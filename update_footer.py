import os

filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCustModal(false)} style={{ padding: '5px 14px', fontSize: '12px' }}>취소</button>
                <button type="submit" className="btn-primary" style={{ padding: '5px 16px', fontSize: '12px' }}>저장</button>
              </div>"""

replacement = """              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
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
              </div>"""

content = content.replace(target, replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Footer replaced successfully")
