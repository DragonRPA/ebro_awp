# 기연리프트 e-Bro ERP 전사 전체 메뉴 및 UIA 통합 명세서 (SSOT)

> **버전**: v2.2.0 (전사 전체 69개 메뉴 100% 최신화)  
> **기준 일시**: 2026-10-11  
> **용도**: 에이전틱 AI 도구 호출(Tool Calling), UI 자동화(UIA), 도메인 관통 테스트(WTT) 및 전사 작업지시 단일 진실의 원천(SSOT)

---

## 🏛️ 1. UIA 개요 및 에이전틱 AI 네이티브 연동 원칙

본 문서는 에이전틱 AI(Agentic AI)와 개발진이 기연리프트 e-Bro ERP의 전체 메뉴 구조와 화면 요소, 데이터 스키마 및 비즈니스 액션을 1원의 오차나 1개의 누락 없이 식별하고 자율적으로 제어(Automation / Tool Calling)할 수 있도록 정의된 **전사 단일 진실의 원천(SSOT) 통합 명세서**입니다.

### 1.1 에이전틱 AI 조작 4대 헌장 불변식 (Constitutional Guardrails)
1. **[헌장 1.3] 출고 검수 승인 마감 시 자산 상태 `RENTED` 전환 원칙**:
   - 출고 검수 승인이 최종 완료되는 즉시 자산 상태는 반드시 `RENTED`(`대여중`)로 전환됩니다.
   - 배차 단계(`deliveries`)에서는 자산 상태를 조작할 수 없으며, 배차 취소 시에도 자산 상태는 보존됩니다.
2. **[헌장 2.3] 대차/교체 배차 의뢰 단일 `EXCHANGE` 1건 발행 원칙**:
   - 대차 교체 발생 시 출고/입고 2건으로 파편화하지 않고, 배차 속성에 `'EXCHANGE'`(`교환`)를 적용하여 단 1건의 왕복 배차 의뢰만 발행하며 왕복 운송비 할인(기본 ₩60,000)을 자동 적용합니다.
3. **[헌장 4.1] 자산별 매출 기여액 정밀 일할 집계 정책**:
   - 대차 교체 발생 시 회수 자산(전자산)은 교체 전일까지의 가동일수로 마감 확정하고, 대차 자산(후장비)은 교체 당일부터 가동일수를 승계받아 일할 매출 기여액을 1원의 오차도 없이 누적 집계합니다 (`대차 차액 ₩0`).
4. **[헌장 5.2] 전 스토리지/DB 저장 성공 동기 검증 및 무음 실패 방지 (Zero Silent Failures)**:
   - 모든 AI 액션은 `await db.awaitPendingWrites()`를 동기 검증하며, 실패 시 절대로 무음 처리하지 않고 에러를 표출합니다.

### 1.2 에이전틱 AI 사전 준비 상태 확인 표준 프로토콜 (Pre-Flight Readiness Check)
- **원칙**: 에이전틱 AI는 ERP에 비즈니스 도구(CUD)를 호출하기 전에 **반드시 0순위로 `system_check_readiness` MCP 도구를 호출하거나 브라우저 `body[data-erp-status="ready"]` DOM 셀렉터를 확인**해야 합니다.
- **Ready 판별 3대 신호(Signals)**:
  1. `MCP 도구`: `system_check_readiness` 호출 ➔ `isReady: true` 확인
  2. `DOM 속성`: `document.body.getAttribute('data-erp-status') === 'ready'`
  3. `전역 프로미스`: `await window.whenErpReady()` 해소(Resolved) 확인

---

## 🗺️ 2. 전사 전체 메뉴 UIA 종합 매트릭스 (총 69개 메뉴)

