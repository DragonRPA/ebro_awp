const fs = require('fs');
let c = fs.readFileSync('RELEASE_NOTES.md', 'utf8');
const date = new Date().toISOString().split('T')[0] + ' ' + new Date().toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute: '2-digit'});
const note = `\n### v1.15.3.Build.21 (${date})\n- [버그수정] 신규 계약 작성 폼에서 현장 선택(UI)이 누락되어 있던 레이아웃 결함 복구\n- [개선] 초기 엑셀 DB 업로드 시 '현장담당자', '청구담당자' 텍스트를 최신 3개 유형(장비/마감) 담당자 구조로 자동 변환 이관하도록 마이그레이션 엔진 패치\n`;
c = c.replace('# eBro 릴리즈 노트', '# eBro 릴리즈 노트\n' + note);
fs.writeFileSync('RELEASE_NOTES.md', c);
