import React from 'react';
import { Home, Wrench, Truck, CheckSquare, Search, Send, Building2, PlusCircle, Boxes, ArrowDownToLine, Layers, Users, AlertTriangle, Fuel, BookOpen, ClipboardList, Navigation } from 'lucide-react';
import { MobileDeptMode } from './MobileHeader';

export type MobileTabType = 
  | 'home' 
  | 'assignment'
  | 'assets' 
  | 'sales_order' 
  | 'my_contracts' 
  | 'as_create' 
  | 'as' 
  | 'as_route_tracking'
  | 'dispatch' 
  | 'inspection'
  | 'vehicle_stock'
  | 'inbound_register'
  | 'sublease'
  | 'customers'
  | 'delinquency'
  | 'vehicle_log'
  | 'manual_viewer'
  | 'consumable_stock'
  | 'sales_journal'
  | 'inbound_defect_claim';

interface MobileBottomNavProps {
  deptMode: MobileDeptMode;
  activeTab: MobileTabType;
  onChangeTab: (tab: MobileTabType) => void;
  hasPermission?: (menuId: string, action: 'view' | 'save') => boolean;
  isDeveloper?: boolean;
  pendingAsCount?: number;
  pendingDispatchCount?: number;
  pendingInspectionCount?: number;
  pendingAssignmentCount?: number;
  subleaseLeakCount?: number;
  overdueBadgeCount?: number;
  incompleteCustomerCount?: number;
  pendingRepairClaimCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  deptMode,
  activeTab,
  onChangeTab,
  hasPermission,
  isDeveloper = false,
  pendingAsCount = 0,
  pendingDispatchCount = 0,
  pendingInspectionCount = 0,
  pendingAssignmentCount = 0,
  subleaseLeakCount = 0,
  overdueBadgeCount = 0,
  incompleteCustomerCount = 0,
  pendingRepairClaimCount = 0,
}) => {
  // 탭별 대응 시스템 메뉴 ID 매핑 (PC 모드 menu_config.ts 1:1 관통)
  const tabMenuMap: Partial<Record<MobileTabType, string>> = {
    home: 'dashboard',
    customers: 'customer',
    assets: 'available_inventory',
    sales_order: 'smart_dispatch4',
    my_contracts: 'contract',
    as: 'field_as',
    as_route_tracking: 'as_route_tracking',
    as_create: 'smart_as_request',
    vehicle_stock: 'consumable_stock',
    assignment: 'dispatch_assign',
    inspection: 'outbound_inspections',
    inbound_register: 'asset_inout_history',
    delinquency: 'delinquency',
    sublease: 'rent_asset',
    dispatch: 'delivery',
    vehicle_log: 'vehicle_log',
    consumable_stock: 'consumable_stock',
    sales_journal: 'sales_journal',
  };

  // 부서별 하단 후보 탭 동적 매핑
  let rawNavItems: { id: MobileTabType; label: string; icon: any; badge: number }[] = [];

  if (deptMode === 'SALES') {
    // 💼 영업부 모바일 탭 (가용재고 최우선 노출)
    rawNavItems = [
      { id: 'home', label: '홈', icon: Home, badge: 0 },
      { id: 'assets', label: '가용재고', icon: ClipboardList, badge: 0 },
      { id: 'sales_order', label: '출고요청', icon: Send, badge: 0 },
      { id: 'inbound_defect_claim', label: '수리비용', icon: AlertTriangle, badge: pendingRepairClaimCount },
      { id: 'my_contracts', label: '내현장', icon: Building2, badge: 0 },
      { id: 'customers', label: '고객관리', icon: Users, badge: incompleteCustomerCount },
      { id: 'sales_journal', label: '영업일지', icon: BookOpen, badge: 0 },
    ];
  } else if (deptMode === 'AS') {
    // 🔧 AS팀 모바일 탭
    rawNavItems = [
      { id: 'home', label: '홈', icon: Home, badge: 0 },
      { id: 'as', label: '현장정비', icon: Wrench, badge: pendingAsCount },
      { id: 'as_route_tracking', label: '동선관리', icon: Navigation, badge: 0 },
      { id: 'as_create', label: '정비요청', icon: PlusCircle, badge: 0 },
      { id: 'vehicle_stock', label: '차량재고', icon: Boxes, badge: 0 },
      { id: 'assets', label: '가용재고', icon: ClipboardList, badge: 0 },
    ];
  } else if (deptMode === 'OUTBOUND') {
    // 🏗️ 출고팀 모바일 탭 (주기장 실물 관리)
    rawNavItems = [
      { id: 'home', label: '홈', icon: Home, badge: 0 },
      { id: 'assignment', label: '장비할당', icon: Layers, badge: pendingAssignmentCount },
      { id: 'inspection', label: '출고검수', icon: CheckSquare, badge: pendingInspectionCount },
      { id: 'inbound_register', label: '입고등록', icon: ArrowDownToLine, badge: 0 },
      { id: 'inbound_defect_claim', label: '불량청구', icon: AlertTriangle, badge: 0 },
      { id: 'assets', label: '가용재고', icon: ClipboardList, badge: 0 },
    ];
  } else if (deptMode === 'EXECUTIVE') {
    // 👑 경영진 모바일 탭 (가용재고 직관 노출)
    rawNavItems = [
      { id: 'home', label: '경영홈', icon: Home, badge: 0 },
      { id: 'assets', label: '가용재고', icon: ClipboardList, badge: 0 },
      { id: 'my_contracts', label: '계약현황', icon: Building2, badge: 0 },
      { id: 'delinquency', label: '연체관리', icon: AlertTriangle, badge: overdueBadgeCount },
      { id: 'customers', label: '고객관리', icon: Users, badge: incompleteCustomerCount },
      { id: 'sales_journal', label: '영업일지', icon: BookOpen, badge: 0 },
    ];
  } else if (deptMode === 'ADMIN') {
    // 📊 관리부 모바일 탭 (배차 포함)
    rawNavItems = [
      { id: 'home', label: '관리홈', icon: Home, badge: 0 },
      { id: 'dispatch', label: '배차관리', icon: Truck, badge: pendingDispatchCount },
      { id: 'sublease', label: '임차관리', icon: Layers, badge: subleaseLeakCount },
      { id: 'vehicle_log', label: '주유관리', icon: Fuel, badge: 0 },
      { id: 'assets', label: '가용재고', icon: ClipboardList, badge: 0 },
    ];
  } else {
    rawNavItems = [
      { id: 'home', label: '홈', icon: Home, badge: 0 },
      { id: 'assets', label: '가용재고', icon: ClipboardList, badge: 0 },
      { id: 'sales_journal', label: '영업일지', icon: BookOpen, badge: 0 },
    ];
  }

  // 홈 및 가용재고 탭은 영업부·경영진 포함 전 임직원 상시 허용 (주유관리는 코드는 보존하되 웹앱 전 부서에서 숨김 처리)
  const navItems = rawNavItems.filter(item => {
    if (item.id === 'vehicle_log') return false;
    if (item.id === 'home' || item.id === 'assets') return true;
    if (deptMode === 'AS' && (item.id === 'as' || item.id === 'as_route_tracking' || item.id === 'as_create' || item.id === 'vehicle_stock')) {
      return true;
    }
    if (isDeveloper) return true;
    if (!hasPermission) return true;
    if (item.id === 'as_create') {
      return hasPermission('smart_as_request', 'view') || hasPermission('field_as', 'view');
    }
    const menuId = tabMenuMap[item.id];
    if (!menuId) return true;
    return hasPermission(menuId, 'view');
  });

  return (
    <nav 
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9000,
        backgroundColor: '#0b1324',
        borderTop: '2px solid #334155',
        paddingTop: '6px',
        paddingLeft: '4px',
        paddingRight: '4px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        boxShadow: '0 -6px 20px rgba(0, 0, 0, 0.55)'
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChangeTab(item.id)}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              minWidth: 0,
              padding: '4px 2px',
              borderRadius: '10px',
              backgroundColor: isActive ? 'rgba(37, 99, 235, 0.22)' : 'transparent',
              border: isActive ? '1px solid rgba(96, 165, 250, 0.45)' : '1px solid transparent',
              cursor: 'pointer',
              color: isActive ? '#93c5fd' : '#e2e8f0',
              fontWeight: isActive ? '800' : '600'
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={20} color={isActive ? '#60a5fa' : '#cbd5e1'} strokeWidth={isActive ? 2.5 : 2} />
              {item.badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-8px',
                  minWidth: '17px',
                  height: '17px',
                  padding: '0 4px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: '900',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid #ffffff',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span style={{
              fontSize: '11px',
              marginTop: '3px',
              color: isActive ? '#ffffff' : '#e2e8f0',
              fontWeight: isActive ? '900' : '600',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              maxWidth: '100%',
              letterSpacing: '-0.3px'
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
