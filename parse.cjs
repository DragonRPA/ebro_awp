const fs = require('fs');
const os = require('os');
const path = require('path');
const mdPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', 'f4b14b4f-169b-4e36-9c36-e42dd3680e74', 'hindsight-ui-elements.md');
const content = fs.readFileSync(mdPath, 'utf-8');
const lines = content.split('\n');
const files = [];
let currentFile = null;

for (const line of lines) {
  const fileMatch = line.match(/^## \S+ `(.+?)`/);
  if (fileMatch) {
    currentFile = { file: fileMatch[1], observe: [], scope: [], trigger: [] };
    files.push(currentFile);
    continue;
  }
  if (!currentFile) continue;

  if (line.includes('Observe')) {
    currentFile.currentSection = 'observe';
  } else if (line.includes('Scope')) {
    currentFile.currentSection = 'scope';
  } else if (line.includes('Trigger')) {
    currentFile.currentSection = 'trigger';
  } else if (line.match(/^  - `(.+?)`/)) {
    const val = line.match(/^  - `(.+?)`/)[1];
    if (currentFile.currentSection === 'observe') currentFile.observe.push(val);
    if (currentFile.currentSection === 'scope') currentFile.scope.push(val);
    if (currentFile.currentSection === 'trigger') currentFile.trigger.push(val);
  }
}
fs.writeFileSync('D:/01.AntiGravity/eBro/hindsight-plan.json', JSON.stringify(files, null, 2));
console.log('Total files:', files.length);
console.log('Sample:', files.slice(0, 2));
