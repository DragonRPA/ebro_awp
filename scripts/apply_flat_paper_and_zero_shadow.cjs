// scripts/apply_flat_paper_and_zero_shadow.cjs
// 📜 전사 UI 종이질감 톤 안정화 (#fbf9f5 -> #f5f2eb, #f5f2eb -> #ebe5d8) 및 테두리 그림자(box-shadow) 전면 제거 스크립트

const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) results = results.concat(walk(full));
    else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css') || file.endsWith('.html')) results.push(full);
  });
  return results;
}

const files = walk('src');
let replacedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // 1. #fbf9f5 -> #f5f2eb 치환 (단, index.css는 아래에서 정밀 처리)
  if (file !== path.normalize('src/index.css')) {
    if (content.includes('#fbf9f5')) {
      content = content.replace(/#fbf9f5/g, '#f5f2eb');
    }
    if (content.includes('rgba(251, 249, 245')) {
      content = content.replace(/rgba\(251,\s*249,\s*245/g, 'rgba(245, 242, 235');
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    replacedCount++;
    console.log(`  [${file}] Converted #fbf9f5 -> #f5f2eb`);
  }
});

console.log(`\n🎉 Total converted files for #fbf9f5 -> #f5f2eb: ${replacedCount}`);
