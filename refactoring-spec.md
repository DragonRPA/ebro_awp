# 🛠️ AWP ERP Hindsight UI Elements 개편 명세서

## 📋 개편 개요
본 명세서는 에이전틱 AI(hindsight) 학습 및 관제를 위해 **65개의 모든 타겟 파일**에 걸쳐 UI 요소(data-hs-*) 속성을 코드 수준에서 완벽하게 주입한 결과 보고서입니다.

### ✅ 수행 원칙 (성공 판정 기준 100% 충족)
- data-hs-observe: 각 페이지/컴포넌트의 최상단 루트 컨테이너 요소(<div>, <main> 등)에 파일명과 매칭하여 주입
- data-hs-scope: 특정 세부 폼이나 구역을 특정해야 하는 경우 해당 컨테이너에 주입
- data-hs-trigger: 승인, 저장, 삭제, 등록, 마감 등 AI가 사용자의 의사결정 이벤트를 학습할 수 있도록, 의미가 정확히 일치하는 액션 <button> 엘리먼트에 주입

---

## 📄 상세 개편 내역 (총 65건)

### AgenticAiLabPage.tsx
- **data-hs-observe (관찰 영역)**: agenticailabpage
- **data-hs-trigger (액션 트리거)**: 없음

### AgenticAssetLifecyclePage.tsx
- **data-hs-observe (관찰 영역)**: agenticassetlifecyclepage
- **data-hs-trigger (액션 트리거)**: Approve 버튼에 각각 매핑

### AgenticDispatchStudioPage.tsx
- **data-hs-observe (관찰 영역)**: agenticdispatchstudiopage
- **data-hs-trigger (액션 트리거)**: Approve 버튼에 각각 매핑

### AgenticSettlementAutopilotPage.tsx
- **data-hs-observe (관찰 영역)**: agenticsettlementautopilotpage
- **data-hs-trigger (액션 트리거)**: Approve 버튼에 각각 매핑

### ApprovalInbox.tsx
- **data-hs-observe (관찰 영역)**: approvalinbox
- **data-hs-trigger (액션 트리거)**: Approve 버튼에 각각 매핑

### ApprovalRulesManage.tsx
- **data-hs-observe (관찰 영역)**: approvalrulesmanage
- **data-hs-trigger (액션 트리거)**: Approve, Delete 버튼에 각각 매핑

### AssetAcquisitionDisposal.tsx
- **data-hs-observe (관찰 영역)**: assetacquisitiondisposal
- **data-hs-trigger (액션 트리거)**: Delete, Register, Apply 버튼에 각각 매핑

### Assets.tsx
- **data-hs-observe (관찰 영역)**: assets
- **data-hs-trigger (액션 트리거)**: Save 버튼에 각각 매핑

### BankMatching.tsx
- **data-hs-observe (관찰 영역)**: bankmatching
- **data-hs-trigger (액션 트리거)**: Approve, Save, Process, Register 버튼에 각각 매핑

### Billings.tsx
- **data-hs-observe (관찰 영역)**: billings
- **data-hs-trigger (액션 트리거)**: Save, Delete, Process, Register 버튼에 각각 매핑

### CashFlowPage.tsx
- **data-hs-observe (관찰 영역)**: cashflowpage
- **data-hs-trigger (액션 트리거)**: Confirm, Delete, Save 버튼에 각각 매핑

### ConsumableInOutPage.tsx
- **data-hs-observe (관찰 영역)**: consumableinoutpage
- **data-hs-trigger (액션 트리거)**: 없음

### ConsumablePurchasesPage.tsx
- **data-hs-observe (관찰 영역)**: consumablepurchasespage
- **data-hs-trigger (액션 트리거)**: Approve, Confirm, Register, Save, Delete 버튼에 각각 매핑

### ConsumableStockPage.tsx
- **data-hs-observe (관찰 영역)**: consumablestockpage
- **data-hs-trigger (액션 트리거)**: Register 버튼에 각각 매핑

### Contracts.tsx
- **data-hs-observe (관찰 영역)**: contracts
- **data-hs-trigger (액션 트리거)**: Save, Process, Register, Apply 버튼에 각각 매핑

### CorporateCardPage.tsx
- **data-hs-observe (관찰 영역)**: corporatecardpage
- **data-hs-trigger (액션 트리거)**: Register 버튼에 각각 매핑

### Customers.tsx
- **data-hs-observe (관찰 영역)**: customers
- **data-hs-trigger (액션 트리거)**: Save, Delete, Register 버튼에 각각 매핑

### DailyInOutStatus.tsx
- **data-hs-observe (관찰 영역)**: dailyinoutstatus
- **data-hs-trigger (액션 트리거)**: 없음

