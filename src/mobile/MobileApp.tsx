// src/mobile/MobileApp.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { MobileHeader, MobileDeptMode } from './MobileHeader';
import { MobileBottomNav, MobileTabType } from './MobileBottomNav';
import { MobileHome } from './pages/MobileHome';
import { MobileExecutiveHome } from './pages/MobileExecutiveHome';
import { MobileAdminHome } from './pages/MobileAdminHome';
import { MobileAsList } from './pages/MobileAsList';
import { MobileAsDetail } from './pages/MobileAsDetail';
import { MobileAsCreate } from './pages/MobileAsCreate';
import { MobileDispatchList } from './pages/MobileDispatchList';
import { MobileInspectionList } from './pages/MobileInspectionList';
import { MobileAssetAssignment } from './pages/MobileAssetAssignment';
import { MobileAssetSearch } from './pages/MobileAssetSearch';
import { MobileDispatchOrderCreate } from './pages/MobileDispatchOrderCreate';
import { MobileMyContracts } from './pages/MobileMyContracts';
import { MobileVehicleStock } from './pages/MobileVehicleStock';
import { MobileInboundRegister } from './pages/MobileInboundRegister';
import { MobileInboundDefectClaim } from './pages/MobileInboundDefectClaim';
import { MobileSubleaseManage } from './pages/MobileSubleaseManage';
import { MobileCustomerManage } from './pages/MobileCustomerManage';
import { MobileDelinquencyManage } from './pages/MobileDelinquencyManage';
import { MobileVehicleLog } from './pages/MobileVehicleLog';
import { MobileManualViewer } from './pages/MobileManualViewer';
import { MobileYardConsumableStock } from './pages/MobileYardConsumableStock';
import { SalesJournalPage } from '../pages/SalesJournalPage';
import { AsRouteTrackingPage } from '../pages/AsRouteTrackingPage';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { MobileWalkieTalkieModal } from './components/MobileWalkieTalkieModal';
import { MobileApkMonitorModal } from './components/MobileApkMonitorModal';
import { CallAudioUploadModal } from '../components/CallAudioUploadModal';
import { walkieService } from '../services/walkieTalkieService';
import { initWorkNotificationListener } from '../utils/workNotificationService';
import { 
  getMyWorkStatus, clockIn, clockOut, subscribeWorkStatus, 
  getLatestApkRelease, WorkStatus, ApkRelease 
} from '../services/workStatusService';
import { isDeveloperUser, resolveUserMobileDeptMode } from '../utils/userDepartmentHelper';
import { reconcileCompletedTodosInDb } from '../utils/taskHandoverPipeline';
import { ErrorBoundary } from '../components/ErrorBoundary';
import './mobile.css';

interface MobileAppProps {
  onSwitchToPc?: () => void;
}

