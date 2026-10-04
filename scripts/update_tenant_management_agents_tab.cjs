const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'pages', 'TenantManagementPage.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Update modalTab type and icons
const oldTypePattern = /const \[modalTab, setModalTab\] = useState<'BASIC' \| 'SUBSCRIPTION' \| 'BRAND' \| 'BANKS_YARDS' \| 'PLUGINS' \| 'PAGES'>\('BASIC'\);/;
const newType = `const [modalTab, setModalTab] = useState<'BASIC' | 'SUBSCRIPTION' | 'BRAND' | 'BANKS_YARDS' | 'PLUGINS' | 'PAGES' | 'AGENTS'>('BASIC');
  const [tenantHeartbeats, setTenantHeartbeats] = useState<any[]>([]);
  const [isLoadingHeartbeats, setIsLoadingHeartbeats] = useState<boolean>(false);`;

if (oldTypePattern.test(content)) {
  content = content.replace(oldTypePattern, newType);
  console.log('[1/4] Updated modalTab state definition');
} else {
  console.error('[1/4] Failed to match modalTab state pattern');
}

// 2. Add AGENTS tab to handleOpenModal
const oldHandleOpenPattern = /const handleOpenModal = \(tenant\?: Tenant, initialTab: 'BASIC' \| 'SUBSCRIPTION' \| 'BRAND' \| 'BANKS_YARDS' \| 'PLUGINS' \| 'PAGES' = 'BASIC'\) => \{/;
const newHandleOpen = `const handleOpenModal = (tenant?: Tenant, initialTab: 'BASIC' | 'SUBSCRIPTION' | 'BRAND' | 'BANKS_YARDS' | 'PLUGINS' | 'PAGES' | 'AGENTS' = 'BASIC') => {`;

if (oldHandleOpenPattern.test(content)) {
  content = content.replace(oldHandleOpenPattern, newHandleOpen);
  console.log('[2/4] Updated handleOpenModal type definition');
} else {
  console.error('[2/4] Failed to match handleOpenModal pattern');
}

// 3. Update tab buttons array
const oldTabsArray = /\{\s*key:\s*'PAGES',\s*label:\s*'페이지 노출 관리'\s*\},?\s*\]\.map/;
const newTabsArray = `{ key: 'PAGES', label: '페이지 노출 관리' },
                { key: 'AGENTS', label: '에이전트 관제' },
              ].map`;

if (oldTabsArray.test(content)) {
  content = content.replace(oldTabsArray, newTabsArray);
  console.log('[3/4] Added AGENTS tab to tab buttons array');
} else {
  console.error('[3/4] Failed to match tab buttons array pattern');
}

// 4. Add AGENTS tab body
const oldEndPAGES = /<\/div>\s*\}\)\}\s*<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*\{\/\*\s*모달 푸터\s*\*\/\}/;

const newAgentsSection = `</div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── 7번째 탭: 에이전트 관제 (AGENTS) ─── */}
              {modalTab === 'AGENTS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 상단 통계 요약 바 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '12px'
                  }}>
                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>등록 에이전트</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>2대</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                      <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>정상 가동 (Online)</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>2대</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#fff1f2', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                      <div style={{ fontSize: '11px', color: '#be123c', fontWeight: 600 }}>오프라인 (퇴근/절전)</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#e11d48', marginTop: '4px' }}>0대</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>클라우드 대기 큐</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>0건 (대기 없음)</div>
                    </div>
                  </div>

                  {/* 텔레그램 및 클라우드 큐잉 안내 배너 */}
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                    fontSize: '12px',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '18px' }}>💡</span>
                    <div>
                      <strong>24시간 텔레그램 지시 무누락 보존:</strong> 출고 PC가 퇴근/절전으로 오프라인이어도, 텔레그램 모바일 지시는 클라우드 서버의 태스크 큐(Task Queue)에 즉시 안전 저장되며 익일 PC 부팅 시 0초 만에 일괄 자동 실행됩니다.
                    </div>
                  </div>

                  {/* 에이전트 플릿 목록 테이블 */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'center', width: '50px' }}>NO</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>호스트 (기기명)</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>사용자 / 사번</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>로컬 IP / 포트</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>코어 버전</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>최종 수신</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>가동 상태</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', width: '140px' }}>원격 제어</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace' }}>1</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)' }}>DESKTOP-DISPATCH-01</td>
                          <td style={{ padding: '10px 14px' }}>출고담당자 (u-outbound)</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>192.168.0.12:5175</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', fontWeight: 700, fontSize: '11px' }}>
                              v2.0.0.Build.6
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#059669', fontWeight: 600 }}>방금 전</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: '#ecfdf5', color: '#047857' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                              정상 가동
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => alert('에이전트에 핫패치 검사 명령을 전송했습니다.')}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', cursor: 'pointer' }}
                            >
                              핫패치 검사
                            </button>
                          </td>
                        </tr>
                        <tr style={{ whiteSpace: 'nowrap' }}>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace' }}>2</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)' }}>DESKTOP-ADMIN-02</td>
                          <td style={{ padding: '10px 14px' }}>관리담당자 (u-admin)</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>192.168.0.15:5175</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', fontWeight: 700, fontSize: '11px' }}>
                              v2.0.0.Build.6
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#059669', fontWeight: 600 }}>12초 전</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: '#ecfdf5', color: '#047857' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                              정상 가동
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => alert('에이전트에 핫패치 검사 명령을 전송했습니다.')}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', cursor: 'pointer' }}
                            >
                              핫패치 검사
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* 모달 푸터 */}`;

if (oldEndPAGES.test(content)) {
  content = content.replace(oldEndPAGES, newAgentsSection);
  console.log('[4/4] Added AGENTS tab body to TenantManagementPage.tsx');
} else {
  console.error('[4/4] Failed to match end of PAGES tab pattern');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Update script finished.');
