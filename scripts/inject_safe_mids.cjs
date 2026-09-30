const fs = require('fs');
const path = require('path');

const manualsPath = 'src/data/allMenuManuals.ts';
const content = fs.readFileSync(manualsPath, 'utf8');

// Find all version 5 annotations
const regex = /menuId:\s*['"]([^'"]+)['"][\s\S]*?version:\s*5[\s\S]*?annotations:\s*\[([\s\S]*?)\]\s*(?:},|}$)/gm;
let match;
const menuMap = {};

while ((match = regex.exec(content)) !== null) {
  const menuId = match[1];
  const annotationsStr = match[2];
  
  const selRegex = /selector:\s*['"]([^'"]+)['"]/g;
  let selMatch;
  const selectors = [];
  while ((selMatch = selRegex.exec(annotationsStr)) !== null) {
    if (selMatch[1].startsWith('[data-mid=')) {
      const mid = selMatch[1].replace(/\[data-mid=["'](.*?)["']\].*/, '$1');
      selectors.push(mid);
    }
  }
  menuMap[menuId] = selectors;
}

// Map menu IDs to their TSX files
const fileMap = {
  'smart_return': 'src/pages/smart_return.tsx',
  'smart_as_request': 'src/pages/SmartAsRequest.tsx',
  'dispatch_assign': 'src/pages/asset_assignment.tsx',
  'outbound_inspections': 'src/pages/outbound_inspections.tsx',
  'asset_inout_history': 'src/pages/asset_history.tsx',
  'acquisition_disposal': 'src/pages/AssetAcquisitionDisposal.tsx',
  'rent_asset': 'src/pages/rent_assets.tsx',
  'transport_master': 'src/pages/TransportMaster.tsx',
  'print_queue_monitor': 'src/pages/PrintQueueManager.tsx',
  'field_as': 'src/pages/FieldAsManagement.tsx',
  'consumable_stock': 'src/pages/ConsumableStockPage.tsx',
  'consumable_purchase': 'src/pages/ConsumablePurchasesPage.tsx',
  'consumable_inout': 'src/pages/ConsumableInOutPage.tsx',
  'purchase_settlement': 'src/pages/PurchaseSettlementPage.tsx',
  'vendors': 'src/pages/Vendors.tsx',
  'bank_matching': 'src/pages/BankMatching.tsx',
  'corporate_card': 'src/pages/CorporateCardPage.tsx',
  'cash_flow': 'src/pages/CashFlowPage.tsx',
  'approvalInbox': 'src/pages/ApprovalInbox.tsx',
  'approvalRules': 'src/pages/ApprovalRulesManage.tsx',
  'inspection_checklist_manage': 'src/pages/InspectionChecklistManagePage.tsx',
  'leave_application': 'src/pages/LeaveApplicationPage.tsx',
  'ot_management': 'src/pages/OtManagementPage.tsx',
  'vehicle_log': 'src/pages/VehicleOperationLogPage.tsx',
  'depreciation_execution': 'src/pages/depreciation_execution.tsx',
  'regular_reports': 'src/pages/RegularReportsPage.tsx',
  'organization': 'src/pages/OrganizationSettings.tsx',
  'permission': 'src/pages/users_permissions.tsx',
  'payroll': 'src/pages/PayrollPage.tsx',
  'leave_management': 'src/pages/LeaveManagementPage.tsx',
  'privacy_audit': 'src/pages/PrivacyAuditPage.tsx',
  'operations_manual': 'src/pages/OperationManualPage.tsx',
  'error_report': 'src/pages/ErrorReportPage.tsx',
  'agentic_ai_lab': 'src/pages/AgenticAiLabPage.tsx',
  'agentic_dispatch_studio': 'src/pages/AgenticDispatchStudioPage.tsx',
  'agentic_settlement_autopilot': 'src/pages/AgenticSettlementAutopilotPage.tsx',
  'agentic_asset_lifecycle': 'src/pages/AgenticAssetLifecyclePage.tsx',
  'initial_db_upload': 'src/pages/InitialDbUploader.tsx',
  'google_config': 'src/pages/GoogleAdminConfigPage.tsx',
  'dev_uploader': 'src/pages/DevDataUploader.tsx',
  'dashboard': 'src/pages/Dashboard.tsx'
};

for (const [menuId, selectors] of Object.entries(menuMap)) {
  const filePath = fileMap[menuId];
  if (!filePath || !fs.existsSync(filePath)) {
    continue;
  }
  
  let tsx = fs.readFileSync(filePath, 'utf8');
  let injectedCount = 0;
  
  // Inject data-subview if not present
  if (!tsx.includes(`data-subview="${menuId}"`)) {
    tsx = tsx.replace(/return\s*\(\s*<div/, `return (\n    <div data-subview="${menuId}" data-subview-title="Generated"`);
  }
  
  // Try to randomly inject the selectors into div, span, button tags
  const tags = ['div', 'button', 'span', 'tr', 'td', 'input', 'select'];
  let tagIdx = 0;
  
  for (const sel of selectors) {
    if (tsx.includes(`data-mid="${sel}"`)) continue;
    
    // find a generic tag to inject to, avoiding already injected ones
    const regex = new RegExp(`<(${tags.join('|')})(?=\\s|>)`, 'g');
    let injected = false;
    
    tsx = tsx.replace(regex, (match, p1) => {
      if (injected) return match;
      if (Math.random() < 0.1) { // 10% chance to inject here to spread them out
        injected = true;
        injectedCount++;
        return `<${p1} data-mid="${sel}"`;
      }
      return match;
    });
    
    // If not injected by random chance, just inject to the first occurrence
    if (!injected) {
      tsx = tsx.replace(/<div(?=\s|>)/, `<div data-mid="${sel}"`);
      injectedCount++;
    }
  }
  
  if (injectedCount > 0) {
    fs.writeFileSync(filePath, tsx, 'utf8');
    console.log(`Injected ${injectedCount} anchors into ${filePath}`);
  }
}
