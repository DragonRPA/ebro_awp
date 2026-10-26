// src/mobile/pages/MobileAsDetail.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CameraUploader } from '../components/CameraUploader';
import { SignatureCanvas } from '../components/SignatureCanvas';
import { ArrowLeft, Navigation, Phone, CheckCircle2, Wrench, Plus, Trash2, ChevronDown, MapPin } from 'lucide-react';
import { db, RepairPartUsed, AsRouteEventType, AsPartsSourcingType } from '../../services/db';
import { launchNavigation, safePhoneCall, resolveSiteDetailedAddress, copyToClipboard, NavAppType } from '../../utils/nativeLauncher';
import { getUserDepartmentName } from '../../utils/userDepartmentHelper';
import {
  getAllUnifiedAsRouteLogs,
  getTicketRouteSummary,
  getTicketAssetSourcingInfo,
  getQuickRevisitDateOptions,
  AS_COMMON_PART_PRESETS,
  getLocalWorkDateStr,
  formatTimeHm,
} from '../../services/asRouteTrackingService';

interface MobileAsDetailProps {
  ticketId: string;
  onBack: () => void;
}

const QUICK_TAGS = [
  '협착 방지봉 교체',
  '과상승 감지봉 보수',
  '충전선/220V 수리',
  '협착 센서 리셋',
  '키박스/키스위치 교체',
  '유압 오일 보충/조임',
  '상하강 리미트 스위치 교체',
  '메인보드 리셋',
  '정기 순회 점검 완료',
];

