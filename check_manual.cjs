
const fs = require('fs');
const content = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('매뉴얼') || line.includes('메뉴얼')) {
    console.log('Line ' + (i+1) + ': ' + line.trim());
  }
});

