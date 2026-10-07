const fs = require('fs');
const content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');
const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('"menuId": "site_options"'));
if (startIdx !== -1) {
  let inAnnotations = false;
  let count = 0;
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].includes('"annotations": [')) inAnnotations = true;
    if (inAnnotations) {
      console.log(lines[i]);
      if (lines[i].includes(']')) count++;
      if (count === 1) break; // end of annotations array
    }
  }
}
