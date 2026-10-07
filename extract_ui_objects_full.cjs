const fs = require('fs');
const plan = require('./hindsight-plan-resolved.json');

let output = '';

for (const p of plan) {
  if (!p.fullPath) continue;
  const content = fs.readFileSync(p.fullPath, 'utf-8');
  const lines = content.split('\n');

  output += `**${p.file}**\n`;

  // Observe
  for (const obs of p.observe) {
    const matchLine = lines.find(l => l.includes(`data-hs-observe="${obs}"`));
    if (matchLine) {
      output += `- \`Observe\`: 林涝等 UI 按眉: \`${matchLine.trim()}\`\n`;
    }
  }

  // Scope
  for (const scp of p.scope) {
    const matchLine = lines.find(l => l.includes(`data-hs-scope="${scp}"`));
    if (matchLine) {
      output += `- \`Scope\`: 林涝等 UI 按眉: \`${matchLine.trim()}\`\n`;
    }
  }

  // Trigger
  for (const trg of p.trigger) {
    const matchLine = lines.find(l => l.includes(`data-hs-trigger="${trg}"`));
    if (matchLine) {
      output += `- \`Trigger (${trg})\`: 林涝等 UI 按眉: \`${matchLine.trim()}\`\n`;
    }
  }
  output += '\n';
}

fs.writeFileSync('D:/01.AntiGravity/eBro/ui_objects_list_full.md', output);
console.log('UI objects extracted fully.');
