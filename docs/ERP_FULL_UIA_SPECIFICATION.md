# 기연리프트 e-Bro ERP 전사 전체 메뉴 UIA (UI Automation & Action Architecture) 명세서

---

## 🏛️ 1. UIA 개요 및 에이전틱 AI 네이티브 연동 원칙

본 문서는 에이전틱 AI(Agentic AI)가 기연리프트 e-Bro ERP의 전체 메뉴 구조와 화면 요소, 데이터 스키마 및 비즈니스 액션을 오차 없이 식별하고 자율적으로 제어(Automation / Tool Calling)할 수 있도록 정의된 **전사 단일 진실의 원천(SSOT) UIA 명세서**이다.

### 1.1 에이전틱 AI 조작 4대 헌장 불변식 (Constitutional Guardrails)
1. **[헌장 1.3] 출고 검수 승인 마감 시 자산 상태 `RENTED` 전환 원칙**:
   - 출고 검수 승인이 최종 완료되는 즉시 자산 상태는 반드시 `RENTED`(`대여중`)로 전환된다.
   - 배차 단계(`deliveries`)에서는 자산 상태를 조작할 수 없으며, 취소 시에도 자산 상태는 보존된다.
2. **[헌장 2.3] 대차/교체 배차 의뢰 단일 `EXCHANGE` 1건 발행 원칙**:
   - 대차 교체 발생 시 출고/입고 2건으로 파편화하지 않고, 배차 속성에 `'EXCHANGE'`(`교환`)를 적용하여 단 1건의 왕복 배차 의뢰만 발행하며 왕복 운송비 할인(기본 ₩60,000)을 자동 적용한다.
3. **[헌장 4.1] 자산별 매출 기여액 정밀 일할 집계 정책**:
   - 대차 교체 발생 시 회수 자산(전자산)은 교체 전일까지의 가동일수로 마감 확정하고, 대차 자산(후장비)은 교체 당일부터 가동일수를 승계받아 일할 매출 기여액을 1원의 오차도 없이 누적 집계한다 (`대차 차액 ₩0`).
4. **[헌장 5.2] 전 스토리지/DB 저장 성공 동기 검증 및 무음 실패 방지 (Zero Silent Failures)**:
   - 모든 AI 액션은 `await db.awaitPendingWrites()`를 동기 검증하며, 실패 시 절대로 무음 처리하지 않고 에러를 표출한다.

### 1.2 에이전틱 AI 사전 준비 상태 확인 표준 프로토콜 (Pre-Flight Readiness Check)
- **원칙**: 에이전틱 AI는 ERP에 비즈니스 도구(CUD)를 호출하기 전에 **반드시 0순위로 `system_check_readiness` MCP 도구를 호출하거나 브라우저 `body[data-erp-status="ready"]` DOM 셀렉터를 확인**해야 한다.
- **Ready 판별 3대 신호(Signals)**:
  1. `MCP 도구`: `system_check_readiness` 호출 ➔ `isReady: true` 확인
  2. `DOM 속성`: `document.body.getAttribute('data-erp-status') === 'ready'`
  3. `전역 프로미스`: `await window.whenErpReady()` 해소(Resolved) 확인
- **준비 완료 시 진단 정보**:
  - `currentUser`: 로그인 사용자 ID 및 권한
  - `activeMenu`: 현재 활성화된 메뉴 ID (예: `dashboard`, `delivery`)
  - `dbConnected`: DB 통신 유효성 true
  - `guardrailsActive`: 4대 전사 헌장 가드레일 활성화 상태

---

### 🗺️ 2. 전사 11대 메뉴 그룹 및 60개 메뉴 UIA 매트릭스

