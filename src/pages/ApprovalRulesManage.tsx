import React, { useState, useEffect } from 'react';
import { supabase, ApprovalRule } from '../services/db';

const ApprovalRulesManage: React.FC = () => {
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [newEventCode, setNewEventCode] = useState('');
  const [newEventName, setNewEventName] = useState('');
  const [newReqTier, setNewReqTier] = useState(0);

  const fetchRules = async () => {
    setLoading(true);
    const { data } = await supabase!.from('approval_rules').select('*').order('created_at', { ascending: false });
    if (data) setRules(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleAddRule = async () => {
    if (!newEventCode || !newEventName) return alert('이벤트 코드와 명칭을 입력하세요.');
    setLoading(true);
    const { error } = await supabase!.from('approval_rules').insert({
      event_code: newEventCode,
      event_name: newEventName,
      required_tier: newReqTier,
      is_enabled: true
    });
    if (error) alert('오류: ' + error.message);
    else {
      setNewEventCode('');
      setNewEventName('');
      setNewReqTier(0);
      fetchRules();
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    await supabase!.from('approval_rules').update({ is_enabled: !current }).eq('id', id);
    fetchRules();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>결재선 규칙 설정</h2>
      
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>이벤트 코드</label>
            <input value={newEventCode} onChange={e => setNewEventCode(e.target.value)} placeholder="예: ASSET_DISPOSAL" style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>업무 이벤트명</label>
            <input value={newEventName} onChange={e => setNewEventName(e.target.value)} placeholder="예: 자산 매각" style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
          </div>
          <div style={{ width: '100px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>요구 티어(0~7)</label>
            <input type="number" min="0" max="7" value={newReqTier} onChange={e => setNewReqTier(parseInt(e.target.value) || 0)} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
          </div>
        </div>
        <button onClick={handleAddRule} disabled={loading} style={{ padding: '10px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          신규 규칙 추가
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead style={{ backgroundColor: '#f1f5f9' }}>
          <tr>
            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>이벤트 코드</th>
            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>이벤트명</th>
            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>요구 티어</th>
            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>사용 여부</th>
          </tr>
        </thead>
        <tbody>
          {rules.map(r => (
            <tr key={r.id}>
              <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{r.event_code}</td>
              <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{r.event_name}</td>
              <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'center' }}>{r.required_tier}</td>
              <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                <button onClick={() => handleToggle(r.id!, r.is_enabled)} style={{ padding: '4px 12px', backgroundColor: r.is_enabled ? '#10b981' : '#ccc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  {r.is_enabled ? 'ON' : 'OFF'}
                </button>
              </td>
            </tr>
          ))}
          {rules.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>설정된 결재선 규칙이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ApprovalRulesManage;
