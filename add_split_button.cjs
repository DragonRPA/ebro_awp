const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /(<button\s*type="button"\s*className="btn-secondary"\s*onClick=\{\(\) => downloadStatementExcel\(activeBilling\.id\)\})/;
const match = content.match(regex);
if (match) {
  const replacement = `{canSave && activeBilling.status !== 'PAID' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => { setSplitTargetId(activeBilling.id); setSplitModalOpen(true); }}
                          style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                          title="이 청구서를 금액 기준으로 2개의 청구서로 분할합니다."
                        >
                          <span>✂️</span> 청구 분할
                        </button>
                      )}
                      $1`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Added Split Button');
} else {
  console.log('Target not found for Split Button');
}
