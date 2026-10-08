const fs = require('fs');
let code = fs.readFileSync('D:/01.AntiGravity/eBro/src/pages/Customers.tsx', 'utf8');
code = code.replace(
  /{editingCustomer\\.id \\? '수정 사항 저장' : '고객사 등록 완료'}/g,
  "{editingCustomer.id ? '수정 사항 저장' : '고객사 등록 완료'}"
);
fs.writeFileSync('D:/01.AntiGravity/eBro/src/pages/Customers.tsx', code, 'utf8');
