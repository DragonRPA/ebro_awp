const fs = require('fs');
const path = 'src/pages/Receivables.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /\{\/\* 헌장 3\.5 대차대조 검증 및 우하단 종결 액션 바 \*\/\}\r?\n\s*<div style=\{\{/g,
  `{/* 헌장 3.5 대차대조 검증 및 우하단 종결 액션 바 */}
      <div data-mid="receivable-terminal-audit" style={{`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed terminal audit.');
