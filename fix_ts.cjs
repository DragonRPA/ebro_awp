const fs = require('fs');

// 1. Fix AppContext.tsx
let appContext = fs.readFileSync('src/context/AppContext.tsx', 'utf8');
appContext = appContext.replace(
  "const newMaster = db.insertRow('siteMasters', {",
  "const newMaster = db.insertRow<SiteMaster>('siteMasters', {"
);

// We need to import SiteMaster in AppContext.tsx
appContext = appContext.replace(
  "import { db, Customer, CustomerContact, CustomerSite, CustomerBankAccount, StandardOption, logPrivacyAccess, SiteContactPerson",
  "import { db, Customer, CustomerContact, CustomerSite, SiteMaster, CustomerBankAccount, StandardOption, logPrivacyAccess, SiteContactPerson"
);

fs.writeFileSync('src/context/AppContext.tsx', appContext);

// 2. Fix migrate_sites_nm.ts
let script = fs.readFileSync('src/scripts/migrate_sites_nm.ts', 'utf8');
script = script.replace(
  "const sites = db.get<any>('sites', []);\n  const siteMasters = db.get<any>('siteMasters', []);",
  "const sites = db.sites;\n  const siteMasters = db.siteMasters;"
);
fs.writeFileSync('src/scripts/migrate_sites_nm.ts', script);

console.log('Fixed TS errors');
