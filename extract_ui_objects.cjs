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
      const trimmed = matchLine.trim().substring(0, 100);
      output += `- \`Observe\`: 林涝等 UI 按眉: \`${trimmed}${trimmed.length === 100 ? '...' : ''}\`\n`;
    }
  }

  // Scope
  for (const scp of p.scope) {
    const matchLine = lines.find(l => l.includes(`data-hs-scope="${scp}"`));
    if (matchLine) {
      const trimmed = matchLine.trim().substring(0, 100);
      output += `- \`Scope\`: 林涝等 UI 按眉: \`${trimmed}${trimmed.length === 100 ? '...' : ''}\`\n`;
    }
  }

  // Trigger
  for (const trg of p.trigger) {
    const matchLine = lines.find(l => l.includes(`data-hs-trigger="${trg}"`));
    if (matchLine) {
      // Find the button tag containing this trigger
      let trimmed = matchLine.trim();
      if (trimmed.startsWith('<button') || trimmed.startsWith('<Button')) {
        trimmed = trimmed.substring(0, 100);
      } else {
        trimmed = trimmed.substring(0, 100);
      }
      output += `- \`Trigger (${trg})\`: 林涝等 UI 按眉: \`${trimmed}${trimmed.length === 100 ? '...' : ''}\`\n`;
    }
  }
  output += '\n';
}

fs.writeFileSync('D:/01.AntiGravity/eBro/ui_objects_list.md', output);
console.log('UI objects extracted.');
