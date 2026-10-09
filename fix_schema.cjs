const fs = require('fs');
let c = fs.readFileSync('schema.sql', 'utf8');
const target = `"currentSiteId"       TEXT,`;
const repl = `"currentSiteId"       TEXT,
  "predecessorContractId" TEXT REFERENCES contracts(id) ON DELETE SET NULL,
  "predecessorContractAssetId" TEXT,
  "inRegisteredAt"      TEXT,`;
c = c.replace(target, repl);
fs.writeFileSync('schema.sql', c);
console.log('Fixed schema.sql');