| 메뉴 그룹 | 메뉴 ID | 메뉴명 | UI 아키타입 | 최종 완결 목표 (Terminal Action) |
|:---|:---|:---|:---|:---|
| grp_dashboard | `dashboard` | ERP 대시보드 | 유형 A (카드/스튜디오) | ToDo 피드 미처리 0건 달성 |
| 1. 영업-유통 | `trade_products` | 상품 등록 및 관리 | 유형 B (고밀도 그리드) | 신규 상품 마스터 등록 및 판매단가 확정 |
| 1. 영업-유통 | `trade_purchases` | 구매 및 입고 | 유형 B (고밀도 그리드) | 매입 입고 승인 및 유통 재고 반영 |
| 1. 영업-유통 | `trade_contracts` | 유통 수주 | 유형 A (카드/스튜디오) | 유통 수주 계약 체결 및 출고 파이프라인 생성 |
| 1. 영업-유통 | `trade_outbounds` | 출고 요청 | 유형 A (카드/스튜디오) | 출고 재고 할당 및 패킹 지시 완결 |
| 1. 영업-유통 | `courier_dispatch` | 택배 배송 관리 | 유형 B (고밀도 그리드) | 송장 등록 및 전자 인수증 확인을 통한 배송 완료 확정 |
| 1. 영업-유통 | `trade_billing` | 유통 청구 및 명세 | 유형 B (고밀도 그리드) | 유통 매출 청구서 발행 및 증빙 저장 확정 |
| 1. 영업-유통 | `trade_returns` | 환입 및 반품 | 유형 B (고밀도 그리드) | 반품 판정(양품 환원 / 불량 폐기) 및 회계 정산 종결 |
| 1. 영업-유통 | `trade_profitability` | 수익성 관리 | 유형 B (고밀도 그리드) | 유통 손익 대차대조 검증 (매출 = 원가 + 운송비 + 순마진) |
| 2. 결재 센터 | `approvalInbox` | 내 결재함 | 유형 A (카드/스튜디오) | 결재 요청에 대한 최종 승인/반려 확정 |
| 2. 결재 센터 | `approvalRules` | 결재선 규칙 설정 | 유형 B (고밀도 그리드) | 결재선 규칙 저장 확정 |
| 3. 영업관리 | `customer` | 고객 관리 | 유형 B (고밀도 그리드) | 고객사 신규 등록 및 엑셀 일괄 적재 완결 |
| 3. 영업관리 | `site_options` | 현장별 옵션 관리 | 유형 B (고밀도 그리드) | 현장 옵션 프로필 저장 및 활성화 토글 완결 |
| 3. 영업관리 | `contract` | 계약 관리 | 유형 A (카드/스튜디오) | 계약서 체결 확정 및 전표 발행 |
| 3. 영업관리 | `billing` | 청구 수납 관리 | 유형 B (고밀도 그리드) | 청구 확정 전표 마감 및 대차대조 무결성 보존 |
| 3. 영업관리 | `custom_billing` | 특수 거래명세서 작성 | 유형 A (카드/스튜디오) | 원청구 = 특수명세서 품목 합계 (차액 ₩0) 검증 후 저장 |
| 3. 영업관리 | `receivable` | 외상미수금 대장 | 유형 B (고밀도 그리드) | 미수 채권 상계 및 잔액 대사 확정 |
| 3. 영업관리 | `smart_dispatch4` | 출고 요청 | 유형 A (카드/스튜디오) | 출고요청서 전표 발행 완결 |
| 3. 영업관리 | `voice_dispatch` | 음성 출고지시 | 유형 A (카드/스튜디오) | 음성 파싱 확인 및 출고요청서 전표 생성 |
| 3. 영업관리 | `smart_return` | 회수 요청 | 유형 A (카드/스튜디오) | 회수 요청서 전표 발행 완결 |
| 3. 영업관리 | `smart_as_request` | AS 요청 | 유형 A (카드/스튜디오) | AS 요청서 발행 및 정비 큐 등록 |
| 3. 영업관리 | `delinquency` | 미수 채권 연체 관리 | 유형 B (고밀도 그리드) | 연체 고객 출고 제한 조치 확정 |
| 3. 영업관리 | `official_mail` | 공식 메일 발송 | 유형 A (카드/스튜디오) | 공식 메일 발송 완료 |
| 3. 영업관리 | `public_construction_permits` | 인허가 건축공정 조회 | 유형 B (고밀도 그리드) | 타깃 현장 스코핑 및 영업 기회 등록 |
| 4. 자산관리 | `product` | 제품 관리 | 유형 B (고밀도 그리드) | 제품 마스터 스펙 등록/수정 완료 |
| 4. 자산관리 | `asset` | 자산 관리 | 유형 B (고밀도 그리드) | 자산 정보 갱신 및 상태 전이 완료 |
| 4. 자산관리 | `acquisition_disposal` | 자산 취득 매각 | 유형 A (카드/스튜디오) | 자산 취득/매각 전표 확정 |
| 4. 자산관리 | `rent_asset` | 임차 장비 관리 | 유형 B (고밀도 그리드) | 임차 장비 계약 및 반납 확정 |
| 5. 배차 운송관리 | `delivery` | 배차 운송 관리 | TYPE_A_CARD_AND_TYPE_B_GRID | 배차 완료 확정 및 월말 운송료 대사 종결 (청구=확정+반려, 차액 ₩0) |
| 5. 배차 운송관리 | `transport_master` | 운송 거래처 관리 | 유형 B (고밀도 그리드) | 운송 기사 마스터 등록/갱신 완료 |
| 6. 입출고관리 | `daily_inout` | 일일 입출고 조회 | 유형 B (고밀도 그리드) | 당일 입출고 파이프라인 전수 확인 |
| 6. 입출고관리 | `asset_inout_history` | 입출고 조회 | 유형 B (고밀도 그리드) | 실물 반납 입고 확정 |
| 6. 입출고관리 | `dispatch_assign` | 장비 할당 | 유형 A (카드/스튜디오) | 출고 실물 장비 할당 완료 |
| 6. 입출고관리 | `outbound_inspections` | 출고 검수 관리 | 유형 A (카드/스튜디오) | 출고 검수 최종 승인 마감 (상태 RENTED 전환) |
| 6. 입출고관리 | `consumable_stock` | 주기장 소모품 재고 | 유형 B (고밀도 그리드) | 안전재고 설정 및 재고 동기화 |
| 6. 입출고관리 | `stocktaking` | 재고 실사 | 유형 B (고밀도 그리드) | 전산 재고 = 실물 스캔 수량 (차이 0건) 실사 확정 |
| 6. 입출고관리 | `print_queue_monitor` | 프린트 큐 모니터 | 유형 A (카드/스튜디오) | 인쇄 대기열 정상 출력 완료 |
| 7. 정비 소모품관리 | `consumable_purchase` | 소모품 구매 | 유형 B (고밀도 그리드) | 소모품 매입 입고 확정 및 로트 생성 |
| 7. 정비 소모품관리 | `consumable_inout` | 소모품 입출고 | 유형 B (고밀도 그리드) | 소모품 불출 등록 완료 |
| 7. 정비 소모품관리 | `field_as` | 현장 AS 관리 | 유형 A (카드/스튜디오) | 현장 AS 조치 완료 전표 마감 |
| 7. 정비 소모품관리 | `repair` | 주기장 정비 관리 | 유형 A (카드/스튜디오) | 수리 완료 및 자산 상태 AVAILABLE(임대가능) 복원 |
| 7. 정비 소모품관리 | `inspection_checklist_manage` | 정비 항목 관리 | 유형 B (고밀도 그리드) | 점검 항목 마스터 저장 |
| 8. 경영관리 | `leave_application` | 연차신청 | 유형 A (카드/스튜디오) | 휴가 신청서 상신 완료 |
| 8. 경영관리 | `ot_management` | 연장근무 관리 | 유형 B (고밀도 그리드) | OT 근무 승인 확정 |
| 8. 경영관리 | `vehicle_log` | 차량 주유관리 | 유형 B (고밀도 그리드) | 주유비 전표 정산 및 운행일지 마감 |
| 8. 경영관리 | `purchase_settlement` | 월말 매입 정산 | 유형 B (고밀도 그리드) | 월말 매입 지급 확정 |
| 8. 경영관리 | `vendors` | 매입처 관리 | 유형 B (고밀도 그리드) | 매입처 등록/수정 완료 |
| 8. 경영관리 | `bank_matching` | 은행 입출금 대장 | 유형 B (고밀도 그리드) | 통장 대사 완료 및 대차대조식 검증 (차액 ₩0) |
| 8. 경영관리 | `corporate_card` | 법인카드 매입정산 | 유형 B (고밀도 그리드) | 카드 경비 전표 승인 마감 |
| 8. 경영관리 | `cash_flow` | 자금 흐름 분석 | 유형 B (고밀도 그리드) | 자금 일계표 마감 |
| 8. 경영관리 | `depreciation_execution` | 감가상각 마감 실행 | 유형 B (고밀도 그리드) | 당월 감가상각 전표 확정 마감 |
| 8. 경영관리 | `regular_reports` | 정기보고서 생성 | 유형 B (고밀도 그리드) | 정기 리포트 생성 및 엑셀 출력 |
| 9. 경영관리 - 특수 | `organization` | 조직 인사 관리 | 유형 A (카드/스튜디오) | 조직도 및 직책 티어 설정 저장 |
| 9. 경영관리 - 특수 | `permission` | 사용자 및 권한 설정 | 유형 B (고밀도 그리드) | 권한 매트릭스 저장 |
| 9. 경영관리 - 특수 | `manual_dictionary` | 전사 업무 매뉴얼 사전 | 유형 C (대시보드/포털) | 표준 용어 단일 진실의 원천 조회 완료 |
| 9. 경영관리 - 특수 | `payroll` | 급여 정산 | 유형 B (고밀도 그리드) | 급여 확정 전표 마감 |
| 9. 경영관리 - 특수 | `leave_management` | 연차관리 | 유형 B (고밀도 그리드) | 연차 현황 확정 |
| 9. 경영관리 - 특수 | `privacy_audit` | 개인정보 접속 감사 | 유형 B (고밀도 그리드) | 접속 감사 로그 검토 완료 |
| 10. 도구 및 다운로드 | `operations_manual` | 업무매뉴얼 | 유형 A (카드/스튜디오) | 업무 지침 습득 및 전사 매뉴얼 DB 동기화 |
| 10. 도구 및 다운로드 | `error_report` | 오류 신고 | 유형 B (고밀도 그리드) | 오류 조치 완료 확정 및 배포 버전 기록 |
| 11. 시스템관리 - 개발자 | `agentic_ai_lab` | AI 샌드박스 랩 | 유형 A (카드/스튜디오) | AI 자율 추론 플랜 실행 완료 |
| 11. 시스템관리 - 개발자 | `agentic_dispatch_studio` | 배차 관제 스튜디오 | 유형 A (카드/스튜디오) | AI 배차 지시 실행 확정 |
| 11. 시스템관리 - 개발자 | `agentic_settlement_autopilot` | 월말 대사 정산 | 유형 B (고밀도 그리드) | 오토파일럿 대사 실행 완료 (대차 차액 ₩0 보존) |
| 11. 시스템관리 - 개발자 | `agentic_asset_lifecycle` | 자산 라이프사이클 관제 | 유형 A (카드/스튜디오) | 자율 라이프사이클 전이 실행 완료 |
| 11. 시스템관리 - 개발자 | `initial_db_upload` | 초기DB 업로드 | 유형 B (고밀도 그리드) | 원시 데이터 일괄 업로드 완료 |
| 11. 시스템관리 - 개발자 | `data_formation` | 초기자료형성 | 유형 B (고밀도 그리드) | 갭 분석 오류 0건 통과 후 DB 일괄 적재 완료 |
| 11. 시스템관리 - 개발자 | `google_config` | 구글 관리자 설정 | 유형 A (카드/스튜디오) | 메일 연동 계정 설정 저장 완료 |
| 11. 시스템관리 - 개발자 | `dev_uploader` | DB 데이터 업로더 | 유형 B (고밀도 그리드) | 개발 데이터 적재 완료 |
| 11. 시스템관리 - 개발자 | `tenant_management` | 테넌트 관리 | 유형 B (고밀도 그리드) | 테넌트 등록/수정, 구독 라이선스 발급 및 도메인 바인딩 확정 |

