const fs = require('fs');
let content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');

// remove step 5
content = content.replace(/"5\. 사업자등록증 AI OCR 자동 등록 및 정보 보완 \(이미지\/PDF 기반 상호\/대표자 자동 파싱\)",\s*/g, '');

// fix numbering of 6 and 7
content = content.replace(/"6\. 국세청 홈택스 사업자 휴폐업 전수 점검 및 여신 리스크 방어"/g, '"5. 국세청 홈택스 사업자 휴폐업 전수 점검 및 여신 리스크 방어"');
content = content.replace(/"7\. 신규 고객 등록 및 신규 현장·담당자 매핑 \([^)]+\)"/g, '"6. 신규 고객 등록 및 신규 현장·담당자 매핑 (현장별 옵션관리 기등록 현장 옵션 속성 검색 및 1클릭 복사 일치로 계약 체결 가용화)"');

// remove the spotlight section for the button
const targetSpotlight = {
        "seq": 5,
        "selector": "[data-mid=\\"btn-ocr-biz-license\\"], button:contains(\\"사업자등록증\\")",
        "type": "click_ripple",
        "label": "사업자등록증 인공지능 보완",
        "description": "사업자등록증 이미지를 올려 상호, 대표자, 등록번호를 자동 파싱합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "bottom",
        "spotlight": true
      },;

content = content.replace(targetSpotlight, '');

fs.writeFileSync('src/data/allMenuManuals.ts', content, 'utf8');
