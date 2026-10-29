// src/mobile/pages/MobileAdminHome.tsx
import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, ArrowRight, 
  Clock, Truck, Layers, Fuel, Bell, CheckSquare, Boxes, FileText
} from 'lucide-react';
import { MobileTabType } from '../MobileBottomNav';
import { Todo } from '../../services/db';
import { findActiveTasksForUser, buildTaskNavigationPayload, resolveMobileTabForTask, getTaskDisplayBadges, canUserSendContract } from '../../utils/taskHandoverPipeline';
import { findUnsentContractOutboundRows } from '../../modules/dispatchRequest/dispatchOrderHistoryReconstructor';
import { ContractDocumentBundleModal } from '../../components/ContractDocumentBundleModal';
import { MobileApprovalInboxSection } from '../components/MobileApprovalInboxSection';

interface MobileAdminHomeProps {
  onNavigate: (tab: MobileTabType) => void;
}

export const MobileAdminHome: React.FC<MobileAdminHomeProps> = ({ onNavigate }) => {
  const { 
    currentUser, 
    deliveries, 
    assets,
    contracts,
    contractAssets,
    contractHistory,
    customers,
    sites,
    siteMasters,
    contacts,
    users,
    standardOptions,
    outboundInspections,
    repairs,
    fieldAsTickets,
    todos,
    hasPermission,
    resolveExecutiveDirective,
    setNavigationPayload
  } = useApp();
  const [toast, setToast] = useState<string | null>(null);
  const [bundleModalTarget, setBundleModalTarget] = useState<{
    contractId: string;
    deliveryId: string;
    contractAssetIds: string[];
  } | null>(null);

  const canSendContract = useMemo(
    () => canUserSendContract(currentUser, hasPermission, 'ADMIN'),
    [currentUser, hasPermission]
  );

  const unsentContractOutboundItems = useMemo(() => {
    if (!canSendContract) return [];
    return findUnsentContractOutboundRows({
      deliveries: deliveries || [],
      contracts: contracts || [],
      contractAssets: contractAssets || [],
      contractHistory: contractHistory || [],
      todos: todos || [],
      customers: customers || [],
      sites: sites || [],
      siteMasters: siteMasters || [],
      contacts: contacts || [],
      assets: assets || [],
      outboundInspections: outboundInspections || [],
      users: users || [],
      standardOptions: standardOptions || [],
    });
  }, [
    canSendContract,
    deliveries,
    contracts,
    contractAssets,
    contractHistory,
    todos,
    customers,
    sites,
    siteMasters,
    contacts,
    assets,
    outboundInspections,
    users,
    standardOptions,
  ]);

  const unsentDeliveryIdSet = useMemo(
    () => new Set(unsentContractOutboundItems.map(item => item.row.id)),
    [unsentContractOutboundItems]
  );

  // 관리부 미결 업무 피드 (웹앱에서 처리 불가능한 명세서마감/수납/연체관리/매입정산 제외)
  const adminTodos = useMemo(() => {
    const raw = findActiveTasksForUser(todos || [], currentUser, hasPermission, 'ADMIN');
    return raw.filter(task => {
      if (task.taskCategory === 'CONTRACT_PACKAGE_SEND' && task.entityId && unsentDeliveryIdSet.has(task.entityId)) {
        return false;
      }
      if (task.taskCategory === 'EXECUTIVE_DIRECTIVE') return true;
      const { menuLabel } = getTaskDisplayBadges(task);
      if (menuLabel === '청구/수납' || menuLabel === '연체 관리' || menuLabel === '매입 정산') {
        return false;
      }
      const cat = (task.taskCategory || '').toUpperCase();
      if (cat.includes('BILLING') || cat.includes('DELINQUENCY') || cat.includes('SETTLEMENT')) {
        return false;
      }
      return true;
    });
  }, [todos, currentUser, hasPermission, contracts, contractAssets, deliveries, outboundInspections, assets, repairs, fieldAsTickets, unsentDeliveryIdSet]);

  const handleResolveDirective = async (task: Todo) => {
    const note = prompt('조치 결과 내용을 입력해주세요:', '확인 및 조치 완료');
    if (note === null) return;
    await resolveExecutiveDirective(task.id, note || '조치 완료');
    setToast('조치 완료 처리되었습니다.');
    setTimeout(() => setToast(null), 2500);
  };

  // 전대 장비 및 주기장 유휴 누수 건수
  const subleaseAssets = useMemo(() => (assets || []).filter(a => a.ownerType === 'RENTED' && !a.actualRentReturnDate && a.status !== 'RENTED_RETURNED'), [assets]);
  const subleaseLeakCount = useMemo(() => {
    return subleaseAssets.filter(a => a.status !== 'RENTED').length;
  }, [subleaseAssets]);

  // 미완료 배차 건수 (PC 대시보드 및 모바일 하단 배지와 100% 동일 조건)
  const pendingDispatchCount = useMemo(() => {
    const activeContractIdSet = new Set(
      (contracts || [])
        .filter(c => {
          const st = (c.status || '').toUpperCase();
          return st !== 'CANCELLED' && st !== 'TERMINATED' && st !== 'COMPLETED';
        })
        .map(c => c.id)
    );
    return (deliveries || []).filter(d => {
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
    }).length;
  }, [deliveries, contracts, contractAssets]);

  return (
    <div className="flex flex-col gap-4 pb-24 p-4 font-sans text-slate-100">
      {/* 토스트 */}
      {toast && (
        <div 
          style={{
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            padding: '10px 18px',
            borderRadius: '12px',
            backgroundColor: '#065f46',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)'
          }}
        >
          {toast}
        </div>
      )}

      {/* ── [최상단 할일 카드] 계약서 발송 권한 임직원 전용: 장비할당 완료 후 계약서 미발송 출고 요청 ── */}
      {canSendContract && unsentContractOutboundItems.length > 0 && (
        <details open className="bg-slate-900 border-2 border-indigo-500/80 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <summary className="flex items-center justify-between cursor-pointer outline-none list-none [&::-webkit-details-marker]:hidden gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-sm font-black text-white" style={{ whiteSpace: 'nowrap' }}>
                계약서 미발송 출고 요청
              </span>
            </div>
            <span
              className="text-xs font-black px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              미발송 {unsentContractOutboundItems.length}건
            </span>
          </summary>

          <div className="flex flex-col gap-2.5 mt-2">
            {unsentContractOutboundItems.map(({ row, issuedInfo, equipSummary, assignedAssetSummary, contractAssetIds }) => (
              <div
                key={row.id}
                className="p-3 rounded-xl border border-indigo-500/50 bg-indigo-950/30 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-600 text-white" style={{ whiteSpace: 'nowrap' }}>
                      계약서 미발송
                    </span>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" style={{ whiteSpace: 'nowrap' }}>
                      장비할당 완료 {row.totalAssignedCount}대
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700" style={{ whiteSpace: 'nowrap' }}>
                      {row.reqTypeLabel}
                    </span>
                    {row.loadingDateVal && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40" style={{ whiteSpace: 'nowrap' }}>
                        상차 {row.loadingDateVal}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-300 font-mono" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {row.id}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-black text-white leading-snug">
                    [{row.customerName}] {row.siteName}
                  </h4>
                  <p className="text-[11px] text-indigo-300 font-bold mt-1 leading-relaxed">
                    {equipSummary} ({assignedAssetSummary})
                  </p>
                  <div className="text-[10px] text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                    <span>계약번호: {row.contractNo}</span>
                    <span>요청자: {row.requesterName}</span>
                    {issuedInfo && (
                      <span className="text-amber-300">발급이력: {issuedInfo.actor} {issuedInfo.timeStr}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-700/80 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      if (!row.contractId) return;
                      setBundleModalTarget({
                        contractId: row.contractId,
                        deliveryId: row.id,
                        contractAssetIds,
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <FileText className="w-3 h-3" />
                    <span>계약서 발송</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (setNavigationPayload) {
                        setNavigationPayload({
                          deliveryId: row.id,
                          contractId: row.contractId,
                          targetMenuId: 'smart_dispatch4',
                        });
                      }
                      onNavigate('sales_order');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <span>출고 요청 이동</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── 관리부 소속 결재자 전용 수신 결재 대기함 ── */}
      <MobileApprovalInboxSection deptMode="ADMIN" />

      {/* ── 0. 관리부 미결 업무 피드 ── */}
      {adminTodos.length > 0 && (
        <div className="bg-slate-900 border-2 border-sky-500/60 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 flex-shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <span className="text-sm font-black text-white" style={{ whiteSpace: 'nowrap' }}>
                관리부 미결 업무 목록
              </span>
            </div>
            <div className="flex items-center gap-1.5" style={{ flexShrink: 0 }}>
              <span className="text-xs font-black px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {adminTodos.length}건 대기
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {adminTodos.map(task => {
              const rawTargetTab = resolveMobileTabForTask(task) as MobileTabType | null;
              const targetTab = rawTargetTab === 'delinquency' ? null : rawTargetTab;
              const isDirective = task.taskCategory === 'EXECUTIVE_DIRECTIVE';
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
                    isDirective ? 'bg-red-950/40 border-red-500/60' : 'bg-slate-800 border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isDirective ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white" style={{ whiteSpace: 'nowrap' }}>
                          특별지시
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

                  <div className="min-w-0">
                    <div className="text-xs font-black text-white leading-snug">{task.title}</div>
                    {task.content && (
                      <div className="text-[11px] text-slate-200 mt-1 whitespace-pre-line">{task.content}</div>
                    )}
                    <div className="text-[10px] text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                      <span>발행: {task.senderName || '시스템'}</span>
                      {deptLabel && <span>담당부서: {deptLabel}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-700">
                    {targetTab && (
                      <button
                        type="button"
                        onClick={() => {
                          if (setNavigationPayload) {
                            setNavigationPayload(buildTaskNavigationPayload(task));
                          }
                          onNavigate(targetTab);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 flex-shrink-0"
                        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <span>처리 이동</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    {isDirective && (
                      <button
                        type="button"
                        onClick={() => handleResolveDirective(task)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 flex-shrink-0"
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
      )}

      {/* ── 1. 상단 관리부 업무 현황 헤더 ── */}
      <div className="bg-slate-900 border border-blue-500/50 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-sky-300 tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            <span>관리부 업무 현황</span>
          </span>
          <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </span>
        </div>
        <h2 className="text-xl font-black text-white leading-tight">
          {currentUser?.name || '관리담당'}님,<br />
          배차 대기 <span className="text-sky-400 font-mono">{pendingDispatchCount}건</span> • 임차 장비 <span className="text-sky-400 font-mono">{subleaseAssets.length}대</span>
        </h2>
      </div>

      {/* ── 배차관리 배너 ── */}
      <div
        onClick={() => onNavigate('dispatch')}
        className="p-4 rounded-2xl bg-slate-900 border border-blue-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-sky-400">
            <Truck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span style={{ whiteSpace: 'nowrap' }}>배차관리</span>
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40" style={{ whiteSpace: 'nowrap' }}>
                {pendingDispatchCount}건 대기
              </span>
            </div>
            <div className="text-xs text-slate-300">배차 확정 및 상차 완료</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-300" />
      </div>

      {/* ── 전대 장비 운용 및 반납 관리 배너 ── */}
      <div
        onClick={() => onNavigate('sublease')}
        className={`p-4 rounded-2xl border flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-lg ${
          subleaseLeakCount > 0 
            ? 'bg-slate-900 border-rose-500/60' 
            : 'bg-slate-900 border-slate-700'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            subleaseLeakCount > 0 
              ? 'bg-rose-600/20 border border-rose-500/40 text-rose-400' 
              : 'bg-sky-600/20 border border-sky-500/40 text-sky-400'
          }`}>
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span style={{ whiteSpace: 'nowrap' }}>전대 장비 운용 및 반납 관리</span>
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40" style={{ whiteSpace: 'nowrap' }}>
                {subleaseAssets.length}대
              </span>
              {subleaseLeakCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white" style={{ whiteSpace: 'nowrap' }}>
                  미반납 {subleaseLeakCount}대
                </span>
              )}
            </div>
            <div className="text-xs text-slate-300">
              {subleaseLeakCount > 0 
                ? `주기장 미반납 유휴 장비 ${subleaseLeakCount}대 확인 필요` 
                : '외부 임차 장비 및 임차처 반납 기한 관리'}
            </div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-300" />
      </div>

      {/* ── 가용재고조회 바로가기 배너 ── */}
      <div
        onClick={() => onNavigate('assets')}
        className="p-4 rounded-2xl bg-slate-900 border border-sky-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-300">
            <Boxes className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span style={{ whiteSpace: 'nowrap' }}>가용재고조회</span>
            </div>
            <div className="text-xs text-slate-300">피트·모델별 계약가능 재고 및 출고예정 조회</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-sky-400" />
      </div>

      {/* ── 법인차량 주유영수증 등록 (웹앱 숨김 처리 · 코드 보존) ── */}
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

      {bundleModalTarget && (
        <ContractDocumentBundleModal
          isOpen={!!bundleModalTarget}
          onClose={() => setBundleModalTarget(null)}
          initialContractId={bundleModalTarget.contractId}
          initialDeliveryId={bundleModalTarget.deliveryId}
          initialContractAssetIds={bundleModalTarget.contractAssetIds}
        />
      )}
    </div>
  );
};
