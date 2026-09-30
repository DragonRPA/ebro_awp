const fs = require('fs');
const path = 'src/pages/DevDataUploader.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `  return (
    <div>
      {/* 헤더 */}`,
  `  return (
    <div data-subview="dev_uploader" data-subview-title="[개발] DB 데이터 업로더">
      {/* 헤더 */}`
);

content = content.replace(
  `<select
            value={selectedTableKey}`,
  `<select data-mid="schema-mode-tabs"
            value={selectedTableKey}`
);

content = content.replace(
  `<button
            onClick={handleVerifySchema}`,
  `<button data-mid="btn-validate-schema-ssot"
            onClick={handleVerifySchema}`
);

content = content.replace(
  `<textarea readOnly value={\`-- ✅ DB 스키마 자동화 도구 Helper 함수 (최초 1회만 실행)`,
  `<textarea data-mid="ddl-editor-textarea" readOnly value={\`-- ✅ DB 스키마 자동화 도구 Helper 함수 (최초 1회만 실행)`
);

fs.writeFileSync(path, content, 'utf8');
console.log('dev_uploader patched');
