
const fs = require('fs');
const content = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const lines = content.split('\n');
for(let i=2900; i<=2920; i++) console.log((i+1) + ': ' + lines[i]);

