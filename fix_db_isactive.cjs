const fs = require('fs');
let c = fs.readFileSync('src/services/db.ts', 'utf8');

c = c.replace(/  isActive\?: boolean; \/\/ 사용\/미사용 \(공사 완공 시 미사용\)\r?\n/g, '');

fs.writeFileSync('src/services/db.ts', c);
