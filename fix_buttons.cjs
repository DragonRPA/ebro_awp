const fs = require('fs');
let c = fs.readFileSync('src/pages/Contracts.tsx', 'utf8');

// 1. Remove the "계약서패키지 지금 발송 ➔" button
const pkgButtonRegex = /\{!m\.isPackageSent && \(\s*<button\s*type="button"\s*className="btn-primary"\s*onClick=\{\(\) => \{\s*setBundleTargetContractId\(activeContract\.id\);\s*setShowBundleModal\(true\);\s*\}\}\s*style=\{\{ padding: '4px 8px', fontSize: '11px', marginTop: '2px', alignSelf: 'flex-start' \}\}\s*>\s*계약서패키지 지금 발송 ➔\s*<\/button>\s*\)\}/g;

c = c.replace(pkgButtonRegex, '');

// 2. Add quick buttons for extend modal
const extendInputRegex = /\{\!modIsOpen && \(\s*<div>\s*<label>변경 만료일 \*<\/label>\s*<input type="date" value=\{modNewEndDate\} onChange=\{e => setModNewEndDate\(e\.target\.value\)\} required style=\{\{ width: '100%', padding: '8px' \}\} \/>\s*<\/div>\s*\)\}/;

const extendReplacement = `{!modIsOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label>변경 만료일 *</label>
                  <input type="date" value={modNewEndDate} onChange={e => setModNewEndDate(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" onClick={() => {
                      const d = new Date(modNewEndDate || new Date().toISOString().split('T')[0]);
                      d.setMonth(d.getMonth() - 2);
                      setModNewEndDate(d.toISOString().split('T')[0]);
                    }} style={{ flex: 1, padding: '4px', fontSize: '11px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>-2개월</button>
                    <button type="button" onClick={() => {
                      const d = new Date(modNewEndDate || new Date().toISOString().split('T')[0]);
                      d.setMonth(d.getMonth() - 1);
                      setModNewEndDate(d.toISOString().split('T')[0]);
                    }} style={{ flex: 1, padding: '4px', fontSize: '11px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>-1개월</button>
                    <button type="button" onClick={() => {
                      const d = new Date(modNewEndDate || new Date().toISOString().split('T')[0]);
                      d.setMonth(d.getMonth() + 1);
                      setModNewEndDate(d.toISOString().split('T')[0]);
                    }} style={{ flex: 1, padding: '4px', fontSize: '11px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>+1개월</button>
                    <button type="button" onClick={() => {
                      const d = new Date(modNewEndDate || new Date().toISOString().split('T')[0]);
                      d.setMonth(d.getMonth() + 2);
                      setModNewEndDate(d.toISOString().split('T')[0]);
                    }} style={{ flex: 1, padding: '4px', fontSize: '11px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>+2개월</button>
                  </div>
                </div>
              )}`;

c = c.replace(extendInputRegex, extendReplacement);

fs.writeFileSync('src/pages/Contracts.tsx', c);
console.log('Done replacement');
