const fs = require('fs');
const content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');
const lines = content.split('\n');
for (let i = 700; i <= 740; i++) {
  console.log('Line ' + (i+1) + ': ' + lines[i]);
}
