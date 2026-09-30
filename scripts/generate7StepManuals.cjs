// scripts/generate7StepManuals.cjs
// 전사 51개 메뉴 매뉴얼을 7단계 심층 비즈니스 워크플로우로 전면 확장 생성하는 빌더 스크립트
const fs = require('fs');
const path = require('path');

// 50개 메뉴(smart_dispatch4 제외 50개)에 대한 7단계 심층 정의 매핑
const SEVEN_STEP_DEFS = {
  dashboard: {
    seqs: [
      '1. 상단 당면 과제(ToDo 피드) 카드뉴스 확인 (출고 검수 대기, 미배정 배차, AS 긴급 출동, 미결재 건 등)',
      '2. 주기장 기상 위젯 및 작업 환경 지표 점검 (강풍/강우 시 고소작업대 상하차 안전 유의)',
      '3. 주요 파이프라인 KPI 카운터(임대가능, 대여중, 정비중, 연체 채권) 클릭을 통한 해당 전담 메뉴 즉시 이동',
      '4. 배차 운송 및 출고 진행 파이프라인 확인 (당일 상차/출발/도착 실시간 추적)',
      '5. 긴급 A/S 및 입고 정비 큐 조망 (현장 긴급 출동 요망 건 및 수리 지연 건 식별)',
      '6. 월간 매출 목표 및 당일 정산 현황 검토 (청구 및 입금 대사 진행률 확인)',
      '7. 직무별 전담 화면 1클릭 바로가기를 통한 당일 업무 본격 착수'
    ],
    ann: [
      { seq: 1, selector: '.todo-feed-container, [data-mid="todo-feed"], .dashboard-todo', type: 'callout', label: '직무별 ToDo 피드', description: '로그인한 직무에 즉시 필요한 당면 과제(출고검수, 배차, 결재 등)를 최우선 노출합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: true },
      { seq: 2, selector: '.weather-widget, [data-mid="weather-widget"]', type: 'stamp', label: '기상 및 작업 환경', description: '주기장 및 현장 상하차 작업 안전을 위한 실시간 풍속/강우 정보입니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '.kpi-summary-cards, [data-mid="kpi-cards"]', type: 'highlight', label: '자산 가동 현황 요약', description: '임대가능, 대여중, 정비중 등 전사 자산 상태를 실시간 집계합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '.dispatch-pipeline-card, [data-mid="dispatch-card"]', type: 'stamp', label: '배차 운송 파이프라인', description: '당일 상차 및 출발 예정인 배차 건의 진행 상태를 모니터링합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '.as-repair-queue-card, [data-mid="repair-card"]', type: 'callout', label: '긴급 AS 및 정비 큐', description: '현장 긴급 출동 및 주기장 입고 수리 대기 건을 즉시 파악합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '.monthly-target-card, [data-mid="settlement-card"]', type: 'highlight', label: '매출 목표 및 정산', description: '당월 청구 마감 및 통장 입금 대사 진행률을 확인합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '.quick-actions-bar, [data-mid="quick-nav"]', type: 'click_ripple', label: '전담 메뉴 즉시 이동', description: '클릭 한 번으로 해당 부서 전문 작업대로 바로 진입합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  approvalInbox: {
    seqs: [
      '1. 상단 결재함 탭 스코핑 (결재 대기 / 진행중 / 결재 완료 / 참조 문서)',
      '2. 결재 유형 필터링 (정산, 계약, 인사, 자산, 고객, 보고 6대 유형 분류)',
      '3. 결재 문서 상세 컨텍스트 검토 (품의 내용, 청구 금액, 거래처, 첨부 서류 확인)',
      '4. 결재선 티어 및 전결 규정 검증 (기안자 직급·직책 및 필요 승인 티어 적합성 판정)',
      '5. 지출/정산 대차대조 수학적 검증 (단가, 수량, 계좌번호, 세금계산서 증빙 1:1 대사)',
      '6. 사전 합의 및 협조 의견 작성 (필요 시 수정/보완 요구)',
      '7. 최종 전자서명 승인 및 사유 명시 반려 (Audit Trail 영구 보존 확정)'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="approval-tabs"], .approval-tab-bar', type: 'stamp', label: '결재함 상태 탭', description: '결재 대기, 진행중, 완료함 탭을 선택하여 처리 대상 문서를 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="approval-type-filter"], .type-filter', type: 'stamp', label: '결재 유형 필터', description: '정산, 계약, 인사, 자산, 고객, 보고 유형별로 필터링합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="approval-doc-detail"], .approval-detail-view', type: 'highlight', label: '품의 문서 상세', description: '기안자가 작성한 품의 내용, 청구 금액, 증빙 서류를 면밀히 검토합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="approval-tier-badge"], .tier-info-badge', type: 'callout', label: '결재 티어 검증', description: '기안자의 직급/직책과 규정에 따른 필요 승인 티어를 확인합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="approval-math-audit"], .audit-box', type: 'highlight', label: '지출 금액 검증', description: '청구 단가와 수량, 계좌 정보 및 세금계산서 일치 여부를 검증합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="approval-comment-input"], textarea.approval-comment', type: 'stamp', label: '결재 의견 작성', description: '합의 또는 반려 시 구체적인 사유와 지시사항을 기록합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-approve-final"], button.btn-approve', type: 'click_ripple', label: '최종 결재 승인', description: '전자서명을 완료하고 상위 결재선 또는 최종 완결 상태로 확정합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  approvalRules: {
    seqs: [
      '1. 상단 결재 카테고리 탭 스코핑 (고객, 계약, 자산, 정산, 인사, 보고 6대 유형)',
      '2. 전사 직급별·직책별 결재 권한 티어(0~7티어) 설정 현황 점검',
      '3. 비즈니스 이벤트별 기준 금액 및 전결 필요 티어 지정',
      '4. 부서간 사전 합의 부서(영업/관리/임원) 체인 구성',
      '5. 일상업무 불필요 결재선 제거 및 실익 중심 검증 (헌장 1.2)',
      '6. [표준 규칙 동기화] 버튼을 통한 DB 누락 규칙 자동 주입',
      '7. 결재선 규칙 최종 저장 및 인사 관리 연동 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="rule-category-tabs"], .rule-tabs', type: 'stamp', label: '결재 카테고리 탭', description: '고객, 계약, 자산, 정산, 인사, 보고 6대 유형별로 규칙을 조회합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="tier-config-panel"], .tier-panel', type: 'highlight', label: '결재 권한 티어', description: '0티어 사원부터 7티어 대표이사까지 직급·직책별 티어를 설정합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="rule-threshold-input"], .threshold-input', type: 'stamp', label: '기준 금액 및 필요 티어', description: '해당 결재 이벤트 승인에 필요한 최소 결재 티어와 금액 기준을 지정합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 4, selector: '[data-mid="rule-approvers-chain"], .chain-selector', type: 'callout', label: '합의선 체인 구성', description: '최종 승인 전에 거쳐야 하는 사전 합의 부서와 담당자를 연결합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="rule-table-grid"], table.rules-table', type: 'highlight', label: '결재 규칙 테이블', description: '일상업무 중복 결재선이 배제된 15개 정예 결재선 규칙을 조망합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-sync-rules"], button:contains("표준 규칙 동기화")', type: 'click_ripple', label: '표준 규칙 동기화', description: '원격 DB에 누락된 표준 결재선 레코드를 일괄 점검하고 동기화합니다.', badgeColor: '#4F46E5', positionHint: 'bottom', spotlight: true },
      { seq: 7, selector: '[data-mid="btn-save-rules"], button.btn-save', type: 'click_ripple', label: '결재 규칙 최종 저장', description: '설정한 결재 규칙을 DB에 영구 반영하여 인사정보와 즉시 연동합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  customer: {
    seqs: [
      '1. 거래처 조회 및 여신 상태 필터링 (정상, 거래중지, 요주의, 폐업)',
      '2. 신규 사업자등록증 첨부 및 AI OCR 자동 파싱 (상호, 대표자, 업태 자동 입력)',
      '3. 홈택스 국세청 실시간 사업자 유효성 검증',
      '4. 거래처 기본 정보 및 전자세금계산서 청구 이메일/담당자 등록',
      '5. 투입 현장 주소 검색 및 지번/도로명 좌표 매핑 (운송비 산정 기준)',
      '6. 현장별 안전 관리자 및 작업지시서 특약 사항 등록',
      '7. 거래처 및 현장 최종 등록 승인 (헌장 1.2 이벤트 무누락 DB 저장)'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="customer-search-filter"], .customer-filters', type: 'stamp', label: '거래처 검색 필터', description: '상호명, 사업자번호, 여신 상태별로 거래처를 조회합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="btn-ocr-biz-license"], button:contains("사업자등록증")', type: 'click_ripple', label: '사업자등록증 OCR', description: '사업자등록증 이미지를 올려 상호, 대표자, 등록번호를 자동 파싱합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: true },
      { seq: 3, selector: '[data-mid="btn-hometax-verify"], button:contains("국세청 검증")', type: 'callout', label: '국세청 유효성 검증', description: '홈택스 API를 통해 계속사업자 여부 및 휴폐업 상태를 실시간 확인합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 4, selector: '[data-mid="customer-form-basic"], .customer-basic-fields', type: 'highlight', label: '기본 및 청구 정보', description: '대표자명, 연락처, 전자세금계산서 전용 청구 이메일을 입력합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="site-address-input"], .site-address-box', type: 'stamp', label: '현장 주소 매핑', description: '장비가 투입될 현장 도로명 주소와 상하차 진입로 특이사항을 등록합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="site-safety-manager"], .site-contact-fields', type: 'stamp', label: '현장 안전 관리자', description: '현장 소장 및 안전 관리자 직통 연락처와 현장 안전 수칙을 기재합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-save-customer"], button:contains("고객사 저장")', type: 'click_ripple', label: '고객사 최종 저장', description: '거래처 및 현장 정보를 DB에 영구 등록하고 계약 체결을 가용화합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  contract: {
    seqs: [
      '1. 계약 조회 스코프 및 상태(진행중/완료/해지) 필터링',
      '2. 신규 계약 기본 정보 입력 (고객사 및 투입 현장 매핑)',
      '3. 렌탈 요구 장비 모델 및 일할 단가/청구 마감일 조건 설정 (헌장 2.2)',
      '4. 현장 특약 및 작업지시서·안전옵션 사양 검토',
      '5. 계약 체결 및 전자서명·PDF 계약서 발송',
      '6. 계약 변경 관리 (기간 연장/단축 및 단가 변경 이력 타임라인 보존)',
      '7. 대차 교체(EXCHANGE) 의뢰 및 출고부서 바통 인계 (헌장 2.1, 4.2)'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="contract-filter"], .contract-filters', type: 'stamp', label: '계약 조회 스코프', description: '진행 상태, 거래처, 현장별로 계약 목록을 조회합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="btn-new-contract"], button:contains("신규 계약")', type: 'click_ripple', label: '신규 계약 작성', description: '새로운 렌탈 임대차 계약서를 작성하고 고객사/현장을 매핑합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: true },
      { seq: 3, selector: '[data-mid="contract-equipments-block"], .contract-equipments', type: 'highlight', label: '장비 모델 및 단가', description: '요구 모델, 월 단가, 일할 기준 및 청구 마감일 조건을 설정합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="contract-safety-options"], .contract-options', type: 'stamp', label: '안전옵션 및 작업지시', description: '협착방지대, 경광등 등 현장 필수 안전옵션 규격을 지정합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="contract-detail-dossier"], .contract-dossier', type: 'highlight', label: '계약 체결 도시에', description: '체결 장비, 일할 기여액, 계약서 전자서명 및 PDF 인쇄를 진행합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-contract-amendment"], button:contains("기간 연장")', type: 'callout', label: '계약 변경 이력', description: '계약 기간 연장/단축 및 단가 변경 이력을 타임라인에 무누락 보존합니다.', badgeColor: '#4F46E5', positionHint: 'left', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-exchange-request"], button:contains("대차/교체")', type: 'click_ripple', label: 'EXCHANGE 대차 의뢰', description: '현장 고장 시 단일 EXCHANGE 배차를 발행하고 출고부서로 인계합니다.', badgeColor: '#E53935', positionHint: 'left', spotlight: true }
    ]
  },
  billing: {
    seqs: [
      '1. 좌상단 정산 연월 및 청구 마감일 조건 스코핑 (1일~말일, 15일~익월14일 등)',
      '2. 미청구 및 청구 대기 거래처 파이프라인 필터링',
      '3. 자산별 누적 가동일수 및 정밀 일할 매출 계산식 검증 (헌장 4.1)',
      '4. 대차 교체 자산 매출 승계 1:1 대사 확인 (전자산 전일 마감 ➔ 후장비 당일 승계)',
      '5. 부가세(VAT 10%) 및 선수금/공제액 정밀 산출',
      '6. 거래처별 매출 청구서/거래명세표 PDF 인쇄 및 전자발송',
      '7. 청구 마감 확정 및 외상매출금(미수금) 원장 자동 이관 (Audit Result)'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="billing-period-scope"], .billing-scope', type: 'stamp', label: '정산 연월 스코프', description: '정산 연월과 청구 마감 주기(말일/특약일)를 선택합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="billing-customer-filter"], .customer-select', type: 'stamp', label: '청구 대상 거래처', description: '당월 청구 대상 거래처 및 미청구 현황을 필터링합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="billing-grid-pro-rata"], table.billing-table', type: 'highlight', label: '일할 매출 집계표', description: '자산별 실가동 일수와 일할 단가를 곱해 정확한 매출액을 계산합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="exchange-audit-cell"], .exchange-audit', type: 'callout', label: '대차 교체 매출 승계', description: '전자산 교체 전일까지 마감 ➔ 후장비 당일부터 승계 집계를 확인합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="billing-vat-summary"], .vat-box', type: 'stamp', label: '공급가 및 부가세', description: '공급가액, 부가세 10%, 할인/공제액 합계를 수학적으로 검증합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-print-invoice"], button:contains("명세서 출력")', type: 'click_ripple', label: '거래명세표 PDF 발행', description: '국세청 전자세금계산서 연동 및 청구서/명세표 PDF를 출력·발송합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: true },
      { seq: 7, selector: '[data-mid="btn-finalize-billing"], button:contains("청구 확정")', type: 'click_ripple', label: '매출 청구 마감 확정', description: '청구를 최종 마감하고 외상매출금 원장으로 데이터를 자동 이관합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  receivable: {
    seqs: [
      '1. 기준 연월 및 미수 채권 구간 스코핑 (30일 미만, 60일, 90일 이상 악성)',
      '2. 거래처별 총 청구액, 기입금액, 미수 잔액 대차대조 조망',
      '3. 거래처별 수납 이력 및 통장 입금 매칭 내역 인라인 확인',
      '4. 미수금 회수 담당 영업사원 배정 및 채권 회수 메모 기록',
      '5. 60일 이상 장기 연체 건 독촉장(최고장) 서식 자동 생성 및 발송',
      '6. 부실 채권 대손 상각 및 결재 상신 (헌장 결재선 연동)',
      '7. 월말 채권 현황 확정 마감 및 경영진 보고용 엑셀 내보내기'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="receivable-scope-filter"], .receivable-scope', type: 'stamp', label: '채권 구간 스코프', description: '당월 청구, 30일/60일/90일 초과 연체 구간별로 채권을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="receivable-balance-grid"], table.receivable-table', type: 'highlight', label: '미수 잔액 대차대조', description: '거래처별 총청구액 - 기입금액 = 미수잔액 무결성을 한눈에 조망합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="receivable-history-drawer"], .history-drawer', type: 'callout', label: '수납 및 입금 이력', description: '해당 거래처의 과거 입금 내역 및 통장 대사 매칭 내역을 확인합니다.', badgeColor: '#7C3AED', positionHint: 'bottom', spotlight: false },
      { seq: 4, selector: '[data-mid="receivable-memo-input"], .memo-box', type: 'stamp', label: '채권 회수 활동 기록', description: '담당 영업사원의 입금 독려 전화 및 현장 방문 면담 메모를 기록합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="btn-generate-notice"], button:contains("독촉장")', type: 'click_ripple', label: '독촉장/최고장 생성', description: '장기 연체 거래처에 발송할 법적 최고장 및 안내장을 자동 생성합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: true },
      { seq: 6, selector: '[data-mid="btn-bad-debt-request"], button:contains("대손 상각")', type: 'callout', label: '대손 상각 결재', description: '폐업 등 회수 불능 채권에 대한 대손 처리 및 탕감 결재를 상신합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-export-receivable"], button:contains("엑셀 내보내기")', type: 'click_ripple', label: '채권 마감 및 엑셀', description: '월말 미수금 대장을 최종 마감하고 경영진 보고용 원장을 다운로드합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  smart_return: {
    seqs: [
      '1. 반납 요청 텍스트(카톡/문자) 자동 파싱 및 계약 매핑',
      '2. 반납 대상 현장 및 투입 자산 일련번호 확인',
      '3. 반납 희망 일시 및 현장 상차 환경(지게차/크레인 유무) 입력',
      '4. 장비 파손/오염 여부 1차 문진 및 현장 사진 첨부',
      '5. 회수 배차 운송비 부담 주체 설정 (고객부담 / 당사부담 / 원사부담)',
      '6. 입고 검수 및 정비부서 반납 입고 예고 자동 통보',
      '7. 반납 요청 최종 발행 및 단일 회수 배차 의뢰 연동 (헌장 2.3)'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="return-paste-zone"], .return-paste-area', type: 'callout', label: '반납 텍스트 파싱', description: '카톡/문자로 수신된 반납 요청을 붙여넣어 계약과 현장을 자동 매핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: true },
      { seq: 2, selector: '[data-mid="return-asset-select"], .asset-select-grid', type: 'stamp', label: '회수 대상 자산 확인', description: '해당 현장에 투입되어 있는 대여중 자산번호와 모델을 선택합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="return-schedule-input"], .schedule-box', type: 'stamp', label: '반납 일시 및 상차 환경', description: '회수 희망 일시와 현장 지게차 유무, 진입로 높이 제한을 기재합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="return-damage-check"], .damage-survey', type: 'highlight', label: '파손/오염 1차 문진', description: '도색 오염, 레버 파손 등 특이사항을 사전 확인하고 사진을 등록합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="return-freight-payer"], .freight-payer-select', type: 'stamp', label: '운송비 귀속선 지정', description: '회수 운송비 부담 주체(고객사, 당사, 원사)를 명확히 판정합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="return-preview-dossier"], .preview-box', type: 'highlight', label: '입고 예고 통보서', description: '주기장 입고 검수 및 정비 부서로 전송될 사전 예고서를 검토합니다.', badgeColor: '#2563EB', positionHint: 'left', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-submit-return"], button.btn-submit-return', type: 'click_ripple', label: '반납 요청 최종 발행', description: '반납 요청을 공식 발행하고 배차부서로 회수 배차 의뢰를 전송합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  smart_as_request: {
    seqs: [
      '1. 긴급 A/S 요청 자연어 접수 및 계약/현장 자동 조회',
      '2. 고장 장비 자산번호 및 에러 코드(리프트 미작동, 유압 누유 등) 식별',
      '3. 고장 증상 유형 분류 (긴급 출동 vs 유선 조치 vs 대차 교체 판정)',
      '4. 현장 비대면/대면 담당자 연락처 및 작업 층수/진입로 확인',
      '5. A/S 출동 엔지니어 지정 및 긴급 출동 지시서 발행',
      '6. 현장 수리 불가 판정 시 [EXCHANGE 대차 교체 요구] 원클릭 즉시 전환 (헌장 2.1)',
      '7. A/S 접수 티켓 확정 및 정비 이력 DB 무누락 기록 (헌장 1.2)'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="as-paste-zone"], .as-paste-area', type: 'callout', label: 'AS 접수 텍스트 파싱', description: '현장 반장님의 고장 문자/카톡을 붙여넣어 계약 현장을 자동 탐색합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: true },
      { seq: 2, selector: '[data-mid="as-asset-picker"], .as-asset-selector', type: 'stamp', label: '고장 자산 및 에러코드', description: '현장 투입 장비 중 고장 발생 자산과 계기판 에러코드를 매핑합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="as-severity-radios"], .severity-options', type: 'stamp', label: '증상 유형 및 긴급도', description: '상승 불가, 주행 불가, 배터리 방전 등 긴급도를 선택합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="as-site-contact"], .site-contact-inputs', type: 'highlight', label: '현장 위치 및 작업 층수', description: '장비가 위치한 층수(지하/지상), 진입 경로 및 현장 담당자를 확인합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="as-engineer-assign"], .engineer-picker', type: 'stamp', label: '출동 엔지니어 지정', description: '현장 권역 전담 정비 엔지니어와 출동 차량을 배정합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-convert-exchange"], button:contains("대차 전환")', type: 'callout', label: '대차 교체 즉시 전환', description: '현장 수리 불가 시 EXCHANGE 단일 대차 요구로 원클릭 전환합니다.', badgeColor: '#E53935', positionHint: 'left', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-submit-as"], button.btn-submit-as', type: 'click_ripple', label: 'AS 지시서 최종 발행', description: 'AS 접수 티켓을 확정하고 엔지니어 모바일로 출동 지령을 전달합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  delinquency: {
    seqs: [
      '1. 연체 기간별 채권 분류 스코핑 (30일/60일/90일 이상 연체)',
      '2. 거래처별 연체 원금, 연체 이자, 누적 회수율 실시간 산출',
      '3. 고객사 대표 및 현장소장 실시간 유선 독촉 및 면담 이력 기록',
      '4. 현장 투입 장비 점유 가압류 또는 가동 정지(시동 차단) 경고 발송',
      '5. 1차 독촉장 및 내용증명 법적 최고장 PDF 원클릭 생성 및 발송',
      '6. 회수 불가 악성 채권 대손 처리 및 연체 탕감 전자결재 상신',
      '7. 연체 채권 관리 대장 마감 및 법적 회수 절차 이관 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="delinquency-aging-filter"], .aging-tabs', type: 'stamp', label: '연체 기간 스코프', description: '30일, 60일, 90일 이상 장기 연체 채권 구간을 필터링합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="delinquency-summary-grid"], table.delinquency-table', type: 'highlight', label: '연체 원금 및 이자', description: '거래처별 연체 원금, 지연 이자, 미회수 잔액을 정밀 조망합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="delinquency-call-log"], .call-log-section', type: 'stamp', label: '독촉 및 면담 이력', description: '대표자 통화 내역, 약속 입금일, 현장 방문 결과를 기록합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="btn-lock-equipment"], button:contains("가동 정지")', type: 'callout', label: '장비 가동 정지 경고', description: '미납 지속 시 현장 장비 시동 차단 및 강제 회수 경고를 발송합니다.', badgeColor: '#E53935', positionHint: 'left', spotlight: false },
      { seq: 5, selector: '[data-mid="btn-legal-notice"], button:contains("최고장 발행")', type: 'click_ripple', label: '법적 최고장 PDF 생성', description: '우체국 내용증명 발송용 법적 채무 변제 최고장을 즉시 출력합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: true },
      { seq: 6, selector: '[data-mid="btn-debt-relief-request"], button:contains("탕감 결재")', type: 'callout', label: '연체 탕감 결재 상신', description: '원금 일부 회수 후 잔여 이자 탕감 시 전자결재 승인을 상신합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-close-delinquency"], button.btn-close-case', type: 'click_ripple', label: '채권 마감 및 법적 이관', description: '채권 관리 상태를 갱신하고 법률 대리인 이관 또는 종결 처리합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  product: {
    seqs: [
      '1. 장비 분류 스코핑 (시저형, 굴절형, 직진형, 궤도형 고소작업대)',
      '2. 신규 모델명, 제조사, 플랫폼 최대 작업 높이 제원 입력',
      '3. 정격 하중(수용 인원 및 공구 중량), 자체 중량, 등판각도 스펙 검증',
      '4. 표준 월 렌탈료 단가표 및 일할 단가 기준 등록',
      '5. 정기 안전인증(KCs) 및 비파괴 검사 기준 주기 설정',
      '6. 권장 정비 부품 및 필수 소모품(배터리, 모터, 오일) BOM 매핑',
      '7. 장비 모델 마스터 최종 승인 및 렌탈 자산 등록 가용화'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="product-type-filter"], .type-filter-bar', type: 'stamp', label: '장비 기종 분류', description: '시저형, 굴절형, 직진형 등 장비 메커니즘별로 목록을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="product-model-input"], .model-input-group', type: 'stamp', label: '모델명 및 작업 높이', description: '제조사와 모델명, 최대 플랫폼 작업 가능 높이(m)를 등록합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="product-specs-card"], .specs-card', type: 'highlight', label: '적재 하중 및 자체 중량', description: '정격 적재 하중(kg), 탑승 인원, 장비 자체 중량 제원을 검증합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="product-pricing-card"], .pricing-card', type: 'stamp', label: '표준 렌탈 단가표', description: '표준 월 렌탈 단가와 일할 계산 단가 기준을 입력합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="product-safety-cert"], .safety-cert-box', type: 'stamp', label: '법정 안전인증 기준', description: '안전보건공단 안전인증(KCs) 및 비파괴 검사 만료 주기를 설정합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="product-bom-mapping"], .bom-box', type: 'callout', label: '소모품 BOM 매핑', description: '해당 기종에 투입되는 정품 배터리 규격과 유압 부품을 연결합니다.', badgeColor: '#4F46E5', positionHint: 'left', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-save-product"], button:contains("모델 저장")', type: 'click_ripple', label: '모델 마스터 확정', description: '모델 제원을 최종 저장하고 실물 자산 취득 및 계약에 가용화합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  asset: {
    seqs: [
      '1. 자산 상태별 스코핑 (임대가능, 대여중, 출고대기, 입고검수, 수리중, 폐기)',
      '2. 자산 식별 바코드/QR코드 및 시리얼 번호(차대번호) 검색',
      '3. 장비 위치(본사 주기장, 2주기장, 고객사 현장) 및 가동 시간(Hour Meter) 조회',
      '4. 자산별 누적 매출 기여액 및 일할 가동율 통계 확인 (헌장 4.1)',
      '5. 정비 점수 및 소모품 교체 주기(배터리, 타이어, 유압호스) 이력 점검',
      '6. 장비 상태 수동 조정 및 주기장 간 이동 지시 (입출고 이벤트 추적)',
      '7. 실물 자산 실사 마감 및 자산 마스터 DB 무결성 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="asset-status-filter"], .status-filter-pills', type: 'stamp', label: '자산 상태 필터', description: '임대가능, 대여중, 출고대기, 수리중 상태별로 자산을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="asset-search-input"], .asset-search-bar', type: 'stamp', label: '자산번호/QR 검색', description: '개별 자산 일련번호, 바코드, 차대번호로 특정 장비를 즉시 조회합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="asset-location-cell"], .location-badge', type: 'highlight', label: '현재 위치 및 아워미터', description: '현재 배치된 주기장 또는 대여 현장 주소와 누적 가동시간을 확인합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="asset-revenue-card"], .revenue-stat-box', type: 'highlight', label: '누적 매출 기여액', description: '계약별 일할 계산으로 축적된 장비의 총 매출 기여액을 확인합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="asset-maintenance-score"], .score-badge', type: 'callout', label: '정비 점수 및 이력', description: '정비 이력과 소모품 교체 주기, 누적 정비 비용을 점검합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-move-yard"], button:contains("주기장 이동")', type: 'click_ripple', label: '주기장간 이동 지시', description: '본사 주기장과 지점 주기장 간의 장비 이동 배차를 발행합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: true },
      { seq: 7, selector: '[data-mid="btn-asset-audit-close"], button.btn-audit-close', type: 'click_ripple', label: '자산 실사 확정', description: '실물 자산의 상태와 수량을 최종 승인하고 마스터 DB를 동기화합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  acquisition_disposal: {
    seqs: [
      '1. 취득/매각/폐기 구분 탭 및 처리 대상 자산 스코핑',
      '2. 신규 자산 취득 정보 입력 (구입처, 취득가액, 취득일자, 제조연월)',
      '3. 취득 자산 검수 및 시리얼·바코드 자산 라벨 출력 큐 전송',
      '4. 노후/전손 장비 매각 및 폐기 사유 평가 (수리비 과다, 연식 초과)',
      '5. 매각 대금 정산 및 세금계산서 발행, 감가상각 잔존가액 상계',
      '6. 자산 매각/폐기 전자결재 상신 (헌장 필수 결재선 연동)',
      '7. 자산 원장 영구 제각 처리 및 취득/처분 이력 DB 확정 보존'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="acq-disp-tabs"], .acq-disp-tab-bar', type: 'stamp', label: '취득/처분 탭 스코프', description: '신규 취득, 매각 처분, 폐기 제각 탭을 선택하여 작업 대상을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="acq-info-form"], .acquisition-fields', type: 'highlight', label: '취득 제원 및 매입가', description: '제조사, 모델, 구입처, 취득원가, 차대번호를 정확히 기재합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="btn-print-asset-label"], button:contains("라벨 출력")', type: 'click_ripple', label: '자산 라벨 출력 전송', description: '신규 자산 번호가 부여된 QR/바코드 실물 라벨을 출력 큐로 보냅니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: true },
      { seq: 4, selector: '[data-mid="disp-reason-select"], .disposal-reason-box', type: 'stamp', label: '처분 사유 및 감정', description: '연식 초과 노후화, 전손 사고, 수리비 과다 등 처분 사유를 입력합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="disp-settlement-math"], .settlement-math-box', type: 'highlight', label: '매각 금액 및 장부가 상계', description: '매각 금액에서 감가상각 잔존 장부가를 차감하여 처분손익을 산출합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-disp-approval"], button:contains("결재 상신")', type: 'callout', label: '처분 전자결재 상신', description: '자산 매각 또는 폐기 승인을 위한 내부 결재를 공식 기안합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-finalize-disposal"], button.btn-finalize', type: 'click_ripple', label: '제각 및 원장 마감', description: '자산 원장에서 영구 제각 처리하고 취득·처분 이력을 확정합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  rent_asset: {
    seqs: [
      '1. 외부 임차 장비 계약 목록 및 원사(임대처)별 스코핑',
      '2. 당사 자산 부족 시 외부 장비 신규 임차 등록 (원사, 모델, 임차 단가)',
      '3. 임차 장비의 당사 고객사 현장 재임대(전대) 계약 매핑',
      '4. 원사 지급 임차료 vs 고객사 수취 렌탈료 간 마진율 및 수지 분석 (헌장 5.5)',
      '5. 원사 반납 예정일 및 계약 연장 여부 알림 관리',
      '6. 원사 정기 임차료 지출결의 및 매입 세금계산서 대사',
      '7. 외부 임차 장비 현장 반납 및 원사 반납 확인서 종결 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="rent-asset-filter"], .rent-asset-filters', type: 'stamp', label: '임차처(원사) 필터', description: '외부 타사 임대업체별로 임차 장비 목록과 계약을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="btn-new-rent-asset"], button:contains("신규 임차")', type: 'click_ripple', label: '외부 장비 임차 등록', description: '자사 자산 부족 시 외부 장비의 모델, 일련번호, 임차 단가를 등록합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: true },
      { seq: 3, selector: '[data-mid="sublease-contract-picker"], .contract-picker', type: 'highlight', label: '전대 계약 1:1 매핑', description: '임차 장비가 투입되는 당사 고객사 렌탈 계약을 바인딩합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="margin-analysis-box"], .margin-box', type: 'callout', label: '임차 마진 및 수지 분석', description: '수취 렌탈료 - 지급 임차료 = 전대 순마진율을 실시간 검증합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="rent-expiry-alarm"], .expiry-badge', type: 'stamp', label: '원사 만료일자 알림', description: '원사 계약 만료일 전에 현장 연장 여부를 확인하여 연체료를 방지합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-rent-payment"], button:contains("임차료 지급")', type: 'click_ripple', label: '임차료 지출결의', description: '원사 매입 세금계산서와 대사 후 임차료 지급 결재를 상신합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: true },
      { seq: 7, selector: '[data-mid="btn-return-to-vendor"], button.btn-return-vendor', type: 'click_ripple', label: '원사 반납 최종 종결', description: '고객사 현장에서 원사로 직반납 또는 주기장 입고 후 반납을 확정합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  delivery: {
    seqs: [
      '1. 탭 1 배차 의뢰 발행 및 운송 기사 배정 작업대 진입',
      '2. 기간(오늘부터 7일간) 및 배차 상태(PENDING 배차 전) 스코핑',
      '3. 의뢰 컨텍스트 검토 (상하차지 주소, 현장 담당자, 장비 제원, 날씨/기상)',
      '4. 배차 속성 확인: 단일 EXCHANGE(교환) 배차 여부 확인 (헌장 2.3 왕복 단일 배차)',
      '5. 운송사 및 차량 기사 배정, 운송료 단가 및 왕복 할인 적용',
      '6. 상차 완료 및 기사 출발 상태 전환 (현장 도착 예상 시각 전달)',
      '7. 탭 2 월말 운송료 대사 그리드 이동 ➔ 인라인 검증 및 우하단 대차대조 통합 지급 요청 (헌장 3.5, 3.6)'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="dispatch-mode-tabs"], .dispatch-tabs', type: 'stamp', label: '배차 탭 선택', description: '탭 1(의뢰 발행/기사 배정)과 탭 2(월말 운송료 대사)를 전환합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="dispatch-date-filter"], .date-filter-group', type: 'stamp', label: '기본 7일간 및 PENDING 필터', description: '오늘부터 7일간 및 배차 전(PENDING) 대기 건을 기본 스코핑합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="dispatch-dossier-card"], .dossier-card', type: 'highlight', label: '배차 의뢰서 컨텍스트', description: '상하차 주소, 현장 담당자, 출고 장비 제원, 현장 기상을 정밀 검토합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="dispatch-type-badge"], .type-badge', type: 'callout', label: 'EXCHANGE 단일 배차 속성', description: '대차 교체 시 출고/입고를 분할하지 않고 EXCHANGE 1건으로 통합 관리합니다.', badgeColor: '#E53935', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="btn-assign-driver"], button:contains("기사 배정")', type: 'click_ripple', label: '운송 기사 및 단가 배정', description: '협력 운송사 및 차량 기사를 배정하고 왕복 할인 운송료를 확정합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: true },
      { seq: 6, selector: '[data-mid="btn-dispatch-depart"], button:contains("상차 완료")', type: 'stamp', label: '상차 완료 및 출발 처리', description: '장비 상차 검수 후 현장으로 기사 출발 상태를 전환합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-batch-settlement"], button:contains("통합 지급요청")', type: 'click_ripple', label: '월말 운송료 대사 및 지급', description: '월말 대사 그리드에서 인라인 확인 후 우하단 통합 지급을 요청합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  transport_master: {
    seqs: [
      '1. 협력 운송사 및 지입/직영 기사 목록 스코핑',
      '2. 신규 운송사 사업자등록증 및 화물운송사업 허가증 검증',
      '3. 운송 기사 인적사항, 차량 톤수(5톤/11톤/셀프로더), 차종 등록',
      '4. 권역별(시/도/군) 표준 운송료 단가표 및 왕복 탁송 할인율 등록',
      '5. 운송 기사 통장 사본 등록 및 운송료 지급 계좌 유효성 검증',
      '6. 배차 수행 실적 및 현장 안전 준수 평점 이력 관리',
      '7. 운송사 및 기사 마스터 최종 승인 및 배차 배정 가용화'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="carrier-filter"], .carrier-filter-bar', type: 'stamp', label: '운송사 목록 스코프', description: '등록된 협력 운송사와 소속 기사 명부를 조회합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="btn-new-carrier"], button:contains("신규 운송사")', type: 'click_ripple', label: '운송사 등록 및 허가증', description: '화물자동차 운송사업 허가증 및 사업자등록증을 검증하고 등록합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: true },
      { seq: 3, selector: '[data-mid="driver-vehicle-form"], .driver-form', type: 'highlight', label: '기사 및 차량 제원', description: '기사 성명, 연락처, 차량 적재 톤수와 셀프로더 여부를 등록합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="rate-table-editor"], .rate-table', type: 'stamp', label: '권역별 표준 단가표', description: '지역별 편도/왕복 표준 운송료와 야간/주말 할증 기준을 설정합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="bank-account-box"], .bank-fields', type: 'callout', label: '지급 계좌 유효성', description: '운송료가 정산 지급될 기사 명의 통장 사본을 확인합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="driver-rating-card"], .rating-badge', type: 'stamp', label: '배차 수행 실적 및 평점', description: '월별 배차 수행 건수와 현장 안전 수칙 준수 평가를 모니터링합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-save-carrier"], button:contains("저장")', type: 'click_ripple', label: '운송 마스터 승인 확정', description: '운송사 및 기사 정보를 확정하여 배차 작업대에서 즉시 호출 가능하도록 활성화합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  asset_inout_history: {
    seqs: [
      '1. 조회 기간 및 입출고 유형(출고, 반납, 대차교체, 주기장이동) 스코핑',
      '2. 자산 번호별 생애주기 입출고 타임라인 1:1 인과율 전수 검수 (헌장 5.6)',
      '3. 출고 검수 승인 시점의 RENTED 대여중 상태 전환 로그 확인 (헌장 1.3)',
      '4. 대차 교체(EXCHANGE) 시 전자산 회수 ➔ 후장비 승계 연결 관계 추적 (헌장 4.2)',
      '5. 운송 기사 및 배차 번호 매핑 검증',
      '6. 주기장 입고 시 반납 검수 판정(정상/파손/오염) 기록 확인',
      '7. 자산 입출고 감사 이력 무누락 보존 확정 및 엑셀 내보내기'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="inout-period-filter"], .inout-filters', type: 'stamp', label: '입출고 기간 및 유형', description: '출고, 반납, 대차, 이동 이벤트 유형별로 기간을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="inout-timeline-view"], .timeline-container', type: 'highlight', label: '생애주기 타임라인', description: '자산의 출고부터 반납까지 시계열 인과율을 1:1 전수 검수합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="rented-state-log"], .state-badge-rented', type: 'callout', label: 'RENTED 상태 전환 로그', description: '배차가 아닌 출고 검수 승인 시점에 완결된 대여 전환을 확인합니다.', badgeColor: '#7C3AED', positionHint: 'bottom', spotlight: false },
      { seq: 4, selector: '[data-mid="exchange-link-row"], .exchange-chain-row', type: 'highlight', label: 'EXCHANGE 1:1 연결 관계', description: '전자산 회수와 후장비 출고가 단일 체인으로 보존되었는지 검증합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="driver-match-cell"], .driver-cell', type: 'stamp', label: '운송 기사 및 배차 매핑', description: '실제 장비를 현장으로 이동시킨 배차 번호와 기사 정보를 확인합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="return-inspection-log"], .return-log', type: 'stamp', label: '입고 검수 판정 결과', description: '주기장 입고 시 작성된 파손 및 청소 점검 결과를 확인합니다.', badgeColor: '#4F46E5', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-export-inout"], button:contains("엑셀 내보내기")', type: 'click_ripple', label: '감사 이력 영구 확정', description: '입출고 원장 데이터를 검증하고 감사용 엑셀 보고서를 출력합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  dispatch_assign: {
    seqs: [
      '1. 미배정 배차 대기 큐 및 상차 임박 긴급도 스코핑',
      '2. 현장별 상하차 주소 및 고소작업대 적재 톤수/차종(셀프로더) 확인',
      '3. 주기장 근접 및 운행 가능한 협력 운송 기사 실시간 탐색',
      '4. 배차 유형(출고/회수/EXCHANGE 단일 교환) 확인 및 운송료 산정 (헌장 2.3)',
      '5. 운송 기사 배정 및 현장 작업지시서·기상 주의사항 모바일 전송',
      '6. 기사 상차 확인 및 배차 상태 배정 완료(ASSIGNED) 전환',
      '7. 당일 배차 배정 큐 100% 완결 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="pending-dispatch-queue"], .pending-queue', type: 'stamp', label: '미배정 배차 대기 큐', description: '출고 의뢰가 접수된 미배정 건들을 상차 시각 순으로 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="dispatch-spec-check"], .spec-box', type: 'highlight', label: '상하차지 및 적재 사양', description: '현장 진입로 제약과 장비 중량에 적합한 운송 차량 규격을 검토합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="driver-search-tool"], .driver-search-modal', type: 'stamp', label: '운송 기사 탐색', description: '현재 주기장 인근에서 배차 대기 중인 협력 기사를 조회합니다.', badgeColor: '#7C3AED', positionHint: 'bottom', spotlight: false },
      { seq: 4, selector: '[data-mid="single-exchange-check"], .exchange-indicator', type: 'callout', label: '단일 EXCHANGE 확인', description: '대차 건에 대해 왕복 1건의 교환 배차가 적용되었는지 확인합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="btn-send-dispatch-push"], button:contains("기사 배정")', type: 'click_ripple', label: '기사 배정 및 지령 전송', description: '기사를 확정 배정하고 작업지시서와 현장 연락처를 모바일로 전송합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: true },
      { seq: 6, selector: '[data-mid="btn-confirm-loading"], button:contains("상차 확인")', type: 'stamp', label: '상차 및 출발 확인', description: '주기장 출고 검수 통과 장비가 차량에 상차되었음을 확인합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="dispatch-assign-complete"], .complete-banner', type: 'click_ripple', label: '배차 배정 큐 완결', description: '당일 출고 대상 배차 배정을 100% 완결하고 배차 대장으로 인계합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  outbound_inspections: {
    seqs: [
      '1. 당일 출고 대기 자산 목록 및 상차 스케줄 스코핑',
      '2. 고소작업대 외관 점검 (도색, 볼팅, 타이어 마모, 누유 유무)',
      '3. 기능 및 안전장치 작동 테스트 (상승/하강, 주행, 비상정지, 과부하 경보)',
      '4. 배터리 완충 전압(25.4V 이상) 및 충전기 동작 상태 정밀 측정',
      '5. 현장 맞춤 안전옵션(협착방지대, 경광등, 안전벨트 걸이구) 볼팅 체결 확인',
      '6. 검수 체크리스트 전수 서명 및 출고 전 장비 전/후/좌/우 실물 사진 등록',
      '7. 최종 [출고 검수 승인] 실행 ➔ 자산 상태 즉시 RENTED 대여중 자동 전환 (헌장 1.3)'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="outbound-ready-queue"], .ready-queue', type: 'stamp', label: '출고 대기 장비 큐', description: '당일 상차 예정인 출고 대기 고소작업대 목록을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="inspection-chassis-check"], .chassis-box', type: 'highlight', label: '외관 및 샤시 점검', description: '기체 균열, 볼트 풀림, 유압 누유, 타이어 파손 여부를 전수 검사합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="inspection-safety-devices"], .safety-devices-box', type: 'callout', label: '안전 장치 작동 시험', description: '상하강 리미트 스위치, 비상정지 버튼, 과부하 경보 센서를 테스트합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="inspection-battery-volt"], .battery-input', type: 'stamp', label: '배터리 전압 정밀 측정', description: '24V 배터리 완충 전압(최소 25.4V)과 충전기 정상 작동을 기록합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="inspection-safety-options"], .options-checklist', type: 'highlight', label: '현장 안전옵션 볼팅', description: '계약에서 요구된 협착방지대와 경광등이 견고히 장착되었는지 확인합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="inspection-photo-upload"], .photo-upload-area', type: 'stamp', label: '출고 실물 사진 첨부', description: '분쟁 방지를 위해 출고 직전 장비 사방 외관 실물 사진을 업로드합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-approve-outbound"], button:contains("출고 검수 승인")', type: 'click_ripple', label: '출고 승인 (RENTED 전환)', description: '검수를 승인하고 자산 상태를 즉시 대여중(RENTED)으로 전환합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  consumable_stock: {
    seqs: [
      '1. 소모품 카테고리(배터리, 유압유, 전선, 조이스틱, 라벨지) 스코핑',
      '2. 품목별 안전 재고량 대비 현재 실재고 수량 모니터링',
      '3. 바코드/QR코드 라벨 서식 템플릿 선택 및 ZPL 코드 보정',
      '4. 인쇄 위치(X/Y 좌표 오프셋) 미세 조정 및 테스트 인쇄',
      '5. 실물 품목별 바코드 라벨 대량 출력 큐 전송',
      '6. 주기장 부품 보관 랙(Rack) 및 위치 번호(Bin) 매핑',
      '7. 소모품 실사 수량 확정 및 재고 원장 동기화'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="stock-category-tabs"], .stock-tabs', type: 'stamp', label: '부품 카테고리 탭', description: '전기 부품, 유압 소모품, 타이어, 안전용품별로 재고를 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="stock-alert-grid"], table.stock-table', type: 'highlight', label: '안전 재고 수량 모니터', description: '현재고가 안전재고 미만인 품목을 경보 색상으로 즉시 식별합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="label-template-select"], .template-picker', type: 'stamp', label: '라벨 서식 선택', description: '부품 식별용 바코드/QR 라벨 서식과 ZPL 템플릿을 선택합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 4, selector: '[data-mid="label-offset-inputs"], .offset-controls', type: 'callout', label: '인쇄 위치 보정', description: '용지 규격에 맞춰 X/Y 오프셋 좌표를 미세 보정하고 테스트 출력합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="btn-print-stock-labels"], button:contains("라벨 인쇄")', type: 'click_ripple', label: '출력 큐 대량 전송', description: '실물 부품에 부착할 바코드 라벨을 인쇄 큐 모니터로 전송합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: true },
      { seq: 6, selector: '[data-mid="rack-location-input"], .bin-input', type: 'stamp', label: '주기장 랙(Rack) 매핑', description: '부품이 보관된 주기장 창고 랙 번호와 선반 위치를 등록합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-sync-stock"], button:contains("재고 실사 확정")', type: 'click_ripple', label: '재고 원장 확정 동기화', description: '실사 수량을 반영하여 소모품 재고 원장을 최종 동기화합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  print_queue_monitor: {
    seqs: [
      '1. 프린터 상태(온라인, 오프라인, 용지 부족) 및 출력 큐 스코핑',
      '2. 대기 중인 라벨 출력 잡(Job) 우선순위 및 인쇄 수량 확인',
      '3. ZPL 인쇄 스풀 데이터 및 프리뷰 렌더링 검증',
      '4. 라벨 프린터 IP 포트 통신 상태 및 연결 확인',
      '5. 인쇄 중단/용지 잼 발생 시 출력 잡 일시정지 및 재전송',
      '6. 정상 인쇄 완료 건 상태 PRINTED 처리 및 큐 자동 아카이빙',
      '7. 출력 큐 오류 0건 달성 및 실물 라벨 장비 부착 진행'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="printer-status-bar"], .printer-bar', type: 'stamp', label: '프린터 연결 상태', description: '라벨 프린터의 IP 연결, 전원, 용지 잔여 상태를 확인합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="print-jobs-table"], table.queue-table', type: 'highlight', label: '출력 대기 큐 목록', description: '출력 대기 중인 라벨 작업들의 인쇄 매수와 우선순위를 조망합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="zpl-preview-panel"], .zpl-preview', type: 'callout', label: 'ZPL 프리뷰 검증', description: '전송될 ZPL 코드의 바코드 및 텍스트 렌더링 결과를 미리 검증합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="printer-port-check"], .port-indicator', type: 'stamp', label: '포트 통신 확인', description: '네트워크 소켓(포트 9100) 데이터 송수신 상태를 점검합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="btn-reprint-job"], button:contains("재인쇄")', type: 'click_ripple', label: '오류 잡 재전송', description: '용지 걸림이나 통신 단절 시 해당 라벨 작업을 재전송합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: true },
      { seq: 6, selector: '[data-mid="btn-clear-queue"], button:contains("큐 정리")', type: 'stamp', label: '완료 잡 아카이빙', description: '인쇄 완료된 작업을 히스토리 로그로 이관하고 큐를 정리합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="queue-done-badge"], .queue-done', type: 'click_ripple', label: '출력 완료 확정', description: '모든 라벨 인쇄를 무오류로 완결하고 자산 부착 작업을 개시합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  consumable_purchase: {
    seqs: [
      '1. 안전재고 미달 품목 및 긴급 보충 발주 큐 스코핑',
      '2. 매입처(부품 협력사) 선택 및 품목별 단가/수량 견적 비교',
      '3. 소모품 구매 발주서 작성 및 협력사 전자 발송',
      '4. 발주 품목 실물 입고 검수 (수량, 규격, 파손 여부 실사)',
      '5. 입고 완료 수량 재고 원장 자동 가산 및 매입 단가 확정',
      '6. 소모품 구입 대금 지급결의 및 전자결재 상신 (헌장 결재선 연동)',
      '7. 매입 세금계산서 수취 매칭 및 구매 발주 종결 처리'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="purchase-shortage-queue"], .shortage-list', type: 'stamp', label: '부족 품목 발주 큐', description: '안전재고 미달로 긴급 보충이 필요한 소모품 목록을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="vendor-select-dropdown"], .vendor-select', type: 'stamp', label: '매입 협력사 선택', description: '최적 단가와 납기를 제공하는 부품 협력사를 선택합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="purchase-order-form"], .order-form', type: 'highlight', label: '구매 발주서 작성', description: '발주 품목, 수량, 공급 단가를 입력하고 발주서를 전자 발송합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="receiving-check-box"], .receiving-box', type: 'callout', label: '실물 입고 검수', description: '주기장 도착 부품의 수량과 규격 일치 여부를 현물 실사합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="btn-confirm-receiving"], button:contains("입고 확정")', type: 'click_ripple', label: '재고 가산 확정', description: '검수 통과 수량을 소모품 재고 원장에 즉시 가산 반영합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: true },
      { seq: 6, selector: '[data-mid="btn-purchase-approval"], button:contains("지급결의 결재")', type: 'callout', label: '구입 대금 결재 상신', description: '소모품 구입 대금 지급을 위한 전자결재 품의를 공식 상신합니다.', badgeColor: '#4F46E5', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-close-purchase"], button.btn-close-po', type: 'click_ripple', label: '발주 종결 및 세금계산서', description: '매입 세금계산서와 대사 완료 후 구매 발주를 최종 종결합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  consumable_inout: {
    seqs: [
      '1. 정비실 및 주기장 출고/불출 의뢰 큐 스코핑',
      '2. 출고 목적(현장 AS, 입고 정비, 정기 소모품 교체) 및 정비 번호 확인',
      '3. 불출 부품 품목 및 수량 바코드 스캔 검증',
      '4. 출고 대상 자산번호(고소작업대 식별자) 1:1 매핑 (부품 원가 귀속)',
      '5. 소모품 재고 차감 및 실시간 안전재고 잔여량 경보 확인',
      '6. 수령 정비 기사 서명 및 불출증 출력',
      '7. 부품 출고 이력 무누락 DB 확정 및 자산 정비 원장 연동'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="inout-request-queue"], .inout-queue', type: 'stamp', label: '불출 의뢰 큐 스코프', description: '정비 기사가 요청한 부품 출고 의뢰 목록을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="inout-purpose-select"], .purpose-select', type: 'stamp', label: '출고 목적 및 정비건', description: '현장 AS, 입고 정비, 정기 점검 등 출고 목적을 매핑합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="barcode-scan-input"], .scan-input', type: 'click_ripple', label: '부품 바코드 스캔', description: '불출할 실물 부품의 바코드를 스캔하여 품목과 수량을 확인합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: true },
      { seq: 4, selector: '[data-mid="target-asset-input"], .target-asset-box', type: 'callout', label: '투입 자산번호 1:1 매핑', description: '부품 원가가 귀속될 고소작업대 자산번호를 정확히 연결합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="inventory-deduction-check"], .deduction-preview', type: 'highlight', label: '재고 차감 및 잔여량', description: '실재고 차감 후 남은 안전재고 수량을 실시간 확인합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="technician-sign-box"], .sign-box', type: 'stamp', label: '수령 기사 서명', description: '부품을 수령한 정비 기사의 전자 서명을 취합합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-confirm-outbound-parts"], button.btn-confirm-parts', type: 'click_ripple', label: '출고 확정 및 이력 저장', description: '부품 불출을 최종 확정하고 자산 정비 이력 DB에 무누락 기록합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  field_as: {
    seqs: [
      '1. 긴급 AS 출동 대기 큐 및 현장 위험도/지역별 스코핑',
      '2. 출동 엔지니어 배정 및 서비스 차량 탑재 부품 재고 점검',
      '3. 현장 도착 및 고소작업대 현물 고장 원인 정밀 진단',
      '4. 현장 즉시 조치: 부품 교체, 전기 배선 수리, 유압 압력 보정',
      '5. 현장 조치 불가 판정 시: 즉시 [대차 교체(EXCHANGE) 요구] 발령 (헌장 2.1)',
      '6. 유상 수리 발생 시: 고객 과실 증거 사진 등록 및 [수리비 청구] 채권 분리 (헌장 5.5)',
      '7. 현장 AS 완료 보고서 서명 날인 및 정비 이력 타임라인 영구 보존'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="field-as-queue"], .field-queue', type: 'stamp', label: '긴급 출동 대기 큐', description: '현장에서 접수된 고장 건들을 권역별·긴급도별로 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="engineer-dispatch-card"], .engineer-card', type: 'stamp', label: '출동 기사 및 차량 배정', description: '전담 정비 엔지니어와 출동 서비스 차량의 적재 부품을 확인합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="as-diagnosis-panel"], .diagnosis-panel', type: 'highlight', label: '현장 고장 원인 진단', description: '컨트롤러 에러코드 판독, 유압 압력계 측정, 모터 저항값을 진단합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="as-action-checklist"], .action-checklist', type: 'stamp', label: '현장 수리 조치 수행', description: '밸브 청소, 퓨즈 교체, 배선 결선 등 현장 즉시 수리를 수행합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="btn-request-exchange"], button:contains("대차 요청")', type: 'callout', label: 'EXCHANGE 대차 발령', description: '현장 수리 불가 판정 시 출고부서로 단일 교환 배차를 즉각 의뢰합니다.', badgeColor: '#E53935', positionHint: 'left', spotlight: true },
      { seq: 6, selector: '[data-mid="btn-claim-repair-fee"], button:contains("수리비 청구")', type: 'callout', label: '고객 과실 수리비 청구', description: '고객 과실(전복, 침수 등) 시 증빙 사진과 함께 유상 채권으로 분리합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-complete-field-as"], button.btn-complete-as', type: 'click_ripple', label: 'AS 완료 보고 확정', description: '현장 반장 서명을 받고 AS 조치 리포트를 정비 DB에 영구 보존합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  repair: {
    seqs: [
      '1. 주기장 정비 대기(수리중) 자산 목록 및 정비 우선순위 스코핑',
      '2. 입고 검수 불량 내역서 및 고장 증상 리포트 확인',
      '3. 분해 진단 및 필요 교체 부품(모터, 밸브, 배터리) 청구 등록',
      '4. 정비 조치 작업 수행 (판금, 도색, 부품 교체, 배선 결선)',
      '5. 정비 완료 후 기능/하중 테스트 및 안전 센서 100% 정상 작동 검증',
      '6. 정비 투입 공수(시간) 및 부품 원가 집계 마감',
      '7. [정비 완료 확정] 실행 ➔ 자산 상태 AVAILABLE (임대가능) 복원 (헌장 1.2)'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="repair-waiting-list"], .repair-list', type: 'stamp', label: '정비 대기 자산 스코프', description: '주기장에 입고되어 수리 대기 중인 고소작업대 목록을 조회합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="repair-symptom-dossier"], .symptom-dossier', type: 'highlight', label: '입고 불량 리포트', description: '반납 검수 시 지적된 파손 부위와 작동 불량 내역서를 검토합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="btn-request-parts"], button:contains("부품 청구")', type: 'click_ripple', label: '교체 부품 불출 청구', description: '수리에 필요한 정품 부품(조이스틱, 실린더 등)을 자재실에 청구합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: true },
      { seq: 4, selector: '[data-mid="repair-task-record"], .task-record-form', type: 'stamp', label: '정비 작업 내역 기록', description: '수리 공정, 용접, 판금, 배선 교체 등 구체적 조치 내역을 기록합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="repair-load-test"], .load-test-card', type: 'callout', label: '정격 하중 안전 테스트', description: '최대 하중 탑승 상태에서 상승/하강 및 비상 정지 센서를 시험합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="repair-cost-summary"], .cost-summary-box', type: 'highlight', label: '정비 공수 및 원가 집계', description: '투입된 기사 작업 공수(시간)와 부품 비용을 합산 집계합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-finalize-repair"], button:contains("수리 완료")', type: 'click_ripple', label: '수리 완료 (임대가능 복원)', description: '정비를 최종 완료하고 자산 상태를 즉시 임대가능(AVAILABLE)으로 복원합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  inspection_checklist_manage: {
    seqs: [
      '1. 검수 유형별 탭 스코핑 (출고 검수, 입고/반납 검수, 정기 안전 검수)',
      '2. 장비 기종별(시저, 굴절, 직진) 필수 점검 표준 항목 정의',
      '3. 법정 안전 점검 항목(과상승방지봉, 하강방지밸브, 비상정지스위치) 필수 지정',
      '4. 판정 기준(합격/불합격/요정비) 및 가중치(정비 점수) 설정',
      '5. 사진 첨부 의무화 및 측정값(배터리 전압, 타이어 잔여 홈) 입력 규칙 구성',
      '6. 모바일 현장 검수 화면 렌더링 순서 및 카테고리 배치 최적화',
      '7. 검수 체크리스트 마스터 개정 승인 및 전사 모바일 검수 폼 실시간 배포'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="checklist-type-tabs"], .checklist-tabs', type: 'stamp', label: '검수 유형별 탭', description: '출고 검수, 반납 검수, 정기 안전점검 체크리스트 탭을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="btn-add-check-item"], button:contains("항목 추가")', type: 'click_ripple', label: '점검 항목 신규 등록', description: '새로운 기계/전기/안전 점검 항목과 설명 문구를 추가합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: true },
      { seq: 3, selector: '[data-mid="mandatory-safety-toggle"], .mandatory-switch', type: 'callout', label: '법정 안전 필수 지정', description: '과상승방지봉 등 법정 안전장치는 미체크 시 출고 불가로 잠급니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="score-weight-input"], .weight-input', type: 'stamp', label: '정비 점수 가중치', description: '불합격 판정 시 자산의 정비 점수에 가산될 패널티 점수를 설정합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="photo-rule-toggle"], .photo-required-box', type: 'highlight', label: '사진 첨부 의무화', description: '배터리 전압계 계측치 및 차체 외관 사진 첨부를 의무화합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="checklist-sort-drag"], .sortable-list', type: 'stamp', label: '모바일 검수 동선 배치', description: '기사가 주기장에서 장비를 돌며 점검하기 편하도록 순서를 정렬합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-publish-checklist"], button:contains("개정 승인")', type: 'click_ripple', label: '체크리스트 개정 배포', description: '개정된 체크리스트를 확정하여 전사 모바일 검수 화면에 즉시 배포합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  leave_application: {
    seqs: [
      '1. 잔여 연차 일수 및 휴가 규정(연차, 반차, 경조사, 병가) 스코핑',
      '2. 신청 휴가 종류 선택 및 시작일/종료일 기간 지정',
      '3. 자동 일수 계산(0.5일/1일/다일) 및 공휴일 제외 확인',
      '4. 업무 대행자 지정 및 비상 연락처, 휴가 사유 작성',
      '5. 인사관리 연동 결재선 티어 자동 탐색 (헌장 결재선 100% 연동)',
      '6. [연차 신청 결재 상신] 실행 및 부서장/결재권자 알림 발송',
      '7. 최종 승인 시 개인 연차 차감 및 전사 근태 캘린더 자동 반영 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="leave-balance-card"], .leave-balance-summary', type: 'stamp', label: '잔여 연차 일수 확인', description: '본인의 총 부여 연차, 사용 연차, 잔여 연차 일수를 실시간 확인합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="leave-type-select"], select.leave-type', type: 'stamp', label: '휴가 종류 선택', description: '연차, 오전반차, 오후반차, 경조휴가, 병가 중 유형을 선택합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="leave-date-picker"], .date-range-picker', type: 'highlight', label: '휴가 기간 지정', description: '휴가 시작일과 종료일을 지정하고 주말/공휴일 제외 일수를 계산합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="deputy-picker"], .deputy-select', type: 'stamp', label: '업무 대행자 지정', description: '휴가 중 긴급 업무를 대행할 동료 임직원과 비상 연락망을 지정합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="approver-line-preview"], .approver-chain-box', type: 'callout', label: '결재권자 자동 매핑', description: '인사 직책 규정에 따라 소속 팀장 및 결재권자 티어가 자동 연결됩니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="leave-reason-textarea"], textarea.leave-reason', type: 'stamp', label: '신청 사유 작성', description: '휴가 신청 사유를 간단명료하게 입력합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-submit-leave"], button:contains("연차 신청")', type: 'click_ripple', label: '연차 신청 결재 상신', description: '신청서를 제출하여 부서장 결재 수신함으로 품의를 즉시 전달합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  ot_management: {
    seqs: [
      '1. 해당 월 연장/휴일 근로 한도(주 52시간 준수) 및 현황 스코핑',
      '2. 신청 일자 및 근로 유형(평일 연장, 휴일 근로, 야간 근로) 선택',
      '3. 근무 예정 시간(시작~종료) 입력 및 실 근로시간 자동 산출',
      '4. 업무 목적 및 사유(긴급 출고 검수, 주말 현장 AS 등) 구체적 기재',
      '5. 팀장 및 인사 담당 결재권자 승인선 자동 매핑',
      '6. 사전 신청 및 사후 실적(타임카드) 1:1 대사 검증',
      '7. 연장근로 승인 확정 및 당월 급여 수당 자동 산출 엔진 연동'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="ot-quota-card"], .ot-quota-box', type: 'stamp', label: '주 52시간 한도 모니터', description: '당월 누적 연장근로 시간과 법정 한도 잔여 시간을 확인합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="ot-type-radios"], .ot-type-options', type: 'stamp', label: '근로 유형 선택', description: '평일 연장, 휴일 주간, 휴일 야간 등 가산수당 유형을 선택합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="ot-time-inputs"], .time-range-inputs', type: 'highlight', label: '근무 시간 및 휴게시간', description: '시작 및 종료 시각을 입력하고 휴게시간을 제외한 실근무를 산출합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="ot-reason-input"], .ot-reason-box', type: 'stamp', label: '구체적 업무 사유', description: '야간 긴급 상하차, 주말 긴급 AS 등 명확한 사유를 기재합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="ot-approver-chain"], .approver-box', type: 'callout', label: '승인선 확인', description: '부서장 및 인사팀 승인선을 확인합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-match-timecard"], button:contains("실적 대사")', type: 'stamp', label: '타임카드 실적 대사', description: '출퇴근 지문/모바일 GPS 기록과 신청 시간을 1:1 교차 검증합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-submit-ot"], button:contains("연장근로 신청")', type: 'click_ripple', label: '신청 제출 및 급여 연동', description: '연장근로를 결재 상신하고 승인 시 당월 급여 수당으로 자동 연동합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  vehicle_log: {
    seqs: [
      '1. 법인 업무용 차량(서비스카, 견인차) 및 운행 월 스코핑',
      '2. 운행 일자, 운전자, 출발지 및 목적지(방문 현장) 입력',
      '3. 운행 전/후 누적 주행거리(km) 입력 및 실 주행거리 자동 계산',
      '4. 주유비, 하이패스 통행료, 주차비 등 운행 경비 영수증 증빙 첨부',
      '5. 업무용(현장AS, 장비탁송, 영업미팅) vs 비업무용 비율 자동 집계',
      '6. 국세청 법인 차량 운행기록부 법정 표준 서식 정합성 검증',
      '7. 월간 차량 운행일지 마감 확정 및 비용 인정용 엑셀 출력'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="vehicle-select-dropdown"], select.vehicle-select', type: 'stamp', label: '업무 차량 선택', description: '운행일지를 작성할 법인 등록 차량번호와 차종을 선택합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="vehicle-dest-input"], .destination-box', type: 'stamp', label: '출발지 및 목적지 현장', description: '출발 주기장과 도착 고객사 현장 명칭 및 주소를 입력합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="odometer-inputs"], .odometer-box', type: 'highlight', label: '계기판 주행거리(km)', description: '운행 전 계기판 거리와 운행 후 거리를 입력하여 실주행거리를 산출합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="vehicle-expense-upload"], .expense-upload', type: 'callout', label: '유류비/통행료 영수증', description: '주유 영수증과 고속도로 톨게이트 전표 이미지를 첨부합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="business-use-ratio"], .ratio-badge', type: 'stamp', label: '업무 사용 비율 집계', description: '현장 AS 및 탁송 목적의 법정 업무용 사용 비율(100%)을 검증합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-validate-hometax"], button:contains("국세청 서식 검증")', type: 'stamp', label: '국세청 양식 검증', description: '국세청 업무용승용차 운행기록부 법정 고시 서식 준수 여부를 검토합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-export-vehicle-log"], button:contains("운행일지 마감")', type: 'click_ripple', label: '운행일지 마감 및 출력', description: '월간 운행일지를 최종 마감하고 세무 증빙용 엑셀을 다운로드합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  purchase_settlement: {
    seqs: [
      '1. 정산 연월 및 매입 유형(운송료, 소모품, 장비임차료, 유류비) 스코핑',
      '2. 매입처(협력사)별 세금계산서 청구 내역 일괄 취합',
      '3. 실물 입고/배차 실적과 1:1 대사 검증 (단가, 수량, 차액 분석)',
      '4. 차액 발생 시 원인 규명 및 조정(공제) 금액 확정',
      '5. 통합 지출결의서 생성 및 회계 결재 상신 (헌장 결재선 연동)',
      '6. 계좌이체(펌뱅킹) 지급 파일 생성 및 지급 예정일 설정',
      '7. 지급 완료 마감 확정 및 매입 채무 원장 자동 대차 상계'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="settlement-month-filter"], .settlement-filters', type: 'stamp', label: '정산 연월 및 유형', description: '운송료, 소모품, 임차료 등 매입 채무 정산 연월을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="vendor-invoice-list"], .invoice-list-table', type: 'highlight', label: '매입 세금계산서 목록', description: '협력사들이 청구 발행한 전자세금계산서 금액을 일괄 취합합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="settlement-recon-grid"], table.recon-grid', type: 'highlight', label: '1:1 실적 대사 그리드', description: '배차/입고 전산 실적과 청구 금액을 비교하여 차액을 자동 적발합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="adjustment-amount-input"], .adj-input', type: 'callout', label: '차액 조정 및 공제', description: '왕복 할인 누락이나 파손 공제 등 차액 조정 사유를 기재합니다.', badgeColor: '#E53935', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="btn-create-expense-doc"], button:contains("지출결의서 생성")', type: 'click_ripple', label: '통합 지출결의서 기안', description: '확정된 지급액을 결재선에 올려 회계 지급 승인을 품의합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: true },
      { seq: 6, selector: '[data-mid="btn-export-banking-file"], button:contains("펌뱅킹 이체파일")', type: 'stamp', label: '은행 펌뱅킹 이체 파일', description: '기업은행/신한은행 대량 계좌이체용 텍스트 파일을 생성합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-confirm-payment"], button.btn-confirm-pay', type: 'click_ripple', label: '지급 완료 확정 마감', description: '지급 완료를 처리하고 매입 채무 원장을 대차 상계 마감합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  vendors: {
    seqs: [
      '1. 매입처 분류 스코핑 (부품 제조사, 정비 협력사, 소모품 납품사, 유류사)',
      '2. 신규 협력사 사업자등록증 및 통장 사본 등록',
      '3. 홈택스 사업자 유효성 실시간 검증',
      '4. 주요 공급 품목군 및 계약 단가표, 결제 조건(익월말 현금 등) 등록',
      '5. 협력사 담당자 연락처 및 세금계산서 수신 이메일 검증',
      '6. 월별 매입 실적 및 대금 지급 이력 원장 조회',
      '7. 협력사 마스터 승인 확정 및 발주/구매 연동 가용화'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="vendor-type-filter"], .vendor-type-bar', type: 'stamp', label: '협력사 분류 스코프', description: '부품사, 정비공장, 유류사, 운송사별로 매입처를 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="btn-new-vendor"], button:contains("협력사 등록")', type: 'click_ripple', label: '신규 협력사 등록', description: '사업자등록증과 대표자 통장 사본을 첨부하여 등록을 개시합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: true },
      { seq: 3, selector: '[data-mid="btn-verify-vendor-tax"], button:contains("사업자 검증")', type: 'callout', label: '홈택스 유효성 검증', description: '국세청 API로 계속사업자 여부와 과세 유형(일반/간이)을 확인합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 4, selector: '[data-mid="vendor-terms-form"], .terms-fields', type: 'highlight', label: '결제 조건 및 단가표', description: '결제 기일(익월말 현금 등)과 품목별 공급 단가표를 등록합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="vendor-tax-email"], input.tax-email', type: 'stamp', label: '세금계산서 전용 메일', description: '전자세금계산서를 수취할 전용 이메일과 회계 담당자를 확인합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="vendor-purchase-history"], .history-tab', type: 'stamp', label: '매입 및 지급 원장', description: '해당 협력사와의 월별 매입 누적액과 지급 대사 이력을 조회합니다.', badgeColor: '#4F46E5', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-save-vendor"], button:contains("저장")', type: 'click_ripple', label: '협력사 마스터 확정', description: '협력사를 정식 등록하여 소모품 발주 및 정산 대상에 가용화합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  bank_matching: {
    seqs: [
      '1. 통장 거래 연월 및 조회 금융 계좌(법인 주거래 통장) 스코핑',
      '2. 은행 펌뱅킹/엑셀 입금 내역 데이터 업로드 및 미매칭 큐 확인',
      '3. 입금자명, 입금액, 입금 일자 기반 미수금 원장 자동 추천 매칭',
      '4. 동명칭/상호 불일치 건 수동 거래처 탐색 및 1:1 강제 매칭',
      '5. 복수 청구서 일괄 입금 건 분할 대사 및 차액(수수료 등) 처리',
      '6. 수납 확정 실행 ➔ 외상매출금(미수금) 원장 실시간 차감 반영 (Audit Result)',
      '7. 통장 대사 합계 검증식(통장 총입금액 = 수납 확정액 | 차액 ₩0) 무결성 확정 (헌장 3.5)'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="bank-account-picker"], .bank-picker', type: 'stamp', label: '법인 계좌 스코프', description: '대사 대상 법인 은행 계좌와 조회 정산 연월을 선택합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="btn-upload-bank-csv"], button:contains("통장 엑셀 업로드")', type: 'click_ripple', label: '통장 거래내역 유입', description: '은행 인터넷뱅킹에서 다운로드한 입금 내역 엑셀을 업로드합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: true },
      { seq: 3, selector: '[data-mid="auto-match-badge"], .auto-match-col', type: 'highlight', label: '인공지능 자동 매칭', description: '입금자명과 금액이 청구서와 100% 일치하는 건을 즉시 매칭 추천합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="manual-search-btn"], button:contains("거래처 찾기")', type: 'callout', label: '상호 불일치 수동 탐색', description: '대표자 개인명 등으로 입금되어 자동 매칭되지 않은 건을 수동 연결합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="split-payment-btn"], button:contains("분할 매칭")', type: 'stamp', label: '복수 현장 분할 대사', description: '1건의 입금액으로 여러 계약의 미수금을 분할 차감합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-confirm-matching"], button:contains("수납 확정")', type: 'click_ripple', label: '외상매출금 수납 차감', description: '매칭을 확정하여 미수금 대장의 잔액을 실시간으로 차감합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: true },
      { seq: 7, selector: '[data-mid="audit-equation-bar"], .audit-equation', type: 'click_ripple', label: '대차 차액 ₩0 무결성', description: '통장 입금액 = 수납 확정액 대차 차액이 0원임을 최종 확인합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  corporate_card: {
    seqs: [
      '1. 정산 연월 및 법인카드 번호/소지 임직원별 스코핑',
      '2. 카드사 승인 내역 엑셀 업로드 또는 스크래핑 데이터 동기화',
      '3. 승인 건별 사용 목적(유류비, 식대, 소모품, 출장비) 계정과목 분류',
      '4. 간이영수증 및 카드 전표 사진 첨부 실사',
      '5. 개인 사용 또는 규정 위반(심야/주말) 건 소명 요구 및 환수 처리',
      '6. 부서별 법인카드 예산 대비 집행률 대차대조 검증',
      '7. 월말 법인카드 정산서 최종 확정 및 회계 지출결의 승인'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="card-select-filter"], .card-filters', type: 'stamp', label: '법인카드 및 임직원 스코프', description: '카드 번호와 소지자별로 당월 사용 내역을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="btn-upload-card-statement"], button:contains("카드 승인내역 업로드")', type: 'click_ripple', label: '카드 승인 내역 유입', description: '카드사 승인 내역 엑셀 파일을 업로드하여 데이터를 파싱합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: true },
      { seq: 3, selector: '[data-mid="expense-category-dropdown"], select.category-select', type: 'highlight', label: '계정과목 자동 분류', description: '가맹점 업종 기반으로 유류비, 소모품비, 복리후생비를 매핑합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="receipt-attach-cell"], .receipt-upload', type: 'callout', label: '영수증 전표 사진 실사', description: '모바일로 촬영된 간이영수증 및 결제 전표 이미지를 대조합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="policy-violation-alert"], .violation-alert', type: 'stamp', label: '규정 위반 검증', description: '주말/심야 사용 등 규정 위반 의심 건에 소명 메모를 요구합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="budget-vs-actual-card"], .budget-card', type: 'stamp', label: '부서별 예산 대비 집행률', description: '부서별 법인카드 한도 대비 실사용 금액을 대차대조합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-finalize-card-settlement"], button:contains("정산 확정")', type: 'click_ripple', label: '법인카드 정산 마감', description: '정산서를 확정하고 지출결의 결재 상신 및 회계 전표를 생성합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  cash_flow: {
    seqs: [
      '1. 기준 일자 및 금융 계좌별 실시간 잔액 스코핑',
      '2. 당일 현금 유입(렌탈료 수납, 매각 대금) 실적 집계',
      '3. 당일 현금 유출(운송료 지급, 부품 매입, 급여, 임차료) 실적 집계',
      '4. 향후 7일/30일간 자금 수지 예측 (청구 예정액 vs 지급 예정액)',
      '5. 자금 부족 예상일 사전 경보 및 단기 유동성 확보 계획 수립',
      '6. 계좌별 이체 한도 및 잔액 증명 대차대조 검증',
      '7. 일일 자금일보 마감 확정 및 대표이사/경영진 보고서 발행'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="cashflow-date-picker"], .date-picker', type: 'stamp', label: '기준 일자 및 계좌 스코프', description: '자금 현황을 조회할 기준일자와 법인 은행 계좌를 선택합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="cash-inflow-card"], .inflow-card', type: 'highlight', label: '당일 현금 유입액', description: '렌탈료 수납, 보증금 입금, 자산 매각 대금 합계를 집계합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="cash-outflow-card"], .outflow-card', type: 'highlight', label: '당일 현금 유출액', description: '운송료 지급, 소모품 매입, 급여 및 임차료 출금 합계를 집계합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="forecast-30days-chart"], .forecast-chart', type: 'callout', label: '30일 자금 수지 예측', description: '향후 입금 예정액과 지급 청구액을 시뮬레이션하여 유동성을 예측합니다.', badgeColor: '#7C3AED', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="liquidity-alert-badge"], .alert-badge', type: 'stamp', label: '자금 부족 사전 경보', description: '특정일 자금 부족 예상 시 단기 대출 또는 수납 독려 경보를 표출합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="account-balance-grid"], table.balance-table', type: 'stamp', label: '계좌별 잔액 대차대조', description: '은행 실잔액과 장부상 자금 잔액의 일치성을 검증합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-publish-daily-report"], button:contains("자금일보 발행")', type: 'click_ripple', label: '일일 자금일보 마감', description: '일일 자금일보를 최종 확정하고 경영진 보고용 PDF를 발행합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  depreciation_execution: {
    seqs: [
      '1. 상각 대상 회계 연월 및 자산 분류(고소작업대, 차량, 공구기구) 스코핑',
      '2. 자산별 취득가액, 내용연수(보통 5년), 상각방법(정액법/정률법) 검토',
      '3. 당월 상각비 및 누적 감가상각누계액, 장부가액 정밀 자동 산출',
      '4. 자산 상태별(매각, 폐기) 상각 중단 및 잔존가치(1,000원) 정합성 확인',
      '5. 자산별 감가상각 명세서 대차대조 합계 검증',
      '6. 회계 전표(감가상각비 / 감가상각누계액) 자동 분개 생성',
      '7. 월말 감가상각 실행 확정 및 재무상태표 원장 자동 반영'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="depr-period-filter"], .depr-filters', type: 'stamp', label: '상각 회계 연월', description: '감가상각을 실행할 회계 연월과 자산 분류를 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="depr-policy-info"], .policy-box', type: 'stamp', label: '내용연수 및 상각법', description: '세법 기준 5년 내용연수와 정액법 상각률(0.2)을 확인합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="depr-calculation-grid"], table.depr-table', type: 'highlight', label: '월 상각비 자동 산출', description: '자산별 취득원가 대비 당월 감가상각비와 미상각잔액을 정밀 계산합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="residual-value-check"], .residual-box', type: 'callout', label: '잔존가액(1천원) 검증', description: '상각 완료 자산의 비망가액 1,000원이 정확히 유지되는지 검증합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="depr-total-summary"], .summary-card', type: 'stamp', label: '총 상각액 대차 검증', description: '전체 고소작업대 자산의 당월 상각액 총계를 대차대조합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-preview-journal"], button:contains("분개 전표")', type: 'stamp', label: '회계 분개 전표 생성', description: '차변: 감가상각비 / 대변: 감가상각누계액 회계 전표를 생성합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-execute-depr"], button:contains("감가상각 실행")', type: 'click_ripple', label: '감가상각 마감 실행', description: '당월 감가상각을 영구 실행하고 재무상태표 원장에 반영합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  regular_reports: {
    seqs: [
      '1. 보고 기간(월간, 분기, 연간) 및 경영 성과 지표 스코핑',
      '2. 렌탈 자산 가동률 및 자산별 누적 매출 기여액 정밀 일할 통계 산출 (헌장 4.1)',
      '3. 고객사별 매출 순위 및 연체 채권 회수율 분석',
      '4. 장비 기종별/작업 높이별 렌탈 수요 트렌드 분석',
      '5. 운송비 및 정비비 원가 비율 지표 검증',
      '6. 전사 손익 요약 및 핵심 KPI(가동율 85% 이상, 연체율 3% 미만) 달성도 검토',
      '7. 정기 경영 보고서 PDF 생성 및 경영진 공식 배포 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="report-period-selector"], .period-bar', type: 'stamp', label: '보고 기간 스코프', description: '월간, 분기, 반기, 연간 경영 보고 주기를 선택합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="report-utilization-stat"], .utilization-box', type: 'highlight', label: '자산 가동율 및 기여액', description: '전사 고소작업대 가동율과 자산별 일할 매출 기여액을 분석합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="report-customer-ranking"], .ranking-table', type: 'stamp', label: '거래처별 매출 순위', description: '상위 핵심 매출 고객사와 채권 회수 현황을 대조합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="report-model-trend"], .trend-chart', type: 'stamp', label: '기종별 렌탈 수요 추이', description: '작업 높이별(6m, 8m, 10m, 12m) 현장 선호 트렌드를 분석합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="report-cost-ratio"], .cost-ratio-card', type: 'callout', label: '운송/정비 원가율', description: '매출액 대비 운송비와 부품 정비 원가 지출 비율을 검증합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="kpi-scorecard"], .kpi-scorecard', type: 'highlight', label: '핵심 KPI 달성도', description: '가동율 목표(85%) 및 채권 연체율 목표(3% 미만) 달성을 평가합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-export-exec-report"], button:contains("경영보고서 PDF")', type: 'click_ripple', label: '보고서 PDF 배포 확정', description: '정기 경영 분석 리포트를 PDF로 발행하고 임원진에 공유합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  organization: {
    seqs: [
      '1. 부서 조직도 트리 및 소속 임직원 현황 스코핑',
      '2. 신규 임직원 등록 (성명, 사번, 입사일, 로그인 ID, 부서)',
      '3. 직급(Position) 선택: 결재선 티어에 정의된 직급 내 선택 (0~7티어)',
      '4. 직책(Duty) 선택: 직책 설정(팀장, 센터장, 본부장 등) 지정 및 실시간 티어 확인',
      '5. 임직원 실효 결재 권한 티어(직책 우선 판정) 인포 박스 검증',
      '6. 비밀번호 초기화 및 모바일 현장 권한 부여',
      '7. 인사 정보 최종 저장 ➔ 전자결재 승인선 및 조직도 실시간 동기화 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="org-tree-panel"], .org-tree', type: 'stamp', label: '부서 조직도 트리', description: '영업부, 배차부, 주기장, 정비부, 관리부 조직 트리를 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="btn-new-employee"], button:contains("임직원 등록")', type: 'click_ripple', label: '신규 임직원 등록', description: '성명, 사번, 소속 부서, 로그인 계정 정보를 입력합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: true },
      { seq: 3, selector: '[data-mid="emp-position-select"], select.position-select', type: 'highlight', label: '직급(Position) 선택', description: '결재선 티어 설정에서 정의된 직급(0~7티어) 중에서만 선택합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="emp-duty-select"], select.duty-select', type: 'stamp', label: '직책(Duty) 지정', description: '팀장, 센터장, 공장장, 본부장 등 직책을 매핑합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="effective-tier-infobox"], .tier-info-box', type: 'callout', label: '실효 결재 티어 판정', description: '직책 우선 판정 원칙에 따라 산출된 실효 결재 티어를 확인합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-reset-pw"], button:contains("비밀번호 초기화")', type: 'stamp', label: '계정 및 모바일 권한', description: '현장 모바일 PWA 접속 권한과 초기 비밀번호를 설정합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-save-org-changes"], button:contains("저장")', type: 'click_ripple', label: '인사 및 결재선 동기화', description: '인사정보를 저장하여 전자결재선과 조직도에 실시간 동기화합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  permission: {
    seqs: [
      '1. 역할 그룹(ADMIN, MANAGER, STAFF, DRIVER, GUEST) 스코핑',
      '2. 51개 전사 메뉴별 접근 권한(조회, 등록, 수정, 삭제, 엑셀) 매트릭스 점검',
      '3. 부서별(영업, 배차, 주기장, 정비, 관리) R&R 헌장 부합성 검증 (헌장 2.1)',
      '4. 특수 민감 메뉴(급여, 자금, 결재선 설정) 관리자 전용 권한 제한',
      '5. 원격 Supabase Row-Level Security(RLS) 정책 일치성 검증',
      '6. 권한 변경 시뮬레이션 및 권한 테스트 유저 전환 검증',
      '7. 권한 매트릭스 최종 적용 및 전사 세션 실시간 반영'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="role-group-tabs"], .role-tabs', type: 'stamp', label: '역할 그룹 스코프', description: '최고관리자, 부서장, 실무자, 기사 그룹별 권한을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="permission-matrix-table"], table.permission-table', type: 'highlight', label: '51개 메뉴 권한 매트릭스', description: '메뉴별 읽기, 쓰기, 삭제, 엑셀 다운로드 권한을 매트릭스로 검토합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="rr-policy-check"], .rr-policy-box', type: 'callout', label: '부서간 R&R 헌장 검증', description: '영업의 자산번호 임의 지정 금지 등 전사 표준 R&R을 준수하도록 통제합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="sensitive-menu-lock"], .lock-badge', type: 'stamp', label: '민감 메뉴 보안 잠금', description: '급여, 자금일보, 결재선 관리 메뉴는 최고관리자 전용으로 제한합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="rls-policy-status"], .rls-status-box', type: 'stamp', label: 'Supabase RLS 동기화', description: 'DB 레벨 Row-Level Security 정책과 UI 권한이 일치하는지 확인합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-test-role-switch"], select.role-switch-test', type: 'stamp', label: '권한 시뮬레이션 전환', description: '헤더 사용자 전환을 통해 실제 화면 노출 여부를 시뮬레이션합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-save-permissions"], button:contains("권한 적용")', type: 'click_ripple', label: '권한 매트릭스 확정', description: '권한 설정을 전사 세션에 실시간 적용하여 보안을 완결합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  payroll: {
    seqs: [
      '1. 급여 지급 연월 및 대상 임직원 명부 스코핑',
      '2. 기본급, 직책수당, 근속수당 기본 항목 산정',
      '3. 당월 승인된 연장/휴일 근로 시간 기반 시간외 수당 자동 집계',
      '4. 4대 보험(국민연금, 건강보험, 고용보험, 산재보험) 및 소득세/지방소득세 공제 계산',
      '5. 차인지급액(실지급액) 정밀 검증 및 급여 대장 대차대조 확정',
      '6. 급여 지급 전자결재 상신 (헌장 결재선 연동)',
      '7. 급여명세서 개별 암호화 PDF 생성 및 임직원 모바일/이메일 전자 교부'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="payroll-month-selector"], .payroll-month-bar', type: 'stamp', label: '급여 연월 스코프', description: '급여를 정산할 연월과 지급 대상 임직원 명부를 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="base-salary-grid"], .base-salary-fields', type: 'stamp', label: '기본급 및 수당 산정', description: '직급별 기본급, 직책수당, 근속수당 기본 항목을 불러옵니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="overtime-allowance-cell"], .ot-calc-box', type: 'highlight', label: '시간외 수당 자동 집계', description: '당월 승인된 연장/휴일 근로 시간을 급여 수당으로 자동 환산합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="deductions-calc-grid"], .deductions-box', type: 'highlight', label: '4대보험 및 세금 공제', description: '국민연금, 건강보험, 고용보험 요율과 간이세액표를 자동 산출합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="net-salary-summary"], .net-salary-card', type: 'callout', label: '실지급액 대차대조', description: '지급총액 - 공제총액 = 실지급액 수학적 정합성을 전수 검증합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-submit-payroll-approval"], button:contains("급여 결재상신")', type: 'click_ripple', label: '급여 지급 결재 상신', description: '월간 급여 대장 품의서를 작성하여 대표이사 최종 결재를 상신합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: true },
      { seq: 7, selector: '[data-mid="btn-publish-paystub"], button:contains("명세서 교부")', type: 'click_ripple', label: '급여명세서 전자 교부', description: '개별 암호화된 급여명세서 PDF를 모바일과 이메일로 자동 교부합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  leave_management: {
    seqs: [
      '1. 기준 연도 및 전사 부서별 연차 관리 대장 스코핑',
      '2. 근로기준법 기준 입사일별 법정 연차 발생 일수 자동 계산 (1년 미만 월 1개, 1년 이상 15개~)',
      '3. 당해 연도 승인된 연차/반차 사용 일수 누적 집계',
      '4. 임직원별 잔여 연차 일수 및 연차 소진율 모니터링',
      '5. 연차 유급휴가 사용 촉진 통보서(1차, 2차) 법정 기한 내 자동 생성',
      '6. 연말 미사용 연차 수당 정산액 산출 및 급여 연동 검토',
      '7. 전사 연차 정산 마감 확정 및 인사 감사 원장 보존'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="leave-mgmt-year"], .year-select', type: 'stamp', label: '연차 관리 연도', description: '조회 및 정산할 관리 연도와 전사 부서를 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="legal-leave-calc"], .statutory-calc-box', type: 'highlight', label: '법정 연차 발생 일수', description: '입사일자 기준 근로기준법에 따른 법정 연차 발생 일수를 자동 계산합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="used-leave-summary"], .used-leave-col', type: 'stamp', label: '사용 연차 누적 집계', description: '당해 연도 전자결재로 승인된 연차 사용 실적을 집계합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="remaining-leave-grid"], table.leave-table', type: 'highlight', label: '임직원별 잔여 일수', description: '임직원별 잔여 연차와 소진율을 대시보드 그리드로 모니터링합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="btn-leave-promotion"], button:contains("사용촉진 통보")', type: 'click_ripple', label: '연차 촉진 통보서 발송', description: '법정 기한(6개월 전/2개월 전) 연차 유급휴가 사용 촉진 통보서를 발송합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: true },
      { seq: 6, selector: '[data-mid="unused-leave-payout"], .payout-calc-box', type: 'callout', label: '미사용 연차 수당 산출', description: '연말 미사용 연차에 대한 통상임금 기준 보상 수당을 산출합니다.', badgeColor: '#E53935', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-finalize-leave-year"], button.btn-finalize-leave', type: 'click_ripple', label: '연차 원장 마감 확정', description: '연간 연차 사용 및 수당 정산을 최종 마감하고 인사 원장에 보존합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  privacy_audit: {
    seqs: [
      '1. 감사 기간 및 열람 유형(고객 주민번호, 계좌번호, 임직원 정보) 스코핑',
      '2. 개인정보 취급자의 조회 일시, 접속 IP, 열람 사유 로그 전수 검색',
      '3. 개인정보 다운로드(엑셀 내보내기) 대량 발생 건 탐지 및 경보 확인',
      '4. 암호화 저장 및 전송 구간 안전성 기준(SSL/TLS, SHA256) 준수 점검',
      '5. 3년 경과 불필요 개인정보 파기 대상 목록 추출',
      '6. 개인정보 파기 실행 및 파기 확인서 자동 발급',
      '7. 개인정보 보호법 제30조 법정 안전성 감사 보고서 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="privacy-audit-filters"], .audit-filters', type: 'stamp', label: '감사 기간 및 정보 유형', description: '고객 주민번호, 통장계좌, 휴대폰번호 등 개인정보 유형을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="access-log-table"], table.access-log', type: 'highlight', label: '접속 및 열람 로그', description: '취급자 사번, 접속 IP, 열람 일시, 사유를 실시간 전수 검색합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="bulk-download-alert"], .alert-row', type: 'callout', label: '대량 다운로드 탐지', description: '개인정보가 포함된 엑셀 대량 다운로드 건을 이상 징후로 탐지합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="encryption-status-card"], .security-card', type: 'stamp', label: 'DB 암호화 저장 검증', description: '민감 데이터의 SHA-256 및 AES-256 암호화 저장 상태를 확인합니다.', badgeColor: '#7C3AED', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="retention-expire-queue"], .expire-queue', type: 'stamp', label: '보유 기간 만료 대상', description: '법정 보존 기간(계약 종료 후 3년/5년)이 경과한 파기 대상을 추출합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-destroy-privacy-data"], button:contains("파기 실행")', type: 'click_ripple', label: '개인정보 영구 파기', description: '만료된 개인정보를 DB에서 영구 삭제하고 파기 증명서를 발급합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: true },
      { seq: 7, selector: '[data-mid="btn-export-privacy-report"], button:contains("감사보고서 출력")', type: 'click_ripple', label: '법정 감사 보고서 확정', description: '개인정보보호위원회 제출 규격의 법정 감사 보고서를 출력합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  operations_manual: {
    seqs: [
      '1. 전사 51개 메뉴 및 20개 모달 매뉴얼 목록 스코핑',
      '2. 매뉴얼별 단계 뱃지 수, 버전, 최근 수정자 현황 확인',
      '3. 화면별 7단계 표준 업무 흐름 및 인지 조작 시퀀스 적합성 검토',
      '4. 마크다운 기능 정의서 편집기 호출 및 비즈니스 헌장 규격 갱신',
      '5. 모달 및 신규 기능 추가 시 인앱 단계 가이드 실시간 작성 및 위치 보정',
      '6. 전사 매뉴얼 시드 일괄 동기화(seedAllManuals) 실행',
      '7. 전사 운영 표준 매뉴얼 무결성 확정 및 배포'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="manual-menu-list"], .manual-list-card', type: 'stamp', label: '51개 메뉴 매뉴얼 목록', description: '전사 메뉴 및 모달 매뉴얼의 등록 상태와 버전을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="manual-version-badge"], .version-badge', type: 'highlight', label: '매뉴얼 버전 및 스텝 수', description: '각 매뉴얼의 7단계 워크플로우 반영 여부와 버전을 확인합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="manual-sequence-viewer"], .sequence-panel', type: 'stamp', label: '7단계 업무 흐름 검토', description: 'Gutenberg Z-패턴에 따른 인지·조작 7단계 1-Way 시퀀스를 검토합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="btn-open-spec-editor"], button:contains("기능 정의서")', type: 'click_ripple', label: '마크다운 정의서 편집', description: '메뉴별 기능 정의서(.md) 모달을 열어 비즈니스 명세를 편집합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: true },
      { seq: 5, selector: '[data-mid="btn-author-mode"], button:contains("매뉴얼 작성")', type: 'stamp', label: '인앱 단계 가이드 보정', description: '실제 화면 위에서 단계 요소 위치와 설명을 실시간 수정합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-seed-all-manuals"], button:contains("시드 전체 동기화")', type: 'click_ripple', label: '전사 매뉴얼 일괄 동기화', description: 'SSOT 최신 7단계 매뉴얼을 Supabase DB에 100% 일괄 시딩합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: true },
      { seq: 7, selector: '[data-mid="manual-publish-status"], .publish-status', type: 'click_ripple', label: '운영 매뉴얼 배포 확정', description: '전사 임직원 및 MCP 에이전트용 최신 운영 매뉴얼을 공식 배포합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  error_report: {
    seqs: [
      '1. 오류 발생 기간 및 심각도(CRITICAL, WARNING, INFO) 스코핑',
      '2. 브라우저 콘솔 에러, 네트워크 실패, DB RLS 차단 로그 상세 확인',
      '3. 발생 사용자 세션, 기기(PC/모바일), 화면 URL 추적',
      '4. 무음 실패(Silent Swallow) 방지 헌장 5.2 준수 여부 점검',
      '5. 오류 재현 절차 확인 및 임시 조치 가이드 등록',
      '6. 버그 패치 배포 후 오류 티켓 상태 해결됨(RESOLVED) 전환',
      '7. 시스템 안정성 지표(가용성 99.9%) 확정 및 재발 방지 대책 수립'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="error-severity-filter"], .severity-filters', type: 'stamp', label: '오류 심각도 스코프', description: '치명적 장애(CRITICAL), 경고, 일반 예외별로 기간을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="error-log-detail"], .error-detail-card', type: 'highlight', label: '에러 스택 및 로그 상세', description: 'JS 에러 스택 트레이스, API 실패 응답, SQL 에러 코드를 확인합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="error-device-info"], .device-box', type: 'stamp', label: '사용자 기기 및 브라우저', description: '발생 사용자의 기기(모바일/데스크탑), 해상도, OS 버전을 추적합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="zero-silent-check"], .silent-check-box', type: 'callout', label: '무음 실패 방지 검증', description: '에러 발생 시 사용자 모달 표출(헌장 5.2)이 정상 작동했는지 점검합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="reproduction-steps"], .steps-box', type: 'stamp', label: '오류 재현 경로', description: '어떤 버튼 클릭과 데이터 입력 중에 장애가 발생했는지 재현합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-resolve-error"], button:contains("해결 완료")', type: 'click_ripple', label: '오류 티켓 종결 처리', description: '버그 픽스 배포 후 해당 오류의 상태를 해결됨(RESOLVED)으로 전환합니다.', badgeColor: '#4F46E5', positionHint: 'top', spotlight: true },
      { seq: 7, selector: '[data-mid="system-uptime-card"], .uptime-card', type: 'click_ripple', label: '시스템 가용성 확정', description: '월간 시스템 무결성과 가용성 99.9% 달성을 검증하고 마감합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  agentic_ai_lab: {
    seqs: [
      '1. 에이전틱 AI 실험 파이프라인 및 테스트 모델 스코핑',
      '2. 자연어 ERP 프롬프트 입력 및 의도(Intent) 분석 테스트',
      '3. MCP(Model Context Protocol) 툴 호출 및 스키마 검증',
      '4. 가상 비즈니스 이벤트 시뮬레이션 및 안전성 가드레일 점검',
      '5. 타 부서 권한 침해 방지(영업의 자산번호 임의 지정 차단 등) 검증 (헌장 2.1)',
      '6. 보존 법칙(날짜, 수지, 상태 보존) 충족 여부 테스트 (헌장 5.5)',
      '7. 에이전트 실험 결과 감사 로그 확정 및 정식 워크플로우 승격 검토'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="ai-pipeline-selector"], .pipeline-select', type: 'stamp', label: '에이전트 파이프라인 스코프', description: '배차, 정산, 고객대응 등 실험할 에이전트 모델을 선택합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="ai-prompt-input"], textarea.prompt-input', type: 'highlight', label: '자연어 지시문 입력', description: '현장 비즈니스 시나리오를 자연어 프롬프트로 주입합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="mcp-tool-call-log"], .mcp-tool-log', type: 'callout', label: 'MCP 툴 호출 추적', description: '에이전트가 호출한 시스템 툴과 인자 스키마의 정합성을 검증합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="guardrail-status-badge"], .guardrail-badge', type: 'stamp', label: '안전성 가드레일', description: '허용되지 않은 데이터 수정이나 권한 월경 시도를 차단합니다.', badgeColor: '#E53935', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="rr-compliance-check"], .rr-box', type: 'stamp', label: '부서 R&R 준수 판정', description: '영업-출고 R&R 분리 원칙(헌장 2.1)을 준수했는지 판정합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="conservation-law-test"], .conservation-box', type: 'highlight', label: '3대 보존법칙 검증', description: '날짜 보존, 수지 보존, 상태 보존의 법칙 충족 여부를 확인합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-promote-workflow"], button:contains("정식 승격")', type: 'click_ripple', label: '실험 결과 승인 확정', description: '검증된 에이전트 로직을 정식 운영 워크플로우로 승격 확정합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  agentic_dispatch_studio: {
    seqs: [
      '1. 미배정 출고 의뢰 큐 및 주기장 보유 장비 가용성 실시간 스코핑',
      '2. 최적 운송 경로 및 차량 적재 시뮬레이션 (왕복 EXCHANGE 단일 배차 우선)',
      '3. 운송사별 과거 정시성 및 운송료 할인율 기반 최적 기사 자동 추천',
      '4. 기상 악화(강풍/폭우) 위험 지역 배차 자동 경보 및 우회 경로 안내',
      '5. 배차 의뢰서 자동 생성 및 운송 기사 모바일 푸시 발송',
      '6. 기사 수락 및 실시간 운송 상태(상차, 이동, 도착) 자동 트래킹',
      '7. 배차 완료 확정 및 운송료 대사 원장 자동 전이'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="studio-dispatch-queue"], .studio-queue', type: 'stamp', label: '출고 의뢰 자율 큐', description: '자율 배차 대상 대기 의뢰 건들을 긴급도 순으로 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="route-optimization-map"], .route-map', type: 'highlight', label: '최적 운송 경로 시뮬레이션', description: '출발 주기장과 도착 현장 간 최단·최적 운송 동선을 산출합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="driver-ai-recommend"], .recommend-card', type: 'callout', label: '최적 기사 AI 매칭', description: '평점과 왕복 운송비 할인율을 평가하여 1순위 최적 기사를 추천합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="weather-hazard-alert"], .weather-hazard', type: 'stamp', label: '기상 위험 자동 경보', description: '현장 풍속 10m/s 이상 강풍 시 고소작업 상차 안전 경보를 표출합니다.', badgeColor: '#E53935', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="btn-auto-dispatch-push"], button:contains("지령 자동발송")', type: 'click_ripple', label: '모바일 배차 지령 발송', description: '기사 모바일 PWA로 배차 의뢰서와 전자 작업지시서를 자동 전송합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: true },
      { seq: 6, selector: '[data-mid="live-tracking-panel"], .tracking-panel', type: 'stamp', label: '운송 상태 실시간 추적', description: '상차 완료, 고속도로 이동, 현장 도착 상태를 자동 트래킹합니다.', badgeColor: '#4F46E5', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-confirm-auto-dispatch"], button.btn-confirm', type: 'click_ripple', label: '배차 완료 및 대사 이관', description: '배차를 최종 종결하고 월말 운송료 대사 대장으로 자동 전이합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  agentic_settlement_autopilot: {
    seqs: [
      '1. 월말 정산 오토파일럿 대상 거래처 및 정산 연월 스코핑',
      '2. 통장 입금 내역 ➔ 미수금 원장 자동 1:1 대사 실행 (인공지능 매칭율 98% 이상)',
      '3. 자산별 정밀 일할 매출 기여액 자동 집계 및 대차 교체 승계 검증 (헌장 4.1)',
      '4. 전자세금계산서 청구서 자동 팩킹 및 국세청 전송 큐 생성',
      '5. 운송료 및 부품 매입 채무 자동 대차대조 검증 (청구 = 확정 + 반려)',
      '6. 이상 차액 발생 건 사전 격리 및 회계 담당자 확인 큐 분기',
      '7. 월말 자율 정산 마감 확정 및 대차대조 감사 리포트 자동 생성'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="autopilot-scope-card"], .autopilot-scope', type: 'stamp', label: '정산 대상 거래처 스코프', description: '당월 정산 오토파일럿 대상 거래처와 마감일을 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="ai-bank-matching-engine"], .matching-engine', type: 'highlight', label: '통장 1:1 자율 매칭', description: '수신된 입금 내역을 미수금 청구서와 1:1 자율 매칭하여 수납 처리합니다.', badgeColor: '#059669', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="pro-rata-audit-engine"], .prorata-engine', type: 'callout', label: '일할 매출 승계 검증', description: '대차 교체 자산의 일할 매출 기여액 바통 승계를 수학적으로 검증합니다.', badgeColor: '#7C3AED', positionHint: 'bottom', spotlight: false },
      { seq: 4, selector: '[data-mid="auto-invoice-pack"], .invoice-pack-box', type: 'stamp', label: '세금계산서 자동 팩킹', description: '거래명세서와 세금계산서 데이터를 자동 패키징하여 국세청 전송을 준비합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="balance-equation-engine"], .equation-engine', type: 'stamp', label: '대차대조 검증 엔진', description: '청구총액 = 확정액 + 반려액 | 대차 차액 ₩0 무결성을 입증합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="anomaly-isolation-queue"], .anomaly-queue', type: 'callout', label: '이상 차액 격리 큐', description: '1원이라도 불일치하는 이상 건은 격리하여 회계 검토 큐로 분기합니다.', badgeColor: '#E53935', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-run-autopilot-close"], button:contains("오토파일럿 마감")', type: 'click_ripple', label: '월말 자율 정산 마감', description: '무결성이 확정된 정산 원장을 최종 마감하고 감사 리포트를 발행합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  agentic_asset_lifecycle: {
    seqs: [
      '1. 전사 고소작업대 자산 생애주기(취득 ➔ 운용 ➔ 정비 ➔ 매각) 스코핑',
      '2. 장비별 가동 시간(Hour Meter) 및 정비 점수 기반 이상 징후 예지 보전 감지',
      '3. 출고 검수 승인 즉시 RENTED 전환 및 반납 시 정비 큐 자동 라우팅 (헌장 1.3)',
      '4. 렌탈료 누적 매출 기여액 대비 총 정비 비용 분석 (자산별 순수익성 산출)',
      '5. 노후/한계 자산 매각 및 폐기 권고 시점 자동 도출',
      '6. 대체 신규 장비 도입 사양 및 자산 투자 회수 기간 예측',
      '7. 자산 생애주기 건전성 리포트 확정 및 주기장 운용 최적화'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="lifecycle-overview-card"], .lifecycle-overview', type: 'stamp', label: '자산 생애주기 스코프', description: '취득부터 폐기까지 전사 자산의 라이프사이클 단계를 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="predictive-maintenance-box"], .predict-box', type: 'highlight', label: '예지 보전 이상 징후', description: '아워미터와 정비 빈도를 분석하여 모터/배터리 고장 징후를 사전 경보합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 3, selector: '[data-mid="state-transition-tracker"], .transition-tracker', type: 'stamp', label: '상태 전이 인과율 추적', description: '출고 승인 시 RENTED 전환 및 입고 시 정비 큐 라우팅을 추적합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 4, selector: '[data-mid="asset-roi-analysis"], .roi-card', type: 'callout', label: '자산별 순수익성 분석', description: '누적 렌탈 매출액 - (취득가 + 누적 정비비 + 운송비) = 순수익을 산출합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="disposal-recommend-card"], .recommend-disposal', type: 'stamp', label: '매각 권고 시점 도출', description: '수리비 증가율이 매출 기여액을 초과하는 한계 장비의 매각을 제안합니다.', badgeColor: '#D97706', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="replacement-plan-box"], .replacement-box', type: 'stamp', label: '대체 신규 장비 도입 계획', description: '신규 고소작업대 모델 도입 시 예상 투자 회수 기간(ROI)을 시뮬레이션합니다.', badgeColor: '#2563EB', positionHint: 'bottom', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-publish-lifecycle-report"], button:contains("자산 건전성 확정")', type: 'click_ripple', label: '생애주기 리포트 확정', description: '자산 운용 최적화 리포트를 확정하고 주기장 배치 전략에 반영합니다.', badgeColor: '#10B981', positionHint: 'top', spotlight: true }
    ]
  },
  initial_db_upload: {
    seqs: [
      '1. 업로드 대상 마스터 탭(고객, 장비모델, 실물자산, 부품, 계약) 스코핑',
      '2. 전사 표준 엑셀 양식 템플릿 다운로드 및 컬럼 규격 확인',
      '3. 작성된 엑셀 파일 드래그 앤 드롭 업로드 및 실시간 파싱',
      '4. 엑셀 데이터 유효성 사전 검증 (중복 사업자번호, 필수 제원 누락 적발)',
      '5. 오류 행 인라인 수정 및 정상 데이터 임시 적재 테이블 매핑',
      '6. Supabase DB 일괄 트랜잭션 주입 (await db.awaitPendingWrites()) (헌장 5.2)',
      '7. 초기 데이터 적재 결과 검증 (총 건수, 성공 건수) 및 기준정보 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="upload-target-tabs"], .upload-tabs', type: 'stamp', label: '업로드 대상 마스터', description: '고객, 모델, 자산, 부품, 계약 중 업로드할 마스터를 선택합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="btn-download-excel-template"], button:contains("양식 다운로드")', type: 'click_ripple', label: '표준 엑셀 양식 다운로드', description: '전사 스키마와 1:1 일치하는 표준 엑셀 입력 템플릿을 내려받습니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: true },
      { seq: 3, selector: '[data-mid="excel-dropzone"], .dropzone-area', type: 'highlight', label: '엑셀 파일 드래그 업로드', description: '작성된 엑셀 파일을 드래그하여 브라우저 메모리로 즉시 파싱합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="upload-validation-shield"], .validation-panel', type: 'callout', label: '데이터 사전 검증 실드', description: '필수 컬럼 누락, 중복 키, 외래키 불일치를 사전에 100% 검출합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 5, selector: '[data-mid="staging-data-grid"], table.staging-table', type: 'stamp', label: '임시 적재 그리드 검토', description: '파싱된 데이터를 인라인 검토하고 필요 시 오류 값을 직접 수정합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-execute-db-insert"], button:contains("DB 주입 실행")', type: 'click_ripple', label: 'Supabase DB 일괄 주입', description: '검증된 데이터를 DB에 트랜잭션 주입하고 대기 완료를 검증합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: true },
      { seq: 7, selector: '[data-mid="upload-result-summary"], .result-summary-box', type: 'click_ripple', label: '적재 결과 확정', description: '성공 건수와 실패 0건을 확인하고 초기 기준정보 적재를 종결합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  google_config: {
    seqs: [
      '1. 구글 워크스페이스 서비스 계정(OAuth2) 인증 상태 스코핑',
      '2. 동기화 대상 루트 폴더 ID 및 하위 폴더(계약서, 세금계산서, 검수사진) 구조 지정',
      '3. 자동 미러링 주기 및 실시간 동기화 데몬 연결 상태 확인',
      '4. 파일 업로드 테스트 (테스트 PDF 드라이브 전송 및 공유 링크 발급 검증)',
      '5. 드라이브 용량 한도 및 네트워크 타임아웃 예외 처리 설정',
      '6. 로컬 백업 사본 보존 정책 및 동기화 실패 재시도 큐 점검',
      '7. 구글 드라이브 클라우드 백업 설정 저장 및 정상 가동 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="google-auth-status"], .auth-status-card', type: 'stamp', label: '구글 OAuth 인증 상태', description: '구글 클라우드 서비스 계정 키 및 API 토큰 유효성을 확인합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="folder-id-input"], input.folder-id', type: 'stamp', label: '루트 드라이브 폴더 ID', description: 'PDF와 사진이 백업 저장될 구글 드라이브 공유 폴더 ID를 지정합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: false },
      { seq: 3, selector: '[data-mid="sync-interval-select"], .sync-interval', type: 'highlight', label: '동기화 주기 및 데몬', description: '실시간 미러링 주기와 백그라운드 동기화 데몬 가동 상태를 설정합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="btn-test-drive-upload"], button:contains("연동 테스트")', type: 'click_ripple', label: '드라이브 전송 테스트', description: '테스트 파일을 업로드하고 드라이브 웹 링크 생성을 즉시 검증합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: true },
      { seq: 5, selector: '[data-mid="timeout-config-box"], .timeout-box', type: 'callout', label: '타임아웃 및 용량 경보', description: '네트워크 지연 시 재시도 횟수와 드라이브 잔여 용량 경보를 설정합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 6, selector: '[data-mid="failed-sync-queue"], .failed-queue', type: 'stamp', label: '실패 재시도 큐 관리', description: '네트워크 일시 단절로 실패한 파일의 자동 재시도 큐를 점검합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 7, selector: '[data-mid="btn-save-google-config"], button:contains("설정 저장")', type: 'click_ripple', label: '구글 동기화 가동 확정', description: '클라우드 미러링 설정을 최종 저장하고 자동 백업을 상시 가동합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  },
  dev_uploader: {
    seqs: [
      '1. 데이터베이스 DDL 스키마 및 마이그레이션 모드 스코핑',
      '2. 로컬 스키마 정의(schema.sql)와 원격 Supabase 정합성 자가 검증 (헌장 5.3)',
      '3. 신규 컬럼 및 테이블 추가 DDL 스크립트 프리뷰',
      '4. RLS(Row Level Security) 정책 멱등성 DROP/CREATE DDL 생성',
      '5. 마이그레이션 안전성 검증 및 백업 스냅샷 확인',
      '6. DDL 실행 및 테이블 스키마 캐시 리프레시',
      '7. DB 스키마 동기화 완료 및 전사 시스템 Ready 상태 확정'
    ],
    ann: [
      { seq: 1, selector: '[data-mid="schema-mode-tabs"], .schema-tabs', type: 'stamp', label: '스키마 DDL 모드', description: '테이블 정의, 인덱스 생성, RLS 보안 정책 모드를 스코핑합니다.', badgeColor: '#1D4ED8', positionHint: 'bottom', spotlight: false },
      { seq: 2, selector: '[data-mid="btn-validate-schema-ssot"], button:contains("정합성 검증")', type: 'click_ripple', label: 'SSOT 스키마 정합성 검증', description: '로컬 schema.sql과 원격 DB 간 컬럼 누락 여부를 자동 대조합니다.', badgeColor: '#059669', positionHint: 'bottom', spotlight: true },
      { seq: 3, selector: '[data-mid="ddl-editor-textarea"], textarea.ddl-editor', type: 'highlight', label: 'DDL 스크립트 에디터', description: '실행될 CREATE/ALTER TABLE DDL SQL 구문을 확인하고 편집합니다.', badgeColor: '#7C3AED', positionHint: 'top', spotlight: false },
      { seq: 4, selector: '[data-mid="btn-generate-rls-ddl"], button:contains("RLS DDL 생성")', type: 'stamp', label: 'RLS 멱등성 DDL 생성', description: 'DROP IF EXISTS를 선행하는 멱등성 보안 정책 DDL을 동적 생성합니다.', badgeColor: '#D97706', positionHint: 'bottom', spotlight: false },
      { seq: 5, selector: '[data-mid="safety-backup-checkbox"], .safety-check', type: 'callout', label: '안전 스냅샷 확인', description: '스키마 수정 전 데이터 손실 방지를 위한 백업 스냅샷을 확인합니다.', badgeColor: '#E53935', positionHint: 'top', spotlight: false },
      { seq: 6, selector: '[data-mid="btn-execute-ddl"], button:contains("DDL 실행")', type: 'click_ripple', label: '원격 DDL 적용 실행', description: '원격 Supabase DB에 DDL을 즉각 실행하여 스키마를 업데이트합니다.', badgeColor: '#2563EB', positionHint: 'top', spotlight: true },
      { seq: 7, selector: '[data-mid="schema-ready-status"], .ready-status', type: 'click_ripple', label: '시스템 Ready 상태 확정', description: '스키마 캐시를 갱신하고 ERP 시스템 Ready 신호를 전사에 공표합니다.', badgeColor: '#10B981', positionHint: 'bottom', spotlight: true }
    ]
  }
};

module.exports = { SEVEN_STEP_DEFS };
