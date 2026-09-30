// src/data/allMenuManuals.ts
// 전사 모든 메뉴 기능의 본질적 업무 목적 및 표준 매뉴얼 데이터 (SSOT)
import type { ManualPage, ManualAnnotationItem } from '../types/manual';

export interface MenuSubTabDetail {
  tabId: string;
  tabName: string;
  purpose: string;
  keyActions: string[];
}

export interface ModalWorkflowDetail {
  modalName: string;           // 모달/스튜디오 팝업 명칭
  triggerButton: string;       // 팝업 트리거 버튼명
  keyFields: string[];         // 모달 내부 핵심 검토 및 입력 항목
  terminalAction: string;      // 최종 완결 버튼명
  afterStateTransition: string; // 사후 자산/DB 상태 전이 결과
}

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
  subTabs?: MenuSubTabDetail[]; // 메뉴 내부 하위 탭 구성 및 역할
  modalWorkflows?: ModalWorkflowDetail[]; // 모달(팝업) 업무 흐름 가이드
  auditResult: string;        // 최종 확정 및 대차대조 결과 (Audit Result - 질문 4)
  rulesCompliance: string[];  // 전사 시스템 개발 표준 헌장 준수 지침 (카테고리 I~VII)
  precautions: string[];      // 현장 물리적 마찰 방지 및 WTT 주의사항
  version?: number;           // 매뉴얼 버전 (DB 갱신 비교용)
  annotations: ManualAnnotationItem[]; // 인앱 오버레이 단계 가이드
}

