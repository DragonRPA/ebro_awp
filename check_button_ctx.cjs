
const fs = require('fs');
const content = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 1180; i <= 1200; i++) {
  console.log('Line ' + (i+1) + ': ' + lines[i]);
}

