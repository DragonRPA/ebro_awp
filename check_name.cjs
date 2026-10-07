
const fs = require('fs');
const content = fs.readFileSync('agent/eBroAgent.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('01.')) {
    console.log('Line ' + (i+1) + ': ' + line.trim());
  }
});