---

## 🔍 3. 주요 그룹별 상세 UIA 요소 및 액션 스키마 (Actionable Specs)

### 3.1 [유통관리 (grp_distribution)]
#### ① `trade_products` (상품 등록 및 관리)
- **UI 아키타입**: 유형 B (고밀도 그리드)
- **핵심 셀렉터**:
  - SKU 입력: `[data-mid="trade_products-sku-input"]`
  - 상품명 입력: `[data-mid="trade_products-name-input"]`
  - 판매가 입력: `[data-mid="trade_products-price-input"]`
  - 신규 등록 버튼: `[data-mid="trade_products-add-btn"]`
  - 상품 테이블: `[data-mid="trade_products-table"]`
- **지원 도구**: `trade_product_create`, `trade_product_list`, `trade_product_update`

#### ② `trade_purchases` (구매 및 입고)
- **UI 아키타입**: 유형 B (고밀도 그리드)
- **핵심 셀렉터**:
  - 발주 등록 버튼: `[data-mid="trade_purchases-add-btn"]`
  - 입고 검수 및 재고 승인: `[data-mid="trade_purchases-confirm-btn"]`
  - 매입 대장 테이블: `[data-mid="trade_purchases-table"]`
- **지원 도구**: `trade_purchase_create`, `trade_purchase_confirm_inbound`

