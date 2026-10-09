const fs = require('fs');
let c = fs.readFileSync('schema.sql', 'utf8');

const siteMasterSQL = `
CREATE TABLE site_masters (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  address               TEXT,
  "isActive"            BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"           TEXT NOT NULL,
  "updatedAt"           TEXT NOT NULL,
  "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);
`;

c = c.replace(
  'CREATE TABLE customer_sites (',
  siteMasterSQL + '\nCREATE TABLE customer_sites ('
);

c = c.replace(
  '"customerId"          TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,',
  '"siteMasterId"        TEXT REFERENCES site_masters(id) ON DELETE CASCADE,\n  "customerId"          TEXT REFERENCES customers(id) ON DELETE CASCADE,'
);

fs.writeFileSync('schema.sql', c);
console.log('Updated schema.sql with site_masters');
