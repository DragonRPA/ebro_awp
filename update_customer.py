import os
import re

filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

func_code = """  const handleDeleteCustomer = async (custId: string, custName: string) => {
    const input = window.prompt(`고객사를 삭제하시려면 아래에 정확히 입력해주세요:\\n"${custName} 삭제"`);
    if (input !== `${custName} 삭제`) {
      if (input !== null) {
        showToast('입력한 텍스트가 일치하지 않아 삭제가 취소되었습니다.', 'error');
      }
      return;
    }

    try {
      const { error } = await supabase.from('customers').delete().eq('id', custId);
      if (error) throw error;
      
      showToast(`고객사 [${custName}] 데이터가 삭제되었습니다.`);
      setShowCustModal(false);
      
      // if selected customer is deleted, clear it
      if (selectedCustomerId === custId) {
        setSelectedCustomerId(null);
      }
      await refreshAllData();
    } catch (err: any) {
      if (err?.code === '23503') {
        showToast('이 고객사와 연결된 하위 데이터(현장, 계약 등)가 존재하여 삭제할 수 없습니다.', 'error');
      } else {
        showToast(`삭제 실패: ${err?.message || err}`, 'error');
      }
    }
  };

  const handleDeleteContact"""

content = content.replace("  const handleDeleteContact", func_code)

target_footer = r"""              <div style=\{\{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var\(--border-color\)' \}\}>
                <button type="button" className="btn-secondary" onClick=\{\(\) => setShowCustModal\(false\)\} style=\{\{ padding: '5px 14px', fontSize: '12px' \}\}>취소</button>
                <button type="submit" className="btn-primary" style=\{\{ padding: '5px 16px', fontSize: '12px' \}\}>저장</button>
              </div>"""

replacement_footer = """              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <div>
                  {editingCust.id && (
                    <button 
                      type="button" 
                      onClick={() => handleDeleteCustomer(editingCust.id, editingCust.name)} 
                      style={{ padding: '5px 14px', fontSize: '12px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      고객사 삭제
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowCustModal(false)} style={{ padding: '5px 14px', fontSize: '12px' }}>취소</button>
                  <button type="submit" className="btn-primary" style={{ padding: '5px 16px', fontSize: '12px' }}>저장</button>
                </div>
              </div>"""

content = re.sub(target_footer, replacement_footer, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Customers.tsx")
