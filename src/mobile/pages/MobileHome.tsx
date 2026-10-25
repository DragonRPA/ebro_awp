// src/mobile/pages/MobileHome.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Wrench, Truck, CheckSquare, Search, Send, Building2, 
  ArrowRight, AlertTriangle, Clock, Plus, Boxes, ArrowDownToLine, Users, Car, Fuel, BookOpen,
  Smartphone, Download, UploadCloud, Layers, Package, Bell, FileText, CheckCircle2
} from 'lucide-react';
import { MobileTabType } from '../MobileBottomNav';
import { MobileDeptMode } from '../MobileHeader';
import { CallAudioUploadModal } from '../../components/CallAudioUploadModal';

import { findActiveTasksForUser, buildTaskNavigationPayload, resolveMobileTabForTask as resolveCanonicalMobileTab, getTaskDisplayBadges, resolveTaskMenuId } from '../../utils/taskHandoverPipeline';
import { calculateAvailableInventorySSOT } from '../../utils/availableInventoryCalculator';
import { db, Todo } from '../../services/db';
import { MobileApprovalInboxSection } from '../components/MobileApprovalInboxSection';

interface MobileHomeProps {
  deptMode: MobileDeptMode;
  onNavigate: (tab: MobileTabType) => void;
  onOpenAsDetail: (ticketId: string) => void;
  onOpenCreateAs: () => void;
}

