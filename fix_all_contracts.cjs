const fs = require('fs');
let c = fs.readFileSync('src/pages/Contracts.tsx', 'utf8');

// 1. Fix succCustSearch onChange
const searchOnChangeTarget = `onChange={e => {
                      const val = e.target.value;
                      setSuccCustSearch(val);
                      if (val.trim()) {
                        const q = val.trim();
                        const currentCustId = activeContract?.customerId;
                        const m = customers.filter(c => c.id !== currentCustId && (matchHangul(c.name, q) || (c.bizRegNo && c.bizRegNo.includes(q))));
                        if (m.length === 1) {
                          setSuccCustId(m[0].id);
                        }
                      }
                    }}`;

const searchOnChangeReplace = `onChange={e => {
                      const val = e.target.value;
                      setSuccCustSearch(val);
                      if (val.trim()) {
                        const q = val.trim();
                        const currentCustId = activeContract?.customerId;
                        const m = customers.filter(c => c.id !== currentCustId && (matchHangul(c.name, q) || (c.bizRegNo && c.bizRegNo.includes(q))));
                        if (m.length === 1 && succCustId !== m[0].id) {
                          setSuccCustId(m[0].id);
                          setSuccSiteId('');
                          setSuccContactId('');
                        }
                      }
                    }}`;
c = c.replace(searchOnChangeTarget, searchOnChangeReplace);

// 2. Fix succCustId select onChange
const selectOnChangeTarget = `onChange={e => setSuccCustId(e.target.value)}`;
const selectOnChangeReplace = `onChange={e => {
                    setSuccCustId(e.target.value);
                    setSuccSiteId('');
                    setSuccContactId('');
                  }}`;
c = c.replace(selectOnChangeTarget, selectOnChangeReplace);

// 3. Add Site and Contact Selectors
const insertTarget = `                </select>
              </div>

              <div>`;

const insertReplace = `                </select>
              </div>

              {/* 양수 현장 및 담당자 선택 영역 추가 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>양수 현장 선택 *</label>
                  <select
                    value={succSiteId}
                    onChange={e => setSuccSiteId(e.target.value)}
                    required
                    disabled={!succCustId}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: succCustId ? 'var(--bg-input, var(--bg-card))' : 'var(--bg-app)',
                      color: succCustId ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}
                  >
                    <option value="">{!succCustId ? '고객사를 먼저 선택하세요' : '-- 양수 현장 선택 --'}</option>
                    {db.sites.filter(s => s.customerId === succCustId).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.address || '주소 미기재'})</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>양수 현장 담당자</label>
                  <select
                    value={succContactId}
                    onChange={e => setSuccContactId(e.target.value)}
                    disabled={!succSiteId && !succCustId}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: (succSiteId || succCustId) ? 'var(--bg-input, var(--bg-card))' : 'var(--bg-app)',
                      color: (succSiteId || succCustId) ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}
                  >
                    <option value="">-- 미지정 --</option>
                    {db.contacts
                      .filter(c => c.customerId === succCustId)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.position || '직책미상'})</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div>`;
c = c.replace(insertTarget, insertReplace);

// 4. Update the genealogy panel using substring replacement
const startStr = '{/* 연관 계약 (족보) 패널 */}';
const endStr = '})()}';

const startIdx = c.indexOf(startStr);
let endIdx = c.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  endIdx += endStr.length;
  
  const replacementGenealogy = `          {/* 연관 계약 (족보) 패널 (N:M 족보 아키텍처 반영) */}
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

  c = c.substring(0, startIdx) + replacementGenealogy + c.substring(endIdx);
  console.log("Genealogy panel updated successfully.");
} else {
  console.log("Could not find genealogy bounds!");
}

fs.writeFileSync('src/pages/Contracts.tsx', c);
console.log('All changes applied successfully!');
