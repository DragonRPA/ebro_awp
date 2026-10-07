const fs = require('fs');
const plan = require('./hindsight-plan-resolved.json');

let perfectCount = 0;
let errors = [];

for (const p of plan) {
  if (!p.fullPath) {
    errors.push(p.file + ': File not found');
    continue;
  }
  const content = fs.readFileSync(p.fullPath, 'utf-8');
  let missing = [];

  for (const obs of p.observe) {
    if (!content.includes(`data-hs-observe="${obs}"`)) missing.push('observe=' + obs);
  }
  for (const scp of p.scope) {
    if (!content.includes(`data-hs-scope="${scp}"`)) missing.push('scope=' + scp);
  }
  for (const trg of p.trigger) {
    if (!content.includes(`data-hs-trigger="${trg}"`)) missing.push('trigger=' + trg);
  }

  if (missing.length === 0) {
    perfectCount++;
  } else {
    errors.push(p.file + ' missing: ' + missing.join(', '));
  }
}

console.log('Perfect files:', perfectCount);
if (errors.length > 0) {
  console.log('Errors:', errors);
}