#### ③ `trade_contracts` (유통 수주)
- **UI 아키타입**: 유형 A (카드 스튜디오)
- **핵심 셀렉터**:
  - 주문 수량 입력: `[data-mid="trade_contracts-qty-input"]`
  - 수주 체결 버튼: `[data-mid="trade_contracts-create-btn"]`
  - 수주 카드 목록: `[data-mid="trade_contracts-cards"]`
- **지원 도구**: `trade_contract_create`, `trade_contract_list`

#### ④ `trade_outbounds` (출고 요청)
- **UI 아키타입**: 유형 A (카드 스튜디오)
- **핵심 셀렉터**:
  - 재고 선점 및 출고 할당: `[data-mid="trade_outbounds-allocate-btn"]`
- **지원 도구**: `trade_outbound_allocate`, `trade_outbound_list`

#### ⑤ `courier_dispatch` (택배 배송 관리)
- **UI 아키타입**: 유형 B (고밀도 그리드)
- **핵심 셀렉터**:
  - 배송 추적 그리드: `[data-mid="courier_dispatch-table"]`
  - 송장 발송 처리 버튼: `[data-mid="courier_dispatch-dispatch-btn"]`
  - 전자 인수증 확인: `[data-mid="btn-view-signed-receipt"]`
- **지원 도구**: `courier_dispatch_ship`, `courier_dispatch_view_receipt`

