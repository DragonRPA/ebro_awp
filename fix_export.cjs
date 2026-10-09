const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

c = c.replace(/'사용여부': cs\.isActive !== false \? '사용' : '종료',/g,
  "'사용여부': siteMasters.find(sm => sm.id === cs.siteMasterId)?.isActive !== false ? '사용' : '종료',");

fs.writeFileSync('src/pages/Customers.tsx', c);
console.log('Fixed export');