```
┌───────────────────────────────┬───────────────────────────────┬─────────────┬───────────────────────────┐
│ 메뉴 그룹                     │ 메뉴 ID                       │ 아키텍처    │ 핵심 액션 트리거          │
├───────────────────────────────┼───────────────────────────────┼─────────────┼───────────────────────────┤
│ 1. 대시보드                   │ dashboard                     │ 유형 A 마스터│ ToDo 피드 조치, 실시간 모니터│
│ 2. 결재 센터 (2개)            │ approvalInbox                 │ 유형 A 카드 │ 결재 승인/반려            │
│                               │ approvalRules                 │ 유형 B 그리드│ 결재 규칙 저장            │
│ 3. 영업관리 (12개)            │ customer                      │ 유형 B 그리드│ 고객/현장/담당자 일괄 등록 │
│                               │ site_options                  │ 유형 B 그리드│ 현장별 옵션/보양/가동 관리 │
│                               │ contract                      │ 유형 A 카드 │ 계약 체결, 조건 갱신, 상속 │
│                               │ billing                       │ 유형 B 그리드│ 월말 청구 확정, 계산서 발행│
│                               │ custom_billing                │ 유형 A 카드 │ 특수 거래명세서 품목 저장  │
│                               │ receivable                    │ 유형 B 그리드│ 미수금 대사, 채권 상계     │
│                               │ smart_dispatch4               │ 유형 A 카드 │ 출고 요청서 발행           │
│                               │ voice_dispatch                │ 유형 A 카드 │ 자연어 음성 출고지시 발행 │
│                               │ smart_return                  │ 유형 A 카드 │ 회수 요청서 발행           │
│                               │ smart_as_request              │ 유형 A 카드 │ 긴급 AS 요청서 발행        │
│                               │ delinquency                   │ 유형 B 그리드│ 미수 연체 고객 출고 차단   │
│                               │ official_mail                 │ 유형 A 카드 │ 공식 메일 발송             │
│                               │ public_construction_permits   │ 유형 B 그리드│ 인허가 공정 검색           │
│ 4. 제품/자산관리 (4개)        │ product                       │ 유형 B 그리드│ 장비 제원/스펙 마스터 관리 │
│                               │ asset                         │ 유형 B 그리드│ 자산 대장, 상태 변경       │
│                               │ acquisition_disposal          │ 유형 A 카드 │ 취득/매각 전표 처리        │
│                               │ rent_asset                    │ 유형 B 그리드│ 외부 타사 임차 장비 관리   │
│ 5. 배차/운송관리 (2개)        │ delivery                      │ 탭1:A / 탭2:B│ 배차 의뢰(단일 EXCHANGE)   │
│                               │ transport_master              │ 유형 B 그리드│ 운송사 및 기사 마스터 관리 │
│ 6. 입출고관리 (7개)           │ daily_inout                   │ 유형 B 그리드│ 당일 입출고 시간대별 조망  │
│                               │ asset_inout_history           │ 유형 B 그리드│ 장비 입고등록 및 이력 추적 │
│                               │ dispatch_assign               │ 유형 A 카드 │ 장비 실물 번호 매핑(Choice)│
│                               │ outbound_inspections          │ 유형 A 카드 │ 출고 검수 승인(RENTED 전환)│
│                               │ consumable_stock              │ 유형 B 그리드│ 주기장 부품 재고 관리      │
│                               │ stocktaking                   │ 유형 B 그리드│ 바코드 스캔 전산 실사 확정 │
│                               │ print_queue_monitor           │ 유형 A 카드 │ 프린트 큐 모니터링/재출력  │
│ 7. 정비/소모품관리 (5개)      │ consumable_purchase           │ 유형 B 그리드│ 소모품 대량 구매 엑셀 등록 │
│                               │ consumable_inout              │ 유형 B 그리드│ 소모품 출고 및 수불 로그   │
│                               │ field_as                      │ 유형 A 카드 │ 현장 출동 AS 정비 조치     │
│                               │ repair                        │ 유형 A 카드 │ 주기장 입고 수리 및 점수 리셋│
│                               │ inspection_checklist_manage   │ 유형 B 그리드│ 점검표 표준 항목 설정      │
│ 8. 경영관리 (10개)            │ leave_application             │ 유형 A 카드 │ 휴가 신청서 제출           │
│                               │ ot_management                 │ 유형 B 그리드│ 시간외근무 승인/정산       │
│                               │ vehicle_log                   │ 유형 B 그리드│ 법인차량 주유 및 운행일지  │
│                               │ purchase_settlement           │ 유형 B 그리드│ 월말 매입 정산 및 홈택스대사│
│                               │ vendors                       │ 유형 B 그리드│ 매입처/외주처 마스터       │
│                               │ bank_matching                 │ 유형 B 그리드│ 통장 입출금 1:1 대사       │
│                               │ corporate_card                │ 유형 B 그리드│ 법인카드 경비 전표 정산    │
│                               │ cash_flow                     │ 유형 B 그리드│ 자금 일계 및 흐름 분석     │
│                               │ depreciation_execution        │ 유형 B 그리드│ 월말 감가상각 마감 실행    │
│                               │ regular_reports               │ 유형 B 그리드│ 월간/연간 정기보고서 생성  │
│ 9. 경영관리-특수 (6개)        │ organization                  │ 유형 A 카드 │ 조직도 및 부서/직책 설정   │
│                               │ permission                    │ 유형 B 그리드│ 임직원 메뉴별 권한 매트릭스│
│                               │ manual_dictionary             │ 유형 C 포털 │ 1단어 1뜻 표준 용어 사전   │
│                               │ payroll                       │ 유형 B 그리드│ 급여 대장 산출 (보안 강제) │
│                               │ leave_management              │ 유형 B 그리드│ 연차 발생 및 잔여일수 관리 │
│                               │ privacy_audit                 │ 유형 B 그리드│ 개인정보 접속 감사 로그    │
│ 10. 도구 및 다운로드 (2개)    │ operations_manual             │ 유형 A 스튜디오│ 업무 매뉴얼 및 지침 검색   │
│                               │ error_report                  │ 유형 B 그리드│ 3단계 오류 신고 등록/처리  │
│ 11. 시스템-에이전틱 랩 (8개)  │ agentic_ai_lab                │ 유형 A 스튜디오│ 자연어 ReAct 시뮬레이터    │
│                               │ agentic_dispatch_studio       │ 유형 A 스튜디오│ 배차 관제 스튜디오         │
│                               │ agentic_settlement_autopilot  │ 유형 B 그리드│ 월말 대사 오토파일럿       │
│                               │ agentic_asset_lifecycle       │ 유형 A 스튜디오│ 자산 수명 관제보드         │
│                               │ initial_db_upload             │ 유형 B 그리드│ 초기DB 업로드              │
│                               │ data_formation                │ 유형 B 그리드│ 레거시 갭 분석 및 일괄적재 │
│                               │ google_config                 │ 유형 A 카드 │ 공식 메일 연동 설정        │
│                               │ dev_uploader                  │ 유형 B 그리드│ DB 데이터 업로더           │
└───────────────────────────────┴───────────────────────────────┴─────────────┴───────────────────────────┘
```

