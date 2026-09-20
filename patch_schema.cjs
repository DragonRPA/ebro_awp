const fs = require('fs');
let sql = fs.readFileSync('schema.sql', 'utf8');
if (!sql.includes('"domainUrls"')) {
    sql = sql.replace(
        '"tenant_id"           TEXT NOT NULL DEFAULT \'giyeun\'',
        '"tenant_id"           TEXT NOT NULL DEFAULT \'giyeun\',\n    "domainUrls"          TEXT,\n    "defaultPaymentMethod" TEXT'
    );
    fs.writeFileSync('schema.sql', sql, 'utf8');
    console.log('Patched schema.sql');
} else {
    console.log('Already patched');
}
