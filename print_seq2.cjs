const fs = require('fs');
const content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('"CUST_LIST"'));
if (idx !== -1) {
  for (let i = idx; i < idx + 100; i++) {
    console.log(lines[i]);
  }
}
