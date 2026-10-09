const fs = require('fs');
let c = fs.readFileSync('src/services/db.ts', 'utf8');
const target = "// DB consumables 스키마에 없는";
const repl = `// contracts 테이블 프론트엔드 전용 상태 필드 격리
      if (tableName === 'contracts' && ['packageSentAt', 'approvalStatus', 'approvalRequestId', 'stagedExtend', 'saleTerms'].includes(key)) { continue; }
      // DB consumables 스키마에 없는`;
c = c.replace(target, repl);
fs.writeFileSync('src/services/db.ts', c);
console.log('Fixed db.ts');
