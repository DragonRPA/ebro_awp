const fs = require('fs');
let c = fs.readFileSync('src/services/db.ts', 'utf8');
const target = "if (tableName === 'contracts' && ['packageSentAt', 'approvalStatus', 'approvalRequestId', 'stagedExtend', 'saleTerms'].includes(key)) { continue; }";
const repl = `if (tableName === 'contracts' && ['packageSentAt', 'approvalStatus', 'approvalRequestId', 'stagedExtend', 'saleTerms'].includes(key)) { continue; }
      if (tableName === 'contract_history' && ['approvalStatus', 'approvalRequestId'].includes(key)) { continue; }`;
c = c.replace(target, repl);
fs.writeFileSync('src/services/db.ts', c);
console.log('Fixed contract_history in db.ts');
