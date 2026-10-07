
const fs = require('fs');
const content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');
const lines = content.split('\n');
for (let i = 540; i <= 555; i++) {
  console.log('Line ' + (i+1) + ': ' + lines[i]);
}
for (let i = 640; i <= 650; i++) {
  console.log('Line ' + (i+1) + ': ' + lines[i]);
}

