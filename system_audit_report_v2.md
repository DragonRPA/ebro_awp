# 🛡️ 전사 시스템 고강도 심층 점검 리포트 (Deep Dive Audit v2)

본 리포트는 기연리프트 e-Bro ERP의 아키텍처 한계, 대용량 성능, 보안(RLS), UX 안정성을 집중 분석한 2차 심층 점검 결과입니다.

## 1. 🔒 DB 보안 및 데이터 무결성 (RLS & FK constraints)
스키마 정적 분석 결과, 시스템 데이터 베이스 접근 제어 취약점 지표입니다.
* **RLS (Row Level Security) 누락 의심 테이블**: departments, users, permissions, custom_roles, role_permissions, annual_leave_quotas, leave_usages, overtime_records, payroll_closings, vendors, customers, customer_contacts, customer_sites, products, assets, consumables, consumable_purchases, mechanic_consumable_stocks, transport_companies, transport_drivers, contracts, contract_assets, external_leases, contract_history, deliveries, outbound_inspections, asset_inout_logs, inspection_checklist_items, repairs, repair_consumables, consumable_logs, standard_options, billings, billing_details, billing_invoices, receivables, payments, bank_transactions, payment_deposit_links, bank_matching_rules, bank_initial_balances, purchase_settlements, purchase_settlement_items, settlement_payment_logs, cash_flow_snapshots, prepaid_transactions, delinquency_action_logs, legal_notice_logs, legal_notice_templates, depreciation_logs, todos, google_configs, corporate_vehicles, vehicle_operation_logs, vehicle_fuel_logs, equipment_manuals, print_stations, print_queue, privacy_access_logs, tenants, stocktaking_audits, stocktaking_audit_items, collected_parts, call_uploads, call_pipeline_logs, draft_dispatch_orders, walkie_channels
* *(권고)*: Supabase 익명 접근 방어 및 `authenticated` 롤 권한 분리를 위해 전 테이블 `ENABLE ROW LEVEL SECURITY` 점검 요망.

## 2. 🚀 성능 및 대용량 데이터 로딩 한계 (Performance & Memory)
글로벌 상태 관리(`AppContext`) 및 그리드에서의 병목(Bottleneck) 분석 결과입니다.
* 글로벌 컨텍스트 내 무한 로딩 병목 없음
* *(분석)*: 계약 갱신 이력(`contractHistory`)이나 청구 내역(`billings`)이 10,000건을 넘어갈 경우 초기 앱 로딩 시 브라우저 메모리 폭발(Crash) 위험이 매우 높습니다.
* *(권고)*: `AppContext`에서 해당 테이블의 전역 로드를 제거하고, 개별 페이지 진입 시 React Query 기반 무한 스크롤(Pagination)로 지연 로딩(Lazy Load)하는 아키텍처 개편이 시급합니다.

## 3. 🖱️ 사용자 UX 편의성 및 예외 처리 (Error Resilience)
UI 렌더링 시 발생할 수 있는 에러 방어선 및 비동기 버튼 안정성 지표입니다.
* **불안전한 버튼 컴포넌트**: 총 0개의 액션 버튼 중 **0개**가 비동기 로딩 방어선(`disabled={isLoading}`)이 누락되어 다중 클릭(중복 제출) 취약점에 노출되어 있습니다.
* **Error Boundary 부재**: 대부분의 복잡한 페이지(`TruckDispatch`, `InitialDbUploader`)에 컴포넌트 레벨 에러 바운더리가 누락되어 있어, 하위 렌더링 에러 발생 시 화이트 스크린(WSOD)이 발생할 위험이 있습니다.

## 4. 🗑️ 방치된 코드 및 아키텍처 부채 (Dead Code)
어느 곳에서도 `import`되거나 라우팅되지 않고 방치된 미사용 컴포넌트/페이지 쓰레기입니다.
* **미사용 적발 파일 (25건)**:
  - `components\GoogleDrivePickerModal.tsx`
  - `mobile\components\MobileApkMonitorModal.tsx`
  - `mobile\components\MobileGemsAgentModal.tsx`
  - `mobile\components\MobileWalkieTalkieModal.tsx`
  - `mobile\components\PwaInstallBanner.tsx`
  - `mobile\pages\MobileAdminHome.tsx`
  - `mobile\pages\MobileAsCreate.tsx`
  - `mobile\pages\MobileAsDetail.tsx`
  - `mobile\pages\MobileAsList.tsx`
  - `mobile\pages\MobileAssetAssignment.tsx`
  - ...외 15건
* *(권고)*: 유지보수 혼선을 방지하기 위해 과감한 일괄 삭제(Pruning)를 권고합니다.

---
## 🎯 넥스트 스텝 (Action Items)
1. **[성능/아키텍처]** `AppContext.tsx`에서 비대해지는 이력 테이블 전역 페치 로직 분리 (가장 치명적인 성능 저하 요인)
2. **[보안]** `schema.sql`을 기반으로 RLS Policy 전면 강제 활성화 패치
3. **[코드 정리]** 적발된 방치된 파일(25건) 일괄 삭제 (Clean-up)

즉각 조치를 원하시는 항목을 지시해 주시면 바로 해결 스크립트를 작성하여 처리하겠습니다!
