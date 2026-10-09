const fs = require('fs');
let c = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

const handlerStr = `
  const handleToggleSiteStatus = async (site: any, targetStatus: boolean) => {
    if (!window.confirm(\`[\${site.name}] 현장을 \${targetStatus ? '가동(진행중)' : '종료(완공)'} 상태로 변경하시겠습니까?\\n\\n※ 종료 시, 계약 등록 및 배차 화면의 현장 선택 목록에서 제외됩니다.\`)) return;
    try {
      await saveSiteMaster({ id: site.id, isActive: targetStatus });
      showToast(\`[\${site.name}] 현장이 \${targetStatus ? '가동중' : '완공/종료'} 상태로 변경되었습니다.\`);
    } catch (err: any) {
      showErrorModal('상태 변경 실패: ' + err.message);
    }
  };
`;

c = c.replace('  const handleOpenEditMaster = (site: any) => {', handlerStr + '  const handleOpenEditMaster = (site: any) => {');

// Now inject the UI into the activeSite header
const originalHeader = `<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={17} color="var(--primary)" />
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {activeSite.name}
                      </h3>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      </span>
                    </div>`;

const newHeader = `<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={17} color="var(--primary)" />
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {activeSite.name}
                      </h3>
                      {activeSite.isActive !== false ? (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', backgroundColor: '#10b981', padding: '2px 6px', borderRadius: '4px' }}>가동중</span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', backgroundColor: '#64748b', padding: '2px 6px', borderRadius: '4px' }}>종료(완공)</span>
                      )}
                    </div>`;

const originalLocation = `<div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} /> {activeSite.address || '주소 미등록'}
                    </div>
                  </div>
                </div>`;

const newLocation = `<div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} /> {activeSite.address || '주소 미등록'}
                    </div>
                  </div>
                  
                  {/* 종결 버튼 영역 */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {activeSite.isActive !== false ? (
                      <button
                        onClick={() => handleToggleSiteStatus(activeSite, false)}
                        style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <PowerOff size={14} /> 현장 완공(종료) 처리
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleSiteStatus(activeSite, true)}
                        style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700, backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Power size={14} /> 현장 가동(진행) 전환
                      </button>
                    )}
                  </div>
                </div>`;

c = c.replace(originalHeader, newHeader);
c = c.replace(originalLocation, newLocation);

fs.writeFileSync('src/pages/SiteOptionManage.tsx', c);
console.log('Injected UI');
