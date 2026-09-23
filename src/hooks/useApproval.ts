import { useState, useCallback, useMemo } from 'react';
import { supabase, ApprovalRule, RuleConsensus, ApprovalRequest, ApprovalStep, DelegationRecord } from '../services/db';

export function useApproval() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. 규칙 및 합의 라우팅 조회
  const fetchRuleForEvent = useCallback(async (eventCode: string): Promise<{ rule: ApprovalRule | null, consensus: RuleConsensus[] }> => {
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

  // 2. 기안 생성 (결재 대상 상신)
  const createApprovalRequest = useCallback(async (
    ruleId: string, 
    originatorId: string, 
    targetRecordId: string, 
    targetTable: string,
    escalatedTier?: number
  ) => {
    setLoading(true);
    try {
      const { data, error: reqErr } = await supabase
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
      
      // 실제로는 여기서 수직 결재선(approval_steps)을 originator의 부서/상급자를 조회해 자동 생성해야 함.
      // 본 RWTT 환경에서는 백엔드 트리거 또는 Edge Function으로 처리하거나, 클라이언트에서 계산하여 insert 
      // 여기서는 스켈레톤만 유지하고 상세 로직은 API 단에서 완성된 것으로 가정 (또는 추가 구현)
      
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. 결재 처리 (승인/반려)
  const processApprovalStep = useCallback(async (stepId: string, action: 'APPROVED' | 'REJECTED', comment?: string) => {
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
      
      // 반려 시 ApprovalRequest 전체를 REJECTED로 롤백 (완전 초기화 원칙)
      if (action === 'REJECTED') {
        // 백엔드 트랜잭션/트리거 의존 또는 직접 쿼리
        // 생략...
      }
      
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchRuleForEvent,
    createApprovalRequest,
    processApprovalStep
  };
}
