with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

spec_start = text.find('{/* 3. 현장 요구 사양 (SPEC) 섹션 */}')
spec_end = text.find('{/* ──────────────────────────────────────────────────────── */}')

spec_new = '''{/* 3. 현장 요구 사양 (SPEC) 섹션 */}
                  <div data-mid="card-spec-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckSquare size={15} color="#d97706" /> 3. 현장 요구 사양 (SPEC)
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        * 안전인증, 경광등, 센서 연동 등 필수 사양 점검
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleToggleOption(e.target.value);
                        }}
                        style={{ height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px', minWidth: '220px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                      >
                        <option value="" disabled>+ 현장에 추가할 사양 마스터 선택...</option>
                        {workingOptionItems.filter(item => item.category === 'SPEC' && !item.isEnabled).map(item => (
                          <option key={item.optionId} value={item.optionId}>{item.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setActiveTab('MASTER_OPTIONS')} style={{ fontSize: '11px', padding: '0 10px', height: '30px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 700 }}>
                        마스터 품목 관리
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
{workingOptionItems.filter(item => item.category === 'SPEC' && item.isEnabled).length === 0 ? (
  <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <span>현장에 적용된 요구 사양이 없습니다. 상단의 드롭다운에서 등록된 마스터 품목을 선택하여 추가해주세요.</span>
    </div>
  </div>
) : (
  workingOptionItems.filter(item => item.category === 'SPEC' && item.isEnabled).map(item => {
    return (
      <div
        key={item.id}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 10px 6px 6px', borderRadius: '8px',
          border: '1.5px solid #d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.08)',
        }}
      >
        <button
          type="button"
          onClick={() => handleToggleOption(item.optionId)}
          style={{ cursor: 'pointer', border: 'none', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
          title="사양 제외"
        >
          <X size={14} strokeWidth={3} />
        </button>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#b45309' }}>
          {item.name}
        </span>
      </div>
    );
  })
)}
                    </div>
                  </div>

                </div>

                '''

text = text[:spec_start] + spec_new + text[spec_end:]

with open('src/pages/SiteOptionManage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SPEC section updated.")
