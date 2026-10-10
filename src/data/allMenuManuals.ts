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
    "version": 12,
    "menuName": "ERP 대시보드",
    "groupId": "grp_top",
    "groupName": "메인",
    "department": "전사 공통",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "로그인한 임직원의 직무에 특화된 실시간 당면 과제(ToDo 피드) 파악 및 가동/출고/정비/배차 자산 상태 모니터링",
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
        "modalName": "경영진 특별지시 모달 (DirectiveModal)",
        "triggerButton": "특별지시 등록 버튼",
        "keyFields": [
          "지시 대상 부서",
          "지시 내용",
          "마감 일시",
          "긴급도"
        ],
        "terminalAction": "특별지시 하달",
        "afterStateTransition": "대상 부서 임직원 ToDo 피드 긴급 과제 즉시 노출"
      },
      {
        "modalName": "계약서 패키지 번들 모달 (BundleModal)",
        "triggerButton": "패키지 재발송 버튼",
        "keyFields": [
          "계약서 번들 항목",
          "수신 이메일",
          "첨부 증빙"
        ],
        "terminalAction": "패키지 발송",
        "afterStateTransition": "고객사 계약서 패키지 전자 발송 완료"
      }
    ],
    "auditResult": "당일 미처리 당면 과제 0건 종결 및 전사 가동 현황 실시간 동기화 확정",
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
        "selector": "[data-mid=\"dashboard-header\"]",
        "label": "대시보드 헤더",
        "description": "로그인 사용자 직무 및 전사 가동 현황 요약",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dashboard-todo-feed\"]",
        "label": "당면 과제 피드",
        "description": "미처리 출고/배차/AS/결재 당면 과제 카드뉴스",
        "colorToken": "PURPLE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"dashboard-btn-refresh\"]",
        "label": "피드 새로고침",
        "description": "실시간 비즈니스 이벤트 즉시 갱신",
        "colorToken": "GREEN",
        "type": "CALLOUT"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dashboard-sales-feed\"]",
        "type": "highlight",
        "label": "영업 수주 할일 피드",
        "description": "[영업 수주 할일 피드] 화면 영역입니다. 영업팀에서 접수된 신규 수주 및 출고 의뢰 현황을 피드로 확인하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dashboard-dispatch-today\"]",
        "type": "highlight",
        "label": "당일 배차 현황",
        "description": "[당일 배차 현황] 화면 영역입니다. 당일 처리해야 할 상차/도착 배차 일정을 실시간으로 확인하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "ERP 대시보드의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"dashboard-sales-feed\"]",
            "type": "click_ripple",
            "label": "영업 수주 할일 피드",
            "description": "[영업 수주 할일 피드] UI 요소를 확인합니다. 영업팀에서 접수된 신규 수주 및 출고 의뢰 현황을 피드로 확인하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"dashboard-dispatch-today\"]",
            "type": "click_ripple",
            "label": "당일 배차 현황",
            "description": "[당일 배차 현황] UI 요소를 확인합니다. 당일 처리해야 할 상차/도착 배차 일정을 실시간으로 확인하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"dashboard-outbound-today\"]",
            "type": "click_ripple",
            "label": "출고 검수 완료",
            "description": "[출고 검수 완료] UI 요소를 확인합니다. 당일 주기장 출고 검수가 완료된 장비 목록을 확인하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"dashboard-bad-debt\"]",
            "type": "click_ripple",
            "label": "부실 채권 경보",
            "description": "[부실 채권 경보] UI 요소를 확인합니다. 미수금액 연체 기한을 초과한 부실 채권 거래처를 확인하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"dashboard-weather-status\"]",
            "type": "click_ripple",
            "label": "기상 환경 모니터",
            "description": "[기상 환경 모니터] UI 요소를 확인합니다. 주기장 및 현장의 강풍/강우 등 기상 상태를 실시간 확인하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"dashboard-stat-summary\"]",
            "type": "click_ripple",
            "label": "자산 가동 지표",
            "description": "[자산 가동 지표] UI 요소를 확인합니다. 임대가능, 대여중, 정비중 등 핵심 자산 가동 지표를 조회하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"dashboard-quick-actions\"]",
            "type": "click_ripple",
            "label": "업무 바로가기",
            "description": "[업무 바로가기] UI 요소에 값을 입력하거나 조작합니다. 직무별 전담 화면으로 즉시 이동하여 당일 업무를 시작하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 8,
            "selector": "[data-mid=\"dashboard-terminal-todo\"]",
            "type": "click_ripple",
            "label": "당면 과제 완결",
            "description": "[당면 과제 완결] UI 요소에 값을 입력하거나 조작합니다. ToDo 피드 숫자가 0이 될 때까지 당일 담당 업무를 완결하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "approvalInbox",
    "version": 12,
    "menuName": "내 결재함 (수신)",
    "groupId": "grp_approval",
    "groupName": "결재 센터",
    "department": "전사 관리자/임원",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "직무 권한 및 전결 규정에 따른 기안 전표 심사 및 승인/반려 결정",
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
        "tabName": "미결함",
        "purpose": "결재 심사 대기 전표 목록",
        "keyActions": [
          "전표 상세 검토",
          "승인",
          "반려"
        ]
      },
      {
        "tabId": "COMPLETED",
        "tabName": "완결함",
        "purpose": "승인 및 반려 완료 전표 이력",
        "keyActions": [
          "결재 이력 조회"
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "반려 사유 입력 모달",
        "triggerButton": "반려 버튼",
        "keyFields": [
          "반려 사유 (필수)"
        ],
        "terminalAction": "반려 확정",
        "afterStateTransition": "전표 상태 REJECTED 전이 및 기안자 반려 사유 통보"
      }
    ],
    "auditResult": "미결재 수신 전표 0건 마감 및 승인 확정 시 해당 원장 데이터 즉시 자동 반영",
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
        "selector": "[data-mid=\"approvalInboxMain\"]",
        "label": "결재함 메인",
        "description": "대기 중인 수신 결재 전표 목록",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"approvalInbox-header\"]",
        "label": "결재함 타이틀",
        "description": "결재 대기 건수 및 현재 접속자 권한 티어",
        "colorToken": "PURPLE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"approvalInbox-user-select\"]",
        "label": "결재자 전환",
        "description": "심사 권한자 전환 및 전결 직급 확인",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"approvalInbox-btn-approve\"]",
        "label": "결재 승인",
        "description": "전표 승인 및 원장 데이터 자동 반영",
        "colorToken": "GREEN",
        "type": "STAMP"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"approvalInbox-btn-reject\"]",
        "label": "결재 반려",
        "description": "반려 사유 입력 및 기안자 회송",
        "colorToken": "RED",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"approvalInbox-header\"]",
        "type": "highlight",
        "label": "결재함 헤더",
        "description": "[결재함 헤더] 화면 영역입니다. 대기 중인 전체 결재 건수를 확인하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"approvalInbox-refresh\"]",
        "type": "highlight",
        "label": "결재함 새로고침",
        "description": "[결재함 새로고침] 화면 영역입니다. 최신 결재 요청 목록을 다시 불러옵니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "내 결재함 (수신)의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"approvalInbox-header\"]",
            "type": "click_ripple",
            "label": "결재함 헤더",
            "description": "[결재함 헤더] UI 요소를 확인합니다. 대기 중인 전체 결재 건수를 확인하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"approvalInbox-refresh\"]",
            "type": "click_ripple",
            "label": "결재함 새로고침",
            "description": "[결재함 새로고침] UI 요소에 값을 입력하거나 조작합니다. 최신 결재 요청 목록을 다시 불러옵니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"approvalInbox-list-container\"]",
            "type": "click_ripple",
            "label": "결재 대기 목록",
            "description": "[결재 대기 목록] UI 요소에 값을 입력하거나 조작합니다. 승인이나 반려 처리가 필요한 결재 건들의 목록입니다.",
            "positionHint": "top"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"approvalInbox-card\"]",
            "type": "click_ripple",
            "label": "개별 결재 카드",
            "description": "[개별 결재 카드] UI 요소에 값을 입력하거나 조작합니다. 각 결재 요청 건의 상세 정보와 액션 버튼을 포함하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"approvalInbox-card-header\"]",
            "type": "click_ripple",
            "label": "결재 유형 및 티어",
            "description": "[결재 유형 및 티어] UI 요소에 값을 입력하거나 조작합니다. 결재 규칙, 합의/결재 여부 및 최소 필요 티어 정보를 표시하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"approvalInbox-card-summary\"]",
            "type": "click_ripple",
            "label": "대상 건 요약",
            "description": "[대상 건 요약] UI 요소를 확인합니다. 결재 요청의 대상 테이블 및 관련 요약 정보를 확인하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"approvalInbox-card-progress\"]",
            "type": "click_ripple",
            "label": "결재 진행 현황",
            "description": "[결재 진행 현황] UI 요소에 값을 입력하거나 조작합니다. 결재 프로세스의 전체 단계 및 현재 상태를 나타냅니다.",
            "positionHint": "top"
          },
          {
            "seq": 8,
            "selector": "[data-mid=\"approvalInbox-card-action\"]",
            "type": "click_ripple",
            "label": "승인 / 반려 처리",
            "description": "[승인 / 반려 처리] UI 요소에 값을 입력하거나 조작합니다. 해당 결재 건을 승인하거나 사유를 작성하여 반려하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "approvalRules",
    "version": 12,
    "menuName": "결재선 규칙 설정",
    "groupId": "grp_approval",
    "groupName": "결재 센터",
    "department": "경영지원/시스템관리",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "이벤트 유형별 결재 필요 직급(Tier), 합의선 지정 및 직무분리(SoD) 규칙 정의",
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
        "tabName": "규칙 설정",
        "purpose": "이벤트별 결재선 규칙 대장",
        "keyActions": [
          "신규 규칙 추가",
          "직급 요건 설정",
          "합의선 추가"
        ]
      },
      {
        "tabId": "TIERS",
        "tabName": "직급 관리",
        "purpose": "임직원 직급별 결재 권한 티어 매핑",
        "keyActions": [
          "티어 수정",
          "전결 상한액 설정"
        ]
      }
    ],
    "auditResult": "전결 규정 규칙 정합성 검증 완료 및 자기승인 방지 규칙 100% 활성화",
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
        "selector": "[data-mid=\"approvalRules-header\"]",
        "label": "결재 규칙 헤더",
        "description": "전사 전결 규정 및 직무분리(SoD) 규칙 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"input-event-name\"]",
        "label": "이벤트 명칭",
        "description": "결재 대상 비즈니스 이벤트 유형",
        "colorToken": "PURPLE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"select-tier\"]",
        "label": "필요 결재 티어",
        "description": "최종 승인 가능 직급 티어 요건",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"btn-expand-consensus\"]",
        "label": "합의선 설정",
        "description": "유관 부서 사전 합의 라인 추가",
        "colorToken": "BLUE",
        "type": "CALLOUT"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"btn-add-consensus\"]",
        "label": "합의 추가",
        "description": "합의선 부서 결합",
        "colorToken": "GREEN",
        "type": "STAMP"
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"chk-is-enabled\"]",
        "label": "규칙 활성화",
        "description": "결재선 규칙 사용 여부 체크",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"approvalRules-tabs\"]",
        "type": "highlight",
        "label": "메뉴 탭 전환",
        "description": "[메뉴 탭 전환] 화면 영역입니다. 결재선 규칙과 직급·직책 티어 설정 간 화면을 전환하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"approvalRules-sync\"]",
        "type": "highlight",
        "label": "표준 규칙 동기화",
        "description": "[표준 규칙 동기화] 화면 영역입니다. 시스템의 표준 결재 이벤트 목록을 조회하여 가져옵니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "결재선 규칙 설정의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"approvalRules-tabs\"]",
            "type": "click_ripple",
            "label": "메뉴 탭 전환",
            "description": "[메뉴 탭 전환] UI 요소에 값을 입력하거나 조작합니다. 결재선 규칙과 직급·직책 티어 설정 간 화면을 전환하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"approvalRules-sync\"]",
            "type": "click_ripple",
            "label": "표준 규칙 동기화",
            "description": "[표준 규칙 동기화] UI 요소를 확인합니다. 시스템의 표준 결재 이벤트 목록을 조회하여 가져옵니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"approvalRules-rules-grid\"]",
            "type": "click_ripple",
            "label": "결재선 규칙 목록",
            "description": "[결재선 규칙 목록] UI 요소에 값을 입력하거나 조작합니다. 이벤트별 전결 티어, 합의선 및 사용 여부를 설정하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"approvalRules-tier-simulator\"]",
            "type": "click_ripple",
            "label": "유효 티어 판정 시뮬레이터",
            "description": "[유효 티어 판정 시뮬레이터] UI 요소에 값을 입력하거나 조작합니다. 설정한 직책과 직급의 조합에 따른 최종 결재 권한 티어를 시뮬레이션하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"approvalRules-duty-config\"]",
            "type": "click_ripple",
            "label": "직책별 티어 관리",
            "description": "[직책별 티어 관리] UI 요소에 값을 입력하거나 조작합니다. 단위 조직 책임자의 직책 티어를 설정합니다. (직급보다 우선 적용됨",
            "positionHint": "top"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"approvalRules-position-config\"]",
            "type": "click_ripple",
            "label": "직급별 티어 관리",
            "description": "[직급별 티어 관리] UI 요소에 값을 입력하거나 조작합니다. 일반 사원 및 소규모 조직에 자동 적용될 직급 티어를 설정하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "결재 규칙 등록 모달 (AddModal)",
        "triggerButton": "신규 규칙 추가",
        "keyFields": [
          "이벤트 명칭",
          "대상 테이블",
          "필요 티어",
          "합의 부서"
        ],
        "terminalAction": "규칙 저장",
        "afterStateTransition": "결재선 엔진 신규 규칙 즉시 적용"
      }
    ]
  },
  {
    "menuId": "customer",
    "version": 12,
    "menuName": "고객 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid='customer-search-filter']",
        "type": "highlight",
        "label": "검색 및 필터 영역",
        "description": "[검색 및 필터 영역] 화면 영역입니다. 검색어, 거래 상태 또는 필수 서류 누락 여부로 고객사 목록을 필터링하는 기본 기능을 제공합니다."
      },
      {
        "seq": 2,
        "selector": "[data-mid='customer-list-panel']",
        "type": "highlight",
        "label": "고객사 목록",
        "description": "[고객사 목록] 화면 영역입니다. 등록된 고객사 목록을 표시하며, 클릭하여 상세 제원을 조회하는 기본 기능을 제공합니다.",
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
            "description": "[신규 고객 등록 버튼] UI 요소를 조작합니다. 신규 고객 등록 버튼을 클릭하여 입력 팝업 창을 엽니다."
          },
          {
            "seq": 2,
            "selector": "[data-mid='input-customer-name']",
            "type": "callout",
            "label": "고객사명",
            "description": "[고객사명] UI 요소를 조작합니다. 등록할 신규 고객사의 공식 상호명을 입력하십시오."
          },
          {
            "seq": 3,
            "selector": "[data-mid='input-biz-no']",
            "type": "callout",
            "label": "사업자등록번호",
            "description": "[사업자등록번호] UI 요소를 조작합니다. 국세청 사업자등록번호 10자리를 입력하십시오."
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
            "description": "[고객사 선택] UI 요소를 조작합니다. 목록에서 고객사 행을 클릭하여 상세 정보를 화면에 불러옵니다."
          },
          {
            "seq": 2,
            "selector": "[data-mid='customer-detail-dossier']",
            "type": "highlight",
            "label": "고객사 상세 정보",
            "description": "[고객사 상세 정보] UI 요소를 조작합니다. 선택한 고객사의 상세 제원, 소속 현장 목록, 계약 이력을 정밀 검토하십시오.",
            "positionHint": "left"
          }
        ]
      },
      {
        "processId": "register_site_options_sync",
        "title": "현장 등록 및 옵션 속성 조회",
        "description": "고객사의 신규 현장을 등록하거나 수정할 때, 현장별 옵션관리에 등록된 현장 중 검색하여 유상/보양/사양 속성을 1클릭 복사하고 일치시킵니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid='btn-new-site'], button:contains('현장 추가')",
            "type": "click_ripple",
            "label": "현장 등록 버튼",
            "description": "[현장 등록 버튼] UI 요소를 조작합니다. 현장 추가 버튼을 클릭하여 현장 등록·수정 모달을 엽니다."
          },
          {
            "seq": 2,
            "selector": "[data-mid='site-option-ref-search-box']",
            "type": "callout",
            "label": "옵션 참조 현장 검색 및 복사",
            "description": "[옵션 참조 현장 검색 및 복사] UI 요소를 조작합니다. 초성 검색을 통해 현장별 옵션관리에 등록된 현장을 검색·선택한 뒤 [옵션 속성 복사] 버튼을 눌러 유상옵션, 보양작업, 요구사양을 즉시 일치시킵니다."
          },
          {
            "seq": 3,
            "selector": "button[type='submit']",
            "type": "click_ripple",
            "label": "현장 정보 저장",
            "description": "[현장 정보 저장] UI 요소에 값을 입력하거나 조작합니다. 복사 및 조정한 옵션 속성과 현장 기본 정보를 데이터베이스에 저장하십시오."
          }
        ]
      }
    ],
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "거래처 사업자등록번호 검증, 담당자 연락처 및 납품 현장 마스터 등록 관리",
    "scopeInfo": "사업자등록번호, 상호명, 대표자, 업태/종목, 전자세금계산서 발행 이메일, 현장 담당자 정보",
    "cognitiveSequence": [
      "1. 거래처 통합 검색 및 거래 상태/초성 필터링 (상호, 사업자번호, 대표자, 거래제한 여부)",
      "2. 고객 및 현장 운용 KPI 실시간 집계 검토 (총 고객사, 정상사, 거래제한/폐업, 현장수)",
      "3. 고객사 대장 목록 탐색 및 선택 (등록증 미등록 업체 및 결손 정보 즉시 파악)",
      "4. 선택 고객사 360도 마스터 상세 도시에 검토 (사업자정보, 대표연락처, 청구조건)",
      "5. 국세청 홈택스 사업자 휴폐업 전수 점검 및 여신 리스크 방어"
    ],
    "subTabs": [
      {
        "tabId": "CUST_LIST",
        "tabName": "고객 목록",
        "purpose": "등록 거래처 기본 정보 및 여신 한도 조회",
        "keyActions": [
          "거래처 등록",
          "홈택스 진위 검증",
          "여신 수정"
        ]
      },
      {
        "tabId": "SITE_LIST",
        "tabName": "현장 목록",
        "purpose": "고객사 소속 납품 현장 목록",
        "keyActions": [
          "현장 등록",
          "현장 이동"
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "거래처 등록/수정 모달 (CustModal)",
        "triggerButton": "신규 거래처 등록",
        "keyFields": [
          "상호명",
          "사업자등록번호",
          "대표자",
          "업태/종목",
          "주소",
          "여신한도"
        ],
        "terminalAction": "저장",
        "afterStateTransition": "고객사 마스터 생성 및 거래 상태 ALLOWED 설정"
      },
      {
        "modalName": "담당자 등록 모달 (ContactModal)",
        "triggerButton": "담당자 추가",
        "keyFields": [
          "성명",
          "부서/직급",
          "휴대전화",
          "이메일"
        ],
        "terminalAction": "담당자 저장",
        "afterStateTransition": "고객사 소속 담당자 연락망 1:N 추가"
      },
      {
        "modalName": "현장 등록 모달 (SiteModal)",
        "triggerButton": "현장 추가",
        "keyFields": [
          "현장명",
          "현장 주소",
          "현장 담당자",
          "도착지 특이사항"
        ],
        "terminalAction": "현장 저장",
        "afterStateTransition": "SiteMaster 연결 및 고객-현장 조인 링크(customer_sites) 결합"
      },
      {
        "modalName": "국세청 진위 확인 모달 (NtsAuditModal)",
        "triggerButton": "홈택스 검증",
        "keyFields": [
          "사업자번호",
          "대표자명",
          "개업일자"
        ],
        "terminalAction": "진위 확인 실행",
        "afterStateTransition": "국세청 휴폐업 상태(계속사업자) 검증 결과 반영"
      }
    ],
    "auditResult": "국세청 사업자 진위 확인 완료 및 N:M 정규화에 따른 고객-현장 관계 결합 확정",
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
        "selector": "[data-mid=\"customer-search-filter\"]",
        "label": "거래처 검색 필터",
        "description": "상호명, 사업자번호 통합 검색",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"customer-list-panel\"]",
        "label": "거래처 목록",
        "description": "등록 고객사 리스트 및 거래 상태",
        "colorToken": "PURPLE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"customer-detail-dossier\"]",
        "label": "고객사 상세 도시에",
        "description": "사업자 제원, 현장, 담당자 연락망 360도 조망",
        "colorToken": "BLUE",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"btn-new-customer\"]",
        "label": "거래처 등록",
        "description": "신규 고객사 마스터 생성",
        "colorToken": "GREEN",
        "type": "STAMP"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"btn-nts-audit\"]",
        "label": "국세청 검증",
        "description": "홈택스 실시간 사업자 휴폐업 진위 확인",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      }
    ]
  },
  {
    "menuId": "site_options",
    "version": 8,
    "menuName": "현장별 옵션 관리",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부 / 출고부",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "물리 현장별 가동 상태, 안전요구사양, 유상옵션 및 보양작업 기준 설정",
    "scopeInfo": "고객사 필터, 현장 검색어, 선택된 현장, 옵션품목마스터(StandardOption) 품목군(유상/보양/사양), 현장 특약단가, 필수 장착 여부, 현장 메모",
    "cognitiveSequence": [
      "1. 좌상단 고객사 필터 및 현장 검색창을 통해 대상 현장 스코핑",
      "2. 좌측 등록 현장 목록에서 옵션을 설정할 특정 현장 선택",
      "3. 우측 작업대 상단에서 대상 현장의 옵션 품목을 점검하고 표준 유상/보양/사양 항목 설정 진행",
      "4. 중앙 1. 유상 옵션 그리드에서 적용할 옵션 체크박스 활성화 및 현장 특약단가(₩) 오버라이드 입력",
      "5. 2. 보양 작업 카드에서 해당 현장 환경에 부합하는 보양 규격 1종 선택",
      "6. 3. 현장 요구 사양에서 안전인증, 경광등, 센서 연동 등 필수 점검 항목 체크",
      "7. 우하단 요약 바에서 적용 유상옵션 건수, 선택된 보양작업, 월 유상옵션 총액 합계 검증",
      "8. 우하단 [현장 옵션 설정 저장] 버튼을 클릭하여 CustomerSite DB에 100% 동기화 저장 완료"
    ],
    "auditResult": "SiteMaster 단일 진실의 원천(SSOT) 옵션 프로필 저장 및 역정규화 필드 0건 유지",
    "rulesCompliance": [
      "헌장 1.1: 임직원 최소 노력으로 마스터 옵션을 활용하여 현장 옵션값을 구축하며, 고객 관리 메뉴 현장 등록/수정 시 기등록 현장의 옵션 속성을 실시간 검색하여 1클릭 복사 일치시키는 최대 편익 달성",
      "헌장 2.2: 옵션품목마스터 기준단가 기반 현장별 옵션 속성 관리 및 계약/출고 자동 연동 원칙 준수",
      "헌장 3.1: 감성적 수식어 배제 및 건조한 명사·동사 UI 단일 표준 준수",
      "헌장 3.2: 테이블 셀 white-space: nowrap 적용으로 줄바꿈 방지",
      "헌장 3.5: 좌측 현장 스코프 ➔ 우측 작업대 ➔ 우하단 월 옵션 총액 및 최종 저장 4단계 Gutenberg Z-패턴 동선 확립"
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
        "label": "현장 검색 필터",
        "description": "고객사 및 물리 현장 검색",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"panel-site-scope\"]",
        "label": "현장 스코프",
        "description": "SiteMaster 물리 현장 선택 패널",
        "colorToken": "PURPLE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"tab-toggle\"]",
        "label": "옵션 탭 전환",
        "description": "마스터 옵션 vs 현장별 옵션 탭 전환",
        "colorToken": "BLUE",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"table-paid-options\"]",
        "label": "유상 옵션 대장",
        "description": "현장별 유상 옵션 설정 그리드",
        "colorToken": "AMBER",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"card-protection-options\"]",
        "label": "보양 작업 설정",
        "description": "바퀴 보양 및 외관 보호 옵션",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"card-spec-options\"]",
        "label": "현장 요구 사양",
        "description": "현장 출입 필수 안전스펙 체크",
        "colorToken": "BLUE",
        "type": "CALLOUT"
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"btn-save-site-options\"]",
        "label": "현장 옵션 저장",
        "description": "SiteMaster 단일 진실의 원천 옵션 저장",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"panel-site-scope\"]",
        "type": "callout",
        "label": "현장 검색 및 선택",
        "description": "[현장 검색 및 선택] 화면 영역입니다. 옵션 단가를 설정할 대상 현장을 검색하고 선택하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"table-paid-options\"]",
        "type": "highlight",
        "label": "현장 안전옵션 매트릭스",
        "description": "[현장 안전옵션 매트릭스] 화면 영역입니다. 해당 현장의 유상옵션 및 법정 안전사양 단가를 실시간 조망하는 기본 기능을 제공합니다.",
        "positionHint": "top"
      }
    ],
    "processes": [
      {
        "processId": "process_site_master_options",
        "title": "옵션 품목 마스터 정렬 및 삭제",
        "description": "전사 기준 풀에 등록된 옵션 품목들을 헤더를 클릭하여 정렬하고, 불필요한 마스터 옵션은 수정 모달에서 삭제합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "th:contains('분류'), th:contains('옵션 품목명'), th:contains('기준단가'), th:contains('단위'), th:contains('설명'), th:contains('상태')",
            "type": "click_ripple",
            "label": "헤더 클릭 정렬",
            "description": "[헤더 클릭 정렬] UI 요소를 조작합니다. 테이블 헤더를 클릭하여 오름차순, 내림차순, 정렬 안 함 순으로 목록을 정렬하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "td button:contains('수정')",
            "type": "click_ripple",
            "label": "옵션 수정 버튼",
            "description": "[옵션 수정 버튼] UI 요소를 조작합니다. 수정할 옵션의 우측 수정 버튼을 클릭하여 수정 모달을 엽니다."
          },
          {
            "seq": 3,
            "selector": "button:contains('삭제')",
            "type": "highlight",
            "label": "옵션 마스터 삭제",
            "description": "[옵션 마스터 삭제] UI 요소에 값을 입력하거나 조작합니다. 수정 모달 하단의 삭제 버튼을 눌러 불필요한 옵션 마스터를 전사 풀에서 제거하십시오.",
            "positionHint": "top"
          }
        ]
      },
      {
        "processId": "process_site_options_sync",
        "title": "현장별 안전옵션 특약 설정 및 저장",
        "description": "현장 특성에 맞는 안전옵션을 지정하고 계약 및 배차 파이프라인으로 100% 자동 연동합니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"panel-site-scope\"]",
            "type": "callout",
            "label": "관리 대상 현장 선택",
            "description": "[관리 대상 현장 선택] UI 요소를 조작합니다. 좌측 현장 목록에서 옵션을 설정할 공사 현장을 선택하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"table-paid-options\"]",
            "type": "click_ripple",
            "label": "유상 옵션 항목 설정",
            "description": "[유상 옵션 항목 설정] UI 요소에 값을 입력하거나 조작합니다. 현장에 투입될 유상옵션 적용 여부와 특약단가를 설정하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"card-protection-options\"]",
            "type": "highlight",
            "label": "보양 작업 규격 선택",
            "description": "[보양 작업 규격 선택] UI 요소를 조작합니다. 현장 환경에 부합하는 보호 완충/함석 보양 규격을 선택하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"btn-save-site-options\"]",
            "type": "click_ripple",
            "label": "옵션 설정 확정 저장",
            "description": "[옵션 설정 확정 저장] UI 요소에 값을 입력하거나 조작합니다. 변경된 현장 안전옵션 구성을 DB에 영구 저장하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "subTabs": [
      {
        "tabId": "MASTER_OPTIONS",
        "tabName": "옵션 마스터",
        "purpose": "전사 표준 안전/유상 옵션 항목 관리",
        "keyActions": [
          "옵션 추가",
          "단가 설정"
        ]
      },
      {
        "tabId": "SITE_OPTIONS",
        "tabName": "현장별 옵션",
        "purpose": "물리 현장별 필수 적용 옵션 프로필 설정",
        "keyActions": [
          "현장 선택",
          "옵션 토글",
          "보양 작업 지정"
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "현장 마스터 수정 모달 (EditSiteMasterModal)",
        "triggerButton": "현장 정보 수정",
        "keyFields": [
          "현장명",
          "주소",
          "진입 제한 높이",
          "통제구역 여부"
        ],
        "terminalAction": "저장",
        "afterStateTransition": "SiteMaster 물리 속성 갱신 (전사 동기화)"
      },
      {
        "modalName": "옵션 마스터 등록 모달 (MasterModal)",
        "triggerButton": "신규 옵션 등록",
        "keyFields": [
          "옵션 코드",
          "옵션 명칭",
          "유무상 구분",
          "표준 장착비"
        ],
        "terminalAction": "저장",
        "afterStateTransition": "전사 공통 옵션 마스터 추가"
      }
    ]
  },
  {
    "menuId": "contract",
    "version": 12,
    "menuName": "계약 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "div[data-mid=\"contract-detailed-filters\"]",
        "type": "highlight",
        "label": "상세 검색 필터",
        "description": "[상세 검색 필터] 화면 영역입니다. 다양한 검색 조건을 활용해 고객사, 현장 등의 계약을 조회할 수 있습니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "div[data-mid=\"contract-table\"]",
        "type": "highlight",
        "label": "계약 목록 그리드",
        "description": "[계약 목록 그리드] 화면 영역입니다. 조회된 계약의 요약 정보를 확인하며, 행을 클릭해 상세 뷰로 진입할 수 있습니다.",
        "positionHint": "top"
      },
      {
        "seq": 3,
        "selector": "div[data-mid=\"contract-filter-panel\"] > div:nth-child(3)",
        "type": "highlight",
        "label": "상태별 퀵 필터",
        "description": "[상태별 퀵 필터] 화면 영역입니다. 진행, 만료 임박, 종결 등 상태 칩을 클릭해 조건에 맞는 계약을 빠르게 필터링하는 기본 기능을 제공합니다.",
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
            "description": "[신규 등록 탭 진입] UI 요소를 조작합니다. '신규 계약 등록' 버튼을 클릭하여 입력 폼을 엽니다."
          },
          {
            "seq": 2,
            "selector": "div[data-mid=\"create-contract-cust\"] select",
            "type": "callout",
            "label": "고객사 선택",
            "description": "[고객사 선택] UI 요소를 조작합니다. 계약을 체결할 고객사를 검색하고 선택하십시오."
          },
          {
            "seq": 3,
            "selector": "div[data-mid=\"create-contract-start-date\"] input",
            "type": "callout",
            "label": "계약 시작일 지정",
            "description": "[계약 시작일 지정] UI 요소를 조작합니다. 렌탈이 시작되는 계약 시작일을 입력하십시오."
          },
          {
            "seq": 4,
            "selector": "div[data-mid=\"create-contract-basket-picker\"] button.btn-primary",
            "type": "click_ripple",
            "label": "자산 바스켓 추가",
            "description": "[자산 바스켓 추가] UI 요소에 값을 입력하거나 조작합니다. 제품 모델과 렌탈료를 설정한 뒤 '+ 추가' 버튼을 눌러 바스켓에 담습니다."
          },
          {
            "seq": 5,
            "selector": "button[data-mid=\"create-contract-submit\"]",
            "type": "click_ripple",
            "label": "계약 등록 완료",
            "description": "[계약 등록 완료] UI 요소를 조작합니다. 모든 정보를 확인한 뒤 '계약 등록' 버튼을 클릭하여 완료하십시오."
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
            "description": "[계약 상세 진입] UI 요소를 조작합니다. 진행 중인 계약 목록에서 '상세 ' 버튼을 클릭하십시오."
          },
          {
            "seq": 2,
            "selector": "div[data-subview=\"contract_detail\"] > div.card:first-child button.btn-primary",
            "type": "click_ripple",
            "label": "기간 연장/단축 실행",
            "description": "[기간 연장/단축 실행] UI 요소를 조작합니다. 화면 상단의 '기간 연장/단축' 버튼을 클릭하여 모달을 엽니다."
          },
          {
            "seq": 3,
            "selector": "div[style*=\"z-index: 1000\"] form.card input[type=\"date\"]",
            "type": "callout",
            "label": "종료일 변경",
            "description": "[종료일 변경] UI 요소를 조작합니다. 새롭게 변경할 만료일(종료일)을 지정하십시오."
          },
          {
            "seq": 4,
            "selector": "div[style*=\"z-index: 1000\"] form.card button[type=\"submit\"]",
            "type": "click_ripple",
            "label": "변경 내용 저장",
            "description": "[변경 내용 저장] UI 요소를 조작합니다. 사유를 기재한 후 '저장' 버튼을 클릭해 반영하십시오."
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
            "description": "[계약 상세 진입] UI 요소를 조작합니다. 진행 중인 계약 목록에서 '상세 ' 버튼을 클릭하십시오."
          },
          {
            "seq": 2,
            "selector": "div[data-subview=\"contract_detail\"] > div:nth-child(3) > div:nth-child(2) > div:first-child button.btn-secondary",
            "type": "click_ripple",
            "label": "대차 의뢰 실행",
            "description": "[대차 의뢰 실행] UI 요소를 조작합니다. 체결 자산 목록 우측 상단의 '자산 교체/대차 의뢰' 버튼을 클릭하십시오."
          },
          {
            "seq": 3,
            "selector": "div[style*=\"z-index: 1000\"] form.card select:first-of-type",
            "type": "callout",
            "label": "회수 자산 선택",
            "description": "[회수 자산 선택] UI 요소를 조작합니다. 회수할 기존 자산 번호 혹은 모델을 선택하십시오."
          },
          {
            "seq": 4,
            "selector": "div[style*=\"z-index: 1000\"] form.card input[type=\"text\"]",
            "type": "callout",
            "label": "사유 입력",
            "description": "[사유 입력] UI 요소에 값을 입력하거나 조작합니다. 대차가 필요한 사유 및 현장 상황을 기재하십시오."
          },
          {
            "seq": 5,
            "selector": "div[style*=\"z-index: 1000\"] form.card button[type=\"submit\"]",
            "type": "click_ripple",
            "label": "대차 의뢰 완료",
            "description": "[대차 의뢰 완료] UI 요소를 조작합니다. '대차 의뢰 접수' 버튼을 클릭하여 출고와 회수 배차를 동시 발행하십시오."
          }
        ]
      }
    ],
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "렌탈 계약 체결, 기간 연장/단축, 단가 변경, 현장 이동 및 계약 승계 관리",
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
        "tabId": "ACTIVE",
        "tabName": "진행중 계약",
        "purpose": "현재 가동 중인 렌탈 계약 목록",
        "keyActions": [
          "계약 상세",
          "기간 연장",
          "단가 변경",
          "대차 교체"
        ]
      },
      {
        "tabId": "TERMINATED",
        "tabName": "종료 계약",
        "purpose": "회수 완료 및 마감된 계약 이력",
        "keyActions": [
          "계약서 열람",
          "정산 내역 검토"
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "단가 변경 모달 (FeeModal)",
        "triggerButton": "단가 변경",
        "keyFields": [
          "변경 월 임대료",
          "변경 일 임대료",
          "적용 시작일",
          "변경 사유"
        ],
        "terminalAction": "단가 확정",
        "afterStateTransition": "해당 일자 이후 일할 단가 승계 반영"
      },
      {
        "modalName": "기간 연장/단축 모달 (ExtendModal)",
        "triggerButton": "기간 변경",
        "keyFields": [
          "변경 계약 종료일",
          "변경 사유"
        ],
        "terminalAction": "기간 확정",
        "afterStateTransition": "계약 종료일 갱신 및 가동일수 재계산"
      },
      {
        "modalName": "대차 교체 의뢰 모달 (ExchangeModal)",
        "triggerButton": "대차 요청",
        "keyFields": [
          "회수 대상 자산",
          "대차 투입 모델",
          "교체 희망일",
          "교체 사유"
        ],
        "terminalAction": "대차 의뢰 발행",
        "afterStateTransition": "단일 EXCHANGE 배차 의뢰 발행 및 최초 계약 조건 100% 자동 상속"
      },
      {
        "modalName": "계약 승계 모달 (TransferModal)",
        "triggerButton": "계약 승계",
        "keyFields": [
          "승계 양수 고객사",
          "승계 일자",
          "미수금 인계 여부"
        ],
        "terminalAction": "승계 완료",
        "afterStateTransition": "기존 계약 마감 및 신규 고객사 승계 계약 자동 체결"
      }
    ],
    "auditResult": "계약별 총 청구액 = 자산별 누적 매출 기여액 합계 보존 및 계약 상태 일치",
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
        "selector": "[data-mid=\"contract-kpi-summary\"]",
        "label": "계약 KPI 요약",
        "description": "가동 계약수, 대여 자산수, 당월 청구 예정액",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"contract-filter-panel\"]",
        "label": "계약 조회 스코프",
        "description": "거래처, 현장, 영업담당자 다차원 필터",
        "colorToken": "PURPLE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"contract-search-bar\"]",
        "label": "계약 통합 검색",
        "description": "계약번호, 현장명 고속 검색",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"contract-table\"]",
        "label": "계약 대장 그리드",
        "description": "체결 계약 상세, 기간, 단가, 가동 자산 현황",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ]
  },
  {
    "menuId": "contract_create",
    "version": 12,
    "menuName": "신규 계약 등록",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "고객사 및 현장 선택, 렌탈 단가/마감일 조건 설정, 장비 바스켓 담기 및 계약서 생성",
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
    "auditResult": "계약서 번호 채번, 계약 자산 1:1 매핑 및 필수 청구 속성 100% 상속 등록",
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
        "selector": "[data-mid=\"create-contract-cust\"]",
        "label": "고객사 선택",
        "description": "계약 주체 고객사 지정",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"create-contract-site\"]",
        "label": "납품 현장 지정",
        "description": "물리 현장 SiteMaster 매핑",
        "colorToken": "PURPLE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"create-contract-start-date\"]",
        "label": "계약 개시일",
        "description": "임대 개시일 및 정산 마감일 설정",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"create-contract-basket-picker\"]",
        "label": "장비 바스켓",
        "description": "계약 투입 장비 모델 및 단가 추가",
        "colorToken": "BLUE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"create-contract-submit\"]",
        "label": "계약 체결 완료",
        "description": "계약서 전표 발행 및 원장 등록",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"create-contract-customer\"]",
        "type": "callout",
        "label": "계약 거래처 선택",
        "description": "[계약 거래처 선택] 화면 영역입니다. 임대 계약을 체결할 고객사를 검색하고 선택하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"create-contract-submit\"]",
        "type": "click_ripple",
        "label": "계약 체결 저장",
        "description": "[계약 체결 저장] 화면 영역입니다. 모든 계약 속성을 검증하고 신규 계약서를 확정 등록하는 기본 기능을 제공합니다.",
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
            "description": "[거래처 및 현장 지정] UI 요소를 조작합니다. 계약 대상 고객사와 장비가 반입될 건설 현장을 선택하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"create-contract-start-date\"]",
            "type": "callout",
            "label": "계약 시작일 설정",
            "description": "[계약 시작일 설정] UI 요소를 조작합니다. 장비 인도 및 과금이 공식 개시되는 기준일을 지정하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"create-contract-rate\"]",
            "type": "callout",
            "label": "월 렌탈료 단가 입력",
            "description": "[월 렌탈료 단가 입력] UI 요소를 조작합니다. 고소작업대 월 임대료 및 일할 계산 기준 단가를 입력하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"create-contract-submit\"]",
            "type": "click_ripple",
            "label": "계약서 최종 등록 완결",
            "description": "[계약서 최종 등록 완결] UI 요소에 값을 입력하거나 조작합니다. 등록 버튼을 눌러 계약서를 발행하고 출고 의뢰 대기 상태로 전이하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "subTabs": [
      {
        "tabId": "CREATE",
        "tabName": "계약서 작성",
        "purpose": "신규 렌탈 계약 정보 입력 폼",
        "keyActions": [
          "고객사 선택",
          "현장 지정",
          "장비 추가",
          "계약 체결"
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "장비 바스켓 모달 (BasketPickerModal)",
        "triggerButton": "장비 담기",
        "keyFields": [
          "제품 모델",
          "수량",
          "월 임대단가",
          "일 임대단가"
        ],
        "terminalAction": "바스켓 담기 완료",
        "afterStateTransition": "계약 체결 장비 목록 가산"
      }
    ]
  },
  {
    "menuId": "billing",
    "version": 12,
    "menuName": "청구 / 수납 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid='tab-billing-wizard']",
        "type": "callout",
        "label": "정산 마법사 탭",
        "description": "[정산 마법사 탭] 화면 영역입니다. 정산 대상 계약을 확인하고 청구서를 신규로 생성하는 기능 탭입니다."
      },
      {
        "seq": 2,
        "selector": "[data-mid='tab-billing-list']",
        "type": "callout",
        "label": "청구 대장 목록 탭",
        "description": "[청구 대장 목록 탭] 화면 영역입니다. 생성된 청구서를 조회하고 이메일 발송, 취소, 분할 등의 관리를 수행하는 탭입니다."
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
            "description": "[정산 마법사 탭 이동] UI 요소에 값을 입력하거나 조작합니다. 청구서를 생성하기 위해 미청구 정산 탭으로 이동하십시오."
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"wizard-period-scope\"] button:nth-child(2)",
            "type": "click_ripple",
            "label": "조회 기간 설정",
            "description": "[조회 기간 설정] UI 요소를 조작합니다. 마감일 기준 검색 기간에서 당월을 선택하십시오."
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"wizard-bulk-generate-btn\"]",
            "type": "click_ripple",
            "label": "일괄 청구 생성",
            "description": "[일괄 청구 생성] UI 요소에 값을 입력하거나 조작합니다. 외상미수금이 없는 일반 계약들을 대상으로 일괄 청구서를 생성하십시오."
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
            "description": "[청구 대장 목록 탭 이동] UI 요소를 확인합니다. 청구 내역을 확인하기 위해 청구 대장 탭으로 이동하십시오."
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"billing-mail-btn\"]:first-of-type",
            "type": "click_ripple",
            "label": "이메일 발송 버튼 클릭",
            "description": "[이메일 발송 버튼 클릭] UI 요소를 조작합니다. 목록에서 대상 청구건의 발송 버튼을 클릭하여 거래명세서를 전송하십시오."
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
            "description": "[청구 대장 목록 탭 이동] UI 요소에 값을 입력하거나 조작합니다. 청구 대장 탭으로 이동하십시오."
          },
          {
            "seq": 2,
            "selector": "[data-mid='billing-list-item']",
            "type": "click_ripple",
            "label": "청구서 선택",
            "description": "[청구서 선택] UI 요소를 조작합니다. 목록에서 취소 또는 분할할 청구서를 클릭하여 상세 내역을 엽니다."
          },
          {
            "seq": 3,
            "selector": "[data-mid='btn-rollback-billing']",
            "type": "callout",
            "label": "청구 취소 (롤백)",
            "description": "[청구 취소 (롤백)] UI 요소를 조작합니다. 이 버튼을 클릭하면 해당 청구서를 취소하고 최근 청구 정보를 직전 유효 상태로 되돌립니다."
          },
          {
            "seq": 4,
            "selector": "[data-mid='btn-split-billing']",
            "type": "callout",
            "label": "청구 분할",
            "description": "[청구 분할] UI 요소에 값을 입력하거나 조작합니다. 이 버튼을 통해 하나의 청구서를 금액 기준으로 두 개의 청구서로 나눌 수 있습니다."
          }
        ]
      }
    ],
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "월별 렌탈료 청구서 산출, 거래명세서 발행, 입금 수납 처리 및 미수금 정산",
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
        "purpose": "월별 거래명세서 및 청구서 목록",
        "keyActions": [
          "청구서 열람",
          "수납 등록",
          "명세서 이메일 발송",
          "세금계산서 발행"
        ]
      },
      {
        "tabId": "WIZARD",
        "tabName": "미청구 정산",
        "purpose": "미청구 가동 계약 자동 정산 마법사",
        "keyActions": [
          "정산 시작",
          "일괄 청구서 생성"
        ]
      },
      {
        "tabId": "INVOICE",
        "tabName": "통합 계산서",
        "purpose": "거래처별 복수 현장 통합 계산서 발행",
        "keyActions": [
          "합산 계산서 생성",
          "국세청 전송"
        ]
      },
      {
        "tabId": "WAIVER",
        "tabName": "면제/대손",
        "purpose": "청구액 면제 및 감면 내역 관리",
        "keyActions": [
          "면제 등록",
          "사유 검토"
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "수납 등록 모달 (PayModal)",
        "triggerButton": "수납 등록",
        "keyFields": [
          "수납 일자",
          "수납 금액",
          "입금 계좌",
          "수납 방식"
        ],
        "terminalAction": "수납 확정",
        "afterStateTransition": "청구서 수납 상태 PAID 전환 및 외상미수금 차감"
      },
      {
        "modalName": "명세서 이메일 발송 모달 (MailModal)",
        "triggerButton": "명세서 발송",
        "keyFields": [
          "수신 담당자 이메일",
          "참조 이메일",
          "명세서 PDF 첨부"
        ],
        "terminalAction": "이메일 전송",
        "afterStateTransition": "메일 발송 로그 기록 및 청구서 mailStatus SENT 전이"
      },
      {
        "modalName": "청구서 재생성 모달 (RegenerateModal)",
        "triggerButton": "청구 재생성",
        "keyFields": [
          "정산 시작일",
          "정산 종료일",
          "단가 재계산 옵션"
        ],
        "terminalAction": "재생성 실행",
        "afterStateTransition": "기존 미납 청구서 갱신 및 일할 계산 재반영"
      }
    ],
    "auditResult": "📄 청구총액 = 🟢 수납액 + 🟡 미수잔액 | ⚖️ 대차 차액 ₩0",
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
        "label": "정산 연월 스코프",
        "description": "청구 대상 연월 및 마감일 범위 설정",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"billing-customer-filter\"]",
        "label": "거래처 필터",
        "description": "청구 대상 고객사 선택",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"billing-search-action\"]",
        "label": "청구 대장 조회",
        "description": "조건별 거래명세서 및 청구서 조회",
        "colorToken": "BLUE",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"billing-list-table\"]",
        "label": "청구 대장 테이블",
        "description": "건별 청구액, 수납액, 미수잔액 대사",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"billing-export-btn\"]",
        "label": "엑셀 내보내기",
        "description": "청구 대장 엑셀 데이터 추출",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"billing-pay-btn\"]",
        "label": "수납 등록",
        "description": "입금 확인 및 수납 분개 처리",
        "colorToken": "GREEN",
        "type": "STAMP"
      },
      {
        "seq": 7,
        "selector": "[data-mid=\"billing-mail-btn\"]",
        "label": "명세서 이메일 발송",
        "description": "거래명세서 PDF 전자 발송",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      }
    ]
  },
  {
    "menuId": "billing_wizard",
    "version": 12,
    "menuName": "미청구 정산",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "전산 미반영 렌탈 가동 건 자동 탐지 및 소급 청구서 일괄 생성",
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
    "auditResult": "대상 기간 미청구 누락 계약 0건 확정 및 청구 대장 자동 이관",
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
        "label": "미청구 기간 설정",
        "description": "미청구 탐지 대상 정산 기간 지정",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"wizard-search-filter\"]",
        "label": "계약 스코핑",
        "description": "대상 고객사 및 현장 필터링",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"wizard-contract-card-list\"]",
        "label": "미청구 계약 목록",
        "description": "전산 미청구 렌탈 계약 카드 덱",
        "colorToken": "AMBER",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"wizard-calculator-container\"]",
        "label": "일할 계산 엔진",
        "description": "가동 일수 x 일할 단가 정밀 계산 검증",
        "colorToken": "BLUE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"wizard-bulk-generate-btn\"]",
        "label": "일괄 청구서 생성",
        "description": "탐지된 미청구 건 정규 청구서 일괄 발행",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"wizard-period-scope\"]",
        "type": "callout",
        "label": "정산 대상 월 선택",
        "description": "[정산 대상 월 선택] 화면 영역입니다. 과거 미청구 또는 당월 청구 대상 기간을 설정하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"wizard-contract-card-list\"]",
        "type": "highlight",
        "label": "미청구 계약 목록",
        "description": "[미청구 계약 목록] 화면 영역입니다. 청구서가 아직 발행되지 않은 가동 계약 건들을 조망하는 기본 기능을 제공합니다.",
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
            "description": "[정산 기간 선택] UI 요소를 조작합니다. 과거 정산 대상 월을 클릭하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"wizard-bulk-generate-btn\"]",
            "type": "click_ripple",
            "label": "일괄 청구서 생성",
            "description": "[일괄 청구서 생성] UI 요소에 값을 입력하거나 조작합니다. 모든 미청구 계약의 일할 계산 청구서를 일괄 생성하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "subTabs": [
      {
        "tabId": "WIZARD",
        "tabName": "정산 마법사",
        "purpose": "미청구 계약 스코핑 및 자동 계산",
        "keyActions": [
          "미청구 조회",
          "계산 검증",
          "일괄 청구 생성"
        ]
      }
    ]
  },
  {
    "menuId": "billing_invoice",
    "version": 12,
    "menuName": "청구서통합",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "복수 현장/계약 청구서 통합 거래명세서 합산 및 전자세금계산서 발행",
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
    "auditResult": "통합 청구 합계 = 개별 현장 명세서 합계 (차액 ₩0) 및 국세청 전송 승인",
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
        "selector": "[data-mid=\"billing-period-scope\"]",
        "label": "계산서 발행 연월",
        "description": "발행 대상 정산 월 선택",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"billing-customer-filter\"]",
        "label": "거래처 선택",
        "description": "통합 청구 대상 고객사 스코핑",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"billing-list-table\"]",
        "label": "명세서 합산 검증",
        "description": "복수 현장 명세서 공급가액 및 세액 대사",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"billing-export-btn\"]",
        "label": "전자세금계산서 발행",
        "description": "국세청 홈택스 표준 포맷 세금계산서 생성",
        "colorToken": "AMBER",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"invoice-period-ym\"]",
        "type": "callout",
        "label": "청구 연월 선택",
        "description": "[청구 연월 선택] 화면 영역입니다. 통합 인보이스를 발행할 기준 년월을 선택하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"invoice-unbilled-table\"]",
        "type": "highlight",
        "label": "미발행 거래명세 목록",
        "description": "[미발행 거래명세 목록] 화면 영역입니다. 고객사 및 현장별 미발행 청구 내역을 확인하는 기본 기능을 제공합니다.",
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
            "description": "[청구 연월 선택] UI 요소를 조작합니다. 발행할 청구 년월을 지정하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"invoice-batch-consolidate-btn\"]",
            "type": "click_ripple",
            "label": "통합 인보이스 생성",
            "description": "[통합 인보이스 생성] UI 요소에 값을 입력하거나 조작합니다. 현장별 청구 내역을 거래처 단위로 합산 발행하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "subTabs": [
      {
        "tabId": "INVOICE",
        "tabName": "통합 계산서",
        "purpose": "거래처별 청구 합산 및 계산서 발행",
        "keyActions": [
          "청구서 선택",
          "합산 검증",
          "전자세금계산서 발행"
        ]
      }
    ]
  },
  {
    "menuId": "billing_waiver",
    "version": 12,
    "menuName": "청구 면제 대장",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "영업 특약 및 대손 발생에 따른 청구 금액 면제 등록 및 사유 관리",
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
    "auditResult": "면제 승인액 = 원청구 차감액 일치 및 사유별 감사 증적 DB 보존",
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
        "label": "면제 조회 기간",
        "description": "청구 면제 대상 연월 범위 설정",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"waiver-category-filter\"]",
        "label": "면제 사유 분류",
        "description": "영업 특약, 현장 분쟁, 대손 등 분류 필터",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"waiver-list-table\"]",
        "label": "면제 승인 내역",
        "description": "건별 면제 승인액 및 차감 증적 대사",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"waiver-export-excel-btn\"]",
        "label": "면제 대장 내보내기",
        "description": "감사 보고용 면제 이력 엑셀 추출",
        "colorToken": "AMBER",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"waiver-period-scope\"]",
        "type": "callout",
        "label": "면제 조회 기간",
        "description": "[면제 조회 기간] 화면 영역입니다. 청구 면제 또는 감면 처리된 기간을 조회하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"waiver-list-table\"]",
        "type": "highlight",
        "label": "청구 면제 대장",
        "description": "[청구 면제 대장] 화면 영역입니다. 우천, 파업, 설비 고장 등으로 청구 면제 처리된 상세 내역을 실사하는 기본 기능을 제공합니다.",
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
            "description": "[면제 대상 확인] UI 요소를 확인합니다. 취소할 면제 건을 확인하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "subTabs": [
      {
        "tabId": "WAIVER",
        "tabName": "청구 면제 대장",
        "purpose": "면제 승인 내역 및 차감액 대사",
        "keyActions": [
          "면제 사유 조회",
          "면제 취소",
          "엑셀 내보내기"
        ]
      }
    ]
  },
  {
    "menuId": "receivable",
    "version": 11,
    "menuName": "외상미수금 대장",
    "basicGuide": [
      {
        "seq": 1,
        "selector": ".table-container",
        "type": "highlight",
        "label": "미수금 관리 그리드",
        "description": "[미수금 관리 그리드] 화면 영역입니다. 미청구 및 부분 청구 잔액을 포함한 모든 외상미수금 내역을 조회·관리하는 기본 기능을 제공합니다."
      },
      {
        "seq": 2,
        "selector": ".card:first-of-type",
        "type": "highlight",
        "label": "검색 및 필터 패널",
        "description": "[검색 및 필터 패널] 화면 영역입니다. 고객사, 비용 유형, 청구 상태, 기간 범위를 지정하여 미수금을 조회하는 기본 기능을 제공합니다."
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
            "description": "[신규 미수금 등록 버튼] UI 요소를 조작합니다. 등록 버튼을 클릭하여 외상미수금 입력 팝업 창을 엽니다."
          },
          {
            "seq": 2,
            "selector": "[data-mid='rec-modal-cost-type'] select",
            "type": "callout",
            "label": "비용 유형 선택",
            "description": "[비용 유형 선택] UI 요소를 조작합니다. 발생한 비용의 적합한 항목(수리비, 운송비, 자재비 등)을 선택하십시오."
          },
          {
            "seq": 3,
            "selector": "[data-mid='rec-modal-total-amount'] input",
            "type": "callout",
            "label": "청구 총액 입력",
            "description": "[청구 총액 입력] UI 요소를 조작합니다. 청구할 외상미수금 총액을 입력하십시오."
          },
          {
            "seq": 4,
            "selector": "[data-mid='rec-modal-submit-btn']",
            "type": "click_ripple",
            "label": "미수금 등록 확정",
            "description": "[미수금 등록 확정] UI 요소를 조작합니다. 등록 완료 버튼을 클릭하여 신규 미수금 채권을 DB에 저장하십시오."
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
            "description": "[단독 청구 선택] UI 요소를 조작합니다. 미결 미수금 행의 단독 청구 버튼을 클릭하십시오."
          },
          {
            "seq": 2,
            "selector": "body",
            "type": "callout",
            "label": "청구 사유 입력",
            "description": "[청구 사유 입력] UI 요소를 조작합니다. 입력 창에 단독 청구 사유를 기재하여 발행을 진행하십시오."
          }
        ]
      }
    ],
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "거래처별 외상매출금 잔액 추적, 수납 차감 및 입금 이력 관리",
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
        "tabId": "SUMMARY",
        "tabName": "업체별 잔액 요약",
        "purpose": "거래처별 총매출, 총입금, 현재 미수금 잔액",
        "keyActions": [
          "거래처 잔액 조회",
          "수기 수납 등록"
        ]
      },
      {
        "tabId": "LEDGER",
        "tabName": "미수 원장 상세",
        "purpose": "건별 매출 및 수납 차감 상세 내역",
        "keyActions": [
          "채권 이력 조회"
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "수기 수납 등록 모달 (AddModal)",
        "triggerButton": "수납 등록",
        "keyFields": [
          "수납 일자",
          "거래처",
          "수납 금액",
          "입금 방식",
          "메모"
        ],
        "terminalAction": "저장",
        "afterStateTransition": "외상매출금 차감 분개 생성 및 거래처 잔액 즉시 갱신"
      }
    ],
    "auditResult": "기말 미수금 = 기초 잔액 + 당기 매출 - 당기 회수액 | 대차 차액 ₩0",
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
        "selector": "[data-mid=\"rec-modal-occurred-date\"]",
        "label": "수납 발생 일자",
        "description": "입금 및 수납 처리 기준일",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"rec-modal-cust-select\"]",
        "label": "거래처 선택",
        "description": "채권 차감 대상 고객사 지정",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"rec-modal-total-amount\"]",
        "label": "수납 금액",
        "description": "외상매출금 차감 입금액",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"rec-modal-submit-btn\"]",
        "label": "수납 확정 저장",
        "description": "채권 잔액 갱신 및 분개 반영",
        "colorToken": "AMBER",
        "type": "STAMP"
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
        "description": "[고객사 선택] 화면 영역입니다. 출고를 진행할 대상 고객사를 선택하는 기본 기능을 제공합니다."
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dispatch4-block-equipments\"]",
        "type": "highlight",
        "label": "장비 매핑",
        "description": "[장비 매핑] 화면 영역입니다. 출고 요청된 모델 및 수량을 배차 주문에 매핑하는 기본 기능을 제공합니다."
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
            "description": "[고객사 검색 및 선택] UI 요소를 조작합니다. 출고 대상 고객사를 검색하여 선택하십시오."
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"dispatch4-model-chips\"]",
            "type": "callout",
            "label": "요청 장비 추가",
            "description": "[요청 장비 추가] UI 요소를 조작합니다. 출고할 고소작업대 모델을 선택하십시오."
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"dispatch4-block-site\"]",
            "type": "callout",
            "label": "현장 정보 및 일정 입력",
            "description": "[현장 정보 및 일정 입력] UI 요소를 조작합니다. 반입 현장 주소, 담당자 연락처 및 상하차 일정을 입력하십시오."
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"dispatch4-btn-submit\"]",
            "type": "click_ripple",
            "label": "출고 의뢰 접수",
            "description": "[출고 의뢰 접수] UI 요소를 조작합니다. 버튼을 클릭하여 출고 배차 의뢰를 최종 접수하십시오."
          }
        ]
      }
    ],
    "version": 11,
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "영업 계약 기반 출고 요구서 발행 및 현장 요구 사양 전달",
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
    "auditResult": "출고요청 전표 발행 완료 및 입출고 검수 대기열 자동 진입",
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
        "selector": "[data-mid=\"dispatch4-block-customer\"]",
        "label": "고객사 스코프",
        "description": "출고 의뢰 고객사 확인",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dispatch4-block-site\"]",
        "label": "현장 및 납품처",
        "description": "하차 현장 주소 및 담당자 연락처",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"dispatch4-block-equipments\"]",
        "label": "출고 요청 장비",
        "description": "요청 모델, 수량 및 안전 요구 옵션",
        "colorToken": "AMBER",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"dispatch4-block-schedule\"]",
        "label": "납품 일정",
        "description": "상차 일시 및 현장 도착 요구 시간",
        "colorToken": "BLUE",
        "type": "CALLOUT"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"dispatch4-btn-submit\"]",
        "label": "출고요청서 전표 발행",
        "description": "출고 요구서 확정 및 배차/검수 대기열 이관",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ]
  },
  {
    "menuId": "smart_return",
    "version": 12,
    "menuName": "회수 요청",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"smart_return-mode-tabs\"]",
        "type": "callout",
        "label": "모드 선택",
        "description": "[모드 선택] 화면 영역입니다. 영업 임대 계약 회수 또는 정비 수리완료 회수 모드를 선택하여 진행할 수 있습니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"smart_return-summary\"]",
        "type": "highlight",
        "label": "회수 현황 요약",
        "description": "[회수 현황 요약] 화면 영역입니다. 현재 대여중인 장비 및 만료 예정 계약 현황을 확인할 수 있습니다.",
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
            "description": "[계약 선택] UI 요소를 조작합니다. 목록에서 회수 대상 계약을 찾아 클릭하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"smart_return-asset-select\"]",
            "type": "highlight",
            "label": "자산 선택",
            "description": "[자산 선택] UI 요소를 조작합니다. 회수할 장비를 체크하여 선택하십시오.",
            "positionHint": "left"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"smart_return-schedule\"]",
            "type": "callout",
            "label": "회수 일정 입력",
            "description": "[회수 일정 입력] UI 요소를 조작합니다. 회수 예정일자 및 희망 시간을 지정하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"smart_return-submit-btn\"]",
            "type": "click_ripple",
            "label": "등록 확정",
            "description": "[등록 확정] UI 요소에 값을 입력하거나 조작합니다. 회수 의뢰 등록 확정 버튼을 눌러 작업을 완료하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "현장 가동 종료 장비 회수 의뢰 접수, 회수 일정 수립 및 회수 전표 발행",
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
    "auditResult": "계약 종료일 확정, 회수 배차 대기열 등록 및 자산 회수 대기 상태 전이",
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
        "label": "회수 요약 지표",
        "description": "회수 대기 장비 및 당일 회수 예정 건수",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"smart_return-search-filter\"]",
        "label": "회수 대상 계약 검색",
        "description": "고객사, 현장별 가동 장비 조회",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"smart_return-contract-list\"]",
        "label": "가동 계약 목록",
        "description": "현장 가동 중인 렌탈 계약 카드 덱",
        "colorToken": "AMBER",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"smart_return-asset-select\"]",
        "label": "회수 대상 자산 선택",
        "description": "현장 철수 대상 자산번호 체크",
        "colorToken": "BLUE",
        "type": "CALLOUT"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"smart_return-submit-btn\"]",
        "label": "회수 의뢰 전표 발행",
        "description": "회수 배차 요구서 발행 및 자산 상태 전이",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ]
  },
  {
    "menuId": "smart_as_request",
    "version": 12,
    "menuName": "AS 요청",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부 / 고객센터",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "렌탈 가동 중 장비 현장 고장 접수 및 긴급 수리 요구 전표 발행",
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
    "auditResult": "고장 증상 및 현장 위치 무누락 저장 및 정비 출동 대기열 배정 완료",
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
        "selector": "[data-mid=\"smart_as-header\"]",
        "label": "AS 요청 헤더",
        "description": "현장 긴급 고장 접수 및 출동 요청 창구",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"btn-new-ticket\"]",
        "label": "신규 접수 작성",
        "description": "고장 접수 폼 열기",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"smart_as-form\"]",
        "label": "고장 내역 입력",
        "description": "현장 위치, 장비번호, 고장 증상 및 긴급도",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"smart_as-form\"]",
        "type": "highlight",
        "label": "긴급 AS 접수 폼",
        "description": "[긴급 AS 접수 폼] 화면 영역입니다. 현장 장비 고장 접수 및 긴급 출동 의뢰를 작성하는 기본 기능을 제공합니다.",
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
            "description": "[고장 현장 및 증상 입력] UI 요소에 값을 입력하거나 조작합니다. 현장 위치, 장비 관리번호, 고장 증상 및 사진을 등록하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"btn-new-ticket\"], button[type=\"submit\"]",
            "type": "click_ripple",
            "label": "AS 접수 완료",
            "description": "[AS 접수 완료] UI 요소에 값을 입력하거나 조작합니다. 의뢰를 확정하고 정비 큐에 긴급 티켓을 발행하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "delinquency",
    "version": 11,
    "menuName": "미수 채권 연체 관리",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "장기 미수 거래처 연체 관리, 독촉장 발송, 출고 제한 및 채권 회수 조치",
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
        "modalName": "독촉장/최고장 발송 모달 (NoticeModal)",
        "triggerButton": "독촉장 발송",
        "keyFields": [
          "수신자",
          "연체 금액",
          "납부 기한",
          "법적 조치 예고문구"
        ],
        "terminalAction": "발송",
        "afterStateTransition": "독촉 이력 기록 및 최고장 발송 전표 생성"
      },
      {
        "modalName": "출고 차단 설정 모달 (BlockModal)",
        "triggerButton": "출고 차단",
        "keyFields": [
          "차단 사유",
          "차단 기간"
        ],
        "terminalAction": "차단 확정",
        "afterStateTransition": "고객사 transactionStatus BLOCKED 전이 (신규 출고 전면 제한)"
      }
    ],
    "auditResult": "연체 등급별 조치 이력 100% 기록 및 회수 계획 수립 완료",
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
        "selector": "[data-mid=\"delinquency-header\"]",
        "label": "연체 관리 헤더",
        "description": "장기 미수 채권 연체 관리 및 법적 조치",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"delinquency-scope-period\"]",
        "label": "연체 기간 스코프",
        "description": "30일, 60일, 90일 이상 연체 구간 필터",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"delinquency-inspection-grid\"]",
        "label": "연체 채권 대장",
        "description": "업체별 연체액, 최종 연락일 및 조치 현황",
        "colorToken": "RED",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"delinquency-scope-period\"]",
        "type": "callout",
        "label": "연체 위험도 필터",
        "description": "[연체 위험도 필터] 화면 영역입니다. 고위험, 지시방치, 30일/60일/90일 이상 연체 채권을 필터링하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"delinquency-inspection-grid\"]",
        "type": "highlight",
        "label": "연체 채권 관리 대장",
        "description": "[연체 채권 관리 대장] 화면 영역입니다. 거래처별 누적 연체액, 최종 약속일, 지시 현황을 1:1 대조 실사하는 기본 기능을 제공합니다.",
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
            "description": "[고위험 연체 스코핑] UI 요소를 조작합니다. 상단의 [고위험] 또는 [지시방치] 필터 버튼을 클릭하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"delinquency-inspection-grid\"]",
            "type": "highlight",
            "label": "대상 거래처 실사",
            "description": "[대상 거래처 실사] UI 요소에 값을 입력하거나 조작합니다. 연체 총액과 최종 독촉 이력을 검토하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "product",
    "version": 11,
    "menuName": "제품 관리",
    "groupId": "grp_product_asset",
    "groupName": "제품 / 자산관리",
    "department": "자산/품질관리팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "고소작업대 모델별 제원 마스터, 작업높이, 적재중량 및 R2 매뉴얼 관리",
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
    "auditResult": "모델별 기술 제원 무결성 확보 및 실물 자산 매핑 100% 연결",
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
        "selector": "[data-mid=\"product-header\"]",
        "label": "제품 모델 헤더",
        "description": "고소작업대 모델 마스터 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"product-btn-add\"]",
        "label": "모델 등록",
        "description": "신규 장비 모델 마스터 추가",
        "colorToken": "GREEN",
        "type": "STAMP"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"product-table\"]",
        "label": "모델 대장 그리드",
        "description": "작업높이, 적재중량, 보유대수, 매핑 현황",
        "colorToken": "AMBER",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"product-type-filter\"], .type-filter-bar",
        "type": "highlight",
        "label": "장비 기종 분류",
        "description": "[장비 기종 분류] 화면 영역입니다. 시저형, 굴절형, 직진형 등 장비 메커니즘별로 목록을 스코핑하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"product-model-input\"], .model-input-group",
        "type": "highlight",
        "label": "모델명 및 작업 높이",
        "description": "[모델명 및 작업 높이] 화면 영역입니다. 제조사와 모델명, 최대 플랫폼 작업 가능 높이(m)를 등록하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "제품 관리의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"product-type-filter\"], .type-filter-bar",
            "type": "click_ripple",
            "label": "장비 기종 분류",
            "description": "[장비 기종 분류] UI 요소에 값을 입력하거나 조작합니다. 시저형, 굴절형, 직진형 등 장비 메커니즘별로 목록을 스코핑하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"product-model-input\"], .model-input-group",
            "type": "click_ripple",
            "label": "모델명 및 작업 높이",
            "description": "[모델명 및 작업 높이] UI 요소에 값을 입력하거나 조작합니다. 제조사와 모델명, 최대 플랫폼 작업 가능 높이(m)를 등록하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"product-specs-card\"], .specs-card",
            "type": "click_ripple",
            "label": "적재 하중 및 자체 중량",
            "description": "[적재 하중 및 자체 중량] UI 요소에 값을 입력하거나 조작합니다. 정격 적재 하중(kg), 탑승 인원, 장비 자체 중량 제원을 검증하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"product-pricing-card\"], .pricing-card",
            "type": "click_ripple",
            "label": "표준 렌탈 단가표",
            "description": "[표준 렌탈 단가표] UI 요소를 조작합니다. 표준 월 렌탈 단가와 일할 계산 단가 기준을 입력하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"product-safety-cert\"], .safety-cert-box",
            "type": "click_ripple",
            "label": "법정 안전인증 기준",
            "description": "[법정 안전인증 기준] UI 요소에 값을 입력하거나 조작합니다. 안전보건공단 안전인증(KCs) 및 비파괴 검사 만료 주기를 설정하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"product-bom-mapping\"], .bom-box",
            "type": "click_ripple",
            "label": "소모품 부품목록 매핑",
            "description": "[소모품 부품목록 매핑] UI 요소에 값을 입력하거나 조작합니다. 해당 기종에 투입되는 정품 배터리 규격과 유압 부품을 연결하십시오.",
            "positionHint": "left"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"btn-save-product\"], button:contains(\"모델 저장\")",
            "type": "click_ripple",
            "label": "모델 마스터 확정",
            "description": "[모델 마스터 확정] UI 요소에 값을 입력하거나 조작합니다. 모델 제원을 최종 저장하고 실물 자산 취득 및 계약에 가용화하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "신규 모델 등록 모달 (AddModal)",
        "triggerButton": "모델 등록",
        "keyFields": [
          "제조사",
          "모델명",
          "피트(규격)",
          "작업높이",
          "적재중량",
          "동력원"
        ],
        "terminalAction": "저장",
        "afterStateTransition": "신규 제품 모델 마스터 생성"
      },
      {
        "modalName": "기술 제원 미리보기 모달 (SpecPreviewModal)",
        "triggerButton": "제원 보기",
        "keyFields": [
          "외형 치수",
          "등판 능력",
          "주행 속도",
          "허용 풍속"
        ],
        "terminalAction": "닫기",
        "afterStateTransition": "제원 조회 완료"
      }
    ]
  },
  {
    "menuId": "asset",
    "version": 12,
    "menuName": "자산 관리 (대장)",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"asset-filter-bar\"]",
        "type": "highlight",
        "label": "자산 검색 및 필터",
        "description": "[자산 검색 및 필터] 화면 영역입니다. 관리번호, 모델명 등의 키워드 검색과 소유구분, 장비 상태 등의 조건으로 자산을 필터링하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"btn-asset-search\"]",
        "type": "highlight",
        "label": "조회",
        "description": "[조회] 화면 영역입니다. 입력된 조건으로 자산을 조회하는 기본 기능을 제공합니다.",
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
            "description": "[자산 선택] UI 요소를 조작합니다. 목록에서 자산의 보기 버튼을 클릭하여 상세 명세서를 엽니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "div[style*=\"z-index: 1000\"] > div:nth-child(1) .btn-primary",
            "type": "click_ripple",
            "label": "수정 버튼 클릭",
            "description": "[수정 버튼 클릭] UI 요소를 조작합니다. 상세 창 상단의 수정 버튼을 클릭하여 편집 모드로 전환하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid='asset-edit-section']",
            "type": "highlight",
            "label": "자산 정보 수정",
            "description": "[자산 정보 수정] UI 요소를 조작합니다. 장비 물리 제원, 운용 현황 등의 정보를 수정한 후 저장 버튼을 클릭하여 반영하십시오.",
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
            "description": "[자산 선택] UI 요소를 조작합니다. 목록에서 자산의 보기 버튼을 클릭하여 상세 명세서를 엽니다.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid='asset-edit-section'] .btn-secondary",
            "type": "click_ripple",
            "label": "이력 엑셀 다운로드",
            "description": "[이력 엑셀 다운로드] UI 요소를 조작합니다. 정비 및 감사 이력 현황 항목의 이력 엑셀 버튼을 클릭하여 다운로드하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "groupId": "grp_product_asset",
    "groupName": "제품 / 자산관리",
    "department": "자산/주기장팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "회사 보유 자산 번호, 시리얼, 가동 상태, 위치 및 정비점수 추적 관리",
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
    "auditResult": "자산 상태(임대가능/출고대기/대여중/수리중) 현장 라이프사이클 100% 일치",
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
        "selector": "[data-mid=\"asset-kpi-summary\"]",
        "label": "자산 KPI 현황",
        "description": "총보유, 임대가능, 대여중, 수리중 수량",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"asset-filter-bar\"]",
        "label": "자산 검색 스코프",
        "description": "상태별, 모델별, 위치별 다차원 필터",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"btn-asset-search\"]",
        "label": "자산 조회",
        "description": "조건별 자산 목록 실시간 조회",
        "colorToken": "BLUE",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"asset-table-container\"]",
        "label": "자산 대장 테이블",
        "description": "호기번호, 시리얼, 현재 위치, 감가점수",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"btn-asset-export\"]",
        "label": "자산 원장 엑셀",
        "description": "전사 자산 대장 엑셀 다운로드",
        "colorToken": "AMBER",
        "type": "STAMP"
      }
    ],
    "subTabs": [
      {
        "tabId": "ALL",
        "tabName": "전체 자산",
        "purpose": "보유 자산 전체 목록",
        "keyActions": [
          "자산 검색",
          "상태 변경",
          "엑셀 다운로드"
        ]
      },
      {
        "tabId": "AVAILABLE",
        "tabName": "임대가능",
        "purpose": "주기장 대기 중 즉시 출고 가능 자산",
        "keyActions": [
          "출고 할당"
        ]
      },
      {
        "tabId": "RENTED",
        "tabName": "대여중",
        "purpose": "현장 가동 중 자산",
        "keyActions": [
          "현장 추적",
          "회수/교환 요청"
        ]
      },
      {
        "tabId": "REPAIRING",
        "tabName": "수리/정비중",
        "purpose": "주기장 입고 정비 진행 자산",
        "keyActions": [
          "정비 점검",
          "정비 완료 복원"
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "자산 상세 정보 모달 (AssetDetailModal)",
        "triggerButton": "상세보기",
        "keyFields": [
          "자산번호",
          "시리얼",
          "제조년월",
          "현재 위치",
          "누적 매출액",
          "정비 감가점수"
        ],
        "terminalAction": "저장",
        "afterStateTransition": "자산 마스터 속성 갱신"
      }
    ]
  },
  {
    "menuId": "acquisition_disposal",
    "version": 12,
    "menuName": "당사자산 취득 / 매각",
    "groupId": "grp_product_asset",
    "groupName": "제품 / 자산관리",
    "department": "자산/재무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "자산 취득 등록, 취득가액 계상, 매각 처리 및 자산 제각 마감",
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
        "tabName": "자산 취득",
        "purpose": "신규 구매 자산 입고 및 취득가액 등록",
        "keyActions": [
          "자산 취득 등록",
          "바코드 발행"
        ]
      },
      {
        "tabId": "DISPOSAL",
        "tabName": "자산 매각/제각",
        "purpose": "노후 자산 매각 및 폐기 손익 확정",
        "keyActions": [
          "매각 등록",
          "제각 처리"
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
    "auditResult": "자산 원장 취득/매각 금액 일치 및 장부가액 감가상각 원장 자동 연계",
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
        "selector": "[data-mid=\"acquisition-header\"]",
        "label": "취득/매각 헤더",
        "description": "당사 보유 자산 취득 및 매각 마감 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"acq-single-form-header\"]",
        "label": "취득 등록 폼",
        "description": "취득일자, 취득가액, 공급업체 입력",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"acq-single-form-header\"]",
        "type": "highlight",
        "label": "신규 자산 취득 정보 폼",
        "description": "[신규 자산 취득 정보 폼] 화면 영역입니다. 고소작업대 신규 도입 시 시리얼, 제조사, 취득가액, 감가상각 연수를 등록하는 기본 기능을 제공합니다.",
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
            "description": "[취득 정보 입력] UI 요소를 조작합니다. 장비 모델, 시리얼번호, 제조년월 및 매입처를 입력하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "button[type=\"submit\"], button.btn-primary",
            "type": "click_ripple",
            "label": "자산 등재 확정",
            "description": "[자산 등재 확정] UI 요소에 값을 입력하거나 조작합니다. 신규 자산번호를 발급받고 AVAILABLE(임대가능) 상태로 초기화하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "rent_asset",
    "version": 12,
    "menuName": "임차 장비 관리",
    "groupId": "grp_product_asset",
    "groupName": "제품 / 자산관리",
    "department": "자산/구매팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "외부 타사 렌탈 장비(전대) 도입 계약, 임차료 정산 및 원사 반납 관리",
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
        "tabId": "RENTING",
        "tabName": "임차 가동중",
        "purpose": "외부에서 빌려 현장에 투입한 전대 장비 목록",
        "keyActions": [
          "원사 정보 확인",
          "지급 요청",
          "반납 의뢰"
        ]
      },
      {
        "tabId": "RETURNED",
        "tabName": "반납 완료",
        "purpose": "원사에 직반납 종결된 임차 장비 이력",
        "keyActions": [
          "정산 내역 검토"
        ]
      }
    ],
    "auditResult": "임차료 원가 = 월별 매입 확정액 일치 및 전대 계약-자산 1:1 연결 보존",
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
        "label": "임차 장비 헤더",
        "description": "외부 타사 임차(전대) 장비 통합 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"stat-returned-assets\"]",
        "label": "임차 자산 현황",
        "description": "원사별 임차 가동 대수 및 반납 대수",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"stat-returned-assets\"]",
        "type": "highlight",
        "label": "타사 임차 장비 가동 현황",
        "description": "[타사 임차 장비 가동 현황] 화면 영역입니다. 외부 전대/임차 장비의 가동 대수 및 월 총 지출 임차료를 확인하는 기본 기능을 제공합니다.",
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
            "description": "[가동 및 반납 대수 확인] UI 요소를 확인합니다. 현장에 투입 중인 외부 임차 장비 목록을 조회하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "임차료 지급요청 모달 (PaymentRequestModal)",
        "triggerButton": "지급 요청",
        "keyFields": [
          "원사 공급업체",
          "임차 기간",
          "월 임차료",
          "지급 예정일"
        ],
        "terminalAction": "지급 요청 상신",
        "afterStateTransition": "매입 정산 대장 청구 항목 자동 이관"
      },
      {
        "modalName": "원사 반납 모달 (ReturnModal)",
        "triggerButton": "원사 반납",
        "keyFields": [
          "반납 일자",
          "반납 주기장",
          "운송비 부담 주체"
        ],
        "terminalAction": "반납 확정",
        "afterStateTransition": "임차 장비 상태 RETURNED 전이 및 가동 종료"
      }
    ]
  },
  {
    "menuId": "delivery",
    "version": 12,
    "menuName": "배차 / 운송 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "div[data-mid='dispatch-mode-tabs']",
        "type": "highlight",
        "label": "업무 탭 (배차/대사)",
        "description": "[업무 탭 (배차/대사)] 화면 영역입니다. '배차 관리'와 '운송료 대사' 탭을 전환하여 업무를 수행하는 기본 기능을 제공합니다."
      },
      {
        "seq": 2,
        "selector": "div[data-mid='dispatch-status-tabs']",
        "type": "highlight",
        "label": "배차 상태 필터",
        "description": "[배차 상태 필터] 화면 영역입니다. 배차 대기, 배차 완료, 이동 완료 등 상태별로 필터링할 수 있습니다."
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
            "description": "[배차 의뢰 접수] UI 요소를 조작합니다. 출고 또는 회수 요청 카드를 선택하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"driver-select-box\"], select",
            "type": "callout",
            "label": "운송 기사 지정",
            "description": "[운송 기사 지정] UI 요소를 조작합니다. 장비 제원(운송중량)에 적합한 카고/셀프로더 운송기사를 선택하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"btn-confirm-dispatch\"], button.btn-primary",
            "type": "click_ripple",
            "label": "배차 확정 및 배차지시서 전송",
            "description": "[배차 확정 및 배차지시서 전송] UI 요소에 값을 입력하거나 조작합니다. 기사에게 상하차지 주소 및 운송 지시를 모바일로 전송하십시오.",
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
            "description": "[교환 의뢰 확인] UI 요소에 값을 입력하거나 조작합니다. 대차 교체용 출고 장비와 회수 대상 장비의 1:1 체인을 검토하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"btn-confirm-dispatch\"], button.btn-primary",
            "type": "click_ripple",
            "label": "단일 왕복 배차 승인",
            "description": "[단일 왕복 배차 승인] UI 요소에 값을 입력하거나 조작합니다. 왕복 운송비 할인이 적용된 1건의 교환 배차를 최종 확정하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "groupId": "grp_logistics",
    "groupName": "배차 / 운송관리",
    "department": "배차/물류팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "출고/회수/교환 배차 수립, 운송사/기사 매칭 및 월말 운송료 대사 확정",
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
        "tabId": "REQUEST_EXECUTION",
        "tabName": "발행요청 처리 (기사배정)",
        "purpose": "출고/회수/교환 요청 건 검토 및 운송 기사 배정",
        "keyActions": [
          "기사 매칭",
          "운송비 책정",
          "카카오 알림톡 전송",
          "상차 승인"
        ]
      },
      {
        "tabId": "PERIOD_RECONCILIATION",
        "tabName": "월말정산 정리 (운송료 대사)",
        "purpose": "운송사 청구서 1:1 대사 및 차액 승인/반려",
        "keyActions": [
          "엑셀 업로드",
          "차액 승인",
          "통합 지급요청"
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "도착지 기상 및 작업환경 모달 (DestWeatherModal)",
        "triggerButton": "현장 날씨",
        "keyFields": [
          "현장 기온",
          "풍속",
          "강수 확률",
          "고소작업 안전수칙"
        ],
        "terminalAction": "확인 완료",
        "afterStateTransition": "배차 전표에 기상 확인 플래그 저장"
      },
      {
        "modalName": "운송료 단가 수정 모달 (CostEditModal)",
        "triggerButton": "운송비 수정",
        "keyFields": [
          "기존 운송비",
          "변경 운송비",
          "경유지 추가비",
          "할인율"
        ],
        "terminalAction": "운송비 확정",
        "afterStateTransition": "배차 전표 운송료 갱신 및 정산 원장 반영"
      },
      {
        "modalName": "카카오 알림톡/문자 발송 모달 (KakaoModal)",
        "triggerButton": "기사 배차 알림",
        "keyFields": [
          "운송 기사 휴대전화",
          "상차지",
          "하차지",
          "담당자 연락처",
          "배차 제원"
        ],
        "terminalAction": "알림톡 발송",
        "afterStateTransition": "카카오 비즈메시지 발송 로그 저장"
      }
    ],
    "auditResult": "단일 EXCHANGE 배차 1건 발행 원칙 준수 및 📄 청구운송료 = 🟢 확정액 + 🚫 반려액 | ⚖️ 대차 차액 ₩0",
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
        "selector": "[data-mid=\"dispatch-mode-tabs\"]",
        "label": "업무 아키타입 탭",
        "description": "요청 처리형(카드) vs 월말정산형(그리드)",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dispatch-date-filter\"]",
        "label": "배차 일자 스코프",
        "description": "배차 실행 및 대사 대상 기간 지정",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"dispatch-dossier-card\"]",
        "label": "배차 상세 도시에",
        "description": "상하차지, 제원, 기사 배정 및 알림톡 발송",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"btn-dispatch-export\"]",
        "label": "운송료 대사 엑셀",
        "description": "월말 정산 대사용 엑셀 데이터 추출",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"btn-new-dispatch\"]",
        "label": "수동 배차 등록",
        "description": "시차 출고 등 특수 예외 배차 등록",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ]
  },
  {
    "menuId": "transport_master",
    "version": 12,
    "menuName": "운송 거래처 관리",
    "groupId": "grp_logistics",
    "groupName": "배차 / 운송관리",
    "department": "배차/물류팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "운송사 기본 정보, 기사 연락처, 계좌번호 및 차량 톤수 등록 관리",
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
    "auditResult": "운송사 사업자등록번호 검증 완료 및 배차 운송 거래처 매핑 확정",
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
        "label": "운송처 헤더",
        "description": "운송 거래처 및 기사 마스터 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"stat-transport-company\"]",
        "label": "등록 운송사 현황",
        "description": "계약 운송사 목록 및 기본 배차 조건",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"stat-transport-company\"]",
        "type": "highlight",
        "label": "운송사 및 기사 현황",
        "description": "[운송사 및 기사 현황] 화면 영역입니다. 등록된 협력 운송사와 전속 운송 기사 등록 현황을 조망하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"transport-company-table\"], table",
        "type": "highlight",
        "label": "운송 협력사 원장",
        "description": "[운송 협력사 원장] 화면 영역입니다. 운송사별 사업자정보, 기본 운임 요율표, 정산 계좌를 관리하는 기본 기능을 제공합니다.",
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
            "description": "[운송사 선택] UI 요소를 조작합니다. 소속 운송 거래처를 지정하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "button.btn-primary",
            "type": "click_ripple",
            "label": "기사 등록 완료",
            "description": "[기사 등록 완료] UI 요소에 값을 입력하거나 조작합니다. 기사 연락처와 차량 등록증을 저장하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "subTabs": [
      {
        "tabId": "COMPANIES",
        "tabName": "운송사 관리",
        "purpose": "계약 운송사 목록 및 기본 계약 조건",
        "keyActions": [
          "운송사 등록",
          "계좌 관리"
        ]
      },
      {
        "tabId": "DRIVERS",
        "tabName": "기사 관리",
        "purpose": "소속 및 지입 운송 기사 연락처 및 차종",
        "keyActions": [
          "기사 등록",
          "차량 톤수 지정"
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "운송사 등록 모달 (CompanyModal)",
        "triggerButton": "운송사 등록",
        "keyFields": [
          "운송사 상호",
          "사업자번호",
          "대표자",
          "정산 계좌"
        ],
        "terminalAction": "저장",
        "afterStateTransition": "운송 거래처 마스터 생성"
      },
      {
        "modalName": "기사 등록 모달 (DriverModal)",
        "triggerButton": "기사 등록",
        "keyFields": [
          "기사 성명",
          "연락처",
          "차량 번호",
          "차량 톤수(5톤/11톤/트레일러)"
        ],
        "terminalAction": "저장",
        "afterStateTransition": "운송 기사 마스터 생성 및 배차 매칭 활성화"
      }
    ]
  },
  {
    "menuId": "daily_inout",
    "version": 8,
    "menuName": "일일 입출고 조회",
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "출고팀 / 주기장팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "당일 주기장 상하차, 출고 장비 및 입고 회수 장비 종합 현황 조망",
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
    "auditResult": "당일 계획 대수 = 실물 입출고 대수 일치 및 이동 로그 무누락 보존",
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
        "label": "조회 조건 패널",
        "description": "주기장별, 일자별 입출고 스코프",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"view-mode-toggle\"]",
        "label": "뷰 모드 전환",
        "description": "캘린더 달력 뷰 vs 대장 테이블 뷰 전환",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"calendar-grid-card\"]",
        "label": "입출고 캘린더",
        "description": "일자별 출고(빨강) 및 입고(파랑) 물동량",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"daily-detail-panel\"]",
        "label": "일일 상세 내역",
        "description": "선택 일자 상하차 장비 호기번호 및 기사",
        "colorToken": "AMBER",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"audit-summary-bar\"]",
        "label": "입출고 검증 바",
        "description": "계획 대비 실물 입출고 일치율 확정",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"filter-panel\"]",
        "type": "highlight",
        "label": "조회 조건 패널",
        "description": "[조회 조건 패널] 화면 영역입니다. 조회 연월 이동 및 입출구분, 진행상태, 모델 필터를 설정하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"view-mode-toggle\"]",
        "type": "highlight",
        "label": "보기 전환",
        "description": "[보기 전환] 화면 영역입니다. 캘린더 형태 보기와 고밀도 표 형태 보기 간 전환하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "일일 입출고 조회의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"filter-panel\"]",
            "type": "click_ripple",
            "label": "조회 조건 패널",
            "description": "[조회 조건 패널] UI 요소를 확인합니다. 조회 연월 이동 및 입출구분, 진행상태, 모델 필터를 설정하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"view-mode-toggle\"]",
            "type": "click_ripple",
            "label": "보기 전환",
            "description": "[보기 전환] UI 요소에 값을 입력하거나 조작합니다. 캘린더 형태 보기와 고밀도 표 형태 보기 간 전환하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"btn-export-excel\"]",
            "type": "click_ripple",
            "label": "엑셀 내보내기",
            "description": "[엑셀 내보내기] UI 요소를 확인합니다. 조회 조건에 부합하는 일일 입출고 대장을 엑셀 파일로 다운로드하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"calendar-grid-card\"]",
            "type": "click_ripple",
            "label": "월간 캘린더",
            "description": "[월간 캘린더] UI 요소를 확인합니다. 월간 7열 달력 상에서 일자별 입고/출고 칩과 순유동을 확인하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"chip-inbound\"]",
            "type": "click_ripple",
            "label": "입고 칩",
            "description": "[입고 칩] UI 요소를 확인합니다. 청색 계열 입고 칩에서 일일 입고 총수량 및 모델별 수량을 확인하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"chip-outbound\"]",
            "type": "click_ripple",
            "label": "출고 칩",
            "description": "[출고 칩] UI 요소를 확인합니다. 적색 계열 출고 칩에서 일일 출고 총수량 및 모델별 수량을 확인하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"daily-detail-panel\"]",
            "type": "click_ripple",
            "label": "일자 상세 내역",
            "description": "[일자 상세 내역] UI 요소를 조작합니다. 선택된 일자의 입고/출고 건별 거래처, 현장, 자산번호, 배차상태를 실사하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 8,
            "selector": "[data-mid=\"audit-summary-bar\"]",
            "type": "click_ripple",
            "label": "대차대조 집계 바",
            "description": "[대차대조 집계 바] UI 요소에 값을 입력하거나 조작합니다. 당월 총 입고, 총 출고 및 주기장 실물 순유동 대차 차액을 최종 검증하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "subTabs": [
      {
        "tabId": "CALENDAR",
        "tabName": "캘린더 뷰",
        "purpose": "날짜별 입출고 예정 및 실적 달력",
        "keyActions": [
          "일자별 조회"
        ]
      },
      {
        "tabId": "TABLE",
        "tabName": "대장 뷰",
        "purpose": "일일 입출고 상세 내역 테이블",
        "keyActions": [
          "엑셀 다운로드",
          "필터 조회"
        ]
      }
    ]
  },
  {
    "menuId": "asset_inout_history",
    "version": 12,
    "menuName": "자산 입출고",
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "주기장팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "회수 장비 입고 검수 등록, 상태 판정 및 입출고 이력 추적",
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
    "auditResult": "회수 장비 주기장 입고 완료 및 자산 상태 '입고점검/수리중' 자동 전이",
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
        "selector": "[data-mid=\"asset_history-header\"]",
        "label": "입출고 이력 헤더",
        "description": "자산 입고 검수 및 출고 이력 추적",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"stat-inout-returns\"]",
        "label": "회수 입고 현황",
        "description": "현장 철수 후 주기장 입고 완료 장비",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"stat-inout-returns\"]",
        "type": "highlight",
        "label": "입출고 통합 이력 지표",
        "description": "[입출고 통합 이력 지표] 화면 영역입니다. 전체 출고 및 반납 입고 누적 이력과 회수율을 조회하는 기본 기능을 제공합니다.",
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
            "description": "[입출고 이력 대장 조회] UI 요소를 확인합니다. 조회 조건별 출납 이력을 대조하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "dispatch_assign",
    "version": 12,
    "menuName": "장비 할당 / 매핑",
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "출고/자산관리팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "출고요청서에 대해 적합 모델의 임대가능 자산번호 물리적 1:1 매핑",
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
    "auditResult": "출고요청 장비 = 자산번호 매핑 100% 완료 및 자산 상태 '출고대기' 전이",
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
        "selector": "[data-mid=\"asset_assignment-header\"]",
        "label": "장비 매핑 헤더",
        "description": "출고요청서 대상 실물 자산번호 매핑",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dispatch-assign-root\"]",
        "label": "할당 작업대",
        "description": "적합 임대가능 자산 선택 및 출고대기 전이",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dispatch-assign-root\"]",
        "type": "highlight",
        "label": "출고 의뢰별 장비 할당 워크벤치",
        "description": "[출고 의뢰별 장비 할당 워크벤치] 화면 영역입니다. 계약된 규격에 부합하는 주기장 내 임대가능 장비 또는 외부 임차 장비를 1:1 매핑하는 기본 기능을 제공합니다.",
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
            "description": "[출고 의뢰 선택] UI 요소를 조작합니다. 할당 대기 중인 계약 건을 선택하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "outbound_inspections",
    "version": 12,
    "menuName": "출고 검수 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "div[data-mid='tab-pending']",
        "type": "highlight",
        "label": "접수 대기 상태",
        "description": "[접수 대기 상태] 화면 영역입니다. 아직 엔지니어가 검수를 시작하지 않은 대기 상태의 요청들입니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "div[data-mid='tab-in-progress']",
        "type": "highlight",
        "label": "검수 진행중 상태",
        "description": "[검수 진행중 상태] 화면 영역입니다. 접수되어 현재 점검 및 검수가 진행 중인 요청들입니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 3,
        "selector": "div[data-mid='outbound-queue-list']",
        "type": "callout",
        "label": "출고 요청 대기열",
        "description": "[출고 요청 대기열] 화면 영역입니다. 상차일자 및 고객사 기준으로 그룹화된 출고 검수 요청 목록입니다.",
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
            "description": "[의뢰 선택] UI 요소를 조작합니다. 검수 대기 중인 요청 카드를 클릭하여 우측에 상세 정보를 표시하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "div[data-mid='btn-accept-job']",
            "type": "click_ripple",
            "label": "작업 접수",
            "description": "[작업 접수] UI 요소를 조작합니다. '▶ 작업 접수 실행' 버튼을 클릭하여 검수를 시작하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "div[data-subview=\"outbound_inspections\"] > div:nth-child(3) > div:nth-child(2) button.btn-secondary",
            "type": "click_ripple",
            "label": "항목 일괄 확인",
            "description": "[항목 일괄 확인] UI 요소를 조작합니다. '전체 선택/해제' 버튼을 눌러 점검 항목을 일괄 체크합니다. (개별 체크도 가능",
            "positionHint": "left"
          },
          {
            "seq": 4,
            "selector": "div[data-subview=\"outbound_inspections\"] > div:nth-child(3) > div:nth-child(2) button.btn-primary",
            "type": "stamp",
            "label": "최종 출고 승인",
            "description": "[최종 출고 승인] UI 요소를 조작합니다. '[🟢 최종 출고 승인 마감]' 버튼을 클릭합니다. 자산 상태가 RENTED로 전환되는지 확인하십시오.",
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
            "description": "[의뢰 선택] UI 요소를 조작합니다. 검수 대기 또는 진행 중인 요청 카드를 클릭하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "div[data-subview=\"outbound_inspections\"] > div:nth-child(3) > div:nth-child(2) button.btn-primary + button",
            "type": "click_ripple",
            "label": "요청 반려 클릭",
            "description": "[요청 반려 클릭] UI 요소를 조작합니다. 하단의 ' 요청 반려' 버튼을 클릭하여 반려 사유 입력 창을 엽니다.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid='reject-reason-input']",
            "type": "callout",
            "label": "반려 사유 작성",
            "description": "[반려 사유 작성] UI 요소를 조작합니다. 타이어 마모, 배터리 불량 등 구체적인 출고 반려 사유를 입력하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 4,
            "selector": "[data-mid='switch-maintenance']",
            "type": "click_ripple",
            "label": "수리정비중 전환",
            "description": "[수리정비중 전환] UI 요소에 값을 입력하거나 조작합니다. 해당 장비를 긴급 수리 상태로 전환하려면 토글을 켭니다.",
            "positionHint": "left"
          },
          {
            "seq": 5,
            "selector": "[data-mid='btn-reject-confirm']",
            "type": "stamp",
            "label": "반려 처리 실행",
            "description": "[반려 처리 실행] UI 요소에 값을 입력하거나 조작합니다. '반려 처리 실행' 버튼을 눌러 반려를 확정하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "출고검수팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "출고 직전 안전장치/제원 검수 승인 및 자산 상태 대여중(RENTED) 최종 마감",
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
        "modalName": "검수 승인 취소 모달 (RollbackModal)",
        "triggerButton": "승인 취소 (롤백)",
        "keyFields": [
          "취소 사유",
          "롤백 후 자산 상태 지정"
        ],
        "terminalAction": "롤백 확정",
        "afterStateTransition": "자산 상태 대여중(RENTED)에서 출고대기로 복원"
      },
      {
        "modalName": "검수 반려 모달 (RejectModal)",
        "triggerButton": "검수 반려",
        "keyFields": [
          "반려 사유 (안전 결함 내용)",
          "정비 이관 여부"
        ],
        "terminalAction": "반려 확정",
        "afterStateTransition": "자산 상태 수리중(REPAIRING) 전이 및 재할당 요구"
      }
    ],
    "auditResult": "출고 검수 승인 마감 즉시 자산 상태 '대여중(RENTED)' 전이 완료 (헌장 1.3조)",
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
        "selector": "[data-mid=\"outbound_inspections-header\"]",
        "label": "출고 검수 헤더",
        "description": "출고 직전 안전장치/제원 검수 승인",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"btn-date-range\"]",
        "label": "검수 기간 선택",
        "description": "출고 예정일자 범위 필터",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"btn-print-receipt\"]",
        "label": "출고증 인쇄",
        "description": "현장 인도용 출고확인증 인쇄",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"btn-rollback-approval\"]",
        "label": "승인 취소 (롤백)",
        "description": "오출고 시 검수 취소 및 자산 상태 복원",
        "colorToken": "RED",
        "type": "STAMP"
      }
    ],
    "subTabs": [
      {
        "tabId": "PENDING",
        "tabName": "검수 대기",
        "purpose": "장비 할당 완료 후 출고 검수 대기 자산",
        "keyActions": [
          "체크리스트 점검",
          "검수 승인",
          "검수 반려"
        ]
      },
      {
        "tabId": "APPROVED",
        "tabName": "검수 승인 완료",
        "purpose": "검수 완료 후 출고된 자산 이력",
        "keyActions": [
          "출고증 인쇄",
          "승인 취소(롤백)"
        ]
      }
    ]
  },
  {
    "menuId": "consumable_stock",
    "version": 12,
    "menuName": "주기장 소모품 재고",
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "주기장/자재팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "주기장 보관 부품 및 소모품 수량 모니터링, 안전재고 관리 및 불출 통제",
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
        "modalName": "부품 마스터 등록 모달 (MasterModal)",
        "triggerButton": "품목 등록",
        "keyFields": [
          "부품 코드",
          "부품명",
          "규격",
          "적정 안전재고",
          "단가"
        ],
        "terminalAction": "저장",
        "afterStateTransition": "소모품 마스터 생성"
      },
      {
        "modalName": "재고 이동 모달 (TransferModal)",
        "triggerButton": "재고 이동",
        "keyFields": [
          "출고 창고",
          "입고 창고(차량)",
          "이동 수량"
        ],
        "terminalAction": "이동 확정",
        "afterStateTransition": "창고별 재고 수량 즉시 증감 반영"
      }
    ],
    "auditResult": "전산 재고 수량 = 실물 보관 수량 일치 및 안전재고 미달 품목 자동 식별",
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
        "selector": "[data-mid=\"consumable_stock-header\"]",
        "label": "소모품 재고 헤더",
        "description": "주기장 부품 및 소모품 수량 모니터링",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-hs-trigger=\"Register\"]",
        "label": "신규 품목 등록",
        "description": "신규 부품/소모품 마스터 등록",
        "colorToken": "GREEN",
        "type": "CALLOUT"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"consumable_stock-tab-nav\"]",
        "type": "highlight",
        "label": "재고 영역 전환",
        "description": "[재고 영역 전환] 화면 영역입니다. 주기장 창고 재고, 이동 정비차량 재고, 고품 관리, 실사 재고 탭을 전환하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"consumable_stock-kpi-stats\"]",
        "type": "highlight",
        "label": "소모품 현황 요약",
        "description": "[소모품 현황 요약] 화면 영역입니다. 관리 품목 수, 주기장 보유 수량, 평가액 지표를 확인하는 기본 기능을 제공합니다.",
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
            "description": "[주기장 재고 탭 선택] UI 요소를 조작합니다. 메인 창고 현재고 조회 화면을 선택하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"consumable_stock-inspection-grid\"]",
            "type": "highlight",
            "label": "재고 대장 확인",
            "description": "[재고 대장 확인] UI 요소를 확인합니다. 부품별 주기장 재고와 차량 재고 수량을 확인하고 정보를 관리하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "print_queue_monitor",
    "version": 12,
    "menuName": "프린트 큐 모니터",
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "주기장/출고팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "라벨 프린터 및 전표 인쇄 작업 대기열 모니터링 및 인쇄 실패 재발행",
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
    "auditResult": "대기 인쇄 작업 0건 처리 및 로컬 에이전트 인쇄 성공 확정",
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
        "selector": "[data-mid=\"print_queue-header\"]",
        "label": "프린트 모니터 헤더",
        "description": "라벨 프린터 및 전표 인쇄 대기열 감시",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"td-station-name\"]",
        "label": "프린터 스테이션",
        "description": "로컬 에이전트 인쇄 장치 연결 상태",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"print_queue_monitor-header\"]",
        "type": "highlight",
        "label": "프린트 큐 모니터",
        "description": "[프린트 큐 모니터] 화면 영역입니다. 프린트 큐 모니터 및 프린터 스테이션을 관리하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"print_queue_monitor-agent-status\"]",
        "type": "highlight",
        "label": "에이전트 상태",
        "description": "[에이전트 상태] 화면 영역입니다. 로컬 프린터 에이전트 연결 상태를 확인하고 재탐색하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "프린트 큐 모니터의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"print_queue_monitor-header\"]",
            "type": "click_ripple",
            "label": "프린트 큐 모니터",
            "description": "[프린트 큐 모니터] UI 요소에 값을 입력하거나 조작합니다. 프린트 큐 모니터 및 프린터 스테이션을 관리하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"print_queue_monitor-agent-status\"]",
            "type": "click_ripple",
            "label": "에이전트 상태",
            "description": "[에이전트 상태] UI 요소를 확인합니다. 로컬 프린터 에이전트 연결 상태를 확인하고 재탐색하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"print_queue_monitor-tabs\"]",
            "type": "click_ripple",
            "label": "탭 메뉴",
            "description": "[탭 메뉴] UI 요소에 값을 입력하거나 조작합니다. 프린터 스테이션 관리와 인쇄 대기 대장 탭을 전환하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"print_queue_monitor-station-list\"]",
            "type": "click_ripple",
            "label": "등록 프린터 목록",
            "description": "[등록 프린터 목록] UI 요소에 값을 입력하거나 조작합니다. 시스템에 등록된 프린터 스테이션 목록입니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"print_queue_monitor-station-form\"]",
            "type": "click_ripple",
            "label": "프린터 설정",
            "description": "[프린터 설정] UI 요소에 값을 입력하거나 조작합니다. 새 프린터를 등록하거나 기존 프린터 설정을 수정하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"print_queue_monitor-queue-filter\"]",
            "type": "click_ripple",
            "label": "큐 필터",
            "description": "[큐 필터] UI 요소에 값을 입력하거나 조작합니다. 상태, 문서, 스테이션별로 인쇄 대기열을 필터링하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"print_queue_monitor-queue-grid\"]",
            "type": "click_ripple",
            "label": "인쇄 대기 대장",
            "description": "[인쇄 대기 대장] UI 요소를 확인합니다. 인쇄 큐에 쌓인 문서들의 상태를 조회하고 관리하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "consumable_purchase",
    "version": 12,
    "menuName": "소모품 구매",
    "groupId": "grp_maintenance",
    "groupName": "정비 / 소모품관리",
    "department": "정비/자재팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "주기장 정비 부품 발주 등록, 입고 검수 및 매입 원장 반영",
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
    "auditResult": "발주 수량 = 입고 수량 일치 및 매입 채무 원장 자동 반영",
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
        "selector": "[data-mid=\"consumable_purchase-header\"]",
        "label": "부품 구매 헤더",
        "description": "정비 부품 발주 및 매입 원장 반영",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"consumable_purchase-scope\"]",
        "type": "highlight",
        "label": "조회 필터 바",
        "description": "[조회 필터 바] 화면 영역입니다. 상태(신청/승인/입고), 기간, 검색어로 구매 신청 목록을 필터링하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"consumable_purchase-inspection-grid\"]",
        "type": "highlight",
        "label": "구매 신청 대장",
        "description": "[구매 신청 대장] 화면 영역입니다. 신청된 소모품 내역, 단가, 승인 현황 및 입고 여부를 조회하는 기본 기능을 제공합니다.",
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
            "description": "[구매신청등록 탭 선택] UI 요소를 조작합니다. 상단의 구매신청등록 탭을 클릭하여 작성 폼을 활성화하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"consumable_purchase-inspection-form\"]",
            "type": "callout",
            "label": "품목 및 수량 입력",
            "description": "[품목 및 수량 입력] UI 요소에 값을 입력하거나 조작합니다. 품목명, 신청 수량, 예상 단가, 공급처를 기재하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"consumable_purchase-terminal-submit\"]",
            "type": "click_ripple",
            "label": "구매 신청서 제출",
            "description": "[구매 신청서 제출] UI 요소를 확인합니다. 총 예상 금액을 확인하고 구매 신청서를 최종 제출하십시오.",
            "positionHint": "left"
          }
        ]
      }
    ]
  },
  {
    "menuId": "consumable_inout",
    "version": 12,
    "menuName": "소모품 입출고",
    "groupId": "grp_maintenance",
    "groupName": "정비 / 소모품관리",
    "department": "주기장/자재팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "정비 투입 부품 불출 등록, 현장 지급 및 폐기/반품 수불 관리",
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
    "auditResult": "당기말 재고 = 기초 재고 + 입고 - 출고 | 수불 오차 0건",
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
        "selector": "[data-mid=\"consumable_inout-header\"]",
        "label": "부품 수불 헤더",
        "description": "정비 투입 부품 불출 및 재고 수불 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"consumable_inout-pipeline-inbound-tab\"]",
        "type": "highlight",
        "label": "소모품 입고 탭",
        "description": "[소모품 입고 탭] 화면 영역입니다. 구매 승인된 소모품의 실물 입고 검수 및 창고 입고를 처리하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"consumable_inout-pipeline-outbound-tab\"]",
        "type": "highlight",
        "label": "소모품 출고 탭",
        "description": "[소모품 출고 탭] 화면 영역입니다. 자산 정비 및 현장 AS용 부품을 출고 등록하는 기본 기능을 제공합니다.",
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
            "description": "[소모품 입고 선택] UI 요소에 값을 입력하거나 조작합니다. 입고 관리 화면을 활성화하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"consumable_inout-inspection-inbound-list\"]",
            "type": "highlight",
            "label": "입고 대상 선택",
            "description": "[입고 대상 선택] UI 요소를 조작합니다. 입고 대기 구매신청 목록에서 실물이 도착한 항목을 선택하십시오.",
            "positionHint": "right"
          }
        ]
      }
    ]
  },
  {
    "menuId": "field_as",
    "version": 12,
    "menuName": "현장 AS 관리",
    "groupId": "grp_maintenance",
    "groupName": "정비 / 소모품관리",
    "department": "AS정비팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "현장 긴급 수리 출동 지시, 기사 배정 및 수리 조치 결과 보고",
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
        "modalName": "현장 AS 접수 등록 모달 (CreateModal)",
        "triggerButton": "AS 접수 등록",
        "keyFields": [
          "현장",
          "계약 자산",
          "고장 증상",
          "긴급도",
          "출동 기사 배정"
        ],
        "terminalAction": "접수 완료",
        "afterStateTransition": "AS 티켓 상태 DISPATCHED 전이"
      }
    ],
    "auditResult": "접수 티켓 조치 완료 종결 및 정비 내역 DB 무누락 보존",
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
        "selector": "[data-mid=\"field_as-header\"]",
        "label": "현장 AS 헤더",
        "description": "현장 긴급 출동 지시 및 조치 결과 보고",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"field_as-table\"]",
        "label": "AS 접수 대장",
        "description": "티켓별 고장 증상, 담당 기사, 처리 상태",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"field_as-scope\"]",
        "type": "highlight",
        "label": "AS 탭 전환",
        "description": "[AS 탭 전환] 화면 영역입니다. 출동 스튜디오, 캘린더, 분석, 관리 대장 간 탭을 전환하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"field_as-filter\"]",
        "type": "highlight",
        "label": "AS 검색 필터",
        "description": "[AS 검색 필터] 화면 영역입니다. 기간, 진행 상태(접수대기/방문예정/재방문/완료)별로 필터링하는 기본 기능을 제공합니다.",
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
            "description": "[신규 AS 등록 버튼 클릭] UI 요소에 값을 입력하거나 조작합니다. 새로운 현장 AS 접수 모달을 엽니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "repair",
    "version": 12,
    "menuName": "주기장 정비 관리",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"repair-inspection-grid\"]",
        "type": "highlight",
        "label": "정비 대기 자산 큐",
        "description": "[정비 대기 자산 큐] 화면 영역입니다. 입고 결함, 출고 불량, 수리 중인 자산 목록을 우선순위에 따라 조회하고 선택할 수 있습니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"repair-studio-workbench\"]",
        "type": "highlight",
        "label": "정비 스튜디오 워크벤치",
        "description": "[정비 스튜디오 워크벤치] 화면 영역입니다. 선택한 자산에 대한 정비 조치 내역, 소모품 투입, 외주 위탁 등을 처리하는 작업 공간입니다.",
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
            "description": "[정비 대상 선택] UI 요소를 조작합니다. 좌측 목록에서 수리할 자산을 클릭하여 선택하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"repair-details-input\"], textarea",
            "type": "callout",
            "label": "정비 상세 내역 입력",
            "description": "[정비 상세 내역 입력] UI 요소에 값을 입력하거나 조작합니다. 점검 결과 및 수리 조치 사항, 교체된 부품 내역을 상세히 기재하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"repair-pipeline-add\"], button.btn-primary",
            "type": "click_ripple",
            "label": "정비 완료 확정",
            "description": "[정비 완료 확정] UI 요소에 값을 입력하거나 조작합니다. 작성된 정비 내역을 저장하고 해당 자산을 AVAILABLE(임대가능) 상태로 복원하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "groupId": "grp_maintenance",
    "groupName": "정비 / 소모품관리",
    "department": "정비팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "입고 장비 오작동 점검, 부품 투입, 세척/도색 및 임대가능 복원 판정",
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
        "tabId": "IN_PROGRESS",
        "tabName": "정비 진행중",
        "purpose": "주기장 수리/세척 진행 중인 자산",
        "keyActions": [
          "체크리스트 입력",
          "부품 불출",
          "정비 완료 승인"
        ]
      },
      {
        "tabId": "COMPLETED",
        "tabName": "정비 완료 이력",
        "purpose": "수리 완료 및 출고 대기 전환 이력",
        "keyActions": [
          "정비 일지 조회"
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
    "auditResult": "정비 완료 판정 즉시 감가 정비점수 0점 복원 및 자산 상태 '임대가능' 전이 (상태 보존)",
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
        "selector": "[data-mid=\"repair-header\"]",
        "label": "주기장 정비 헤더",
        "description": "입고 장비 점검, 부품 투입 및 임대 복원",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"repair-vendor-select\"]",
        "label": "정비 담당처 지정",
        "description": "자사 직영 정비 및 외부 전문 외주처 배정",
        "colorToken": "GREEN",
        "type": "CALLOUT"
      }
    ]
  },
  {
    "menuId": "inspection_checklist_manage",
    "version": 12,
    "menuName": "정비 항목 관리",
    "groupId": "grp_maintenance",
    "groupName": "정비 / 소모품관리",
    "department": "정비/품질관리팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "장비 유형별 정비 점검 체크리스트 표준 항목 및 감가 배점 관리",
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
        "tabName": "표준 항목",
        "purpose": "전사 공통 점검 항목 대장",
        "keyActions": [
          "항목 추가",
          "감가 배점 설정"
        ]
      },
      {
        "tabId": "ANALYTICS",
        "tabName": "고장 빈도 분석",
        "purpose": "부위별 다빈도 결함 통계",
        "keyActions": [
          "통계 조회"
        ]
      },
      {
        "tabId": "MANUALS",
        "tabName": "정비 지침서",
        "purpose": "항목별 표준 정비 절차서",
        "keyActions": [
          "지침서 열람"
        ]
      }
    ],
    "auditResult": "표준 정비 항목 마스터 일치 및 정비점수 산출 기준 무결성 확보",
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
        "selector": "[data-mid=\"inspection_checklist-header\"]",
        "label": "정비 항목 헤더",
        "description": "표준 점검 체크리스트 및 감가 배점 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"inspection_checklist_manage-scope\"]",
        "type": "highlight",
        "label": "탭 메뉴",
        "description": "[탭 메뉴] 화면 영역입니다. 점검 항목 마스터, 조직 역량 분석, 장비 매뉴얼 라이브러리 간 탭 전환을 수행하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"inspection_checklist_manage-terminal-audit\"]",
        "type": "highlight",
        "label": "정비 요약 통계",
        "description": "[정비 요약 통계] 화면 영역입니다. 관리 분류, 총 점검항목, 평균 배점, 부품연계율 통계를 표시하는 기본 기능을 제공합니다.",
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
            "description": "[신규 정비 항목 등록 버튼 클릭] UI 요소에 값을 입력하거나 조작합니다. 정비 항목 등록 팝업 모달을 호출하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "leave_application",
    "version": 12,
    "menuName": "연차신청",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid='leave-form']",
        "type": "callout",
        "label": "연차/반차 신청 폼",
        "description": "[연차/반차 신청 폼] 화면 영역입니다. 휴가 구분, 일자 및 사유를 입력하여 연차 또는 반차를 신청하는 영역입니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid='leave-history-table']",
        "type": "callout",
        "label": "신청 내역 리스트",
        "description": "[신청 내역 리스트] 화면 영역입니다. 과거 연차 및 반차 신청 내역과 사용 기간, 차감 일수를 확인할 수 있는 이력 테이블입니다.",
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
            "description": "[휴가 구분 선택] UI 요소를 조작합니다. 연차, 오전반차, 또는 오후반차 중 원하는 휴가 구분을 선택하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid='leave-date-input']",
            "type": "highlight",
            "label": "휴가 일자 입력",
            "description": "[휴가 일자 입력] UI 요소를 조작합니다. 휴가의 시작 일자와 종료 일자를 지정하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 3,
            "selector": "[data-mid='leave-reason-input']",
            "type": "highlight",
            "label": "사유 입력",
            "description": "[사유 입력] UI 요소를 조작합니다. 휴가를 신청하는 사유를 간략히 입력하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 4,
            "selector": "[data-mid='leave-submit-btn']",
            "type": "click_ripple",
            "label": "신청 버튼 클릭",
            "description": "[신청 버튼 클릭] UI 요소를 조작합니다. 입력한 정보를 바탕으로 휴가를 최종 신청하십시오.",
            "positionHint": "right"
          }
        ]
      }
    ],
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "전사 임직원",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "임직원 연차/반차 신청서 작성, 휴일 자동 제외 일수 산출 및 결재 상신",
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
    "auditResult": "주말·공휴일 제외 소정근로일수 정밀 차감 및 결재선 승인 상신",
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
        "selector": "[data-mid=\"leave_app-header\"]",
        "label": "연차신청 헤더",
        "description": "임직원 연차/반차 신청서 작성 및 상신",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"leave-form\"]",
        "label": "신청서 작성 폼",
        "description": "휴가 유형, 시작일, 종료일(공휴일 자동 제외)",
        "colorToken": "PURPLE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"leave-reason-input\"]",
        "label": "신청 사유 입력",
        "description": "연차 사유 기재",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"leave-history-table\"]",
        "label": "내 연차 신청 이력",
        "description": "기안 연차 승인/반려 상태 확인",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ]
  },
  {
    "menuId": "ot_management",
    "version": 12,
    "menuName": "OT 관리",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "인사/총무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "시간외 근무(연장/야간/휴일) 실적 등록, 승인 및 대체휴무/수당 정산",
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
    "auditResult": "OT 인정 시간 = 실근무 시간 검증 및 급여 대장 반영 확정",
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
        "selector": "[data-mid=\"ot-header\"]",
        "label": "OT 관리 헤더",
        "description": "시간외 근무 실적 등록 및 승인 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"ot_management-terminal-audit\"]",
        "type": "highlight",
        "label": "연장근무 현황 요약",
        "description": "[연장근무 현황 요약] 화면 영역입니다. 총 승인 시간, 당월 OT 시간 등 전체적인 현황을 요약하여 보여줍니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"ot_management-pipeline-add\"]",
        "type": "highlight",
        "label": "연장근무 등록",
        "description": "[연장근무 등록] 화면 영역입니다. 다중 인원 선택 및 일자, 시간을 지정하여 OT를 등록할 수 있습니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "OT 관리의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"ot_management-terminal-audit\"]",
            "type": "click_ripple",
            "label": "연장근무 현황 요약",
            "description": "[연장근무 현황 요약] UI 요소에 값을 입력하거나 조작합니다. 총 승인 시간, 당월 OT 시간 등 전체적인 현황을 요약하여 보여줍니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"ot_management-pipeline-add\"]",
            "type": "click_ripple",
            "label": "연장근무 등록",
            "description": "[연장근무 등록] UI 요소를 조작합니다. 다중 인원 선택 및 일자, 시간을 지정하여 OT를 등록할 수 있습니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"ot_management-inspection-grid\"]",
            "type": "click_ripple",
            "label": "연장근무 목록 조회",
            "description": "[연장근무 목록 조회] UI 요소를 확인합니다. 과거 및 현재 등록된 전체 OT 기록을 테이블 형태로 조회할 수 있습니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"ot_management-analytics-grid\"]",
            "type": "click_ripple",
            "label": "연장근무 캘린더 뷰",
            "description": "[연장근무 캘린더 뷰] UI 요소를 확인합니다. 월별 OT 내역을 캘린더 형태로 확인하고 일별 상세 조회에 접근하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "vehicle_log",
    "version": 12,
    "menuName": "차량 / 주유관리",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "총무/운행자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "업무용 차량 운행일지 기록, 주유비 정산 및 차량별 유지비 분석",
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
        "tabId": "OPERATION_LOG",
        "tabName": "운행 일지",
        "purpose": "일자별 차량 운행 거리 및 목적",
        "keyActions": [
          "운행 기록 등록"
        ]
      },
      {
        "tabId": "FUEL_LOG",
        "tabName": "주유 / 정비",
        "purpose": "주유 금액 및 영수증 증빙 내역",
        "keyActions": [
          "주유 등록",
          "영수증 첨부"
        ]
      },
      {
        "tabId": "FLEET_MASTER",
        "tabName": "차량 마스터",
        "purpose": "보유 차량 제원 및 보험 만기 관리",
        "keyActions": [
          "차량 등록"
        ]
      }
    ],
    "auditResult": "최종 주행거리 = 이전 거리 + 당일 주행거리 보존 및 주유 영수증 증빙 일치",
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
        "label": "차량 관리 헤더",
        "description": "업무용 차량 운행일지 및 주유비 정산",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"vehicle_log-table\"]",
        "label": "운행 일지 대장",
        "description": "일자별 주행거리, 목적지, 주유 영수증",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"vehicle_log-header\"]",
        "type": "highlight",
        "label": "차량 운용 현황 요약",
        "description": "[차량 운용 현황 요약] 화면 영역입니다. 보유 차량 수, 당월 총 주행거리, 총 주유비, 유류대 정산 현황을 모니터링하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"vehicle_log-export-nts\"]",
        "type": "highlight",
        "label": "국세청 양식 내보내기",
        "description": "[국세청 양식 내보내기] 화면 영역입니다. 국세청 업무용 승용차 운행기록부 법정 서식으로 엑셀을 즉시 내려받습니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "차량 / 주유관리의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"vehicle_log-header\"]",
            "type": "click_ripple",
            "label": "차량 운용 현황 요약",
            "description": "[차량 운용 현황 요약] UI 요소에 값을 입력하거나 조작합니다. 보유 차량 수, 당월 총 주행거리, 총 주유비, 유류대 정산 현황을 모니터링하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"vehicle_log-export-nts\"]",
            "type": "click_ripple",
            "label": "국세청 양식 내보내기",
            "description": "[국세청 양식 내보내기] UI 요소에 값을 입력하거나 조작합니다. 국세청 업무용 승용차 운행기록부 법정 서식으로 엑셀을 즉시 내려받습니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"vehicle_log-upload-excel\"]",
            "type": "click_ripple",
            "label": "주유 내역 엑셀 업로드",
            "description": "[주유 내역 엑셀 업로드] UI 요소에 값을 입력하거나 조작합니다. 법인카드 주유 전표 및 전자세금계산서 주유 데이터를 일괄 업로드하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"vehicle_log-export-fuel\"]",
            "type": "click_ripple",
            "label": "주유 대장 내보내기",
            "description": "[주유 대장 내보내기] UI 요소에 값을 입력하거나 조작합니다. 기간별 차량 주유 집계 및 정산 내역을 엑셀로 다운로드하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"vehicle_log-tab-fuel\"]",
            "type": "click_ripple",
            "label": "주유 정산 대장 탭",
            "description": "[주유 정산 대장 탭] UI 요소에 값을 입력하거나 조작합니다. 차량별 주유 일자, 주유량(L), 금액, 주유소를 1:1 대사하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"vehicle_log-tab-fleet\"]",
            "type": "click_ripple",
            "label": "차량 마스터 관리 탭",
            "description": "[차량 마스터 관리 탭] UI 요소에 값을 입력하거나 조작합니다. 회사 보유 차량 번호, 차종, 배정 임직원, 보험 만기일을 관리하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"vehicle_log-filter\"]",
            "type": "click_ripple",
            "label": "운행 기록 검색 조건",
            "description": "[운행 기록 검색 조건] UI 요소를 확인합니다. 조회 기간, 차량 번호, 운전자, 업무용/비업무용 구분별로 필터링하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 8,
            "selector": "[data-mid=\"vehicle_log-grid-fuel\"]",
            "type": "click_ripple",
            "label": "운행 및 주유 데이터 대장",
            "description": "[운행 및 주유 데이터 대장] UI 요소에 값을 입력하거나 조작합니다. 일자별 출발/도착지, 주행거리, 유류대 실지출 내역을 검토 및 수정하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "purchase_settlement",
    "version": 12,
    "menuName": "월말 매입 정산",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "재무/회계팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "부품/외주/장비 임차 매입 세금계산서 대사 및 거래처 지급 승인",
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
    "auditResult": "📄 매입청구액 = 🟢 확정지급액 + 🚫 반려액 | ⚖️ 대차 차액 ₩0",
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
        "selector": "[data-mid=\"purchase_settlement-header\"]",
        "label": "매입 정산 헤더",
        "description": "부품/외주/임차 매입 세금계산서 대사",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"purchase_settlement-pipeline-generate\"]",
        "label": "매입 확정 실행",
        "description": "대사 완료 건 지급 승인 및 전표 생성",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"purchase_settlement-pipeline-generate\"]",
        "type": "click_ripple",
        "label": "매입 정산 자동 집계",
        "description": "[매입 정산 자동 집계] 화면 영역입니다. 당월 발생한 부품 매입, 외주 정비, 운송비 지출을 자동 집계하는 기본 기능을 제공합니다.",
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
            "description": "[매입 정산 집계] UI 요소에 값을 입력하거나 조작합니다. 당월 매입 내역을 집계하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "subTabs": [
      {
        "tabId": "CONSUMABLES",
        "tabName": "소모품/부품 매입",
        "purpose": "부품 공급사 매입 정산",
        "keyActions": [
          "대사 검증",
          "지급 승인"
        ]
      },
      {
        "tabId": "RENTAL_LEASE",
        "tabName": "장비 임차(전대)료",
        "purpose": "타사 렌탈 장비 임차료 정산",
        "keyActions": [
          "임차 대사",
          "지급 승인"
        ]
      }
    ]
  },
  {
    "menuId": "vendors",
    "version": 12,
    "menuName": "매입처 (공급자 / 외주처) 관리",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "구매/회계팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "부품 공급사 및 수리 외주처 마스터, 사업자등록증 및 지급 계좌 관리",
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
    "auditResult": "국세청 사업자 진위 확인 완료 및 매입 거래처 원장 등록 확정",
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
        "selector": "[data-mid=\"vendors-header\"]",
        "label": "매입처 관리 헤더",
        "description": "공급사 마스터, 사업자등록증 및 계좌 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"vendors-table\"]",
        "label": "매입 거래처 대장",
        "description": "상호, 사업자번호, 대표자, 지급 조건",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "table, .table-container",
        "type": "highlight",
        "label": "매입처 대장",
        "description": "[매입처 대장] 화면 영역입니다. 부품사, 운송사, 정비공업사 등 협력 매입처 원장을 관리하는 기본 기능을 제공합니다.",
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
            "description": "[매입처 등록] UI 요소를 조작합니다. 신규 매입처 정보를 입력 저장하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "modalWorkflows": [
      {
        "modalName": "국세청 진위 확인 모달 (NtsAuditModal)",
        "triggerButton": "홈택스 검증",
        "keyFields": [
          "사업자번호",
          "대표자",
          "개업일자"
        ],
        "terminalAction": "검증 실행",
        "afterStateTransition": "사업자 계속사업 여부 확정"
      }
    ]
  },
  {
    "menuId": "bank_matching",
    "version": 12,
    "menuName": "은행 입출금 대장",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "table",
        "type": "callout",
        "label": "분할 화면 레이아웃",
        "description": "[분할 화면 레이아웃] 화면 영역입니다. 화면은 분할 구조로 이루어져 있으며, 좌측에는 입금 내역(Deposits), 우측에는 청구 내역(Billings) 정보가 표시되어 수납 대사를 효율적으로 진행할 수 있습니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid='btn-batch-match'], [data-mid='btn-auto-match']",
        "type": "highlight",
        "label": "일괄 자동 매칭",
        "description": "[일괄 자동 매칭] 화면 영역입니다. 상호 및 금액이 일치하는 입금 건과 청구 건을 시스템이 자동으로 찾아 일괄 매칭 및 수납 처리하는 기본 기능을 제공합니다.",
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
            "description": "[입금 건 선택] UI 요소를 조작합니다. 아직 매칭되지 않은 입금 내역 우측의 수납/매칭 버튼을 클릭하여 대상 입금 건을 선택하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid='input-matching-billing']",
            "type": "click_ripple",
            "label": "청구서 선택",
            "description": "[청구서 선택] UI 요소를 조작합니다. 활성화된 모달창에서 수납을 적용할 대상 청구서의 라디오 버튼을 선택하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 3,
            "selector": "form button[type='submit'].btn-primary",
            "type": "click_ripple",
            "label": "수납 승인",
            "description": "[수납 승인] UI 요소를 조작합니다. 수납 승인 완료 버튼을 클릭하여 수납 처리를 확정하십시오.",
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
            "description": "[매칭 해제 실행] UI 요소를 조작합니다. 매칭이 완료된 목록의 행에서 해제 버튼을 클릭하여 수납 매칭 롤백을 수행하십시오.",
            "positionHint": "right"
          }
        ]
      }
    ],
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "재무/회계팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "은행 통장 거래 내역 수집, 매출 청구서 1:1 수납 대사 및 자동 매칭",
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
    "auditResult": "통장 입금 총액 = 청구 수납 확정액 + 미확인 잔액 | 대차 차액 ₩0",
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
        "selector": "[data-mid=\"bank_matching-header\"]",
        "label": "은행 대장 헤더",
        "description": "통장 거래 내역 수집 및 1:1 수납 대사",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"input-matching-billing\"]",
        "label": "청구서 매칭 검색",
        "description": "입금자명 기준 청구서 자동 매칭",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ]
  },
  {
    "menuId": "corporate_card",
    "version": 12,
    "menuName": "법인카드 매입정산",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "재무/회계팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "법인카드 승인 내역 수집, 부서/계정과목 분류 및 경비 전표 마감",
    "scopeInfo": "카드 번호, 승인 일시, 가맹점명, 승인 금액, 부가세, 사용자, 회계 계정과목, 영수증 이미지",
    "cognitiveSequence": [
      "1. 정산 연월 및 법인카드 번호/소지 임직원별 스코핑",
      "2. 카드사 승인 내역 엑셀 업로드 또는 스크래핑 데이터 조회",
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
    "auditResult": "카드 청구 총액 = 계정과목별 분개 합계 | 차액 ₩0",
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
        "selector": "[data-mid=\"corporate_card-scope-month\"]",
        "label": "카드 정산 연월",
        "description": "법인카드 승인 내역 조회 및 경비 분개",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "table, .table-container",
        "type": "highlight",
        "label": "법인카드 승인 내역",
        "description": "[법인카드 승인 내역] 화면 영역입니다. 카드사 승인 내역과 ERP 지출 품의를 1:1 매칭하는 기본 기능을 제공합니다.",
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
            "description": "[카드 명세 로드] UI 요소에 값을 입력하거나 조작합니다. 승인 내역을 업로드하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "cash_flow",
    "version": 12,
    "menuName": "자금 흐름 분석",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "경영진/재무팀",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "월별 매출 입금, 매입 지급, 고정비 지출 분석 및 미래 유동성 예측",
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
    "auditResult": "기말 잔액 = 기초 잔액 + 수납 유입 - 지출 유출 | 자금 수지 보존",
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
        "selector": "[data-mid=\"cash_flow-header\"]",
        "label": "자금 흐름 헤더",
        "description": "월별 매출 입금, 매입 지급, 유동성 예측",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"cash_flow-month-input\"]",
        "label": "분석 기준월",
        "description": "자금 수지 분석 연월 선택",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"cash_flow-btn-export\"]",
        "label": "자금 흐름 엑셀",
        "description": "현금 흐름 표 엑셀 다운로드",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"cash_flow-inspection-grid\"]",
        "label": "자금 수지 그리드",
        "description": "유입, 유출, 순현금흐름 대차대조 대장",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "div[style*=\"grid-template-columns\"]",
        "type": "highlight",
        "label": "자금 수지 지표",
        "description": "[자금 수지 지표] 화면 영역입니다. 당월 매출 입금액과 매입/급여/운송 지출액의 순유동성을 실시간 조망하는 기본 기능을 제공합니다.",
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
            "description": "[자금 수지 조망] UI 요소를 확인합니다. 총 유입액과 총 유출액을 확인하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "depreciation_execution",
    "version": 12,
    "menuName": "감가상각 마감 실행",
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "회계팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "당사 보유 자산 정액법 감가상각비 월할 계상 및 장부가액 감가 마감",
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
    "auditResult": "감가상각 누계액 = 전월 누계 + 당월 상각비 | 자산별 장부가액 보존",
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
        "selector": "[data-mid=\"dep-header\"]",
        "label": "감가상각 헤더",
        "description": "자산 정액법 감가상각비 월할 계상",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dep-status-banner\"]",
        "label": "상각 마감 상태",
        "description": "당월 감가상각 마감 여부 및 장부가액 총액",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dep-status-banner\"]",
        "type": "highlight",
        "label": "감가상각 마감 상태",
        "description": "[감가상각 마감 상태] 화면 영역입니다. 당월 감가상각비 계상 및 장부가액 감액 상태를 확인하는 기본 기능을 제공합니다.",
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
            "description": "[상각 상태 확인] UI 요소를 확인합니다. 당월 상각 실행 대기 자산 목록을 확인하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "regular_reports",
    "version": 12,
    "menuName": "정기보고서 생성",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "select",
        "type": "highlight",
        "label": "리포트 목록 선택",
        "description": "[리포트 목록 선택] 화면 영역입니다. 조회할 대상 연월을 선택하여 해당 월의 결산 보고서를 불러옵니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "button.btn-primary",
        "type": "callout",
        "label": "보고서 확정 및 다운로드",
        "description": "[보고서 확정 및 다운로드] 화면 영역입니다. 지시 사항을 저장하거나 최종 확정된 공식 보고서를 다운로드하는 기본 기능을 제공합니다.",
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
            "description": "[대기 보고서 선택] UI 요소를 조작합니다. 드롭다운 목록에서 결재할 대상 연월의 보고서를 선택하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid='reports-grid']",
            "type": "highlight",
            "label": "보고서 내용 검토",
            "description": "[보고서 내용 검토] UI 요소에 값을 입력하거나 조작합니다. 보고서 본문의 상세 지표, 차트, 부서별 의견을 정밀 검토하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "button.btn-primary",
            "type": "stamp",
            "label": "승인 및 결재 확정",
            "description": "[승인 및 결재 확정] UI 요소를 조작합니다. 확인 버튼을 클릭하여 보고서를 최종 승인 상태로 확정 마감하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "groupId": "grp_management",
    "groupName": "경영관리",
    "department": "경영기획/경영진",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "월간 렌탈 가동률, 매출 실적, 채권 현황 등 경영 핵심 리포트 생성 및 출력",
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
    "auditResult": "리포트 집계 수식 100% DB 원장 일치 및 PDF/엑셀 생성 완료",
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
        "selector": "[data-mid=\"reports-kpi\"]",
        "label": "경영 지표 카드",
        "description": "가동률, 당월 매출, 채권 회수율 KPI",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ]
  },
  {
    "menuId": "organization",
    "version": 12,
    "menuName": "조직 / 인사 관리",
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "인사/총무팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "부서 트리 구조 정의, 직위/직무 체계 설정 및 임직원 인사 마스터 관리",
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
    "auditResult": "전사 부서-임직원 소속 100% 결합 및 직무별 기본 권한 매핑 확정",
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
        "label": "조직 관리 헤더",
        "description": "부서 트리 및 직위/직무 체계 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"org-user-card\"]",
        "label": "임직원 인사 카드",
        "description": "성명, 부서, 직책, 연락처, 입사일",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"org-save-all\"]",
        "label": "조직도 저장",
        "description": "부서 배치 및 직무 설정 영구 저장",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"org-tree-panel\"]",
        "type": "highlight",
        "label": "부서 조직 구조도",
        "description": "[부서 조직 구조도] 화면 영역입니다. 본사/지사/주기장 및 팀별 계층 구조를 조망하고 하위 부서를 신설·배치하는 기본 기능을 제공합니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"org-users-panel\"]",
        "type": "highlight",
        "label": "부서원 명부 대장",
        "description": "[부서원 명부 대장] 화면 영역입니다. 선택 부서에 소속된 임직원의 직급, 직책, 결재선 티어 및 계정 상태를 관리하는 기본 기능을 제공합니다.",
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
            "description": "[상위 부서 선택] UI 요소를 조작합니다. 조직도 트리에서 신설할 부서의 상위 조직 또는 본부를 클릭하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"org-btn-add-dept\"]",
            "type": "click_ripple",
            "label": "하위 부서 추가 클릭",
            "description": "[하위 부서 추가 클릭] UI 요소를 조작합니다. 조직 트리 상단의 [+] 버튼을 클릭하여 새 부서 노드를 생성하십시오.",
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
            "description": "[신규 직원 등록 버튼 클릭] UI 요소를 조작합니다. 명부 상단의 [신규 직원 등록] 버튼을 클릭하여 입력 모달을 엽니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"org-users-panel\"]",
            "type": "highlight",
            "label": "배치 결과 확인",
            "description": "[배치 결과 확인] UI 요소를 확인합니다. 등록된 직원이 부서원 명부에 정상 반영되고 직책 티어가 산정되었는지 확인하십시오.",
            "positionHint": "left"
          }
        ]
      }
    ]
  },
  {
    "menuId": "permission",
    "version": 12,
    "menuName": "사용자 및 권한",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid='btn-inherit-role']",
        "type": "highlight",
        "label": "사용자 그리드",
        "description": "[사용자 그리드] 화면 영역입니다. 개별 직원 목록을 조회하고 시스템 등급 및 권한 명칭을 부여할 수 있는 사용자 그리드 탭입니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid='matrix-title']",
        "type": "callout",
        "label": "권한 설정 매트릭스",
        "description": "[권한 설정 매트릭스] 화면 영역입니다. 선택한 역할(Role)에 대해 각 메뉴별 조회 및 저장 권한을 상세하게 제어할 수 있는 영역입니다.",
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
            "description": "[대상 선택] UI 요소를 조작합니다. 좌측 목록에서 권한을 수정할 대상을 클릭하여 선택하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid='permission-matrix-grid'], [data-mid='matrix-title']",
            "type": "highlight",
            "label": "권한 토글",
            "description": "[권한 토글] UI 요소를 조작합니다. 우측 매트릭스에서 부여할 특정 메뉴의 조회 또는 저장 권한 체크박스를 클릭하여 변경하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid='btn-save-permissions']",
            "type": "click_ripple",
            "label": "설정 저장",
            "description": "[설정 저장] UI 요소를 조작합니다. 변경 사항을 시스템에 반영하기 위해 상단의 저장 버튼을 클릭하십시오.",
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
            "description": "[직원 권한 배정 탭 진입] UI 요소를 조작합니다. 상단 탭 바에서 [직원 권한 상속 배정] 탭을 클릭하여 전환하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid='permission-user-filter']",
            "type": "callout",
            "label": "임직원 검색 및 필터",
            "description": "[임직원 검색 및 필터] UI 요소를 조작합니다. 성명, 부서, 직급 조건을 입력하여 권한을 배정할 직원을 검색하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid='permission-user-grid']",
            "type": "highlight",
            "label": "권한 역할 드롭다운 선택",
            "description": "[권한 역할 드롭다운 선택] UI 요소를 조작합니다. 해당 직원 행의 권한 명칭 드롭다운에서 부여할 역할을 선택하여 즉시 매핑하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "시스템관리자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "역할별 시스템 메뉴 접근 권한, 데이터 쓰기/삭제 권한 매트릭스 설정",
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
    "auditResult": "직무분리(SoD) 기준 준수 및 불법 권한 오남용 차단 확정",
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
        "selector": "[data-mid=\"permission-header\"]",
        "label": "권한 설정 헤더",
        "description": "역할별 메뉴 접근 및 CUD 권한 매트릭스",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"permission-inspection-grid\"]",
        "label": "권한 매트릭스 그리드",
        "description": "메뉴별 읽기/쓰기/삭제 권한 체크",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ]
  },
  {
    "menuId": "payroll",
    "version": 12,
    "menuName": "급여 정산",
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"payroll-month-input\"], [data-mid=\"payroll-scope-month\"]",
        "type": "callout",
        "label": "정산 대상 연월 선택",
        "description": "[정산 대상 연월 선택] 화면 영역입니다. 급여를 정산할 대상 년월을 지정하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"payroll-inspection-grid\"]",
        "type": "highlight",
        "label": "급여 정산 대장",
        "description": "[급여 정산 대장] 화면 영역입니다. 임직원별 기본급, 수당, 공제 항목, 실지급액을 대사하는 기본 기능을 제공합니다.",
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
            "description": "[정산 대상 연월 선택] UI 요소를 조작합니다. 급여를 정산할 대상 년월을 지정하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"payroll-inspection-grid\"]",
            "type": "highlight",
            "label": "급여 대장 실사",
            "description": "[급여 대장 실사] UI 요소에 값을 입력하거나 조작합니다. 직원별 산정 급여와 공제 내역을 1:1 대사하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"payroll-terminal-audit-close\"], button.btn-success",
            "type": "click_ripple",
            "label": "결재 마감 승인 잠금",
            "description": "[결재 마감 승인 잠금] UI 요소에 값을 입력하거나 조작합니다. 급여 대장을 최종 확정하고 수정을 잠급니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ],
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "인사/급여팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "임직원 기본급, 수당, 4대보험 공제, 실지급액 산출 및 명세서 발송",
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
    "auditResult": "실지급액 = 지급총액 - 공제총액 | 급여 원장 대차 차액 ₩0",
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
        "selector": "[data-mid=\"payroll-header\"]",
        "label": "급여 정산 헤더",
        "description": "임직원 기본급, 수당, 4대보험 공제 정산",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"payroll-scope-month\"]",
        "label": "급여 귀속 연월",
        "description": "정산 대상 급여 월 지정",
        "colorToken": "GREEN",
        "type": "CALLOUT"
      }
    ]
  },
  {
    "menuId": "leave_management",
    "version": 12,
    "menuName": "연차관리",
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "인사팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "입사일 기준 연차 자동 부여, 소진 일수 차감 및 전사 잔여 연차 대장 관리",
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
        "tabName": "임직원 연차 현황 대장",
        "purpose": "임직원별 1년 부여 연차 및 잔여일수 대장",
        "keyActions": [
          "부여 갯수 갱신",
          "엑셀 다운로드"
        ]
      },
      {
        "tabId": "USAGE",
        "tabName": "연차 소진 관리 대장",
        "purpose": "관리자 수동 소진 등록 및 소진 취소",
        "keyActions": [
          "소진 등록",
          "소진 취소(환원)"
        ]
      }
    ],
    "auditResult": "잔여 연차 = 발생 연차 - 소진 연차 | 오차 0일 보존",
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
        "selector": "[data-mid=\"leave-management-tabs\"]",
        "label": "연차 관리 탭",
        "description": "부여 현황 대장 vs 소진 관리 대장",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"leave-inspection-summary\"]",
        "label": "전사 연차 통계 바",
        "description": "등록 임직원, 총 발생 연차, 소진 연차, 잔여 연차",
        "colorToken": "PURPLE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"leave-inspection-quota-grid\"]",
        "label": "연차 대장 그리드",
        "description": "임직원별 입사일, 갱신 주기, 발생일수, 잔여일수",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"leave-terminal-audit-excel\"]",
        "label": "연차 대장 엑셀",
        "description": "전사 연차 소진 및 잔여일수 엑셀 다운로드",
        "colorToken": "AMBER",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"leave-scope-emp\"]",
        "type": "callout",
        "label": "임직원 연차 검색",
        "description": "[임직원 연차 검색] 화면 영역입니다. 성명 또는 부서를 입력하여 대상 임직원의 연차 현황을 신속히 스코핑하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"leave-inspection-quota-grid\"], [data-mid=\"leave-inspection-usage-grid\"]",
        "type": "highlight",
        "label": "연차 관리 대장",
        "description": "[연차 관리 대장] 화면 영역입니다. 근속연수별 법정 발생 연차, 기사용 일수, 잔여 일수를 1:1 대조 실사하는 기본 기능을 제공합니다.",
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
            "description": "[연차 현황 대장 탭 선택] UI 요소를 조작합니다. 상단에서 [임직원 연차 갱신/현황 대장] 탭을 클릭하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"leave-scope-emp\"]",
            "type": "callout",
            "label": "대상 임직원 검색",
            "description": "[대상 임직원 검색] UI 요소를 조작합니다. 검색창에 사원명을 입력하여 연차 한도를 수정할 직원을 찾습니다.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "privacy_audit",
    "version": 12,
    "menuName": "개인정보 접속 감사",
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "개인정보보호책임자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "주민등록번호, 연락처 등 개인정보 조회/다운로드 접속 로그 감사 및 오남용 감시",
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
    "auditResult": "개인정보 처리 로그 100% 무누락 영구 보존 및 감사 리포트 확정",
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
        "selector": "[data-mid=\"privacy-header\"]",
        "label": "개인정보 감사 헤더",
        "description": "개인정보 조회/다운로드 접속 로그 감사",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"privacy-inspection-grid\"]",
        "label": "감사 로그 그리드",
        "description": "일시, 접속자, 대상 고객사, 처리 작업 유형",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"privacy-terminal-audit-excel\"]",
        "label": "감사 보고서 엑셀",
        "description": "개인정보보호법 감사 증빙 엑셀 다운로드",
        "colorToken": "AMBER",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"privacy-scope-header\"]",
        "type": "highlight",
        "label": "개인정보 보호책임자 현황",
        "description": "[개인정보 보호책임자 현황] 화면 영역입니다. 법정 개인정보 보호책임자(CPO) 지정 정보 및 전사 처리방침 규정을 확인하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"privacy-inspection-grid\"]",
        "type": "highlight",
        "label": "개인정보 접속 감사 대장",
        "description": "[개인정보 접속 감사 대장] 화면 영역입니다. 열람 일시, 접속자 IP, 대상 고객/임직원 식별정보, 접근 사유를 전수 실사하는 기본 기능을 제공합니다.",
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
            "description": "[감사 기간 범위 설정] UI 요소를 조작합니다. 조회 시작일과 종료일을 지정하여 감사 대상 범위를 확정하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"privacy-inspection-grid\"]",
            "type": "highlight",
            "label": "접속 로그 대조 실사",
            "description": "[접속 로그 대조 실사] UI 요소를 확인합니다. 비정상 시간대 접속이나 대량 조회가 발생했는지 로그를 검토하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "operations_manual",
    "version": 12,
    "menuName": "업무매뉴얼",
    "groupId": "grp_tools",
    "groupName": "도구 및 다운로드",
    "department": "전사 임직원",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "부서별 전사 업무 프로세스 표준 가이드라인 및 직무별 매뉴얼 조회",
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
    "auditResult": "전사 73개 메뉴 표준 지침 100% 열람 지원 및 최신 개정본 유지",
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
        "selector": "[data-mid=\"operations_manual-header\"]",
        "label": "업무매뉴얼 헤더",
        "description": "전사 업무 프로세스 표준 지침서 조회",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"operations_manual-scope\"]",
        "label": "부서별 매뉴얼 탐색",
        "description": "부서 및 업무 영역별 메뉴 네비게이션",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"operations_manual-pipeline-db\"]",
        "label": "중앙 DB 동기화",
        "description": "중앙 클라우드 매뉴얼 최신 개정본 동기화",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"operations_manual-pipeline-print\"]",
        "label": "매뉴얼 인쇄/PDF",
        "description": "표준 업무 매뉴얼 문서 출력",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"operations_manual-scope\"]",
        "type": "highlight",
        "label": "매뉴얼 검색 스코프",
        "description": "[매뉴얼 검색 스코프] 화면 영역입니다. 메뉴, 목표, 헌장 등 전체 매뉴얼 컨텐츠를 검색하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"operations_manual-filter\"]",
        "type": "highlight",
        "label": "부서 필터링",
        "description": "[부서 필터링] 화면 영역입니다. 담당 부서별로 매뉴얼을 필터링하여 조회하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "업무매뉴얼의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"operations_manual-scope\"]",
            "type": "click_ripple",
            "label": "매뉴얼 검색 스코프",
            "description": "[매뉴얼 검색 스코프] UI 요소에 값을 입력하거나 조작합니다. 메뉴, 목표, 헌장 등 전체 매뉴얼 컨텐츠를 검색하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"operations_manual-filter\"]",
            "type": "click_ripple",
            "label": "부서 필터링",
            "description": "[부서 필터링] UI 요소를 확인합니다. 담당 부서별로 매뉴얼을 필터링하여 조회하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"operations_manual-pipeline-db\"]",
            "type": "click_ripple",
            "label": "DB 일괄 주입",
            "description": "[DB 일괄 주입] UI 요소를 확인합니다. 모든 표준 매뉴얼을 DB에 영구 주입 및 조회하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"operations_manual-pipeline-print\"]",
            "type": "click_ripple",
            "label": "A4 인쇄",
            "description": "[A4 인쇄] UI 요소를 조작합니다. 선택된 매뉴얼 또는 전체 매뉴얼을 A4 규격으로 인쇄하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"operations_manual-inspection-nav\"]",
            "type": "click_ripple",
            "label": "메뉴 목록 네비게이션",
            "description": "[메뉴 목록 네비게이션] UI 요소를 조작합니다. 그룹화된 메뉴 목록에서 상세 조회할 매뉴얼을 선택하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"operations_manual-terminal-detail\"]",
            "type": "click_ripple",
            "label": "매뉴얼 상세 컨텐츠",
            "description": "[매뉴얼 상세 컨텐츠] UI 요소를 조작합니다. 선택된 메뉴의 Z-패턴 조작 동선 및 감사 결과를 포함한 전체 매뉴얼을 확인하십시오.",
            "positionHint": "left"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"operations_manual-inspection-card\"]",
            "type": "click_ripple",
            "label": "매뉴얼 요약 정보",
            "description": "[매뉴얼 요약 정보] UI 요소를 확인합니다. 해당 메뉴의 소속 부서, 아키타입, 메뉴ID 등의 핵심 요약을 확인하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "error_report",
    "version": 12,
    "menuName": "오류 신고",
    "groupId": "grp_tools",
    "groupName": "도구 및 다운로드",
    "department": "전사 임직원",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "현장 업무 중 발견된 시스템 결함, UI 깨짐, 논리 오류 접수 및 조치 관리",
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
    "auditResult": "접수 결함 조치 완료 종결 및 재발 방지 패치 검증 확정",
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
        "selector": "[data-mid=\"error_report-header\"]",
        "label": "오류 신고 헤더",
        "description": "시스템 결함 및 논리 충돌 접수/조치",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"error_report-scope-status\"]",
        "label": "처리 상태 필터",
        "description": "접수, 조치중, 완료 상태별 필터",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"error_report-pipeline-register\"]",
        "label": "오류 신고 등록",
        "description": "신규 버그 및 화면 결함 제보 작성",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"error_report-scope-status\"]",
        "type": "highlight",
        "label": "단계별 오류 현황",
        "description": "[단계별 오류 현황] 화면 영역입니다. 신고등록, 접수처리, 완료 등 3대 단계별 오류 신고 현황을 한눈에 확인하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"error_report-scope-filters\"]",
        "type": "highlight",
        "label": "신고 내역 검색 필터",
        "description": "[신고 내역 검색 필터] 화면 영역입니다. 단계, 발생 메뉴, 중요도, 검색어 등을 통해 오류 신고 내역을 필터링하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "오류 신고의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"error_report-scope-status\"]",
            "type": "click_ripple",
            "label": "단계별 오류 현황",
            "description": "[단계별 오류 현황] UI 요소를 확인합니다. 신고등록, 접수처리, 완료 등 3대 단계별 오류 신고 현황을 한눈에 확인하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"error_report-scope-filters\"]",
            "type": "click_ripple",
            "label": "신고 내역 검색 필터",
            "description": "[신고 내역 검색 필터] UI 요소에 값을 입력하거나 조작합니다. 단계, 발생 메뉴, 중요도, 검색어 등을 통해 오류 신고 내역을 필터링하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"error_report-pipeline-export\"]",
            "type": "click_ripple",
            "label": "엑셀 내보내기",
            "description": "[엑셀 내보내기] UI 요소에 값을 입력하거나 조작합니다. 현재 필터링된 오류 신고 내역을 엑셀 파일로 다운로드하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"error_report-pipeline-register\"]",
            "type": "click_ripple",
            "label": "신규 신고 등록",
            "description": "[신규 신고 등록] UI 요소에 값을 입력하거나 조작합니다. 새로운 시스템 오류, 버그, 또는 개선 요청을 등록하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"error_report-inspection-grid\"]",
            "type": "click_ripple",
            "label": "오류 신고 대장 그리드",
            "description": "[오류 신고 대장 그리드] UI 요소를 확인합니다. 등록된 오류 신고의 처리 상태, 중요도, 신고자 및 담당자를 목록에서 확인하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"error_report-modal-register\"]",
            "type": "click_ripple",
            "label": "신고 등록 모달",
            "description": "[신고 등록 모달] UI 요소에 값을 입력하거나 조작합니다. 발생 메뉴, 오류 유형, 상세 내용 및 증빙 화면 캡처 등을 첨부하여 신고를 접수하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"error_report-modal-detail\"]",
            "type": "click_ripple",
            "label": "신고 상세 및 처리 모달",
            "description": "[신고 상세 및 처리 모달] UI 요소를 확인합니다. 신고 상세 내역을 확인하고, 담당자 배정(접수) 및 조치 완료 처리를 수행하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "agentic_ai_lab",
    "version": 12,
    "menuName": "에이전틱 AI 샌드박스 랩",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "개발/기획팀",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "자연어 비즈니스 지시어 기반 다중 에이전트 자율 업무 수행 시뮬레이션 및 검증",
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
    "auditResult": "에이전트 도구 호출 무결성 및 인과율 타임라인 검증 완료",
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
        "selector": "[data-mid=\"agentic_ai_lab-header\"]",
        "label": "AI 랩 헤더",
        "description": "다중 에이전트 자율 업무 시뮬레이션 환경",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"agentic_ai_lab-root\"]",
        "label": "에이전트 샌드박스",
        "description": "자연어 지시 실행 및 인과율 타임라인",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"agentic_ai_lab-scope\"]",
        "type": "highlight",
        "label": "시나리오 프리셋 선택",
        "description": "[시나리오 프리셋 선택] 화면 영역입니다. 출고 의뢰, 배차 추천, 계약 대차 등 사전 정의된 고난도 ERP 시나리오를 선택하는 기본 기능을 제공합니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"agentic_ai_lab-timeline\"]",
        "type": "highlight",
        "label": "인공지능 추론 타임라인",
        "description": "[인공지능 추론 타임라인] 화면 영역입니다. AI 에이전트의 단계별 생각(Thought), 표준 도구 호출(Tool Call) 및 관찰(Observation)을 실시간 모니터링하는 기본 기능을 제공합니다.",
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
            "description": "[시나리오 프리셋 선택] UI 요소를 조작합니다. 테스트할 비즈니스 시나리오를 클릭하여 프롬프트 콘솔에 로드하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"agentic_ai_lab-pipeline-run\"]",
            "type": "click_ripple",
            "label": "인공지능 자동 실행 클릭",
            "description": "[인공지능 자동 실행 클릭] UI 요소에 값을 입력하거나 조작합니다. 상단 [에이전틱 AI 실행] 버튼을 눌러 ReAct 추론 루프를 가동하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"agentic_ai_lab-timeline\"]",
            "type": "highlight",
            "label": "추론 및 툴 호출 모니터링",
            "description": "[추론 및 툴 호출 모니터링] UI 요소를 확인합니다. 에이전트가 헌장 가드레일을 준수하며 정확한 DB 도구를 실행하는지 확인하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "agentic_dispatch_studio",
    "version": 12,
    "menuName": "에이전틱 배차 관제 스튜디오",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "개발/배차팀",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "왕복 배차 최적화, 운송비 절감 경로 산출 및 교환 배차 자동 매칭",
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
    "auditResult": "교환 1건 왕복 배차 발행 원칙 100% 달성 및 운송비 절감액 산출 확정",
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
        "selector": "[data-mid=\"agentic_dispatch_studio-header\"]",
        "label": "에이전틱 배차 헤더",
        "description": "왕복 배차 최적화 및 운송비 절감 엔진",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"kpi-exchange-compliance\"]",
        "label": "교환 배차 준수율",
        "description": "교환 1건 왕복 배차 발행 원칙 준수 KPI",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"kpi-exchange-compliance\"]",
        "type": "highlight",
        "label": "헌장 2.3 교환 준수율 현황판",
        "description": "[헌장 2.3 교환 준수율 현황판] 화면 영역입니다. 대차 단일 왕복 배차 및 헌장 1.3 출고 승인 전 상태 비조작 준수율을 실시간 검증하는 기본 기능을 제공합니다.",
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
            "description": "[배차 헌장 지표 확인] UI 요소를 확인합니다. 단일 EXCHANGE 발행 및 왕복할인 차감 여부를 확인하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "input[type=\"text\"], textarea",
            "type": "callout",
            "label": "자연어 배차 지시 입력",
            "description": "[자연어 배차 지시 입력] UI 요소에 값을 입력하거나 조작합니다. 예: \"내일 아침 8시 화성 향남 현장 GS-1930 2대 5톤 셀프로더로 배차해줘\"",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "agentic_settlement_autopilot",
    "version": 12,
    "menuName": "에이전틱 월말 대사 정산 오토파일럿",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "개발/회계팀",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "월말 운송료, 매입처, 은행 입금 다자간 대사 자동 수행 및 차액 분석",
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
    "auditResult": "자동 대사 일치율 100% 및 ⚖️ 대차 차액 ₩0 보존 확정",
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
        "label": "정산 오토파일럿 헤더",
        "description": "월말 다자간 대사 자동 수행 및 차액 분석",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"agentic_settlement_autopilot-header\"]",
        "type": "highlight",
        "label": "에이전틱 정산오토파일럿 헤더",
        "description": "[에이전틱 정산오토파일럿 헤더] 화면 영역입니다. 헌장 4.1 일할 매출 기여액 정산 오토파일럿 상태와 개요를 표시하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"agentic_settlement_autopilot-scope\"]",
        "type": "highlight",
        "label": "정산 대상 및 기준 설정",
        "description": "[정산 대상 및 기준 설정] 화면 영역입니다. 대사를 수행할 정산 연월, 대상 거래처, 지급 기준을 설정하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "에이전틱 월말 대사 정산 오토파일럿의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"agentic_settlement_autopilot-header\"]",
            "type": "click_ripple",
            "label": "에이전틱 정산오토파일럿 헤더",
            "description": "[에이전틱 정산오토파일럿 헤더] UI 요소에 값을 입력하거나 조작합니다. 헌장 4.1 일할 매출 기여액 정산 오토파일럿 상태와 개요를 표시하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"agentic_settlement_autopilot-scope\"]",
            "type": "click_ripple",
            "label": "정산 대상 및 기준 설정",
            "description": "[정산 대상 및 기준 설정] UI 요소에 값을 입력하거나 조작합니다. 대사를 수행할 정산 연월, 대상 거래처, 지급 기준을 설정하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"agentic_settlement_autopilot-scope-month\"]",
            "type": "click_ripple",
            "label": "정산 연월 선택",
            "description": "[정산 연월 선택] UI 요소를 조작합니다. 정산하고자 하는 대상 연월을 정확히 선택하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"agentic_settlement_autopilot-pipeline-run\"]",
            "type": "click_ripple",
            "label": "정산오토파일럿 실행",
            "description": "[정산오토파일럿 실행] UI 요소에 값을 입력하거나 조작합니다. 에이전틱 AI가 입금 대사 및 일할 정산 대차대조 검증을 자동 수행하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"agentic_settlement_autopilot-status\"]",
            "type": "click_ripple",
            "label": "실행 상태 안내",
            "description": "[실행 상태 안내] UI 요소에 값을 입력하거나 조작합니다. 정산 AI의 실행 진행 상황 및 완료 상태를 실시간 안내하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"agentic_settlement_autopilot-inspection-grid\"]",
            "type": "click_ripple",
            "label": "대차대조 검증 그리드",
            "description": "[대차대조 검증 그리드] UI 요소에 값을 입력하거나 조작합니다. 계약자산별 1원 오차 없는 정밀 일할 매출 기여액 내역을 표시하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"agentic_settlement_autopilot-terminal-summary\"]",
            "type": "click_ripple",
            "label": "정산 합계 및 대차 검증",
            "description": "[정산 합계 및 대차 검증] UI 요소에 값을 입력하거나 조작합니다. 청구총액, 확정액, 반려액 합계를 통한 대차대조 무결성을 판정하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 8,
            "selector": "[data-mid=\"agentic_settlement_autopilot-terminal-commit\"]",
            "type": "click_ripple",
            "label": "정산 확정 및 결과 반영",
            "description": "[정산 확정 및 결과 반영] UI 요소에 값을 입력하거나 조작합니다. 대차 검증이 완료된 월말 정산 내역을 최종 확정 처리하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "agentic_asset_lifecycle",
    "version": 12,
    "menuName": "에이전틱 자산 라이프사이클 관제",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "개발/자산관리팀",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "취득부터 출고, 회수, 정비, 매각까지 자산 생애주기 전사 이벤트 추적",
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
    "auditResult": "자산 이벤트 로그 무누락 검증 및 라이프사이클 상태 보존 법칙 확정",
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
        "label": "생애주기 관제 헤더",
        "description": "자산 라이프사이클 전사 이벤트 추적",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"agentic_asset_lifecycle-header\"]",
        "type": "highlight",
        "label": "자산 생애주기 에이전트 헤더",
        "description": "[자산 생애주기 에이전트 헤더] 화면 영역입니다. 취득, 출고, 입고, 정비, 매각의 전 생애주기 에이전트 현황을 표시하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"agentic_asset_lifecycle-scope\"]",
        "type": "highlight",
        "label": "자산 조회 스코프",
        "description": "[자산 조회 스코프] 화면 영역입니다. 생애주기 추적 대상 자산의 관리번호, 모델명, 소유구분을 설정하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "에이전틱 자산 라이프사이클 관제의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"agentic_asset_lifecycle-header\"]",
            "type": "click_ripple",
            "label": "자산 생애주기 에이전트 헤더",
            "description": "[자산 생애주기 에이전트 헤더] UI 요소에 값을 입력하거나 조작합니다. 취득, 출고, 입고, 정비, 매각의 전 생애주기 에이전트 현황을 표시하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"agentic_asset_lifecycle-scope\"]",
            "type": "click_ripple",
            "label": "자산 조회 스코프",
            "description": "[자산 조회 스코프] UI 요소에 값을 입력하거나 조작합니다. 생애주기 추적 대상 자산의 관리번호, 모델명, 소유구분을 설정하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"agentic_asset_lifecycle-pipeline-filter\"]",
            "type": "click_ripple",
            "label": "생애주기 단계 필터",
            "description": "[생애주기 단계 필터] UI 요소에 값을 입력하거나 조작합니다. 출고대기, 대여중, 주기장입고, 정비중 등 단계별 자산을 선별하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"agentic_asset_lifecycle-timeline\"]",
            "type": "click_ripple",
            "label": "자산 생애주기 타임라인",
            "description": "[자산 생애주기 타임라인] UI 요소를 확인합니다. 취득부터 현재까지 발생한 모든 입출고·정비 사건의 시계열 이력을 조회하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"agentic_asset_lifecycle-exchange-trace\"]",
            "type": "click_ripple",
            "label": "대차 교체 연결 추적",
            "description": "[대차 교체 연결 추적] UI 요소에 값을 입력하거나 조작합니다. 헌장 4.2 준수: 전자산 회수 및 후장비 투입 1:1 연결 관계를 검증하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"agentic_asset_lifecycle-inspection-details\"]",
            "type": "click_ripple",
            "label": "입출고 검수 상세 내역",
            "description": "[입출고 검수 상세 내역] UI 요소를 확인합니다. 출고 PDI 및 입고 정비 점검표, 파손/오염 증빙 사진을 확인하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"agentic_asset_lifecycle-maintenance-score\"]",
            "type": "click_ripple",
            "label": "자산 정비 감가 수치",
            "description": "[자산 정비 감가 수치] UI 요소를 확인합니다. 가동시간, 정비점수, 안전검사 유효기간 등 자산 건전성 지표를 확인하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 8,
            "selector": "[data-mid=\"agentic_asset_lifecycle-terminal-audit\"]",
            "type": "click_ripple",
            "label": "상태 전환 확정",
            "description": "[상태 전환 확정] UI 요소에 값을 입력하거나 조작합니다. 출고 검수 승인 또는 입고 정비 완료 조치를 검증하여 자산 상태를 확정하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "initial_db_upload",
    "version": 12,
    "menuName": "초기DB 업로드",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "시스템관리자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "과거 엑셀 데이터, 밴드 AS 이력, 소급 청구서 일괄 DB 적재 및 무결성 검증",
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
        "tabName": "초기데이터 적재",
        "purpose": "계약, 고객, 장비 엑셀 파싱 및 DB 반영",
        "keyActions": [
          "파일 선택",
          "파싱",
          "DB 적재"
        ]
      },
      {
        "tabId": "CLEANUP",
        "tabName": "정합성 대사",
        "purpose": "외래키 고아 데이터 및 중복 제거",
        "keyActions": [
          "무결성 대사 실행"
        ]
      },
      {
        "tabId": "BACKUP",
        "tabName": "DB 백업",
        "purpose": "스토리지 스냅샷 백업",
        "keyActions": [
          "백업 파일 생성"
        ]
      },
      {
        "tabId": "RESET",
        "tabName": "데이터 초기화",
        "purpose": "테스트 데이터 초기화",
        "keyActions": [
          "초기화 실행"
        ]
      }
    ],
    "auditResult": "적재 대상 레코드 100% 정상 영구 보존 및 외래키 정합성 확보",
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
        "label": "초기DB 적재 헤더",
        "description": "과거 데이터 마이그레이션 및 정합성 검증",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"initial_db_upload-tabs\"]",
        "label": "작업 단계 탭",
        "description": "적재, 정합성 대사, 백업, 초기화 탭",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"initial_db_hud_row\"]",
        "label": "데이터 적재 현황 HUD",
        "description": "계약, 고객, 장비, AS 이력 적재 건수 집계",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"initial_db_upload-header\"]",
        "type": "highlight",
        "label": "초기 DB 적재 가이드",
        "description": "[초기 DB 적재 가이드] 화면 영역입니다. 신규 테넌트 구축 및 레거시 데이터 이관 시 기준정보를 원자적으로 적재하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"initial_db_upload-tabs\"]",
        "type": "highlight",
        "label": "작업 모드 탭 바",
        "description": "[작업 모드 탭 바] 화면 영역입니다. 엑셀 데이터 적재, 정제/중복 제거, 전체 백업, 테넌트 초기화 모드를 선택하는 기본 기능을 제공합니다.",
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
            "description": "[데이터 적재 탭 선택] UI 요소를 조작합니다. 상단 탭에서 [엑셀 데이터 적재 (INGEST)] 모드를 클릭하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"initial_db_upload-excel-import\"]",
            "type": "highlight",
            "label": "엑셀 파일 선택 및 파싱",
            "description": "[엑셀 파일 선택 및 파싱] UI 요소에 값을 입력하거나 조작합니다. 작성된 표준 양식 엑셀을 드래그 앤 드롭하여 유효성을 사전 검증하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "google_config",
    "version": 12,
    "menuName": "구글 관리자 설정",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "시스템관리자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "구글 드라이브, Supabase 버킷, Cloudflare R2 스토리지 인증 및 백업 환경 설정",
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
    "auditResult": "클라우드 스토리지 연결 인증 성공 및 동기화 환경설정 영구 저장",
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
        "label": "클라우드 설정 헤더",
        "description": "구글 드라이브, Supabase, R2 스토리지 연동",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"google_config-header\"]",
        "type": "highlight",
        "label": "구글 및 클라우드 연동 헤더",
        "description": "[구글 및 클라우드 연동 헤더] 화면 영역입니다. 클라우드 인프라 및 구글 계정 연동 화면의 상태를 안내하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"google_config-auth\"]",
        "type": "highlight",
        "label": "구글 인증 계정 설정",
        "description": "[구글 인증 계정 설정] 화면 영역입니다. 시스템 알림 발송 및 드라이브 백업에 사용할 구글 인증 계정을 설정하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "구글 관리자 설정의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"google_config-header\"]",
            "type": "click_ripple",
            "label": "구글 및 클라우드 연동 헤더",
            "description": "[구글 및 클라우드 연동 헤더] UI 요소에 값을 입력하거나 조작합니다. 클라우드 인프라 및 구글 계정 연동 화면의 상태를 안내하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"google_config-auth\"]",
            "type": "click_ripple",
            "label": "구글 인증 계정 설정",
            "description": "[구글 인증 계정 설정] UI 요소에 값을 입력하거나 조작합니다. 시스템 알림 발송 및 드라이브 백업에 사용할 구글 인증 계정을 설정하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"google_config-storage\"]",
            "type": "click_ripple",
            "label": "Supabase 스토리지 버킷 설정",
            "description": "[Supabase 스토리지 버킷 설정] UI 요소에 값을 입력하거나 조작합니다. 사진 및 검수 증빙 파일을 저장할 클라우드 스토리지 버킷 및 보안 정책을 관리하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"google_config-mode\"]",
            "type": "click_ripple",
            "label": "시스템 운영 모드 설정",
            "description": "[시스템 운영 모드 설정] UI 요소에 값을 입력하거나 조작합니다. 테스트용 로컬 모드와 클라우드 원격 운영을 위한 실무 모드를 전환하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"google_config-r2\"]",
            "type": "click_ripple",
            "label": "Cloudflare R2 스토리지 설정",
            "description": "[Cloudflare R2 스토리지 설정] UI 요소에 값을 입력하거나 조작합니다. 대용량 미디어 및 백업 데이터를 저장할 Cloudflare R2 버킷 정보를 설정하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"google_config-folders\"]",
            "type": "click_ripple",
            "label": "구글 드라이브 폴더 매핑",
            "description": "[구글 드라이브 폴더 매핑] UI 요소를 조작합니다. 계약서, 거래명세서 등 각종 문서를 백업할 구글 드라이브 전용 폴더 ID를 지정하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"google_config-save\"]",
            "type": "click_ripple",
            "label": "클라우드 환경설정 영구 저장",
            "description": "[클라우드 환경설정 영구 저장] UI 요소를 조작합니다. 입력된 모든 클라우드 인프라 및 연동 설정을 DB에 영구 반영하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ]
  },
  {
    "menuId": "dev_uploader",
    "version": 11,
    "menuName": "[개발] DB 데이터 업로더",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "개발자 전용",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "개발자 테이블 데이터 검증, 템플릿 다운로드 및 일괄 업로드 관리",
    "scopeInfo": "테스트 배치 ID(test_batch_id), 테스트 계약/배차/자산 건수, 스트레스 주입 축(공간/물리/시간/비용/수량)",
    "cognitiveSequence": [
      "1. 데이터베이스 DDL 스키마 및 마이그레이션 모드 스코핑",
      "2. 로컬 스키마 정의(schema.sql)와 원격 Supabase 정합성 자가 검증 (헌장 5.3)",
      "3. 신규 컬럼 및 테이블 추가 DDL 스크립트 프리뷰",
      "4. RLS(Row Level Security) 정책 멱등성 DROP/CREATE DDL 생성",
      "5. 마이그레이션 안전성 검증 및 백업 스냅샷 확인",
      "6. DDL 실행 및 테이블 스키마 캐시 리프레시",
      "7. DB 스키마 조회 완료 및 전사 시스템 Ready 상태 확정"
    ],
    "auditResult": "테이블 스키마 정합성 검증 완료 및 데이터 무결 적재 종결",
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
        "selector": "[data-mid=\"dev_uploader-download-template\"]",
        "label": "테이블 템플릿",
        "description": "선택 테이블 표준 엑셀 서식 다운로드",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dev_uploader-download-current\"]",
        "label": "현재 데이터 백업",
        "description": "현재 DB 저장 데이터 백업 엑셀 추출",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"dev_uploader-validate-btn\"]",
        "label": "데이터 검증",
        "description": "스키마 타입 및 필수값 정합성 검증",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"dev_uploader-upload-btn\"]",
        "label": "DB 일괄 업로드",
        "description": "검증 완료 데이터베이스 테이블 적재",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "seq": 1,
        "selector": "[data-mid=\"schema-mode-tabs\"], .schema-tabs",
        "type": "highlight",
        "label": "스키마 DDL 모드",
        "description": "[스키마 DDL 모드] 화면 영역입니다. 테이블 정의, 인덱스 생성, RLS 보안 정책 모드를 스코핑하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"btn-validate-schema-ssot\"], button:contains(\"정합성 검증\")",
        "type": "highlight",
        "label": "SSOT 스키마 정합성 검증",
        "description": "[SSOT 스키마 정합성 검증] 화면 영역입니다. 로컬 schema.sql과 원격 DB 간 컬럼 누락 여부를 자동 대조하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      }
    ],
    "processes": [
      {
        "processId": "main_process",
        "title": "핵심 단위 업무 조작 흐름",
        "description": "[개발] DB 데이터 업로더의 주요 기능 조작 절차입니다.",
        "steps": [
          {
            "seq": 1,
            "selector": "[data-mid=\"schema-mode-tabs\"], .schema-tabs",
            "type": "click_ripple",
            "label": "스키마 DDL 모드",
            "description": "[스키마 DDL 모드] UI 요소에 값을 입력하거나 조작합니다. 테이블 정의, 인덱스 생성, RLS 보안 정책 모드를 스코핑하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"btn-validate-schema-ssot\"], button:contains(\"정합성 검증\")",
            "type": "click_ripple",
            "label": "SSOT 스키마 정합성 검증",
            "description": "[SSOT 스키마 정합성 검증] UI 요소에 값을 입력하거나 조작합니다. 로컬 schema.sql과 원격 DB 간 컬럼 누락 여부를 자동 대조하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 3,
            "selector": "[data-mid=\"ddl-editor-textarea\"], textarea.ddl-editor",
            "type": "click_ripple",
            "label": "DDL 스크립트 에디터",
            "description": "[DDL 스크립트 에디터] UI 요소를 확인합니다. 실행될 CREATE/ALTER TABLE DDL SQL 구문을 확인하고 편집하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 4,
            "selector": "[data-mid=\"btn-generate-rls-ddl\"], button:contains(\"RLS DDL 생성\")",
            "type": "click_ripple",
            "label": "RLS 멱등성 DDL 생성",
            "description": "[RLS 멱등성 DDL 생성] UI 요소에 값을 입력하거나 조작합니다. DROP IF EXISTS를 선행하는 멱등성 보안 정책 DDL을 동적 생성하십시오.",
            "positionHint": "bottom"
          },
          {
            "seq": 5,
            "selector": "[data-mid=\"safety-backup-checkbox\"], .safety-check",
            "type": "click_ripple",
            "label": "안전 스냅샷 확인",
            "description": "[안전 스냅샷 확인] UI 요소를 확인합니다. 스키마 수정 전 데이터 손실 방지를 위한 백업 스냅샷을 확인하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 6,
            "selector": "[data-mid=\"btn-execute-ddl\"], button:contains(\"DDL 실행\")",
            "type": "click_ripple",
            "label": "원격 DDL 적용 실행",
            "description": "[원격 DDL 적용 실행] UI 요소에 값을 입력하거나 조작합니다. 원격 Supabase DB에 DDL을 즉각 실행하여 스키마를 업데이트하십시오.",
            "positionHint": "top"
          },
          {
            "seq": 7,
            "selector": "[data-mid=\"schema-ready-status\"], .ready-status",
            "type": "click_ripple",
            "label": "시스템 준비 완료 확정",
            "description": "[시스템 준비 완료 확정] UI 요소에 값을 입력하거나 조작합니다. 스키마 캐시를 갱신하고 ERP 시스템 Ready 신호를 전사에 공표하십시오.",
            "positionHint": "bottom"
          }
        ]
      }
    ]
  },
  {
    "menuId": "official_mail",
    "version": 8,
    "menuName": "공식 메일 발송",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부 / 고객센터",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "거래처 대상 최고장, 공문, 계약 서류 등 공식 문서 전자 발송",
    "scopeInfo": "고객사, 담당자 이메일, 현장명, 견적 템플릿(장비기종, 임대료, 운송비)",
    "cognitiveSequence": [
      "1. 좌측 패널에서 수신 대상 고객사, 현장 및 담당자 선택",
      "2. 발송 서식 템플릿(견적서/회사소개서/제원표) 선택",
      "3. 자동 완성된 메일 제목, 본문 및 첨부 파일 확인/편집",
      "4. 우하단 이메일 발송 버튼 클릭하여 공식 발신 완료"
    ],
    "auditResult": "발송 문서 스토리지 저장 및 이메일 전송 성공 로그 무누락 기록",
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
        "description": "[수신 대상 지정] 화면 영역입니다. 고객사, 현장, 담당자 및 수신 이메일 주소를 선택하는 기본 기능을 제공합니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"mail-terminal-send\"]",
        "type": "click_ripple",
        "label": "공식 메일 발송",
        "description": "[공식 메일 발송] 화면 영역입니다. 작성된 본문과 첨부 파일을 회사 공식 계정으로 전송하는 기본 기능을 제공합니다.",
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
            "description": "[수신 거래처 지정] UI 요소를 조작합니다. 견적서를 수신할 고객사와 담당자를 선택하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"mail-terminal-send\"]",
            "type": "click_ripple",
            "label": "견적 메일 발송",
            "description": "[견적 메일 발송] UI 요소에 값을 입력하거나 조작합니다. 버튼을 눌러 공식 견적서를 전송하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"mail-recipient-panel\"]",
        "label": "수신자 지정",
        "description": "거래처 담당자 이메일 스코프",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"mail-composer-panel\"]",
        "label": "공문서 작성기",
        "description": "공식 최고장/공문 본문 및 첨부 증빙",
        "colorToken": "PURPLE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"mail-terminal-send\"]",
        "label": "전자 공문 발송",
        "description": "공식 메일 발송 및 감사 로그 보존",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ]
  },
  {
    "menuId": "public_construction_permits",
    "version": 8,
    "menuName": "인허가 건축공정 조회",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업부 / 전략기획팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "공공 인허가 건축 데이터 조회를 통한 관내 착공 현장 및 잠재 영업 기회 발굴",
    "scopeInfo": "전국 17개 시도/시군구 인허가 공정 데이터, 도로폭(V-World), CSI 안전계획 의무 여부",
    "cognitiveSequence": [
      "1. 상단 필터 바에서 지역(시도/시군구) 및 공정 단계(마감·설비 골든타임) 선택",
      "2. 좌측 그리드에서 도로폭 및 예상 소요 대수 검토 후 대상 행 선택",
      "3. 우측 AI 역산 스튜디오에서 추천 장비 및 안전 서류 확인",
      "4. 우측 하단 [1클릭 영업 리드 및 현장 등록] 완결"
    ],
    "auditResult": "신규 착공 현장 데이터베이스 동기화 및 영업 파이프라인 연계 확정",
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
        "description": "[인허가 건축공정 대장] 화면 영역입니다. 전국 공공 건축 허가 및 착공 현황을 실시간 조망하는 기본 기능을 제공합니다.",
        "positionHint": "right"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"permits-dossier-panel\"]",
        "type": "highlight",
        "label": "인공지능 공정 역산 작업대",
        "description": "[인공지능 공정 역산 작업대] 화면 영역입니다. 선택 현장의 고소작업대 적기 투입 시점 및 추천 기종을 분석하는 기본 기능을 제공합니다.",
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
            "description": "[건축 현장 선택] UI 요소를 조작합니다. 골든타임 표식이 붙은 A급 추천 현장을 클릭하십시오.",
            "positionHint": "right"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"permits-dossier-panel\"]",
            "type": "highlight",
            "label": "장비 제원 분석",
            "description": "[장비 제원 분석] UI 요소를 확인합니다. 추천 장비 기종(GS-1930 등)과 필요 대수를 확인하십시오.",
            "positionHint": "left"
          }
        ]
      }
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"permits-pipeline-fetch\"]",
        "label": "인허가 데이터 수집",
        "description": "공공 건축 인허가 데이터베이스 동기화",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"permits-inspection-grid\"]",
        "label": "착공 현장 대장",
        "description": "관내 신규 착공 및 골조 공정 현황 그리드",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"permits-dossier-panel\"]",
        "label": "현장 상세 도시에",
        "description": "시공사, 연면적, 층수 및 잠재 렌탈 수요 분석",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"permits-pipeline-excel\"]",
        "label": "영업 리스트 내보내기",
        "description": "잠재 타겟 현장 엑셀 데이터 추출",
        "colorToken": "AMBER",
        "type": "STAMP"
      }
    ]
  },
  {
    "menuId": "tenant_management",
    "version": 8,
    "menuName": "테넌트 관리",
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "최고관리자",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "멀티 테넌트 환경 고객사 코드, 격리 정책, 권한 및 서비스 온보딩 관리",
    "scopeInfo": "테넌트 영문 코드, 표시 상호, 사업자번호, 구독 플랜, 만료일자",
    "cognitiveSequence": [
      "1. 테넌트 검색어(상호, 코드, 사업자번호) 및 구독 상태 스코핑",
      "2. 신규 테넌트 등록 또는 기존 테넌트 설정 진입",
      "3. 구독 플랜(TRIAL, BASIC, PRO, ENTERPRISE) 및 라이선스 만료일 확정",
      "4. 테넌트 마스터 저장 및 대상 테넌트 작업공간 즉시 전환 검증"
    ],
    "auditResult": "테넌트 데이터 격리 보장 및 신규 테넌트 초기화 완결",
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
        "description": "[테넌트 검색 및 필터] 화면 영역입니다. 상호명, 테넌트 코드, 사업자등록번호를 입력하여 관리 대상을 신속 검색하는 기본 기능을 제공합니다.",
        "positionHint": "bottom"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"tenant-inspection-grid\"]",
        "type": "highlight",
        "label": "테넌트 마스터 대장",
        "description": "[테넌트 마스터 대장] 화면 영역입니다. 가동 상태, 구독 플랜, 만료일자, 대표자 및 브랜드 에셋을 한눈에 조망하는 기본 기능을 제공합니다.",
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
            "description": "[테넌트 등록 버튼 클릭] UI 요소를 조작합니다. 우상단의 [테넌트 등록] 버튼을 클릭하여 설정 모달을 엽니다.",
            "positionHint": "bottom"
          },
          {
            "seq": 2,
            "selector": "[data-mid=\"tenant-inspection-grid\"]",
            "type": "highlight",
            "label": "등록 결과 확인",
            "description": "[등록 결과 확인] UI 요소를 확인합니다. 그리드 대장에서 신규 생성된 테넌트의 가동 상태와 구독 만료일을 확인하십시오.",
            "positionHint": "top"
          }
        ]
      }
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"tenant-scope-search\"]",
        "label": "테넌트 검색",
        "description": "고객사 테넌트 코드 및 상호 검색",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"tenant-scope-status\"]",
        "label": "상태 필터",
        "description": "활성, 대기, 정지 테넌트 스코핑",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"tenant-pipeline-excel\"]",
        "label": "엑셀 내보내기",
        "description": "전사 테넌트 목록 엑셀 추출",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"tenant-pipeline-onboard\"]",
        "label": "온보딩 실행",
        "description": "신규 테넌트 초기 데이터베이스 프로비저닝",
        "colorToken": "GREEN",
        "type": "CALLOUT"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"tenant-pipeline-add\"]",
        "label": "테넌트 추가",
        "description": "신규 고객사 테넌트 등록",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 6,
        "selector": "[data-mid=\"tenant-inspection-grid\"]",
        "label": "테넌트 관리 대장",
        "description": "테넌트별 계약 기간, 계정수, 격리 정책",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ]
  },
  {
    "menuId": "trade_products",
    "menuName": "상품 등록 및 관리",
    "groupId": "grp_distribution",
    "groupName": "영업-유통",
    "department": "유통 영업",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "유통 판매 상품 SKU 등록, 매입가/판매가 설정 및 재고 규격 관리",
    "scopeInfo": "분류 카테고리, 판매 상태(단종/진행) 및 재고 현황",
    "cognitiveSequence": [
      "1. 좌상단 검색 필터에서 상품군 및 상태 선택",
      "2. 우상단 '신규 등록' 또는 '엑셀 업로드'로 상품 마스터 유입",
      "3. 중앙 고밀도 그리드에서 품목명, 단가, 원가 산정방식 확인 및 인라인 수정",
      "4. 우하단 '변경 저장' 버튼으로 상품 정보 원장 갱신 마감"
    ],
    "auditResult": "상품 SKU 고유성 확보 및 유통 상품 마스터 등록 확정",
    "rulesCompliance": [
      "3.1 무수식어 건조한 표기 원칙 준수",
      "3.6 고밀도 그리드 아키타입 적용"
    ],
    "precautions": [
      "렌탈 장비(Assets)와 상품(TradeGoods) 마스터가 섞이지 않도록 ItemType 엄격 격리"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"trade_products-sku-input\"]",
        "label": "SKU 코드 입력",
        "description": "유통 상품 고유 식별 코드",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"trade_products-name-input\"]",
        "label": "상품명 입력",
        "description": "판매 상품 품목명",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"trade_products-price-input\"]",
        "label": "판매 단가",
        "description": "기준 공급 단가 설정",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"trade_products-add-btn\"]",
        "label": "상품 등록",
        "description": "신규 유통 상품 마스터 추가",
        "colorToken": "GREEN",
        "type": "STAMP"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"trade_products-table\"]",
        "label": "상품 대장 그리드",
        "description": "등록 상품 재고 및 단가 현황",
        "colorToken": "BLUE",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "id": "tp_bg_1",
        "title": "검색 필터",
        "text": "좌상단의 카테고리와 판매 상태 드롭다운을 통해 관리할 상품을 좁힙니다.",
        "elementSelector": ".filter-group"
      },
      {
        "id": "tp_bg_2",
        "title": "상품 그리드",
        "text": "중앙 표에서 상품의 단가와 이동평균원가(COGS) 방식을 한눈에 확인합니다.",
        "elementSelector": ".grid-container"
      }
    ],
    "processes": [
      {
        "id": "tp_proc_1",
        "title": "신규 상품 등록 흐름",
        "steps": [
          {
            "text": "우상단 [신규 등록] 버튼을 클릭하세요.",
            "selector": ".btn-new"
          },
          {
            "text": "입력창에 [상품명]과 [표준 판매가]를 입력하세요.",
            "selector": "input[name='itemName']"
          },
          {
            "text": "우하단의 [변경 저장]을 눌러 상품 원장에 등록을 완결하세요.",
            "selector": ".btn-save"
          }
        ]
      }
    ],
    "version": 3
  },
  {
    "menuId": "trade_purchases",
    "menuName": "구매 및 입고",
    "groupId": "grp_distribution",
    "groupName": "영업-유통",
    "department": "유통 물류/구매",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "유통 상품 발주서 작성, 입고 검수 및 재고 증가 반영",
    "scopeInfo": "입고 대기 중인 발주서 내역 및 입고 예정일자",
    "cognitiveSequence": [
      "1. 좌상단에서 매입처와 입고 연월을 스코핑",
      "2. 우상단 '발주서 업로드'로 구매 내역 파이프라인 유입",
      "3. 중앙 그리드에서 입고 예정 수량과 실제 하차/검수 수량을 1:1 대사",
      "4. 우하단 '입고 일괄 확정' 버튼으로 가용 재고 가산 및 매입채무 발생 확정"
    ],
    "auditResult": "발주 수량 = 입고 수량 일치 및 상품 재고 원장 자동 가산",
    "rulesCompliance": [
      "5.2 무음 실패 방지 (입고 트랜잭션 동기화)",
      "수량 보존 법칙"
    ],
    "precautions": [
      "부분 입고(Partial Received) 시 잔여 수량 관리 주의",
      "단가 변동 시 기존 재고 가치 희석 방지(LOT 기반 추적)"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"trade_purchases-header\"]",
        "label": "구매 입고 헤더",
        "description": "유통 상품 발주 및 입고 검수 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"trade_purchases-add-btn\"]",
        "label": "발주 등록",
        "description": "신규 매입 발주서 작성",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"trade_purchases-table\"]",
        "label": "발주/입고 대장",
        "description": "발주 건별 수량, 단가, 입고 상태",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"trade_purchases-confirm-btn\"]",
        "label": "입고 확정",
        "description": "실물 입고 검수 완료 및 재고 반영",
        "colorToken": "AMBER",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "id": "tpu_bg_1",
        "title": "입고 대기 목록",
        "text": "좌상단의 필터를 통해 입고 처리가 필요한 발주 건들을 화면에 호출합니다.",
        "elementSelector": ".filter-group"
      },
      {
        "id": "tpu_bg_2",
        "title": "수량 대사 그리드",
        "text": "발주서 수량과 현장 검수 수량의 차액을 중앙 테이블에서 직접 확인합니다.",
        "elementSelector": ".grid-container"
      }
    ],
    "processes": [
      {
        "id": "tpu_proc_1",
        "title": "상품 입고 검수 및 확정",
        "steps": [
          {
            "text": "중앙 그리드에서 [실제 입고 수량] 셀을 클릭하고 숫자를 입력하세요.",
            "selector": ".qty-input"
          },
          {
            "text": "수량 불일치 시 우측 셀의 [사유] 드롭다운에서 파손/오배송을 선택하세요.",
            "selector": ".reason-select"
          },
          {
            "text": "우하단의 [입고 일괄 확정] 버튼을 눌러 재고 수불부에 더하세요.",
            "selector": ".btn-confirm"
          }
        ]
      }
    ],
    "version": 3
  },
  {
    "menuId": "trade_contracts",
    "menuName": "유통 수주(계약)",
    "groupId": "grp_distribution",
    "groupName": "영업-유통",
    "department": "유통 영업",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "유통 상품 판매 견적, 고객 수주 등록 및 납품 계약 체결 관리",
    "scopeInfo": "고객 마스터 정보 및 가용 재고(Available Qty) 현황",
    "cognitiveSequence": [
      "1. 좌상단 고객사 정보 세팅",
      "2. 우상단 에이전트 [초안 작성] 호출 또는 상품 직접 검색 유입",
      "3. 중앙 카드에서 품목별 수량, 단가, 할인율, 인도 조건(특약) 세부 컨텍스트 조율",
      "4. 우하단 '수주 체결 승인' 버튼으로 거래 명세 확정 및 물류 부서로 출고 지시 하달"
    ],
    "auditResult": "수주 전표 발행 및 납품 대기 상태 확정",
    "rulesCompliance": [
      "3.6 마스터-디테일 카드형 설계",
      "3.7 AI 에이전트 Slop 방지 (건조한 버튼 적용)"
    ],
    "precautions": [
      "마진율 미달 시 시스템 알림 및 관리자 승인 대기(Hard Lock)"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"trade_contracts-header\"]",
        "label": "유통 수주 헤더",
        "description": "고객 수주 등록 및 판매 계약 체결",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"trade_contracts-qty-input\"]",
        "label": "수주 수량",
        "description": "판매 납품 수량 지정",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"trade_contracts-create-btn\"]",
        "label": "수주 전표 생성",
        "description": "판매 수주 계약서 체결",
        "colorToken": "GREEN",
        "type": "STAMP"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"trade_contracts-cards\"]",
        "label": "수주 현황 카드",
        "description": "진행 중인 유통 수주 계약 덱",
        "colorToken": "BLUE",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "id": "tc_bg_1",
        "title": "수주 기본 정보",
        "text": "상단에서 고객사명과 납기 예정일, 결제 조건 등 계약의 기본 골격을 확인합니다.",
        "elementSelector": ".header-info"
      },
      {
        "id": "tc_bg_2",
        "title": "품목 상세 카드",
        "text": "중앙 영역에서 어떤 상품을 얼마에 몇 개 판매할지 상세 조건을 입력합니다.",
        "elementSelector": ".card-container"
      }
    ],
    "processes": [
      {
        "id": "tc_proc_1",
        "title": "신규 수주 체결 흐름",
        "steps": [
          {
            "text": "좌상단의 [고객사 검색] 창에 기업명을 입력하여 대상을 지정하세요.",
            "selector": ".customer-search"
          },
          {
            "text": "우상단의 [양식 자동 채우기] 버튼을 누르거나 중앙의 [품목 추가]를 통해 판매할 상품을 나열하세요.",
            "selector": ".btn-add-item"
          },
          {
            "text": "각 상품별 [수량] 및 [단가] 입력칸에 숫자를 기입하고 이윤율을 확인하세요.",
            "selector": ".item-qty-input"
          },
          {
            "text": "우하단의 [수주 체결 승인] 버튼을 클릭해 물류팀으로 출고 지시를 넘기세요.",
            "selector": ".btn-submit"
          }
        ]
      }
    ],
    "version": 3
  },
  {
    "menuId": "trade_outbounds",
    "menuName": "출고 요청",
    "groupId": "grp_distribution",
    "groupName": "영업-유통",
    "department": "유통 물류/구매",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "수주 상품 재고 할당, 출고 지시 및 패킹 검수 관리",
    "scopeInfo": "승인된 수주 내역(Sales Order) 및 창고별 물리적 재고(On-hand Qty) 상황",
    "cognitiveSequence": [
      "1. 좌상단 출고 요청 번호 및 납기일 확인",
      "2. 우상단 '재고 할당' 실행을 통해 가용 창고 매핑",
      "3. 중앙 카드에서 출고 검수 내역, 합포장 여부, 현장 특이사항 메모 확인",
      "4. 우하단 '출고 승인' 버튼으로 물리 재고 차감 및 송장 출력 대기 전이"
    ],
    "auditResult": "출고 수량만큼 재고 차감 및 택배/화물 배송 대기열 이관",
    "rulesCompliance": [
      "1.4 전사 단일 의미 표준화 (배차 vs 출고 구분)",
      "Z-Pattern 시선 흐름"
    ],
    "precautions": [
      "재고 부족 시 무음 실패 방지 (에러 모달 표출 및 할당 보류)"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"trade_outbounds-header\"]",
        "label": "출고 요청 헤더",
        "description": "수주 상품 재고 할당 및 패킹 지시",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"trade_outbounds-allocate-btn\"]",
        "label": "재고 할당 확정",
        "description": "출고 상품 재고 차감 및 배송 이관",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "id": "to_bg_1",
        "title": "출고 지시 요약",
        "text": "상단에서 언제 어디로 보내야 하는지 수주 지시 원문을 확인합니다.",
        "elementSelector": ".request-summary"
      },
      {
        "id": "to_bg_2",
        "title": "피킹/패킹 작업대",
        "text": "중앙 카드에서 실제 창고의 어느 구역에서 물건을 꺼낼지(피킹) 할당 상태를 봅니다.",
        "elementSelector": ".picking-card"
      }
    ],
    "processes": [
      {
        "id": "to_proc_1",
        "title": "재고 할당 및 출고 승인",
        "steps": [
          {
            "text": "우상단의 [재고 할당] 버튼을 눌러 부족한 재고가 없는지 시스템 연산을 실행하세요.",
            "selector": ".btn-allocate"
          },
          {
            "text": "중앙의 현장 특이사항(포장 주의 등) 텍스트를 읽고 검수 체크박스를 틱(V) 하세요.",
            "selector": ".checkbox-inspect"
          },
          {
            "text": "우하단의 [출고 승인] 버튼을 눌러 재고를 완전히 차감하고 배송 파트너에게 넘기세요.",
            "selector": ".btn-approve"
          }
        ]
      }
    ],
    "version": 3
  },
  {
    "menuId": "courier_dispatch",
    "menuName": "택배 배송 관리",
    "groupId": "grp_distribution",
    "groupName": "영업-유통",
    "department": "유통 물류/구매",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "택배 운송장 번호 등록, 출고 배송 추적 및 수령 확인 관리",
    "scopeInfo": "당일 출고 승인(PACKED)된 전체 유통 주문 건",
    "cognitiveSequence": [
      "1. 좌상단 배송 희망일 및 택배사(로젠/경동 등) 필터 적용",
      "2. 우상단 '운송장 일괄 다운로드'로 택배사 연동 파이프라인 유입",
      "3. 중앙 고밀도 그리드에서 운송장 번호 부여 상태 및 주소지 인라인 대사",
      "4. 우하단 '배송 일괄 마감' 버튼으로 고객에게 송장 문자 발송 및 마감"
    ],
    "auditResult": "운송장 매핑 100% 및 배송 완료 상태 전이",
    "rulesCompliance": [
      "3.1 무수식어 원칙 (배송 vs 배차 의미 분리 적용)",
      "3.2 셀 줄바꿈 방지(nowrap)"
    ],
    "precautions": [
      "렌탈 화물 배차(TruckDispatch)와 달리 중량/제원보다 주소 및 송장 번호 정확도 최우선"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"courier_dispatch-header\"]",
        "label": "택배 배송 헤더",
        "description": "택배 운송장 등록 및 배송 관제",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"courier_dispatch-table\"]",
        "label": "배송 대장",
        "description": "주문별 택배사, 운송장번호, 배송 상태",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"courier_dispatch-dispatch-btn\"]",
        "label": "배송 출발 확정",
        "description": "택배 인계 및 배송중 상태 전이",
        "colorToken": "AMBER",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "id": "cd_bg_1",
        "title": "발송 목록 필터",
        "text": "좌상단에서 오늘 발송해야 할 택배사별 물량을 좁혀서 조회합니다.",
        "elementSelector": ".filter-group"
      },
      {
        "id": "cd_bg_2",
        "title": "송장 맵핑 그리드",
        "text": "중앙 표에서 고객 주소와 부여된 택배 운송장 번호가 올바르게 매칭되었는지 확인합니다.",
        "elementSelector": ".grid-container"
      }
    ],
    "processes": [
      {
        "id": "cd_proc_1",
        "title": "송장 부여 및 배송 마감",
        "steps": [
          {
            "text": "우상단 [엑셀 송장 업로드] 버튼을 클릭해 택배사에서 받은 운송장 번호 파일을 업로드하세요.",
            "selector": ".btn-upload-invoice"
          },
          {
            "text": "중앙 그리드의 [운송장 번호] 칸에 빈칸이 없는지 시각적으로 확인하세요.",
            "selector": ".invoice-cell"
          },
          {
            "text": "우하단의 [배송 일괄 마감] 버튼을 클릭해 고객에게 발송 알림을 보내세요.",
            "selector": ".btn-dispatch"
          }
        ]
      }
    ],
    "version": 3
  },
  {
    "menuId": "trade_billing",
    "menuName": "유통 청구 및 명세",
    "groupId": "grp_distribution",
    "groupName": "영업-유통",
    "department": "경영 지원",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "유통 판매 매출 청구서 산출, 세금계산서 발행 및 수납 대사",
    "scopeInfo": "정산 연월, 고객사별 출고 완료(SHIPPED/DELIVERED) 매출 건",
    "cognitiveSequence": [
      "1. 좌상단 정산 연월(마감월) 및 수금 조건 필터",
      "2. 우상단 '데이터 불러오기'를 통해 미청구 매출 건 파이프라인 유입",
      "3. 중앙 고밀도 그리드에서 거래처별 누적 매출액, 기청구액, 잔액 인라인 차액 분석",
      "4. 우하단 `청구총액 = 확정액 | 차액 ₩0` 수식 확인 후 '명세서 일괄 발행' 완결"
    ],
    "auditResult": "유통 매출액 = 수납 확정액 + 미수잔액 | 대차 차액 ₩0",
    "rulesCompliance": [
      "3.5 Z-Pattern 목적 지향 설계 질문 준수",
      "대차대조 완결(₩0 오차) 강제"
    ],
    "precautions": [
      "렌탈의 일할 계산과 달리, 유통은 수량*단가의 일시 확정 청구임을 주의"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"trade_billing-header\"]",
        "label": "유통 청구 헤더",
        "description": "판매 매출 청구서 및 세금계산서 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"trade_billing-table\"]",
        "label": "유통 청구 대장",
        "description": "거래처별 납품 청구액, 수납액, 미수금",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"trade_billing-issue-btn\"]",
        "label": "세금계산서 발행",
        "description": "유통 매출 전자세금계산서 발행",
        "colorToken": "AMBER",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "id": "tb_bg_1",
        "title": "청구 대상 스코프",
        "text": "좌상단 달력에서 마감할 월을 선택하여 미청구된 유통 판매 내역을 부릅니다.",
        "elementSelector": ".filter-month"
      },
      {
        "id": "tb_bg_2",
        "title": "대차대조 및 차액 검증",
        "text": "중앙 표와 우하단 요약 영역에서 받을 돈과 발행할 명세서 금액의 차이가 ₩0 인지 검증합니다.",
        "elementSelector": ".audit-summary"
      }
    ],
    "processes": [
      {
        "id": "tb_proc_1",
        "title": "매출 마감 및 명세서 발행",
        "steps": [
          {
            "text": "우상단 [미청구액 불러오기] 버튼을 눌러 지난달 판매액을 모두 끌어오세요.",
            "selector": ".btn-fetch"
          },
          {
            "text": "중앙 그리드에서 청구 대상 거래처 좌측의 [체크박스]를 모두 선택하세요.",
            "selector": ".row-checkbox"
          },
          {
            "text": "우하단의 [명세서 일괄 발행] 버튼을 클릭하여 청구서를 확정하세요.",
            "selector": ".btn-issue"
          }
        ]
      }
    ],
    "version": 3
  },
  {
    "menuId": "trade_returns",
    "menuName": "환입 및 반품",
    "groupId": "grp_distribution",
    "groupName": "영업-유통",
    "department": "유통 물류/구매",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "고객 반품 접수, 불량 검수, 양품 재입고 및 환불/대손 처리",
    "scopeInfo": "고객 반환 접수 건 및 원본 수주 계약(Sales Order) 내역",
    "cognitiveSequence": [
      "1. 좌상단 반품 접수 번호 스코핑",
      "2. 우상단 '원계약 조회'로 과거 출고 단가 및 LOT 이력 유입",
      "3. 중앙 폼에서 육안 검수 사진 첨부 및 양품/불량 판정 사유 기입",
      "4. 우하단 '환입 완료' 버튼으로 가용 재고 가산(양품) 또는 손실/RMA 원장 기록(불량)"
    ],
    "auditResult": "반품 수량 = 양품 입고 + 폐기 수량 보존 및 매출 차감 반영",
    "rulesCompliance": [
      "재고 임의 조작 영구 엄단 (상태 기반 논리 전이)",
      "3.4 레이블-입력 필드 상하 스택 배치"
    ],
    "precautions": [
      "반환 시 최초 출고되었던 동일 LOT 원가로 환원해야 회계 마진이 왜곡되지 않음"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"trade_returns-header\"]",
        "label": "환입/반품 헤더",
        "description": "고객 반품 접수 및 불량 검수 관리",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"trade_returns-table\"]",
        "label": "반품 대장",
        "description": "반품 접수 품목, 반품 사유, 수량",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"trade_returns-btn-sellable\"]",
        "label": "양품 재입고",
        "description": "정상 상품 재고 원장 복원",
        "colorToken": "GREEN",
        "type": "STAMP"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"trade_returns-btn-defective\"]",
        "label": "불량 폐기 확정",
        "description": "불량품 폐기 손실 처리",
        "colorToken": "RED",
        "type": "STAMP"
      }
    ],
    "basicGuide": [
      {
        "id": "tr_bg_1",
        "title": "반품 원계약 추적",
        "text": "상단에서 고객이 언제, 얼마에 사간 물건인지 원본 판매 이력을 대조합니다.",
        "elementSelector": ".original-contract-info"
      },
      {
        "id": "tr_bg_2",
        "title": "검수 및 판정 영역",
        "text": "중앙 화면에서 박스 개봉 사진을 첨부하고 다시 팔 수 있는지 없는지를 기록합니다.",
        "elementSelector": ".inspection-form"
      }
    ],
    "processes": [
      {
        "id": "tr_proc_1",
        "title": "상품 반환 검수 및 환입",
        "steps": [
          {
            "text": "우상단 [원계약 조회] 버튼을 눌러 과거 판매 기록을 팝업으로 띄워 확인하세요.",
            "selector": ".btn-view-origin"
          },
          {
            "text": "중앙 폼의 [검수 상태] 드롭다운에서 '정상(재판매)' 또는 '불량(수리/폐기)'을 정확히 선택하세요.",
            "selector": "select[name='condition']"
          },
          {
            "text": "우하단의 [환입 완료] 버튼을 눌러 재고와 회계 원장에 반품을 확정하세요.",
            "selector": ".btn-return"
          }
        ]
      }
    ],
    "version": 3
  },
  {
    "menuId": "trade_profitability",
    "menuName": "수익성 관리",
    "groupId": "grp_distribution",
    "groupName": "영업-유통",
    "department": "경영 지원",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "유통 상품별 매출액, 매입원가, 배송비 차감 및 마진율 분석",
    "scopeInfo": "분석 기간 및 특정 상품군, 거래처 필터",
    "cognitiveSequence": [
      "1. 좌상단 조회 연월 및 상품군 조건 지정",
      "2. 우상단 '분석 실행'으로 DB 원장(Ledger) 실시간 연산 유입",
      "3. 중앙 고밀도 그리드에서 품목별 총매출, 매출원가, 순수익, 마진율 차액 대조",
      "4. 우하단 총합 마진율 수식 확인 후 '마감' 또는 '엑셀 내보내기' 완결"
    ],
    "auditResult": "총수익 = 총매출 - (매입원가 + 배송비) | 수익성 지표 100% 산출",
    "rulesCompliance": [
      "5.1 2단계 검증(스키마 기반 수학적 정합성) 준수",
      "AI Slop 방어 (그래프/차트 떡칠 배제하고 고밀도 숫자 그리드 유지)"
    ],
    "precautions": [
      "화면 UI상의 단순 뺄셈이 아닌, TradeCogsLedger DB 원장 합산값만을 노출할 것"
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"trade_profitability-header\"]",
        "label": "수익성 분석 헤더",
        "description": "유통 매출, 매입원가, 마진율 종합 분석",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"trade_profitability-kpi\"]",
        "label": "수익성 KPI 지표",
        "description": "총매출액, 순이익, 평균 마진율 실적",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "basicGuide": [
      {
        "id": "tprof_bg_1",
        "title": "마진 분석 스코프",
        "text": "좌상단 필터에서 이번 달 어떤 품목이 얼마나 남았는지 분석할 범위를 정합니다.",
        "elementSelector": ".filter-group"
      },
      {
        "id": "tprof_bg_2",
        "title": "이익률 대차대조표",
        "text": "중앙 표에서 매출액에서 매입원가를 뺀 실제 마진율(%)을 상품별로 건조하게 직관적으로 확인합니다.",
        "elementSelector": ".grid-container"
      }
    ],
    "processes": [
      {
        "id": "tprof_proc_1",
        "title": "월간 유통 수익성 결산",
        "steps": [
          {
            "text": "좌상단 [분석 기간] 달력을 눌러 지난달 1일부터 말일까지로 세팅하세요.",
            "selector": ".date-picker"
          },
          {
            "text": "우상단 [분석 실행] 버튼을 눌러 DB에 저장된 확정 원가와 매출액을 계산해 오세요.",
            "selector": ".btn-analyze"
          },
          {
            "text": "우하단의 [총 마진율 %]를 확인하고, 보고서 제출을 위해 [엑셀 내보내기]를 누르세요.",
            "selector": ".btn-export"
          }
        ]
      }
    ],
    "version": 3
  },
  {
    "menuId": "custom_billing",
    "version": 3,
    "menuName": "특수 거래명세서 (특수청구) 작성",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업관리팀 / 회계팀",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "비정형 렌탈료, 소모품 실비, 현장 위약금 등 특수 품목 거래명세서 수기 작성",
    "scopeInfo": "원청구 전표(Billings) 데이터 및 고객사 요청 품목/단가/수량 변경 사유",
    "cognitiveSequence": [
      "1. 좌상단 원청구 기본 정보(고객사, 현장명, 원공급가액, 원부가세, 원합계금액) 검토",
      "2. 특수 거래명세서 변환 사유 입력 (예: 건설 현장 기성 산출 내역서 양식 준용)",
      "3. 중앙 명세서 품목 목록 행 추가 및 품목명, 규격, 수량, 단가, 공급가액 편집",
      "4. 우하단 대차대조 검증 지표(원청구 합계 vs 특수명세서 품목 합계, 차액 ₩0) 실시간 확인",
      "5. 차액 ₩0 검증 만족 시 [특수 거래명세서 품목 저장] 버튼을 클릭하여 확정 마감"
    ],
    "modalWorkflows": [
      {
        "modalName": "특수 거래명세서 작성 모달",
        "triggerButton": "특수청구 작성",
        "keyFields": [
          "고객사/현장",
          "청구 품목명",
          "수량",
          "단가",
          "공급가액",
          "세액"
        ],
        "terminalAction": "명세서 저장",
        "afterStateTransition": "특수 거래명세서 전표 생성 및 청구 대장 즉시 반영"
      }
    ],
    "auditResult": "특수 품목 합계액 = 청구서 총액 일치 및 매출 대장 연동 반영",
    "rulesCompliance": [
      "헌장 4.1 [자산별 매출 기여액 정밀 집계 정책] 및 회계 보존 법칙 준수: 원청구 총액과 명세서 합계 1원도 불일치 불허 (차액 ₩0 필수)",
      "헌장 3.5 [Gutenberg Z-패턴 표준] 준수: 좌상단 원정보 ➔ 중앙 품목 편집 ➔ 우하단 대차대조 합계 검증 및 확정"
    ],
    "precautions": [
      "원청구 금액과 특수명세서 품목 합계에 단 1원의 오차라도 발생 시 저장 버튼이 비활성화됩니다.",
      "변환 사유는 세무 조사 및 대금 정산 감사 시 증빙자료로 활용되므로 명확히 기재해야 합니다."
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"statement-closing-today-alert\"]",
        "label": "마감 알림 배너",
        "description": "당일 마감 대상 거래처 안내",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"billing-list-table\"]",
        "label": "특수 청구 품목 대장",
        "description": "비정형 품목 및 수기 명세 내역",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"billing-detail-studio\"]",
        "label": "명세서 상세 스튜디오",
        "description": "품목별 단가, 수량, 세액 검증 및 저장",
        "colorToken": "AMBER",
        "type": "STAMP"
      }
    ],
    "processes": [
      {
        "id": "custom_billing_proc_1",
        "title": "특수 거래명세서 품목 구성 및 발행",
        "steps": [
          {
            "text": "청구 대장에서 [특수명세서 작성] 버튼을 클릭하여 모달을 오픈하세요.",
            "selector": ".btn-custom-statement"
          },
          {
            "text": "변환 사유를 입력하고 품목 목록에 행을 추가하여 규격과 금액을 기재하세요.",
            "selector": ".custom-statement-table"
          },
          {
            "text": "우하단 대차 차액 ₩0 표시를 확인한 후 [특수 거래명세서 품목 저장]을 누르세요.",
            "selector": ".btn-save-custom-statement"
          }
        ]
      }
    ]
  },
  {
    "menuId": "stocktaking",
    "version": 3,
    "menuName": "재고/자산 실사",
    "groupId": "grp_inout",
    "groupName": "입출고관리",
    "department": "주기장관리팀 / 정비팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "주기장 바코드 스캔을 통한 실물 자산 및 부품 재고 전수 대사",
    "scopeInfo": "실사 구역(본사 주기장 HQ 또는 정비차량 VEHICLE), 담당 정비사, 실물 바코드/장비호기",
    "cognitiveSequence": [
      "1. 좌상단 실사 구역(본사 주기장 / 정비차량) 및 담당 정비사 선택 후 [실사 시작] 클릭",
      "2. 상단 바코드 입력 필드에 장비 호기 또는 소모품 바코드 스캔/입력",
      "3. 중앙 실사 그리드에서 전산 수량 대비 실물 스캔 수량 및 차이 수량 실시간 모니터링",
      "4. 미확인 품목에 대한 물리적 탐색 및 추가 스캔 완료",
      "5. 우하단 [실사 확정] 버튼 클릭을 통해 전산 재고와 실물 재고 동기화 완료"
    ],
    "modalWorkflows": [],
    "auditResult": "실사 수량 = 전산 수량 | 오차 0건 확정 및 실사 감사 로그 영구 보존",
    "rulesCompliance": [
      "헌장 1.2 [렌탈 도메인 3대 핵심 가치] 준수: 실물 라이프사이클과 전산 재고의 완벽한 1:1 일치",
      "헌장 5.2 [무음 실패 방지] 준수: 실사 확정 시 재고 변경 이력 DB 동기 저장 검증"
    ],
    "precautions": [
      "실사 진행 중에는 해당 구역의 장비 출고 및 소모품 수불 등록을 일시 정지해야 합니다.",
      "바코드가 손상된 장비는 호기 번호를 직접 수동 입력하여 누락을 방지합니다."
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"stocktaking-area-select\"]",
        "label": "실사 구역 선택",
        "description": "주기장 구역 및 자산 분류 스코프",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"stocktaking-start-btn\"]",
        "label": "실사 시작",
        "description": "새 실사 세션 개시",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"stocktaking-barcode-input\"]",
        "label": "바코드 고속 스캔",
        "description": "실물 자산 바코드 리더기 스캔 입력",
        "colorToken": "AMBER",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"stocktaking-inspection-grid\"]",
        "label": "실사 대사 그리드",
        "description": "전산 수량 vs 실물 스캔 수량 오차 비교",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"stocktaking-btn-confirm\"]",
        "label": "실사 최종 확정",
        "description": "실사 오차 0건 확인 및 감사 로그 영구 저장",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "processes": [
      {
        "id": "stocktaking_proc_1",
        "title": "주기장 및 차량 재고 실사 수행",
        "steps": [
          {
            "text": "실사 구역을 선택하고 [실사 시작] 버튼을 누르세요.",
            "selector": ".btn-start-audit"
          },
          {
            "text": "바코드 입력창에 장비/부품 바코드를 연속 스캔하세요.",
            "selector": "input[placeholder*='바코드']"
          },
          {
            "text": "오차 품목을 재확인한 뒤 우하단 [실사 확정]을 눌러 재고를 동기화하세요.",
            "selector": ".btn-confirm-audit"
          }
        ]
      }
    ]
  },
  {
    "menuId": "data_formation",
    "version": 3,
    "menuName": "초기자료형성",
    "groupId": "grp_system_dev",
    "groupName": "시스템관리 - 개발자",
    "department": "시스템운영팀 / DX추진팀",
    "archetype": "유형 B: 기간 조회 및 정산/정리형 (고밀도 그리드)",
    "objective": "엔티티별 템플릿 다운로드, 샘플 데이터 주입, 갭 분석 및 DB 일괄 형성",
    "scopeInfo": "이관 대상 엔티티(고객사 CUSTOMER, 자산 ASSET, 계약 CONTRACT), 원본 엑셀 파일, 필수 컬럼 매핑 규칙",
    "cognitiveSequence": [
      "1. 상단 이관 대상 엔티티 탭(고객사 / 자산 / 계약) 선택",
      "2. [엑셀 업로드] 또는 [샘플 데이터 로드]를 통해 원본 데이터 유입 및 원시 그리드 확인",
      "3. 헤더 자동 매핑 결과 검토 및 미매핑 컬럼 수동 보정",
      "4. [갭 분석 실행]을 클릭하여 필수값 누락, 데이터 타입 결함, 중복 검증 리포트 점검",
      "5. 오류 0건 검증 확인 후 우하단 [DB 일괄 적재] 클릭을 통해 초기 데이터 생성 완료"
    ],
    "modalWorkflows": [],
    "auditResult": "템플릿 유효성 검증 통과 및 대상 엔티티 테이블 DB 적재 완결",
    "rulesCompliance": [
      "헌장 1.4 [1단어 1뜻 표준화] 준수: 레거시 용어를 ERP 전사 표준 엔티티/컬럼명으로 정규화",
      "헌장 5.2 [무음 실패 방지] 준수: 갭 분석 실패 시 오류 행과 원인을 명확히 적발하여 적재 차단"
    ],
    "precautions": [
      "자산(ASSET) 데이터 적재 전 고객사(CUSTOMER) 마스터가 먼저 생성되어 있어야 계약 연동이 가능합니다.",
      "실제 운영 DB에 적재 시 기존 레코드 덮어쓰기 여부를 사전에 반드시 확인해야 합니다."
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"data_formation-entity-tabs\"]",
        "label": "엔티티 탭",
        "description": "고객, 현장, 제품, 자산, 계약 대상 엔티티 선택",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"data_formation-download-template\"]",
        "label": "양식 다운로드",
        "description": "엔티티별 표준 엑셀 템플릿 다운로드",
        "colorToken": "PURPLE",
        "type": "CALLOUT"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"data_formation-sample-inject\"]",
        "label": "샘플 주입",
        "description": "테스트용 무결 샘플 데이터 자동 채움",
        "colorToken": "AMBER",
        "type": "CALLOUT"
      },
      {
        "seq": 4,
        "selector": "[data-mid=\"data_formation-file-upload\"]",
        "label": "파일 업로드",
        "description": "작성 완료된 엑셀 파일 업로드",
        "colorToken": "BLUE",
        "type": "CALLOUT"
      },
      {
        "seq": 5,
        "selector": "[data-mid=\"data_formation-preview-table\"]",
        "label": "데이터 미리보기",
        "description": "업로드 데이터 유효성 사전 검증",
        "colorToken": "GREEN",
        "type": "HIGHLIGHT_BOX"
      }
    ],
    "processes": [
      {
        "id": "data_formation_proc_1",
        "title": "초기 엑셀 데이터 이관 및 적재",
        "steps": [
          {
            "text": "대상 엔티티를 선택하고 엑셀 파일을 업로드하세요.",
            "selector": ".btn-upload-excel"
          },
          {
            "text": "헤더 매핑을 확인하고 [갭 분석] 버튼을 눌러 오류를 검사하세요.",
            "selector": ".btn-gap-analysis"
          },
          {
            "text": "결함 0건 상태에서 [DB 일괄 적재]를 클릭하여 데이터를 형성하세요.",
            "selector": ".btn-insert-db"
          }
        ]
      }
    ],
    "subTabs": [
      {
        "tabId": "customers",
        "tabName": "고객사 형성",
        "purpose": "고객사 마스터 데이터 생성",
        "keyActions": [
          "샘플 주입",
          "엑셀 업로드",
          "DB 적재"
        ]
      },
      {
        "tabId": "sites",
        "tabName": "현장 형성",
        "purpose": "현장 마스터 데이터 생성",
        "keyActions": [
          "샘플 주입",
          "엑셀 업로드",
          "DB 적재"
        ]
      },
      {
        "tabId": "products",
        "tabName": "제품 형성",
        "purpose": "제품 모델 마스터 데이터 생성",
        "keyActions": [
          "샘플 주입",
          "엑셀 업로드",
          "DB 적재"
        ]
      },
      {
        "tabId": "assets",
        "tabName": "자산 형성",
        "purpose": "실물 자산 마스터 데이터 생성",
        "keyActions": [
          "샘플 주입",
          "엑셀 업로드",
          "DB 적재"
        ]
      },
      {
        "tabId": "contracts",
        "tabName": "계약 형성",
        "purpose": "렌탈 계약 마스터 데이터 생성",
        "keyActions": [
          "샘플 주입",
          "엑셀 업로드",
          "DB 적재"
        ]
      }
    ]
  },
  {
    "menuId": "voice_dispatch",
    "version": 3,
    "menuName": "음성 출고지시",
    "groupId": "grp_sales",
    "groupName": "영업관리",
    "department": "영업팀 / 현장영업",
    "archetype": "유형 A: 요청 처리형 (카드형 상세)",
    "objective": "음성 녹음 입력을 통한 고객/현장/장비 엔티티 자동 추출 및 출고요청서 전표 생성",
    "scopeInfo": "마이크 입력 장치, 거래처/현장 마스터, 당사 가용 장비 모델 목록",
    "cognitiveSequence": [
      "1. 화면 중앙 [음성 녹음 시작] 마이크 버튼 클릭",
      "2. 자연어 출고 지시 발화 (예: '대한건설 동탄현장에 3219 2대 내일 아침 8시 출고해줘')",
      "3. 실시간 STT 텍스트 변환 결과 및 AI 엔티티(고객, 현장, 기종, 수량, 일시) 파싱 카드 확인",
      "4. 누락 또는 오인식 항목 터치 수정",
      "5. 우하단 [출고요청서 즉시 발행] 버튼 클릭으로 입출고/배차 부서로 의뢰 전송 완료"
    ],
    "modalWorkflows": [],
    "auditResult": "음성 파싱 정확도 100% 검증 및 정규 출고요청 전표 생성 확정",
    "rulesCompliance": [
      "헌장 1.1 [최우선 개발 사명] 준수: 외근 영업사원의 최소 노력으로 최대 업무 효익 창출",
      "헌장 2.1 [부서 R&R 엄격 분리] 준수: 영업사원은 출고 의뢰만 발행하며 개별 자산번호는 지정하지 않음"
    ],
    "precautions": [
      "주변 소음이 심한 건설 현장에서는 블루투스 이어폰 마이크 사용을 권장합니다.",
      "신규 현장인 경우 주소 오인식을 방지하기 위해 현장명을 또박또박 발음해야 합니다."
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"dispatch4-btn-audio-upload\"]",
        "label": "음성 녹음 입력",
        "description": "현장 영업사원 음성 출고 지시 녹음",
        "colorToken": "BLUE",
        "type": "STAMP"
      },
      {
        "seq": 2,
        "selector": "[data-mid=\"dispatch4-preview-dossier\"]",
        "label": "AI 파싱 도시에",
        "description": "고객, 현장, 모델, 일정 엔티티 자동 추출 결과",
        "colorToken": "PURPLE",
        "type": "HIGHLIGHT_BOX"
      },
      {
        "seq": 3,
        "selector": "[data-mid=\"dispatch4-btn-submit\"]",
        "label": "출고요청 전표 확정",
        "description": "파싱 데이터 검증 후 정규 전표 발행",
        "colorToken": "GREEN",
        "type": "STAMP"
      }
    ],
    "processes": [
      {
        "id": "voice_dispatch_proc_1",
        "title": "음성을 통한 신속 출고 요청",
        "steps": [
          {
            "text": "마이크 버튼을 클릭하고 출고 지시 내용을 음성으로 말씀하세요.",
            "selector": ".btn-mic-record"
          },
          {
            "text": "화면에 표시된 파싱 결과를 눈으로 확인하세요.",
            "selector": ".parsed-entity-card"
          },
          {
            "text": "[출고요청서 발행] 버튼을 눌러 접수를 완료하세요.",
            "selector": ".btn-submit-voice-dispatch"
          }
        ]
      }
    ]
  },
  {
    "menuId": "manual_dictionary",
    "version": 3,
    "menuName": "전사 업무 매뉴얼 사전",
    "groupId": "grp_management_special",
    "groupName": "경영관리 - 특수",
    "department": "경영관리팀 / 감사실",
    "archetype": "유형 C: 대시보드 및 지식 포털 (대시보드 / 포털)",
    "objective": "헌장 1.4조 1단어 1뜻 표준 용어 사전 조회 및 다의어/동의어 파편화 방지",
    "scopeInfo": "전사 표준 용어집(SSOT), 헌장 조항(카테고리 I~VII), 부서별 표준 업무 절차",
    "cognitiveSequence": [
      "1. 상단 검색창에 용어 또는 헌장 번호(예: '1.3', 'EXCHANGE', 'RENTED') 입력",
      "2. 좌측 조항/용어 목록에서 상세 정의 및 금지 안티패턴 확인",
      "3. 우측 전사 적용 메뉴 및 관련 DB 스키마 1:1 관통 상태 조망",
      "4. 표준 준수 자가 진단 체크리스트 확인"
    ],
    "modalWorkflows": [],
    "auditResult": "표준 도메인 용어 단일 진실의 원천(SSOT) 정의 보존",
    "rulesCompliance": [
      "헌장 1.4 [1단어 1뜻 전사 단일 의미 표준화 원칙] 준수: 다의어 및 동의어 파편화 영구 퇴치",
      "헌장 5.3 [단일 진실의 원천(SSOT) 준수] 의무화"
    ],
    "precautions": [
      "신규 기능을 기획하거나 용어를 정의할 때는 반드시 본 사전의 등록 여부를 선행 검증해야 합니다."
    ],
    "annotations": [
      {
        "seq": 1,
        "selector": "[data-mid=\"manual_dictionary-process-list\"]",
        "label": "용어 사전 프로세스",
        "description": "1단어 1뜻 표준 도메인 용어 정의 목록",
        "colorToken": "BLUE",
        "type": "STAMP"
      }
    ],
    "processes": [
      {
        "id": "manual_dictionary_proc_1",
        "title": "전사 표준 용어 검색 및 검증",
        "steps": [
          {
            "text": "검색창에 확인하고자 하는 비즈니스 용어를 입력하세요.",
            "selector": "input[placeholder*='용어']"
          },
          {
            "text": "정의 카드에서 1:1 표준 명칭과 적용 규칙을 확인하세요.",
            "selector": ".dictionary-detail-card"
          }
        ]
      }
    ]
  }
];

export const getMenuManual = (menuId: string): MenuManualDetail | undefined => {
  return ALL_MENU_MANUALS.find(m => m.menuId === menuId);
};

export const getManualPageForMenu = (menuId: string): ManualPage | undefined => {
  const m = getMenuManual(menuId);
  if (!m) return undefined;
  return {
    pageId: m.menuId,
    pageTitle: m.menuName,
    version: m.version || 1,
    items: m.annotations.map((item, i) => ({ ...item, seq: i + 1 })),
    basicGuide: m.basicGuide,
    processes: m.processes
  };
};
