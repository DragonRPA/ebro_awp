const fs = require('fs');
const plan = require('./hindsight-plan-resolved.json');

let output = [];

for (const p of plan) {
  if (!p.fullPath) continue;
  const content = fs.readFileSync(p.fullPath, 'utf-8');
  const lines = content.split('\n');
  
  let fileObj = { file: p.file, observe: [], scope: [], trigger: [] };

  for (const obs of p.observe) {
    const matchLine = lines.find(l => l.includes(`data-hs-observe="${obs}"`));
    if (matchLine) fileObj.observe.push({ name: obs, code: matchLine.trim() });
  }

  for (const scp of p.scope) {
    const matchLine = lines.find(l => l.includes(`data-hs-scope="${scp}"`));
    if (matchLine) fileObj.scope.push({ name: scp, code: matchLine.trim() });
  }

  for (const trg of p.trigger) {
    const matchLine = lines.find(l => l.includes(`data-hs-trigger="${trg}"`));
    if (matchLine) fileObj.trigger.push({ name: trg, code: matchLine.trim() });
  }
  output.push(fileObj);
}

fs.writeFileSync('D:/01.AntiGravity/eBro/extracted.json', JSON.stringify(output, null, 2));
console.log('Saved to extracted.json');
