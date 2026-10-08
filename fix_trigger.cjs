const fs = require('fs');
let content = fs.readFileSync('D:/01.AntiGravity/eBro/src/components/BusinessLicenseModal.tsx', 'utf8');
content = content.replace(
  /onClick={handleSave}\\s+disabled={isSaving}/,
  'data-hs-trigger=\"Register\"\\n                  onClick={handleSave}\\n                  disabled={isSaving}'
);
fs.writeFileSync('D:/01.AntiGravity/eBro/src/components/BusinessLicenseModal.tsx', content, 'utf8');
