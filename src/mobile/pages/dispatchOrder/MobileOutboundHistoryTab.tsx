// src/mobile/pages/dispatchOrder/MobileOutboundHistoryTab.tsx
// 모바일 출고 요청 내역 조회, 상세 명세, 출고 요청 수정, 완결된 출고 수정(계약의 수정), 일정 변경, 취소 및 인쇄/계약서 발송 컴포넌트

import React, { useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Trash2,
  Package,
  ShieldCheck,
  Printer,
  X,
  Plus,
  Check,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { db, StandardOption } from '../../../services/db';
import { createHangulMatcher } from '../../../utils/hangulSearch';
import { splitMasterAwareOptions } from '../../../types/siteOption';
import { ContractDocumentBundleModal } from '../../../components/ContractDocumentBundleModal';
import {
  OutboundHistoryRow,
  OutboundHistoryEquipmentItem,
  getLocalTodayDateStr
} from '../../../modules/dispatchRequest/dispatchOrderTypes';
import {
  classifyOptionCategory,
  getOptionGroupMeta,
  buildCheckedSpecsFromLabels
} from '../../../modules/dispatchRequest/dispatchOrderParser';
import { buildDispatchOrderPrintHtml } from '../../../modules/dispatchRequest/dispatchOrderPrintHtml';

interface MobileOutboundHistoryTabProps {
  rows: OutboundHistoryRow[];
  catalogModels: { modelName: string; availableCount: number }[];
  standardOptions: StandardOption[];
  hasFinancialAccess: boolean;
  canSave: boolean;
  currentUser: any;
  refreshAllData: () => void;
  updateOutboundRequestPricing: (params: any) => Promise<{ success: boolean; errorMessage?: string }>;
  cancelOutboundRequest: (deliveryId: string, reason: string) => Promise<{ success: boolean; errorMessage?: string }>;
  deleteCancelledOutboundRequests: (deliveryIds: string[]) => Promise<{ success: boolean; deletedCount?: number; errorMessage?: string }>;
  fetchRuleForEvent: (eventType: any) => Promise<{ rule: any }>;
  createApprovalRequest: (
    ruleId: string,
    originatorId: string,
    targetId: string,
    targetTable: string,
    requiredTier?: any,
    payload?: any
  ) => Promise<any>;
  isRuleEnabled: (eventType: any) => boolean;
  onRemotePrintHtml: (html: string, customerName: string, siteName: string) => Promise<void>;
  isAgentPrinting: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const MobileOutboundHistoryTab: React.FC<MobileOutboundHistoryTabProps> = ({
  rows,
  catalogModels,
  standardOptions,
  hasFinancialAccess,
  canSave,
  currentUser,
  refreshAllData,
  updateOutboundRequestPricing,
  cancelOutboundRequest,
  deleteCancelledOutboundRequests,
  fetchRuleForEvent,
  createApprovalRequest,
  isRuleEnabled,
  onRemotePrintHtml,
  isAgentPrinting,
  showToast
}) => {
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    'ALL' | 'UNASSIGNED' | 'REQUESTED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'
  >('ALL');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // 편집 상태 (출고검수 전 수정 및 완결된 출고의 수정)
  const [isEditingPrices, setIsEditingPrices] = useState(false);
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [editEquipments, setEditEquipments] = useState<OutboundHistoryEquipmentItem[]>([]);
  const [editAddModelName, setEditAddModelName] = useState<string>('');
  const [editAddModelQty, setEditAddModelQty] = useState<number>(1);
  const [editSelectedOptions, setEditSelectedOptions] = useState<Set<string>>(new Set());
  const [editCustomOptInput, setEditCustomOptInput] = useState<string>('');
  const [editOptPrices, setEditOptPrices] = useState<Record<string, number>>({});
  const [editOptUnits, setEditOptUnits] = useState<Record<string, '월' | '대' | '건' | '수량'>>({});
  const [editOptQtys, setEditOptQtys] = useState<Record<string, number>>({});
  const [editLoadingDate, setEditLoadingDate] = useState<string>('');
  const [editLoadingSlot, setEditLoadingSlot] = useState<string>('오전');
  const [editUnloadingDate, setEditUnloadingDate] = useState<string>('');
  const [editUnloadingSlot, setEditUnloadingSlot] = useState<string>('오전');
  const [editPriceReason, setEditPriceReason] = useState<string>('');

  // 상하차 일정 단독 빠른 변경 상태
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // 출고 취소 모달 상태
  const [cancelTargetRow, setCancelTargetRow] = useState<{
    id: string;
    contractNo: string;
    customerName: string;
    siteName: string;
    equipSummary: string;
  } | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);

  // 취소한 요청 일괄 삭제 모달
  const [deleteCancelledTarget, setDeleteCancelledTarget] = useState<{
    filteredIds: string[];
    allIds: string[];
  } | null>(null);
  const [isDeletingCancelled, setIsDeletingCancelled] = useState(false);

  // 계약서패키지 발송 모달
  const [bundleModalTarget, setBundleModalTarget] = useState<{
    contractId: string;
    deliveryId: string;
    contractAssetIds: string[];
  } | null>(null);

  const isProtectionOption = (label: string) => classifyOptionCategory(label, standardOptions) === 'FREE';
  const isAttachmentOption = (label: string) => classifyOptionCategory(label, standardOptions) === 'ATTACHMENT';
  const isSpecOption = (label: string) => classifyOptionCategory(label, standardOptions) === 'SPEC';

  const toLocalDateStr = (raw: string): string => {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
    return trimmed.slice(0, 10);
  };

  const { baseScopedRows, filteredRows, statusCounts } = useMemo(() => {
    const q = historySearchQuery.trim();
    const matcher = q ? createHangulMatcher(q) : null;

    const scoped = rows.filter(r => {
      const datePart = toLocalDateStr(r.createdAt || r.delivery?.requestDate || '');
      if (historyStartDate && datePart && datePart < historyStartDate) return false;
      if (historyEndDate && datePart && datePart > historyEndDate) return false;
      if (!matcher) return true;
      const equipStr = r.equipmentItems.map(e => `${e.modelName} ${e.assignedAssets.join(' ')}`).join(' ');
      const optStr = r.paidOptionItems.map(o => o.name).join(' ');
      return (
        matcher.test(r.id) ||
        matcher.test(r.contractNo) ||
        matcher.test(r.customerName) ||
        matcher.test(r.siteName) ||
        matcher.test(r.siteAddress) ||
        matcher.test(r.requesterName) ||
        matcher.test(r.siteContactName) ||
        matcher.test(equipStr) ||
        matcher.test(optStr)
      );
    });

    const filtered = scoped.filter(r => {
      if (historyStatusFilter === 'UNASSIGNED' && (r.totalUnassignedCount === 0 || r.dispatchStatus === 'CANCELLED')) return false;
      if (historyStatusFilter === 'REQUESTED' && r.dispatchStatus !== 'REQUESTED' && r.dispatchStatus !== 'PENDING') return false;
      if (historyStatusFilter === 'DISPATCHED' && r.dispatchStatus !== 'DISPATCHED') return false;
      if (historyStatusFilter === 'DELIVERED' && r.dispatchStatus !== 'DELIVERED' && r.dispatchStatus !== 'COMPLETED') return false;
      if (historyStatusFilter === 'CANCELLED' && r.dispatchStatus !== 'CANCELLED') return false;
      return true;
    });

    const counts = {
      ALL: scoped.length,
      UNASSIGNED: scoped.filter(r => r.totalUnassignedCount > 0 && r.dispatchStatus !== 'CANCELLED').length,
      REQUESTED: scoped.filter(r => r.dispatchStatus === 'REQUESTED' || r.dispatchStatus === 'PENDING').length,
      DISPATCHED: scoped.filter(r => r.dispatchStatus === 'DISPATCHED').length,
      DELIVERED: scoped.filter(r => r.dispatchStatus === 'DELIVERED' || r.dispatchStatus === 'COMPLETED').length,
      CANCELLED: scoped.filter(r => r.dispatchStatus === 'CANCELLED').length
    };

    return { baseScopedRows: scoped, filteredRows: filtered, statusCounts: counts };
  }, [rows, historyStartDate, historyEndDate, historySearchQuery, historyStatusFilter]);

  const selectedRow = useMemo(
    () => (selectedHistoryId ? rows.find(r => r.id === selectedHistoryId) || null : null),
    [rows, selectedHistoryId]
  );

  const openEditModeForRow = (row: OutboundHistoryRow) => {
    setEditEquipments(
      row.equipmentItems.map(eq => ({
        contractAssetIds: [...(eq.contractAssetIds || [])],
        modelName: eq.modelName,
        qty: eq.qty,
        monthlyRate: eq.monthlyRate,
        dailyRate: eq.dailyRate,
        assignedAssets: [...(eq.assignedAssets || [])],
        unassignedCount: eq.unassignedCount
      }))
    );
    setEditAddModelName(catalogModels[0]?.modelName || 'SJ-3219');
    setEditAddModelQty(1);

    const initOpts = new Set<string>();
    row.paidOptionItems.forEach(o => initOpts.add(o.name));
    if (row.protectionStr && row.protectionStr !== '없음') {
      splitMasterAwareOptions(row.protectionStr, standardOptions, { onlyMasterOptions: false, stripPrice: true })
        .filter(o => o && o !== '없음' && o !== 'NONE')
        .forEach(o => initOpts.add(o));
    }
    if (row.attachmentsStr && row.attachmentsStr !== '없음') {
      splitMasterAwareOptions(row.attachmentsStr, standardOptions, { onlyMasterOptions: false, stripPrice: true })
        .filter(o => o && o !== '없음' && o !== 'NONE')
        .forEach(o => initOpts.add(o));
    }
    if (row.specsStr && row.specsStr !== '없음') {
      splitMasterAwareOptions(row.specsStr, standardOptions, { onlyMasterOptions: false, stripPrice: true })
        .filter(o => o && o !== '없음' && o !== 'NONE')
        .forEach(o => initOpts.add(o));
    }
    setEditSelectedOptions(initOpts);
    setEditCustomOptInput('');

    const optPriceInit: Record<string, number> = {};
    const optUnitInit: Record<string, '월' | '대' | '건' | '수량'> = {};
    const optQtyInit: Record<string, number> = {};
    row.paidOptionItems.forEach(o => {
      optPriceInit[o.name] = o.price;
      const u = (o.unitLabel || '월').trim();
      optUnitInit[o.name] = u === '건' ? '건' : u === '수량' ? '수량' : u === '대' ? '대' : '월';
      optQtyInit[o.name] = Math.max(1, Number(o.perUnitQty) || 1);
    });
    setEditOptPrices(optPriceInit);
    setEditOptUnits(optUnitInit);
    setEditOptQtys(optQtyInit);
    setEditLoadingDate(row.loadingDateVal || getLocalTodayDateStr());
    setEditLoadingSlot(row.loadingTimeSlotVal || '오전');
    setEditUnloadingDate(row.unloadingDateVal || row.loadingDateVal || getLocalTodayDateStr());
    setEditUnloadingSlot(row.unloadingTimeSlotVal || '오전');
    setEditPriceReason('');
    setIsEditingPrices(true);
  };

  const handleSaveEditPrices = async (row: OutboundHistoryRow) => {
    if (editEquipments.length === 0) {
      showToast('최소 1개 이상의 장비 모델이 필요합니다.', 'error');
      return;
    }
    if (!editLoadingDate || !editUnloadingDate) {
      showToast('상차일과 하차일(계약개시일)을 모두 선택해 주십시오.', 'error');
      return;
    }
    if (editLoadingDate > editUnloadingDate) {
      showToast('상차일이 하차일보다 늦을 수 없습니다.', 'error');
      return;
    }
    if (!row.canEditPreInspection && !editPriceReason.trim()) {
      showToast('계약의 수정 품의 사유를 입력해 주십시오.', 'error');
      return;
    }

    setIsSavingPrices(true);
    try {
      const allOpts = Array.from(editSelectedOptions);
      const nextPaidStr = allOpts
        .filter(label => !isProtectionOption(label) && !isAttachmentOption(label) && !isSpecOption(label))
        .join(', ');
      const nextProtStr = allOpts.filter(label => isProtectionOption(label)).join(', ') || 'NONE';
      const nextAttStr = allOpts.filter(label => isAttachmentOption(label)).join(', ');
      const nextSpecsObj = buildCheckedSpecsFromLabels(
        allOpts,
        row.checkedSpecsObj,
        editOptPrices,
        standardOptions
      );

      const updateParams = {
        deliveryId: row.id,
        allowCompletedModify: !row.canEditPreInspection,
        equipments: editEquipments.map(eq => ({
          contractAssetIds: eq.contractAssetIds,
          modelName: eq.modelName,
          qty: Math.max(1, Number(eq.qty) || 1),
          monthlyRate: Number(eq.monthlyRate) || 0,
          dailyRate: Number(eq.dailyRate) || 0
        })),
        paidOptions: nextPaidStr,
        protection: nextProtStr,
        attachments: nextAttStr,
        checkedSpecs: nextSpecsObj,
        paidOptionPrices: editOptPrices,
        paidOptionUnits: editOptUnits,
        paidOptionQtys: editOptQtys,
        loadingDate: editLoadingDate,
        loadingTimeSlot: editLoadingSlot,
        unloadingDate: editUnloadingDate,
        unloadingTimeSlot: editUnloadingSlot,
        reason: editPriceReason.trim() || '출고 요청 내역 수정'
      };

      if (row.canEditPreInspection) {
        const res = await updateOutboundRequestPricing(updateParams);
        if (res.success) {
          showToast(`배차번호 ${row.id}의 출고 요청 내역이 수정 저장되었습니다.`, 'success');
          setIsEditingPrices(false);
          setIsEditingSchedule(false);
        }
      } else {
        const { rule } = await fetchRuleForEvent('CONTRACT_MODIFY');
        const asIsEquipSummary = row.equipmentItems
          .map(e => `${e.modelName} × ${e.qty}대 (월 ${e.monthlyRate.toLocaleString()}원)`)
          .join(', ');
        const toBeEquipSummary = editEquipments
          .map(e => `${e.modelName} × ${e.qty}대 (월 ${(Number(e.monthlyRate) || 0).toLocaleString()}원)`)
          .join(', ');

        if (rule && rule.id && rule.is_enabled) {
          await createApprovalRequest(
            rule.id,
            currentUser?.id || 'sys-admin',
            row.id,
            'deliveries',
            undefined,
            {
              actionType: 'CONTRACT_MODIFY',
              targetTable: 'deliveries',
              targetId: row.id,
              asIs: {
                contractNo: row.contractNo,
                customerName: row.customerName,
                siteName: row.siteName,
                equipmentsSummary: asIsEquipSummary,
                unloadingDate: row.unloadingDateVal || row.loadingDateVal || '-'
              },
              toBe: {
                contractId: row.contractId,
                contractNo: row.contractNo,
                customerName: row.customerName,
                siteName: row.siteName,
                equipmentsSummary: toBeEquipSummary,
                unloadingDate: editUnloadingDate,
                updateParams
              },
              reason: editPriceReason.trim(),
              summaryText: `[계약의 수정(완결된 출고의 수정)] ${row.customerName} (${row.siteName}) — 배차 ${row.id}`
            }
          );

          if (row.contractId) {
            db.updateRow<any>('contracts', row.contractId, {
              approvalStatus: 'PENDING',
              updatedAt: new Date().toISOString()
            });
            db.insertRow<any>('contractHistory', {
              contractId: row.contractId,
              changeType: 'FEE_CHANGE',
              changeDate: getLocalTodayDateStr(),
              description: `[결재 상신] 계약의 수정(완결된 출고의 수정) 품의 상신 (배차: ${row.id}) | 사유: ${editPriceReason.trim()}`,
              createdAt: new Date().toISOString()
            });
            await db.awaitPendingWrites();
            refreshAllData();
          }

          showToast('계약의 수정 품의가 상신되었습니다. 결재 승인 시 자동 반영됩니다.', 'success');
          setIsEditingPrices(false);
          setIsEditingSchedule(false);
        } else {
          const res = await updateOutboundRequestPricing(updateParams);
          if (res.success) {
            showToast('계약의 수정 내역이 즉시 반영되었습니다.', 'success');
            setIsEditingPrices(false);
            setIsEditingSchedule(false);
          }
        }
      }
    } finally {
      setIsSavingPrices(false);
    }
  };

  const handlePrintHistoryRow = async (row: OutboundHistoryRow) => {
    const safetyOpts = [
      ...row.paidOptionItems.map(o => o.name),
      ...(row.protectionStr !== '없음' ? row.protectionStr.split(',').map(s => s.trim()) : []),
      ...(row.attachmentsStr !== '없음' ? row.attachmentsStr.split(',').map(s => s.trim()) : [])
    ].filter(Boolean);

    const { html, customerName, siteName } = buildDispatchOrderPrintHtml({
      customerName: row.customerName,
      siteName: row.siteName,
      siteAddress: row.siteAddress,
      siteContactName: row.siteContactName,
      siteContactPhone: row.siteContactPhone,
      loadingSchedule: row.loadingSchedule,
      unloadingSchedule: row.unloadingSchedule,
      equipments: row.equipmentItems.map(e => ({
        modelName: e.modelName,
        qty: e.qty,
        monthlyRate: e.monthlyRate,
        dailyRate: e.dailyRate
      })),
      safetyOptions: safetyOpts,
      note: row.userNote || '',
      staggeredMemo: row.staggeredText,
      vehicleType: row.vehicleType,
      paidBy: row.billableToCustomer ? 'CUSTOMER' : 'OURS',
      contextLabel: row.reqTypeLabel,
      requesterName: row.requesterName
    });
    await onRemotePrintHtml(html, customerName, siteName);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 1. 상단 조회 조건 & 필터 패널 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300">요청 시작일</label>
            <input
              type="date"
              value={historyStartDate}
              onChange={e => setHistoryStartDate(e.target.value)}
              className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300">요청 종료일</label>
            <input
              type="date"
              value={historyEndDate}
              onChange={e => setHistoryEndDate(e.target.value)}
              className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
            />
          </div>
        </div>

        {/* 빠른 기간 버튼 & 취소 요청 삭제 */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const t = getLocalTodayDateStr();
                setHistoryStartDate(t);
                setHistoryEndDate(t);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold whitespace-nowrap"
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => {
                setHistoryStartDate('');
                setHistoryEndDate('');
                setHistoryStatusFilter('ALL');
                setHistorySearchQuery('');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold whitespace-nowrap"
            >
              전체 기간
            </button>
            <button
              type="button"
              onClick={() => {
                refreshAllData();
                showToast('출고 요청 내역을 최신 상태로 갱신했습니다.', 'info');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>새로고침</span>
            </button>
          </div>

          {(() => {
            const allCancelledIds = rows.filter(r => r.dispatchStatus === 'CANCELLED').map(r => r.id);
            const scopedCancelledIds = baseScopedRows.filter(r => r.dispatchStatus === 'CANCELLED').map(r => r.id);
            return (
              <button
                type="button"
                onClick={() => {
                  if (allCancelledIds.length === 0) {
                    showToast('삭제할 취소 상태의 출고 요청이 없습니다.', 'info');
                    return;
                  }
                  setDeleteCancelledTarget({
                    filteredIds: scopedCancelledIds,
                    allIds: allCancelledIds
                  });
                }}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/90 text-rose-300 border border-rose-700 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>취소한 요청 삭제{scopedCancelledIds.length > 0 ? ` (${scopedCancelledIds.length})` : ''}</span>
              </button>
            );
          })()}
        </div>

        {/* 상태 필터 칩 */}
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          {[
            { id: 'ALL', label: `전체 (${statusCounts.ALL})` },
            { id: 'UNASSIGNED', label: `장비미할당 (${statusCounts.UNASSIGNED})` },
            { id: 'REQUESTED', label: `배차대기 (${statusCounts.REQUESTED})` },
            { id: 'DISPATCHED', label: `배차완료 (${statusCounts.DISPATCHED})` },
            { id: 'DELIVERED', label: `운송완료 (${statusCounts.DELIVERED})` },
            { id: 'CANCELLED', label: `취소 (${statusCounts.CANCELLED})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setHistoryStatusFilter(tab.id as any)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap ${
                historyStatusFilter === tab.id
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-950 text-slate-300 border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 검색어 */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={historySearchQuery}
            onChange={e => setHistorySearchQuery(e.target.value)}
            placeholder="고객사, 현장명, 모델명, 요청자, 배차번호 검색"
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
          />
          {historySearchQuery && (
            <button
              type="button"
              onClick={() => setHistorySearchQuery('')}
              className="absolute right-2.5 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. 출고 요청 카드 리스트 */}
      <div className="flex flex-col gap-2">
        {filteredRows.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
            조회 조건에 해당하는 출고 요청 내역이 없습니다.
          </div>
        ) : (
          filteredRows.map(row => {
            const equipSummary = row.equipmentItems.map(e => `${e.modelName}×${e.qty}대`).join(', ');
            const totalMonthlyRentalAmount = row.equipmentItems.reduce(
              (sum, e) => sum + (Number(e.monthlyRate) || 0) * (Number(e.qty) || 1),
              0
            );

            return (
              <div
                key={row.id}
                onClick={() => {
                  setSelectedHistoryId(row.id);
                  setIsEditingPrices(false);
                  setIsEditingSchedule(false);
                }}
                className={`bg-slate-900 border border-slate-800 hover:border-blue-600 rounded-xl p-3.5 flex flex-col gap-2 cursor-pointer transition ${
                  row.dispatchStatus === 'CANCELLED' ? 'opacity-65' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs font-black text-blue-400 whitespace-nowrap">{row.id}</span>
                    <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-800 text-slate-200 border border-slate-700 whitespace-nowrap">
                      {row.reqTypeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10.5px] font-bold border whitespace-nowrap ${
                        row.dispatchStatus === 'DELIVERED' || row.dispatchStatus === 'COMPLETED'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : row.dispatchStatus === 'DISPATCHED'
                            ? 'bg-blue-950 text-blue-300 border-blue-800'
                            : row.dispatchStatus === 'CANCELLED'
                              ? 'bg-rose-950 text-rose-300 border-rose-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}
                    >
                      {row.dispatchStatus === 'DELIVERED' || row.dispatchStatus === 'COMPLETED'
                        ? '운송완료'
                        : row.dispatchStatus === 'DISPATCHED'
                          ? '배차완료'
                          : row.dispatchStatus === 'CANCELLED'
                            ? '출고취소'
                            : '배차대기'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600 text-white whitespace-nowrap">
                      상세 ➔
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-black text-white truncate">{row.customerName}</div>
                  <div className="text-xs text-slate-300 truncate">{row.siteName}</div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800 text-xs">
                  <span className="font-mono font-bold text-emerald-400 truncate">{equipSummary || '-'}</span>
                  {hasFinancialAccess && totalMonthlyRentalAmount > 0 && (
                    <span className="font-mono font-bold text-emerald-300 whitespace-nowrap">
                      월 {totalMonthlyRentalAmount.toLocaleString()}원
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span className="font-mono">상차: {row.loadingSchedule}</span>
                  <span>요청: {row.requesterName}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. 선택된 출고 요청 상세 인스펙터 모달 */}
      {selectedRow && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9300,
            backgroundColor: 'rgba(2, 6, 23, 0.92)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* 모달 헤더 */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-sm font-black text-white whitespace-nowrap">출고 요청 상세 명세</span>
              <span className="font-mono text-xs font-bold text-blue-400 truncate">
                {selectedRow.id} ({selectedRow.contractNo})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedHistoryId(null);
                setIsEditingPrices(false);
                setIsEditingSchedule(false);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
            >
              <X className="w-4 h-4" />
              <span>닫기</span>
            </button>
          </div>

          {/* 모달 본문 */}
          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3 text-xs">
            {/* 취소 알림 */}
            {selectedRow.dispatchStatus === 'CANCELLED' && (
              <div className="bg-rose-950/60 border border-rose-700 rounded-xl p-3 flex flex-col gap-1">
                <div className="font-bold text-rose-300">출고 요청 취소됨</div>
                <div className="text-[11px] text-rose-200">
                  {selectedRow.cancelReason || selectedRow.closingMemo || '출고 검수 전 취소 처리된 건입니다.'}
                </div>
              </div>
            )}

            {/* 1. 고객사 및 현장 정보 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
              <div className="text-[11px] font-bold text-blue-400">1. 고객사 및 현장 정보</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10.5px] text-slate-400 block">고객사명</span>
                  <span className="font-bold text-white">{selectedRow.customerName}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-slate-400 block">투입 현장명</span>
                  <span className="font-bold text-white">{selectedRow.siteName}</span>
                </div>
              </div>
              <div>
                <span className="text-[10.5px] text-slate-400 block">현장 상세주소</span>
                <span className="text-slate-200">{selectedRow.siteAddress}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                <div>
                  <span className="text-[10.5px] text-slate-400 block">현장 인수담당자</span>
                  <span className="font-bold text-slate-200">{selectedRow.siteContactName}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-slate-400 block">담당자 연락처</span>
                  <span className="font-mono text-slate-200">{selectedRow.siteContactPhone}</span>
                </div>
              </div>
            </div>

            {/* 2. 요청 장비 및 단가 명세 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-emerald-400">
                  2. 요청 장비 및 단가 명세 (총{' '}
                  {isEditingPrices
                    ? editEquipments.reduce((s, e) => s + (Number(e.qty) || 1), 0)
                    : selectedRow.totalQty}
                  대)
                </span>
                {canSave &&
                  selectedRow.dispatchStatus !== 'CANCELLED' &&
                  (selectedRow.canEditPreInspection || hasFinancialAccess) &&
                  (!isEditingPrices ? (
                    <button
                      type="button"
                      onClick={() => openEditModeForRow(selectedRow)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold whitespace-nowrap"
                    >
                      {selectedRow.canEditPreInspection ? '출고 요청 수정' : '계약수정'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isSavingPrices}
                        onClick={() => handleSaveEditPrices(selectedRow)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold whitespace-nowrap"
                      >
                        {isSavingPrices
                          ? '처리중...'
                          : selectedRow.canEditPreInspection
                            ? '저장'
                            : isRuleEnabled('CONTRACT_MODIFY')
                              ? '결재 상신'
                              : '저장'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingPrices(false)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-bold whitespace-nowrap"
                      >
                        취소
                      </button>
                    </div>
                  ))}
              </div>

              {isEditingPrices ? (
                <div className="flex flex-col gap-2.5">
                  {!selectedRow.canEditPreInspection && (
                    <div className="bg-indigo-950/60 border border-indigo-700 rounded-lg p-2.5 flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-amber-300">계약의 수정 품의 사유 (필수) *</span>
                      <input
                        type="text"
                        value={editPriceReason}
                        onChange={e => setEditPriceReason(e.target.value)}
                        placeholder="변경 사유 입력 (예: 모델/수량/단가/하차일 정정)"
                        className="px-2.5 py-2 rounded-lg bg-slate-950 border border-amber-500 text-white text-xs"
                      />
                    </div>
                  )}

                  {editEquipments.map((eq, idx) => (
                    <div key={idx} className="bg-slate-950 border border-blue-800 rounded-lg p-2.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={eq.modelName}
                          onChange={e => {
                            const newModel = e.target.value;
                            setEditEquipments(prev => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], modelName: newModel };
                              return next;
                            });
                          }}
                          className="flex-1 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs"
                        >
                          {!catalogModels.some(m => m.modelName === eq.modelName) && (
                            <option value={eq.modelName}>{eq.modelName}</option>
                          )}
                          {catalogModels.map(m => (
                            <option key={m.modelName} value={m.modelName}>
                              {m.modelName} (가용 {m.availableCount}대)
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditEquipments(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], qty: Math.max(1, (Number(next[idx].qty) || 1) - 1) };
                                return next;
                              });
                            }}
                            className="w-7 h-7 rounded bg-slate-800 text-white font-bold border border-slate-700"
                          >
                            -
                          </button>
                          <span className="px-2 font-mono font-bold text-white">{eq.qty}대</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditEquipments(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], qty: (Number(next[idx].qty) || 1) + 1 };
                                return next;
                              });
                            }}
                            className="w-7 h-7 rounded bg-slate-800 text-white font-bold border border-slate-700"
                          >
                            +
                          </button>
                          {editEquipments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setEditEquipments(prev => prev.filter((_, i) => i !== idx))}
                              className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-700 text-[11px] font-bold"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>

                      {hasFinancialAccess && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] text-slate-400">월 렌탈료</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={(Number(eq.monthlyRate) || 0).toLocaleString()}
                              onChange={e => {
                                const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                setEditEquipments(prev => {
                                  const next = [...prev];
                                  next[idx] = {
                                    ...next[idx],
                                    monthlyRate: num,
                                    dailyRate: num > 0 ? Math.round(num / 30) : 0
                                  };
                                  return next;
                                });
                              }}
                              className="px-2.5 py-1.5 rounded bg-slate-900 border border-emerald-600 font-mono font-bold text-emerald-300 text-right"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] text-slate-400">일 렌탈료</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={(Number(eq.dailyRate) || 0).toLocaleString()}
                              onChange={e => {
                                const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                setEditEquipments(prev => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], dailyRate: num };
                                  return next;
                                });
                              }}
                              className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono font-bold text-white text-right"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 모델 추가 */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <select
                      value={editAddModelName}
                      onChange={e => setEditAddModelName(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                    >
                      {catalogModels.map(m => (
                        <option key={m.modelName} value={m.modelName}>
                          {m.modelName} (가용 {m.availableCount}대)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const target = editAddModelName || catalogModels[0]?.modelName;
                        if (!target) return;
                        setEditEquipments(prev => [
                          ...prev,
                          {
                            contractAssetIds: [],
                            modelName: target,
                            qty: editAddModelQty || 1,
                            monthlyRate: 0,
                            dailyRate: 0,
                            assignedAssets: [],
                            unassignedCount: editAddModelQty || 1
                          }
                        ]);
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-700 text-white font-bold text-xs whitespace-nowrap"
                    >
                      + 모델 추가
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {selectedRow.equipmentItems.map((eq, i) => (
                    <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-white">
                          {eq.modelName} × {eq.qty}대
                        </span>
                        {hasFinancialAccess && (
                          <span className="font-mono font-bold text-emerald-400">
                            월 {eq.monthlyRate.toLocaleString()}원 / 일 {eq.dailyRate.toLocaleString()}원
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>할당 자산번호</span>
                        <span className="font-mono text-slate-200">
                          {eq.assignedAssets.length > 0 ? eq.assignedAssets.join(', ') : '미할당'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. 안전옵션 명세 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
              <div className="text-[11px] font-bold text-rose-400">3. 안전옵션 명세</div>
              {selectedRow.paidOptionItems.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {selectedRow.paidOptionItems.map(o => (
                    <div key={o.name} className="flex items-center justify-between text-xs bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="font-bold text-white">{o.name}</span>
                      {hasFinancialAccess && (
                        <span className="font-mono text-rose-300 font-bold">
                          {o.price.toLocaleString()}원 / {o.unitLabel === '대' ? `1대당 ${o.perUnitQty}개` : o.unitLabel}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400">유상옵션 없음</div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                <div>
                  <span className="text-[10.5px] text-slate-400 block">무상옵션</span>
                  <span className="text-slate-200">{selectedRow.protectionStr}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-slate-400 block">부착물</span>
                  <span className="text-slate-200">{selectedRow.attachmentsStr}</span>
                </div>
              </div>
            </div>

            {/* 4. 상하차 일정 및 개시일 빠른 변경 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-blue-400">4. 상하차 일정 및 배차 현황</span>
                {canSave &&
                  selectedRow.dispatchStatus !== 'CANCELLED' &&
                  selectedRow.dispatchStatus !== 'DELIVERED' &&
                  selectedRow.dispatchStatus !== 'COMPLETED' &&
                  !isEditingPrices &&
                  (!isEditingSchedule ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditLoadingDate(selectedRow.loadingDateVal || getLocalTodayDateStr());
                        setEditLoadingSlot(selectedRow.loadingTimeSlotVal || '오전');
                        setEditUnloadingDate(selectedRow.unloadingDateVal || selectedRow.loadingDateVal || getLocalTodayDateStr());
                        setEditUnloadingSlot(selectedRow.unloadingTimeSlotVal || '오전');
                        setIsEditingSchedule(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold whitespace-nowrap"
                    >
                      일정 · 개시일 변경
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        disabled={isSavingSchedule}
                        onClick={async () => {
                          setIsSavingSchedule(true);
                          try {
                            const res = await updateOutboundRequestPricing({
                              deliveryId: selectedRow.id,
                              loadingDate: editLoadingDate,
                              loadingTimeSlot: editLoadingSlot,
                              unloadingDate: editUnloadingDate,
                              unloadingTimeSlot: editUnloadingSlot,
                              reason: '상하차 일시 및 계약 개시일 변경'
                            });
                            if (res.success) {
                              showToast('일정 및 계약 개시일이 변경되었습니다.', 'success');
                              setIsEditingSchedule(false);
                            }
                          } finally {
                            setIsSavingSchedule(false);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold whitespace-nowrap"
                      >
                        일정 저장
                      </button>
                      {selectedRow.totalAssignedCount > 0 && selectedRow.contractId && (
                        <button
                          type="button"
                          disabled={isSavingSchedule}
                          onClick={async () => {
                            setIsSavingSchedule(true);
                            try {
                              const res = await updateOutboundRequestPricing({
                                deliveryId: selectedRow.id,
                                loadingDate: editLoadingDate,
                                loadingTimeSlot: editLoadingSlot,
                                unloadingDate: editUnloadingDate,
                                unloadingTimeSlot: editUnloadingSlot,
                                reason: '하차일시 변경 및 계약서패키지 재발송'
                              });
                              if (res.success) {
                                setIsEditingSchedule(false);
                                setBundleModalTarget({
                                  contractId: selectedRow.contractId,
                                  deliveryId: selectedRow.id,
                                  contractAssetIds: selectedRow.equipmentItems.flatMap(e => e.contractAssetIds || [])
                                });
                              }
                            } finally {
                              setIsSavingSchedule(false);
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-indigo-600 text-white text-[11px] font-bold whitespace-nowrap"
                        >
                          저장 후 계약서 재발송 ➔
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsEditingSchedule(false)}
                        className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[11px] font-bold whitespace-nowrap"
                      >
                        취소
                      </button>
                    </div>
                  ))}
              </div>

              {isEditingSchedule || isEditingPrices ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] text-slate-300">상차 일자</span>
                    <input
                      type="date"
                      value={editLoadingDate}
                      onChange={e => setEditLoadingDate(e.target.value)}
                      className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] text-emerald-300 font-bold">하차 일자 (계약 개시일)</span>
                    <input
                      type="date"
                      value={editUnloadingDate}
                      onChange={e => setEditUnloadingDate(e.target.value)}
                      className="px-2 py-1.5 rounded bg-slate-950 border border-emerald-600 text-emerald-300 font-mono text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">상차 일정</span>
                    <span className="font-mono font-bold text-white">{selectedRow.loadingSchedule}</span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-emerald-400 font-bold block">하차 일정 (계약 개시일)</span>
                    <span className="font-mono font-bold text-emerald-300">{selectedRow.unloadingSchedule}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 모달 하단 액션 바 */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
            <div>
              {selectedRow.canCancelRequest ? (
                <button
                  type="button"
                  onClick={() => {
                    const equipSummary = selectedRow.equipmentItems.map(e => `${e.modelName}×${e.qty}대`).join(', ');
                    setCancelTargetRow({
                      id: selectedRow.id,
                      contractNo: selectedRow.contractNo,
                      customerName: selectedRow.customerName,
                      siteName: selectedRow.siteName,
                      equipSummary
                    });
                    setCancelReasonInput('');
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold whitespace-nowrap"
                >
                  출고 요청 취소
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold whitespace-nowrap">
                    {selectedRow.cancelBlockBadge}
                  </span>
                  {canSave && !selectedRow.canEditPreInspection && hasFinancialAccess && !isEditingPrices && (
                    <button
                      type="button"
                      onClick={() => openEditModeForRow(selectedRow)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 border border-indigo-400 text-white text-xs font-bold whitespace-nowrap"
                    >
                      계약수정
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isAgentPrinting}
                onClick={() => handlePrintHistoryRow(selectedRow)}
                className="px-3 py-2 rounded-xl bg-slate-800 text-slate-100 border border-slate-700 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>출고요청서 인쇄</span>
              </button>

              {selectedRow.dispatchStatus !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedRow.contractId || selectedRow.totalAssignedCount === 0) {
                      showToast('장비 할당이 완료된 후 계약서패키지를 발송할 수 있습니다.', 'error');
                      return;
                    }
                    setBundleModalTarget({
                      contractId: selectedRow.contractId,
                      deliveryId: selectedRow.id,
                      contractAssetIds: selectedRow.equipmentItems.flatMap(e => e.contractAssetIds || [])
                    });
                  }}
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>계약서 발송</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. 출고 요청 취소 확인 모달 */}
      {cancelTargetRow && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9500,
            backgroundColor: 'rgba(2, 6, 23, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div className="w-full max-w-sm bg-slate-900 border border-rose-700 rounded-2xl p-4 flex flex-col gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-400 font-black text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>출고 요청 취소 확인</span>
            </div>
            <div className="text-slate-200 leading-relaxed">
              <strong>{cancelTargetRow.customerName}</strong> ({cancelTargetRow.siteName}) — {cancelTargetRow.equipSummary} 출고 요청을 취소하시겠습니까?
            </div>
            <input
              type="text"
              value={cancelReasonInput}
              onChange={e => setCancelReasonInput(e.target.value)}
              placeholder="취소 사유 입력 (예: 현장 일정 취소)"
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCancelTargetRow(null)}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={async () => {
                  setIsCancelling(true);
                  try {
                    const res = await cancelOutboundRequest(
                      cancelTargetRow.id,
                      cancelReasonInput.trim() || '영업담당자 요청 취소'
                    );
                    if (res.success) {
                      showToast('출고 요청이 취소되었습니다.', 'success');
                      setCancelTargetRow(null);
                      setSelectedHistoryId(null);
                    } else {
                      showToast(res.errorMessage || '취소 처리 실패', 'error');
                    }
                  } finally {
                    setIsCancelling(false);
                  }
                }}
                className="py-2.5 rounded-xl bg-rose-600 text-white font-black"
              >
                {isCancelling ? '취소 처리 중...' : '출고 취소 확정'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 취소한 요청 삭제 확인 모달 */}
      {deleteCancelledTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9500,
            backgroundColor: 'rgba(2, 6, 23, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div className="w-full max-w-sm bg-slate-900 border border-rose-700 rounded-2xl p-4 flex flex-col gap-3 text-xs">
            <div className="text-sm font-black text-rose-400">취소한 출고 요청 영구 삭제</div>
            <div className="text-slate-200">
              취소 완료 상태인 출고 요청({deleteCancelledTarget.allIds.length}건)을 목록에서 삭제하시겠습니까?
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteCancelledTarget(null)}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isDeletingCancelled}
                onClick={async () => {
                  setIsDeletingCancelled(true);
                  try {
                    const targetIds =
                      deleteCancelledTarget.filteredIds.length > 0
                        ? deleteCancelledTarget.filteredIds
                        : deleteCancelledTarget.allIds;
                    const res = await deleteCancelledOutboundRequests(targetIds);
                    if (res.success) {
                      showToast(`취소된 출고 요청 ${res.deletedCount || targetIds.length}건을 삭제했습니다.`, 'success');
                      setDeleteCancelledTarget(null);
                    }
                  } finally {
                    setIsDeletingCancelled(false);
                  }
                }}
                className="py-2.5 rounded-xl bg-rose-600 text-white font-black"
              >
                {isDeletingCancelled ? '삭제 중...' : '삭제 실행'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. 계약서패키지 발송 모달 */}
      {bundleModalTarget && (
        <ContractDocumentBundleModal
          isOpen={true}
          initialContractId={bundleModalTarget.contractId}
          initialDeliveryId={bundleModalTarget.deliveryId}
          initialContractAssetIds={bundleModalTarget.contractAssetIds}
          onClose={() => setBundleModalTarget(null)}
        />
      )}
    </div>
  );
};