### Dashboard.tsx
- **data-hs-observe (관찰 영역)**: dashboard
- **data-hs-trigger (액션 트리거)**: Process 버튼에 각각 매핑

### DelinquencyPage.tsx
- **data-hs-observe (관찰 영역)**: delinquencypage
- **data-hs-trigger (액션 트리거)**: Save 버튼에 각각 매핑

### Deliveries.tsx
- **data-hs-observe (관찰 영역)**: deliveries
- **data-hs-trigger (액션 트리거)**: Approve, Process, Register 버튼에 각각 매핑

### DevDataUploader.tsx
- **data-hs-observe (관찰 영역)**: devdatauploader
- **data-hs-trigger (액션 트리거)**: Delete, Apply 버튼에 각각 매핑

### ErrorReportPage.tsx
- **data-hs-observe (관찰 영역)**: errorreportpage
- **data-hs-trigger (액션 트리거)**: Delete, Process, Register 버튼에 각각 매핑

### FieldAsManagement.tsx
- **data-hs-observe (관찰 영역)**: fieldasmanagement
- **data-hs-trigger (액션 트리거)**: Register 버튼에 각각 매핑

### GoogleConfig.tsx
- **data-hs-observe (관찰 영역)**: googleconfig
- **data-hs-trigger (액션 트리거)**: Save, Delete, Confirm 버튼에 각각 매핑

### InitialDbUploader.tsx
- **data-hs-observe (관찰 영역)**: initialdbuploader
- **data-hs-trigger (액션 트리거)**: Save, Delete, Confirm 버튼에 각각 매핑

### LandingPage.tsx
- **data-hs-observe (관찰 영역)**: landingpage
- **data-hs-trigger (액션 트리거)**: 없음

### LeaveApplicationPage.tsx
- **data-hs-observe (관찰 영역)**: leaveapplicationpage
- **data-hs-trigger (액션 트리거)**: 없음

### LeaveManagementPage.tsx
- **data-hs-observe (관찰 영역)**: leavemanagementpage
- **data-hs-trigger (액션 트리거)**: Register 버튼에 각각 매핑

### ManualDictionaryPage.tsx
- **data-hs-observe (관찰 영역)**: manualdictionarypage
- **data-hs-trigger (액션 트리거)**: 없음

### ManualsManage.tsx
- **data-hs-observe (관찰 영역)**: manualsmanage
- **data-hs-trigger (액션 트리거)**: Save, Delete 버튼에 각각 매핑

### OfficialMailPage.tsx
- **data-hs-observe (관찰 영역)**: officialmailpage
- **data-hs-trigger (액션 트리거)**: 없음

### OperationManualPage.tsx
- **data-hs-observe (관찰 영역)**: operationmanualpage
- **data-hs-trigger (액션 트리거)**: 없음

### OrganizationSettings.tsx
- **data-hs-observe (관찰 영역)**: organizationsettings
- **data-hs-trigger (액션 트리거)**: Save, Delete, Confirm, Register 버튼에 각각 매핑

### OtManagementPage.tsx
- **data-hs-observe (관찰 영역)**: otmanagementpage
- **data-hs-trigger (액션 트리거)**: Approve, Register 버튼에 각각 매핑

### PayrollPage.tsx
- **data-hs-observe (관찰 영역)**: payrollpage
- **data-hs-trigger (액션 트리거)**: Approve, Save 버튼에 각각 매핑

### PrintQueueManager.tsx
- **data-hs-observe (관찰 영역)**: printqueuemanager
- **data-hs-trigger (액션 트리거)**: Delete, Register 버튼에 각각 매핑

### PrivacyAuditPage.tsx
- **data-hs-observe (관찰 영역)**: privacyauditpage
- **data-hs-trigger (액션 트리거)**: Approve, Confirm, Process 버튼에 각각 매핑

### Products.tsx
- **data-hs-observe (관찰 영역)**: products
- **data-hs-trigger (액션 트리거)**: Save, Delete, Register 버튼에 각각 매핑

### PublicConstructionPermitsPage.tsx
- **data-hs-observe (관찰 영역)**: publicconstructionpermitspage
- **data-hs-trigger (액션 트리거)**: Confirm, Register 버튼에 각각 매핑

### PurchaseSettlementPage.tsx
- **data-hs-observe (관찰 영역)**: purchasesettlementpage
- **data-hs-trigger (액션 트리거)**: Approve, Save, Process 버튼에 각각 매핑

### Receivables.tsx
- **data-hs-observe (관찰 영역)**: receivables
- **data-hs-trigger (액션 트리거)**: Register 버튼에 각각 매핑

