const fs = require('fs');
let lines = fs.readFileSync('src/pages/Contracts.tsx', 'utf8').split('\n');
const replacement = `          {/* 연관 계약 (족보) 패널 (N:M 족보 아키텍처 반영) */}
          {(() => {
            // 1. 부모 계약 찾기: ContractAsset의 predecessorContractId 활용
            const parentContractIds = Array.from(new Set(activeContractAssets.map(ca => ca.predecessorContractId).filter(Boolean))) as string[];
            const parentContracts = contracts.filter(c => parentContractIds.includes(c.id));
            if (parentContracts.length === 0 && activeContract.predecessorContractId) {
              const legacyParent = contracts.find(c => c.id === activeContract.predecessorContractId);
              if (legacyParent) parentContracts.push(legacyParent);
            }

            // 2. 자식 계약 찾기: 전체 ContractAsset 중 predecessorContractId가 현재 계약인 것 탐색
            const childContractIds = Array.from(new Set(
              (db.contractAssets || []).filter(ca => ca.predecessorContractId === activeContract.id).map(ca => ca.contractId)
            ));
            const childContracts = contracts.filter(c => childContractIds.includes(c.id));
            const legacyChildContracts = contracts.filter(c => c.predecessorContractId === activeContract.id);
            legacyChildContracts.forEach(lc => {
              if (!childContracts.find(c => c.id === lc.id)) childContracts.push(lc);
            });

            if (parentContracts.length === 0 && childContracts.length === 0) return null;
            
            return (
              <div className="card" style={{ padding: '12px 18px', margin: 0, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '13px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Network size={16} /> 연관 계약 (족보)
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {parentContracts.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#15803d', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 700 }}>⬆️ 부모 계약 (이전):</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '12px' }}>
                        {parentContracts.map(parent => (
                          <a key={parent.id} href="#" onClick={(e) => { e.preventDefault(); handleSelectContract(parent.id); }} style={{ color: '#16a34a', textDecoration: 'underline', fontWeight: 700 }}>
                            ↳ {parent.contractNo} ({customers.find(cust => cust.id === parent.customerId)?.name} / {db.sites.find(s => s.id === parent.siteId)?.name})
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {childContracts.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#15803d', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 700 }}>⬇️ 파생 계약 (이후):</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '12px' }}>
                        {childContracts.map(child => (
                          <a key={child.id} href="#" onClick={(e) => { e.preventDefault(); handleSelectContract(child.id); }} style={{ color: '#16a34a', textDecoration: 'underline', fontWeight: 700 }}>
                            ↳ {child.contractNo} ({customers.find(cust => cust.id === child.customerId)?.name} / {db.sites.find(s => s.id === child.siteId)?.name}) - {child.status === 'COMPLETED' ? '종료' : '진행중'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}`;

lines.splice(2036, 36, replacement);
fs.writeFileSync('src/pages/Contracts.tsx', lines.join('\\n'));
console.log('Replaced by line indices!');
