// @ts-nocheck
// d:\Giyeun_Lift\src\App.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from './context/AppContext';
import {
  LayoutDashboard, Users, UserCheck, Package, Layers, PlusCircle,
  Truck, Wrench, Shield, ShoppingBag, CreditCard, LogOut, Sun, Moon, Menu, X, Zap, Settings, Database as DatabaseIcon,
  TrendingUp, Clock, AlertTriangle, Building2, ChevronDown, ChevronRight, ChevronLeft, Briefcase, Box, FolderKanban, ShieldAlert, Terminal, ArrowLeftRight, CheckSquare,
  Smartphone, Monitor, Car, FileText, Search, Printer, PackagePlus, Boxes, Calendar, Camera, BookOpen,
  FileCheck, ShieldCheck, Bot, Download, Bell
, CheckCircle, Settings as SettingsIcon, SlidersHorizontal, Mail, Mic } from 'lucide-react';
const OfficialMailPage = React.lazy(() => import('./pages/OfficialMailPage').then(module => ({ default: module.OfficialMailPage })));
import { getTenantAgentInstallerInfo, triggerTenantAgentDownload, AGENT_CERT_URL, syncTenantPolicyToAgent } from './services/agentService';

import { JobAlertModal } from './components/JobAlertModal';
import { PersistentJobAlertToast } from './components/PersistentJobAlertToast';
import { jobNotificationService } from './services/jobNotificationService';

import { WeatherWidget } from './components/WeatherWidget';
const ApprovalRulesManage = React.lazy(() => import('./pages/ApprovalRulesManage'));
const ApprovalInbox = React.lazy(() => import('./pages/ApprovalInbox'));
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
const PrivacyAuditPage = React.lazy(() => import('./pages/PrivacyAuditPage').then(module => ({ default: module.PrivacyAuditPage })));
const ManualsManage = React.lazy(() => import('./pages/ManualsManage').then(module => ({ default: module.ManualsManage })));
const ManualDictionaryPage = React.lazy(() => import('./pages/ManualDictionaryPage').then(module => ({ default: module.ManualDictionaryPage })));
const AgenticAiLabPage = React.lazy(() => import('./pages/AgenticAiLabPage').then(module => ({ default: module.AgenticAiLabPage })));
const AgenticDispatchStudioPage = React.lazy(() => import('./pages/AgenticDispatchStudioPage').then(module => ({ default: module.AgenticDispatchStudioPage })));
const AgenticSettlementAutopilotPage = React.lazy(() => import('./pages/AgenticSettlementAutopilotPage').then(module => ({ default: module.AgenticSettlementAutopilotPage })));
const AgenticAssetLifecyclePage = React.lazy(() => import('./pages/AgenticAssetLifecyclePage').then(module => ({ default: module.AgenticAssetLifecyclePage })));
import { markErpReady, markErpStatus } from './services/appReadySignal';
const DriverPortalPage = React.lazy(() => import('./pages/DriverPortalPage').then(module => ({ default: module.DriverPortalPage })));
import { DemoModeBanner } from './components/DemoModeBanner';
import { isDemoMode, enterDemoMode } from './services/demoMode';
import { SidebarCustomizationModal } from './components/SidebarCustomizationModal';
import { useMenuPreferences } from './hooks/useMenuPreferences';
import { getDomainMode, getAdminConsoleUrl, getLandingUrl, getTenantUrl } from './utils/domainRouter';
const LandingPage = React.lazy(() => import('./pages/LandingPage').then(module => ({ default: module.LandingPage })));

// 페이지 컴포넌트 임포트 (SSOT 언더바 파일명 통일)
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
import { TradeProductsPage } from './pages/distribution/TradeProductsPage';
import { TradePurchasesPage } from './pages/distribution/TradePurchasesPage';
import { TradeContractsPage } from './pages/distribution/TradeContractsPage';
import { TradeOutboundPage } from './pages/distribution/TradeOutboundPage';
import { CourierDispatchPage } from './pages/distribution/CourierDispatchPage';
import { TradeBillingPage } from './pages/distribution/TradeBillingPage';
import { TradeReturnsPage } from './pages/distribution/TradeReturnsPage';
import { TradeProfitabilityPage } from './pages/distribution/TradeProfitabilityPage';
const PrintQueueManager = React.lazy(() => import('./pages/PrintQueueManager').then(module => ({ default: module.PrintQueueManager })));
import { UsersPermissions } from './pages/users_permissions';
const Customers = React.lazy(() => import('./pages/Customers').then(module => ({ default: module.Customers })));
const Products = React.lazy(() => import('./pages/Products').then(module => ({ default: module.Products })));
const Assets = React.lazy(() => import('./pages/Assets').then(module => ({ default: module.Assets })));
const AssetAcquisitionDisposal = React.lazy(() => import('./pages/AssetAcquisitionDisposal').then(module => ({ default: module.AssetAcquisitionDisposal })));
import { RentAssets } from './pages/rent_assets';
import { InspectionChecklistManage } from './pages/inspection_checklist_manage';
const Consumables = React.lazy(() => import('./pages/Consumables').then(module => ({ default: module.Consumables })));
const ConsumablePurchasesPage = React.lazy(() => import('./pages/ConsumablePurchasesPage').then(module => ({ default: module.ConsumablePurchasesPage })));
const ConsumableInOutPage = React.lazy(() => import('./pages/ConsumableInOutPage').then(module => ({ default: module.ConsumableInOutPage })));
const ConsumableStockPage = React.lazy(() => import('./pages/ConsumableStockPage').then(module => ({ default: module.ConsumableStockPage })));
const StocktakingPage = React.lazy(() => import('./pages/StocktakingPage').then(module => ({ default: module.StocktakingPage })));

const Contracts = React.lazy(() => import('./pages/Contracts').then(module => ({ default: module.Contracts })));

const Receivables = React.lazy(() => import('./pages/Receivables').then(module => ({ default: module.Receivables })));
const BankMatching = React.lazy(() => import('./pages/BankMatching').then(module => ({ default: module.BankMatching })));
const TransportMaster = React.lazy(() => import('./pages/TransportMaster').then(module => ({ default: module.TransportMaster })));


const Repairs = React.lazy(() => import('./pages/Repairs').then(module => ({ default: module.Repairs })));
const SmartAsRequest = React.lazy(() => import('./pages/SmartAsRequest').then(module => ({ default: module.SmartAsRequest })));
const FieldAsManagement = React.lazy(() => import('./pages/FieldAsManagement').then(module => ({ default: module.FieldAsManagement })));
const OrganizationSettings = React.lazy(() => import('./pages/OrganizationSettings').then(module => ({ default: module.OrganizationSettings })));
const TenantManagementPage = React.lazy(() => import('./pages/TenantManagementPage').then(module => ({ default: module.TenantManagementPage })));
const OtManagementPage = React.lazy(() => import('./pages/OtManagementPage').then(module => ({ default: module.OtManagementPage })));
const LeaveApplicationPage = React.lazy(() => import('./pages/LeaveApplicationPage').then(module => ({ default: module.LeaveApplicationPage })));
const LeaveManagementPage = React.lazy(() => import('./pages/LeaveManagementPage').then(module => ({ default: module.LeaveManagementPage })));
const LeaveOtPage = React.lazy(() => import('./pages/LeaveOtPage').then(module => ({ default: module.LeaveOtPage })));
const VehicleOperationLogPage = React.lazy(() => import('./pages/VehicleOperationLogPage').then(module => ({ default: module.VehicleOperationLogPage })));
const Vendors = React.lazy(() => import('./pages/Vendors').then(module => ({ default: module.Vendors })));
import { SmartDispatch } from './pages/smart_dispatch';
import { SmartDispatch2 } from './pages/smart_dispatch2';
import { SmartDispatch3 } from './pages/smart_dispatch3';
import { SmartDispatch4 } from './pages/smart_dispatch4';
import { VoiceDispatch } from './pages/voice_dispatch';

import { SmartReturn } from './pages/smart_return';
const DevDataUploader = React.lazy(() => import('./pages/DevDataUploader').then(module => ({ default: module.DevDataUploader })));

import { AssetAssignment } from './pages/asset_assignment';
const PayrollPage = React.lazy(() => import('./pages/PayrollPage').then(module => ({ default: module.PayrollPage })));
const CorporateCardPage = React.lazy(() => import('./pages/CorporateCardPage').then(module => ({ default: module.CorporateCardPage })));
const CashFlowPage = React.lazy(() => import('./pages/CashFlowPage').then(module => ({ default: module.CashFlowPage })));
const DelinquencyPage = React.lazy(() => import('./pages/DelinquencyPage').then(module => ({ default: module.DelinquencyPage })));
import { OutboundInspections } from './pages/outbound_inspections';
import { DepreciationExecution } from './pages/depreciation_execution';
const DailyInOutStatus = React.lazy(() => import('./pages/DailyInOutStatus').then(module => ({ default: module.DailyInOutStatus })));
const SiteOptionManage = React.lazy(() => import('./pages/SiteOptionManage').then(module => ({ default: module.SiteOptionManage })));

const RegularReportsPage = React.lazy(() => import('./pages/RegularReportsPage').then(module => ({ default: module.RegularReportsPage })));
const GoogleConfig = React.lazy(() => import('./pages/GoogleConfig').then(module => ({ default: module.GoogleConfig })));
const InitialDbUploader = React.lazy(() => import('./pages/InitialDbUploader').then(module => ({ default: module.InitialDbUploader })));
const DataFormationStudio = React.lazy(() => import('./pages/DataFormationStudio'));

