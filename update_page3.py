import re

filepath = 'src/pages/SiteOptionManage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix layout to keep Save button pinned
content = content.replace(
    "<div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '14px', minHeight: '620px' }}>",
    "<div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '14px', height: 'calc(100vh - 180px)', minHeight: '500px' }}>"
)

content = content.replace(
    """            {/* 우측: 현장별 옵션 상세 작업 (70%) */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>""",
    """            {/* 우측: 현장별 옵션 상세 작업 (70%) */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              overflow: 'hidden'
            }}>"""
)

# Fix sorting headers
headers = [
    ("분류", "12%", "category"),
    ("옵션 품목명", "25%", "name"),
    ("기준단가", "15%", "defaultPrice"),
    ("단위", "8%", "unit"),
    ("설명", "25%", "description"),
]

for label, width, key in headers:
    old_th = f"<th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '{width}' }}>{label}</th>"
    new_th = f"<th onClick={{() => handleMasterSort('{key}')}} style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '{width}', cursor: 'pointer' }}>{label}{{masterSortConfig.key === '{key}' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}}</th>"
    content = content.replace(old_th, new_th)

content = content.replace(
    "<th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '8%' }}>상태</th>",
    "<th onClick={() => handleMasterSort('isActive')} style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '8%', cursor: 'pointer' }}>상태{masterSortConfig.key === 'isActive' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>"
)

# Fix Delete button
old_btns = """              {/* 하단 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowMasterModal(false);
                    setEditingMasterOption(null);
                  }}"""

new_btns = """              {/* 하단 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <div>
                  {editingMasterOption.id && (
                    <button
                      type="button"
                      data-hs-trigger="Delete"
                      onClick={async () => {
                        if (confirm('이 옵션 품목 마스터를 삭제하시겠습니까?')) {
                          try {
                            await deleteStandardOption(editingMasterOption.id!);
                            setShowMasterModal(false);
                            setEditingMasterOption(null);
                            await fullRefreshFromServer();
                          } catch (err: any) {
                            showErrorModal(`삭제 실패: ${err.message}`);
                          }
                        }
                      }}
                      style={{
                        padding: '7px 14px', borderRadius: '6px', border: '1px solid #ef4444', 
                        color: '#ef4444', backgroundColor: 'transparent', fontSize: '12.5px', cursor: 'pointer'
                      }}
                    >
                      삭제
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowMasterModal(false);
                    setEditingMasterOption(null);
                  }}"""
content = content.replace(old_btns, new_btns)

old_close = """                </button>
              </div>
            </form>"""
new_close = """                </button>
                </div>
              </div>
            </form>"""
content = content.replace(old_close, new_close)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Layout and Headers/Delete buttons.")
