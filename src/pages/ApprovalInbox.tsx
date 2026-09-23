import React, { useState, useEffect } from 'react';
import { supabase } from '../services/db';
import { useApp } from '../context/AppContext';

const ApprovalInbox: React.FC = () => {
  const { currentUser } = useApp();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInbox = async () => {
    if (!user) return;
    setLoading(true);
    // 내게 할당된 대기 중인 결재 단계 조회
    const { data } = await supabase
      .from('approval_steps')
      .select(`
        *,
        approval_requests (
          target_table,
          target_record_id,
          status,
          rule_id,
          approval_rules ( event_name )
        )
      `)
      .eq('approver_id', currentUser.id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });
    
    if (data) setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchInbox();
  }, [currentUser]);

  const handleAction = async (stepId: string, action: 'APPROVED' | 'REJECTED') => {
    const confirmMsg = action === 'APPROVED' ? '승인하시겠습니까?' : '반려하시겠습니까? (기안이 원점으로 돌아갑니다)';
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    const { error } = await supabase
      .from('approval_steps')
      .update({ status: action, acted_at: new Date().toISOString() })
      .eq('id', stepId);
      
    if (error) {
      alert('오류: ' + error.message);
    } else {
      // NOTE: 백엔드 트리거가 approval_requests 상태와 다음 단계를 업데이트해야 함
      alert(action === 'APPROVED' ? '승인되었습니다.' : '반려되었습니다.');
      fetchInbox();
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>내 결재함 (수신)</h2>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead style={{ backgroundColor: '#f1f5f9' }}>
          <tr>
            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>요청일시</th>
            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>결재 종류</th>
            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>대상 건 (ID)</th>
            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>타입</th>
            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>조치</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(r => {
            const req = r.approval_requests;
            const ruleName = req?.approval_rules?.event_name || '알 수 없음';
            
            return (
              <tr key={r.id}>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{new Date(r.created_at).toLocaleString()}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{ruleName}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{req?.target_record_id}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                  {r.step_type === 'CONSENSUS' ? '합의' : '결재'}
                </td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                  <button onClick={() => handleAction(r.id, 'APPROVED')} disabled={loading} style={{ marginRight: '8px', padding: '4px 12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    승인
                  </button>
                  <button onClick={() => handleAction(r.id, 'REJECTED')} disabled={loading} style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    반려
                  </button>
                </td>
              </tr>
            );
          })}
          {requests.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#888' }}>대기 중인 결재 건이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ApprovalInbox;
