// @ts-nocheck
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
    version: 5,
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
        selector: '[data-mid="dashboard-sales-feed"]',
        type: 'stamp',
        label: '영업 수주 ToDo 피드',
        description: '영업팀에서 접수된 신규 수주 및 출고 의뢰 현황을 피드로 확인합니다.',
        badgeColor: '#10b981',
        positionHint: 'bottom',
        spotlight: true
      },
      {
        seq: 2,
        selector: '[data-mid="dashboard-dispatch-today"]',
        type: 'stamp',
        label: '당일 배차 현황',
        description: '당일 처리해야 할 상차/도착 배차 일정을 실시간으로 확인합니다.',
        badgeColor: '#3b82f6',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 3,
        selector: '[data-mid="dashboard-outbound-today"]',
        type: 'stamp',
        label: '출고 검수 완료',
        description: '당일 주기장 출고 검수가 완료된 장비 목록을 확인합니다.',
        badgeColor: '#8b5cf6',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 4,
        selector: '[data-mid="dashboard-bad-debt"]',
        type: 'stamp',
        label: '부실 채권 경보',
        description: '미수금액 연체 기한을 초과한 부실 채권 거래처를 확인합니다.',
        badgeColor: '#ef4444',
        positionHint: 'top',
        spotlight: true
      },
      {
        seq: 5,
        selector: '[data-mid="dashboard-weather-status"]',
        type: 'stamp',
        label: '기상 환경 모니터',
        description: '주기장 및 현장의 강풍/강우 등 기상 상태를 실시간 확인합니다.',
        badgeColor: '#6b7280',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 6,
        selector: '[data-mid="dashboard-stat-summary"]',
        type: 'stamp',
        label: '자산 가동 지표',
        description: '임대가능, 대여중, 정비중 등 핵심 자산 가동 지표를 조회합니다.',
        badgeColor: '#3b82f6',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 7,
        selector: '[data-mid="dashboard-quick-actions"]',
        type: 'stamp',
        label: '업무 바로가기',
        description: '직무별 전담 화면으로 즉시 이동하여 당일 업무를 시작합니다.',
        badgeColor: '#10b981',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 8,
        selector: '[data-mid="dashboard-terminal-todo"]',
        type: 'stamp',
        label: '당면 과제 완결',
        description: 'ToDo 피드 숫자가 0이 될 때까지 당일 담당 업무를 완결합니다.',
        badgeColor: '#ef4444',
        positionHint: 'top',
        spotlight: true
      }
    ]
  },

  // ─── 1. 결재 센터 (grp_approval) ──────────────────────────
  {
    menuId: 'approvalInbox',
    version: 5,
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
      '헌장 3.5 [Z-패턴 동선]: 좌상단 대기목록  중앙 본문 내용 검토  우하단 [승인/반려] 액션'
    ],
    precautions: [
      '직무 대결(Delegation) 설정 기간 중에는 대결자의 승인도 본인 승인과 동일한 법적/회계적 효력을 가짐',
      '반려 시에는 기안자가 보완할 수 있도록 구체적인 사유를 1줄 이상 명확히 기재'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="approvalInbox-header"]',
        type: 'stamp',
        label: '결재함 헤더',
        description: '대기 중인 전체 결재 건수를 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 2,
        selector: '[data-mid="approvalInbox-refresh"]',
        type: 'stamp',
        label: '결재함 새로고침',
        description: '최신 결재 요청 목록을 다시 불러옵니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 3,
        selector: '[data-mid="approvalInbox-list-container"]',
        type: 'stamp',
        label: '결재 대기 목록',
        description: '승인이나 반려 처리가 필요한 결재 건들의 목록입니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 4,
        selector: '[data-mid="approvalInbox-card"]',
        type: 'stamp',
        label: '개별 결재 카드',
        description: '각 결재 요청 건의 상세 정보와 액션 버튼을 포함합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 5,
        selector: '[data-mid="approvalInbox-card-header"]',
        type: 'stamp',
        label: '결재 유형 및 티어',
        description: '결재 규칙, 합의/결재 여부 및 최소 필요 티어 정보를 표시합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 6,
        selector: '[data-mid="approvalInbox-card-summary"]',
        type: 'stamp',
        label: '대상 건 요약',
        description: '결재 요청의 대상 테이블 및 관련 요약 정보를 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 7,
        selector: '[data-mid="approvalInbox-card-progress"]',
        type: 'stamp',
        label: '결재 진행 현황',
        description: '결재 프로세스의 전체 단계 및 현재 상태를 나타냅니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 8,
        selector: '[data-mid="approvalInbox-card-action"]',
        type: 'stamp',
        label: '승인 / 반려 처리',
        description: '해당 결재 건을 승인하거나 사유를 작성하여 반려합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'top',
        spotlight: false
      }
    ]
  },
  {
    menuId: 'approvalRules',
    version: 5,
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
        selector: '[data-mid="approvalRules-tabs"]',
        type: 'stamp',
        label: '메뉴 탭 전환',
        description: '결재선 규칙과 직급·직책 티어 설정 간 화면을 전환합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 2,
        selector: '[data-mid="approvalRules-sync"]',
        type: 'stamp',
        label: '표준 규칙 동기화',
        description: '시스템의 표준 결재 이벤트 목록을 동기화하여 가져옵니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 3,
        selector: '[data-mid="approvalRules-rules-grid"]',
        type: 'stamp',
        label: '결재선 규칙 목록',
        description: '이벤트별 전결 티어, 합의선 및 사용 여부를 설정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 4,
        selector: '[data-mid="approvalRules-tier-simulator"]',
        type: 'stamp',
        label: '유효 티어 판정 시뮬레이터',
        description: '설정한 직책과 직급의 조합에 따른 최종 결재 권한 티어를 시뮬레이션합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 5,
        selector: '[data-mid="approvalRules-duty-config"]',
        type: 'stamp',
        label: '직책별 티어 관리',
        description: '단위 조직 책임자의 직책 티어를 설정합니다. (직급보다 우선 적용됨)',
        badgeColor: '#1D4ED8',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 6,
        selector: '[data-mid="approvalRules-position-config"]',
        type: 'stamp',
        label: '직급별 티어 관리',
        description: '일반 사원 및 소규모 조직에 자동 적용될 직급 티어를 설정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'top',
        spotlight: false
      }
    ]
  },

  // ─── 2. 영업관리 (grp_sales) ──────────────────────────────
  {
    menuId: 'customer',
    version: 5,
    menuName: '고객 관리',
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  basicGuide: [
  {
    "seq": 1,
    "selector": "div[data-subview=\"payroll\"] .table-container",
    "type": "highlight",
    "label": "Payroll Grid",
    "description": "Displays the calculated payroll data for employees, including base salary, allowances, and tax deductions.",
    "badgeColor": "#3b82f6"
  },
  {
    "seq": 2,
    "selector": "div[data-subview=\"payroll\"] .btn-success",
    "type": "callout",
    "label": "Payroll Lock Status",
    "description": "Indicates and toggles the approval status of the payroll. Locking it prevents further data modifications for the selected month.",
    "badgeColor": "#10b981"
  }
],
  processes: [
  {
    "processId": "payroll_inquiry_and_lock",
    "title": "급여 대장 조회 및 잠금",
    "description": "Procedure to query the monthly payroll ledger and lock the records to prevent further modifications.",
    "steps": [
      {
        "seq": 1,
        "selector": "input[type=\"month\"]",
        "type": "click_ripple",
        "label": "Select Month",
        "description": "Select the target year and month to load the corresponding payroll data."
      },
      {
        "seq": 2,
        "selector": "div[data-subview=\"payroll\"] .table-container",
        "type": "highlight",
        "label": "View Payroll Ledger",
        "description": "Review the payroll ledger grid to ensure all data points are accurate."
      },
      {
        "seq": 3,
        "selector": "div[data-subview=\"payroll\"] .btn-success",
        "type": "click_ripple",
        "label": "Lock Payroll",
        "description": "Click the approval button to finalize the payroll and transition it to a locked state."
      }
    ]
  }
],
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
                selector: "[data-mid=\"payroll-scope-month\"]",
                type: "stamp",
                label: "정산 지급 연월 설정",
                description: "급여 지급 대상 연월 및 정산 기준일을 지정합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 2,
                selector: "[data-mid=\"payroll-scope-emp\"]",
                type: "stamp",
                label: "급여 대상 임직원 필터",
                description: "전체 사원, 정규직, 계약직, 현장 기사별로 정산 대상을 선택합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 3,
                selector: "[data-mid=\"payroll-pipeline-upload\"]",
                type: "stamp",
                label: "근태 및 수당 엑셀 업로드",
                description: "연장근무, 휴일수당, 식대, 차량보조금 실적을 엑셀로 일괄 반입합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 4,
                selector: "[data-mid=\"payroll-inspection-grid\"]",
                type: "stamp",
                label: "급여 정산 명세 대장",
                description: "기본급, 수당, 4대보험, 소득세 원천징수액 및 실지급액을 1:1 검증합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 5,
                selector: "[data-mid=\"payroll-terminal-audit-close\"]",
                type: "stamp",
                label: "급여 마감 최종 확정",
                description: "당월 급여 산출 내역을 확정 마감하고 회계 전표로 이관합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 6,
                selector: "[data-mid=\"payroll-terminal-audit-email\"]",
                type: "stamp",
                label: "급여명세서 전자 발송",
                description: "암호화된 개인별 급여명세서를 임직원 이메일로 일괄 전송합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 7,
                selector: "[data-mid=\"payroll-terminal-audit-excel\"]",
                type: "stamp",
                label: "급여 대장 엑셀 내보내기",
                description: "은행 급여 이체용 대장 및 급여 대장 원부를 엑셀로 다운로드합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        }
    ]
  },
  {
    menuId: 'leave_management',
    version: 5,
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
                selector: "[data-mid=\"leave-scope-emp\"]",
                type: "stamp",
                label: "임직원 연차 조회 조건",
                description: "귀속 연도, 부서, 사원명을 선택하여 연차 현황을 스코핑합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 2,
                selector: "[data-mid=\"leave-inspection-quota-grid\"]",
                type: "stamp",
                label: "연차 부여 및 잔여 대장",
                description: "근속연수별 발생 연차, 기사용 연차, 잔여 일수를 1:1 대조합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 3,
                selector: "[data-mid=\"leave-inspection-usage-grid\"]",
                type: "stamp",
                label: "연차 사용 상세 내역",
                description: "신청 일자, 휴가 유형(연차/반차/경조/병가), 사용 사유, 결재 상태를 조회합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 4,
                selector: "[data-mid=\"leave-pipeline-add\"]",
                type: "stamp",
                label: "연차 수동 조정 및 등록",
                description: "포상 휴가 가산, 이월 연차 반영 등 수동 가감 조정을 등록합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 5,
                selector: "[data-mid=\"leave-terminal-audit-excel\"]",
                type: "stamp",
                label: "연차 대장 엑셀 내보내기",
                description: "전사 연차 발생 및 사용 결산 현황을 엑셀 파일로 내려받습니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 6,
                selector: "[data-mid=\"leave-terminal-audit-delete\"]",
                type: "stamp",
                label: "연차 사용 내역 취소",
                description: "미승인 또는 취소 요청된 연차 내역을 삭제하고 잔여 연차를 복원합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 7,
                selector: "[data-mid=\"leave-pipeline-edit\"]",
                type: "stamp",
                label: "연차 발생 일수 수정",
                description: "입사일 기준 회계연도 비례 연차 부여 일수를 수정 저장합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 8,
                selector: "[data-mid=\"leave-inspection-summary\"]",
                type: "stamp",
                label: "연차 소진율 요약 지표",
                description: "전사 총 발생일수, 총 사용일수, 평균 소진율, 촉구 대상자를 모니터링합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        }
    ]
  },
  {
    menuId: 'privacy_audit',
    version: 5,
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
                selector: "[data-mid=\"privacy-scope-date\"]",
                type: "stamp",
                label: "감사 기간 범위 설정",
                description: "접속 로그 조회 시작일과 종료일을 지정하여 감사 범위를 확정합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 2,
                selector: "[data-mid=\"privacy-scope-text\"]",
                type: "stamp",
                label: "접속자 및 대상 검색",
                description: "조회 사원명, 로그인 계정, 고객 상호, 주민/사업자번호를 검색합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 3,
                selector: "[data-mid=\"privacy-scope-select\"]",
                type: "stamp",
                label: "수행 작업 유형 필터",
                description: "열람, 수정, 삭제, 엑셀 다운로드, 인쇄 등 작업 유형별로 필터링합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 4,
                selector: "[data-mid=\"privacy-inspection-grid\"]",
                type: "stamp",
                label: "개인정보 접속 감사 대장",
                description: "접속 일시, 접속자 IP, 접근 메뉴, 조회된 개인정보 항목, 사유를 실사합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 5,
                selector: "[data-mid=\"privacy-terminal-audit-excel\"]",
                type: "stamp",
                label: "감사 로그 엑셀 내보내기",
                description: "법적 증빙 보존을 위해 개인정보 접속 기록을 암호화 엑셀로 내려받습니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 6,
                selector: "[data-mid=\"privacy-pipeline-refresh\"]",
                type: "stamp",
                label: "감사 로그 즉시 갱신",
                description: "최신 발생된 접속 및 다운로드 이벤트를 원천 DB에서 즉시 재조회합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 7,
                selector: "[data-mid=\"privacy-inspection-detail\"]",
                type: "stamp",
                label: "접속 상세 패킷 검토",
                description: "대량 다운로드 또는 비정상 시간대 접속 건의 상세 페이로드를 확인합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        },
        {
                seq: 8,
                selector: "[data-mid=\"privacy-scope-header\"]",
                type: "stamp",
                label: "개인정보 감사 규정 요약",
                description: "법정 보존 기한(2년 이상), 이상 징후 알림 기준, 개인정보보호법 준수 지표를 조망합니다.",
                badgeColor: "#1D4ED8",
                positionHint: "bottom",
                spotlight: false
        }
    ]
  },

  // ─── 9. 도구 및 다운로드 (grp_tools) ──────────────────────
  {
    menuId: 'operations_manual',
    version: 5,
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
        selector: '[data-mid="operations_manual-scope"]',
        type: 'stamp',
        label: '매뉴얼 검색 스코프',
        description: '메뉴, 목표, 헌장 등 전체 매뉴얼 컨텐츠를 검색합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 2,
        selector: '[data-mid="operations_manual-filter"]',
        type: 'stamp',
        label: '부서 필터링',
        description: '담당 부서별로 매뉴얼을 필터링하여 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 3,
        selector: '[data-mid="operations_manual-pipeline-db"]',
        type: 'stamp',
        label: 'DB 일괄 주입',
        description: '모든 표준 매뉴얼을 DB에 영구 주입 및 동기화합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 4,
        selector: '[data-mid="operations_manual-pipeline-print"]',
        type: 'stamp',
        label: 'A4 인쇄',
        description: '선택된 매뉴얼 또는 전체 매뉴얼을 A4 규격으로 인쇄합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 5,
        selector: '[data-mid="operations_manual-inspection-nav"]',
        type: 'stamp',
        label: '메뉴 목록 네비게이션',
        description: '그룹화된 메뉴 목록에서 상세 조회할 매뉴얼을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'right',
        spotlight: false
      },
      {
        seq: 6,
        selector: '[data-mid="operations_manual-terminal-detail"]',
        type: 'stamp',
        label: '매뉴얼 상세 컨텐츠',
        description: '선택된 메뉴의 Z-패턴 조작 동선 및 감사 결과를 포함한 전체 매뉴얼을 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'left',
        spotlight: false
      },
      {
        seq: 7,
        selector: '[data-mid="operations_manual-inspection-card"]',
        type: 'stamp',
        label: '매뉴얼 요약 정보',
        description: '해당 메뉴의 소속 부서, 아키타입, 메뉴ID 등의 핵심 요약을 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      }
    ]
  },
  {
    menuId: 'error_report',
    version: 5,
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
        selector: '[data-mid="error_report-scope-status"]',
        type: 'stamp',
        label: '단계별 오류 현황',
        description: '신고등록, 접수처리, 완료 등 3대 단계별 오류 신고 현황을 한눈에 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 2,
        selector: '[data-mid="error_report-scope-filters"]',
        type: 'stamp',
        label: '신고 내역 검색 필터',
        description: '단계, 발생 메뉴, 중요도, 검색어 등을 통해 오류 신고 내역을 필터링합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 3,
        selector: '[data-mid="error_report-pipeline-export"]',
        type: 'stamp',
        label: '엑셀 내보내기',
        description: '현재 필터링된 오류 신고 내역을 엑셀 파일로 다운로드합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 4,
        selector: '[data-mid="error_report-pipeline-register"]',
        type: 'stamp',
        label: '신규 신고 등록',
        description: '새로운 시스템 오류, 버그, 또는 개선 요청을 등록합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 5,
        selector: '[data-mid="error_report-inspection-grid"]',
        type: 'stamp',
        label: '오류 신고 대장 그리드',
        description: '등록된 오류 신고의 처리 상태, 중요도, 신고자 및 담당자를 목록에서 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 6,
        selector: '[data-mid="error_report-modal-register"]',
        type: 'stamp',
        label: '신고 등록 모달',
        description: '발생 메뉴, 오류 유형, 상세 내용 및 증빙 화면 캡처 등을 첨부하여 신고를 접수합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 7,
        selector: '[data-mid="error_report-modal-detail"]',
        type: 'stamp',
        label: '신고 상세 및 처리 모달',
        description: '신고 상세 내역을 확인하고, 담당자 배정(접수) 및 조치 완료 처리를 수행합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'top',
        spotlight: false
      }
    ]
  },

  // ─── 10. 시스템관리 - 개발자 (grp_system_dev) ─────────────
  {
    menuId: 'agentic_ai_lab',
    version: 5,
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
        selector: '[data-mid="agentic_ai_lab-scope"]',
        type: 'stamp',
        label: '시나리오 프리셋',
        description: '다양한 에이전틱 AI 업무 시나리오 프리셋을 선택하여 신속하게 테스트합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 2,
        selector: '[data-mid="agentic_ai_lab-input"]',
        type: 'stamp',
        label: '자연어 프롬프트 입력',
        description: '에이전트에게 지시할 비즈니스 업무를 자연어로 직접 입력합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 3,
        selector: '[data-mid="agentic_ai_lab-pipeline-run"]',
        type: 'stamp',
        label: '단일 에이전트 실행',
        description: '입력된 프롬프트를 기반으로 AI 에이전트를 단발성으로 실행합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 4,
        selector: '[data-mid="agentic_ai_lab-pipeline-stress"]',
        type: 'stamp',
        label: '스트레스 테스트',
        description: '20회 연속으로 에이전트를 실행하여 시스템 부하 및 안정성을 테스트합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 5,
        selector: '[data-mid="agentic_ai_lab-metrics"]',
        type: 'stamp',
        label: '효익 정량 비교 HUD',
        description: '수동 작업 대비 AI가 절감한 시간, 조작 횟수 및 무결성 결과를 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 6,
        selector: '[data-mid="agentic_ai_lab-timeline"]',
        type: 'stamp',
        label: 'ReAct 추론 타임라인',
        description: 'AI 에이전트의 단계별 사고 과정(Thought) 및 도구 호출(Action) 내역을 모니터링합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 7,
        selector: '[data-mid="agentic_ai_lab-manifest"]',
        type: 'stamp',
        label: '도구 매니페스트',
        description: '에이전트가 활용 가능한 전사 표준 원자적(Atomic) API 도구 목록을 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      }
    ]
  },
  {
    menuId: 'agentic_dispatch_studio',
    version: 5,
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
        selector: '[data-mid="agentic_dispatch_studio-metrics"]',
        type: 'stamp',
        label: 'AI 배차 효율성 HUD',
        description: '수동 배차 대비 단축된 시간, 절감된 클릭 수 및 헌장 준수 현황을 실시간으로 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 2,
        selector: '[data-mid="agentic_dispatch_studio-input"]',
        type: 'stamp',
        label: '자연어 배차 지시 입력',
        description: '운송지, 장비, 요청 사항 등을 자연어로 입력하여 배차를 지시합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 3,
        selector: '[data-mid="agentic_dispatch_studio-pipeline-run"]',
        type: 'stamp',
        label: '배차 수립 실행',
        description: '에이전틱 AI가 자연어 지시를 분석하고 헌장 2.3을 검증하여 배차를 수립합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 4,
        selector: '[data-mid="agentic_dispatch_studio-inspection-deck"]',
        type: 'stamp',
        label: '배차 관제 큐',
        description: 'AI가 수립한 배차 의뢰 내역과 기존 배차 확정 내역을 목록으로 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'left',
        spotlight: false
      },
      {
        seq: 5,
        selector: '[data-mid="agentic_dispatch_studio-inspection-card"]',
        type: 'stamp',
        label: '배차 상세 카드',
        description: '개별 배차의 출고/회수/교환 유형, 운송 경로, 기사 정보 및 운송비 정산 내역을 상세 조회합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 6,
        selector: '[data-mid="agentic_dispatch_studio-terminal-confirm"]',
        type: 'stamp',
        label: '배차 최종 승인',
        description: 'AI가 자동 배정한 기사와 운송비를 검토 후 최종 배차를 확정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 7,
        selector: '[data-mid="agentic_dispatch_studio-audit-discount"]',
        type: 'stamp',
        label: '왕복할인 검증',
        description: '대차 교환 배차 시 헌장 2.3에 따른 왕복할인 정산이 정확히 차감되었는지 검증합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      }
    ]
  },
  {
    menuId: 'agentic_settlement_autopilot',
    version: 5,
    menuName: '에이전틱 월말 대사 정산 오토파일럿',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발/회계팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '수백 건의 운송료, 부품 매입, 렌탈 매출 데이터를 AI 정산 엔진이 1원 단위로 사전 대사하고 이상치/단가 위반을 자율 적발하는 무인 정산기',
    scopeInfo: '전사 청구서 엑셀, 계약 원장 일할 단가, 운송사 세금계산서, 은행 계좌 거래 내역',
    cognitiveSequence: [
      '1. 월말 정산 오토파일럿 대상 거래처 및 정산 연월 스코핑',
      '2. 통장 입금 내역  미수금 원장 자동 1:1 대사 실행 (인공지능 매칭율 98% 이상)',
      '3. 자산별 정밀 일할 매출 기여액 자동 집계 및 대차 교체 승계 검증 (헌장 4.1)',
      '4. 전자세금계산서 청구서 자동 팩킹 및 국세청 전송 큐 생성',
      '5. 운송료 및 부품 매입 채무 자동 대차대조 검증 (청구 = 확정 + 반려)',
      '6. 이상 차액 발생 건 사전 격리 및 회계 담당자 확인 큐 분기',
      '7. 월말 자율 정산 마감 확정 및 대차대조 감사 리포트 자동 생성'
    ],
    auditResult: '월말 정산 소요 시간 90% 단축 및 휴먼 에러로 인한 오지급 0건 실현',
    rulesCompliance: [
      '헌장 3.5 질문 4 [Audit Result]:  청구총액 = 🟢 확정액 +  반려액 | ️ 대차 차액 ₩0 엄격 확정',
      '헌장 4.1 [정밀 일할 집계]: 일할 계산 오차를 사전에 1원도 없이 전수 스캔'
    ],
    precautions: [
      '단가 특약이 적용된 특수 계약의 경우 AI가 계약서 메모 조항을 참조했는지 교차 확인',
      '자동 승인 한도액(예: 건당 500만원 초과)은 사람의 최종 결재를 거치도록 안전장치 유지'
    ],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="agentic_settlement_autopilot-header"]',
        type: 'stamp',
        label: '에이전틱 정산오토파일럿 헤더',
        description: '헌장 4.1 일할 매출 기여액 정산 오토파일럿 상태와 개요를 표시합니다.',
        badgeColor: '#10b981',
        positionHint: 'bottom',
        spotlight: true
      },
      {
        seq: 2,
        selector: '[data-mid="agentic_settlement_autopilot-scope"]',
        type: 'stamp',
        label: '정산 대상 및 기준 설정',
        description: '대사를 수행할 정산 연월, 대상 거래처, 지급 기준을 설정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 3,
        selector: '[data-mid="agentic_settlement_autopilot-scope-month"]',
        type: 'stamp',
        label: '정산 연월 선택',
        description: '정산하고자 하는 대상 연월을 정확히 선택합니다.',
        badgeColor: '#6b7280',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 4,
        selector: '[data-mid="agentic_settlement_autopilot-pipeline-run"]',
        type: 'stamp',
        label: '정산오토파일럿 실행',
        description: '에이전틱 AI가 입금 대사 및 일할 정산 대차대조 검증을 자동 수행합니다.',
        badgeColor: '#8b5cf6',
        positionHint: 'bottom',
        spotlight: true
      },
      {
        seq: 5,
        selector: '[data-mid="agentic_settlement_autopilot-status"]',
        type: 'stamp',
        label: '실행 상태 안내',
        description: '정산 AI의 실행 진행 상황 및 완료 상태를 실시간 안내합니다.',
        badgeColor: '#f59e0b',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 6,
        selector: '[data-mid="agentic_settlement_autopilot-inspection-grid"]',
        type: 'stamp',
        label: '대차대조 검증 그리드',
        description: '계약자산별 1원 오차 없는 정밀 일할 매출 기여액 내역을 표시합니다.',
        badgeColor: '#3b82f6',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 7,
        selector: '[data-mid="agentic_settlement_autopilot-terminal-summary"]',
        type: 'stamp',
        label: '정산 합계 및 대차 검증',
        description: '청구총액, 확정액, 반려액 합계를 통한 대차대조 무결성을 판정합니다.',
        badgeColor: '#10b981',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 8,
        selector: '[data-mid="agentic_settlement_autopilot-terminal-commit"]',
        type: 'stamp',
        label: '정산 확정 및 결과 반영',
        description: '대차 검증이 완료된 월말 정산 내역을 최종 확정 처리합니다.',
        badgeColor: '#ef4444',
        positionHint: 'top',
        spotlight: true
      }
    ]
  },
  {
    menuId: 'agentic_asset_lifecycle',
    version: 5,
    menuName: '에이전틱 자산 라이프사이클 관제',
    groupId: 'grp_system_dev',
    groupName: '시스템관리 - 개발자',
    department: '개발/자산관리팀',
    archetype: '유형 C: 대시보드 및 지식 포털 (Dashboard / Portal)',
    objective: '개별 고소작업대별 누적 매출 기여도, 고장 빈도, 정비 비용, 잔존 장부가액을 실시간 추적하여 최적 매각/정비 타이밍을 제시하는 자산 AI 관제탑',
    scopeInfo: '자산 마스터, 계약별 누적 매출 기여액(헌장 4.1), 정비비 투입 누계, 가동일수/유휴일수',
    cognitiveSequence: [
      '1. 전사 고소작업대 자산 생애주기(취득  운용  정비  매각) 스코핑',
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
        selector: '[data-mid="agentic_asset_lifecycle-header"]',
        type: 'stamp',
        label: '자산 생애주기 에이전트 헤더',
        description: '취득, 출고, 입고, 정비, 매각의 전 생애주기 에이전트 현황을 표시합니다.',
        badgeColor: '#10b981',
        positionHint: 'bottom',
        spotlight: true
      },
      {
        seq: 2,
        selector: '[data-mid="agentic_asset_lifecycle-scope"]',
        type: 'stamp',
        label: '자산 조회 스코프',
        description: '생애주기 추적 대상 자산의 관리번호, 모델명, 소유구분을 설정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 3,
        selector: '[data-mid="agentic_asset_lifecycle-pipeline-filter"]',
        type: 'stamp',
        label: '생애주기 단계 필터',
        description: '출고대기, 대여중, 주기장입고, 정비중 등 단계별 자산을 선별합니다.',
        badgeColor: '#8b5cf6',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 4,
        selector: '[data-mid="agentic_asset_lifecycle-timeline"]',
        type: 'stamp',
        label: '자산 생애주기 타임라인',
        description: '취득부터 현재까지 발생한 모든 입출고·정비 사건의 시계열 이력을 조회합니다.',
        badgeColor: '#3b82f6',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 5,
        selector: '[data-mid="agentic_asset_lifecycle-exchange-trace"]',
        type: 'stamp',
        label: '대차 교체 연결 추적',
        description: '헌장 4.2 준수: 전자산 회수 및 후장비 투입 1:1 연결 관계를 검증합니다.',
        badgeColor: '#f59e0b',
        positionHint: 'top',
        spotlight: true
      },
      {
        seq: 6,
        selector: '[data-mid="agentic_asset_lifecycle-inspection-details"]',
        type: 'stamp',
        label: '입출고 검수 상세 내역',
        description: '출고 PDI 및 입고 정비 점검표, 파손/오염 증빙 사진을 확인합니다.',
        badgeColor: '#10b981',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 7,
        selector: '[data-mid="agentic_asset_lifecycle-maintenance-score"]',
        type: 'stamp',
        label: '자산 정비 감가 수치',
        description: '가동시간, 정비점수, 안전검사 유효기간 등 자산 건전성 지표를 확인합니다.',
        badgeColor: '#6b7280',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 8,
        selector: '[data-mid="agentic_asset_lifecycle-terminal-audit"]',
        type: 'stamp',
        label: '상태 전환 확정',
        description: '출고 검수 승인 또는 입고 정비 완료 조치를 검증하여 자산 상태를 확정합니다.',
        badgeColor: '#ef4444',
        positionHint: 'top',
        spotlight: true
      }
    ]
  },
  {
    menuId: 'initial_db_upload',
    version: 5,
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
        selector: '[data-mid="initial_db_upload-header"]',
        type: 'stamp',
        label: '초기 DB 업로드 헤더',
        description: '초기 DB 업로드의 목적 및 진행 상태를 표시합니다.',
        badgeColor: '#2563eb',
        positionHint: 'bottom',
        spotlight: true
      },
      {
        seq: 2,
        selector: '[data-mid="initial_db_upload-tabs"]',
        type: 'stamp',
        label: '주요 작업 탭',
        description: '데이터 업로드, 정합성 검증, 백업, 초기화 등 작업 모드를 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 3,
        selector: '[data-mid="initial_db_upload-excel-import"]',
        type: 'stamp',
        label: '초기 현황 엑셀 업로드',
        description: '보유자산, 임대현황, 거래처 등 기초 데이터를 엑셀로 일괄 등록합니다.',
        badgeColor: '#8b5cf6',
        positionHint: 'bottom',
        spotlight: true
      },
      {
        seq: 4,
        selector: '[data-mid="initial_db_upload-hist-billing"]',
        type: 'stamp',
        label: '과거 미청구 청구서 생성',
        description: '과거 데이터를 기반으로 이전 청구 이력을 일괄 산출하여 등록합니다.',
        badgeColor: '#f59e0b',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 5,
        selector: '[data-mid="initial_db_upload-dispatch-import"]',
        type: 'stamp',
        label: '배차 이력 업로드',
        description: '과거 출고 및 회수 배차 내역을 엑셀로 업로드하여 데이터베이스를 동기화합니다.',
        badgeColor: '#3b82f6',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 6,
        selector: '[data-mid="initial_db_upload-band-import"]',
        type: 'stamp',
        label: '밴드 AS 이력 업로드',
        description: '네이버 밴드 등에 기록된 AS 내역 텍스트를 파싱하여 정비 이력으로 변환 저장합니다.',
        badgeColor: '#10b981',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 7,
        selector: '[data-mid="initial_db_upload-cleanup"]',
        type: 'stamp',
        label: '데이터 정합성 검증',
        description: '업로드된 데이터 중 중복 및 오류 데이터를 식별하고 정제합니다.',
        badgeColor: '#ef4444',
        positionHint: 'top',
        spotlight: true
      },
      {
        seq: 8,
        selector: '[data-mid="initial_db_upload-backup"]',
        type: 'stamp',
        label: '전체 DB 백업',
        description: '현재 구축된 전사 데이터베이스를 파일 또는 JSON 형태로 보존합니다.',
        badgeColor: '#6b7280',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 9,
        selector: '[data-mid="initial_db_upload-reset"]',
        type: 'stamp',
        label: '데이터 초기화',
        description: '전체 데이터를 모두 삭제하고 초기 상태로 환원하는 관리 작업을 수행합니다.',
        badgeColor: '#ef4444',
        positionHint: 'top',
        spotlight: false
      }
    ]
  },
  {
    menuId: 'google_config',
    version: 5,
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
        selector: '[data-mid="google_config-header"]',
        type: 'stamp',
        label: '구글 및 클라우드 연동 헤더',
        description: '클라우드 인프라 및 구글 계정 연동 화면의 상태를 안내합니다.',
        badgeColor: '#10b981',
        positionHint: 'bottom',
        spotlight: true
      },
      {
        seq: 2,
        selector: '[data-mid="google_config-auth"]',
        type: 'stamp',
        label: '구글 인증 계정 설정',
        description: '시스템 알림 발송 및 드라이브 백업에 사용할 구글 인증 계정을 설정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 3,
        selector: '[data-mid="google_config-storage"]',
        type: 'stamp',
        label: 'Supabase 스토리지 버킷 설정',
        description: '사진 및 검수 증빙 파일을 저장할 클라우드 스토리지 버킷 및 보안 정책을 관리합니다.',
        badgeColor: '#8b5cf6',
        positionHint: 'bottom',
        spotlight: false
      },
      {
        seq: 4,
        selector: '[data-mid="google_config-mode"]',
        type: 'stamp',
        label: '시스템 운영 모드 설정',
        description: '테스트용 로컬 모드와 클라우드 원격 운영을 위한 실무 모드를 전환합니다.',
        badgeColor: '#f59e0b',
        positionHint: 'top',
        spotlight: true
      },
      {
        seq: 5,
        selector: '[data-mid="google_config-r2"]',
        type: 'stamp',
        label: 'Cloudflare R2 스토리지 설정',
        description: '대용량 미디어 및 백업 데이터를 저장할 Cloudflare R2 버킷 정보를 설정합니다.',
        badgeColor: '#3b82f6',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 6,
        selector: '[data-mid="google_config-folders"]',
        type: 'stamp',
        label: '구글 드라이브 폴더 매핑',
        description: '계약서, 거래명세서 등 각종 문서를 백업할 구글 드라이브 전용 폴더 ID를 지정합니다.',
        badgeColor: '#6b7280',
        positionHint: 'top',
        spotlight: false
      },
      {
        seq: 7,
        selector: '[data-mid="google_config-save"]',
        type: 'stamp',
        label: '클라우드 환경설정 영구 저장',
        description: '입력된 모든 클라우드 인프라 및 연동 설정을 DB에 영구 반영합니다.',
        badgeColor: '#ef4444',
        positionHint: 'top',
        spotlight: true
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
