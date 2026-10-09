const fs = require('fs');
let c = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

c = c.replace(
  "if (!quickSiteForm.customerId || !quickSiteForm.name) {\n      showErrorModal('고객사와 현장명을 모두 입력해주세요.');",
  "if (!quickSiteForm.name) {\n      showErrorModal('현장명을 입력해주세요.');"
);

c = c.replace(
  "customerId: quickSiteForm.customerId,",
  "customerId: '', // 독립 현장 마스터"
);

const customerSelectBlock = `              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>소속 고객사 *</label>
                <select
                  required
                  value={quickSiteForm.customerId}
                  onChange={e => setQuickSiteForm({ ...quickSiteForm, customerId: e.target.value })}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                >
                  <option value="">-- 고객사 선택 --</option>
                  {(customers || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>`;

c = c.replace(customerSelectBlock, "");

fs.writeFileSync('src/pages/SiteOptionManage.tsx', c);
console.log('Removed customer dependency from quick site modal');
