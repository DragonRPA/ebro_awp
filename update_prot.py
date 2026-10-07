with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

prot_start = text.find('{/* 2. 보양 작업 (PROTECTION) 섹션 */}')
prot_end = text.find('{/* 3. 현장 요구 사양 (SPEC) 섹션 */}')

prot_new = '''{/* 2. 보양 작업 (PROTECTION) 섹션 */}
                  <div data-mid="card-protection-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={15} color="#059669" /> 2. 보양 작업 (PROTECTION) - 1종 선택
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        * 현장 환경에 따른 보호 완충/함석 보양 규격 지정
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <select
                        value={workingOptionItems.find(i => i.category === 'PROTECTION' && i.isEnabled)?.optionId || ""}
                        onChange={(e) => handleSelectProtection(e.target.value)}
                        style={{ height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px', minWidth: '220px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                      >
                        <option value="" disabled>현장에 적용할 보양 작업 마스터 선택...</option>
                        {workingOptionItems.filter(item => item.category === 'PROTECTION').map(item => (
                          <option key={item.optionId} value={item.optionId}>{item.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => handleSelectProtection('')} style={{ fontSize: '11px', padding: '0 10px', height: '30px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 700 }}>
                        적용 해제
                      </button>
                      <button type="button" onClick={() => setActiveTab('MASTER_OPTIONS')} style={{ fontSize: '11px', padding: '0 10px', height: '30px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 700 }}>
                        마스터 품목 관리
                      </button>
                    </div>
                  </div>

                  '''

text = text[:prot_start] + prot_new + text[prot_end:]

with open('src/pages/SiteOptionManage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("PROTECTION section updated.")
