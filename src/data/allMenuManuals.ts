// src/data/allMenuManuals.ts
// 전사 모든 메뉴 기능의 본질적 업무 목적 및 표준 매뉴얼 데이터 (SSOT)
import type { ManualPage, ManualAnnotationItem } from '../types/manual';

export interface MenuManualDetail {
  menuId: string;
  menuName: string;
  groupId: string;
  groupName: string;
  department: string;
  archetype: '유형 A: 요청 처리형 (Card Dossier)' | '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)' | '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)';
  objective: string;          // 최종 목표 (Terminal Objective - Gutenberg 질문 1)
  scopeInfo: string;          // 시작 정보 및 전제 조건 (Scope - 질문 2)
  cognitiveSequence: string[]; // 인지 및 조작 순서 1-Way 동선 (Cognitive Sequence - 질문 3)
  auditResult: string;        // 최종 확정 및 대차대조 결과 (Audit Result - 질문 4)
  rulesCompliance: string[];  // 전사 시스템 개발 표준 헌장 준수 지침 (카테고리 I~VII)
  precautions: string[];      // 현장 물리적 마찰 방지 및 WTT 주의사항
  annotations: ManualAnnotationItem[]; // 인앱 오버레이 어노테이션
}

export const ALL_MENU_MANUALS: MenuManualDetail[] = [
  // ─── 0. 최상단 독립 메뉴 ──────────────────────────────────
  {
    menuId: 'dashboard',
    menuName: 'ERP 대시보드',
    groupId: 'grp_top',
    groupName: '메인',
    department: '전사 공통',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '로그인한 임직원의 직무에 특화된 실시간 당면 과제(ToDo 피드) 파악 및 전사 가동/출고/정비/배차 자산 상태를 한눈에 모니터링하여 즉시 대응 조치 착수',
    scopeInfo: '로그인 사용자 직무 권한(영업, 배차, 주기장, 정비, 관리)에 따른 맞춤형 ToDo 피드 및 당일 주기장 날씨/작업 환경 데이터',
    cognitiveSequence: [
      '1. 상단 당면 과제(ToDo 피드) 카드뉴스 확인 (출고 검수 대기, 미배정 배차, AS 긴급 출동, 미결재 건 등)',
      '2. 주기장 기상 위젯 및 작업 환경 지표 점검 (강풍/강우 시 고소작업대 상하차 안전 유의)',
      '3. 주요 파이프라인 KPI 카운터(임대가능, 대여중, 정비중, 연체 채권) 클릭을 통한 해당 전담 메뉴 즉시 이동',
      '4. 당일 처리율 및 부서별 잔여 태스크 완결 현황 확인'
    ],
    auditResult: '당일 긴급 미처리 업무 0건 달성 및 전사 자산 상태 라이프사이클의 유기적 흐름 개시',
    rulesCompliance: [
      '헌장 3.3 [사용자 맞춤형 직무 중심 ToDo 피드 대시보드 정책] 준수: 불필요한 공통 위젯 배제, 로그인 직무별 실시간 당면 과제 카드뉴스 우선 배치',
      '헌장 1.2 [렌탈 도메인 3대 핵심 가치] 준수: 임직원 최소 조작으로 당면 태스크 즉시 진입'
    ],
    precautions: [
      '기상 악화(초속 10m/s 이상 강풍 등) 시 출고 검수 및 상하차 작업 시 안전 관리자 입회 필수',
      'ToDo 피드 숫자가 0이 될 때까지 당일 담당 업무 지속 조망'
    ],
    annotations: [
      {
        seq: 1,
        selector: '.todo-feed-container, [data-mid="todo-feed"], .dashboard-todo',
        type: 'callout',
        label: '직무별 ToDo 피드',
        description: '로그인한 직무에 즉시 필요한 당면 과제(출고검수, 배차, 결재 등)를 최우선 노출합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '.weather-widget, [data-mid="weather-widget"]',
        type: 'stamp',
        label: '기상 및 작업 환경',
        description: '주기장 및 현장 상하차 작업 안전을 위한 실시간 풍속/강우 정보입니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '.kpi-summary-cards, [data-mid="kpi-cards"]',
        type: 'highlight',
        label: '자산 가동 현황 요약',
        description: '임대가능, 대여중, 정비중 등 전사 자산 상태를 실시간 집계합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      }
    ]
  },

  // ─── 1. 결재 센터 (grp_approval) ──────────────────────────
  {
    menuId: 'approvalInbox',
    menuName: '내 결재함 (수신)',
    groupId: 'grp_approval',
    groupName: '결재 센터',
    department: '전사 관리자/임원',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '본인에게 상신된 결재 건(계약 체결, 대차 교체, 단가 할인, 운송비 예외, 연차/OT 등)의 전후 맥락을 검토하여 원클릭 승인 또는 사유 기재 반려 처리',
    scopeInfo: '로그인 사용자의 직급 티어(Tier 1~7) 및 위임(Delegation) 권한에 따라 도달한 [대기] 상태 결재 문서 목록',
    cognitiveSequence: [
      '1. 상단 탭에서 [대기(결재할 문서)] 목록 선택 및 긴급/연체 플래그 확인',
      '2. 결재 건 선택 후 우측 또는 카드 상세에서 기안 내용, 결재선 타임라인, 합의(Consensus) 현황 검토',
      '3. 첨부 증빙 및 원천 문서(계약서, 배차지시서, 영수증 등) 1:1 대조 확인',
      '4. 우하단 [승인] 또는 [반려(사유입력)] 버튼 클릭으로 의사결정 종결'
    ],
    auditResult: '결재 승인 즉시 차순위 결재자 인계 또는 최종 확정(Approved) 전환 및 감사 로그 영구 기록',
    rulesCompliance: [
      '헌장 1.2 [이벤트 기록 무누락 DB 저장]: 승인/반려 시각, 결재자 식별자, 결재 의견 DB 완벽 저장',
      '헌장 3.1 [무수식어 건조 UI 표준]: 건조한 명사/동사([승인], [반려], [결재선]) 구조 준수',
      '헌장 3.5 [Z-패턴 동선]: 좌상단 대기목록 ➔ 중앙 본문 내용 검토 ➔ 우하단 [승인/반려] 액션'
    ],
    precautions: [
      '직무 대결(Delegation) 설정 기간 중에는 대결자의 승인도 본인 승인과 동일한 법적/회계적 효력을 가짐',
      '반려 시에는 기안자가 보완할 수 있도록 구체적인 사유를 1줄 이상 명확히 기재'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="approval-tabs"], .inbox-tabs',
        type: 'stamp',
        label: '결재 상태 탭',
        description: '대기, 진행, 완료 문서를 구분하여 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="approval-list"], .inbox-list',
        type: 'highlight',
        label: '결재 문서 목록',
        description: '기안자, 문서종류, 금액, 긴급도를 확인하고 문서를 선택합니다.',
        badgeColor: '#059669',
        positionHint: 'right',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="approval-detail"], .inbox-detail',
        type: 'callout',
        label: '기안 내용 및 합의선',
        description: '상세 기안 내용과 복수 합의자 승인 여부를 360도로 검토합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'left',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="btn-approve"], .btn-approve-action',
        type: 'click_ripple',
        label: '승인 / 반려 완결',
        description: '검토를 완료하고 최종 승인 또는 사유 기재 후 반려합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'approvalRules',
    menuName: '결재선 규칙 설정',
    groupId: 'grp_approval',
    groupName: '결재 센터',
    department: '경영지원/시스템관리',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '테넌트별 7단계 직급 티어(Tier 1~7) 매핑, 문서 카테고리별 필수 결재선/합의(Consensus) 조건, 금액별 전결 한도 규칙 정의 및 직무 대결 관리',
    scopeInfo: '테넌트 식별자, 등록된 직급/직책 체계, 문서 카테고리(계약, 배차, 할인, 비용, 인사) 목록',
    cognitiveSequence: [
      '1. 상단 티어 판정 시뮬레이터에서 사용자별 유효 직급 티어 매핑 정합성 검증',
      '2. 좌측 또는 상단 탭에서 결재 카테고리(계약/할인/운송 등) 선택',
      '3. 중앙 고밀도 그리드에서 최소 승인 티어, 복수 합의 필수 여부, 금액 임계치 인라인 정의',
      '4. 우측/하단 대결(Delegation) 패널에서 부재자 대결자 지정 및 유효기간 설정 후 [규칙 저장]'
    ],
    auditResult: '전사 결재 상신 시 해당 룰에 따라 결재선과 합의자가 오차 없이 자동 생성되는 기준 확립',
    rulesCompliance: [
      '헌장 5.3 [단일 진실의 원천(SSOT)]: 결재 티어 레벨을 전사 단일 표준(Tier 1~7)으로 관리',
      '헌장 7.1 [멀티테넌트 아키텍처]: 테넌트별 독립적인 결재 규칙 및 직급 매핑 보장'
    ],
    precautions: [
      '티어 규칙 수정 시 현재 상신 진행 중인 결재선에는 영향을 주지 않으며, 신규 상신 건부터 적용됨',
      '대표이사(Tier 7) 전결 규칙 설정 시 합의선 누락 여부를 반드시 시뮬레이터로 검증'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="tier-simulator"], .simulator-container',
        type: 'callout',
        label: '티어 판정 시뮬레이터',
        description: '직급 및 직책에 따른 유효 티어 산출 결과를 실시간 모의 판정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="rules-grid"], .rules-table',
        type: 'highlight',
        label: '결재선 규칙 테이블',
        description: '문서 카테고리별 필수 승인 티어와 합의 조건을 설정합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-save-rule"], .btn-save-rules',
        type: 'click_ripple',
        label: '규칙 저장',
        description: '설정한 결재 규칙을 DB에 즉시 동기화 반영합니다.',
        badgeColor: '#E53935',
        positionHint: 'left',
        spotlight: false,
      }
    ]
  },

  // ─── 2. 영업관리 (grp_sales) ──────────────────────────────
  {
    menuId: 'customer',
    menuName: '고객 관리',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업부',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '고객사(원청, 전문건설사, 발주처)의 기본 정보, 사업자등록증, 현장 담당자 연락망, 신용 한도 및 미수 채권 상태 통합 관리',
    scopeInfo: '사업자등록번호, 상호명, 대표자, 업태/종목, 전자세금계산서 발행 이메일, 현장 담당자 정보',
    cognitiveSequence: [
      '1. 좌상단 검색바에서 상호명 또는 사업자번호로 기존 등록 여부 중복 조회',
      '2. 우상단 [고객사 등록] 버튼 클릭하여 사업자 정보 및 담당자 연락처 입력',
      '3. 중앙 그리드에서 신용도, 결제 조건(익월말, 말일 등), 여신 한도액 확인 및 수정',
      '4. 하단 계약 이력 및 미수 잔액 탭 연계 확인 후 [저장]'
    ],
    auditResult: '고객 마스터 등록 완결 및 신규 계약 체결 시 자동 완성 데이터 원천 구축',
    rulesCompliance: [
      '헌장 3.2 [줄바꿈 방지 원칙]: 거래처명, 사업자번호, 대표자 셀에 `white-space: nowrap` 적용',
      '헌장 3.4 [상하 스택 배치]: 등록 모달 폼의 모든 레이블-입력창 상하 세로 스택 준수'
    ],
    precautions: [
      '동일 사업자등록번호의 중복 등록을 엄격히 방지하여 매출/미수금 집계 왜곡 차단',
      '세금계산서 역발행 업체의 경우 전용 전자계산서 수신 이메일을 정확히 기재'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="customer-search"], input[placeholder*="검색"]',
        type: 'stamp',
        label: '고객사 검색',
        description: '상호명, 사업자번호, 대표자명으로 신속히 검색합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-new-customer"], button:contains("등록")',
        type: 'click_ripple',
        label: '신규 고객 등록',
        description: '새로운 원청/발주처의 사업자 정보를 신규 등록합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="customer-grid"], table',
        type: 'highlight',
        label: '고객사 원장 그리드',
        description: '거래처별 신용 상태, 미수 잔액, 담당자 연락망을 확인합니다.',
        badgeColor: '#374151',
        positionHint: 'top',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'contract',
    menuName: '계약 관리',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업부',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '고소작업대 렌탈 임대차 계약 체결, 계약 기간, 대여 자산 기여액 일할 집계(헌장 4.1), 대차/교체 시 계약 속성 100% 자동 상속(헌장 2.2), 계약 변경 이력 무누락 보존',
    scopeInfo: '고객사, 현장 주소, 요구 장비 규격/수량, 임대 시작/종료일, 월 렌탈료 단가, 청구 마감일 조건',
    cognitiveSequence: [
      '1. 좌상단 필터에서 진행 상태(견적, 체결, 진행중, 완료) 및 고객사별 계약 스코핑',
      '2. 우상단 [신규 계약 체결] 버튼으로 계약 기본 정보 및 청구/현장 속성 입력',
      '3. 중앙 계약 상세 카드에서 체결 자산 목록, 누적 매출 기여액, 계약 변경 이력 타임라인 확인',
      '4. 대차 교체 발생 시 [대차/교체 요구] 발행 ➔ 출고부서로 바통 인계 (영업부 장비 직접지정 금지 - 헌장 2.1)'
    ],
    auditResult: '유효 계약 체결 확정 및 자산별 매출 기여액 정밀 일할 집계 기반 마련',
    rulesCompliance: [
      '헌장 2.1 [부서 R&R 엄격 분리]: 영업부서는 계약 관점 대차 요구 발행만 담당, 개별 자산번호 직접 선택 금지',
      '헌장 2.2 [계약 속성 100% 자동 상속]: 대차 장비는 최초 계약 단가/마감일/현장속성 자동 상속',
      '헌장 4.1 [자산별 매출 기여액 정밀 일할 집계]: 전자산 전일 마감 ➔ 후장비 당일 승계 완벽 일치',
      '헌장 4.2 [대차 교체 1:1 완벽 추적성]: contractHistory에 CHANGE_TYPE=EXCHANGE 무누락 보존'
    ],
    precautions: [
      '계약 기간 연장/단축 시 반드시 [기간 변경] 기능을 통해 일할 정산 기준일 갱신 필수',
      '현장 주소 오기입 시 배차 운송비 차액이 발생하므로 도로명 주소 정밀 확인'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="contract-filter"], .contract-filters',
        type: 'stamp',
        label: '계약 조회 스코프',
        description: '진행 상태, 거래처, 현장별로 계약 목록을 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-new-contract"]',
        type: 'click_ripple',
        label: '신규 계약 등록',
        description: '새로운 렌탈 임대차 계약서를 작성하고 체결합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="contract-detail-dossier"]',
        type: 'highlight',
        label: '계약 상세 도시에',
        description: '체결 장비, 일할 기여액, 대차 교체 이력 타임라인을 확인합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="btn-exchange-request"]',
        type: 'callout',
        label: '대차 교체 요구 발행',
        description: '현장 고장/교체 필요 시 출고부서에 동등 규격 대차를 공식 의뢰합니다.',
        badgeColor: '#E53935',
        positionHint: 'left',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'billing',
    menuName: '청구 / 수납 관리',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업/재무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '월말 렌탈 매출 정산 대장 확인, 일할 계산 기반 정밀 청구액 확정, 세금계산서 발행 및 입금 수납 처리 완결',
    scopeInfo: '정산 연월(YYYY-MM), 청구 대상 거래처, 계약별 일할 가동일수 및 단가',
    cognitiveSequence: [
      '1. 좌상단에서 정산 연월(기준월) 및 미청구/청구완료 상태 스코핑',
      '2. 우상단 [정산 집계 실행]으로 계약별 자산 가동일수 및 일할 계산 자동 산출',
      '3. 중앙 고밀도 그리드에서 계약별 청구액, 부가세, 할인/공제액 인라인 검증',
      '4. 우하단 대차대조식(청구총액 = 확정액 + 조정액) 확인 후 [일괄 청구 확정 / 세금계산서 발행]'
    ],
    auditResult: '월말 매출 채권 확정 및 세금계산서 발행 연계, 외상미수금 대장으로 잔액 바통 인계',
    rulesCompliance: [
      '헌장 3.5 [Gutenberg Z-패턴 표준]: 좌상단(정산월) ➔ 우상단(집계) ➔ 중앙(1:1검증) ➔ 우하단([일괄 확정])',
      '헌장 4.1 [정밀 일할 집계 정책]: 1원의 오차도 없는 일할 매출 기여액 합산 검증식 충족'
    ],
    precautions: [
      '중도 반납 또는 대차 교체 건의 가동 일수가 역일(달력 일수)과 정확히 일치하는지 대조',
      '세금계산서 국세청 전송 후에는 금액 임의 수정 불가하므로 확정 전 철저히 검증'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="billing-month-picker"], select[name*="month"]',
        type: 'stamp',
        label: '정산 연월 선택',
        description: '청구서를 마감 집계할 연월을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="billing-grid"], .billing-table',
        type: 'highlight',
        label: '청구 대사 그리드',
        description: '계약별 일할 단가, 가동 일수, 청구 총액을 1:1 대사합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-confirm-billing"], .btn-terminal-billing',
        type: 'click_ripple',
        label: '최종 청구 확정',
        description: '대차대조를 검증하고 세금계산서 발행 및 수납 대장으로 인계합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'receivable',
    menuName: '외상미수금 대장',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업/재무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '거래처별 누적 외상 매출금 잔액 추적, 수금 완료/미수금 잔액 대사, 연체 월령 분석 및 수금 독촉 관리',
    scopeInfo: '거래처 마스터, 월별 청구 확정액, 통장 입금 수납액',
    cognitiveSequence: [
      '1. 좌상단에서 거래처별 또는 미수 잔액 발생 업체 우선 정렬 스코핑',
      '2. 중앙 고밀도 그리드에서 전월 이월액, 당월 발생액, 당월 수금액, 현재 잔액 1:1 대사',
      '3. 장기 미수 업체 클릭 시 입금 내역 수기 매칭 및 수금 약속일 메모 등록',
      '4. 우하단 전사 미수금 총액 요약 확인 및 [잔액 대사 확정]'
    ],
    auditResult: '전사 외상매출금 잔액 일치 확정 및 연체 채권 조기 적발',
    rulesCompliance: [
      '헌장 3.2 [셀 줄바꿈 방지]: 모든 금액 컬럼 white-space: nowrap 강제',
      '헌장 3.6 [유형 B 고밀도 그리드]: 40px 행 높이로 다량의 거래처를 한눈에 비교 검증'
    ],
    precautions: [
      '입금자명과 계약처 상호가 다른 경우 통장 입출금 대장(BankMatching)과 교차 검증 필수',
      '90일 초과 악성 미수 건은 [미수 채권 연체 관리]로 즉시 이첩하여 법적 대응 착수'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="receivable-scope"]',
        type: 'stamp',
        label: '조회 조건 설정',
        description: '미수 잔액 존재 거래처만 필터링하여 집중 관리합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="receivable-grid"]',
        type: 'highlight',
        label: '외상미수금 원장 그리드',
        description: '이월잔액, 당월매출, 수금액, 기말잔액을 한눈에 대사합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-match-payment"]',
        type: 'callout',
        label: '수금 매칭 처리',
        description: '입금된 수납액을 외상매출금에 1:1 상계 반영합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'left',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'smart_dispatch4',
    menuName: '출고 요청',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업부',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '영업부서가 체결된 계약을 바탕으로 현장 납기일, 장비 제원, 현장 주소, 특이사항을 명시하여 출고/배차 부서에 공식 출고 의뢰 발행 (헌장 2.1)',
    scopeInfo: '체결 계약 정보, 요청 작업 높이/모델 규격, 현장 반입 예정 일시, 현장 담당자 연락처, 도로 진입 여건',
    cognitiveSequence: [
      '1. 상단 계약 검색에서 출고를 요청할 고객사 및 체결 계약서 선택',
      '2. 출고 희망 일시, 정확한 현장 하차지 주소, 현장 반입 조건(지하 진입 여부 등) 입력',
      '3. 장비 요구 옵션(상부 센서, 과상승 방지, 논마킹 타이어 등) 체크',
      '4. 우하단 [출고 요청서 발행] 버튼 클릭으로 배차/주기장 큐로 공식 전송'
    ],
    auditResult: '출고 의뢰 레코드 생성 및 배차 관리(TruckDispatch) 및 장비 할당(AssetAssignment) 대기열 자동 등록',
    rulesCompliance: [
      '헌장 2.1 [부서 R&R 엄격 분리]: 영업부서는 모델 규격 요구만 발행하며, 특정 자산번호 강제 지정 불가',
      '헌장 1.2 [이벤트 기록 무누락]: 출고 요청 발행 시각, 요청자, 계약 ID 영구 보존'
    ],
    precautions: [
      '당일 긴급 출고의 경우 배차실 및 주기장 담당자에게 유선 통보 병행 권장',
      '현장 진입로 협소(5톤 트럭 진입 불가 등) 시 톤수 특이사항을 전달 메모에 필수 기재'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="contract-select-box"]',
        type: 'stamp',
        label: '계약서 선택',
        description: '출고를 진행할 유효 체결 계약을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="dispatch-request-form"]',
        type: 'highlight',
        label: '현장 납기 및 조건 입력',
        description: '반입 일시, 현장 수령인 연락처, 필수 안전 옵션을 입력합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-submit-request"]',
        type: 'click_ripple',
        label: '출고 요청 발행',
        description: '출고/배차 부서로 공식 출고 의뢰를 발행합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'smart_return',
    menuName: '회수 요청',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업부',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '현장 공사 완료 또는 임대 만료에 따라 현장에 투입된 장비의 회수(반납) 의뢰를 배차 부서에 정식 발행',
    scopeInfo: '대여 중인 계약, 회수 대상 자산번호, 반출 희망 일시, 현장 상차지 주소 및 상차 가능 여건',
    cognitiveSequence: [
      '1. 대여 중 계약 목록에서 회수 대상 계약 및 현장 선택',
      '2. 회수할 자산번호 확인 및 반출 희망 일시 지정',
      '3. 현장 특이사항(지하층 장비 지상 인출 필요 여부, 크레인 양중 필요 여부 등) 기록',
      '4. 우하단 [회수 요청서 발행] 버튼 클릭으로 배차 대장으로 인계'
    ],
    auditResult: '회수 배차 의뢰 발행 및 자산 상태 추적(회수 대기 플래그) 연동',
    rulesCompliance: [
      '헌장 2.3 [단일 EXCHANGE 원칙의 역방향]: 순수 반납 건은 독립 RETURN 배차로 발행',
      '헌장 4.1 [일할 기여액 마감]: 회수 완료 시점까지의 가동일수 산출 기준 확립'
    ],
    precautions: [
      '현장에서 장비 열쇠 분실 또는 충전기 미반납이 잦으므로 현장 담당자에게 사전 점검 요청 필수',
      '회수 지연 발생 시 추가 임대료 청구 대상이 될 수 있음을 고객사에 사전 안내'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="return-contract-list"]',
        type: 'stamp',
        label: '회수 대상 계약 선택',
        description: '현재 대여 중인 현장과 회수 장비를 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="return-info-inputs"]',
        type: 'highlight',
        label: '반출 조건 입력',
        description: '반출 일시, 상차 위치, 장비 이상 유무를 기재합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-submit-return"]',
        type: 'click_ripple',
        label: '회수 요청 발행',
        description: '배차 부서로 회수 운송 의뢰를 전송합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'smart_as_request',
    menuName: 'AS 요청',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업부 / 고객센터',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '현장 가동 중 고장, 이상 경보, 파손 발생 시 긴급 AS 출동 및 정비 조치 의뢰 발행 (필요 시 즉시 대차 교체 연계)',
    scopeInfo: '고객사, 현장 주소, 고장 자산번호, 고장 증상(상승불가, 주행불능, 에러코드), 현장 사진 증빙',
    cognitiveSequence: [
      '1. 고장 발생 계약 및 대상 자산번호 조회/선택',
      '2. 현장 전달 고장 증상 유형(전원/유압/주행/경보/파손) 및 에러코드 입력',
      '3. 고객이 전송한 고장 사진/동영상 증빙 업로드',
      '4. 현장 수리 가능 여부 판단 후 긴급도(긴급/당일/익일) 지정 후 [AS 요청 접수]'
    ],
    auditResult: 'AS 티켓 발행 및 현장 AS 관리(FieldAsManagement) 대기열로 즉시 라우팅',
    rulesCompliance: [
      '헌장 2.1 [대차 교체 연계]: 현장 수리 불가 판정 시 동일 메뉴에서 원클릭 대차 교체 요구 전환 연동',
      '헌장 1.2 [이벤트 무누락 저장]: 고장 증상, 에러코드, 접수 일시 DB 영구 기록'
    ],
    precautions: [
      '배터리 방전 또는 비상정지 스위치 눌림 등 단순 조치 사항은 유선 통화로 1차 해결 지도',
      '사용자 과실(추락 충격, 전도 파손) 의심 시 유상 수리 증빙 확보'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="as-asset-picker"]',
        type: 'stamp',
        label: '고장 자산 선택',
        description: '고장이 발생한 현장의 대여 자산을 지정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="as-symptom-form"]',
        type: 'highlight',
        label: '고장 증상 및 증빙',
        description: '에러코드와 현장 고장 증상, 사진을 첨부합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-submit-as"]',
        type: 'click_ripple',
        label: 'AS 요청 접수',
        description: 'AS 정비팀으로 긴급 출동 지시를 전송합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'delinquency',
    menuName: '미수 채권 연체 관리',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업/재무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '30일/60일/90일 이상 장기 연체 채권 집중 모니터링, 신용 거래 제한(출고 정지), 최고장 발송 및 법적 조치 단계 관리',
    scopeInfo: '연체 일수 기준, 거래처별 누적 연체금, 담보 여부, 현장 가동 장비 목록',
    cognitiveSequence: [
      '1. 상단 연체 구간 탭(30일 이상, 60일 이상, 90일 이상 악성) 선택',
      '2. 중앙 고밀도 그리드에서 거래처별 연체금액, 최종 수금일, 신용등급 확인',
      '3. 대상 거래처 선택 후 [출고 보류(Blacklist)] 지정 또는 [최고장/내용증명 양식 출력]',
      '4. 장비 미회수 위험 현장의 경우 즉시 [장비 강제 회수 배차] 연계 조치'
    ],
    auditResult: '부실 채권 조기 회수 조치 완결 및 추가 부실 출고 원천 차단',
    rulesCompliance: [
      '헌장 3.1 [건조한 UI 표기]: 과장된 경고 문구 배제, 사실에 기반한 연체 일수와 금액만 직관 표기',
      '헌장 3.5 [Z-패턴 동선]: 좌상단 연체구간 ➔ 중앙 대상 감사 ➔ 우하단 조치 확정'
    ],
    precautions: [
      '출고 보류 지정 시 영업 담당자에게 즉시 사유가 통보되며 신규 계약 체결이 자동 제한됨',
      '법적 조치 착수 전 현장 가동 중인 자산의 실물 위치 및 봉인 가능 여부 필수 실사'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="delinquency-tier-tabs"]',
        type: 'stamp',
        label: '연체 구간 선택',
        description: '30일, 60일, 90일 초과 연체 구간별로 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="delinquency-grid"]',
        type: 'highlight',
        label: '연체 채권 그리드',
        description: '연체 금액, 경과 일수, 가동 장비 현황을 검토합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-action-hold"]',
        type: 'click_ripple',
        label: '출고 보류 / 법적 조치',
        description: '신규 출고를 잠금 처리하고 채권 추심 절차로 이첩합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'left',
        spotlight: false,
      }
    ]
  },

  // ─── 3. 제품 / 자산관리 (grp_product_asset) ────────────────
  {
    menuId: 'product',
    menuName: '제품 관리',
    groupId: 'grp_product_asset',
    groupName: '제품 / 자산관리',
    department: '자산/품질관리팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '고소작업대 표준 모델 카탈로그(제조사, 모델명, 작업높이, 적재중량, 전폭, 차체중량, 배터리사양) 및 표준 렌탈 요율 마스터 관리',
    scopeInfo: '제조사(스카이잭, 지니, 딩리, 시노붐 등), 모델 규격, 플랫폼 확장 제원, 전력 사양',
    cognitiveSequence: [
      '1. 좌상단 제조사/높이 규격별 필터로 기존 등록 모델 스코핑',
      '2. 우상단 [제품 모델 등록] 버튼 클릭하여 신규 카탈로그 제원 입력',
      '3. 중앙 고밀도 그리드에서 작업 높이, 허용 하중, 권장 운송 차종 매핑 정보 확인',
      '4. 우하단 [저장]으로 자산 대장 및 계약 견적서의 표준 모델 원천 데이터 확립'
    ],
    auditResult: '전사 고소작업대 모델 마스터 표준화 및 출고/배차 시 제원 정합성 확보',
    rulesCompliance: [
      '헌장 5.3 [SSOT 단일 진실의 원천]: 모델 제원 정보를 전사 단일 마스터 테이블에서 관리',
      '헌장 3.1 [무수식어 건조 UI]: "최고급", "최신형" 등 수식어 배제, 객관적 제원(m, kg) 표기'
    ],
    precautions: [
      '작업 높이(Platform Height vs Working Height) 표기 혼동 방지 (작업높이 = 발판높이 + 2m)',
      '차체 중량 오기입 시 셀프 배차 톤수 초과로 인한 과적 단속 위험 발생'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="product-search"]',
        type: 'stamp',
        label: '모델 검색',
        description: '제조사 및 작업 높이로 제품 카탈로그를 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="product-grid"]',
        type: 'highlight',
        label: '제품 사양 테이블',
        description: '발판 높이, 적재 중량, 전폭, 권장 차종을 1:1 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-new-product"]',
        type: 'click_ripple',
        label: '신규 모델 등록',
        description: '새로운 고소작업대 기종과 표준 제원을 등록합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'asset',
    menuName: '자산 관리 (대장)',
    groupId: 'grp_product_asset',
    groupName: '제품 / 자산관리',
    department: '자산/주기장팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '당사 보유 및 관리 중인 모든 개별 자산의 라이프사이클(AVAILABLE/RENTED/REPAIRING 등) 상태, 장비 일련번호, 바코드, 누적 매출 기여액 추적 관리 (헌장 1.2 핵심가치 1)',
    scopeInfo: '자산번호(Barcode), 제품 모델, 시리얼 넘버, 소유 구분(당사 자산/외부 임차), 현재 상태, 현재 위치(주기장/고객현장)',
    cognitiveSequence: [
      '1. 좌상단 상태 필터(임대가능, 대여중, 정비중, 출고대기) 및 모델별 자산 스코핑',
      '2. 중앙 고밀도 그리드에서 자산번호, 현 위치, 현재 계약처, 누적 매출 기여액(헌장 4.1) 조망',
      '3. 장비 상세 클릭 시 개별 장비의 출고/반납/수리 전 생애 이력 타임라인 360도 확인',
      '4. 라벨 훼손 장비의 경우 [바코드/QR 라벨 재출력] 연동'
    ],
    auditResult: '자산 실물 라이프사이클과 DB 상태의 100% 일치 및 자산별 누적 기여액 정합성 보장',
    rulesCompliance: [
      '헌장 1.2 [렌탈 자산의 효과적인 운용]: 자산 상태가 실제 물리적 현장과 완벽히 일치해야 함',
      '헌장 1.3 [상태 RENTED 전환 원칙]: 대여중 상태는 출고 검수 승인 마감 시에만 전환됨',
      '헌장 4.1 [자산별 매출 기여액 정밀 일할 집계]: 개별 자산의 누적 매출액을 1원도 틀림없이 표시'
    ],
    precautions: [
      '자산 상태를 수동으로 강제 변경하지 말고 반드시 검수/정비 프로세스를 거쳐 자동 변경 유도',
      '도난/분실 의심 장비는 즉시 [상태: 분실조사중]으로 전환하고 최종 계약처 확인'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="asset-status-filter"]',
        type: 'stamp',
        label: '자산 상태 필터',
        description: '임대가능, 대여중, 수리중 등 상태별로 필터링합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="asset-master-grid"]',
        type: 'highlight',
        label: '자산 마스터 원장',
        description: '자산번호, 현재 위치, 계약처, 누적 매출 기여액을 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-print-label"]',
        type: 'click_ripple',
        label: '라벨 인쇄 연동',
        description: '선택한 자산의 방수 QR/바코드 라벨 출력을 요청합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'left',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'acquisition_disposal',
    menuName: '당사자산 취득 / 매각',
    groupId: 'grp_product_asset',
    groupName: '제품 / 자산관리',
    department: '자산/재무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '신규 고소작업대 도입 시 취득원가/취득일 등록 및 노후 장비 매각/폐기 프로세스를 회계적/물리적으로 확정 처리',
    scopeInfo: '취득일, 취득가액, 구입처, 모델명, 제조년월, 매각일, 매각처, 매각가액, 처분손익',
    cognitiveSequence: [
      '1. 상단 취득/매각 구분 탭 선택 및 기간별 내역 조회',
      '2. 우상단 [신규 자산 취득]으로 매입 계약서 기반 취득원가 및 일련번호 입력 ➔ 자산 대장 자동 생성',
      '3. 매각/폐기 시 대상 장비 선택 후 감가상각 잔존가액 확인 및 매각가액 입력',
      '4. 처분 손익 자동 계산 확인 후 [매각/폐기 확정] ➔ 자산 대장에서 DISPOSED 상태 자동 전환'
    ],
    auditResult: '고정자산 관리대장 동기화 및 유형자산 처분손익 회계 전표 원천 확정',
    rulesCompliance: [
      '헌장 5.1 [리포트/통계 2단계 검증]: 장부가액 - 매각가액 = 처분손익 수학적 수식 정합성 충족',
      '헌장 1.2 [이벤트 기록 무누락]: 취득/매각 전 과정의 증빙 문서 및 승인 이력 영구 보존'
    ],
    precautions: [
      '현재 대여중(RENTED) 상태인 장비는 반납 완료 전까지 매각 처리 불가',
      '세금계산서 발행 금액과 매각 확정 금액이 1원도 틀리지 않도록 사전 대사'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="acq-disp-tabs"]',
        type: 'stamp',
        label: '취득 / 매각 구분',
        description: '자산 취득 원장과 매각/폐기 원장을 전환 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="acq-disp-grid"]',
        type: 'highlight',
        label: '취득/처분 내역 그리드',
        description: '취득가, 잔존가액, 매각가, 처분손익을 1:1 대사합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-new-acquisition"]',
        type: 'click_ripple',
        label: '취득 / 매각 등록',
        description: '새로운 자산을 취득 등록하거나 매각/폐기 처리합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'rent_asset',
    menuName: '임차 장비 관리',
    groupId: 'grp_product_asset',
    groupName: '제품 / 자산관리',
    department: '자산/구매팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '당사 보유 자산 부족 시 외부 타사(원사)로부터 임차(전대)해온 장비의 계약 조건, 원가 정산, 가동 현황 관리 (헌장 2.1)',
    scopeInfo: '임차 공급처(원사), 외부 장비번호, 임차 시작/종료일, 월 임차료 원가, 당사 현장 재임대 매핑 정보',
    cognitiveSequence: [
      '1. 좌상단 임차 거래처 및 가동 상태별 스코핑',
      '2. 우상단 [외부 임차 계약 등록]으로 원사 계약 조건 및 월 임차료 입력',
      '3. 중앙 그리드에서 당사 고객 계약과의 1:1 전대 매핑 현황 및 마진율 확인',
      '4. 월말 매입 정산(PurchaseSettlement) 시 원사 지급액과 1:1 대사 확정'
    ],
    auditResult: '외부 임차 장비의 원가/매출 분리 집계 및 반납 기한 준수를 통한 연체료 방지',
    rulesCompliance: [
      '헌장 2.1 [출고/자산 부서 책임]: 자산 부족 시 타사 임차 장비 매핑 권한 및 정산 책임 이행',
      '헌장 4.1 [일할 집계]: 전대 장비도 당사 고객 계약에 대해 정밀 일할 매출 기여액 정상 산출'
    ],
    precautions: [
      '당사 고객 반납 즉시 원사로 반납하지 않으면 공회전 임차료 손실이 발생하므로 반납 일정 철저 관리',
      '원사 장비 파손 시 고객 과실 여부를 확인하여 구상권 청구 증빙 확보'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="rent-asset-filter"]',
        type: 'stamp',
        label: '임차처 필터',
        description: '외부 원사별로 임차 중인 장비 목록을 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="rent-asset-grid"]',
        type: 'highlight',
        label: '임차 장비 대장',
        description: '원가 단가, 당사 현장 매핑, 반납 예정일을 모니터링합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-new-rent-asset"]',
        type: 'click_ripple',
        label: '신규 임차 등록',
        description: '외부 장비를 임차 등록하고 전대 매핑을 준비합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      }
    ]
  },

  // ─── 4. 배차 / 운송관리 (grp_logistics) ────────────────────
  {
    menuId: 'delivery',
    menuName: '배차 / 운송 관리',
    groupId: 'grp_logistics',
    groupName: '배차 / 운송관리',
    department: '배차/물류팀',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '출고/회수/EXCHANGE 단일 배차 의뢰(헌장 2.3)에 대한 차량/기사 배정, 6대 신규 셀프 차종 매핑, 단가/일정 수정, 취소건 복원 및 월말 운송료 1:1 대사 완결 (헌장 3.6 탭별 이원화)',
    scopeInfo: '배차 의뢰 목록(출고/회수/교환), 운송 거래처 마스터, 기사 연락처, 배차 차종(1.2T~8.5T 셀프 등), 운송료 단가, 상하차 일시',
    cognitiveSequence: [
      '1. [탭 1: 배차 지시]: 미배정 배차 카드 검토 (자연어 요청 원문, 제원, 현장 주소, 특이사항 360도 판단)',
      '2. 기사 배정 및 수정: 운송거래처, 기사명, 차종(1.2T/3.5T/4T/5T/5T장축/8.5T 셀프), 운송료 단가 지정 후 [배차 확정]',
      '3. 취소된 건도 언제든 정보 수정 후 [배차 완료로 재배정] 복원 조치',
      '4. [탭 2: 월말 운송료 대사]: 고밀도 그리드에서 운송사 청구서와 1:1 대사 ➔ 차액 승인 ➔ 우하단 [통합 지급요청] 완결'
    ],
    auditResult: '차량 배차 100% 완료 및 월말 운송료 청구총액 = 확정액 + 반려액 (차액 ₩0) 무결성 확정',
    rulesCompliance: [
      '헌장 2.3 [단일 EXCHANGE 1건 발행 원칙]: 대차 교체 시 출고/입고 분할 없이 단일 왕복 배차로 통합 관리',
      '헌장 1.3 [배차 단계 상태 조작 금지]: 배차 단계에서 자산 상태를 대여중으로 바꾸지 않음 (출고검수 시 완결)',
      '헌장 3.6 [업무 본질 아키타입 이원화]: 탭 1(카드 도시에) vs 탭 2(고밀도 그리드) 독립 적용'
    ],
    precautions: [
      '고소작업대 2대 이상 적재 시 5T장축 또는 8.5T 셀프 차량 필수 배정',
      '배차 취소 후 재배정 시 기존 기사에게 취소 통보 및 신규 기사 배차 안내 문자 발송 필수'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="dispatch-mode-tabs"]',
        type: 'stamp',
        label: '업무 아키타입 탭',
        description: '탭 1(배차 지시 카드)과 탭 2(월말 대사 그리드)를 목적에 맞게 전환합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="dispatch-card-list"]',
        type: 'highlight',
        label: '배차 의뢰 카드 도시에',
        description: '상하차 주소, 요청 차종, 기사 메모를 360도 검토합니다.',
        badgeColor: '#059669',
        positionHint: 'right',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-assign-driver"]',
        type: 'click_ripple',
        label: '기사 배정 및 수정',
        description: '운송사, 기사, 차종, 단가를 지정하거나 취소건을 수정 복원합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 4,
        selector: '[data-mid="reconcile-grid-summary"]',
        type: 'callout',
        label: '대차대조 검증 합계',
        description: '탭 2에서 청구총액 = 확정액 + 반려액 (차액 ₩0)을 검증하고 마감합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'transport_master',
    menuName: '운송 거래처 관리',
    groupId: 'grp_logistics',
    groupName: '배차 / 운송관리',
    department: '배차/물류팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '외주 운송사 및 지입/직속 화물 기사 마스터, 보유 차종(1.2T~8.5T 셀프), 계좌 정보, 구간별 표준 운송 요율표 관리',
    scopeInfo: '운송사 상호, 사업자번호, 기사 성명, 연락처, 차량 번호, 차종/톤수, 지급 계좌',
    cognitiveSequence: [
      '1. 좌상단 검색에서 운송사명 또는 기사 성명으로 기등록 여부 조회',
      '2. 우상단 [운송 기사/거래처 등록]으로 신규 화물차주 정보 및 보유 셀프 차종 입력',
      '3. 중앙 그리드에서 계좌 실명 및 운송료 지급 조건 확인',
      '4. 권역별(시내/시외/장거리) 표준 운송료 테이블 연계 설정 후 [저장]'
    ],
    auditResult: '배차 시 기사 자동완성 및 월말 운송료 이체 계좌 데이터 100% 무결성 확보',
    rulesCompliance: [
      '헌장 3.2 [줄바꿈 방지]: 기사명, 차량번호, 차종 셀 줄바꿈 방지 적용',
      '헌장 1.2 [이벤트 기록]: 기사 정보 및 계좌 변경 이력 감사 로그 보존'
    ],
    precautions: [
      '셀프 로더(Self-loader) 차량이 아닌 일반 카고 차량은 고소작업대 자가 상하차 불가하므로 차종 등록 시 엄격 확인',
      '운송비 입금 계좌의 예금주명과 사업자/주민번호 일치 여부 필수 검증'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="transport-search"]',
        type: 'stamp',
        label: '운송 거래처 검색',
        description: '운송사명, 기사명, 차종으로 신속 검색합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="transport-grid"]',
        type: 'highlight',
        label: '운송 기사 마스터 원장',
        description: '보유 차종, 차량 번호, 연락처, 지급 계좌를 관리합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-new-transport"]',
        type: 'click_ripple',
        label: '신규 기사 등록',
        description: '새로운 셀프 로더 차주 및 운송 협력사를 등록합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      }
    ]
  },

  // ─── 5. 입출고관리 (grp_inout) ────────────────────────────
  {
    menuId: 'asset_inout_history',
    menuName: '자산 입출고',
    groupId: 'grp_inout',
    groupName: '입출고관리',
    department: '주기장팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '주기장 게이트를 통과하는 모든 장비의 물리적 입출고 시간, 운송차량, 상하차 기사, 작업자 기록을 무누락 시계열 DB 보존 (헌장 1.2 핵심가치 2)',
    scopeInfo: '게이트 통과 일시, 입출고 구분(IN/OUT), 자산번호, 운송 차량번호, 담당 기사, 연계 계약/배차 번호',
    cognitiveSequence: [
      '1. 상단 일자별/게이트별 조회 범위 지정',
      '2. 중앙 고밀도 시계열 테이블에서 게이트 통과 내역 실시간 모니터링',
      '3. 바코드 스캐너 또는 모바일 앱 연동 입출고 태깅 내역 1:1 대조',
      '4. 누락 또는 수동 입출고 건 발생 시 [수동 게이트 통과 기록]'
    ],
    auditResult: '주기장 내 물리적 장비 재고와 시스템 DB 재고의 100% 일치 보장',
    rulesCompliance: [
      '헌장 1.2 [발생 사건 무누락 DB 저장]: 게이트 통과 이벤트 타임스탬프 영구 보존',
      '헌장 5.6 [시계열 타임라인 무결성]: 입출고 순서와 배차/검수 타임스탬프 인과율 준수'
    ],
    precautions: [
      '출고 검수가 승인되지 않은 장비가 게이트를 통과하지 않도록 차단기 인터락 주의',
      '야간 긴급 반납 건은 다음 날 아침 1교시 게이트 로그 필수 대조 확인'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="inout-date-filter"]',
        type: 'stamp',
        label: '통과 일자 선택',
        description: '게이트 입출고 이력을 조회할 기간을 지정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="inout-history-grid"]',
        type: 'highlight',
        label: '게이트 통과 시계열 대장',
        description: '출고/입고 시간, 자산번호, 운송차량을 무누락 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'dispatch_assign',
    menuName: '장비 할당 / 매핑',
    groupId: 'grp_inout',
    groupName: '입출고관리',
    department: '출고/자산관리팀',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '영업부서의 출고 요청에 대해 주기장의 적격 가용 자산(AVAILABLE) 또는 외부 타사 임차 장비를 실제 실물 자산번호와 매핑하여 검수 대기열로 인계 (헌장 2.1)',
    scopeInfo: '미할당 출고 요청 목록, 요구 모델/사양, 주기장 내 임대가능(AVAILABLE) 자산 목록',
    cognitiveSequence: [
      '1. 좌측 출고 요청 큐에서 대기 중인 주문 선택 (요구 높이, 규격, 납기 확인)',
      '2. 우측 가용 자산 목록에서 배터리 완충 및 정비 완료된 최적 자산번호 탐색',
      '3. 자산 부족 시 [외부 임차 장비 매핑] 탭으로 전환하여 전대 장비 선택',
      '4. 중앙 [장비 할당 확정] 클릭 ➔ 출고 검수 관리(OutboundInspections) 큐로 자동 전송'
    ],
    auditResult: '출고 요청과 실물 자산번호 1:1 매핑 완료 및 자산 상태 ASSIGNED(출고대기) 전환',
    rulesCompliance: [
      '헌장 2.1 [출고/자산 부서 고유 권한]: 자산번호 지정은 오직 출고/자산 부서의 권한과 책임 하에 집행',
      '헌장 1.2 [효과적인 자산 운용]: 선입선출 및 배터리 수명 주기를 고려한 균등 장비 회전 배정'
    ],
    precautions: [
      '정비 중(REPAIRING)이거나 배터리 저전압 상태인 장비를 강제 할당 금지',
      '현장 특수 요구(상부 센서 등)가 장착된 장비인지 실물 제원표 교차 확인'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="unassigned-request-list"]',
        type: 'stamp',
        label: '미할당 출고 요청',
        description: '영업부에서 요청한 장비 규격과 납기를 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="available-asset-list"]',
        type: 'highlight',
        label: '주기장 가용 자산',
        description: '출고 가능한 최적의 실물 장비를 선택합니다.',
        badgeColor: '#059669',
        positionHint: 'left',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-confirm-assign"]',
        type: 'click_ripple',
        label: '장비 할당 확정',
        description: '실물 장비를 확정 매핑하고 출고 검수 대기열로 인계합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'outbound_inspections',
    menuName: '출고 검수 관리',
    groupId: 'grp_inout',
    groupName: '입출고관리',
    department: '출고검수팀',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '현장 출고 직전 20대 법정 안전 옵션(과상승 방지, 리미트 센서, 비상하강) 및 배터리/유압 작동 전수 검수, 승인 마감 시 자산 상태 RENTED(대여중) 자동 전환 (헌장 1.3)',
    scopeInfo: '할당 완료된 출고 대기 장비, 출고 체크리스트 템플릿, 현장 요구 옵션 내역, 검수 사진',
    cognitiveSequence: [
      '1. 출고 검수 대기 목록에서 검수 대상 장비 선택 및 제원 확인',
      '2. 현장 실물 장비 앞에서 20개 안전 항목(작동, 누유, 리미트, 외관 등) 점검 및 체크',
      '3. 장비 4면 외관 및 계기판/배터리 비중 사진 실시간 촬영 업로드',
      '4. 불량 발견 시 [검수 불량 반려(정비인계)] / 전 항목 합격 시 [출고 검수 최종 승인]'
    ],
    auditResult: '출고 검수 성적서 발행 및 자산 상태 즉시 RENTED(대여중) 전환 완료 (헌장 1.3)',
    rulesCompliance: [
      '헌장 1.3 [출고 검수 승인 마감 시 자산 상태 RENTED 전환 원칙]: 배차 단계가 아닌 이 시점에 대여중 전환 완결',
      '헌장 1.2 [이벤트 기록 무누락]: 검수자, 승인 시각, 20대 체크리스트 결과, 사진 증빙 DB 영구 저장'
    ],
    precautions: [
      '비상 하강 밸브 수동 작동 불량 시 현장 인명 사고 위험이 있으므로 절대 출고 승인 금지',
      '충전기 내장형 모델의 경우 충전 플러그 접지 단자 파손 여부 필수 확인'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="inspection-queue"]',
        type: 'stamp',
        label: '출고 검수 대기열',
        description: '출고 직전 실물 장비 검수 대상을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="checklist-container"]',
        type: 'highlight',
        label: '안전 점검 체크리스트',
        description: '상승, 주행, 비상하강, 센서 등 필수 항목을 점검합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-approve-outbound"]',
        type: 'click_ripple',
        label: '출고 검수 최종 승인',
        description: '검수를 마감하고 자산 상태를 즉시 RENTED(대여중)로 전환합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'consumable_stock',
    menuName: '주기장 소모품 재고',
    groupId: 'grp_inout',
    groupName: '입출고관리',
    department: '주기장/자재팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '주기장 정비 및 출고 시 소모되는 부품(배터리, 충전기, 작동유, 조이스틱, 타이어 등)의 실시간 수불 관리 및 적정 안전 재고 유지',
    scopeInfo: '부품 코드, 품명, 규격, 적정 재고량, 현재고량, 입고/출고 수불 내역, 보관 위치(창고/선반)',
    cognitiveSequence: [
      '1. 좌상단 부품 카테고리(전기/유압/외장/배터리) 및 안전재고 부족 품목 스코핑',
      '2. 중앙 고밀도 그리드에서 기초 재고, 당월 입고, 당월 출고, 현재고 1:1 대사',
      '3. 실사 차이 발생 시 [재고 실사 보정]을 통해 차액 원인(파손/손모) 등록',
      '4. 안전 재고 미달 품목 선택 후 [소모품 구매 발주 요청] 연계'
    ],
    auditResult: '정비 부품 결품 제로 달성 및 주기장 자재 자산 가액 정확한 결산 반영',
    rulesCompliance: [
      '헌장 3.1 [건조한 UI 표기]: "스마트 재고", "자동 감시" 등 수식어 배제, 규격과 수량 중심 표기',
      '헌장 5.1 [수학적 수식 정립]: 기말재고 = 기초재고 + 입고 - 출고 보존 법칙 충족'
    ],
    precautions: [
      '배터리는 보관 중 자연 방전되므로 30일 이상 미사용 재고는 주기적 보충전 필수',
      '유압 작동유는 이물질 혼입 방지를 위해 개봉 후 밀봉 보관 확인'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="stock-category-filter"]',
        type: 'stamp',
        label: '부품 분류 선택',
        description: '배터리, 전장품, 유압 부품별로 필터링합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="stock-grid"]',
        type: 'highlight',
        label: '소모품 재고 원장',
        description: '현재고, 안전재고, 수불 내역을 한눈에 대조합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-reorder-parts"]',
        type: 'click_ripple',
        label: '구매 발주 연계',
        description: '부족 품목을 [소모품 구매] 대기열로 즉시 발주합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'print_queue_monitor',
    menuName: '프린트 큐 모니터',
    groupId: 'grp_inout',
    groupName: '입출고관리',
    department: '주기장/출고팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '자산 방수 바코드 및 부품 QR 라벨 ZPL/PDF 인쇄 큐 상태 실시간 감시, 인쇄 위치 오프셋 보정, 실패 큐 재전송 (헌장 3.1)',
    scopeInfo: '프린터 네트워크 IP, 포트(9100), 라벨 규격(100x75 등), 대기/성공/오류 큐 목록, ZPL 원문 코드',
    cognitiveSequence: [
      '1. 상단 프린터 연결 상태(ONLINE/OFFLINE) 및 라벨 용지 규격 확인',
      '2. 중앙 고밀도 모니터에서 인쇄 대기/실패 작업 큐 실시간 상태 조망',
      '3. 인쇄 위치 밀림 발생 시 [인쇄 위치 보정(X/Y Offset)] 미세 조정',
      '4. 전송 에러 발생 건 선택 후 [재전송] 또는 [큐 초기화] 종결'
    ],
    auditResult: '출고 자산 실물 방수 라벨 부착 100% 보장 및 인쇄 오류 무중단 복구',
    rulesCompliance: [
      '헌장 3.1 [무수식어 건조 UI 단일 표준]: "라벨 출력 관리", "프린트 큐 모니터", "인쇄 위치 보정" 등 표준 용어 준수',
      '헌장 5.2 [무음 실패 방지]: 프린터 통신 장애 시 즉시 에러 모달 표출'
    ],
    precautions: [
      'Zebra 감열/열전사 프린터의 헤드 오염 시 바코드 인식률이 급감하므로 에탄올 세척 권장',
      '인쇄 위치 보정 후 반드시 [테스트 인쇄] 1회를 거쳐 영점 확인'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="printer-status-bar"]',
        type: 'stamp',
        label: '프린터 연결 상태',
        description: '라벨 프린터의 네트워크 연결 및 용지 상태를 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="print-queue-grid"]',
        type: 'highlight',
        label: '인쇄 큐 목록',
        description: '대기, 인쇄중, 실패 건을 실시간 모니터링합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-retry-print"]',
        type: 'click_ripple',
        label: '재전송 / 오프셋 보정',
        description: '인쇄 실패 건을 재전송하거나 인쇄 위치를 보정합니다.',
        badgeColor: '#E53935',
        positionHint: 'left',
        spotlight: false,
      }
    ]
  },

  // ─── 6. 정비 / 소모품관리 (grp_maintenance) ───────────────
  {
    menuId: 'consumable_purchase',
    menuName: '소모품 구매',
    groupId: 'grp_maintenance',
    groupName: '정비 / 소모품관리',
    department: '정비/자재팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '정비 및 주기장 유지보수에 필요한 부품/소모품 발주서 작성, 매입 단가 승인 및 입고 대사',
    scopeInfo: '공급 업체(Vendor), 부품 품목, 발주 수량, 단가, 납기 예정일, 승인 결재선',
    cognitiveSequence: [
      '1. 좌상단 발주 상태(작성중, 발주완료, 입고검수, 마감) 스코핑',
      '2. 우상단 [신규 발주서 작성]으로 공급처 선택 및 부품별 수량/단가 입력',
      '3. 발주 금액에 따른 결재선 자동 상신 및 승인 완료 확인',
      '4. 물품 도착 시 [입고 검수 확정] ➔ 재고 수량 자동 가산 및 월말 매입 정산 연동'
    ],
    auditResult: '부품 발주부터 입고까지의 정산 원천 데이터 확정 및 매입 채무 연계',
    rulesCompliance: [
      '헌장 3.4 [상하 스택 배치]: 발주 입력 필드 상하 세로 스택 준수',
      '헌장 1.2 [이벤트 무누락]: 발주, 승인, 입고 전 단계 DB 로그 보존'
    ],
    precautions: [
      '정품(OEM) 부품과 호환 부품의 단가 차이가 크므로 발주서에 정품 여부 명기 필수',
      '입고 수량과 세금계산서 수량이 불일치할 경우 입고 보류 처리'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="purchase-order-search"]',
        type: 'stamp',
        label: '발주서 조회',
        description: '공급처 및 발주 상태별로 문서를 검색합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="purchase-order-grid"]',
        type: 'highlight',
        label: '발주 및 입고 원장',
        description: '발주 품목, 단가, 총액, 입고 여부를 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-new-po"]',
        type: 'click_ripple',
        label: '신규 발주서 작성',
        description: '부품 구매 발주서를 작성하고 결재를 상신합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'consumable_inout',
    menuName: '소모품 입출고',
    groupId: 'grp_maintenance',
    groupName: '정비 / 소모품관리',
    department: '주기장/자재팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '구매 입고된 부품의 창고 적재 및 정비 작업으로 인한 부품 출고 불출 내역 기록',
    scopeInfo: '입출고 일시, 구분(입고/출고/폐기), 부품 코드, 수량, 관련 정비 작업 번호, 불출 작업자',
    cognitiveSequence: [
      '1. 기간별 소모품 입출고 수불 내역 조회',
      '2. 정비 작업에 부품 투입 시 [부품 불출 등록]으로 해당 정비 카드에 원가 매핑',
      '3. 중앙 그리드에서 불출자, 정비 대상 장비번호, 사용 수량 1:1 대사',
      '4. 불량 부품 반품 시 [반품 출고] 처리'
    ],
    auditResult: '부품 재고 실시간 차감 및 정비 작업별 원가 투입 데이터 100% 무결성 확립',
    rulesCompliance: [
      '헌장 4.1 [원가 및 기여도 투입]: 정비 부품 투입 내역을 자산 정비 이력에 1:1 보존',
      '헌장 3.2 [줄바꿈 방지]: 부품명, 규격, 수량 셀 줄바꿈 방지'
    ],
    precautions: [
      '정비 작업 번호 없이 부품을 임의 불출하지 않도록 주기장 창고 키 관리 철저',
      '교체 후 회수된 고품(코어)은 재제조 또는 고철 매각용으로 별도 보관'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="consumable-inout-filter"]',
        type: 'stamp',
        label: '수불 기간 선택',
        description: '부품 입출고 내역을 조회할 기간을 지정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="consumable-inout-grid"]',
        type: 'highlight',
        label: '입출고 수불 대장',
        description: '입고, 불출, 정비 연계 장비번호를 대조합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-register-inout"]',
        type: 'click_ripple',
        label: '부품 불출 등록',
        description: '정비 작업에 투입된 부품을 출고 등록합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'field_as',
    menuName: '현장 AS 관리',
    groupId: 'grp_maintenance',
    groupName: '정비 / 소모품관리',
    department: 'AS정비팀',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '현장에 출동한 순회 정비 기사의 이동 경로, 고장 부위 조치 내역, 유/무상 정비 판정, 투입 부품 기록 및 고객 서명 수령',
    scopeInfo: '접수된 AS 티켓, 현장 위치, 기사 배정, 도착 일시, 수리 완료 일시, 유상 수리 청구 금액, 고객 서명',
    cognitiveSequence: [
      '1. 상단 미배정/출동중/완료 탭에서 담당 현장 선택',
      '2. 현장 도착 후 고장 원인(전기/유압/외장 등) 진단 및 교체 부품 기록',
      '3. 사용자 과실(충돌, 케이블 단선 등) 여부 확인 후 유상/무상 판정',
      '4. 수리 완료 사진 첨부 및 현장 소장 디지털 서명 수령 후 [AS 종결 확정]'
    ],
    auditResult: '현장 AS 조치 완료 및 유상 수리 시 매출 청구(Billing) 데이터로 즉시 이첩',
    rulesCompliance: [
      '헌장 5.5 [현장 마찰 계수 주입]: 현장 수리 불가 시 즉시 EXCHANGE 대차 배차 연동',
      '헌장 1.2 [이벤트 기록 무누락]: 수리 전/후 사진, 교체 부품, 서명 이미지 영구 보존'
    ],
    precautions: [
      '고압 전선 접촉 또는 낙하 충격 장비는 현장 수리 금지하고 즉시 입고 정비 인계',
      '유상 수리 건은 현장 담당자에게 유상 안내 및 서명 사전 득 필수'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="field-as-ticket-list"]',
        type: 'stamp',
        label: 'AS 출동 티켓',
        description: '현장별 고장 접수 내역과 출동 상태를 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="as-action-report"]',
        type: 'highlight',
        label: '정비 조치 리포트',
        description: '조치 내용, 투입 부품, 유/무상 판정을 기록합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-complete-as"]',
        type: 'click_ripple',
        label: '고객 서명 및 완료',
        description: '현장 담당자 서명을 받고 AS 조치를 종결합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'repair',
    menuName: '주기장 정비 관리',
    groupId: 'grp_maintenance',
    groupName: '정비 / 소모품관리',
    department: '정비팀',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '회수 입고된 고소작업대의 세척, 도색, 분해 수리, 안전 점검 및 정비 조치 (정비 완료 시 자산 상태 AVAILABLE(임대가능) 복원)',
    scopeInfo: '입고된 정비 대상 장비, 회수 점검표, 투입 부품 내역, 정비 공수(시간), 정비 완료 승인자',
    cognitiveSequence: [
      '1. 좌측 정비 대기열(입고점검, 정비대기, 부품대기, 최종검사)에서 장비 카드 선택',
      '2. 정비 작업 진행: 고장 진단, 부품 투입, 세척 및 작동 테스트 진행',
      '3. 투입된 정비 시간 및 소모 부품 등록 ➔ 자산 원가 반영',
      '4. 전 기능 정상 작동 확인 후 우하단 [정비 완료 승인] ➔ 자산 상태 AVAILABLE 자동 전환'
    ],
    auditResult: '장비 정비 완결 및 자산 상태 AVAILABLE(임대가능) 복원, 가용 자산 풀 재편입',
    rulesCompliance: [
      '헌장 1.2 [렌탈 자산 효과적 운용]: 정비 완료 시점에 정확히 AVAILABLE 상태로 복귀',
      '헌장 3.6 [유형 A 카드 도시에]: 개별 장비의 정비 상세 컨텍스트를 한 화면에서 360도 판단'
    ],
    precautions: [
      '시저암 롤러 마모 및 용접 부위 크랙 여부를 비파괴 육안 검사로 철저 확인',
      '충전 테스트는 최소 4시간 이상 연속 부하 충전하여 만충 전압(25.4V 이상) 확인'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="repair-card-board"]',
        type: 'stamp',
        label: '정비 공정 보드',
        description: '대기, 수리중, 검사중 등 공정별 장비 카드를 조망합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="repair-detail-panel"]',
        type: 'highlight',
        label: '정비 작업 일지',
        description: '수리 내용, 교체 부품, 투입 공수를 기록합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-approve-repair"]',
        type: 'click_ripple',
        label: '정비 완료 승인',
        description: '정비를 종결하고 자산을 즉시 임대가능(AVAILABLE)으로 복원합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'inspection_checklist_manage',
    menuName: '정비 항목 관리',
    groupId: 'grp_maintenance',
    groupName: '정비 / 소모품관리',
    department: '정비/품질관리팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '장비 기종별/작업유형별(출고검수, 정기점검, 입고정비) 법정 안전점검 체크리스트 표준 템플릿 관리',
    scopeInfo: '점검 유형, 기종 분류, 점검 항목명, 판정 기준, 필수 점검 여부, 과태료/안전 기준 연계',
    cognitiveSequence: [
      '1. 상단 점검 템플릿 유형(출고검수, 정기안전점검, 입고점검) 선택',
      '2. 중앙 고밀도 그리드에서 점검 항목 순서, 기준 설명, 필수 여부 편집',
      '3. 우상단 [새 점검 항목 추가]로 신규 안전 기준 법 개정 사항 반영',
      '4. 우하단 [템플릿 저장]으로 전사 모바일 검수 폼에 즉시 동기화'
    ],
    auditResult: '고소작업대 안전보건공단 안전인증 기준에 부합하는 점검 체계 확립',
    rulesCompliance: [
      '헌장 5.3 [SSOT 원칙]: 체크리스트 기준을 전사 단일 마스터로 관리하여 현장별 편차 방지',
      '헌장 3.1 [무수식어 표기]: 사실적이고 객관적인 측정 기준(압력, 치수, 전압 등) 명기'
    ],
    precautions: [
      '법정 필수 항목(과상승 방지봉, 비상정지 스위치)은 [필수 점검] 해제 금지',
      '항목 순서 변경 시 현장 검수 동선(하부 ➔ 상부 ➔ 조작부)과 일치하도록 정렬'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="checklist-type-selector"]',
        type: 'stamp',
        label: '검수 템플릿 선택',
        description: '출고, 입고, 정기점검 템플릿을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="checklist-items-grid"]',
        type: 'highlight',
        label: '점검 항목 마스터',
        description: '점검 기준, 필수 여부, 판정 방법을 관리합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-save-checklist"]',
        type: 'click_ripple',
        label: '템플릿 저장',
        description: '변경된 점검 기준을 전사 시스템에 일괄 반영합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      }
    ]
  },

  // ─── 7. 경영관리 (grp_management) ─────────────────────────
  {
    menuId: 'leave_application',
    menuName: '연차신청',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '전사 임직원',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '임직원의 법정 연차, 반차, 병가, 경조 휴가 신청서 작성 및 상위 결재선 자동 상신',
    scopeInfo: '신청자 정보, 잔여 연차 일수, 휴가 유형, 시작일/종료일, 사용 일수, 직무 대결자, 사유',
    cognitiveSequence: [
      '1. 상단 본인 잔여 연차 및 당해 연도 사용 일수 현황 확인',
      '2. 휴가 종류(연차, 오전반차, 오후반차, 경조휴가 등) 선택',
      '3. 휴가 기간 지정 및 부재 중 업무 대결자 선택',
      '4. 우하단 [연차 신청서 상신] ➔ 결재 센터(ApprovalInbox)로 상위 결재선 자동 발송'
    ],
    auditResult: '휴가 신청 결재 상신 완료 및 승인 시 연차 차감 및 캘린더 공유',
    rulesCompliance: [
      '헌장 3.4 [상하 스택 배치]: 휴가 신청 폼 모든 레이블-입력 필드 상하 스택 적용',
      '헌장 1.2 [이벤트 기록 무누락]: 연차 신청, 결재, 차감 이력 DB 영구 저장'
    ],
    precautions: [
      '주기장 및 배차 필수 당직 인원은 동시 휴가 사용이 제한될 수 있으므로 팀 내 사전 조율 필수',
      '당일 긴급 연차는 직속 부서장에게 유선 보고 후 사후 상신'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="leave-balance-card"]',
        type: 'stamp',
        label: '잔여 연차 현황',
        description: '발생 일수, 사용 일수, 잔여 연차를 실시간 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="leave-apply-form"]',
        type: 'highlight',
        label: '휴가 신청서 작성',
        description: '휴가 종류, 기간, 업무 대결자를 지정합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-submit-leave"]',
        type: 'click_ripple',
        label: '결재 상신',
        description: '결재 센터로 연차 신청서를 공식 상신합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'ot_management',
    menuName: 'OT 관리',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '인사/총무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '야간/주말 특근 및 연장 근무(OT) 사전 신청 및 사후 승인, 급여 정산 연동 수당 산출',
    scopeInfo: '근무자, OT 일자, 시작/종료 시간, 연장 시간, 야간/휴일 구분, 근무 사유, 승인 여부',
    cognitiveSequence: [
      '1. 조회 연월 및 부서별 OT 신청 목록 스코핑',
      '2. 중앙 고밀도 그리드에서 계획 시간과 실제 출퇴근 태깅 시간 대조',
      '3. 연장 근로 사유(긴급 출고 검수, 야간 배차 대응 등) 정당성 검토',
      '4. 우하단 [OT 일괄 승인] ➔ 당월 급여 정산(PayrollPage) 수당 테이블로 자동 반영'
    ],
    auditResult: '근로기준법 52시간 준수 모니터링 및 정확한 법정 가산 수당 확정',
    rulesCompliance: [
      '헌장 5.1 [수학적 수식 검증]: 통상시급 × OT시간 × 1.5 가산율 수학적 산식 준수',
      '헌장 3.5 [Z-패턴 동선]: 좌상단(월/부서) ➔ 중앙(시간대사) ➔ 우하단([승인마감])'
    ],
    precautions: [
      '주간 총 근로시간이 52시간을 초과하지 않도록 사전 경고 알림 확인 필수',
      '야간 근로(22시~06시)는 통상시급의 50%가 추가 중복 가산되므로 승인 시 시간대 철저 검수'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="ot-month-filter"]',
        type: 'stamp',
        label: '정산 연월 선택',
        description: 'OT 내역을 검토할 연월과 부서를 지정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="ot-review-grid"]',
        type: 'highlight',
        label: 'OT 근무 내역 그리드',
        description: '신청 시간, 출퇴근 기록, 사유를 1:1 대사합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-approve-ot"]',
        type: 'click_ripple',
        label: 'OT 승인 마감',
        description: 'OT 수당을 확정하고 급여 대장으로 인계합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'vehicle_log',
    menuName: '차량 / 주유관리',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '총무/운행자',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '회사 업무용 차량(순회 AS차, 현장 영업차 등)의 운행 일지(주행거리, 목적지) 및 주유/하이패스 영수증 관리',
    scopeInfo: '차량 번호, 운행 일자, 운행자, 출발/도착지, 주행거리(시작/종료), 주유량/금액, 정기검사일',
    cognitiveSequence: [
      '1. 차량별/운행자별 기간 운행 내역 스코핑',
      '2. 우상단 [운행 일지 등록]으로 당일 출발/도착 누적 계기판 거리 및 방문 현장 입력',
      '3. 주유 영수증 첨부 및 유류비/통행료 비용 등록',
      '4. 중앙 그리드에서 연비 및 사적 사용 여부 감사 후 [일지 확정]'
    ],
    auditResult: '국세청 업무용 승용차 운행기록부 법정 양식 자동 생성 및 비용 인정 충족',
    rulesCompliance: [
      '헌장 1.2 [발생 사건 무누락 DB 보존]: 일일 주행거리 계기판 사진 및 영수증 증빙 저장',
      '헌장 3.1 [무수식어 건조 표준]: 명확한 계기판 숫자와 지명 중심 표기'
    ],
    precautions: [
      '계기판 시작 거리가 전일 종료 거리와 불일치할 경우 누락 구간 사유 소명 필수',
      '엔진오일 교환 주기(10,000km) 및 자동차 정기검사 만료일 사전 점검'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="vehicle-filter"]',
        type: 'stamp',
        label: '차량 선택',
        description: '업무용 차량별 운행 기록을 필터링합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="vehicle-log-grid"]',
        type: 'highlight',
        label: '운행 일지 테이블',
        description: '주행거리, 유류비, 통행료, 방문지를 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-new-log"]',
        type: 'click_ripple',
        label: '운행 일지 등록',
        description: '새로운 운행 내역과 주유 영수증을 등록합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'purchase_settlement',
    menuName: '월말 매입 정산',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '재무/회계팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '전사 외주 운송비, 부품 구매비, 외부 임차료 등 월말 매입 채무 1:1 대사, 세금계산서 수취 검증 및 최종 지급 결재 (헌장 3.5 Z-패턴 4단계 완결)',
    scopeInfo: '정산 연월, 매입처(운송사/부품사/임차원사), 청구서 수령액, 시스템 집계액, 차액 승인 내역',
    cognitiveSequence: [
      '1. 좌상단 (Start): 정산 연월 및 미지급 매입처 스코핑',
      '2. 우상단 (Pipeline): 매입처 엑셀 세금계산서 업로드 및 시스템 집계 실행',
      '3. 중앙 본문 (Inspection): 행 높이 38px 고밀도 그리드에서 1:1 대사, 차액 원인 분석 및 인라인 승인',
      '4. 우하단 (Terminal Action): 대차대조 검증 합계(청구총액 = 확정액 + 반려액) 확인 후 [통합 지급요청 / 최종 결재]'
    ],
    auditResult: '전사 매입 채무 확정 및 이체 펌뱅킹 데이터 생성 완료 (차액 ₩0 무결성 보장)',
    rulesCompliance: [
      '헌장 3.5 [Gutenberg Z-패턴 표준]: 좌상단 ➔ 우상단 ➔ 중앙 본문 ➔ 우하단 완결 동선 엄격 이행',
      '헌장 3.6 [유형 B 고밀도 그리드]: 80~85% 세로 영역 확보로 수백 건 인라인 일괄 마감'
    ],
    precautions: [
      '매입처 발행 세금계산서 금액과 시스템 확정액의 1원 단위 차액도 반드시 차액 사유(단가 할인/지연 배상 등) 기재 후 승인',
      '지급 보류 매입처는 사유를 명시하여 이체 대상에서 제외 조치'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="settle-scope"]',
        type: 'stamp',
        label: '정산 스코프 설정',
        description: '정산 연월과 지급 미완료 대상을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="settle-grid"]',
        type: 'highlight',
        label: '1:1 매입 대사 그리드',
        description: '청구액과 입고/운송 실적을 1:1 대조하고 차액을 승인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-terminal-settle"]',
        type: 'click_ripple',
        label: '통합 지급요청 완결',
        description: '대차대조를 검증하고 최종 결재 및 이체 승인으로 종결합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'vendors',
    menuName: '매입처 (공급자 / 외주처) 관리',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '구매/회계팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '부품 공급사, 외주 정비업체, 장비 임대 원사 등 협력업체 마스터, 결제 계좌, 세금계산서 수신처 관리',
    scopeInfo: '사업자등록번호, 상호명, 대표자, 업태/종목, 주거래 품목, 결제 은행/계좌번호, 담당자 연락처',
    cognitiveSequence: [
      '1. 상단 검색창에서 공급처명 또는 사업자번호 중복 조회',
      '2. 우상단 [매입처 등록]으로 신규 협력사 기본 정보 및 통장 사본 계좌 입력',
      '3. 중앙 그리드에서 결제 조건(마감 후 익월 10일/말일 등) 및 계좌 실명 확인',
      '4. 우하단 [저장]으로 매입 정산 및 발주 원천 거래처 데이터 확정'
    ],
    auditResult: '매입처 마스터 확정 및 정산 이체 시 예금주 불일치 사고 원천 차단',
    rulesCompliance: [
      '헌장 3.2 [셀 줄바꿈 방지]: 사업자번호, 상호, 계좌번호 셀 white-space: nowrap 강제',
      '헌장 7.1 [테넌트 독립성]: 테넌트별 협력업체 데이터 독립 분리'
    ],
    precautions: [
      '계좌번호 변경 요청 시 반드시 통장 사본 실물 증빙을 수령하여 확인 후 갱신',
      '휴폐업 사업자 여부를 홈택스 API 또는 국세청 조회를 통해 분기별 실사'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="vendor-search"]',
        type: 'stamp',
        label: '매입처 검색',
        description: '상호명 또는 사업자번호로 협력사를 검색합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="vendor-grid"]',
        type: 'highlight',
        label: '협력업체 원장',
        description: '거래 품목, 결제 조건, 이체 계좌 정보를 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-new-vendor"]',
        type: 'click_ripple',
        label: '신규 매입처 등록',
        description: '새로운 부품/외주 협력사를 등록합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'bank_matching',
    menuName: '은행 입출금 대장',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '재무/회계팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '실시간 은행 계좌 스크래핑/엑셀 거래 내역과 매출 청구(수납) 및 매입 지급 건 1:1 대사 매칭 (헌장 3.6 유형 B)',
    scopeInfo: '통장 거래 일시, 입금액/출금액, 적요(입금자명), 잔액, 시스템 매칭 대상 매출/매입 채권',
    cognitiveSequence: [
      '1. 좌상단 조회 계좌 및 기간(당일/당월) 스코핑',
      '2. 미매칭 입금 내역 확인 (적요명과 거래처명 유사도 기반 추천 목록 제시)',
      '3. 중앙 그리드에서 해당 매출 청구서와 1:1 인라인 매칭 선택',
      '4. 우하단 [원클릭 수납 매칭 확정] ➔ 외상미수금 대장 실시간 상계 반영'
    ],
    auditResult: '통장 잔액과 시스템 장부 잔액 100% 일치 및 미수금 실시간 회수 처리',
    rulesCompliance: [
      '헌장 3.6 [유형 B 고밀도 그리드]: 한눈에 20~30건의 입금 내역을 동시 조망하며 인라인 처리',
      '헌장 1.2 [이벤트 기록 무누락]: 매칭된 거래 ID 및 상계 시각 영구 보존'
    ],
    precautions: [
      '동명이인 또는 대표자 개인 계좌 입금 시 고객사 담당자 확인 후 매칭',
      '가수금(출처 불명 입금)은 임의 매칭하지 말고 가수금 계정으로 임시 보관'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="bank-account-picker"]',
        type: 'stamp',
        label: '조회 계좌 선택',
        description: '대사를 진행할 은행 법인 통장을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="bank-tx-grid"]',
        type: 'highlight',
        label: '통장 거래 내역 그리드',
        description: '입출금 적요, 거래 금액, 시스템 자동 매칭 후보를 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-confirm-match"]',
        type: 'click_ripple',
        label: '수납 매칭 확정',
        description: '매출 채권과 1:1 상계 처리하고 수납을 종결합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'corporate_card',
    menuName: '법인카드 매입정산',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '재무/회계팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '법인카드 승인 내역 연동, 카드 사용자별 영수증 증빙 첨부 확인 및 회계 계정과목(복리후생, 유류비 등) 분류 확정',
    scopeInfo: '카드 번호, 승인 일시, 가맹점명, 승인 금액, 부가세, 사용자, 회계 계정과목, 영수증 이미지',
    cognitiveSequence: [
      '1. 승인 연월 및 카드별/부서별 승인 내역 스코핑',
      '2. 중앙 그리드에서 미증빙/미분류 사용 내역 인라인 확인',
      '3. 가맹점명 기반 계정과목(식대, 소모품비, 유류비, 통행료 등) 선택 및 영수증 증빙 대조',
      '4. 우하단 [카드 매입 전표 확정] ➔ 부가세 매입세액 공제 신고 기초 데이터 확정'
    ],
    auditResult: '법인카드 사용 내역 100% 증빙 완결 및 세무 신고용 매입 전표 확정',
    rulesCompliance: [
      '헌장 3.1 [무수식어 표기]: 객관적 승인 일시, 가맹점, 공급가액, 세액만 정밀 표기',
      '헌장 5.1 [수학적 검증]: 승인총액 = 공급가액 + 부가세액 보존식 준수'
    ],
    precautions: [
      '휴일/심야 사용 건 또는 유흥업소 결제 건은 감사 대상이므로 구체적 업무 사유서 첨부 필수',
      '간이과세자 결제 건은 부가세 매입세액 불공제 항목으로 정확히 분류'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="card-month-filter"]',
        type: 'stamp',
        label: '승인 연월 선택',
        description: '정산할 카드 승인 기간을 지정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="card-tx-grid"]',
        type: 'highlight',
        label: '카드 승인 내역 원장',
        description: '가맹점, 금액, 사용자, 첨부 증빙을 1:1 대사합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-confirm-card-slip"]',
        type: 'click_ripple',
        label: '전표 확정 마감',
        description: '계정과목을 확정하고 회계 전표로 인계합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'cash_flow',
    menuName: '자금 흐름 분석',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '경영진/재무팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '매출 수납액과 매입 지출액 기반 일일/월별/분기별 현금 유동성 추이 분석 및 차기 자금 집행 예측',
    scopeInfo: '현금/보통예금 잔액, 당월 수금 예정액, 확정 매입 지급액, 고정비(급여/임차료), 여유 자금 지표',
    cognitiveSequence: [
      '1. 상단 분석 기간(월별/분기별) 및 계좌 그룹 선택',
      '2. 중앙 캐시플로우 트렌드 차트에서 순자금 증감(Inflow vs Outflow) 추이 분석',
      '3. 차기 30일간의 만기 도래 채권 및 채무 예정 스케줄표 검토',
      '4. 자금 과부족 발생 예상 시점 파악 및 단기 차입/유동성 확보 대책 수립'
    ],
    auditResult: '전사 자금 건전성 조망 및 현금 유동성 경색 위험 선제적 차단',
    rulesCompliance: [
      '헌장 5.1 [리포트 2단계 검증]: 기말 현금 = 기초 현금 + 수납액 - 지출액 수학적 수식 정합성 충족',
      '헌장 3.1 [건조한 표기]: 감성적 지표 배제, 실제 통장 입출금 기반 통계만 표시'
    ],
    precautions: [
      '미수 채권 연체율 증가 시 현금 유입 예측치에 할인율을 반영하여 보수적 분석 권장',
      '특정 일자(급여일 10일/25일 등)에 자금 유출 집중 여부 점검'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="cash-flow-range"]',
        type: 'stamp',
        label: '분석 기간 설정',
        description: '자금 흐름을 시뮬레이션할 기간을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="cash-flow-chart"]',
        type: 'highlight',
        label: '자금 유출입 차트',
        description: '수납(유입)과 지출(유출), 순현금 추이를 시각적으로 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'depreciation_execution',
    menuName: '감가상각 마감 실행',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '회계팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '보유 고소작업대 자산의 정액법 월별 감가상각비 자동 계산, 장부가액 갱신 및 월말 회계 마감 확정',
    scopeInfo: '취득 자산 목록, 취득원가, 내용연수(5년/60개월), 잔존가치, 상각방법, 기 상각누계액',
    cognitiveSequence: [
      '1. 상단 감가상각 마감 대상 연월(YYYY-MM) 선택',
      '2. [상각비 시뮬레이션 계산] 클릭으로 자산별 당월 상각비 및 기말 장부가액 자동 산출',
      '3. 중앙 고밀도 그리드에서 신규 취득분 일할 상각 및 매각 자산 상각 중지 여부 검증',
      '4. 우하단 대차대조식(취득원가 = 상각누계액 + 장부가액) 확인 후 [감가상각 마감 확정]'
    ],
    auditResult: '자산 대장 장부가액 실시간 반영 및 재무제표 감가상각비 전표 생성',
    rulesCompliance: [
      '헌장 5.1 [수학적 산식 준수]: 월 상각비 = (취득원가 - 잔존가치) / 내용연수(월) 산식 1:1 일치',
      '헌장 1.2 [이벤트 무누락]: 월별 상각 마감 일시 및 실행자 식별자 DB 영구 보존'
    ],
    precautions: [
      '이미 매각/폐기 처리된 장비에 대해 중복 상각이 발생하지 않도록 제각 일자 철저 확인',
      '당월 마감 확정 후에는 취득원가 수정이 불가하므로 실행 전 신규 취득 등록 완료 여부 점검'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="depr-month-picker"]',
        type: 'stamp',
        label: '상각 연월 선택',
        description: '감가상각을 집계할 기준 월을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="depr-calc-grid"]',
        type: 'highlight',
        label: '상각비 계산 그리드',
        description: '자산별 취득가, 당월 상각비, 상각누계액, 장부가액을 대사합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-confirm-depr"]',
        type: 'click_ripple',
        label: '상각 마감 실행',
        description: '감가상각비를 확정하고 자산 대장 장부가액을 갱신합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'regular_reports',
    menuName: '정기보고서 생성',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '경영기획/경영진',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '전사 자산 가동률, 모델별 매출 기여도(헌장 4.1), 부서별 KPI, 손익 집계 등 경영진 브리핑용 정기보고서 자동 생성 및 엑셀 다운로드 (헌장 5.1 2단계 검증 적용)',
    scopeInfo: '보고 기간(월간/분기/연간), 집계 지표(가동률, 총매출, 운송비율, 정비비용, 연체율)',
    cognitiveSequence: [
      '1. 상단 보고서 유형(월간 경영 실적, 자산 가동 분석, 수지 분석) 선택',
      '2. 기준 기간 지정 후 [데이터 집계 실행]',
      '3. 지표별 수식 및 DB 데이터 1:1 정합성 검증 확인',
      '4. 우상단 [PDF 인쇄] 또는 [엑셀 내보내기]로 경영진 보고 자료 생성 종결'
    ],
    auditResult: '경영 의사결정을 위한 100% 무오류 정기 경영 분석 보고서 완결',
    rulesCompliance: [
      '헌장 5.1 [2단계 검증 정책 필수 이행]: 모든 통계 지표는 수학적 산식 정립 + DB 스키마 1:1 검증 후 집계',
      '헌장 3.1 [건조한 보고서]: 과장 없는 건조한 명사/숫자 중심 레이아웃'
    ],
    precautions: [
      '월말 결산(청구 마감, 매입 마감, 감가상각)이 완료되기 전 집계 시 미확정 추정치로 표기 필수',
      '가동률 계산 시 역일(달력 일수)과 장비 총 보유 대수 기준을 명확히 명기'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="report-type-selector"]',
        type: 'stamp',
        label: '보고서 서식 선택',
        description: '경영실적, 가동률, 자산수익성 등 서식을 지정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="report-viewer"]',
        type: 'highlight',
        label: '보고서 브리핑 뷰어',
        description: '2단계 검증을 거친 정밀 통계 지표를 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-export-report"]',
        type: 'click_ripple',
        label: 'PDF / 엑셀 다운로드',
        description: '경영 보고용 정규 문서 파일로 내보냅니다.',
        badgeColor: '#E53935',
        positionHint: 'left',
        spotlight: false,
      }
    ]
  },

  // ─── 8. 경영관리 - 특수 (grp_management_special) ──────────
  {
    menuId: 'organization',
    menuName: '조직 / 인사 관리',
    groupId: 'grp_management_special',
    groupName: '경영관리 - 특수',
    department: '인사/총무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '본사/지사/주기장 조직도 트리 구조, 부서 및 직급 체계 정의, 테넌트 정보보호 책임자 설정 및 메타데이터 관리',
    scopeInfo: '상위 부서, 하위 부서, 직급/직책 코드, 테넌트 정보보호 책임자 성명/연락처, 사업장 소재지',
    cognitiveSequence: [
      '1. 좌측 조직도 트리에서 부서 계층 구조(영업본부, 물류팀, 주기장팀 등) 확인 및 노드 추가',
      '2. 직급/직책 체계표에서 7단계 직급 티어와 연결될 직위(사원~대표이사) 정의',
      '3. 우측 테넌트 설정 패널에서 [개인정보보호 책임자] 성명, 부서, 직통 연락처 지정',
      '4. 우하단 [조직 설정 저장]으로 전사 결재선 및 사용자 권한에 즉시 반영'
    ],
    auditResult: '전사 부서 및 권한 통제의 근간이 되는 조직 마스터 SSOT 확립',
    rulesCompliance: [
      '헌장 5.3 [단일 진실의 원천(SSOT)]: 조직 및 직급 메타데이터의 단일 원본 보존',
      '개인정보보호법 제31조 준수: 테넌트별 개인정보보호 책임자 필수 지정'
    ],
    precautions: [
      '부서 삭제 시 소속된 임직원이 존재할 경우 삭제 불가 (타 부서로 사전 재배치 필수)',
      '정보보호 책임자 변경 시 개인정보 접속 감사 페이지 및 처리방침에 즉시 연동 반영'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="org-tree-panel"]',
        type: 'stamp',
        label: '조직도 트리',
        description: '회사 부서의 상하 계층 구조를 직관적으로 편집합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'right',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="privacy-officer-form"]',
        type: 'highlight',
        label: '정보보호 책임자 설정',
        description: '법정 의무 개인정보보호 책임자를 테넌트별로 지정합니다.',
        badgeColor: '#059669',
        positionHint: 'left',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-save-org"]',
        type: 'click_ripple',
        label: '조직 설정 저장',
        description: '변경된 조직 및 직급 기준을 시스템에 즉시 반영합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'permission',
    menuName: '사용자 및 권한',
    groupId: 'grp_management_special',
    groupName: '경영관리 - 특수',
    department: '시스템관리자',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '임직원 계정 생성, 소속 부서/직급 매핑, 직급 티어(Tier 1~7) 부여 및 메뉴별 읽기/쓰기/삭제 RBAC 권한 제어',
    scopeInfo: '로그인 ID, 사원 성명, 소속 부서, 직급, 티어 레벨(0~7), 메뉴별 권한 매트릭스(view, edit, delete, export)',
    cognitiveSequence: [
      '1. 좌측 사용자 목록에서 대상 임직원 선택 또는 [신규 사용자 추가]',
      '2. 사원 정보(아이디, 성명, 이메일, 소속부서, 직급) 입력 및 유효 티어 레벨 설정',
      '3. 우측 메뉴 권한 매트릭스에서 담당 직무에 따른 메뉴별 열람/편집/삭제 체크박스 부여',
      '4. 우하단 [사용자 권한 저장] ➔ 해당 사용자의 다음 로그인 시 메뉴 사이드바 및 액션 버튼 실시간 통제'
    ],
    auditResult: '부서별 업무 R&R에 입각한 엄격한 최소 권한(Least Privilege) 체계 확립',
    rulesCompliance: [
      '헌장 2.1 [부서 R&R 엄격 분리]: 영업사원 계정에는 장비 할당/배차 편집 권한 부여 금지',
      '헌장 5.3 [SSOT 권한]: 권한 정의를 DB user_permissions 단일 테이블로 일관 관리'
    ],
    precautions: [
      '퇴사자 발생 시 즉시 계정 상태를 [비활성(Inactive)]으로 전환하여 접근 차단',
      '관리자(Tier 7) 권한은 대표이사 및 전산 책임자 외 임의 부여 절대 금지'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="user-list-table"]',
        type: 'stamp',
        label: '사용자 목록',
        description: '등록된 임직원 계정과 부서, 직급 티어를 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'right',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="permission-matrix"]',
        type: 'highlight',
        label: '메뉴 권한 매트릭스',
        description: '메뉴별 열람, 수정, 삭제, 내보내기 권한을 정밀 통제합니다.',
        badgeColor: '#059669',
        positionHint: 'left',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-save-permission"]',
        type: 'click_ripple',
        label: '권한 저장',
        description: '설정한 보안 권한을 사용자 계정에 즉시 동기화합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'payroll',
    menuName: '급여 정산',
    groupId: 'grp_management_special',
    groupName: '경영관리 - 특수',
    department: '인사/급여팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '기본급, OT 수당, 식대, 4대보험 공제액 및 소득세를 반영한 월별 급여 명세서 자동 산출, 급여 이체 데이터 확정 및 명세서 발송',
    scopeInfo: '급여 연월, 임직원 기본급 테이블, 당월 OT 승인 시간, 4대보험 요율, 부양가족 수',
    cognitiveSequence: [
      '1. 상단 급여 연월(YYYY-MM) 선택 후 [급여 대장 자동 생성]',
      '2. OT 관리(OtManagementPage) 승인 시간 및 연차 차감 내역 자동 연동 확인',
      '3. 중앙 고밀도 그리드에서 지급 총액, 공제 총액(국민/건강/고용/장기요양/소득세), 실지급액 1:1 대사',
      '4. 우하단 [급여 대장 최종 확정] ➔ 개인별 급여명세서 전자메일 발송 및 은행 대량이체 텍스트 추출'
    ],
    auditResult: '임직원 급여 정산 100% 무결성 확정 및 세무 원천징수 신고 기초 데이터 완결',
    rulesCompliance: [
      '헌장 5.1 [수학적 산식 검증]: 실지급액 = 지급총액 - 공제총액 (1원의 절사 오차 없는 검증)',
      '헌장 1.2 [이벤트 기록 무누락]: 급여 산출 근거 및 확정 이력 암호화 저장'
    ],
    precautions: [
      '당해 연도 4대보험 법정 요율 변경 시 요율 테이블 최신화 선행 필수',
      '급여 데이터는 극비 개인정보이므로 권한 없는 자의 화면 접근 절대 차단'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="payroll-month-selector"]',
        type: 'stamp',
        label: '급여 연월 선택',
        description: '급여를 정산할 해당 월을 지정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="payroll-grid"]',
        type: 'highlight',
        label: '급여 대장 그리드',
        description: '기본급, OT수당, 4대보험 공제, 실지급액을 1:1 검증합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-confirm-payroll"]',
        type: 'click_ripple',
        label: '급여 마감 및 명세서 발송',
        description: '급여를 최종 확정하고 명세서 발송 및 이체 데이터를 생성합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'leave_management',
    menuName: '연차관리',
    groupId: 'grp_management_special',
    groupName: '경영관리 - 특수',
    department: '인사팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '전사 임직원의 입사일 기준 법정 연차 일수 자동 부여, 사용 일수 차감 집계, 연차 유급휴가 사용 촉진 통보 관리',
    scopeInfo: '임직원 입사일자, 근속 연수, 법정 발생 연차, 회계연도 기준 사용 연차, 잔여 일수, 촉진 통보 이력',
    cognitiveSequence: [
      '1. 기준 연도 및 부서별 연차 관리 스코핑',
      '2. 근속 연수에 따른 법정 발생 일수(15일 + 매 2년마다 1일 가산) 자동 계산 검증',
      '3. 연차 미사용 임직원 대상 법정 [연차 사용 촉진 통보서 자동 생성 및 발송]',
      '4. 연말 잔여 연차 보상 수당 산출 연동 및 [연차 마감]'
    ],
    auditResult: '근로기준법 제61조 연차 사용 촉진 절차 완벽 준수 및 연차 충당부채 확정',
    rulesCompliance: [
      '헌장 5.1 [수학적 산식 준수]: 잔여 연차 = 발생 연차 - 승인 완료 사용 연차 일치 보장',
      '헌장 3.1 [건조한 UI]: 촉진 통보일자 및 수령 서명 사실 위주 기록'
    ],
    precautions: [
      '1년 미만 입사자는 1개월 개근 시 1일씩 발생하는 월 단위 연차 기준 적용 필수',
      '연차 촉진 통보서를 기한 내 서면/전자 통보하지 않으면 미사용 연차 수당 지급 의무 발생'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="leave-year-filter"]',
        type: 'stamp',
        label: '관리 연도 선택',
        description: '연차를 집계할 기준 연도를 지정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="leave-mgmt-grid"]',
        type: 'highlight',
        label: '전사 연차 관리 원장',
        description: '임직원별 근속연수, 발생일수, 사용일수, 잔여일수를 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-send-promote"]',
        type: 'click_ripple',
        label: '사용 촉진 통보',
        description: '법정 연차 사용 촉진 통보서를 발송합니다.',
        badgeColor: '#E53935',
        positionHint: 'left',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'privacy_audit',
    menuName: '개인정보 접속 감사',
    groupId: 'grp_management_special',
    groupName: '경영관리 - 특수',
    department: '개인정보보호책임자',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '개인정보보호법에 따른 주민등록번호, 연락처, 계좌번호 등 고유식별정보의 열람/수정/다운로드 접속 기록 무누락 감사 및 침해사고 예방',
    scopeInfo: '접속 일시, 접속자 ID/성명, 접속자 IP, 열람 대상 정보 주체, 수행 액션(READ/EXPORT/UPDATE), 법적 정당 사유',
    cognitiveSequence: [
      '1. 상단 감사 기간 및 대량 다운로드/비인가 IP 이상 징후 필터링',
      '2. 중앙 고밀도 그리드에서 1초 단위 개인정보 열람 로그 전수 감사',
      '3. 특정 사용자의 대량 엑셀 다운로드 이력 클릭 시 다운로드 사유 소명 검토',
      '4. 우상단 [월간 개인정보 접속 감사 보고서 출력]으로 법정 감사 증적 보관'
    ],
    auditResult: '개인정보 접속 기록 최소 1~2년 이상 위변조 없이 안전 보관 법정 의무 충족',
    rulesCompliance: [
      '헌장 1.2 [이벤트 기록 무누락 DB 저장]: 접속 기록 로그 삭제/변조 영구 금지 (WORM)',
      '헌장 5.6 [날조 영구 엄단]: 인과율과 실제 접속 IP 타임스탬프 완벽 일치 보증'
    ],
    precautions: [
      '개인정보 접속 기록은 최소 1년(5만명 이상/민감정보 시 2년) 이상 영구 보존 필수',
      '심야 시간대 대량 다운로드 감지 시 즉시 정보보호 책임자에게 비상 경보 발령'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="audit-date-picker"]',
        type: 'stamp',
        label: '감사 기간 지정',
        description: '개인정보 접속 로그를 감사할 기간을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="audit-log-grid"]',
        type: 'highlight',
        label: '개인정보 접속 로그',
        description: '접속자, IP, 열람 대상자, 수행 액션을 위변조 없이 감사합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-audit-report"]',
        type: 'click_ripple',
        label: '법정 감사 보고서 출력',
        description: '감독 기관 제출용 접속 감사 보고서를 생성합니다.',
        badgeColor: '#E53935',
        positionHint: 'left',
        spotlight: false,
      }
    ]
  },

  // ─── 9. 도구 및 다운로드 (grp_tools) ──────────────────────
  {
    menuId: 'operations_manual',
    menuName: '업무매뉴얼',
    groupId: 'grp_tools',
    groupName: '도구 및 다운로드',
    department: '전사 임직원',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '전사 모든 부서 및 메뉴의 업무 프로세스, 조작 동선, 표준 헌장 준수 수칙을 전수 검색/열람하고 실무 지침서로 활용',
    scopeInfo: '전사 51개 메뉴별 상세 매뉴얼, 부서별 퀵 네비게이션, 검색 키워드, A4 인쇄 서식',
    cognitiveSequence: [
      '1. 상단 부서 선택 탭 또는 좌측 메뉴 아코디언에서 궁금한 업무 메뉴 선택',
      '2. 상단 통합 검색바에서 키워드(예: "대차", "단가상속", "검수승인") 실시간 검색',
      '3. 우측 본문에서 해당 메뉴의 최종 목표, Z-패턴 조작 순서, 헌장 준수 수칙 열람',
      '4. 필요 시 상단 [인쇄] 버튼을 눌러 부서 비치용 A4 표준 업무 편람 출력'
    ],
    auditResult: '신규 입사자 교육 및 전사 임직원의 업무 혼선 제로화 달성',
    rulesCompliance: [
      '헌장 1.1 [시스템 최우선 사명]: 최소 노력 대비 최대 편익 창출을 위한 전사 지식 기반 확립',
      '헌장 3.1 [무수식어 건조 표준]: 감성적 미사여구를 배제한 명확한 업무 지침 전수 수록'
    ],
    precautions: [
      '현장 프로세스 개편 시 매뉴얼도 즉시 동기화 갱신하여 지식의 노후화 방지',
      '인쇄물 배포 시 버전 관리 번호(v1.8.x)를 확인하여 구버전 매뉴얼 파기'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="manual-dept-tabs"]',
        type: 'stamp',
        label: '부서 퀵 필터',
        description: '영업부, 출고팀, AS팀, 경영관리부 등 부서별 매뉴얼을 전환합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="manual-search-box"]',
        type: 'highlight',
        label: '매뉴얼 통합 검색',
        description: '메뉴명, 업무 목표, 키워드로 표준 가이드를 즉시 검색합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-print-manual"]',
        type: 'click_ripple',
        label: 'A4 편람 인쇄',
        description: '현장 비치용 표준 업무 편람을 인쇄 서식으로 출력합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'left',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'error_report',
    menuName: '오류 신고',
    groupId: 'grp_tools',
    groupName: '도구 및 다운로드',
    department: '전사 임직원',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '시스템 버그, 데이터 불일치, 화면 멈춤 등 장애 발생 시 화면 캡처와 브라우저 로그를 첨부하여 개발팀에 즉각 접수 (신속 핫픽스 큐 연동)',
    scopeInfo: '발생 메뉴, 오류 현상 설명, 재현 경로, 스크린샷 이미지, 사용자 브라우저/OS 정보, 콘솔 로그',
    cognitiveSequence: [
      '1. 오류가 발생한 메뉴 선택 및 긴급도(업무 불가, 단순 표시 오류 등) 지정',
      '2. 문제 현상 및 발생 직전 수행한 조작 순서를 2~3줄로 명확히 기재',
      '3. 화면 캡처 이미지 또는 에러 팝업 캡처 첨부',
      '4. 우하단 [오류 접수] 클릭 ➔ 개발팀 실시간 핫픽스 이슈 트래커로 즉각 전송'
    ],
    auditResult: '오류 티켓 접수 완료 및 개발팀 24시간 내 패치 릴리즈 큐 인계',
    rulesCompliance: [
      '헌장 5.2 [전 스토리지 저장 성공 검증 및 무음 실패 방지]: 장애 무음 은폐 방지 및 즉각 직보',
      '헌장 6.1 [버전 관리]: 배포 버전 빌드 넘버와 함께 버그 추적성 확보'
    ],
    precautions: [
      '단순 새로고침으로 해결되는 네트워크 일시 오류인지 확인 후 지속 재현 시 신고',
      '개인정보나 계좌번호가 포함된 화면 캡처 시 중요 번호 마스킹 처리'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="error-form-container"]',
        type: 'stamp',
        label: '오류 내용 입력',
        description: '발생 메뉴, 재현 경로, 현상 설명을 기재합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-submit-error"]',
        type: 'click_ripple',
        label: '오류 신고 접수',
        description: '개발팀 실시간 핫픽스 큐로 즉시 전송합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },

  // ─── 10. 시스템관리 - 개발자 (grp_system_dev) ─────────────
  {
    menuId: 'agentic_ai_lab',
    menuName: '에이전틱 AI 샌드박스 랩',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발/기획팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '멀티에이전트 자율 의사결정 모델, 고소작업대 MRO 도메인 지식 파이프라인, 프롬프트 테스트 및 자율 최적화 연구',
    scopeInfo: '에이전트 모델(LLaMA 3.3, Gemini Flash), 도메인 지식 사전, 테스트 프롬프트, 추론 지연시간/비용',
    cognitiveSequence: [
      '1. 테스트할 에이전트 페르소나(배차 에이전트, 정산 감사관, MRO 기술고문) 선택',
      '2. 가상 시나리오(돌발 대차, 운송료 차액, 복합 고장) 프롬프트 투하',
      '3. 에이전트 간 합의 과정 및 최종 도출 솔루션 추론 타임라인 감사',
      '4. 성능 평가 후 실 운영 오토파일럿 엔진으로 프롬프트 파라미터 배포'
    ],
    auditResult: '도메인 특화 에이전트 의사결정 정확도 99% 달성 및 자율 운영 준비 확립',
    rulesCompliance: [
      '헌장 5.6 [날조 영구 엄단]: 가짜 Mock 응답 배제, 실제 LLM 추론 결과만 정직하게 로깅',
      '헌장 5.7 [감사관 에이전트 행동 강령]: 적대적 관점의 교차 검증 수행'
    ],
    precautions: [
      '실제 운영 DB에 직접 영향을 주지 않는 격리된 샌드박스 환경에서만 실행',
      'API 호출 토큰 비용 및 Rate Limit 모니터링 필수'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="agentic-prompt-input"]',
        type: 'stamp',
        label: '실험 시나리오 투하',
        description: '에이전트에게 검증할 비즈니스 상황을 주입합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="agentic-log-viewer"]',
        type: 'highlight',
        label: '추론 타임라인 감사',
        description: '에이전트의 사고 과정과 도구 호출 결과를 모니터링합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'agentic_dispatch_studio',
    menuName: '에이전틱 배차 관제 스튜디오',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발/배차팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '차량 위치 기반 최적 배차 경로, 실시간 교통 상황, 셀프 톤수별 적재율을 AI가 자율 시뮬레이션하고 최적 기사를 자동 추천하는 관제탑',
    scopeInfo: '미배정 배차 건수, 등록 운송 기사 위치 데이터, 지오코딩 좌표, 차종별 표준 요율표',
    cognitiveSequence: [
      '1. 당일 출고/회수/EXCHANGE 배차 지도 상 시각화 현황 조망',
      '2. AI 최적 배차 시뮬레이션 버튼 클릭 ➔ 합짐/복합 경로/최저 운송비 알고리즘 구동',
      '3. 추천된 기사 및 차종 조합 검토 후 [원클릭 자동 배차 지시]',
      '4. 기사 수락 여부 및 실시간 운송 상태 추적 모니터링'
    ],
    auditResult: '공차 운행율 30% 감축 및 왕복 운송비 최적화를 통한 비용 절감 실현',
    rulesCompliance: [
      '헌장 2.3 [단일 EXCHANGE 1건 원칙]: 왕복 배차 체인을 묶어 합짐 최적화 유도',
      '헌장 1.1 [최대 편익]: 배차 담당자의 수작업 배차 고민 시간을 최소화'
    ],
    precautions: [
      '지도 API 호출 쿼터 초과 시 오프라인 거리 계산 알고리즘으로 자동 폴백 확인',
      '기사 휴게 시간 및 과적 여부를 시스템이 사전에 강제 필터링'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="dispatch-map-view"]',
        type: 'stamp',
        label: '배차 관제 지도',
        description: '상하차 위치와 운송 기사 동선을 지도에서 실시간 조망합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-auto-dispatch"]',
        type: 'click_ripple',
        label: 'AI 최적 배차 추천',
        description: '최저 비용 및 최적 적재율의 기사를 자율 매칭합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'agentic_settlement_autopilot',
    menuName: '에이전틱 월말 대사 정산 오토파일럿',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발/회계팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '수백 건의 운송료, 부품 매입, 렌탈 매출 데이터를 AI 정산 엔진이 1원 단위로 사전 대사하고 이상치/단가 위반을 자율 적발하는 무인 정산기',
    scopeInfo: '전사 청구서 엑셀, 계약 원장 일할 단가, 운송사 세금계산서, 은행 계좌 거래 내역',
    cognitiveSequence: [
      '1. 오토파일럿 정산 대상 연월 및 거래처 파이프라인 가동',
      '2. 1원 단위 자동 대사 실행 ➔ 일치율 100% 정상 건은 자동 [승인 대기] 분류',
      '3. 이상치(단가 초과, 날짜 중복, 계약 외 청구) 적발 목록 집중 검토',
      '4. AI가 제안한 차액 조정안 확인 후 [일괄 자율 정산 마감 확정]'
    ],
    auditResult: '월말 정산 소요 시간 90% 단축 및 휴먼 에러로 인한 오지급 0건 실현',
    rulesCompliance: [
      '헌장 3.5 질문 4 [Audit Result]: 📄 청구총액 = 🟢 확정액 + 🚫 반려액 | ⚖️ 대차 차액 ₩0 엄격 확정',
      '헌장 4.1 [정밀 일할 집계]: 일할 계산 오차를 사전에 1원도 없이 전수 스캔'
    ],
    precautions: [
      '단가 특약이 적용된 특수 계약의 경우 AI가 계약서 메모 조항을 참조했는지 교차 확인',
      '자동 승인 한도액(예: 건당 500만원 초과)은 사람의 최종 결재를 거치도록 안전장치 유지'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="autopilot-run-btn"]',
        type: 'stamp',
        label: '오토파일럿 실행',
        description: '전사 대사 데이터를 1원 단위로 AI 자율 스캔합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="autopilot-anomaly-list"]',
        type: 'highlight',
        label: '이상치 자동 적발 목록',
        description: '단가 불일치 및 중복 청구 의심 건을 집중 감사합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'agentic_asset_lifecycle',
    menuName: '에이전틱 자산 라이프사이클 관제',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발/자산관리팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '개별 고소작업대별 누적 매출 기여도, 고장 빈도, 정비 비용, 잔존 장부가액을 실시간 추적하여 최적 매각/정비 타이밍을 제시하는 자산 AI 관제탑',
    scopeInfo: '자산 마스터, 계약별 누적 매출 기여액(헌장 4.1), 정비비 투입 누계, 가동일수/유휴일수',
    cognitiveSequence: [
      '1. 자산별 생애 수익성(Life-time ROI) 매트릭스 조망',
      '2. 고수익 효자 장비 vs 고비용 적자 장비(수리비가 임대료 초과) 선별',
      '3. AI 권고안(예: "장비번호 #105: 잔존가 대비 정비비 급증으로 3개월 내 매각 권고") 확인',
      '4. 자산 매각/정비 전략 수립 및 자산 대장 우선 관리 등록'
    ],
    auditResult: '렌탈 자산 가동 수익성 극대화 및 노후 장비 적기 처분을 통한 손실 방지',
    rulesCompliance: [
      '헌장 4.1 [자산별 매출 기여액 정밀 일할 집계]: 누적 매출 데이터를 100% 신뢰할 수 있는 기반 제공',
      '헌장 1.2 [렌탈 자산의 효과적인 운용]: 자산의 물리적 수명과 경제적 수명의 최적 교차점 도출'
    ],
    precautions: [
      '단기 렌탈 위주 장비와 장기 렌탈 장비의 가동률 지표 해석 시 계절성 요인 감안',
      '매각 권고 장비라도 현장 수요가 높은 특수 규격인 경우 대체 장비 확보 선행 필수'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="asset-roi-matrix"]',
        type: 'stamp',
        label: '생애 수익성 매트릭스',
        description: '자산별 매출 기여액과 정비비 투입액을 비교 분석합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="asset-ai-recommend"]',
        type: 'highlight',
        label: 'AI 매각/정비 권고',
        description: '수익성 분석에 기반한 최적의 자산 처분 시점을 제시합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'initial_db_upload',
    menuName: '초기DB 업로드',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '시스템관리자',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '신규 테넌트 구축 또는 과거 레거시 시스템 이관 시 고객, 장비, 자산 원장 엑셀 파일의 정합성을 검증하고 원자적(Atomic) 초기 적재',
    scopeInfo: '엑셀 템플릿(고객사, 자산대장, 단가표), 데이터 유효성 검증 규칙, 테넌트 ID',
    cognitiveSequence: [
      '1. 업로드할 데이터 카테고리(고객사/자산/계약 등) 선택 및 표준 양식 다운로드',
      '2. 과거 엑셀 파일 업로드 ➔ 시스템 사전 정합성(중복, 필수값, 외래키) 자동 검수',
      '3. 검수 오류 항목 인라인 확인 및 수정',
      '4. 우하단 [원자적 DB 일괄 주입] 클릭 ➔ Supabase 트랜잭션 적재 종결'
    ],
    auditResult: '신규 테넌트의 오염 없는 청정 초기 데이터베이스 셋업 완료',
    rulesCompliance: [
      '헌장 5.3 [로컬 DB 스키마 정합성 자가 검증]: 로컬 schema.sql 정의와 완벽 일치 검증',
      '헌장 5.2 [무음 실패 방지]: 실패 행 발생 시 즉시 상세 에러 모달 표출'
    ],
    precautions: [
      '기존 데이터가 존재하는 운영 테넌트에 업로드 시 덮어쓰기 위험이 있으므로 사전 백업 필수',
      '사업자번호 및 자산번호의 중복 키 충돌 여부 사전 확인'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="db-template-download"]',
        type: 'stamp',
        label: '표준 양식 다운로드',
        description: 'DB 스키마와 1:1 매핑된 엑셀 템플릿을 다운로드합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="db-upload-zone"]',
        type: 'highlight',
        label: '엑셀 파일 업로드',
        description: '데이터를 업로드하고 유효성을 사전 검증합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-commit-upload"]',
        type: 'click_ripple',
        label: 'DB 일괄 주입',
        description: '검증된 데이터를 운영 DB에 원자적으로 주입합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'google_config',
    menuName: '구글 관리자 설정',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '시스템관리자',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: 'Google Workspace, Drive, Cloud OCR API 및 OAuth 인증 키 환경설정 관리',
    scopeInfo: 'Google Client ID, Client Secret, 서비스 계정 JSON 키, Drive 공유 폴더 ID, OCR 엔드포인트',
    cognitiveSequence: [
      '1. 구글 클라우드 콘솔 연동 프로젝트 상태 및 API 활성화 점검',
      '2. 서비스 계정 인증서 키 및 OAuth 2.0 클라이언트 자격증명 입력',
      '3. [연결 테스트] 클릭으로 구글 드라이브 및 OCR API 응답 확인',
      '4. 우하단 [설정 저장]으로 클라우드 동기화 서비스 활성화'
    ],
    auditResult: '구글 클라우드 서비스와의 무장애 보안 연동 채널 확립',
    rulesCompliance: [
      '헌장 5.8 [외부 의존성 물리적 작동 필수]: 가짜 성공 배제, 실제 Google API 응답 코드 검증',
      '헌장 1.2 [이벤트 기록]: API 연동 설정 변경 이력 감사 로그 보존'
    ],
    precautions: [
      '서비스 계정 비공개 키가 소스코드에 하드코딩되지 않도록 환경변수/DB 보안 저장 필수',
      'Google Drive 스토리지 용량 한도 주기적 모니터링'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="google-api-keys"]',
        type: 'stamp',
        label: 'API 자격증명 입력',
        description: 'Google OAuth 및 서비스 계정 키를 설정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-test-google"]',
        type: 'click_ripple',
        label: '연결 테스트',
        description: '실제 구글 서버와 통신하여 유효성을 검증합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'dev_uploader',
    menuName: '[개발] DB 데이터 업로더',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발자 전용',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '개발 및 WTT 스트레스 테스트를 위한 고밀도 합성 시나리오 데이터 주입 및 데이터베이스 마이그레이션 도구',
    scopeInfo: '테스트 배치 ID(test_batch_id), 테스트 계약/배차/자산 건수, 스트레스 주입 축(공간/물리/시간/비용/수량)',
    cognitiveSequence: [
      '1. 주입할 테스트 시나리오(WTT 5대 축 스트레스 테스트 데이터셋) 선택',
      '2. test_batch_id 지정 (헌장 5.6에 의거 감사 완료 전 사후 삭제 금지)',
      '3. [합성 데이터 일괄 주입] 클릭 ➔ 테이블 간 외래키 정합성 유지 적재',
      '4. 감사관 에이전트(Auditor) 및 독립 검증 실행'
    ],
    auditResult: '실환경 검증(RWTT)을 위한 날조 불가능한 물리적 테스트 레코드 생성 완료',
    rulesCompliance: [
      '헌장 5.6 [날조 테스트 영구 금지]: 테스트 데이터 사후 DELETE 증거인멸 금지, test_batch_id로 영구 보존',
      '헌장 5.5 [도메인 관통 스트레스 테스트 WTT]: 5대 축 마찰 계수가 주입된 데이터 적재'
    ],
    precautions: [
      '프로덕션(운영) 환경에서는 일반 사용자가 본 메뉴에 접근할 수 없도록 권한 엄격 격리',
      '테스트 데이터에는 반드시 [TEST] 또는 [모의] 접두사를 부여하여 실매출 집계 오인 방지'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="dev-scenario-picker"]',
        type: 'stamp',
        label: '테스트 시나리오 선택',
        description: 'WTT 스트레스 테스트용 시나리오 데이터를 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-inject-test-data"]',
        type: 'click_ripple',
        label: '합성 데이터 주입',
        description: '외래키와 보존법칙을 충족하는 테스트 레코드를 주입합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  }
];

/**
 * 특정 메뉴 ID(pageId)에 대한 매뉴얼 상세 정보 조회 헬퍼
 */
export function getMenuManual(menuId: string): MenuManualDetail | undefined {
  return ALL_MENU_MANUALS.find(m => m.menuId === menuId);
}

/**
 * 인앱 오버레이용 ManualPage 데이터로 변환
 */
export function getManualPageForMenu(menuId: string, customTitle?: string): ManualPage {
  const manual = getMenuManual(menuId);
  if (!manual) {
    return {
      pageId: menuId,
      pageTitle: customTitle || menuId,
      version: 1,
      items: [
        {
          seq: 1,
          selector: 'main, .main-content-area, #root',
          type: 'callout',
          label: `${customTitle || menuId} 기본 안내`,
          description: '이 화면의 상세 조작 및 업무 지침은 [업무매뉴얼] 메뉴에서 확인하실 수 있습니다.',
          badgeColor: '#1D4ED8',
          positionHint: 'top',
          spotlight: false,
        }
      ]
    };
  }

  return {
    pageId: manual.menuId,
    pageTitle: manual.menuName,
    version: 1,
    items: manual.annotations,
  };
}
