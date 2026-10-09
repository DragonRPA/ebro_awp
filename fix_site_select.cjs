const fs = require('fs');
let lines = fs.readFileSync('src/pages/Contracts.tsx', 'utf8').split(/\\r?\\n/);

let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<div data-mid="create-contract-cust"')) {
    startIdx = i - 1; // get the <div style={{ display: 'grid'... 
    let j = i;
    while (!lines[j].includes('<div data-mid="create-contract-end-date">')) {
      j++;
    }
    endIdx = j - 3; // roughly right before the next grid row
    break;
  }
}

if (startIdx !== -1) {
  const replacement = \`          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div data-mid="create-contract-cust" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>고객사 선택 *</label>
                {custModalSearch && (
                  <button
                    type="button"
                    onClick={() => setCustModalSearch('')}
                    style={{ fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >검색 초기화</button>
                )}
              </div>
              <input
                type="text"
                value={custModalSearch}
                onChange={e => setCustModalSearch(e.target.value)}
                placeholder="고객명 / 초성 검색..."
                style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
              />
              <select
                value={custSelect}
                onChange={e => {
                  const val = e.target.value;
                  setCustSelect(val);
                  setSiteSelect(''); // 고객사 변경 시 현장 초기화
                  if (val && val !== 'NEW') {
                    const sel = customers.find(c => c.id === val);
                    if (sel) {
                      setBillingDay(sel.defaultBillingDay || 30);
                      setStatementClosingDay(sel.defaultStatementClosingDay || 25);
                      setPaymentDueDay(sel.paymentDueDay || 25);
                      setPaymentDueMonthOffset(sel.paymentDueMonthOffset !== undefined ? sel.paymentDueMonthOffset : 1);
                    }
                  }
                }}
                required
                style={{ width: '100%', padding: '7px 8px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              >
                <option value="">
                  {custModalSearch ? \`검색 결과 (\${filteredCustModalList.length}개사)\` : '고객사를 선택하세요'}
                </option>
                {filteredCustModalList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.transactionStatus === 'RESTRICT_NEW' ? \`🟡 [추가계약금지] \${c.name}\` : isCustomerTotalBlocked(c.transactionStatus) ? \`🔴 [전면차단] \${c.name}\` : c.name} ({c.bizRegNo})
                  </option>
                ))}
              </select>
            </div>

            <div data-mid="create-contract-site" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>현장 선택 *</label>
              <select
                value={siteSelect}
                onChange={e => setSiteSelect(e.target.value)}
                required
                disabled={!custSelect || custSelect === 'NEW'}
                style={{ width: '100%', padding: '7px 8px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: (!custSelect || custSelect === 'NEW') ? 'var(--bg-app)' : 'var(--bg-card)', color: 'var(--text-main)', marginTop: '26px' }}
              >
                <option value="">-- 현장 선택 --</option>
                {custSelect && custSelect !== 'NEW' && sites.filter(s => s.customerId === custSelect).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div data-mid="create-contract-salesperson" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>영업담당 *</label>
              <select value={salespersonSelect} onChange={e => setSalespersonSelect(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '24px' }}>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div data-mid="create-contract-start-date" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>계약 시작일 *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '24px' }} />
            </div>
          </div>\`;

  lines.splice(startIdx, endIdx - startIdx + 1, replacement);
  fs.writeFileSync('src/pages/Contracts.tsx', lines.join('\\n'));
  console.log('Fixed Contracts.tsx missing siteSelect UI!');
} else {
  console.log('Target not found in Contracts.tsx');
}
