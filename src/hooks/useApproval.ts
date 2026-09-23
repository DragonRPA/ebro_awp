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
      return data;
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