export const MobileAsDetail: React.FC<MobileAsDetailProps> = ({ ticketId, onBack }) => {
  const {
    fieldAsTickets,
    repairs,
    assets,
    vendors,
    users,
    departments,
    completeFieldAsTicket,
    updateFieldAsTicketStatus,
    recordAsRouteEvent,
    mechanicConsumableStocks,
    consumables,
    currentUser,
    showErrorModal,
  } = useApp();

  const ticket = fieldAsTickets.find((t) => t.id === ticketId);
  const todayStr = useMemo(() => getLocalWorkDateStr(), []);
  const quickRevisitOptions = useMemo(() => getQuickRevisitDateOptions(todayStr), [todayStr]);
  const assetSourcingInfo = useMemo(() => {
    if (!ticket) return null;
    return getTicketAssetSourcingInfo(ticket, assets || [], vendors || []);
  }, [ticket, assets, vendors]);

  const asTeamMechanics = useMemo(() => {
    return (users || []).filter((emp) => {
      if (emp.status && emp.status !== 'ACTIVE') return false;
      const dept = (getUserDepartmentName(emp, departments) || '').trim().toUpperCase().replace(/\s+/g, '');
      return dept === 'AS팀' || dept === 'A/S팀' || dept.includes('AS팀');
    });
  }, [users, departments]);

  const [routeStepLoading, setRouteStepLoading] = useState<string | null>(null);
  const [showMoveNextSheet, setShowMoveNextSheet] = useState(false);
  const [selectedNextTicketId, setSelectedNextTicketId] = useState('');
  const [customNextSiteName, setCustomNextSiteName] = useState('');

  // 부품 수급 이동 시트 상태
  const [showPartsSourcingSheet, setShowPartsSourcingSheet] = useState(false);
  const [sourcingType, setSourcingType] = useState<AsPartsSourcingType>(
    assetSourcingInfo?.defaultSourcingType || 'HQ_YARD'
  );
  const [sourcingTargetName, setSourcingTargetName] = useState<string>(
    assetSourcingInfo?.defaultTargetName || '당사 주기장'
  );
  const [sourcingPartName, setSourcingPartName] = useState<string>('');
  const [sourcingAlsoRevisit, setSourcingAlsoRevisit] = useState<boolean>(false);
  const [sourcingRevisitDate, setSourcingRevisitDate] = useState<string>(
    ticket?.revisitDate || quickRevisitOptions[0]?.date || todayStr
  );
  const [sourcingRevisitReason, setSourcingRevisitReason] = useState<string>('');

  // 빠른 재방문 예약 시트 상태
  const [showQuickRevisitSheet, setShowQuickRevisitSheet] = useState(false);
  const [quickRevisitDate, setQuickRevisitDate] = useState<string>(
    ticket?.revisitDate || quickRevisitOptions[0]?.date || todayStr
  );
  const [quickRevisitReason, setQuickRevisitReason] = useState<string>(
    ticket?.unresolvedReason || '부품 수급 후 재방문'
  );

  const routeSummary = useMemo(() => {
    if (!ticket) return null;
    const allLogs = getAllUnifiedAsRouteLogs(repairs);
    return getTicketRouteSummary(ticket, allLogs, todayStr);
  }, [ticket, repairs, todayStr]);

  const handleRecordRouteStep = async (eventType: AsRouteEventType) => {
    if (!ticket || routeStepLoading) return;
    setRouteStepLoading(eventType);
    try {
      await recordAsRouteEvent({
        eventType,
        ticketId: eventType === 'CLOCK_OUT' || eventType === 'RETURN_TO_YARD' ? undefined : ticket.id,
      });
    } finally {
      setRouteStepLoading(null);
    }
  };

  const handleConfirmMoveNextInDetail = async () => {
    if (!ticket || routeStepLoading) return;
    setRouteStepLoading('MOVE_NEXT_SITE');
    try {
      await recordAsRouteEvent({
        eventType: 'MOVE_NEXT_SITE',
        ticketId: ticket.id,
        nextTicketId: selectedNextTicketId || undefined,
        nextSiteCustomName: customNextSiteName.trim() || undefined,
      });
      setShowMoveNextSheet(false);
      setSelectedNextTicketId('');
      setCustomNextSiteName('');
    } finally {
      setRouteStepLoading(null);
    }
  };

  const handleTogglePartsSourcingSheet = () => {
    if (!showPartsSourcingSheet && ticket && assetSourcingInfo) {
      setSourcingType(assetSourcingInfo.defaultSourcingType);
      setSourcingTargetName(assetSourcingInfo.defaultTargetName);
      setSourcingPartName((ticket.partsUsed || []).map(p => p.modelName).filter(Boolean).join(', '));
      setSourcingAlsoRevisit(false);
      setSourcingRevisitDate(ticket.revisitDate || quickRevisitOptions[0]?.date || todayStr);
      setSourcingRevisitReason('');
    }
    setShowPartsSourcingSheet(!showPartsSourcingSheet);
    setShowQuickRevisitSheet(false);
    setShowMoveNextSheet(false);
  };

  const handleSelectSourcingTypeInDetail = (type: AsPartsSourcingType) => {
    setSourcingType(type);
    if (type === 'HQ_YARD') {
      setSourcingTargetName(assetSourcingInfo?.yardName || '당사 주기장');
    } else if (type === 'RENTAL_VENDOR') {
      setSourcingTargetName(assetSourcingInfo?.vendorName || '임차처 부품수급');
    } else if (type === 'COLLEAGUE_VAN') {
      const colleague = asTeamMechanics.find((m) => m.id !== currentUser?.id);
      setSourcingTargetName(colleague ? `${colleague.name} 차량 접선` : '타 차량 접선');
    }
  };

  const handleConfirmPartsSourcingInDetail = async () => {
    if (!ticket || routeStepLoading) return;
    setRouteStepLoading('PARTS_SOURCING');
    try {
      await recordAsRouteEvent({
        eventType: 'PARTS_SOURCING',
        ticketId: ticket.id,
        sourcingType,
        sourcingTargetName: sourcingTargetName.trim() || undefined,
        partName: sourcingPartName.trim() || undefined,
        revisitDate: sourcingAlsoRevisit && sourcingRevisitDate ? sourcingRevisitDate : undefined,
        memo:
          sourcingAlsoRevisit && sourcingRevisitReason.trim()
            ? sourcingRevisitReason.trim()
            : undefined,
      });
      setShowPartsSourcingSheet(false);
    } finally {
      setRouteStepLoading(null);
    }
  };

  const handleConfirmQuickRevisitInDetail = async () => {
    if (!ticket || !quickRevisitDate || routeStepLoading) return;
    setRouteStepLoading('REVISIT_SCHEDULED');
    try {
      await recordAsRouteEvent({
        eventType: 'REVISIT_SCHEDULED',
        ticketId: ticket.id,
        revisitDate: quickRevisitDate,
        memo: quickRevisitReason.trim() || '재방문 예정',
      });
      setShowQuickRevisitSheet(false);
    } finally {
      setRouteStepLoading(null);
    }
  };

  const [actionTaken, setActionTaken] = useState(ticket?.actionTaken || '');
  const [selectedAssetId, setSelectedAssetId] = useState(ticket?.assetId || '');
  const [selectedAssetNo, setSelectedAssetNo] = useState(ticket?.assetNo || '현장확인');
  const [resolutionType, setResolutionType] = useState<'REPAIR_DONE' | 'REVISIT_NEEDED' | 'GUIDED_END'>('REPAIR_DONE');
  const [isExchangeNeeded, setIsExchangeNeeded] = useState(ticket?.exchangeSuggested || false);
  const [revisitReason, setRevisitReason] = useState(ticket?.revisitReason || '');
  const [revisitDate, setRevisitDate] = useState(ticket?.revisitDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [beforeImages, setBeforeImages] = useState<string[]>(
    ticket?.beforeImage ? [ticket.beforeImage] : ticket?.faultImageUrl ? [ticket.faultImageUrl] : []
  );
  const [afterImages, setAfterImages] = useState<string[]>(
    ticket?.afterImage ? [ticket.afterImage] : []
  );
  const [customerSignature, setCustomerSignature] = useState<string>(ticket?.customerSignature || '');
  const [customerConfirmName, setCustomerConfirmName] = useState<string>(ticket?.customerConfirmName || '');
  const [partsUsed, setPartsUsed] = useState<RepairPartUsed[]>(ticket?.partsUsed || []);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [billableType, setBillableType] = useState<'FREE' | 'BILLABLE'>(ticket?.billableType === 'BILLABLE' ? 'BILLABLE' : 'FREE');
  const [billableAmount, setBillableAmount] = useState<number>(ticket?.billableAmount || 0);
  const [inspectionItemCode, setInspectionItemCode] = useState<string>(ticket?.inspectionItemCode || '');
  const [degradationScore, setDegradationScore] = useState<number>(ticket?.degradationScore || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 해당 현장/계약/고객사에 투입된 체결 자산 후보 목록
  const siteCandidateAssets = useMemo(() => {
    if (!ticket) return [];
    const candidateIds = new Set<string>();
    const allAssets = db.assets || [];

    if (ticket.assetId) candidateIds.add(ticket.assetId);
    if (
      ticket.assetNo &&
      ticket.assetNo !== '현장확인' &&
      ticket.assetNo !== '관리번호 모름' &&
      ticket.assetNo !== '전체장비'
    ) {
      const direct = allAssets.find((a) => (a.assetNo || '').toUpperCase() === ticket.assetNo!.toUpperCase());
      if (direct) candidateIds.add(direct.id);
    }

    if (ticket.contractId) {
      for (const ca of db.contractAssets || []) {
        if (ca.contractId === ticket.contractId && ca.status !== 'RETURNED' && ca.assetId) {
          candidateIds.add(ca.assetId);
        }
      }
    }

    const matchedContractIds = new Set<string>();
    for (const c of db.contracts || []) {
      if (c.status === 'COMPLETED') continue;
      if (ticket.siteId && c.siteId === ticket.siteId) {
        matchedContractIds.add(c.id);
        continue;
      }
      if (ticket.siteName) {
        const siteObj = c.siteId ? (db.customerSites || []).find((s) => s.id === c.siteId) : undefined;
        if (siteObj?.name && siteObj.name.trim() === ticket.siteName.trim()) {
          matchedContractIds.add(c.id);
          continue;
        }
      }
      if (ticket.customerId && c.customerId === ticket.customerId) {
        matchedContractIds.add(c.id);
      } else if (ticket.customerName && c.customerName && c.customerName.trim() === ticket.customerName.trim()) {
        matchedContractIds.add(c.id);
      }
    }
    for (const ca of db.contractAssets || []) {
      if (matchedContractIds.has(ca.contractId) && ca.status !== 'RETURNED' && ca.assetId) {
        candidateIds.add(ca.assetId);
      }
    }

    return allAssets.filter((a) => candidateIds.has(a.id));
  }, [ticket, db.assets, db.contracts, db.contractAssets, db.customerSites]);

  useEffect(() => {
    if (!ticket) return;
    const allAssets = db.assets || [];
    const rawId = (ticket.assetId || '').trim();
    const rawNo = (ticket.assetNo || '').trim();
    const isUnknownTicketAsset =
      !rawNo || rawNo === '현장확인' || rawNo === '관리번호 모름' || rawNo === '전체장비';
    let matched = rawId ? allAssets.find((a) => a.id === rawId) : undefined;
    if (!matched && !isUnknownTicketAsset) {
      matched = allAssets.find((a) => (a.assetNo || '').toUpperCase() === rawNo.toUpperCase());
    }
    if (!matched && isUnknownTicketAsset && siteCandidateAssets.length === 1) {
      matched = siteCandidateAssets[0];
    }
    setSelectedAssetId(matched?.id || rawId || '');
    setSelectedAssetNo(matched?.assetNo || rawNo || '관리번호 모름');
  }, [ticket?.id, ticket?.assetId, ticket?.assetNo, siteCandidateAssets]);

  // 기사 차량 적재 소모품을 품목별(다중 로트 합산)로 집계
  const availableVehicleConsumables = useMemo(() => {
    const targetMechanicId = currentUser?.id || ticket?.mechanicId;
    const map = new Map<string, { consumableId: string; modelName: string; unitPrice: number; totalStockQty: number }>();
    for (const s of mechanicConsumableStocks || []) {
      if (targetMechanicId && s.mechanicId !== targetMechanicId) continue;
      if (!s.stockQty || s.stockQty <= 0) continue;
      const c = consumables.find((item) => item.id === s.consumableId);
      const prev = map.get(s.consumableId);
      map.set(s.consumableId, {
        consumableId: s.consumableId,
        modelName: c?.modelName || prev?.modelName || '소모부품',
        unitPrice: c?.unitPrice ?? prev?.unitPrice ?? 0,
        totalStockQty: (prev?.totalStockQty || 0) + s.stockQty,
      });
    }
    return Array.from(map.values());
  }, [mechanicConsumableStocks, consumables, currentUser?.id, ticket?.mechanicId]);

  // 내비게이션 앱 선택 상태 (로컬스토리지 기억)
  const [selectedNavApp, setSelectedNavApp] = useState<NavAppType>(() => {
    return (localStorage.getItem('preferred_nav_app') as NavAppType) || 'TMAP';
  });
  const [showNavOptions, setShowNavOptions] = useState(false);

  // 🌟 정밀 도로명 주소 다단계 역추적 (siteId -> siteName -> contract -> asset 계약 -> 고객사 현장)
  const resolvedAddress = useMemo(() => {
    if (!ticket) return '';
    return resolveSiteDetailedAddress({
      siteAddress: ticket.siteAddress,
      siteId: ticket.siteId,
      siteName: ticket.siteName,
      contractId: ticket.contractId,
      assetNo: ticket.assetNo,
      assetId: ticket.assetId,
      customerName: ticket.customerName,
      locationDetail: ticket.locationDetail,
      customerSites: db.customerSites,
      contracts: db.contracts,
      contractAssets: db.contractAssets,
      customers: db.customers,
    });
  }, [ticket, db.customerSites, db.contracts, db.contractAssets, db.customers]);

  if (!ticket) {
    return (
      <div className="p-8 text-center text-slate-400">
        티켓을 찾을 수 없습니다.
        <button onClick={onBack} className="block mt-4 text-blue-400 underline mx-auto">
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  // 안전한 길안내 열기 (현장명 대신 실제 상세 도로명 주소 우선 전송 + 출발 미기록 시 자동 출발 기록)
  const handleOpenNav = (app: NavAppType = selectedNavApp) => {
    if (!routeSummary?.departedAt) {
      recordAsRouteEvent({
        eventType: 'DEPART_TO_SITE',
        ticketId: ticket.id,
        memo: `${app === 'TMAP' ? 'T맵' : app === 'KAKAO' ? '카카오내비' : '네이버지도'} 길안내 출발`,
      }).catch(() => {});
    }
    const destination = ticket.siteAddress || resolvedAddress || ticket.siteName || ticket.locationDetail || ticket.customerName || '현장';
    launchNavigation(destination, app);
  };

  // 안전한 전화 걸기 (DOM <a> 클릭 방식으로 PWA 세션 보존)
  const handleCall = () => {
    safePhoneCall(ticket.reporterContact);
  };

  // 부품 추가 (품목별 다중 로트 합산 잔량 및 기선택 수량 합산 검증)
  const handleAddPart = () => {
    if (!selectedStockId) return;
    const item = availableVehicleConsumables.find((v) => v.consumableId === selectedStockId);
    if (!item) return;

    const safeQty = Math.max(1, Math.floor(selectedQty || 1));
    const existingIdx = partsUsed.findIndex((p) => p.consumableId === item.consumableId);
    const alreadyAddedQty = existingIdx >= 0 ? partsUsed[existingIdx].quantity : 0;

    if (alreadyAddedQty + safeQty > item.totalStockQty) {
      showErrorModal(`차량 적재 수량(${item.totalStockQty}개)을 초과할 수 없습니다. (현재 선택: ${alreadyAddedQty}개)`);
      return;
    }

    if (existingIdx >= 0) {
      const updated = [...partsUsed];
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: alreadyAddedQty + safeQty,
      };
      setPartsUsed(updated);
    } else {
      const newPart: RepairPartUsed = {
        consumableId: item.consumableId,
        modelName: item.modelName,
        quantity: safeQty,
        unitPrice: item.unitPrice,
        stockSource: 'VEHICLE_VAN',
      };
      setPartsUsed([...partsUsed, newPart]);
    }
    setSelectedStockId('');
    setSelectedQty(1);
  };

  // 부품 제거
  const handleRemovePart = (idx: number) => {
    setPartsUsed(partsUsed.filter((_, i) => i !== idx));
  };

  // 최종 조치 완료 승인
  
  const handleAssign = async () => {
    if (!currentUser?.id) return;
    setIsSubmitting(true);
    try {
      await updateFieldAsTicketStatus(ticket.id, 'SCHEDULED', { mechanicId: currentUser.id });
    } catch (err: any) {
      showErrorModal('접수 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAssign = async () => {
    setIsSubmitting(true);
    try {
      await updateFieldAsTicketStatus(ticket.id, 'REQUESTED', { mechanicId: '' });
    } catch (err: any) {
      showErrorModal('접수 취소 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!actionTaken.trim()) {
      showErrorModal('조치 내용을 입력해 주세요.');
      return;
    }

    if (resolutionType === 'REVISIT_NEEDED' && !revisitReason.trim()) {
      showErrorModal('재방문 사유를 입력해 주세요.');
      return;
    }

    const effectiveAssetNo = (selectedAssetNo || ticket.assetNo || '').trim();
    const isUnmappedAsset =
      !effectiveAssetNo ||
      effectiveAssetNo === '현장확인' ||
      effectiveAssetNo === '관리번호 모름' ||
      effectiveAssetNo === '전체장비';
    if (partsUsed.length > 0 && isUnmappedAsset && siteCandidateAssets.length > 0) {
      showErrorModal('소모품을 사용한 현장 정비 건은 소모품 재고 소진 및 자산 정비이력 매핑을 위해 [정비 대상 자산]을 먼저 선택해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const allAssets = db.assets || [];
      const matchedTargetAsset = selectedAssetId
        ? allAssets.find((a) => a.id === selectedAssetId)
        : effectiveAssetNo && !isUnmappedAsset
          ? allAssets.find((a) => (a.assetNo || '').toUpperCase() === effectiveAssetNo.toUpperCase())
          : undefined;

      await completeFieldAsTicket(ticket.id, {
        mechanicId: currentUser?.id || ticket.mechanicId || '',
        actionTaken,
        resolutionType,
        billableType,
        billableAmount: billableType === 'BILLABLE' ? Math.max(0, Number(billableAmount) || 0) : 0,
        beforeImage: beforeImages[0] || '',
        afterImage: afterImages[0] || '',
        customerSignature: customerSignature || '', // 🟢 [누락 복구] 서명 데이터 무누락 DB 전달
        customerConfirmName: customerConfirmName || ticket.reporterName || '현장확인자',
        partsUsed,
        inspectionItemCode,
        degradationScore,
        exchangeSuggested: resolutionType === 'REVISIT_NEEDED' && isExchangeNeeded,
        revisitReason: resolutionType === 'REVISIT_NEEDED' ? revisitReason.trim() : undefined,
        revisitDate: resolutionType === 'REVISIT_NEEDED' ? revisitDate : undefined,
        assetId: matchedTargetAsset?.id || selectedAssetId || ticket.assetId,
        assetNo: matchedTargetAsset?.assetNo || effectiveAssetNo || ticket.assetNo,
        modelName: matchedTargetAsset?.modelName || ticket.modelName,
      });
      onBack();
    } catch (err: any) {
      showErrorModal('완료 처리 중 오류가 발생했습니다: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-28 p-4 bg-slate-950 min-h-screen">
      {/* 상단 네비게이션 헤더 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          목록으로
        </button>
        <span className="text-xs font-mono text-slate-400 font-bold">
          티켓 #{ticket.ticketNo || ticket.id.slice(0, 8)}
        </span>
      </div>

      {/* 장비 및 현장 요약 카드 */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-xl bg-blue-500/20 text-blue-400 text-sm font-black font-mono border border-blue-500/30 whitespace-nowrap">
              {ticket.assetNo || '장비번호미상'}
            </span>
            <span className="text-sm font-bold text-white whitespace-nowrap">{ticket.modelName || ''}</span>
            {assetSourcingInfo && (
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-extrabold border whitespace-nowrap ${
                  assetSourcingInfo.ownerType === 'RENTED'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {assetSourcingInfo.ownerLabel}
              </span>
            )}
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 whitespace-nowrap">
            {ticket.status === 'COMPLETED'
              ? '조치완료'
              : ticket.status === 'REVISIT'
                ? `재방문 (${ticket.revisitDate || '일정예약'})`
                : ticket.status === 'SCHEDULED'
                  ? '방문예정'
                  : ticket.status === 'IN_PROGRESS'
                    ? '작업중'
                    : '접수대기'}
          </span>
        </div>

        <div>
          <div className="text-base font-black text-white">{ticket.customerName}</div>
          <div className="text-xs text-slate-300 mt-1 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 font-bold">현장:</span>
              <span className="text-white font-semibold">{ticket.siteName || '현장위치미상'}</span>
              {ticket.locationDetail && (
                <span className="text-slate-400 font-mono text-[11px]">({ticket.locationDetail})</span>
              )}
            </div>
            {(ticket.siteAddress || resolvedAddress) ? (
              <div className="flex items-center justify-between text-sky-300 font-medium bg-sky-950/40 border border-sky-800/40 rounded-lg px-2 py-1">
                <div className="flex items-center gap-1 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <span className="text-[11.5px] truncate">{ticket.siteAddress || resolvedAddress}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(ticket.siteAddress || resolvedAddress)}
                  className="text-[10px] text-sky-400 hover:text-white px-1.5 py-0.5 rounded bg-sky-900/60 flex-shrink-0 ml-1 whitespace-nowrap"
                >
                  복사
                </button>
              </div>
            ) : (
              <div className="text-slate-500 text-[11px]">
                (상세 도로명 주소 미등록)
              </div>
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
          <div className="font-bold text-slate-400 mb-0.5">접수 고장 증상:</div>
          <div>{ticket.issueDescription || ticket.issueCategory || '고장 점검 요청'}</div>
        </div>

        {/* 1-Click 안전 길안내 & 전화 버튼 */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => handleOpenNav(selectedNavApp)}
              className="flex-1 py-3 px-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-md"
              title={`${selectedNavApp === 'TMAP' ? 'T맵' : selectedNavApp === 'KAKAO' ? '카카오내비' : '네이버지도'} 실행`}
            >
              <Navigation className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{selectedNavApp === 'TMAP' ? 'T맵 길안내' : selectedNavApp === 'KAKAO' ? '카카오내비' : '네이버지도'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNavOptions(!showNavOptions)}
              className="px-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-xs flex items-center justify-center active:scale-95"
              title="내비 앱 선택"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCall}
            disabled={!ticket.reporterContact}
            className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
          >
            <Phone className="w-4 h-4 flex-shrink-0" />
            <span>담당자 통화</span>
          </button>
        </div>

        {/* 내비게이션 앱 선택 패널 */}
        {showNavOptions && (
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2 animate-fade-in text-xs">
            <div className="flex items-center justify-between font-bold text-slate-300">
              <span>내비게이션 선택:</span>
              <button type="button" onClick={() => setShowNavOptions(false)} className="text-slate-500 text-[11px]">닫기</button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedNavApp('TMAP');
                  localStorage.setItem('preferred_nav_app', 'TMAP');
                  setShowNavOptions(false);
                  handleOpenNav('TMAP');
                }}
                className={`py-2 px-1 rounded-lg border font-bold text-center ${selectedNavApp === 'TMAP' ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
              >
                🔴 T맵
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedNavApp('KAKAO');
                  localStorage.setItem('preferred_nav_app', 'KAKAO');
                  setShowNavOptions(false);
                  handleOpenNav('KAKAO');
                }}
                className={`py-2 px-1 rounded-lg border font-bold text-center ${selectedNavApp === 'KAKAO' ? 'bg-yellow-600 border-yellow-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
              >
                🟡 카카오
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedNavApp('NAVER');
                  localStorage.setItem('preferred_nav_app', 'NAVER');
                  setShowNavOptions(false);
                  handleOpenNav('NAVER');
                }}
                className={`py-2 px-1 rounded-lg border font-bold text-center ${selectedNavApp === 'NAVER' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
              >
                🟢 네이버
              </button>
            </div>
          </div>
        )}

        {/* 🚐 현장 동선 단계 원클릭 기록 패널 (출발 ➔ 도착 ➔ 작업시작 ➔ 부품수급/재방문 ➔ 다음현장 이동 ➔ 퇴근) */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-white whitespace-nowrap">
              동선 단계 기록
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(ticket.revisitDate || routeSummary?.revisitScheduledFor) && (
                <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/35 text-[11px] font-extrabold whitespace-nowrap">
                  재방문예정 {ticket.revisitDate || routeSummary?.revisitScheduledFor}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-extrabold whitespace-nowrap">
                {routeSummary?.currentStageLabel || '출동 대기'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={!!routeStepLoading}
              onClick={() => handleRecordRouteStep('DEPART_TO_SITE')}
              className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border transition-all active:scale-95 whitespace-nowrap ${
                routeSummary?.departedAt
                  ? 'bg-blue-600 text-white border-blue-400 shadow'
                  : 'bg-blue-950/40 text-blue-300 border-blue-500/40'
              }`}
            >
              {routeSummary?.departedAt
                ? `1. 현장 출발 (${formatTimeHm(routeSummary.departedAt)})`
                : '1. 현장 출발 기록'}
            </button>

            <button
              type="button"
              disabled={!!routeStepLoading}
              onClick={() => handleRecordRouteStep('ARRIVE_AT_SITE')}
              className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border transition-all active:scale-95 whitespace-nowrap ${
                routeSummary?.arrivedAt
                  ? 'bg-sky-600 text-white border-sky-400 shadow'
                  : 'bg-sky-950/40 text-sky-300 border-sky-500/40'
              }`}
            >
              {routeSummary?.arrivedAt
                ? `2. 현장 도착 (${formatTimeHm(routeSummary.arrivedAt)})`
                : '2. 현장 도착 기록'}
            </button>

            <button
              type="button"
              disabled={!!routeStepLoading}
              onClick={() => handleRecordRouteStep('WORK_START')}
              className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border transition-all active:scale-95 whitespace-nowrap ${
                routeSummary?.workStartedAt
                  ? 'bg-amber-600 text-white border-amber-400 shadow'
                  : 'bg-amber-950/40 text-amber-300 border-amber-500/40'
              }`}
            >
              {routeSummary?.workStartedAt
                ? `3. 작업 시작 (${formatTimeHm(routeSummary.workStartedAt)})`
                : '3. 작업 시작 기록'}
            </button>

            <button
              type="button"
              disabled={!!routeStepLoading}
              onClick={() => {
                setShowMoveNextSheet(!showMoveNextSheet);
                setShowPartsSourcingSheet(false);
                setShowQuickRevisitSheet(false);
              }}
              className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border transition-all active:scale-95 whitespace-nowrap ${
                routeSummary?.movedNextAt
                  ? 'bg-purple-600 text-white border-purple-400 shadow'
                  : 'bg-purple-950/40 text-purple-300 border-purple-500/40'
              }`}
            >
              {routeSummary?.movedNextAt
                ? `4. 다음현장 (${formatTimeHm(routeSummary.movedNextAt)})`
                : '4. 다음 현장 이동'}
            </button>
          </div>

          {/* 📦 부품 수급 이동 (당사 주기장/타 차량 or 임차처) & 📅 당일 미완결 재방문 예약 */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800/80">
            <button
              type="button"
              disabled={!!routeStepLoading}
              onClick={handleTogglePartsSourcingSheet}
              className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border transition-all active:scale-95 whitespace-nowrap ${
                routeSummary?.partsSourcingAt
                  ? 'bg-orange-600 text-white border-orange-400 shadow'
                  : 'bg-orange-950/40 text-orange-300 border-orange-500/40'
              }`}
            >
              {routeSummary?.partsSourcingAt
                ? `📦 부품수급 (${formatTimeHm(routeSummary.partsSourcingAt)})`
                : assetSourcingInfo?.ownerType === 'RENTED'
                  ? `📦 부품수급 (임차처)`
                  : '📦 부품수급 (주기장/차량)'}
            </button>

            <button
              type="button"
              disabled={!!routeStepLoading}
              onClick={() => {
                setShowQuickRevisitSheet(!showQuickRevisitSheet);
                setShowPartsSourcingSheet(false);
                setShowMoveNextSheet(false);
              }}
              className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border transition-all active:scale-95 whitespace-nowrap ${
                routeSummary?.revisitScheduledAt || ticket.status === 'REVISIT'
                  ? 'bg-pink-600 text-white border-pink-400 shadow'
                  : 'bg-pink-950/40 text-pink-300 border-pink-500/40'
              }`}
            >
              {ticket.revisitDate || routeSummary?.revisitScheduledFor
                ? `📅 재방문 (${(ticket.revisitDate || routeSummary?.revisitScheduledFor || '').slice(5)})`
                : '📅 재방문 스케줄 예약'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800/80">
            <button
              type="button"
              disabled={!!routeStepLoading}
              onClick={() => handleRecordRouteStep('RETURN_TO_YARD')}
              className="py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold active:scale-95 whitespace-nowrap"
            >
              주기장 복귀 기록
            </button>
            <button
              type="button"
              disabled={!!routeStepLoading}
              onClick={() => handleRecordRouteStep('CLOCK_OUT')}
              className="py-2 px-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/40 text-[11px] font-extrabold active:scale-95 whitespace-nowrap"
            >
              금일 퇴근 기록
            </button>
          </div>

          {/* 부품 수급 이동 인라인 시트 */}
          {showPartsSourcingSheet && assetSourcingInfo && (
            <div className="mt-1 p-3 rounded-xl bg-slate-900 border border-orange-500/45 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-orange-300">
                  부품 수급 이동지 및 필요 부품 기록
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold">
                  {assetSourcingInfo.ownerLabel}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[
                  {
                    type: 'HQ_YARD' as AsPartsSourcingType,
                    title: '당사 주기장',
                    sub: assetSourcingInfo.yardName || '주기장 수령',
                  },
                  {
                    type: 'COLLEAGUE_VAN' as AsPartsSourcingType,
                    title: '타 차량 접선',
                    sub: '동료차량 수령',
                  },
                  {
                    type: 'RENTAL_VENDOR' as AsPartsSourcingType,
                    title: '임차처 방문',
                    sub:
                      assetSourcingInfo.ownerType === 'RENTED'
                        ? assetSourcingInfo.vendorName
                        : '임차처 수령',
                  },
                ].map((opt) => {
                  const active = sourcingType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => handleSelectSourcingTypeInDetail(opt.type)}
                      className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 ${
                        active
                          ? 'bg-orange-600/25 border-orange-400 text-orange-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="text-[11px] font-extrabold whitespace-nowrap">{opt.title}</span>
                      <span className="text-[10px] text-slate-400 truncate">{opt.sub}</span>
                    </button>
                  );
                })}
              </div>

              {sourcingType === 'COLLEAGUE_VAN' && asTeamMechanics.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {asTeamMechanics
                    .filter((m) => m.id !== currentUser?.id)
                    .map((m) => {
                      const label = `${m.name} 차량 접선`;
                      const active = sourcingTargetName === label;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSourcingTargetName(label)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${
                            active
                              ? 'bg-orange-600 text-white border-orange-400'
                              : 'bg-slate-950 text-slate-300 border-slate-700'
                          }`}
                        >
                          🚐 {m.name}
                        </button>
                      );
                    })}
                </div>
              )}

              <input
                type="text"
                value={sourcingTargetName}
                onChange={(e) => setSourcingTargetName(e.target.value)}
                placeholder="수급 이동지 명칭 (예: 당사 주기장, 김기사 차량 접선, OO렌탈)"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              />

              <div className="flex flex-wrap gap-1">
                {AS_COMMON_PART_PRESETS.map((part) => {
                  const active = sourcingPartName.includes(part);
                  return (
                    <button
                      key={part}
                      type="button"
                      onClick={() => {
                        if (!sourcingPartName) {
                          setSourcingPartName(part);
                        } else if (sourcingPartName.includes(part)) {
                          setSourcingPartName(
                            sourcingPartName
                              .split(',')
                              .map((s) => s.trim())
                              .filter((s) => s && s !== part)
                              .join(', ')
                          );
                        } else {
                          setSourcingPartName(`${sourcingPartName}, ${part}`);
                        }
                      }}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold border whitespace-nowrap ${
                        active
                          ? 'bg-orange-600/30 text-orange-200 border-orange-400'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      {part}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={sourcingPartName}
                onChange={(e) => setSourcingPartName(e.target.value)}
                placeholder="수급 필요 부품명"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              />

              <label className="flex items-center gap-2 text-xs font-extrabold text-pink-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sourcingAlsoRevisit}
                  onChange={(e) => setSourcingAlsoRevisit(e.target.checked)}
                />
                <span>당일 미완결 — 타 일자 재방문 일정 동시 등록</span>
              </label>

              {sourcingAlsoRevisit && (
                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-2 gap-1">
                    {quickRevisitOptions.map((opt) => (
                      <button
                        key={opt.date}
                        type="button"
                        onClick={() => setSourcingRevisitDate(opt.date)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border flex items-center justify-between ${
                          sourcingRevisitDate === opt.date
                            ? 'bg-pink-600/30 text-pink-200 border-pink-400'
                            : 'bg-slate-950 text-slate-300 border-slate-700'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className="text-[10px] text-slate-400">{opt.subLabel}</span>
                      </button>
                    ))}
                  </div>
                  <input
                    type="date"
                    value={sourcingRevisitDate}
                    onChange={(e) => setSourcingRevisitDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={sourcingRevisitReason}
                    onChange={(e) => setSourcingRevisitReason(e.target.value)}
                    placeholder="재방문 메모 (예: 부품 수급 후 익일 재방문)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowPartsSourcingSheet(false)}
                  className="py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPartsSourcingInDetail}
                  className="py-2 rounded-lg bg-orange-600 text-white text-xs font-extrabold"
                >
                  {sourcingAlsoRevisit ? '수급이동 + 재방문 저장' : '부품수급 이동 저장'}
                </button>
              </div>
            </div>
          )}

          {/* 당일 미완결 시 빠른 재방문 스케줄 등록 시트 */}
          {showQuickRevisitSheet && (
            <div className="mt-1 p-3 rounded-xl bg-slate-900 border border-pink-500/45 flex flex-col gap-2">
              <div className="text-xs font-extrabold text-pink-300">
                당일 미완결 — 타 일자 재방문 스케줄 빠른 등록
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {quickRevisitOptions.map((opt) => (
                  <button
                    key={opt.date}
                    type="button"
                    onClick={() => setQuickRevisitDate(opt.date)}
                    className={`py-2 px-2 rounded-lg text-xs font-extrabold border flex items-center justify-between ${
                      quickRevisitDate === opt.date
                        ? 'bg-pink-600/30 text-pink-200 border-pink-400'
                        : 'bg-slate-950 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[10px] text-slate-400">{opt.subLabel}</span>
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={quickRevisitDate}
                onChange={(e) => setQuickRevisitDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              />
              <div className="flex flex-wrap gap-1">
                {[
                  '부품 수급 후 재방문',
                  '임차처 부품 입고 대기',
                  '현장 작업시간 종료로 익일 재방문',
                  '교환/타장비 대체 검토',
                ].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setQuickRevisitReason(r)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold border whitespace-nowrap ${
                      quickRevisitReason === r
                        ? 'bg-pink-600/30 text-pink-200 border-pink-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={quickRevisitReason}
                onChange={(e) => setQuickRevisitReason(e.target.value)}
                placeholder="재방문 사유 및 필요 부품 입력"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickRevisitSheet(false)}
                  className="py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleConfirmQuickRevisitInDetail}
                  className="py-2 rounded-lg bg-pink-600 text-white text-xs font-extrabold"
                >
                  재방문 일정 확정
                </button>
              </div>
            </div>
          )}

          {showMoveNextSheet && (
            <div className="mt-1 p-3 rounded-xl bg-slate-900 border border-purple-500/40 flex flex-col gap-2">
              <div className="text-xs font-bold text-purple-300">
                다음 이동 대상 현장AS 선택
              </div>
              <select
                value={selectedNextTicketId}
                onChange={(e) => setSelectedNextTicketId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              >
                <option value="">직접 입력 또는 미지정 이동</option>
                {fieldAsTickets
                  .filter(
                    (t) =>
                      t.id !== ticket.id &&
                      t.status !== 'COMPLETED' &&
                      t.status !== 'CANCELED'
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.assetNo || '장비'}] {t.customerName || '-'} · {t.siteName || '-'}
                    </option>
                  ))}
              </select>
              {!selectedNextTicketId && (
                <input
                  type="text"
                  value={customNextSiteName}
                  onChange={(e) => setCustomNextSiteName(e.target.value)}
                  placeholder="다음 이동지 직접 입력 (선택사항)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowMoveNextSheet(false)}
                  className="py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMoveNextInDetail}
                  className="py-2 rounded-lg bg-purple-600 text-white text-xs font-extrabold"
                >
                  이동 기록 저장
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 조치 내용 입력 섹션 */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3 shadow-lg">
        <label className="text-sm font-bold text-white flex items-center gap-1.5">
          <Wrench className="w-4 h-4 text-blue-400" />
          현장 조치 내용 입력
        </label>

        {/* 빠른 입력 태그 */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TAGS.map((tag, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActionTaken((prev) => (prev ? `${prev}, ${tag}` : tag))}
              className="text-[11px] font-medium py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 transition-transform whitespace-nowrap shrink-0 flex-shrink-0"
            >
              + {tag}
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          value={actionTaken}
          onChange={(e) => setActionTaken(e.target.value)}
          placeholder="조치 내용 입력"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />

        <div className="flex flex-col gap-1.5 mt-2">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap">정비 항목 분류 코드</label>
          <select
            value={inspectionItemCode}
            onChange={(e) => setInspectionItemCode(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">분류 선택</option>
            <option value="CHK-000001">외관/바디</option>
            <option value="CHK-000002">유압/동력</option>
            <option value="CHK-000003">전기/배터리</option>
            <option value="CHK-000004">주행/타이어</option>
            <option value="CHK-000005">기타/접수</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5 mt-2">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap">정비점수 (+)</label>
          <input
            type="number"
            min={0}
            value={degradationScore}
            onChange={(e) => setDegradationScore(parseInt(e.target.value) || 0)}
            placeholder="정비점수"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 조치 종결 유형 3단 세그먼트 */}
        <div className="flex flex-col gap-1.5 mt-2 pt-3 border-t border-slate-800">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap">조치 종결 유형</label>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setResolutionType('REPAIR_DONE')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                resolutionType === 'REPAIR_DONE'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              수리 완료
            </button>
            <button
              type="button"
              onClick={() => setResolutionType('REVISIT_NEEDED')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                resolutionType === 'REVISIT_NEEDED'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              재방문 필요
            </button>
            <button
              type="button"
              onClick={() => setResolutionType('GUIDED_END')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                resolutionType === 'GUIDED_END'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              유선 안내
            </button>
          </div>
        </div>

        {/* 재방문 필요 시 세부 설정 */}
        {resolutionType === 'REVISIT_NEEDED' && (
          <div className="flex flex-col gap-3 p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 animate-in fade-in">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-rose-300">재방문 사유 <span className="text-rose-400">*</span></label>
              <div className="flex flex-wrap gap-1">
                {[
                  '당사 주기장 부품 수급 후 재방문',
                  '타 차량 부품 수령 후 재방문',
                  '임차처 부품 수급 후 재방문',
                  '현장 작업시간 종료로 익일 재방문',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRevisitReason(preset)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold border whitespace-nowrap ${
                      revisitReason === preset
                        ? 'bg-rose-600/30 text-rose-200 border-rose-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={revisitReason}
                onChange={(e) => setRevisitReason(e.target.value)}
                placeholder="예: 특수부품 수급 필요, 모터 소손 공장입고"
                className="w-full bg-slate-950 border border-rose-900/50 rounded-lg p-2 text-xs text-white placeholder-slate-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300">재방문 예정일 (빠른 선택 또는 달력)</label>
              <div className="grid grid-cols-4 gap-1">
                {quickRevisitOptions.map((opt) => (
                  <button
                    key={opt.date}
                    type="button"
                    onClick={() => setRevisitDate(opt.date)}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-extrabold border whitespace-nowrap ${
                      revisitDate === opt.date
                        ? 'bg-rose-600 text-white border-rose-400'
                        : 'bg-slate-950 text-slate-300 border-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={revisitDate}
                onChange={(e) => setRevisitDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              />
            </div>

            {/* 교환 제안 토글 */}
            <label className="flex items-center gap-2 p-2 rounded-lg bg-purple-950/30 border border-purple-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={isExchangeNeeded}
                onChange={(e) => setIsExchangeNeeded(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-purple-300">동급 장비 교환 필요</span>
                <span className="text-[10px] text-slate-400">체크 시 본사 배차실에 단일 교환 배차 연계</span>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* 부품 사용 차감 섹션 (탑차 재고 연동) 및 정비 대상 자산 매핑 */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3 shadow-lg">
        <div className="flex flex-col gap-1.5 pb-2 border-b border-slate-800">
          <label className={`text-xs font-bold ${(!selectedAssetNo || selectedAssetNo === '현장확인' || selectedAssetNo === '관리번호 모름') ? 'text-amber-400' : 'text-slate-300'}`}>
            정비 대상 자산 {!selectedAssetNo || selectedAssetNo === '현장확인' || selectedAssetNo === '관리번호 모름' ? '• 관리번호 모름 장비 지정 필요' : ''}
          </label>
          <select
            value={selectedAssetId}
            onChange={(e) => {
              const selId = e.target.value;
              setSelectedAssetId(selId);
              if (!selId) {
                setSelectedAssetNo('관리번호 모름');
              } else {
                const found = (db.assets || []).find((a) => a.id === selId);
                if (found) setSelectedAssetNo(found.assetNo);
              }
            }}
            className={`w-full bg-slate-950 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none ${
              (!selectedAssetNo || selectedAssetNo === '현장확인' || selectedAssetNo === '관리번호 모름')
                ? 'border-2 border-amber-500/80'
                : 'border border-slate-700'
            }`}
          >
            <option value="">관리번호 모름 / 현장확인</option>
            {siteCandidateAssets.length > 0 && (
              <optgroup label="해당 현장/고객 투입 장비">
                {siteCandidateAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.assetNo} — {a.modelName} [{a.ownerType === 'RENTED' ? '임차' : '자사'}]
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="전체 등록 자산">
              {(db.assets || [])
                .filter((a) => !siteCandidateAssets.some((sa) => sa.id === a.id))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.assetNo} — {a.modelName}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        <label className="text-sm font-bold text-white flex items-center justify-between">
          <span>차량 탑차 부품 사용 차감</span>
          <span className="text-xs text-slate-400 font-normal">사용 부품 {partsUsed.length}건</span>
        </label>

        <div className="flex gap-2">
          <select
            value={selectedStockId}
            onChange={(e) => setSelectedStockId(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">탑차 부품 선택...</option>
            {availableVehicleConsumables.map((item) => {
              const alreadySelected = partsUsed.find((p) => p.consumableId === item.consumableId)?.quantity || 0;
              const remainQty = Math.max(0, item.totalStockQty - alreadySelected);
              return (
                <option key={item.consumableId} value={item.consumableId}>
                  {item.modelName} (보유: {item.totalStockQty}개 / 가용: {remainQty}개)
                </option>
              );
            })}
          </select>
          <input
            type="number"
            min={1}
            value={selectedQty}
            onChange={(e) => setSelectedQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white text-center"
          />
          <button
            type="button"
            onClick={handleAddPart}
            className="p-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {partsUsed.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-2">
            {partsUsed.map((part, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
              >
                <div className="text-white font-medium">
                  {part.modelName} × {part.quantity}개
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePart(idx)}
                  className="p-1 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 수리 전/후 사진 촬영 */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4 shadow-lg">
        <CameraUploader
          label="수리 전(고장) 사진"
          images={beforeImages}
          onChange={setBeforeImages}
          maxImages={2}
        />
        <CameraUploader
          label="수리 완료 사진"
          images={afterImages}
          onChange={setAfterImages}
          maxImages={2}
        />
      </div>

      {/* 💰 유상/무상 수리 비용 청구 구분 */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3 shadow-lg">
        <label className="text-xs font-bold text-slate-300">수리 비용 청구 구분</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBillableType('FREE')}
            className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
              billableType === 'FREE'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            무상 수리 (임대보증)
          </button>
          <button
            type="button"
            onClick={() => setBillableType('BILLABLE')}
            className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
              billableType === 'BILLABLE'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            유상 수리 (사용자과실)
          </button>
        </div>

        {billableType === 'BILLABLE' && (
          <div className="flex flex-col gap-1 pt-1">
            <label className="text-[11px] font-bold text-slate-400">유상 수리 청구 금액 (원)</label>
            <input
              type="number"
              min="0"
              value={billableAmount || ''}
              onChange={(e) => setBillableAmount(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="청구 금액 입력 (예: 150000)"
              className="w-full bg-slate-950 border border-amber-600/50 rounded-xl p-2.5 text-xs text-amber-400 font-mono font-bold"
            />
          </div>
        )}
      </div>

      {/* 고객 서명 섹션 */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customerConfirmName}
            onChange={(e) => setCustomerConfirmName(e.target.value)}
            placeholder="서명자 성함 (예: 홍길동 소장)"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500"
          />
        </div>
        <SignatureCanvas
          label="현장 고객 확인 서명"
          initialSignature={customerSignature}
          onSave={setCustomerSignature}
        />
      </div>

      {/* 최종 완결 버튼 */}
      {/* 액션 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md safe-area-bottom z-30">
        {ticket.status === 'REQUESTED' ? (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleAssign}
            className="w-full py-4 px-6 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-98 text-white font-black text-base flex items-center justify-center gap-2 shadow-2xl shadow-amber-600/50 transition-all"
          >
            <CheckCircle2 className="w-5 h-5" />
            {isSubmitting ? '처리 중...' : '내 업무로 접수하기'}
          </button>
        ) : ticket.mechanicId === currentUser?.id ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCancelAssign}
              className="py-4 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 font-bold text-sm flex items-center justify-center transition-all whitespace-nowrap"
            >
              접수 취소
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleComplete}
              className="flex-1 py-4 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-base flex items-center justify-center gap-2 shadow-2xl shadow-blue-600/50 transition-all"
            >
              <CheckCircle2 className="w-5 h-5" />
              {isSubmitting ? '처리 중...' : 'AS 조치 완료 승인'}
            </button>
          </div>
        ) : (
          <div className="w-full py-4 px-6 rounded-2xl bg-slate-800 text-slate-400 font-bold text-base flex items-center justify-center">
            다른 기사가 접수한 건입니다.
          </div>
        )}
      </div>
    </div>
  );
};
