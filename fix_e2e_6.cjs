const fs = require('fs');
let code = fs.readFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_4.cjs', 'utf8');

code = code.replace(
  \"page.on('dialog', async dialog => {\",
  \"page.on('console', msg => console.log('   [BROWSER]', msg.text()));\\n  page.on('dialog', async dialog => {\"
);

fs.writeFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_7.cjs', code, 'utf8');
