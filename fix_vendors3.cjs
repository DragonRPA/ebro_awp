const fs = require('fs');
let vendors = fs.readFileSync('src/pages/Vendors.tsx', 'utf8');
vendors = vendors.replace(
  "<FileText size={12} /> {editingVendor.businessCertFileName || '등록증 열람'} ↗",
  "<FileText size={12} /> 사업자등록증 보기 ↗"
);
fs.writeFileSync('src/pages/Vendors.tsx', vendors);
