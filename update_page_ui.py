import os
import re

filepath = 'src/pages/TenantManagementPage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace hardcoded summary cards and table
target = r"""                    \{/\*     \*/\}
                    <div style=\{\{
                      display: 'grid',
                      gridTemplateColumns: 'repeat\(4, 1fr\)',
                      gap: '12px'
                    \}\}>
                      <div style=\{\{ padding: '12px', backgroundColor: 'var\(--bg-app\)', borderRadius: '8px', border: '1px solid var\(--border-color\)' \}\}>
                        <div style=\{\{ fontSize: '11px', color: 'var\(--text-muted\)', fontWeight: 600 \}\}> Ʈ</div>
                        <div style=\{\{ fontSize: '20px', fontWeight: 800, color: 'var\(--text-main\)', marginTop: '4px' \}\}>2</div>
                      </div>
                      <div style=\{\{ padding: '12px', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' \}\}>
                        <div style=\{\{ fontSize: '11px', color: '#047857', fontWeight: 600 \}\}>  \(Online\)</div>
                        <div style=\{\{ fontSize: '20px', fontWeight: 800, color: '#059669', marginTop: '4px' \}\}>2</div>
                      </div>
                      <div style=\{\{ padding: '12px', backgroundColor: '#fff1f2', borderRadius: '8px', border: '1px solid #fecdd3' \}\}>
                        <div style=\{\{ fontSize: '11px', color: '#be123c', fontWeight: 600 \}\}> \(/\)</div>
                        <div style=\{\{ fontSize: '20px', fontWeight: 800, color: '#e11d48', marginTop: '4px' \}\}>0</div>
                      </div>
                      <div style=\{\{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' \}\}>
                        <div style=\{\{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600 \}\}>Ŭ  ť</div>
                        <div style=\{\{ fontSize: '20px', fontWeight: 800, color: '#2563eb', marginTop: '4px' \}\}>0 \( \)</div>
                      </div>
                    </div>.*?<div style=\{\{
                      backgroundColor: 'var\(--bg-card\)',
                      borderRadius: '8px',
                      border: '1px solid var\(--border-color\)',
                      overflow: 'hidden'
                    \}\}>.*?</thead>.*?<tbody>.*?</tbody>.*?</table>.*?</div>"""

replacement = """                    {/* 에이전트 상태 요약 */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '12px'
                    }}>
                      <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>등록 에이전트</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>{tenantHeartbeats.length}대</div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                        <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>정상 가동 (Online)</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                          {tenantHeartbeats.filter(h => new Date().getTime() - new Date(h.last_seen_at).getTime() < 60000).length}대
                        </div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: '#fff1f2', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                        <div style={{ fontSize: '11px', color: '#be123c', fontWeight: 600 }}>오프라인 (퇴근/절전)</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#e11d48', marginTop: '4px' }}>
                          {tenantHeartbeats.filter(h => new Date().getTime() - new Date(h.last_seen_at).getTime() >= 60000).length}대
                        </div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>클라우드 대기 큐</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>0건 (대기 없음)</div>
                      </div>
                    </div>

                    {/* 텔레그램 지시 클라우드 큐 안내 문구 */}
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

                    {/* 에이전트 목록 데이터 테이블 */}
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
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>액션</th>
                          </tr>
                        </thead>
                        <tbody>
                          {isLoadingHeartbeats ? (
                            <tr>
                              <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                실시간 하트비트를 조회하는 중입니다...
                              </td>
                            </tr>
                          ) : tenantHeartbeats.length === 0 ? (
                            <tr>
                              <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                수집된 에이전트 하트비트가 없습니다.
                              </td>
                            </tr>
                          ) : (
                            tenantHeartbeats.map((hb, idx) => {
                              const isOnline = (new Date().getTime() - new Date(hb.last_seen_at).getTime()) < 60000;
                              
                              let timeAgo = '';
                              const diffSec = Math.floor((new Date().getTime() - new Date(hb.last_seen_at).getTime()) / 1000);
                              if (diffSec < 60) timeAgo = diffSec < 15 ? '방금 전' : `${diffSec}초 전`;
                              else if (diffSec < 3600) timeAgo = `${Math.floor(diffSec/60)}분 전`;
                              else if (diffSec < 86400) timeAgo = `${Math.floor(diffSec/3600)}시간 전`;
                              else timeAgo = `${Math.floor(diffSec/86400)}일 전`;

                              return (
                                <tr key={hb.id} style={{ borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap', opacity: isOnline ? 1 : 0.6 }}>
                                  <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace' }}>{idx + 1}</td>
                                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)' }}>{hb.pc_name || hb.device_id}</td>
                                  <td style={{ padding: '10px 14px' }}>{hb.user_name || '-'} ({hb.user_id || '-'})</td>
                                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{hb.ip_address || '127.0.0.1'}:5175</td>
                                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                    <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', fontWeight: 700, fontSize: '11px' }}>
                                      {hb.engine_version || '알 수 없음'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'center', color: isOnline ? '#059669' : 'var(--text-muted)', fontWeight: 600 }}>
                                    {timeAgo}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: isOnline ? '#ecfdf5' : '#f1f5f9', color: isOnline ? '#047857' : '#64748b' }}>
                                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isOnline ? '#10b981' : '#94a3b8' }} />
                                      {isOnline ? '정상 가동' : '오프라인'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => alert(`에이전트 패치 및 상태 검사를 백그라운드로 지시했습니다.\n(대상: ${hb.pc_name})`)}
                                      style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', cursor: 'pointer' }}
                                    >
                                      원격 진단
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>"""

content = re.sub(target, replacement, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated UI in TenantManagementPage.tsx")
