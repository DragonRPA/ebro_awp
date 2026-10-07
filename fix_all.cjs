
const fs = require('fs');
let content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');
content = content.replace(/\
/g, '\\n');
fs.writeFileSync('src/data/allMenuManuals.ts', content, 'utf8');
console.log('Fixed');

