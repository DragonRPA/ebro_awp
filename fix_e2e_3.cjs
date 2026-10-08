const fs = require('fs');
let code = fs.readFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_2.cjs', 'utf8');

const replacement = \
    // Mock APIs
    await page.route('**/api/**', async route => {
      const url = route.request().url();
      console.log('Intercepted API call:', url);
      
      if (url.includes('vision-ocr')) {
        return route.fulfill({ json: {
          success: true,
          result: { companyName: "E2E 정밀 테스트(주)", bizRegNo: "999-88-77777", representative: "이디투", address: "서울시 서초구 방배동 123", bizType: "IT/제조", bizItem: "소프트웨어", taxEmail: "e2e@test.com", repContact: "010-9999-8888", openingDate: "2020-01-01", sourceType: "MOCK_VISION" }
        }});
      } else if (url.includes('nts-status')) {
        return route.fulfill({ json: {
          success: true,
          data: [{ b_no: "9998877777", b_stt: "계속사업자", tax_type: "부가가치세 일반과세자" }]
        }});
      } else if (url.includes('nts-validate')) {
        return route.fulfill({ json: {
          success: true,
          data: [{ b_no: "9998877777", valid: "01" }]
        }});
      }
      route.continue();
    });
\;

code = code.replace(
  /await page\.route\('\*\*\/api\/vision-ocr'[\s\S]*?\}\);[\s\S]*?\}\);/,
  replacement
);

fs.writeFileSync('D:/01.AntiGravity/eBro/scratch/e2e_wtt_4.cjs', code, 'utf8');