#### ⑥ `trade_billing` (유통 청구 및 명세)
- **UI 아키타입**: 유형 B (고밀도 그리드)
- **핵심 셀렉터**:
  - 청구 대장 그리드: `[data-mid="trade_billing-table"]`
  - 청구서/명세서 발행 버튼: `[data-mid="trade_billing-issue-btn"]`
  - 증빙 조회 버튼: `[data-mid="btn-view-billing-proof"]`
- **지원 도구**: `trade_billing_issue_invoice`, `trade_billing_list`

#### ⑦ `trade_returns` (환입 및 반품)
- **UI 아키타입**: 유형 B (고밀도 그리드)
- **핵심 셀렉터**:
  - 반품 대장 그리드: `[data-mid="trade_returns-table"]`
  - 양품 판정 (재고 환원): `[data-mid="trade_returns-btn-sellable"]`
  - 불량 판정 (폐기/손실): `[data-mid="trade_returns-btn-defective"]`
- **지원 도구**: `trade_return_process_sellable`, `trade_return_process_defective`

#### ⑧ `trade_profitability` (수익성 관리)
- **UI 아키타입**: 유형 B (고밀도 그리드)
- **핵심 셀렉터**:
  - 헤더 필터: `[data-mid="trade_profitability-header"]`
  - 손익 KPI 위젯: `[data-mid="trade_profitability-kpi"]`
- **지원 도구**: `trade_profitability_calculate`, `trade_profitability_get_report`

---

### 3.2 [영업관리 (grp_sales)]
#### ① `customer` (고객 관리)
- **UI 아키타입**: 유형 B (고밀도 그리드)
- **핵심 셀렉터**:
  - 엑셀 업로드: `[data-uia="btn-excel-upload-customer"]`
  - 고객 신규등록: `[data-uia="btn-add-customer"]`
  - 고객 검색창: `[data-uia="input-customer-search"]`
  - 고객 리스트 그리드: `[data-uia="table-customer-list"]`
- **헌장 원칙**: N:M 정규화 준수, SiteMaster 독립성 보장 (헌장 1.5).

#### ② `contract` (계약 관리)
- **UI 아키타입**: 유형 A (카드 / 마스터-디테일)
- **핵심 셀렉터**:
  - 신규 계약: `[data-uia="btn-new-contract"]`
  - 계약 상세 패널: `[data-uia="panel-contract-detail"]`
  - 자산 추가: `[data-uia="btn-add-contract-asset"]`
- **헌장 가드레일**: 대차 교체 시 단가, 청구마감일, 현장속성 100% 자동 상속 (헌장 2.2).

#### ③ `voice_dispatch` (음성 출고지시)
- **UI 아키타입**: 유형 A (카드 스튜디오)
- **핵심 셀렉터**:
  - 음성 녹취 업로드: `[data-mid="dispatch4-btn-audio-upload"]`
  - AI 파싱 실행: `[data-mid="dispatch4-btn-parse"]`
  - 파싱 결과 미리보기: `[data-mid="dispatch4-preview-dossier"]`
  - 출고 지시 제출: `[data-mid="dispatch4-btn-submit"]`
