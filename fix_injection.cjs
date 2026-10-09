const fs = require('fs');
let c = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

const regexHeader = /<h3 style=\{\{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var\(--text-primary\)' \}\}>\s*\{activeSite\.name\}\s*<\/h3>\s*<span style=\{\{ fontSize: '12px', fontWeight: 700, color: 'var\(--text-muted\)' \}\}>\s*<\/span>\s*<\/div>/g;

const newHeader = `<h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {activeSite.name}
                      </h3>
                      {activeSite.isActive !== false ? (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', backgroundColor: '#10b981', padding: '2px 6px', borderRadius: '4px' }}>🟢 가동중</span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', backgroundColor: '#64748b', padding: '2px 6px', borderRadius: '4px' }}>⚫ 종료(완공)</span>
                      )}
                    </div>`;

c = c.replace(regexHeader, newHeader);

const regexLocation = /<div style=\{\{ fontSize: '11\.5px', color: 'var\(--text-muted\)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' \}\}>\s*<MapPin size=\{12\} \/> \{activeSite\.address \|\| '주소 미등록'\}\s*<\/div>\s*<\/div>\s*<\/div>/g;

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

c = c.replace(regexLocation, newLocation);

fs.writeFileSync('src/pages/SiteOptionManage.tsx', c);
console.log('Fixed UI Injection');
