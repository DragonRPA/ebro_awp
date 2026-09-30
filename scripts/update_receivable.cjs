const fs = require('fs');

const path = 'src/data/allMenuManuals.ts';
let content = fs.readFileSync(path, 'utf8');

const replacement = `{
    menuId: 'receivable',
    version: 5,
    menuName: '외상미수금 대장',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업/재무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '운송료, 수리비 등 정기 렌탈료 외에 발생하는 각종 부대비용 및 외상 채권을 등록하고 청구/수금 상태를 추적 마감',
    scopeInfo: '고객사, 현장, 계약별 외상 발생일, 비용 유형, 청구 상태 및 외상 총액',
    cognitiveSequence: [
      '1. 상단 컴팩트 필터 패널에서 기간, 고객사, 비용 유형, 청구 상태 스코핑',
      '2. 우상단 [엑셀 다운로드] 또는 [신규 외상 등록] 파이프라인 진입',
      '3. 신규 외상 등록 시 고객사/현장/계약을 양방향으로 검색하여 자동 확정 (단일 계약 추론)',
      '4. 등록된 외상미수금 대장 그리드에서 누락되거나 미청구된 건 인라인 색출',
      '5. 미청구(PENDING) 건에 대해 [단독 청구] 버튼 클릭으로 명세서 즉시 단독 발행 (정기 청구와 분리)',
      '6. 우하단 종결 대차대조식(총 외상 = 기청구액 + 미청구 잔액 | 차액 ₩0) 검증'
    ],
    modalWorkflows: [
      {
        "modalName": "외상 건 신규 등록 팝업 (Add Receivable Modal)",
        "triggerButton": "[신규 외상 등록]",
        "keyFields": [
          "발생일",
          "계약/고객/현장 검색 및 양방향 확정",
          "비용 유형 및 외상 총액",
          "내부 기재명(실제 내역) 및 명세서 표기명"
        ],
        "terminalAction": "[외상 등록 완료]",
        "afterStateTransition": "미수금 원장에 신규 건 등록 완료, 즉시 조회 가능 상태로 전환"
      }
    ],
    auditResult: '총 외상채권 = 기청구액 + 미청구 잔액 합계 일치(차액 ₩0) 확정 및 수금 체계 완결',
    rulesCompliance: [
      '헌장 3.5 [Z-패턴 동선]: 좌상단 필터 ➔ 우상단 등록/엑셀 ➔ 중앙 본문 대장 ➔ 우하단 대차대조식 검증',
      '헌장 3.6 [유형 B 고밀도 그리드]: 세로 영역 80% 작업대 확보, 다수 건 즉시 파악',
      '헌장 3.4 [상하 스택 배치]: 모달 내 모든 필드는 레이블-입력 상하 세로 구조'
    ],
    precautions: [
      '명세서 표기명 누락 시 내부 장부 기재명이 그대로 고객에게 노출되므로 주의',
      '고객사와 현장이 단 1개뿐일 경우 모달에서 자동으로 픽스되므로 편의성 활용'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="receivable-scope"]',
        type: 'stamp',
        label: '외상 조회 및 스코핑',
        description: '통합검색, 비용 유형, 상태, 발생 기간을 통해 미수금 내역을 세밀하게 필터링합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="receivable-pipeline-excel"]',
        type: 'callout',
        label: '외상 대장 엑셀 반출',
        description: '조회된 현재 목록 그대로 경영진 보고용 또는 내부 회계 참고용 엑셀(CSV)로 다운로드합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="receivable-pipeline-add"]',
        type: 'click_ripple',
        label: '신규 외상 건 등록 진입',
        description: '수리비, 배차비, 청소비 등 새로 발생한 외상채권 건을 수기 등록하기 위해 모달을 엽니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 4,
        selector: '[data-mid="receivable-inspection-grid"]',
        type: 'highlight',
        label: '고밀도 외상 대장',
        description: '외상 발생일, 귀속 계약, 내부 기재명 및 남은 미청구 잔액을 한 화면에서 동시 조망하고 대사합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="receivable-inspection-issue"]',
        type: 'click_ripple',
        label: '단독 청구서 발행',
        description: '미청구(PENDING) 건을 정기 렌탈료와 합산하지 않고, 지금 즉시 단독 청구서로 즉발 발행(분리 징수)합니다.',
        badgeColor: '#E53935',
        positionHint: 'right',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="receivable-terminal-audit"]',
        type: 'highlight',
        label: '우하단 종결 대차대조 검증',
        description: '현재 조회된 스코프의 [총 외상채권액 = 기청구액 + 미청구 잔액] 수학적 합계가 정확히 맞아 떨어지는지(차액 ₩0) 무결성을 확정합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="rec-modal-search-box"]',
        type: 'stamp',
        label: '계약 양방향 검색기',
        description: '[모달 내부] 계약번호, 고객명, 현장명을 통합 검색합니다. 1건으로 좁혀지면 3개 필드가 양방향 자동 픽스됩니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 8,
        selector: '[data-mid="rec-modal-cost-type"]',
        type: 'stamp',
        label: '외상 비용 유형 분류',
        description: '[모달 내부] 해당 채권이 수리비인지, 운송료인지, 청소비인지 정확히 분류하여 매출 회계 처리의 기준을 잡습니다.',
        badgeColor: '#F59E0B',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 9,
        selector: '[data-mid="rec-modal-total-amount"]',
        type: 'stamp',
        label: '발생 외상 총액',
        description: '[모달 내부] 공급가액과 부가세가 모두 포함된 청구해야 할 최종(TOTAL) 금액을 입력합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 10,
        selector: '[data-mid="rec-modal-submit-btn"]',
        type: 'click_ripple',
        label: '최종 외상 등록 확정',
        description: '[모달 내부] 모든 항목이 정확히 작성되었음을 확인하고 신규 외상 건을 DB에 영구 등록합니다.',
        badgeColor: '#3B82F6',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  }`;

// Replace the existing object
const regex = /{[\s\S]*?menuId:\s*'receivable'[\s\S]*?\]\n\s*}/;
const match = content.match(regex);
if (match) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully updated receivable manual.');
} else {
  console.error('Could not find receivable manual block.');
}
