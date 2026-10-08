const fs = require('fs');
let code = fs.readFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_4.cjs', 'utf8');
code = code.replace(
  \"// Mock APIs\\n    await page.route('**/api/**', async route => {\",
  \"// Mock APIs\\n    await page.route('**', async route => {\\n      // console.log('Intercepted:', route.request().url());\\n      if(route.request().url().includes('/api/vision-ocr') || route.request().url().includes('/api/nts-status') || route.request().url().includes('/api/nts-validate')) {\"
);
code = code.replace(
  \"      if (url.includes('vision-ocr')) {\",
  \"      console.log('   ?? Intercepted API call:', url);\\n      if (url.includes('vision-ocr')) {\"
);
fs.writeFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_5.cjs', code, 'utf8');
