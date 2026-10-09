const fs = require('fs');
let c = fs.readFileSync('RELEASE_NOTES.md', 'utf8');
const date = new Date().toISOString().split('T')[0] + ' ' + new Date().toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute: '2-digit'});
const note = `\n### v1.15.1.Build.19 (${date})\n- [개선] 신규 현장 등록 및 참조 기능 사용 시 '최소 입력' 원칙에 맞게 현장명/주소 자동 복사 적용\n- [개선] 계약 승계 모달에서 양수 현장 및 담당자 필수 선택 기능 추가 (승계 논리적 결함 패치)\n- [아키텍처] N:M 다중 승계 및 족보 추적을 위해 ContractAsset 단위로 predecessorContractId 및 predecessorContractAssetId를 기억하는 마이크로 족보 구조 도입 (복합 족보 조회 지원)\n`;
c = c.replace('# eBro 릴리즈 노트', '# eBro 릴리즈 노트\n' + note);
fs.writeFileSync('RELEASE_NOTES.md', c);
