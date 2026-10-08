const fs = require('fs');
let code = fs.readFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_4.cjs', 'utf8');

code = code.replace(
  \"if (req.url().includes('/rest/v1/') && !req.url().includes('awp_shared_memories') && req.method() !== 'OPTIONS' && req.method() !== 'GET') {\",
  \"console.log('NETWORK:', req.method(), req.url());\\n    if (req.url().includes('/rest/v1/') && !req.url().includes('awp_shared_memories') && req.method() !== 'OPTIONS' && req.method() !== 'GET') {\"
);

fs.writeFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_6.cjs', code, 'utf8');
