const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /(<td style=\{\{ whiteSpace: 'nowrap' \}\}><strong>\{b\.billingYm\}<\/strong>)(<\/td>)/;
const match = content.match(regex);
if (match) {
  const replacement = `$1
                          {b.parentBillingId && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 5px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderRadius: '4px', fontWeight: 'bold' }} title="분할 생성된 청구건입니다">
                              ✂️ 분할됨
                            </span>
                          )}
                          {b.details?.some(d => d.amount < 0 && d.itemName.includes('분할')) && !b.parentBillingId && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 5px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderRadius: '4px', fontWeight: 'bold' }} title="일부 금액이 다른 청구서로 분할되었습니다">
                              ✂️ 분할(원본)
                            </span>
                          )}$2`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Added Split Badge');
} else {
  console.log('Target not found for Split Badge');
}
