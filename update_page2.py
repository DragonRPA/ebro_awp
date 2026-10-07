import re

filepath = 'src/pages/SiteOptionManage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

if 'deleteStandardOption,' not in content:
    content = content.replace('saveStandardOption,', 'saveStandardOption, deleteStandardOption,')

if 'masterSortConfig' not in content:
    state_injection = """
  // --- Master Option Sort ---
  type SortKey = keyof StandardOption;
  const [masterSortConfig, setMasterSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' | null }>({ key: 'sortOrder', direction: null });

  const sortedStandardOptions = useMemo(() => {
    let sorted = [...(standardOptions || [])];
    if (masterSortConfig.direction !== null) {
      sorted.sort((a, b) => {
        let valA: any = a[masterSortConfig.key];
        let valB: any = b[masterSortConfig.key];
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return masterSortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return masterSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [standardOptions, masterSortConfig]);

  const handleMasterSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (masterSortConfig.key === key && masterSortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (masterSortConfig.key === key && masterSortConfig.direction === 'desc') {
      direction = null;
    }
    setMasterSortConfig({ key, direction });
  };
  // --------------------------
"""
    search_str = "const [searchSiteKeyword, setSearchSiteKeyword] = useState<string>('');"
    content = content.replace(search_str, search_str + "\n" + state_injection)

content = content.replace("{(standardOptions || []).map(opt => {", "{sortedStandardOptions.map(opt => {")

content = content.replace(
    "<th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '12%' }}>분류</th>",
    "<th onClick={() => handleMasterSort('category')} style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '12%', cursor: 'pointer' }}>분류{masterSortConfig.key === 'category' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>"
)
content = content.replace(
    "<th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '25%' }}>옵션 품목명</th>",
    "<th onClick={() => handleMasterSort('name')} style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '25%', cursor: 'pointer' }}>옵션 품목명{masterSortConfig.key === 'name' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>"
)
content = content.replace(
    "<th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '15%' }}>기준단가</th>",
    "<th onClick={() => handleMasterSort('defaultPrice')} style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '15%', cursor: 'pointer' }}>기준단가{masterSortConfig.key === 'defaultPrice' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>"
)
content = content.replace(
    "<th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '8%' }}>단위</th>",
    "<th onClick={() => handleMasterSort('unit')} style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '8%', cursor: 'pointer' }}>단위{masterSortConfig.key === 'unit' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>"
)
content = content.replace(
    "<th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '25%' }}>설명</th>",
    "<th onClick={() => handleMasterSort('description')} style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '25%', cursor: 'pointer' }}>설명{masterSortConfig.key === 'description' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>"
)
content = content.replace(
    "<th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '8%' }}>상태</th>",
    "<th onClick={() => handleMasterSort('isActive')} style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)', width: '8%', cursor: 'pointer' }}>상태{masterSortConfig.key === 'isActive' ? (masterSortConfig.direction === 'asc' ? ' \u25b2' : masterSortConfig.direction === 'desc' ? ' \u25bc' : '') : ''}</th>"
)

old_buttons = """              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowMasterModal(false);
                    setEditingMasterOption(null);
                  }}"""

new_buttons = """              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
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
content = content.replace(old_buttons, new_buttons)

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
print("Updated SiteOptionManage.tsx")
