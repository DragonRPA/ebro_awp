const fs = require('fs');

const path = 'D:/01.AntiGravity/Giyuen_Lift/src/data/allMenuManuals.ts';
let text = fs.readFileSync(path, 'utf8');

// A helper function to replace version and annotations for a specific menuId
function updateMenuManual(menuId, newAnnotations) {
    const menuRegex = new RegExp(`(menuId:\\s*['"]${menuId}['"]\\s*,[\\s\\S]*?version:\\s*)\\d+(,[\\s\\S]*?)(annotations:\\s*\\[)([\\s\\S]*?)(\\]\\s*})`);
    
    const match = text.match(menuRegex);
    if (!match) {
        console.error('Could not find menuId:', menuId);
        return;
    }
    
    // new version = 5
    const replacement = `${match[1]}5${match[2]}annotations: [\n${newAnnotations}\n    ] }`;
    text = text.replace(menuRegex, replacement);
}

const permissionAnnotations = `
      {
        seq: 1,
        selector: '[data-mid="permission-role-tab"]',
        type: 'click_ripple',
        label: '권한 명칭 관리 탭 진입',
        description: '역할을 정의하고 권한 세트를 할당하기 위한 마스터 설정 화면을 엽니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="permission-create-role"]',
        type: 'highlight',
        label: '신규 권한 명칭 생성',
        description: '새로운 직무나 직책에 맞는 권한 세트를 생성합니다.',
        badgeColor: '#059669',
        positionHint: 'right',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="permission-role-list"]',
        type: 'stamp',
        label: '권한 목록 확인',
        description: '현재 등록된 모든 권한 명칭들을 확인하고 선택할 수 있습니다.',
        badgeColor: '#7C3AED',
        positionHint: 'right',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="permission-bulk-save"]',
        type: 'click_ripple',
        label: '권한 설정 일괄 저장',
        description: '변경된 권한 설정 매트릭스를 시스템에 저장하여 일괄 반영합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 5,
        selector: '[data-mid="permission-user-tab"]',
        type: 'click_ripple',
        label: '직원 권한 상속 배정 탭 진입',
        description: '각 임직원에게 생성된 권한을 상속 및 배정하는 화면으로 전환합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="permission-filter-group"]',
        type: 'stamp',
        label: '직원 스코프 조회',
        description: '부서, 직급, 성명 등의 조건을 통해 권한을 배정할 직원을 조회합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="permission-export-excel"]',
        type: 'callout',
        label: '권한 대장 반출',
        description: '임직원의 현재 권한 상태를 엑셀 문서로 다운로드합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 8,
        selector: '[data-mid="permission-user-grid"]',
        type: 'highlight',
        label: '직원 권한 매핑 테이블',
        description: '임직원 목록에서 각 직원에게 적절한 권한을 드롭다운으로 즉각 배정합니다.',
        badgeColor: '#F59E0B',
        positionHint: 'top',
        spotlight: false,
      }
`;

updateMenuManual('permission', permissionAnnotations);

fs.writeFileSync(path, text);
console.log('permission updated');
