const fs = require('fs');
const content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('btn-option-master') || line.includes('tab-toggle')) {
    console.log('Line ' + (i+1) + ': ' + line.trim());
  }
});
