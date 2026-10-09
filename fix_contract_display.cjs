const fs = require('fs');

let c = fs.readFileSync('src/pages/Contracts.tsx', 'utf8');

const target = `                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>현장 담당자</label>
                  <span>
                    {(() => {
                      const site = sites.find(s => s.id === activeContract.siteId);
                      return site && site.contactName ? site.contactName : '-';
                    })()}
                  </span>
                </div>
                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>영업담당</label><span>{users.find(u => u.id === activeContract.salespersonId)?.name || '-'}</span></div>
                
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>담당자 연락처</label>
                  <span>
                    {(() => {
                      const curSite = sites.find(s => s.id === activeContract.siteId);
                      const actContacts = (curSite?.contacts || []).filter(c => c.isActive !== false);
                      if (actContacts.length > 0) {
                        return actContacts.map(c => \`\${c.name}: \${c.contact}\`).join(' / ');
                      }
                      return curSite?.contact || '-';
                    })()}
                  </span>
                </div>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>담당자 이메일</label>
                  <span>
                    {(() => {
                      const curSite = sites.find(s => s.id === activeContract.siteId);
                      const actContacts = (curSite?.contacts || []).filter(c => c.isActive !== false && c.email);
                      if (actContacts.length > 0) {
                        return actContacts.map(c => \`\${c.name}<\${c.email}>\`).join(', ');
                      }
                      return curSite?.email || '-';
                    })()}
                  </span>
                </div>`;

const replacement = `                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>영업담당</label><span>{users.find(u => u.id === activeContract.salespersonId)?.name || '-'}</span></div>
                <div style={{ visibility: 'hidden' }}></div>
                
                {/* 3분할 담당자 상세 정보 (Full Width) */}
                <div style={{ gridColumn: '1 / -1', marginTop: '4px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '8px' }}>현장 담당자 정보</label>
                  {(() => {
                    const curSite = sites.find(s => s.id === activeContract.siteId);
                    const actContacts = (curSite?.contacts || []).filter(c => c.isActive !== false);
                    if (actContacts.length === 0) {
                      return <span style={{ color: 'var(--text-muted)' }}>등록된 현장 담당자가 없습니다.</span>;
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {actContacts.map(c => {
                          const typeLabel = c.contactType === 'EQUIPMENT' ? '장비' : c.contactType === 'CLOSING' ? '마감' : c.contactType === 'SAFETY' ? '안전' : '현장';
                          const typeColor = c.contactType === 'EQUIPMENT' ? '#2563eb' : c.contactType === 'CLOSING' ? '#059669' : c.contactType === 'SAFETY' ? '#d97706' : '#4b5563';
                          const typeBg = c.contactType === 'EQUIPMENT' ? '#eff6ff' : c.contactType === 'CLOSING' ? '#ecfdf5' : c.contactType === 'SAFETY' ? '#fffbeb' : '#f3f4f6';
                          
                          return (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                              <span style={{ 
                                padding: '2px 6px', 
                                backgroundColor: typeBg, 
                                border: \`1px solid \${typeColor}40\`, 
                                borderRadius: '4px', 
                                fontSize: '10px', 
                                fontWeight: 700,
                                color: typeColor,
                                width: '32px',
                                textAlign: 'center'
                              }}>
                                {typeLabel}
                              </span>
                              <strong style={{ minWidth: '50px' }}>{c.name}</strong>
                              {c.contact && <span style={{ color: 'var(--text-main)', minWidth: '100px' }}>{c.contact}</span>}
                              {c.email && <span style={{ color: 'var(--text-muted)' }}>{c.email}</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>`;

c = c.replace(target, replacement);
fs.writeFileSync('src/pages/Contracts.tsx', c);
console.log('Replaced');
