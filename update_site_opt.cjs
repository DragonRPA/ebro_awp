const fs = require('fs');
let content = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

const lines = content.split('\n');

const tabBtnStart = lines.findIndex(l => l.includes('옵션 품목 마스터 (') && l.includes('{standardOptions?.length')) - 20;
// lines 403 to 424.
// Let's accurately slice out lines 402 to 423 (0-indexed).

const newLines = [];
let i = 0;
while (i < lines.length) {
  if (lines[i].trim() === '<button' && lines[i+1].includes('onClick={() => setActiveTab(\'MASTER_OPTIONS\')}') && lines[i+2].includes('style={{') && lines[i+19].includes('옵션 품목 마스터 ({standardOptions?.length || 0})')) {
    // skip 22 lines
    i += 22;
    continue;
  }
  newLines.push(lines[i]);
  i++;
}

content = newLines.join('\n');

// Now swap the two buttons.
const excelBtnRegex = /(\s*\{\/\* 엑셀 내보내기 버튼 \*\/\}\s*<button[\s\S]*?엑셀 내보내기\s*<\/button>)/;
const masterBtnRegex = /(\s*\{\/\* 옵션 품목 마스터 버튼 \(고객관리에서 이동배치\) \*\/\}\s*<button[\s\S]*?옵션 품목 마스터\s*<\/button>)/;

const excelMatch = content.match(excelBtnRegex);
const masterMatch = content.match(masterBtnRegex);

if (excelMatch && masterMatch) {
  content = content.replace(excelMatch[0], '[[EXCEL_BTN]]');
  content = content.replace(masterMatch[0], '[[MASTER_BTN]]');
  
  content = content.replace('[[EXCEL_BTN]]', masterMatch[0]);
  content = content.replace('[[MASTER_BTN]]', excelMatch[0]);
}

fs.writeFileSync('src/pages/SiteOptionManage.tsx', content, 'utf8');
