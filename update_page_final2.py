import re

filepath = 'src/pages/SiteOptionManage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix layout
grid_pattern = re.compile(r"style=\{\{\s*display:\s*'grid',\s*gridTemplateColumns:\s*'320px 1fr',\s*gap:\s*'14px',\s*minHeight:\s*'620px'\s*\}\}")
content = grid_pattern.sub(
    "style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '14px', height: 'calc(100vh - 180px)', minHeight: '500px' }}",
    content
)

panel_pattern = re.compile(r"(backgroundColor:\s*'var\(--bg-card\)',\s*borderRadius:\s*'12px',\s*border:\s*'1px solid var\(--border-color\)',\s*display:\s*'flex',\s*flexDirection:\s*'column',\s*boxShadow:\s*'0 1px 3px rgba\(0,0,0,0\.04\)')")
content = panel_pattern.sub(
    r"\1, overflow: 'hidden'",
    content
)

# 3. Replace the <th> tags with sorting logic
content = re.sub(r"<th style=\{\{\s*padding:\s*'9px 12px',\s*width:\s*'80px'\s*\}\}>분류</th>", 
                 "<th onClick={() => handleMasterSort('category')} style={{ padding: '9px 12px', width: '80px', cursor: 'pointer' }}>분류{masterSortConfig.key === 'category' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>", content)

content = re.sub(r"<th style=\{\{\s*padding:\s*'9px 12px',\s*width:\s*'220px'\s*\}\}>옵션 품목명</th>", 
                 "<th onClick={() => handleMasterSort('name')} style={{ padding: '9px 12px', width: '220px', cursor: 'pointer' }}>옵션 품목명{masterSortConfig.key === 'name' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>", content)

content = re.sub(r"<th style=\{\{\s*padding:\s*'9px 12px',\s*width:\s*'110px'\s*\}\}>기준단가</th>", 
                 "<th onClick={() => handleMasterSort('defaultPrice')} style={{ padding: '9px 12px', width: '110px', cursor: 'pointer' }}>기준단가{masterSortConfig.key === 'defaultPrice' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>", content)

content = re.sub(r"<th style=\{\{\s*padding:\s*'9px 12px',\s*width:\s*'70px'\s*\}\}>단위</th>", 
                 "<th onClick={() => handleMasterSort('unit')} style={{ padding: '9px 12px', width: '70px', cursor: 'pointer' }}>단위{masterSortConfig.key === 'unit' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>", content)

content = re.sub(r"<th style=\{\{\s*padding:\s*'9px 12px'\s*\}\}>설명</th>", 
                 "<th onClick={() => handleMasterSort('description')} style={{ padding: '9px 12px', cursor: 'pointer' }}>설명{masterSortConfig.key === 'description' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>", content)

content = re.sub(r"<th style=\{\{\s*padding:\s*'9px 12px',\s*width:\s*'80px',\s*textAlign:\s*'center'\s*\}\}>상태</th>", 
                 "<th onClick={() => handleMasterSort('isActive')} style={{ padding: '9px 12px', width: '80px', textAlign: 'center', cursor: 'pointer' }}>상태{masterSortConfig.key === 'isActive' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>", content)

# 4. Inject Delete button next to Cancel button
cancel_btn_pattern = re.compile(r"(<div\s+style=\{\{\s*display:\s*'flex',\s*justifyContent:\s*'flex-end',\s*gap:\s*'8px',\s*marginTop:\s*'10px'\s*\}\}>\s*<button\s+type=\"button\"\s+onClick=\{\(\) => \{\s*setShowMasterModal\(false\);\s*setEditingMasterOption\(null\);\s*\}\})")

new_btns = r"""<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
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

content = cancel_btn_pattern.sub(new_btns.replace('\\', '\\\\'), content)

form_close_pattern = re.compile(r"(</button>\s*</div>\s*</form>)")
content = form_close_pattern.sub(r"</button></div></div></form>", content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated SiteOptionManage.tsx")

