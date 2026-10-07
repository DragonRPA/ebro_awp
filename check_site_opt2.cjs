const fs = require('fs');
const content = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const lines = content.split('\n');
console.log('--- Around 2909 ---');
for (let i = 2880; i <= 2990; i++) console.log((i+1) + ': ' + lines[i]);
console.log('\n--- Around 3457 ---');
for (let i = 3450; i <= 3540; i++) console.log((i+1) + ': ' + lines[i]);
