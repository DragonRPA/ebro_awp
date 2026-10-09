const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

// For line 270/271 (contacts sorting)
// Wait! `contacts` sorting uses `isActive`. `CustomerContact` HAS `isActive`.
// So line 270/271 for `customerContacts` is CORRECT!
// Let's check `customerSites` sorting (lines 280/281).
c = c.replace(/const aActive = a\.isActive !== false;\s*const bActive = b\.isActive !== false;/g,
  "const aActive = a.isActive !== false; const bActive = b.isActive !== false; // _TEMP_");

fs.writeFileSync('src/pages/Customers.tsx', c);