---

## 🔍 3. 메뉴별 상세 UIA 요소 및 조작 스키마 (Actionable Specs)

### 3.1 [영업관리] `customer` (고객 관리)
- **UI 아키타입**: 유형 B (고밀도 그리드)
- **DOM 식별자 / Selector**:
  - 컨테이너: `[data-uia="customer-container"]`
  - 엑셀 일괄 등록 버튼: `[data-uia="btn-excel-upload-customer"]`
  - 신규 등록 버튼: `[data-uia="btn-add-customer"]`
  - 검색 입력 필드: `[data-uia="input-customer-search"]`
  - 그리드 테이블: `[data-uia="table-customer-list"]`
- **에이전틱 AI 액션 스키마**:
  ```json
  {
    "action": "customer_create",
    "parameters": {
      "name": "string (고객사 상호)",
      "bizRegNo": "string (사업자등록번호 10자리)",
      "representative": "string (대표자 성명)",
      "repContact": "string (대표 연락처)",
      "address": "string (본사 주소)",
      "sites": [{ "name": "string", "address": "string", "contactName": "string", "contact": "string" }],
      "contacts": [{ "name": "string", "position": "string", "contact": "string" }]
    }
  }
  ```

### 3.2 [영업관리] `contract` (계약 관리)
- **UI 아키타입**: 유형 A (카드 / 마스터-디테일)
- **DOM 식별자 / Selector**:
  - 컨테이너: `[data-uia="contract-container"]`
  - 계약 생성 버튼: `[data-uia="btn-new-contract"]`
  - 계약 상세 패널: `[data-uia="panel-contract-detail"]`
  - 자산 추가 버튼: `[data-uia="btn-add-contract-asset"]`
- **헌장 가드레일**: 대차 교체 시 최초 계약 단가 및 청구 마감일 속성 100% 자동 상속 (헌장 2.2).

### 3.3 [배차/운송관리] `delivery` (배차/운송 관리)
- **UI 아키타입**: 탭 1 (유형 A 카드 처리형) / 탭 2 (유형 B 고밀도 정산 그리드)
- **DOM 식별자 / Selector**:
  - 탭 선택기: `[data-uia="tab-dispatch-ops"]`, `[data-uia="tab-dispatch-settle"]`
  - 엑셀 일괄 등록 버튼: `[data-uia="btn-excel-upload-delivery"]`
  - 배차 카드 리스트: `[data-uia="card-delivery-item-{id}"]`
  - 기사 배정 버튼: `[data-uia="btn-assign-driver"]`
  - 운송비 확정 입력: `[data-uia="input-delivery-cost"]`
