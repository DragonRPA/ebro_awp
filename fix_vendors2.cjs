const fs = require('fs');
let vendors = fs.readFileSync('src/pages/Vendors.tsx', 'utf8');
let lines = vendors.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('title={v.businessCertFileName')) {
    if (lines[i+2] && lines[i+2].includes('사본 열람 ↗')) {
      lines[i+2] = lines[i+2].replace('사본 열람 ↗', '사업자등록증 보기 ↗');
    }
  }
  if (lines[i].includes('title={v.passbookFileName')) {
    if (lines[i+2] && lines[i+2].includes('사본 열람 ↗')) {
      lines[i+2] = lines[i+2].replace('사본 열람 ↗', '통장사본 보기 ↗');
    }
  }
  if (lines[i].includes('{editingVendor.businessCertFileName')) {
    lines[i] = lines[i].replace("{editingVendor.businessCertFileName || '사업자등록증 열람'} ↗", "사업자등록증 보기 ↗");
  }
}
fs.writeFileSync('src/pages/Vendors.tsx', lines.join('\n'));
console.log('Fixed Vendors.tsx');
