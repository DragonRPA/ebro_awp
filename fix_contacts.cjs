const fs = require('fs');

let dbTs = fs.readFileSync('src/services/db.ts', 'utf8');
dbTs = dbTs.replace(/  contactName: string;\r?\n/g, '');
dbTs = dbTs.replace(/  contact: string;\r?\n/g, '');
dbTs = dbTs.replace(/  email: string;\r?\n/g, '');
dbTs = dbTs.replace(/  contacts\?: SiteContactPerson\[\];.*\r?\n/g, '');
dbTs = dbTs.replace(/  billingContactName\?: string;.*\r?\n/g, '');
dbTs = dbTs.replace(/  billingContactPhone\?: string;.*\r?\n/g, '');
dbTs = dbTs.replace(/  billingContactEmail\?: string;.*\r?\n/g, '');
dbTs = dbTs.replace(/  safetyContactName\?: string;.*\r?\n/g, '');
dbTs = dbTs.replace(/  safetyContactPhone\?: string;.*\r?\n/g, '');
dbTs = dbTs.replace(/  safetyContactEmail\?: string;.*\r?\n/g, '');

fs.writeFileSync('src/services/db.ts', dbTs);

let schema = fs.readFileSync('schema.sql', 'utf8');
schema = schema.replace(/    "contactName"\s+TEXT,\r?\n/g, '');
schema = schema.replace(/    contact\s+TEXT,\r?\n/g, '');
schema = schema.replace(/    email\s+TEXT,\r?\n/g, '');
schema = schema.replace(/    "contacts"\s+JSONB DEFAULT '\[\]'::jsonb,\r?\n/g, '');
fs.writeFileSync('schema.sql', schema);

let siteOpt = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');
// Fix the Excel export rows
siteOpt = siteOpt.replace(/'현장담당자': s.contactName \|\| '-',\r?\n/g, '');
siteOpt = siteOpt.replace(/'연락처': s.contact \|\| '-'\r?\n/g, '');

// Fix the render map
siteOpt = siteOpt.replace(/ \| 담당: \{activeSite\.contactName \|\| '-'\} \(\{activeSite\.contact \|\| '-'\}\)/g, '');

fs.writeFileSync('src/pages/SiteOptionManage.tsx', siteOpt);

console.log('Fixed DB schema and SiteOptionManage UI.');