- **헌장 가드레일**:
  - 대차 건 접수 시 `type: 'EXCHANGE'` 1건만 생성 (헌장 2.3).
  - 왕복 운송비 ₩60,000 자동 차감 할인 적용 (`finalCost = roundTrip - 60000`).
  - 배차 단계에서 `assets.status` 절대 조작 금지 (헌장 1.3).

### 3.4 [입출고관리] `outbound_inspections` (출고 검수 관리)
- **UI 아키타입**: 유형 A (요청 처리형 카드 스튜디오)
- **DOM 식별자 / Selector**:
  - 검수 대상 목록: `[data-uia="list-inspection-targets"]`
  - 체크리스트 체크박스: `[data-uia="chk-inspection-item-{code}"]`
  - 최종 검수 승인 버튼: `[data-uia="btn-approve-outbound"]`
- **헌장 가드레일**:
  - `[btn-approve-outbound]` 클릭 승인 마감 즉시 해당 자산의 상태는 예외 없이 `RENTED`(`대여중`)로 전환됨 (헌장 1.3).

### 3.5 [정비/소모품관리] `consumable_purchase` (소모품 구매)
- **UI 아키타입**: 유형 B (고밀도 그리드)
- **DOM 식별자 / Selector**:
  - 엑셀 업로드 버튼: `[data-uia="btn-excel-upload-consumable"]`
  - 구매 신청 목록 그리드: `[data-uia="table-consumable-purchases"]`
  - 구매 승인/입고 버튼: `[data-uia="btn-accept-purchase-{id}"]`
- **결과 연동**: 입고 완료 시 `consumables.stockQty` 실시간 가산 및 수불 로그 기록.

### 3.6 [경영관리] `bank_matching` (은행 입출금 대장)
- **UI 아키타입**: 유형 B (고밀도 1:1 대사 그리드)
- **Gutenberg Z-패턴 레이아웃 (헌장 3.5)**:
  - ① 좌상단 (Scope): 통장 계좌 및 대상 연월 선택기 `[data-uia="select-bank-scope"]`
  - ② 우상단 (Pipeline): 은행 엑셀 업로드 `[data-uia="btn-bank-excel-upload"]`
  - ③ 중앙 본문 (Inspection): 38px 슬림 통장 대사 그리드 `[data-uia="table-bank-matching-grid"]`
  - ④ 우하단 (Terminal Action): 대차대조 합계 검증식 및 `[data-uia="btn-confirm-reconciliation"]`

### 3.7 [업무도구] `error_report` (오류 신고 관리)
- **UI 아키타입**: 유형 B (고밀도 그리드 + 3단계 라이프사이클 처리)
- **Gutenberg Z-패턴 및 전사 헌장 규격**:
  - ① 좌상단 (Scope): 3단계 상태 HUD (`[data-uia="hud-stage-counts"]`) 및 검색/필터 바
  - ② 우상단 (Pipeline): 오류 신고 등록 버튼 (`[data-uia="btn-open-report-modal"]`), 엑셀 내보내기 (`[data-uia="btn-export-excel"]`)
  - ③ 중앙 본문 (Inspection): 38px 슬림 신고 대장 그리드 (`[data-uia="table-error-reports"]`), 좌측 첫 컬럼 `[상세 ➔]` 액션 버튼
  - ④ 상세/조치 패널:
    - 1단계 [신고 등록]: 상하 세로 스택 폼, 드래그&드롭 및 **Ctrl+V 클립보드 즉각 캡처 붙여넣기** (`[data-uia="dropzone-attachments"]`), Base64 자동 인코딩
    - 2단계 [접수 처리]: 담당 조치자 지정, 조치 희망일, 접수 메모 기록 후 `[data-uia="btn-confirm-reception"]`
    - 3단계 [완료 처리]: 원인 분석(rootCause), 조치 내역(resolutionNote), 해결 반영 버전(resolvedVersion) 무누락 기록 후 `[data-uia="btn-confirm-completion"]`
