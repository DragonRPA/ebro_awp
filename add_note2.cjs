const fs = require('fs');
let c = fs.readFileSync('RELEASE_NOTES.md', 'utf8');
const date = new Date().toISOString().split('T')[0] + ' ' + new Date().toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute: '2-digit'});
const note = `\n### v1.15.2.Build.20 (${date})\n- [버그수정] 계약 승계 모달에서 양수 현장 담당자 목록이 노출되지 않는 문제 해결 (현장 전용 담당자 3개 유형 매핑 누락 픽스)\n`;
c = c.replace('# eBro 릴리즈 노트', '# eBro 릴리즈 노트\n' + note);
fs.writeFileSync('RELEASE_NOTES.md', c);
