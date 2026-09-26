import React, { useState, useEffect } from 'react';
import { db, supabase } from '../services/db';
import { BookOpen, Save, RefreshCw, Plus, Trash2, ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ManualsManage: React.FC = () => {
  const { currentTenant } = useApp();
  const [manuals, setManuals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchManuals = async () => {
    setLoading(true);
    const { data, error } = await supabase!
      .from('system_manuals')
      .select('*')
      .eq('tenant_id', currentTenant)
      .order('menu_id');
    if (error) {
      showToast('매뉴얼 목록을 불러오는데 실패했습니다.', 'error');
    } else {
      setManuals(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchManuals();
  }, [currentTenant]);

  const addRow = () => {
    setManuals([...manuals, { id: 'NEW_' + Date.now(), menu_id: '', manual_url: '', isNew: true }]);
  };

  const updateRow = (index: number, field: string, value: string) => {
    const newManuals = [...manuals];
    newManuals[index] = { ...newManuals[index], [field]: value };
    setManuals(newManuals);
  };

  const saveRow = async (index: number) => {
    const row = manuals[index];
    if (!row.menu_id || !row.manual_url) {
      showToast('메뉴 ID와 매뉴얼 URL을 모두 입력해주세요.', 'error');
      return;
    }

    const { data, error } = await supabase!
      .from('system_manuals')
      .upsert({
        id: row.isNew ? undefined : row.id,
        tenant_id: currentTenant,
        menu_id: row.menu_id,
        manual_url: row.manual_url,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id,menu_id' })
      .select()
      .single();

    if (error) {
      showToast('저장 실패: ' + error.message, 'error');
    } else {
      showToast('저장되었습니다.');
      fetchManuals();
    }
  };

  const deleteRow = async (index: number) => {
    const row = manuals[index];
    if (row.isNew) {
      const newManuals = [...manuals];
      newManuals.splice(index, 1);
      setManuals(newManuals);
      return;
    }
    if (!confirm('해당 메뉴의 매뉴얼 연결을 삭제하시겠습니까?')) return;

    const { error } = await supabase!
      .from('system_manuals')
      .delete()
      .eq('id', row.id);

    if (error) {
      showToast('삭제 실패: ' + error.message, 'error');
    } else {
      showToast('삭제되었습니다.');
      fetchManuals();
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontWeight: '700', fontSize: '18px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={20} color="#0ea5e9" />
          메뉴별 매뉴얼 매핑 관리
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchManuals} className="btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            새로고침
          </button>
          <button onClick={addRow} className="btn-primary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} />
            새 연결 추가
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '16px', overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', minWidth: '800px' }}>
          <thead>
            <tr>
              <th style={{ width: '200px' }}>메뉴 ID (메뉴코드)</th>
              <th>매뉴얼 HTML/URL (cf 주소 등)</th>
              <th style={{ width: '80px', textAlign: 'center' }}>테스트</th>
              <th style={{ width: '120px', textAlign: 'center' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {manuals.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>등록된 매뉴얼 매핑이 없습니다.</td></tr>
            ) : (
              manuals.map((m, idx) => (
                <tr key={m.id}>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      value={m.menu_id}
                      onChange={(e) => updateRow(idx, 'menu_id', e.target.value)}
                      placeholder="예: customer"
                      disabled={!m.isNew}
                      style={{ width: '100%', padding: '6px' }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      value={m.manual_url}
                      onChange={(e) => updateRow(idx, 'manual_url', e.target.value)}
                      placeholder="예: https://cf.domain.com/manuals/customer.html"
                      style={{ width: '100%', padding: '6px' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {m.manual_url && (
                      <a href={m.manual_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9' }}>
                        <ExternalLink size={18} />
                      </a>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button onClick={() => saveRow(idx)} className="btn-icon" title="저장" style={{ color: '#10b981' }}><Save size={16} /></button>
                      <button onClick={() => deleteRow(idx)} className="btn-icon" title="삭제" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          backgroundColor: toastMessage.type === 'success' ? '#10B981' : '#EF4444',
          color: 'white', padding: '12px 20px', borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 9999, fontWeight: 'bold'
        }}>
          {toastMessage.text}
        </div>
      )}
    </div>
  );
};
