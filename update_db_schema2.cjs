const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/services/db.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /(isPartial\?: boolean;[^\n]*)/;
const match = content.match(regex);

if (match) {
  const replacement = `$1\n  parentBillingId?: string; // 청구 분할 시 원본 청구서 ID (Audit Trail)`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully replaced in db.ts using regex');
} else {
  console.log('Target not found in db.ts via regex');
}
