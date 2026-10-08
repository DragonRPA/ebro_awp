const fs = require('fs');
let code = fs.readFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_1.cjs', 'utf8');

// Replace the click
code = code.replace(
  \"await page.click('button[data-mid=\\\"btn-new-customer\\\"]', { force: true });\",
  \"await page.evaluate(() => { const btns = Array.from(document.querySelectorAll('button')); const btn = btns.find(b => b.textContent.includes('사업자등록증 보완')); if(btn) btn.click(); });\"
);

// We need to fix the monthly fee input too because we found out it matches multiple input[type=\"number\"]
code = code.replace(
  \"await page.fill('input[type=\\\"number\\\"]', '500000'); // Monthly Fee\",
  \"const numberInputs = await page.('input[type=\\\"number\\\"]'); if (numberInputs.length > 2) { await numberInputs[2].fill('500000'); } else if (numberInputs.length > 0) { await numberInputs[numberInputs.length - 1].fill('500000'); }\"
);

// We should also replace the Save button locator from text to data-hs-trigger=\"Register\"
code = code.replace(
  \"if(await b.isVisible() && (await b.innerText()).includes('신규 고객 등록')) {\",
  \"if(await b.isVisible() && (await b.getAttribute('data-hs-trigger')) === 'Register') {\"
);

fs.writeFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_2.cjs', code, 'utf8');
