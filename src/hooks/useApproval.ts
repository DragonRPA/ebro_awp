import { useState, useCallback } from 'react';
import { db, supabase, ApprovalRule, RuleConsensus, ApprovalRequest, ApprovalStep, ApprovalPayload, getUserEffectiveTier } from '../services/db';

export function useApproval() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuleForEvent = useCallback(async (eventCode: string): Promise<{ rule: ApprovalRule | null, consensus: RuleConsensus[] }> => {
    if (!supabase) throw new Error('Supabase Client not initialized');
    setLoading(true);
    try {
      const { data: ruleData, error: ruleErr } = await supabase
        .from('approval_rules')
        .select('*')
        .eq('event_code', eventCode)
        .eq('is_enabled', true)
        .single();
        
      if (ruleErr && ruleErr.code !== 'PGRST116') throw ruleErr;
      if (!ruleData) return { rule: null, consensus: [] };

      const { data: consensusData, error: conErr } = await supabase
        .from('rule_consensus')
        .select('*')
        .eq('rule_id', ruleData.id)
        .order('seq_order', { ascending: true });
        
      if (conErr) throw conErr;
      
      return { rule: ruleData, consensus: consensusData || [] };
    } catch (err: any) {
      setError(err.message);
      return { rule: null, consensus: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  const createApprovalRequest = useCallback(async (
    ruleId: string, 
    originatorId: string, 
    targetRecordId: string, 
    targetTable: string,
    escalatedTier?: number,
    payload?: ApprovalPayload
  ) => {
    if (!supabase) throw new Error('Supabase Client not initialized');
    setLoading(true);
    try {
      const { data: ruleData } = await supabase.from('approval_rules').select('required_tier').eq('id', ruleId).single();
      const targetTier = escalatedTier ?? (ruleData?.required_tier || 0);

      // 🛡️ FK 무결성 보장: sys-admin, usr-admin 등 가상 계정 방어 및 실제 DB 사용자(u-1 등) 매핑
      const VIRTUAL_USER_IDS = new Set(['sys-admin', 'usr-admin', 'sys-anon', 'system', 'admin']);
      const isValidUser = originatorId && !VIRTUAL_USER_IDS.has(originatorId) && (db.users || []).some((u: any) => u && u.id === originatorId && !VIRTUAL_USER_IDS.has(u.id));
      const safeOriginatorId = isValidUser ? originatorId : ((db.users || []).find((u: any) => u && u.id === 'u-1')?.id || (db.users || []).find((u: any) => u && !VIRTUAL_USER_IDS.has(u.id))?.id || null);

      const insertObj: any = {
        rule_id: ruleId,
        originator_id: safeOriginatorId,
        target_record_id: targetRecordId,
        target_table: targetTable,
        escalated_tier: escalatedTier,
        status: 'PENDING',
        current_step: 1
      };
      if (payload) {
        insertObj.payload = payload;
      }

      let reqData: any = null;
      const { data: inserted, error: reqErr } = await supabase
        .from('approval_requests')
        .insert(insertObj)
        .select()
        .single();
        
      if (reqErr) {
        // 혹시 supabase 컬럼에 payload가 없어 42703 (undefined column) 에러 발생 시 fallback
        if (payload && (reqErr.code === '42703' || reqErr.message?.includes('payload'))) {
          delete insertObj.payload;
          const { data: fallbackInserted, error: fbErr } = await supabase
            .from('approval_requests')
            .insert(insertObj)
            .select()
            .single();
          if (fbErr) throw fbErr;
          reqData = fallbackInserted;
        } else {
          throw reqErr;
        }
      } else {
        reqData = inserted;
      }

      // 로컬 캐시 및 영구 보존용 localStorage 동기화
      if (reqData && payload) {
        try {
          localStorage.setItem(`approval_payload_${reqData.id}`, JSON.stringify(payload));
        } catch {}
      }
      
      // 결재선(approval_steps) 자동 생성 로직 (R&R 기반 직책 티어 우선 판정)
      let usersList: any[] = [];
      const { data: usersData } = await supabase.from('users').select('*');
      if (usersData && usersData.length > 0) {
        usersList = [...usersData];
      }
      // 로컬스토리지 erp_users와 지능형 병합하여 최신 duty, position, tier_level 완벽 보존
      try {
        const rawLocalUsers = localStorage.getItem('erp_users');
        if (rawLocalUsers) {
          const localUsers = JSON.parse(rawLocalUsers);
          usersList = usersList.map(u => {
            const matched = localUsers.find((lu: any) => lu.id === u.id);
            return matched ? { ...u, duty: matched.duty || u.duty, position: matched.position || u.position, tier_level: matched.tier_level ?? u.tier_level } : u;
          });
          localUsers.forEach((lu: any) => {
            if (!usersList.some(u => u.id === lu.id)) usersList.push(lu);
          });
        }
      } catch {}

      const originator = usersList.find(u => u.id === originatorId);
      const currentTier = originator ? getUserEffectiveTier(originator).effectiveTier : 0;
      
      let stepNum = 1;
      const stepsToInsert = [];
      
      // 요구 티어까지 수직 결재선(1->3->5->7 등) 생성
      const allTiers = [1, 3, 5, 7];
      const requiredTiers = allTiers.filter(t => t > currentTier && t <= targetTier);
      if (requiredTiers.length === 0 && targetTier > currentTier) {
         requiredTiers.push(targetTier);
      }
      
      for (const t of requiredTiers) {
         // 직책/직급 기반 유효 티어가 t 이상인 결재권자 탐색 (직책 우선)
         const approver = usersList.find(u => getUserEffectiveTier(u).effectiveTier === t) 
           || usersList.find(u => getUserEffectiveTier(u).effectiveTier >= t) 
           || usersList.find(u => u.role === 'ADMIN');
         if (approver) {
            stepsToInsert.push({
               request_id: reqData.id,
               step_order: stepNum++,
               step_type: 'APPROVAL',
               approver_id: approver.id,
               required_tier: t,
               status: 'PENDING'
            });
         }
      }
      
      // 만약 아무도 배정되지 않았다면 최고관리자(admin) 강제 배정
      if (stepsToInsert.length === 0) {
         const admin = usersList.find(u => u.role === 'ADMIN');
         if (admin) {
            stepsToInsert.push({
               request_id: reqData.id,
               step_order: stepNum++,
               step_type: 'APPROVAL',
               approver_id: admin.id,
               required_tier: targetTier,
               status: 'PENDING'
            });
         }
      }
      
      if (stepsToInsert.length > 0) {
         await supabase.from('approval_steps').insert(stepsToInsert);
      }

      return reqData;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const processApprovalStep = useCallback(async (stepId: string, action: 'APPROVED' | 'REJECTED', comment?: string) => {
    if (!supabase) throw new Error('Supabase Client not initialized');
    setLoading(true);
    try {
      const { error: stepErr } = await supabase
        .from('approval_steps')
        .update({
          status: action,
          comment: comment,
          acted_at: new Date().toISOString()
        })
        .eq('id', stepId);
        
      if (stepErr) throw stepErr;
      
      // 만약 최종 단계 승인이거나 반려일 경우 approval_requests 상태 업데이트 로직 추가
      // (RWTT 환경이므로 간단히 Edge Function 대신 여기서 직접 처리)
      const { data: stepData } = await supabase.from('approval_steps').select('*').eq('id', stepId).single();
      if (stepData) {
        if (action === 'REJECTED') {
          await supabase.from('approval_requests').update({ status: 'REJECTED' }).eq('id', stepData.request_id);
        } else if (action === 'APPROVED') {
          // 남은 대기 스텝이 있는지 확인
          const { data: remainingSteps } = await supabase.from('approval_steps')
            .select('id')
            .eq('request_id', stepData.request_id)
            .eq('status', 'PENDING');
          
          if (!remainingSteps || remainingSteps.length === 0) {
            await supabase.from('approval_requests').update({ status: 'APPROVED' }).eq('id', stepData.request_id);
          } else {
            await supabase.from('approval_requests').update({ current_step: stepData.step_order + 1 }).eq('id', stepData.request_id);
          }
        }
      }

      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, fetchRuleForEvent, createApprovalRequest, processApprovalStep };
}