export const MobileHome: React.FC<MobileHomeProps> = ({
  deptMode,
  onNavigate,
  onOpenAsDetail,
  onOpenCreateAs,
}) => {
  const { 
    fieldAsTickets, 
    deliveries, 
    outboundInspections, 
    currentUser, 
    products,
    assets, 
    contracts, 
    contractAssets, 
    mechanicConsumableStocks, 
    customers, 
    currentTenant, 
    repairs, 
    consumables, 
    logout,
    todos,
    hasPermission,
    completeTodo,
    resolveExecutiveDirective,
    refreshAllData,
    billings,
    setNavigationPayload
  } = useApp();

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    setTaskCategoryFilter('ALL');
  }, [deptMode]);

  // ── 로그인 사용자 직무 맞춤형 ToDo 필터링 (헌장 3.3 정책 & 실물 엔티티 완료 교차검증) ──
  const userTodos = useMemo(() => {
    return findActiveTasksForUser(todos || [], currentUser, hasPermission, deptMode);
  }, [todos, currentUser, hasPermission, deptMode, contracts, contractAssets, deliveries, outboundInspections, assets, repairs, fieldAsTickets, billings]);

  const resolveMobileTabForTask = (task: Todo): MobileTabType | null => {
    return resolveCanonicalMobileTab(task) as MobileTabType;
  };

  const handleResolveDirective = async (task: Todo) => {
    const note = prompt('조치 결과 내용을 입력해주세요:', '현장 확인 및 조치 완료');
    if (note === null) return;
    await resolveExecutiveDirective(task.id, note || '조치 완료');
  };

  const handleBulkCompleteNormalTodos = async () => {
    const normalTasks = userTodos.filter(t => t.taskCategory !== 'EXECUTIVE_DIRECTIVE');
    if (normalTasks.length === 0) return;
    for (const t of normalTasks) {
      db.updateRow<Todo>('todos', t.id, {
        isCompleted: true,
      });
    }
    await db.awaitPendingWrites();
    refreshAllData();
  };

  // ── 가용재고 및 출고예정 실시간 요약 (SSOT 단일 엔진 연동: 가용재고조회 화면과 100% 일치) ──
  const availableInventorySummary = useMemo(() => {
    return calculateAvailableInventorySSOT({
      products,
      assets,
      contracts,
      contractAssets,
      deliveries,
      outboundInspections,
    }).summary;
  }, [products, assets, contracts, contractAssets, deliveries, outboundInspections]);

  // ── 실물 상태 기반 미결 KPI 집계 (PC 대시보드 및 모바일 하단 배지와 100% 동일 조건) ──
  const pendingAsTickets = useMemo(() => {
    return (fieldAsTickets || []).filter(
      (t) => t.status !== 'COMPLETED' && t.status !== 'CANCELED' && (t.status as string) !== 'CANCELLED'
    );
  }, [fieldAsTickets]);

  const pendingDeliveries = useMemo(() => {
    const activeContractIdSet = new Set(
      (contracts || [])
        .filter(c => {
          const st = (c.status || '').toUpperCase();
          return st !== 'CANCELLED' && st !== 'TERMINATED' && st !== 'COMPLETED';
        })
        .map(c => c.id)
    );
    return (deliveries || []).filter((d) => {
      if (d.status !== 'PENDING' && d.status !== 'REQUESTED') return false;
      if (!d.contractId || !activeContractIdSet.has(d.contractId)) return false;
      if (d.driverName || d.vehicleNo || d.loadingCompletedAt || d.unloadingCompletedAt) return false;
      const cAssets = (contractAssets || []).filter(ca => ca.contractId === d.contractId);
      if (d.type !== 'INBOUND') {
        if (cAssets.length > 0 && cAssets.every(ca => ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD')) {
          return false;
        }
      } else {
        if (cAssets.length > 0 && cAssets.every(ca => ca.status === 'RETURNED' || ca.status === 'SOLD')) {
          return false;
        }
      }
      return true;
    });
  }, [deliveries, contracts, contractAssets]);

  const pendingInspections = useMemo(() => {
    const cancelledOrDoneDelivIds = new Set(
      (deliveries || [])
        .filter(d => d.status === 'CANCELLED' || d.status === 'DELIVERED' || (d.status as string) === 'COMPLETED')
        .map(d => d.id)
    );
    const activeContractIdSet = new Set(
      (contracts || [])
        .filter(c => {
          const st = (c.status || '').toUpperCase();
          return st !== 'CANCELLED' && st !== 'TERMINATED' && st !== 'COMPLETED';
        })
        .map(c => c.id)
    );
    return (outboundInspections || []).filter((ins) => {
      if (ins.status !== 'PENDING' && ins.status !== 'IN_PROGRESS') return false;
      if (ins.contractId && !activeContractIdSet.has(ins.contractId)) return false;
      if (ins.deliveryId && cancelledOrDoneDelivIds.has(ins.deliveryId)) return false;
      if ((ins as any).contractAssetId) {
        const ca = (contractAssets || []).find(c => c.id === (ins as any).contractAssetId);
        if (ca && (ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD')) return false;
      }
      if (ins.assetId) {
        const asset = (assets || []).find(a => a.id === ins.assetId);
        if (asset && (asset.status === 'RENTED' || asset.status === 'DISPOSED' || (asset.status as string) === 'SOLD' || asset.status === 'RENTED_RETURNED')) return false;
      }
      return true;
    });
  }, [outboundInspections, deliveries, contracts, contractAssets, assets]);

  const pendingAssignmentSlots = availableInventorySummary.unassignedScheduledCount;
  const activeContracts = useMemo(() => (contracts || []).filter(c => c.status === 'ACTIVE' || c.status === 'EXTENDED'), [contracts]);

  const yardRepairAssets = useMemo(() => {
    return (assets || []).filter(a => {
      if (a.status === 'RENTED' || a.status === 'DISPOSED' || (a.status as string) === 'SOLD' || a.status === 'ASSIGNED') return false;
      const hasOutboundDefect = (repairs || []).some(r => r.assetId === a.id && r.status === 'PENDING' && r.source === 'OUTBOUND_DEFECT');
      const hasInboundDefect = (repairs || []).some(r => r.assetId === a.id && r.status === 'PENDING' && r.source === 'INBOUND_INSPECTION');
      const isUnresolved = (repairs || []).some(r => r.assetId === a.id && r.status === 'UNRESOLVED');
      return hasOutboundDefect || hasInboundDefect || isUnresolved || a.status === 'REPAIRING' || a.status === 'RENTED_RETURNED';
    });
  }, [assets, repairs]);

  const inboundDefectCount = useMemo(() => {
    return (assets || []).filter(a => 
      (repairs || []).some(r => r.assetId === a.id && r.status === 'PENDING' && (r.source === 'INBOUND_INSPECTION' || r.source === 'OUTBOUND_DEFECT'))
    ).length;
  }, [assets, repairs]);

  const deptFilterTabs = useMemo(() => {
    if (deptMode === 'OUTBOUND') {
      let assign = 0;
      let inspection = 0;
      let repair = 0;
      userTodos.forEach(t => {
        const mId = resolveTaskMenuId(t);
        if (mId === 'dispatch_assign') assign += 1;
        else if (mId === 'outbound_inspections') inspection += 1;
        else repair += 1;
      });
      return [
        { id: 'ALL', label: `전체 ${userTodos.length}` },
        ...(assign > 0 ? [{ id: 'ASSIGN', label: `장비 할당 ${assign}` }] : []),
        ...(inspection > 0 ? [{ id: 'INSPECTION', label: `출고 검수 ${inspection}` }] : []),
        ...(repair > 0 ? [{ id: 'REPAIR', label: `입고 정비 ${repair}` }] : []),
      ];
    }
    if (deptMode === 'AS') {
      let fieldAs = 0;
      let repair = 0;
      userTodos.forEach(t => {
        const mId = resolveTaskMenuId(t);
        if (mId === 'field_as') fieldAs += 1;
        else repair += 1;
      });
      return [
        { id: 'ALL', label: `전체 ${userTodos.length}` },
        ...(fieldAs > 0 ? [{ id: 'FIELD_AS', label: `현장 정비 ${fieldAs}` }] : []),
        ...(repair > 0 ? [{ id: 'REPAIR', label: `입고 정비 ${repair}` }] : []),
      ];
    }
    // SALES
    let contract = 0;
    let delinquency = 0;
    let customer = 0;
    userTodos.forEach(t => {
      const mId = resolveTaskMenuId(t);
      if (mId === 'contract') contract += 1;
      else if (mId === 'delinquency' || mId === 'billing') delinquency += 1;
      else customer += 1;
    });
    return [
      { id: 'ALL', label: `전체 ${userTodos.length}` },
      ...(contract > 0 ? [{ id: 'CONTRACT', label: `계약 관리 ${contract}` }] : []),
      ...(delinquency > 0 ? [{ id: 'DELINQUENCY', label: `연체 관리 ${delinquency}` }] : []),
      ...(customer > 0 ? [{ id: 'CUSTOMER', label: `고객 관리 ${customer}` }] : []),
    ];
  }, [userTodos, deptMode]);

  const filteredUserTodos = useMemo(() => {
    if (taskCategoryFilter === 'ALL') return userTodos;
    return userTodos.filter(t => {
      const mId = resolveTaskMenuId(t);
      if (taskCategoryFilter === 'ASSIGN') return mId === 'dispatch_assign';
      if (taskCategoryFilter === 'INSPECTION') return mId === 'outbound_inspections';
      if (taskCategoryFilter === 'FIELD_AS') return mId === 'field_as';
      if (taskCategoryFilter === 'REPAIR') return mId !== 'dispatch_assign' && mId !== 'outbound_inspections' && mId !== 'field_as';
      if (taskCategoryFilter === 'CONTRACT') return mId === 'contract';
      if (taskCategoryFilter === 'DELINQUENCY') return mId === 'delinquency' || mId === 'billing';
      if (taskCategoryFilter === 'CUSTOMER') return mId !== 'contract' && mId !== 'delinquency' && mId !== 'billing';
      return true;
    });
  }, [userTodos, taskCategoryFilter]);

  const deptTodoSectionTitle =
    deptMode === 'OUTBOUND' ? '출고팀 담당 업무' :
    deptMode === 'AS' ? 'AS팀 담당 업무' : '영업부 담당 업무';

  // ── 공통 업무 목록(ToDo) 렌더링 블록 ──
  const renderTodoFeedSection = (accentColor: 'indigo' | 'emerald' | 'amber') => {
    if (userTodos.length === 0) return null;

    const borderClass = accentColor === 'emerald'
      ? 'border-emerald-500/60'
      : accentColor === 'amber'
      ? 'border-amber-500/60'
      : 'border-indigo-500/60';

    return (
      <details open className={`bg-slate-900 border-2 ${borderClass} rounded-2xl p-4 shadow-xl flex flex-col gap-3`}>
        <summary className="flex items-center justify-between cursor-pointer outline-none list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-sky-400 flex-shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <span className="text-sm font-black text-white" style={{ whiteSpace: 'nowrap' }}>
              {deptTodoSectionTitle}
            </span>
          </div>
          <div className="flex items-center gap-1.5" style={{ flexShrink: 0 }}>
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-sky-300 border border-blue-500/40" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              {userTodos.length}건 대기
            </span>
          </div>
        </summary>
        <div className="details-content mt-2">
          {/* 부서별 맞춤형 유형 필터 칩 */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
            {deptFilterTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTaskCategoryFilter(tab.id)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-black border transition-all ${
                  taskCategoryFilter === tab.id
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
                style={{ whiteSpace: 'nowrap' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            {filteredUserTodos.map((task) => {
              const isDirective = task.taskCategory === 'EXECUTIVE_DIRECTIVE';
              const isPackageResend = task.taskCategory === 'CONTRACT_PACKAGE_RESEND';
              const { menuLabel, deptLabel } = getTaskDisplayBadges(task);
              const priorityBg = task.priority === 'URGENT' 
                ? 'bg-red-500/20 text-red-300 border-red-500/40' 
                : task.priority === 'HIGH' 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                : 'bg-blue-500/20 text-blue-300 border-blue-500/40';

              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl border flex flex-col gap-2 ${
                    isDirective
                      ? 'bg-red-950/40 border-red-500/60'
                      : isPackageResend
                      ? 'bg-indigo-950/40 border-indigo-500/60'
                      : 'bg-slate-800 border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isDirective ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white flex items-center gap-1" style={{ whiteSpace: 'nowrap' }}>
                          특별지시
                        </span>
                      ) : isPackageResend ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-600 text-white flex items-center gap-1" style={{ whiteSpace: 'nowrap' }}>
                          <FileText className="w-3 h-3" /> 패키지 재발송
                        </span>
                      ) : (
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${priorityBg}`} style={{ whiteSpace: 'nowrap' }}>
                          {task.priority === 'URGENT' ? '긴급' : task.priority === 'HIGH' ? '높음' : '일반'}
                        </span>
                      )}

                      {menuLabel && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40" style={{ whiteSpace: 'nowrap' }}>
                          {menuLabel}
                        </span>
                      )}

                      {task.dueDate && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40" style={{ whiteSpace: 'nowrap' }}>
                          마감 {task.dueDate}
                        </span>
                      )}
                    </div>

                    {task.createdAt && (
                      <span className="text-[10px] text-slate-300 font-mono" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {task.createdAt.substring(5, 10)}
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-white leading-snug">
                      {task.title}
                    </h4>
                    {task.content && (
                      <p className="text-[11px] text-slate-200 mt-1 leading-relaxed whitespace-pre-line">
                        {task.content}
                      </p>
                    )}
                    <div className="text-[10px] text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                      <span>발행: {task.senderName || '시스템'}</span>
                      {deptLabel && <span>담당부서: {deptLabel}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-700">
                    {isPackageResend && (
                      <span
                        className="px-2 py-1 rounded-lg bg-slate-700/80 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1"
                        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <FileText className="w-3 h-3" />
                        <span>PC 에이전트에서 발송</span>
                      </span>
                    )}

                    {(() => {
                      const targetTab = resolveMobileTabForTask(task);
                      if (!targetTab) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            const payload = buildTaskNavigationPayload(task);
                            if (setNavigationPayload) {
                              setNavigationPayload(payload);
                            }
                            if (payload.ticketId && (fieldAsTickets || []).some(tk => tk.id === payload.ticketId || tk.ticketNo === payload.ticketId)) {
                              const matchedTk = (fieldAsTickets || []).find(tk => tk.id === payload.ticketId || tk.ticketNo === payload.ticketId);
                              if (matchedTk) {
                                onOpenAsDetail(matchedTk.id);
                                return;
                              }
                            }
                            onNavigate(targetTab);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          <span>처리 이동</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      );
                    })()}

                    {isDirective && (
                      <button
                        type="button"
                        onClick={() => handleResolveDirective(task)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <CheckSquare className="w-3 h-3" />
                        <span>보고 및 완료</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </details>
    );
  };

  // 1. [영업부 전용 홈 화면]
  if (deptMode === 'SALES') {
    return (
      <div className="flex flex-col gap-4 pb-24 p-4 font-sans text-slate-100">
        <style dangerouslySetInnerHTML={{ __html: `
          details > summary::-webkit-details-marker { display: none; }
          details[open] summary ~ * { animation: slideDown 0.2s ease-out; }
          @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        `}} />

        {/* 상단 현장 피드 배너 */}
        <div className="bg-gradient-to-br from-blue-900/70 to-slate-900 border border-blue-500/50 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-sky-300 tracking-wider">영업 현장 피드</span>
            <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
          </div>
          <h2 className="text-xl font-black text-white leading-tight">
            {currentUser?.name || '영업담당'}님,<br />
            가동 계약 <span className="text-sky-400">{activeContracts.length}건</span> 운용 중
          </h2>
        </div>

        {/* 영업부 직무 맞춤형 미결 과제 ToDo 피드 */}
        {renderTodoFeedSection('indigo')}

        {/* 영업부 소속 결재자(팀장/부장) 전용 수신 결재 대기함 */}
        <MobileApprovalInboxSection deptMode="SALES" />

        {/* [신규 핵심] 영업부 가용재고 및 출고예정 실시간 조회 카드 */}
        <div
          onClick={() => onNavigate('assets')}
          className="p-4 rounded-2xl bg-slate-900 border-2 border-sky-500/50 flex flex-col gap-3 shadow-xl cursor-pointer active:scale-98 transition-all overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300 flex-shrink-0">
                <Boxes className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-white truncate">
                  가용재고 및 출고예정 현황
                </div>
              </div>
            </div>
            <span
              className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-xs font-black flex items-center gap-1 flex-shrink-0"
              style={{ whiteSpace: 'nowrap', flexShrink: 0, color: '#ffffff' }}
            >
              <span>가용재고조회</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-600 flex flex-col justify-between">
              <div className="text-[10.5px] font-extrabold text-sky-300" style={{ whiteSpace: 'nowrap', color: '#7dd3fc' }}>계약가능 재고</div>
              <div className={`text-lg font-black font-mono mt-0.5 ${availableInventorySummary.contractableTotal < 0 ? 'text-rose-400' : 'text-emerald-400'}`} style={{ whiteSpace: 'nowrap' }}>
                {availableInventorySummary.contractableTotal}대
              </div>
              <div className="text-[10px] text-slate-200 font-bold" style={{ whiteSpace: 'nowrap', color: '#cbd5e1' }}>
                재고 - 출고예정
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-600 flex flex-col justify-between">
              <div className="text-[10.5px] font-extrabold text-emerald-300" style={{ whiteSpace: 'nowrap', color: '#6ee7b7' }}>주기장 현재고</div>
              <div className="text-lg font-black font-mono text-white mt-0.5" style={{ whiteSpace: 'nowrap', color: '#ffffff' }}>
                {availableInventorySummary.totalStock}대
              </div>
              <div className="text-[10px] text-slate-200 font-mono font-bold" style={{ whiteSpace: 'nowrap', color: '#e2e8f0' }}>
                당사 {availableInventorySummary.stockOurs} · 임차 {availableInventorySummary.stockSub}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-600 flex flex-col justify-between">
              <div className="text-[10.5px] font-extrabold text-amber-300" style={{ whiteSpace: 'nowrap', color: '#fcd34d' }}>출고예정</div>
              <div className="text-lg font-black font-mono text-amber-400 mt-0.5" style={{ whiteSpace: 'nowrap', color: '#fbbf24' }}>
                {availableInventorySummary.scheduledTotal}대
              </div>
              <div className="text-[10px] text-slate-200 font-mono font-bold" style={{ whiteSpace: 'nowrap', color: '#e2e8f0' }}>
                당사 {availableInventorySummary.scheduledOurs} · 임차 {availableInventorySummary.scheduledSub}
              </div>
            </div>
          </div>
        </div>

        {/* [핵심 1] 모바일 출고 요청 작성 대형 버튼 */}
        <button
          type="button"
          onClick={() => onNavigate('sales_order')}
          className="w-full py-4 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-base flex items-center justify-between shadow-xl shadow-blue-600/30 active:scale-98 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Send className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span style={{ whiteSpace: 'nowrap' }}>출고 요청 작성</span>
          </div>
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* [핵심 2] 통화 녹음 직접 업로드 카드 (영업부 홈 화면 숨김 처리) */}
        {false && (
          <div
            onClick={() => setIsUploadModalOpen(true)}
            className="cursor-pointer bg-slate-900 border border-blue-500/50 rounded-2xl p-4 flex items-center justify-between shadow-md active:scale-98 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0 text-sky-400">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  <span style={{ whiteSpace: 'nowrap' }}>통화 녹음 파일 업로드</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-sky-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                    출고 요청 자동 생성
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  녹음 파일 선택 시 출고 요청 초안 등록
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-sky-400 flex-shrink-0" />
          </div>
        )}

        {/* [핵심 3] 법인차량 주유영수증 촬영 카드 (웹앱 숨김 처리 · 코드 보존) */}
        {false && (
          <div
            onClick={() => onNavigate('vehicle_log')}
            className="p-4 rounded-2xl bg-slate-900 border border-amber-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span style={{ whiteSpace: 'nowrap' }}>법인차량 주유영수증 등록</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                    전사 공용
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-0.5">주유 영수증 촬영 및 주유 대장 연동</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-amber-400" />
          </div>
        )}

        {/* [핵심 5] 입고 파손 수리비 PDF 전달 및 고객 협상 합의 배너 */}
        <div
          onClick={() => onNavigate('inbound_defect_claim')}
          className="p-4 rounded-2xl bg-slate-900 border border-rose-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white" style={{ whiteSpace: 'nowrap' }}>입고 파손 수리비 협상·PDF 전달</div>
              <div className="text-xs text-slate-300">수리비 내역서 PDF 카톡·이메일 전달 및 합의 금액 확정</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-rose-400" />
        </div>

        <CallAudioUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            alert('통화 녹음 파일이 업로드되었습니다.\n분석 완료 후 출고 요청 대기 목록에 초안으로 등록됩니다.');
          }}
        />
      </div>
    );
  }

  // 2. [출고/자산팀 전용 홈 화면]
  if (deptMode === 'OUTBOUND') {
    return (
      <div className="flex flex-col gap-4 pb-24 p-4 font-sans text-slate-100">
        <style dangerouslySetInnerHTML={{ __html: `
          details > summary::-webkit-details-marker { display: none; }
          details[open] summary ~ * { animation: slideDown 0.2s ease-out; }
          @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        `}} />

        <div className="bg-gradient-to-br from-emerald-950/70 to-slate-900 border border-emerald-500/50 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-300 tracking-wider">주기장 출고 피드</span>
            <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <button
              type="button"
              onClick={() => onNavigate('assignment')}
              className="p-2.5 rounded-2xl bg-slate-900/80 border border-sky-500/40 flex flex-col items-center justify-center active:scale-95 transition-all"
            >
              <span className="text-[11px] font-bold text-slate-300" style={{ whiteSpace: 'nowrap' }}>장비 할당 대기</span>
              <span className="text-lg font-black text-sky-400 font-mono mt-0.5">{pendingAssignmentSlots}대</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('inspection')}
              className="p-2.5 rounded-2xl bg-slate-900/80 border border-emerald-500/40 flex flex-col items-center justify-center active:scale-95 transition-all"
            >
              <span className="text-[11px] font-bold text-slate-300" style={{ whiteSpace: 'nowrap' }}>출고검수 대기</span>
              <span className="text-lg font-black text-emerald-400 font-mono mt-0.5">{pendingInspections.length}건</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('as')}
              className="p-2.5 rounded-2xl bg-slate-900/80 border border-amber-500/40 flex flex-col items-center justify-center active:scale-95 transition-all"
            >
              <span className="text-[11px] font-bold text-slate-300" style={{ whiteSpace: 'nowrap' }}>입고정비 대기</span>
              <span className="text-lg font-black text-amber-400 font-mono mt-0.5">{yardRepairAssets.length}대</span>
            </button>
          </div>
        </div>

        {/* 출고팀 직무 맞춤형 당면 과제 ToDo 피드 */}
        {renderTodoFeedSection('emerald')}

        {/* 출고팀 소속 결재자 전용 수신 결재 대기함 */}
        <MobileApprovalInboxSection deptMode="OUTBOUND" />

        {/* 가용재고조회 바로가기 배너 */}
        <div
          onClick={() => onNavigate('assets')}
          className="p-4 rounded-2xl bg-slate-900 border border-sky-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300 flex-shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span style={{ whiteSpace: 'nowrap' }}>가용재고조회</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                  계약가능 {availableInventorySummary.contractableTotal}대
                </span>
              </div>
              <div className="text-xs text-slate-300">주기장 현재고 {availableInventorySummary.totalStock}대 · 출고예정 {availableInventorySummary.scheduledTotal}대</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-sky-400" />
        </div>

        {/* 주기장 정비입력 바로가기 배너 */}
        <div
          onClick={() => onNavigate('as')}
          className="p-4 rounded-2xl bg-slate-900 border border-red-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span style={{ whiteSpace: 'nowrap' }}>주기장 정비 관리</span>
                {yardRepairAssets.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                    {yardRepairAssets.length}대 대기{inboundDefectCount > 0 ? ` (결함 ${inboundDefectCount})` : ''}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300">입고 결함 점검, 소모품 투입 및 임대가능 복원</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-red-400" />
        </div>

        {/* 입고 후 미처리 불량 상태 및 수리비 청구 등록 배너 */}
        <div
          onClick={() => onNavigate('inbound_defect_claim')}
          className="p-4 rounded-2xl bg-slate-900 border border-rose-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span style={{ whiteSpace: 'nowrap' }}>입고 불량 상태·수리비 청구 등록</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                  외상미수금 1건 연동
                </span>
              </div>
              <div className="text-xs text-slate-300">관리번호 입력 ➔ 증상·사진(2장)·예상수리비 ➔ 영업부 인계</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-rose-400" />
        </div>

        {/* 주기장 소모품 재고조회 */}
        <div
          onClick={() => onNavigate('consumable_stock')}
          className="p-4 rounded-2xl bg-slate-900 border border-amber-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span style={{ whiteSpace: 'nowrap' }}>주기장 소모품 재고조회</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                  {(consumables || []).length}종
                </span>
              </div>
              <div className="text-xs text-slate-300">출고 부속품, 충전기, 안전용품 및 부품 가용 수량 조회</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-amber-400" />
        </div>

        {/* [법인차량] 주유영수증 등록 카드 (웹앱 숨김 처리 · 코드 보존) */}
        {false && (
          <div
            onClick={() => onNavigate('vehicle_log')}
            className="p-4 rounded-2xl bg-slate-900 border border-amber-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span style={{ whiteSpace: 'nowrap' }}>법인차량 주유영수증 등록</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                    전사 공용
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-0.5">주유 영수증 촬영 및 주유 대장 연동</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-amber-400" />
          </div>
        )}

        {/* [장비 매뉴얼] 장비 매뉴얼 관리 바로가기 */}
        <div
          onClick={() => onNavigate('manual_viewer')}
          className="p-4 rounded-2xl bg-slate-900 border border-blue-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-sky-400 flex-shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span style={{ whiteSpace: 'nowrap' }}>장비 매뉴얼 관리</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-sky-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                  출고·정비
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-0.5">파츠북, 에러코드 진단표, 전기/유압 회로도 열람</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-sky-400" />
        </div>
      </div>
    );
  }

  // 3. [AS팀 전용 홈 화면 - 기본]
  return (
    <div className="flex flex-col gap-4 pb-24 p-4 font-sans text-slate-100">
      <style dangerouslySetInnerHTML={{ __html: `
        details > summary::-webkit-details-marker { display: none; }
        details[open] summary ~ * { animation: slideDown 0.2s ease-out; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      `}} />

      {/* 상단 현장 AS 출동 피드 배너 */}
      <div className="bg-gradient-to-br from-amber-950/70 to-slate-900 border border-amber-500/50 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-amber-300 tracking-wider">현장 정비 피드</span>
          <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
          </span>
        </div>
        <h2 className="text-xl font-black text-white leading-tight">
          {currentUser?.name || '정비기사'}님,<br />
          출동 대기 과제 <span className="text-amber-400">{pendingAsTickets.length}건</span>
        </h2>
      </div>

      {/* AS팀 직무 맞춤형 당면 과제 ToDo 피드 */}
      {renderTodoFeedSection('amber')}

      {/* AS팀 소속 결재자 전용 수신 결재 대기함 */}
      <MobileApprovalInboxSection deptMode="AS" />

      {/* 긴급 AS 등록 버튼 */}
      <button
        type="button"
        onClick={() => onOpenCreateAs()}
        className="w-full py-4 px-5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-base flex items-center justify-between shadow-xl shadow-amber-600/30 active:scale-98 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Plus className="w-6 h-6 stroke-[3]" />
          </div>
          <span style={{ whiteSpace: 'nowrap' }}>현장 정비 요청 등록</span>
        </div>
        <ArrowRight className="w-5 h-5" />
      </button>

      {/* [현장정비 동선 관리] 바로가기 카드 */}
      <div
        onClick={() => onNavigate('as_route_tracking')}
        className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span style={{ whiteSpace: 'nowrap' }}>현장정비 동선 관리</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                출발·도착·작업·퇴근
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-0.5">일자별 AS팀 업무처리 동선 기록 및 조회</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-emerald-400" />
      </div>

      {/* [장비 매뉴얼 관리] 바로가기 카드 */}
      <div
        onClick={() => onNavigate('manual_viewer')}
        className="p-4 rounded-2xl bg-slate-900 border border-blue-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-sky-400 flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span style={{ whiteSpace: 'nowrap' }}>장비 매뉴얼 관리</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-sky-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                출고·정비
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-0.5">파츠북, 에러코드 진단표, 전기/유압 회로도 열람</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-sky-400" />
      </div>

      {/* 긴급 출동 대상 AS 목록 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>오늘 출동 티켓 ({pendingAsTickets.length}건)</span>
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('as')}
            className="text-xs text-sky-400 font-semibold"
          >
            전체보기 ➔
          </button>
        </div>

        {pendingAsTickets.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-700 text-center text-slate-300 text-xs">
            대기 중인 현장 정비 출동 건이 없습니다.
          </div>
        ) : (
          pendingAsTickets.slice(0, 3).map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => onOpenAsDetail(ticket.id)}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-700 hover:border-slate-600 active:scale-98 transition-all cursor-pointer flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-sky-300 text-xs font-black font-mono border border-blue-500/40">
                    {ticket.assetNo || '자산번호미상'}
                  </span>
                  <span className="text-xs text-slate-300">{ticket.modelName || ''}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                  {ticket.status === 'SCHEDULED' ? '방문예정' : ticket.status === 'REVISIT' ? '재방문' : '접수'}
                </span>
              </div>
              <div className="text-sm font-bold text-white line-clamp-1">
                {ticket.siteName ? `[${ticket.siteName}] ` : ''}{ticket.customerName || '고객사'}
              </div>
              <div className="text-xs text-slate-300 line-clamp-1">
                증상: {ticket.issueDescription || ticket.issueCategory || '고장 점검 요청'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 본인 차량 소모품 재고 조회 */}
      <div
        onClick={() => onNavigate('vehicle_stock')}
        className="p-4 rounded-2xl bg-slate-900 border border-slate-700 hover:border-amber-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span style={{ whiteSpace: 'nowrap' }}>내 차량 소모품 재고</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold" style={{ whiteSpace: 'nowrap' }}>
                {(mechanicConsumableStocks || [])
                  .filter(s => s.mechanicId === currentUser?.id && s.stockQty > 0)
                  .reduce((sum, s) => sum + s.stockQty, 0)}개 적재
              </span>
            </div>
            <div className="text-xs text-slate-300">보충 수령, 주기장 반납 및 실사 관리</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-300" />
      </div>

      {/* 주기장 정비 관리 바로가기 */}
      <div
        onClick={() => onNavigate('as')}
        className="p-4 rounded-2xl bg-slate-900 border border-red-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 flex-shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span style={{ whiteSpace: 'nowrap' }}>주기장 정비 관리</span>
              {yardRepairAssets.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                  {yardRepairAssets.length}대 대기{inboundDefectCount > 0 ? ` (결함 ${inboundDefectCount})` : ''}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-300">입고 결함 장비 수리, 부품 투입 및 임대가능 복원</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-red-400" />
      </div>

      {/* [법인차량] 주유영수증 등록 카드 (웹앱 숨김 처리 · 코드 보존) */}
      {false && (
        <div
          onClick={() => onNavigate('vehicle_log')}
          className="p-4 rounded-2xl bg-slate-900 border border-amber-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span style={{ whiteSpace: 'nowrap' }}>법인차량 주유영수증 등록</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                  전사 공용
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-0.5">주유 영수증 촬영 및 주유 대장 연동</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-amber-400" />
        </div>
      )}
    </div>
  );
};
