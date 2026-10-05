// @ts-nocheck
// src/data/allMenuManuals.ts
// 전사 모든 메뉴 기능의 본질적 업무 목적 및 표준 매뉴얼 데이터 (SSOT)
import type { ManualPage, ManualAnnotationItem, ManualProcessFlow } from '../types/manual';

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
  archetype: '유형 A: 요청 처리형 (카드형 상세)' | '유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)' | '유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)';
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
  basicGuide?: ManualAnnotationItem[]; // 2-Tier 기초 안내 (화면 개요)
  processes?: ManualProcessFlow[];     // 2-Tier 단위업무 흐름 워크플로우 (절차형)
  manualUrl?: string;         // 중앙 DB 연동 원문 매뉴얼 URL
}

export const ALL_MENU_MANUALS: MenuManualDetail[] = [
  {
    "menuId": "dashboard",
    "version": 10,
    "menuName": "ERP 대시보드",
    "groupId": "grp_top",
    "groupName": "메인",
    "department": "전사 공통",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "로그인한 임직원의 직무에 특화된 실시간 당면 과제(ToDo 피드) 파악 및 전사 가동/출고/정비/배차 자산 상태를 한눈에 모니터링하여 즉시 대응 조치 착수",
    "scopeInfo": "로그인 사용자 직무 권한(영업, 배차, 주기장, 정비, 관리)에 따른 맞춤형 ToDo 피드 및 당일 주기장 날씨/작업 환경 데이터",
    "cognitiveSequence": [
      "1. 상단 당면 과제(ToDo 피드) 카드뉴스 확인 (출고 검수 대기, 미배정 배차, AS 긴급 출동, 미결재 건 등)",
      "2. 주기장 기상 위젯 및 작업 환경 지표 점검 (강풍/강우 시 고소작업대 상하차 안전 유의)",
      "3. 주요 파이프라인 KPI 카운터(임대가능, 대여중, 정비중, 연체 채권) 클릭을 통한 해당 전담 메뉴 즉시 이동",
      "4. 배차 운송 및 출고 진행 파이프라인 확인 (당일 상차/출발/도착 실시간 추적)",
      "5. 긴급 A/S 및 입고 정비 큐 조망 (현장 긴급 출동 요망 건 및 수리 지연 건 식별)",
      "6. 월간 매출 목표 및 당일 정산 현황 검토 (청구 및 입금 대사 진행률 확인)",
      "7. 직무별 전담 화면 1클릭 바로가기를 통한 당일 업무 본격 착수"
    ],
    "modalWorkflows": [
      {
        "modalName": "업무 지시 및 공지 팝업",
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
    "auditResult": "당일 긴급 미처리 업무 0건 달성 및 전사 자산 상태 라이프사이클의 유기적 흐름 개시",
    "rulesCompliance": [
      "헌장 3.3 [사용자 맞춤형 직무 중심 ToDo 피드 대시보드 정책] 준수: 불필요한 공통 위젯 배제, 로그인 직무별 실시간 당면 과제 카드뉴스 우선 배치",
      "헌장 1.2 [렌탈 도메인 3대 핵심 가치] 준수: 임직원 최소 조작으로 당면 태스크 즉시 진입"
    ],
    "precautions": [
      "기상 악화(초속 10m/s 이상 강풍 등) 시 출고 검수 및 상하차 작업 시 안전 관리자 입회 필수",
      "ToDo 피드 숫자가 0이 될 때까지 당일 담당 업무 지속 조망"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dashboard-sales-feed\"]",
        "type": "stamp",
        "label": "영업 수주 할일 피드",
        "description": "영업팀에서 접수된 신규 수주 및 출고 의뢰 현황을 피드로 확인합니다.",
        "badgeColor": "#10b981",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dashboard-dispatch-today\"]",
        "type": "stamp",
        "label": "당일 배차 현황",
        "description": "당일 처리해야 할 상차/도착 배차 일정을 실시간으로 확인합니다.",
        "badgeColor": "#3b82f6",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"dashboard-outbound-today\"]",
        "type": "stamp",
        "label": "출고 검수 완료",
        "description": "당일 주기장 출고 검수가 완료된 장비 목록을 확인합니다.",
        "badgeColor": "#8b5cf6",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"dashboard-bad-debt\"]",
        "type": "stamp",
        "label": "부실 채권 경보",
        "description": "미수금액 연체 기한을 초과한 부실 채권 거래처를 확인합니다.",
        "badgeColor": "#ef4444",
        "positionHint": "top",
        "spotlight": true
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"dashboard-weather-status\"]",
        "type": "stamp",
        "label": "기상 환경 모니터",
        "description": "주기장 및 현장의 강풍/강우 등 기상 상태를 실시간 확인합니다.",
        "badgeColor": "#6b7280",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"dashboard-stat-summary\"]",
        "type": "stamp",
        "label": "자산 가동 지표",
        "description": "임대가능, 대여중, 정비중 등 핵심 자산 가동 지표를 조회합니다.",
        "badgeColor": "#3b82f6",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"dashboard-quick-actions\"]",
        "type": "stamp",
        "label": "업무 바로가기",
        "description": "직무별 전담 화면으로 즉시 이동하여 당일 업무를 시작합니다.",
        "badgeColor": "#10b981",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"dashboard-terminal-todo\"]",
        "type": "stamp",
        "label": "당면 과제 완결",
        "description": "ToDo 피드 숫자가 0이 될 때까지 당일 담당 업무를 완결합니다.",
        "badgeColor": "#ef4444",
        "positionHint": "top",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "approvalInbox",
    "version": 10,
    "menuName": "내 결재함 (수신)",
    "groupId": "grp_approval",
    "groupName": "결재 센터",
    "department": "전사 관리자/임원",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "본인에게 상신된 결재 건(계약 체결, 대차 교체, 단가 할인, 운송비 예외, 연차/OT 등)의 전후 맥락을 검토하여 원클릭 승인 또는 사유 기재 반려 처리",
    "scopeInfo": "로그인 사용자의 직급 티어(Tier 1~7) 및 위임(Delegation) 권한에 따라 도달한 [대기] 상태 결재 문서 목록",
    "cognitiveSequence": [
      "1. 상단 결재함 탭 스코핑 (결재 대기 / 진행중 / 결재 완료 / 참조 문서)",
      "2. 결재 유형 필터링 (정산, 계약, 인사, 자산, 고객, 보고 6대 유형 분류)",
      "3. 결재 문서 상세 컨텍스트 검토 (품의 내용, 청구 금액, 거래처, 첨부 서류 확인)",
      "4. 결재선 티어 및 전결 규정 검증 (기안자 직급·직책 및 필요 승인 티어 적합성 판정)",
      "5. 지출/정산 대차대조 수학적 검증 (단가, 수량, 계좌번호, 세금계산서 증빙 1:1 대사)",
      "6. 사전 합의 및 협조 의견 작성 (필요 시 수정/보완 요구)",
      "7. 최종 전자서명 승인 및 사유 명시 반려 (Audit Trail 영구 보존 확정)"
    ],
    "subTabs": [
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
    "modalWorkflows": [
      {
        "modalName": "결재 합의 및 승인/반려 다이얼로그",
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
    "auditResult": "결재 승인 즉시 차순위 결재자 인계 또는 최종 확정(Approved) 전환 및 감사 로그 영구 기록",
    "rulesCompliance": [
      "헌장 1.2 [이벤트 기록 무누락 DB 저장]: 승인/반려 시각, 결재자 식별자, 결재 의견 DB 완벽 저장",
      "헌장 3.1 [무수식어 건조 UI 표준]: 건조한 명사/동사([승인], [반려], [결재선]) 구조 준수",
      "헌장 3.5 [Z-패턴 동선]: 좌상단 대기목록  중앙 본문 내용 검토  우하단 [승인/반려] 액션"
    ],
    "precautions": [
      "직무 대결(Delegation) 설정 기간 중에는 대결자의 승인도 본인 승인과 동일한 법적/회계적 효력을 가짐",
      "반려 시에는 기안자가 보완할 수 있도록 구체적인 사유를 1줄 이상 명확히 기재"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"approvalInbox-header\"]",
        "type": "stamp",
        "label": "결재함 헤더",
        "description": "대기 중인 전체 결재 건수를 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"approvalInbox-refresh\"]",
        "type": "stamp",
        "label": "결재함 새로고침",
        "description": "최신 결재 요청 목록을 다시 불러옵니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"approvalInbox-list-container\"]",
        "type": "stamp",
        "label": "결재 대기 목록",
        "description": "승인이나 반려 처리가 필요한 결재 건들의 목록입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"approvalInbox-card\"]",
        "type": "stamp",
        "label": "개별 결재 카드",
        "description": "각 결재 요청 건의 상세 정보와 액션 버튼을 포함합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"approvalInbox-card-header\"]",
        "type": "stamp",
        "label": "결재 유형 및 티어",
        "description": "결재 규칙, 합의/결재 여부 및 최소 필요 티어 정보를 표시합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"approvalInbox-card-summary\"]",
        "type": "stamp",
        "label": "대상 건 요약",
        "description": "결재 요청의 대상 테이블 및 관련 요약 정보를 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"approvalInbox-card-progress\"]",
        "type": "stamp",
        "label": "결재 진행 현황",
        "description": "결재 프로세스의 전체 단계 및 현재 상태를 나타냅니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"approvalInbox-card-action\"]",
        "type": "stamp",
        "label": "승인 / 반려 처리",
        "description": "해당 결재 건을 승인하거나 사유를 작성하여 반려합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "approvalRules",
    "version": 10,
    "menuName": "결재선 규칙 설정",
    "groupId": "grp_approval",
    "groupName": "결재 센터",
    "department": "경영지원/시스템관리",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "테넌트별 7단계 직급 티어(Tier 1~7) 매핑, 문서 카테고리별 필수 결재선/합의(Consensus) 조건, 금액별 전결 한도 규칙 정의 및 직무 대결 관리",
    "scopeInfo": "테넌트 식별자, 등록된 직급/직책 체계, 문서 카테고리(계약, 배차, 할인, 비용, 인사) 목록",
    "cognitiveSequence": [
      "1. 상단 결재 카테고리 탭 스코핑 (고객, 계약, 자산, 정산, 인사, 보고 6대 유형)",
      "2. 전사 직급별·직책별 결재 권한 티어(0~7티어) 설정 현황 점검",
      "3. 비즈니스 이벤트별 기준 금액 및 전결 필요 티어 지정",
      "4. 부서간 사전 합의 부서(영업/관리/임원) 체인 구성",
      "5. 일상업무 불필요 결재선 제거 및 실익 중심 검증 (헌장 1.2)",
      "6. [표준 규칙 동기화] 버튼을 통한 DB 누락 규칙 자동 주입",
      "7. 결재선 규칙 최종 저장 및 인사 관리 연동 확정"
    ],
    "subTabs": [
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
    "auditResult": "전사 결재 상신 시 해당 룰에 따라 결재선과 합의자가 오차 없이 자동 생성되는 기준 확립",
    "rulesCompliance": [
      "헌장 5.3 [단일 진실의 원천(SSOT)]: 결재 티어 레벨을 전사 단일 표준(Tier 1~7)으로 관리",
      "헌장 7.1 [멀티테넌트 아키텍처]: 테넌트별 독립적인 결재 규칙 및 직급 매핑 보장"
    ],
    "precautions": [
      "티어 규칙 수정 시 현재 상신 진행 중인 결재선에는 영향을 주지 않으며, 신규 상신 건부터 적용됨",
      "대표이사(Tier 7) 전결 규칙 설정 시 합의선 누락 여부를 반드시 시뮬레이터로 검증"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"approvalRules-tabs\"]",
        "type": "stamp",
        "label": "메뉴 탭 전환",
        "description": "결재선 규칙과 직급·직책 티어 설정 간 화면을 전환합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"approvalRules-sync\"]",
        "type": "stamp",
        "label": "표준 규칙 동기화",
        "description": "시스템의 표준 결재 이벤트 목록을 동기화하여 가져옵니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"approvalRules-rules-grid\"]",
        "type": "stamp",
        "label": "결재선 규칙 목록",
        "description": "이벤트별 전결 티어, 합의선 및 사용 여부를 설정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"approvalRules-tier-simulator\"]",
        "type": "stamp",
        "label": "유효 티어 판정 시뮬레이터",
        "description": "설정한 직책과 직급의 조합에 따른 최종 결재 권한 티어를 시뮬레이션합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"approvalRules-duty-config\"]",
        "type": "stamp",
        "label": "직책별 티어 관리",
        "description": "단위 조직 책임자의 직책 티어를 설정합니다. (직급보다 우선 적용됨)",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"approvalRules-position-config\"]",
        "type": "stamp",
        "label": "직급별 티어 관리",
        "description": "일반 사원 및 소규모 조직에 자동 적용될 직급 티어를 설정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "customer",
    "version": 10,
    "menuName": "고객 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid='customer-search-filter']",
        "type": "highlight",
        "label": "검색 및 필터 영역",
        "description": "검색어, 거래 상태 또는 필수 서류 누락 여부로 고객사 목록을 필터링합니다."
      },
      {
        "seq": 2,
        "selector": "[data-mid='customer-list-panel']",
        "type": "highlight",
        "label": "고객사 목록",
        "description": "등록된 고객사 목록을 표시하며, 클릭하여 상세 제원을 조회합니다.",
        "positionHint": "right"
      }
    ],
    "processes": [
      {
        "processId": "register_customer",
        "title": "고객 등록",
        "description": "신규 고객사의 기본 정보를 입력하여 정식 등록합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid='btn-new-customer']",
            "type": "click_ripple",
            "label": "신규 고객 등록 버튼",
            "description": "신규 고객 등록 버튼을 클릭하여 입력 팝업 창을 엽니다."
          },
          {
            "seq": 2,
            "selector": "[data-mid='input-customer-name']",
            "type": "callout",
            "label": "고객사명",
            "description": "등록할 신규 고객사의 공식 상호명을 입력합니다."
          },
          {
            "seq": 3,
            "selector": "[data-mid='input-biz-no']",
            "type": "callout",
            "label": "사업자등록번호",
            "description": "국세청 사업자등록번호 10자리를 입력합니다."
          }
        ]
      },
      {
        "processId": "view_customer_details",
        "title": "고객 상세 조회",
        "description": "선택한 고객사의 상세 정보, 현장 내역, 담당자 연락처를 조회합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid='customer-grid-item']",
            "type": "click_ripple",
            "label": "고객사 선택",
            "description": "목록에서 고객사 행을 클릭하여 상세 정보를 화면에 불러옵니다."
          },
          {
            "seq": 2,
            "selector": "[data-mid='customer-detail-dossier']",
            "type": "highlight",
            "label": "고객사 상세 정보",
            "description": "선택한 고객사의 상세 제원, 소속 현장 목록, 계약 이력을 정밀 검토합니다.",
            "positionHint": "left"
          }
        ]
      }
    ],
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "고객사(원청, 전문건설사, 발주처)의 기본 정보, 사업자등록증, 현장 담당자 연락망, 신용 한도 및 미수 채권 상태 통합 관리",
    "scopeInfo": "사업자등록번호, 상호명, 대표자, 업태/종목, 전자세금계산서 발행 이메일, 현장 담당자 정보",
    "cognitiveSequence": [
      "1. 거래처 통합 검색 및 거래 상태/초성 필터링 (상호, 사업자번호, 대표자, 거래제한 여부)",
      "2. 고객 및 현장 운용 KPI 실시간 집계 검토 (총 고객사, 정상사, 거래제한/폐업, 현장수)",
      "3. 고객사 대장 목록 탐색 및 선택 (등록증 미등록 업체 및 결손 정보 즉시 파악)",
      "4. 선택 고객사 360도 마스터 상세 도시에 검토 (사업자정보, 대표연락처, 청구조건)",
      "5. 사업자등록증 AI OCR 자동 등록 및 정보 보완 (이미지/PDF 기반 상호/대표자 자동 파싱)",
      "6. 국세청 홈택스 사업자 휴폐업 전수 점검 및 여신 리스크 방어",
      "7. 신규 고객 등록 및 신규 현장·담당자 매핑 (계약 체결 가용화)"
    ],
    "subTabs": [
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
    "modalWorkflows": [
      {
        "modalName": "거래처 및 현장 등록/홈택스 검증 팝업",
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
    "auditResult": "고객 마스터 등록 완결 및 신규 계약 체결 시 자동 완성 데이터 원천 구축",
    "rulesCompliance": [
      "헌장 3.2 [줄바꿈 방지 원칙]: 거래처명, 사업자번호, 대표자 셀에 `white-space: nowrap` 적용",
      "헌장 3.4 [상하 스택 배치]: 등록 모달 폼의 모든 레이블-입력창 상하 세로 스택 준수"
    ],
    "precautions": [
      "동일 사업자등록번호의 중복 등록을 엄격히 방지하여 매출/미수금 집계 왜곡 차단",
      "세금계산서 역발행 업체의 경우 전용 전자계산서 수신 이메일을 정확히 기재"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"customer-search-filter\"], .customer-filters",
        "type": "stamp",
        "label": "거래처 검색 필터",
        "description": "상호명, 사업자번호, 거래 상태, 초성별로 거래처를 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"customer-kpi-summary\"], .kpi-summary-cards",
        "type": "highlight",
        "label": "고객 운용 지표 요약",
        "description": "총 고객사, 정상 거래사, 거래제한/폐업, 등록 현장수를 모니터링합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"customer-list-panel\"], .customer-list-box",
        "type": "stamp",
        "label": "고객사 대장 목록",
        "description": "등록된 전체 거래처와 등록증 미등록 상태를 실시간 탐색합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "right",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"customer-detail-dossier\"], .customer-detail-panel",
        "type": "highlight",
        "label": "고객 상세 도시에",
        "description": "선택한 고객사의 상호, 대표자, 연락처, 거래제한 여부를 통합 검토합니다.",
        "badgeColor": "#D97706",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"btn-ocr-biz-license\"], button:contains(\"사업자등록증\")",
        "type": "click_ripple",
        "label": "사업자등록증 인공지능 보완",
        "description": "사업자등록증 이미지를 올려 상호, 대표자, 등록번호를 자동 파싱합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"btn-nts-audit\"], button:contains(\"국세청\")",
        "type": "callout",
        "label": "국세청 휴폐업 점검",
        "description": "국세청 홈택스 실시간 API로 정상/휴업/폐업 여부를 즉시 검증합니다.",
        "badgeColor": "#4F46E5",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"btn-new-customer\"], button:contains(\"신규 고객 등록\")",
        "type": "click_ripple",
        "label": "신규 고객 등록",
        "description": "신규 거래처 및 투입 현장을 신규 등록하고 여신 거래를 개시합니다.",
        "badgeColor": "#10B981",
        "positionHint": "bottom",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "site_options",
    "version": 6,
    "menuName": "현장별 옵션 관리",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부 / 출고부",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "고소작업대 렌탈 현장별 유상옵션, 보양작업, 요구사양을 옵션품목마스터로부터 100% 자동 상속받고 현장 특약 단가를 오버라이드하여 계약/출고/배차 파이프라인과 완벽 연동",
    "scopeInfo": "고객사 필터, 현장 검색어, 선택된 현장, 옵션품목마스터(StandardOption) 품목군(유상/보양/사양), 현장 특약단가, 필수 장착 여부, 현장 메모",
    "cognitiveSequence": [
      "1. 좌상단 고객사 필터 및 현장 검색창을 통해 대상 현장 스코핑",
      "2. 좌측 등록 현장 목록에서 옵션을 설정할 특정 현장 선택",
      "3. 우측 상속 작업대 상단에서 [마스터 초기화] 또는 [고객사 기본값 상속] 클릭으로 1클릭 상속 실행",
      "4. 중앙 1. 유상 옵션 그리드에서 적용할 옵션 체크박스 활성화 및 현장 특약단가(₩) 오버라이드 입력",
      "5. 2. 보양 작업 카드에서 해당 현장 환경에 부합하는 보양 규격 1종 선택",
      "6. 3. 현장 요구 사양에서 안전인증, 경광등, 센서 연동 등 필수 점검 항목 체크",
      "7. 우하단 요약 바에서 적용 유상옵션 건수, 선택된 보양작업, 월 유상옵션 총액 합계 검증",
      "8. 우하단 [현장 옵션 설정 저장] 버튼을 클릭하여 CustomerSite DB에 100% 동기화 저장 완료"
    ],
    "auditResult": "총 옵션 항목수 = 활성 옵션수 + 비활성 옵션수 | 월 유상옵션 총액 = Σ(활성 유상옵션별 현장 특약단가)",
    "rulesCompliance": [
      "헌장 1.1: 임직원 최소 노력으로 마스터 옵션을 1클릭 상속받아 현장 옵션값을 즉시 구축하는 최대 편익 달성",
      "헌장 2.2: 옵션품목마스터 기준단가 및 고객사 기본 옵션 속성 100% 자동 상속 원칙 완결",
      "헌장 3.1: 감성적 수식어 배제 및 건조한 명사·동사 UI 단일 표준 준수",
      "헌장 3.2: 테이블 셀 white-space: nowrap 적용으로 줄바꿈 방지",
      "헌장 3.5: 좌측 현장 스코프  우측 상속 작업대  우하단 월 옵션 총액 및 최종 저장 4단계 Gutenberg Z-패턴 동선 확립"
    ],
    "precautions": [
      "현장별 옵션은 반드시 옵션품목마스터(StandardOption)의 품목 체계를 상속받아 구성되어야 합니다.",
      "현장에서 특약 단가를 변경한 경우 계약서 및 견적서 옵션 청구 항목에 해당 특약 단가가 우선 적용됩니다.",
      "보양작업은 현장별 1종 선택(라디오)이 원칙이며, 미선택 시 기본 상속 처리됩니다."
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"filter-panel\"]",
        "type": "stamp",
        "label": "조회 조건 패널",
        "description": "고객사 필터 및 현장 검색창을 통해 대상 현장을 스코핑합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"tab-toggle\"]",
        "type": "stamp",
        "label": "탭 전환",
        "description": "현장별 옵션 관리 작업대와 옵션 품목 마스터 간 화면을 전환합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"panel-site-scope\"]",
        "type": "stamp",
        "label": "현장 선택",
        "description": "옵션을 설정할 고객 현장을 목록에서 클릭 선택합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "right",
        "spotlight": true
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"btn-inherit-master\"]",
        "type": "stamp",
        "label": "마스터 상속",
        "description": "옵션품목마스터의 모든 표준 품목 및 기준단가를 1클릭 상속받습니다.",
        "badgeColor": "#10B981",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"table-paid-options\"]",
        "type": "stamp",
        "label": "유상 옵션",
        "description": "현장에 투입될 유상옵션 적용 여부와 현장 특약단가를 인라인 입력합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"card-protection-options\"]",
        "type": "stamp",
        "label": "보양 작업",
        "description": "현장 환경에 부합하는 보호 완충/함석 보양 규격을 1종 선택합니다.",
        "badgeColor": "#059669",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"summary-monthly-fee\"]",
        "type": "stamp",
        "label": "월 옵션 총액",
        "description": "적용 유상옵션 건수, 보양작업 및 월 청구 옵션 총액을 검증합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"btn-save-site-options\"]",
        "type": "stamp",
        "label": "설정 저장",
        "description": "작업대에서 구성한 옵션값을 해당 현장의 DB 레코드에 최종 저장합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": true
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"scope-site-search\"]",
        "type": "callout",
        "label": "현장 검색 및 선택",
        "description": "옵션 단가를 설정하거나 상속받을 대상 현장을 검색합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"inspection-options-grid\"]",
        "type": "highlight",
        "label": "현장 안전옵션 매트릭스",
        "description": "해당 현장의 유상옵션 및 법정 안전사양 단가를 실시간 조망합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "process_site_options_sync",
        "title": "현장별 안전옵션 특약 설정 및 상속 동기화",
        "description": "현장 특성에 맞는 안전옵션을 지정하고 계약 및 배차 파이프라인으로 100% 자동 상속합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"scope-site-search\"]",
            "type": "callout",
            "label": "관리 대상 현장 선택",
            "description": "좌측 현장 목록에서 옵션을 커스텀할 공사 현장을 선택합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"pipeline-inherit-master\"]",
            "type": "click_ripple",
            "label": "표준 옵션 상속",
            "description": "표준 옵션 마스터로부터 기본 안전 규격을 100% 자동 상속받습니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"inspection-options-grid\"]",
            "type": "highlight",
            "label": "현장 특약 단가 조정",
            "description": "협의된 특약 단가를 인라인으로 입력하여 표준 단가를 오버라이드합니다.",
            "positionHint": "top"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"terminal-save-options\"]",
            "type": "click_ripple",
            "label": "옵션 설정 확정 저장",
            "description": "변경된 현장 안전옵션 구성을 DB에 영구 저장합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "contract",
    "version": 10,
    "menuName": "계약 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "div[data-mid=\"contract-detailed-filters\"]",
        "type": "highlight",
        "label": "상세 검색 필터",
        "description": "다양한 검색 조건을 활용해 고객사, 현장 등의 계약을 조회할 수 있습니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "div[data-mid=\"contract-table\"]",
        "type": "highlight",
        "label": "계약 목록 그리드",
        "description": "조회된 계약의 요약 정보를 확인하며, 행을 클릭해 상세 뷰로 진입할 수 있습니다.",
        "positionHint": "top"
      },
      {
        "seq": 3,
        "selector": "div[data-mid=\"contract-filter-panel\"] > div:nth-child(3)",
        "type": "highlight",
        "label": "상태별 퀵 필터",
        "description": "진행, 만료 임박, 종결 등 상태 칩을 클릭해 조건에 맞는 계약을 빠르게 필터링합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "process_contract_register",
        "title": "신규 계약 등록",
        "description": "새로운 렌탈 계약을 등록하고 자산을 할당하는 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "button[data-mid=\"btn-new-contract\"]",
            "type": "click_ripple",
            "label": "신규 등록 탭 진입",
            "description": "'신규 계약 등록' 버튼을 클릭하여 입력 폼을 엽니다."
          },
          {
            "seq": 2,
            "selector": "div[data-mid=\"create-contract-cust\"] select",
            "type": "callout",
            "label": "고객사 선택",
            "description": "계약을 체결할 고객사를 검색하고 선택합니다."
          },
          {
            "seq": 3,
            "selector": "div[data-mid=\"create-contract-start-date\"] input",
            "type": "callout",
            "label": "계약 시작일 지정",
            "description": "렌탈이 시작되는 계약 시작일을 입력합니다."
          },
          {
            "seq": 4,
            "selector": "div[data-mid=\"create-contract-basket-picker\"] button.btn-primary",
            "type": "click_ripple",
            "label": "자산 바스켓 추가",
            "description": "제품 모델과 렌탈료를 설정한 뒤 '+ 추가' 버튼을 눌러 바스켓에 담습니다."
          },
          {
            "seq": 5,
            "selector": "button[data-mid=\"create-contract-submit\"]",
            "type": "click_ripple",
            "label": "계약 등록 완료",
            "description": "모든 정보를 확인한 뒤 '계약 등록' 버튼을 클릭하여 완료합니다."
          }
        ]
      },
      {
        "processId": "process_contract_extend",
        "title": "계약 연장 및 단축",
        "description": "진행 중인 계약의 기간을 변경(연장/단축)하는 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "button[data-mid=\"contract-detail-action\"]",
            "type": "click_ripple",
            "label": "계약 상세 진입",
            "description": "진행 중인 계약 목록에서 '상세 ' 버튼을 클릭합니다."
          },
          {
            "seq": 2,
            "selector": "div[data-subview=\"contract_detail\"] > div.card:first-child button.btn-primary",
            "type": "click_ripple",
            "label": "기간 연장/단축 실행",
            "description": "화면 상단의 '기간 연장/단축' 버튼을 클릭하여 모달을 엽니다."
          },
          {
            "seq": 3,
            "selector": "div[style*=\"z-index: 1000\"] form.card input[type=\"date\"]",
            "type": "callout",
            "label": "종료일 변경",
            "description": "새롭게 변경할 만료일(종료일)을 지정합니다."
          },
          {
            "seq": 4,
            "selector": "div[style*=\"z-index: 1000\"] form.card button[type=\"submit\"]",
            "type": "click_ripple",
            "label": "변경 내용 저장",
            "description": "사유를 기재한 후 '저장' 버튼을 클릭해 반영합니다."
          }
        ]
      },
      {
        "processId": "process_contract_exchange",
        "title": "대차 출고 의뢰",
        "description": "운용 중인 장비의 고장 등으로 인해 자산을 교체/대차하는 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "button[data-mid=\"contract-detail-action\"]",
            "type": "click_ripple",
            "label": "계약 상세 진입",
            "description": "진행 중인 계약 목록에서 '상세 ' 버튼을 클릭합니다."
          },
          {
            "seq": 2,
            "selector": "div[data-subview=\"contract_detail\"] > div:nth-child(3) > div:nth-child(2) > div:first-child button.btn-secondary",
            "type": "click_ripple",
            "label": "대차 의뢰 실행",
            "description": "체결 자산 목록 우측 상단의 '자산 교체/대차 의뢰' 버튼을 클릭합니다."
          },
          {
            "seq": 3,
            "selector": "div[style*=\"z-index: 1000\"] form.card select:first-of-type",
            "type": "callout",
            "label": "회수 자산 선택",
            "description": "회수할 기존 자산 번호 혹은 모델을 선택합니다."
          },
          {
            "seq": 4,
            "selector": "div[style*=\"z-index: 1000\"] form.card input[type=\"text\"]",
            "type": "callout",
            "label": "사유 입력",
            "description": "대차가 필요한 사유 및 현장 상황을 기재합니다."
          },
          {
            "seq": 5,
            "selector": "div[style*=\"z-index: 1000\"] form.card button[type=\"submit\"]",
            "type": "click_ripple",
            "label": "대차 의뢰 완료",
            "description": "'대차 의뢰 접수' 버튼을 클릭하여 출고와 회수 배차를 동시 발행합니다."
          }
        ]
      }
    ],
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "고소작업대 렌탈 임대차 계약 체결, 계약 기간, 대여 자산 기여액 일할 집계(헌장 4.1), 대차/교체 시 계약 속성 100% 자동 상속(헌장 2.2), 계약 변경 이력 무누락 보존",
    "scopeInfo": "고객사, 현장 주소, 요구 장비 규격/수량, 임대 시작/종료일, 월 렌탈료 단가, 청구 마감일 조건",
    "cognitiveSequence": [
      "1. 계약 조회 조건 설정 및 스코핑 (고객사, 현장, 계약기간, 진행상태 필터링)",
      "2. 계약 운용 실시간 KPI 지표 검토 (총 계약건수, 진행/연장, 만료임박, 월 렌탈료 합계)",
      "3. 통합 빠른 검색 및 계약 유형 전환 (렌탈 계약 ↔ 매각 계약 1클릭 전환)",
      "4. 고밀도 계약 대장 그리드 1:1 대사 (출고 마일스톤, 투입 장비 모델/수량, 마감일 검증)",
      "5. 계약 상세 조회 및 라이프사이클 조치 ([상세 ] 클릭: 기간변경, 단가조정, EXCHANGE 대차)",
      "6. 계약서 패키지 통합 발행 및 엑셀 대장 출력 (계약서·작업지시서·안전옵션 PDF 및 엑셀)",
      "7. 신규 계약 작성 및 전자 체결 ([+ 신규 계약 등록] 클릭: 고객/현장 매핑 및 장비 단가 체결)"
    ],
    "subTabs": [
      {
        "tabId": "ALL_LIST",
        "tabName": "계약 대장 목록",
        "purpose": "체결된 전체 렌탈 계약의 기간, 상태, 청구 조건, 자산 목록 통합 조망",
        "keyActions": [
          "계약 상세 조회",
          "계약서 PDF 인쇄",
          "기간 연장/단축",
          "대차 교체 의뢰"
        ],
        "basicGuide": [
          {
            "seq": 1,
            "selector": "div[data-mid=\"contract-detailed-filters\"]",
            "type": "highlight",
            "label": "상세 검색 필터",
            "description": "다양한 검색 조건을 활용해 고객사, 현장 등의 계약을 조회할 수 있습니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "div[data-mid=\"contract-table\"]",
            "type": "highlight",
            "label": "계약 목록 그리드",
            "description": "조회된 계약의 요약 정보를 확인하며, 행을 클릭해 상세 뷰로 진입할 수 있습니다.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "div[data-mid=\"contract-filter-panel\"] > div:nth-child(3)",
            "type": "highlight",
            "label": "상태별 퀵 필터",
            "description": "진행, 만료 임박, 종결 등 상태 칩을 클릭해 조건에 맞는 계약을 빠르게 필터링합니다.",
            "positionHint": "bottom"
          }
        ],
        "processes": [
          {
            "processId": "process_contract_register",
            "title": "신규 계약 등록",
            "description": "새로운 렌탈 계약을 등록하고 자산을 할당하는 절차입니다.",
            "steps": [
              {
                "seq": 1,
                "selector": "button[data-mid=\"btn-new-contract\"]",
                "type": "click_ripple",
                "label": "신규 등록 탭 진입",
                "description": "'신규 계약 등록' 버튼을 클릭하여 입력 폼을 엽니다."
              },
              {
                "seq": 2,
                "selector": "div[data-mid=\"create-contract-cust\"] select",
                "type": "callout",
                "label": "고객사 선택",
                "description": "계약을 체결할 고객사를 검색하고 선택합니다."
              },
              {
                "seq": 3,
                "selector": "div[data-mid=\"create-contract-start-date\"] input",
                "type": "callout",
                "label": "계약 시작일 지정",
                "description": "렌탈이 시작되는 계약 시작일을 입력합니다."
              },
              {
                "seq": 4,
                "selector": "div[data-mid=\"create-contract-basket-picker\"] button.btn-primary",
                "type": "click_ripple",
                "label": "자산 바스켓 추가",
                "description": "제품 모델과 렌탈료를 설정한 뒤 '+ 추가' 버튼을 눌러 바스켓에 담습니다."
              },
              {
                "seq": 5,
                "selector": "button[data-mid=\"create-contract-submit\"]",
                "type": "click_ripple",
                "label": "계약 등록 완료",
                "description": "모든 정보를 확인한 뒤 '계약 등록' 버튼을 클릭하여 완료합니다."
              }
            ]
          },
          {
            "processId": "process_contract_extend",
            "title": "계약 연장 및 단축",
            "description": "진행 중인 계약의 기간을 변경(연장/단축)하는 절차입니다.",
            "steps": [
              {
                "seq": 1,
                "selector": "button[data-mid=\"contract-detail-action\"]",
                "type": "click_ripple",
                "label": "계약 상세 진입",
                "description": "진행 중인 계약 목록에서 '상세 ' 버튼을 클릭합니다."
              },
              {
                "seq": 2,
                "selector": "div[data-subview=\"contract_detail\"] > div.card:first-child button.btn-primary",
                "type": "click_ripple",
                "label": "기간 연장/단축 실행",
                "description": "화면 상단의 '기간 연장/단축' 버튼을 클릭하여 모달을 엽니다."
              },
              {
                "seq": 3,
                "selector": "div[style*=\"z-index: 1000\"] form.card input[type=\"date\"]",
                "type": "callout",
                "label": "종료일 변경",
                "description": "새롭게 변경할 만료일(종료일)을 지정합니다."
              },
              {
                "seq": 4,
                "selector": "div[style*=\"z-index: 1000\"] form.card button[type=\"submit\"]",
                "type": "click_ripple",
                "label": "변경 내용 저장",
                "description": "사유를 기재한 후 '저장' 버튼을 클릭해 반영합니다."
              }
            ]
          },
          {
            "processId": "process_contract_exchange",
            "title": "대차 출고 의뢰",
            "description": "운용 중인 장비의 고장 등으로 인해 자산을 교체/대차하는 절차입니다.",
            "steps": [
              {
                "seq": 1,
                "selector": "button[data-mid=\"contract-detail-action\"]",
                "type": "click_ripple",
                "label": "계약 상세 진입",
                "description": "진행 중인 계약 목록에서 '상세 ' 버튼을 클릭합니다."
              },
              {
                "seq": 2,
                "selector": "div[data-subview=\"contract_detail\"] > div:nth-child(3) > div:nth-child(2) > div:first-child button.btn-secondary",
                "type": "click_ripple",
                "label": "대차 의뢰 실행",
                "description": "체결 자산 목록 우측 상단의 '자산 교체/대차 의뢰' 버튼을 클릭합니다."
              },
              {
                "seq": 3,
                "selector": "div[style*=\"z-index: 1000\"] form.card select:first-of-type",
                "type": "callout",
                "label": "회수 자산 선택",
                "description": "회수할 기존 자산 번호 혹은 모델을 선택합니다."
              },
              {
                "seq": 4,
                "selector": "div[style*=\"z-index: 1000\"] form.card input[type=\"text\"]",
                "type": "callout",
                "label": "사유 입력",
                "description": "대차가 필요한 사유 및 현장 상황을 기재합니다."
              },
              {
                "seq": 5,
                "selector": "div[style*=\"z-index: 1000\"] form.card button[type=\"submit\"]",
                "type": "click_ripple",
                "label": "대차 의뢰 완료",
                "description": "'대차 의뢰 접수' 버튼을 클릭하여 출고와 회수 배차를 동시 발행합니다."
              }
            ]
          }
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
    "modalWorkflows": [
      {
        "modalName": "대차 교체 의뢰 팝업",
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
        "modalName": "계약 변경(기간 연장 / 단가 변경) 팝업",
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
    "auditResult": "유효 계약 체결 확정 및 자산별 매출 기여액 정밀 일할 집계 기반 마련",
    "rulesCompliance": [
      "헌장 2.1 [부서 R&R 엄격 분리]: 영업부서는 계약 관점 대차 요구 발행만 담당, 개별 자산번호 직접 선택 금지",
      "헌장 2.2 [계약 속성 100% 자동 상속]: 대차 장비는 최초 계약 단가/마감일/현장속성 자동 상속",
      "헌장 4.1 [자산별 매출 기여액 정밀 일할 집계]: 전자산 전일 마감  후장비 당일 승계 완벽 일치",
      "헌장 4.2 [대차 교체 1:1 완벽 추적성]: contractHistory에 CHANGE_TYPE=EXCHANGE 무누락 보존"
    ],
    "precautions": [
      "계약 기간 연장/단축 시 반드시 [기간 변경] 기능을 통해 일할 정산 기준일 갱신 필수",
      "현장 주소 오기입 시 배차 운송비 차액이 발생하므로 도로명 주소 정밀 확인"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"contract-filter-panel\"], .contract-filters",
        "type": "stamp",
        "label": "계약 조회 조건 설정",
        "description": "고객사, 현장, 계약 기간(시작/종료일) 및 진행 상태(진행중/만료임박/종결) 조회 조건을 설정하고 조회를 실행합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"contract-kpi-summary\"], .contract-kpi-cards",
        "type": "highlight",
        "label": "계약 운용 지표 요약",
        "description": "총 계약건수, 진행/연장 건, 만료 임박(D-3), 단가 0원 주의, 체결 투입자산 대수 및 월 렌탈료 합계를 실시간 확인합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"contract-search-bar\"], .contract-search-bar",
        "type": "stamp",
        "label": "통합 검색 및 유형 선택",
        "description": "계약번호, 고객사명, 현장명, 자산번호 빠른 검색 및 렌탈 계약 / 매각 계약 유형을 즉시 전환합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"contract-table\"], .contract-table-container",
        "type": "highlight",
        "label": "계약 대장 목록 대사",
        "description": "계약번호, 고객사, 현장, 출고 마일스톤, 체결 자산 모델/수량, 월 렌탈료 및 청구 마감일을 1:1 대사합니다.",
        "badgeColor": "#D97706",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"contract-detail-action\"], button:contains(\"상세\")",
        "type": "click_ripple",
        "label": "계약 상세 및 변경 조치",
        "description": "[상세 ]를 클릭하여 체결 자산 상세, 기간 연장/단축, 단가 변경, EXCHANGE 대차 의뢰를 조치합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "right",
        "spotlight": true
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"contract-export-actions\"], button:contains(\"계약서패키지\")",
        "type": "callout",
        "label": "계약서 패키지 및 엑셀",
        "description": "체결 계약서·작업지시서·안전옵션 패키지 PDF/이메일 일괄 발송 및 계약 대장 엑셀을 다운로드합니다.",
        "badgeColor": "#4F46E5",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"btn-new-contract\"], button:contains(\"신규 계약 등록\")",
        "type": "click_ripple",
        "label": "신규 계약 작성 등록",
        "description": "신규 렌탈/매각 임대차 계약서를 작성하고 고객사/현장 매핑, 장비 모델 및 월/일할 단가를 설정하여 체결합니다.",
        "badgeColor": "#10B981",
        "positionHint": "bottom",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "contract_create",
    "version": 10,
    "menuName": "신규 계약 등록",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "신규 고객사/현장 매핑, 영업담당 지정, 계약 기간 및 청구/결제 조건 설정, 장비 모델 및 단가 체결 완료",
    "scopeInfo": "고객사(거래처), 영업담당자, 계약 시작일, 만료일(또는 상시대여), 청구 마감일, 명세서 마감일, 약정 결제일, 투입 자산 모델 및 월 렌탈료",
    "cognitiveSequence": [
      "1. 고객사(거래처) 검색 및 선택 (연체 채권 및 거래제한 실시간 검증)",
      "2. 계약 총괄 사내 영업담당자 지정",
      "3. 장비 투입 및 과금 개시 계약 시작일 설정",
      "4. 계약 만료일 설정 또는 종료일 미정(상시 대여) 지정",
      "5. 청구 마감일, 거래명세서 마감일 및 약정 결제일 조건 확정",
      "6. 체결 대상 장비 모델 및 월 렌탈료 단가 입력 후 바스켓 추가",
      "7. 신규 계약 최종 등록 및 체결 완료 ([계약 등록])"
    ],
    "auditResult": "신규 임대차 계약 체결 확정 및 자산 대여/과금 라이프사이클 개시",
    "rulesCompliance": [
      "헌장 1.1 [최대 편익 달성]: 최소 입력으로 정확한 거래처 및 계약 속성 매핑",
      "헌장 1.2 [렌탈 자산 효과적 운용]: 계약 체결 즉시 출고 검수 및 배차 대기 파이프라인 연계",
      "헌장 2.1 [영업 R&R]: 영업은 제원 요구 및 단가 체결까지 담당"
    ],
    "precautions": [
      "거래제한 고객사는 신규 계약 등록이 차단되며 경영진 해제 승인 선행 필요",
      "미납 연체 채권 존재 거래처는 수금 책임 인지 체크박스 동의 필수"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"create-contract-cust\"], select[value*=\"custSelect\"]",
        "type": "stamp",
        "label": "고객사 선택 및 검증",
        "description": "거래처를 검색·선택하거나 신규 고객사를 등록합니다. 미납 연체 채권 및 경영진 출고제한 여부가 자동 검증됩니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"create-contract-salesperson\"], select[value*=\"salespersonSelect\"]",
        "type": "stamp",
        "label": "영업담당 지정",
        "description": "계약 체결 및 수금 관리를 총괄할 사내 영업담당 임직원을 지정합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"create-contract-start-date\"], input[type=\"date\"]",
        "type": "stamp",
        "label": "계약 시작일 설정",
        "description": "현장 장비 인도 및 렌탈료 과금이 공식 개시되는 계약 시작일을 설정합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"create-contract-end-date\"]",
        "type": "stamp",
        "label": "종료일 / 상시대여",
        "description": "약정 만료일을 입력하거나, 현장 종료 시까지 유지되는 종료일 미정(상시 대여)을 체크합니다.",
        "badgeColor": "#D97706",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"create-contract-billing-terms\"]",
        "type": "stamp",
        "label": "청구 마감 및 결제일",
        "description": "매월 청구 마감일(일), 명세서 마감일(일) 및 약정 결제일 조건을 설정합니다. (고객사 기본 조건 자동 연동)",
        "badgeColor": "#2563EB",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"create-contract-basket-picker\"]",
        "type": "callout",
        "label": "체결 자산 모델 및 단가",
        "description": "제품 모델(또는 자산 관리번호)을 선택하고 월 렌탈료 단가를 입력한 후 [+ 추가] 버튼으로 바스켓에 담습니다.",
        "badgeColor": "#4F46E5",
        "positionHint": "top",
        "spotlight": true
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"create-contract-submit\"], button[type=\"submit\"]:contains(\"계약 등록\")",
        "type": "click_ripple",
        "label": "신규 계약 최종 등록",
        "description": "입력된 계약 제원과 체결 자산 바스켓을 검증하고 [계약 등록]을 클릭하여 계약 체결을 완료합니다.",
        "badgeColor": "#10B981",
        "positionHint": "top",
        "spotlight": true
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"create-contract-customer\"]",
        "type": "callout",
        "label": "계약 거래처 선택",
        "description": "임대 계약을 체결할 고객사를 검색하고 선택합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"create-contract-submit\"]",
        "type": "click_ripple",
        "label": "계약 체결 저장",
        "description": "모든 계약 속성을 검증하고 신규 계약서를 확정 등록합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "process_contract_create_wizard",
        "title": "신규 임대차 계약 등록 7단계 완결",
        "description": "거래처 선택부터 시작일, 장비 스펙, 렌탈료 단가 산정까지 1화면에서 원스톱으로 체결합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"create-contract-customer\"]",
            "type": "callout",
            "label": "거래처 및 현장 지정",
            "description": "계약 대상 고객사와 장비가 반입될 건설 현장을 선택합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"create-contract-start-date\"]",
            "type": "callout",
            "label": "계약 시작일 설정",
            "description": "장비 인도 및 과금이 공식 개시되는 기준일을 지정합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"create-contract-rate\"]",
            "type": "callout",
            "label": "월 렌탈료 단가 입력",
            "description": "고소작업대 월 임대료 및 일할 계산 기준 단가를 입력합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"create-contract-submit\"]",
            "type": "click_ripple",
            "label": "계약서 최종 등록 완결",
            "description": "등록 버튼을 눌러 계약서를 발행하고 출고 의뢰 대기 상태로 전이합니다.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "billing",
    "version": 10,
    "menuName": "청구 / 수납 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid='tab-billing-wizard']",
        "type": "callout",
        "label": "정산 마법사 탭",
        "description": "정산 대상 계약을 확인하고 청구서를 신규로 생성하는 기능 탭입니다."
      },
      {
        "seq": 2,
        "selector": "[data-mid='tab-billing-list']",
        "type": "callout",
        "label": "청구 대장 목록 탭",
        "description": "생성된 청구서를 조회하고 이메일 발송, 취소, 분할 등의 관리를 수행하는 탭입니다."
      }
    ],
    "processes": [
      {
        "processId": "bulk-billing-generate",
        "title": "일괄 청구서 생성",
        "description": "정산 기간을 선택하여 다수의 계약에 대한 청구서를 한 번에 생성합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid='tab-billing-wizard']",
            "type": "click_ripple",
            "label": "정산 마법사 탭 이동",
            "description": "청구서를 생성하기 위해 미청구 정산 탭으로 이동합니다."
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"wizard-period-scope\"] button:nth-child(2)",
            "type": "click_ripple",
            "label": "조회 기간 설정",
            "description": "마감일 기준 검색 기간에서 당월을 선택합니다."
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"wizard-bulk-generate-btn\"]",
            "type": "click_ripple",
            "label": "일괄 청구 생성",
            "description": "외상미수금이 없는 일반 계약들을 대상으로 일괄 청구서를 생성합니다."
          }
        ]
      },
      {
        "processId": "email-statement",
        "title": "청구서 이메일 발송",
        "description": "발행된 청구서의 거래명세서를 고객의 이메일로 전송합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid='tab-billing-list']",
            "type": "click_ripple",
            "label": "청구 대장 목록 탭 이동",
            "description": "청구 내역을 확인하기 위해 청구 대장 탭으로 이동합니다."
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"billing-mail-btn\"]:first-of-type",
            "type": "click_ripple",
            "label": "이메일 발송 버튼 클릭",
            "description": "목록에서 대상 청구건의 발송 버튼을 클릭하여 거래명세서를 전송합니다."
          }
        ]
      },
      {
        "processId": "cancel-split-billing",
        "title": "청구 취소 및 분할",
        "description": "기존 청구서를 취소하여 롤백하거나 금액 기준으로 분할합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid='tab-billing-list']",
            "type": "click_ripple",
            "label": "청구 대장 목록 탭 이동",
            "description": "청구 대장 탭으로 이동합니다."
          },
          {
            "seq": 2,
            "selector": "[data-mid='billing-list-item']",
            "type": "click_ripple",
            "label": "청구서 선택",
            "description": "목록에서 취소 또는 분할할 청구서를 클릭하여 상세 내역을 엽니다."
          },
          {
            "seq": 3,
            "selector": "[data-mid='btn-rollback-billing']",
            "type": "callout",
            "label": "청구 취소 (롤백)",
            "description": "이 버튼을 클릭하면 해당 청구서를 취소하고 최근 청구 정보를 직전 유효 상태로 되돌립니다."
          },
          {
            "seq": 4,
            "selector": "[data-mid='btn-split-billing']",
            "type": "callout",
            "label": "청구 분할",
            "description": "이 버튼을 통해 하나의 청구서를 금액 기준으로 두 개의 청구서로 나눌 수 있습니다."
          }
        ]
      }
    ],
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "월별 청구 대장 조회, 다중 조건 필터링, 수납 등록 및 미수금 관리, 전자명세서 발송, 정품 거래명세서 서식 출력, 회계 대차대조식 검증",
    "scopeInfo": "청구 귀속월(YYYY-MM), 고객사 초성/상호, 계약번호, 수납 상태(완납/미납), 메일 발송 여부, 통합 인보이스 구분",
    "cognitiveSequence": [
      "1. 좌상단 청구 귀속 시작월~종료월 기간 설정",
      "2. [당월] 및 [<], [>] 퀵 버튼으로 월 단위 빠른 점프 이동",
      "3. 고객사 초성(예: ㅅㅅ) 또는 상호 입력으로 거래처 특정",
      "4. 특정 계약 추적 시 계약번호 직접 입력",
      "5. 수납 상태(전체/완납/미완료)로 미수 채권 청구서 추출",
      "6. 메일 발송(미발송/발송) 및 통합 구분 필터링",
      "7. [조회] 실행으로 DB 실시간 쿼리 및 [초기화]로 기본값 복원",
      "8. 청구·수납 6대 종합 집계 (공급가, 세액, 총액, 수납액, 미수금, 통장잔액) 확인",
      "9. 청구 대장 전체 데이터 엑셀(XLSX) 양식 다운로드",
      "10. 월별 청구 대장 그리드에서 청구서 목록 조망 및 개별 행 클릭",
      "11. 미납 청구서 [수납] 클릭  통장 입금 내역 1:1 매칭 및 영수 등록",
      "12. [발송] 클릭  거래처 담당자에게 거래명세서 이메일 즉시 전송",
      "13. 고객사 이의제기 시 [취소/재생성]으로 청구 취소 및 계약 직전 상태 롤백",
      "14. 우측 명세서 스튜디오에서 장비별 일할 렌탈료 대조, [청구 분할 ️], 정품 PDF/엑셀 출력",
      "15. 하단 회계 대차대조식 검증 바(청구총액 = 수납액 + 미수잔액) 무결성 확정 (Audit Result)"
    ],
    "subTabs": [
      {
        "tabId": "LIST",
        "tabName": "청구 대장",
        "purpose": "월별 청구 목록 조회, 실시간 입금 수납 매칭, 거래명세서 이메일 발송 및 정품 A4 서식 출력",
        "keyActions": [
          "청구 귀속월 및 초성 검색",
          "수납 등록 및 통장 매칭",
          "거래명세서 이메일 즉시 발송",
          "청구 취소 및 계약 롤백",
          "청구 분할 및 정품 PDF/엑셀 출력"
        ]
      },
      {
        "tabId": "WIZARD",
        "tabName": "미청구 정산",
        "purpose": "정산 대상 계약의 기간별 일할 매출을 집계하여 청구서 생성",
        "keyActions": [
          "마감 연월 선택",
          "일할 계산 검증",
          "정산 기간 설정",
          "청구 생성 마감"
        ]
      },
      {
        "tabId": "INVOICE",
        "tabName": "청구서통합",
        "purpose": "동일 거래처 다수 현장 계약 건을 1장의 통합 청구서로 합산 발행",
        "keyActions": [
          "거래처별 합산 미리보기",
          "통합 청구서 PDF 생성"
        ]
      },
      {
        "tabId": "WAIVER",
        "tabName": "청구 면제 대장",
        "purpose": "우천, 파업, 고장 대차 등 특약에 의한 청구 감면 내역 감사 원장",
        "keyActions": [
          "면제 승인 건 검토",
          "면제 증빙 확인"
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "수납 등록 팝업",
        "triggerButton": "[수납]",
        "keyFields": [
          "수납 일자 및 입금 계좌",
          "수납 금액 및 통장 거래 1:1 매칭",
          "입금자명 확인"
        ],
        "terminalAction": "[수납 처리 완료]",
        "afterStateTransition": "청구서 상태가 PAID(완납) 또는 PARTIAL(일부납)로 갱신되고 미수채권 차감"
      }
    ],
    "auditResult": "청구 총액과 기수납액, 미수 잔액의 합이 100% 일치(대차 차액 ₩0)하여 외상매출금 원장과 무결하게 연계됨",
    "rulesCompliance": [
      "헌장 3.1 [무수식어 건조 UI 표준]: 과장된 수식어 전면 배제 및 건조한 명사·동사 단일 체계 준수",
      "헌장 3.5 [Gutenberg Z-패턴 표준]: 좌상단(1~7)  우상단(8~9)  중앙(10~14)  우하단(15) 실무 동선 일치",
      "헌장 4.1 [정밀 일할 집계 정책]: 청구서별 장비 일할 렌탈료 및 추가비용 1:1 대사 검증"
    ],
    "precautions": [
      "완납 처리된 청구서는 임의 삭제가 불가하므로 수납 전 입금 내역을 철저히 대조",
      "취소/재생성 시 계약의 최근 청구 이력이 롤백되므로 이의제기 사유를 명확히 기재"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"billing-period-scope\"]",
        "type": "stamp",
        "label": "청구 귀속월 기간 설정",
        "description": "조회할 청구 귀속 시작월과 종료월을 지정합니다. (예: 2026-09 ~ 2026-09) 복수 월을 선택하면 분기 또는 반기 누적 청구 현황을 일괄 집계할 수 있습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"billing-month-quick\"]",
        "type": "click_ripple",
        "label": "전월·당월·익월 퀵 버튼",
        "description": "달력 피커를 직접 열지 않고 [당월]을 클릭하면 즉시 이번 달 귀속월로 자동 세팅되며, [<], [>] 버튼을 눌러 1개월 단위로 빠르게 전후 이동합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"billing-customer-filter\"]",
        "type": "stamp",
        "label": "고객사 초성·상호 검색",
        "description": "고객사명 또는 한글 초성(예: \"ㅅㅅ\" 입력 시 삼성, 삼우 등)을 입력하여 특정 거래처의 청구 내역만 실시간으로 빠르게 필터링합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"billing-contract-filter\"]",
        "type": "stamp",
        "label": "계약번호 직접 조회",
        "description": "특정 현장 또는 특정 계약건에 부속된 청구서만 정밀하게 추적할 때 고유 계약번호(예: CT-2026-XXXX)를 입력합니다.",
        "badgeColor": "#0D9488",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"billing-payment-filter\"]",
        "type": "stamp",
        "label": "수납 상태 필터링",
        "description": "\"전체\", \"수납완료(PAID)\", \"미완료(UNPAID_ANY)\" 중 선택합니다. \"미완료\"를 선택하면 아직 입금되지 않은 외상미수금 청구서만 집중 추출됩니다.",
        "badgeColor": "#D97706",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"billing-mail-filter\"]",
        "type": "stamp",
        "label": "메일 발송 및 통합 구분 필터",
        "description": "전자거래명세서 \"미발송\" 건만 걸러내어 누락 없이 이메일을 전송하거나, \"단독 청구\"와 \"통합 인보이스\" 포함 여부를 구분하여 선별합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"billing-search-action\"]",
        "type": "click_ripple",
        "label": "[조회] 및 [초기화] 실행",
        "description": "입력한 모든 검색 조건을 DB에 적용하여 청구 목록과 6대 종합 지표를 즉시 재계산합니다. [초기화]를 누르면 모든 필터가 기본값으로 리셋됩니다.",
        "badgeColor": "#4F46E5",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"billing-kpi-summary\"]",
        "type": "stamp",
        "label": "청구·수납 6대 종합 집계",
        "description": "조회 조건에 따른 조회건수, 공급가액, 총 청구합계(VAT포함), 기수납액, 미수채권 잔액 및 매칭 가능한 통장잔액 현황을 한눈에 파악합니다.",
        "badgeColor": "#9333EA",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 9,
        "selector": "[data-mid=\"billing-export-btn\"]",
        "type": "click_ripple",
        "label": "청구 대장 엑셀 다운로드",
        "description": "필터링된 청구 목록 전체 데이터를 엑셀(XLSX) 양식으로 즉시 내보내어 재무 보고서 작성 및 외상매출금 장부 보관용으로 활용합니다.",
        "badgeColor": "#EA580C",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 10,
        "selector": "[data-mid=\"billing-list-table\"]",
        "type": "highlight",
        "label": "월별 청구 대장 그리드",
        "description": "청구월, 고객사, 공급가액, 청구합계, 미납액, 수납 상태 배지를 조망합니다. 특정 행을 클릭하면 우측 패널에 해당 청구서의 세부 명세가 즉시 활성화됩니다.",
        "badgeColor": "#2563EB",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 11,
        "selector": "[data-mid=\"billing-pay-btn\"]",
        "type": "click_ripple",
        "label": "[수납] 입금 매칭 및 영수 등록",
        "description": "미납 잔액이 있는 청구서의 [수납]을 클릭하여 수납 등록 팝업을 호출합니다. 통장 입금 거래를 1:1 매칭하거나 수납액을 직접 입력하여 완납(PAID) 또는 일부납(PARTIAL) 처리합니다.",
        "badgeColor": "#10B981",
        "positionHint": "right",
        "spotlight": true
      },
      {
        "seq": 12,
        "selector": "[data-mid=\"billing-mail-btn\"]",
        "type": "click_ripple",
        "label": "[발송] 거래명세서 이메일 전송",
        "description": "거래처 담당자에게 정품 거래명세서(HTML/PDF 첨부)를 즉시 이메일 발송합니다. 통합 인보이스에 묶인 건은 [개별발송]으로 개별 명세서만 분리 전송할 수 있습니다.",
        "badgeColor": "#3B82F6",
        "positionHint": "right",
        "spotlight": true
      },
      {
        "seq": 13,
        "selector": "[data-mid=\"billing-cancel-btn\"]",
        "type": "click_ripple",
        "label": "[취소/재생성] 및 청구 롤백",
        "description": "단가나 가동일수에 이의제기가 발생한 경우 청구를 취소하고 [미청구 정산] 위저드로 되돌려 수정하거나, 계약의 최근 청구일자를 직전 유효 상태로 롤백합니다.",
        "badgeColor": "#EF4444",
        "positionHint": "right",
        "spotlight": true
      },
      {
        "seq": 14,
        "selector": "[data-mid=\"billing-detail-studio\"]",
        "type": "stamp",
        "label": "청구 명세서 및 정품 서식 출력",
        "description": "선택된 청구서의 장비별 일할 렌탈료(역일 일수 대사) 및 부대비용을 1:1 대조하고, [청구월 수정], [청구 분할 ️], MS Excel COM 엔진 기반 정품 A4 거래명세서 PDF/엑셀을 다운로드합니다.",
        "badgeColor": "#6366F1",
        "positionHint": "left",
        "spotlight": false
      },
      {
        "seq": 15,
        "selector": "[data-mid=\"billing-bottom-audit-bar\"]",
        "type": "callout",
        "label": "회계 대차대조식 검증 바",
        "description": "조회 청구 총액이 기수납액과 미수 잔액의 합과 정확히 일치(청구총액 = 수납액 + 미수잔액 | 대차 차액 ₩0)하는지 무결성을 검증하고 외상미수금 원장으로 바통을 인계합니다.",
        "badgeColor": "#059669",
        "positionHint": "top",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "billing_wizard",
    "version": 10,
    "menuName": "미청구 정산",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "마감 도래 계약의 기간별 일할 매출 정산, 고객부담 운송료/수리비 및 외상미수금 연계 정산, 청구서 생성 및 최종 확정",
    "scopeInfo": "정산 대상 기간, 청구 대상 계약 목록, 자산별 일할 가동일수 및 단가, 미청구 부대비용 및 연계 외상미수금",
    "cognitiveSequence": [
      "1. 마감일 기준 검색 기간 및 전월/당월 퀵버튼 스코핑",
      "2. 고객사명, 계약번호, 현장명 세부 필터링 및 [조회]",
      "3. 외상미수금 없는 정상 계약 원클릭 일괄 청구 생성 ([일괄청구생성])",
      "4. 좌측 마감 도래 계약 카드 선택 및 우측 정산 계산기 연동",
      "5. 정산 대상 기간 및 청구 귀속월 확정 (권장 시작일, 당월, 전월 퀵버튼)",
      "6. 장비별 일할 청구액, 현장 AS 수리비, 고객부담 운송료 및 외상미수금 합산 대사",
      "7. 총 정산 예상 금액 검증 및 [청구 생성] 클릭으로 청구 대장 최종 등록"
    ],
    "auditResult": "당월 미청구 일할 매출 확정 및 청구 대장/외상매출금 자동 연계 등록",
    "rulesCompliance": [
      "헌장 1.2 [발생 사건 무누락 DB 저장]: 청구 생성 즉시 청구서 및 세부 내역 무누락 DB 기록",
      "헌장 4.1 [자산별 매출 기여액 정밀 일할 집계]: 실제 가동일수 기반 1원도 오차 없는 정밀 일할 계산"
    ],
    "precautions": [
      "외상미수금(수리비/운송비)이 포함된 계약은 일괄 청구 대상에서 제외되며 수동 검토 후 생성 필요",
      "직전 청구 기간과 겹치지 않도록 권장 시작일 자동 계산값을 우선 확인"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"wizard-period-scope\"]",
        "type": "stamp",
        "label": "마감일 기준 검색 기간",
        "description": "전월·당월·익월·3개월·연간 퀵버튼과 일자 입력을 통해 청구 마감이 도래한 계약 범위를 스코핑합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"wizard-search-filter\"]",
        "type": "stamp",
        "label": "고객사·계약번호·현장 검색",
        "description": "특정 고객사, 계약번호 또는 현장명을 입력하여 정산 대상 계약을 정밀 필터링합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"wizard-bulk-generate-btn\"], button:contains(\"일괄청구생성\")",
        "type": "click_ripple",
        "label": "일괄 청구 생성",
        "description": "외상미수금 등 예외 조율이 없는 정상 계약 전체를 단 1클릭으로 일괄 청구 계산 및 생성합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"wizard-contract-card-list\"]",
        "type": "callout",
        "label": "정산 대상 계약 카드 목록",
        "description": "마감 도래 뱃지 및 외상미수금 주의 표시를 확인하고 개별 정산할 계약 카드를 클릭하여 우측에 로드합니다.",
        "badgeColor": "#D97706",
        "positionHint": "right",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"wizard-calc-period\"], [data-mid=\"wizard-calculator-container\"]",
        "type": "stamp",
        "label": "정산 기간 및 청구귀속월",
        "description": "권장 시작일, 당월, 전월 퀵버튼으로 일할 정산 대상 기간과 청구 귀속월을 확정합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"wizard-calc-items\"], [data-mid=\"wizard-calculator-container\"]",
        "type": "highlight",
        "label": "일할 청구액 및 미수금 정산",
        "description": "자산별 일할 가동일수와 청구액, 현장 AS 수리비, 고객부담 운송료 및 외상미수금 합산 내역을 검증합니다.",
        "badgeColor": "#4F46E5",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"wizard-submit-btn\"], button:contains(\"청구 생성\"), [data-mid=\"wizard-calculator-container\"]",
        "type": "click_ripple",
        "label": "청구 생성 및 마감",
        "description": "산출된 총 정산 금액을 검증하고 [청구 생성]을 클릭하여 청구 대장에 최종 등록합니다.",
        "badgeColor": "#10B981",
        "positionHint": "top",
        "spotlight": true
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"wizard-period-scope\"]",
        "type": "callout",
        "label": "정산 대상 월 선택",
        "description": "과거 미청구 또는 당월 청구 대상 기간을 설정합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"wizard-contract-card-list\"]",
        "type": "highlight",
        "label": "미청구 계약 목록",
        "description": "청구서가 아직 발행되지 않은 가동 계약 건들을 조망합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "wizard-bulk-billing",
        "title": "미청구 계약 일괄 소급 청구서 생성",
        "description": "해당 월의 모든 미청구 계약을 일괄 집계하여 표준 청구서로 원클릭 발행합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"wizard-period-scope\"]",
            "type": "callout",
            "label": "정산 기간 선택",
            "description": "과거 정산 대상 월을 클릭합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"wizard-bulk-generate-btn\"]",
            "type": "click_ripple",
            "label": "일괄 청구서 생성",
            "description": "모든 미청구 계약의 일할 계산 청구서를 일괄 생성합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "billing_invoice",
    "version": 10,
    "menuName": "청구서통합",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "동일 고객사 다수 현장의 미통합 청구서 일괄 합산, 고객/현장 단위 통합 인보이스 생성, 공식 A4 거래명세서 11행 싱크 및 정품 엑셀/PDF 서식 출력, 이메일 발송 및 최종 발행 마감",
    "scopeInfo": "청구 귀속연월(YYYY-MM), 고객사 상호/초성, 통합 단위(고객/현장), 품목 카테고리(렌탈/수리/운반), 인보이스 납기일자 및 통합 비고",
    "cognitiveSequence": [
      "1. 좌상단 청구 귀속연월 선택으로 통합 대상 기간 스코핑",
      "2. 고객명 검색 인풋에 상호 또는 초성 입력으로 대상 고객사 선별",
      "3. 고객사 선택 드롭다운에서 통합 인보이스 발행 대상 거래처 지정",
      "4. 통합 단위를 [고객 단위 (본사 1세금계산서)] 또는 [현장 단위]로 설정",
      "5. [통합 발행 스튜디오]와 [발행 이력 대장] 간 뷰 모드 전환 확인",
      "6. 과거 단독 청구건 일괄 묶음 필요 시 [기존 청구 소급 묶기] 실행",
      "7. 최신 DB 데이터 반영을 위한 [새로고침] 실행",
      "8. 품목 카테고리 필터([전체], [렌탈], [수리], [운반])로 내역 선별 대조",
      "9. 미통합 청구 목록에서 전체 또는 개별 체크박스로 통합 대상 청구서 선택",
      "10. 우측 작업대에서 발행 예정 인보이스 번호 확인 및 납기일자/통합 비고 입력",
      "11. 공식 거래명세서 A4 11행 싱크 캔버스에서 공급자/공급받는자/명세 실시간 대사",
      "12. 하단 회계 대차 검증 스트립(공급가 + 세액 = 총청구합계) 무결성 확인",
      "13. 정품 양식 주입 [정품 엑셀 다운로드] 실행",
      "14. [PDF 다운로드], [인쇄], [이메일 발송]으로 고객사 담당자에게 명세서 전달",
      "15. [통합 청구서 발행] 클릭으로 단일 통합 인보이스(INV-XXXX) 최종 확정 마감"
    ],
    "auditResult": "복수 개별 청구서가 단일 통합 인보이스(INV-XXXX)로 무결하게 묶여 세금계산서 1장과 1:1 대사 일치",
    "rulesCompliance": [
      "헌장 3.1 [무수식어 건조 UI 표준]: 과장된 수식어 전면 배제 및 건조한 명사·동사 단일 체계 준수",
      "헌장 3.5 [Gutenberg Z-패턴 표준]: 좌상단 Scope(1~4)  Pipeline(5~7)  Inspection(8~12)  Terminal Action(13~15)",
      "헌장 4.1 [정밀 일할 집계 정책]: 개별 청구 공급가액과 부가세액의 합산이 통합 거래명세서와 1원도 오차 없이 일치"
    ],
    "precautions": [
      "고객사를 먼저 선택해야 해당 업체의 미통합 청구서 목록이 로드됩니다.",
      "수리비나 운반비 등 미청구 부가비용이 있는 경우 누락 방지를 위해 동반 선택 여부를 확인하십시오."
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"invoice-period-ym\"]",
        "type": "stamp",
        "label": "청구 귀속연월 설정",
        "description": "통합 인보이스를 발행할 대상 귀속연월(YYYY-MM)을 선택합니다. 선택한 연월에 귀속된 미통합 청구서들이 좌측 바구니에 로드됩니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"invoice-customer-search\"]",
        "type": "stamp",
        "label": "고객명 초성·상호 검색",
        "description": "다수의 거래처 중 특정 업체를 빠르게 찾기 위해 상호 또는 한글 초성(예: \"ㄷㅇ\", \"ㅅㅅ\")을 입력하여 드롭다운 목록을 실시간 필터링합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"invoice-customer-select\"]",
        "type": "click_ripple",
        "label": "고객사 선택 드롭다운",
        "description": "통합 인보이스를 발행할 고객사를 최종 선택합니다. 선택 즉시 사업자번호, 대표자명, 사업장 주소 등 공급받는자 정보가 우측 명세서 캔버스에 자동 매핑됩니다.",
        "badgeColor": "#2563EB",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"invoice-groupby-select\"]",
        "type": "stamp",
        "label": "통합 단위 설정",
        "description": "\"고객 단위 (본사 1세금계산서)\" 또는 \"현장 단위 (현장별 독립 묶기)\" 중 청구 합산 방식을 선택하여 본사 일괄 청구 또는 현장별 분리 청구를 결정합니다.",
        "badgeColor": "#0D9488",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"invoice-viewmode-toggle\"]",
        "type": "click_ripple",
        "label": "스튜디오·이력 대장 전환",
        "description": "신규 통합 청구서를 작성하는 [통합 발행 스튜디오]와 기존에 발행 완료된 통합 인보이스를 조회/취소하는 [발행 이력 대장] 뷰 모드를 상호 전환합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"invoice-batch-consolidate-btn\"]",
        "type": "click_ripple",
        "label": "[기존 청구 소급 묶기]",
        "description": "과거에 단독 발행되어 미통합 상태로 남아있는 청구 건들을 시스템 통합 규칙에 따라 일괄 소급하여 인보이스로 묶어 처리합니다.",
        "badgeColor": "#D97706",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"invoice-refresh-btn\"]",
        "type": "click_ripple",
        "label": "청구 데이터 새로고침",
        "description": "현재 선택된 고객사와 귀속연월의 최신 청구 데이터 및 미통합 내역을 Supabase 원격 DB로부터 즉시 재조회합니다.",
        "badgeColor": "#64748B",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"invoice-category-filter\"]",
        "type": "click_ripple",
        "label": "품목 카테고리 필터",
        "description": "[전체], [렌탈], [수리], [운반] 필터 탭을 클릭하여 특정 비용 항목만 선별 대사하거나 개별 청구 건수를 확인합니다.",
        "badgeColor": "#3B82F6",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 9,
        "selector": "[data-mid=\"invoice-unbilled-table\"]",
        "type": "highlight",
        "label": "미통합 청구서 바구니",
        "description": "선택 고객사의 미통합 청구 목록을 확인하고, 전체 선택 체크박스 또는 개별 행을 클릭하여 통합 인보이스에 합산할 청구 건들을 바구니에 담습니다.",
        "badgeColor": "#2563EB",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 10,
        "selector": "[data-mid=\"invoice-form-inputs\"]",
        "type": "stamp",
        "label": "납기일자 및 통합 비고 입력",
        "description": "채번될 통합 인보이스 번호를 확인하고, 입금 마감일(납기일자) 및 거래명세서/세금계산서 비고란에 인쇄될 통합 전달사항 메모를 입력합니다.",
        "badgeColor": "#4F46E5",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 11,
        "selector": "[data-mid=\"invoice-statement-canvas\"]",
        "type": "stamp",
        "label": "공식 거래명세서 A4 규격 캔버스",
        "description": "공급자(기연리프트)와 공급받는자(고객사), 한글 금액 표기, 11행 정규 품목·규격·단가·공급가액·세액이 실시간 바인딩된 정품 양식을 대사 검증합니다.",
        "badgeColor": "#6366F1",
        "positionHint": "left",
        "spotlight": false
      },
      {
        "seq": 12,
        "selector": "[data-mid=\"invoice-reconcile-summary\"]",
        "type": "callout",
        "label": "회계 대차대조식 검증 스트립",
        "description": "바구니에서 선택된 청구 건수와 공급가액, 부가세액의 합산이 거래명세서 청구총액과 정확히 일치(공급가 + 세액 = 총청구액 | 차액 ₩0)하는지 무결성을 검증합니다.",
        "badgeColor": "#059669",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 13,
        "selector": "[data-mid=\"invoice-export-excel-btn\"]",
        "type": "click_ripple",
        "label": "[정품 엑셀 다운로드]",
        "description": "00.거래명세서양식.xlsx 정품 서식에 선택된 청구 내역과 합산 데이터가 1:1 주입된 고품질 엑셀 파일을 다운로드합니다.",
        "badgeColor": "#10B981",
        "positionHint": "top",
        "spotlight": true
      },
      {
        "seq": 14,
        "selector": "[data-mid=\"invoice-print-email-actions\"]",
        "type": "click_ripple",
        "label": "PDF 변환·인쇄·이메일 발송",
        "description": "MS Excel COM 엔진 연동 정품 PDF 다운로드, 브라우저 직접 인쇄, 또는 거래처 담당자에게 통합 명세서와 청구 내역을 이메일로 즉시 발송합니다.",
        "badgeColor": "#3B82F6",
        "positionHint": "top",
        "spotlight": true
      },
      {
        "seq": 15,
        "selector": "[data-mid=\"invoice-issue-submit-btn\"]",
        "type": "click_ripple",
        "label": "[통합 청구서 발행] 최종 완결",
        "description": "선택된 개별 청구 건들을 묶어 단일 통합 인보이스(INV-XXXX)로 공식 발행 확정하고 DB 상태를 마감 처리합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": true
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"invoice-period-ym\"]",
        "type": "callout",
        "label": "청구 연월 선택",
        "description": "통합 인보이스를 발행할 기준 년월을 선택합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"invoice-unbilled-table\"]",
        "type": "highlight",
        "label": "미발행 거래명세 목록",
        "description": "고객사 및 현장별 미발행 청구 내역을 확인합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "invoice-consolidate-issue",
        "title": "고객사 다수 현장 통합 거래명세서/인보이스 발행",
        "description": "동일 거래처의 여러 현장 청구 건을 1건의 통합 인보이스로 묶어 거래명세서를 발행합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"invoice-period-ym\"]",
            "type": "callout",
            "label": "청구 연월 선택",
            "description": "발행할 청구 년월을 지정합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"invoice-batch-consolidate-btn\"]",
            "type": "click_ripple",
            "label": "통합 인보이스 생성",
            "description": "현장별 청구 내역을 거래처 단위로 합산 발행합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "billing_waiver",
    "version": 10,
    "menuName": "청구 면제 대장",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "우천, 파업, 고장 대차 등 특약에 의해 청구 면제 처리된 수리비 및 운송비 감사 원장 조회, 사유별/영업담당별 집계 분석 및 원상 롤백(면제 취소)",
    "scopeInfo": "면제 연월 범위, 항목 구분(현장AS/입고정비/화물운송료), 거래처/계약번호/담당자/사유 검색어",
    "cognitiveSequence": [
      "1. 좌상단 면제 연월 범위(시작월~종료월) 설정으로 조회 기간 스코핑",
      "2. 항목 구분(전체/현장 AS/입고 정비/화물 운송료) 셀렉트박스로 세부 선별",
      "3. 고객사명, 계약번호, 현장명, 면제처리자, 사유 검색어로 특정 건 추적",
      "4. 상단 [엑셀 내보내기] 클릭으로 면제 원장 전체 데이터 다운로드",
      "5. 4대 KPI 카드에서 총 면제 손실액 및 AS/정비/운송료별 면제 합계 대사",
      "6. 사유별 비중 칩 및 영업담당자별 면제 집계 스트립 분석",
      "7. 본문 고밀도 대장에서 장비별 원발생비용, 면제금액, 면제사유 대조",
      "8. 잘못 면제 처리된 건은 좌측 [면제 취소] 클릭으로 미청구 대장 즉시 원상 복원",
      "9. 하단 회계 대차대조식 검증 바(총 유료비용 = 정상 청구액 + 영업 면제액 | 대차 차액 ₩0) 무결성 확정"
    ],
    "auditResult": "총 유료비용 발생액이 정상 청구액과 영업 면제액의 합과 정확히 일치(대차 차액 ₩0)하여 손실 원장 무결성 보장",
    "rulesCompliance": [
      "헌장 3.1 [무수식어 건조 UI 표준]: 과장된 수식어 전면 배제 및 건조한 명사·동사 단일 체계 준수",
      "헌장 3.5 [Gutenberg Z-패턴 표준]: 좌상단 Scope(1~3)  우상단 Pipeline(4)  본문 Inspection(5~8)  우하단 Terminal Audit(9)",
      "헌장 4.1 [정밀 일할 집계 정책]: 원발생비용과 면제금액의 1원 단위 일치 여부 정밀 대사"
    ],
    "precautions": [
      "면제 취소 시 해당 수리비/운송비가 [미청구 정산] 위저드로 즉시 환원되어 다음 청구 시 합산 대상이 됩니다.",
      "사유별 손실 집계가 경영진 감사 지표로 활용되므로 면제 사유를 명확히 기재하십시오."
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"waiver-period-scope\"]",
        "type": "stamp",
        "label": "면제 연월 범위 설정",
        "description": "조회할 면제 발생 시작월과 종료월을 지정합니다. (예: 2026-09 ~ 2026-09) 복수 월을 선택하여 분기 또는 반기 면제 추이를 일괄 집계합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"waiver-category-filter\"]",
        "type": "stamp",
        "label": "항목 구분 필터",
        "description": "전체 구분, 현장 AS(고객과실 출동), 입고 정비(반납 결함 파손), 화물 운송료(배차 추가운임) 중 원하는 비용 항목을 선별합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"waiver-search-input\"]",
        "type": "stamp",
        "label": "거래처·계약·담당자·사유 검색",
        "description": "고객사명, 계약번호, 현장명, 면제처리자, 면제사유를 텍스트로 자유롭게 입력하여 특정 면제 건을 빠르게 검색합니다.",
        "badgeColor": "#0D9488",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"waiver-export-excel-btn\"]",
        "type": "click_ripple",
        "label": "면제 대장 엑셀 내보내기",
        "description": "필터링된 면제 내역 전체 목록을 엑셀(XLSX) 양식으로 다운로드하여 재무 감사 및 영업 손실 보고서용으로 활용합니다.",
        "badgeColor": "#EA580C",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"waiver-kpi-summary\"]",
        "type": "stamp",
        "label": "4대 면제 손실 종합 집계",
        "description": "총 영업 면제 손실액, 현장 AS 비용 면제, 반납 입고 정비비 면제, 고객부담 운송료 면제 합계를 한눈에 파악합니다.",
        "badgeColor": "#DC2626",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"waiver-reason-sales-strip\"]",
        "type": "stamp",
        "label": "사유별·영업담당자별 분석 스트립",
        "description": "면제 사유 상위 4개 항목(우천, 파업, 대차 등)의 비중과 영업담당자별 면제 처리 금액을 실시간 칩 형태로 대조합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"waiver-list-table\"]",
        "type": "highlight",
        "label": "면제 대장 고밀도 감사 그리드",
        "description": "면제일자, 구분, 고객사, 계약번호, 현장, 대상장비, 원발생비용, 면제금액, 상세사유, 처리자를 1행 1건 슬림 테이블로 면밀히 조망합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"waiver-cancel-btn\"]",
        "type": "click_ripple",
        "label": "[면제 취소] 미청구 복원",
        "description": "착오 면제 건의 [면제 취소]를 클릭하면 면제가 해제되고, 해당 비용이 [미청구 정산] 위저드로 즉시 환원되어 다음 청구 시 정상 청구됩니다.",
        "badgeColor": "#D97706",
        "positionHint": "right",
        "spotlight": true
      },
      {
        "seq": 9,
        "selector": "[data-mid=\"waiver-bottom-audit-bar\"]",
        "type": "callout",
        "label": "회계 대차대조식 검증 바",
        "description": "총 유료비용 발생액이 정상 청구액과 영업 면제액의 합과 정확히 일치(총 유료비용 = 정상 청구액 + 영업 면제액 | 대차 차액 ₩0)하는지 무결성을 검증합니다.",
        "badgeColor": "#059669",
        "positionHint": "top",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"waiver-period-scope\"]",
        "type": "callout",
        "label": "면제 조회 기간",
        "description": "청구 면제 또는 감면 처리된 기간을 조회합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"waiver-list-table\"]",
        "type": "highlight",
        "label": "청구 면제 대장",
        "description": "우천, 파업, 설비 고장 등으로 청구 면제 처리된 상세 내역을 실사합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "waiver-cancel-restore",
        "title": "청구 면제 취소 및 정상 청구 복원",
        "description": "오면제된 건을 취소하여 정상 청구 대장으로 복원합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"waiver-list-table\"]",
            "type": "highlight",
            "label": "면제 대상 확인",
            "description": "취소할 면제 건을 확인합니다.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "receivable",
    "version": 9,
    "menuName": "외상미수금 대장",
    "basicGuide": [
      {
        "seq": 1,
        "selector": ".table-container",
        "type": "highlight",
        "label": "미수금 관리 그리드",
        "description": "미청구 및 부분 청구 잔액을 포함한 모든 외상미수금 내역을 조회·관리합니다."
      },
      {
        "seq": 2,
        "selector": ".card:first-of-type",
        "type": "highlight",
        "label": "검색 및 필터 패널",
        "description": "고객사, 비용 유형, 청구 상태, 기간 범위를 지정하여 미수금을 조회합니다."
      }
    ],
    "processes": [
      {
        "processId": "register_receivable",
        "title": "신규 미수금 등록",
        "description": "수리비, 운송비 등 발생된 신규 미청구 채권을 등록합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "button.btn-primary",
            "type": "click_ripple",
            "label": "신규 미수금 등록 버튼",
            "description": "등록 버튼을 클릭하여 외상미수금 입력 팝업 창을 엽니다."
          },
          {
            "seq": 2,
            "selector": "[data-mid='rec-modal-cost-type'] select",
            "type": "callout",
            "label": "비용 유형 선택",
            "description": "발생한 비용의 적합한 항목(수리비, 운송비, 자재비 등)을 선택합니다."
          },
          {
            "seq": 3,
            "selector": "[data-mid='rec-modal-total-amount'] input",
            "type": "callout",
            "label": "청구 총액 입력",
            "description": "청구할 외상미수금 총액을 입력합니다."
          },
          {
            "seq": 4,
            "selector": "[data-mid='rec-modal-submit-btn']",
            "type": "click_ripple",
            "label": "미수금 등록 확정",
            "description": "등록 완료 버튼을 클릭하여 신규 미수금 채권을 DB에 저장합니다."
          }
        ]
      },
      {
        "processId": "standalone_billing",
        "title": "단독 청구서 발행",
        "description": "특정 외상 항목에 대해 즉시 단독 청구서를 발행합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "table tbody tr:first-child button.btn-secondary",
            "type": "click_ripple",
            "label": "단독 청구 선택",
            "description": "미결 미수금 행의 단독 청구 버튼을 클릭합니다."
          },
          {
            "seq": 2,
            "selector": "body",
            "type": "callout",
            "label": "청구 사유 입력",
            "description": "입력 창에 단독 청구 사유를 기재하여 발행을 진행합니다."
          }
        ]
      }
    ],
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "거래처별 누적 외상 매출금 잔액 추적, 수금 완료/미수금 잔액 대사, 연체 월령 분석 및 수금 독촉 관리",
    "scopeInfo": "거래처 마스터, 월별 청구 확정액, 통장 입금 수납액",
    "cognitiveSequence": [
      "1. 기준 연월 및 미수 채권 구간 스코핑 (30일 미만, 60일, 90일 이상 악성)",
      "2. 거래처별 총 청구액, 기입금액, 미수 잔액 대차대조 조망",
      "3. 거래처별 수납 이력 및 통장 입금 매칭 내역 인라인 확인",
      "4. 미수금 회수 담당 영업사원 배정 및 채권 회수 메모 기록",
      "5. 60일 이상 장기 연체 건 독촉장(최고장) 서식 자동 생성 및 발송",
      "6. 부실 채권 대손 상각 및 결재 상신 (헌장 결재선 연동)",
      "7. 월말 채권 현황 확정 마감 및 경영진 보고용 엑셀 내보내기"
    ],
    "subTabs": [
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
    "modalWorkflows": [
      {
        "modalName": "외상매출금 수기 수납 처리 팝업",
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
    "auditResult": "전사 외상매출금 잔액 일치 확정 및 연체 채권 조기 적발",
    "rulesCompliance": [
      "헌장 3.2 [셀 줄바꿈 방지]: 모든 금액 컬럼 white-space: nowrap 강제",
      "헌장 3.6 [유형 B 고밀도 그리드]: 40px 행 높이로 다량의 거래처를 한눈에 비교 검증"
    ],
    "precautions": [
      "입금자명과 계약처 상호가 다른 경우 통장 입출금 대장(BankMatching)과 교차 검증 필수",
      "90일 초과 악성 미수 건은 [미수 채권 연체 관리]로 즉시 이첩하여 법적 대응 착수"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"receivable-scope-filter\"], .receivable-scope",
        "type": "stamp",
        "label": "채권 구간 스코프",
        "description": "당월 청구, 30일/60일/90일 초과 연체 구간별로 채권을 스코핑합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"receivable-balance-grid\"], table.receivable-table",
        "type": "highlight",
        "label": "미수 잔액 대차대조",
        "description": "거래처별 총청구액 - 기입금액 = 미수잔액 무결성을 한눈에 조망합니다.",
        "badgeColor": "#059669",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"receivable-history-drawer\"], .history-drawer",
        "type": "callout",
        "label": "수납 및 입금 이력",
        "description": "해당 거래처의 과거 입금 내역 및 통장 대사 매칭 내역을 확인합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"receivable-memo-input\"], .memo-box",
        "type": "stamp",
        "label": "채권 회수 활동 기록",
        "description": "담당 영업사원의 입금 독려 전화 및 현장 방문 면담 메모를 기록합니다.",
        "badgeColor": "#D97706",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"btn-generate-notice\"], button:contains(\"독촉장\")",
        "type": "click_ripple",
        "label": "독촉장/최고장 생성",
        "description": "장기 연체 거래처에 발송할 법적 최고장 및 안내장을 자동 생성합니다.",
        "badgeColor": "#E53935",
        "positionHint": "top",
        "spotlight": true
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"btn-bad-debt-request\"], button:contains(\"대손 상각\")",
        "type": "callout",
        "label": "대손 상각 결재",
        "description": "폐업 등 회수 불능 채권에 대한 대손 처리 및 탕감 결재를 상신합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"btn-export-receivable\"], button:contains(\"엑셀 내보내기\")",
        "type": "click_ripple",
        "label": "채권 마감 및 엑셀",
        "description": "월말 미수금 대장을 최종 마감하고 경영진 보고용 원장을 다운로드합니다.",
        "badgeColor": "#10B981",
        "positionHint": "bottom",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "smart_dispatch4",
    "menuName": "출고 요청",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dispatch4-block-customer\"]",
        "type": "highlight",
        "label": "고객사 선택",
        "description": "출고를 진행할 대상 고객사를 선택합니다."
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dispatch4-block-equipments\"]",
        "type": "highlight",
        "label": "장비 매핑",
        "description": "출고 요청된 모델 및 수량을 배차 주문에 매핑합니다."
      }
    ],
    "processes": [
      {
        "processId": "create_dispatch_order",
        "title": "출고 의뢰 등록",
        "description": "신규 배차 및 출고 운송 의뢰를 등록합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"dispatch4-customer-search\"]",
            "type": "callout",
            "label": "고객사 검색 및 선택",
            "description": "출고 대상 고객사를 검색하여 선택합니다."
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"dispatch4-model-chips\"]",
            "type": "callout",
            "label": "요청 장비 추가",
            "description": "출고할 고소작업대 모델을 선택합니다."
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"dispatch4-block-site\"]",
            "type": "callout",
            "label": "현장 정보 및 일정 입력",
            "description": "반입 현장 주소, 담당자 연락처 및 상하차 일정을 입력합니다."
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"dispatch4-btn-submit\"]",
            "type": "click_ripple",
            "label": "출고 의뢰 접수",
            "description": "버튼을 클릭하여 출고 배차 의뢰를 최종 접수합니다."
          }
        ]
      }
    ],
    "version": 9,
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "영업담당자가 고객사로부터 접수한 렌탈 출고요청을 자연어 파싱 및 5단계 표준 서식으로 정형화하고, 9대 필수 스키마 실시간 검증을 거쳐 배차·출고 부서로 공식 출고 의뢰를 발행하는 전사 출고 파이프라인의 출발점 (헌장 2.1)",
    "scopeInfo": "고객사/현장 마스터, 자연어 카톡/문자 원문, 모델 규격별 수량, 상하차 희망 일시, 현장 인수자 연락처, 필수 안전옵션, 9대 방어차단 규칙",
    "cognitiveSequence": [
      "1. (선택) 카톡/문자 텍스트 붙여넣기 파싱으로 자연어 요청 원문 자동 변환",
      "2. 업무 유형 선택 (신규고객 출고 / 기존현장 출고 / 교체(대차))",
      "3. 1. 거래처 (고객사) 블록에서 거래처 검색 지정 또는 신규 거래처 등록",
      "4. 2. 투입 현장 블록에서 현장 선택/신규등록 및 현장 인수자(성명/연락처) 지정",
      "5. 3. 출고 장비 규격 블록에서 작업높이 및 모델별 요구 수량 선택 (헌장 2.1 모델 요구)",
      "6. 4. 출고 및 하차 일정 블록에서 상차 희망일시(ASAP/지정시간) 및 현장 도착일정 지정",
      "7. 5. 안전옵션 블록에서 필수 안전장치(난간대, 감지봉 등) 체크 및 진입로 특이 메모 기재",
      "8. 우측 [필수 정보 검증 & 방어 차단] 9대 항목 충족 확인 (미충족 시 발행 자동 차단)",
      "9. 우하단 [출고 요청 발행] 클릭  배차/출고 대기열(TruckDispatch)로 공식 전송"
    ],
    "subTabs": [
      {
        "tabId": "NEW",
        "tabName": "새 요청 작성",
        "purpose": "신규 렌탈 출고 요청 5단계 서식 작성, 자연어 파싱, 실시간 유효성 검증 및 공식 발행",
        "keyActions": [
          "카톡/문자 텍스트 자동 파싱",
          "업무 유형 및 5단계 정보 입력",
          "9대 스키마 유효성 검증 확인",
          "출고 요청 공식 발행"
        ]
      },
      {
        "tabId": "QUEUE",
        "tabName": "처리 대기 (임시저장 큐)",
        "purpose": "작성 중 임시 보관된 출고 초안 및 통화 녹음 연동 건 열람, 수정, 재개",
        "keyActions": [
          "초안 목록 조회 및 선택",
          "새 요청 작성으로 초안 불러오기",
          "다수 초안 일괄 처리 및 삭제"
        ]
      }
    ],
    "auditResult": "출고 의뢰 레코드(deliveries) 생성 및 배차 관리(TruckDispatch) 및 자산 출고 대기 큐로 공식 바인딩 전송",
    "rulesCompliance": [
      "헌장 2.1 [영업-출고 R&R 엄격 분리]: 영업부서는 모델 규격 요구만 의뢰하며, 특정 자산번호 강제 지정 절대 금지",
      "헌장 1.2 [이벤트 기록 무누락 DB 저장]: 요청 발행 일시, 영업담당자, 고객/현장 속성 100% 영구 보존",
      "헌장 3.5 [Gutenberg Z-Pattern]: 좌상단 텍스트 파싱  중앙 5단계 서식  우측 실시간 검증  우하단 출고 요청 최종 발행"
    ],
    "precautions": [
      "현장 상세주소 및 현장 인수자(성명/휴대폰) 미입력 시 출고 요청 발행이 시스템에 의해 자동 방어 차단됩니다.",
      "신규 고객사의 경우 영업사원이 출고 요청을 발행한 후 관리부의 사업자등록 검증이 완료되어야 배차가 진행됩니다.",
      "현장 진입로 협소(5톤 축차 불가 등) 시 배차 및 특이사항 메모에 반드시 기재해야 합니다."
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dispatch4-paste-zone\"]",
        "type": "callout",
        "label": "카톡/문자 텍스트 파싱",
        "description": "카톡, 문자, 메일로 접수된 자연어 요청 원문을 붙여넣으면 고객사, 현장, 장비, 날짜를 AI/정규식으로 자동 추출하여 폼에 즉시 채워줍니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dispatch4-context-types\"]",
        "type": "stamp",
        "label": "업무 유형 선택",
        "description": "신규고객 출고, 기존현장 추가출고, 교체(대차) 중 해당하는 비즈니스 맥락을 선택합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"dispatch4-block-customer\"]",
        "type": "stamp",
        "label": "1. 거래처 (고객사)",
        "description": "출고 대상 거래처(고객사)를 검색 선택하거나, 신규 고객사 정보를 직접 입력합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"dispatch4-block-site\"]",
        "type": "stamp",
        "label": "2. 투입 현장 및 담당자",
        "description": "장비가 반입될 공사 현장과 현장 인수자(성명, 휴대전화)를 지정합니다. 배차 운송의 필수 기준이 됩니다.",
        "badgeColor": "#0891B2",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"dispatch4-block-equipments\"]",
        "type": "stamp",
        "label": "3. 출고 장비 규격",
        "description": "현장 요구에 맞는 작업 높이/모델 규격과 수량을 지정합니다. 헌장 2.1에 따라 영업은 개별 자산번호가 아닌 모델 규격으로만 의뢰합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"dispatch4-block-schedule\"]",
        "type": "stamp",
        "label": "4. 출고 및 하차 일정",
        "description": "상차 희망일시(ASAP, 오전, 오후, 지정시간) 및 현장 도착일정을 설정합니다. 다수 장비의 경우 시차 출고 메모를 남길 수 있습니다.",
        "badgeColor": "#D97706",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"dispatch4-validation-shield\"]",
        "type": "callout",
        "label": "필수 정보 검증 & 방어 차단",
        "description": "고객사, 현장주소, 인수자, 장비, 일정 등 9대 필수 항목을 실시간 검증하며, 정보 누락 시 출고 요청 발행을 자동 차단하여 불완전 배차를 원천 방지합니다.",
        "badgeColor": "#DC2626",
        "positionHint": "left",
        "spotlight": true
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"dispatch4-btn-submit\"]",
        "type": "click_ripple",
        "label": "출고 요청 최종 발행",
        "description": "9대 필수 검증을 100% 통과하면 최종 발행 버튼이 활성화되며, 클릭 즉시 배차/출고 부서의 대기열로 공식 출고 의뢰가 전송됩니다.",
        "badgeColor": "#E53935",
        "positionHint": "top",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "smart_return",
    "version": 10,
    "menuName": "회수 요청",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"smart_return-mode-tabs\"]",
        "type": "callout",
        "label": "모드 선택",
        "description": "영업 임대 계약 회수 또는 정비 수리완료 회수 모드를 선택하여 진행할 수 있습니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"smart_return-summary\"]",
        "type": "highlight",
        "label": "회수 현황 요약",
        "description": "현재 대여중인 장비 및 만료 예정 계약 현황을 확인할 수 있습니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "return_request",
        "title": "반납 처리(회수 의뢰)",
        "description": "임대 계약이 종료되거나 조기 반납 시 회수 의뢰를 등록하는 프로세스입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"smart_return-contract-list\"]",
            "type": "click_ripple",
            "label": "계약 선택",
            "description": "목록에서 회수 대상 계약을 찾아 클릭합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"smart_return-asset-select\"]",
            "type": "highlight",
            "label": "자산 선택",
            "description": "회수할 장비를 체크하여 선택합니다.",
            "positionHint": "left"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"smart_return-schedule\"]",
            "type": "callout",
            "label": "회수 일정 입력",
            "description": "회수 예정일자 및 희망 시간을 지정합니다.",
            "positionHint": "top"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"smart_return-submit-btn\"]",
            "type": "click_ripple",
            "label": "등록 확정",
            "description": "회수 의뢰 등록 확정 버튼을 눌러 작업을 완료합니다.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "현장 공사 완료 또는 임대 만료에 따라 현장에 투입된 장비의 회수(반납) 의뢰를 배차 부서에 정식 발행",
    "scopeInfo": "대여 중인 계약, 회수 대상 자산번호, 반출 희망 일시, 현장 상차지 주소 및 상차 가능 여건",
    "cognitiveSequence": [
      "1. 계약 및 현장 대여 자산 요약 확인",
      "2. 회수 업무 모드 선택 (임대 계약 회수 vs 외주 정비 수리완료)",
      "3. 통화 접수 회수 대기 큐 확인 및 1-클릭 서식 바인딩",
      "4. 계약 초성 검색 및 만료일 순 정렬 필터링",
      "5. 회수 대상 임대 계약 선택",
      "6. 회수 대상 자산 지정 (전량 vs 부분 조기반송 체크리스트)",
      "7. 회수 예정일자 및 상차 시간대 설정",
      "8. 방문지 현장 인계 담당자명 및 연락처 확인",
      "9. 회수 의뢰 등록 확정 및 배차 대장 INBOUND 연동 (헌장 2.3)",
      "10. A4 입고요청서 인쇄 및 출고 장착옵션 회수 대조표 점검"
    ],
    "auditResult": "회수 배차 의뢰 발행 및 자산 상태 추적(회수 대기 플래그) 연동",
    "rulesCompliance": [
      "헌장 2.3 [단일 EXCHANGE 원칙의 역방향]: 순수 반납 건은 독립 RETURN 배차로 발행",
      "헌장 4.1 [일할 기여액 마감]: 회수 완료 시점까지의 가동일수 산출 기준 확립"
    ],
    "precautions": [
      "현장에서 장비 열쇠 분실 또는 충전기 미반납이 잦으므로 현장 담당자에게 사전 점검 요청 필수",
      "회수 지연 발생 시 추가 임대료 청구 대상이 될 수 있음을 고객사에 사전 안내"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"smart_return-summary\"]",
        "type": "callout",
        "label": "계약 및 현장 대여 자산 요약",
        "description": "진행중인 임대 계약, 현장 가동 자산 대수, 7일 내 만료 예정 계약 현황을 실시간 조망합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"smart_return-mode-tabs\"]",
        "type": "stamp",
        "label": "회수 업무 모드 선택",
        "description": "현장 공사 완료에 따른 [임대 계약 회수 의뢰]와 공장 수리 완료에 따른 [외주 정비 수리완료 회수 의뢰] 중 업무 목적을 선택합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"smart_return-call-drafts\"]",
        "type": "stamp",
        "label": "통화 접수 회수 대기 큐",
        "description": "현장에서 걸려온 반납 요청 통화 녹음이 AI로 분석된 대기 목록입니다. 카드를 클릭하면 계약과 회수 조건이 우측 서식에 1-클릭 자동 입력됩니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"smart_return-search-filter\"]",
        "type": "stamp",
        "label": "계약 초성 검색 및 만료일 정렬",
        "description": "고객사명, 현장명, 초성(예: ㅅㅅ, ㅎㄷ) 검색과 계약 만료일 순 정렬을 통해 회수 대상 계약을 신속히 필터링합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"smart_return-contract-list\"]",
        "type": "click_ripple",
        "label": "회수 대상 임대 계약 선택",
        "description": "장비를 반납할 현장 계약을 클릭하여 선택합니다. 선택 즉시 우측 서식에 현장 정보와 투입 자산 목록이 바인딩됩니다.",
        "badgeColor": "#E53935",
        "positionHint": "right",
        "spotlight": true
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"smart_return-asset-select\"]",
        "type": "stamp",
        "label": "회수 자산 지정 (전량 / 부분 조기반납)",
        "description": "현장에 투입된 장비 중 실제로 철수하는 장비의 체크박스를 선택합니다. 다수 장비 중 일부만 조기 반납하는 부분 회수도 지원합니다.",
        "badgeColor": "#D97706",
        "positionHint": "left",
        "spotlight": true
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"smart_return-schedule\"]",
        "type": "stamp",
        "label": "회수 예정일자 및 상차 시간대",
        "description": "현장 상차 및 화물차 배차 일시를 지정합니다. 기본값으로 오늘 날짜가 자동 설정되며 시간대(오전/오후/수시/시간)를 지정합니다.",
        "badgeColor": "#059669",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"smart_return-contact\"]",
        "type": "stamp",
        "label": "현장 상차 담당자 및 연락처",
        "description": "운송 기사가 현장 도착 시 통화할 현장 소장 또는 인계 담당자 연락처를 확인 및 수정합니다. 출고 배차 정보가 자동 승계됩니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 9,
        "selector": "[data-mid=\"smart_return-submit-btn\"]",
        "type": "click_ripple",
        "label": "회수 의뢰 등록 확정",
        "description": "회수 배차 의뢰를 확정 등록합니다. 배차 대장에 INBOUND(회수) 배차가 1건 자동 생성되며 입고 검수 예고 상태로 연동됩니다.",
        "badgeColor": "#10B981",
        "positionHint": "top",
        "spotlight": true
      },
      {
        "seq": 10,
        "selector": "[data-mid=\"smart_return-preview-print\"]",
        "type": "stamp",
        "label": "A4 입고요청서 인쇄 및 옵션 대조표",
        "description": "출고 시 부착되었던 안전옵션(철망/함석, 감지봉, 충전기 등)의 회수 체크리스트와 공인 A4 입고요청서를 미리보고 지정 프린터로 즉시 인쇄합니다.",
        "badgeColor": "#4F46E5",
        "positionHint": "top",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "smart_as_request",
    "version": 10,
    "menuName": "AS 요청",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부 / 고객센터",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "현장 가동 중 고장, 이상 경보, 파손 발생 시 긴급 AS 출동 및 정비 조치 의뢰 발행 (필요 시 즉시 대차 교체 연계)",
    "scopeInfo": "고객사, 현장 주소, 고장 자산번호, 고장 증상(상승불가, 주행불능, 에러코드), 현장 사진 증빙",
    "cognitiveSequence": [
      "1. 긴급 A/S 요청 자연어 접수 및 계약/현장 자동 조회",
      "2. 고장 장비 자산번호 및 에러 코드(리프트 미작동, 유압 누유 등) 식별",
      "3. 고장 증상 유형 분류 (긴급 출동 vs 유선 조치 vs 대차 교체 판정)",
      "4. 현장 비대면/대면 담당자 연락처 및 작업 층수/진입로 확인",
      "5. A/S 출동 엔지니어 지정 및 긴급 출동 지시서 발행",
      "6. 현장 수리 불가 판정 시 [EXCHANGE 대차 교체 요구] 원클릭 즉시 전환 (헌장 2.1)",
      "7. A/S 접수 티켓 확정 및 정비 이력 DB 무누락 기록 (헌장 1.2)"
    ],
    "auditResult": "AS 티켓 발행 및 현장 AS 관리(FieldAsManagement) 대기열로 즉시 라우팅",
    "rulesCompliance": [
      "헌장 2.1 [대차 교체 연계]: 현장 수리 불가 판정 시 동일 메뉴에서 원클릭 대차 교체 요구 전환 연동",
      "헌장 1.2 [이벤트 무누락 저장]: 고장 증상, 에러코드, 접수 일시 DB 영구 기록"
    ],
    "precautions": [
      "배터리 방전 또는 비상정지 스위치 눌림 등 단순 조치 사항은 유선 통화로 1차 해결 지도",
      "사용자 과실(추락 충격, 전도 파손) 의심 시 유상 수리 증빙 확보"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"smart_as_request-scope\"]",
        "type": "stamp",
        "label": "AS 접수",
        "description": "AS 요청을 접수합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"smart_as_request-pipeline-add\"]",
        "type": "stamp",
        "label": "고객/장비 선택",
        "description": "해당 고객사와 대상 장비를 선택합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"smart_as_request-details\"]",
        "type": "stamp",
        "label": "현장 정보",
        "description": "자산의 상세 현장 위치를 입력합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"smart_as_request-issue\"]",
        "type": "stamp",
        "label": "고장 증상",
        "description": "에러 코드 등 고장 증상을 입력합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"smart_as_request-reporter\"]",
        "type": "stamp",
        "label": "현장 접수자",
        "description": "현장에서 접수한 담당자 정보를 입력합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"smart_as_request-submit\"]",
        "type": "stamp",
        "label": "AS 접수 등록",
        "description": "AS 티켓을 생성합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"smart_as_request-terminal-audit\"]",
        "type": "stamp",
        "label": "전화 접수 AS 대기",
        "description": "전화로 접수된 AS 대기 내역을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "right",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"smart_as-form\"]",
        "type": "highlight",
        "label": "긴급 AS 접수 폼",
        "description": "현장 장비 고장 접수 및 긴급 출동 의뢰를 작성합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "process_smart_as_ticket",
        "title": "현장 긴급 고장 AS 접수 및 조치 의뢰",
        "description": "현장에서 발생한 고장 증상을 접수하고 정비팀 출동 또는 대차 교체를 의뢰합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"smart_as-form\"]",
            "type": "highlight",
            "label": "고장 현장 및 증상 입력",
            "description": "현장 위치, 장비 관리번호, 고장 증상 및 사진을 등록합니다.",
            "positionHint": "top"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"btn-new-ticket\"], button[type=\"submit\"]",
            "type": "click_ripple",
            "label": "AS 접수 완료",
            "description": "의뢰를 확정하고 정비 큐에 긴급 티켓을 발행합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "delinquency",
    "version": 9,
    "menuName": "미수 채권 연체 관리",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "30일/60일/90일 이상 장기 연체 채권 집중 모니터링, 신용 거래 제한(출고 정지), 최고장 발송 및 법적 조치 단계 관리",
    "scopeInfo": "연체 일수 기준, 거래처별 누적 연체금, 담보 여부, 현장 가동 장비 목록",
    "cognitiveSequence": [
      "1. 연체 기간별 채권 분류 스코핑 (30일/60일/90일 이상 연체)",
      "2. 거래처별 연체 원금, 연체 이자, 누적 회수율 실시간 산출",
      "3. 고객사 대표 및 현장소장 실시간 유선 독촉 및 면담 이력 기록",
      "4. 현장 투입 장비 점유 가압류 또는 가동 정지(시동 차단) 경고 발송",
      "5. 1차 독촉장 및 내용증명 법적 최고장 PDF 원클릭 생성 및 발송",
      "6. 회수 불가 악성 채권 대손 처리 및 연체 탕감 전자결재 상신",
      "7. 연체 채권 관리 대장 마감 및 법적 회수 절차 이관 확정"
    ],
    "subTabs": [
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
    "modalWorkflows": [
      {
        "modalName": "독촉장 및 최고장 발송 팝업",
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
    "auditResult": "부실 채권 조기 회수 조치 완결 및 추가 부실 출고 원천 차단",
    "rulesCompliance": [
      "헌장 3.1 [건조한 UI 표기]: 과장된 경고 문구 배제, 사실에 기반한 연체 일수와 금액만 직관 표기",
      "헌장 3.5 [Z-패턴 동선]: 좌상단 연체구간  중앙 대상 감사  우하단 조치 확정"
    ],
    "precautions": [
      "출고 보류 지정 시 영업 담당자에게 즉시 사유가 통보되며 신규 계약 체결이 자동 제한됨",
      "법적 조치 착수 전 현장 가동 중인 자산의 실물 위치 및 봉인 가능 여부 필수 실사"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"delinquency-aging-filter\"], .aging-tabs",
        "type": "stamp",
        "label": "연체 기간 스코프",
        "description": "30일, 60일, 90일 이상 장기 연체 채권 구간을 필터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"delinquency-summary-grid\"], table.delinquency-table",
        "type": "highlight",
        "label": "연체 원금 및 이자",
        "description": "거래처별 연체 원금, 지연 이자, 미회수 잔액을 정밀 조망합니다.",
        "badgeColor": "#059669",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"delinquency-call-log\"], .call-log-section",
        "type": "stamp",
        "label": "독촉 및 면담 이력",
        "description": "대표자 통화 내역, 약속 입금일, 현장 방문 결과를 기록합니다.",
        "badgeColor": "#D97706",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"btn-lock-equipment\"], button:contains(\"가동 정지\")",
        "type": "callout",
        "label": "장비 가동 정지 경고",
        "description": "미납 지속 시 현장 장비 시동 차단 및 강제 회수 경고를 발송합니다.",
        "badgeColor": "#E53935",
        "positionHint": "left",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"btn-legal-notice\"], button:contains(\"최고장 발행\")",
        "type": "click_ripple",
        "label": "법적 최고장 PDF 생성",
        "description": "우체국 내용증명 발송용 법적 채무 변제 최고장을 즉시 출력합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "top",
        "spotlight": true
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"btn-debt-relief-request\"], button:contains(\"탕감 결재\")",
        "type": "callout",
        "label": "연체 탕감 결재 상신",
        "description": "원금 일부 회수 후 잔여 이자 탕감 시 전자결재 승인을 상신합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"btn-close-delinquency\"], button.btn-close-case",
        "type": "click_ripple",
        "label": "채권 마감 및 법적 이관",
        "description": "채권 관리 상태를 갱신하고 법률 대리인 이관 또는 종결 처리합니다.",
        "badgeColor": "#10B981",
        "positionHint": "top",
        "spotlight": true
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"delinquency-scope-period\"]",
        "type": "callout",
        "label": "연체 위험도 필터",
        "description": "고위험, 지시방치, 30일/60일/90일 이상 연체 채권을 필터링합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"delinquency-inspection-grid\"]",
        "type": "highlight",
        "label": "연체 채권 관리 대장",
        "description": "거래처별 누적 연체액, 최종 약속일, 지시 현황을 1:1 대조 실사합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "process_delinquency_audit_action",
        "title": "장기 연체 채권 감사 및 최고장/출고정지 조치",
        "description": "연체 채권을 선별하여 내용증명을 발송하고 신용 거래 제한(출고 정지)을 단행합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"delinquency-scope-period\"]",
            "type": "click_ripple",
            "label": "고위험 연체 스코핑",
            "description": "상단의 [고위험] 또는 [지시방치] 필터 버튼을 클릭합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"delinquency-inspection-grid\"]",
            "type": "highlight",
            "label": "대상 거래처 실사",
            "description": "연체 총액과 최종 독촉 이력을 검토합니다.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "product",
    "version": 9,
    "menuName": "제품 관리",
    "groupId": "grp_product_asset",
    "groupName": "제품 / 자산관리",
    "department": "자산/품질관리팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "고소작업대 표준 모델 카탈로그(제조사, 모델명, 작업높이, 적재중량, 전폭, 차체중량, 배터리사양) 및 표준 렌탈 요율 마스터 관리",
    "scopeInfo": "제조사(스카이잭, 지니, 딩리, 시노붐 등), 모델 규격, 플랫폼 확장 제원, 전력 사양",
    "cognitiveSequence": [
      "1. 장비 분류 스코핑 (시저형, 굴절형, 직진형, 궤도형 고소작업대)",
      "2. 신규 모델명, 제조사, 플랫폼 최대 작업 높이 제원 입력",
      "3. 정격 하중(수용 인원 및 공구 중량), 자체 중량, 등판각도 스펙 검증",
      "4. 표준 월 렌탈료 단가표 및 일할 단가 기준 등록",
      "5. 정기 안전인증(KCs) 및 비파괴 검사 기준 주기 설정",
      "6. 권장 정비 부품 및 필수 소모품(배터리, 모터, 오일) BOM 매핑",
      "7. 장비 모델 마스터 최종 승인 및 렌탈 자산 등록 가용화"
    ],
    "auditResult": "전사 고소작업대 모델 마스터 표준화 및 출고/배차 시 제원 정합성 확보",
    "rulesCompliance": [
      "헌장 5.3 [SSOT 단일 진실의 원천]: 모델 제원 정보를 전사 단일 마스터 테이블에서 관리",
      "헌장 3.1 [무수식어 건조 UI]: \"최고급\", \"최신형\" 등 수식어 배제, 객관적 제원(m, kg) 표기"
    ],
    "precautions": [
      "작업 높이(Platform Height vs Working Height) 표기 혼동 방지 (작업높이 = 발판높이 + 2m)",
      "차체 중량 오기입 시 셀프 배차 톤수 초과로 인한 과적 단속 위험 발생"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"product-type-filter\"], .type-filter-bar",
        "type": "stamp",
        "label": "장비 기종 분류",
        "description": "시저형, 굴절형, 직진형 등 장비 메커니즘별로 목록을 스코핑합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"product-model-input\"], .model-input-group",
        "type": "stamp",
        "label": "모델명 및 작업 높이",
        "description": "제조사와 모델명, 최대 플랫폼 작업 가능 높이(m)를 등록합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"product-specs-card\"], .specs-card",
        "type": "highlight",
        "label": "적재 하중 및 자체 중량",
        "description": "정격 적재 하중(kg), 탑승 인원, 장비 자체 중량 제원을 검증합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"product-pricing-card\"], .pricing-card",
        "type": "stamp",
        "label": "표준 렌탈 단가표",
        "description": "표준 월 렌탈 단가와 일할 계산 단가 기준을 입력합니다.",
        "badgeColor": "#D97706",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"product-safety-cert\"], .safety-cert-box",
        "type": "stamp",
        "label": "법정 안전인증 기준",
        "description": "안전보건공단 안전인증(KCs) 및 비파괴 검사 만료 주기를 설정합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"product-bom-mapping\"], .bom-box",
        "type": "callout",
        "label": "소모품 부품목록 매핑",
        "description": "해당 기종에 투입되는 정품 배터리 규격과 유압 부품을 연결합니다.",
        "badgeColor": "#4F46E5",
        "positionHint": "left",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"btn-save-product\"], button:contains(\"모델 저장\")",
        "type": "click_ripple",
        "label": "모델 마스터 확정",
        "description": "모델 제원을 최종 저장하고 실물 자산 취득 및 계약에 가용화합니다.",
        "badgeColor": "#10B981",
        "positionHint": "bottom",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "asset",
    "version": 10,
    "menuName": "자산 관리 (대장)",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"btn-new-asset\"]",
        "type": "highlight",
        "label": "자산 취득 및 매각",
        "description": "신규 자산을 등록하거나 기존 자산을 매각 처리할 수 있는 페이지로 이동합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"asset-header-actions\"] button.btn-primary",
        "type": "highlight",
        "label": "임차자산 관리",
        "description": "임차자산의 현황을 관리하고 반납 처리 등을 수행하는 페이지로 이동합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"asset-filter-bar\"]",
        "type": "highlight",
        "label": "자산 검색 및 필터",
        "description": "관리번호, 모델명 등의 키워드 검색과 소유구분, 장비 상태 등의 조건으로 자산을 필터링합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "asset_edit",
        "title": "자산 상세 조회 및 수정",
        "description": "선택한 자산의 상세 명세서를 조회하고 필요 시 정보를 수정합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"asset-detail-action\"]",
            "type": "click_ripple",
            "label": "자산 선택",
            "description": "목록에서 자산의 보기 버튼을 클릭하여 상세 명세서를 엽니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "div[style*=\"z-index: 1000\"] > div:nth-child(1) .btn-primary",
            "type": "click_ripple",
            "label": "수정 버튼 클릭",
            "description": "상세 창 상단의 수정 버튼을 클릭하여 편집 모드로 전환합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid='asset-edit-section']",
            "type": "highlight",
            "label": "자산 정보 수정",
            "description": "장비 물리 제원, 운용 현황 등의 정보를 수정한 후 저장 버튼을 클릭하여 반영합니다.",
            "positionHint": "left"
          }
        ]
      },
      {
        "processId": "asset_history_export",
        "title": "자산 이력 다운로드",
        "description": "특정 자산의 정비 및 감사 이력을 엑셀 파일로 다운로드합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"asset-detail-action\"]",
            "type": "click_ripple",
            "label": "자산 선택",
            "description": "목록에서 자산의 보기 버튼을 클릭하여 상세 명세서를 엽니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid='asset-edit-section'] .btn-secondary",
            "type": "click_ripple",
            "label": "이력 엑셀 다운로드",
            "description": "정비 및 감사 이력 현황 항목의 이력 엑셀 버튼을 클릭하여 다운로드합니다.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "groupId": "grp_product_asset",
    "groupName": "제품 / 자산관리",
    "department": "자산/주기장팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "당사 보유 및 관리 중인 모든 개별 자산의 라이프사이클(AVAILABLE/RENTED/REPAIRING 등) 상태, 장비 일련번호, 바코드, 누적 매출 기여액 추적 관리 (헌장 1.2 핵심가치 1)",
    "scopeInfo": "자산번호(Barcode), 제품 모델, 시리얼 넘버, 소유 구분(당사 자산/외부 임차), 현재 상태, 현재 위치(주기장/고객현장)",
    "cognitiveSequence": [
      "1. 자산 통합 검색 및 상태/소유구분/제조사 필터링 스코핑",
      "2. 자산 운용 실시간 KPI 지표 검토 (임대가능, 현장대여중, 출고검수대기, 수리정비중, 실가동률)",
      "3. 고밀도 전사 자산 대장 그리드 1:1 대사 (관리번호, 모델, 규격, 소유, 거래처, 누적기여액)",
      "4. 개별 자산 상세 도시에 조회 및 수정 ([보기] 클릭: 제원, 계약, 이력, 정비점수)",
      "5. 하단 전사 자산 회계 대차대조식 무결성 검증 (등록자산 = 가동 + 대기, 장부가 총액)",
      "6. 자산 대장 엑셀 내보내기 및 데이터 백업",
      "7. 자산 신규 취득 및 매각 처리 연동"
    ],
    "auditResult": "자산 실물 라이프사이클과 DB 상태의 100% 일치 및 자산별 누적 기여액 정합성 보장",
    "rulesCompliance": [
      "헌장 1.2 [렌탈 자산의 효과적인 운용]: 자산 상태가 실제 물리적 현장과 완벽히 일치해야 함",
      "헌장 1.3 [상태 RENTED 전환 원칙]: 대여중 상태는 출고 검수 승인 마감 시에만 전환됨",
      "헌장 4.1 [자산별 매출 기여액 정밀 일할 집계]: 개별 자산의 누적 매출액을 1원도 틀림없이 표시"
    ],
    "precautions": [
      "자산 상태를 수동으로 강제 변경하지 말고 반드시 검수/정비 프로세스를 거쳐 자동 변경 유도",
      "도난/분실 의심 장비는 즉시 [상태: 분실조사중]으로 전환하고 최종 계약처 확인"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"asset-filter-bar\"], .asset-filter-bar",
        "type": "stamp",
        "label": "자산 통합 검색 및 필터",
        "description": "관리번호, 모델명, 제조사 검색 및 소유구분(당사/임차), 장비 상태별로 자산을 스코핑합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"asset-kpi-summary\"], .asset-kpi-cards",
        "type": "highlight",
        "label": "자산 운용 지표 요약",
        "description": "임대 가능(주기장), 현장 대여중, 출고/검수 대기, 수리/정비중 자산 대수와 실가동률을 실시간 점검합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"asset-table-container\"], .asset-table-container",
        "type": "highlight",
        "label": "전사 자산 대장 그리드",
        "description": "관리번호, 모델, 규격, 소유구분, 현재 고객사/현장, 누적 렌탈수익, 감가누계액 및 장부가액을 1:1 대사합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"asset-detail-action\"], button:contains(\"보기\")",
        "type": "click_ripple",
        "label": "자산 상세 도시에 보기",
        "description": "[보기]를 클릭하여 장비 제원, 계약 정보, 누적 입출고/정비 라이프사이클 이력을 확인하고 정보를 수정합니다.",
        "badgeColor": "#D97706",
        "positionHint": "right",
        "spotlight": true
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"asset-balance-bar\"], .asset-balance-bar",
        "type": "stamp",
        "label": "전사 자산 대차대조 검증",
        "description": "전사 등록자산 = 당사자산 + 임차자산, 실가동률 및 당사자산 장부가 총액의 회계적 일치를 검증합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"btn-asset-export\"], button:contains(\"엑셀 다운로드\")",
        "type": "callout",
        "label": "자산 대장 엑셀 내보내기",
        "description": "전사 자산 목록 및 상세 제원, 가동 현황 전체를 엑셀 파일로 다운로드합니다.",
        "badgeColor": "#4F46E5",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"btn-new-asset\"], button:contains(\"자산 취득\")",
        "type": "click_ripple",
        "label": "자산 신규 취득 / 매각",
        "description": "신규 장비 도입 및 노후 장비 매각 등록 화면으로 전환하여 자산 마스터를 갱신합니다.",
        "badgeColor": "#10B981",
        "positionHint": "bottom",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "acquisition_disposal",
    "version": 10,
    "menuName": "당사자산 취득 / 매각",
    "groupId": "grp_product_asset",
    "groupName": "제품 / 자산관리",
    "department": "자산/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "신규 고소작업대 도입 시 취득원가/취득일 등록 및 노후 장비 매각/폐기 프로세스를 회계적/물리적으로 확정 처리",
    "scopeInfo": "취득일, 취득가액, 구입처, 모델명, 제조년월, 매각일, 매각처, 매각가액, 처분손익",
    "cognitiveSequence": [
      "1. 취득/매각/폐기 구분 탭 및 처리 대상 자산 스코핑",
      "2. 신규 자산 취득 정보 입력 (구입처, 취득가액, 취득일자, 제조연월)",
      "3. 취득 자산 검수 및 시리얼·바코드 자산 라벨 출력 큐 전송",
      "4. 노후/전손 장비 매각 및 폐기 사유 평가 (수리비 과다, 연식 초과)",
      "5. 매각 대금 정산 및 세금계산서 발행, 감가상각 잔존가액 상계",
      "6. 자산 매각/폐기 전자결재 상신 (헌장 필수 결재선 연동)",
      "7. 자산 원장 영구 제각 처리 및 취득/처분 이력 DB 확정 보존"
    ],
    "subTabs": [
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
    "modalWorkflows": [
      {
        "modalName": "신규 자산 취득 등록 팝업",
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
    "auditResult": "고정자산 관리대장 동기화 및 유형자산 처분손익 회계 전표 원천 확정",
    "rulesCompliance": [
      "헌장 5.1 [리포트/통계 2단계 검증]: 장부가액 - 매각가액 = 처분손익 수학적 수식 정합성 충족",
      "헌장 1.2 [이벤트 기록 무누락]: 취득/매각 전 과정의 증빙 문서 및 승인 이력 영구 보존"
    ],
    "precautions": [
      "현재 대여중(RENTED) 상태인 장비는 반납 완료 전까지 매각 처리 불가",
      "세금계산서 발행 금액과 매각 확정 금액이 1원도 틀리지 않도록 사전 대사"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"acquisition_disposal-scope\"]",
        "type": "stamp",
        "label": "필터 및 검색",
        "description": "취득/매각 내역을 필터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"acquisition_disposal-pipeline-add\"]",
        "type": "stamp",
        "label": "신규 등록",
        "description": "새로운 취득/매각 건을 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"acquisition_disposal-inspection-grid\"]",
        "type": "stamp",
        "label": "내역 목록",
        "description": "취득/매각 내역 데이터 그리드입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"acquisition_disposal-detail-form\"]",
        "type": "stamp",
        "label": "상세 폼",
        "description": "항목의 세부 내용을 조회하고 수정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"acquisition_disposal-financial\"]",
        "type": "stamp",
        "label": "재무 정보",
        "description": "금액 및 결제 정보를 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"acquisition_disposal-terminal-audit\"]",
        "type": "stamp",
        "label": "이력/로그",
        "description": "처리 이력 및 감사 로그입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"acquisition_disposal-actions\"]",
        "type": "stamp",
        "label": "작업 버튼",
        "description": "저장, 삭제 등 주요 액션 버튼입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"acq-single-form-header\"]",
        "type": "highlight",
        "label": "신규 자산 취득 정보 폼",
        "description": "고소작업대 신규 도입 시 시리얼, 제조사, 취득가액, 감가상각 연수를 등록합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "process_single_acquisition",
        "title": "고소작업대 신규 자산 취득 등록",
        "description": "장비 입고 시 관리번호를 자동 채번하고 자산 대장에 정식 등재합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"acq-single-form-header\"]",
            "type": "highlight",
            "label": "취득 정보 입력",
            "description": "장비 모델, 시리얼번호, 제조년월 및 매입처를 입력합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "button[type=\"submit\"], button.btn-primary",
            "type": "click_ripple",
            "label": "자산 등재 확정",
            "description": "신규 자산번호를 발급받고 AVAILABLE(임대가능) 상태로 초기화합니다.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "rent_asset",
    "version": 10,
    "menuName": "임차 장비 관리",
    "groupId": "grp_product_asset",
    "groupName": "제품 / 자산관리",
    "department": "자산/구매팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "당사 보유 자산 부족 시 외부 타사(원사)로부터 임차(전대)해온 장비의 계약 조건, 원가 정산, 가동 현황 관리 (헌장 2.1)",
    "scopeInfo": "임차 공급처(원사), 외부 장비번호, 임차 시작/종료일, 월 임차료 원가, 당사 현장 재임대 매핑 정보",
    "cognitiveSequence": [
      "1. 외부 임차 장비 계약 목록 및 원사(임대처)별 스코핑",
      "2. 당사 자산 부족 시 외부 장비 신규 임차 등록 (원사, 모델, 임차 단가)",
      "3. 임차 장비의 당사 고객사 현장 재임대(전대) 계약 매핑",
      "4. 원사 지급 임차료 vs 고객사 수취 렌탈료 간 마진율 및 수지 분석 (헌장 5.5)",
      "5. 원사 반납 예정일 및 계약 연장 여부 알림 관리",
      "6. 원사 정기 임차료 지출결의 및 매입 세금계산서 대사",
      "7. 외부 임차 장비 현장 반납 및 원사 반납 확인서 종결 확정"
    ],
    "subTabs": [
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
    "auditResult": "외부 임차 장비의 원가/매출 분리 집계 및 반납 기한 준수를 통한 연체료 방지",
    "rulesCompliance": [
      "헌장 2.1 [출고/자산 부서 책임]: 자산 부족 시 타사 임차 장비 매핑 권한 및 정산 책임 이행",
      "헌장 4.1 [일할 집계]: 전대 장비도 당사 고객 계약에 대해 정밀 일할 매출 기여액 정상 산출"
    ],
    "precautions": [
      "당사 고객 반납 즉시 원사로 반납하지 않으면 공회전 임차료 손실이 발생하므로 반납 일정 철저 관리",
      "원사 장비 파손 시 고객 과실 여부를 확인하여 구상권 청구 증빙 확보"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"rent_asset-header\"]",
        "type": "stamp",
        "label": "임차 장비 관리",
        "description": "임차 장비 관리 메뉴입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"rent_asset-add-btn\"]",
        "type": "stamp",
        "label": "신규 등록",
        "description": "임차 자산을 신규 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"rent_asset-tabs\"]",
        "type": "stamp",
        "label": "탭 메뉴",
        "description": "대장, 협의, 원장, 정산 탭으로 이동합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"rent_asset-recon-scope\"]",
        "type": "stamp",
        "label": "정산 범위 설정",
        "description": "정산할 연월 및 임차처를 설정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"rent_asset-recon-pipeline\"]",
        "type": "stamp",
        "label": "파이프라인",
        "description": "명세서 데이터를 업로드합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"rent_asset-recon-grid\"]",
        "type": "stamp",
        "label": "대사 결과",
        "description": "업로드된 명세서와 자사 데이터를 대사합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"rent_asset-profit-summary\"]",
        "type": "stamp",
        "label": "손익 요약",
        "description": "전대 손익 및 매출/매입 요약입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"rent_asset-profit-grid\"]",
        "type": "stamp",
        "label": "손익 원장",
        "description": "자산별 누적 손익 상세 현황입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"stat-returned-assets\"]",
        "type": "highlight",
        "label": "타사 임차 장비 가동 현황",
        "description": "외부 전대/임차 장비의 가동 대수 및 월 총 지출 임차료를 확인합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "process_rent_asset_reconcile",
        "title": "월말 임차료 대사 및 정산 확정",
        "description": "타사에서 빌려온 전대 장비의 실제 가동 일수를 일할 계산하여 매입처 청구액과 대사합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"stat-returned-assets\"]",
            "type": "highlight",
            "label": "가동 및 반납 대수 확인",
            "description": "현장에 투입 중인 외부 임차 장비 목록을 조회합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "delivery",
    "version": 10,
    "menuName": "배차 / 운송 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "div[data-mid='dispatch-mode-tabs']",
        "type": "highlight",
        "label": "업무 탭 (배차/대사)",
        "description": "'배차 관리'와 '운송료 대사' 탭을 전환하여 업무를 수행합니다."
      },
      {
        "seq": 2,
        "selector": "div[data-mid='dispatch-status-tabs']",
        "type": "highlight",
        "label": "배차 상태 필터",
        "description": "배차 대기, 배차 완료, 이동 완료 등 상태별로 필터링할 수 있습니다."
      }
    ],
    "processes": [
      {
        "processId": "process_standard_dispatch",
        "title": "신규 출고/회수 배차 기사 매칭 및 운송 지시",
        "description": "발행된 출고 또는 회수 의뢰에 대해 전문 탁송 기사를 배정하고 운송비를 확정합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"dispatch-request-card\"], .card",
            "type": "click_ripple",
            "label": "배차 의뢰 접수",
            "description": "출고 또는 회수 요청 카드를 선택합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"driver-select-box\"], select",
            "type": "callout",
            "label": "운송 기사 지정",
            "description": "장비 제원(운송중량)에 적합한 카고/셀프로더 운송기사를 선택합니다.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"btn-confirm-dispatch\"], button.btn-primary",
            "type": "click_ripple",
            "label": "배차 확정 및 배차지시서 전송",
            "description": "기사에게 상하차지 주소 및 운송 지시를 모바일로 전송합니다.",
            "positionHint": "bottom"
          }
        ]
      },
      {
        "processId": "process_exchange_dispatch",
        "title": "헌장 2.3 교환(대차) 단일 왕복 배차 발행",
        "description": "대차 교체 발생 시 출고/회수를 분할하지 않고 EXCHANGE 1건으로 통합하여 왕복 운송비를 정산 관리합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"dispatch-exchange-badge\"], [data-mid=\"dispatch-request-card\"]",
            "type": "highlight",
            "label": "교환 의뢰 확인",
            "description": "대차 교체용 출고 장비와 회수 대상 장비의 1:1 체인을 검토합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"btn-confirm-dispatch\"], button.btn-primary",
            "type": "click_ripple",
            "label": "단일 왕복 배차 승인",
            "description": "왕복 운송비 할인이 적용된 1건의 교환 배차를 최종 확정합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "groupId": "grp_logistics",
    "groupName": "배차 / 운송관리",
    "department": "배차/물류팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "출고/회수/EXCHANGE 단일 배차 의뢰(헌장 2.3)에 대한 차량/기사 배정, 6대 신규 셀프 차종 매핑, 단가/일정 수정, 취소건 복원 및 월말 운송료 1:1 대사 완결 (헌장 3.6 탭별 이원화)",
    "scopeInfo": "배차 의뢰 목록(출고/회수/교환), 운송 거래처 마스터, 기사 연락처, 배차 차종(1.2T~8.5T 셀프 등), 운송료 단가, 상하차 일시",
    "cognitiveSequence": [
      "1. 배차 운송일 및 신청일 기간 조회 필터링 (기본 오늘부터 7일간 스코핑)",
      "2. 4단계 배차 진행 상태별 필터 탭 (전체, 배차 전, 배차 완료, 출발/하차 완료)",
      "3. 좌측 배차 의뢰서 카드 목록 탐색 (고객사, 상하차 주소, 출고 제원, 현장 날씨)",
      "4. 우측 배차 운송 기사 배정 및 세부 설정 스튜디오 (운송사, 기사, 차종, 운송비 확정)",
      "5. 배차/입출고 요청서 현장 원격 인쇄 및 직접 출력 (현장 라우팅 인쇄 지원)",
      "6. 배차 내역 엑셀 다운로드 및 일괄 등록",
      "7. 신규 수동 배차 생성 및 예외 배차 등록 ([+ 수동 배차 생성])"
    ],
    "subTabs": [
      {
        "tabId": "DISPATCH",
        "tabName": "배차 지시 및 기사 배정",
        "purpose": "출고, 입고, 교환(EXCHANGE) 배차 요청 접수 및 운송 기사/차량 배정 처리 (유형 A 카드 도시에)",
        "keyActions": [
          "배차 카드 검토",
          "기사 배정",
          "배차 정보 수정",
          "배차 취소/재배정"
        ],
        "basicGuide": [
          {
            "seq": 1,
            "selector": "div[data-mid='dispatch-mode-tabs']",
            "type": "highlight",
            "label": "업무 탭 (배차/대사)",
            "description": "'배차 관리'와 '운송료 대사' 탭을 전환하여 업무를 수행합니다."
          },
          {
            "seq": 2,
            "selector": "div[data-mid='dispatch-status-tabs']",
            "type": "highlight",
            "label": "배차 상태 필터",
            "description": "배차 대기, 배차 완료, 이동 완료 등 상태별로 필터링할 수 있습니다."
          }
        ],
        "processes": [
          {
            "processId": "dispatch-outbound",
            "title": "출고 배차 처리",
            "description": "출고 대기 건에 대해 배차 정보를 입력하고 배차를 완료합니다.",
            "steps": [
              {
                "seq": 1,
                "selector": "div[data-mid='dispatch-status-tabs'] button:nth-child(2)",
                "type": "click_ripple",
                "label": "배차 대기 탭 선택",
                "description": "대기 중인 배차 건을 확인합니다."
              },
              {
                "seq": 2,
                "selector": "[data-mid='delivery-queue-item']",
                "type": "click_ripple",
                "label": "배차 대기 건 선택",
                "description": "리스트에서 배차할 항목을 클릭합니다."
              },
              {
                "seq": 3,
                "selector": "select",
                "type": "callout",
                "label": "운송 정보 입력",
                "description": "기사 이름과 연락처, 차량번호를 선택하거나 입력합니다.",
                "positionHint": "left"
              },
              {
                "seq": 4,
                "selector": "button.btn-primary",
                "type": "click_ripple",
                "label": "배차 완료 버튼 클릭",
                "description": "배정된 정보를 저장하고 상태를 '배차 완료'로 변경합니다."
              }
            ]
          },
          {
            "processId": "dispatch-inbound",
            "title": "회수(반납) 배차 처리",
            "description": "입고/회수 대기 건에 대해 배차 정보를 입력하고 완료합니다.",
            "steps": [
              {
                "seq": 1,
                "selector": "div[data-mid='dispatch-status-tabs'] button:nth-child(2)",
                "type": "click_ripple",
                "label": "배차 대기 탭 선택",
                "description": "대기 중인 배차 건을 확인합니다."
              },
              {
                "seq": 2,
                "selector": "[data-mid='delivery-queue-item']",
                "type": "click_ripple",
                "label": "회수 배차 건 선택",
                "description": "리스트에서 [입고] 또는 [회수] 태그가 있는 건을 클릭합니다."
              },
              {
                "seq": 3,
                "selector": "select",
                "type": "callout",
                "label": "운송 정보 입력",
                "description": "회수 차량 및 기사 정보를 입력합니다.",
                "positionHint": "left"
              },
              {
                "seq": 4,
                "selector": "button.btn-primary",
                "type": "click_ripple",
                "label": "배차 완료 버튼 클릭",
                "description": "배정된 정보를 저장하고 회수 배차를 완료합니다."
              }
            ]
          },
          {
            "processId": "dispatch-reconciliation",
            "title": "운송비 월말 대사",
            "description": "배차가 완료된 건들의 운송비를 검증하고 대사합니다.",
            "steps": [
              {
                "seq": 1,
                "selector": "div[data-mid='dispatch-mode-tabs'] button:nth-child(2)",
                "type": "click_ripple",
                "label": "운송료 대사 탭 이동",
                "description": "상단의 '운송료 대사' 탭을 클릭합니다."
              },
              {
                "seq": 2,
                "selector": "table",
                "type": "highlight",
                "label": "운송비 검증",
                "description": "예상 운송비와 최종 청구 운송비 금액이 일치하는지 확인합니다."
              }
            ]
          }
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
    "modalWorkflows": [
      {
        "modalName": "배차 수정 및 재배정 스튜디오",
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
        "modalName": "월말 운송료 대사 차액 승인 팝업",
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
    "auditResult": "차량 배차 100% 완료 및 월말 운송료 청구총액 = 확정액 + 반려액 (차액 ₩0) 무결성 확정",
    "rulesCompliance": [
      "헌장 2.3 [단일 EXCHANGE 1건 발행 원칙]: 대차 교체 시 출고/입고 분할 없이 단일 왕복 배차로 통합 관리",
      "헌장 1.3 [배차 단계 상태 조작 금지]: 배차 단계에서 자산 상태를 대여중으로 바꾸지 않음 (출고검수 시 완결)",
      "헌장 3.6 [업무 본질 아키타입 이원화]: 탭 1(카드 도시에) vs 탭 2(고밀도 그리드) 독립 적용"
    ],
    "precautions": [
      "고소작업대 2대 이상 적재 시 5T장축 또는 8.5T 셀프 차량 필수 배정",
      "배차 취소 후 재배정 시 기존 기사에게 취소 통보 및 신규 기사 배차 안내 문자 발송 필수"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dispatch-date-filter\"], .date-filter-group",
        "type": "stamp",
        "label": "배차 운송일/신청일 기간 조회",
        "description": "운송일자 및 신청일자 기준 기간(기본 오늘부터 7일간)을 스코핑하여 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dispatch-status-tabs\"], .dispatch-status-tabs",
        "type": "highlight",
        "label": "배차 진행 상태별 탭",
        "description": "전체, 배차 전(대기), 배차 완료, 출발 완료, 하차 완료 상태별로 필터링합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"dispatch-dossier-card\"], .dossier-card",
        "type": "stamp",
        "label": "배차 의뢰 목록 카드",
        "description": "고객사, 상하차지 주소, 현장 담당자, 출고 제원 및 하차지 실시간 날씨를 확인합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"dispatch-assign-studio\"], .assign-studio",
        "type": "highlight",
        "label": "기사 배정 및 상하차 세부 설정",
        "description": "협력 운송사 및 차량 기사를 배정하고, 셀프 차종 및 편도/왕복 운송비를 설정하여 확정합니다.",
        "badgeColor": "#D97706",
        "positionHint": "left",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"btn-dispatch-print\"], button:contains(\"요청서 인쇄\")",
        "type": "click_ripple",
        "label": "배차 요청서 현장 출력",
        "description": "현장 프린터(출고: 프린터1, 입고: 프린터2)로 자동 원격 출력하거나 브라우저에서 직접 인쇄합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"btn-dispatch-export\"], button:contains(\"배차 엑셀\")",
        "type": "callout",
        "label": "배차 엑셀 내보내기/일괄 등록",
        "description": "배차 대장 전체 내역을 엑셀로 내보내거나 대량 배차 건을 엑셀 서식으로 일괄 등록합니다.",
        "badgeColor": "#4F46E5",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"btn-new-dispatch\"], button:contains(\"수동 배차 생성\")",
        "type": "click_ripple",
        "label": "수동 배차 생성 등록",
        "description": "계약 외 긴급 이동이나 특수 운송건에 대해 수동 배차 의뢰를 생성 등록합니다.",
        "badgeColor": "#10B981",
        "positionHint": "bottom",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "transport_master",
    "version": 10,
    "menuName": "운송 거래처 관리",
    "groupId": "grp_logistics",
    "groupName": "배차 / 운송관리",
    "department": "배차/물류팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "외주 운송사 및 지입/직속 화물 기사 마스터, 보유 차종(1.2T~8.5T 셀프), 계좌 정보, 구간별 표준 운송 요율표 관리",
    "scopeInfo": "운송사 상호, 사업자번호, 기사 성명, 연락처, 차량 번호, 차종/톤수, 지급 계좌",
    "cognitiveSequence": [
      "1. 협력 운송사 및 지입/직영 기사 목록 스코핑",
      "2. 신규 운송사 사업자등록증 및 화물운송사업 허가증 검증",
      "3. 운송 기사 인적사항, 차량 톤수(5톤/11톤/셀프로더), 차종 등록",
      "4. 권역별(시/도/군) 표준 운송료 단가표 및 왕복 탁송 할인율 등록",
      "5. 운송 기사 통장 사본 등록 및 운송료 지급 계좌 유효성 검증",
      "6. 배차 수행 실적 및 현장 안전 준수 평점 이력 관리",
      "7. 운송사 및 기사 마스터 최종 승인 및 배차 배정 가용화"
    ],
    "auditResult": "배차 시 기사 자동완성 및 월말 운송료 이체 계좌 데이터 100% 무결성 확보",
    "rulesCompliance": [
      "헌장 3.2 [줄바꿈 방지]: 기사명, 차량번호, 차종 셀 줄바꿈 방지 적용",
      "헌장 1.2 [이벤트 기록]: 기사 정보 및 계좌 변경 이력 감사 로그 보존"
    ],
    "precautions": [
      "셀프 로더(Self-loader) 차량이 아닌 일반 카고 차량은 고소작업대 자가 상하차 불가하므로 차종 등록 시 엄격 확인",
      "운송비 입금 계좌의 예금주명과 사업자/주민번호 일치 여부 필수 검증"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"transport_master-header\"]",
        "type": "stamp",
        "label": "운송 거래처 관리",
        "description": "물류사 및 소속 기사를 관리합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"transport_master-summary\"]",
        "type": "stamp",
        "label": "현황 요약",
        "description": "전체 등록 운송사 및 기사 수를 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"transport_master-company-list\"]",
        "type": "stamp",
        "label": "운송사 목록",
        "description": "등록된 운송 거래처를 선택하여 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"transport_master-company-add-btn\"]",
        "type": "stamp",
        "label": "운송사 등록",
        "description": "새로운 운송 거래처를 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"transport_master-driver-list\"]",
        "type": "stamp",
        "label": "소속 기사 목록",
        "description": "선택된 운송사의 소속 기사를 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"transport_master-driver-add-btn\"]",
        "type": "stamp",
        "label": "기사 등록",
        "description": "새로운 운송 기사를 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"transport_master-driver-grid\"]",
        "type": "stamp",
        "label": "기사 상세",
        "description": "운송 기사의 차량, 연락처 등 상세 정보입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"stat-transport-company\"]",
        "type": "highlight",
        "label": "운송사 및 기사 현황",
        "description": "등록된 협력 운송사와 전속 운송 기사 등록 현황을 조망합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"transport-company-table\"], table",
        "type": "highlight",
        "label": "운송 협력사 원장",
        "description": "운송사별 사업자정보, 기본 운임 요율표, 정산 계좌를 관리합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "process_register_transport_driver",
        "title": "신규 운송 기사 등록 및 차종/계좌 설정",
        "description": "새로운 탁송 기사의 차량 톤수(5톤/11톤/셀프로더)와 운임 입금 계좌를 등록합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"stat-transport-company\"]",
            "type": "highlight",
            "label": "운송사 선택",
            "description": "소속 운송 거래처를 지정합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "button.btn-primary",
            "type": "click_ripple",
            "label": "기사 등록 완료",
            "description": "기사 연락처와 차량 등록증을 저장합니다.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "daily_inout",
    "version": 6,
    "menuName": "일일 입출고 조회",
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "출고팀 / 주기장팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "고소작업대 렌탈 현장의 매일 발생하는 장비 출고와 입고 현황을 일자별·기종별로 파악하고 주기장 실물 재고의 순유입/유출 추이를 직관적으로 모니터링",
    "scopeInfo": "조회 기준 연월, 입출 구분(입고/출고), 진행 상태(실적/배차예정), 모델명(기종), 거래처 및 현장 정보",
    "cognitiveSequence": [
      "1. 좌상단 조회 연월(이전달/다음달/오늘) 및 입출구분/진행상태/모델 필터 설정",
      "2. 우상단 뷰 모드(캘린더 형태 / 표 형태) 선택 및 필요 시 엑셀 내보내기 실행",
      "3. 중앙 캘린더 그리드에서 일자별 입고(청색) 및 출고(적색) 수량과 기종별 표기(모델명 * 수량) 조망",
      "4. 일자 셀 상단 순유동 배지(순유입/순유출)를 통한 당일 주기장 재고 변동 확인",
      "5. 특정 일자 클릭 시 하단 상세 도시에 패널에서 건별 거래처, 현장, 자산번호, 배차상태 실사",
      "6. 표 형태 보기 전환 시 슬림 고밀도 행 기반 1:1 대사 그리드에서 전수 목록 확인",
      "7. 최하단 대차대조 집계 바에서 당월 총 입고, 총 출고 및 주기장 실물 순유동 대차 차액 검증"
    ],
    "auditResult": "당월 총 입고 대수 = 실적 입고 + 배차예정 입고 | 당월 총 출고 대수 = 실적 출고 + 배차예정 출고 | 주기장 순유동 = 총 입고 - 총 출고",
    "rulesCompliance": [
      "헌장 1.1: 임직원 최소 조작으로 월간/일간 입출고 현황을 한눈에 파악하는 최대 편익 창출",
      "헌장 1.2: assetInOutLogs 실적 및 deliveries 배차예정 이벤트 무누락 DB 추적",
      "헌장 3.1: 감성적 수식어 배제 및 건조한 명사·동사 UI 단일 표준 준수",
      "헌장 3.2: 캘린더 칩 및 테이블 셀 white-space: nowrap 적용으로 줄바꿈 방지",
      "헌장 3.4: 필터 패널 레이블-입력 상하 스택(vertical column) 레이아웃 준수",
      "헌장 3.5: 좌상단 스코프  우상단 파이프라인  중앙 본문  우하단 대차대조 4단계 Gutenberg Z-패턴 동선 확립"
    ],
    "precautions": [
      "출고 및 입고 수량은 단일 표준 표기인 [모델명 * 수량] 규칙을 준수해야 합니다.",
      "배차 진행 상태가 DELIVERED(운송완료)인 건은 입출고 실적과 중복 집계되지 않도록 소스가 투명하게 구분되어야 합니다.",
      "교환(EXCHANGE) 배차의 경우 상차일은 출고, 하차일은 입고로 1:1 분기 집계됩니다."
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"filter-panel\"]",
        "type": "stamp",
        "label": "조회 조건 패널",
        "description": "조회 연월 이동 및 입출구분, 진행상태, 모델 필터를 설정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"view-mode-toggle\"]",
        "type": "stamp",
        "label": "보기 전환",
        "description": "캘린더 형태 보기와 고밀도 표 형태 보기 간 전환합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"btn-export-excel\"]",
        "type": "stamp",
        "label": "엑셀 내보내기",
        "description": "조회 조건에 부합하는 일일 입출고 대장을 엑셀 파일로 다운로드합니다.",
        "badgeColor": "#10B981",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"calendar-grid-card\"]",
        "type": "stamp",
        "label": "월간 캘린더",
        "description": "월간 7열 달력 상에서 일자별 입고/출고 칩과 순유동을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"chip-inbound\"]",
        "type": "stamp",
        "label": "입고 칩",
        "description": "청색 계열 입고 칩에서 일일 입고 총수량 및 모델별 수량을 확인합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"chip-outbound\"]",
        "type": "stamp",
        "label": "출고 칩",
        "description": "적색 계열 출고 칩에서 일일 출고 총수량 및 모델별 수량을 확인합니다.",
        "badgeColor": "#DC2626",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"daily-detail-panel\"]",
        "type": "stamp",
        "label": "일자 상세 내역",
        "description": "선택된 일자의 입고/출고 건별 거래처, 현장, 자산번호, 배차상태를 실사합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"audit-summary-bar\"]",
        "type": "stamp",
        "label": "대차대조 집계 바",
        "description": "당월 총 입고, 총 출고 및 주기장 실물 순유동 대차 차액을 최종 검증합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "asset_inout_history",
    "version": 10,
    "menuName": "자산 입출고",
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "주기장팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "주기장 게이트를 통과하는 모든 장비의 물리적 입출고 시간, 운송차량, 상하차 기사, 작업자 기록을 무누락 시계열 DB 보존 (헌장 1.2 핵심가치 2)",
    "scopeInfo": "게이트 통과 일시, 입출고 구분(IN/OUT), 자산번호, 운송 차량번호, 담당 기사, 연계 계약/배차 번호",
    "cognitiveSequence": [
      "1. 조회 기간 및 입출고 유형(출고, 반납, 대차교체, 주기장이동) 스코핑",
      "2. 자산 번호별 생애주기 입출고 타임라인 1:1 인과율 전수 검수 (헌장 5.6)",
      "3. 출고 검수 승인 시점의 RENTED 대여중 상태 전환 로그 확인 (헌장 1.3)",
      "4. 대차 교체(EXCHANGE) 시 전자산 회수  후장비 승계 연결 관계 추적 (헌장 4.2)",
      "5. 운송 기사 및 배차 번호 매핑 검증",
      "6. 주기장 입고 시 반납 검수 판정(정상/파손/오염) 기록 확인",
      "7. 자산 입출고 감사 이력 무누락 보존 확정 및 엑셀 내보내기"
    ],
    "subTabs": [
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
    "auditResult": "주기장 내 물리적 장비 재고와 시스템 DB 재고의 100% 일치 보장",
    "rulesCompliance": [
      "헌장 1.2 [발생 사건 무누락 DB 저장]: 게이트 통과 이벤트 타임스탬프 영구 보존",
      "헌장 5.6 [시계열 타임라인 무결성]: 입출고 순서와 배차/검수 타임스탬프 인과율 준수"
    ],
    "precautions": [
      "출고 검수가 승인되지 않은 장비가 게이트를 통과하지 않도록 차단기 인터락 주의",
      "야간 긴급 반납 건은 다음 날 아침 1교시 게이트 로그 필수 대조 확인"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"asset_inout_history-scope\"]",
        "type": "stamp",
        "label": "검색 및 필터",
        "description": "입출고 이력을 검색합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"asset_inout_history-pipeline\"]",
        "type": "stamp",
        "label": "입출고 등록",
        "description": "수동으로 입출고 이력을 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"asset_inout_history-inspection-grid\"]",
        "type": "stamp",
        "label": "이력 목록",
        "description": "입출고 이력 데이터 그리드입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"asset_inout_history-detail\"]",
        "type": "stamp",
        "label": "상세 정보",
        "description": "선택한 이력의 상세 정보입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"asset_inout_history-chart\"]",
        "type": "stamp",
        "label": "통계/차트",
        "description": "입출고 통계를 시각적으로 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"asset_inout_history-terminal-audit\"]",
        "type": "stamp",
        "label": "감사 로그",
        "description": "입출고 관련된 시스템 로그입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"asset_inout_history-actions\"]",
        "type": "stamp",
        "label": "작업 버튼",
        "description": "엑셀 다운로드 등 부가 작업입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"stat-inout-returns\"]",
        "type": "highlight",
        "label": "입출고 통합 이력 지표",
        "description": "전체 출고 및 반납 입고 누적 이력과 회수율을 조회합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "process_audit_inout_lifecycle",
        "title": "자산별 출고-반납 풀 라이프사이클 추적",
        "description": "자산번호별로 어느 현장에 출고되어 언제 반납되었는지 타임라인을 전수 실사합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"stat-inout-returns\"]",
            "type": "highlight",
            "label": "입출고 이력 대장 조회",
            "description": "조회 조건별 출납 이력을 대조합니다.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "dispatch_assign",
    "version": 10,
    "menuName": "장비 할당 / 매핑",
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "출고/자산관리팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "영업부서의 출고 요청에 대해 주기장의 적격 가용 자산(AVAILABLE) 또는 외부 타사 임차 장비를 실제 실물 자산번호와 매핑하여 검수 대기열로 인계 (헌장 2.1)",
    "scopeInfo": "미할당 출고 요청 목록, 요구 모델/사양, 주기장 내 임대가능(AVAILABLE) 자산 목록",
    "cognitiveSequence": [
      "1. 미배정 배차 대기 큐 및 상차 임박 긴급도 스코핑",
      "2. 현장별 상하차 주소 및 고소작업대 적재 톤수/차종(셀프로더) 확인",
      "3. 주기장 근접 및 운행 가능한 협력 운송 기사 실시간 탐색",
      "4. 배차 유형(출고/회수/EXCHANGE 단일 교환) 확인 및 운송료 산정 (헌장 2.3)",
      "5. 운송 기사 배정 및 현장 작업지시서·기상 주의사항 모바일 전송",
      "6. 기사 상차 확인 및 배차 상태 배정 완료(ASSIGNED) 전환",
      "7. 당일 배차 배정 큐 100% 완결 확정"
    ],
    "auditResult": "출고 요청과 실물 자산번호 1:1 매핑 완료 및 자산 상태 ASSIGNED(출고대기) 전환",
    "rulesCompliance": [
      "헌장 2.1 [출고/자산 부서 고유 권한]: 자산번호 지정은 오직 출고/자산 부서의 권한과 책임 하에 집행",
      "헌장 1.2 [효과적인 자산 운용]: 선입선출 및 배터리 수명 주기를 고려한 균등 장비 회전 배정"
    ],
    "precautions": [
      "정비 중(REPAIRING)이거나 배터리 저전압 상태인 장비를 강제 할당 금지",
      "현장 특수 요구(상부 센서 등)가 장착된 장비인지 실물 제원표 교차 확인"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dispatch_assign-scope\"]",
        "type": "stamp",
        "label": "배차 현황",
        "description": "배차 현황을 요약하여 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dispatch_assign-exchange-list\"]",
        "type": "stamp",
        "label": "교체 요청 목록",
        "description": "대체 장비가 필요한 교체 건을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"dispatch_assign-list\"]",
        "type": "stamp",
        "label": "출고 대기 목록",
        "description": "출고 대기 중인 계약 목록입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"dispatch_assign-pipeline\"]",
        "type": "stamp",
        "label": "장비 할당",
        "description": "장비 할당 상세 화면입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"dispatch_assign-left-panel\"]",
        "type": "stamp",
        "label": "매핑 대상",
        "description": "매핑해야 할 장비 목록입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"dispatch_assign-right-grid\"]",
        "type": "stamp",
        "label": "가용 장비",
        "description": "현재 할당 가능한 장비 목록입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"dispatch_assign-right-panel\"]",
        "type": "stamp",
        "label": "장비 매핑",
        "description": "선택한 장비를 계약에 매핑합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": true
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dispatch-assign-root\"]",
        "type": "highlight",
        "label": "출고 의뢰별 장비 할당 워크벤치",
        "description": "계약된 규격에 부합하는 주기장 내 임대가능 장비 또는 외부 임차 장비를 1:1 매핑합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "process_assign_asset_to_dispatch",
        "title": "출고 대기 자산번호 1:1 초이스 및 매핑",
        "description": "영업부 출고 의뢰에 대해 자산부 권한으로 최적의 장비 번호를 지정합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"dispatch-assign-root\"]",
            "type": "highlight",
            "label": "출고 의뢰 선택",
            "description": "할당 대기 중인 계약 건을 선택합니다.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "outbound_inspections",
    "version": 10,
    "menuName": "출고 검수 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "div[data-mid='tab-pending']",
        "type": "highlight",
        "label": "접수 대기 상태",
        "description": "아직 엔지니어가 검수를 시작하지 않은 대기 상태의 요청들입니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "div[data-mid='tab-in-progress']",
        "type": "highlight",
        "label": "검수 진행중 상태",
        "description": "접수되어 현재 점검 및 검수가 진행 중인 요청들입니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 3,
        "selector": "div[data-mid='outbound-queue-list']",
        "type": "callout",
        "label": "출고 요청 대기열",
        "description": "상차일자 및 고객사 기준으로 그룹화된 출고 검수 요청 목록입니다.",
        "positionHint": "right"
      }
    ],
    "processes": [
      {
        "processId": "process_outbound_approve",
        "title": "출고 검수 승인",
        "description": "출고 요청 건을 접수하고 점검 항목을 확인한 뒤 최종 승인합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "div[data-mid='outbound-queue-item']",
            "type": "click_ripple",
            "label": "의뢰 선택",
            "description": "검수 대기 중인 요청 카드를 클릭하여 우측에 상세 정보를 표시합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "div[data-mid='btn-accept-job']",
            "type": "click_ripple",
            "label": "작업 접수",
            "description": "'▶ 작업 접수 실행' 버튼을 클릭하여 검수를 시작합니다.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "div[data-subview=\"outbound_inspections\"] > div:nth-child(3) > div:nth-child(2) button.btn-secondary",
            "type": "click_ripple",
            "label": "항목 일괄 확인",
            "description": "'전체 선택/해제' 버튼을 눌러 점검 항목을 일괄 체크합니다. (개별 체크도 가능)",
            "positionHint": "left"
          },
          {
            "seq": 4,
            "selector": "div[data-subview=\"outbound_inspections\"] > div:nth-child(3) > div:nth-child(2) button.btn-primary",
            "type": "stamp",
            "label": "최종 출고 승인",
            "description": "'[🟢 최종 출고 승인 마감]' 버튼을 클릭합니다. 자산 상태가 RENTED로 전환됩니다.",
            "positionHint": "top"
          }
        ]
      },
      {
        "processId": "process_outbound_reject",
        "title": "출고 검수 반려",
        "description": "불량 등의 사유로 출고가 불가능할 때 요청을 반려하고 수리를 등록합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "div[data-mid='outbound-queue-item']",
            "type": "click_ripple",
            "label": "의뢰 선택",
            "description": "검수 대기 또는 진행 중인 요청 카드를 클릭합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "div[data-subview=\"outbound_inspections\"] > div:nth-child(3) > div:nth-child(2) button.btn-primary + button",
            "type": "click_ripple",
            "label": "요청 반려 클릭",
            "description": "하단의 ' 요청 반려' 버튼을 클릭하여 반려 사유 입력 창을 엽니다.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid='reject-reason-input']",
            "type": "callout",
            "label": "반려 사유 작성",
            "description": "타이어 마모, 배터리 불량 등 구체적인 출고 반려 사유를 입력합니다.",
            "positionHint": "top"
          },
          {
            "seq": 4,
            "selector": "[data-mid='switch-maintenance']",
            "type": "click_ripple",
            "label": "수리정비중 전환",
            "description": "해당 장비를 긴급 수리 상태로 전환하려면 토글을 켭니다.",
            "positionHint": "left"
          },
          {
            "seq": 5,
            "selector": "[data-mid='btn-reject-confirm']",
            "type": "stamp",
            "label": "반려 처리 실행",
            "description": "'반려 처리 실행' 버튼을 눌러 반려를 확정합니다.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "출고검수팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "현장 출고 직전 20대 법정 안전 옵션(과상승 방지, 리미트 센서, 비상하강) 및 배터리/유압 작동 전수 검수, 승인 마감 시 자산 상태 RENTED(대여중) 자동 전환 (헌장 1.3)",
    "scopeInfo": "할당 완료된 출고 대기 장비, 출고 체크리스트 템플릿, 현장 요구 옵션 내역, 검수 사진",
    "cognitiveSequence": [
      "1. 당일 출고 대기 자산 목록 및 상차 스케줄 스코핑",
      "2. 고소작업대 외관 점검 (도색, 볼팅, 타이어 마모, 누유 유무)",
      "3. 기능 및 안전장치 작동 테스트 (상승/하강, 주행, 비상정지, 과부하 경보)",
      "4. 배터리 완충 전압(25.4V 이상) 및 충전기 동작 상태 정밀 측정",
      "5. 현장 맞춤 안전옵션(협착방지대, 경광등, 안전벨트 걸이구) 볼팅 체결 확인",
      "6. 검수 체크리스트 전수 서명 및 출고 전 장비 전/후/좌/우 실물 사진 등록",
      "7. 최종 [출고 검수 승인] 실행  자산 상태 즉시 RENTED 대여중 자동 전환 (헌장 1.3)"
    ],
    "modalWorkflows": [
      {
        "modalName": "출고 검수 승인 팝업",
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
    "auditResult": "출고 검수 성적서 발행 및 자산 상태 즉시 RENTED(대여중) 전환 완료 (헌장 1.3)",
    "rulesCompliance": [
      "헌장 1.3 [출고 검수 승인 마감 시 자산 상태 RENTED 전환 원칙]: 배차 단계가 아닌 이 시점에 대여중 전환 완결",
      "헌장 1.2 [이벤트 기록 무누락]: 검수자, 승인 시각, 20대 체크리스트 결과, 사진 증빙 DB 영구 저장"
    ],
    "precautions": [
      "비상 하강 밸브 수동 작동 불량 시 현장 인명 사고 위험이 있으므로 절대 출고 승인 금지",
      "충전기 내장형 모델의 경우 충전 플러그 접지 단자 파손 여부 필수 확인"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"outbound_inspections-scope\"]",
        "type": "stamp",
        "label": "필터 및 검색",
        "description": "검수 목록을 필터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false,
        "basicGuide": [
          {
            "seq": 1,
            "selector": "div[data-mid='tab-pending']",
            "type": "highlight",
            "label": "접수 대기 상태",
            "description": "아직 엔지니어가 검수를 시작하지 않은 대기 상태의 요청들입니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "div[data-mid='tab-in-progress']",
            "type": "highlight",
            "label": "검수 진행중 상태",
            "description": "접수되어 현재 점검 및 검수가 진행 중인 요청들입니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "div[data-mid='outbound-queue-list']",
            "type": "callout",
            "label": "출고 요청 대기열",
            "description": "상차일자 및 고객사 기준으로 그룹화된 출고 검수 요청 목록입니다.",
            "positionHint": "right"
          }
        ],
        "processes": [
          {
            "processId": "process_outbound_approve",
            "title": "출고 검수 승인",
            "description": "출고 요청 건을 접수하고 점검 항목을 확인한 뒤 최종 승인합니다.",
            "steps": [
              {
                "seq": 1,
                "selector": "div[data-mid='outbound-queue-item']",
                "type": "click_ripple",
                "label": "의뢰 선택",
                "description": "검수 대기 중인 요청 카드를 클릭하여 우측에 상세 정보를 표시합니다.",
                "positionHint": "right"
              },
              {
                "seq": 2,
                "selector": "div[data-mid='btn-accept-job']",
                "type": "click_ripple",
                "label": "작업 접수",
                "description": "'▶ 작업 접수 실행' 버튼을 클릭하여 검수를 시작합니다.",
                "positionHint": "top"
              },
              {
                "seq": 3,
                "selector": "div[data-subview=\"outbound_inspections\"] > div:nth-child(3) > div:nth-child(2) button.btn-secondary",
                "type": "click_ripple",
                "label": "항목 일괄 확인",
                "description": "'전체 선택/해제' 버튼을 눌러 점검 항목을 일괄 체크합니다. (개별 체크도 가능)",
                "positionHint": "left"
              },
              {
                "seq": 4,
                "selector": "div[data-subview=\"outbound_inspections\"] > div:nth-child(3) > div:nth-child(2) button.btn-primary",
                "type": "stamp",
                "label": "최종 출고 승인",
                "description": "'[🟢 최종 출고 승인 마감]' 버튼을 클릭합니다. 자산 상태가 RENTED로 전환됩니다.",
                "positionHint": "top"
              }
            ]
          },
          {
            "processId": "process_outbound_reject",
            "title": "출고 검수 반려",
            "description": "불량 등의 사유로 출고가 불가능할 때 요청을 반려하고 수리를 등록합니다.",
            "steps": [
              {
                "seq": 1,
                "selector": "div[data-mid='outbound-queue-item']",
                "type": "click_ripple",
                "label": "의뢰 선택",
                "description": "검수 대기 또는 진행 중인 요청 카드를 클릭합니다.",
                "positionHint": "right"
              },
              {
                "seq": 2,
                "selector": "div[data-subview=\"outbound_inspections\"] > div:nth-child(3) > div:nth-child(2) button.btn-primary + button",
                "type": "click_ripple",
                "label": "요청 반려 클릭",
                "description": "하단의 ' 요청 반려' 버튼을 클릭하여 반려 사유 입력 창을 엽니다.",
                "positionHint": "top"
              },
              {
                "seq": 3,
                "selector": "[data-mid='reject-reason-input']",
                "type": "callout",
                "label": "반려 사유 작성",
                "description": "타이어 마모, 배터리 불량 등 구체적인 출고 반려 사유를 입력합니다.",
                "positionHint": "top"
              },
              {
                "seq": 4,
                "selector": "[data-mid='switch-maintenance']",
                "type": "click_ripple",
                "label": "수리정비중 전환",
                "description": "해당 장비를 긴급 수리 상태로 전환하려면 토글을 켭니다.",
                "positionHint": "left"
              },
              {
                "seq": 5,
                "selector": "[data-mid='btn-reject-confirm']",
                "type": "stamp",
                "label": "반려 처리 실행",
                "description": "'반려 처리 실행' 버튼을 눌러 반려를 확정합니다.",
                "positionHint": "top"
              }
            ]
          }
        ]
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"outbound_inspections-pipeline-add\"]",
        "type": "stamp",
        "label": "새 검수 등록",
        "description": "새로운 검수 건을 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"outbound_inspections-inspection-grid\"]",
        "type": "stamp",
        "label": "검수 목록",
        "description": "출고 검수 목록입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"outbound_inspections-detail-form\"]",
        "type": "stamp",
        "label": "검수 상세",
        "description": "검수 상세 정보 입력 폼입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"outbound_inspections-checklist\"]",
        "type": "stamp",
        "label": "체크리스트",
        "description": "검수 항목을 체크합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"outbound_inspections-terminal-audit\"]",
        "type": "stamp",
        "label": "이력 및 감사",
        "description": "검수 이력을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"outbound_inspections-actions\"]",
        "type": "stamp",
        "label": "작업 버튼",
        "description": "검수 완료 및 기타 작업을 수행합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "consumable_stock",
    "version": 10,
    "menuName": "주기장 소모품 재고",
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "주기장/자재팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "주기장 정비 및 출고 시 소모되는 부품(배터리, 충전기, 작동유, 조이스틱, 타이어 등)의 실시간 수불 관리 및 적정 안전 재고 유지",
    "scopeInfo": "부품 코드, 품명, 규격, 적정 재고량, 현재고량, 입고/출고 수불 내역, 보관 위치(창고/선반)",
    "cognitiveSequence": [
      "1. 소모품 카테고리(배터리, 유압유, 전선, 조이스틱, 라벨지) 스코핑",
      "2. 품목별 안전 재고량 대비 현재 실재고 수량 모니터링",
      "3. 바코드/QR코드 라벨 서식 템플릿 선택 및 ZPL 코드 보정",
      "4. 인쇄 위치(X/Y 좌표 오프셋) 미세 조정 및 테스트 인쇄",
      "5. 실물 품목별 바코드 라벨 대량 출력 큐 전송",
      "6. 주기장 부품 보관 랙(Rack) 및 위치 번호(Bin) 매핑",
      "7. 소모품 실사 수량 확정 및 재고 원장 동기화"
    ],
    "subTabs": [
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
    "modalWorkflows": [
      {
        "modalName": "부품 재고 이동 및 차량 불출 팝업",
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
    "auditResult": "정비 부품 결품 제로 달성 및 주기장 자재 자산 가액 정확한 결산 반영",
    "rulesCompliance": [
      "헌장 3.1 [건조한 UI 표기]: \"스마트 재고\", \"자동 감시\" 등 수식어 배제, 규격과 수량 중심 표기",
      "헌장 5.1 [수학적 수식 정립]: 기말재고 = 기초재고 + 입고 - 출고 보존 법칙 충족"
    ],
    "precautions": [
      "배터리는 보관 중 자연 방전되므로 30일 이상 미사용 재고는 주기적 보충전 필수",
      "유압 작동유는 이물질 혼입 방지를 위해 개봉 후 밀봉 보관 확인"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"consumable_stock-tab-nav\"]",
        "type": "stamp",
        "label": "재고 영역 전환",
        "description": "본사 주기장 재고, 이동 정비차량 재고, 실사 재고조사 탭을 전환합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"consumable_stock-kpi-stats\"]",
        "type": "stamp",
        "label": "소모품 현황 요약",
        "description": "관리 품목 수, 총 보유 수량, 주기장 평가액, 전사 총 재고액을 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"consumable_stock-scope\"]",
        "type": "stamp",
        "label": "품목 검색 필터",
        "description": "품목명, 공급처, 재고 상태별로 소모품 목록을 검색 및 정렬합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"consumable_stock-pipeline-actions\"]",
        "type": "stamp",
        "label": "소모품 관리 액션",
        "description": "신규 품목 마스터 등록 및 소모품 재고 대장을 엑셀로 내보냅니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"consumable_stock-inspection-grid\"]",
        "type": "stamp",
        "label": "소모품 재고 대장",
        "description": "품목별 주기장 재고, 차량 재고, 단가, 평가액을 대조하고 품목 정보를 수정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "right",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"consumable_stock-vehicle-scope\"]",
        "type": "stamp",
        "label": "정비 차량 선택",
        "description": "정비 차량별 적재 부품 및 담당 기사별 출고 재고를 선택 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"consumable_stock-pipeline-transfer\"]",
        "type": "stamp",
        "label": "차량 부품 이송",
        "description": "주기장 재고 부품을 현장 정비 차량으로 불출 이관 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "left",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"consumable_stock-terminal-audit-confirm\"]",
        "type": "stamp",
        "label": "실사 재고 확정",
        "description": "전산 재고와 실물 실사 수량의 차액을 대조하고 재고 조정을 최종 확정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"consumable_stock-tab-nav\"]",
        "type": "highlight",
        "label": "재고 영역 전환",
        "description": "주기장 창고 재고, 이동 정비차량 재고, 고품 관리, 실사 재고 탭을 전환합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"consumable_stock-kpi-stats\"]",
        "type": "highlight",
        "label": "소모품 현황 요약",
        "description": "관리 품목 수, 주기장 보유 수량, 평가액 지표를 확인합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "process_monitor_stock",
        "title": "주기장 소모품 재고 및 안전재고 모니터링",
        "description": "주기장 창고의 부품별 현재고, 단가, 평가액을 대조하고 검색합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"consumable_stock-tab-nav\"]",
            "type": "click_ripple",
            "label": "주기장 재고 탭 선택",
            "description": "메인 창고 현재고 조회 화면을 선택합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"consumable_stock-inspection-grid\"]",
            "type": "highlight",
            "label": "재고 대장 확인",
            "description": "부품별 주기장 재고와 차량 재고 수량을 확인하고 정보를 관리합니다.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "print_queue_monitor",
    "version": 10,
    "menuName": "프린트 큐 모니터",
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "주기장/출고팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "자산 방수 바코드 및 부품 QR 라벨 ZPL/PDF 인쇄 큐 상태 실시간 감시, 인쇄 위치 오프셋 보정, 실패 큐 재전송 (헌장 3.1)",
    "scopeInfo": "프린터 네트워크 IP, 포트(9100), 라벨 규격(100x75 등), 대기/성공/오류 큐 목록, ZPL 원문 코드",
    "cognitiveSequence": [
      "1. 프린터 상태(온라인, 오프라인, 용지 부족) 및 출력 큐 스코핑",
      "2. 대기 중인 라벨 출력 잡(Job) 우선순위 및 인쇄 수량 확인",
      "3. ZPL 인쇄 스풀 데이터 및 프리뷰 렌더링 검증",
      "4. 라벨 프린터 IP 포트 통신 상태 및 연결 확인",
      "5. 인쇄 중단/용지 잼 발생 시 출력 잡 일시정지 및 재전송",
      "6. 정상 인쇄 완료 건 상태 PRINTED 처리 및 큐 자동 아카이빙",
      "7. 출력 큐 오류 0건 달성 및 실물 라벨 장비 부착 진행"
    ],
    "subTabs": [
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
    "auditResult": "출고 자산 실물 방수 라벨 부착 100% 보장 및 인쇄 오류 무중단 복구",
    "rulesCompliance": [
      "헌장 3.1 [무수식어 건조 UI 단일 표준]: \"라벨 출력 관리\", \"프린트 큐 모니터\", \"인쇄 위치 보정\" 등 표준 용어 준수",
      "헌장 5.2 [무음 실패 방지]: 프린터 통신 장애 시 즉시 에러 모달 표출"
    ],
    "precautions": [
      "Zebra 감열/열전사 프린터의 헤드 오염 시 바코드 인식률이 급감하므로 에탄올 세척 권장",
      "인쇄 위치 보정 후 반드시 [테스트 인쇄] 1회를 거쳐 영점 확인"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"print_queue_monitor-header\"]",
        "type": "stamp",
        "label": "프린트 큐 모니터",
        "description": "프린트 큐 모니터 및 프린터 스테이션을 관리합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"print_queue_monitor-agent-status\"]",
        "type": "stamp",
        "label": "에이전트 상태",
        "description": "로컬 프린터 에이전트 연결 상태를 확인하고 재탐색합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"print_queue_monitor-tabs\"]",
        "type": "stamp",
        "label": "탭 메뉴",
        "description": "프린터 스테이션 관리와 인쇄 대기 대장 탭을 전환합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"print_queue_monitor-station-list\"]",
        "type": "stamp",
        "label": "등록 프린터 목록",
        "description": "시스템에 등록된 프린터 스테이션 목록입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"print_queue_monitor-station-form\"]",
        "type": "stamp",
        "label": "프린터 설정",
        "description": "새 프린터를 등록하거나 기존 프린터 설정을 수정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"print_queue_monitor-queue-filter\"]",
        "type": "stamp",
        "label": "큐 필터",
        "description": "상태, 문서, 스테이션별로 인쇄 대기열을 필터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"print_queue_monitor-queue-grid\"]",
        "type": "stamp",
        "label": "인쇄 대기 대장",
        "description": "인쇄 큐에 쌓인 문서들의 상태를 조회하고 관리합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "consumable_purchase",
    "version": 10,
    "menuName": "소모품 구매",
    "groupId": "grp_maintenance",
    "groupName": "정비 / 소모품관리",
    "department": "정비/자재팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "정비 및 주기장 유지보수에 필요한 부품/소모품 발주서 작성, 매입 단가 승인 및 입고 대사",
    "scopeInfo": "공급 업체(Vendor), 부품 품목, 발주 수량, 단가, 납기 예정일, 승인 결재선",
    "cognitiveSequence": [
      "1. 안전재고 미달 품목 및 긴급 보충 발주 큐 스코핑",
      "2. 매입처(부품 협력사) 선택 및 품목별 단가/수량 견적 비교",
      "3. 소모품 구매 발주서 작성 및 협력사 전자 발송",
      "4. 발주 품목 실물 입고 검수 (수량, 규격, 파손 여부 실사)",
      "5. 입고 완료 수량 재고 원장 자동 가산 및 매입 단가 확정",
      "6. 소모품 구입 대금 지급결의 및 전자결재 상신 (헌장 결재선 연동)",
      "7. 매입 세금계산서 수취 매칭 및 구매 발주 종결 처리"
    ],
    "subTabs": [
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
    "auditResult": "부품 발주부터 입고까지의 정산 원천 데이터 확정 및 매입 채무 연계",
    "rulesCompliance": [
      "헌장 3.4 [상하 스택 배치]: 발주 입력 필드 상하 세로 스택 준수",
      "헌장 1.2 [이벤트 무누락]: 발주, 승인, 입고 전 단계 DB 로그 보존"
    ],
    "precautions": [
      "정품(OEM) 부품과 호환 부품의 단가 차이가 크므로 발주서에 정품 여부 명기 필수",
      "입고 수량과 세금계산서 수량이 불일치할 경우 입고 보류 처리"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"consumable_purchase-scope\"]",
        "type": "stamp",
        "label": "조회 필터",
        "description": "상태, 기간, 검색어 등으로 구매 신청 내역을 필터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"consumable_purchase-pipeline-add\"]",
        "type": "stamp",
        "label": "구매신청등록",
        "description": "새로운 소모품 구매 신청서를 작성합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"consumable_purchase-pipeline-batch\"]",
        "type": "stamp",
        "label": "엑셀 일괄 등록",
        "description": "엑셀 템플릿을 사용하여 여러 구매 신청을 일괄 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"consumable_purchase-pipeline-excel\"]",
        "type": "stamp",
        "label": "엑셀 다운로드",
        "description": "조회된 구매 신청 대장을 엑셀로 내보냅니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"consumable_purchase-inspection-grid\"]",
        "type": "stamp",
        "label": "구매신청 목록",
        "description": "구매신청 내역과 상태, 결재진행 및 입고 현황을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"consumable_purchase-terminal-audit\"]",
        "type": "stamp",
        "label": "요약",
        "description": "조회된 항목의 총 수량과 예상 금액을 요약하여 보여줍니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"consumable_purchase-inspection-form\"]",
        "type": "stamp",
        "label": "신청서 폼",
        "description": "품목, 수량, 단가 및 구매처를 입력하여 구매 신청서를 작성합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"consumable_purchase-terminal-submit\"]",
        "type": "stamp",
        "label": "제출",
        "description": "작성된 신청서를 최종 제출합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "left",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"consumable_purchase-scope\"]",
        "type": "highlight",
        "label": "조회 필터 바",
        "description": "상태(신청/승인/입고), 기간, 검색어로 구매 신청 목록을 필터링합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"consumable_purchase-inspection-grid\"]",
        "type": "highlight",
        "label": "구매 신청 대장",
        "description": "신청된 소모품 내역, 단가, 승인 현황 및 입고 여부를 조회합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "process_create_purchase",
        "title": "소모품 구매 신청서 작성",
        "description": "부품 및 소모품의 신규 구매 발주 신청서를 작성하여 제출합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"consumable_purchase-pipeline-add\"]",
            "type": "click_ripple",
            "label": "구매신청등록 탭 선택",
            "description": "상단의 구매신청등록 탭을 클릭하여 작성 폼을 활성화합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"consumable_purchase-inspection-form\"]",
            "type": "callout",
            "label": "품목 및 수량 입력",
            "description": "품목명, 신청 수량, 예상 단가, 공급처를 기재합니다.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"consumable_purchase-terminal-submit\"]",
            "type": "click_ripple",
            "label": "구매 신청서 제출",
            "description": "총 예상 금액을 확인하고 구매 신청서를 최종 제출합니다.",
            "positionHint": "left"
          }
        ]
      }
    ]
  },
  {
    "menuId": "consumable_inout",
    "version": 10,
    "menuName": "소모품 입출고",
    "groupId": "grp_maintenance",
    "groupName": "정비 / 소모품관리",
    "department": "주기장/자재팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "구매 입고된 부품의 창고 적재 및 정비 작업으로 인한 부품 출고 불출 내역 기록",
    "scopeInfo": "입출고 일시, 구분(입고/출고/폐기), 부품 코드, 수량, 관련 정비 작업 번호, 불출 작업자",
    "cognitiveSequence": [
      "1. 정비실 및 주기장 출고/불출 의뢰 큐 스코핑",
      "2. 출고 목적(현장 AS, 입고 정비, 정기 소모품 교체) 및 정비 번호 확인",
      "3. 불출 부품 품목 및 수량 바코드 스캔 검증",
      "4. 출고 대상 자산번호(고소작업대 식별자) 1:1 매핑 (부품 원가 귀속)",
      "5. 소모품 재고 차감 및 실시간 안전재고 잔여량 경보 확인",
      "6. 수령 정비 기사 서명 및 불출증 출력",
      "7. 부품 출고 이력 무누락 DB 확정 및 자산 정비 원장 연동"
    ],
    "subTabs": [
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
    "auditResult": "부품 재고 실시간 차감 및 정비 작업별 원가 투입 데이터 100% 무결성 확립",
    "rulesCompliance": [
      "헌장 4.1 [원가 및 기여도 투입]: 정비 부품 투입 내역을 자산 정비 이력에 1:1 보존",
      "헌장 3.2 [줄바꿈 방지]: 부품명, 규격, 수량 셀 줄바꿈 방지"
    ],
    "precautions": [
      "정비 작업 번호 없이 부품을 임의 불출하지 않도록 주기장 창고 키 관리 철저",
      "교체 후 회수된 고품(코어)은 재제조 또는 고철 매각용으로 별도 보관"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"consumable_inout-pipeline-inbound-tab\"]",
        "type": "stamp",
        "label": "소모품 입고",
        "description": "구매 승인된 소모품의 입고 처리를 진행하는 탭입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"consumable_inout-pipeline-outbound-tab\"]",
        "type": "stamp",
        "label": "소모품 출고",
        "description": "현장 정비 등 자산에 투입할 소모품 출고 처리를 진행하는 탭입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"consumable_inout-pipeline-logs-tab\"]",
        "type": "stamp",
        "label": "입출고 이력",
        "description": "소모품의 전체 수불 내역을 조회하는 탭입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"consumable_inout-inspection-inbound-list\"]",
        "type": "stamp",
        "label": "입고 대기 목록",
        "description": "현재 창고 입고 대기 중인 구매신청 건 목록입니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "right",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"consumable_inout-inspection-inbound-form\"]",
        "type": "stamp",
        "label": "입고 확정",
        "description": "실제 입고 수량과 거래명세서를 첨부하여 입고 확정을 처리합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "left",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"consumable_inout-inspection-outbound-form\"]",
        "type": "stamp",
        "label": "출고 확정",
        "description": "출고 품목, 수량, 대상 자산 및 정비사를 지정하여 출고를 확정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "right",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"consumable_inout-scope\"]",
        "type": "stamp",
        "label": "이력 조회 필터",
        "description": "검색어, 품목, 구분, 담당자, 기간 조건으로 입출고 이력을 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"consumable_inout-inspection-grid\"]",
        "type": "stamp",
        "label": "입출고 수불 내역",
        "description": "조건에 맞는 입출고 수불 내역을 상세히 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 9,
        "selector": "[data-mid=\"consumable_inout-terminal-audit\"]",
        "type": "stamp",
        "label": "수불 대차 검증",
        "description": "조회된 내역에 대해 입고, 출고 등의 금액과 수량 합계를 요약 검증합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"consumable_inout-pipeline-inbound-tab\"]",
        "type": "highlight",
        "label": "소모품 입고 탭",
        "description": "구매 승인된 소모품의 실물 입고 검수 및 창고 입고를 처리합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"consumable_inout-pipeline-outbound-tab\"]",
        "type": "highlight",
        "label": "소모품 출고 탭",
        "description": "자산 정비 및 현장 AS용 부품을 출고 등록합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "process_inbound_confirm",
        "title": "구매 부품 입고 검수 및 창고 확정",
        "description": "납품된 부품의 수량과 거래명세서를 확인하고 입고 처리합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"consumable_inout-pipeline-inbound-tab\"]",
            "type": "click_ripple",
            "label": "소모품 입고 선택",
            "description": "입고 관리 화면을 활성화합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"consumable_inout-inspection-inbound-list\"]",
            "type": "highlight",
            "label": "입고 대상 선택",
            "description": "입고 대기 구매신청 목록에서 실물이 도착한 항목을 선택합니다.",
            "positionHint": "right"
          }
        ]
      }
    ]
  },
  {
    "menuId": "field_as",
    "version": 10,
    "menuName": "현장 AS 관리",
    "groupId": "grp_maintenance",
    "groupName": "정비 / 소모품관리",
    "department": "AS정비팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "현장에 출동한 순회 정비 기사의 이동 경로, 고장 부위 조치 내역, 유/무상 정비 판정, 투입 부품 기록 및 고객 서명 수령",
    "scopeInfo": "접수된 AS 티켓, 현장 위치, 기사 배정, 도착 일시, 수리 완료 일시, 유상 수리 청구 금액, 고객 서명",
    "cognitiveSequence": [
      "1. 긴급 AS 출동 대기 큐 및 현장 위험도/지역별 스코핑",
      "2. 출동 엔지니어 배정 및 서비스 차량 탑재 부품 재고 점검",
      "3. 현장 도착 및 고소작업대 현물 고장 원인 정밀 진단",
      "4. 현장 즉시 조치: 부품 교체, 전기 배선 수리, 유압 압력 보정",
      "5. 현장 조치 불가 판정 시: 즉시 [대차 교체(EXCHANGE) 요구] 발령 (헌장 2.1)",
      "6. 유상 수리 발생 시: 고객 과실 증거 사진 등록 및 [수리비 청구] 채권 분리 (헌장 5.5)",
      "7. 현장 AS 완료 보고서 서명 날인 및 정비 이력 타임라인 영구 보존"
    ],
    "modalWorkflows": [
      {
        "modalName": "현장 AS 접수 및 출동 지시 팝업",
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
        "modalName": "현장 AS 조치 완료 보고 팝업",
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
    "auditResult": "현장 AS 조치 완료 및 유상 수리 시 매출 청구(Billing) 데이터로 즉시 이첩",
    "rulesCompliance": [
      "헌장 5.5 [현장 마찰 계수 주입]: 현장 수리 불가 시 즉시 EXCHANGE 대차 배차 연동",
      "헌장 1.2 [이벤트 기록 무누락]: 수리 전/후 사진, 교체 부품, 서명 이미지 영구 보존"
    ],
    "precautions": [
      "고압 전선 접촉 또는 낙하 충격 장비는 현장 수리 금지하고 즉시 입고 정비 인계",
      "유상 수리 건은 현장 담당자에게 유상 안내 및 서명 사전 득 필수"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"field_as-scope\"]",
        "type": "stamp",
        "label": "AS 탭 전환",
        "description": "당일 긴급 출동 대기 큐와 전체 AS 조치 대장 탭을 전환합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"field_as-filter\"]",
        "type": "stamp",
        "label": "AS 접수 검색 필터",
        "description": "접수 일자, 거래처, 현장, 장비 번호, 증상별로 필터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"field_as-inspection-grid\"]",
        "type": "stamp",
        "label": "AS 접수 대기 목록",
        "description": "현장 고장 접수 내역, 긴급도, 투입 장비 제원 및 고장 증상을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "right",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"field_as-pipeline-add\"]",
        "type": "stamp",
        "label": "현장 조치 및 부품 등록",
        "description": "출동 기사 배정, 투입 부품, 수리 내역, 유/무상 여부를 입력하고 조치를 완료합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "left",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"field_as-audit\"]",
        "type": "stamp",
        "label": "AS 이력 대장",
        "description": "완료된 현장 수리 이력, 사용 부품 대금, 수리 일자별 이력을 통합 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"field_as-scope\"]",
        "type": "highlight",
        "label": "AS 탭 전환",
        "description": "출동 스튜디오, 캘린더, 분석, 관리 대장 간 탭을 전환합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"field_as-filter\"]",
        "type": "highlight",
        "label": "AS 검색 필터",
        "description": "기간, 진행 상태(접수대기/방문예정/재방문/완료)별로 필터링합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "process_create_field_as",
        "title": "현장 AS 신규 접수 및 출동 등록",
        "description": "고객 현장의 고장 접수를 등록하고 출동 담당 기사를 배정합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"field_as-pipeline-add\"]",
            "type": "click_ripple",
            "label": "신규 AS 등록 버튼 클릭",
            "description": "새로운 현장 AS 접수 모달을 엽니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "repair",
    "version": 10,
    "menuName": "주기장 정비 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"repair-inspection-grid\"]",
        "type": "highlight",
        "label": "정비 대기 자산 큐",
        "description": "입고 결함, 출고 불량, 수리 중인 자산 목록을 우선순위에 따라 조회하고 선택할 수 있습니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"repair-studio-workbench\"]",
        "type": "highlight",
        "label": "정비 스튜디오 워크벤치",
        "description": "선택한 자산에 대한 정비 조치 내역, 소모품 투입, 외주 위탁 등을 처리하는 작업 공간입니다.",
        "positionHint": "left"
      }
    ],
    "processes": [
      {
        "processId": "process_internal_repair",
        "title": "자체 정비 완료 처리",
        "description": "주기장 내에서 직접 자산을 점검하고 수리를 완료하여 임대가능 상태로 복원합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"repair-inspection-grid\"]",
            "type": "click_ripple",
            "label": "정비 대상 선택",
            "description": "좌측 목록에서 수리할 자산을 클릭하여 선택합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"repair-details-input\"], textarea",
            "type": "callout",
            "label": "정비 상세 내역 입력",
            "description": "점검 결과 및 수리 조치 사항, 교체된 부품 내역을 상세히 기재합니다.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"repair-pipeline-add\"], button.btn-primary",
            "type": "click_ripple",
            "label": "정비 완료 확정",
            "description": "작성된 정비 내역을 저장하고 해당 자산을 AVAILABLE(임대가능) 상태로 복원합니다.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "groupId": "grp_maintenance",
    "groupName": "정비 / 소모품관리",
    "department": "정비팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "회수 입고된 고소작업대의 세척, 도색, 분해 수리, 안전 점검 및 정비 조치 (정비 완료 시 자산 상태 AVAILABLE(임대가능) 복원)",
    "scopeInfo": "입고된 정비 대상 장비, 회수 점검표, 투입 부품 내역, 정비 공수(시간), 정비 완료 승인자",
    "cognitiveSequence": [
      "1. 주기장 정비 대기(수리중) 자산 목록 및 정비 우선순위 스코핑",
      "2. 입고 검수 불량 내역서 및 고장 증상 리포트 확인",
      "3. 분해 진단 및 필요 교체 부품(모터, 밸브, 배터리) 청구 등록",
      "4. 정비 조치 작업 수행 (판금, 도색, 부품 교체, 배선 결선)",
      "5. 정비 완료 후 기능/하중 테스트 및 안전 센서 100% 정상 작동 검증",
      "6. 정비 투입 공수(시간) 및 부품 원가 집계 마감",
      "7. [정비 완료 확정] 실행  자산 상태 AVAILABLE (임대가능) 복원 (헌장 1.2)"
    ],
    "subTabs": [
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
    "modalWorkflows": [
      {
        "modalName": "정비 조치 및 부품 투입 팝업",
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
    "auditResult": "장비 정비 완결 및 자산 상태 AVAILABLE(임대가능) 복원, 가용 자산 풀 재편입",
    "rulesCompliance": [
      "헌장 1.2 [렌탈 자산 효과적 운용]: 정비 완료 시점에 정확히 AVAILABLE 상태로 복귀",
      "헌장 3.6 [유형 A 카드 도시에]: 개별 장비의 정비 상세 컨텍스트를 한 화면에서 360도 판단"
    ],
    "precautions": [
      "시저암 롤러 마모 및 용접 부위 크랙 여부를 비파괴 육안 검사로 철저 확인",
      "충전 테스트는 최소 4시간 이상 연속 부하 충전하여 만충 전압(25.4V 이상) 확인"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"repair-scope\"]",
        "type": "stamp",
        "label": "정비 모드 전환",
        "description": "입고 검수 대기, 진행 중 정비, 정비 완료 이력 탭을 전환합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"repair-filter\"]",
        "type": "stamp",
        "label": "정비 대상 필터",
        "description": "자산 번호, 장비 규격, 정비 유형(도색/유압/배터리/판금)별로 검색합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"repair-inspection-grid\"]",
        "type": "stamp",
        "label": "정비 대상 자산 목록",
        "description": "주기장 입고 장비의 고장 부위, 수리 우선순위, 입고일을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "right",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"repair-pipeline-add\"]",
        "type": "stamp",
        "label": "정비 내역 및 부품 등록",
        "description": "소모 부품 출고, 정비 공수 입력, 완료 사진 등록 후 자산을 임대가능 상태로 전환합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "left",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"repair-audit\"]",
        "type": "stamp",
        "label": "정비 이력 대장",
        "description": "자산별 누적 정비 비용, 교체 부품 이력, 정비 판정을 종합 관리합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "inspection_checklist_manage",
    "version": 10,
    "menuName": "정비 항목 관리",
    "groupId": "grp_maintenance",
    "groupName": "정비 / 소모품관리",
    "department": "정비/품질관리팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "장비 기종별/작업유형별(출고검수, 정기점검, 입고정비) 법정 안전점검 체크리스트 표준 템플릿 관리",
    "scopeInfo": "점검 유형, 기종 분류, 점검 항목명, 판정 기준, 필수 점검 여부, 과태료/안전 기준 연계",
    "cognitiveSequence": [
      "1. 검수 유형별 탭 스코핑 (출고 검수, 입고/반납 검수, 정기 안전 검수)",
      "2. 장비 기종별(시저, 굴절, 직진) 필수 점검 표준 항목 정의",
      "3. 법정 안전 점검 항목(과상승방지봉, 하강방지밸브, 비상정지스위치) 필수 지정",
      "4. 판정 기준(합격/불합격/요정비) 및 가중치(정비 점수) 설정",
      "5. 사진 첨부 의무화 및 측정값(배터리 전압, 타이어 잔여 홈) 입력 규칙 구성",
      "6. 모바일 현장 검수 화면 렌더링 순서 및 카테고리 배치 최적화",
      "7. 검수 체크리스트 마스터 개정 승인 및 전사 모바일 검수 폼 실시간 배포"
    ],
    "subTabs": [
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
    "auditResult": "고소작업대 안전보건공단 안전인증 기준에 부합하는 점검 체계 확립",
    "rulesCompliance": [
      "헌장 5.3 [SSOT 원칙]: 체크리스트 기준을 전사 단일 마스터로 관리하여 현장별 편차 방지",
      "헌장 3.1 [무수식어 표기]: 사실적이고 객관적인 측정 기준(압력, 치수, 전압 등) 명기"
    ],
    "precautions": [
      "법정 필수 항목(과상승 방지봉, 비상정지 스위치)은 [필수 점검] 해제 금지",
      "항목 순서 변경 시 현장 검수 동선(하부  상부  조작부)과 일치하도록 정렬"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"inspection_checklist_manage-scope\"]",
        "type": "stamp",
        "label": "탭 메뉴",
        "description": "마스터 관리, 조직 역량 분석, 장비 매뉴얼 라이브러리 간 탭 전환을 수행할 수 있습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"inspection_checklist_manage-terminal-audit\"]",
        "type": "stamp",
        "label": "정비 요약 통계",
        "description": "정비 항목수, 항목 평점, 권장 표준 공수, 부품 연동 등 주요 통계를 표시합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"inspection_checklist_manage-pipeline-add\"]",
        "type": "stamp",
        "label": "정비 항목 등록",
        "description": "새로운 정비 항목을 등록하거나 목록을 엑셀로 내보낼 수 있습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"inspection_checklist_manage-inspection-grid\"]",
        "type": "stamp",
        "label": "정비 대장 목록",
        "description": "등록된 모든 정비 항목의 상세 내용과 연관 부품 등을 조회할 수 있습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"inspection_checklist_manage-analytics-filter\"]",
        "type": "stamp",
        "label": "검색 및 분석 필터",
        "description": "조건에 맞는 데이터만 추려내어 정비 비용 및 성과를 분석할 수 있습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"inspection_checklist_manage-scope\"]",
        "type": "highlight",
        "label": "탭 메뉴",
        "description": "점검 항목 마스터, 조직 역량 분석, 장비 매뉴얼 라이브러리 간 탭 전환을 수행합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"inspection_checklist_manage-terminal-audit\"]",
        "type": "highlight",
        "label": "정비 요약 통계",
        "description": "관리 분류, 총 점검항목, 평균 배점, 부품연계율 통계를 표시합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "process_create_checklist_item",
        "title": "신규 정비 점검 항목 등록",
        "description": "법정 안전 점검 및 점검 항목 마스터에 신규 항목을 추가 등록합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"inspection_checklist_manage-pipeline-add\"]",
            "type": "click_ripple",
            "label": "신규 정비 항목 등록 버튼 클릭",
            "description": "정비 항목 등록 팝업 모달을 호출합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "leave_application",
    "version": 10,
    "menuName": "연차신청",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid='leave-form']",
        "type": "callout",
        "label": "연차/반차 신청 폼",
        "description": "휴가 구분, 일자 및 사유를 입력하여 연차 또는 반차를 신청하는 영역입니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid='leave-history-table']",
        "type": "callout",
        "label": "신청 내역 리스트",
        "description": "과거 연차 및 반차 신청 내역과 사용 기간, 차감 일수를 확인할 수 있는 이력 테이블입니다.",
        "positionHint": "left"
      }
    ],
    "processes": [
      {
        "processId": "apply_leave",
        "title": "휴가 신청",
        "description": "새로운 연차 또는 반차를 신청하는 과정입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid='leave-type-select']",
            "type": "highlight",
            "label": "휴가 구분 선택",
            "description": "연차, 오전반차, 또는 오후반차 중 원하는 휴가 구분을 선택합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid='leave-date-input']",
            "type": "highlight",
            "label": "휴가 일자 입력",
            "description": "휴가의 시작 일자와 종료 일자를 지정합니다.",
            "positionHint": "right"
          },
          {
            "seq": 3,
            "selector": "[data-mid='leave-reason-input']",
            "type": "highlight",
            "label": "사유 입력",
            "description": "휴가를 신청하는 사유를 간략히 입력합니다.",
            "positionHint": "right"
          },
          {
            "seq": 4,
            "selector": "[data-mid='leave-submit-btn']",
            "type": "click_ripple",
            "label": "신청 버튼 클릭",
            "description": "입력한 정보를 바탕으로 휴가를 최종 신청합니다.",
            "positionHint": "right"
          }
        ]
      }
    ],
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "전사 임직원",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "임직원의 법정 연차, 반차, 병가, 경조 휴가 신청서 작성 및 상위 결재선 자동 상신",
    "scopeInfo": "신청자 정보, 잔여 연차 일수, 휴가 유형, 시작일/종료일, 사용 일수, 직무 대결자, 사유",
    "cognitiveSequence": [
      "1. 잔여 연차 일수 및 휴가 규정(연차, 반차, 경조사, 병가) 스코핑",
      "2. 신청 휴가 종류 선택 및 시작일/종료일 기간 지정",
      "3. 자동 일수 계산(0.5일/1일/다일) 및 공휴일 제외 확인",
      "4. 업무 대행자 지정 및 비상 연락처, 휴가 사유 작성",
      "5. 인사관리 연동 결재선 티어 자동 탐색 (헌장 결재선 100% 연동)",
      "6. [연차 신청 결재 상신] 실행 및 부서장/결재권자 알림 발송",
      "7. 최종 승인 시 개인 연차 차감 및 전사 근태 캘린더 자동 반영 확정"
    ],
    "auditResult": "휴가 신청 결재 상신 완료 및 승인 시 연차 차감 및 캘린더 공유",
    "rulesCompliance": [
      "헌장 3.4 [상하 스택 배치]: 휴가 신청 폼 모든 레이블-입력 필드 상하 스택 적용",
      "헌장 1.2 [이벤트 기록 무누락]: 연차 신청, 결재, 차감 이력 DB 영구 저장"
    ],
    "precautions": [
      "주기장 및 배차 필수 당직 인원은 동시 휴가 사용이 제한될 수 있으므로 팀 내 사전 조율 필수",
      "당일 긴급 연차는 직속 부서장에게 유선 보고 후 사후 상신"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"leave_application-terminal-audit\"]",
        "type": "stamp",
        "label": "연차 현황 요약",
        "description": "선택된 임직원의 연차 현황(부여, 소진, 잔여 일수)을 실시간으로 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"leave_application-pipeline-add\"]",
        "type": "stamp",
        "label": "연차 신청",
        "description": "본인 또는 대상 임직원의 연차 및 반차를 신청합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"leave_application-scope\"]",
        "type": "stamp",
        "label": "신청 내역 필터",
        "description": "구분별, 본인/전체 대상 내역만 모아보기 위한 필터를 제공합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"leave_application-inspection-grid\"]",
        "type": "stamp",
        "label": "연차 이력",
        "description": "등록된 연차 신청 및 차감 이력을 목록 형태로 상세 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "ot_management",
    "version": 10,
    "menuName": "OT 관리",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "인사/총무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "야간/주말 특근 및 연장 근무(OT) 사전 신청 및 사후 승인, 급여 정산 연동 수당 산출",
    "scopeInfo": "근무자, OT 일자, 시작/종료 시간, 연장 시간, 야간/휴일 구분, 근무 사유, 승인 여부",
    "cognitiveSequence": [
      "1. 해당 월 연장/휴일 근로 한도(주 52시간 준수) 및 현황 스코핑",
      "2. 신청 일자 및 근로 유형(평일 연장, 휴일 근로, 야간 근로) 선택",
      "3. 근무 예정 시간(시작~종료) 입력 및 실 근로시간 자동 산출",
      "4. 업무 목적 및 사유(긴급 출고 검수, 주말 현장 AS 등) 구체적 기재",
      "5. 팀장 및 인사 담당 결재권자 승인선 자동 매핑",
      "6. 사전 신청 및 사후 실적(타임카드) 1:1 대사 검증",
      "7. 연장근로 승인 확정 및 당월 급여 수당 자동 산출 엔진 연동"
    ],
    "subTabs": [
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
    "auditResult": "근로기준법 52시간 준수 모니터링 및 정확한 법정 가산 수당 확정",
    "rulesCompliance": [
      "헌장 5.1 [수학적 수식 검증]: 통상시급 × OT시간 × 1.5 가산율 수학적 산식 준수",
      "헌장 3.5 [Z-패턴 동선]: 좌상단(월/부서)  중앙(시간대사)  우하단([승인마감])"
    ],
    "precautions": [
      "주간 총 근로시간이 52시간을 초과하지 않도록 사전 경고 알림 확인 필수",
      "야간 근로(22시~06시)는 통상시급의 50%가 추가 중복 가산되므로 승인 시 시간대 철저 검수"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"ot_management-terminal-audit\"]",
        "type": "stamp",
        "label": "연장근무 현황 요약",
        "description": "총 승인 시간, 당월 OT 시간 등 전체적인 현황을 요약하여 보여줍니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"ot_management-pipeline-add\"]",
        "type": "stamp",
        "label": "연장근무 등록",
        "description": "다중 인원 선택 및 일자, 시간을 지정하여 OT를 등록할 수 있습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"ot_management-inspection-grid\"]",
        "type": "stamp",
        "label": "연장근무 목록 조회",
        "description": "과거 및 현재 등록된 전체 OT 기록을 테이블 형태로 조회할 수 있습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"ot_management-analytics-grid\"]",
        "type": "stamp",
        "label": "연장근무 캘린더 뷰",
        "description": "월별 OT 내역을 캘린더 형태로 확인하고 일별 상세 조회에 접근합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "vehicle_log",
    "version": 10,
    "menuName": "차량 / 주유관리",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "총무/운행자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "회사 업무용 차량(순회 AS차, 현장 영업차 등)의 운행 일지(주행거리, 목적지) 및 주유/하이패스 영수증 관리",
    "scopeInfo": "차량 번호, 운행 일자, 운행자, 출발/도착지, 주행거리(시작/종료), 주유량/금액, 정기검사일",
    "cognitiveSequence": [
      "1. 법인 업무용 차량(서비스카, 견인차) 및 운행 월 스코핑",
      "2. 운행 일자, 운전자, 출발지 및 목적지(방문 현장) 입력",
      "3. 운행 전/후 누적 주행거리(km) 입력 및 실 주행거리 자동 계산",
      "4. 주유비, 하이패스 통행료, 주차비 등 운행 경비 영수증 증빙 첨부",
      "5. 업무용(현장AS, 장비탁송, 영업미팅) vs 비업무용 비율 자동 집계",
      "6. 국세청 법인 차량 운행기록부 법정 표준 서식 정합성 검증",
      "7. 월간 차량 운행일지 마감 확정 및 비용 인정용 엑셀 출력"
    ],
    "subTabs": [
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
    "auditResult": "국세청 업무용 승용차 운행기록부 법정 양식 자동 생성 및 비용 인정 충족",
    "rulesCompliance": [
      "헌장 1.2 [발생 사건 무누락 DB 보존]: 일일 주행거리 계기판 사진 및 영수증 증빙 저장",
      "헌장 3.1 [무수식어 건조 표준]: 명확한 계기판 숫자와 지명 중심 표기"
    ],
    "precautions": [
      "계기판 시작 거리가 전일 종료 거리와 불일치할 경우 누락 구간 사유 소명 필수",
      "엔진오일 교환 주기(10,000km) 및 자동차 정기검사 만료일 사전 점검"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"vehicle_log-header\"]",
        "type": "stamp",
        "label": "차량 운용 현황 요약",
        "description": "보유 차량 수, 당월 총 주행거리, 총 주유비, 유류대 정산 현황을 모니터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"vehicle_log-export-nts\"]",
        "type": "stamp",
        "label": "국세청 양식 내보내기",
        "description": "국세청 업무용 승용차 운행기록부 법정 서식으로 엑셀을 즉시 내려받습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"vehicle_log-upload-excel\"]",
        "type": "stamp",
        "label": "주유 내역 엑셀 업로드",
        "description": "법인카드 주유 전표 및 전자세금계산서 주유 데이터를 일괄 업로드합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"vehicle_log-export-fuel\"]",
        "type": "stamp",
        "label": "주유 대장 내보내기",
        "description": "기간별 차량 주유 집계 및 정산 내역을 엑셀로 다운로드합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"vehicle_log-tab-fuel\"]",
        "type": "stamp",
        "label": "주유 정산 대장 탭",
        "description": "차량별 주유 일자, 주유량(L), 금액, 주유소를 1:1 대사합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"vehicle_log-tab-fleet\"]",
        "type": "stamp",
        "label": "차량 마스터 관리 탭",
        "description": "회사 보유 차량 번호, 차종, 배정 임직원, 보험 만기일을 관리합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"vehicle_log-filter\"]",
        "type": "stamp",
        "label": "운행 기록 검색 조건",
        "description": "조회 기간, 차량 번호, 운전자, 업무용/비업무용 구분별로 필터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"vehicle_log-grid-fuel\"]",
        "type": "stamp",
        "label": "운행 및 주유 데이터 대장",
        "description": "일자별 출발/도착지, 주행거리, 유류대 실지출 내역을 검토 및 수정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "purchase_settlement",
    "version": 10,
    "menuName": "월말 매입 정산",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "재무/회계팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "전사 외주 운송비, 부품 구매비, 외부 임차료 등 월말 매입 채무 1:1 대사, 세금계산서 수취 검증 및 최종 지급 결재 (헌장 3.5 Z-패턴 4단계 완결)",
    "scopeInfo": "정산 연월, 매입처(운송사/부품사/임차원사), 청구서 수령액, 시스템 집계액, 차액 승인 내역",
    "cognitiveSequence": [
      "1. 정산 연월 및 매입 유형(운송료, 소모품, 장비임차료, 유류비) 스코핑",
      "2. 매입처(협력사)별 세금계산서 청구 내역 일괄 취합",
      "3. 실물 입고/배차 실적과 1:1 대사 검증 (단가, 수량, 차액 분석)",
      "4. 차액 발생 시 원인 규명 및 조정(공제) 금액 확정",
      "5. 통합 지출결의서 생성 및 회계 결재 상신 (헌장 결재선 연동)",
      "6. 계좌이체(펌뱅킹) 지급 파일 생성 및 지급 예정일 설정",
      "7. 지급 완료 마감 확정 및 매입 채무 원장 자동 대차 상계"
    ],
    "auditResult": "전사 매입 채무 확정 및 이체 펌뱅킹 데이터 생성 완료 (차액 ₩0 무결성 보장)",
    "rulesCompliance": [
      "헌장 3.5 [Gutenberg Z-패턴 표준]: 좌상단  우상단  중앙 본문  우하단 완결 동선 엄격 이행",
      "헌장 3.6 [유형 B 고밀도 그리드]: 80~85% 세로 영역 확보로 수백 건 인라인 일괄 마감"
    ],
    "precautions": [
      "매입처 발행 세금계산서 금액과 시스템 확정액의 1원 단위 차액도 반드시 차액 사유(단가 할인/지연 배상 등) 기재 후 승인",
      "지급 보류 매입처는 사유를 명시하여 이체 대상에서 제외 조치"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"purchase_settlement-pipeline-generate\"]",
        "type": "stamp",
        "label": "월간 자동 집계",
        "description": "선택한 연월의 운송료, 소모품, 임차료 등 매입 내역을 자동으로 집계합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"purchase_settlement-pipeline-excel\"]",
        "type": "stamp",
        "label": "엑셀 내보내기",
        "description": "조회된 매입 정산 대장을 엑셀로 내보냅니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"purchase_settlement-pipeline-hometax\"]",
        "type": "stamp",
        "label": "국세청 대사",
        "description": "국세청 매입세금계산서와 대사하여 정산 정보를 업데이트합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"purchase_settlement-scope\"]",
        "type": "stamp",
        "label": "정산 유형",
        "description": "전체, 운송료, 소모품, 임차료, 외주 정비비 등 정산 유형별로 내역을 필터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"purchase_settlement-inspection-filter\"]",
        "type": "stamp",
        "label": "검색 필터",
        "description": "지급 상태나 매입처명으로 정산 내역을 상세 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"purchase_settlement-terminal-audit\"]",
        "type": "stamp",
        "label": "정산 요약 지표",
        "description": "당월 정산 건수, 총 청구액, 지급 완료액, 미지급 잔액을 실시간으로 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"purchase_settlement-inspection-grid\"]",
        "type": "stamp",
        "label": "매입 정산 내역",
        "description": "매입처별 정산 금액과 세금계산서, 증빙을 확인하고 지급 처리를 진행할 수 있습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"purchase_settlement-pipeline-generate\"]",
        "type": "click_ripple",
        "label": "매입 정산 자동 집계",
        "description": "당월 발생한 부품 매입, 외주 정비, 운송비 지출을 자동 집계합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "settlement-auto-generate",
        "title": "월말 매입금 집계 및 국세청 전자세금계산서 대사",
        "description": "협력업체로부터 발행된 매입 세금계산서와 시스템 지출 원장을 1:1 대사합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"purchase_settlement-pipeline-generate\"]",
            "type": "click_ripple",
            "label": "매입 정산 집계",
            "description": "당월 매입 내역을 집계합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "vendors",
    "version": 10,
    "menuName": "매입처 (공급자 / 외주처) 관리",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "구매/회계팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "부품 공급사, 외주 정비업체, 장비 임대 원사 등 협력업체 마스터, 결제 계좌, 세금계산서 수신처 관리",
    "scopeInfo": "사업자등록번호, 상호명, 대표자, 업태/종목, 주거래 품목, 결제 은행/계좌번호, 담당자 연락처",
    "cognitiveSequence": [
      "1. 매입처 분류 스코핑 (부품 제조사, 정비 협력사, 소모품 납품사, 유류사)",
      "2. 신규 협력사 사업자등록증 및 통장 사본 등록",
      "3. 홈택스 사업자 유효성 실시간 검증",
      "4. 주요 공급 품목군 및 계약 단가표, 결제 조건(익월말 현금 등) 등록",
      "5. 협력사 담당자 연락처 및 세금계산서 수신 이메일 검증",
      "6. 월별 매입 실적 및 대금 지급 이력 원장 조회",
      "7. 협력사 마스터 승인 확정 및 발주/구매 연동 가용화"
    ],
    "auditResult": "매입처 마스터 확정 및 정산 이체 시 예금주 불일치 사고 원천 차단",
    "rulesCompliance": [
      "헌장 3.2 [셀 줄바꿈 방지]: 사업자번호, 상호, 계좌번호 셀 white-space: nowrap 강제",
      "헌장 7.1 [테넌트 독립성]: 테넌트별 협력업체 데이터 독립 분리"
    ],
    "precautions": [
      "계좌번호 변경 요청 시 반드시 통장 사본 실물 증빙을 수령하여 확인 후 갱신",
      "휴폐업 사업자 여부를 홈택스 API 또는 국세청 조회를 통해 분기별 실사"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"vendors-inspection-stats\"]",
        "type": "stamp",
        "label": "매입처 요약 정보",
        "description": "총 매입처 수, 누적 거래액 등 전반적인 상태를 확인할 수 있습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"vendors-scope-filter\"]",
        "type": "stamp",
        "label": "매입처 검색 및 필터",
        "description": "거래 유형이나 검색어를 통해 특정 매입처를 빠르게 찾을 수 있습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"vendors-pipeline-sync\"]",
        "type": "stamp",
        "label": "누적거래액 전체 동기화",
        "description": "당사자산 취득 및 매입정산 대장을 스캔하여 전체 매입처의 누적거래액을 동기화합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"vendors-pipeline-batch\"]",
        "type": "stamp",
        "label": "폴더 일괄 등록",
        "description": "사업자등록증 폴더를 지정하여 다수의 매입처 정보를 한 번에 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"vendors-pipeline-audit\"]",
        "type": "stamp",
        "label": "국세청 휴폐업 점검",
        "description": "홈택스와 연동하여 등록된 매입처의 휴폐업 상태를 전수 점검합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"vendors-pipeline-add\"]",
        "type": "stamp",
        "label": "신규 매입처 등록",
        "description": "새로운 매입처(공급자, 외주처)의 기본 정보 및 계좌 정보를 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"vendors-inspection-grid\"]",
        "type": "stamp",
        "label": "매입처 목록",
        "description": "등록된 매입처의 정보, 거래 내역 및 상태를 목록 형태로 확인하고 관리합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "table, .table-container",
        "type": "highlight",
        "label": "매입처 대장",
        "description": "부품사, 운송사, 정비공업사 등 협력 매입처 원장을 관리합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "vendor-register",
        "title": "신규 협력 매입처 등록 및 계좌 검증",
        "description": "새로운 부품 또는 외주 정비 매입처의 사업자번호와 정산 계좌를 등록합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "button.btn-primary",
            "type": "click_ripple",
            "label": "매입처 등록",
            "description": "신규 매입처 정보를 입력 저장합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "bank_matching",
    "version": 10,
    "menuName": "은행 입출금 대장",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "table",
        "type": "callout",
        "label": "분할 화면 레이아웃",
        "description": "화면은 분할 구조로 이루어져 있으며, 좌측에는 입금 내역(Deposits), 우측에는 청구 내역(Billings) 정보가 표시되어 수납 대사를 효율적으로 진행할 수 있습니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid='btn-batch-match'], [data-mid='btn-auto-match']",
        "type": "highlight",
        "label": "일괄 자동 매칭",
        "description": "상호 및 금액이 일치하는 입금 건과 청구 건을 시스템이 자동으로 찾아 일괄 매칭 및 수납 처리합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "manual_match",
        "title": "수동 수납 매칭",
        "description": "입금 내역과 특정 청구서를 수동으로 지정하여 매칭하는 프로세스입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "table tbody tr td button.btn-primary",
            "type": "click_ripple",
            "label": "입금 건 선택",
            "description": "아직 매칭되지 않은 입금 내역 우측의 수납/매칭 버튼을 클릭하여 대상 입금 건을 선택합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid='input-matching-billing']",
            "type": "click_ripple",
            "label": "청구서 선택",
            "description": "활성화된 모달창에서 수납을 적용할 대상 청구서의 라디오 버튼을 선택합니다.",
            "positionHint": "right"
          },
          {
            "seq": 3,
            "selector": "form button[type='submit'].btn-primary",
            "type": "click_ripple",
            "label": "수납 승인",
            "description": "수납 승인 완료 버튼을 클릭하여 수납 처리를 확정합니다.",
            "positionHint": "bottom"
          }
        ]
      },
      {
        "processId": "unmatch_rollback",
        "title": "매칭 해제(롤백)",
        "description": "기존에 매칭이 완료된 수납 내역을 취소하고 원상 복구하는 프로세스입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid='btn-unmatch']",
            "type": "click_ripple",
            "label": "매칭 해제 실행",
            "description": "매칭이 완료된 목록의 행에서 해제 버튼을 클릭하여 수납 매칭 롤백을 수행합니다.",
            "positionHint": "right"
          }
        ]
      }
    ],
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "재무/회계팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "실시간 은행 계좌 스크래핑/엑셀 거래 내역과 매출 청구(수납) 및 매입 지급 건 1:1 대사 매칭 (헌장 3.6 유형 B)",
    "scopeInfo": "통장 거래 일시, 입금액/출금액, 적요(입금자명), 잔액, 시스템 매칭 대상 매출/매입 채권",
    "cognitiveSequence": [
      "1. 통장 거래 연월 및 조회 금융 계좌(법인 주거래 통장) 스코핑",
      "2. 은행 펌뱅킹/엑셀 입금 내역 데이터 업로드 및 미매칭 큐 확인",
      "3. 입금자명, 입금액, 입금 일자 기반 미수금 원장 자동 추천 매칭",
      "4. 동명칭/상호 불일치 건 수동 거래처 탐색 및 1:1 강제 매칭",
      "5. 복수 청구서 일괄 입금 건 분할 대사 및 차액(수수료 등) 처리",
      "6. 수납 확정 실행  외상매출금(미수금) 원장 실시간 차감 반영 (Audit Result)",
      "7. 통장 대사 합계 검증식(통장 총입금액 = 수납 확정액 | 차액 ₩0) 무결성 확정 (헌장 3.5)"
    ],
    "subTabs": [
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
    "modalWorkflows": [
      {
        "modalName": "통장 입금 1:1 수기 대사 매칭 팝업",
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
    "auditResult": "통장 잔액과 시스템 장부 잔액 100% 일치 및 미수금 실시간 회수 처리",
    "rulesCompliance": [
      "헌장 3.6 [유형 B 고밀도 그리드]: 한눈에 20~30건의 입금 내역을 동시 조망하며 인라인 처리",
      "헌장 1.2 [이벤트 기록 무누락]: 매칭된 거래 ID 및 상계 시각 영구 보존"
    ],
    "precautions": [
      "동명이인 또는 대표자 개인 계좌 입금 시 고객사 담당자 확인 후 매칭",
      "가수금(출처 불명 입금)은 임의 매칭하지 말고 가수금 계정으로 임시 보관"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"bank_matching-scope-tab\"]",
        "type": "stamp",
        "label": "탭 메뉴",
        "description": "통장 입출금 대사 화면과 매칭 규칙 화면 간을 전환합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"bank_matching-pipeline-auto\"]",
        "type": "stamp",
        "label": "일괄 자동 수납",
        "description": "상호 또는 금액이 일치하는 미대사 입금 건을 즉시 일괄 수납 처리합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"bank_matching-inspection-stats\"]",
        "type": "stamp",
        "label": "은행 입출금 현황",
        "description": "전체 은행 계좌 잔액 및 수납, 지급 대사 현황을 요약해서 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"bank_matching-scope-search\"]",
        "type": "stamp",
        "label": "조회 필터",
        "description": "구분, 은행, 대사 상태, 검색어 및 기간 등의 조건으로 상세 검색을 수행합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"bank_matching-pipeline-upload\"]",
        "type": "stamp",
        "label": "통장 엑셀 업로드",
        "description": "은행에서 다운로드한 엑셀(CSV) 파일을 업로드하여 입출금 내역을 추가합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"bank_matching-pipeline-export\"]",
        "type": "stamp",
        "label": "엑셀 내보내기",
        "description": "조회된 입출금 대사 내역을 엑셀 파일로 다운로드합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"bank_matching-inspection-grid\"]",
        "type": "stamp",
        "label": "대사 내역 목록",
        "description": "개별 입출금 내역의 매칭 결과를 확인하고 수동으로 수납 또는 지급 대사 처리를 합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "corporate_card",
    "version": 10,
    "menuName": "법인카드 매입정산",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "재무/회계팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "법인카드 승인 내역 연동, 카드 사용자별 영수증 증빙 첨부 확인 및 회계 계정과목(복리후생, 유류비 등) 분류 확정",
    "scopeInfo": "카드 번호, 승인 일시, 가맹점명, 승인 금액, 부가세, 사용자, 회계 계정과목, 영수증 이미지",
    "cognitiveSequence": [
      "1. 정산 연월 및 법인카드 번호/소지 임직원별 스코핑",
      "2. 카드사 승인 내역 엑셀 업로드 또는 스크래핑 데이터 동기화",
      "3. 승인 건별 사용 목적(유류비, 식대, 소모품, 출장비) 계정과목 분류",
      "4. 간이영수증 및 카드 전표 사진 첨부 실사",
      "5. 개인 사용 또는 규정 위반(심야/주말) 건 소명 요구 및 환수 처리",
      "6. 부서별 법인카드 예산 대비 집행률 대차대조 검증",
      "7. 월말 법인카드 정산서 최종 확정 및 회계 지출결의 승인"
    ],
    "subTabs": [
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
    "auditResult": "법인카드 사용 내역 100% 증빙 완결 및 세무 신고용 매입 전표 확정",
    "rulesCompliance": [
      "헌장 3.1 [무수식어 표기]: 객관적 승인 일시, 가맹점, 공급가액, 세액만 정밀 표기",
      "헌장 5.1 [수학적 검증]: 승인총액 = 공급가액 + 부가세액 보존식 준수"
    ],
    "precautions": [
      "휴일/심야 사용 건 또는 유흥업소 결제 건은 감사 대상이므로 구체적 업무 사유서 첨부 필수",
      "간이과세자 결제 건은 부가세 매입세액 불공제 항목으로 정확히 분류"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"corporate_card-scope-tab\"]",
        "type": "stamp",
        "label": "탭 메뉴",
        "description": "매입정산 내역 검증 화면과 매입유형 항목 설정 화면으로 이동합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"corporate_card-pipeline-upload\"]",
        "type": "stamp",
        "label": "명세서 파일 로드",
        "description": "카드사 이용내역 명세서 파일을 업로드하여 내역을 가져옵니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"corporate_card-inspection-monitor\"]",
        "type": "stamp",
        "label": "누락 방지 모니터",
        "description": "사전에 정의된 예상 지출금액과 실제 지출을 비교하여 누락되거나 과다한 지출을 파악합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"corporate_card-inspection-summary\"]",
        "type": "stamp",
        "label": "총매입 정산 대장",
        "description": "매입 유형별 집행된 금액 합계와 전사 총 정산 매입액을 한눈에 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"corporate_card-pipeline-auto\"]",
        "type": "stamp",
        "label": "자동 매칭",
        "description": "업로드된 카드 이용 내역을 바탕으로 매입 항목과 자동으로 연결(매핑)합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"corporate_card-pipeline-export\"]",
        "type": "stamp",
        "label": "엑셀 내보내기",
        "description": "법인카드 이용내역 및 정산 현황을 엑셀 파일로 다운로드합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"corporate_card-inspection-grid\"]",
        "type": "stamp",
        "label": "명세 리스트",
        "description": "법인카드 건별 이용 명세와 계정과목 배정 상태를 목록 형태로 조회하고 편집합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "table, .table-container",
        "type": "highlight",
        "label": "법인카드 승인 내역",
        "description": "카드사 승인 내역과 ERP 지출 품의를 1:1 매칭합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "card-upload-match",
        "title": "법인카드 엑셀 명세 업로드 및 자동 매칭",
        "description": "카드사 엑셀 명세를 업로드하여 영수증 미제출 건 및 비업무용 지출을 검증합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "button.btn-primary",
            "type": "click_ripple",
            "label": "카드 명세 로드",
            "description": "승인 내역을 업로드합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "cash_flow",
    "version": 10,
    "menuName": "자금 흐름 분석",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "경영진/재무팀",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "매출 수납액과 매입 지출액 기반 일일/월별/분기별 현금 유동성 추이 분석 및 차기 자금 집행 예측",
    "scopeInfo": "현금/보통예금 잔액, 당월 수금 예정액, 확정 매입 지급액, 고정비(급여/임차료), 여유 자금 지표",
    "cognitiveSequence": [
      "1. 기준 일자 및 금융 계좌별 실시간 잔액 스코핑",
      "2. 당일 현금 유입(렌탈료 수납, 매각 대금) 실적 집계",
      "3. 당일 현금 유출(운송료 지급, 부품 매입, 급여, 임차료) 실적 집계",
      "4. 향후 7일/30일간 자금 수지 예측 (청구 예정액 vs 지급 예정액)",
      "5. 자금 부족 예상일 사전 경보 및 단기 유동성 확보 계획 수립",
      "6. 계좌별 이체 한도 및 잔액 증명 대차대조 검증",
      "7. 일일 자금일보 마감 확정 및 대표이사/경영진 보고서 발행"
    ],
    "subTabs": [
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
    "auditResult": "전사 자금 건전성 조망 및 현금 유동성 경색 위험 선제적 차단",
    "rulesCompliance": [
      "헌장 5.1 [리포트 2단계 검증]: 기말 현금 = 기초 현금 + 수납액 - 지출액 수학적 수식 정합성 충족",
      "헌장 3.1 [건조한 표기]: 감성적 지표 배제, 실제 통장 입출금 기반 통계만 표시"
    ],
    "precautions": [
      "미수 채권 연체율 증가 시 현금 유입 예측치에 할인율을 반영하여 보수적 분석 권장",
      "특정 일자(급여일 10일/25일 등)에 자금 유출 집중 여부 점검"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"cash_flow-scope\"]",
        "type": "stamp",
        "label": "분석 기준일 및 설정",
        "description": "유동성 분석을 위한 기준일, 전망 기간, 계좌 및 안전 기준액을 설정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"cash_flow-pipeline-sync\"]",
        "type": "stamp",
        "label": "실데이터 동기화",
        "description": "최신 전사 실데이터를 즉시 동기화합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"cash_flow-pipeline-snapshot\"]",
        "type": "stamp",
        "label": "스냅샷 동결",
        "description": "현재 분석된 유동성 전망 데이터를 스냅샷으로 저장합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"cash_flow-pipeline-export\"]",
        "type": "stamp",
        "label": "엑셀 내보내기",
        "description": "자금 흐름 분석 결과를 엑셀 파일로 내보냅니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"cash_flow-inspection-cards\"]",
        "type": "stamp",
        "label": "핵심 지표 카드뉴스",
        "description": "잔액, 예정, 지출, 투자 등 핵심 지표를 요약하여 보여줍니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"cash_flow-inspection-chart\"]",
        "type": "stamp",
        "label": "유동성 추이 밴드 차트",
        "description": "안전 기준선과 부도 위험선을 기준으로 자금 잔고 추이를 시각화합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"cash_flow-inspection-grid\"]",
        "type": "stamp",
        "label": "일별 수지 대사 원장",
        "description": "일별 수납액, 지출액, 누적 잔고 및 유동성 상태를 상세히 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"cash_flow-audit-history\"]",
        "type": "stamp",
        "label": "스냅샷 이력 대장",
        "description": "저장된 과거의 자금 계획 스냅샷 이력을 조회하고 엑셀로 내보냅니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 9,
        "selector": "[data-mid=\"cash_flow-terminal-audit\"]",
        "type": "stamp",
        "label": "대차대조식 검증 바",
        "description": "현금흐름과 대차 차액을 요약하여 유동성 정상 여부를 표시합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "div[style*=\"grid-template-columns\"]",
        "type": "highlight",
        "label": "자금 수지 지표",
        "description": "당월 매출 입금액과 매입/급여/운송 지출액의 순유동성을 실시간 조망합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "cash-flow-liquidity-audit",
        "title": "자금 수지 및 유동성 대차대조 검증",
        "description": "월간 현금 유입과 유출을 비교하여 수지 보존 무결성을 확정합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "div[style*=\"grid-template-columns\"]",
            "type": "highlight",
            "label": "자금 수지 조망",
            "description": "총 유입액과 총 유출액을 확인합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "depreciation_execution",
    "version": 10,
    "menuName": "감가상각 마감 실행",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "회계팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "보유 고소작업대 자산의 정액법 월별 감가상각비 자동 계산, 장부가액 갱신 및 월말 회계 마감 확정",
    "scopeInfo": "취득 자산 목록, 취득원가, 내용연수(5년/60개월), 잔존가치, 상각방법, 기 상각누계액",
    "cognitiveSequence": [
      "1. 상각 대상 회계 연월 및 자산 분류(고소작업대, 차량, 공구기구) 스코핑",
      "2. 자산별 취득가액, 내용연수(보통 5년), 상각방법(정액법/정률법) 검토",
      "3. 당월 상각비 및 누적 감가상각누계액, 장부가액 정밀 자동 산출",
      "4. 자산 상태별(매각, 폐기) 상각 중단 및 잔존가치(1,000원) 정합성 확인",
      "5. 자산별 감가상각 명세서 대차대조 합계 검증",
      "6. 회계 전표(감가상각비 / 감가상각누계액) 자동 분개 생성",
      "7. 월말 감가상각 실행 확정 및 재무상태표 원장 자동 반영"
    ],
    "auditResult": "자산 대장 장부가액 실시간 반영 및 재무제표 감가상각비 전표 생성",
    "rulesCompliance": [
      "헌장 5.1 [수학적 산식 준수]: 월 상각비 = (취득원가 - 잔존가치) / 내용연수(월) 산식 1:1 일치",
      "헌장 1.2 [이벤트 무누락]: 월별 상각 마감 일시 및 실행자 식별자 DB 영구 보존"
    ],
    "precautions": [
      "이미 매각/폐기 처리된 장비에 대해 중복 상각이 발생하지 않도록 제각 일자 철저 확인",
      "당월 마감 확정 후에는 취득원가 수정이 불가하므로 실행 전 신규 취득 등록 완료 여부 점검"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dep-export-asset\"]",
        "type": "stamp",
        "label": "상각 대상 자산 내보내기",
        "description": "당월 감가상각 계산 대상 자산 목록 및 기초 장부가액을 엑셀로 내려받습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dep-execute-panel\"]",
        "type": "stamp",
        "label": "감가상각 실행 패널",
        "description": "상각 기준 연월을 선택하고 당월 상각비 및 기말 장부가액을 자동 산출합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"dep-rollback\"]",
        "type": "stamp",
        "label": "마감 롤백 취소",
        "description": "오기 입력이나 회계 수정 발생 시 기마감된 감가상각 전표를 회계 취소합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"dep-execute-btn\"]",
        "type": "stamp",
        "label": "감가상각 최종 실행",
        "description": "정액법에 따른 월할 상각비를 계산하여 자산 장부가액에 영구 반영 마감합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"dep-rules-panel\"]",
        "type": "stamp",
        "label": "상각 회계 정책",
        "description": "내용연수(5년/8년 등), 잔존가액 정책, 취득월 일할 기준을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"dep-export-logs\"]",
        "type": "stamp",
        "label": "상각 이력 내보내기",
        "description": "과거 회계연도별 누적 감가상각 실행 대장을 엑셀로 저장합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"dep-logs-grid\"]",
        "type": "stamp",
        "label": "상각 실행 로그 대장",
        "description": "월별 상각 완료 일시, 실행 담당자, 상각 총액, 자산 변동 내역을 실사합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dep-status-banner\"]",
        "type": "highlight",
        "label": "감가상각 마감 상태",
        "description": "당월 감가상각비 계상 및 장부가액 감액 상태를 확인합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "depreciation-execute",
        "title": "월말 자산 감가상각 정액법 자동 마감",
        "description": "전체 고소작업대의 잔존 가액과 내용연수를 기준으로 월 감가상각비를 일괄 상각합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"dep-status-banner\"]",
            "type": "highlight",
            "label": "상각 상태 확인",
            "description": "당월 상각 실행 대기 자산 목록을 확인합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "regular_reports",
    "version": 10,
    "menuName": "정기보고서 생성",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "select",
        "type": "highlight",
        "label": "리포트 목록 선택",
        "description": "조회할 대상 연월을 선택하여 해당 월의 결산 보고서를 불러옵니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "button.btn-primary",
        "type": "callout",
        "label": "보고서 확정 및 다운로드",
        "description": "지시 사항을 저장하거나 최종 확정된 공식 보고서를 다운로드합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "보고서 확인 및 결재",
        "title": "보고서 확인 및 결재",
        "description": "결재 대기 중인 보고서를 선택하고 내용을 검토한 뒤 최종 승인합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "select",
            "type": "click_ripple",
            "label": "대기 보고서 선택",
            "description": "드롭다운 목록에서 결재할 대상 연월의 보고서를 선택합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid='reports-grid']",
            "type": "highlight",
            "label": "보고서 내용 검토",
            "description": "보고서 본문의 상세 지표, 차트, 부서별 의견을 정밀 검토합니다.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "button.btn-primary",
            "type": "stamp",
            "label": "승인 및 결재 확정",
            "description": "확인 버튼을 클릭하여 보고서를 최종 승인 상태로 확정 마감합니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "경영기획/경영진",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "전사 자산 가동률, 모델별 매출 기여도(헌장 4.1), 부서별 KPI, 손익 집계 등 경영진 브리핑용 정기보고서 자동 생성 및 엑셀 다운로드 (헌장 5.1 2단계 검증 적용)",
    "scopeInfo": "보고 기간(월간/분기/연간), 집계 지표(가동률, 총매출, 운송비율, 정비비용, 연체율)",
    "cognitiveSequence": [
      "1. 보고 기간(월간, 분기, 연간) 및 경영 성과 지표 스코핑",
      "2. 렌탈 자산 가동률 및 자산별 누적 매출 기여액 정밀 일할 통계 산출 (헌장 4.1)",
      "3. 고객사별 매출 순위 및 연체 채권 회수율 분석",
      "4. 장비 기종별/작업 높이별 렌탈 수요 트렌드 분석",
      "5. 운송비 및 정비비 원가 비율 지표 검증",
      "6. 전사 손익 요약 및 핵심 KPI(가동율 85% 이상, 연체율 3% 미만) 달성도 검토",
      "7. 정기 경영 보고서 PDF 생성 및 경영진 공식 배포 확정"
    ],
    "subTabs": [
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
    "auditResult": "경영 의사결정을 위한 100% 무오류 정기 경영 분석 보고서 완결",
    "rulesCompliance": [
      "헌장 5.1 [2단계 검증 정책 필수 이행]: 모든 통계 지표는 수학적 산식 정립 + DB 스키마 1:1 검증 후 집계",
      "헌장 3.1 [건조한 보고서]: 과장 없는 건조한 명사/숫자 중심 레이아웃"
    ],
    "precautions": [
      "월말 결산(청구 마감, 매입 마감, 감가상각)이 완료되기 전 집계 시 미확정 추정치로 표기 필수",
      "가동률 계산 시 역일(달력 일수)과 장비 총 보유 대수 기준을 명확히 명기"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"reports-header\"]",
        "type": "stamp",
        "label": "보고서 기준 연월 설정",
        "description": "정기 경영보고서 집계 기준 연월을 선택하고 데이터 범위를 확정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"reports-btn-refresh\"]",
        "type": "stamp",
        "label": "최신 실적 집계 갱신",
        "description": "매출, 수납, 가동률, 회계 전표 데이터를 원천 DB에서 최신으로 재집계합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"reports-btn-print\"]",
        "type": "stamp",
        "label": "보고서 출력 인쇄",
        "description": "A4 최적화 레이아웃으로 경영 실적 보고서를 인쇄합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"reports-btn-pdf\"]",
        "type": "stamp",
        "label": "공식 PDF 내보내기",
        "description": "임원 보고용 정기 경영 분석 보고서를 고해상도 PDF 파일로 저장합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"reports-kpi\"]",
        "type": "stamp",
        "label": "경영 핵심 지표 요약",
        "description": "월간 총매출, 영업이익, 장비 가동률, 채권 회수율 등 경영 실적을 조망합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "organization",
    "version": 10,
    "menuName": "조직 / 인사 관리",
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "인사/총무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "본사/지사/주기장 조직도 트리 구조, 부서 및 직급 체계 정의, 테넌트 정보보호 책임자 설정 및 메타데이터 관리",
    "scopeInfo": "상위 부서, 하위 부서, 직급/직책 코드, 테넌트 정보보호 책임자 성명/연락처, 사업장 소재지",
    "cognitiveSequence": [
      "1. 부서 조직도 트리 및 소속 임직원 현황 스코핑",
      "2. 신규 임직원 등록 (성명, 사번, 입사일, 로그인 ID, 부서)",
      "3. 직급(Position) 선택: 결재선 티어에 정의된 직급 내 선택 (0~7티어)",
      "4. 직책(Duty) 선택: 직책 설정(팀장, 센터장, 본부장 등) 지정 및 실시간 티어 확인",
      "5. 임직원 실효 결재 권한 티어(직책 우선 판정) 인포 박스 검증",
      "6. 비밀번호 초기화 및 모바일 현장 권한 부여",
      "7. 인사 정보 최종 저장  전자결재 승인선 및 조직도 실시간 동기화 확정"
    ],
    "subTabs": [
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
    "auditResult": "전사 부서 및 권한 통제의 근간이 되는 조직 마스터 SSOT 확립",
    "rulesCompliance": [
      "헌장 5.3 [단일 진실의 원천(SSOT)]: 조직 및 직급 메타데이터의 단일 원본 보존",
      "개인정보보호법 제31조 준수: 테넌트별 개인정보보호 책임자 필수 지정"
    ],
    "precautions": [
      "부서 삭제 시 소속된 임직원이 존재할 경우 삭제 불가 (타 부서로 사전 재배치 필수)",
      "정보보호 책임자 변경 시 개인정보 접속 감사 페이지 및 처리방침에 즉시 연동 반영"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"org-header\"]",
        "type": "stamp",
        "label": "조직 마스터 현황",
        "description": "전체 부서 수, 재직 임직원 수, 직급 체계 및 계정 상태를 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"org-export-excel\"]",
        "type": "stamp",
        "label": "조직도 엑셀 내보내기",
        "description": "전체 임직원 명부 및 부서 배치 데이터를 엑셀로 내려받습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"org-save-all\"]",
        "type": "stamp",
        "label": "조직 변동 저장",
        "description": "부서 이동 및 직책 변경 사항을 DB에 일괄 반영 저장합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"org-tree-panel\"]",
        "type": "stamp",
        "label": "부서 조직도 트리",
        "description": "영업부, 배차팀, 주기장정비팀 등 트리 구조로 부서를 추가·수정·배치합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"org-unassigned-pool\"]",
        "type": "stamp",
        "label": "미배치 사원 대기 큐",
        "description": "신규 가입 후 부서나 팀이 미지정된 임직원 계정을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"org-users-panel\"]",
        "type": "stamp",
        "label": "부서원 명부 대장",
        "description": "선택 부서에 소속된 사원의 성명, 직급, 사번, 연락처, 입사일을 관리합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"org-btn-add-user\"]",
        "type": "stamp",
        "label": "신규 임직원 등록",
        "description": "새로운 직원의 프로필, 로그인 이메일, 기본 부서 및 직급을 생성합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"org-tree-panel\"]",
        "type": "highlight",
        "label": "부서 조직 구조도",
        "description": "본사/지사/주기장 및 팀별 계층 구조를 조망하고 하위 부서를 신설·배치합니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"org-users-panel\"]",
        "type": "highlight",
        "label": "부서원 명부 대장",
        "description": "선택 부서에 소속된 임직원의 직급, 직책, 결재선 티어 및 계정 상태를 관리합니다.",
        "positionHint": "left"
      }
    ],
    "processes": [
      {
        "processId": "org_add_dept",
        "title": "신규 부서 추가 및 조직도 구성",
        "description": "사내 직제 개편에 따라 신규 부서를 추가하고 상위 부서 아래에 배치하는 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"org-tree-panel\"]",
            "type": "highlight",
            "label": "상위 부서 선택",
            "description": "조직도 트리에서 신설할 부서의 상위 조직 또는 본부를 클릭합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"org-btn-add-dept\"]",
            "type": "click_ripple",
            "label": "하위 부서 추가 클릭",
            "description": "조직 트리 상단의 [+] 버튼을 클릭하여 새 부서 노드를 생성합니다.",
            "positionHint": "bottom"
          }
        ]
      },
      {
        "processId": "org_register_user",
        "title": "신규 임직원 등록 및 직책 설정",
        "description": "새로운 직원의 프로필과 직책/직급을 등록하여 전자결재 티어를 확정하는 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"org-btn-add-user\"]",
            "type": "click_ripple",
            "label": "신규 직원 등록 버튼 클릭",
            "description": "명부 상단의 [신규 직원 등록] 버튼을 클릭하여 입력 모달을 엽니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"org-users-panel\"]",
            "type": "highlight",
            "label": "배치 결과 확인",
            "description": "등록된 직원이 부서원 명부에 정상 반영되고 직책 티어가 산정되었는지 확인합니다.",
            "positionHint": "left"
          }
        ]
      }
    ]
  },
  {
    "menuId": "permission",
    "version": 10,
    "menuName": "사용자 및 권한",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid='btn-inherit-role']",
        "type": "highlight",
        "label": "사용자 그리드",
        "description": "개별 직원 목록을 조회하고 시스템 등급 및 권한 명칭을 부여할 수 있는 사용자 그리드 탭입니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid='matrix-title']",
        "type": "callout",
        "label": "권한 설정 매트릭스",
        "description": "선택한 역할(Role)에 대해 각 메뉴별 조회 및 저장 권한을 상세하게 제어할 수 있는 영역입니다.",
        "positionHint": "left"
      }
    ],
    "processes": [
      {
        "processId": "process_grant_permission",
        "title": "권한 부여 및 수정",
        "description": "대상을 선택하고 세부 메뉴 권한을 수정한 뒤 저장하는 과정입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid='role-list-title']",
            "type": "click_ripple",
            "label": "대상 선택",
            "description": "좌측 목록에서 권한을 수정할 대상을 클릭하여 선택합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid='permission-matrix-grid'], [data-mid='matrix-title']",
            "type": "highlight",
            "label": "권한 토글",
            "description": "우측 매트릭스에서 부여할 특정 메뉴의 조회 또는 저장 권한 체크박스를 클릭하여 변경합니다.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid='btn-save-permissions']",
            "type": "click_ripple",
            "label": "설정 저장",
            "description": "변경 사항을 시스템에 반영하기 위해 상단의 저장 버튼을 클릭합니다.",
            "positionHint": "bottom"
          }
        ]
      },
      {
        "processId": "process_map_user_role",
        "title": "직원 권한 상속 배정",
        "description": "개별 임직원을 검색하고 사내 직무에 부합하는 권한 역할을 1:1 매핑 부여합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid='btn-inherit-role']",
            "type": "click_ripple",
            "label": "직원 권한 배정 탭 진입",
            "description": "상단 탭 바에서 [직원 권한 상속 배정] 탭을 클릭하여 전환합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid='permission-user-filter']",
            "type": "callout",
            "label": "임직원 검색 및 필터",
            "description": "성명, 부서, 직급 조건을 입력하여 권한을 배정할 직원을 검색합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid='permission-user-grid']",
            "type": "highlight",
            "label": "권한 역할 드롭다운 선택",
            "description": "해당 직원 행의 권한 명칭 드롭다운에서 부여할 역할을 선택하여 즉시 매핑합니다.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "시스템관리자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "임직원 계정 생성, 소속 부서/직급 매핑, 직급 티어(Tier 1~7) 부여 및 메뉴별 읽기/쓰기/삭제 RBAC 권한 제어",
    "scopeInfo": "로그인 ID, 사원 성명, 소속 부서, 직급, 티어 레벨(0~7), 메뉴별 권한 매트릭스(view, edit, delete, export)",
    "cognitiveSequence": [
      "1. 역할 그룹(ADMIN, MANAGER, STAFF, DRIVER, GUEST) 스코핑",
      "2. 51개 전사 메뉴별 접근 권한(조회, 등록, 수정, 삭제, 엑셀) 매트릭스 점검",
      "3. 부서별(영업, 배차, 주기장, 정비, 관리) R&R 헌장 부합성 검증 (헌장 2.1)",
      "4. 특수 민감 메뉴(급여, 자금, 결재선 설정) 관리자 전용 권한 제한",
      "5. 원격 Supabase Row-Level Security(RLS) 정책 일치성 검증",
      "6. 권한 변경 시뮬레이션 및 권한 테스트 유저 전환 검증",
      "7. 권한 매트릭스 최종 적용 및 전사 세션 실시간 반영"
    ],
    "subTabs": [
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
    "auditResult": "부서별 업무 R&R에 입각한 엄격한 최소 권한(Least Privilege) 체계 확립",
    "rulesCompliance": [
      "헌장 2.1 [부서 R&R 엄격 분리]: 영업사원 계정에는 장비 할당/배차 편집 권한 부여 금지",
      "헌장 5.3 [SSOT 권한]: 권한 정의를 DB user_permissions 단일 테이블로 일관 관리"
    ],
    "precautions": [
      "퇴사자 발생 시 즉시 계정 상태를 [비활성(Inactive)]으로 전환하여 접근 차단",
      "관리자(Tier 7) 권한은 대표이사 및 전산 책임자 외 임의 부여 절대 금지"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"permission-scope\"]",
        "type": "stamp",
        "label": "권한 롤 선택",
        "description": "최고관리자, 영업관리, 배차담당, 정비기사 등 권한 그룹을 선택합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"permission-user-scope\"]",
        "type": "stamp",
        "label": "사용자별 권한 스코핑",
        "description": "특정 임직원을 검색하여 개별 메뉴 접근 및 CUD 권한을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"permission-pipeline-add\"]",
        "type": "stamp",
        "label": "신규 권한 그룹 생성",
        "description": "새로운 직무 롤을 정의하고 직무별 기본 권한 템플릿을 생성합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"permission-inspection-grid\"]",
        "type": "stamp",
        "label": "메뉴별 접근 권한 매트릭스",
        "description": "각 메뉴별 읽기, 쓰기, 삭제, 엑셀 출력 권한을 1:1 매핑 체크합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"permission-inspection-detail\"]",
        "type": "stamp",
        "label": "특수 권한 상세 설정",
        "description": "단가 조회, 미수금 열람, 감사 로그 접근 등 보안 속성을 상세 제어합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"permission-pipeline-save\"]",
        "type": "stamp",
        "label": "권한 변경 사항 저장",
        "description": "수정된 권한 매트릭스 정책을 DB 및 사용자 세션에 즉시 적용합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"permission-user-inspection-filter\"]",
        "type": "stamp",
        "label": "임직원 권한 검색",
        "description": "부서별, 재직 상태별로 임직원을 필터링하여 권한 현황을 검토합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"permission-user-inspection-grid\"]",
        "type": "stamp",
        "label": "임직원 롤 매핑 대장",
        "description": "개별 사원에게 부여된 주 권한과 추가 예외 권한을 대조합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 9,
        "selector": "[data-mid=\"permission-terminal-audit\"]",
        "type": "stamp",
        "label": "보안 감사 로그 대조",
        "description": "권한 변경 이력, 최종 수정자, 변경 시각을 감사 추적합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "payroll",
    "version": 10,
    "menuName": "급여 정산",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"payroll-month-input\"], [data-mid=\"payroll-scope-month\"]",
        "type": "callout",
        "label": "정산 대상 연월 선택",
        "description": "급여를 정산할 대상 년월을 지정합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"payroll-inspection-grid\"]",
        "type": "highlight",
        "label": "급여 정산 대장",
        "description": "임직원별 기본급, 수당, 공제 항목, 실지급액을 대사합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "payroll_inquiry_and_lock",
        "title": "월별 급여 대장 조회 및 마감 승인",
        "description": "당월 급여 산출 내역을 검증하고 마감 결재를 통해 확정합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"payroll-month-input\"], [data-mid=\"payroll-scope-month\"]",
            "type": "callout",
            "label": "정산 대상 연월 선택",
            "description": "급여를 정산할 대상 년월을 지정합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"payroll-inspection-grid\"]",
            "type": "highlight",
            "label": "급여 대장 실사",
            "description": "직원별 산정 급여와 공제 내역을 1:1 대사합니다.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"payroll-terminal-audit-close\"], button.btn-success",
            "type": "click_ripple",
            "label": "결재 마감 승인 잠금",
            "description": "급여 대장을 최종 확정하고 수정을 잠급니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "인사/급여팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "기본급, OT 수당, 식대, 4대보험 공제액 및 소득세를 반영한 월별 급여 명세서 자동 산출, 급여 이체 데이터 확정 및 명세서 발송",
    "scopeInfo": "급여 연월, 임직원 기본급 테이블, 당월 OT 승인 시간, 4대보험 요율, 부양가족 수",
    "cognitiveSequence": [
      "1. 급여 지급 연월 및 대상 임직원 명부 스코핑",
      "2. 기본급, 직책수당, 근속수당 기본 항목 산정",
      "3. 당월 승인된 연장/휴일 근로 시간 기반 시간외 수당 자동 집계",
      "4. 4대 보험(국민연금, 건강보험, 고용보험, 산재보험) 및 소득세/지방소득세 공제 계산",
      "5. 차인지급액(실지급액) 정밀 검증 및 급여 대장 대차대조 확정",
      "6. 급여 지급 전자결재 상신 (헌장 결재선 연동)",
      "7. 급여명세서 개별 암호화 PDF 생성 및 임직원 모바일/이메일 전자 교부"
    ],
    "auditResult": "임직원 급여 정산 100% 무결성 확정 및 세무 원천징수 신고 기초 데이터 완결",
    "rulesCompliance": [
      "헌장 5.1 [수학적 산식 검증]: 실지급액 = 지급총액 - 공제총액 (1원의 절사 오차 없는 검증)",
      "헌장 1.2 [이벤트 기록 무누락]: 급여 산출 근거 및 확정 이력 암호화 저장"
    ],
    "precautions": [
      "당해 연도 4대보험 법정 요율 변경 시 요율 테이블 최신화 선행 필수",
      "급여 데이터는 극비 개인정보이므로 권한 없는 자의 화면 접근 절대 차단"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"payroll-scope-month\"]",
        "type": "stamp",
        "label": "정산 지급 연월 설정",
        "description": "급여 지급 대상 연월 및 정산 기준일을 지정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"payroll-scope-emp\"]",
        "type": "stamp",
        "label": "급여 대상 임직원 필터",
        "description": "전체 사원, 정규직, 계약직, 현장 기사별로 정산 대상을 선택합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"payroll-pipeline-upload\"]",
        "type": "stamp",
        "label": "근태 및 수당 엑셀 업로드",
        "description": "연장근무, 휴일수당, 식대, 차량보조금 실적을 엑셀로 일괄 반입합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"payroll-inspection-grid\"]",
        "type": "stamp",
        "label": "급여 정산 명세 대장",
        "description": "기본급, 수당, 4대보험, 소득세 원천징수액 및 실지급액을 1:1 검증합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"payroll-terminal-audit-close\"]",
        "type": "stamp",
        "label": "급여 마감 최종 확정",
        "description": "당월 급여 산출 내역을 확정 마감하고 회계 전표로 이관합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"payroll-terminal-audit-email\"]",
        "type": "stamp",
        "label": "급여명세서 전자 발송",
        "description": "암호화된 개인별 급여명세서를 임직원 이메일로 일괄 전송합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"payroll-terminal-audit-excel\"]",
        "type": "stamp",
        "label": "급여 대장 엑셀 내보내기",
        "description": "은행 급여 이체용 대장 및 급여 대장 원부를 엑셀로 다운로드합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "leave_management",
    "version": 10,
    "menuName": "연차관리",
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "인사팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "전사 임직원의 입사일 기준 법정 연차 일수 자동 부여, 사용 일수 차감 집계, 연차 유급휴가 사용 촉진 통보 관리",
    "scopeInfo": "임직원 입사일자, 근속 연수, 법정 발생 연차, 회계연도 기준 사용 연차, 잔여 일수, 촉진 통보 이력",
    "cognitiveSequence": [
      "1. 기준 연도 및 전사 부서별 연차 관리 대장 스코핑",
      "2. 근로기준법 기준 입사일별 법정 연차 발생 일수 자동 계산 (1년 미만 월 1개, 1년 이상 15개~)",
      "3. 당해 연도 승인된 연차/반차 사용 일수 누적 집계",
      "4. 임직원별 잔여 연차 일수 및 연차 소진율 모니터링",
      "5. 연차 유급휴가 사용 촉진 통보서(1차, 2차) 법정 기한 내 자동 생성",
      "6. 연말 미사용 연차 수당 정산액 산출 및 급여 연동 검토",
      "7. 전사 연차 정산 마감 확정 및 인사 감사 원장 보존"
    ],
    "subTabs": [
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
    "auditResult": "근로기준법 제61조 연차 사용 촉진 절차 완벽 준수 및 연차 충당부채 확정",
    "rulesCompliance": [
      "헌장 5.1 [수학적 산식 준수]: 잔여 연차 = 발생 연차 - 승인 완료 사용 연차 일치 보장",
      "헌장 3.1 [건조한 UI]: 촉진 통보일자 및 수령 서명 사실 위주 기록"
    ],
    "precautions": [
      "1년 미만 입사자는 1개월 개근 시 1일씩 발생하는 월 단위 연차 기준 적용 필수",
      "연차 촉진 통보서를 기한 내 서면/전자 통보하지 않으면 미사용 연차 수당 지급 의무 발생"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"leave-scope-emp\"]",
        "type": "stamp",
        "label": "임직원 연차 조회 조건",
        "description": "귀속 연도, 부서, 사원명을 선택하여 연차 현황을 스코핑합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"leave-inspection-quota-grid\"]",
        "type": "stamp",
        "label": "연차 부여 및 잔여 대장",
        "description": "근속연수별 발생 연차, 기사용 연차, 잔여 일수를 1:1 대조합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"leave-inspection-usage-grid\"]",
        "type": "stamp",
        "label": "연차 사용 상세 내역",
        "description": "신청 일자, 휴가 유형(연차/반차/경조/병가), 사용 사유, 결재 상태를 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"leave-pipeline-add\"]",
        "type": "stamp",
        "label": "연차 수동 조정 및 등록",
        "description": "포상 휴가 가산, 이월 연차 반영 등 수동 가감 조정을 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"leave-terminal-audit-excel\"]",
        "type": "stamp",
        "label": "연차 대장 엑셀 내보내기",
        "description": "전사 연차 발생 및 사용 결산 현황을 엑셀 파일로 내려받습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"leave-terminal-audit-delete\"]",
        "type": "stamp",
        "label": "연차 사용 내역 취소",
        "description": "미승인 또는 취소 요청된 연차 내역을 삭제하고 잔여 연차를 복원합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"leave-pipeline-edit\"]",
        "type": "stamp",
        "label": "연차 발생 일수 수정",
        "description": "입사일 기준 회계연도 비례 연차 부여 일수를 수정 저장합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"leave-inspection-summary\"]",
        "type": "stamp",
        "label": "연차 소진율 요약 지표",
        "description": "전사 총 발생일수, 총 사용일수, 평균 소진율, 촉구 대상자를 모니터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"leave-scope-emp\"]",
        "type": "callout",
        "label": "임직원 연차 검색",
        "description": "성명 또는 부서를 입력하여 대상 임직원의 연차 현황을 신속히 스코핑합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"leave-inspection-quota-grid\"], [data-mid=\"leave-inspection-usage-grid\"]",
        "type": "highlight",
        "label": "연차 관리 대장",
        "description": "근속연수별 법정 발생 연차, 기사용 일수, 잔여 일수를 1:1 대조 실사합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "leave_quota_management",
        "title": "연차 부여 및 잔여 한도 관리",
        "description": "임직원별 발생 연차 일수를 갱신하고 잔여 연차를 대조 확정하는 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"leave-tab-quota\"]",
            "type": "click_ripple",
            "label": "연차 현황 대장 탭 선택",
            "description": "상단에서 [임직원 연차 갱신/현황 대장] 탭을 클릭합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"leave-scope-emp\"]",
            "type": "callout",
            "label": "대상 임직원 검색",
            "description": "검색창에 사원명을 입력하여 연차 한도를 수정할 직원을 찾습니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "privacy_audit",
    "version": 10,
    "menuName": "개인정보 접속 감사",
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "개인정보보호책임자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "개인정보보호법에 따른 주민등록번호, 연락처, 계좌번호 등 고유식별정보의 열람/수정/다운로드 접속 기록 무누락 감사 및 침해사고 예방",
    "scopeInfo": "접속 일시, 접속자 ID/성명, 접속자 IP, 열람 대상 정보 주체, 수행 액션(READ/EXPORT/UPDATE), 법적 정당 사유",
    "cognitiveSequence": [
      "1. 감사 기간 및 열람 유형(고객 주민번호, 계좌번호, 임직원 정보) 스코핑",
      "2. 개인정보 취급자의 조회 일시, 접속 IP, 열람 사유 로그 전수 검색",
      "3. 개인정보 다운로드(엑셀 내보내기) 대량 발생 건 탐지 및 경보 확인",
      "4. 암호화 저장 및 전송 구간 안전성 기준(SSL/TLS, SHA256) 준수 점검",
      "5. 3년 경과 불필요 개인정보 파기 대상 목록 추출",
      "6. 개인정보 파기 실행 및 파기 확인서 자동 발급",
      "7. 개인정보 보호법 제30조 법정 안전성 감사 보고서 확정"
    ],
    "subTabs": [
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
    "auditResult": "개인정보 접속 기록 최소 1~2년 이상 위변조 없이 안전 보관 법정 의무 충족",
    "rulesCompliance": [
      "헌장 1.2 [이벤트 기록 무누락 DB 저장]: 접속 기록 로그 삭제/변조 영구 금지 (WORM)",
      "헌장 5.6 [날조 영구 엄단]: 인과율과 실제 접속 IP 타임스탬프 완벽 일치 보증"
    ],
    "precautions": [
      "개인정보 접속 기록은 최소 1년(5만명 이상/민감정보 시 2년) 이상 영구 보존 필수",
      "심야 시간대 대량 다운로드 감지 시 즉시 정보보호 책임자에게 비상 경보 발령"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"privacy-scope-date\"]",
        "type": "stamp",
        "label": "감사 기간 범위 설정",
        "description": "접속 로그 조회 시작일과 종료일을 지정하여 감사 범위를 확정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"privacy-scope-text\"]",
        "type": "stamp",
        "label": "접속자 및 대상 검색",
        "description": "조회 사원명, 로그인 계정, 고객 상호, 주민/사업자번호를 검색합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"privacy-scope-select\"]",
        "type": "stamp",
        "label": "수행 작업 유형 필터",
        "description": "열람, 수정, 삭제, 엑셀 다운로드, 인쇄 등 작업 유형별로 필터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"privacy-inspection-grid\"]",
        "type": "stamp",
        "label": "개인정보 접속 감사 대장",
        "description": "접속 일시, 접속자 IP, 접근 메뉴, 조회된 개인정보 항목, 사유를 실사합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"privacy-terminal-audit-excel\"]",
        "type": "stamp",
        "label": "감사 로그 엑셀 내보내기",
        "description": "법적 증빙 보존을 위해 개인정보 접속 기록을 암호화 엑셀로 내려받습니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"privacy-pipeline-refresh\"]",
        "type": "stamp",
        "label": "감사 로그 즉시 갱신",
        "description": "최신 발생된 접속 및 다운로드 이벤트를 원천 DB에서 즉시 재조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"privacy-inspection-detail\"]",
        "type": "stamp",
        "label": "접속 상세 패킷 검토",
        "description": "대량 다운로드 또는 비정상 시간대 접속 건의 상세 페이로드를 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"privacy-scope-header\"]",
        "type": "stamp",
        "label": "개인정보 감사 규정 요약",
        "description": "법정 보존 기한(2년 이상), 이상 징후 알림 기준, 개인정보보호법 준수 지표를 조망합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"privacy-scope-header\"]",
        "type": "highlight",
        "label": "개인정보 보호책임자 현황",
        "description": "법정 개인정보 보호책임자(CPO) 지정 정보 및 전사 처리방침 규정을 확인합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"privacy-inspection-grid\"]",
        "type": "highlight",
        "label": "개인정보 접속 감사 대장",
        "description": "열람 일시, 접속자 IP, 대상 고객/임직원 식별정보, 접근 사유를 전수 실사합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "privacy_audit_log_query",
        "title": "개인정보 접속 감사 로그 조회",
        "description": "지정 기간 동안 발생한 고유식별정보 열람 및 다운로드 기록을 전수 검색합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"privacy-scope-date\"]",
            "type": "callout",
            "label": "감사 기간 범위 설정",
            "description": "조회 시작일과 종료일을 지정하여 감사 대상 범위를 확정합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"privacy-inspection-grid\"]",
            "type": "highlight",
            "label": "접속 로그 대조 실사",
            "description": "비정상 시간대 접속이나 대량 조회가 발생했는지 로그를 검토합니다.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "operations_manual",
    "version": 10,
    "menuName": "업무매뉴얼",
    "groupId": "grp_tools",
    "groupName": "도구 및 다운로드",
    "department": "전사 임직원",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "전사 모든 부서 및 메뉴의 업무 프로세스, 조작 동선, 표준 헌장 준수 수칙을 전수 검색/열람하고 실무 지침서로 활용",
    "scopeInfo": "전사 51개 메뉴별 상세 매뉴얼, 부서별 퀵 네비게이션, 검색 키워드, A4 인쇄 서식",
    "cognitiveSequence": [
      "1. 전사 51개 메뉴 및 20개 모달 매뉴얼 목록 스코핑",
      "2. 매뉴얼별 단계 뱃지 수, 버전, 최근 수정자 현황 확인",
      "3. 화면별 7단계 표준 업무 흐름 및 인지 조작 시퀀스 적합성 검토",
      "4. 마크다운 기능 정의서 편집기 호출 및 비즈니스 헌장 규격 갱신",
      "5. 모달 및 신규 기능 추가 시 인앱 단계 가이드 실시간 작성 및 위치 보정",
      "6. 전사 매뉴얼 시드 일괄 동기화(seedAllManuals) 실행",
      "7. 전사 운영 표준 매뉴얼 무결성 확정 및 배포"
    ],
    "auditResult": "신규 입사자 교육 및 전사 임직원의 업무 혼선 제로화 달성",
    "rulesCompliance": [
      "헌장 1.1 [시스템 최우선 사명]: 최소 노력 대비 최대 편익 창출을 위한 전사 지식 기반 확립",
      "헌장 3.1 [무수식어 건조 표준]: 감성적 미사여구를 배제한 명확한 업무 지침 전수 수록"
    ],
    "precautions": [
      "현장 프로세스 개편 시 매뉴얼도 즉시 동기화 갱신하여 지식의 노후화 방지",
      "인쇄물 배포 시 버전 관리 번호(v1.8.x)를 확인하여 구버전 매뉴얼 파기"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"operations_manual-scope\"]",
        "type": "stamp",
        "label": "매뉴얼 검색 스코프",
        "description": "메뉴, 목표, 헌장 등 전체 매뉴얼 컨텐츠를 검색합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"operations_manual-filter\"]",
        "type": "stamp",
        "label": "부서 필터링",
        "description": "담당 부서별로 매뉴얼을 필터링하여 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"operations_manual-pipeline-db\"]",
        "type": "stamp",
        "label": "DB 일괄 주입",
        "description": "모든 표준 매뉴얼을 DB에 영구 주입 및 동기화합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"operations_manual-pipeline-print\"]",
        "type": "stamp",
        "label": "A4 인쇄",
        "description": "선택된 매뉴얼 또는 전체 매뉴얼을 A4 규격으로 인쇄합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"operations_manual-inspection-nav\"]",
        "type": "stamp",
        "label": "메뉴 목록 네비게이션",
        "description": "그룹화된 메뉴 목록에서 상세 조회할 매뉴얼을 선택합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "right",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"operations_manual-terminal-detail\"]",
        "type": "stamp",
        "label": "매뉴얼 상세 컨텐츠",
        "description": "선택된 메뉴의 Z-패턴 조작 동선 및 감사 결과를 포함한 전체 매뉴얼을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "left",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"operations_manual-inspection-card\"]",
        "type": "stamp",
        "label": "매뉴얼 요약 정보",
        "description": "해당 메뉴의 소속 부서, 아키타입, 메뉴ID 등의 핵심 요약을 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "error_report",
    "version": 10,
    "menuName": "오류 신고",
    "groupId": "grp_tools",
    "groupName": "도구 및 다운로드",
    "department": "전사 임직원",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "시스템 버그, 데이터 불일치, 화면 멈춤 등 장애 발생 시 화면 캡처와 브라우저 로그를 첨부하여 개발팀에 즉각 접수 (신속 핫픽스 큐 연동)",
    "scopeInfo": "발생 메뉴, 오류 현상 설명, 재현 경로, 스크린샷 이미지, 사용자 브라우저/OS 정보, 콘솔 로그",
    "cognitiveSequence": [
      "1. 오류 발생 기간 및 심각도(CRITICAL, WARNING, INFO) 스코핑",
      "2. 브라우저 콘솔 에러, 네트워크 실패, DB RLS 차단 로그 상세 확인",
      "3. 발생 사용자 세션, 기기(PC/모바일), 화면 URL 추적",
      "4. 무음 실패(Silent Swallow) 방지 헌장 5.2 준수 여부 점검",
      "5. 오류 재현 절차 확인 및 임시 조치 가이드 등록",
      "6. 버그 패치 배포 후 오류 티켓 상태 해결됨(RESOLVED) 전환",
      "7. 시스템 안정성 지표(가용성 99.9%) 확정 및 재발 방지 대책 수립"
    ],
    "modalWorkflows": [
      {
        "modalName": "시스템 오류 등록 팝업",
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
    "auditResult": "오류 티켓 접수 완료 및 개발팀 24시간 내 패치 릴리즈 큐 인계",
    "rulesCompliance": [
      "헌장 5.2 [전 스토리지 저장 성공 검증 및 무음 실패 방지]: 장애 무음 은폐 방지 및 즉각 직보",
      "헌장 6.1 [버전 관리]: 배포 버전 빌드 넘버와 함께 버그 추적성 확보"
    ],
    "precautions": [
      "단순 새로고침으로 해결되는 네트워크 일시 오류인지 확인 후 지속 재현 시 신고",
      "개인정보나 계좌번호가 포함된 화면 캡처 시 중요 번호 마스킹 처리"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"error_report-scope-status\"]",
        "type": "stamp",
        "label": "단계별 오류 현황",
        "description": "신고등록, 접수처리, 완료 등 3대 단계별 오류 신고 현황을 한눈에 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"error_report-scope-filters\"]",
        "type": "stamp",
        "label": "신고 내역 검색 필터",
        "description": "단계, 발생 메뉴, 중요도, 검색어 등을 통해 오류 신고 내역을 필터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"error_report-pipeline-export\"]",
        "type": "stamp",
        "label": "엑셀 내보내기",
        "description": "현재 필터링된 오류 신고 내역을 엑셀 파일로 다운로드합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"error_report-pipeline-register\"]",
        "type": "stamp",
        "label": "신규 신고 등록",
        "description": "새로운 시스템 오류, 버그, 또는 개선 요청을 등록합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"error_report-inspection-grid\"]",
        "type": "stamp",
        "label": "오류 신고 대장 그리드",
        "description": "등록된 오류 신고의 처리 상태, 중요도, 신고자 및 담당자를 목록에서 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"error_report-modal-register\"]",
        "type": "stamp",
        "label": "신고 등록 모달",
        "description": "발생 메뉴, 오류 유형, 상세 내용 및 증빙 화면 캡처 등을 첨부하여 신고를 접수합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"error_report-modal-detail\"]",
        "type": "stamp",
        "label": "신고 상세 및 처리 모달",
        "description": "신고 상세 내역을 확인하고, 담당자 배정(접수) 및 조치 완료 처리를 수행합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "agentic_ai_lab",
    "version": 10,
    "menuName": "에이전틱 AI 샌드박스 랩",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "개발/기획팀",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "멀티에이전트 자율 의사결정 모델, 고소작업대 MRO 도메인 지식 파이프라인, 프롬프트 테스트 및 자율 최적화 연구",
    "scopeInfo": "에이전트 모델(LLaMA 3.3, Gemini Flash), 도메인 지식 사전, 테스트 프롬프트, 추론 지연시간/비용",
    "cognitiveSequence": [
      "1. 에이전틱 AI 실험 파이프라인 및 테스트 모델 스코핑",
      "2. 자연어 ERP 프롬프트 입력 및 의도(Intent) 분석 테스트",
      "3. MCP(Model Context Protocol) 툴 호출 및 스키마 검증",
      "4. 가상 비즈니스 이벤트 시뮬레이션 및 안전성 가드레일 점검",
      "5. 타 부서 권한 침해 방지(영업의 자산번호 임의 지정 차단 등) 검증 (헌장 2.1)",
      "6. 보존 법칙(날짜, 수지, 상태 보존) 충족 여부 테스트 (헌장 5.5)",
      "7. 에이전트 실험 결과 감사 로그 확정 및 정식 워크플로우 승격 검토"
    ],
    "auditResult": "도메인 특화 에이전트 의사결정 정확도 99% 달성 및 자율 운영 준비 확립",
    "rulesCompliance": [
      "헌장 5.6 [날조 영구 엄단]: 가짜 Mock 응답 배제, 실제 LLM 추론 결과만 정직하게 로깅",
      "헌장 5.7 [감사관 에이전트 행동 강령]: 적대적 관점의 교차 검증 수행"
    ],
    "precautions": [
      "실제 운영 DB에 직접 영향을 주지 않는 격리된 샌드박스 환경에서만 실행",
      "API 호출 토큰 비용 및 Rate Limit 모니터링 필수"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"agentic_ai_lab-scope\"]",
        "type": "stamp",
        "label": "시나리오 프리셋",
        "description": "다양한 에이전틱 AI 업무 시나리오 프리셋을 선택하여 신속하게 테스트합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"agentic_ai_lab-input\"]",
        "type": "stamp",
        "label": "자연어 프롬프트 입력",
        "description": "에이전트에게 지시할 비즈니스 업무를 자연어로 직접 입력합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"agentic_ai_lab-pipeline-run\"]",
        "type": "stamp",
        "label": "단일 에이전트 실행",
        "description": "입력된 프롬프트를 기반으로 AI 에이전트를 단발성으로 실행합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"agentic_ai_lab-pipeline-stress\"]",
        "type": "stamp",
        "label": "스트레스 테스트",
        "description": "20회 연속으로 에이전트를 실행하여 시스템 부하 및 안정성을 테스트합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"agentic_ai_lab-metrics\"]",
        "type": "stamp",
        "label": "효익 정량 비교 현황판",
        "description": "수동 작업 대비 AI가 절감한 시간, 조작 횟수 및 무결성 결과를 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"agentic_ai_lab-timeline\"]",
        "type": "stamp",
        "label": "인공지능 추론 타임라인",
        "description": "AI 에이전트의 단계별 사고 과정(Thought) 및 도구 호출(Action) 내역을 모니터링합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"agentic_ai_lab-manifest\"]",
        "type": "stamp",
        "label": "도구 매니페스트",
        "description": "에이전트가 활용 가능한 전사 표준 원자적(Atomic) API 도구 목록을 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"agentic_ai_lab-scope\"]",
        "type": "highlight",
        "label": "시나리오 프리셋 선택",
        "description": "출고 의뢰, 배차 추천, 계약 대차 등 사전 정의된 고난도 ERP 시나리오를 선택합니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"agentic_ai_lab-timeline\"]",
        "type": "highlight",
        "label": "인공지능 추론 타임라인",
        "description": "AI 에이전트의 단계별 생각(Thought), 표준 도구 호출(Tool Call) 및 관찰(Observation)을 실시간 모니터링합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "agentic_ai_single_run",
        "title": "에이전틱 AI 단일 실행 및 추론 관제",
        "description": "자연어 프롬프트로 업무를 지시하고 AI가 도구를 호출하여 업무를 완결하는 과정입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"agentic_ai_lab-scope\"]",
            "type": "click_ripple",
            "label": "시나리오 프리셋 선택",
            "description": "테스트할 비즈니스 시나리오를 클릭하여 프롬프트 콘솔에 로드합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"agentic_ai_lab-pipeline-run\"]",
            "type": "click_ripple",
            "label": "인공지능 자동 실행 클릭",
            "description": "상단 [에이전틱 AI 실행] 버튼을 눌러 ReAct 추론 루프를 가동합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"agentic_ai_lab-timeline\"]",
            "type": "highlight",
            "label": "추론 및 툴 호출 모니터링",
            "description": "에이전트가 헌장 가드레일을 준수하며 정확한 DB 도구를 실행하는지 확인합니다.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "agentic_dispatch_studio",
    "version": 10,
    "menuName": "에이전틱 배차 관제 스튜디오",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "개발/배차팀",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "차량 위치 기반 최적 배차 경로, 실시간 교통 상황, 셀프 톤수별 적재율을 AI가 자율 시뮬레이션하고 최적 기사를 자동 추천하는 관제탑",
    "scopeInfo": "미배정 배차 건수, 등록 운송 기사 위치 데이터, 지오코딩 좌표, 차종별 표준 요율표",
    "cognitiveSequence": [
      "1. 미배정 출고 의뢰 큐 및 주기장 보유 장비 가용성 실시간 스코핑",
      "2. 최적 운송 경로 및 차량 적재 시뮬레이션 (왕복 EXCHANGE 단일 배차 우선)",
      "3. 운송사별 과거 정시성 및 운송료 할인율 기반 최적 기사 자동 추천",
      "4. 기상 악화(강풍/폭우) 위험 지역 배차 자동 경보 및 우회 경로 안내",
      "5. 배차 의뢰서 자동 생성 및 운송 기사 모바일 푸시 발송",
      "6. 기사 수락 및 실시간 운송 상태(상차, 이동, 도착) 자동 트래킹",
      "7. 배차 완료 확정 및 운송료 대사 원장 자동 전이"
    ],
    "auditResult": "공차 운행율 30% 감축 및 왕복 운송비 최적화를 통한 비용 절감 실현",
    "rulesCompliance": [
      "헌장 2.3 [단일 EXCHANGE 1건 원칙]: 왕복 배차 체인을 묶어 합짐 최적화 유도",
      "헌장 1.1 [최대 편익]: 배차 담당자의 수작업 배차 고민 시간을 최소화"
    ],
    "precautions": [
      "지도 API 호출 쿼터 초과 시 오프라인 거리 계산 알고리즘으로 자동 폴백 확인",
      "기사 휴게 시간 및 과적 여부를 시스템이 사전에 강제 필터링"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"agentic_dispatch_studio-metrics\"]",
        "type": "stamp",
        "label": "인공지능 배차 효율성 현황판",
        "description": "수동 배차 대비 단축된 시간, 절감된 클릭 수 및 헌장 준수 현황을 실시간으로 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"agentic_dispatch_studio-input\"]",
        "type": "stamp",
        "label": "자연어 배차 지시 입력",
        "description": "운송지, 장비, 요청 사항 등을 자연어로 입력하여 배차를 지시합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"agentic_dispatch_studio-pipeline-run\"]",
        "type": "stamp",
        "label": "배차 수립 실행",
        "description": "에이전틱 AI가 자연어 지시를 분석하고 헌장 2.3을 검증하여 배차를 수립합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"agentic_dispatch_studio-inspection-deck\"]",
        "type": "stamp",
        "label": "배차 관제 큐",
        "description": "AI가 수립한 배차 의뢰 내역과 기존 배차 확정 내역을 목록으로 확인합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "left",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"agentic_dispatch_studio-inspection-card\"]",
        "type": "stamp",
        "label": "배차 상세 카드",
        "description": "개별 배차의 출고/회수/교환 유형, 운송 경로, 기사 정보 및 운송비 정산 내역을 상세 조회합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"agentic_dispatch_studio-terminal-confirm\"]",
        "type": "stamp",
        "label": "배차 최종 승인",
        "description": "AI가 자동 배정한 기사와 운송비를 검토 후 최종 배차를 확정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"agentic_dispatch_studio-audit-discount\"]",
        "type": "stamp",
        "label": "왕복할인 검증",
        "description": "대차 교환 배차 시 헌장 2.3에 따른 왕복할인 정산이 정확히 차감되었는지 검증합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"kpi-exchange-compliance\"]",
        "type": "highlight",
        "label": "헌장 2.3 교환 준수율 현황판",
        "description": "대차 단일 왕복 배차 및 헌장 1.3 출고 승인 전 상태 비조작 준수율을 실시간 검증합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "process_agentic_dispatch_run",
        "title": "자연어 AI 배차 명령 및 원클릭 자동 배정",
        "description": "자연어로 운송 명령을 하달하고 최적 차량과 기사를 AI 추천받아 배차를 완결합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"kpi-exchange-compliance\"]",
            "type": "highlight",
            "label": "배차 헌장 지표 확인",
            "description": "단일 EXCHANGE 발행 및 왕복할인 차감 여부를 확인합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "input[type=\"text\"], textarea",
            "type": "callout",
            "label": "자연어 배차 지시 입력",
            "description": "예: \"내일 아침 8시 화성 향남 현장 GS-1930 2대 5톤 셀프로더로 배차해줘\"",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "agentic_settlement_autopilot",
    "version": 10,
    "menuName": "에이전틱 월말 대사 정산 오토파일럿",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "개발/회계팀",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "수백 건의 운송료, 부품 매입, 렌탈 매출 데이터를 AI 정산 엔진이 1원 단위로 사전 대사하고 이상치/단가 위반을 자율 적발하는 무인 정산기",
    "scopeInfo": "전사 청구서 엑셀, 계약 원장 일할 단가, 운송사 세금계산서, 은행 계좌 거래 내역",
    "cognitiveSequence": [
      "1. 월말 정산 오토파일럿 대상 거래처 및 정산 연월 스코핑",
      "2. 통장 입금 내역  미수금 원장 자동 1:1 대사 실행 (인공지능 매칭율 98% 이상)",
      "3. 자산별 정밀 일할 매출 기여액 자동 집계 및 대차 교체 승계 검증 (헌장 4.1)",
      "4. 전자세금계산서 청구서 자동 팩킹 및 국세청 전송 큐 생성",
      "5. 운송료 및 부품 매입 채무 자동 대차대조 검증 (청구 = 확정 + 반려)",
      "6. 이상 차액 발생 건 사전 격리 및 회계 담당자 확인 큐 분기",
      "7. 월말 자율 정산 마감 확정 및 대차대조 감사 리포트 자동 생성"
    ],
    "auditResult": "월말 정산 소요 시간 90% 단축 및 휴먼 에러로 인한 오지급 0건 실현",
    "rulesCompliance": [
      "헌장 3.5 질문 4 [Audit Result]:  청구총액 = 🟢 확정액 +  반려액 | ️ 대차 차액 ₩0 엄격 확정",
      "헌장 4.1 [정밀 일할 집계]: 일할 계산 오차를 사전에 1원도 없이 전수 스캔"
    ],
    "precautions": [
      "단가 특약이 적용된 특수 계약의 경우 AI가 계약서 메모 조항을 참조했는지 교차 확인",
      "자동 승인 한도액(예: 건당 500만원 초과)은 사람의 최종 결재를 거치도록 안전장치 유지"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"agentic_settlement_autopilot-header\"]",
        "type": "stamp",
        "label": "에이전틱 정산오토파일럿 헤더",
        "description": "헌장 4.1 일할 매출 기여액 정산 오토파일럿 상태와 개요를 표시합니다.",
        "badgeColor": "#10b981",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"agentic_settlement_autopilot-scope\"]",
        "type": "stamp",
        "label": "정산 대상 및 기준 설정",
        "description": "대사를 수행할 정산 연월, 대상 거래처, 지급 기준을 설정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"agentic_settlement_autopilot-scope-month\"]",
        "type": "stamp",
        "label": "정산 연월 선택",
        "description": "정산하고자 하는 대상 연월을 정확히 선택합니다.",
        "badgeColor": "#6b7280",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"agentic_settlement_autopilot-pipeline-run\"]",
        "type": "stamp",
        "label": "정산오토파일럿 실행",
        "description": "에이전틱 AI가 입금 대사 및 일할 정산 대차대조 검증을 자동 수행합니다.",
        "badgeColor": "#8b5cf6",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"agentic_settlement_autopilot-status\"]",
        "type": "stamp",
        "label": "실행 상태 안내",
        "description": "정산 AI의 실행 진행 상황 및 완료 상태를 실시간 안내합니다.",
        "badgeColor": "#f59e0b",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"agentic_settlement_autopilot-inspection-grid\"]",
        "type": "stamp",
        "label": "대차대조 검증 그리드",
        "description": "계약자산별 1원 오차 없는 정밀 일할 매출 기여액 내역을 표시합니다.",
        "badgeColor": "#3b82f6",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"agentic_settlement_autopilot-terminal-summary\"]",
        "type": "stamp",
        "label": "정산 합계 및 대차 검증",
        "description": "청구총액, 확정액, 반려액 합계를 통한 대차대조 무결성을 판정합니다.",
        "badgeColor": "#10b981",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"agentic_settlement_autopilot-terminal-commit\"]",
        "type": "stamp",
        "label": "정산 확정 및 결과 반영",
        "description": "대차 검증이 완료된 월말 정산 내역을 최종 확정 처리합니다.",
        "badgeColor": "#ef4444",
        "positionHint": "top",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "agentic_asset_lifecycle",
    "version": 10,
    "menuName": "에이전틱 자산 라이프사이클 관제",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "개발/자산관리팀",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "개별 고소작업대별 누적 매출 기여도, 고장 빈도, 정비 비용, 잔존 장부가액을 실시간 추적하여 최적 매각/정비 타이밍을 제시하는 자산 AI 관제탑",
    "scopeInfo": "자산 마스터, 계약별 누적 매출 기여액(헌장 4.1), 정비비 투입 누계, 가동일수/유휴일수",
    "cognitiveSequence": [
      "1. 전사 고소작업대 자산 생애주기(취득  운용  정비  매각) 스코핑",
      "2. 장비별 가동 시간(Hour Meter) 및 정비 점수 기반 이상 징후 예지 보전 감지",
      "3. 출고 검수 승인 즉시 RENTED 전환 및 반납 시 정비 큐 자동 라우팅 (헌장 1.3)",
      "4. 렌탈료 누적 매출 기여액 대비 총 정비 비용 분석 (자산별 순수익성 산출)",
      "5. 노후/한계 자산 매각 및 폐기 권고 시점 자동 도출",
      "6. 대체 신규 장비 도입 사양 및 자산 투자 회수 기간 예측",
      "7. 자산 생애주기 건전성 리포트 확정 및 주기장 운용 최적화"
    ],
    "auditResult": "렌탈 자산 가동 수익성 극대화 및 노후 장비 적기 처분을 통한 손실 방지",
    "rulesCompliance": [
      "헌장 4.1 [자산별 매출 기여액 정밀 일할 집계]: 누적 매출 데이터를 100% 신뢰할 수 있는 기반 제공",
      "헌장 1.2 [렌탈 자산의 효과적인 운용]: 자산의 물리적 수명과 경제적 수명의 최적 교차점 도출"
    ],
    "precautions": [
      "단기 렌탈 위주 장비와 장기 렌탈 장비의 가동률 지표 해석 시 계절성 요인 감안",
      "매각 권고 장비라도 현장 수요가 높은 특수 규격인 경우 대체 장비 확보 선행 필수"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"agentic_asset_lifecycle-header\"]",
        "type": "stamp",
        "label": "자산 생애주기 에이전트 헤더",
        "description": "취득, 출고, 입고, 정비, 매각의 전 생애주기 에이전트 현황을 표시합니다.",
        "badgeColor": "#10b981",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"agentic_asset_lifecycle-scope\"]",
        "type": "stamp",
        "label": "자산 조회 스코프",
        "description": "생애주기 추적 대상 자산의 관리번호, 모델명, 소유구분을 설정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"agentic_asset_lifecycle-pipeline-filter\"]",
        "type": "stamp",
        "label": "생애주기 단계 필터",
        "description": "출고대기, 대여중, 주기장입고, 정비중 등 단계별 자산을 선별합니다.",
        "badgeColor": "#8b5cf6",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"agentic_asset_lifecycle-timeline\"]",
        "type": "stamp",
        "label": "자산 생애주기 타임라인",
        "description": "취득부터 현재까지 발생한 모든 입출고·정비 사건의 시계열 이력을 조회합니다.",
        "badgeColor": "#3b82f6",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"agentic_asset_lifecycle-exchange-trace\"]",
        "type": "stamp",
        "label": "대차 교체 연결 추적",
        "description": "헌장 4.2 준수: 전자산 회수 및 후장비 투입 1:1 연결 관계를 검증합니다.",
        "badgeColor": "#f59e0b",
        "positionHint": "top",
        "spotlight": true
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"agentic_asset_lifecycle-inspection-details\"]",
        "type": "stamp",
        "label": "입출고 검수 상세 내역",
        "description": "출고 PDI 및 입고 정비 점검표, 파손/오염 증빙 사진을 확인합니다.",
        "badgeColor": "#10b981",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"agentic_asset_lifecycle-maintenance-score\"]",
        "type": "stamp",
        "label": "자산 정비 감가 수치",
        "description": "가동시간, 정비점수, 안전검사 유효기간 등 자산 건전성 지표를 확인합니다.",
        "badgeColor": "#6b7280",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"agentic_asset_lifecycle-terminal-audit\"]",
        "type": "stamp",
        "label": "상태 전환 확정",
        "description": "출고 검수 승인 또는 입고 정비 완료 조치를 검증하여 자산 상태를 확정합니다.",
        "badgeColor": "#ef4444",
        "positionHint": "top",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "initial_db_upload",
    "version": 10,
    "menuName": "초기DB 업로드",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "시스템관리자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "신규 테넌트 구축 또는 과거 레거시 시스템 이관 시 고객, 장비, 자산 원장 엑셀 파일의 정합성을 검증하고 원자적(Atomic) 초기 적재",
    "scopeInfo": "엑셀 템플릿(고객사, 자산대장, 단가표), 데이터 유효성 검증 규칙, 테넌트 ID",
    "cognitiveSequence": [
      "1. 업로드 대상 마스터 탭(고객, 장비모델, 실물자산, 부품, 계약) 스코핑",
      "2. 전사 표준 엑셀 양식 템플릿 다운로드 및 컬럼 규격 확인",
      "3. 작성된 엑셀 파일 드래그 앤 드롭 업로드 및 실시간 파싱",
      "4. 엑셀 데이터 유효성 사전 검증 (중복 사업자번호, 필수 제원 누락 적발)",
      "5. 오류 행 인라인 수정 및 정상 데이터 임시 적재 테이블 매핑",
      "6. Supabase DB 일괄 트랜잭션 주입 (await db.awaitPendingWrites()) (헌장 5.2)",
      "7. 초기 데이터 적재 결과 검증 (총 건수, 성공 건수) 및 기준정보 확정"
    ],
    "subTabs": [
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
    "auditResult": "신규 테넌트의 오염 없는 청정 초기 데이터베이스 셋업 완료",
    "rulesCompliance": [
      "헌장 5.3 [로컬 DB 스키마 정합성 자가 검증]: 로컬 schema.sql 정의와 완벽 일치 검증",
      "헌장 5.2 [무음 실패 방지]: 실패 행 발생 시 즉시 상세 에러 모달 표출"
    ],
    "precautions": [
      "기존 데이터가 존재하는 운영 테넌트에 업로드 시 덮어쓰기 위험이 있으므로 사전 백업 필수",
      "사업자번호 및 자산번호의 중복 키 충돌 여부 사전 확인"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"initial_db_upload-header\"]",
        "type": "stamp",
        "label": "초기 DB 업로드 헤더",
        "description": "초기 DB 업로드의 목적 및 진행 상태를 표시합니다.",
        "badgeColor": "#2563eb",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"initial_db_upload-tabs\"]",
        "type": "stamp",
        "label": "주요 작업 탭",
        "description": "데이터 업로드, 정합성 검증, 백업, 초기화 등 작업 모드를 선택합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"initial_db_upload-excel-import\"]",
        "type": "stamp",
        "label": "초기 현황 엑셀 업로드",
        "description": "보유자산, 임대현황, 거래처 등 기초 데이터를 엑셀로 일괄 등록합니다.",
        "badgeColor": "#8b5cf6",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"initial_db_upload-hist-billing\"]",
        "type": "stamp",
        "label": "과거 미청구 청구서 생성",
        "description": "과거 데이터를 기반으로 이전 청구 이력을 일괄 산출하여 등록합니다.",
        "badgeColor": "#f59e0b",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"initial_db_upload-dispatch-import\"]",
        "type": "stamp",
        "label": "배차 이력 업로드",
        "description": "과거 출고 및 회수 배차 내역을 엑셀로 업로드하여 데이터베이스를 동기화합니다.",
        "badgeColor": "#3b82f6",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"initial_db_upload-band-import\"]",
        "type": "stamp",
        "label": "밴드 AS 이력 업로드",
        "description": "네이버 밴드 등에 기록된 AS 내역 텍스트를 파싱하여 정비 이력으로 변환 저장합니다.",
        "badgeColor": "#10b981",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"initial_db_upload-cleanup\"]",
        "type": "stamp",
        "label": "데이터 정합성 검증",
        "description": "업로드된 데이터 중 중복 및 오류 데이터를 식별하고 정제합니다.",
        "badgeColor": "#ef4444",
        "positionHint": "top",
        "spotlight": true
      },
      {
        "seq": 8,
        "selector": "[data-mid=\"initial_db_upload-backup\"]",
        "type": "stamp",
        "label": "전체 DB 백업",
        "description": "현재 구축된 전사 데이터베이스를 파일 또는 JSON 형태로 보존합니다.",
        "badgeColor": "#6b7280",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 9,
        "selector": "[data-mid=\"initial_db_upload-reset\"]",
        "type": "stamp",
        "label": "데이터 초기화",
        "description": "전체 데이터를 모두 삭제하고 초기 상태로 환원하는 관리 작업을 수행합니다.",
        "badgeColor": "#ef4444",
        "positionHint": "top",
        "spotlight": false
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"initial_db_upload-header\"]",
        "type": "highlight",
        "label": "초기 DB 적재 가이드",
        "description": "신규 테넌트 구축 및 레거시 데이터 이관 시 기준정보를 원자적으로 적재합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"initial_db_upload-tabs\"]",
        "type": "highlight",
        "label": "작업 모드 탭 바",
        "description": "엑셀 데이터 적재, 정제/중복 제거, 전체 백업, 테넌트 초기화 모드를 선택합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "initial_db_excel_ingest",
        "title": "기초 원장 엑셀 일괄 적재",
        "description": "고객, 장비, 자산 원장 엑셀 파일을 업로드하고 정합성을 검증하여 DB에 적재합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"initial_db_upload-tabs\"]",
            "type": "click_ripple",
            "label": "데이터 적재 탭 선택",
            "description": "상단 탭에서 [엑셀 데이터 적재 (INGEST)] 모드를 클릭합니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"initial_db_upload-excel-import\"]",
            "type": "highlight",
            "label": "엑셀 파일 선택 및 파싱",
            "description": "작성된 표준 양식 엑셀을 드래그 앤 드롭하여 유효성을 사전 검증합니다.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "google_config",
    "version": 10,
    "menuName": "구글 관리자 설정",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "시스템관리자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "Google Workspace, Drive, Cloud OCR API 및 OAuth 인증 키 환경설정 관리",
    "scopeInfo": "Google Client ID, Client Secret, 서비스 계정 JSON 키, Drive 공유 폴더 ID, OCR 엔드포인트",
    "cognitiveSequence": [
      "1. 구글 워크스페이스 서비스 계정(OAuth2) 인증 상태 스코핑",
      "2. 동기화 대상 루트 폴더 ID 및 하위 폴더(계약서, 세금계산서, 검수사진) 구조 지정",
      "3. 자동 미러링 주기 및 실시간 동기화 데몬 연결 상태 확인",
      "4. 파일 업로드 테스트 (테스트 PDF 드라이브 전송 및 공유 링크 발급 검증)",
      "5. 드라이브 용량 한도 및 네트워크 타임아웃 예외 처리 설정",
      "6. 로컬 백업 사본 보존 정책 및 동기화 실패 재시도 큐 점검",
      "7. 구글 드라이브 클라우드 백업 설정 저장 및 정상 가동 확정"
    ],
    "modalWorkflows": [
      {
        "modalName": "클라우드 파일 업로드/관리 팝업",
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
    "auditResult": "구글 클라우드 서비스와의 무장애 보안 연동 채널 확립",
    "rulesCompliance": [
      "헌장 5.8 [외부 의존성 물리적 작동 필수]: 가짜 성공 배제, 실제 Google API 응답 코드 검증",
      "헌장 1.2 [이벤트 기록]: API 연동 설정 변경 이력 감사 로그 보존"
    ],
    "precautions": [
      "서비스 계정 비공개 키가 소스코드에 하드코딩되지 않도록 환경변수/DB 보안 저장 필수",
      "Google Drive 스토리지 용량 한도 주기적 모니터링"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"google_config-header\"]",
        "type": "stamp",
        "label": "구글 및 클라우드 연동 헤더",
        "description": "클라우드 인프라 및 구글 계정 연동 화면의 상태를 안내합니다.",
        "badgeColor": "#10b981",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"google_config-auth\"]",
        "type": "stamp",
        "label": "구글 인증 계정 설정",
        "description": "시스템 알림 발송 및 드라이브 백업에 사용할 구글 인증 계정을 설정합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"google_config-storage\"]",
        "type": "stamp",
        "label": "Supabase 스토리지 버킷 설정",
        "description": "사진 및 검수 증빙 파일을 저장할 클라우드 스토리지 버킷 및 보안 정책을 관리합니다.",
        "badgeColor": "#8b5cf6",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"google_config-mode\"]",
        "type": "stamp",
        "label": "시스템 운영 모드 설정",
        "description": "테스트용 로컬 모드와 클라우드 원격 운영을 위한 실무 모드를 전환합니다.",
        "badgeColor": "#f59e0b",
        "positionHint": "top",
        "spotlight": true
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"google_config-r2\"]",
        "type": "stamp",
        "label": "Cloudflare R2 스토리지 설정",
        "description": "대용량 미디어 및 백업 데이터를 저장할 Cloudflare R2 버킷 정보를 설정합니다.",
        "badgeColor": "#3b82f6",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"google_config-folders\"]",
        "type": "stamp",
        "label": "구글 드라이브 폴더 매핑",
        "description": "계약서, 거래명세서 등 각종 문서를 백업할 구글 드라이브 전용 폴더 ID를 지정합니다.",
        "badgeColor": "#6b7280",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"google_config-save\"]",
        "type": "stamp",
        "label": "클라우드 환경설정 영구 저장",
        "description": "입력된 모든 클라우드 인프라 및 연동 설정을 DB에 영구 반영합니다.",
        "badgeColor": "#ef4444",
        "positionHint": "top",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "dev_uploader",
    "version": 9,
    "menuName": "[개발] DB 데이터 업로더",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "개발자 전용",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "개발 및 WTT 스트레스 테스트를 위한 고밀도 합성 시나리오 데이터 주입 및 데이터베이스 마이그레이션 도구",
    "scopeInfo": "테스트 배치 ID(test_batch_id), 테스트 계약/배차/자산 건수, 스트레스 주입 축(공간/물리/시간/비용/수량)",
    "cognitiveSequence": [
      "1. 데이터베이스 DDL 스키마 및 마이그레이션 모드 스코핑",
      "2. 로컬 스키마 정의(schema.sql)와 원격 Supabase 정합성 자가 검증 (헌장 5.3)",
      "3. 신규 컬럼 및 테이블 추가 DDL 스크립트 프리뷰",
      "4. RLS(Row Level Security) 정책 멱등성 DROP/CREATE DDL 생성",
      "5. 마이그레이션 안전성 검증 및 백업 스냅샷 확인",
      "6. DDL 실행 및 테이블 스키마 캐시 리프레시",
      "7. DB 스키마 동기화 완료 및 전사 시스템 Ready 상태 확정"
    ],
    "auditResult": "실환경 검증(RWTT)을 위한 날조 불가능한 물리적 테스트 레코드 생성 완료",
    "rulesCompliance": [
      "헌장 5.6 [날조 테스트 영구 금지]: 테스트 데이터 사후 DELETE 증거인멸 금지, test_batch_id로 영구 보존",
      "헌장 5.5 [도메인 관통 스트레스 테스트 WTT]: 5대 축 마찰 계수가 주입된 데이터 적재"
    ],
    "precautions": [
      "프로덕션(운영) 환경에서는 일반 사용자가 본 메뉴에 접근할 수 없도록 권한 엄격 격리",
      "테스트 데이터에는 반드시 [TEST] 또는 [모의] 접두사를 부여하여 실매출 집계 오인 방지"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"schema-mode-tabs\"], .schema-tabs",
        "type": "stamp",
        "label": "스키마 DDL 모드",
        "description": "테이블 정의, 인덱스 생성, RLS 보안 정책 모드를 스코핑합니다.",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"btn-validate-schema-ssot\"], button:contains(\"정합성 검증\")",
        "type": "click_ripple",
        "label": "SSOT 스키마 정합성 검증",
        "description": "로컬 schema.sql과 원격 DB 간 컬럼 누락 여부를 자동 대조합니다.",
        "badgeColor": "#059669",
        "positionHint": "bottom",
        "spotlight": true
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"ddl-editor-textarea\"], textarea.ddl-editor",
        "type": "highlight",
        "label": "DDL 스크립트 에디터",
        "description": "실행될 CREATE/ALTER TABLE DDL SQL 구문을 확인하고 편집합니다.",
        "badgeColor": "#7C3AED",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"btn-generate-rls-ddl\"], button:contains(\"RLS DDL 생성\")",
        "type": "stamp",
        "label": "RLS 멱등성 DDL 생성",
        "description": "DROP IF EXISTS를 선행하는 멱등성 보안 정책 DDL을 동적 생성합니다.",
        "badgeColor": "#D97706",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"safety-backup-checkbox\"], .safety-check",
        "type": "callout",
        "label": "안전 스냅샷 확인",
        "description": "스키마 수정 전 데이터 손실 방지를 위한 백업 스냅샷을 확인합니다.",
        "badgeColor": "#E53935",
        "positionHint": "top",
        "spotlight": false
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"btn-execute-ddl\"], button:contains(\"DDL 실행\")",
        "type": "click_ripple",
        "label": "원격 DDL 적용 실행",
        "description": "원격 Supabase DB에 DDL을 즉각 실행하여 스키마를 업데이트합니다.",
        "badgeColor": "#2563EB",
        "positionHint": "top",
        "spotlight": true
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"schema-ready-status\"], .ready-status",
        "type": "click_ripple",
        "label": "시스템 준비 완료 확정",
        "description": "스키마 캐시를 갱신하고 ERP 시스템 Ready 신호를 전사에 공표합니다.",
        "badgeColor": "#10B981",
        "positionHint": "bottom",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "official_mail",
    "version": 6,
    "menuName": "공식 메일 발송",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부 / 고객센터",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "회사 공식 계정 기반 고객사 대상 견적서, 회사소개서, 장비제원표, 계약서류 패키지 표준 발송 및 이력 추적",
    "scopeInfo": "고객사, 담당자 이메일, 현장명, 견적 템플릿(장비기종, 임대료, 운송비)",
    "cognitiveSequence": [
      "1. 좌측 패널에서 수신 대상 고객사, 현장 및 담당자 선택",
      "2. 발송 서식 템플릿(견적서/회사소개서/제원표) 선택",
      "3. 자동 완성된 메일 제목, 본문 및 첨부 파일 확인/편집",
      "4. 우하단 이메일 발송 버튼 클릭하여 공식 발신 완료"
    ],
    "auditResult": "고객사 수신 확인 및 발송 성공 로그 DB 보존",
    "rulesCompliance": [
      "헌장 1.4 [1단어 1뜻 SSOT]: 공식 발신 명칭 및 표준 서식 준수",
      "헌장 5.2 [무음 실패 방지]: 메일 발송 실패 시 오류 상세 표출"
    ],
    "precautions": [
      "대용량 첨부 파일(20MB 이상) 시 압축 파일 첨부 권장",
      "수신자 이메일 주소 오기입 시 반송 안내 확인"
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"mail-recipient-panel\"]",
        "type": "highlight",
        "label": "수신 대상 지정",
        "description": "고객사, 현장, 담당자 및 수신 이메일 주소를 선택합니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"mail-terminal-send\"]",
        "type": "click_ripple",
        "label": "공식 메일 발송",
        "description": "작성된 본문과 첨부 파일을 회사 공식 계정으로 전송합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "mail_template_select_send",
        "title": "표준 견적서 서식 선택 및 원클릭 발송",
        "description": "고객사 선택 후 임대 견적서 템플릿을 자동 생성하여 즉시 발송합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"mail-recipient-panel\"]",
            "type": "highlight",
            "label": "수신 거래처 지정",
            "description": "견적서를 수신할 고객사와 담당자를 선택합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"mail-terminal-send\"]",
            "type": "click_ripple",
            "label": "견적 메일 발송",
            "description": "[이메일 발송] 버튼을 눌러 공식 견적서를 전송합니다.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"mail-recipient-panel\"]",
        "type": "stamp",
        "label": "수신처 패널",
        "description": "거래처 및 현장 연락처 지정",
        "badgeColor": "#2563EB",
        "positionHint": "right",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"mail-terminal-send\"]",
        "type": "stamp",
        "label": "메일 발송",
        "description": "공식 계정 이메일 전송",
        "badgeColor": "#2563EB",
        "positionHint": "top",
        "spotlight": true
      }
    ]
  },
  {
    "menuId": "public_construction_permits",
    "version": 6,
    "menuName": "인허가 건축공정 조회",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부 / 전략기획팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "국토교통부 공공 인허가 건축 데이터와 도로망·CSI 안전 데이터를 결합하여 고소작업대 투입 적기(골든타임) 현장 사전 포섭 및 영업 리드 등록",
    "scopeInfo": "전국 17개 시도/시군구 인허가 공정 데이터, 도로폭(V-World), CSI 안전계획 의무 여부",
    "cognitiveSequence": [
      "1. 상단 필터 바에서 지역(시도/시군구) 및 공정 단계(마감·설비 골든타임) 선택",
      "2. 좌측 그리드에서 도로폭 및 예상 소요 대수 검토 후 대상 행 선택",
      "3. 우측 AI 역산 스튜디오에서 추천 장비 및 안전 서류 확인",
      "4. 우측 하단 [1클릭 영업 리드 및 현장 등록] 완결"
    ],
    "auditResult": "신규 고객사 및 현장 마스터 자동 등록 및 안전옵션 동기화",
    "rulesCompliance": [
      "헌장 3.5 [Gutenberg Z-패턴]: 필터 스코핑 -> 그리드 검증 -> 우측 Dossier -> 우하단 리드 등록 완결"
    ],
    "precautions": [
      "도로폭 4m 미만 현장은 대형 트럭 진입 불가하므로 소형 차량 배차 계획 수립 필수"
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"permits-inspection-grid\"]",
        "type": "highlight",
        "label": "인허가 건축공정 대장",
        "description": "전국 공공 건축 허가 및 착공 현황을 실시간 조망합니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"permits-dossier-panel\"]",
        "type": "highlight",
        "label": "인공지능 공정 역산 작업대",
        "description": "선택 현장의 고소작업대 적기 투입 시점 및 추천 기종을 분석합니다.",
        "positionHint": "left"
      }
    ],
    "processes": [
      {
        "processId": "permits_filter_inspect",
        "title": "고소작업대 골든타임(마감·설비) 현장 발굴 및 조망",
        "description": "공정 진척도 40~70% 구간의 고소작업대 대량 투입 현장을 필터링하여 선점합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"permits-inspection-grid\"]",
            "type": "highlight",
            "label": "건축 현장 선택",
            "description": "골든타임 표식이 붙은 A급 추천 현장을 클릭합니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"permits-dossier-panel\"]",
            "type": "highlight",
            "label": "장비 제원 분석",
            "description": "추천 장비 기종(GS-1930 등)과 필요 대수를 확인합니다.",
            "positionHint": "left"
          }
        ]
      }
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"permits-inspection-grid\"]",
        "type": "stamp",
        "label": "공정 그리드",
        "description": "인허가 건축 목록",
        "badgeColor": "#2563EB",
        "positionHint": "right",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"permits-dossier-panel\"]",
        "type": "stamp",
        "label": "역산 스튜디오",
        "description": "골든타임 추천 분석",
        "badgeColor": "#2563EB",
        "positionHint": "left",
        "spotlight": false
      }
    ]
  },
  {
    "menuId": "tenant_management",
    "version": 6,
    "menuName": "테넌트 관리",
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "최고관리자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "멀티 테넌트 SaaS 환경에서 고객사별 테넌트 라이프사이클(생성, 구독 만료, 권한 통제, 브랜드 커스텀, 온보딩)을 중앙 관제하고 원자적으로 관리",
    "scopeInfo": "테넌트 영문 코드, 표시 상호, 사업자번호, 구독 플랜, 만료일자",
    "cognitiveSequence": [
      "1. 테넌트 검색어(상호, 코드, 사업자번호) 및 구독 상태 스코핑",
      "2. 신규 테넌트 등록 또는 기존 테넌트 설정 진입",
      "3. 구독 플랜(TRIAL, BASIC, PRO, ENTERPRISE) 및 라이선스 만료일 확정",
      "4. 테넌트 마스터 저장 및 대상 테넌트 작업공간 즉시 전환 검증"
    ],
    "auditResult": "멀티 테넌트 완벽 격리 및 SaaS 구독 라이프사이클 무결성 확립",
    "rulesCompliance": [
      "헌장 5.3 [단일 진실의 원천(SSOT)]: 중앙 ebro-platform-core DB와 로컬 테넌트 원장 100% 일치"
    ],
    "precautions": [
      "테넌트 영문 코드는 DB 스키마 및 스토리지 경로의 고유 식별자이므로 생성 후 수정 불가"
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"tenant-scope-search\"]",
        "type": "callout",
        "label": "테넌트 검색 및 필터",
        "description": "상호명, 테넌트 코드, 사업자등록번호를 입력하여 관리 대상을 신속 검색합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"tenant-inspection-grid\"]",
        "type": "highlight",
        "label": "테넌트 마스터 대장",
        "description": "가동 상태, 구독 플랜, 만료일자, 대표자 및 브랜드 에셋을 한눈에 조망합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "tenant_register_workflow",
        "title": "신규 테넌트 생성 및 초기화",
        "description": "새로운 고객사 테넌트를 생성하고 구독 플랜과 기본 마스터 속성을 설정합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"tenant-pipeline-add\"]",
            "type": "click_ripple",
            "label": "테넌트 등록 버튼 클릭",
            "description": "우상단의 [테넌트 등록] 버튼을 클릭하여 설정 모달을 엽니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"tenant-inspection-grid\"]",
            "type": "highlight",
            "label": "등록 결과 확인",
            "description": "그리드 대장에서 신규 생성된 테넌트의 가동 상태와 구독 만료일을 확인합니다.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"tenant-scope-search\"]",
        "type": "stamp",
        "label": "테넌트 검색",
        "description": "상호, 코드, 사업자번호 검색",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"tenant-pipeline-add\"]",
        "type": "stamp",
        "label": "신규 등록",
        "description": "테넌트 등록 모달 호출",
        "badgeColor": "#1D4ED8",
        "positionHint": "bottom",
        "spotlight": false
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"tenant-inspection-grid\"]",
        "type": "stamp",
        "label": "테넌트 대장",
        "description": "테넌트 구독 및 상태 관리",
        "badgeColor": "#1D4ED8",
        "positionHint": "top",
        "spotlight": false
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
    basicGuide: manual.basicGuide || manual.annotations || [],
    processes: manual.processes || [],
    items: manual.annotations,
  };
}