import { AgentRequiredModal } from './components/AgentRequiredModal';
const OperationManualPage = React.lazy(() => import('./pages/OperationManualPage').then(module => ({ default: module.OperationManualPage })));
const ErrorReportPage = React.lazy(() => import('./pages/ErrorReportPage').then(module => ({ default: module.ErrorReportPage })));
import { MirrorSyncProgressToast } from './components/MirrorSyncProgressToast';
import { MobileApp } from './mobile/MobileApp';
import { initWorkNotificationListener } from './utils/workNotificationService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ManualProvider, useManualContext } from './components/manual/ManualContext';
import { ManualOverlay } from './components/manual/ManualOverlay';
import { ManualAuthorPanel } from './components/manual/ManualAuthorPanel';
import { detectActiveModalElement, detectCurrentContext } from './data/modalManuals';


const Billings = React.lazy(() => import('./pages/Billings').then(module => ({ default: module.Billings })));

const TruckDispatch = React.lazy(() => import('./pages/TruckDispatch').then(module => ({ default: module.TruckDispatch })));

const Deliveries = React.lazy(() => import('./pages/Deliveries').then(module => ({ default: module.Deliveries })));

const PurchaseSettlementPage = React.lazy(() => import('./pages/PurchaseSettlementPage').then(module => ({ default: module.PurchaseSettlementPage })));

const AssetHistory = React.lazy(() => import('./pages/asset_history').then(module => ({ default: module.AssetHistory })));

const PublicConstructionPermitsPage = React.lazy(() => import('./pages/PublicConstructionPermitsPage').then(module => ({ default: module.PublicConstructionPermitsPage })));

export interface SubMenuItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

export interface MenuGroup {
  id: string;
  name: string;
  icon: React.ReactNode;
  items: SubMenuItem[];
}

import ReactDOM from 'react-dom';
import { db, supabase, getTenantSubscriptionInfo } from './services/db';
import { useGridWheel } from './hooks/useGridWheel';

