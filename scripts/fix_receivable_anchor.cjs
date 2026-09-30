const fs = require('fs');
const path = 'src/pages/Receivables.tsx';
let content = fs.readFileSync(path, 'utf8');

// The bottom audit bar starts like this:
//       {/* 헌장 3.5 대차대조 검증 및 우하단 종결 액션 바 */}
//       <div style={{
//         padding: '12px 16px',

content = content.replace(
  `{/* 헌장 3.5 대차대조 검증 및 우하단 종결 액션 바 */}
      <div style={{`,
  `{/* 헌장 3.5 대차대조 검증 및 우하단 종결 액션 바 */}
      <div data-mid="receivable-terminal-audit" style={{`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed terminal audit.');
