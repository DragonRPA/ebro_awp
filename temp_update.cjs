const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /const canActDelivery = [^\n]+;/,
  "const canActDelivery = hasPermission('delivery', 'save') || hasPermission('delivery', 'view') || isExecUser || userRole === 'ACCOUNTING' || (userDept && (userDept.includes('관리')));"
);

const inboundDataProcessing = `
        // 2-1. 입고 검수 대기 건 (반납 후 검수 대기)
        const pendingInboundInspections = assets.filter(a => a.status === 'RENTED_RETURNED');
        const showInboundInspectionFeed = pendingInboundInspections.length > 0 && canActOutboundInspection;
`;
content = content.replace(
  /const showOutboundInspectionFeed = pendingOutboundInspections\.length > 0 && canActOutboundInspection;/,
  "const showOutboundInspectionFeed = pendingOutboundInspections.length > 0 && canActOutboundInspection;" + inboundDataProcessing
);

content = content.replace(
  /const visibleCount = \[showTodoFeed, showSalesPipelineFeed, showAssignFeed, showOutboundInspectionFeed, showDeliveryFeed, showRepairFeed, showBillingFeed, showPendingDueBillingFeed, showRentAssetFeed, showContractFeed\]\.filter\(Boolean\)\.length;/,
  "const visibleCount = [showTodoFeed, showSalesPipelineFeed, showAssignFeed, showOutboundInspectionFeed, showInboundInspectionFeed, showDeliveryFeed, showRepairFeed, showBillingFeed, showPendingDueBillingFeed, showRentAssetFeed, showContractFeed].filter(Boolean).length;"
);

const inboundUI = `
            {/* 2-1. 입고 검수 대기 피드 카드 */}
            {showInboundInspectionFeed && (
              <details open style={{
                backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px 24px',
                borderLeft: '5px solid #eab308', border: '1px solid var(--border-color)', borderLeftWidth: '5px'
              }}>
                <summary style={{ cursor: "pointer", listStyle: "none", outline: "none" }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#eab308', backgroundColor: 'rgba(234,179,8,0.12)', padding: '3px 9px', borderRadius: '4px', border: '1px solid rgba(234,179,8,0.3)' }}>
                      입고 검수 관리
                    </span>
                    <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#eab308' }}>
                      입고 검수 대기 {pendingInboundInspections.length}건
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckSquare size={18} color="#eab308" /> 입고 검수 대기
                  </h4>
                </summary>
                <div className="details-content">
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: '1.5' }}>
                    반납된 장비 중 입고 검수 및 정비 판단 대기 중인 장비 <strong>{pendingInboundInspections.length}건</strong>.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {pendingInboundInspections.slice(0, 3).map((asset, idx) => (
                      <div key={asset.id} style={{
                        backgroundColor: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px',
                        border: '1px solid var(--border-color)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>
                            {idx + 1}. {asset.assetNo}
                          </span>
                          <span style={{
                            fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                            backgroundColor: 'rgba(234,179,8,0.15)',
                            color: '#ca8a04'
                          }}>
                            입고 대기
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <span>📦 <strong>모델:</strong> {asset.modelName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="btn-primary" onClick={() => setActiveTab('assets')} style={{ backgroundColor: '#eab308', border: 'none', fontSize: '12.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', color: '#fff' }}>
                    자산 관리 이동 <ArrowRight size={13} />
                  </button>
                </div>
              </details>
            )}
`;

content = content.replace(
  /{showOutboundInspectionFeed && \([\s\S]*?<\/details>\s*\n\s*\)}/,
  match => match + "\n" + inboundUI
);

fs.writeFileSync(path, content, 'utf8');
console.log('Update complete');
