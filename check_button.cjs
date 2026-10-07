const fs = require('fs');
const content = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('AI') || line.includes('사업자등록증')) {
    console.log(Line : );
  }
});
