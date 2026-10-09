const fs = require('fs');
let lines = fs.readFileSync('src/pages/Contracts.tsx', 'utf8').split('\n');

const siteAndContact = `              {/* 양수 현장 및 담당자 선택 영역 추가 */}
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
`;

// Find where to insert
let insertIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('양수 고객사 선택 셀렉트')) {
    // skip forward to the end of the select block
    let j = i;
    while (!lines[j].includes('</select>')) {
      j++;
    }
    // after </select>, find </div>
    while (!lines[j].includes('</div>')) {
      j++;
    }
    insertIdx = j + 1; // right after </div>
    break;
  }
}

if (insertIdx !== -1) {
  lines.splice(insertIdx, 0, siteAndContact);
  fs.writeFileSync('src/pages/Contracts.tsx', lines.join('\n'));
  console.log('Successfully injected site and contact UI at line', insertIdx);
} else {
  console.log('Target not found for insertion.');
}