/* ── 인앱 오버레이 매뉴얼 버튼 (헤더 우측 배치) ─────────────── */
const ManualHeaderButtons: React.FC<{ activeTab: string; currentUser: any; activeTabName?: string }> = ({ activeTab, currentUser, activeTabName }) => {
  const { mode, setMode, loadPage, page } = useManualContext();
  
  // 개발자 계정(admin, sys-admin)일 때만 매뉴얼 작성 기능 노출
  const isTrueDev = (u?: any) => u && (u.loginId === 'admin' || u.id === 'sys-admin');
  const canAuthor = Boolean(isTrueDev(currentUser));

  const pageTitle = activeTabName || activeTab;

  // 💡 [메뉴 전환 시 매뉴얼 단계 수 동기화]
  useEffect(() => {
    if (activeTab) {
      const ctx = detectCurrentContext(activeTab, pageTitle);
      loadPage(ctx.pageId, ctx.pageTitle);
    }
  }, [activeTab, pageTitle, loadPage]);

  const handleView = async () => {
    if (mode !== 'off') { setMode('off'); return; }
    const ctx = detectCurrentContext(activeTab, pageTitle);
    await loadPage(ctx.pageId, ctx.pageTitle);
    setMode('viewing');
  };

  const handleAuthor = async () => {
    if (!canAuthor) return;
    if (mode === 'authoring') { setMode('off'); return; }
    setMode('off');
    const ctx = detectCurrentContext(activeTab, pageTitle);
    await loadPage(ctx.pageId, ctx.pageTitle);
    setMode('authoring');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
      <button
        onClick={handleView}
        style={{
          padding: '6px 12px', borderRadius: '20px', fontSize: '12.5px', fontWeight: 700,
          background: mode === 'viewing' ? '#dbeafe' : 'var(--bg-app)',
          color: mode === 'viewing' ? '#1d4ed8' : 'var(--text-primary)',
          border: mode === 'viewing' ? '1.5px solid #1d4ed8' : '1px solid var(--border-color)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        title="현재 화면 매뉴얼 오버레이 표시 (Ctrl+M)"
      >
        📖 {mode === 'viewing' ? '매뉴얼 닫기' : '매뉴얼 보기'}
        {page && page.items.length > 0 && mode !== 'viewing' && (
          <span style={{ background: '#1d4ed8', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>
            {page.items.length}
          </span>
        )}
        <span style={{
          fontSize: '10px',
          padding: '1px 5px',
          borderRadius: '4px',
          backgroundColor: mode === 'viewing' ? '#bfdbfe' : 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          color: mode === 'viewing' ? '#1e40af' : 'var(--text-muted)',
          fontFamily: 'monospace',
          marginLeft: '2px',
          fontWeight: 600
        }}>
          Ctrl+M
        </span>
      </button>
      {canAuthor && (
        <button
          onClick={handleAuthor}
          style={{
            padding: '6px 12px', borderRadius: '20px', fontSize: '12.5px', fontWeight: 700,
            background: mode === 'authoring' ? '#e0e7ff' : 'var(--bg-app)',
            color: mode === 'authoring' ? '#4f46e5' : 'var(--text-primary)',
            border: mode === 'authoring' ? '1.5px solid #4f46e5' : '1px solid var(--border-color)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          title="현재 화면 매뉴얼 작성/편집 모드 (개발자 전용)"
        >
          ✏️ {mode === 'authoring' ? '작성 종료' : '매뉴얼 작성'}
        </button>
      )}
    </div>
  );
};



const ContextualManualButton: React.FC = () => {
  const { activeTab, currentTenant } = useApp();
  const [manualUrl, setManualUrl] = React.useState<string | null>(null);
  const [showIframe, setShowIframe] = React.useState(false);
  const [headerNode, setHeaderNode] = React.useState<Element | null>(null);

  React.useEffect(() => {
    const fetchUrl = async () => {
      const { data } = await supabase!.from('system_manuals').select('manual_url').eq('tenant_id', currentTenant).eq('menu_id', activeTab).single();
      if (data?.manual_url) setManualUrl(data.manual_url);
      else setManualUrl(null);
    };
    fetchUrl();

    const findHeader = () => {
      const main = document.querySelector('.main-content-area');
      if (!main) return null;
      const headers = main.querySelectorAll('h2, h3');
      for (const h of headers) {
        if (h.closest('.card') || h.closest('.page-header') || (h as HTMLElement).style.fontSize === '17px' || (h as HTMLElement).style.fontSize === '16px') {
           return h;
        }
      }
      return headers[0] || null;
    };

    let attempts = 0;
    const interval = setInterval(() => {
      const node = findHeader();
      if (node) {
        setHeaderNode(node);
        clearInterval(interval);
      }
      if (attempts++ > 10) clearInterval(interval);
    }, 100);

    return () => { clearInterval(interval); setHeaderNode(null); };
  }, [activeTab, currentTenant]);

  if (!manualUrl && !headerNode) return null;

  const Button = (
    <div style={{ display: 'inline-flex', marginLeft: '12px', verticalAlign: 'middle' }}>
      {manualUrl ? (
        <button
          onClick={(e) => { e.stopPropagation(); setShowIframe(true); }}
          style={{
            padding: '4px 8px', fontSize: '11px', borderRadius: '4px', backgroundColor: '#EFF6FF',
            color: '#2563EB', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
            height: '24px'
          }}
        >
          <BookOpen size={12} /> 매뉴얼 보기
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); window.alert('이 메뉴에 등록된 매뉴얼이 없습니다. [메뉴 매뉴얼 관리]에서 HTML 문서를 연결해주세요.'); }}
          style={{
            padding: '4px 8px', fontSize: '11px', borderRadius: '4px', backgroundColor: '#F3F4F6',
            color: '#9CA3AF', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
            height: '24px'
          }}
          title="등록된 매뉴얼 없음"
        >
          <BookOpen size={12} /> 매뉴얼 보기
        </button>
      )}

      {showIframe && manualUrl && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }} onClick={() => setShowIframe(false)}>
          <div style={{ width: '90%', height: '90%', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '10px 16px', backgroundColor: '#1E293B', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}><BookOpen size={16}/> 매뉴얼 열람</h3>
              <button onClick={() => setShowIframe(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <iframe src={manualUrl} style={{ flex: 1, width: '100%', border: 'none' }} title="Manual Iframe" />
          </div>
        </div>
      )}
    </div>
  );

  return headerNode ? ReactDOM.createPortal(Button, headerNode) : null;
};

const App: React.FC = () => {
  console.log("[DEBUG] App Render!");
  const context = useApp();
  if (typeof window !== 'undefined') {
    (window as any).__APP_CONTEXT__ = context;
  }
  const { currentUser, users, switchUser, login, logout, theme, toggleTheme, hasPermission, activeTab, setActiveTab, loadTablesForMenu, currentTenant, canGoBack, canGoForward, goBack, goForward, historyStack, historyIndex } = context;
  const { mode: manualMode, setMode: setManualMode, loadPage: loadManualPage, setBaseMenu } = useManualContext();
  useGridWheel(activeTab); // Shift+Wheel 횡스크롤: 그리드 컨테이너에만 적용

  // 로그인 폼 상태
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loginErrorMsg, setLoginErrorMsg] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 편의기능 체크박스 상태
  const [rememberId, setRememberId] = useState(false);
  const [rememberPw, setRememberPw] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);

  // 모바일 메뉴 사이드바 토글 상태
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 개인정보 처리방침 법정 고지 모달 상태
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  // 🔔 주기장/공장 현장용 업무 알림 설정 상태
  const [showJobAlertModal, setShowJobAlertModal] = useState(false);
  const [jobNotifySettings, setJobNotifySettings] = useState(jobNotificationService.getSettings());

  useEffect(() => {
    const unsub = jobNotificationService.onSettingsChange(setJobNotifySettings);
    return () => unsub();
  }, []);

  // ─── 메뉴 검색 네비게이터 상태 ───
  const [menuSearchOpen, setMenuSearchOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [menuSearchHighlight, setMenuSearchHighlight] = useState(0);
  const menuSearchInputRef = useRef<HTMLInputElement>(null);
  const menuSearchBoxRef = useRef<HTMLDivElement>(null);

  // 모바일 전용 뷰 모드 (PWA / Field App) — ebro.run/mobile 또는 /m 전용 주소 처리
  const [isMobileView, setIsMobileView] = useState<boolean>(() => {
    // 1. URL 경로 또는 쿼리 확인 (/mobile 또는 /m 또는 ?mode=mobile 또는 ?view=mobile)
    const pathname = window.location.pathname.toLowerCase();
    const search = window.location.search;
    if (
      pathname === '/mobile' ||
      pathname.startsWith('/mobile/') ||
      pathname === '/m' ||
      pathname.startsWith('/m/') ||
      search.includes('view=mobile') ||
      search.includes('mode=mobile')
    ) {
      return true;
    }
    // 2. localStorage 저장값 확인 (사용자의 명시적 수동 선택 최우선)
    const savedView = localStorage.getItem('erp_view_mode');
    if (savedView === 'mobile') return true;
    if (savedView === 'desktop') return false;

    // 3. 디바이스 환경 판별 (아이폰, 아이패드, 안드로이드 모바일 등)
    const ua = navigator.userAgent;
    const isIPhone = /iPhone|iPod/i.test(ua);
    const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMobileWidth = window.innerWidth < 768;

    // 아이폰 또는 768px 미만 소형 기기는 기본 모바일 뷰
    if (isIPhone || isMobileWidth) return true;

    // 아이패드 세로 모드(portrait <= 834px)는 현장 모바일 뷰 기본 진입 권장
    if (isIPad && window.innerWidth <= 834) return true;

    return false;
  });

  // 📱 브라우저 URL 경로(/mobile, /m) 동적 감지
  useEffect(() => {
    const handleUrlCheck = () => {
      const pathname = window.location.pathname.toLowerCase();
      if (
        pathname === '/mobile' ||
        pathname.startsWith('/mobile/') ||
        pathname === '/m' ||
        pathname.startsWith('/m/')
      ) {
        setIsMobileView(true);
      }
    };
    window.addEventListener('popstate', handleUrlCheck);
    return () => window.removeEventListener('popstate', handleUrlCheck);
  }, []);

  // 🤖 온디맨드 로컬 에이전트 실행 안내 모달 상태 (평상시 비노출, 필요 시점에 미응답일 때만 표출)
  const [agentRequiredModal, setAgentRequiredModal] = useState<{
    isOpen: boolean;
    actionName?: string;
  }>({
    isOpen: false,
    actionName: '로컬 연동 작업'
  });

  useEffect(() => {
    const handleAgentRequired = (e: any) => {
      const actionName = e?.detail?.actionName || '로컬 연동 작업';
      setAgentRequiredModal({
        isOpen: true,
        actionName
      });
    };
    window.addEventListener('ebro:agent_required', handleAgentRequired);
    return () => window.removeEventListener('ebro:agent_required', handleAgentRequired);
  }, []);

  // 컴포넌트 마운트 시 저장된 로그인 편의 정보 로드
  useEffect(() => {
    try {
      const savedId = localStorage.getItem('remember_id');
      const savedPw = localStorage.getItem('remember_pw');
      const idPref = localStorage.getItem('remember_id_pref') === 'true';
      const pwPref = localStorage.getItem('remember_pw_pref') === 'true';
      if (savedId) {
        setLoginId(savedId);
        setRememberId(true);
      } else if (idPref) {
        setRememberId(true);
      }
      if (savedPw) {
        setPassword(savedPw);
        setRememberPw(true);
      } else if (pwPref) {
        setRememberPw(true);
      }
      const hasAuto = !!localStorage.getItem('auto_user');
      if (hasAuto) {
        setAutoLogin(true);
      }
    } catch (e) {}
  }, []);

  // 업무 알림 리스너 연동
  useEffect(() => {
    if (currentUser) {
      initWorkNotificationListener(currentUser);
    }
  }, [currentUser]);

  // 🧭 eBro Web Agent 및 외부 자동화 신호에 따른 메뉴 전환 리스너
  useEffect(() => {
    const handleErpNavigate = (e: any) => {
      const targetMenu = e.detail?.menuId || e.detail?.menu;
      if (targetMenu && typeof targetMenu === 'string') {
        if (manualMode !== 'off') setManualMode('off');
        setActiveTab(targetMenu);
      }
    };
    window.addEventListener('erp:navigate', handleErpNavigate);
    return () => window.removeEventListener('erp:navigate', handleErpNavigate);
  }, [manualMode]);

  // 메뉴(activeTab) 전환 시 스크롤 최상단 리셋 + 해당 메뉴 관련 테이블만 Supabase pull + 켜진 매뉴얼 자동 끄기
  useEffect(() => {
    if (manualMode !== 'off') {
      setManualMode('off');
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    const mainArea = document.querySelector('.main-content-area');
    if (mainArea) {
      mainArea.scrollTop = 0;
    }
    loadTablesForMenu(activeTab);
  }, [activeTab]);

  // 🚀 에이전틱 AI 및 MCP 자동화를 위한 시스템 Ready 상태 공표
  useEffect(() => {
    if (currentUser) {
      markErpReady({
        user: currentUser,
        menu: activeTab,
        tenant: currentTenant
      });
      if (currentTenant) {
        syncTenantPolicyToAgent(currentTenant).catch(() => {});
      }
    } else {
      markErpStatus('LOGIN_REQUIRED', 'login');
    }
  }, [currentUser, activeTab, currentTenant]);

  const [installerDownloadMsg, setInstallerDownloadMsg] = useState<string | null>(null);

  const handleAgentInstallerDownload = () => {
    const info = getTenantAgentInstallerInfo(currentTenant);
    triggerTenantAgentDownload(currentTenant);
    setInstallerDownloadMsg(`[${info.tenantName}] 설치 프로그램 다운로드가 시작되었습니다.`);
    setTimeout(() => setInstallerDownloadMsg(null), 4000);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrorMsg(null);
    setIsLoggingIn(true);
    try {
      const res = await login(loginId, password, autoLogin);
      if (res.success) {
        // 아이디 저장 처리
        if (rememberId) {
          localStorage.setItem('remember_id', loginId);
        } else {
          localStorage.removeItem('remember_id');
        }
        
        // 비밀번호 저장 처리
        if (rememberPw) {
          localStorage.setItem('remember_pw', password);
        } else {
          localStorage.removeItem('remember_pw');
        }

        // 필드 정리 (저장 설정 안된 값만 비우기)
        if (!rememberId) setLoginId('');
        if (!rememberPw) setPassword('');
        
        setActiveTab('dashboard'); // 로그인 성공시 대시보드로
      } else {
        setLoginErrorMsg(res.reason || '아이디 또는 비밀번호가 잘못되었습니다.');
      }
    } catch (err: any) {
      setLoginErrorMsg(`로그인 처리 중 시스템 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 계층형 상위-하위 아코디언 메뉴 구조 정의 (유저 지정 규격)
  const menuGroups: MenuGroup[] = React.useMemo(() => [
    {
      id: 'grp_approval',
      name: '결재 센터',
      icon: <CheckCircle size={18} />,
      items: [
        { id: 'approvalInbox', name: '내 결재함 (수신)', icon: <CheckCircle size={16} />, component: <ApprovalInbox /> },
        { id: 'approvalRules', name: '결재선 규칙 설정', icon: <SettingsIcon size={16} />, component: <ApprovalRulesManage /> },
      ]
    },
    {
      id: 'grp_sales',
      name: '영업관리',
      icon: <Briefcase size={17} />,
      items: [
        { id: 'customer', name: '고객 관리', icon: <Users size={16} />, component: <Customers /> },
        { id: 'site_options', name: '현장별 옵션 관리', icon: <SlidersHorizontal size={16} />, component: <SiteOptionManage /> },
        { id: 'contract', name: '계약 관리', icon: <UserCheck size={16} />, component: <Contracts /> },
        { id: 'billing', name: '청구 / 수납 관리', icon: <CreditCard size={16} />, component: <Billings /> },
        { id: 'receivable', name: '외상미수금 대장', icon: <CreditCard size={16} />, component: <Receivables /> },
        { id: 'smart_dispatch4', name: '출고 요청', icon: <Zap size={16} />, component: <SmartDispatch4 /> },
        { id: 'voice_dispatch', name: '음성 출고지시', icon: <Mic size={16} />, component: <VoiceDispatch /> },
        { id: 'smart_return', name: '회수 요청', icon: <Zap size={16} />, component: <SmartReturn /> },
        { id: 'smart_as_request', name: 'AS 요청', icon: <Wrench size={16} />, component: <SmartAsRequest /> },
        { id: 'delinquency', name: '미수 채권 연체 관리', icon: <AlertTriangle size={16} />, component: <DelinquencyPage /> },
        { id: 'official_mail', name: '공식 메일 발송', icon: <Mail size={16} />, component: <OfficialMailPage /> },
        { id: 'public_construction_permits', name: '인허가 건축공정 조회', icon: <Building2 size={16} />, component: <PublicConstructionPermitsPage /> },
      ]
    },
    {
      id: 'grp_product_asset',
      name: '제품 / 자산관리',
      icon: <Box size={17} />,
      items: [
        { id: 'product', name: '제품 관리', icon: <Package size={16} />, component: <Products /> },
        { id: 'asset', name: '자산 관리 (대장)', icon: <Layers size={16} />, component: <Assets /> },
        { id: 'acquisition_disposal', name: '당사자산 취득 / 매각', icon: <PlusCircle size={16} />, component: <AssetAcquisitionDisposal /> },
        { id: 'rent_asset', name: '임차 장비 관리', icon: <ShoppingBag size={16} />, component: <RentAssets /> },
      ]
    },
    {
      id: 'grp_logistics',
      name: '배차 / 운송관리',
      icon: <Truck size={17} />,
      items: [
        { id: 'delivery', name: '배차 / 운송 관리', icon: <Truck size={16} />, component: <TruckDispatch /> },
        { id: 'transport_master', name: '운송 거래처 관리', icon: <Settings size={16} />, component: <TransportMaster /> },
      ]
    },
    {
      id: 'grp_inout',
      name: '입출고관리',
      icon: <ArrowLeftRight size={17} />,
      items: [
        { id: 'daily_inout', name: '일일 입출고 조회', icon: <Calendar size={16} />, component: <DailyInOutStatus /> },
        { id: 'asset_inout_history', name: '입고등록/입출고조회', icon: <Clock size={16} />, component: <AssetHistory /> },
        { id: 'dispatch_assign', name: '장비 할당 / 매핑', icon: <Layers size={16} />, component: <AssetAssignment /> },
        { id: 'outbound_inspections', name: '출고 검수 관리', icon: <CheckSquare size={16} />, component: <OutboundInspections /> },
        { id: 'consumable_stock', name: '주기장 소모품 재고', icon: <Boxes size={16} />, component: <ConsumableStockPage /> },
          { id: 'stocktaking', name: '재고/자산 실사', icon: <Clipboard size={16} />, component: <StocktakingPage /> },
        { id: 'print_queue_monitor', name: '프린트 큐 모니터', icon: <Printer size={16} />, component: <PrintQueueManager /> },
      ]
    },
    {
      id: 'grp_maintenance',
      name: '정비 / 소모품관리',
      icon: <Wrench size={17} />,
      items: [
        { id: 'consumable_purchase', name: '소모품 구매', icon: <ShoppingBag size={16} />, component: <ConsumablePurchasesPage /> },
        { id: 'consumable_inout', name: '소모품 입출고', icon: <PackagePlus size={16} />, component: <ConsumableInOutPage /> },
        { id: 'consumable_stock', name: '소모품 재고', icon: <Boxes size={16} />, component: <ConsumableStockPage /> },
        { id: 'field_as', name: '현장 AS 관리', icon: <Wrench size={16} />, component: <FieldAsManagement /> },
        { id: 'repair', name: '주기장 정비 관리', icon: <Wrench size={16} />, component: <Repairs /> },
        { id: 'inspection_checklist_manage', name: '정비 항목 관리', icon: <Shield size={16} />, component: <InspectionChecklistManage /> },
      ]
    },
    {
      id: 'grp_management',
      name: '경영관리',
      icon: <FolderKanban size={17} />,
      items: [
        { id: 'leave_application', name: '연차신청', icon: <Calendar size={16} />, component: <LeaveApplicationPage /> },
        { id: 'ot_management', name: 'OT 관리', icon: <Clock size={16} />, component: <OtManagementPage /> },
        { id: 'vehicle_log', name: '차량 / 주유관리', icon: <Car size={16} />, component: <VehicleOperationLogPage /> },
        { id: 'purchase_settlement', name: '월말 매입 정산', icon: <CreditCard size={16} />, component: <PurchaseSettlementPage /> },
        { id: 'vendors', name: '매입처 (공급자 / 외주처) 관리', icon: <Building2 size={16} />, component: <Vendors /> },
        { id: 'bank_matching', name: '은행 입출금 대장', icon: <TrendingUp size={16} />, component: <BankMatching /> },
        { id: 'corporate_card', name: '법인카드 매입정산', icon: <CreditCard size={16} />, component: <CorporateCardPage /> },
        { id: 'cash_flow', name: '자금 흐름 분석', icon: <TrendingUp size={16} />, component: <CashFlowPage /> },
        { id: 'depreciation_execution', name: '감가상각 마감 실행', icon: <TrendingUp size={16} />, component: <DepreciationExecution /> },
        { id: 'regular_reports', name: '정기보고서 생성', icon: <FileText size={16} />, component: <RegularReportsPage /> },
      ]
    },
    {
      id: 'grp_management_special',
      name: '경영관리 - 특수',
      icon: <ShieldAlert size={17} />,
      items: [
        { id: 'organization', name: '조직 / 인사 관리', icon: <Users size={16} />, component: <OrganizationSettings /> },
        { id: 'permission', name: '사용자 및 권한', icon: <Shield size={16} />, component: <UsersPermissions /> },
        { id: 'manual_dictionary', name: '전사 업무 매뉴얼 사전', icon: <BookOpen size={16} />, component: <ManualDictionaryPage /> },
        { id: 'payroll', name: '급여 정산', icon: <CreditCard size={16} />, component: <PayrollPage /> },
        { id: 'leave_management', name: '연차관리', icon: <UserCheck size={16} />, component: <LeaveManagementPage /> },
        { id: 'privacy_audit', name: '개인정보 접속 감사', icon: <FileCheck size={16} />, component: <PrivacyAuditPage /> },
      ]
    },
    {
      id: 'grp_tools',
      name: '도구 및 다운로드',
      icon: <BookOpen size={17} />,
      items: [
        { id: 'operations_manual', name: '업무매뉴얼', icon: <BookOpen size={16} />, component: <OperationManualPage /> },
        { id: 'error_report', name: '오류 신고', icon: <AlertTriangle size={16} />, component: <ErrorReportPage /> },
      ]
    },
    {
      id: 'grp_system_dev',
      name: '시스템관리 - 개발자',
      icon: <Terminal size={17} />,
      items: [
        { id: 'agentic_ai_lab', name: '에이전틱 AI 샌드박스 랩', icon: <Bot size={16} />, component: <AgenticAiLabPage /> },
        { id: 'agentic_dispatch_studio', name: '에이전틱 배차 관제 스튜디오', icon: <Truck size={16} />, component: <AgenticDispatchStudioPage /> },
        { id: 'agentic_settlement_autopilot', name: '에이전틱 월말 대사 정산 오토파일럿', icon: <TrendingUp size={16} />, component: <AgenticSettlementAutopilotPage /> },
        { id: 'agentic_asset_lifecycle', name: '에이전틱 자산 라이프사이클 관제', icon: <Layers size={16} />, component: <AgenticAssetLifecyclePage /> },
        { id: 'initial_db_upload', name: '초기DB 업로드', icon: <DatabaseIcon size={16} />, component: <InitialDbUploader /> },
          { id: 'data_formation', name: '초기자료형성', icon: <DatabaseIcon size={16} />, component: <DataFormationStudio /> },
        { id: 'google_config', name: '공식 메일 연동 설정', icon: <Settings size={16} />, component: <GoogleConfig /> },
        { id: 'dev_uploader', name: '[개발] DB 데이터 업로더', icon: <DatabaseIcon size={16} />, component: <DevDataUploader /> },
      ]
    }
  ], []);

  // 상위 그룹 아코디언 접힘/펼침 상태

  // ─── 메뉴 검색 네비게이터 — 필터링 결과 계산 ───
  const menuSearchResults = useCallback(() => {
    const q = menuSearchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: { groupName: string; id: string; name: string }[] = [];
    menuGroups.forEach(grp => {
      grp.items.forEach(item => {
        if (hasPermission(item.id, 'view') && (item.name.toLowerCase().includes(q) || grp.name.toLowerCase().includes(q))) {
          results.push({ groupName: grp.name, id: item.id, name: item.name });
        }
      });
    });
    return results;
  }, [menuSearchQuery, menuGroups, hasPermission]);

  const searchResults = menuSearchResults();

  // 전역 키보드 단축키: Ctrl+K (메뉴 검색), Ctrl+M (매뉴얼 보기 토글)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ctrl+K 또는 Cmd+K -> 메뉴 검색
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setMenuSearchOpen(true);
        setMenuSearchQuery('');
        setMenuSearchHighlight(0);
        setTimeout(() => menuSearchInputRef.current?.focus(), 50);
        return;
      }

      // 2. Ctrl+M 또는 Cmd+M -> 매뉴얼 보기 켜기/끄기 토글 (영문/한글 IME 완벽 지원, 모달 및 서브뷰 동적 자동 감지)
      const isMKey = e.code === 'KeyM' || (e.key && (e.key.toLowerCase() === 'm' || e.key === 'ㅡ'));
      if ((e.ctrlKey || e.metaKey) && isMKey) {
        e.preventDefault();
        e.stopPropagation();
        if (manualMode !== 'off') {
          setManualMode('off');
        } else {
          const allItems = menuGroups.flatMap(g => g.items);
          const currentItem = allItems.find(i => i.id === activeTab);
          const defaultPageTitle = currentItem?.name || (activeTab === 'dashboard' ? '대시보드' : activeTab);
          const ctx = detectCurrentContext(activeTab, defaultPageTitle);
          loadManualPage(ctx.pageId, ctx.pageTitle).then(() => {
            setManualMode('viewing');
          });
        }
        return;
      }

      // 3. Esc — 메뉴 검색 닫기 또는 매뉴얼 닫기
      if (e.key === 'Escape') {
        if (menuSearchOpen) {
          setMenuSearchOpen(false);
          setMenuSearchQuery('');
          return;
        }
        if (manualMode !== 'off') {
          setManualMode('off');
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuSearchOpen, manualMode, activeTab, loadManualPage, setManualMode, menuGroups]);

  // 검색창 외부 클릭 시 닫기
  useEffect(() => {
    if (!menuSearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuSearchBoxRef.current && !menuSearchBoxRef.current.contains(e.target as Node)) {
        setMenuSearchOpen(false);
        setMenuSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuSearchOpen]);

  // 검색창 오픈 시 자동 포커스
  useEffect(() => {
    if (menuSearchOpen) {
      setTimeout(() => menuSearchInputRef.current?.focus(), 50);
    }
  }, [menuSearchOpen]);

  const handleMenuSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMenuSearchHighlight(h => Math.min(h + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMenuSearchHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = searchResults[menuSearchHighlight];
      if (target) {
        if (manualMode !== 'off') setManualMode('off');
        setActiveTab(target.id);
        setMenuSearchOpen(false);
        setMenuSearchQuery('');
      }
    } else if (e.key === 'Escape') {
      setMenuSearchOpen(false);
    }
  };

  // ── 🎨 좌측 메뉴 패널 개인화 상태 및 훅 ──
  const [showSidebarCustomModal, setShowSidebarCustomModal] = useState(false);
  const {
    preferences: menuPreferences,
    toggleVisibility: toggleMenuVisibility,
    setMenuColor,
    moveItemUp: moveMenuItemUp,
    moveItemDown: moveMenuItemDown,
    moveGroupUp: moveMenuGroupUp,
    moveGroupDown: moveMenuGroupDown,
    resetToDefault: resetMenuPreferences,
    getColorPreset
  } = useMenuPreferences(currentUser?.id || currentUser?.loginId);

  const menuPrefs = useMemo(() => {
    return menuPreferences?.items || {};
  }, [menuPreferences]);

  // 메뉴 그룹 순서 개인화 (groupOrder 반영)
  const sortedMenuGroups = useMemo(() => {
    const orderList = menuPreferences?.groupOrder;
    if (!orderList || orderList.length === 0) return menuGroups;
    return [...menuGroups].sort((a, b) => {
      const indexA = orderList.indexOf(a.id);
      const indexB = orderList.indexOf(b.id);
      const valA = indexA === -1 ? 999 : indexA;
      const valB = indexB === -1 ? 999 : indexB;
      return valA - valB;
    });
  }, [menuGroups, menuPreferences?.groupOrder]);

  // 권한이 있는 메뉴만 추출하여 모달에 전달 (정렬된 그룹 순서 반영)
  const customizationGroups = useMemo(() => {
    return sortedMenuGroups
      .map(grp => {
        const permitted = grp.items.filter(item => hasPermission(item.id, 'view'));
        const sorted = [...permitted].sort((a, b) => {
          const orderA = menuPrefs[a.id]?.order ?? 999;
          const orderB = menuPrefs[b.id]?.order ?? 999;
          return orderA - orderB;
        });
        return {
          id: grp.id,
          name: grp.name,
          icon: grp.icon,
          items: sorted.map(item => ({
            id: item.id,
            name: item.name,
            icon: item.icon,
            groupId: grp.id,
            groupName: grp.name
          }))
        };
      })
      .filter(grp => grp.items.length > 0);
  }, [sortedMenuGroups, hasPermission, menuPrefs]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    grp_sales: true,
    grp_product_asset: true,
    grp_logistics: true,
    grp_inout: true,
    grp_maintenance: true,
    grp_management: true,
    grp_management_special: true,
    grp_system_dev: true
  });


  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // activeTab이 활성화될 때 속한 상위 그룹 자동 펼침 및 매뉴얼 기준 메뉴(baseMenu) 동기화
  useEffect(() => {
    menuGroups.forEach(grp => {
      if (grp.items.some(item => item.id === activeTab)) {
        setExpandedGroups(prev => prev[grp.id] ? prev : { ...prev, [grp.id]: true });
      }
    });
    const allItems = menuGroups.flatMap(g => g.items);
    const currentItem = allItems.find(item => item.id === activeTab);
    const title = currentItem?.name || (activeTab === 'dashboard' ? '대시보드' : activeTab);
    setBaseMenu(activeTab, title);
    document.body.setAttribute('data-active-menu', title);
  }, [activeTab, menuGroups, setBaseMenu]);

  // 활성 페이지 컴포넌트 탐색
  const getActiveComponent = () => {
    if (activeTab === 'dashboard') return <Dashboard />;
    if (activeTab === 'manual_dictionary') return <ManualDictionaryPage />;
    if (activeTab === 'consumable' || activeTab === 'consumables') return <ConsumableStockPage />;
    if (activeTab === 'leave_ot') return <LeaveOtPage />;
    for (const grp of menuGroups) {
      const found = grp.items.find(item => item.id === activeTab);
      if (found) return found.component;
    }
    return <Dashboard />;
  };

  const domainMode = getDomainMode();

  // 🌐 [1단계: ebro.run 공식 홍보 마케팅 랜딩 페이지]
  if (domainMode === 'LANDING') {
    return <LandingPage />;
  }

  // 🌐 [1.5단계: 스마트 운송 포털 (기사용 모바일 웹) - 로그인 우회]
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/driver-portal/')) {
    return (
      <React.Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>}>
        <DriverPortalPage />
      </React.Suspense>
    );
  }

  // 1. 비로그인 상태: 로그인 화면 렌더링
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)' }}>
        <DemoModeBanner />
        <div style={{
          display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '380px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {domainMode === 'ADMIN' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 16px rgba(79, 70, 229, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}>
                  <span style={{ color: '#fff', fontSize: '20px', fontWeight: '900', letterSpacing: '-1px' }}>eB</span>
                </div>
                <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.5px', margin: 0 }}>
                  eBro 플랫폼 최고관리자
                </h1>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#818cf8',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '9999px'
                }}>
                  admin.ebro.run 관제탑
                </span>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                  플랫폼 최고관리자(admin, sys-admin) 전용 로그인
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <img 
                    src={isDemoMode() ? '/images/ci/ebro_rental_ci.svg' : (currentTenant?.ciUrl || currentTenant?.logoUrl || '/images/ci/giyeun_ci.png')} 
                    alt="CI" 
                    style={{ height: '36px', maxWidth: '130px', objectFit: 'contain' }} 
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                  <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.5px', margin: 0 }}>
                    {isDemoMode() ? '(주)e-Bro렌탈' : (currentTenant?.displayName || currentTenant?.tradeName || currentTenant?.corporateName || '기연리프트')}
                  </h1>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '600', letterSpacing: '0.3px' }}>
                  {isDemoMode() ? 'e-Bro AWP 고소작업대 ERP' : 'e-Bro ERP System'}
                </p>
              </>
            )}
          </div>

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ color: 'var(--text-main)', fontSize: '13px', marginBottom: '4px', display: 'block' }}>사용자 아이디</label>
              <input
                type="text"
                value={loginId}
                onChange={e => {
                  const val = e.target.value;
                  setLoginId(val);
                  if (rememberId) {
                    try { localStorage.setItem('remember_id', val); } catch (err) {}
                  }
                }}
                placeholder="아이디 입력 (admin)"
                required
                style={{ fontSize: '14px', padding: '8px 12px' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-main)', fontSize: '13px', marginBottom: '4px', display: 'block' }}>비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => {
                  const val = e.target.value;
                  setPassword(val);
                  if (rememberPw) {
                    try { localStorage.setItem('remember_pw', val); } catch (err) {}
                  }
                }}
                placeholder="비밀번호 입력"
                required
                style={{ fontSize: '14px', padding: '8px 12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', padding: '2px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberId}
                  onChange={e => {
                    const checked = e.target.checked;
                    setRememberId(checked);
                    try {
                      if (checked) {
                        localStorage.setItem('remember_id_pref', 'true');
                        if (loginId) localStorage.setItem('remember_id', loginId);
                      } else {
                        localStorage.removeItem('remember_id_pref');
                        localStorage.removeItem('remember_id');
                      }
                    } catch (err) {}
                  }}
                />
                아이디 저장
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberPw}
                  onChange={e => {
                    const checked = e.target.checked;
                    setRememberPw(checked);
                    try {
                      if (checked) {
                        localStorage.setItem('remember_pw_pref', 'true');
                        if (password) localStorage.setItem('remember_pw', password);
                      } else {
                        localStorage.removeItem('remember_pw_pref');
                        localStorage.removeItem('remember_pw');
                      }
                    } catch (err) {}
                  }}
                />
                비밀번호 저장
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={e => {
                    const checked = e.target.checked;
                    setAutoLogin(checked);
                    if (!checked) {
                      try { localStorage.removeItem('auto_user'); } catch (err) {}
                    }
                  }}
                />
                자동 로그인
              </label>
            </div>

            {loginErrorMsg && (
              <div style={{
                backgroundColor: 'var(--danger-light)',
                border: '1px solid #ef4444',
                color: 'var(--danger)',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                lineHeight: '1.4'
              }}>
                {loginErrorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '8px', fontSize: '15px', fontWeight: '700' }}
            >
              {isLoggingIn ? '로그인 확인 중...' : '로그인'}
            </button>
          </form>

          {/* 🌐 플랫폼 최고관리자 도메인 접속 시 일반 사용자용 고객사 포털 안내 */}
          {domainMode === 'ADMIN' && (
            <div style={{
              marginTop: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(79, 70, 229, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>일반 테넌트 임직원이신가요?</span>
              <a
                href={getLandingUrl()}
                style={{
                  color: '#818cf8',
                  fontWeight: '700',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                고객사 ERP 바로가기 ➔
              </a>
            </div>
          )}

          {/* 시연 데모 모드 체험 버튼: 오직 데모 도메인(awp-demo.ebro.run)에서만 노출하며, 기연리프트 실운영 화면에서는 100% 숨김 */}
          {isDemoMode() && (
            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                onClick={enterDemoMode}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--info)',
                  border: '1px solid #0284c7',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Zap size={14} color="#38bdf8" />
                <span>시연 데모 모드로 체험하기</span>
              </button>
            </div>
          )}

          {/* 💻 PC 에이전트 설치 프로그램 다운로드 (접속 URL 기준 테넌트 자동 식별) */}
          <div style={{
            marginTop: '16px',
            padding: '14px 16px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <Monitor size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  PC 에이전트 설치 프로그램
                </span>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--primary)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                {isDemoMode() ? '(주)e-Bro렌탈 전용' : `${currentTenant?.displayName || currentTenant?.tradeName || '기연리프트'} 전용`}
              </span>
            </div>

            <div>
              <button
                type="button"
                onClick={handleAgentInstallerDownload}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--primary)',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                  whiteSpace: 'nowrap'
                }}
                title="PC 백그라운드 에이전트 및 웹 확장도구 통합 설치 패키지 다운로드"
              >
                <Download size={15} color="#ffffff" style={{ flexShrink: 0 }} />
                <span>eBro 통합 에이전트 설치 (.exe)</span>
              </button>
            </div>

            {installerDownloadMsg && (
              <div style={{
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: '#dcfce7',
                border: '1px solid #86efac',
                color: '#166534',
                fontSize: '11.5px',
                fontWeight: 600,
                textAlign: 'center',
                whiteSpace: 'nowrap'
              }}>
                {installerDownloadMsg}
              </div>
            )}


          </div>

          {/* 접속 화면 모드 선택 (모바일 / PC) */}
          <div style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px'
          }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>접속 화면 모드</span>
            <div style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: 'var(--bg-app)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <button
                type="button"
                onClick={() => {
                  setIsMobileView(true);
                  localStorage.setItem('erp_view_mode', 'mobile');
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: isMobileView ? 'var(--primary)' : 'transparent',
                  color: isMobileView ? '#ffffff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Smartphone size={13} />
                <span>모바일</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMobileView(false);
                  localStorage.setItem('erp_view_mode', 'desktop');
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: !isMobileView ? 'var(--primary)' : 'transparent',
                  color: !isMobileView ? '#ffffff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Monitor size={13} />
                <span>PC/대화면</span>
              </button>
            </div>
          </div>

          {/* 아이폰 · 아이패드 사파리(Safari) 최적화 안내 */}
          <div style={{
            marginTop: '16px',
            padding: '12px 14px',
            borderRadius: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            color: 'var(--text-muted)',
            fontSize: '11.5px',
            lineHeight: 1.5
          }}>
            <div style={{ fontWeight: '700', color: '#60a5fa', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Smartphone size={14} />
              <span>아이폰 · 아이패드 사파리(Safari) 지원</span>
            </div>
            <div>• 사파리 브라우저 <strong>[공유]</strong> ➔ <strong>[홈 화면에 추가]</strong> 시 전체화면 단독 앱으로 즉시 실행됩니다.</div>
            <div>• 아이패드는 화면 회전 및 상단 모드 전환을 통해 모바일/PC 뷰를 선택할 수 있습니다.</div>
          </div>

          {/* 테스트 계정 안내 — 개발 환경(localhost)에서만 표시 */}
          {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
            <div style={{ marginTop: '16px', padding: '12px', border: '1px dashed #f59e0b', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(251,191,36,0.07)', fontSize: '12px' }}>
              <div style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--warning)' }}>⚠️ [개발 전용] 테스트 계정 — 운영 환경에서는 표시 안됨</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>• 개발자: <strong>admin / admin123</strong></div>
                <div>• 영업관리: <strong>manager / mgr123</strong></div>
                <div>• 일반영업: <strong>user / user123</strong></div>
                <div>• 정비현장: <strong>mechanic / mech123</strong></div>
              </div>
              <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed rgba(245, 158, 11, 0.3)', fontSize: '11px', color: 'var(--warning)' }}>
                • 임직원 로그인: <strong>사원명(예: 김동우, 이수용, 최수호)</strong> 또는 <strong>사번</strong> / 초기 비밀번호: <strong>1111</strong>
              </div>
            </div>
          )}

          {/* 개인정보 처리방침 법정 고지 링크 */}
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setShowPrivacyPolicy(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '11.5px',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '4px 8px'
              }}
            >
              개인정보처리방침
            </button>
          </div>
        </div>

        {/* 🛡️ 개인정보 처리방침 모달 (로그인 전 열람 가능) */}
        {showPrivacyPolicy && (
          <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} />
        )}
        </div>
      </div>
    );
  }

  // 2. 모바일 전용 PWA 화면 렌더링 (분리 구축 뷰 — ebro.run/mobile)
  if (isMobileView) {
    return (
      <MobileApp
        onSwitchToPc={() => {
          setIsMobileView(false);
          localStorage.setItem('erp_view_mode', 'desktop');
          if (
            window.location.pathname.toLowerCase().startsWith('/mobile') ||
            window.location.pathname.toLowerCase().startsWith('/m')
          ) {
            window.history.pushState(null, '', '/');
          }
        }}
      />
    );
  }

  // 3. 로그인 상태: 메인 ERP 대시보드 렌더링
  
  // 🛡️ [특급 보안] 어드민 모드 독립 격리 레이아웃 (정보보호서약 완벽 준수)
  if (domainMode === 'ADMIN') {
    return (
      <div style={{ display: 'flex', height: '100dvh', maxHeight: '100dvh', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ height: '64px', flexShrink: 0, backgroundColor: '#1e1b4b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 50, borderBottom: '1px solid #312e81' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#fff', fontSize: '16px', fontWeight: '900' }}>eB</span>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '-0.5px' }}>eBro 플랫폼 통합 관제탑</div>
              <div style={{ fontSize: '11.5px', color: '#a5b4fc', marginTop: '2px', fontWeight: '600' }}>admin.ebro.run (정보보호서약 완벽 준수 아키텍처)</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>{currentUser.name || '개발자 (시스템)'}</div>
              <div style={{ fontSize: '11px', color: '#818cf8' }}>플랫폼 최고관리자</div>
            </div>
            <button onClick={logout} style={{ padding: '7px 14px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#fff', fontSize: '12px', fontWeight: '700', border: '1px solid rgba(255, 255, 255, 0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <LogOut size={14} /> 로그아웃
            </button>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <aside style={{ width: '260px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '8px', backgroundColor: '#eef2ff', color: '#4f46e5', fontWeight: '800', fontSize: '14.5px', border: '1px solid #c7d2fe', cursor: 'pointer', boxShadow: '0 2px 4px rgba(79, 70, 229, 0.05)' }}>
              <Building2 size={18} /> 테넌트 인프라 관리
            </button>
            <div style={{ marginTop: 'auto', padding: '16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1', fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: '800', marginBottom: '8px' }}>
                <ShieldAlert size={16} color="#ef4444" />
                접근 통제 및 보안 알림
              </div>
              데이터 프라이버시(NDA) 보호 규정에 따라, 최고관리자라 하더라도 <strong>개별 고객사(테넌트)의 비즈니스 데이터 및 ERP 화면에는 원천적으로 접근할 수 없도록 격리</strong>되어 있습니다.<br/><br/>
              본 관제탑에서는 오직 인프라 할당, 계정 상태, 구독 설정만을 제어합니다.
            </div>
          </aside>
          
          <main className="main-content-area" style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f1f5f9', padding: '24px' }}>
            <ErrorBoundary>
               <TenantManagementPage />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    );
  }

  const getMenuTitle = (tabId?: string) => {
    if (!tabId) return '';
    if (tabId === 'dashboard') return 'ERP 대시보드';
    const item = menuGroups.flatMap(g => g.items).find(i => i.id === tabId);
    return item?.name || tabId;
  };

  const prevMenuTitle = canGoBack && historyStack[historyIndex - 1] ? getMenuTitle(historyStack[historyIndex - 1]?.tab) : '';
  const nextMenuTitle = canGoForward && historyStack[historyIndex + 1] ? getMenuTitle(historyStack[historyIndex + 1]?.tab) : '';

  const userHasViewPerm = hasPermission(activeTab, 'view');

  return (
    <div style={{ display: 'flex', height: '100dvh', maxHeight: '100dvh', flexDirection: 'column', overflow: 'hidden' }}>
      <DemoModeBanner />
      
      {/* 🌐 플랫폼 최고관리자 관제탑 안내 띠 배너 */}
      {domainMode === 'ADMIN' && (
        <div style={{
          backgroundColor: '#1e1b4b',
          color: '#e0e7ff',
          fontSize: '12px',
          fontWeight: '600',
          padding: '6px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #3730a3',
          zIndex: 60,
          whiteSpace: 'nowrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ backgroundColor: '#4f46e5', color: '#fff', padding: '1px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' }}>
              ADMIN
            </span>
            <span>eBro 플랫폼 최고관리자 관제탑 (admin.ebro.run) - 멀티테넌트 통합 제어</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ color: '#a5b4fc', fontSize: '11px' }}>
              현재 활성 테넌트: <strong>{currentTenant?.displayName || currentTenant?.tradeName || '기연리프트'}</strong>
            </span>
            <a
              href={getLandingUrl()}
              style={{
                color: '#c7d2fe',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)'
              }}
            >
              공식 솔루션 소개 (ebro.run) ➔
            </a>
          </div>
        </div>
      )}

      {/* 상단 네비게이션 헤더 */}
      <header style={{
        height: '64px',
        flexShrink: 0,
        backgroundColor: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ padding: '8px', display: 'none', borderRadius: '4px', backgroundColor: 'transparent' }}
            className="mobile-burger-btn"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {domainMode === 'ADMIN' ? (
              <>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(79, 70, 229, 0.35)',
                  flexShrink: 0
                }}>
                  <span style={{ color: '#fff', fontSize: '15px', fontWeight: '900' }}>eB</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      onClick={() => setActiveTab('tenant_management')}
                      style={{
                        fontSize: '17px',
                        fontWeight: '900',
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.5px',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.15,
                        cursor: 'pointer'
                      }}
                      title="클릭 시 테넌트 관리 센터로 이동"
                    >
                      eBro 플랫폼 본부
                    </span>
                    <span style={{
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      color: '#818cf8',
                      border: '1px solid rgba(99, 102, 241, 0.3)'
                    }}>
                      admin.ebro.run
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', letterSpacing: '0.2px', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    테넌트 통합 관제 센터
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* 🏢 테넌트 회사 CI 이미지 (회사이름 바로 왼쪽) */}
                <img 
                  src={isDemoMode() ? '/images/ci/ebro_rental_ci.svg' : (currentTenant?.ciUrl || currentTenant?.logoUrl || '/images/ci/giyeun_ci.png')} 
                  alt="CI" 
                  style={{ height: '32px', maxWidth: isDemoMode() ? '110px' : '90px', objectFit: 'contain', flexShrink: 0 }} 
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
                {/* 🏢 1열: 고객회사명(강조) + 만료상태 / 2열: e-Bro ERP System (작은 글씨) */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span 
                      style={{ 
                        fontSize: '18px', 
                        fontWeight: '900', 
                        color: 'var(--text-primary)', 
                        letterSpacing: '-0.5px', 
                        whiteSpace: 'nowrap', 
                        lineHeight: 1.15,
                      }}
                    >
                      {currentTenant?.displayName || currentTenant?.tradeName || currentTenant?.corporateName || (isDemoMode() ? '(주)e-Bro렌탈' : '기연리프트')}
                    </span>
                    {currentTenant && (() => {
                      const subInfo = getTenantSubscriptionInfo(currentTenant);
                      if (subInfo.isExpiringSoon || subInfo.isExpired || subInfo.isGracePeriod) {
                        return (
                          <span
                            title={`구독 만료일자: ${currentTenant.subscription?.endDate || ''}`}
                            style={{
                              padding: '1px 6px',
                              borderRadius: '10px',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              backgroundColor: subInfo.badgeBg,
                              color: subInfo.badgeColor,
                              border: '1px solid rgba(0,0,0,0.08)',
                            }}
                          >
                            {subInfo.badgeLabel || subInfo.label}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--primary)', letterSpacing: '0.2px', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    {isDemoMode() ? 'e-Bro AWP ERP' : 'e-Bro ERP System'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 헤더 좌측 현장 날씨 정보 위젯 */}
          <WeatherWidget />

          {/* ─── 인앱 히스토리 네비게이션: 뒤로가기 / 앞으로가기 ─── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button
              onClick={goBack}
              disabled={!canGoBack}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: canGoBack ? 'var(--text-main)' : 'var(--text-muted)',
                opacity: canGoBack ? 1 : 0.35,
                cursor: canGoBack ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.15s ease',
                boxShadow: canGoBack ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
              title={canGoBack ? `이전: ${prevMenuTitle} (Alt+←)` : '이전 화면 없음 (Alt+←)'}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goForward}
              disabled={!canGoForward}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: canGoForward ? 'var(--text-main)' : 'var(--text-muted)',
                opacity: canGoForward ? 1 : 0.35,
                cursor: canGoForward ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.15s ease',
                boxShadow: canGoForward ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
              title={canGoForward ? `다음: ${nextMenuTitle} (Alt+→)` : '다음 화면 없음 (Alt+→)'}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* ─── 헤더 중앙: 메뉴 검색 네비게이터 ─── */}
        <div
          ref={menuSearchBoxRef}
          style={{ position: 'relative', flex: '0 1 320px', minWidth: '120px' }}
        >
          {/* 검색 트리거 버튼 (닫힌 상태) */}
          {!menuSearchOpen && (
            <button
              onClick={() => { setMenuSearchOpen(true); setMenuSearchQuery(''); setMenuSearchHighlight(0); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-muted)',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              title="메뉴 검색 (Ctrl+K)"
            >
              <Search size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                메뉴 검색
              </span>
              <span style={{
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                flexShrink: 0,
                fontFamily: 'monospace',
              }}>
                Ctrl+K
              </span>
            </button>
          )}

          {/* 검색 입력창 (열린 상태) */}
          {menuSearchOpen && (
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', pointerEvents: 'none', flexShrink: 0,
              }} />
              <input
                ref={menuSearchInputRef}
                value={menuSearchQuery}
                onChange={e => { setMenuSearchQuery(e.target.value); setMenuSearchHighlight(0); }}
                onKeyDown={handleMenuSearchKeyDown}
                placeholder="메뉴명 입력..."
                style={{
                  width: '100%',
                  padding: '7px 14px 7px 34px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--primary)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* 드롭다운 검색 결과 목록 */}
          {menuSearchOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              zIndex: 200,
              overflow: 'hidden',
              maxHeight: '320px',
              overflowY: 'auto',
            }}>
              {searchResults.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {menuSearchQuery.trim() ? '일치하는 메뉴 없음' : '메뉴명을 입력하세요'}
                </div>
              ) : (
                searchResults.map((item, idx) => (
                  <div
                    key={item.id}
                    onMouseDown={() => {
                      if (manualMode !== 'off') setManualMode('off');
                      setActiveTab(item.id);
                      setMenuSearchOpen(false);
                      setMenuSearchQuery('');
                    }}
                    onMouseEnter={() => setMenuSearchHighlight(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 14px',
                      cursor: 'pointer',
                      backgroundColor: idx === menuSearchHighlight ? 'var(--primary)' : 'transparent',
                      color: idx === menuSearchHighlight ? '#fff' : 'var(--text-primary)',
                      borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border-color)' : 'none',
                      transition: 'background-color 0.1s',
                    }}
                  >
                    <Search size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.65, whiteSpace: 'nowrap' }}>
                        {item.groupName}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 사용자 정보 및 화면 모드 (밝은화면모드 / 어두운화면모드) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>

          {/* 📖 인앱 오버레이 매뉴얼 보기/작성 버튼 */}
          <ManualHeaderButtons
            activeTab={activeTab}
            currentUser={currentUser}
            activeTabName={menuGroups.flatMap(g => g.items).find(i => i.id === activeTab)?.name || (activeTab === 'dashboard' ? '대시보드' : activeTab)}
          />

          {/* 🔔 주기장/공장 현장용 업무 알림 설정 버튼 (소리-차임벨 & 팝업 토스트) */}
          <button
            onClick={() => setShowJobAlertModal(true)}
            style={{
              padding: '6px 11px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease',
              position: 'relative'
            }}
            title="주기장/공장 현장 업무 알림 설정 (소리 차임벨, 확인 버튼 팝업, 직무별 수신)"
          >
            <Bell size={14} color="#2563eb" />
            <span>업무알림설정</span>
            {jobNotifySettings.soundEnabled && (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  display: 'inline-block'
                }}
                title="소리 알림 켜짐"
              />
            )}
          </button>

          {/* 화면 모드 전환 버튼 (명시적 텍스트 라벨 적용) */}
          <button
            onClick={toggleTheme}
            style={{
              padding: '6px 11px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            title={theme === 'light' ? '어두운화면모드(다크모드)로 전환' : '밝은화면모드(라이트모드)로 전환'}
          >
            {theme === 'light' ? (
              <>
                <Sun size={14} color="#F59E0B" />
                <span>밝은화면모드</span>
              </>
            ) : (
              <>
                <Moon size={14} color="#8B5CF6" />
                <span>어두운화면모드</span>
              </>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }} className="user-profile-badge">
            {(() => {
              const originalAdminStr = sessionStorage.getItem('original_admin_user');
              const originalAdmin = originalAdminStr ? JSON.parse(originalAdminStr) : null;
              const isSuperAdmin = currentUser.role === 'ADMIN' || originalAdmin?.role === 'ADMIN';

              const isTrueDev = (u?: any) => u && (u.loginId === 'admin' || u.id === 'sys-admin');
              const getUserDisplayName = (u?: any) => {
                if (!u) return '임직원';
                if (isTrueDev(u)) return '개발자';
                return u.name || '임직원';
              };
              const getUserRoleLabel = (u?: any) => {
                if (!u) return '임직원';
                if (isTrueDev(u)) return '개발자';
                if (u.role === 'ADMIN') return '최고관리자';
                return u.role;
              };

              if (isSuperAdmin) {
                const allUsers = [...users];
                if (originalAdmin && !allUsers.find(u => u.id === originalAdmin.id)) {
                  allUsers.unshift(originalAdmin);
                } else if (currentUser.id === 'sys-admin' && !allUsers.find(u => u.id === 'sys-admin')) {
                  allUsers.unshift(currentUser);
                }

                if (allUsers.length > 0) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                      <select
                        value={currentUser.id}
                        onChange={(e) => switchUser(e.target.value)}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: '1px solid var(--primary)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          maxWidth: '180px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                        title="[관리자 전용] 다른 사용자로 권한 테스트 전환"
                      >
                        <option value={currentUser.id}>{getUserDisplayName(currentUser)} ({currentUser.department}) - 현재</option>
                        <optgroup label="다른 사용자로 전환">
                          {allUsers.filter(u => u.id !== currentUser.id).map(u => (
                            <option key={u.id} value={u.id}>{getUserDisplayName(u)} ({u.department} / {getUserRoleLabel(u)})</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  );
                }
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>{getUserDisplayName(currentUser)} {getUserRoleLabel(currentUser)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{currentUser.department} ({getUserRoleLabel(currentUser)})</span>
                </div>
              );
            })()}
            <div style={{
              width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0, fontSize: '13px'
            }}>
              {(((currentUser.loginId === 'admin' || currentUser.id === 'sys-admin') ? '개발자' : (currentUser.name || 'U'))).substring(0, 1)}
            </div>
          </div>

          <button
            onClick={logout}
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '12.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              height: '32px',
              cursor: 'pointer'
            }}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            <span>로그아웃</span>
          </button>
        </div>
      </header>

      {/* 메인 레이아웃 본문 (헤더 64px 제외 나머지 전체) */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        
        {/* 데스크탑 계층형 아코디언 사이드바 (독자 스크롤) */}
        <aside
          className={`sidebar-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}
          style={{
            width: '260px',
            height: '100%',
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 10px',
            gap: '4px',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          {/* 최상단 독립 ERP 대시보드 버튼 */}
          {hasPermission('dashboard', 'view') && (
            <button
              data-menu-id="dashboard"
              onClick={() => {
                if (manualMode !== 'off') setManualMode('off');
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                fontSize: '13.5px',
                fontWeight: activeTab === 'dashboard' ? '700' : '500',
                color: activeTab === 'dashboard' ? '#ffffff' : 'var(--text-main)',
                background: activeTab === 'dashboard' ? 'linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)' : 'transparent',
                boxShadow: activeTab === 'dashboard' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                cursor: 'pointer',
                marginBottom: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <LayoutDashboard size={17} />
              <span>ERP 대시보드</span>
            </button>
          )}

          {/* 계층형 접이식 상위-하위 아코디언 그룹 메뉴 (개인화 그룹/메뉴 순서, 노출 여부, 색상 연동) */}
          {sortedMenuGroups.map(grp => {
            // 1. 사용자가 권한을 가진 하위 메뉴 필터링 (권한 연동 100%)
            const permittedItems = grp.items.filter(item => hasPermission(item.id, 'view'));
            if (permittedItems.length === 0) return null;

            // 2. 개인화 순서(order)에 따라 정렬
            const sortedItems = [...permittedItems].sort((a, b) => {
              const orderA = menuPrefs[a.id]?.order ?? 999;
              const orderB = menuPrefs[b.id]?.order ?? 999;
              return orderA - orderB;
            });

            // 3. 사용자가 숨김(visible: false) 처리한 메뉴 제외
            const visibleItems = sortedItems.filter(item => menuPrefs[item.id]?.visible !== false);
            if (visibleItems.length === 0) return null;

            const isExpanded = expandedGroups[grp.id] !== false;
            const hasActiveChild = grp.items.some(item => item.id === activeTab);

            return (
              <div key={grp.id} style={{ marginBottom: '4px' }}>
                {/* 상위 메뉴 헤더 버튼 (아코디언 토글) */}
                <button
                  onClick={() => toggleGroup(grp.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: hasActiveChild ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    color: hasActiveChild ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                    <span style={{ width: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {grp.icon}
                    </span>
                    <span style={{ marginLeft: '8px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {grp.name}
                    </span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} style={{ flexShrink: 0 }} />}
                </button>

                {/* 하위 메뉴 서브 항목 그룹 */}
                {isExpanded && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    marginTop: '2px',
                    marginLeft: '15px',
                    borderLeft: '2px solid rgba(59, 130, 246, 0.22)',
                  }}>
                    {visibleItems.map(item => {
                      const isItemActive = activeTab === item.id;
                      const customColorId = menuPrefs[item.id]?.colorId;
                      const colorPreset = getColorPreset(customColorId);
                      const hasCustomColor = Boolean(customColorId && customColorId !== 'default');

                      // 커스텀 색상 스타일
                      const itemTextColor = isItemActive 
                        ? (hasCustomColor ? colorPreset.color : 'var(--primary)') 
                        : (hasCustomColor ? colorPreset.color : 'var(--text-secondary)');
                      const itemBgColor = isItemActive 
                        ? (hasCustomColor ? colorPreset.bgTint : 'var(--primary-light)') 
                        : 'transparent';
                      const itemBorder = isItemActive && hasCustomColor 
                        ? `1px solid ${colorPreset.borderTint}` 
                        : 'none';

                      return (
                        <button
                          key={item.id}
                          data-menu-id={item.id}
                          onClick={() => {
                            if (manualMode !== 'off') setManualMode('off');
                            setActiveTab(item.id);
                            setMobileMenuOpen(false);
                          }}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '16px 1fr auto',
                            columnGap: '8px',
                            alignItems: 'center',
                            width: '100%',
                            padding: '7px 8px 7px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: itemBorder,
                            fontSize: '12px',
                            fontWeight: isItemActive ? '800' : hasCustomColor ? '700' : '400',
                            color: itemTextColor,
                            backgroundColor: itemBgColor,
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '16px',
                            height: '16px',
                            flexShrink: 0,
                            overflow: 'hidden',
                            color: hasCustomColor ? colorPreset.color : 'inherit'
                          }}>
                            {item.icon}
                          </span>
                          <span style={{
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                          }}>
                            {item.name}
                          </span>
                          {/* 커스텀 색상이 지정된 메뉴에 작은 컬러 도트 뱃지 노출 */}
                          {hasCustomColor && (
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: colorPreset.color,
                              flexShrink: 0
                            }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* ⚙️ 사이드바 최하단: 메뉴 패널 개인화 설정 버튼 */}
          <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setShowSidebarCustomModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="사이드바 메뉴 보이기/숨기기, 순서 변경 및 메뉴별 색상 지정"
            >
              <SlidersHorizontal size={14} />
              <span>메뉴 패널 설정</span>
            </button>
          </div>
        </aside>

        {/* 메인 콘텐츠 영역 (독자 종스크롤 & 다이나믹 뷰포트 활용, 두꺼운 16px 스크롤바 적용) */}
        <main style={{ flex: 1, height: '100%', minHeight: 0, padding: '16px 20px 5px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)' }} className="main-content-area">
          {userHasViewPerm ? (
            getActiveComponent()
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '80px 0', color: 'var(--danger)', backgroundColor: 'var(--danger-light)' }}>
              <h3>접근 권한 제한 알림</h3>
              <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                선택하신 메뉴에 대한 조회 권한이 비활성화되어 있습니다.<br />
                권한이 필요할 경우 개발자에게 문의하시기 바랍니다.
              </p>
            </div>
          )}
        </main>

        {/* 모바일 메인 영역 어두운 백드롭 오버레이 (클릭 시 사이드바 자동 닫힘) */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              top: '64px',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 35
            }}
          />
        )}

      </div>

      {/* 모바일 다이나믹 반응형 전용 스타일 (PC vs 모바일 분리) */}
      <style>{`
        @media (max-width: 768px) {
          .mobile-burger-btn {
            display: inline-flex !important;
          }
          .sidebar-nav {
            position: fixed;
            top: 64px;
            left: -270px;
            bottom: 0;
            width: 270px;
            z-index: 40;
            transition: left 0.25s ease;
            box-shadow: 4px 0 15px rgba(0,0,0,0.2);
          }
          .sidebar-nav.mobile-open {
            left: 0;
          }
          .user-profile-badge {
            display: none !important;
          }
          .main-content-area {
            padding: 12px 10px 40px 10px !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            touch-action: pan-x pan-y !important;
          }
        }
      `}</style>

      {/* 🚀 구글 드라이브 미러링 진행상황 플로팅 토스트 */}
      <MirrorSyncProgressToast />

      {/* 📖 인앱 오버레이 매뉴얼 시스템 */}
      <ManualOverlay />
      <ManualAuthorPanel />

      {/* 🛡️ 개인정보 처리방침 법정 고지 모달 */}
      {showPrivacyPolicy && (
        <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} />
      )}

      {/* 🎨 좌측 메뉴 패널 개인화 설정 모달 */}
      <SidebarCustomizationModal
        isOpen={showSidebarCustomModal}
        onClose={() => setShowSidebarCustomModal(false)}
        groups={customizationGroups}
        menuPrefs={menuPrefs}
        onToggleVisibility={toggleMenuVisibility}
        onSetColor={setMenuColor}
        onMoveUp={(list, idx) => moveMenuItemUp(list, idx)}
        onMoveDown={(list, idx) => moveMenuItemDown(list, idx)}
        onMoveGroupUp={(groupList, idx) => moveMenuGroupUp(groupList, idx)}
        onMoveGroupDown={(groupList, idx) => moveMenuGroupDown(groupList, idx)}
        onReset={resetMenuPreferences}
      />

      {/* 🔔 주기장/공장 현장용 고정 팝업 토스트 (확인 버튼 클릭 시까지 상주) */}
      <PersistentJobAlertToast onNavigateMenu={(menuId) => setActiveTab(menuId)} />

      {/* ⚙️ 직무별 업무 알림 설정 모달 */}
      <JobAlertModal
        isOpen={showJobAlertModal}
        onClose={() => setShowJobAlertModal(false)}
      />

      {/* 🤖 온디맨드 로컬 에이전트 실행 안내 모달 (실행 필요 시점에만 팝업) */}
      <AgentRequiredModal
        isOpen={agentRequiredModal.isOpen}
        onClose={() => setAgentRequiredModal(prev => ({ ...prev, isOpen: false }))}
        actionName={agentRequiredModal.actionName}
      />

    </div>
  );
};

const AppWithManual: React.FC = () => (
  <ManualProvider>
    <App />
  </ManualProvider>
);

export default AppWithManual;
