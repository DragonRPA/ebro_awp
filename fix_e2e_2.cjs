const fs = require('fs');
let code = fs.readFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_2.cjs', 'utf8');

// Fix BusinessLicenseModal Save button
code = code.replace(
  \"(await b.getAttribute('data-hs-trigger')) === 'Register'\",
  \"(await b.getAttribute('data-hs-trigger')) === 'Save'\"
);

fs.writeFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_3.cjs', code, 'utf8');
