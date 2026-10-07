
const fs = require('fs');
let text = fs.readFileSync('src/pages/smart_dispatch4.tsx', 'utf8');

text = text.replace(/setActiveTab\('.*?'\);/g, '');
// For the 4859, 4867 cases, they might be in an onClick?
text = text.replace(/onClick=\{.*?setActiveTab\('.*?'\).*?\}/g, '');

fs.writeFileSync('src/pages/smart_dispatch4.tsx', text, 'utf8');
console.log('Fixed TS errors.');

