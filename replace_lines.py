import os

filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_footer = """            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <div>
                {editingCust.id && (
                  <button 
                    type="button" 
                    onClick={() => handleDeleteCustomer(editingCust.id!, editingCust.name)} 
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
            </div>
"""

lines[2391:2395] = [new_footer]

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Replaced lines 2392-2395 with new footer")
