// scripts/scan_menu_ui_consistency.cjs
// Scan all menu pages in eBro to audit:
// 1. Menu title display (presence, h1/h2/h3, icon, data-mid, dry syntax)
// 2. UI flow consistency (Gutenberg Z-pattern: scope, pipeline, body, terminal)
// 3. Unnecessary margins/padding (outer padding, nested card bloat)
// 4. Inter-component spacing & vertical label-input stacks (gap: 4px, nowrap)

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'src', 'pages');

// Map of all active menu IDs and their corresponding page files
const MENU_REGISTRY = [
  // grp_distribution
  { menuId: 'trade_products', file: 'distribution/TradeProductsPage.tsx', group: '영업-유통', name: '상품 등록 및 관리' },
  { menuId: 'trade_purchases', file: 'distribution/TradePurchasesPage.tsx', group: '영업-유통', name: '구매 및 입고' },
  { menuId: 'trade_contracts', file: 'distribution/TradeContractsPage.tsx', group: '영업-유통', name: '유통 계약 관리' },
  { menuId: 'trade_outbounds', file: 'distribution/TradeOutboundPage.tsx', group: '영업-유통', name: '출고 요청' },
  { menuId: 'courier_dispatch', file: 'distribution/CourierDispatchPage.tsx', group: '영업-유통', name: '택배 배송 관리' },
  { menuId: 'trade_billing', file: 'distribution/TradeBillingPage.tsx', group: '영업-유통', name: '유통 청구 및 명세' },
  { menuId: 'trade_returns', file: 'distribution/TradeReturnsPage.tsx', group: '영업-유통', name: '환입 및 반품' },
  { menuId: 'trade_profitability', file: 'distribution/TradeProfitabilityPage.tsx', group: '영업-유통', name: '수익성 관리' },

  // grp_approval
  { menuId: 'approvalInbox', file: 'ApprovalInbox.tsx', group: '결재 센터', name: '내 결재함' },
  { menuId: 'approvalRules', file: 'ApprovalRulesManage.tsx', group: '결재 센터', name: '결재선 규칙 설정' },

  // grp_sales
  { menuId: 'customer', file: 'Customers.tsx', group: '영업관리', name: '고객 관리' },
  { menuId: 'site_options', file: 'SiteOptionManage.tsx', group: '영업관리', name: '현장별 옵션 관리' },
  { menuId: 'contract', file: 'Contracts.tsx', group: '영업관리', name: '계약 관리' },
  { menuId: 'billing', file: 'Billings.tsx', group: '영업관리', name: '청구 수납 관리' },
  { menuId: 'receivable', file: 'Receivables.tsx', group: '영업관리', name: '외상미수금 대장' },
  { menuId: 'smart_dispatch4', file: 'smart_dispatch4.tsx', group: '영업관리', name: '출고 요청' },
  { menuId: 'voice_dispatch', file: 'voice_dispatch.tsx', group: '영업관리', name: '음성 출고지시' },
  { menuId: 'smart_return', file: 'smart_return.tsx', group: '영업관리', name: '회수 요청' },
  { menuId: 'smart_as_request', file: 'SmartAsRequest.tsx', group: '영업관리', name: 'AS 요청' },
  { menuId: 'delinquency', file: 'DelinquencyPage.tsx', group: '영업관리', name: '미수 채권 연체 관리' },
  { menuId: 'official_mail', file: 'OfficialMailPage.tsx', group: '영업관리', name: '공식 메일 발송' },
  { menuId: 'public_construction_permits', file: 'PublicConstructionPermitsPage.tsx', group: '영업관리', name: '인허가 건축공정 조회' },

  // grp_product_asset
  { menuId: 'product', file: 'Products.tsx', group: '자산관리', name: '제품 관리' },
  { menuId: 'asset', file: 'Assets.tsx', group: '자산관리', name: '자산 관리' },
  { menuId: 'acquisition_disposal', file: 'AssetAcquisitionDisposal.tsx', group: '자산관리', name: '자산 취득 매각' },
  { menuId: 'rent_asset', file: 'rent_assets.tsx', group: '자산관리', name: '임차 장비 관리' },

  // grp_logistics
  { menuId: 'delivery', file: 'TruckDispatch.tsx', group: '배차 운송관리', name: '배차 운송 관리' },
  { menuId: 'transport_master', file: 'TransportMaster.tsx', group: '배차 운송관리', name: '운송 거래처 관리' },

  // grp_inout
  { menuId: 'daily_inout', file: 'DailyInOutStatus.tsx', group: '입출고관리', name: '일일 입출고 조회' },
  { menuId: 'asset_inout_history', file: 'asset_history.tsx', group: '입출고관리', name: '입출고 조회' },
  { menuId: 'dispatch_assign', file: 'asset_assignment.tsx', group: '입출고관리', name: '장비 할당' },
  { menuId: 'outbound_inspections', file: 'outbound_inspections.tsx', group: '입출고관리', name: '출고 검수 관리' },
  { menuId: 'consumable_stock', file: 'ConsumableStockPage.tsx', group: '입출고관리', name: '주기장 소모품 재고' },
  { menuId: 'stocktaking', file: 'StocktakingPage.tsx', group: '입출고관리', name: '재고 실사' },
  { menuId: 'print_queue_monitor', file: 'PrintQueueManager.tsx', group: '입출고관리', name: '프린트 큐 모니터' },

  // grp_maintenance
  { menuId: 'consumable_purchase', file: 'ConsumablePurchasesPage.tsx', group: '정비 소모품관리', name: '소모품 구매' },
  { menuId: 'consumable_inout', file: 'ConsumableInOutPage.tsx', group: '정비 소모품관리', name: '소모품 입출고' },
  { menuId: 'field_as', file: 'FieldAsManagement.tsx', group: '정비 소모품관리', name: '현장 AS 관리' },
  { menuId: 'repair', file: 'Repairs.tsx', group: '정비 소모품관리', name: '주기장 정비 관리' },
  { menuId: 'inspection_checklist_manage', file: 'inspection_checklist_manage.tsx', group: '정비 소모품관리', name: '정비 항목 관리' },

  // grp_management
  { menuId: 'leave_application', file: 'LeaveApplicationPage.tsx', group: '경영관리', name: '연차신청' },
  { menuId: 'ot_management', file: 'OtManagementPage.tsx', group: '경영관리', name: '연장근무 관리' },
  { menuId: 'vehicle_log', file: 'VehicleOperationLogPage.tsx', group: '경영관리', name: '차량 주유관리' },
  { menuId: 'purchase_settlement', file: 'PurchaseSettlementPage.tsx', group: '경영관리', name: '월말 매입 정산' },
  { menuId: 'vendors', file: 'Vendors.tsx', group: '경영관리', name: '매입처 관리' },
  { menuId: 'bank_matching', file: 'BankMatching.tsx', group: '경영관리', name: '은행 입출금 대장' },
  { menuId: 'corporate_card', file: 'CorporateCardPage.tsx', group: '경영관리', name: '법인카드 매입정산' },
  { menuId: 'cash_flow', file: 'CashFlowPage.tsx', group: '경영관리', name: '자금 흐름 분석' },
  { menuId: 'depreciation_execution', file: 'depreciation_execution.tsx', group: '경영관리', name: '감가상각 마감 실행' },
  { menuId: 'regular_reports', file: 'RegularReportsPage.tsx', group: '경영관리', name: '정기보고서 생성' },

  // grp_management_special
  { menuId: 'organization', file: 'OrganizationSettings.tsx', group: '경영관리 - 특수', name: '조직 인사 관리' },
  { menuId: 'permission', file: 'users_permissions.tsx', group: '경영관리 - 특수', name: '사용자 및 권한' },
  { menuId: 'manual_dictionary', file: 'ManualDictionaryPage.tsx', group: '경영관리 - 특수', name: '전사 업무 매뉴얼 사전' },
  { menuId: 'payroll', file: 'PayrollPage.tsx', group: '경영관리 - 특수', name: '급여 정산' },
  { menuId: 'leave_management', file: 'LeaveManagementPage.tsx', group: '경영관리 - 특수', name: '연차관리' },
  { menuId: 'privacy_audit', file: 'PrivacyAuditPage.tsx', group: '경영관리 - 특수', name: '개인정보 접속 감사' },

  // grp_tools
  { menuId: 'operations_manual', file: 'OperationManualPage.tsx', group: '도구 및 다운로드', name: '업무매뉴얼' },
  { menuId: 'error_report', file: 'ErrorReportPage.tsx', group: '도구 및 다운로드', name: '오류 신고' },

  // grp_system_dev
  { menuId: 'agentic_ai_lab', file: 'AgenticAiLabPage.tsx', group: '시스템관리 - 개발자', name: 'AI 샌드박스 랩' },
  { menuId: 'agentic_dispatch_studio', file: 'AgenticDispatchStudioPage.tsx', group: '시스템관리 - 개발자', name: '배차 관제 스튜디오' },
  { menuId: 'agentic_settlement_autopilot', file: 'AgenticSettlementAutopilotPage.tsx', group: '시스템관리 - 개발자', name: '월말 대사 정산' },
  { menuId: 'agentic_asset_lifecycle', file: 'AgenticAssetLifecyclePage.tsx', group: '시스템관리 - 개발자', name: '자산 라이프사이클 관제' },
  { menuId: 'initial_db_upload', file: 'InitialDbUploader.tsx', group: '시스템관리 - 개발자', name: '초기DB 업로드' },
  { menuId: 'data_formation', file: 'DataFormationStudio.tsx', group: '시스템관리 - 개발자', name: '초기자료형성' },
  { menuId: 'google_config', file: 'GoogleConfig.tsx', group: '시스템관리 - 개발자', name: '공식 메일 연동 설정' },
  { menuId: 'dev_uploader', file: 'DevDataUploader.tsx', group: '시스템관리 - 개발자', name: 'DB 데이터 업로더' },
  { menuId: 'tenant_management', file: 'TenantManagementPage.tsx', group: '시스템관리 - 개발자', name: '테넌트 관리' },

  // dashboard
  { menuId: 'dashboard', file: 'Dashboard.tsx', group: '메인', name: '대시보드' }
];

