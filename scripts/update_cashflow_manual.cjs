const fs = require('fs');
let content = fs.readFileSync('D:/01.AntiGravity/Giyuen_Lift/src/data/allMenuManuals.ts', 'utf8');

const regex = /menuId:\s*'cash_flow'[\s\S]*?subTabs:\s*\[[\s\S]*?\]\s*\}\s*\]\s*\}/;

const newCashFlow = `menuId: 'cash_flow',
    version: 5,
    menuName: '자금 흐름 분석',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '경영진/재무팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '매출 수납액과 매입 지출액 기반 일일/월별/분기별 현금 유동성 추이 분석 및 차기 자금 집행 예측',
    scopeInfo: '현금/보통예금 잔액, 당월 수금 예정액, 확정 매입 지급액, 고정비(급여/임차료), 여유 자금 지표',
    cognitiveSequence: [
      '1. 기준 일자 및 금융 계좌별 실시간 잔액 스코핑',
      '2. 당일 현금 유입(렌탈료 수납, 매각 대금) 실적 집계',
      '3. 당일 현금 유출(운송료 지급, 부품 매입, 급여, 임차료) 실적 집계',
      '4. 향후 7일/30일간 자금 수지 예측 (청구 예정액 vs 지급 예정액)',
      '5. 자금 부족 예상일 사전 경보 및 단기 유동성 확보 계획 수립',
      '6. 계좌별 이체 한도 및 잔액 증명 대차대조 검증',
      '7. 일일 자금일보 마감 확정 및 대표이사/경영진 보고서 발행'
    ],
    annotations: [
      {
        step: 1,
        selector: '[data-mid="cash_flow-scope"]',
        title: '기준일 및 계좌 스코핑',
        description: '자금 분석 기준일, 전망 기간, 조회 대상 은행 계좌를 설정하여 분석 스코프를 획정합니다.'
      },
      {
        step: 2,
        selector: '[data-mid="cash_flow-pipeline-sync"]',
        title: '실데이터 동기화',
        description: '전사 원장 데이터를 실시간 동기화하여 최신 매출/매입 채권을 자금 계획에 반영합니다.'
      },
      {
        step: 3,
        selector: '[data-mid="cash_flow-pipeline-snapshot"]',
        title: '스냅샷 동결',
        description: '현재 산출된 자금 유동성 전망 데이터를 경영진 보고용 스냅샷으로 영구 동결 보존합니다.'
      },
      {
        step: 4,
        selector: '[data-mid="cash_flow-pipeline-export"]',
        title: '전망대장 엑셀 반출',
        description: '현금흐름 전망 내역을 스프레드시트 포맷으로 외부 반출합니다.'
      },
      {
        step: 5,
        selector: '[data-mid="cash_flow-inspection-summary"]',
        title: '대차대조식 검증 요약',
        description: '기초 잔액과 입출금 합계 기반 종단 보존 법칙 무결성을 검증하고 부도 위험(결손) 여부를 직관적으로 진단합니다.'
      },
      {
        step: 6,
        selector: '[data-mid="cash_flow-inspection-chart"]',
        title: '유동성 밴드 차트',
        description: '예상 누적 잔고와 안전 기준액 간의 이격도를 시계열 그래프로 조망합니다.'
      },
      {
        step: 7,
        selector: '[data-mid="cash_flow-inspection-grid"]',
        title: '일별 유동성 전망 그리드',
        description: '일자별 수납/지출 예정액 및 순유출입 상세 명세를 대사 확인합니다.'
      },
      {
        step: 8,
        selector: '[data-mid="cash_flow-audit-history"]',
        title: '스냅샷 이력 대장',
        description: '과거에 동결된 자금 계획 스냅샷 이력을 추적 및 열람하여 계획 대비 실적 차이를 사후 감사(Audit)합니다.'
      }
    ]
  }`;

content = content.replace(regex, newCashFlow);
fs.writeFileSync('D:/01.AntiGravity/Giyuen_Lift/src/data/allMenuManuals.ts', content);
