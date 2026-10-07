
const fs = require('fs');
const content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('사업자등록증 AI') || line.includes('AI 등록/보완') || line.includes('btn-ocr-biz-license')) {
    console.log('Line ' + (i+1) + ': ' + line.trim());
  }
});

