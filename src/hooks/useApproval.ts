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
      const { data: ruleData } = await supabase.from('approval_rules').select('event_code, required_tier').eq('id', ruleId).single();
      const targetTier = escalatedTier ?? (ruleData?.required_tier || 0);

      // 🛡️ FK 무결성 보장: sys-admin, usr-admin 등 가상 계정 방어 및 실제 DB 사용자(u-1 등) 매핑
      const VIRTUAL_USER_IDS = new Set(['sys-admin', 'usr-admin', 'sys-anon', 'system', 'admin']);
      const isValidUser = originatorId && !VIRTUAL_USER_IDS.has(originatorId) && (db.users || []).some((u: any) => u && u.id === originatorId && !VIRTUAL_USER_IDS.has(u.id));
      const safeOriginatorId = isValidUser ? originatorId : ((db.users || []).find((u: any) => u && u.id === 'u-1')?.id || (db.users || []).find((u: any) => u && !VIRTUAL_USER_IDS.has(u.id))?.id || null);

      const insertObj: any = {
        rule_id: ruleId,
        event_code: ruleData?.event_code || 'APPROVAL_EVENT',
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
      
      // 결재선(approval_steps) 자동 생성 로직 (R&R 및 책임분리 원칙 준수)
      const { data: consensusList } = await supabase
        .from('rule_consensus')
        .select('*')
        .eq('rule_id', ruleId)
        .order('seq_order', { ascending: true });

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

      const originator = usersList.find(u => u.id === safeOriginatorId || u.id === originatorId);
      const origTier = originator ? getUserEffectiveTier(originator).effectiveTier : 0;
      const origDeptId = originator?.departmentId;

      // 🛡️ 책임 분리(Segregation of Duties) & 셀프 승인 방지 원칙:
      // 기안자 본인은 어떠한 결재 스텝에도 승인권자로 참여할 수 없음
      const assignedUserIds = new Set<string>();
      if (originatorId) assignedUserIds.add(originatorId);
      if (safeOriginatorId) assignedUserIds.add(safeOriginatorId);

      // 목표 티어(targetTier) 및 기안자 권한에 따른 다양한 결재선 동역학(Approval Dynamics)
      let milestoneTiers: number[] = [];
      if (targetTier <= 4) {
        if (origTier < 4) {
          milestoneTiers = [4]; // 팀장 전결
        } else {
          // 기안자가 이미 팀장/부장이면 셀프 승인이 불가하므로 상위 임원/대표이사로 자동 에스컬레이션
          milestoneTiers = [Math.min(7, Math.max(origTier + 1, 6))];
        }
      } else if (targetTier <= 6) {
        if (origTier < 4) {
          milestoneTiers = [4, targetTier]; // 1차 팀장 심사 ➔ 2차 임원 전결
        } else if (origTier < targetTier) {
          milestoneTiers = [targetTier]; // 임원 전결
        } else {
          milestoneTiers = [7]; // 대표이사 최종 결재로 에스컬레이션
        }
      } else {
        // targetTier === 7 (중대/대표이사 결재)
        if (origTier < 4) {
          milestoneTiers = [4, 7]; // 1차 팀장 심사 ➔ 2차 대표이사 최종 승인
        } else {
          milestoneTiers = [7]; // 대표이사 최종 승인
        }
      }

      // 헬퍼: 결재권자 탐색 (기안자 제외, 중복 배정 제외, 조직 지휘선 우선)
      const findApprover = (minTier: number, targetDeptId?: string | null) => {
        // 1. 합의선 등 지정된 부서가 있는 경우
        if (targetDeptId) {
          const deptApprover = usersList.find(u => 
            !assignedUserIds.has(u.id) && 
            u.departmentId === targetDeptId && 
            getUserEffectiveTier(u).effectiveTier >= minTier
          );
          if (deptApprover) return deptApprover;
        }
        // 2. 기안자 소속 부서 내에서 minTier 이상 & 미할당 결재권자 탐색
        if (origDeptId) {
          const sameDeptApprover = usersList.find(u => 
            !assignedUserIds.has(u.id) && 
            u.departmentId === origDeptId && 
            getUserEffectiveTier(u).effectiveTier >= minTier
          );
          if (sameDeptApprover) return sameDeptApprover;
        }
        // 3. 전사에서 정확한 티어 일치자 탐색
        const exactTierApprover = usersList.find(u => 
          !assignedUserIds.has(u.id) && 
          getUserEffectiveTier(u).effectiveTier === minTier
        );
        if (exactTierApprover) return exactTierApprover;

        // 4. 전사에서 minTier 이상인 자 탐색
        const higherTierApprover = usersList.find(u => 
          !assignedUserIds.has(u.id) && 
          getUserEffectiveTier(u).effectiveTier >= minTier
        );
        if (higherTierApprover) return higherTierApprover;

        // 5. 최고관리자(ADMIN) fallback (단, 기안자 제외)
        const adminFallback = usersList.find(u => 
          !assignedUserIds.has(u.id) && 
          u.role === 'ADMIN'
        );
        if (adminFallback) return adminFallback;

        // 6. 최후 수단: 기안자가 아닌 사용자 중 최고 티어 보유자
        const highestFallback = [...usersList]
          .filter(u => !assignedUserIds.has(u.id))
          .sort((a, b) => getUserEffectiveTier(b).effectiveTier - getUserEffectiveTier(a).effectiveTier)[0];
        return highestFallback || null;
      };

      let stepNum = 1;
      const stepsToInsert: any[] = [];

      for (const t of milestoneTiers) {
        const approver = findApprover(t);
        if (approver) {
          assignedUserIds.add(approver.id);
          stepsToInsert.push({
            request_id: reqData.id,
            step_order: stepNum++,
            step_type: 'APPROVAL',
            approver_id: approver.id,
            approver_name: approver.name,
            approver_tier: t,
            status: stepsToInsert.length === 0 ? 'PENDING' : 'WAITING'
          });

          // 합의선(rule_consensus) 체크: 현재 티어 직후 트리거되는 부서 합의 단계 삽입
          const matchingConsensus = (consensusList || []).filter(c => c.trigger_after_tier === t);
          for (const con of matchingConsensus) {
            const conApprover = findApprover(con.consensus_tier, con.target_dept_id);
            if (conApprover) {
              assignedUserIds.add(conApprover.id);
              stepsToInsert.push({
                request_id: reqData.id,
                step_order: stepNum++,
                step_type: 'CONSENSUS',
                approver_id: conApprover.id,
                approver_name: conApprover.name,
                approver_tier: con.consensus_tier,
                status: 'WAITING'
              });
            }
          }
        }
      }

      // 만약 아무도 배정되지 않았다면 기안자 외의 최고관리자/차상위자 배정
      if (stepsToInsert.length === 0) {
        const fallback = usersList.find(u => !assignedUserIds.has(u.id) && u.role === 'ADMIN') ||
                         usersList.find(u => !assignedUserIds.has(u.id));
        if (fallback) {
          stepsToInsert.push({
            request_id: reqData.id,
            step_order: stepNum++,
            step_type: 'APPROVAL',
            approver_id: fallback.id,
            approver_name: fallback.name,
            approver_tier: targetTier,
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
      
      const { data: stepData } = await supabase.from('approval_steps').select('*').eq('id', stepId).single();
      if (stepData) {
        if (action === 'REJECTED') {
          await supabase.from('approval_requests').update({ status: 'REJECTED' }).eq('id', stepData.request_id);
          // 잔여 대기(WAITING/PENDING) 스텝 전체 취소 마감
          await supabase
            .from('approval_steps')
            .update({ status: 'CANCELLED' })
            .eq('request_id', stepData.request_id)
            .in('status', ['WAITING', 'PENDING']);
        } else if (action === 'APPROVED') {
          // 다음 순번 대기(WAITING) 스텝 조회
          const { data: nextSteps } = await supabase
            .from('approval_steps')
            .select('*')
            .eq('request_id', stepData.request_id)
            .eq('status', 'WAITING')
            .order('step_order', { ascending: true });
          
          if (nextSteps && nextSteps.length > 0) {
            const nextStep = nextSteps[0];
            await supabase.from('approval_steps').update({ status: 'PENDING' }).eq('id', nextStep.id);
            await supabase.from('approval_requests').update({ current_step: nextStep.step_order }).eq('id', stepData.request_id);
          } else {
            // 모든 단계 승인 완료
            await supabase.from('approval_requests').update({ status: 'APPROVED' }).eq('id', stepData.request_id);
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