- **지원 도구**: `voice_dispatch_transcribe`, `voice_dispatch_parse_order`

---

### 3.3 [배차 및 입출고관리]
#### ① `delivery` (배차 운송 관리)
- **UI 아키타입**: 탭 1 (유형 A 카드 처리) / 탭 2 (유형 B 고밀도 정산 그리드)
- **핵심 셀렉터**:
  - 탭 전환: `[data-uia="tab-dispatch-ops"]`, `[data-uia="tab-dispatch-settle"]`
  - 배차 카드 리스트: `[data-uia="card-delivery-item-{id}"]`
  - 기사 배정: `[data-uia="btn-assign-driver"]`
  - 운송비 입력: `[data-uia="input-delivery-cost"]`
- **헌장 가드레일**: 대차 시 단일 `EXCHANGE` 1건 발행 및 왕복할인(₩60,000) 자동 적용 (헌장 2.3). 배차 단계에서 자산상태 조작 금지 (헌장 1.3).

#### ② `outbound_inspections` (출고 검수 관리)
- **UI 아키타입**: 유형 A (카드 스튜디오)
- **핵심 셀렉터**:
  - 검수 체크리스트: `[data-uia="chk-inspection-item-{code}"]`
  - 검수 승인 마감: `[data-uia="btn-approve-outbound"]`
- **헌장 가드레일**: 승인 완료 즉시 자산 상태 `RENTED`(`대여중`) 확정 전환 (헌장 1.3).

---

### 3.4 [경영관리 및 시스템관리]
#### ① `bank_matching` (은행 입출금 대장)
- **UI 아키타입**: 유형 B (고밀도 그리드, Gutenberg Z-패턴)
- **핵심 셀렉터**:
  - ① 좌상단 (Scope): `[data-uia="select-bank-scope"]`
  - ② 우상단 (Pipeline): `[data-uia="btn-bank-excel-upload"]`
  - ③ 중앙 본문 (Inspection): `[data-uia="table-bank-matching-grid"]`
  - ④ 우하단 (Terminal Action): `[data-uia="btn-confirm-reconciliation"]`

#### ② `tenant_management` (테넌트 관리)
- **UI 아키타입**: 유형 B (고밀도 그리드)
- **핵심 셀렉터**:
  - 검색어 입력: `[data-mid="tenant-scope-search"]`
  - 상태 필터: `[data-mid="tenant-scope-status"]`
  - 엑셀 내보내기: `[data-mid="tenant-pipeline-excel"]`
  - 온보딩 모달: `[data-mid="tenant-pipeline-onboard"]`
  - 신규 등록: `[data-mid="tenant-pipeline-add"]`
  - 테넌트 테이블: `[data-mid="tenant-inspection-grid"]`
- **지원 도구**: `tenant_create`, `tenant_update`, `tenant_extend_subscription`, `tenant_set_default`

---

## 🛡️ 4. 에이전틱 AI 도구 호출(MCP Tool Calling) 연동 규약

모든 에이전틱 AI 액션은 아래 MCP 도구 호출 규격을 따르며, 전사 헌장 가드레일 인터셉터에 의해 실시간 검증됩니다:

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
      "memo": "S-45 고장 대차 교체 (단일 EXCHANGE 및 왕복할인 ₩60,000 적용)"
    }
  }
}
```

---

## 📌 5. 학습 및 작업지시 기초정보 활용 지침

1. **단일 진실의 원천(SSOT) 준수**: 본 문서와 `public/data/uia_manifest.json`은 ERP 전체 메뉴 및 UI 요소의 유일한 정답지이며, 임의의 메뉴 ID 생성이나 셀렉터 날조를 일절 금지합니다.
2. **신규 기능/화면 개발 시**: 본 매트릭스의 그룹 및 아키타입(유형 A / B / C) 분류에 따라 UI 폼, 테이블, 셀렉터를 배치합니다.
3. **작업 지시 및 프롬프트 생성 시**: 메뉴명 뒤에 정확한 영문 `menuId`를 병기(예: `고객 관리(customer)`, `배차 운송 관리(delivery)`)하여 컨텍스트 혼선을 원천 방지합니다.
