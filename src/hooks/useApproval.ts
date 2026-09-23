import { useState, useCallback } from 'react';
import { supabase, ApprovalRule, RuleConsensus, ApprovalRequest, ApprovalStep } from '../services/db';

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
    escalatedTier?: number
  ) => {
    if (!supabase) throw new Error('Supabase Client not initialized');
    setLoading(true);
    try {
      const { data: ruleData } = await supabase.from('approval_rules').select('required_tier').eq('id', ruleId).single();
      const targetTier = escalatedTier ?? (ruleData?.required_tier || 0);

      const { data: reqData, error: reqErr } = await supabase
        .from('approval_requests')
        .insert({
          rule_id: ruleId,
          originator_id: originatorId,
          target_record_id: targetRecordId,
          target_table: targetTable,
          escalated_tier: escalatedTier,
          status: 'PENDING',
          current_step: 1
        })
        .select()
        .single();
        
      if (reqErr) throw reqErr;
      
      // 결재선(approval_steps) 자동 생성 로직
      const { data: usersData } = await supabase.from('users').select('*');
      const originator = usersData?.find(u => u.id === originatorId);
      const currentTier = originator?.tier_level || 0;
      
      let stepNum = 1;
      const stepsToInsert = [];
      
      // 요구 티어까지 수직 결재선(1->3->5->7 등) 생성
      const allTiers = [1, 3, 5, 7];
      const requiredTiers = allTiers.filter(t => t > currentTier && t <= targetTier);
      if (requiredTiers.length === 0 && targetTier > currentTier) {
         requiredTiers.push(targetTier);
      }
      
      for (const t of requiredTiers) {
         // 실제 환경에서는 부서 정보 등을 매칭해야 하지만 RWTT를 위해 해당 티어 사용자 탐색
         const approver = usersData?.find(u => (u.tier_level || 0) === t) || usersData?.find(u => u.role === 'ADMIN');
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
         const admin = usersData?.find(u => u.role === 'ADMIN');
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