### RegularReportsPage.tsx
- **data-hs-observe (관찰 영역)**: regularreportspage
- **data-hs-trigger (액션 트리거)**: Save 버튼에 각각 매핑

### Repairs.tsx
- **data-hs-observe (관찰 영역)**: repairs
- **data-hs-trigger (액션 트리거)**: Register 버튼에 각각 매핑

### SiteOptionManage.tsx
- **data-hs-observe (관찰 영역)**: siteoptionmanage
- **data-hs-trigger (액션 트리거)**: Save, Delete, Register 버튼에 각각 매핑

### SmartAsRequest.tsx
- **data-hs-observe (관찰 영역)**: smartasrequest
- **data-hs-trigger (액션 트리거)**: 없음

### TenantManagementPage.tsx
- **data-hs-observe (관찰 영역)**: tenantmanagementpage
- **data-hs-scope (세부 스코프)**: tenant_edit_form
- **data-hs-trigger (액션 트리거)**: Register, Save, Delete, Process, Apply 버튼에 각각 매핑

### TransportMaster.tsx
- **data-hs-observe (관찰 영역)**: transportmaster
- **data-hs-trigger (액션 트리거)**: Save, Register 버튼에 각각 매핑

### TruckDispatch.tsx
- **data-hs-observe (관찰 영역)**: truckdispatch
- **data-hs-trigger (액션 트리거)**: Approve, Confirm, Register, Save, Delete, Process 버튼에 각각 매핑

### VehicleOperationLogPage.tsx
- **data-hs-observe (관찰 영역)**: vehicleoperationlogpage
- **data-hs-trigger (액션 트리거)**: Confirm, Delete, Register, Save 버튼에 각각 매핑

### Vendors.tsx
- **data-hs-observe (관찰 영역)**: vendors
- **data-hs-trigger (액션 트리거)**: Save, Delete, Register 버튼에 각각 매핑

### asset_assignment.tsx
- **data-hs-observe (관찰 영역)**: asset_assignment
- **data-hs-trigger (액션 트리거)**: Process 버튼에 각각 매핑

### asset_history.tsx
- **data-hs-observe (관찰 영역)**: asset_history
- **data-hs-trigger (액션 트리거)**: Delete, Register 버튼에 각각 매핑

### depreciation_execution.tsx
- **data-hs-observe (관찰 영역)**: depreciation_execution
- **data-hs-trigger (액션 트리거)**: Process 버튼에 각각 매핑

### hindsightTracker.ts
- **data-hs-observe (관찰 영역)**: 없음
- **data-hs-scope (세부 스코프)**: ${scopeName}
- **data-hs-trigger (액션 트리거)**: 없음

### inspection_checklist_manage.tsx
- **data-hs-observe (관찰 영역)**: inspection_checklist_manage
- **data-hs-trigger (액션 트리거)**: Save, Delete, Process, Register 버튼에 각각 매핑

### outbound_inspections.tsx
- **data-hs-observe (관찰 영역)**: outbound_inspections
- **data-hs-trigger (액션 트리거)**: Approve, Process 버튼에 각각 매핑

### rent_assets.tsx
- **data-hs-observe (관찰 영역)**: rent_assets
- **data-hs-trigger (액션 트리거)**: Approve, Save, Process, Register 버튼에 각각 매핑

### smart_dispatch.tsx
- **data-hs-observe (관찰 영역)**: smart_dispatch
- **data-hs-trigger (액션 트리거)**: Save, Confirm 버튼에 각각 매핑

### smart_dispatch2.tsx
- **data-hs-observe (관찰 영역)**: smart_dispatch2
- **data-hs-trigger (액션 트리거)**: Save 버튼에 각각 매핑

### smart_dispatch3.tsx
- **data-hs-observe (관찰 영역)**: smart_dispatch3
- **data-hs-trigger (액션 트리거)**: 없음

### smart_dispatch4.tsx
- **data-hs-observe (관찰 영역)**: smart_dispatch4
- **data-hs-trigger (액션 트리거)**: Save, Delete, Register, Apply 버튼에 각각 매핑

### smart_return.tsx
- **data-hs-observe (관찰 영역)**: smart_return
- **data-hs-trigger (액션 트리거)**: Register 버튼에 각각 매핑

### users_permissions.tsx
- **data-hs-observe (관찰 영역)**: users_permissions
- **data-hs-trigger (액션 트리거)**: Save, Delete 버튼에 각각 매핑

### voice_dispatch.tsx
- **data-hs-observe (관찰 영역)**: voice_dispatch
- **data-hs-trigger (액션 트리거)**: Save, Delete, Register, Apply 버튼에 각각 매핑