export const MobileApp: React.FC<MobileAppProps> = ({ onSwitchToPc: _onSwitchToPc }) => {
  const { 
    fieldAsTickets, deliveries, outboundInspections, currentUser, assets, 
    customers, billings, currentTenant, contracts, contractAssets,
    logout, departments, hasPermission 
  } = useApp();

  const isDeveloper = useMemo(() => isDeveloperUser(currentUser), [currentUser]);

  // 모바일 웹앱 진입 시 전역 다크 테마(High-Contrast Field Dark Mode) 강제 동기화
  useEffect(() => {
    const prevTheme = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-mobile-view', 'true');
    return () => {
      document.documentElement.removeAttribute('data-mobile-view');
      if (prevTheme) {
        document.documentElement.setAttribute('data-theme', prevTheme);
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    };
  }, []);

  // 기완료 ToDo 상시 자동 상계 동기화
  useEffect(() => {
    try {
      reconcileCompletedTodosInDb();
    } catch {}
  }, [deliveries, outboundInspections, contractAssets, fieldAsTickets, billings]);

  // 전대 장비 주기장 유휴 누수 위험 건수
  const subleaseLeakCount = useMemo(() => {
    return (assets || []).filter(a => 
      a.ownerType === 'RENTED' && 
      !a.actualRentReturnDate && 
      a.status !== 'RENTED_RETURNED' && 
      a.status !== 'RENTED'
    ).length;
  }, [assets]);

  // 🚨 약정 납기일 도과 연체 고객사 수 배지 (헌장 4.1 & 5.1 준수)
  const overdueBadgeCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueCustIds = new Set<string>();

    (billings || []).forEach(b => {
      if (b.status === 'REJECTED' || b.status === 'PAID') return;
      const unpaid = (b.totalAmount || 0) - (b.paidAmount || 0);
      if (unpaid <= 0) return;

      const customer = (customers || []).find(c => c.id === b.customerId);
      let dueDate = '';
      if (customer?.paymentDueDay) {
        const ym = b.billingYm || b.createdAt.slice(0, 7);
        const [y, m] = ym.split('-');
        let year = parseInt(y, 10);
        let month = parseInt(m, 10) + 1;
        if (month > 12) { month = 1; year += 1; }
        const lastDay = new Date(year, month, 0).getDate();
        dueDate = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(customer.paymentDueDay, lastDay)).padStart(2, '0')}`;
      } else if (customer?.paymentTermDays) {
        const baseDate = new Date(b.billingDate || b.createdAt.split('T')[0]);
        baseDate.setDate(baseDate.getDate() + customer.paymentTermDays);
        dueDate = baseDate.toISOString().split('T')[0];
      } else {
        const baseDate = new Date(b.billingDate || b.createdAt.split('T')[0]);
        baseDate.setDate(baseDate.getDate() + 30);
        dueDate = baseDate.toISOString().split('T')[0];
      }

      if (dueDate < todayStr) {
        overdueCustIds.add(b.customerId);
      }
    });

    return overdueCustIds.size;
  }, [billings, customers]);

  // 📋 정보 누락 고객사 수 배지 (헌장 1.2 준수)
  const incompleteCustomerCount = useMemo(() => {
    return (customers || []).filter(c => 
      !c.bizRegNo || c.bizRegNo === '미상' ||
      !c.representative || c.representative === '미상' ||
      !c.repContact || c.repContact === '미상' ||
      !c.address || c.address === '미상'
    ).length;
  }, [customers]);

  // 1. 🏛️ 부서 모드 결정
  const userResolvedMode = useMemo(() => {
    return resolveUserMobileDeptMode(currentUser, departments || []);
  }, [currentUser, departments]);

  const [deptMode, setDeptMode] = useState<MobileDeptMode>(() => {
    if (!isDeveloper) return userResolvedMode;
    const saved = localStorage.getItem('erp_mobile_dept') as MobileDeptMode;
    if (saved && (saved === 'SALES' || saved === 'AS' || saved === 'OUTBOUND' || saved === 'EXECUTIVE' || saved === 'ADMIN')) {
      return saved;
    }
    return userResolvedMode;
  });

  useEffect(() => {
    if (!isDeveloper) {
      setDeptMode(userResolvedMode);
    }
  }, [isDeveloper, userResolvedMode]);

  const [activeTab, setActiveTab] = useState<MobileTabType>('home');
  const [selectedAsTicketId, setSelectedAsTicketId] = useState<string | null>(null);
  const [isCreatingAs, setIsCreatingAs] = useState(false);
  const [orderInitialParams, setOrderInitialParams] = useState<{ customerId?: string; specFt?: string } | null>(null);
  const [asInitialParams, setAsInitialParams] = useState<{ assetNo?: string; siteId?: string } | null>(null);

  // 📻 무전기 모달 및 전원 상태
  const [isWalkieModalOpen, setIsWalkieModalOpen] = useState(false);
  const [isWalkieOn, setIsWalkieOn] = useState(() => walkieService.getIsPowerOn());

  // 📱 통화캡처 APK 모니터링 & 출퇴근 상태
  const [isApkMonitorOpen, setIsApkMonitorOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [workStatus, setWorkStatus] = useState<WorkStatus | null>(null);
  const [workLoading, setWorkLoading] = useState(false);
  const [apkRelease, setApkRelease] = useState<ApkRelease | null>(null);

  useEffect(() => {
    getMyWorkStatus(currentUser?.id).then(s => setWorkStatus(s));
    getLatestApkRelease().then(r => setApkRelease(r));
    if (!currentUser?.id) return;
    const unsub = subscribeWorkStatus(currentUser.id, s => setWorkStatus(s));
    return unsub;
  }, [currentUser?.id]);

  const handleWorkToggle = async () => {
    const targetUserId = currentUser?.id || 'current_user';
    if (workLoading) return;
    setWorkLoading(true);
    try {
      if (workStatus?.isWorking) {
        const updated = await clockOut(targetUserId);
        setWorkStatus(updated);
        logout();
      } else {
        const updated = await clockIn(targetUserId);
        setWorkStatus(updated);
      }
    } catch (e) {
      console.error('출퇴근 토글 오류:', e);
    } finally {
      setWorkLoading(false);
    }
  };

  const isWalkieTalkieEnabled = currentTenant?.features?.walkieTalkie !== false;

  useEffect(() => {
    if (currentUser) {
      initWorkNotificationListener(currentUser, departments);
      if (isWalkieTalkieEnabled) {
        walkieService.subscribe({
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          deptName: currentUser.department || currentTenant?.displayName || currentTenant?.tradeName || 'eBro'
        });
      }
    }

    if (!isWalkieTalkieEnabled) {
      setIsWalkieOn(false);
      setIsWalkieModalOpen(false);
      return;
    }

    const handleFirstGesture = () => {
      walkieService.unlockAudio();
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('touchend', handleFirstGesture);
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('pointerdown', handleFirstGesture);
    };
    window.addEventListener('touchstart', handleFirstGesture, { passive: true });
    window.addEventListener('touchend', handleFirstGesture, { passive: true });
    window.addEventListener('click', handleFirstGesture, { passive: true });
    window.addEventListener('pointerdown', handleFirstGesture, { passive: true });

    const interval = setInterval(() => {
      setIsWalkieOn(walkieService.getIsPowerOn());
    }, 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('touchend', handleFirstGesture);
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('pointerdown', handleFirstGesture);
    };
  }, [currentUser, currentTenant, departments, isWalkieTalkieEnabled]);

  const handleDeptModeChange = (mode: MobileDeptMode) => {
    setDeptMode(mode);
    localStorage.setItem('erp_mobile_dept', mode);
    setActiveTab('home');
    setSelectedAsTicketId(null);
    setIsCreatingAs(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // 🛡️ 미처리 배지 카운트 (기완료·반납·취소 건 100% 제외하여 무한 누적 방지)
  const activeContractIdSet = useMemo(() => {
    const set = new Set<string>();
    (contracts || []).forEach(c => {
      const st = (c.status || '').toUpperCase();
      if (st !== 'TERMINATED' && st !== 'CANCELLED' && st !== 'COMPLETED') {
        set.add(c.id);
      }
    });
    return set;
  }, [contracts]);

  const completedInspectionCaIdSet = useMemo(() => {
    const set = new Set<string>();
    (outboundInspections || []).forEach(ins => {
      if (ins.status === 'COMPLETED' && (ins as any).contractAssetId) {
        set.add((ins as any).contractAssetId);
      }
    });
    return set;
  }, [outboundInspections]);

  const assetMap = useMemo(() => new Map((assets || []).map(a => [a.id, a])), [assets]);

  // 1) 미완료 현장정비 티켓 수
  const pendingAsCount = useMemo(() => {
    return (fieldAsTickets || []).filter(
      (t) => t.status === 'REQUESTED' || t.status === 'SCHEDULED' || t.status === 'REVISIT' || t.status === 'IN_PROGRESS'
    ).length;
  }, [fieldAsTickets]);

  // 2) 미완료 장비할당 슬롯 수 (PC 장비 할당 미완결 기준과 100% 동일)
  const pendingAssignmentCount = useMemo(() => {
    return (contractAssets || []).filter((ca) => {
      if (!ca.contractId || !activeContractIdSet.has(ca.contractId)) return false;
      if (ca.status === 'RETURNED' || ca.status === 'SOLD' || ca.status === 'RENTED') return false;
      if (completedInspectionCaIdSet.has(ca.id)) return false;
      if (ca.assetId) return false;
      return true;
    }).length;
  }, [contractAssets, activeContractIdSet, completedInspectionCaIdSet]);

  // 3) 미완료 배차/상차 건수 (이미 상차/운송완료되었거나 취소된 건, 이미 대여중 전환된 건 제외)
  const pendingDispatchCount = useMemo(() => {
    return (deliveries || []).filter((d) => {
      const st = (d.status || '').toUpperCase();
      if (st === 'CANCELLED' || st === 'DELIVERED' || st === 'COMPLETED') return false;
      if (d.contractId && !activeContractIdSet.has(d.contractId)) return false;
      if (d.unloadingCompletedAt || d.loadingCompletedAt) return false;
      if (d.type !== 'INBOUND' && d.contractId) {
        const cAssets = (contractAssets || []).filter(ca => ca.contractId === d.contractId);
        if (cAssets.length > 0 && cAssets.every(ca => ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD')) {
          return false;
        }
      }
      return st === 'PENDING' || st === 'REQUESTED' || st === 'DISPATCHED';
    }).length;
  }, [deliveries, contractAssets, activeContractIdSet]);

  // 4) 미완료 출고검수 건수 (취소된 배차 또는 이미 RENTED/RETURNED 전환된 슬롯 제외)
  const pendingInspectionCount = useMemo(() => {
    const cancelledDelivIds = new Set(
      (deliveries || []).filter(d => d.status === 'CANCELLED' || d.status === 'DELIVERED' || (d.status as string) === 'COMPLETED').map(d => d.id)
    );
    return (outboundInspections || []).filter((ins) => {
      if (ins.status !== 'PENDING' && ins.status !== 'IN_PROGRESS') return false;
      if (ins.contractId && !activeContractIdSet.has(ins.contractId)) return false;
      if (ins.deliveryId && cancelledDelivIds.has(ins.deliveryId)) return false;
      if ((ins as any).contractAssetId) {
        const ca = (contractAssets || []).find(c => c.id === (ins as any).contractAssetId);
        if (!ca || ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD') return false;
      }
      if (ins.assetId) {
        const a = assetMap.get(ins.assetId);
        if (a && a.status === 'RENTED') return false;
      }
      return true;
    }).length;
  }, [outboundInspections, deliveries, contractAssets, assetMap, activeContractIdSet]);

  // 네비게이션 핸들러
  const handleTabChange = (tab: MobileTabType) => {
    setSelectedAsTicketId(null);
    setIsCreatingAs(false);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAsDetail = (ticketId: string) => {
    setSelectedAsTicketId(ticketId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCreateAs = (assetNo?: string, siteId?: string) => {
    const validAssetNo = typeof assetNo === 'string' ? assetNo : undefined;
    const validSiteId = typeof siteId === 'string' ? siteId : undefined;
    setAsInitialParams(validAssetNo || validSiteId ? { assetNo: validAssetNo, siteId: validSiteId } : null);
    setIsCreatingAs(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      data-theme="dark"
      className="mobile-app-root min-h-screen bg-slate-950 text-white flex flex-col font-sans selection:bg-blue-500 selection:text-white w-full max-w-full overflow-x-hidden"
    >
      {/* 상단 모바일 헤더 + 부서 퀵 체인저 + 무전기 버튼 */}
      <MobileHeader 
        deptMode={deptMode}
        onChangeDeptMode={handleDeptModeChange}
        isWalkieOn={isWalkieOn}
        onOpenWalkieTalkie={isWalkieTalkieEnabled ? () => {
          walkieService.unlockAudio();
          setIsWalkieModalOpen(true);
        } : undefined}
        onOpenApkMonitor={() => setIsApkMonitorOpen(true)}
        isWorking={workStatus?.isWorking ?? false}
        isWorkLoading={workLoading}
        onToggleWork={handleWorkToggle}
      />

      {/* 홈 화면 PWA 설치 안내 배너 */}
      <PwaInstallBanner />

      {/* 본문 라우팅 */}
      <main className="flex-1 w-full max-w-lg md:max-w-3xl mx-auto px-1.5 sm:px-3 min-w-0 max-w-full overflow-x-hidden">
        {selectedAsTicketId ? (
          <MobileAsDetail
            ticketId={selectedAsTicketId}
            onBack={() => setSelectedAsTicketId(null)}
          />
        ) : isCreatingAs ? (
          <MobileAsCreate
            initialAssetNo={asInitialParams?.assetNo}
            initialSiteId={asInitialParams?.siteId}
            onBack={() => setIsCreatingAs(false)}
            onCreated={(ticketId) => {
              setIsCreatingAs(false);
              setSelectedAsTicketId(ticketId);
            }}
          />
        ) : activeTab === 'home' ? (
          deptMode === 'EXECUTIVE' ? (
            <MobileExecutiveHome
              onNavigate={handleTabChange}
              onOpenAsDetail={handleOpenAsDetail}
            />
          ) : deptMode === 'ADMIN' ? (
            <MobileAdminHome
              onNavigate={handleTabChange}
            />
          ) : (
            <MobileHome
              deptMode={deptMode}
              onNavigate={handleTabChange}
              onOpenAsDetail={handleOpenAsDetail}
              onOpenCreateAs={handleOpenCreateAs}
            />
          )
        ) : activeTab === 'sales_order' ? (
          <MobileDispatchOrderCreate
            initialCustomerId={orderInitialParams?.customerId}
            initialSpecFt={orderInitialParams?.specFt}
            onBack={() => handleTabChange('home')}
            onSuccess={() => handleTabChange('my_contracts')}
          />
        ) : activeTab === 'my_contracts' ? (
          <MobileMyContracts
            onOpenCreateAsForAsset={
              deptMode === 'SALES'
                ? undefined
                : (assetNo, siteId) => handleOpenCreateAs(assetNo, siteId)
            }
          />
        ) : activeTab === 'as_create' ? (
          <MobileAsCreate
            initialAssetNo={asInitialParams?.assetNo}
            initialSiteId={asInitialParams?.siteId}
            onBack={() => handleTabChange('home')}
            onCreated={(ticketId) => {
              setSelectedAsTicketId(ticketId);
            }}
          />
        ) : activeTab === 'as' ? (
          <MobileAsList
            onSelectTicket={handleOpenAsDetail}
            onOpenCreate={handleOpenCreateAs}
            onOpenManual={() => handleTabChange('manual_viewer')}
            onOpenRouteTracking={() => handleTabChange('as_route_tracking')}
          />
        ) : activeTab === 'as_route_tracking' ? (
          <AsRouteTrackingPage
            isMobileEmbedded
            onOpenTicketDetail={handleOpenAsDetail}
          />
        ) : activeTab === 'dispatch' ? (
          <MobileDispatchList />
        ) : activeTab === 'sublease' ? (
          <MobileSubleaseManage
            onNavigate={(tab) => handleTabChange(tab)}
            onBack={() => handleTabChange('home')}
          />
        ) : activeTab === 'customers' ? (
          <MobileCustomerManage 
            onNavigateToOrder={(customerId) => {
              setOrderInitialParams({ customerId });
              handleTabChange('sales_order');
            }}
          />
        ) : activeTab === 'delinquency' ? (
          <MobileDelinquencyManage />
        ) : activeTab === 'assignment' ? (
          <MobileAssetAssignment 
            onNavigate={(tab) => handleTabChange(tab)}
            onBack={() => handleTabChange('home')}
          />
        ) : activeTab === 'inspection' ? (
          <MobileInspectionList />
        ) : activeTab === 'inbound_register' ? (
          <MobileInboundRegister 
            onSuccess={() => handleTabChange('inspection')}
            onBack={() => handleTabChange('home')}
            onOpenDefectClaim={() => handleTabChange('inbound_defect_claim')}
          />
        ) : activeTab === 'inbound_defect_claim' ? (
          <MobileInboundDefectClaim
            onNavigate={handleTabChange}
            initialViewMode={deptMode === 'SALES' ? 'NEGOTIATE' : 'REGISTER'}
          />
        ) : activeTab === 'vehicle_log' ? (
          <MobileVehicleLog onBack={() => handleTabChange('home')} />
        ) : activeTab === 'manual_viewer' ? (
          <MobileManualViewer onBack={() => handleTabChange('home')} />
        ) : activeTab === 'vehicle_stock' ? (
          <MobileVehicleStock />
        ) : activeTab === 'consumable_stock' ? (
          <MobileYardConsumableStock onBack={() => handleTabChange('home')} />
        ) : activeTab === 'sales_journal' ? (
          <SalesJournalPage isMobileEmbedded />
        ) : (
          <MobileAssetSearch
            onNavigateToOrder={(specFt) => {
              setOrderInitialParams({ specFt });
              handleTabChange('sales_order');
            }}
          />
        )}
      </main>

      {/* 하단 고정 부서별 특화 엄지손가락 내비게이션 바 */}
      {!selectedAsTicketId && !isCreatingAs && (
        <MobileBottomNav
          deptMode={deptMode}
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          hasPermission={hasPermission}
          isDeveloper={isDeveloper}
          pendingAsCount={pendingAsCount}
          pendingDispatchCount={pendingDispatchCount}
          pendingInspectionCount={pendingInspectionCount}
          pendingAssignmentCount={pendingAssignmentCount}
          subleaseLeakCount={subleaseLeakCount}
          overdueBadgeCount={overdueBadgeCount}
          incompleteCustomerCount={incompleteCustomerCount}
        />
      )}

      {/* 📻 현장 무전기 모달 */}
      {isWalkieTalkieEnabled && (
        <ErrorBoundary fallbackTitle="무전기 오류 복구" isModal onClose={() => setIsWalkieModalOpen(false)}>
          <MobileWalkieTalkieModal
            isOpen={isWalkieModalOpen}
            onClose={() => setIsWalkieModalOpen(false)}
            onNavigateToDispatchOrder={() => {
              setIsWalkieModalOpen(false);
              handleTabChange('sales_order');
            }}
          />
        </ErrorBoundary>
      )}

      {/* 📱 통화 녹음 APK 다운로드 및 모니터링 모달 */}
      <MobileApkMonitorModal
        isOpen={isApkMonitorOpen}
        onClose={() => setIsApkMonitorOpen(false)}
        workStatus={workStatus}
        isWorkLoading={workLoading}
        onToggleWork={handleWorkToggle}
        onOpenAudioUpload={() => setIsUploadModalOpen(true)}
        apkRelease={apkRelease}
      />

      {/* 📁 통화 녹음 파일 직접 업로드 모달 (아이폰/미설치자 대응) */}
      <CallAudioUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
};
