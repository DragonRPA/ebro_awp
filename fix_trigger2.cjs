const fs = require('fs');
let content = fs.readFileSync('D:/01.AntiGravity/eBro/src/components/BusinessLicenseModal.tsx', 'utf8');
content = content.replace(
  \"onClick={handleSave}\",
  \"data-hs-trigger=\\\"Register\\\" onClick={handleSave}\"
);
fs.writeFileSync('D:/01.AntiGravity/eBro/src/components/BusinessLicenseModal.tsx', content, 'utf8');
