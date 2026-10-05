// src/utils/menuNavigator.ts
// 전사 메뉴 및 하위 탭/뷰 네비게이션 SSOT 매핑 딕셔너리 및 유틸리티

export interface MenuNavTarget {
  tabId: string;
  subTabTrigger?: string;
}

/**
 * allMenuManuals 57개 menuId를 AppContext의 activeTab 및 내부 서브탭/버튼 트리거 셀렉터로 매핑하는 SSOT 딕셔너리
 */
export const MENU_TO_APP_TAB_MAP: Record<string, MenuNavTarget> = {
  // ─── 특별 매핑 (하위 탭 및 버튼 트리거 동반 메뉴) ───
  contract: { tabId: 'contract' },
  contract_create: { tabId: 'contract', subTabTrigger: '[data-mid="btn-new-contract"]' },
  billing: { tabId: 'billing', subTabTrigger: '[data-mid="tab-billing-list"]' },
  billing_wizard: { tabId: 'billing', subTabTrigger: '[data-mid="tab-billing-wizard"]' },
  billing_invoice: { tabId: 'billing', subTabTrigger: '[data-mid="tab-billing-invoice"]' },
  billing_waiver: { tabId: 'billing', subTabTrigger: '[data-mid="tab-billing-waiver"]' },

  // ─── 기본 1:1 매핑 (allMenuManuals 57종 전사 표준 메뉴) ───
  dashboard: { tabId: 'dashboard' },
  approvalInbox: { tabId: 'approvalInbox' },
  approvalRules: { tabId: 'approvalRules' },
  customer: { tabId: 'customer' },
  site_options: { tabId: 'site_options' },
  receivable: { tabId: 'receivable' },
  smart_dispatch4: { tabId: 'smart_dispatch4' },
  smart_return: { tabId: 'smart_return' },
  smart_as_request: { tabId: 'smart_as_request' },
  delinquency: { tabId: 'delinquency' },
  product: { tabId: 'product' },
  asset: { tabId: 'asset' },
  acquisition_disposal: { tabId: 'acquisition_disposal' },
  rent_asset: { tabId: 'rent_asset' },
  delivery: { tabId: 'delivery' },
  transport_master: { tabId: 'transport_master' },
  daily_inout: { tabId: 'daily_inout' },
  asset_inout_history: { tabId: 'asset_inout_history' },
  dispatch_assign: { tabId: 'dispatch_assign' },
  outbound_inspections: { tabId: 'outbound_inspections' },
  consumable_stock: { tabId: 'consumable_stock' },
  print_queue_monitor: { tabId: 'print_queue_monitor' },
  consumable_purchase: { tabId: 'consumable_purchase' },
  consumable_inout: { tabId: 'consumable_inout' },
  field_as: { tabId: 'field_as' },
  repair: { tabId: 'repair' },
  inspection_checklist_manage: { tabId: 'inspection_checklist_manage' },
  leave_application: { tabId: 'leave_application' },
  ot_management: { tabId: 'ot_management' },
  vehicle_log: { tabId: 'vehicle_log' },
  purchase_settlement: { tabId: 'purchase_settlement' },
  vendors: { tabId: 'vendors' },
  bank_matching: { tabId: 'bank_matching' },
  corporate_card: { tabId: 'corporate_card' },
  cash_flow: { tabId: 'cash_flow' },
  depreciation_execution: { tabId: 'depreciation_execution' },
  regular_reports: { tabId: 'regular_reports' },
  organization: { tabId: 'organization' },
  permission: { tabId: 'permission' },
  payroll: { tabId: 'payroll' },
  leave_management: { tabId: 'leave_management' },
  privacy_audit: { tabId: 'privacy_audit' },
  operations_manual: { tabId: 'operations_manual' },
  error_report: { tabId: 'error_report' },
  agentic_ai_lab: { tabId: 'agentic_ai_lab' },
  agentic_dispatch_studio: { tabId: 'agentic_dispatch_studio' },
  agentic_settlement_autopilot: { tabId: 'agentic_settlement_autopilot' },
  agentic_asset_lifecycle: { tabId: 'agentic_asset_lifecycle' },
  initial_db_upload: { tabId: 'initial_db_upload' },
  google_config: { tabId: 'google_config' },
  dev_uploader: { tabId: 'dev_uploader' },
  official_mail: { tabId: 'official_mail' },
  public_construction_permits: { tabId: 'public_construction_permits' },
  tenant_management: { tabId: 'tenant_management' }
};

/**
 * 특정 메뉴 ID에 대응하는 AppContext의 tabId 및 서브탭 트리거 셀렉터를 반환합니다.
 */
export function getAppTabForMenu(menuId: string): MenuNavTarget {
  if (MENU_TO_APP_TAB_MAP[menuId]) {
    return MENU_TO_APP_TAB_MAP[menuId];
  }
  // 미등록 메뉴는 1:1 매핑으로 기본 폴백
  return { tabId: menuId };
}