- **에이전틱 AI 액션 스키마**:
  ```json
  {
    "action": "error_report_create",
    "parameters": {
      "title": "배차 목록 엑셀 내보내기 타임아웃 오류",
      "description": "운송대사 탭에서 데이터 500건 이상 필터링 시 다운로드 지연",
      "category": "UI_BUG",
      "severity": "MAJOR",
      "menuId": "dispatch_list",
      "reporterName": "배차담당자"
    }
  }
  ```
  ```json
  {
    "action": "error_report_update_status",
    "parameters": {
      "id": "ERR-202609-001",
      "status": "COMPLETED",
      "resolutionNote": "데이터 스트리밍 엑셀 생성 적용 완료",
      "resolvedVersion": "v1.1.0.Build.42",
      "rootCause": "대용량 일괄 렌더링 메모리 초과"
    }
  }
  ```

---

## 🤖 4. 에이전틱 AI 3대 신규 테스트 메뉴 UIA 상세 명세

### 4.1 [신규메뉴 1] `agentic_dispatch_studio` (에이전틱 배차 관제 스튜디오)
- **라우트**: `/agentic-dispatch-studio`
- **아키타입**: 유형 A 마스터-디테일 스튜디오
- **주요 UI 요소**:
  - 자연어 디스패치 지시창: `[data-uia="agentic-dispatch-prompt"]`
  - 의뢰 큐 카드 덱: `[data-uia="deck-dispatch-requests"]`
  - 헌장 2.3 EXCHANGE 단일화 인디케이터: `[data-uia="badge-exchange-discount"]`
  - 기사 최적 자동 배정 버튼: `[data-uia="btn-auto-match-driver"]`
  - 실시간 편의성 지표 HUD: `[data-uia="hud-dispatch-metrics"]`

### 4.2 [신규메뉴 2] `agentic_settlement_autopilot` (에이전틱 월말 대사·정산 오토파일럿)
- **라우트**: `/agentic-settlement-autopilot`
- **아키타입**: 유형 B 고밀도 다열 그리드 (85% 작업대)
- **주요 UI 요소**:
  - 연월/거래처 스코핑 바: `[data-uia="autopilot-scope-filter"]`
  - 일할 매출 기여액 1원 대사 테이블: `[data-uia="table-prorata-audit"]`
  - 헌장 4.1 대차 바통 승계 표시: `[data-uia="cell-baton-transfer-{assetId}"]`
  - 원클릭 오토파일럿 대사 실행: `[data-uia="btn-run-autopilot"]`
  - 우하단 종단 대차대조식: `[data-uia="summary-terminal-balance"]`
    (`📄 청구총액 = 🟢 확정액 + 🚫 반려액 | ⚖️ 대차 차액 ₩0`)

### 4.3 [신규메뉴 3] `agentic_asset_lifecycle` (에이전틱 자산 상태·수명 라이프사이클 관제)
- **라우트**: `/agentic-asset-lifecycle`
- **아키타입**: 유형 A 관제 스튜디오
- **주요 UI 요소**:
  - 6대 상태 플로우 모니터: `[data-uia="monitor-lifecycle-flow"]`
  - 헌장 1.3 RENTED 강제 가드 상태: `[data-uia="badge-guard-rented"]`
  - 센서 수명/가동시간 분석 위젯: `[data-uia="widget-asset-health"]`
  - 대차 교체 자율 권고 카드: `[data-uia="card-recommended-exchange"]`
  - 자율 원클릭 라이프사이클 조치: `[data-uia="btn-execute-lifecycle-action"]`

---

## 🛡️ 5. AI 에이전트 도구 호출(Tool Calling) 표준 프로토콜 (MCP)

모든 에이전틱 AI 도구는 MCP(Model Context Protocol) 표준 사양을 준수하며, 요청 시 헌장 가드레일 인터셉터를 필수로 통과한다.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "dispatch_create_order",
    "arguments": {
      "type": "EXCHANGE",
      "transportCompany": "호남고속화물",
      "originAddress": "충북 청주시 흥덕구 직지대로 436",
      "destinationAddress": "경기 성남시 분당구 판교역로 166",
      "deliveryCost": 140000,
      "expectedCost": 140000,
      "billableToCustomer": true,
      "memo": "S-45 고장 대차 교체 (왕복할인 ₩60,000 적용)"
    }
  }
}
```
- **응답 프로토콜**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "배차 ID del_178922... 성공적으로 생성되었습니다. [헌장 2.3 단일 EXCHANGE 1건 및 ₩60,000 왕복할인 정상 적용 확인]"
      }
    ],
    "isError": false
  }
}
```
