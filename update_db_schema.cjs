const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/services/db.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `  isPartial?: boolean;   // 부분 청구 여부 (동일 월에 일부 자산만 별도로 청구)`;
const replacement = `  isPartial?: boolean;   // 부분 청구 여부 (동일 월에 일부 자산만 별도로 청구)
  parentBillingId?: string; // 청구 분할 시 원본 청구서 ID (Audit Trail)`;

if(content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully replaced in db.ts');
} else {
  console.log('Target not found in db.ts');
}