export const ALL_MENU_MANUALS: MenuManualDetail[] = [
  // ─── 0. 최상단 독립 메뉴 ──────────────────────────────────
  {
    menuId: 'dashboard',
    version: 4,
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
      '4. 배차 운송 및 출고 진행 파이프라인 확인 (당일 상차/출발/도착 실시간 추적)',
      '5. 긴급 A/S 및 입고 정비 큐 조망 (현장 긴급 출동 요망 건 및 수리 지연 건 식별)',
      '6. 월간 매출 목표 및 당일 정산 현황 검토 (청구 및 입금 대사 진행률 확인)',
      '7. 직무별 전담 화면 1클릭 바로가기를 통한 당일 업무 본격 착수'
    ],
        modalWorkflows: [
          {
                "modalName": "업무 지시 및 공지 팝업 (Directive Modal)",
                "triggerButton": "[긴급 업무 지시 등록]",
                "keyFields": [
                      "수신 부서/담당자",
                      "지시 우선순위(긴급/통상)",
                      "지시 내용 및 마감 시한"
                ],
                "terminalAction": "[업무 지시 발령]",
                "afterStateTransition": "해당 부서 임직원 대시보드 ToDo 피드에 실시간 업무 카드 생성"
          }
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
      },
      {
        seq: 4,
        selector: '.dispatch-pipeline-card, [data-mid="dispatch-card"]',
        type: 'stamp',
        label: '배차 운송 파이프라인',
        description: '당일 상차 및 출발 예정인 배차 건의 진행 상태를 모니터링합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '.as-repair-queue-card, [data-mid="repair-card"]',
        type: 'callout',
        label: '긴급 AS 및 정비 큐',
        description: '현장 긴급 출동 및 주기장 입고 수리 대기 건을 즉시 파악합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '.monthly-target-card, [data-mid="settlement-card"]',
        type: 'highlight',
        label: '매출 목표 및 정산',
        description: '당월 청구 마감 및 통장 입금 대사 진행률을 확인합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '.quick-actions-bar, [data-mid="quick-nav"]',
        type: 'click_ripple',
        label: '전담 메뉴 즉시 이동',
        description: '클릭 한 번으로 해당 부서 전문 작업대로 바로 진입합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },

  // ─── 1. 결재 센터 (grp_approval) ──────────────────────────
  {
    menuId: 'approvalInbox',
    version: 4,
    menuName: '내 결재함 (수신)',
    groupId: 'grp_approval',
    groupName: '결재 센터',
    department: '전사 관리자/임원',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '본인에게 상신된 결재 건(계약 체결, 대차 교체, 단가 할인, 운송비 예외, 연차/OT 등)의 전후 맥락을 검토하여 원클릭 승인 또는 사유 기재 반려 처리',
    scopeInfo: '로그인 사용자의 직급 티어(Tier 1~7) 및 위임(Delegation) 권한에 따라 도달한 [대기] 상태 결재 문서 목록',
    cognitiveSequence: [
      '1. 상단 결재함 탭 스코핑 (결재 대기 / 진행중 / 결재 완료 / 참조 문서)',
      '2. 결재 유형 필터링 (정산, 계약, 인사, 자산, 고객, 보고 6대 유형 분류)',
      '3. 결재 문서 상세 컨텍스트 검토 (품의 내용, 청구 금액, 거래처, 첨부 서류 확인)',
      '4. 결재선 티어 및 전결 규정 검증 (기안자 직급·직책 및 필요 승인 티어 적합성 판정)',
      '5. 지출/정산 대차대조 수학적 검증 (단가, 수량, 계좌번호, 세금계산서 증빙 1:1 대사)',
      '6. 사전 합의 및 협조 의견 작성 (필요 시 수정/보완 요구)',
      '7. 최종 전자서명 승인 및 사유 명시 반려 (Audit Trail 영구 보존 확정)'
    ],
        subTabs: [
          {
                "tabId": "PENDING",
                "tabName": "대기 문서",
                "purpose": "본인 승인 권한에 속한 미결재 문서 검토 및 승인/반려",
                "keyActions": [
                      "기안 내용 검토",
                      "원천 문서 증빙 확인",
                      "[승인] 또는 [반려]"
                ]
          },
          {
                "tabId": "IN_PROGRESS",
                "tabName": "진행 문서",
                "purpose": "본인이 기안하거나 결재 완료하여 상위 결재선으로 이관된 진행 문서 추적",
                "keyActions": [
                      "현재 결재 단계 모니터링",
                      "긴급 시 기안 회수"
                ]
          },
          {
                "tabId": "COMPLETED",
                "tabName": "완료 문서",
                "purpose": "최종 승인(APPROVED) 또는 반려(REJECTED) 완료된 결재 원장 조회",
                "keyActions": [
                      "감사 로그 확인",
                      "결재 공문 PDF 인쇄"
                ]
          }
    ],
    modalWorkflows: [
          {
                "modalName": "결재 합의 및 승인/반려 다이얼로그 (Approval Action Modal)",
                "triggerButton": "[승인] 또는 [반려]",
                "keyFields": [
                      "전결 규정 티어 부합 여부",
                      "차순위 결재선 지정",
                      "결재 의견 및 반려 사유"
                ],
                "terminalAction": "[승인 확정] / [반려 확정]",
                "afterStateTransition": "결재 상태 변경, 원천 비즈니스 레코드(계약/배차/감면) 즉시 실시간 동기화"
          }
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
        selector: '[data-mid="approval-tabs"], .approval-tab-bar',
        type: 'stamp',
        label: '결재함 상태 탭',
        description: '결재 대기, 진행중, 완료함 탭을 선택하여 처리 대상 문서를 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="approval-type-filter"], .type-filter',
        type: 'stamp',
        label: '결재 유형 필터',
        description: '정산, 계약, 인사, 자산, 고객, 보고 유형별로 필터링합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="approval-doc-detail"], .approval-detail-view',
        type: 'highlight',
        label: '품의 문서 상세',
        description: '기안자가 작성한 품의 내용, 청구 금액, 증빙 서류를 면밀히 검토합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="approval-tier-badge"], .tier-info-badge',
        type: 'callout',
        label: '결재 티어 검증',
        description: '기안자의 직급/직책과 규정에 따른 필요 승인 티어를 확인합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="approval-math-audit"], .audit-box',
        type: 'highlight',
        label: '지출 금액 검증',
        description: '청구 단가와 수량, 계좌 정보 및 세금계산서 일치 여부를 검증합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="approval-comment-input"], textarea.approval-comment',
        type: 'stamp',
        label: '결재 의견 작성',
        description: '합의 또는 반려 시 구체적인 사유와 지시사항을 기록합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-approve-final"], button.btn-approve',
        type: 'click_ripple',
        label: '최종 결재 승인',
        description: '전자서명을 완료하고 상위 결재선 또는 최종 완결 상태로 확정합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'approvalRules',
    version: 4,
    menuName: '결재선 규칙 설정',
    groupId: 'grp_approval',
    groupName: '결재 센터',
    department: '경영지원/시스템관리',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '테넌트별 7단계 직급 티어(Tier 1~7) 매핑, 문서 카테고리별 필수 결재선/합의(Consensus) 조건, 금액별 전결 한도 규칙 정의 및 직무 대결 관리',
    scopeInfo: '테넌트 식별자, 등록된 직급/직책 체계, 문서 카테고리(계약, 배차, 할인, 비용, 인사) 목록',
    cognitiveSequence: [
      '1. 상단 결재 카테고리 탭 스코핑 (고객, 계약, 자산, 정산, 인사, 보고 6대 유형)',
      '2. 전사 직급별·직책별 결재 권한 티어(0~7티어) 설정 현황 점검',
      '3. 비즈니스 이벤트별 기준 금액 및 전결 필요 티어 지정',
      '4. 부서간 사전 합의 부서(영업/관리/임원) 체인 구성',
      '5. 일상업무 불필요 결재선 제거 및 실익 중심 검증 (헌장 1.2)',
      '6. [표준 규칙 동기화] 버튼을 통한 DB 누락 규칙 자동 주입',
      '7. 결재선 규칙 최종 저장 및 인사 관리 연동 확정'
    ],
        subTabs: [
          {
                "tabId": "RULES",
                "tabName": "결재선 규칙 설정",
                "purpose": "금액 및 업무 성격에 따른 승인 라우팅 조건 정의",
                "keyActions": [
                      "규칙 신규 등록",
                      "최소 결재 티어 지정",
                      "합의(Consensus) 필수 여부 설정"
                ]
          },
          {
                "tabId": "TIERS",
                "tabName": "직급 티어 및 대결 설정",
                "purpose": "임직원 결재 권한 티어(Tier 1~7) 매핑 및 부재 시 대결자 지정",
                "keyActions": [
                      "대결 기간 설정",
                      "대결 수임자 지정",
                      "전결 한도액 설정"
                ]
          }
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
        selector: '[data-mid="rule-category-tabs"], .rule-tabs',
        type: 'stamp',
        label: '결재 카테고리 탭',
        description: '고객, 계약, 자산, 정산, 인사, 보고 6대 유형별로 규칙을 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="tier-config-panel"], .tier-panel',
        type: 'highlight',
        label: '결재 권한 티어',
        description: '0티어 사원부터 7티어 대표이사까지 직급·직책별 티어를 설정합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="rule-threshold-input"], .threshold-input',
        type: 'stamp',
        label: '기준 금액 및 필요 티어',
        description: '해당 결재 이벤트 승인에 필요한 최소 결재 티어와 금액 기준을 지정합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="rule-approvers-chain"], .chain-selector',
        type: 'callout',
        label: '합의선 체인 구성',
        description: '최종 승인 전에 거쳐야 하는 사전 합의 부서와 담당자를 연결합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="rule-table-grid"], table.rules-table',
        type: 'highlight',
        label: '결재 규칙 테이블',
        description: '일상업무 중복 결재선이 배제된 15개 정예 결재선 규칙을 조망합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-sync-rules"], button:contains("표준 규칙 동기화")',
        type: 'click_ripple',
        label: '표준 규칙 동기화',
        description: '원격 DB에 누락된 표준 결재선 레코드를 일괄 점검하고 동기화합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-save-rules"], button.btn-save',
        type: 'click_ripple',
        label: '결재 규칙 최종 저장',
        description: '설정한 결재 규칙을 DB에 영구 반영하여 인사정보와 즉시 연동합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },

  // ─── 2. 영업관리 (grp_sales) ──────────────────────────────
  {
    menuId: 'customer',
    version: 5,
    menuName: '고객 관리',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업부',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '고객사(원청, 전문건설사, 발주처)의 기본 정보, 사업자등록증, 현장 담당자 연락망, 신용 한도 및 미수 채권 상태 통합 관리',
    scopeInfo: '사업자등록번호, 상호명, 대표자, 업태/종목, 전자세금계산서 발행 이메일, 현장 담당자 정보',
    cognitiveSequence: [
      '1. 거래처 통합 검색 및 거래 상태/초성 필터링 (상호, 사업자번호, 대표자, 거래제한 여부)',
      '2. 고객 및 현장 운용 KPI 실시간 집계 검토 (총 고객사, 정상사, 거래제한/폐업, 현장수)',
      '3. 고객사 대장 목록 탐색 및 선택 (등록증 미등록 업체 및 결손 정보 즉시 파악)',
      '4. 선택 고객사 360도 마스터 상세 도시에 검토 (사업자정보, 대표연락처, 청구조건)',
      '5. 사업자등록증 AI OCR 자동 등록 및 정보 보완 (이미지/PDF 기반 상호/대표자 자동 파싱)',
      '6. 국세청 홈택스 사업자 휴폐업 전수 점검 및 여신 리스크 방어',
      '7. 신규 고객 등록 및 신규 현장·담당자 매핑 (계약 체결 가용화)'
    ],
        subTabs: [
          {
                "tabId": "CUST_LIST",
                "tabName": "거래처 원장",
                "purpose": "고객사 사업자 정보 및 신용 여신 상태 관리",
                "keyActions": [
                      "신규 거래처 등록",
                      "홈택스 휴폐업 검증",
                      "여신 한도액 설정"
                ]
          },
          {
                "tabId": "SITE_LIST",
                "tabName": "현장 관리",
                "purpose": "거래처별 납품/작업 현장 주소 및 현장 소장/안전담당자 관리",
                "keyActions": [
                      "현장 추가",
                      "현장 고유 출고 안전 옵션 지정",
                      "현장 지도 위치 확인"
                ]
          }
    ],
    modalWorkflows: [
          {
                "modalName": "거래처 및 현장 등록/홈택스 검증 팝업 (Customer & Site Modal)",
                "triggerButton": "[신규 거래처 등록] 또는 [현장 추가]",
                "keyFields": [
                      "사업자등록번호 (국세청 API 실시간 유효성 검증)",
                      "상호 및 대표자",
                      "세금계산서 전용 이메일",
                      "현장 주소 및 담당자 연락처",
                      "기본 안전 옵션"
                ],
                "terminalAction": "[거래처/현장 저장]",
                "afterStateTransition": "거래처 및 현장 레코드 DB 즉시 생성, 계약 작성 시 자동 완성 지원"
          }
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
        selector: '[data-mid="customer-search-filter"], .customer-filters',
        type: 'stamp',
        label: '거래처 검색 필터',
        description: '상호명, 사업자번호, 거래 상태, 초성별로 거래처를 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="customer-kpi-summary"], .kpi-summary-cards',
        type: 'highlight',
        label: '고객 운용 지표 요약',
        description: '총 고객사, 정상 거래사, 거래제한/폐업, 등록 현장수를 모니터링합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="customer-list-panel"], .customer-list-box',
        type: 'stamp',
        label: '고객사 대장 목록',
        description: '등록된 전체 거래처와 등록증 미등록 상태를 실시간 탐색합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'right',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="customer-detail-dossier"], .customer-detail-panel',
        type: 'highlight',
        label: '고객 상세 도시에',
        description: '선택한 고객사의 상호, 대표자, 연락처, 거래제한 여부를 통합 검토합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-ocr-biz-license"], button:contains("사업자등록증")',
        type: 'click_ripple',
        label: '사업자등록증 AI 보완',
        description: '사업자등록증 이미지를 올려 상호, 대표자, 등록번호를 자동 파싱합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-nts-audit"], button:contains("국세청")',
        type: 'callout',
        label: '국세청 휴폐업 점검',
        description: '국세청 홈택스 실시간 API로 정상/휴업/폐업 여부를 즉시 검증합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-new-customer"], button:contains("신규 고객 등록")',
        type: 'click_ripple',
        label: '신규 고객 등록',
        description: '신규 거래처 및 투입 현장을 신규 등록하고 여신 거래를 개시합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'contract',
    version: 5,
    menuName: '계약 관리',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업부',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '고소작업대 렌탈 임대차 계약 체결, 계약 기간, 대여 자산 기여액 일할 집계(헌장 4.1), 대차/교체 시 계약 속성 100% 자동 상속(헌장 2.2), 계약 변경 이력 무누락 보존',
    scopeInfo: '고객사, 현장 주소, 요구 장비 규격/수량, 임대 시작/종료일, 월 렌탈료 단가, 청구 마감일 조건',
    cognitiveSequence: [
      '1. 계약 조회 조건 설정 및 스코핑 (고객사, 현장, 계약기간, 진행상태 필터링)',
      '2. 계약 운용 실시간 KPI 지표 검토 (총 계약건수, 진행/연장, 만료임박, 월 렌탈료 합계)',
      '3. 통합 빠른 검색 및 계약 유형 전환 (렌탈 계약 ↔ 매각 계약 1클릭 전환)',
      '4. 고밀도 계약 대장 그리드 1:1 대사 (출고 마일스톤, 투입 장비 모델/수량, 마감일 검증)',
      '5. 계약 상세 조회 및 라이프사이클 조치 ([상세 ➔] 클릭: 기간변경, 단가조정, EXCHANGE 대차)',
      '6. 계약서 패키지 통합 발행 및 엑셀 대장 출력 (계약서·작업지시서·안전옵션 PDF 및 엑셀)',
      '7. 신규 계약 작성 및 전자 체결 ([+ 신규 계약 등록] 클릭: 고객/현장 매핑 및 장비 단가 체결)'
    ],
        subTabs: [
          {
                "tabId": "ALL_LIST",
                "tabName": "계약 대장 목록",
                "purpose": "체결된 전체 렌탈 계약의 기간, 상태, 청구 조건, 자산 목록 통합 조망",
                "keyActions": [
                      "계약 상세 조회",
                      "계약서 PDF 인쇄",
                      "기간 연장/단축",
                      "대차 교체 의뢰"
                ]
          },
          {
                "tabId": "CREATE",
                "tabName": "신규 계약 작성",
                "purpose": "신규 장비 임대차 계약서 작성 및 전자 서명 발행",
                "keyActions": [
                      "거래처/현장 선택",
                      "계약 장비 모델 및 단가 입력",
                      "작업지시서 첨부",
                      "계약서 저장/발송"
                ]
          }
    ],
    modalWorkflows: [
          {
                "modalName": "EXCHANGE 대차 교체 의뢰 팝업 (Exchange Order Modal)",
                "triggerButton": "체결 자산 행의 [대차/교체]",
                "keyFields": [
                      "회수 대상 전자산 번호",
                      "교체 사유(고장, 사양 변경 등)",
                      "대차 요청 모델/수량",
                      "현장 인도 희망 시각"
                ],
                "terminalAction": "[EXCHANGE 단일 배차 의뢰 발행]",
                "afterStateTransition": "단일 EXCHANGE 배차 의뢰 1건 발행(헌장 2.3), 계약 속성 100% 자동 상속(헌장 2.2), 타임라인 1:1 연결 기록(헌장 4.2)"
          },
          {
                "modalName": "계약 변경(기간 연장 / 단가 변경) 팝업 (Contract Amendment Modal)",
                "triggerButton": "[기간 연장] 또는 [단가 변경]",
                "keyFields": [
                      "신규 만료일자",
                      "연장/변경 월 렌탈료 단가",
                      "적용 시작일자",
                      "변경 사유"
                ],
                "terminalAction": "[변경 확정 및 결재 상신]",
                "afterStateTransition": "계약 이력(contractHistory)에 AMENDMENT 이력 영구 보존, 매출 일할 청구 계산식 자동 갱신"
          }
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
        selector: '[data-mid="contract-filter-panel"], .contract-filters',
        type: 'stamp',
        label: '계약 조회 조건 설정',
        description: '고객사, 현장, 계약 기간(시작/종료일) 및 진행 상태(진행중/만료임박/종결) 조회 조건을 설정하고 조회를 실행합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="contract-kpi-summary"], .contract-kpi-cards',
        type: 'highlight',
        label: '계약 운용 지표 요약',
        description: '총 계약건수, 진행/연장 건, 만료 임박(D-3), 단가 0원 주의, 체결 투입자산 대수 및 월 렌탈료 합계를 실시간 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="contract-search-bar"], .contract-search-bar',
        type: 'stamp',
        label: '통합 검색 및 유형 선택',
        description: '계약번호, 고객사명, 현장명, 자산번호 빠른 검색 및 렌탈 계약 / 매각 계약 유형을 즉시 전환합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="contract-table"], .contract-table-container',
        type: 'highlight',
        label: '계약 대장 목록 대사',
        description: '계약번호, 고객사, 현장, 출고 마일스톤, 체결 자산 모델/수량, 월 렌탈료 및 청구 마감일을 1:1 대사합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="contract-detail-action"], button:contains("상세")',
        type: 'click_ripple',
        label: '계약 상세 및 변경 조치',
        description: '[상세 ➔]를 클릭하여 체결 자산 상세, 기간 연장/단축, 단가 변경, EXCHANGE 대차 의뢰를 조치합니다.',
        badgeColor: '#2563EB',
        positionHint: 'right',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="contract-export-actions"], button:contains("계약서패키지")',
        type: 'callout',
        label: '계약서 패키지 및 엑셀',
        description: '체결 계약서·작업지시서·안전옵션 패키지 PDF/이메일 일괄 발송 및 계약 대장 엑셀을 다운로드합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-new-contract"], button:contains("신규 계약 등록")',
        type: 'click_ripple',
        label: '신규 계약 작성 등록',
        description: '신규 렌탈/매각 임대차 계약서를 작성하고 고객사/현장 매핑, 장비 모델 및 월/일할 단가를 설정하여 체결합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'contract_create',
    version: 5,
    menuName: '신규 계약 등록',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업부',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '신규 고객사/현장 매핑, 영업담당 지정, 계약 기간 및 청구/결제 조건 설정, 장비 모델 및 단가 체결 완료',
    scopeInfo: '고객사(거래처), 영업담당자, 계약 시작일, 만료일(또는 상시대여), 청구 마감일, 명세서 마감일, 약정 결제일, 투입 자산 모델 및 월 렌탈료',
    cognitiveSequence: [
      '1. 고객사(거래처) 검색 및 선택 (연체 채권 및 거래제한 실시간 검증)',
      '2. 계약 총괄 사내 영업담당자 지정',
      '3. 장비 투입 및 과금 개시 계약 시작일 설정',
      '4. 계약 만료일 설정 또는 종료일 미정(상시 대여) 지정',
      '5. 청구 마감일, 거래명세서 마감일 및 약정 결제일 조건 확정',
      '6. 체결 대상 장비 모델 및 월 렌탈료 단가 입력 후 바스켓 추가',
      '7. 신규 계약 최종 등록 및 체결 완료 ([계약 등록])'
    ],
    auditResult: '신규 임대차 계약 체결 확정 및 자산 대여/과금 라이프사이클 개시',
    rulesCompliance: [
      '헌장 1.1 [최대 편익 달성]: 최소 입력으로 정확한 거래처 및 계약 속성 매핑',
      '헌장 1.2 [렌탈 자산 효과적 운용]: 계약 체결 즉시 출고 검수 및 배차 대기 파이프라인 연계',
      '헌장 2.1 [영업 R&R]: 영업은 제원 요구 및 단가 체결까지 담당'
    ],
    precautions: [
      '거래제한 고객사는 신규 계약 등록이 차단되며 경영진 해제 승인 선행 필요',
      '미납 연체 채권 존재 거래처는 수금 책임 인지 체크박스 동의 필수'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="create-contract-cust"], select[value*="custSelect"]',
        type: 'stamp',
        label: '고객사 선택 및 검증',
        description: '거래처를 검색·선택하거나 신규 고객사를 등록합니다. 미납 연체 채권 및 경영진 출고제한 여부가 자동 검증됩니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="create-contract-salesperson"], select[value*="salespersonSelect"]',
        type: 'stamp',
        label: '영업담당 지정',
        description: '계약 체결 및 수금 관리를 총괄할 사내 영업담당 임직원을 지정합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="create-contract-start-date"], input[type="date"]',
        type: 'stamp',
        label: '계약 시작일 설정',
        description: '현장 장비 인도 및 렌탈료 과금이 공식 개시되는 계약 시작일을 설정합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="create-contract-end-date"]',
        type: 'stamp',
        label: '종료일 / 상시대여',
        description: '약정 만료일을 입력하거나, 현장 종료 시까지 유지되는 종료일 미정(상시 대여)을 체크합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="create-contract-billing-terms"]',
        type: 'stamp',
        label: '청구 마감 및 결제일',
        description: '매월 청구 마감일(일), 명세서 마감일(일) 및 약정 결제일 조건을 설정합니다. (고객사 기본 조건 자동 연동)',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="create-contract-basket-picker"]',
        type: 'callout',
        label: '체결 자산 모델 및 단가',
        description: '제품 모델(또는 자산 관리번호)을 선택하고 월 렌탈료 단가를 입력한 후 [+ 추가] 버튼으로 바스켓에 담습니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 7,
        selector: '[data-mid="create-contract-submit"], button[type="submit"]:contains("계약 등록")',
        type: 'click_ripple',
        label: '신규 계약 최종 등록',
        description: '입력된 계약 제원과 체결 자산 바스켓을 검증하고 [계약 등록]을 클릭하여 계약 체결을 완료합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'billing',
    version: 5,
    menuName: '청구 / 수납 관리',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업/재무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '월별 청구 대장 조회, 다중 조건 필터링, 수납 등록 및 미수금 관리, 전자명세서 발송, 정품 거래명세서 서식 출력, 회계 대차대조식 검증',
    scopeInfo: '청구 귀속월(YYYY-MM), 고객사 초성/상호, 계약번호, 수납 상태(완납/미납), 메일 발송 여부, 통합 인보이스 구분',
    cognitiveSequence: [
      '1. 좌상단 청구 귀속 시작월~종료월 기간 설정',
      '2. [당월] 및 [<], [>] 퀵 버튼으로 월 단위 빠른 점프 이동',
      '3. 고객사 초성(예: ㅅㅅ) 또는 상호 입력으로 거래처 특정',
      '4. 특정 계약 추적 시 계약번호 직접 입력',
      '5. 수납 상태(전체/완납/미완료)로 미수 채권 청구서 추출',
      '6. 메일 발송(미발송/발송) 및 통합 구분 필터링',
      '7. [조회] 실행으로 DB 실시간 쿼리 및 [초기화]로 기본값 복원',
      '8. 청구·수납 6대 종합 집계 (공급가, 세액, 총액, 수납액, 미수금, 통장잔액) 확인',
      '9. 청구 대장 전체 데이터 엑셀(XLSX) 양식 다운로드',
      '10. 월별 청구 대장 그리드에서 청구서 목록 조망 및 개별 행 클릭',
      '11. 미납 청구서 [수납] 클릭 ➔ 통장 입금 내역 1:1 매칭 및 영수 등록',
      '12. [발송] 클릭 ➔ 거래처 담당자에게 거래명세서 이메일 즉시 전송',
      '13. 고객사 이의제기 시 [취소/재생성]으로 청구 취소 및 계약 직전 상태 롤백',
      '14. 우측 명세서 스튜디오에서 장비별 일할 렌탈료 대조, [청구 분할 ✂️], 정품 PDF/엑셀 출력',
      '15. 하단 회계 대차대조식 검증 바(청구총액 = 수납액 + 미수잔액) 무결성 확정 (Audit Result)'
    ],
    subTabs: [
      {
        tabId: 'LIST',
        tabName: '청구 대장',
        purpose: '월별 청구 목록 조회, 실시간 입금 수납 매칭, 거래명세서 이메일 발송 및 정품 A4 서식 출력',
        keyActions: [
          '청구 귀속월 및 초성 검색',
          '수납 등록 및 통장 매칭',
          '거래명세서 이메일 즉시 발송',
          '청구 취소 및 계약 롤백',
          '청구 분할 및 정품 PDF/엑셀 출력'
        ]
      },
      {
        tabId: 'WIZARD',
        tabName: '미청구 정산',
        purpose: '정산 대상 계약의 기간별 일할 매출을 집계하여 청구서 생성',
        keyActions: [
          '마감 연월 선택',
          '일할 계산 검증',
          '정산 기간 설정',
          '청구 생성 마감'
        ]
      },
      {
        tabId: 'INVOICE',
        tabName: '청구서통합',
        purpose: '동일 거래처 다수 현장 계약 건을 1장의 통합 청구서로 합산 발행',
        keyActions: [
          '거래처별 합산 미리보기',
          '통합 청구서 PDF 생성'
        ]
      },
      {
        tabId: 'WAIVER',
        tabName: '청구 면제 대장',
        purpose: '우천, 파업, 고장 대차 등 특약에 의한 청구 감면 내역 감사 원장',
        keyActions: [
          '면제 승인 건 검토',
          '면제 증빙 확인'
        ]
      }
    ],
    modalWorkflows: [
      {
        modalName: '수납 등록 팝업 (Receipt Modal)',
        triggerButton: '[수납]',
        keyFields: [
          '수납 일자 및 입금 계좌',
          '수납 금액 및 통장 거래 1:1 매칭',
          '입금자명 확인'
        ],
        terminalAction: '[수납 처리 완료]',
        afterStateTransition: '청구서 상태가 PAID(완납) 또는 PARTIAL(일부납)로 갱신되고 미수채권 차감'
      }
    ],
    auditResult: '청구 총액과 기수납액, 미수 잔액의 합이 100% 일치(대차 차액 ₩0)하여 외상매출금 원장과 무결하게 연계됨',
    rulesCompliance: [
      '헌장 3.1 [무수식어 건조 UI 표준]: 과장된 수식어 전면 배제 및 건조한 명사·동사 단일 체계 준수',
      '헌장 3.5 [Gutenberg Z-패턴 표준]: 좌상단(1~7) ➔ 우상단(8~9) ➔ 중앙(10~14) ➔ 우하단(15) 실무 동선 일치',
      '헌장 4.1 [정밀 일할 집계 정책]: 청구서별 장비 일할 렌탈료 및 추가비용 1:1 대사 검증'
    ],
    precautions: [
      '완납 처리된 청구서는 임의 삭제가 불가하므로 수납 전 입금 내역을 철저히 대조',
      '취소/재생성 시 계약의 최근 청구 이력이 롤백되므로 이의제기 사유를 명확히 기재'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="billing-period-scope"]',
        type: 'stamp',
        label: '청구 귀속월 기간 설정',
        description: '조회할 청구 귀속 시작월과 종료월을 지정합니다. (예: 2026-09 ~ 2026-09) 복수 월을 선택하면 분기 또는 반기 누적 청구 현황을 일괄 집계할 수 있습니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="billing-month-quick"]',
        type: 'click_ripple',
        label: '전월·당월·익월 퀵 버튼',
        description: '달력 피커를 직접 열지 않고 [당월]을 클릭하면 즉시 이번 달 귀속월로 자동 세팅되며, [<], [>] 버튼을 눌러 1개월 단위로 빠르게 전후 이동합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="billing-customer-filter"]',
        type: 'stamp',
        label: '고객사 초성·상호 검색',
        description: '고객사명 또는 한글 초성(예: "ㅅㅅ" 입력 시 삼성, 삼우 등)을 입력하여 특정 거래처의 청구 내역만 실시간으로 빠르게 필터링합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="billing-contract-filter"]',
        type: 'stamp',
        label: '계약번호 직접 조회',
        description: '특정 현장 또는 특정 계약건에 부속된 청구서만 정밀하게 추적할 때 고유 계약번호(예: CT-2026-XXXX)를 입력합니다.',
        badgeColor: '#0D9488',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="billing-payment-filter"]',
        type: 'stamp',
        label: '수납 상태 필터링',
        description: '"전체", "수납완료(PAID)", "미완료(UNPAID_ANY)" 중 선택합니다. "미완료"를 선택하면 아직 입금되지 않은 외상미수금 청구서만 집중 추출됩니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="billing-mail-filter"]',
        type: 'stamp',
        label: '메일 발송 및 통합 구분 필터',
        description: '전자거래명세서 "미발송" 건만 걸러내어 누락 없이 이메일을 전송하거나, "단독 청구"와 "통합 인보이스" 포함 여부를 구분하여 선별합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="billing-search-action"]',
        type: 'click_ripple',
        label: '[조회] 및 [초기화] 실행',
        description: '입력한 모든 검색 조건을 DB에 적용하여 청구 목록과 6대 종합 지표를 즉시 재계산합니다. [초기화]를 누르면 모든 필터가 기본값으로 리셋됩니다.',
        badgeColor: '#4F46E5',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 8,
        selector: '[data-mid="billing-kpi-summary"]',
        type: 'stamp',
        label: '청구·수납 6대 종합 집계',
        description: '조회 조건에 따른 조회건수, 공급가액, 총 청구합계(VAT포함), 기수납액, 미수채권 잔액 및 매칭 가능한 통장잔액 현황을 한눈에 파악합니다.',
        badgeColor: '#9333EA',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 9,
        selector: '[data-mid="billing-export-btn"]',
        type: 'click_ripple',
        label: '청구 대장 엑셀 다운로드',
        description: '필터링된 청구 목록 전체 데이터를 엑셀(XLSX) 양식으로 즉시 내보내어 재무 보고서 작성 및 외상매출금 장부 보관용으로 활용합니다.',
        badgeColor: '#EA580C',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 10,
        selector: '[data-mid="billing-list-table"]',
        type: 'highlight',
        label: '월별 청구 대장 그리드',
        description: '청구월, 고객사, 공급가액, 청구합계, 미납액, 수납 상태 배지를 조망합니다. 특정 행을 클릭하면 우측 패널에 해당 청구서의 세부 명세가 즉시 활성화됩니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 11,
        selector: '[data-mid="billing-pay-btn"]',
        type: 'click_ripple',
        label: '[수납] 입금 매칭 및 영수 등록',
        description: '미납 잔액이 있는 청구서의 [수납]을 클릭하여 수납 등록 팝업을 호출합니다. 통장 입금 거래를 1:1 매칭하거나 수납액을 직접 입력하여 완납(PAID) 또는 일부납(PARTIAL) 처리합니다.',
        badgeColor: '#10B981',
        positionHint: 'right',
        spotlight: true,
      },
      {
        seq: 12,
        selector: '[data-mid="billing-mail-btn"]',
        type: 'click_ripple',
        label: '[발송] 거래명세서 이메일 전송',
        description: '거래처 담당자에게 정품 거래명세서(HTML/PDF 첨부)를 즉시 이메일 발송합니다. 통합 인보이스에 묶인 건은 [개별발송]으로 개별 명세서만 분리 전송할 수 있습니다.',
        badgeColor: '#3B82F6',
        positionHint: 'right',
        spotlight: true,
      },
      {
        seq: 13,
        selector: '[data-mid="billing-cancel-btn"]',
        type: 'click_ripple',
        label: '[취소/재생성] 및 청구 롤백',
        description: '단가나 가동일수에 이의제기가 발생한 경우 청구를 취소하고 [미청구 정산] 위저드로 되돌려 수정하거나, 계약의 최근 청구일자를 직전 유효 상태로 롤백합니다.',
        badgeColor: '#EF4444',
        positionHint: 'right',
        spotlight: true,
      },
      {
        seq: 14,
        selector: '[data-mid="billing-detail-studio"]',
        type: 'stamp',
        label: '청구 명세서 및 정품 서식 출력',
        description: '선택된 청구서의 장비별 일할 렌탈료(역일 일수 대사) 및 부대비용을 1:1 대조하고, [청구월 수정], [청구 분할 ✂️], MS Excel COM 엔진 기반 정품 A4 거래명세서 PDF/엑셀을 다운로드합니다.',
        badgeColor: '#6366F1',
        positionHint: 'left',
        spotlight: false,
      },
      {
        seq: 15,
        selector: '[data-mid="billing-bottom-audit-bar"]',
        type: 'callout',
        label: '회계 대차대조식 검증 바',
        description: '조회 청구 총액이 기수납액과 미수 잔액의 합과 정확히 일치(청구총액 = 수납액 + 미수잔액 | 대차 차액 ₩0)하는지 무결성을 검증하고 외상미수금 원장으로 바통을 인계합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      }
    ]
  },
  {
    menuId: 'billing_wizard',
    version: 5,
    menuName: '미청구 정산',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업/재무팀',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '마감 도래 계약의 기간별 일할 매출 정산, 고객부담 운송료/수리비 및 외상미수금 연계 정산, 청구서 생성 및 최종 확정',
    scopeInfo: '정산 대상 기간, 청구 대상 계약 목록, 자산별 일할 가동일수 및 단가, 미청구 부대비용 및 연계 외상미수금',
    cognitiveSequence: [
      '1. 마감일 기준 검색 기간 및 전월/당월 퀵버튼 스코핑',
      '2. 고객사명, 계약번호, 현장명 세부 필터링 및 [조회]',
      '3. 외상미수금 없는 정상 계약 원클릭 일괄 청구 생성 ([일괄청구생성])',
      '4. 좌측 마감 도래 계약 카드 선택 및 우측 정산 계산기 연동',
      '5. 정산 대상 기간 및 청구 귀속월 확정 (권장 시작일, 당월, 전월 퀵버튼)',
      '6. 장비별 일할 청구액, 현장 AS 수리비, 고객부담 운송료 및 외상미수금 합산 대사',
      '7. 총 정산 예상 금액 검증 및 [청구 생성] 클릭으로 청구 대장 최종 등록'
    ],
    auditResult: '당월 미청구 일할 매출 확정 및 청구 대장/외상매출금 자동 연계 등록',
    rulesCompliance: [
      '헌장 1.2 [발생 사건 무누락 DB 저장]: 청구 생성 즉시 청구서 및 세부 내역 무누락 DB 기록',
      '헌장 4.1 [자산별 매출 기여액 정밀 일할 집계]: 실제 가동일수 기반 1원도 오차 없는 정밀 일할 계산'
    ],
    precautions: [
      '외상미수금(수리비/운송비)이 포함된 계약은 일괄 청구 대상에서 제외되며 수동 검토 후 생성 필요',
      '직전 청구 기간과 겹치지 않도록 권장 시작일 자동 계산값을 우선 확인'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="wizard-period-scope"]',
        type: 'stamp',
        label: '마감일 기준 검색 기간',
        description: '전월·당월·익월·3개월·연간 퀵버튼과 일자 입력을 통해 청구 마감이 도래한 계약 범위를 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="wizard-search-filter"]',
        type: 'stamp',
        label: '고객사·계약번호·현장 검색',
        description: '특정 고객사, 계약번호 또는 현장명을 입력하여 정산 대상 계약을 정밀 필터링합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="wizard-bulk-generate-btn"], button:contains("일괄청구생성")',
        type: 'click_ripple',
        label: '일괄 청구 생성',
        description: '외상미수금 등 예외 조율이 없는 정상 계약 전체를 단 1클릭으로 일괄 청구 계산 및 생성합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 4,
        selector: '[data-mid="wizard-contract-card-list"]',
        type: 'callout',
        label: '정산 대상 계약 카드 목록',
        description: '마감 도래 뱃지 및 외상미수금 주의 표시를 확인하고 개별 정산할 계약 카드를 클릭하여 우측에 로드합니다.',
        badgeColor: '#D97706',
        positionHint: 'right',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="wizard-calc-period"], [data-mid="wizard-calculator-container"]',
        type: 'stamp',
        label: '정산 기간 및 청구귀속월',
        description: '권장 시작일, 당월, 전월 퀵버튼으로 일할 정산 대상 기간과 청구 귀속월을 확정합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="wizard-calc-items"], [data-mid="wizard-calculator-container"]',
        type: 'highlight',
        label: '일할 청구액 및 미수금 정산',
        description: '자산별 일할 가동일수와 청구액, 현장 AS 수리비, 고객부담 운송료 및 외상미수금 합산 내역을 검증합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="wizard-submit-btn"], button:contains("청구 생성"), [data-mid="wizard-calculator-container"]',
        type: 'click_ripple',
        label: '청구 생성 및 마감',
        description: '산출된 총 정산 금액을 검증하고 [청구 생성]을 클릭하여 청구 대장에 최종 등록합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'receivable',
    version: 4,
    menuName: '외상미수금 대장',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업/재무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '거래처별 누적 외상 매출금 잔액 추적, 수금 완료/미수금 잔액 대사, 연체 월령 분석 및 수금 독촉 관리',
    scopeInfo: '거래처 마스터, 월별 청구 확정액, 통장 입금 수납액',
    cognitiveSequence: [
      '1. 기준 연월 및 미수 채권 구간 스코핑 (30일 미만, 60일, 90일 이상 악성)',
      '2. 거래처별 총 청구액, 기입금액, 미수 잔액 대차대조 조망',
      '3. 거래처별 수납 이력 및 통장 입금 매칭 내역 인라인 확인',
      '4. 미수금 회수 담당 영업사원 배정 및 채권 회수 메모 기록',
      '5. 60일 이상 장기 연체 건 독촉장(최고장) 서식 자동 생성 및 발송',
      '6. 부실 채권 대손 상각 및 결재 상신 (헌장 결재선 연동)',
      '7. 월말 채권 현황 확정 마감 및 경영진 보고용 엑셀 내보내기'
    ],
        subTabs: [
          {
                "tabId": "PENDING_PARTIAL",
                "tabName": "미수금 / 부분입금 현황",
                "purpose": "청구 완료되었으나 아직 전액 수납되지 않은 미수 채권 목록",
                "keyActions": [
                      "수납 등록",
                      "입금 독촉 알림톡 발송",
                      "부분 입금 처리"
                ]
          },
          {
                "tabId": "PAID",
                "tabName": "수납 완결 대장",
                "purpose": "입금이 100% 완료되어 정산 종결된 매출 청구서 원장",
                "keyActions": [
                      "입금 영수증 출력",
                      "수납 감사 로그 확인"
                ]
          },
          {
                "tabId": "OVERDUE",
                "tabName": "연체 채권 관리",
                "purpose": "약정 지급기일(30일/60일/90일)을 초과한 장기 연체 거래처 집중 관리",
                "keyActions": [
                      "연체이자 계산",
                      "내용증명 발송 요청",
                      "채권 회수 등급 조정"
                ]
          }
    ],
    modalWorkflows: [
          {
                "modalName": "외상매출금 수기 수납 처리 팝업 (Receivable Receipt Modal)",
                "triggerButton": "[수납 등록]",
                "keyFields": [
                      "수납 일자",
                      "실제 입금 금액",
                      "입금 계좌 선택",
                      "차액 처리 구분(할인, 수수료, 단수절사)"
                ],
                "terminalAction": "[수납 확정]",
                "afterStateTransition": "청구서 수납 상태 PAID 전환, 미수금 잔액 즉시 0원 처리, 거래처 여신 한도 복원"
          }
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
        selector: '[data-mid="receivable-scope-filter"], .receivable-scope',
        type: 'stamp',
        label: '채권 구간 스코프',
        description: '당월 청구, 30일/60일/90일 초과 연체 구간별로 채권을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="receivable-balance-grid"], table.receivable-table',
        type: 'highlight',
        label: '미수 잔액 대차대조',
        description: '거래처별 총청구액 - 기입금액 = 미수잔액 무결성을 한눈에 조망합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="receivable-history-drawer"], .history-drawer',
        type: 'callout',
        label: '수납 및 입금 이력',
        description: '해당 거래처의 과거 입금 내역 및 통장 대사 매칭 내역을 확인합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="receivable-memo-input"], .memo-box',
        type: 'stamp',
        label: '채권 회수 활동 기록',
        description: '담당 영업사원의 입금 독려 전화 및 현장 방문 면담 메모를 기록합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-generate-notice"], button:contains("독촉장")',
        type: 'click_ripple',
        label: '독촉장/최고장 생성',
        description: '장기 연체 거래처에 발송할 법적 최고장 및 안내장을 자동 생성합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-bad-debt-request"], button:contains("대손 상각")',
        type: 'callout',
        label: '대손 상각 결재',
        description: '폐업 등 회수 불능 채권에 대한 대손 처리 및 탕감 결재를 상신합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-export-receivable"], button:contains("엑셀 내보내기")',
        type: 'click_ripple',
        label: '채권 마감 및 엑셀',
        description: '월말 미수금 대장을 최종 마감하고 경영진 보고용 원장을 다운로드합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'smart_dispatch4',
    menuName: '출고 요청',
    version: 4,
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업부',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '영업담당자가 고객사로부터 접수한 렌탈 출고요청을 자연어 파싱 및 5단계 표준 서식으로 정형화하고, 9대 필수 스키마 실시간 검증을 거쳐 배차·출고 부서로 공식 출고 의뢰를 발행하는 전사 출고 파이프라인의 출발점 (헌장 2.1)',
    scopeInfo: '고객사/현장 마스터, 자연어 카톡/문자 원문, 모델 규격별 수량, 상하차 희망 일시, 현장 인수자 연락처, 필수 안전옵션, 9대 방어차단 규칙',
    cognitiveSequence: [
      '1. (선택) 카톡/문자 텍스트 붙여넣기 파싱으로 자연어 요청 원문 자동 변환',
      '2. 업무 유형 선택 (신규고객 출고 / 기존현장 출고 / 교체(대차))',
      '3. 1. 거래처 (고객사) 블록에서 거래처 검색 지정 또는 신규 거래처 등록',
      '4. 2. 투입 현장 블록에서 현장 선택/신규등록 및 현장 인수자(성명/연락처) 지정',
      '5. 3. 출고 장비 규격 블록에서 작업높이 및 모델별 요구 수량 선택 (헌장 2.1 모델 요구)',
      '6. 4. 출고 및 하차 일정 블록에서 상차 희망일시(ASAP/지정시간) 및 현장 도착일정 지정',
      '7. 5. 안전옵션 블록에서 필수 안전장치(난간대, 감지봉 등) 체크 및 진입로 특이 메모 기재',
      '8. 우측 [필수 정보 검증 & 방어 차단] 9대 항목 충족 확인 (미충족 시 발행 자동 차단)',
      '9. 우하단 [출고 요청 발행] 클릭 ➔ 배차/출고 대기열(TruckDispatch)로 공식 전송'
    ],
    subTabs: [
      {
        tabId: 'NEW',
        tabName: '새 요청 작성',
        purpose: '신규 렌탈 출고 요청 5단계 서식 작성, 자연어 파싱, 실시간 유효성 검증 및 공식 발행',
        keyActions: [
          '카톡/문자 텍스트 자동 파싱',
          '업무 유형 및 5단계 정보 입력',
          '9대 스키마 유효성 검증 확인',
          '출고 요청 공식 발행'
        ]
      },
      {
        tabId: 'QUEUE',
        tabName: '처리 대기 (임시저장 큐)',
        purpose: '작성 중 임시 보관된 출고 초안 및 통화 녹음 연동 건 열람, 수정, 재개',
        keyActions: [
          '초안 목록 조회 및 선택',
          '새 요청 작성으로 초안 불러오기',
          '다수 초안 일괄 처리 및 삭제'
        ]
      }
    ],
    auditResult: '출고 의뢰 레코드(deliveries) 생성 및 배차 관리(TruckDispatch) 및 자산 출고 대기 큐로 공식 바인딩 전송',
    rulesCompliance: [
      '헌장 2.1 [영업-출고 R&R 엄격 분리]: 영업부서는 모델 규격 요구만 의뢰하며, 특정 자산번호 강제 지정 절대 금지',
      '헌장 1.2 [이벤트 기록 무누락 DB 저장]: 요청 발행 일시, 영업담당자, 고객/현장 속성 100% 영구 보존',
      '헌장 3.5 [Gutenberg Z-Pattern]: 좌상단 텍스트 파싱 ➔ 중앙 5단계 서식 ➔ 우측 실시간 검증 ➔ 우하단 출고 요청 최종 발행'
    ],
    precautions: [
      '현장 상세주소 및 현장 인수자(성명/휴대폰) 미입력 시 출고 요청 발행이 시스템에 의해 자동 방어 차단됩니다.',
      '신규 고객사의 경우 영업사원이 출고 요청을 발행한 후 관리부의 사업자등록 검증이 완료되어야 배차가 진행됩니다.',
      '현장 진입로 협소(5톤 축차 불가 등) 시 배차 및 특이사항 메모에 반드시 기재해야 합니다.'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="dispatch4-paste-zone"]',
        type: 'callout',
        label: '카톡/문자 텍스트 파싱',
        description: '카톡, 문자, 메일로 접수된 자연어 요청 원문을 붙여넣으면 고객사, 현장, 장비, 날짜를 AI/정규식으로 자동 추출하여 폼에 즉시 채워줍니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="dispatch4-context-types"]',
        type: 'stamp',
        label: '업무 유형 선택',
        description: '신규고객 출고, 기존현장 추가출고, 교체(대차) 중 해당하는 비즈니스 맥락을 선택합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="dispatch4-block-customer"]',
        type: 'stamp',
        label: '1. 거래처 (고객사)',
        description: '출고 대상 거래처(고객사)를 검색 선택하거나, 신규 고객사 정보를 직접 입력합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="dispatch4-block-site"]',
        type: 'stamp',
        label: '2. 투입 현장 및 담당자',
        description: '장비가 반입될 공사 현장과 현장 인수자(성명, 휴대전화)를 지정합니다. 배차 운송의 필수 기준이 됩니다.',
        badgeColor: '#0891B2',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="dispatch4-block-equipments"]',
        type: 'stamp',
        label: '3. 출고 장비 규격',
        description: '현장 요구에 맞는 작업 높이/모델 규격과 수량을 지정합니다. 헌장 2.1에 따라 영업은 개별 자산번호가 아닌 모델 규격으로만 의뢰합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="dispatch4-block-schedule"]',
        type: 'stamp',
        label: '4. 출고 및 하차 일정',
        description: '상차 희망일시(ASAP, 오전, 오후, 지정시간) 및 현장 도착일정을 설정합니다. 다수 장비의 경우 시차 출고 메모를 남길 수 있습니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="dispatch4-validation-shield"]',
        type: 'callout',
        label: '필수 정보 검증 & 방어 차단',
        description: '고객사, 현장주소, 인수자, 장비, 일정 등 9대 필수 항목을 실시간 검증하며, 정보 누락 시 출고 요청 발행을 자동 차단하여 불완전 배차를 원천 방지합니다.',
        badgeColor: '#DC2626',
        positionHint: 'left',
        spotlight: true,
      },
      {
        seq: 8,
        selector: '[data-mid="dispatch4-btn-submit"]',
        type: 'click_ripple',
        label: '출고 요청 최종 발행',
        description: '9대 필수 검증을 100% 통과하면 최종 발행 버튼이 활성화되며, 클릭 즉시 배차/출고 부서의 대기열로 공식 출고 의뢰가 전송됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'smart_return',
    version: 4,
    menuName: '회수 요청',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업부',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '현장 공사 완료 또는 임대 만료에 따라 현장에 투입된 장비의 회수(반납) 의뢰를 배차 부서에 정식 발행',
    scopeInfo: '대여 중인 계약, 회수 대상 자산번호, 반출 희망 일시, 현장 상차지 주소 및 상차 가능 여건',
    cognitiveSequence: [
      '1. 반납 요청 텍스트(카톡/문자) 자동 파싱 및 계약 매핑',
      '2. 반납 대상 현장 및 투입 자산 일련번호 확인',
      '3. 반납 희망 일시 및 현장 상차 환경(지게차/크레인 유무) 입력',
      '4. 장비 파손/오염 여부 1차 문진 및 현장 사진 첨부',
      '5. 회수 배차 운송비 부담 주체 설정 (고객부담 / 당사부담 / 원사부담)',
      '6. 입고 검수 및 정비부서 반납 입고 예고 자동 통보',
      '7. 반납 요청 최종 발행 및 단일 회수 배차 의뢰 연동 (헌장 2.3)'
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
        selector: '[data-mid="return-paste-zone"], .return-paste-area',
        type: 'callout',
        label: '반납 텍스트 파싱',
        description: '카톡/문자로 수신된 반납 요청을 붙여넣어 계약과 현장을 자동 매핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="return-asset-select"], .asset-select-grid',
        type: 'stamp',
        label: '회수 대상 자산 확인',
        description: '해당 현장에 투입되어 있는 대여중 자산번호와 모델을 선택합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="return-schedule-input"], .schedule-box',
        type: 'stamp',
        label: '반납 일시 및 상차 환경',
        description: '회수 희망 일시와 현장 지게차 유무, 진입로 높이 제한을 기재합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="return-damage-check"], .damage-survey',
        type: 'highlight',
        label: '파손/오염 1차 문진',
        description: '도색 오염, 레버 파손 등 특이사항을 사전 확인하고 사진을 등록합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="return-freight-payer"], .freight-payer-select',
        type: 'stamp',
        label: '운송비 귀속선 지정',
        description: '회수 운송비 부담 주체(고객사, 당사, 원사)를 명확히 판정합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="return-preview-dossier"], .preview-box',
        type: 'highlight',
        label: '입고 예고 통보서',
        description: '주기장 입고 검수 및 정비 부서로 전송될 사전 예고서를 검토합니다.',
        badgeColor: '#2563EB',
        positionHint: 'left',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-submit-return"], button.btn-submit-return',
        type: 'click_ripple',
        label: '반납 요청 최종 발행',
        description: '반납 요청을 공식 발행하고 배차부서로 회수 배차 의뢰를 전송합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'smart_as_request',
    version: 4,
    menuName: 'AS 요청',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업부 / 고객센터',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '현장 가동 중 고장, 이상 경보, 파손 발생 시 긴급 AS 출동 및 정비 조치 의뢰 발행 (필요 시 즉시 대차 교체 연계)',
    scopeInfo: '고객사, 현장 주소, 고장 자산번호, 고장 증상(상승불가, 주행불능, 에러코드), 현장 사진 증빙',
    cognitiveSequence: [
      '1. 긴급 A/S 요청 자연어 접수 및 계약/현장 자동 조회',
      '2. 고장 장비 자산번호 및 에러 코드(리프트 미작동, 유압 누유 등) 식별',
      '3. 고장 증상 유형 분류 (긴급 출동 vs 유선 조치 vs 대차 교체 판정)',
      '4. 현장 비대면/대면 담당자 연락처 및 작업 층수/진입로 확인',
      '5. A/S 출동 엔지니어 지정 및 긴급 출동 지시서 발행',
      '6. 현장 수리 불가 판정 시 [EXCHANGE 대차 교체 요구] 원클릭 즉시 전환 (헌장 2.1)',
      '7. A/S 접수 티켓 확정 및 정비 이력 DB 무누락 기록 (헌장 1.2)'
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
        selector: '[data-mid="as-paste-zone"], .as-paste-area',
        type: 'callout',
        label: 'AS 접수 텍스트 파싱',
        description: '현장 반장님의 고장 문자/카톡을 붙여넣어 계약 현장을 자동 탐색합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '[data-mid="as-asset-picker"], .as-asset-selector',
        type: 'stamp',
        label: '고장 자산 및 에러코드',
        description: '현장 투입 장비 중 고장 발생 자산과 계기판 에러코드를 매핑합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="as-severity-radios"], .severity-options',
        type: 'stamp',
        label: '증상 유형 및 긴급도',
        description: '상승 불가, 주행 불가, 배터리 방전 등 긴급도를 선택합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="as-site-contact"], .site-contact-inputs',
        type: 'highlight',
        label: '현장 위치 및 작업 층수',
        description: '장비가 위치한 층수(지하/지상), 진입 경로 및 현장 담당자를 확인합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="as-engineer-assign"], .engineer-picker',
        type: 'stamp',
        label: '출동 엔지니어 지정',
        description: '현장 권역 전담 정비 엔지니어와 출동 차량을 배정합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-convert-exchange"], button:contains("대차 전환")',
        type: 'callout',
        label: '대차 교체 즉시 전환',
        description: '현장 수리 불가 시 EXCHANGE 단일 대차 요구로 원클릭 전환합니다.',
        badgeColor: '#E53935',
        positionHint: 'left',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-submit-as"], button.btn-submit-as',
        type: 'click_ripple',
        label: 'AS 지시서 최종 발행',
        description: 'AS 접수 티켓을 확정하고 엔지니어 모바일로 출동 지령을 전달합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'delinquency',
    version: 4,
    menuName: '미수 채권 연체 관리',
    groupId: 'grp_sales',
    groupName: '영업관리',
    department: '영업/재무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '30일/60일/90일 이상 장기 연체 채권 집중 모니터링, 신용 거래 제한(출고 정지), 최고장 발송 및 법적 조치 단계 관리',
    scopeInfo: '연체 일수 기준, 거래처별 누적 연체금, 담보 여부, 현장 가동 장비 목록',
    cognitiveSequence: [
      '1. 연체 기간별 채권 분류 스코핑 (30일/60일/90일 이상 연체)',
      '2. 거래처별 연체 원금, 연체 이자, 누적 회수율 실시간 산출',
      '3. 고객사 대표 및 현장소장 실시간 유선 독촉 및 면담 이력 기록',
      '4. 현장 투입 장비 점유 가압류 또는 가동 정지(시동 차단) 경고 발송',
      '5. 1차 독촉장 및 내용증명 법적 최고장 PDF 원클릭 생성 및 발송',
      '6. 회수 불가 악성 채권 대손 처리 및 연체 탕감 전자결재 상신',
      '7. 연체 채권 관리 대장 마감 및 법적 회수 절차 이관 확정'
    ],
        subTabs: [
          {
                "tabId": "OVERDUE_30",
                "tabName": "30일 이상 경과",
                "purpose": "초기 연체 거래처에 대한 1차 독촉 및 상환 약정 체결",
                "keyActions": [
                      "독촉 알림톡 발송",
                      "분납 약정 등록"
                ]
          },
          {
                "tabId": "OVERDUE_60",
                "tabName": "60일 이상 경과",
                "purpose": "중기 연체 거래처 대상 신규 출고 정지 및 최고장 발송",
                "keyActions": [
                      "출고 제한 설정",
                      "최고장 발송"
                ]
          },
          {
                "tabId": "OVERDUE_90",
                "tabName": "90일 이상 악성",
                "purpose": "장기 악성 연체 건의 현장 장비 강제 회수 및 법적 조치 이행",
                "keyActions": [
                      "강제 회수 배차 의뢰",
                      "법적 절차 이관"
                ]
          }
    ],
    modalWorkflows: [
          {
                "modalName": "독촉장 및 최고장 발송 팝업 (Delinquency Notice Modal)",
                "triggerButton": "[독촉장 발송] 또는 [최고장 발송]",
                "keyFields": [
                      "수신 거래처 및 대표자",
                      "연체 청구서 목록 및 연체 이자",
                      "납부 기한 지정",
                      "내용증명 양식 선택"
                ],
                "terminalAction": "[전자 문서 발송]",
                "afterStateTransition": "독촉 발송 이력 저장, 거래처 신용 등급 강등 처리"
          }
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
        selector: '[data-mid="delinquency-aging-filter"], .aging-tabs',
        type: 'stamp',
        label: '연체 기간 스코프',
        description: '30일, 60일, 90일 이상 장기 연체 채권 구간을 필터링합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="delinquency-summary-grid"], table.delinquency-table',
        type: 'highlight',
        label: '연체 원금 및 이자',
        description: '거래처별 연체 원금, 지연 이자, 미회수 잔액을 정밀 조망합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="delinquency-call-log"], .call-log-section',
        type: 'stamp',
        label: '독촉 및 면담 이력',
        description: '대표자 통화 내역, 약속 입금일, 현장 방문 결과를 기록합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="btn-lock-equipment"], button:contains("가동 정지")',
        type: 'callout',
        label: '장비 가동 정지 경고',
        description: '미납 지속 시 현장 장비 시동 차단 및 강제 회수 경고를 발송합니다.',
        badgeColor: '#E53935',
        positionHint: 'left',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-legal-notice"], button:contains("최고장 발행")',
        type: 'click_ripple',
        label: '법적 최고장 PDF 생성',
        description: '우체국 내용증명 발송용 법적 채무 변제 최고장을 즉시 출력합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-debt-relief-request"], button:contains("탕감 결재")',
        type: 'callout',
        label: '연체 탕감 결재 상신',
        description: '원금 일부 회수 후 잔여 이자 탕감 시 전자결재 승인을 상신합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-close-delinquency"], button.btn-close-case',
        type: 'click_ripple',
        label: '채권 마감 및 법적 이관',
        description: '채권 관리 상태를 갱신하고 법률 대리인 이관 또는 종결 처리합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },

  // ─── 3. 제품 / 자산관리 (grp_product_asset) ────────────────
  {
    menuId: 'product',
    version: 4,
    menuName: '제품 관리',
    groupId: 'grp_product_asset',
    groupName: '제품 / 자산관리',
    department: '자산/품질관리팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '고소작업대 표준 모델 카탈로그(제조사, 모델명, 작업높이, 적재중량, 전폭, 차체중량, 배터리사양) 및 표준 렌탈 요율 마스터 관리',
    scopeInfo: '제조사(스카이잭, 지니, 딩리, 시노붐 등), 모델 규격, 플랫폼 확장 제원, 전력 사양',
    cognitiveSequence: [
      '1. 장비 분류 스코핑 (시저형, 굴절형, 직진형, 궤도형 고소작업대)',
      '2. 신규 모델명, 제조사, 플랫폼 최대 작업 높이 제원 입력',
      '3. 정격 하중(수용 인원 및 공구 중량), 자체 중량, 등판각도 스펙 검증',
      '4. 표준 월 렌탈료 단가표 및 일할 단가 기준 등록',
      '5. 정기 안전인증(KCs) 및 비파괴 검사 기준 주기 설정',
      '6. 권장 정비 부품 및 필수 소모품(배터리, 모터, 오일) BOM 매핑',
      '7. 장비 모델 마스터 최종 승인 및 렌탈 자산 등록 가용화'
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
        selector: '[data-mid="product-type-filter"], .type-filter-bar',
        type: 'stamp',
        label: '장비 기종 분류',
        description: '시저형, 굴절형, 직진형 등 장비 메커니즘별로 목록을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="product-model-input"], .model-input-group',
        type: 'stamp',
        label: '모델명 및 작업 높이',
        description: '제조사와 모델명, 최대 플랫폼 작업 가능 높이(m)를 등록합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="product-specs-card"], .specs-card',
        type: 'highlight',
        label: '적재 하중 및 자체 중량',
        description: '정격 적재 하중(kg), 탑승 인원, 장비 자체 중량 제원을 검증합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="product-pricing-card"], .pricing-card',
        type: 'stamp',
        label: '표준 렌탈 단가표',
        description: '표준 월 렌탈 단가와 일할 계산 단가 기준을 입력합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="product-safety-cert"], .safety-cert-box',
        type: 'stamp',
        label: '법정 안전인증 기준',
        description: '안전보건공단 안전인증(KCs) 및 비파괴 검사 만료 주기를 설정합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="product-bom-mapping"], .bom-box',
        type: 'callout',
        label: '소모품 BOM 매핑',
        description: '해당 기종에 투입되는 정품 배터리 규격과 유압 부품을 연결합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'left',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-save-product"], button:contains("모델 저장")',
        type: 'click_ripple',
        label: '모델 마스터 확정',
        description: '모델 제원을 최종 저장하고 실물 자산 취득 및 계약에 가용화합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'asset',
    version: 5,
    menuName: '자산 관리 (대장)',
    groupId: 'grp_product_asset',
    groupName: '제품 / 자산관리',
    department: '자산/주기장팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '당사 보유 및 관리 중인 모든 개별 자산의 라이프사이클(AVAILABLE/RENTED/REPAIRING 등) 상태, 장비 일련번호, 바코드, 누적 매출 기여액 추적 관리 (헌장 1.2 핵심가치 1)',
    scopeInfo: '자산번호(Barcode), 제품 모델, 시리얼 넘버, 소유 구분(당사 자산/외부 임차), 현재 상태, 현재 위치(주기장/고객현장)',
    cognitiveSequence: [
      '1. 자산 통합 검색 및 상태/소유구분/제조사 필터링 스코핑',
      '2. 자산 운용 실시간 KPI 지표 검토 (임대가능, 현장대여중, 출고검수대기, 수리정비중, 실가동률)',
      '3. 고밀도 전사 자산 대장 그리드 1:1 대사 (관리번호, 모델, 규격, 소유, 거래처, 누적기여액)',
      '4. 개별 자산 상세 도시에 조회 및 수정 ([보기] 클릭: 제원, 계약, 이력, 정비점수)',
      '5. 하단 전사 자산 회계 대차대조식 무결성 검증 (등록자산 = 가동 + 대기, 장부가 총액)',
      '6. 자산 대장 엑셀 내보내기 및 데이터 백업',
      '7. 자산 신규 취득 및 매각 처리 연동'
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
        selector: '[data-mid="asset-filter-bar"], .asset-filter-bar',
        type: 'stamp',
        label: '자산 통합 검색 및 필터',
        description: '관리번호, 모델명, 제조사 검색 및 소유구분(당사/임차), 장비 상태별로 자산을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="asset-kpi-summary"], .asset-kpi-cards',
        type: 'highlight',
        label: '자산 운용 지표 요약',
        description: '임대 가능(주기장), 현장 대여중, 출고/검수 대기, 수리/정비중 자산 대수와 실가동률을 실시간 점검합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="asset-table-container"], .asset-table-container',
        type: 'highlight',
        label: '전사 자산 대장 그리드',
        description: '관리번호, 모델, 규격, 소유구분, 현재 고객사/현장, 누적 렌탈수익, 감가누계액 및 장부가액을 1:1 대사합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="asset-detail-action"], button:contains("보기")',
        type: 'click_ripple',
        label: '자산 상세 도시에 보기',
        description: '[보기]를 클릭하여 장비 제원, 계약 정보, 누적 입출고/정비 라이프사이클 이력을 확인하고 정보를 수정합니다.',
        badgeColor: '#D97706',
        positionHint: 'right',
        spotlight: true,
      },
      {
        seq: 5,
        selector: '[data-mid="asset-balance-bar"], .asset-balance-bar',
        type: 'stamp',
        label: '전사 자산 대차대조 검증',
        description: '전사 등록자산 = 당사자산 + 임차자산, 실가동률 및 당사자산 장부가 총액의 회계적 일치를 검증합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-asset-export"], button:contains("엑셀 다운로드")',
        type: 'callout',
        label: '자산 대장 엑셀 내보내기',
        description: '전사 자산 목록 및 상세 제원, 가동 현황 전체를 엑셀 파일로 다운로드합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-new-asset"], button:contains("자산 취득")',
        type: 'click_ripple',
        label: '자산 신규 취득 / 매각',
        description: '신규 장비 도입 및 노후 장비 매각 등록 화면으로 전환하여 자산 마스터를 갱신합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'acquisition_disposal',
    version: 4,
    menuName: '당사자산 취득 / 매각',
    groupId: 'grp_product_asset',
    groupName: '제품 / 자산관리',
    department: '자산/재무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '신규 고소작업대 도입 시 취득원가/취득일 등록 및 노후 장비 매각/폐기 프로세스를 회계적/물리적으로 확정 처리',
    scopeInfo: '취득일, 취득가액, 구입처, 모델명, 제조년월, 매각일, 매각처, 매각가액, 처분손익',
    cognitiveSequence: [
      '1. 취득/매각/폐기 구분 탭 및 처리 대상 자산 스코핑',
      '2. 신규 자산 취득 정보 입력 (구입처, 취득가액, 취득일자, 제조연월)',
      '3. 취득 자산 검수 및 시리얼·바코드 자산 라벨 출력 큐 전송',
      '4. 노후/전손 장비 매각 및 폐기 사유 평가 (수리비 과다, 연식 초과)',
      '5. 매각 대금 정산 및 세금계산서 발행, 감가상각 잔존가액 상계',
      '6. 자산 매각/폐기 전자결재 상신 (헌장 필수 결재선 연동)',
      '7. 자산 원장 영구 제각 처리 및 취득/처분 이력 DB 확정 보존'
    ],
        subTabs: [
          {
                "tabId": "ACQUISITION",
                "tabName": "자산 취득 원장",
                "purpose": "신규 고소작업대 매입 계약, 취득가액, 제조번호(시리얼), 도입 검수 관리",
                "keyActions": [
                      "신규 자산 취득 등록",
                      "자산 바코드 발급",
                      "초기 검수"
                ]
          },
          {
                "tabId": "DISPOSAL",
                "tabName": "자산 매각/폐기 원장",
                "purpose": "노후화 또는 파손 장비의 매각처, 매각 대금 정산 및 폐기 말소 승인",
                "keyActions": [
                      "매각/폐기 기안",
                      "매각 대금 수납",
                      "자산 상태 DISPOSED 마감"
                ]
          }
    ],
    modalWorkflows: [
          {
                "modalName": "신규 자산 취득 등록 팝업 (Asset Acquisition Modal)",
                "triggerButton": "[신규 자산 취득 등록]",
                "keyFields": [
                      "제조사 및 모델명",
                      "장비 제조번호(시리얼)",
                      "취득일자 및 취득가액",
                      "구입처(공급업체)",
                      "초기 검수 상태"
                ],
                "terminalAction": "[취득 등록 확정]",
                "afterStateTransition": "자산 마스터(assets)에 AVAILABLE(임대가능) 상태로 신규 등록, QR 라벨 인쇄 큐 전송"
          }
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
        selector: '[data-mid="acq-disp-tabs"], .acq-disp-tab-bar',
        type: 'stamp',
        label: '취득/처분 탭 스코프',
        description: '신규 취득, 매각 처분, 폐기 제각 탭을 선택하여 작업 대상을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="acq-info-form"], .acquisition-fields',
        type: 'highlight',
        label: '취득 제원 및 매입가',
        description: '제조사, 모델, 구입처, 취득원가, 차대번호를 정확히 기재합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-print-asset-label"], button:contains("라벨 출력")',
        type: 'click_ripple',
        label: '자산 라벨 출력 전송',
        description: '신규 자산 번호가 부여된 QR/바코드 실물 라벨을 출력 큐로 보냅니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 4,
        selector: '[data-mid="disp-reason-select"], .disposal-reason-box',
        type: 'stamp',
        label: '처분 사유 및 감정',
        description: '연식 초과 노후화, 전손 사고, 수리비 과다 등 처분 사유를 입력합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="disp-settlement-math"], .settlement-math-box',
        type: 'highlight',
        label: '매각 금액 및 장부가 상계',
        description: '매각 금액에서 감가상각 잔존 장부가를 차감하여 처분손익을 산출합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-disp-approval"], button:contains("결재 상신")',
        type: 'callout',
        label: '처분 전자결재 상신',
        description: '자산 매각 또는 폐기 승인을 위한 내부 결재를 공식 기안합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-finalize-disposal"], button.btn-finalize',
        type: 'click_ripple',
        label: '제각 및 원장 마감',
        description: '자산 원장에서 영구 제각 처리하고 취득·처분 이력을 확정합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'rent_asset',
    version: 4,
    menuName: '임차 장비 관리',
    groupId: 'grp_product_asset',
    groupName: '제품 / 자산관리',
    department: '자산/구매팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '당사 보유 자산 부족 시 외부 타사(원사)로부터 임차(전대)해온 장비의 계약 조건, 원가 정산, 가동 현황 관리 (헌장 2.1)',
    scopeInfo: '임차 공급처(원사), 외부 장비번호, 임차 시작/종료일, 월 임차료 원가, 당사 현장 재임대 매핑 정보',
    cognitiveSequence: [
      '1. 외부 임차 장비 계약 목록 및 원사(임대처)별 스코핑',
      '2. 당사 자산 부족 시 외부 장비 신규 임차 등록 (원사, 모델, 임차 단가)',
      '3. 임차 장비의 당사 고객사 현장 재임대(전대) 계약 매핑',
      '4. 원사 지급 임차료 vs 고객사 수취 렌탈료 간 마진율 및 수지 분석 (헌장 5.5)',
      '5. 원사 반납 예정일 및 계약 연장 여부 알림 관리',
      '6. 원사 정기 임차료 지출결의 및 매입 세금계산서 대사',
      '7. 외부 임차 장비 현장 반납 및 원사 반납 확인서 종결 확정'
    ],
        subTabs: [
          {
                "tabId": "CURRENT",
                "tabName": "임차 장비 현황",
                "purpose": "외부 타사에서 임차하여 고객사 현장에 투입(전대) 중인 장비 목록 조망",
                "keyActions": [
                      "신규 타사 임차 등록",
                      "임차 계약 조건 확인",
                      "반납 요청"
                ]
          },
          {
                "tabId": "NEGOTIATION",
                "tabName": "원사 단가 협의",
                "purpose": "원소유주(원사)와의 월 임차료 단가 협의 및 연장 조건 관리",
                "keyActions": [
                      "단가 변경 기안",
                      "협의 이력 관리"
                ]
          },
          {
                "tabId": "PROFIT_LEDGER",
                "tabName": "전대 손익 대장",
                "purpose": "고객사 수취 렌탈료 vs 원사 지급 임차료 간 마진율 및 일할 손익 분석",
                "keyActions": [
                      "자산별 순마진 확인",
                      "적자 임차 장비 색출"
                ]
          },
          {
                "tabId": "RECONCILIATION",
                "tabName": "월말 임차료 정산 대사",
                "purpose": "원사가 청구한 월간 세금계산서와 당사 전대 가동일수 간 1:1 대사",
                "keyActions": [
                      "청구액 검증",
                      "지급 승인"
                ]
          }
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
        selector: '[data-mid="rent-asset-filter"], .rent-asset-filters',
        type: 'stamp',
        label: '임차처(원사) 필터',
        description: '외부 타사 임대업체별로 임차 장비 목록과 계약을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-new-rent-asset"], button:contains("신규 임차")',
        type: 'click_ripple',
        label: '외부 장비 임차 등록',
        description: '자사 자산 부족 시 외부 장비의 모델, 일련번호, 임차 단가를 등록합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="sublease-contract-picker"], .contract-picker',
        type: 'highlight',
        label: '전대 계약 1:1 매핑',
        description: '임차 장비가 투입되는 당사 고객사 렌탈 계약을 바인딩합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="margin-analysis-box"], .margin-box',
        type: 'callout',
        label: '임차 마진 및 수지 분석',
        description: '수취 렌탈료 - 지급 임차료 = 전대 순마진율을 실시간 검증합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="rent-expiry-alarm"], .expiry-badge',
        type: 'stamp',
        label: '원사 만료일자 알림',
        description: '원사 계약 만료일 전에 현장 연장 여부를 확인하여 연체료를 방지합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-rent-payment"], button:contains("임차료 지급")',
        type: 'click_ripple',
        label: '임차료 지출결의',
        description: '원사 매입 세금계산서와 대사 후 임차료 지급 결재를 상신합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-return-to-vendor"], button.btn-return-vendor',
        type: 'click_ripple',
        label: '원사 반납 최종 종결',
        description: '고객사 현장에서 원사로 직반납 또는 주기장 입고 후 반납을 확정합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },

  // ─── 4. 배차 / 운송관리 (grp_logistics) ────────────────────
  {
    menuId: 'delivery',
    version: 5,
    menuName: '배차 / 운송 관리',
    groupId: 'grp_logistics',
    groupName: '배차 / 운송관리',
    department: '배차/물류팀',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '출고/회수/EXCHANGE 단일 배차 의뢰(헌장 2.3)에 대한 차량/기사 배정, 6대 신규 셀프 차종 매핑, 단가/일정 수정, 취소건 복원 및 월말 운송료 1:1 대사 완결 (헌장 3.6 탭별 이원화)',
    scopeInfo: '배차 의뢰 목록(출고/회수/교환), 운송 거래처 마스터, 기사 연락처, 배차 차종(1.2T~8.5T 셀프 등), 운송료 단가, 상하차 일시',
    cognitiveSequence: [
      '1. 배차 운송일 및 신청일 기간 조회 필터링 (기본 오늘부터 7일간 스코핑)',
      '2. 4단계 배차 진행 상태별 필터 탭 (전체, 배차 전, 배차 완료, 출발/하차 완료)',
      '3. 좌측 배차 의뢰서 카드 목록 탐색 (고객사, 상하차 주소, 출고 제원, 현장 날씨)',
      '4. 우측 배차 운송 기사 배정 및 세부 설정 스튜디오 (운송사, 기사, 차종, 운송비 확정)',
      '5. 배차/입출고 요청서 현장 원격 인쇄 및 직접 출력 (현장 라우팅 인쇄 지원)',
      '6. 배차 내역 엑셀 다운로드 및 일괄 등록',
      '7. 신규 수동 배차 생성 및 예외 배차 등록 ([+ 수동 배차 생성])'
    ],
        subTabs: [
          {
                "tabId": "DISPATCH",
                "tabName": "배차 지시 및 기사 배정",
                "purpose": "출고, 입고, 교환(EXCHANGE) 배차 요청 접수 및 운송 기사/차량 배정 처리 (유형 A 카드 도시에)",
                "keyActions": [
                      "배차 카드 검토",
                      "기사 배정",
                      "배차 정보 수정",
                      "배차 취소/재배정"
                ]
          },
          {
                "tabId": "NEGOTIATION",
                "tabName": "운임 협의 및 조율",
                "purpose": "원거리, 특수 차량, 야간 배차 시 운송사와의 운임 단가 협의 내역 관리",
                "keyActions": [
                      "운임 견적 비교",
                      "협의 운임 승인 요청"
                ]
          },
          {
                "tabId": "RECONCILIATION",
                "tabName": "월말 운송료 대사 대장",
                "purpose": "운송사가 청구한 월간 세금계산서와 당사 배차 완료 실적 간 1:1 대사 및 차액 승인 (유형 B 그리드)",
                "keyActions": [
                      "운송사 엑셀 업로드",
                      "1:1 차액 분석",
                      "차액 사유 승인",
                      "통합 지급 요청"
                ]
          }
    ],
    modalWorkflows: [
          {
                "modalName": "배차 수정 및 재배정 스튜디오 (Dispatch Edit Modal)",
                "triggerButton": "배차 카드 행의 [수정] 버튼",
                "keyFields": [
                      "운송거래처(협력 운송사) 변경",
                      "운송기사명 및 연락처",
                      "차종/톤수(1.2T 셀프, 3.5T 셀프, 4T 셀프, 5T 셀프, 5T장축 셀프, 8.5T 셀프)",
                      "상하차 일정/시각",
                      "편도/왕복 운송료 단가",
                      "배차 상태(취소된 건도 재배정/정상화 가능)"
                ],
                "terminalAction": "[배차 정보 저장]",
                "afterStateTransition": "배차 레코드 실시간 동기화, 취소 건 재활성화, 월말 운송료 대사 원장 자동 갱신"
          },
          {
                "modalName": "월말 운송료 대사 차액 승인 팝업 (Delivery Reconciliation Modal)",
                "triggerButton": "대사 그리드 행의 [차액 승인]",
                "keyFields": [
                      "청구 운임 vs 시스템 운임 비교",
                      "차액 발생 원인(대기료, 고속도로 통행료, 야간 할증 등)",
                      "증빙 영수증 확인"
                ],
                "terminalAction": "[차액 승인 확정]",
                "afterStateTransition": "해당 배차 건 확정액(Approved Amount) 반영, 대차대조 차액 ₩0 달성"
          }
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
        selector: '[data-mid="dispatch-date-filter"], .date-filter-group',
        type: 'stamp',
        label: '배차 운송일/신청일 기간 조회',
        description: '운송일자 및 신청일자 기준 기간(기본 오늘부터 7일간)을 스코핑하여 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="dispatch-status-tabs"], .dispatch-status-tabs',
        type: 'highlight',
        label: '배차 진행 상태별 탭',
        description: '전체, 배차 전(대기), 배차 완료, 출발 완료, 하차 완료 상태별로 필터링합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="dispatch-dossier-card"], .dossier-card',
        type: 'stamp',
        label: '배차 의뢰 목록 카드',
        description: '고객사, 상하차지 주소, 현장 담당자, 출고 제원 및 하차지 실시간 날씨를 확인합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="dispatch-assign-studio"], .assign-studio',
        type: 'highlight',
        label: '기사 배정 및 상하차 세부 설정',
        description: '협력 운송사 및 차량 기사를 배정하고, 셀프 차종 및 편도/왕복 운송비를 설정하여 확정합니다.',
        badgeColor: '#D97706',
        positionHint: 'left',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-dispatch-print"], button:contains("요청서 인쇄")',
        type: 'click_ripple',
        label: '배차 요청서 현장 출력',
        description: '현장 프린터(출고: 프린터1, 입고: 프린터2)로 자동 원격 출력하거나 브라우저에서 직접 인쇄합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-dispatch-export"], button:contains("배차 엑셀")',
        type: 'callout',
        label: '배차 엑셀 내보내기/일괄 등록',
        description: '배차 대장 전체 내역을 엑셀로 내보내거나 대량 배차 건을 엑셀 서식으로 일괄 등록합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-new-dispatch"], button:contains("수동 배차 생성")',
        type: 'click_ripple',
        label: '수동 배차 생성 등록',
        description: '계약 외 긴급 이동이나 특수 운송건에 대해 수동 배차 의뢰를 생성 등록합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'transport_master',
    version: 4,
    menuName: '운송 거래처 관리',
    groupId: 'grp_logistics',
    groupName: '배차 / 운송관리',
    department: '배차/물류팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '외주 운송사 및 지입/직속 화물 기사 마스터, 보유 차종(1.2T~8.5T 셀프), 계좌 정보, 구간별 표준 운송 요율표 관리',
    scopeInfo: '운송사 상호, 사업자번호, 기사 성명, 연락처, 차량 번호, 차종/톤수, 지급 계좌',
    cognitiveSequence: [
      '1. 협력 운송사 및 지입/직영 기사 목록 스코핑',
      '2. 신규 운송사 사업자등록증 및 화물운송사업 허가증 검증',
      '3. 운송 기사 인적사항, 차량 톤수(5톤/11톤/셀프로더), 차종 등록',
      '4. 권역별(시/도/군) 표준 운송료 단가표 및 왕복 탁송 할인율 등록',
      '5. 운송 기사 통장 사본 등록 및 운송료 지급 계좌 유효성 검증',
      '6. 배차 수행 실적 및 현장 안전 준수 평점 이력 관리',
      '7. 운송사 및 기사 마스터 최종 승인 및 배차 배정 가용화'
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
        selector: '[data-mid="carrier-filter"], .carrier-filter-bar',
        type: 'stamp',
        label: '운송사 목록 스코프',
        description: '등록된 협력 운송사와 소속 기사 명부를 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-new-carrier"], button:contains("신규 운송사")',
        type: 'click_ripple',
        label: '운송사 등록 및 허가증',
        description: '화물자동차 운송사업 허가증 및 사업자등록증을 검증하고 등록합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="driver-vehicle-form"], .driver-form',
        type: 'highlight',
        label: '기사 및 차량 제원',
        description: '기사 성명, 연락처, 차량 적재 톤수와 셀프로더 여부를 등록합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="rate-table-editor"], .rate-table',
        type: 'stamp',
        label: '권역별 표준 단가표',
        description: '지역별 편도/왕복 표준 운송료와 야간/주말 할증 기준을 설정합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="bank-account-box"], .bank-fields',
        type: 'callout',
        label: '지급 계좌 유효성',
        description: '운송료가 정산 지급될 기사 명의 통장 사본을 확인합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="driver-rating-card"], .rating-badge',
        type: 'stamp',
        label: '배차 수행 실적 및 평점',
        description: '월별 배차 수행 건수와 현장 안전 수칙 준수 평가를 모니터링합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-save-carrier"], button:contains("저장")',
        type: 'click_ripple',
        label: '운송 마스터 승인 확정',
        description: '운송사 및 기사 정보를 확정하여 배차 작업대에서 즉시 호출 가능하도록 활성화합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },

  // ─── 5. 입출고관리 (grp_inout) ────────────────────────────
  {
    menuId: 'asset_inout_history',
    version: 4,
    menuName: '자산 입출고',
    groupId: 'grp_inout',
    groupName: '입출고관리',
    department: '주기장팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '주기장 게이트를 통과하는 모든 장비의 물리적 입출고 시간, 운송차량, 상하차 기사, 작업자 기록을 무누락 시계열 DB 보존 (헌장 1.2 핵심가치 2)',
    scopeInfo: '게이트 통과 일시, 입출고 구분(IN/OUT), 자산번호, 운송 차량번호, 담당 기사, 연계 계약/배차 번호',
    cognitiveSequence: [
      '1. 조회 기간 및 입출고 유형(출고, 반납, 대차교체, 주기장이동) 스코핑',
      '2. 자산 번호별 생애주기 입출고 타임라인 1:1 인과율 전수 검수 (헌장 5.6)',
      '3. 출고 검수 승인 시점의 RENTED 대여중 상태 전환 로그 확인 (헌장 1.3)',
      '4. 대차 교체(EXCHANGE) 시 전자산 회수 ➔ 후장비 승계 연결 관계 추적 (헌장 4.2)',
      '5. 운송 기사 및 배차 번호 매핑 검증',
      '6. 주기장 입고 시 반납 검수 판정(정상/파손/오염) 기록 확인',
      '7. 자산 입출고 감사 이력 무누락 보존 확정 및 엑셀 내보내기'
    ],
        subTabs: [
          {
                "tabId": "INBOUND_REGISTER",
                "tabName": "입고 등록 및 점검",
                "purpose": "현장 반납된 장비의 실물 도착 접수 및 초기 외관 점검",
                "keyActions": [
                      "반납 도착 등록",
                      "기본 점검표 작성",
                      "정비 대기 이관"
                ]
          },
          {
                "tabId": "INBOUND",
                "tabName": "입고 완료 원장",
                "purpose": "과거 입고된 모든 장비의 회수 일자, 운송 기사, 입고 상태 이력 조회",
                "keyActions": [
                      "입고증 출력",
                      "반납 이력 검색"
                ]
          },
          {
                "tabId": "OUTBOUND",
                "tabName": "출고 완료 원장",
                "purpose": "현장으로 출고된 모든 장비의 출고 검수 승인 및 반출 이력 조회",
                "keyActions": [
                      "출고증 출력",
                      "출고 시 사진 확인"
                ]
          }
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
        selector: '[data-mid="inout-period-filter"], .inout-filters',
        type: 'stamp',
        label: '입출고 기간 및 유형',
        description: '출고, 반납, 대차, 이동 이벤트 유형별로 기간을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="inout-timeline-view"], .timeline-container',
        type: 'highlight',
        label: '생애주기 타임라인',
        description: '자산의 출고부터 반납까지 시계열 인과율을 1:1 전수 검수합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="rented-state-log"], .state-badge-rented',
        type: 'callout',
        label: 'RENTED 상태 전환 로그',
        description: '배차가 아닌 출고 검수 승인 시점에 완결된 대여 전환을 확인합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="exchange-link-row"], .exchange-chain-row',
        type: 'highlight',
        label: 'EXCHANGE 1:1 연결 관계',
        description: '전자산 회수와 후장비 출고가 단일 체인으로 보존되었는지 검증합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="driver-match-cell"], .driver-cell',
        type: 'stamp',
        label: '운송 기사 및 배차 매핑',
        description: '실제 장비를 현장으로 이동시킨 배차 번호와 기사 정보를 확인합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="return-inspection-log"], .return-log',
        type: 'stamp',
        label: '입고 검수 판정 결과',
        description: '주기장 입고 시 작성된 파손 및 청소 점검 결과를 확인합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-export-inout"], button:contains("엑셀 내보내기")',
        type: 'click_ripple',
        label: '감사 이력 영구 확정',
        description: '입출고 원장 데이터를 검증하고 감사용 엑셀 보고서를 출력합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'dispatch_assign',
    version: 4,
    menuName: '장비 할당 / 매핑',
    groupId: 'grp_inout',
    groupName: '입출고관리',
    department: '출고/자산관리팀',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '영업부서의 출고 요청에 대해 주기장의 적격 가용 자산(AVAILABLE) 또는 외부 타사 임차 장비를 실제 실물 자산번호와 매핑하여 검수 대기열로 인계 (헌장 2.1)',
    scopeInfo: '미할당 출고 요청 목록, 요구 모델/사양, 주기장 내 임대가능(AVAILABLE) 자산 목록',
    cognitiveSequence: [
      '1. 미배정 배차 대기 큐 및 상차 임박 긴급도 스코핑',
      '2. 현장별 상하차 주소 및 고소작업대 적재 톤수/차종(셀프로더) 확인',
      '3. 주기장 근접 및 운행 가능한 협력 운송 기사 실시간 탐색',
      '4. 배차 유형(출고/회수/EXCHANGE 단일 교환) 확인 및 운송료 산정 (헌장 2.3)',
      '5. 운송 기사 배정 및 현장 작업지시서·기상 주의사항 모바일 전송',
      '6. 기사 상차 확인 및 배차 상태 배정 완료(ASSIGNED) 전환',
      '7. 당일 배차 배정 큐 100% 완결 확정'
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
        selector: '[data-mid="pending-dispatch-queue"], .pending-queue',
        type: 'stamp',
        label: '미배정 배차 대기 큐',
        description: '출고 의뢰가 접수된 미배정 건들을 상차 시각 순으로 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="dispatch-spec-check"], .spec-box',
        type: 'highlight',
        label: '상하차지 및 적재 사양',
        description: '현장 진입로 제약과 장비 중량에 적합한 운송 차량 규격을 검토합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="driver-search-tool"], .driver-search-modal',
        type: 'stamp',
        label: '운송 기사 탐색',
        description: '현재 주기장 인근에서 배차 대기 중인 협력 기사를 조회합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="single-exchange-check"], .exchange-indicator',
        type: 'callout',
        label: '단일 EXCHANGE 확인',
        description: '대차 건에 대해 왕복 1건의 교환 배차가 적용되었는지 확인합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-send-dispatch-push"], button:contains("기사 배정")',
        type: 'click_ripple',
        label: '기사 배정 및 지령 전송',
        description: '기사를 확정 배정하고 작업지시서와 현장 연락처를 모바일로 전송합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-confirm-loading"], button:contains("상차 확인")',
        type: 'stamp',
        label: '상차 및 출발 확인',
        description: '주기장 출고 검수 통과 장비가 차량에 상차되었음을 확인합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="dispatch-assign-complete"], .complete-banner',
        type: 'click_ripple',
        label: '배차 배정 큐 완결',
        description: '당일 출고 대상 배차 배정을 100% 완결하고 배차 대장으로 인계합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'outbound_inspections',
    version: 4,
    menuName: '출고 검수 관리',
    groupId: 'grp_inout',
    groupName: '입출고관리',
    department: '출고검수팀',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '현장 출고 직전 20대 법정 안전 옵션(과상승 방지, 리미트 센서, 비상하강) 및 배터리/유압 작동 전수 검수, 승인 마감 시 자산 상태 RENTED(대여중) 자동 전환 (헌장 1.3)',
    scopeInfo: '할당 완료된 출고 대기 장비, 출고 체크리스트 템플릿, 현장 요구 옵션 내역, 검수 사진',
    cognitiveSequence: [
      '1. 당일 출고 대기 자산 목록 및 상차 스케줄 스코핑',
      '2. 고소작업대 외관 점검 (도색, 볼팅, 타이어 마모, 누유 유무)',
      '3. 기능 및 안전장치 작동 테스트 (상승/하강, 주행, 비상정지, 과부하 경보)',
      '4. 배터리 완충 전압(25.4V 이상) 및 충전기 동작 상태 정밀 측정',
      '5. 현장 맞춤 안전옵션(협착방지대, 경광등, 안전벨트 걸이구) 볼팅 체결 확인',
      '6. 검수 체크리스트 전수 서명 및 출고 전 장비 전/후/좌/우 실물 사진 등록',
      '7. 최종 [출고 검수 승인] 실행 ➔ 자산 상태 즉시 RENTED 대여중 자동 전환 (헌장 1.3)'
    ],
        modalWorkflows: [
          {
                "modalName": "출고 검수 승인 팝업 (Outbound Inspection Modal)",
                "triggerButton": "출고 대기 자산 행의 [검수 승인]",
                "keyFields": [
                      "배터리 전압 및 충전 상태",
                      "유압 라인 누유 여부",
                      "상승/하강 리미트 센서 및 비상 정지 스위치",
                      "도색 및 외관 손상 여부",
                      "검수 실사 사진 등록"
                ],
                "terminalAction": "[최종 출고 승인 마감]",
                "afterStateTransition": "헌장 1.3에 따라 자산 상태가 즉시 RENTED(대여중)로 전환, 출고 검수증 PDF 자동 발행, 주기장 반출 허가"
          }
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
        selector: '[data-mid="outbound-ready-queue"], .ready-queue',
        type: 'stamp',
        label: '출고 대기 장비 큐',
        description: '당일 상차 예정인 출고 대기 고소작업대 목록을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="inspection-chassis-check"], .chassis-box',
        type: 'highlight',
        label: '외관 및 샤시 점검',
        description: '기체 균열, 볼트 풀림, 유압 누유, 타이어 파손 여부를 전수 검사합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="inspection-safety-devices"], .safety-devices-box',
        type: 'callout',
        label: '안전 장치 작동 시험',
        description: '상하강 리미트 스위치, 비상정지 버튼, 과부하 경보 센서를 테스트합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="inspection-battery-volt"], .battery-input',
        type: 'stamp',
        label: '배터리 전압 정밀 측정',
        description: '24V 배터리 완충 전압(최소 25.4V)과 충전기 정상 작동을 기록합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="inspection-safety-options"], .options-checklist',
        type: 'highlight',
        label: '현장 안전옵션 볼팅',
        description: '계약에서 요구된 협착방지대와 경광등이 견고히 장착되었는지 확인합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="inspection-photo-upload"], .photo-upload-area',
        type: 'stamp',
        label: '출고 실물 사진 첨부',
        description: '분쟁 방지를 위해 출고 직전 장비 사방 외관 실물 사진을 업로드합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-approve-outbound"], button:contains("출고 검수 승인")',
        type: 'click_ripple',
        label: '출고 승인 (RENTED 전환)',
        description: '검수를 승인하고 자산 상태를 즉시 대여중(RENTED)으로 전환합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'consumable_stock',
    version: 4,
    menuName: '주기장 소모품 재고',
    groupId: 'grp_inout',
    groupName: '입출고관리',
    department: '주기장/자재팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '주기장 정비 및 출고 시 소모되는 부품(배터리, 충전기, 작동유, 조이스틱, 타이어 등)의 실시간 수불 관리 및 적정 안전 재고 유지',
    scopeInfo: '부품 코드, 품명, 규격, 적정 재고량, 현재고량, 입고/출고 수불 내역, 보관 위치(창고/선반)',
    cognitiveSequence: [
      '1. 소모품 카테고리(배터리, 유압유, 전선, 조이스틱, 라벨지) 스코핑',
      '2. 품목별 안전 재고량 대비 현재 실재고 수량 모니터링',
      '3. 바코드/QR코드 라벨 서식 템플릿 선택 및 ZPL 코드 보정',
      '4. 인쇄 위치(X/Y 좌표 오프셋) 미세 조정 및 테스트 인쇄',
      '5. 실물 품목별 바코드 라벨 대량 출력 큐 전송',
      '6. 주기장 부품 보관 랙(Rack) 및 위치 번호(Bin) 매핑',
      '7. 소모품 실사 수량 확정 및 재고 원장 동기화'
    ],
        subTabs: [
          {
                "tabId": "STOCK",
                "tabName": "메인 창고 현재고",
                "purpose": "중앙 주기장 창고의 부품/소모품 규격별 현재고 및 적정 재고 모니터링",
                "keyActions": [
                      "안전재고 미달 품목 확인",
                      "재고 이동 기안",
                      "바코드/라벨 인쇄"
                ]
          },
          {
                "tabId": "VEHICLE_STOCK",
                "tabName": "서비스 차량 탑재 재고",
                "purpose": "현장 AS 출동 차량(1호차~5호차)에 상시 적재된 부품 재고 파악",
                "keyActions": [
                      "차량별 재고 실사",
                      "주기장 창고에서 차량으로 불출 이동"
                ]
          },
          {
                "tabId": "COLLECTED_PARTS",
                "tabName": "회수 부품 창고",
                "purpose": "현장 수리 후 회수된 고장 부품의 재생/폐기 대기 현황 관리",
                "keyActions": [
                      "재생 가능 판정",
                      "폐기 처리"
                ]
          },
          {
                "tabId": "STOCKTAKING",
                "tabName": "재고 실사 및 보정",
                "purpose": "정기 물리적 실사 수량과 전산 수량 간 오차 파악 및 재고 보정",
                "keyActions": [
                      "실사표 출력",
                      "실사 수량 입력",
                      "재고 차이 보정 승인"
                ]
          }
    ],
    modalWorkflows: [
          {
                "modalName": "부품 재고 이동 및 차량 불출 팝업 (Stock Transfer Modal)",
                "triggerButton": "[재고 이동] 또는 [차량 불출]",
                "keyFields": [
                      "출고 창고 (메인 창고)",
                      "입고 창고 (서비스 1호차 등)",
                      "이동 품목 및 수량",
                      "불출 목적/비고"
                ],
                "terminalAction": "[재고 이동 확정]",
                "afterStateTransition": "출고처 재고 차감, 입고처 재고 가산, 수불부 TRANSFER 이력 무누락 저장"
          }
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
        selector: '[data-mid="stock-category-tabs"], .stock-tabs',
        type: 'stamp',
        label: '부품 카테고리 탭',
        description: '전기 부품, 유압 소모품, 타이어, 안전용품별로 재고를 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="stock-alert-grid"], table.stock-table',
        type: 'highlight',
        label: '안전 재고 수량 모니터',
        description: '현재고가 안전재고 미만인 품목을 경보 색상으로 즉시 식별합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="label-template-select"], .template-picker',
        type: 'stamp',
        label: '라벨 서식 선택',
        description: '부품 식별용 바코드/QR 라벨 서식과 ZPL 템플릿을 선택합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="label-offset-inputs"], .offset-controls',
        type: 'callout',
        label: '인쇄 위치 보정',
        description: '용지 규격에 맞춰 X/Y 오프셋 좌표를 미세 보정하고 테스트 출력합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-print-stock-labels"], button:contains("라벨 인쇄")',
        type: 'click_ripple',
        label: '출력 큐 대량 전송',
        description: '실물 부품에 부착할 바코드 라벨을 인쇄 큐 모니터로 전송합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="rack-location-input"], .bin-input',
        type: 'stamp',
        label: '주기장 랙(Rack) 매핑',
        description: '부품이 보관된 주기장 창고 랙 번호와 선반 위치를 등록합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-sync-stock"], button:contains("재고 실사 확정")',
        type: 'click_ripple',
        label: '재고 원장 확정 동기화',
        description: '실사 수량을 반영하여 소모품 재고 원장을 최종 동기화합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'print_queue_monitor',
    version: 4,
    menuName: '프린트 큐 모니터',
    groupId: 'grp_inout',
    groupName: '입출고관리',
    department: '주기장/출고팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '자산 방수 바코드 및 부품 QR 라벨 ZPL/PDF 인쇄 큐 상태 실시간 감시, 인쇄 위치 오프셋 보정, 실패 큐 재전송 (헌장 3.1)',
    scopeInfo: '프린터 네트워크 IP, 포트(9100), 라벨 규격(100x75 등), 대기/성공/오류 큐 목록, ZPL 원문 코드',
    cognitiveSequence: [
      '1. 프린터 상태(온라인, 오프라인, 용지 부족) 및 출력 큐 스코핑',
      '2. 대기 중인 라벨 출력 잡(Job) 우선순위 및 인쇄 수량 확인',
      '3. ZPL 인쇄 스풀 데이터 및 프리뷰 렌더링 검증',
      '4. 라벨 프린터 IP 포트 통신 상태 및 연결 확인',
      '5. 인쇄 중단/용지 잼 발생 시 출력 잡 일시정지 및 재전송',
      '6. 정상 인쇄 완료 건 상태 PRINTED 처리 및 큐 자동 아카이빙',
      '7. 출력 큐 오류 0건 달성 및 실물 라벨 장비 부착 진행'
    ],
        subTabs: [
          {
                "tabId": "stations",
                "tabName": "프린트 스테이션 상태",
                "purpose": "주기장 및 사무실에 설치된 제브라(Zebra)/네트워크 프린터의 온라인/오프라인 연결 상태 감시",
                "keyActions": [
                      "프린터 연결 테스트",
                      "ZPL 포트 설정"
                ]
          },
          {
                "tabId": "queue",
                "tabName": "인쇄 대기열 큐 모니터링",
                "purpose": "발행된 자산 QR 라벨, 부품 바코드의 전송 상태, 오류 인쇄 재전송",
                "keyActions": [
                      "대기열 일시 정지",
                      "오류 인쇄 재전송",
                      "완료 큐 비우기"
                ]
          }
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
        selector: '[data-mid="printer-status-bar"], .printer-bar',
        type: 'stamp',
        label: '프린터 연결 상태',
        description: '라벨 프린터의 IP 연결, 전원, 용지 잔여 상태를 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="print-jobs-table"], table.queue-table',
        type: 'highlight',
        label: '출력 대기 큐 목록',
        description: '출력 대기 중인 라벨 작업들의 인쇄 매수와 우선순위를 조망합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="zpl-preview-panel"], .zpl-preview',
        type: 'callout',
        label: 'ZPL 프리뷰 검증',
        description: '전송될 ZPL 코드의 바코드 및 텍스트 렌더링 결과를 미리 검증합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="printer-port-check"], .port-indicator',
        type: 'stamp',
        label: '포트 통신 확인',
        description: '네트워크 소켓(포트 9100) 데이터 송수신 상태를 점검합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-reprint-job"], button:contains("재인쇄")',
        type: 'click_ripple',
        label: '오류 잡 재전송',
        description: '용지 걸림이나 통신 단절 시 해당 라벨 작업을 재전송합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-clear-queue"], button:contains("큐 정리")',
        type: 'stamp',
        label: '완료 잡 아카이빙',
        description: '인쇄 완료된 작업을 히스토리 로그로 이관하고 큐를 정리합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="queue-done-badge"], .queue-done',
        type: 'click_ripple',
        label: '출력 완료 확정',
        description: '모든 라벨 인쇄를 무오류로 완결하고 자산 부착 작업을 개시합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },

  // ─── 6. 정비 / 소모품관리 (grp_maintenance) ───────────────
  {
    menuId: 'consumable_purchase',
    version: 4,
    menuName: '소모품 구매',
    groupId: 'grp_maintenance',
    groupName: '정비 / 소모품관리',
    department: '정비/자재팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '정비 및 주기장 유지보수에 필요한 부품/소모품 발주서 작성, 매입 단가 승인 및 입고 대사',
    scopeInfo: '공급 업체(Vendor), 부품 품목, 발주 수량, 단가, 납기 예정일, 승인 결재선',
    cognitiveSequence: [
      '1. 안전재고 미달 품목 및 긴급 보충 발주 큐 스코핑',
      '2. 매입처(부품 협력사) 선택 및 품목별 단가/수량 견적 비교',
      '3. 소모품 구매 발주서 작성 및 협력사 전자 발송',
      '4. 발주 품목 실물 입고 검수 (수량, 규격, 파손 여부 실사)',
      '5. 입고 완료 수량 재고 원장 자동 가산 및 매입 단가 확정',
      '6. 소모품 구입 대금 지급결의 및 전자결재 상신 (헌장 결재선 연동)',
      '7. 매입 세금계산서 수취 매칭 및 구매 발주 종결 처리'
    ],
        subTabs: [
          {
                "tabId": "REQ_WRITE",
                "tabName": "구매 발주 기안",
                "purpose": "안전재고 미달 품목 또는 긴급 수리 부품의 신규 구매 발주서 작성",
                "keyActions": [
                      "부품 규격 선택",
                      "구매 수량 및 견적 단가 입력",
                      "발주서 결재 상신"
                ]
          },
          {
                "tabId": "REQ_LIST",
                "tabName": "구매 발주 현황 대장",
                "purpose": "상신된 구매 발주서의 결재 상태, 입고 예정일, 공급사 납품 현황 추적",
                "keyActions": [
                      "발주서 상세 확인",
                      "공급사 입고 확인"
                ]
          }
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
        selector: '[data-mid="purchase-shortage-queue"], .shortage-list',
        type: 'stamp',
        label: '부족 품목 발주 큐',
        description: '안전재고 미달로 긴급 보충이 필요한 소모품 목록을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="vendor-select-dropdown"], .vendor-select',
        type: 'stamp',
        label: '매입 협력사 선택',
        description: '최적 단가와 납기를 제공하는 부품 협력사를 선택합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="purchase-order-form"], .order-form',
        type: 'highlight',
        label: '구매 발주서 작성',
        description: '발주 품목, 수량, 공급 단가를 입력하고 발주서를 전자 발송합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="receiving-check-box"], .receiving-box',
        type: 'callout',
        label: '실물 입고 검수',
        description: '주기장 도착 부품의 수량과 규격 일치 여부를 현물 실사합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-confirm-receiving"], button:contains("입고 확정")',
        type: 'click_ripple',
        label: '재고 가산 확정',
        description: '검수 통과 수량을 소모품 재고 원장에 즉시 가산 반영합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-purchase-approval"], button:contains("지급결의 결재")',
        type: 'callout',
        label: '구입 대금 결재 상신',
        description: '소모품 구입 대금 지급을 위한 전자결재 품의를 공식 상신합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-close-purchase"], button.btn-close-po',
        type: 'click_ripple',
        label: '발주 종결 및 세금계산서',
        description: '매입 세금계산서와 대사 완료 후 구매 발주를 최종 종결합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'consumable_inout',
    version: 4,
    menuName: '소모품 입출고',
    groupId: 'grp_maintenance',
    groupName: '정비 / 소모품관리',
    department: '주기장/자재팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '구매 입고된 부품의 창고 적재 및 정비 작업으로 인한 부품 출고 불출 내역 기록',
    scopeInfo: '입출고 일시, 구분(입고/출고/폐기), 부품 코드, 수량, 관련 정비 작업 번호, 불출 작업자',
    cognitiveSequence: [
      '1. 정비실 및 주기장 출고/불출 의뢰 큐 스코핑',
      '2. 출고 목적(현장 AS, 입고 정비, 정기 소모품 교체) 및 정비 번호 확인',
      '3. 불출 부품 품목 및 수량 바코드 스캔 검증',
      '4. 출고 대상 자산번호(고소작업대 식별자) 1:1 매핑 (부품 원가 귀속)',
      '5. 소모품 재고 차감 및 실시간 안전재고 잔여량 경보 확인',
      '6. 수령 정비 기사 서명 및 불출증 출력',
      '7. 부품 출고 이력 무누락 DB 확정 및 자산 정비 원장 연동'
    ],
        subTabs: [
          {
                "tabId": "REQ_INBOUND",
                "tabName": "입고 요청 및 검수 등록",
                "purpose": "구매 발주 완료된 부품의 실물 입고 검수 및 창고 입고 등록",
                "keyActions": [
                      "실물 수량 대조",
                      "불량 검수",
                      "입고 확정"
                ]
          },
          {
                "tabId": "OUTBOUND",
                "tabName": "불출 및 출고 대장",
                "purpose": "정비 작업 및 현장 AS 출동을 위해 불출된 부품의 출고 내역 조회",
                "keyActions": [
                      "불출 영수증 확인",
                      "부품 투입 장비 번호 추적"
                ]
          },
          {
                "tabId": "LOGS",
                "tabName": "수불부 전체 이력",
                "purpose": "입고, 출고, 이동, 실사보정 등 부품별 모든 재고 증감 로그 종합 조망",
                "keyActions": [
                      "부품별 수불 카드 조회",
                      "월간 수불 대사"
                ]
          }
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
        selector: '[data-mid="inout-request-queue"], .inout-queue',
        type: 'stamp',
        label: '불출 의뢰 큐 스코프',
        description: '정비 기사가 요청한 부품 출고 의뢰 목록을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="inout-purpose-select"], .purpose-select',
        type: 'stamp',
        label: '출고 목적 및 정비건',
        description: '현장 AS, 입고 정비, 정기 점검 등 출고 목적을 매핑합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="barcode-scan-input"], .scan-input',
        type: 'click_ripple',
        label: '부품 바코드 스캔',
        description: '불출할 실물 부품의 바코드를 스캔하여 품목과 수량을 확인합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 4,
        selector: '[data-mid="target-asset-input"], .target-asset-box',
        type: 'callout',
        label: '투입 자산번호 1:1 매핑',
        description: '부품 원가가 귀속될 고소작업대 자산번호를 정확히 연결합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="inventory-deduction-check"], .deduction-preview',
        type: 'highlight',
        label: '재고 차감 및 잔여량',
        description: '실재고 차감 후 남은 안전재고 수량을 실시간 확인합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="technician-sign-box"], .sign-box',
        type: 'stamp',
        label: '수령 기사 서명',
        description: '부품을 수령한 정비 기사의 전자 서명을 취합합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-confirm-outbound-parts"], button.btn-confirm-parts',
        type: 'click_ripple',
        label: '출고 확정 및 이력 저장',
        description: '부품 불출을 최종 확정하고 자산 정비 이력 DB에 무누락 기록합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'field_as',
    version: 4,
    menuName: '현장 AS 관리',
    groupId: 'grp_maintenance',
    groupName: '정비 / 소모품관리',
    department: 'AS정비팀',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '현장에 출동한 순회 정비 기사의 이동 경로, 고장 부위 조치 내역, 유/무상 정비 판정, 투입 부품 기록 및 고객 서명 수령',
    scopeInfo: '접수된 AS 티켓, 현장 위치, 기사 배정, 도착 일시, 수리 완료 일시, 유상 수리 청구 금액, 고객 서명',
    cognitiveSequence: [
      '1. 긴급 AS 출동 대기 큐 및 현장 위험도/지역별 스코핑',
      '2. 출동 엔지니어 배정 및 서비스 차량 탑재 부품 재고 점검',
      '3. 현장 도착 및 고소작업대 현물 고장 원인 정밀 진단',
      '4. 현장 즉시 조치: 부품 교체, 전기 배선 수리, 유압 압력 보정',
      '5. 현장 조치 불가 판정 시: 즉시 [대차 교체(EXCHANGE) 요구] 발령 (헌장 2.1)',
      '6. 유상 수리 발생 시: 고객 과실 증거 사진 등록 및 [수리비 청구] 채권 분리 (헌장 5.5)',
      '7. 현장 AS 완료 보고서 서명 날인 및 정비 이력 타임라인 영구 보존'
    ],
        modalWorkflows: [
          {
                "modalName": "현장 AS 접수 및 출동 지시 팝업 (Field AS Dispatch Modal)",
                "triggerButton": "[신규 AS 접수]",
                "keyFields": [
                      "고객사 및 현장명",
                      "고장 장비 번호 및 증상 유형(시동 불가, 유압 누유, 충전 불량 등)",
                      "긴급도",
                      "출동 담당 기사 지정",
                      "예상 소요 시간"
                ],
                "terminalAction": "[AS 접수 및 기사 배정]",
                "afterStateTransition": "AS 상태 PENDING에서 DISPATCHED 전환, 기사 스마트폰 ToDo 연동"
          },
          {
                "modalName": "현장 AS 조치 완료 보고 팝업 (Field AS Complete Modal)",
                "triggerButton": "[조치 완료 보고]",
                "keyFields": [
                      "현장 원인 분석",
                      "조치 내용(부품 교체, 응급 배선 수리 등)",
                      "투입 부품 선택",
                      "유/무상 판정 및 유상 비용",
                      "현장 확인 서명 사진"
                ],
                "terminalAction": "[AS 완료 승인]",
                "afterStateTransition": "AS 상태 COMPLETED 전환, 유상 건은 매출 청구 원장으로 자동 연계"
          }
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
        selector: '[data-mid="field-as-queue"], .field-queue',
        type: 'stamp',
        label: '긴급 출동 대기 큐',
        description: '현장에서 접수된 고장 건들을 권역별·긴급도별로 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="engineer-dispatch-card"], .engineer-card',
        type: 'stamp',
        label: '출동 기사 및 차량 배정',
        description: '전담 정비 엔지니어와 출동 서비스 차량의 적재 부품을 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="as-diagnosis-panel"], .diagnosis-panel',
        type: 'highlight',
        label: '현장 고장 원인 진단',
        description: '컨트롤러 에러코드 판독, 유압 압력계 측정, 모터 저항값을 진단합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="as-action-checklist"], .action-checklist',
        type: 'stamp',
        label: '현장 수리 조치 수행',
        description: '밸브 청소, 퓨즈 교체, 배선 결선 등 현장 즉시 수리를 수행합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-request-exchange"], button:contains("대차 요청")',
        type: 'callout',
        label: 'EXCHANGE 대차 발령',
        description: '현장 수리 불가 판정 시 출고부서로 단일 교환 배차를 즉각 의뢰합니다.',
        badgeColor: '#E53935',
        positionHint: 'left',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-claim-repair-fee"], button:contains("수리비 청구")',
        type: 'callout',
        label: '고객 과실 수리비 청구',
        description: '고객 과실(전복, 침수 등) 시 증빙 사진과 함께 유상 채권으로 분리합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-complete-field-as"], button.btn-complete-as',
        type: 'click_ripple',
        label: 'AS 완료 보고 확정',
        description: '현장 반장 서명을 받고 AS 조치 리포트를 정비 DB에 영구 보존합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'repair',
    version: 4,
    menuName: '주기장 정비 관리',
    groupId: 'grp_maintenance',
    groupName: '정비 / 소모품관리',
    department: '정비팀',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '회수 입고된 고소작업대의 세척, 도색, 분해 수리, 안전 점검 및 정비 조치 (정비 완료 시 자산 상태 AVAILABLE(임대가능) 복원)',
    scopeInfo: '입고된 정비 대상 장비, 회수 점검표, 투입 부품 내역, 정비 공수(시간), 정비 완료 승인자',
    cognitiveSequence: [
      '1. 주기장 정비 대기(수리중) 자산 목록 및 정비 우선순위 스코핑',
      '2. 입고 검수 불량 내역서 및 고장 증상 리포트 확인',
      '3. 분해 진단 및 필요 교체 부품(모터, 밸브, 배터리) 청구 등록',
      '4. 정비 조치 작업 수행 (판금, 도색, 부품 교체, 배선 결선)',
      '5. 정비 완료 후 기능/하중 테스트 및 안전 센서 100% 정상 작동 검증',
      '6. 정비 투입 공수(시간) 및 부품 원가 집계 마감',
      '7. [정비 완료 확정] 실행 ➔ 자산 상태 AVAILABLE (임대가능) 복원 (헌장 1.2)'
    ],
        subTabs: [
          {
                "tabId": "STUDIO",
                "tabName": "정비 조치 스튜디오",
                "purpose": "현장에서 입고된 반납 장비의 입고 점검, 세척, 수리, 부품 투입 조치 (유형 A 카드 도시에)",
                "keyActions": [
                      "입고 점검 체크리스트 작성",
                      "정비 조치 등록",
                      "투입 부품 선택",
                      "수리 완료 판정"
                ]
          },
          {
                "tabId": "LEDGER",
                "tabName": "정비 완료 원장",
                "purpose": "완료된 정비 이력, 투입 부품 원가, 장비별 정비 지출 누적 내역 조회",
                "keyActions": [
                      "정비 원가 분석",
                      "장비별 누적 수리 이력 출력"
                ]
          }
    ],
    modalWorkflows: [
          {
                "modalName": "정비 조치 및 부품 투입 팝업 (Repair Execution Modal)",
                "triggerButton": "[정비 조치 / 부품 투입]",
                "keyFields": [
                      "고장 증상 및 정비 내용",
                      "투입 소모품/부품 및 수량 선택 (재고 실시간 조회)",
                      "정비 시간 및 공임",
                      "최종 판정 (정비 완료 / 외주 정비 / 폐기)"
                ],
                "terminalAction": "[정비 완료 승인]",
                "afterStateTransition": "소모품 재고 자동 출고 차감(OUTBOUND), 자산 상태 UNDER_REPAIR에서 AVAILABLE(임대가능)으로 전환 복귀"
          }
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
        selector: '[data-mid="repair-waiting-list"], .repair-list',
        type: 'stamp',
        label: '정비 대기 자산 스코프',
        description: '주기장에 입고되어 수리 대기 중인 고소작업대 목록을 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="repair-symptom-dossier"], .symptom-dossier',
        type: 'highlight',
        label: '입고 불량 리포트',
        description: '반납 검수 시 지적된 파손 부위와 작동 불량 내역서를 검토합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-request-parts"], button:contains("부품 청구")',
        type: 'click_ripple',
        label: '교체 부품 불출 청구',
        description: '수리에 필요한 정품 부품(조이스틱, 실린더 등)을 자재실에 청구합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 4,
        selector: '[data-mid="repair-task-record"], .task-record-form',
        type: 'stamp',
        label: '정비 작업 내역 기록',
        description: '수리 공정, 용접, 판금, 배선 교체 등 구체적 조치 내역을 기록합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="repair-load-test"], .load-test-card',
        type: 'callout',
        label: '정격 하중 안전 테스트',
        description: '최대 하중 탑승 상태에서 상승/하강 및 비상 정지 센서를 시험합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="repair-cost-summary"], .cost-summary-box',
        type: 'highlight',
        label: '정비 공수 및 원가 집계',
        description: '투입된 기사 작업 공수(시간)와 부품 비용을 합산 집계합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-finalize-repair"], button:contains("수리 완료")',
        type: 'click_ripple',
        label: '수리 완료 (임대가능 복원)',
        description: '정비를 최종 완료하고 자산 상태를 즉시 임대가능(AVAILABLE)으로 복원합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'inspection_checklist_manage',
    version: 4,
    menuName: '정비 항목 관리',
    groupId: 'grp_maintenance',
    groupName: '정비 / 소모품관리',
    department: '정비/품질관리팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '장비 기종별/작업유형별(출고검수, 정기점검, 입고정비) 법정 안전점검 체크리스트 표준 템플릿 관리',
    scopeInfo: '점검 유형, 기종 분류, 점검 항목명, 판정 기준, 필수 점검 여부, 과태료/안전 기준 연계',
    cognitiveSequence: [
      '1. 검수 유형별 탭 스코핑 (출고 검수, 입고/반납 검수, 정기 안전 검수)',
      '2. 장비 기종별(시저, 굴절, 직진) 필수 점검 표준 항목 정의',
      '3. 법정 안전 점검 항목(과상승방지봉, 하강방지밸브, 비상정지스위치) 필수 지정',
      '4. 판정 기준(합격/불합격/요정비) 및 가중치(정비 점수) 설정',
      '5. 사진 첨부 의무화 및 측정값(배터리 전압, 타이어 잔여 홈) 입력 규칙 구성',
      '6. 모바일 현장 검수 화면 렌더링 순서 및 카테고리 배치 최적화',
      '7. 검수 체크리스트 마스터 개정 승인 및 전사 모바일 검수 폼 실시간 배포'
    ],
        subTabs: [
          {
                "tabId": "MASTER",
                "tabName": "점검 항목 마스터",
                "purpose": "출고, 입고, 정기점검 시 평가할 세부 안전/기능 점검 항목 정의",
                "keyActions": [
                      "신규 점검 항목 추가",
                      "배점/가중치 설정",
                      "필수 여부 지정"
                ]
          },
          {
                "tabId": "PRESETS",
                "tabName": "장비군별 점검표 템플릿",
                "purpose": "시저 리프트, 굴절 붐, 직진 붐 등 차종별 맞춤형 체크리스트 프리셋 구성",
                "keyActions": [
                      "템플릿 복제",
                      "차종 매핑"
                ]
          },
          {
                "tabId": "HISTORY",
                "tabName": "점검표 개정 이력",
                "purpose": "안전 기준 강화에 따른 체크리스트 버전 관리 및 개정 이력 추적",
                "keyActions": [
                      "버전별 변경점 비교"
                ]
          }
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
        selector: '[data-mid="checklist-type-tabs"], .checklist-tabs',
        type: 'stamp',
        label: '검수 유형별 탭',
        description: '출고 검수, 반납 검수, 정기 안전점검 체크리스트 탭을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-add-check-item"], button:contains("항목 추가")',
        type: 'click_ripple',
        label: '점검 항목 신규 등록',
        description: '새로운 기계/전기/안전 점검 항목과 설명 문구를 추가합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="mandatory-safety-toggle"], .mandatory-switch',
        type: 'callout',
        label: '법정 안전 필수 지정',
        description: '과상승방지봉 등 법정 안전장치는 미체크 시 출고 불가로 잠급니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="score-weight-input"], .weight-input',
        type: 'stamp',
        label: '정비 점수 가중치',
        description: '불합격 판정 시 자산의 정비 점수에 가산될 패널티 점수를 설정합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="photo-rule-toggle"], .photo-required-box',
        type: 'highlight',
        label: '사진 첨부 의무화',
        description: '배터리 전압계 계측치 및 차체 외관 사진 첨부를 의무화합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="checklist-sort-drag"], .sortable-list',
        type: 'stamp',
        label: '모바일 검수 동선 배치',
        description: '기사가 주기장에서 장비를 돌며 점검하기 편하도록 순서를 정렬합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-publish-checklist"], button:contains("개정 승인")',
        type: 'click_ripple',
        label: '체크리스트 개정 배포',
        description: '개정된 체크리스트를 확정하여 전사 모바일 검수 화면에 즉시 배포합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },

  // ─── 7. 경영관리 (grp_management) ─────────────────────────
  {
    menuId: 'leave_application',
    version: 4,
    menuName: '연차신청',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '전사 임직원',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '임직원의 법정 연차, 반차, 병가, 경조 휴가 신청서 작성 및 상위 결재선 자동 상신',
    scopeInfo: '신청자 정보, 잔여 연차 일수, 휴가 유형, 시작일/종료일, 사용 일수, 직무 대결자, 사유',
    cognitiveSequence: [
      '1. 잔여 연차 일수 및 휴가 규정(연차, 반차, 경조사, 병가) 스코핑',
      '2. 신청 휴가 종류 선택 및 시작일/종료일 기간 지정',
      '3. 자동 일수 계산(0.5일/1일/다일) 및 공휴일 제외 확인',
      '4. 업무 대행자 지정 및 비상 연락처, 휴가 사유 작성',
      '5. 인사관리 연동 결재선 티어 자동 탐색 (헌장 결재선 100% 연동)',
      '6. [연차 신청 결재 상신] 실행 및 부서장/결재권자 알림 발송',
      '7. 최종 승인 시 개인 연차 차감 및 전사 근태 캘린더 자동 반영 확정'
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
        selector: '[data-mid="leave-balance-card"], .leave-balance-summary',
        type: 'stamp',
        label: '잔여 연차 일수 확인',
        description: '본인의 총 부여 연차, 사용 연차, 잔여 연차 일수를 실시간 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="leave-type-select"], select.leave-type',
        type: 'stamp',
        label: '휴가 종류 선택',
        description: '연차, 오전반차, 오후반차, 경조휴가, 병가 중 유형을 선택합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="leave-date-picker"], .date-range-picker',
        type: 'highlight',
        label: '휴가 기간 지정',
        description: '휴가 시작일과 종료일을 지정하고 주말/공휴일 제외 일수를 계산합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="deputy-picker"], .deputy-select',
        type: 'stamp',
        label: '업무 대행자 지정',
        description: '휴가 중 긴급 업무를 대행할 동료 임직원과 비상 연락망을 지정합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="approver-line-preview"], .approver-chain-box',
        type: 'callout',
        label: '결재권자 자동 매핑',
        description: '인사 직책 규정에 따라 소속 팀장 및 결재권자 티어가 자동 연결됩니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="leave-reason-textarea"], textarea.leave-reason',
        type: 'stamp',
        label: '신청 사유 작성',
        description: '휴가 신청 사유를 간단명료하게 입력합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-submit-leave"], button:contains("연차 신청")',
        type: 'click_ripple',
        label: '연차 신청 결재 상신',
        description: '신청서를 제출하여 부서장 결재 수신함으로 품의를 즉시 전달합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'ot_management',
    version: 4,
    menuName: 'OT 관리',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '인사/총무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '야간/주말 특근 및 연장 근무(OT) 사전 신청 및 사후 승인, 급여 정산 연동 수당 산출',
    scopeInfo: '근무자, OT 일자, 시작/종료 시간, 연장 시간, 야간/휴일 구분, 근무 사유, 승인 여부',
    cognitiveSequence: [
      '1. 해당 월 연장/휴일 근로 한도(주 52시간 준수) 및 현황 스코핑',
      '2. 신청 일자 및 근로 유형(평일 연장, 휴일 근로, 야간 근로) 선택',
      '3. 근무 예정 시간(시작~종료) 입력 및 실 근로시간 자동 산출',
      '4. 업무 목적 및 사유(긴급 출고 검수, 주말 현장 AS 등) 구체적 기재',
      '5. 팀장 및 인사 담당 결재권자 승인선 자동 매핑',
      '6. 사전 신청 및 사후 실적(타임카드) 1:1 대사 검증',
      '7. 연장근로 승인 확정 및 당월 급여 수당 자동 산출 엔진 연동'
    ],
        subTabs: [
          {
                "tabId": "LIST",
                "tabName": "OT 신청 및 처리 대장",
                "purpose": "연장, 야간, 휴일 근무 사전 신청 및 실제 승인 실적 원장",
                "keyActions": [
                      "OT 사전 신청",
                      "사후 실적 확인",
                      "부서장 승인"
                ]
          },
          {
                "tabId": "CALENDAR",
                "tabName": "월간 OT 캘린더",
                "purpose": "부서별 일자별 연장근무 투입 현황을 캘린더 뷰로 직관 조망",
                "keyActions": [
                      "특정 일자 집중 근무자 확인",
                      "법정 주 52시간 준수 모니터링"
                ]
          }
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
        selector: '[data-mid="ot-quota-card"], .ot-quota-box',
        type: 'stamp',
        label: '주 52시간 한도 모니터',
        description: '당월 누적 연장근로 시간과 법정 한도 잔여 시간을 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="ot-type-radios"], .ot-type-options',
        type: 'stamp',
        label: '근로 유형 선택',
        description: '평일 연장, 휴일 주간, 휴일 야간 등 가산수당 유형을 선택합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="ot-time-inputs"], .time-range-inputs',
        type: 'highlight',
        label: '근무 시간 및 휴게시간',
        description: '시작 및 종료 시각을 입력하고 휴게시간을 제외한 실근무를 산출합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="ot-reason-input"], .ot-reason-box',
        type: 'stamp',
        label: '구체적 업무 사유',
        description: '야간 긴급 상하차, 주말 긴급 AS 등 명확한 사유를 기재합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="ot-approver-chain"], .approver-box',
        type: 'callout',
        label: '승인선 확인',
        description: '부서장 및 인사팀 승인선을 확인합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-match-timecard"], button:contains("실적 대사")',
        type: 'stamp',
        label: '타임카드 실적 대사',
        description: '출퇴근 지문/모바일 GPS 기록과 신청 시간을 1:1 교차 검증합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-submit-ot"], button:contains("연장근로 신청")',
        type: 'click_ripple',
        label: '신청 제출 및 급여 연동',
        description: '연장근로를 결재 상신하고 승인 시 당월 급여 수당으로 자동 연동합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'vehicle_log',
    version: 4,
    menuName: '차량 / 주유관리',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '총무/운행자',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '회사 업무용 차량(순회 AS차, 현장 영업차 등)의 운행 일지(주행거리, 목적지) 및 주유/하이패스 영수증 관리',
    scopeInfo: '차량 번호, 운행 일자, 운행자, 출발/도착지, 주행거리(시작/종료), 주유량/금액, 정기검사일',
    cognitiveSequence: [
      '1. 법인 업무용 차량(서비스카, 견인차) 및 운행 월 스코핑',
      '2. 운행 일자, 운전자, 출발지 및 목적지(방문 현장) 입력',
      '3. 운행 전/후 누적 주행거리(km) 입력 및 실 주행거리 자동 계산',
      '4. 주유비, 하이패스 통행료, 주차비 등 운행 경비 영수증 증빙 첨부',
      '5. 업무용(현장AS, 장비탁송, 영업미팅) vs 비업무용 비율 자동 집계',
      '6. 국세청 법인 차량 운행기록부 법정 표준 서식 정합성 검증',
      '7. 월간 차량 운행일지 마감 확정 및 비용 인정용 엑셀 출력'
    ],
        subTabs: [
          {
                "tabId": "FUEL_LOG",
                "tabName": "주유 및 충전 일지",
                "purpose": "배차 트럭 및 AS 출동 차량의 주유량, 충전비용, 주유소 전표 관리",
                "keyActions": [
                      "주유 영수증 등록",
                      "연비 계산"
                ]
          },
          {
                "tabId": "OPERATION_LOG",
                "tabName": "운행 일지",
                "purpose": "출발지, 도착지, 주행거리(km), 운행 목적 기록 (국세청 제출 양식)",
                "keyActions": [
                      "운행 일지 작성",
                      "국세청 양식 엑셀 출력"
                ]
          },
          {
                "tabId": "MAINTENANCE",
                "tabName": "차량 정비 점검",
                "purpose": "엔진오일 교환, 타이어 교체 등 업무차량 정기 소모품 점검 주기 관리",
                "keyActions": [
                      "정비 알림 설정",
                      "차량 수리비 지출 기록"
                ]
          }
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
        selector: '[data-mid="vehicle-select-dropdown"], select.vehicle-select',
        type: 'stamp',
        label: '업무 차량 선택',
        description: '운행일지를 작성할 법인 등록 차량번호와 차종을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="vehicle-dest-input"], .destination-box',
        type: 'stamp',
        label: '출발지 및 목적지 현장',
        description: '출발 주기장과 도착 고객사 현장 명칭 및 주소를 입력합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="odometer-inputs"], .odometer-box',
        type: 'highlight',
        label: '계기판 주행거리(km)',
        description: '운행 전 계기판 거리와 운행 후 거리를 입력하여 실주행거리를 산출합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="vehicle-expense-upload"], .expense-upload',
        type: 'callout',
        label: '유류비/통행료 영수증',
        description: '주유 영수증과 고속도로 톨게이트 전표 이미지를 첨부합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="business-use-ratio"], .ratio-badge',
        type: 'stamp',
        label: '업무 사용 비율 집계',
        description: '현장 AS 및 탁송 목적의 법정 업무용 사용 비율(100%)을 검증합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-validate-hometax"], button:contains("국세청 서식 검증")',
        type: 'stamp',
        label: '국세청 양식 검증',
        description: '국세청 업무용승용차 운행기록부 법정 고시 서식 준수 여부를 검토합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-export-vehicle-log"], button:contains("운행일지 마감")',
        type: 'click_ripple',
        label: '운행일지 마감 및 출력',
        description: '월간 운행일지를 최종 마감하고 세무 증빙용 엑셀을 다운로드합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'purchase_settlement',
    version: 4,
    menuName: '월말 매입 정산',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '재무/회계팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '전사 외주 운송비, 부품 구매비, 외부 임차료 등 월말 매입 채무 1:1 대사, 세금계산서 수취 검증 및 최종 지급 결재 (헌장 3.5 Z-패턴 4단계 완결)',
    scopeInfo: '정산 연월, 매입처(운송사/부품사/임차원사), 청구서 수령액, 시스템 집계액, 차액 승인 내역',
    cognitiveSequence: [
      '1. 정산 연월 및 매입 유형(운송료, 소모품, 장비임차료, 유류비) 스코핑',
      '2. 매입처(협력사)별 세금계산서 청구 내역 일괄 취합',
      '3. 실물 입고/배차 실적과 1:1 대사 검증 (단가, 수량, 차액 분석)',
      '4. 차액 발생 시 원인 규명 및 조정(공제) 금액 확정',
      '5. 통합 지출결의서 생성 및 회계 결재 상신 (헌장 결재선 연동)',
      '6. 계좌이체(펌뱅킹) 지급 파일 생성 및 지급 예정일 설정',
      '7. 지급 완료 마감 확정 및 매입 채무 원장 자동 대차 상계'
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
        selector: '[data-mid="settlement-month-filter"], .settlement-filters',
        type: 'stamp',
        label: '정산 연월 및 유형',
        description: '운송료, 소모품, 임차료 등 매입 채무 정산 연월을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="vendor-invoice-list"], .invoice-list-table',
        type: 'highlight',
        label: '매입 세금계산서 목록',
        description: '협력사들이 청구 발행한 전자세금계산서 금액을 일괄 취합합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="settlement-recon-grid"], table.recon-grid',
        type: 'highlight',
        label: '1:1 실적 대사 그리드',
        description: '배차/입고 전산 실적과 청구 금액을 비교하여 차액을 자동 적발합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="adjustment-amount-input"], .adj-input',
        type: 'callout',
        label: '차액 조정 및 공제',
        description: '왕복 할인 누락이나 파손 공제 등 차액 조정 사유를 기재합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-create-expense-doc"], button:contains("지출결의서 생성")',
        type: 'click_ripple',
        label: '통합 지출결의서 기안',
        description: '확정된 지급액을 결재선에 올려 회계 지급 승인을 품의합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-export-banking-file"], button:contains("펌뱅킹 이체파일")',
        type: 'stamp',
        label: '은행 펌뱅킹 이체 파일',
        description: '기업은행/신한은행 대량 계좌이체용 텍스트 파일을 생성합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-confirm-payment"], button.btn-confirm-pay',
        type: 'click_ripple',
        label: '지급 완료 확정 마감',
        description: '지급 완료를 처리하고 매입 채무 원장을 대차 상계 마감합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'vendors',
    version: 4,
    menuName: '매입처 (공급자 / 외주처) 관리',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '구매/회계팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '부품 공급사, 외주 정비업체, 장비 임대 원사 등 협력업체 마스터, 결제 계좌, 세금계산서 수신처 관리',
    scopeInfo: '사업자등록번호, 상호명, 대표자, 업태/종목, 주거래 품목, 결제 은행/계좌번호, 담당자 연락처',
    cognitiveSequence: [
      '1. 매입처 분류 스코핑 (부품 제조사, 정비 협력사, 소모품 납품사, 유류사)',
      '2. 신규 협력사 사업자등록증 및 통장 사본 등록',
      '3. 홈택스 사업자 유효성 실시간 검증',
      '4. 주요 공급 품목군 및 계약 단가표, 결제 조건(익월말 현금 등) 등록',
      '5. 협력사 담당자 연락처 및 세금계산서 수신 이메일 검증',
      '6. 월별 매입 실적 및 대금 지급 이력 원장 조회',
      '7. 협력사 마스터 승인 확정 및 발주/구매 연동 가용화'
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
        selector: '[data-mid="vendor-type-filter"], .vendor-type-bar',
        type: 'stamp',
        label: '협력사 분류 스코프',
        description: '부품사, 정비공장, 유류사, 운송사별로 매입처를 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-new-vendor"], button:contains("협력사 등록")',
        type: 'click_ripple',
        label: '신규 협력사 등록',
        description: '사업자등록증과 대표자 통장 사본을 첨부하여 등록을 개시합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="btn-verify-vendor-tax"], button:contains("사업자 검증")',
        type: 'callout',
        label: '홈택스 유효성 검증',
        description: '국세청 API로 계속사업자 여부와 과세 유형(일반/간이)을 확인합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="vendor-terms-form"], .terms-fields',
        type: 'highlight',
        label: '결제 조건 및 단가표',
        description: '결제 기일(익월말 현금 등)과 품목별 공급 단가표를 등록합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="vendor-tax-email"], input.tax-email',
        type: 'stamp',
        label: '세금계산서 전용 메일',
        description: '전자세금계산서를 수취할 전용 이메일과 회계 담당자를 확인합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="vendor-purchase-history"], .history-tab',
        type: 'stamp',
        label: '매입 및 지급 원장',
        description: '해당 협력사와의 월별 매입 누적액과 지급 대사 이력을 조회합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-save-vendor"], button:contains("저장")',
        type: 'click_ripple',
        label: '협력사 마스터 확정',
        description: '협력사를 정식 등록하여 소모품 발주 및 정산 대상에 가용화합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'bank_matching',
    version: 4,
    menuName: '은행 입출금 대장',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '재무/회계팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '실시간 은행 계좌 스크래핑/엑셀 거래 내역과 매출 청구(수납) 및 매입 지급 건 1:1 대사 매칭 (헌장 3.6 유형 B)',
    scopeInfo: '통장 거래 일시, 입금액/출금액, 적요(입금자명), 잔액, 시스템 매칭 대상 매출/매입 채권',
    cognitiveSequence: [
      '1. 통장 거래 연월 및 조회 금융 계좌(법인 주거래 통장) 스코핑',
      '2. 은행 펌뱅킹/엑셀 입금 내역 데이터 업로드 및 미매칭 큐 확인',
      '3. 입금자명, 입금액, 입금 일자 기반 미수금 원장 자동 추천 매칭',
      '4. 동명칭/상호 불일치 건 수동 거래처 탐색 및 1:1 강제 매칭',
      '5. 복수 청구서 일괄 입금 건 분할 대사 및 차액(수수료 등) 처리',
      '6. 수납 확정 실행 ➔ 외상매출금(미수금) 원장 실시간 차감 반영 (Audit Result)',
      '7. 통장 대사 합계 검증식(통장 총입금액 = 수납 확정액 | 차액 ₩0) 무결성 확정 (헌장 3.5)'
    ],
        subTabs: [
          {
                "tabId": "MATCHING",
                "tabName": "통장 입금 1:1 대사",
                "purpose": "통장 거래내역과 시스템 매출 청구서를 1:1로 비교 매칭하여 자동 수납 처리",
                "keyActions": [
                      "통장 엑셀 업로드",
                      "자동 매칭 실행",
                      "수기 매칭 승인"
                ]
          },
          {
                "tabId": "RULES",
                "tabName": "자동 매칭 규칙 설정",
                "purpose": "입금자명 패턴(상호+현장명 등)에 따라 거래처를 자동 식별하는 룰셋 관리",
                "keyActions": [
                      "입금자 패턴 추가",
                      "거래처 자동 매핑 룰 정의"
                ]
          }
    ],
    modalWorkflows: [
          {
                "modalName": "통장 입금 1:1 수기 대사 매칭 팝업 (Bank Matching Modal)",
                "triggerButton": "통장 내역 행의 [수기 매칭]",
                "keyFields": [
                      "입금 내역(일자, 입금자명, 입금액)",
                      "매칭 대상 미수 청구서 선택",
                      "차액(타행이체 수수료 등) 입력"
                ],
                "terminalAction": "[매칭 확정 및 수납 완료]",
                "afterStateTransition": "통장 내역 매칭 완료 플래그 저장, 해당 매출 청구서 PAID 수납 처리"
          }
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
        selector: '[data-mid="bank-account-picker"], .bank-picker',
        type: 'stamp',
        label: '법인 계좌 스코프',
        description: '대사 대상 법인 은행 계좌와 조회 정산 연월을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-upload-bank-csv"], button:contains("통장 엑셀 업로드")',
        type: 'click_ripple',
        label: '통장 거래내역 유입',
        description: '은행 인터넷뱅킹에서 다운로드한 입금 내역 엑셀을 업로드합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="auto-match-badge"], .auto-match-col',
        type: 'highlight',
        label: '인공지능 자동 매칭',
        description: '입금자명과 금액이 청구서와 100% 일치하는 건을 즉시 매칭 추천합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="manual-search-btn"], button:contains("거래처 찾기")',
        type: 'callout',
        label: '상호 불일치 수동 탐색',
        description: '대표자 개인명 등으로 입금되어 자동 매칭되지 않은 건을 수동 연결합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="split-payment-btn"], button:contains("분할 매칭")',
        type: 'stamp',
        label: '복수 현장 분할 대사',
        description: '1건의 입금액으로 여러 계약의 미수금을 분할 차감합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-confirm-matching"], button:contains("수납 확정")',
        type: 'click_ripple',
        label: '외상매출금 수납 차감',
        description: '매칭을 확정하여 미수금 대장의 잔액을 실시간으로 차감합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 7,
        selector: '[data-mid="audit-equation-bar"], .audit-equation',
        type: 'click_ripple',
        label: '대차 차액 ₩0 무결성',
        description: '통장 입금액 = 수납 확정액 대차 차액이 0원임을 최종 확인합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'corporate_card',
    version: 4,
    menuName: '법인카드 매입정산',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '재무/회계팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '법인카드 승인 내역 연동, 카드 사용자별 영수증 증빙 첨부 확인 및 회계 계정과목(복리후생, 유류비 등) 분류 확정',
    scopeInfo: '카드 번호, 승인 일시, 가맹점명, 승인 금액, 부가세, 사용자, 회계 계정과목, 영수증 이미지',
    cognitiveSequence: [
      '1. 정산 연월 및 법인카드 번호/소지 임직원별 스코핑',
      '2. 카드사 승인 내역 엑셀 업로드 또는 스크래핑 데이터 동기화',
      '3. 승인 건별 사용 목적(유류비, 식대, 소모품, 출장비) 계정과목 분류',
      '4. 간이영수증 및 카드 전표 사진 첨부 실사',
      '5. 개인 사용 또는 규정 위반(심야/주말) 건 소명 요구 및 환수 처리',
      '6. 부서별 법인카드 예산 대비 집행률 대차대조 검증',
      '7. 월말 법인카드 정산서 최종 확정 및 회계 지출결의 승인'
    ],
        subTabs: [
          {
                "tabId": "settlement",
                "tabName": "법인카드 전표 정산",
                "purpose": "카드사 연동 승인 내역에 용도, 계정과목, 영수증 증빙을 매핑하여 전표 처리",
                "keyActions": [
                      "카드 승인 내역 수집",
                      "용도/계정과목 지정",
                      "영수증 사진 첨부",
                      "정산 상신"
                ]
          },
          {
                "tabId": "settings",
                "tabName": "카드 및 한도 관리",
                "purpose": "임직원별 지급된 법인카드 목록, 유효기간, 월 한도액 관리",
                "keyActions": [
                      "신규 카드 등록",
                      "한도 조정"
                ]
          }
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
        selector: '[data-mid="card-select-filter"], .card-filters',
        type: 'stamp',
        label: '법인카드 및 임직원 스코프',
        description: '카드 번호와 소지자별로 당월 사용 내역을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-upload-card-statement"], button:contains("카드 승인내역 업로드")',
        type: 'click_ripple',
        label: '카드 승인 내역 유입',
        description: '카드사 승인 내역 엑셀 파일을 업로드하여 데이터를 파싱합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="expense-category-dropdown"], select.category-select',
        type: 'highlight',
        label: '계정과목 자동 분류',
        description: '가맹점 업종 기반으로 유류비, 소모품비, 복리후생비를 매핑합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="receipt-attach-cell"], .receipt-upload',
        type: 'callout',
        label: '영수증 전표 사진 실사',
        description: '모바일로 촬영된 간이영수증 및 결제 전표 이미지를 대조합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="policy-violation-alert"], .violation-alert',
        type: 'stamp',
        label: '규정 위반 검증',
        description: '주말/심야 사용 등 규정 위반 의심 건에 소명 메모를 요구합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="budget-vs-actual-card"], .budget-card',
        type: 'stamp',
        label: '부서별 예산 대비 집행률',
        description: '부서별 법인카드 한도 대비 실사용 금액을 대차대조합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-finalize-card-settlement"], button:contains("정산 확정")',
        type: 'click_ripple',
        label: '법인카드 정산 마감',
        description: '정산서를 확정하고 지출결의 결재 상신 및 회계 전표를 생성합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'cash_flow',
    version: 4,
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
        subTabs: [
          {
                "tabId": "FORECAST",
                "tabName": "자금 수지 예측",
                "purpose": "향후 30일/60일/90일간 예정된 매출 수납액과 운송료, 임차료, 급여 지출 예측",
                "keyActions": [
                      "일자별 예상 잔액 확인",
                      "자금 부족 위험 구간 경보"
                ]
          },
          {
                "tabId": "HISTORY",
                "tabName": "입출금 실적 내역",
                "purpose": "실제 통장 입출금 실적과 예측치 간 편차 분석 및 감사 로그",
                "keyActions": [
                      "실적 대비 편차율 검토"
                ]
          }
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
        selector: '[data-mid="cashflow-date-picker"], .date-picker',
        type: 'stamp',
        label: '기준 일자 및 계좌 스코프',
        description: '자금 현황을 조회할 기준일자와 법인 은행 계좌를 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="cash-inflow-card"], .inflow-card',
        type: 'highlight',
        label: '당일 현금 유입액',
        description: '렌탈료 수납, 보증금 입금, 자산 매각 대금 합계를 집계합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="cash-outflow-card"], .outflow-card',
        type: 'highlight',
        label: '당일 현금 유출액',
        description: '운송료 지급, 소모품 매입, 급여 및 임차료 출금 합계를 집계합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="forecast-30days-chart"], .forecast-chart',
        type: 'callout',
        label: '30일 자금 수지 예측',
        description: '향후 입금 예정액과 지급 청구액을 시뮬레이션하여 유동성을 예측합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="liquidity-alert-badge"], .alert-badge',
        type: 'stamp',
        label: '자금 부족 사전 경보',
        description: '특정일 자금 부족 예상 시 단기 대출 또는 수납 독려 경보를 표출합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="account-balance-grid"], table.balance-table',
        type: 'stamp',
        label: '계좌별 잔액 대차대조',
        description: '은행 실잔액과 장부상 자금 잔액의 일치성을 검증합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-publish-daily-report"], button:contains("자금일보 발행")',
        type: 'click_ripple',
        label: '일일 자금일보 마감',
        description: '일일 자금일보를 최종 확정하고 경영진 보고용 PDF를 발행합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'depreciation_execution',
    version: 4,
    menuName: '감가상각 마감 실행',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '회계팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '보유 고소작업대 자산의 정액법 월별 감가상각비 자동 계산, 장부가액 갱신 및 월말 회계 마감 확정',
    scopeInfo: '취득 자산 목록, 취득원가, 내용연수(5년/60개월), 잔존가치, 상각방법, 기 상각누계액',
    cognitiveSequence: [
      '1. 상각 대상 회계 연월 및 자산 분류(고소작업대, 차량, 공구기구) 스코핑',
      '2. 자산별 취득가액, 내용연수(보통 5년), 상각방법(정액법/정률법) 검토',
      '3. 당월 상각비 및 누적 감가상각누계액, 장부가액 정밀 자동 산출',
      '4. 자산 상태별(매각, 폐기) 상각 중단 및 잔존가치(1,000원) 정합성 확인',
      '5. 자산별 감가상각 명세서 대차대조 합계 검증',
      '6. 회계 전표(감가상각비 / 감가상각누계액) 자동 분개 생성',
      '7. 월말 감가상각 실행 확정 및 재무상태표 원장 자동 반영'
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
        selector: '[data-mid="depr-period-filter"], .depr-filters',
        type: 'stamp',
        label: '상각 회계 연월',
        description: '감가상각을 실행할 회계 연월과 자산 분류를 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="depr-policy-info"], .policy-box',
        type: 'stamp',
        label: '내용연수 및 상각법',
        description: '세법 기준 5년 내용연수와 정액법 상각률(0.2)을 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="depr-calculation-grid"], table.depr-table',
        type: 'highlight',
        label: '월 상각비 자동 산출',
        description: '자산별 취득원가 대비 당월 감가상각비와 미상각잔액을 정밀 계산합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="residual-value-check"], .residual-box',
        type: 'callout',
        label: '잔존가액(1천원) 검증',
        description: '상각 완료 자산의 비망가액 1,000원이 정확히 유지되는지 검증합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="depr-total-summary"], .summary-card',
        type: 'stamp',
        label: '총 상각액 대차 검증',
        description: '전체 고소작업대 자산의 당월 상각액 총계를 대차대조합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-preview-journal"], button:contains("분개 전표")',
        type: 'stamp',
        label: '회계 분개 전표 생성',
        description: '차변: 감가상각비 / 대변: 감가상각누계액 회계 전표를 생성합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-execute-depr"], button:contains("감가상각 실행")',
        type: 'click_ripple',
        label: '감가상각 마감 실행',
        description: '당월 감가상각을 영구 실행하고 재무상태표 원장에 반영합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'regular_reports',
    version: 4,
    menuName: '정기보고서 생성',
    groupId: 'grp_management',
    groupName: '경영관리',
    department: '경영기획/경영진',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '전사 자산 가동률, 모델별 매출 기여도(헌장 4.1), 부서별 KPI, 손익 집계 등 경영진 브리핑용 정기보고서 자동 생성 및 엑셀 다운로드 (헌장 5.1 2단계 검증 적용)',
    scopeInfo: '보고 기간(월간/분기/연간), 집계 지표(가동률, 총매출, 운송비율, 정비비용, 연체율)',
    cognitiveSequence: [
      '1. 보고 기간(월간, 분기, 연간) 및 경영 성과 지표 스코핑',
      '2. 렌탈 자산 가동률 및 자산별 누적 매출 기여액 정밀 일할 통계 산출 (헌장 4.1)',
      '3. 고객사별 매출 순위 및 연체 채권 회수율 분석',
      '4. 장비 기종별/작업 높이별 렌탈 수요 트렌드 분석',
      '5. 운송비 및 정비비 원가 비율 지표 검증',
      '6. 전사 손익 요약 및 핵심 KPI(가동율 85% 이상, 연체율 3% 미만) 달성도 검토',
      '7. 정기 경영 보고서 PDF 생성 및 경영진 공식 배포 확정'
    ],
        subTabs: [
          {
                "tabId": "EXECUTIVE",
                "tabName": "경영진 핵심 요약 보고서",
                "purpose": "월별 전사 가동률, 매출 총액, 미수 채권, 자산 수익률 1장 요약 브리핑",
                "keyActions": [
                      "기간별 KPI 비교",
                      "PDF 리포트 출력"
                ]
          },
          {
                "tabId": "DRILLDOWN",
                "tabName": "부문별 상세 손익 드릴다운",
                "purpose": "장비 모델별, 거래처별, 영업담당자별 공헌이익 및 비용 세부 분석",
                "keyActions": [
                      "장비군별 수익성 필터",
                      "엑셀 데이터 내보내기"
                ]
          }
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
        selector: '[data-mid="report-period-selector"], .period-bar',
        type: 'stamp',
        label: '보고 기간 스코프',
        description: '월간, 분기, 반기, 연간 경영 보고 주기를 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="report-utilization-stat"], .utilization-box',
        type: 'highlight',
        label: '자산 가동율 및 기여액',
        description: '전사 고소작업대 가동율과 자산별 일할 매출 기여액을 분석합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="report-customer-ranking"], .ranking-table',
        type: 'stamp',
        label: '거래처별 매출 순위',
        description: '상위 핵심 매출 고객사와 채권 회수 현황을 대조합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="report-model-trend"], .trend-chart',
        type: 'stamp',
        label: '기종별 렌탈 수요 추이',
        description: '작업 높이별(6m, 8m, 10m, 12m) 현장 선호 트렌드를 분석합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="report-cost-ratio"], .cost-ratio-card',
        type: 'callout',
        label: '운송/정비 원가율',
        description: '매출액 대비 운송비와 부품 정비 원가 지출 비율을 검증합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="kpi-scorecard"], .kpi-scorecard',
        type: 'highlight',
        label: '핵심 KPI 달성도',
        description: '가동율 목표(85%) 및 채권 연체율 목표(3% 미만) 달성을 평가합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-export-exec-report"], button:contains("경영보고서 PDF")',
        type: 'click_ripple',
        label: '보고서 PDF 배포 확정',
        description: '정기 경영 분석 리포트를 PDF로 발행하고 임원진에 공유합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },

  // ─── 8. 경영관리 - 특수 (grp_management_special) ──────────
  {
    menuId: 'organization',
    version: 4,
    menuName: '조직 / 인사 관리',
    groupId: 'grp_management_special',
    groupName: '경영관리 - 특수',
    department: '인사/총무팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '본사/지사/주기장 조직도 트리 구조, 부서 및 직급 체계 정의, 테넌트 정보보호 책임자 설정 및 메타데이터 관리',
    scopeInfo: '상위 부서, 하위 부서, 직급/직책 코드, 테넌트 정보보호 책임자 성명/연락처, 사업장 소재지',
    cognitiveSequence: [
      '1. 부서 조직도 트리 및 소속 임직원 현황 스코핑',
      '2. 신규 임직원 등록 (성명, 사번, 입사일, 로그인 ID, 부서)',
      '3. 직급(Position) 선택: 결재선 티어에 정의된 직급 내 선택 (0~7티어)',
      '4. 직책(Duty) 선택: 직책 설정(팀장, 센터장, 본부장 등) 지정 및 실시간 티어 확인',
      '5. 임직원 실효 결재 권한 티어(직책 우선 판정) 인포 박스 검증',
      '6. 비밀번호 초기화 및 모바일 현장 권한 부여',
      '7. 인사 정보 최종 저장 ➔ 전자결재 승인선 및 조직도 실시간 동기화 확정'
    ],
        subTabs: [
          {
                "tabId": "DEPT",
                "tabName": "부서 및 팀 조직도",
                "purpose": "영업팀, 주기장팀, 정비팀, 배차팀, 관리본부 등 사내 직제 및 부서 관리",
                "keyActions": [
                      "부서 신설/수정",
                      "부서장 지정"
                ]
          },
          {
                "tabId": "UNASSIGNED",
                "tabName": "미배치 인원 관리",
                "purpose": "신규 입사자 또는 부서 이동 대기 인원의 소속 부서 배정",
                "keyActions": [
                      "소속 부서 지정",
                      "인수인계 설정"
                ]
          }
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
        selector: '[data-mid="org-tree-panel"], .org-tree',
        type: 'stamp',
        label: '부서 조직도 트리',
        description: '영업부, 배차부, 주기장, 정비부, 관리부 조직 트리를 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-new-employee"], button:contains("임직원 등록")',
        type: 'click_ripple',
        label: '신규 임직원 등록',
        description: '성명, 사번, 소속 부서, 로그인 계정 정보를 입력합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="emp-position-select"], select.position-select',
        type: 'highlight',
        label: '직급(Position) 선택',
        description: '결재선 티어 설정에서 정의된 직급(0~7티어) 중에서만 선택합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="emp-duty-select"], select.duty-select',
        type: 'stamp',
        label: '직책(Duty) 지정',
        description: '팀장, 센터장, 공장장, 본부장 등 직책을 매핑합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="effective-tier-infobox"], .tier-info-box',
        type: 'callout',
        label: '실효 결재 티어 판정',
        description: '직책 우선 판정 원칙에 따라 산출된 실효 결재 티어를 확인합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-reset-pw"], button:contains("비밀번호 초기화")',
        type: 'stamp',
        label: '계정 및 모바일 권한',
        description: '현장 모바일 PWA 접속 권한과 초기 비밀번호를 설정합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-save-org-changes"], button:contains("저장")',
        type: 'click_ripple',
        label: '인사 및 결재선 동기화',
        description: '인사정보를 저장하여 전자결재선과 조직도에 실시간 동기화합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'permission',
    version: 4,
    menuName: '사용자 및 권한',
    groupId: 'grp_management_special',
    groupName: '경영관리 - 특수',
    department: '시스템관리자',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '임직원 계정 생성, 소속 부서/직급 매핑, 직급 티어(Tier 1~7) 부여 및 메뉴별 읽기/쓰기/삭제 RBAC 권한 제어',
    scopeInfo: '로그인 ID, 사원 성명, 소속 부서, 직급, 티어 레벨(0~7), 메뉴별 권한 매트릭스(view, edit, delete, export)',
    cognitiveSequence: [
      '1. 역할 그룹(ADMIN, MANAGER, STAFF, DRIVER, GUEST) 스코핑',
      '2. 51개 전사 메뉴별 접근 권한(조회, 등록, 수정, 삭제, 엑셀) 매트릭스 점검',
      '3. 부서별(영업, 배차, 주기장, 정비, 관리) R&R 헌장 부합성 검증 (헌장 2.1)',
      '4. 특수 민감 메뉴(급여, 자금, 결재선 설정) 관리자 전용 권한 제한',
      '5. 원격 Supabase Row-Level Security(RLS) 정책 일치성 검증',
      '6. 권한 변경 시뮬레이션 및 권한 테스트 유저 전환 검증',
      '7. 권한 매트릭스 최종 적용 및 전사 세션 실시간 반영'
    ],
        subTabs: [
          {
                "tabId": "ROLES",
                "tabName": "역할/권한 그룹 설정",
                "purpose": "영업, 주기장, 정비, 회계, 관리자 등 역할별 메뉴 접근 및 수정 권한 매트릭스 정의",
                "keyActions": [
                      "신규 권한 그룹 생성",
                      "메뉴별 읽기/쓰기 체크박스 설정"
                ]
          },
          {
                "tabId": "USERS",
                "tabName": "사용자별 역할 매핑",
                "purpose": "개별 임직원 계정에 특정 권한 그룹을 매핑하여 시스템 접근 통제",
                "keyActions": [
                      "임직원 권한 변경",
                      "임시 관리자 권한 부여"
                ]
          }
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
        selector: '[data-mid="role-group-tabs"], .role-tabs',
        type: 'stamp',
        label: '역할 그룹 스코프',
        description: '최고관리자, 부서장, 실무자, 기사 그룹별 권한을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="permission-matrix-table"], table.permission-table',
        type: 'highlight',
        label: '51개 메뉴 권한 매트릭스',
        description: '메뉴별 읽기, 쓰기, 삭제, 엑셀 다운로드 권한을 매트릭스로 검토합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="rr-policy-check"], .rr-policy-box',
        type: 'callout',
        label: '부서간 R&R 헌장 검증',
        description: '영업의 자산번호 임의 지정 금지 등 전사 표준 R&R을 준수하도록 통제합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="sensitive-menu-lock"], .lock-badge',
        type: 'stamp',
        label: '민감 메뉴 보안 잠금',
        description: '급여, 자금일보, 결재선 관리 메뉴는 최고관리자 전용으로 제한합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="rls-policy-status"], .rls-status-box',
        type: 'stamp',
        label: 'Supabase RLS 동기화',
        description: 'DB 레벨 Row-Level Security 정책과 UI 권한이 일치하는지 확인합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-test-role-switch"], select.role-switch-test',
        type: 'stamp',
        label: '권한 시뮬레이션 전환',
        description: '헤더 사용자 전환을 통해 실제 화면 노출 여부를 시뮬레이션합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-save-permissions"], button:contains("권한 적용")',
        type: 'click_ripple',
        label: '권한 매트릭스 확정',
        description: '권한 설정을 전사 세션에 실시간 적용하여 보안을 완결합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'payroll',
    version: 4,
    menuName: '급여 정산',
    groupId: 'grp_management_special',
    groupName: '경영관리 - 특수',
    department: '인사/급여팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '기본급, OT 수당, 식대, 4대보험 공제액 및 소득세를 반영한 월별 급여 명세서 자동 산출, 급여 이체 데이터 확정 및 명세서 발송',
    scopeInfo: '급여 연월, 임직원 기본급 테이블, 당월 OT 승인 시간, 4대보험 요율, 부양가족 수',
    cognitiveSequence: [
      '1. 급여 지급 연월 및 대상 임직원 명부 스코핑',
      '2. 기본급, 직책수당, 근속수당 기본 항목 산정',
      '3. 당월 승인된 연장/휴일 근로 시간 기반 시간외 수당 자동 집계',
      '4. 4대 보험(국민연금, 건강보험, 고용보험, 산재보험) 및 소득세/지방소득세 공제 계산',
      '5. 차인지급액(실지급액) 정밀 검증 및 급여 대장 대차대조 확정',
      '6. 급여 지급 전자결재 상신 (헌장 결재선 연동)',
      '7. 급여명세서 개별 암호화 PDF 생성 및 임직원 모바일/이메일 전자 교부'
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
        selector: '[data-mid="payroll-month-selector"], .payroll-month-bar',
        type: 'stamp',
        label: '급여 연월 스코프',
        description: '급여를 정산할 연월과 지급 대상 임직원 명부를 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="base-salary-grid"], .base-salary-fields',
        type: 'stamp',
        label: '기본급 및 수당 산정',
        description: '직급별 기본급, 직책수당, 근속수당 기본 항목을 불러옵니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="overtime-allowance-cell"], .ot-calc-box',
        type: 'highlight',
        label: '시간외 수당 자동 집계',
        description: '당월 승인된 연장/휴일 근로 시간을 급여 수당으로 자동 환산합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="deductions-calc-grid"], .deductions-box',
        type: 'highlight',
        label: '4대보험 및 세금 공제',
        description: '국민연금, 건강보험, 고용보험 요율과 간이세액표를 자동 산출합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="net-salary-summary"], .net-salary-card',
        type: 'callout',
        label: '실지급액 대차대조',
        description: '지급총액 - 공제총액 = 실지급액 수학적 정합성을 전수 검증합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-submit-payroll-approval"], button:contains("급여 결재상신")',
        type: 'click_ripple',
        label: '급여 지급 결재 상신',
        description: '월간 급여 대장 품의서를 작성하여 대표이사 최종 결재를 상신합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-publish-paystub"], button:contains("명세서 교부")',
        type: 'click_ripple',
        label: '급여명세서 전자 교부',
        description: '개별 암호화된 급여명세서 PDF를 모바일과 이메일로 자동 교부합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'leave_management',
    version: 4,
    menuName: '연차관리',
    groupId: 'grp_management_special',
    groupName: '경영관리 - 특수',
    department: '인사팀',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '전사 임직원의 입사일 기준 법정 연차 일수 자동 부여, 사용 일수 차감 집계, 연차 유급휴가 사용 촉진 통보 관리',
    scopeInfo: '임직원 입사일자, 근속 연수, 법정 발생 연차, 회계연도 기준 사용 연차, 잔여 일수, 촉진 통보 이력',
    cognitiveSequence: [
      '1. 기준 연도 및 전사 부서별 연차 관리 대장 스코핑',
      '2. 근로기준법 기준 입사일별 법정 연차 발생 일수 자동 계산 (1년 미만 월 1개, 1년 이상 15개~)',
      '3. 당해 연도 승인된 연차/반차 사용 일수 누적 집계',
      '4. 임직원별 잔여 연차 일수 및 연차 소진율 모니터링',
      '5. 연차 유급휴가 사용 촉진 통보서(1차, 2차) 법정 기한 내 자동 생성',
      '6. 연말 미사용 연차 수당 정산액 산출 및 급여 연동 검토',
      '7. 전사 연차 정산 마감 확정 및 인사 감사 원장 보존'
    ],
        subTabs: [
          {
                "tabId": "QUOTA",
                "tabName": "연차 부여 및 한도 관리",
                "purpose": "임직원별 근속연수 기준 연차 발생일수 부여 및 잔여일수 관리",
                "keyActions": [
                      "연차 일괄 생성",
                      "포상/특별 휴가 부여"
                ]
          },
          {
                "tabId": "USAGE",
                "tabName": "연차 사용 현황 대장",
                "purpose": "임직원 연차 사용 신청, 승인 내역 및 월별 연차 소진율 집계",
                "keyActions": [
                      "휴가 캘린더 확인",
                      "연차 사용 촉진 안내"
                ]
          }
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
        selector: '[data-mid="leave-mgmt-year"], .year-select',
        type: 'stamp',
        label: '연차 관리 연도',
        description: '조회 및 정산할 관리 연도와 전사 부서를 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="legal-leave-calc"], .statutory-calc-box',
        type: 'highlight',
        label: '법정 연차 발생 일수',
        description: '입사일자 기준 근로기준법에 따른 법정 연차 발생 일수를 자동 계산합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="used-leave-summary"], .used-leave-col',
        type: 'stamp',
        label: '사용 연차 누적 집계',
        description: '당해 연도 전자결재로 승인된 연차 사용 실적을 집계합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="remaining-leave-grid"], table.leave-table',
        type: 'highlight',
        label: '임직원별 잔여 일수',
        description: '임직원별 잔여 연차와 소진율을 대시보드 그리드로 모니터링합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-leave-promotion"], button:contains("사용촉진 통보")',
        type: 'click_ripple',
        label: '연차 촉진 통보서 발송',
        description: '법정 기한(6개월 전/2개월 전) 연차 유급휴가 사용 촉진 통보서를 발송합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="unused-leave-payout"], .payout-calc-box',
        type: 'callout',
        label: '미사용 연차 수당 산출',
        description: '연말 미사용 연차에 대한 통상임금 기준 보상 수당을 산출합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-finalize-leave-year"], button.btn-finalize-leave',
        type: 'click_ripple',
        label: '연차 원장 마감 확정',
        description: '연간 연차 사용 및 수당 정산을 최종 마감하고 인사 원장에 보존합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'privacy_audit',
    version: 4,
    menuName: '개인정보 접속 감사',
    groupId: 'grp_management_special',
    groupName: '경영관리 - 특수',
    department: '개인정보보호책임자',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '개인정보보호법에 따른 주민등록번호, 연락처, 계좌번호 등 고유식별정보의 열람/수정/다운로드 접속 기록 무누락 감사 및 침해사고 예방',
    scopeInfo: '접속 일시, 접속자 ID/성명, 접속자 IP, 열람 대상 정보 주체, 수행 액션(READ/EXPORT/UPDATE), 법적 정당 사유',
    cognitiveSequence: [
      '1. 감사 기간 및 열람 유형(고객 주민번호, 계좌번호, 임직원 정보) 스코핑',
      '2. 개인정보 취급자의 조회 일시, 접속 IP, 열람 사유 로그 전수 검색',
      '3. 개인정보 다운로드(엑셀 내보내기) 대량 발생 건 탐지 및 경보 확인',
      '4. 암호화 저장 및 전송 구간 안전성 기준(SSL/TLS, SHA256) 준수 점검',
      '5. 3년 경과 불필요 개인정보 파기 대상 목록 추출',
      '6. 개인정보 파기 실행 및 파기 확인서 자동 발급',
      '7. 개인정보 보호법 제30조 법정 안전성 감사 보고서 확정'
    ],
        subTabs: [
          {
                "tabId": "LOGS",
                "tabName": "개인정보 열람 감사 로그",
                "purpose": "고객사 대표자, 기사, 임직원의 주민등록번호, 계좌번호 등 민감정보 열람 기록 전수 감사",
                "keyActions": [
                      "열람 일시/사유 확인",
                      "비정상 대량 열람 적발"
                ]
          },
          {
                "tabId": "POLICY",
                "tabName": "개인정보 처리방침 관리",
                "purpose": "개인정보 보유 기간, 파기 절차, 위수탁 계약 기준 관리",
                "keyActions": [
                      "보유 기간 만료 데이터 파기"
                ]
          }
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
        selector: '[data-mid="privacy-audit-filters"], .audit-filters',
        type: 'stamp',
        label: '감사 기간 및 정보 유형',
        description: '고객 주민번호, 통장계좌, 휴대폰번호 등 개인정보 유형을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="access-log-table"], table.access-log',
        type: 'highlight',
        label: '접속 및 열람 로그',
        description: '취급자 사번, 접속 IP, 열람 일시, 사유를 실시간 전수 검색합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="bulk-download-alert"], .alert-row',
        type: 'callout',
        label: '대량 다운로드 탐지',
        description: '개인정보가 포함된 엑셀 대량 다운로드 건을 이상 징후로 탐지합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="encryption-status-card"], .security-card',
        type: 'stamp',
        label: 'DB 암호화 저장 검증',
        description: '민감 데이터의 SHA-256 및 AES-256 암호화 저장 상태를 확인합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="retention-expire-queue"], .expire-queue',
        type: 'stamp',
        label: '보유 기간 만료 대상',
        description: '법정 보존 기간(계약 종료 후 3년/5년)이 경과한 파기 대상을 추출합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-destroy-privacy-data"], button:contains("파기 실행")',
        type: 'click_ripple',
        label: '개인정보 영구 파기',
        description: '만료된 개인정보를 DB에서 영구 삭제하고 파기 증명서를 발급합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-export-privacy-report"], button:contains("감사보고서 출력")',
        type: 'click_ripple',
        label: '법정 감사 보고서 확정',
        description: '개인정보보호위원회 제출 규격의 법정 감사 보고서를 출력합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },

  // ─── 9. 도구 및 다운로드 (grp_tools) ──────────────────────
  {
    menuId: 'operations_manual',
    version: 4,
    menuName: '업무매뉴얼',
    groupId: 'grp_tools',
    groupName: '도구 및 다운로드',
    department: '전사 임직원',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '전사 모든 부서 및 메뉴의 업무 프로세스, 조작 동선, 표준 헌장 준수 수칙을 전수 검색/열람하고 실무 지침서로 활용',
    scopeInfo: '전사 51개 메뉴별 상세 매뉴얼, 부서별 퀵 네비게이션, 검색 키워드, A4 인쇄 서식',
    cognitiveSequence: [
      '1. 전사 51개 메뉴 및 20개 모달 매뉴얼 목록 스코핑',
      '2. 매뉴얼별 단계 뱃지 수, 버전, 최근 수정자 현황 확인',
      '3. 화면별 7단계 표준 업무 흐름 및 인지 조작 시퀀스 적합성 검토',
      '4. 마크다운 기능 정의서 편집기 호출 및 비즈니스 헌장 규격 갱신',
      '5. 모달 및 신규 기능 추가 시 인앱 단계 가이드 실시간 작성 및 위치 보정',
      '6. 전사 매뉴얼 시드 일괄 동기화(seedAllManuals) 실행',
      '7. 전사 운영 표준 매뉴얼 무결성 확정 및 배포'
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
        selector: '[data-mid="manual-menu-list"], .manual-list-card',
        type: 'stamp',
        label: '51개 메뉴 매뉴얼 목록',
        description: '전사 메뉴 및 모달 매뉴얼의 등록 상태와 버전을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="manual-version-badge"], .version-badge',
        type: 'highlight',
        label: '매뉴얼 버전 및 스텝 수',
        description: '각 매뉴얼의 7단계 워크플로우 반영 여부와 버전을 확인합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="manual-sequence-viewer"], .sequence-panel',
        type: 'stamp',
        label: '7단계 업무 흐름 검토',
        description: 'Gutenberg Z-패턴에 따른 인지·조작 7단계 1-Way 시퀀스를 검토합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="btn-open-spec-editor"], button:contains("기능 정의서")',
        type: 'click_ripple',
        label: '마크다운 정의서 편집',
        description: '메뉴별 기능 정의서(.md) 모달을 열어 비즈니스 명세를 편집합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-author-mode"], button:contains("매뉴얼 작성")',
        type: 'stamp',
        label: '인앱 단계 가이드 보정',
        description: '실제 화면 위에서 단계 요소 위치와 설명을 실시간 수정합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-seed-all-manuals"], button:contains("시드 전체 동기화")',
        type: 'click_ripple',
        label: '전사 매뉴얼 일괄 동기화',
        description: 'SSOT 최신 7단계 매뉴얼을 Supabase DB에 100% 일괄 시딩합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 7,
        selector: '[data-mid="manual-publish-status"], .publish-status',
        type: 'click_ripple',
        label: '운영 매뉴얼 배포 확정',
        description: '전사 임직원 및 MCP 에이전트용 최신 운영 매뉴얼을 공식 배포합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'error_report',
    version: 4,
    menuName: '오류 신고',
    groupId: 'grp_tools',
    groupName: '도구 및 다운로드',
    department: '전사 임직원',
    archetype: '유형 A: 요청 처리형 (Card Dossier)',
    objective: '시스템 버그, 데이터 불일치, 화면 멈춤 등 장애 발생 시 화면 캡처와 브라우저 로그를 첨부하여 개발팀에 즉각 접수 (신속 핫픽스 큐 연동)',
    scopeInfo: '발생 메뉴, 오류 현상 설명, 재현 경로, 스크린샷 이미지, 사용자 브라우저/OS 정보, 콘솔 로그',
    cognitiveSequence: [
      '1. 오류 발생 기간 및 심각도(CRITICAL, WARNING, INFO) 스코핑',
      '2. 브라우저 콘솔 에러, 네트워크 실패, DB RLS 차단 로그 상세 확인',
      '3. 발생 사용자 세션, 기기(PC/모바일), 화면 URL 추적',
      '4. 무음 실패(Silent Swallow) 방지 헌장 5.2 준수 여부 점검',
      '5. 오류 재현 절차 확인 및 임시 조치 가이드 등록',
      '6. 버그 패치 배포 후 오류 티켓 상태 해결됨(RESOLVED) 전환',
      '7. 시스템 안정성 지표(가용성 99.9%) 확정 및 재발 방지 대책 수립'
    ],
        modalWorkflows: [
          {
                "modalName": "시스템 오류 등록 팝업 (Error Register Modal)",
                "triggerButton": "[오류 등록]",
                "keyFields": [
                      "오류 발생 메뉴",
                      "오류 유형(UI 깨짐, 데이터 불일치, DB 저장 실패 등)",
                      "화면 캡처 첨부",
                      "발생 경로 및 증상"
                ],
                "terminalAction": "[오류 등록 완료]",
                "afterStateTransition": "개발팀 시스템 이슈 트래커에 즉시 연동 및 접수 번호 발행"
          }
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
        selector: '[data-mid="error-severity-filter"], .severity-filters',
        type: 'stamp',
        label: '오류 심각도 스코프',
        description: '치명적 장애(CRITICAL), 경고, 일반 예외별로 기간을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="error-log-detail"], .error-detail-card',
        type: 'highlight',
        label: '에러 스택 및 로그 상세',
        description: 'JS 에러 스택 트레이스, API 실패 응답, SQL 에러 코드를 확인합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="error-device-info"], .device-box',
        type: 'stamp',
        label: '사용자 기기 및 브라우저',
        description: '발생 사용자의 기기(모바일/데스크탑), 해상도, OS 버전을 추적합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="zero-silent-check"], .silent-check-box',
        type: 'callout',
        label: '무음 실패 방지 검증',
        description: '에러 발생 시 사용자 모달 표출(헌장 5.2)이 정상 작동했는지 점검합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="reproduction-steps"], .steps-box',
        type: 'stamp',
        label: '오류 재현 경로',
        description: '어떤 버튼 클릭과 데이터 입력 중에 장애가 발생했는지 재현합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-resolve-error"], button:contains("해결 완료")',
        type: 'click_ripple',
        label: '오류 티켓 종결 처리',
        description: '버그 픽스 배포 후 해당 오류의 상태를 해결됨(RESOLVED)으로 전환합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 7,
        selector: '[data-mid="system-uptime-card"], .uptime-card',
        type: 'click_ripple',
        label: '시스템 가용성 확정',
        description: '월간 시스템 무결성과 가용성 99.9% 달성을 검증하고 마감합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },

  // ─── 10. 시스템관리 - 개발자 (grp_system_dev) ─────────────
  {
    menuId: 'agentic_ai_lab',
    version: 4,
    menuName: '에이전틱 AI 샌드박스 랩',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발/기획팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '멀티에이전트 자율 의사결정 모델, 고소작업대 MRO 도메인 지식 파이프라인, 프롬프트 테스트 및 자율 최적화 연구',
    scopeInfo: '에이전트 모델(LLaMA 3.3, Gemini Flash), 도메인 지식 사전, 테스트 프롬프트, 추론 지연시간/비용',
    cognitiveSequence: [
      '1. 에이전틱 AI 실험 파이프라인 및 테스트 모델 스코핑',
      '2. 자연어 ERP 프롬프트 입력 및 의도(Intent) 분석 테스트',
      '3. MCP(Model Context Protocol) 툴 호출 및 스키마 검증',
      '4. 가상 비즈니스 이벤트 시뮬레이션 및 안전성 가드레일 점검',
      '5. 타 부서 권한 침해 방지(영업의 자산번호 임의 지정 차단 등) 검증 (헌장 2.1)',
      '6. 보존 법칙(날짜, 수지, 상태 보존) 충족 여부 테스트 (헌장 5.5)',
      '7. 에이전트 실험 결과 감사 로그 확정 및 정식 워크플로우 승격 검토'
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
        selector: '[data-mid="ai-pipeline-selector"], .pipeline-select',
        type: 'stamp',
        label: '에이전트 파이프라인 스코프',
        description: '배차, 정산, 고객대응 등 실험할 에이전트 모델을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="ai-prompt-input"], textarea.prompt-input',
        type: 'highlight',
        label: '자연어 지시문 입력',
        description: '현장 비즈니스 시나리오를 자연어 프롬프트로 주입합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="mcp-tool-call-log"], .mcp-tool-log',
        type: 'callout',
        label: 'MCP 툴 호출 추적',
        description: '에이전트가 호출한 시스템 툴과 인자 스키마의 정합성을 검증합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="guardrail-status-badge"], .guardrail-badge',
        type: 'stamp',
        label: '안전성 가드레일',
        description: '허용되지 않은 데이터 수정이나 권한 월경 시도를 차단합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="rr-compliance-check"], .rr-box',
        type: 'stamp',
        label: '부서 R&R 준수 판정',
        description: '영업-출고 R&R 분리 원칙(헌장 2.1)을 준수했는지 판정합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="conservation-law-test"], .conservation-box',
        type: 'highlight',
        label: '3대 보존법칙 검증',
        description: '날짜 보존, 수지 보존, 상태 보존의 법칙 충족 여부를 확인합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-promote-workflow"], button:contains("정식 승격")',
        type: 'click_ripple',
        label: '실험 결과 승인 확정',
        description: '검증된 에이전트 로직을 정식 운영 워크플로우로 승격 확정합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'agentic_dispatch_studio',
    version: 4,
    menuName: '에이전틱 배차 관제 스튜디오',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발/배차팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '차량 위치 기반 최적 배차 경로, 실시간 교통 상황, 셀프 톤수별 적재율을 AI가 자율 시뮬레이션하고 최적 기사를 자동 추천하는 관제탑',
    scopeInfo: '미배정 배차 건수, 등록 운송 기사 위치 데이터, 지오코딩 좌표, 차종별 표준 요율표',
    cognitiveSequence: [
      '1. 미배정 출고 의뢰 큐 및 주기장 보유 장비 가용성 실시간 스코핑',
      '2. 최적 운송 경로 및 차량 적재 시뮬레이션 (왕복 EXCHANGE 단일 배차 우선)',
      '3. 운송사별 과거 정시성 및 운송료 할인율 기반 최적 기사 자동 추천',
      '4. 기상 악화(강풍/폭우) 위험 지역 배차 자동 경보 및 우회 경로 안내',
      '5. 배차 의뢰서 자동 생성 및 운송 기사 모바일 푸시 발송',
      '6. 기사 수락 및 실시간 운송 상태(상차, 이동, 도착) 자동 트래킹',
      '7. 배차 완료 확정 및 운송료 대사 원장 자동 전이'
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
        selector: '[data-mid="studio-dispatch-queue"], .studio-queue',
        type: 'stamp',
        label: '출고 의뢰 자율 큐',
        description: '자율 배차 대상 대기 의뢰 건들을 긴급도 순으로 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="route-optimization-map"], .route-map',
        type: 'highlight',
        label: '최적 운송 경로 시뮬레이션',
        description: '출발 주기장과 도착 현장 간 최단·최적 운송 동선을 산출합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="driver-ai-recommend"], .recommend-card',
        type: 'callout',
        label: '최적 기사 AI 매칭',
        description: '평점과 왕복 운송비 할인율을 평가하여 1순위 최적 기사를 추천합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="weather-hazard-alert"], .weather-hazard',
        type: 'stamp',
        label: '기상 위험 자동 경보',
        description: '현장 풍속 10m/s 이상 강풍 시 고소작업 상차 안전 경보를 표출합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="btn-auto-dispatch-push"], button:contains("지령 자동발송")',
        type: 'click_ripple',
        label: '모바일 배차 지령 발송',
        description: '기사 모바일 PWA로 배차 의뢰서와 전자 작업지시서를 자동 전송합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="live-tracking-panel"], .tracking-panel',
        type: 'stamp',
        label: '운송 상태 실시간 추적',
        description: '상차 완료, 고속도로 이동, 현장 도착 상태를 자동 트래킹합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-confirm-auto-dispatch"], button.btn-confirm',
        type: 'click_ripple',
        label: '배차 완료 및 대사 이관',
        description: '배차를 최종 종결하고 월말 운송료 대사 대장으로 자동 전이합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'agentic_settlement_autopilot',
    version: 4,
    menuName: '에이전틱 월말 대사 정산 오토파일럿',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발/회계팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '수백 건의 운송료, 부품 매입, 렌탈 매출 데이터를 AI 정산 엔진이 1원 단위로 사전 대사하고 이상치/단가 위반을 자율 적발하는 무인 정산기',
    scopeInfo: '전사 청구서 엑셀, 계약 원장 일할 단가, 운송사 세금계산서, 은행 계좌 거래 내역',
    cognitiveSequence: [
      '1. 월말 정산 오토파일럿 대상 거래처 및 정산 연월 스코핑',
      '2. 통장 입금 내역 ➔ 미수금 원장 자동 1:1 대사 실행 (인공지능 매칭율 98% 이상)',
      '3. 자산별 정밀 일할 매출 기여액 자동 집계 및 대차 교체 승계 검증 (헌장 4.1)',
      '4. 전자세금계산서 청구서 자동 팩킹 및 국세청 전송 큐 생성',
      '5. 운송료 및 부품 매입 채무 자동 대차대조 검증 (청구 = 확정 + 반려)',
      '6. 이상 차액 발생 건 사전 격리 및 회계 담당자 확인 큐 분기',
      '7. 월말 자율 정산 마감 확정 및 대차대조 감사 리포트 자동 생성'
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
        selector: '[data-mid="autopilot-scope-card"], .autopilot-scope',
        type: 'stamp',
        label: '정산 대상 거래처 스코프',
        description: '당월 정산 오토파일럿 대상 거래처와 마감일을 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="ai-bank-matching-engine"], .matching-engine',
        type: 'highlight',
        label: '통장 1:1 자율 매칭',
        description: '수신된 입금 내역을 미수금 청구서와 1:1 자율 매칭하여 수납 처리합니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="pro-rata-audit-engine"], .prorata-engine',
        type: 'callout',
        label: '일할 매출 승계 검증',
        description: '대차 교체 자산의 일할 매출 기여액 바통 승계를 수학적으로 검증합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="auto-invoice-pack"], .invoice-pack-box',
        type: 'stamp',
        label: '세금계산서 자동 팩킹',
        description: '거래명세서와 세금계산서 데이터를 자동 패키징하여 국세청 전송을 준비합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="balance-equation-engine"], .equation-engine',
        type: 'stamp',
        label: '대차대조 검증 엔진',
        description: '청구총액 = 확정액 + 반려액 | 대차 차액 ₩0 무결성을 입증합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="anomaly-isolation-queue"], .anomaly-queue',
        type: 'callout',
        label: '이상 차액 격리 큐',
        description: '1원이라도 불일치하는 이상 건은 격리하여 회계 검토 큐로 분기합니다.',
        badgeColor: '#E53935',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-run-autopilot-close"], button:contains("오토파일럿 마감")',
        type: 'click_ripple',
        label: '월말 자율 정산 마감',
        description: '무결성이 확정된 정산 원장을 최종 마감하고 감사 리포트를 발행합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'agentic_asset_lifecycle',
    version: 4,
    menuName: '에이전틱 자산 라이프사이클 관제',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발/자산관리팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '개별 고소작업대별 누적 매출 기여도, 고장 빈도, 정비 비용, 잔존 장부가액을 실시간 추적하여 최적 매각/정비 타이밍을 제시하는 자산 AI 관제탑',
    scopeInfo: '자산 마스터, 계약별 누적 매출 기여액(헌장 4.1), 정비비 투입 누계, 가동일수/유휴일수',
    cognitiveSequence: [
      '1. 전사 고소작업대 자산 생애주기(취득 ➔ 운용 ➔ 정비 ➔ 매각) 스코핑',
      '2. 장비별 가동 시간(Hour Meter) 및 정비 점수 기반 이상 징후 예지 보전 감지',
      '3. 출고 검수 승인 즉시 RENTED 전환 및 반납 시 정비 큐 자동 라우팅 (헌장 1.3)',
      '4. 렌탈료 누적 매출 기여액 대비 총 정비 비용 분석 (자산별 순수익성 산출)',
      '5. 노후/한계 자산 매각 및 폐기 권고 시점 자동 도출',
      '6. 대체 신규 장비 도입 사양 및 자산 투자 회수 기간 예측',
      '7. 자산 생애주기 건전성 리포트 확정 및 주기장 운용 최적화'
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
        selector: '[data-mid="lifecycle-overview-card"], .lifecycle-overview',
        type: 'stamp',
        label: '자산 생애주기 스코프',
        description: '취득부터 폐기까지 전사 자산의 라이프사이클 단계를 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="predictive-maintenance-box"], .predict-box',
        type: 'highlight',
        label: '예지 보전 이상 징후',
        description: '아워미터와 정비 빈도를 분석하여 모터/배터리 고장 징후를 사전 경보합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="state-transition-tracker"], .transition-tracker',
        type: 'stamp',
        label: '상태 전이 인과율 추적',
        description: '출고 승인 시 RENTED 전환 및 입고 시 정비 큐 라우팅을 추적합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="asset-roi-analysis"], .roi-card',
        type: 'callout',
        label: '자산별 순수익성 분석',
        description: '누적 렌탈 매출액 - (취득가 + 누적 정비비 + 운송비) = 순수익을 산출합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="disposal-recommend-card"], .recommend-disposal',
        type: 'stamp',
        label: '매각 권고 시점 도출',
        description: '수리비 증가율이 매출 기여액을 초과하는 한계 장비의 매각을 제안합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="replacement-plan-box"], .replacement-box',
        type: 'stamp',
        label: '대체 신규 장비 도입 계획',
        description: '신규 고소작업대 모델 도입 시 예상 투자 회수 기간(ROI)을 시뮬레이션합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-publish-lifecycle-report"], button:contains("자산 건전성 확정")',
        type: 'click_ripple',
        label: '생애주기 리포트 확정',
        description: '자산 운용 최적화 리포트를 확정하고 주기장 배치 전략에 반영합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'initial_db_upload',
    version: 4,
    menuName: '초기DB 업로드',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '시스템관리자',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '신규 테넌트 구축 또는 과거 레거시 시스템 이관 시 고객, 장비, 자산 원장 엑셀 파일의 정합성을 검증하고 원자적(Atomic) 초기 적재',
    scopeInfo: '엑셀 템플릿(고객사, 자산대장, 단가표), 데이터 유효성 검증 규칙, 테넌트 ID',
    cognitiveSequence: [
      '1. 업로드 대상 마스터 탭(고객, 장비모델, 실물자산, 부품, 계약) 스코핑',
      '2. 전사 표준 엑셀 양식 템플릿 다운로드 및 컬럼 규격 확인',
      '3. 작성된 엑셀 파일 드래그 앤 드롭 업로드 및 실시간 파싱',
      '4. 엑셀 데이터 유효성 사전 검증 (중복 사업자번호, 필수 제원 누락 적발)',
      '5. 오류 행 인라인 수정 및 정상 데이터 임시 적재 테이블 매핑',
      '6. Supabase DB 일괄 트랜잭션 주입 (await db.awaitPendingWrites()) (헌장 5.2)',
      '7. 초기 데이터 적재 결과 검증 (총 건수, 성공 건수) 및 기준정보 확정'
    ],
        subTabs: [
          {
                "tabId": "INGEST",
                "tabName": "엑셀 데이터 적재",
                "purpose": "과거 ERP/엑셀 데이터(고객, 계약, 자산, 부품)의 무누락 DB 적재",
                "keyActions": [
                      "엑셀 파일 업로드",
                      "컬럼 매핑",
                      "유효성 검사",
                      "DB 적재"
                ]
          },
          {
                "tabId": "CLEANUP",
                "tabName": "데이터 정제 및 중복 제거",
                "purpose": "적재된 데이터 중 사업자번호 중복, 빈값, 비정상 포맷 정제",
                "keyActions": [
                      "중복 데이터 색출",
                      "일괄 병합/정제"
                ]
          },
          {
                "tabId": "BACKUP",
                "tabName": "DB 백업 및 스냅샷",
                "purpose": "대량 데이터 변경 전 시스템 전체 스냅샷 생성 및 롤백 보증",
                "keyActions": [
                      "스냅샷 생성",
                      "스냅샷 다운로드"
                ]
          },
          {
                "tabId": "RESET",
                "tabName": "테넌트 데이터 초기화",
                "purpose": "테스트 데이터 전면 소탕 및 청정 초기화 (최고관리자 전용)",
                "keyActions": [
                      "초기화 승인 코드 입력",
                      "테넌트 DB 초기화"
                ]
          }
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
        selector: '[data-mid="upload-target-tabs"], .upload-tabs',
        type: 'stamp',
        label: '업로드 대상 마스터',
        description: '고객, 모델, 자산, 부품, 계약 중 업로드할 마스터를 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-download-excel-template"], button:contains("양식 다운로드")',
        type: 'click_ripple',
        label: '표준 엑셀 양식 다운로드',
        description: '전사 스키마와 1:1 일치하는 표준 엑셀 입력 템플릿을 내려받습니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="excel-dropzone"], .dropzone-area',
        type: 'highlight',
        label: '엑셀 파일 드래그 업로드',
        description: '작성된 엑셀 파일을 드래그하여 브라우저 메모리로 즉시 파싱합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="upload-validation-shield"], .validation-panel',
        type: 'callout',
        label: '데이터 사전 검증 실드',
        description: '필수 컬럼 누락, 중복 키, 외래키 불일치를 사전에 100% 검출합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="staging-data-grid"], table.staging-table',
        type: 'stamp',
        label: '임시 적재 그리드 검토',
        description: '파싱된 데이터를 인라인 검토하고 필요 시 오류 값을 직접 수정합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-execute-db-insert"], button:contains("DB 주입 실행")',
        type: 'click_ripple',
        label: 'Supabase DB 일괄 주입',
        description: '검증된 데이터를 DB에 트랜잭션 주입하고 대기 완료를 검증합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 7,
        selector: '[data-mid="upload-result-summary"], .result-summary-box',
        type: 'click_ripple',
        label: '적재 결과 확정',
        description: '성공 건수와 실패 0건을 확인하고 초기 기준정보 적재를 종결합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'google_config',
    version: 4,
    menuName: '구글 관리자 설정',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '시스템관리자',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: 'Google Workspace, Drive, Cloud OCR API 및 OAuth 인증 키 환경설정 관리',
    scopeInfo: 'Google Client ID, Client Secret, 서비스 계정 JSON 키, Drive 공유 폴더 ID, OCR 엔드포인트',
    cognitiveSequence: [
      '1. 구글 워크스페이스 서비스 계정(OAuth2) 인증 상태 스코핑',
      '2. 동기화 대상 루트 폴더 ID 및 하위 폴더(계약서, 세금계산서, 검수사진) 구조 지정',
      '3. 자동 미러링 주기 및 실시간 동기화 데몬 연결 상태 확인',
      '4. 파일 업로드 테스트 (테스트 PDF 드라이브 전송 및 공유 링크 발급 검증)',
      '5. 드라이브 용량 한도 및 네트워크 타임아웃 예외 처리 설정',
      '6. 로컬 백업 사본 보존 정책 및 동기화 실패 재시도 큐 점검',
      '7. 구글 드라이브 클라우드 백업 설정 저장 및 정상 가동 확정'
    ],
        modalWorkflows: [
          {
                "modalName": "클라우드 파일 업로드/관리 팝업 (Cloud Storage Modal)",
                "triggerButton": "[스토리지 파일 관리]",
                "keyFields": [
                      "버킷 선택",
                      "업로드 대상 파일",
                      "접근 권한(공개/비공개)"
                ],
                "terminalAction": "[파일 업로드]",
                "afterStateTransition": "Cloudflare R2 스토리지에 영구 보존 및 CDN URL 발급"
          }
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
        selector: '[data-mid="google-auth-status"], .auth-status-card',
        type: 'stamp',
        label: '구글 OAuth 인증 상태',
        description: '구글 클라우드 서비스 계정 키 및 API 토큰 유효성을 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="folder-id-input"], input.folder-id',
        type: 'stamp',
        label: '루트 드라이브 폴더 ID',
        description: 'PDF와 사진이 백업 저장될 구글 드라이브 공유 폴더 ID를 지정합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="sync-interval-select"], .sync-interval',
        type: 'highlight',
        label: '동기화 주기 및 데몬',
        description: '실시간 미러링 주기와 백그라운드 동기화 데몬 가동 상태를 설정합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="btn-test-drive-upload"], button:contains("연동 테스트")',
        type: 'click_ripple',
        label: '드라이브 전송 테스트',
        description: '테스트 파일을 업로드하고 드라이브 웹 링크 생성을 즉시 검증합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 5,
        selector: '[data-mid="timeout-config-box"], .timeout-box',
        type: 'callout',
        label: '타임아웃 및 용량 경보',
        description: '네트워크 지연 시 재시도 횟수와 드라이브 잔여 용량 경보를 설정합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="failed-sync-queue"], .failed-queue',
        type: 'stamp',
        label: '실패 재시도 큐 관리',
        description: '네트워크 일시 단절로 실패한 파일의 자동 재시도 큐를 점검합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="btn-save-google-config"], button:contains("설정 저장")',
        type: 'click_ripple',
        label: '구글 동기화 가동 확정',
        description: '클라우드 미러링 설정을 최종 저장하고 자동 백업을 상시 가동합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
        spotlight: true,
      }
    ]
  },
  {
    menuId: 'dev_uploader',
    version: 4,
    menuName: '[개발] DB 데이터 업로더',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발자 전용',
    archetype: '유형 B: 기간 조회 및 정산/정리형 (High-Density Grid)',
    objective: '개발 및 WTT 스트레스 테스트를 위한 고밀도 합성 시나리오 데이터 주입 및 데이터베이스 마이그레이션 도구',
    scopeInfo: '테스트 배치 ID(test_batch_id), 테스트 계약/배차/자산 건수, 스트레스 주입 축(공간/물리/시간/비용/수량)',
    cognitiveSequence: [
      '1. 데이터베이스 DDL 스키마 및 마이그레이션 모드 스코핑',
      '2. 로컬 스키마 정의(schema.sql)와 원격 Supabase 정합성 자가 검증 (헌장 5.3)',
      '3. 신규 컬럼 및 테이블 추가 DDL 스크립트 프리뷰',
      '4. RLS(Row Level Security) 정책 멱등성 DROP/CREATE DDL 생성',
      '5. 마이그레이션 안전성 검증 및 백업 스냅샷 확인',
      '6. DDL 실행 및 테이블 스키마 캐시 리프레시',
      '7. DB 스키마 동기화 완료 및 전사 시스템 Ready 상태 확정'
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
        selector: '[data-mid="schema-mode-tabs"], .schema-tabs',
        type: 'stamp',
        label: '스키마 DDL 모드',
        description: '테이블 정의, 인덱스 생성, RLS 보안 정책 모드를 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="btn-validate-schema-ssot"], button:contains("정합성 검증")',
        type: 'click_ripple',
        label: 'SSOT 스키마 정합성 검증',
        description: '로컬 schema.sql과 원격 DB 간 컬럼 누락 여부를 자동 대조합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="ddl-editor-textarea"], textarea.ddl-editor',
        type: 'highlight',
        label: 'DDL 스크립트 에디터',
        description: '실행될 CREATE/ALTER TABLE DDL SQL 구문을 확인하고 편집합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="btn-generate-rls-ddl"], button:contains("RLS DDL 생성")',
        type: 'stamp',
        label: 'RLS 멱등성 DDL 생성',
        description: 'DROP IF EXISTS를 선행하는 멱등성 보안 정책 DDL을 동적 생성합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="safety-backup-checkbox"], .safety-check',
        type: 'callout',
        label: '안전 스냅샷 확인',
        description: '스키마 수정 전 데이터 손실 방지를 위한 백업 스냅샷을 확인합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="btn-execute-ddl"], button:contains("DDL 실행")',
        type: 'click_ripple',
        label: '원격 DDL 적용 실행',
        description: '원격 Supabase DB에 DDL을 즉각 실행하여 스키마를 업데이트합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 7,
        selector: '[data-mid="schema-ready-status"], .ready-status',
        type: 'click_ripple',
        label: '시스템 Ready 상태 확정',
        description: '스키마 캐시를 갱신하고 ERP 시스템 Ready 신호를 전사에 공표합니다.',
        badgeColor: '#10B981',
        positionHint: 'bottom',
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
    version: manual.version || 1,
    items: manual.annotations,
  };
}