console.log(`Auditing ${MENU_REGISTRY.length} menu pages for UI/UX consistency...\n`);

const results = [];

MENU_REGISTRY.forEach(item => {
  const filePath = path.join(PAGES_DIR, item.file);
  if (!fs.existsSync(filePath)) {
    results.push({
      ...item,
      exists: false,
      issues: ['File not found: ' + item.file]
    });
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  const issues = [];
  const findings = {};

  // 1. Title / Header Detection
  // Check if there is an h1, h2, or h3 tag with title or data-mid
  const hasH1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.test(content);
  const hasH2 = /<h2[^>]*>([\s\S]*?)<\/h2>/i.test(content);
  const hasH3 = /<h3[^>]*>([\s\S]*?)<\/h3>/i.test(content);
  const hasHeaderMid = /data-mid=["'][^"']*-header["']/i.test(content);
  const hasTitleMid = /data-mid=["'][^"']*-title["']/i.test(content);
  const hasPageHeaderClass = /className=["'][^"']*page-header[^"']*["']/i.test(content);
  const hasHeaderTag = /<header[^>]*>/i.test(content);

  findings.hasHeader = hasH1 || hasH2 || hasH3 || hasHeaderMid || hasTitleMid || hasPageHeaderClass || hasHeaderTag;

  // Extract title text if possible
  const titleMatch = content.match(/<(?:h1|h2|h3)[^>]*>([\s\S]*?)<\/(?:h1|h2|h3)>/i);
  let extractedTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  extractedTitle = extractedTitle.replace(/\{[^}]+\}/g, '').trim();
  findings.extractedTitle = extractedTitle;

  if (!findings.hasHeader) {
    issues.push('❌ 헤더/제목 표시 누락 (h1/h2/h3 또는 header 컨테이너 없음)');
  }

  // Check for icon next to title
  const hasIconNearTitle = /<(?:h1|h2|h3)[^>]*>[\s\S]*?<[A-Z][a-zA-Z]+ size=|<[A-Z][a-zA-Z]+ size=[\s\S]*?<(?:h1|h2|h3)/.test(content);
  findings.hasIconNearTitle = hasIconNearTitle;

  // 2. Unnecessary padding / margins
  // Outer padding check: does the root return div/main specify excessive padding (e.g. 24px, 30px, 40px)
  const returnMatch = content.match(/return\s*\(\s*(<[a-zA-Z0-9]+[^>]*>)/);
  let rootPadding = null;
  if (returnMatch) {
    const padMatch = returnMatch[1].match(/padding:\s*['"]([^'"]+)['"]/);
    if (padMatch) {
      rootPadding = padMatch[1];
      if (/([1-9]\dpx|2\dpx|3\dpx|4\dpx)/.test(rootPadding) && rootPadding !== '0' && rootPadding !== '0px') {
        issues.push(`⚠️ 과도한 루트 여백 감지 (${rootPadding}) - 상위 main-content-area 패딩(16px 20px)과 중복`);
      }
    }
  }

  // Nested cards check (Card in Card - Charter 3.7 AI-Slop rule 1)
  const cardOccurrences = (content.match(/className=["'][^"']*\bcard\b[^"']*["']/g) || []).length;
  findings.cardCount = cardOccurrences;
  if (cardOccurrences > 4 && !content.includes('gridTemplateColumns')) {
    issues.push(`⚠️ 다수 카드 중첩 의심 (card 클래스 ${cardOccurrences}회 사용)`);
  }

  // 3. UI Flow (Gutenberg Z-Pattern)
  // Check for search/filter (Scope)
  const hasSearchOrFilter = /data-mid=["'][^"']*(?:search|filter)[^"']*["']|placeholder=["'][^"']*검색[^"']*["']|type=["']month["']|type=["']date["']/i.test(content);
  findings.hasSearchOrFilter = hasSearchOrFilter;

  // Check for Action Buttons (Pipeline / Terminal)
  const hasButtons = /<button/i.test(content);
  findings.hasButtons = hasButtons;

  // 4. Uniform Inter-Component Spacing & Form Layout (Charter 3.4)
  // Check if labels are positioned horizontally next to inputs (Charter 3.4 violation: horizontal layout)
  const hasHorizontalLabelForm = /display:\s*['"]flex['"],\s*alignItems:\s*['"]center['"],\s*gap:[^}]*<label/i.test(content) ||
                                 /<label[^>]*>[^<]*<\/label>\s*<input/i.test(content);
  
  // Check table nowrap (Charter 3.2)
  const hasTable = /<table/i.test(content);
  findings.hasTable = hasTable;
  const hasTableNoWrap = /whiteSpace:\s*['"]nowrap['"]|className=["'][^"']*whitespace-nowrap[^"']*["']/i.test(content);
  findings.hasTableNoWrap = hasTableNoWrap;

  if (hasTable && !hasTableNoWrap) {
    issues.push('⚠️ 테이블 셀 줄바꿈 방지(white-space: nowrap) 부재 의심 (헌장 3.2)');
  }

  // Check 3-state sorting on tables
  const hasSortableTh = /SortableTh|sortField|requestSort/i.test(content);
  findings.hasSortableTh = hasSortableTh;
  if (hasTable && !hasSortableTh && !content.includes('sortConfig')) {
    // Info level
  }

  results.push({
    ...item,
    exists: true,
    findings,
    issues
  });
});

// Summary
console.log('='.repeat(80));
console.log('UI/UX CONSISTENCY AUDIT REPORT');
console.log('='.repeat(80));

const defectiveItems = results.filter(r => r.issues && r.issues.length > 0);
console.log(`Total Pages Scanned: ${results.length}`);
console.log(`Compliant Pages: ${results.length - defectiveItems.length}`);
console.log(`Pages Requiring Uniformity Adjustment: ${defectiveItems.length}\n`);

defectiveItems.forEach((item, idx) => {
  console.log(`[${idx + 1}] [${item.group}] ${item.name} (${item.menuId}) -> ${item.file}`);
  console.log(`    Extracted Title: "${item.findings.extractedTitle || 'NONE'}"`);
  item.issues.forEach(iss => console.log(`    ${iss}`));
  console.log('');
});

// Output JSON file for programmatic reference
fs.writeFileSync(
  path.join(__dirname, 'ui_consistency_scan_result.json'),
  JSON.stringify(results, null, 2),
  'utf8'
);
console.log('Detailed scan result written to scripts/ui_consistency_scan_result.json');
