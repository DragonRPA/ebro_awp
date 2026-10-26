// src/mobile/pages/MobileAsList.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Plus, Wrench, MapPin, User, Phone, Package, AlertTriangle, Clock, Image as ImageIcon, ChevronRight, BookOpen, Navigation, LogIn, LogOut, Home } from 'lucide-react';
import { safePhoneCall, resolveSiteDetailedAddress } from '../../utils/nativeLauncher';
import { getUserDepartmentName } from '../../utils/userDepartmentHelper';
import { Asset, Repair, InboundDefectDetail, AsRouteEventType, AsPartsSourcingType } from '../../services/db';
import { MobileYardRepairModal } from '../components/MobileYardRepairModal';
import {
  getAllUnifiedAsRouteLogs,
  getTicketRouteSummary,
  getTicketAssetSourcingInfo,
  getQuickRevisitDateOptions,
  AS_COMMON_PART_PRESETS,
  getLocalWorkDateStr,
  formatTimeHm,
} from '../../services/asRouteTrackingService';

interface MobileAsListProps {
  onSelectTicket: (ticketId: string) => void;
  onOpenCreate: () => void;
  onOpenManual?: () => void;
  onOpenRouteTracking?: () => void;
  initialMode?: 'FIELD_AS' | 'YARD_REPAIR';
}

export const MobileAsList: React.FC<MobileAsListProps> = ({
  onSelectTicket,
  onOpenCreate,
  onOpenManual,
  onOpenRouteTracking,
  initialMode = 'FIELD_AS',
}) => {
  const { fieldAsTickets, repairs, assets, vendors, users, departments, sites, customers, contracts, contractAssets, currentUser, recordAsRouteEvent, refreshAllData, navigationPayload, setNavigationPayload } = useApp();
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const [moveNextTargetTicket, setMoveNextTargetTicket] = useState<Repair | null>(null);
  const [selectedNextTicketId, setSelectedNextTicketId] = useState<string>('');
  const [customNextSiteName, setCustomNextSiteName] = useState<string>('');

  // 부품 수급 이동 모달 상태
  const [partsSourcingTargetTicket, setPartsSourcingTargetTicket] = useState<Repair | null>(null);
  const [sourcingType, setSourcingType] = useState<AsPartsSourcingType>('HQ_YARD');
  const [sourcingTargetName, setSourcingTargetName] = useState<string>('');
  const [sourcingPartName, setSourcingPartName] = useState<string>('');
  const [sourcingAlsoRevisit, setSourcingAlsoRevisit] = useState<boolean>(false);
  const [sourcingRevisitDate, setSourcingRevisitDate] = useState<string>('');
  const [sourcingRevisitReason, setSourcingRevisitReason] = useState<string>('');

  // 재방문 스케줄 단독 등록 모달 상태
  const [revisitTargetTicket, setRevisitTargetTicket] = useState<Repair | null>(null);
  const [revisitModalDate, setRevisitModalDate] = useState<string>('');
  const [revisitModalReason, setRevisitModalReason] = useState<string>('');

  const asTeamMechanics = useMemo(() => {
    return (users || []).filter(emp => {
      if (emp.status && emp.status !== 'ACTIVE') return false;
      const dept = (getUserDepartmentName(emp, departments) || '').trim().toUpperCase().replace(/\s+/g, '');
      return dept === 'AS팀' || dept === 'A/S팀' || dept.includes('AS팀');
    });
  }, [users, departments]);

  const allRouteLogs = useMemo(() => getAllUnifiedAsRouteLogs(repairs), [repairs]);
  const todayStr = useMemo(() => getLocalWorkDateStr(), []);
  const myTodayLogs = useMemo(() => {
    return allRouteLogs.filter(
      l =>
        l.workDate === todayStr &&
        (l.mechanicId === currentUser?.id || l.mechanicName === currentUser?.name)
    );
  }, [allRouteLogs, todayStr, currentUser?.id, currentUser?.name]);

  const handleOpenPartsSourcing = (e: React.MouseEvent, ticket: Repair) => {
    e.stopPropagation();
    const info = getTicketAssetSourcingInfo(ticket, assets || [], vendors || []);
    const quickDates = getQuickRevisitDateOptions(todayStr);
    setPartsSourcingTargetTicket(ticket);
    setSourcingType(info.defaultSourcingType);
    setSourcingTargetName(info.defaultTargetName);
    setSourcingPartName((ticket.partsUsed || []).map(p => p.modelName).filter(Boolean).join(', '));
    setSourcingAlsoRevisit(false);
    setSourcingRevisitDate(ticket.revisitDate || quickDates[0]?.date || todayStr);
    setSourcingRevisitReason('');
  };

  const handleSelectSourcingType = (type: AsPartsSourcingType, ticket: Repair) => {
    const info = getTicketAssetSourcingInfo(ticket, assets || [], vendors || []);
    setSourcingType(type);
    if (type === 'HQ_YARD') {
      setSourcingTargetName(info.yardName || '당사 주기장');
    } else if (type === 'RENTAL_VENDOR') {
      setSourcingTargetName(info.vendorName || '임차처 부품수급');
    } else if (type === 'COLLEAGUE_VAN') {
      const colleague = asTeamMechanics.find(m => m.id !== currentUser?.id);
      setSourcingTargetName(colleague ? `${colleague.name} 차량 접선` : '타 차량 접선');
    }
  };

  const handleConfirmPartsSourcing = async () => {
    if (!partsSourcingTargetTicket) return;
    setRecordingKey(`PARTS_SOURCING-${partsSourcingTargetTicket.id}`);
    try {
      await recordAsRouteEvent({
        eventType: 'PARTS_SOURCING',
        ticketId: partsSourcingTargetTicket.id,
        sourcingType,
        sourcingTargetName: sourcingTargetName.trim() || undefined,
        partName: sourcingPartName.trim() || undefined,
        revisitDate: sourcingAlsoRevisit && sourcingRevisitDate ? sourcingRevisitDate : undefined,
        memo:
          sourcingAlsoRevisit && sourcingRevisitReason.trim()
            ? sourcingRevisitReason.trim()
            : undefined,
      });
      setPartsSourcingTargetTicket(null);
    } finally {
      setRecordingKey(null);
    }
  };

  const handleOpenRevisitSchedule = (e: React.MouseEvent, ticket: Repair) => {
    e.stopPropagation();
    const quickDates = getQuickRevisitDateOptions(todayStr);
    setRevisitTargetTicket(ticket);
    setRevisitModalDate(ticket.revisitDate || quickDates[0]?.date || todayStr);
    setRevisitModalReason(ticket.unresolvedReason || '부품 수급 후 재방문');
  };

  const handleConfirmRevisitSchedule = async () => {
    if (!revisitTargetTicket || !revisitModalDate) return;
    setRecordingKey(`REVISIT-${revisitTargetTicket.id}`);
    try {
      await recordAsRouteEvent({
        eventType: 'REVISIT_SCHEDULED',
        ticketId: revisitTargetTicket.id,
        revisitDate: revisitModalDate,
        memo: revisitModalReason.trim() || '재방문 예정',
      });
      setRevisitTargetTicket(null);
    } finally {
      setRecordingKey(null);
    }
  };

  const handleQuickRouteStep = async (
    e: React.MouseEvent,
    eventType: AsRouteEventType,
    ticket?: Repair | null
  ) => {
    e.stopPropagation();
    const key = `${eventType}-${ticket?.id || 'DUTY'}`;
    if (recordingKey) return;
    setRecordingKey(key);
    try {
      await recordAsRouteEvent({
        eventType,
        ticketId: ticket?.id,
      });
    } finally {
      setRecordingKey(null);
    }
  };

  const handleConfirmMoveNext = async () => {
    if (!moveNextTargetTicket) return;
    setRecordingKey(`MOVE_NEXT-${moveNextTargetTicket.id}`);
    try {
      await recordAsRouteEvent({
        eventType: 'MOVE_NEXT_SITE',
        ticketId: moveNextTargetTicket.id,
        nextTicketId: selectedNextTicketId || undefined,
        nextSiteCustomName: customNextSiteName.trim() || undefined,
      });
      setMoveNextTargetTicket(null);
      setSelectedNextTicketId('');
      setCustomNextSiteName('');
    } finally {
      setRecordingKey(null);
    }
  };
  
  // ── 상단 탭 모드: 'FIELD_AS' (현장 출동) vs 'YARD_REPAIR' (주기장 정비) ──
  const [activeMode, setActiveMode] = useState<'FIELD_AS' | 'YARD_REPAIR'>(initialMode);

  // 공통 검색어
  const [searchTerm, setSearchTerm] = useState('');

  // 현장 AS 상태 필터
  const [fieldStatusFilter, setFieldStatusFilter] = useState<'ALL' | 'UNRESOLVED' | 'COMPLETED'>('UNRESOLVED');

  // 주기장 정비 상태 필터: 'ALL' | 'INBOUND_DEFECT' | 'REPAIRING' | 'UNRESOLVED'
  const [yardFilter, setYardFilter] = useState<'ALL' | 'INBOUND_DEFECT' | 'REPAIRING' | 'UNRESOLVED'>('ALL');

  // 주기장 정비 모달 상태
  const [selectedYardAsset, setSelectedYardAsset] = useState<Asset | null>(null);
  const [selectedYardRepair, setSelectedYardRepair] = useState<Repair | null>(null);
  const [isYardModalOpen, setIsYardModalOpen] = useState(false);

  // 대시보드 [처리 이동] 딥링크 자동 선택 연동
  useEffect(() => {
    if (!navigationPayload) return;
    const { ticketId, repairId, assetId, entityId, taskCategory } = navigationPayload;
    const targetTicketId = ticketId || entityId || '';
    const targetRepairId = repairId || entityId || '';

    // 1. 현장 AS 티켓 매칭
    if (targetTicketId && (fieldAsTickets || []).length > 0) {
      const matchedTicket = fieldAsTickets.find(tk => tk.id === targetTicketId || tk.ticketNo === targetTicketId);
      if (matchedTicket) {
        setActiveMode('FIELD_AS');
        setFieldStatusFilter('ALL');
        setSearchTerm('');
        onSelectTicket(matchedTicket.id);
        if (setNavigationPayload) setNavigationPayload(null);
        return;
      }
    }

    // 2. 주기장 입고 정비 자산/수리 매칭
    const matchedRepair = targetRepairId ? (repairs || []).find(r => r.id === targetRepairId) : undefined;
    const resolvedAssetId = matchedRepair?.assetId || assetId || entityId || '';
    const matchedAsset = resolvedAssetId ? (assets || []).find(a => a.id === resolvedAssetId || a.assetNo === resolvedAssetId) : undefined;

    if (matchedAsset || matchedRepair || taskCategory === 'INBOUND_REPAIR_DEFECT') {
      setActiveMode('YARD_REPAIR');
      setYardFilter('ALL');
      setSearchTerm('');
      if (matchedAsset) {
        const pendingOutbound = (repairs || []).find(r => r.assetId === matchedAsset.id && r.status === 'PENDING' && r.source === 'OUTBOUND_DEFECT');
        const pendingInbound = (repairs || []).find(r => r.assetId === matchedAsset.id && r.status === 'PENDING' && r.source === 'INBOUND_INSPECTION');
        const unresolvedRepair = (repairs || []).find(r => r.assetId === matchedAsset.id && r.status === 'UNRESOLVED');
        const generalPending = (repairs || []).find(r => r.assetId === matchedAsset.id && (r.status === 'PENDING' || r.status === 'IN_PROGRESS'));
        setSelectedYardAsset(matchedAsset);
        setSelectedYardRepair(matchedRepair || pendingOutbound || pendingInbound || unresolvedRepair || generalPending || null);
        setIsYardModalOpen(true);
      }
      if (setNavigationPayload) setNavigationPayload(null);
    }
  }, [navigationPayload, fieldAsTickets, repairs, assets]);

  // 1. 주기장 정비 대상 자산 집계
  const yardAssets = useMemo(() => {
    return (assets || []).filter(a => {
      if (a.status === 'RENTED' || a.status === 'SOLD' || a.status === 'ASSIGNED') return false;
      const hasOutboundDefect = (repairs || []).some(r => r.assetId === a.id && r.status === 'PENDING' && r.source === 'OUTBOUND_DEFECT');
      const hasInboundDefect = (repairs || []).some(r => r.assetId === a.id && r.status === 'PENDING' && r.source === 'INBOUND_INSPECTION');
      const isRepairing = a.status === 'REPAIRING';
      const isReturned = a.status === 'RENTED_RETURNED';
      const isUnresolved = (repairs || []).some(r => r.assetId === a.id && r.status === 'UNRESOLVED');
      return hasOutboundDefect || hasInboundDefect || isRepairing || isReturned || isUnresolved;
    });
  }, [assets, repairs]);

  // 입출고 결함 자산 건수
  const inboundDefectCount = useMemo(() => {
    return (assets || []).filter(a => 
      (repairs || []).some(r => r.assetId === a.id && r.status === 'PENDING' && (r.source === 'INBOUND_INSPECTION' || r.source === 'OUTBOUND_DEFECT'))
    ).length;
  }, [assets, repairs]);

  // 주기장 필터링된 자산 목록
  const filteredYardAssets = useMemo(() => {
    return yardAssets.filter(asset => {
      const pendingOutbound = (repairs || []).find(r => r.assetId === asset.id && r.status === 'PENDING' && r.source === 'OUTBOUND_DEFECT');
      const pendingInbound = (repairs || []).find(r => r.assetId === asset.id && r.status === 'PENDING' && r.source === 'INBOUND_INSPECTION');
      const unresolvedRepair = (repairs || []).find(r => r.assetId === asset.id && r.status === 'UNRESOLVED');

      if (yardFilter === 'INBOUND_DEFECT' && !pendingInbound && !pendingOutbound) return false;
      if (yardFilter === 'REPAIRING' && asset.status !== 'REPAIRING') return false;
      if (yardFilter === 'UNRESOLVED' && !unresolvedRepair) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchAsset = (asset.assetNo || '').toLowerCase().includes(q);
        const matchModel = (asset.modelName || '').toLowerCase().includes(q);
        const matchNote = (asset.note || '').toLowerCase().includes(q);
        const matchMemo = (asset.memo || '').toLowerCase().includes(q);
        const matchInbound = pendingInbound?.inboundNo ? pendingInbound.inboundNo.toLowerCase().includes(q) : false;
        const matchDetails = pendingInbound?.details ? pendingInbound.details.toLowerCase().includes(q) : false;
        const matchOutbound = pendingOutbound?.details ? pendingOutbound.details.toLowerCase().includes(q) : false;
        if (!matchAsset && !matchModel && !matchNote && !matchMemo && !matchInbound && !matchDetails && !matchOutbound) return false;
      }

      return true;
    });
  }, [yardAssets, yardFilter, searchTerm, repairs]);

  // 현장 AS 필터링된 티켓 목록
  const filteredFieldTickets = useMemo(() => {
    return fieldAsTickets.filter((ticket) => {
      if (fieldStatusFilter === 'UNRESOLVED') {
        if (ticket.status === 'COMPLETED' || ticket.status === 'CANCELED') return false;
      } else if (fieldStatusFilter === 'COMPLETED') {
        if (ticket.status !== 'COMPLETED') return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchAsset = (ticket.assetNo || '').toLowerCase().includes(q);
        const matchCustomer = (ticket.customerName || '').toLowerCase().includes(q);
        const matchSite = (ticket.siteName || '').toLowerCase().includes(q);
        const matchIssue = (ticket.issueDescription || '').toLowerCase().includes(q);
        const matchMechanic = (ticket.mechanicName || '').toLowerCase().includes(q);
        const matchAddress = (ticket.siteAddress || '').toLowerCase().includes(q);
        const matchReporter = (ticket.reporterName || '').toLowerCase().includes(q);
        if (!matchAsset && !matchCustomer && !matchSite && !matchIssue && !matchMechanic && !matchAddress && !matchReporter) return false;
      }

      return true;
    });
  }, [fieldAsTickets, fieldStatusFilter, searchTerm]);

  // 주기장 정비 모달 열기 핸들러
  const handleOpenYardRepair = (asset: Asset) => {
    const pendingOutbound = (repairs || []).find(r => r.assetId === asset.id && r.status === 'PENDING' && r.source === 'OUTBOUND_DEFECT');
    const pendingInbound = (repairs || []).find(r => r.assetId === asset.id && r.status === 'PENDING' && r.source === 'INBOUND_INSPECTION');
    const unresolvedRepair = (repairs || []).find(r => r.assetId === asset.id && r.status === 'UNRESOLVED');
    const generalPending = (repairs || []).find(r => r.assetId === asset.id && (r.status === 'PENDING' || r.status === 'IN_PROGRESS'));

    setSelectedYardAsset(asset);
    setSelectedYardRepair(pendingOutbound || pendingInbound || unresolvedRepair || generalPending || null);
    setIsYardModalOpen(true);
  };

  const handleYardRepairCompleted = () => {
    setIsYardModalOpen(false);
    setSelectedYardAsset(null);
    setSelectedYardRepair(null);
    refreshAllData();
  };

  return (
    <div className="flex flex-col gap-3 pb-24 p-4 font-sans text-slate-100">
      {/* ── 상단 2대 탭 전환: [현장 AS 출동] vs [주기장 입고정비] ── */}
      <div className="flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800 gap-1 shadow-md">
        <button
          type="button"
          onClick={() => {
            setActiveMode('FIELD_AS');
            setSearchTerm('');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
            activeMode === 'FIELD_AS'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>현장 AS 출동 ({fieldAsTickets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode('YARD_REPAIR');
            setSearchTerm('');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
            activeMode === 'YARD_REPAIR'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>주기장 입고정비 ({yardAssets.length})</span>
          {inboundDefectCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#f5f2eb] text-red-600 font-black">
              {inboundDefectCount}
            </span>
          )}
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. 현장 AS 출동 모드 뷰                                      */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeMode === 'FIELD_AS' ? (
        <>
          {/* 상단 타이틀 & 등록 버튼 */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-400" />
              현장 AS 티켓 ({filteredFieldTickets.length})
            </h2>
            <div className="flex items-center gap-2">
              {onOpenManual && (
                <button
                  type="button"
                  onClick={onOpenManual}
                  className="flex items-center gap-1 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs border border-blue-500/30 shadow-md active:scale-95 transition-transform"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>장비 매뉴얼</span>
                </button>
              )}
              <button
                onClick={onOpenCreate}
                className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                신규 접수
              </button>
            </div>
          </div>

          {/* 🚐 금일 내 일과/동선 원클릭 기록 바 (출근 · 주기장복귀 · 퇴근 · 동선조회) */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-2 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-200 whitespace-nowrap">
                <Navigation className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>금일 동선 기록 ({currentUser?.name || '담당기사'})</span>
                {myTodayLogs.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
                    {myTodayLogs[myTodayLogs.length - 1].eventLabel}{' '}
                    {formatTimeHm(myTodayLogs[myTodayLogs.length - 1].recordedAt)}
                  </span>
                )}
              </div>
              {onOpenRouteTracking && (
                <button
                  type="button"
                  onClick={onOpenRouteTracking}
                  className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/40 text-[11px] font-extrabold whitespace-nowrap shrink-0"
                >
                  동선 조회 ➔
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={!!recordingKey}
                onClick={(e) => handleQuickRouteStep(e, 'CLOCK_IN', null)}
                className="py-2 px-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-extrabold flex items-center justify-center gap-1 active:scale-95 transition-all whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>출근</span>
              </button>
              <button
                type="button"
                disabled={!!recordingKey}
                onClick={(e) => handleQuickRouteStep(e, 'RETURN_TO_YARD', null)}
                className="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-extrabold flex items-center justify-center gap-1 active:scale-95 transition-all whitespace-nowrap"
              >
                <Home className="w-3.5 h-3.5" />
                <span>주기장복귀</span>
              </button>
              <button
                type="button"
                disabled={!!recordingKey}
                onClick={(e) => handleQuickRouteStep(e, 'CLOCK_OUT', null)}
                className="py-2 px-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-extrabold flex items-center justify-center gap-1 active:scale-95 transition-all whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>퇴근</span>
              </button>
            </div>
          </div>

          {/* 검색창 */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="장비번호, 고객사, 현장명, 고장증상 검색..."
              className="w-full rounded-2xl py-3 pl-10 pr-4 text-xs placeholder-slate-500 focus:outline-none border"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                borderColor: '#334155',
                colorScheme: 'dark'
              }}
            />
          </div>

          {/* 상태 필터 탭 */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFieldStatusFilter('UNRESOLVED')}
              className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                fieldStatusFilter === 'UNRESOLVED'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              미완료 (출동/대기)
            </button>
            <button
              onClick={() => setFieldStatusFilter('ALL')}
              className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                fieldStatusFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              전체 보기
            </button>
            <button
              onClick={() => setFieldStatusFilter('COMPLETED')}
              className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                fieldStatusFilter === 'COMPLETED'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              조치 완료
            </button>
          </div>

          {/* 티켓 카드 피드 */}
          <div className="flex flex-col gap-2.5">
            {filteredFieldTickets.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
                해당 조건의 AS 티켓이 없습니다.
              </div>
            ) : (
              filteredFieldTickets.map((ticket) => {
                const resolvedAddress = resolveSiteDetailedAddress({
                  siteAddress: ticket.siteAddress,
                  siteId: ticket.siteId,
                  siteName: ticket.siteName,
                  contractId: ticket.contractId,
                  assetNo: ticket.assetNo,
                  assetId: ticket.assetId,
                  customerName: ticket.customerName,
                  locationDetail: ticket.locationDetail,
                  customerSites: sites || [],
                  contracts: contracts || [],
                  contractAssets: contractAssets || [],
                  customers: customers || [],
                });

                const matchedSite = (sites || []).find(
                  (s) => s.id === ticket.siteId || (ticket.siteName && s.name === ticket.siteName)
                );
                const contactName = ticket.reporterName?.trim() || matchedSite?.contactName?.trim() || '';
                const contactPhone = ticket.reporterContact?.trim() || matchedSite?.contact?.trim() || '';

                return (
                  <div
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket.id)}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-98 transition-all cursor-pointer flex flex-col gap-2.5 shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-black font-mono border whitespace-nowrap ${
                            !ticket.assetNo || ticket.assetNo === '관리번호 모름' || ticket.assetNo === '현장확인'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {ticket.assetNo || '관리번호 모름'}
                        </span>
                        {ticket.modelName && ticket.assetNo !== '관리번호 모름' && (
                          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                            {ticket.modelName}
                          </span>
                        )}
                        {(() => {
                          const sInfo = getTicketAssetSourcingInfo(ticket, assets || [], vendors || []);
                          return (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold border whitespace-nowrap ${
                                sInfo.ownerType === 'RENTED'
                                  ? 'bg-orange-500/15 text-orange-300 border-orange-500/35'
                                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                              }`}
                            >
                              {sInfo.ownerLabel}
                            </span>
                          );
                        })()}
                      </div>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold border whitespace-nowrap ${
                          ticket.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : ticket.status === 'REVISIT'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : ticket.status === 'SCHEDULED'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-slate-700 text-slate-300 border-slate-600'
                        }`}
                      >
                        {ticket.status === 'COMPLETED'
                          ? '조치완료'
                          : ticket.status === 'REVISIT'
                          ? `재방문${ticket.revisitDate ? ` (${ticket.revisitDate.slice(5)})` : ''}`
                          : ticket.status === 'SCHEDULED'
                          ? '방문예정'
                          : '접수대기'}
                      </span>
                    </div>

                    <div className="text-sm font-black text-white">
                      {ticket.customerName || '고객사'} {ticket.siteName ? `· ${ticket.siteName}` : ''}
                    </div>

                    <div className="flex items-start gap-1.5 text-xs text-slate-300 bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                      <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">
                        {resolvedAddress || '현장 주소 미등록'}
                        {ticket.locationDetail ? (
                          <span className="text-amber-300 ml-1.5 font-bold">[{ticket.locationDetail}]</span>
                        ) : null}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-bold text-white truncate">
                          {contactName || '현장 담당자 미지정'}
                        </span>
                        {contactPhone && (
                          <span className="text-slate-400 font-mono text-[11px] truncate">
                            ({contactPhone})
                          </span>
                        )}
                      </div>
                      {contactPhone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            safePhoneCall(contactPhone);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95 transition-all shadow-sm"
                        >
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>통화</span>
                        </button>
                      )}
                    </div>

                    <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-slate-500 font-bold mr-1">고장:</span>
                      {ticket.issueDescription || ticket.issueCategory || '고장 점검 요청'}
                    </div>

                    {/* 🚐 원클릭 동선 단계 버튼 바: 출발 ➔ 도착 ➔ 작업시작 ➔ 다음현장 이동 + 부품수급 / 재방문예약 */}
                    {(() => {
                      const routeSum = getTicketRouteSummary(ticket, allRouteLogs, todayStr);
                      const assetSourcing = getTicketAssetSourcingInfo(ticket, assets || [], vendors || []);
                      const revisitDateLabel = ticket.revisitDate || routeSum.revisitScheduledFor;
                      return (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800"
                        >
                          <div className="flex items-center justify-between text-[11px] gap-1 flex-wrap">
                            <span className="font-extrabold text-slate-300 whitespace-nowrap">
                              현장 동선 기록
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {revisitDateLabel && (
                                <span className="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/35 font-extrabold whitespace-nowrap">
                                  재방문예정 {revisitDateLabel}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 font-extrabold whitespace-nowrap">
                                {routeSum.currentStageLabel}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              type="button"
                              disabled={!!recordingKey}
                              onClick={(e) => handleQuickRouteStep(e, 'DEPART_TO_SITE', ticket)}
                              className={`py-2 px-1 rounded-lg text-[11px] font-extrabold border transition-all active:scale-95 whitespace-nowrap ${
                                routeSum.departedAt
                                  ? 'bg-blue-600 text-white border-blue-400 shadow'
                                  : 'bg-blue-950/40 text-blue-300 border-blue-500/40'
                              }`}
                            >
                              {routeSum.departedAt
                                ? `출발 ${formatTimeHm(routeSum.departedAt)}`
                                : '1. 출발'}
                            </button>
                            <button
                              type="button"
                              disabled={!!recordingKey}
                              onClick={(e) => handleQuickRouteStep(e, 'ARRIVE_AT_SITE', ticket)}
                              className={`py-2 px-1 rounded-lg text-[11px] font-extrabold border transition-all active:scale-95 whitespace-nowrap ${
                                routeSum.arrivedAt
                                  ? 'bg-sky-600 text-white border-sky-400 shadow'
                                  : 'bg-sky-950/40 text-sky-300 border-sky-500/40'
                              }`}
                            >
                              {routeSum.arrivedAt
                                ? `도착 ${formatTimeHm(routeSum.arrivedAt)}`
                                : '2. 도착'}
                            </button>
                            <button
                              type="button"
                              disabled={!!recordingKey}
                              onClick={(e) => handleQuickRouteStep(e, 'WORK_START', ticket)}
                              className={`py-2 px-1 rounded-lg text-[11px] font-extrabold border transition-all active:scale-95 whitespace-nowrap ${
                                routeSum.workStartedAt
                                  ? 'bg-amber-600 text-white border-amber-400 shadow'
                                  : 'bg-amber-950/40 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {routeSum.workStartedAt
                                ? `시작 ${formatTimeHm(routeSum.workStartedAt)}`
                                : '3. 작업시작'}
                            </button>
                            <button
                              type="button"
                              disabled={!!recordingKey}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMoveNextTargetTicket(ticket);
                                setSelectedNextTicketId('');
                                setCustomNextSiteName('');
                              }}
                              className={`py-2 px-1 rounded-lg text-[11px] font-extrabold border transition-all active:scale-95 whitespace-nowrap ${
                                routeSum.movedNextAt
                                  ? 'bg-purple-600 text-white border-purple-400 shadow'
                                  : 'bg-purple-950/40 text-purple-300 border-purple-500/40'
                              }`}
                            >
                              {routeSum.movedNextAt
                                ? `이동 ${formatTimeHm(routeSum.movedNextAt)}`
                                : '4. 다음현장'}
                            </button>
                          </div>

                          {/* 2행: 부품수급 이동 (당사주기장/타차량 or 임차처) & 재방문 예약 */}
                          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                            <button
                              type="button"
                              disabled={!!recordingKey}
                              onClick={(e) => handleOpenPartsSourcing(e, ticket)}
                              className={`py-2 px-2 rounded-lg text-[11px] font-extrabold border transition-all active:scale-95 whitespace-nowrap flex items-center justify-center gap-1 ${
                                routeSum.partsSourcingAt
                                  ? 'bg-orange-600 text-white border-orange-400 shadow'
                                  : 'bg-orange-950/40 text-orange-300 border-orange-500/40'
                              }`}
                            >
                              {routeSum.partsSourcingAt
                                ? `📦 부품수급 ${formatTimeHm(routeSum.partsSourcingAt)}`
                                : assetSourcing.ownerType === 'RENTED'
                                  ? `📦 부품수급 (임차처: ${assetSourcing.vendorName})`
                                  : '📦 부품수급 (주기장/차량)'}
                            </button>
                            <button
                              type="button"
                              disabled={!!recordingKey}
                              onClick={(e) => handleOpenRevisitSchedule(e, ticket)}
                              className={`py-2 px-2 rounded-lg text-[11px] font-extrabold border transition-all active:scale-95 whitespace-nowrap flex items-center justify-center gap-1 ${
                                routeSum.revisitScheduledAt || ticket.status === 'REVISIT'
                                  ? 'bg-pink-600 text-white border-pink-400 shadow'
                                  : 'bg-pink-950/40 text-pink-300 border-pink-500/40'
                              }`}
                            >
                              {revisitDateLabel
                                ? `📅 재방문예약 (${revisitDateLabel.slice(5)})`
                                : '📅 재방문 예약 (타일자)'}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                      <span>접수: {ticket.requestDate || ''}</span>
                      <span>담당: {ticket.mechanicName || '미지정'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* ──────────────────────────────────────────────────────────── */
        /* 2. 주기장 입고정비 모드 뷰 (새로 신설된 핵심 스튜디오)      */
        /* ──────────────────────────────────────────────────────────── */
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-red-400" />
              주기장 정비 대상 ({filteredYardAssets.length}대)
            </h2>
            <span className="text-xs text-slate-400 font-bold">
              입고결함 <span className="text-red-400">{inboundDefectCount}대</span>
            </span>
          </div>

          {/* 검색창 */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="자산번호, 모델명, 입고번호 검색..."
              className="w-full rounded-2xl py-3 pl-10 pr-4 text-xs placeholder-slate-500 focus:outline-none border"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                borderColor: '#334155',
                colorScheme: 'dark'
              }}
            />
          </div>

          {/* 필터 칩 */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setYardFilter('ALL')}
              className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                yardFilter === 'ALL'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              전체 ({yardAssets.length})
            </button>
            <button
              onClick={() => setYardFilter('INBOUND_DEFECT')}
              className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                yardFilter === 'INBOUND_DEFECT'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              입고불량 ({inboundDefectCount})
            </button>
            <button
              onClick={() => setYardFilter('REPAIRING')}
              className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                yardFilter === 'REPAIRING'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              정비중
            </button>
            <button
              onClick={() => setYardFilter('UNRESOLVED')}
              className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                yardFilter === 'UNRESOLVED'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              소모품대기
            </button>
          </div>

          {/* 주기장 정비 대상 자산 카드 피드 */}
          <div className="flex flex-col gap-2.5">
            {filteredYardAssets.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
                정비가 필요한 주기장 자산이 없습니다.
              </div>
            ) : (
              filteredYardAssets.map((asset) => {
                const pendingOutbound = (repairs || []).find(r => r.assetId === asset.id && r.status === 'PENDING' && r.source === 'OUTBOUND_DEFECT');
                const pendingInbound = (repairs || []).find(r => r.assetId === asset.id && r.status === 'PENDING' && r.source === 'INBOUND_INSPECTION');
                const unresolvedRepair = (repairs || []).find(r => r.assetId === asset.id && r.status === 'UNRESOLVED');

                let defectList: InboundDefectDetail[] = [];
                if (pendingInbound?.defectsJson) {
                  try {
                    const parsed = JSON.parse(pendingInbound.defectsJson);
                    if (Array.isArray(parsed)) defectList = parsed;
                  } catch (e) {}
                }

                return (
                  <div
                    key={asset.id}
                    onClick={() => handleOpenYardRepair(asset)}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-red-500/50 active:scale-98 transition-all cursor-pointer flex flex-col gap-2.5 shadow-md"
                  >
                    {/* 상단 장비 및 상태 뱃지 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-black font-mono border border-red-500/30">
                          {asset.assetNo}
                        </span>
                        <span className="text-xs text-white font-bold">{asset.modelName}</span>
                        <span className="text-[10px] text-slate-400">
                          {asset.ownerType === 'RENTED' ? '타사임차' : '자사보유'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {pendingOutbound ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            ⚡ 출고불량
                          </span>
                        ) : pendingInbound ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            🚨 입고결함
                          </span>
                        ) : unresolvedRepair ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            ⏸️ 소모품대기
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {asset.status === 'REPAIRING' ? '정비중' : '입고검수'}
                          </span>
                        )}

                        {(asset.maintenanceScore || 0) > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-black bg-red-900/60 text-red-200 border border-red-700">
                            +{asset.maintenanceScore}점
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 출고 불량 교체 사유 */}
                    {pendingOutbound && (
                      <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-[11px] text-red-300 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          출고 불량 교체 건
                        </span>
                        <span className="text-[11px] text-red-200">
                          {pendingOutbound.issueDescription || pendingOutbound.details}
                        </span>
                      </div>
                    )}

                    {/* 입고 결함 항목 배지들 */}
                    {defectList.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-500/20 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px] text-red-300 font-bold">
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                            적발 결함 ({defectList.length}건)
                          </span>
                          {pendingInbound?.inboundNo && (
                            <span className="font-mono text-[10px] text-slate-400">{pendingInbound.inboundNo}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {defectList.map((d, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-red-500/30 text-white">
                              {d.checkitemName} <strong className="text-red-400">+{d.score}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 부품 대기 사유 노출 */}
                    {unresolvedRepair?.unresolvedReason && (
                      <div className="text-xs text-amber-300 bg-amber-950/30 p-2 rounded-xl border border-amber-500/30 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>보류사유: {unresolvedRepair.unresolvedReason}</span>
                      </div>
                    )}

                    {/* 하단 터치 가이드 바 */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span className="truncate max-w-[200px]">
                        {asset.note && !asset.note.startsWith('[정비완료') ? `정비요구: ${asset.note}` : asset.memo ? `비고: ${asset.memo}` : '정상 대기'}
                      </span>
                      <span className="text-red-400 font-bold flex items-center gap-0.5 shrink-0">
                        주기장 정비입력 열기 <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* 🛠️ 모바일 주기장 정비 전용 모달 */}
      <MobileYardRepairModal
        isOpen={isYardModalOpen}
        asset={selectedYardAsset}
        pendingRepair={selectedYardRepair}
        onClose={() => setIsYardModalOpen(false)}
        onCompleted={handleYardRepairCompleted}
      />

      {/* 🚐 다음 현장 이동 원클릭 선택 모달 */}
      {moveNextTargetTicket && (
        <div
          onClick={() => setMoveNextTargetTicket(null)}
          className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3 text-white shadow-2xl"
          >
            <div className="text-sm font-black">다음 현장 이동 기록</div>
            <div className="text-xs text-slate-400">
              현재 현장:{' '}
              <strong className="text-white">
                {moveNextTargetTicket.siteName || moveNextTargetTicket.customerName}
              </strong>{' '}
              ({moveNextTargetTicket.assetNo || '-'})
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-300">
                다음 이동할 현장AS 선택 (선택 시 다음 현장 출발 동시 기록)
              </label>
              <select
                value={selectedNextTicketId}
                onChange={(e) => setSelectedNextTicketId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              >
                <option value="">직접 입력 또는 미지정 이동</option>
                {fieldAsTickets
                  .filter(
                    (t) =>
                      t.id !== moveNextTargetTicket.id &&
                      t.status !== 'COMPLETED' &&
                      t.status !== 'CANCELED'
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.assetNo || '장비'}] {t.customerName || '-'} · {t.siteName || '-'} ({t.modelName || '-'})
                    </option>
                  ))}
              </select>
            </div>

            {!selectedNextTicketId && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-300">다음 이동지 직접 입력</label>
                <input
                  type="text"
                  value={customNextSiteName}
                  onChange={(e) => setCustomNextSiteName(e.target.value)}
                  placeholder="예: 삼성 평택현장, 본사 주기장 등"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMoveNextTargetTicket(null)}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmMoveNext}
                className="py-2.5 rounded-xl bg-purple-600 text-white text-xs font-extrabold"
              >
                다음 현장 이동 기록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📦 부품 수급 이동 (당사 주기장 / 타 차량 접선 / 임차처 방문) 원클릭 바텀시트 */}
      {partsSourcingTargetTicket && (() => {
        const sInfo = getTicketAssetSourcingInfo(
          partsSourcingTargetTicket,
          assets || [],
          vendors || []
        );
        const quickDates = getQuickRevisitDateOptions(todayStr);
        return (
          <div
            onClick={() => setPartsSourcingTargetTicket(null)}
            className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-3"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[88vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black text-orange-400">부품 수급 이동 기록</div>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-extrabold border whitespace-nowrap ${
                    sInfo.ownerType === 'RENTED'
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {sInfo.ownerLabel}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex flex-col gap-0.5">
                <div className="font-bold text-white">
                  {partsSourcingTargetTicket.customerName || '-'} · {partsSourcingTargetTicket.siteName || '현장'}
                </div>
                <div className="text-slate-400 text-[11px]">
                  장비: {partsSourcingTargetTicket.assetNo || '현장확인'} ({partsSourcingTargetTicket.modelName || '-'})
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-300">
                  1. 수급 이동지 선택 ({sInfo.ownerType === 'RENTED' ? '임차자산 → 임차처 자동 매칭' : '당사자산 → 주기장/타차량'})
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    {
                      type: 'HQ_YARD' as AsPartsSourcingType,
                      title: '당사 주기장',
                      sub: sInfo.yardName || '주기장 수령',
                    },
                    {
                      type: 'COLLEAGUE_VAN' as AsPartsSourcingType,
                      title: '타 차량 접선',
                      sub: '동료차량 수령',
                    },
                    {
                      type: 'RENTAL_VENDOR' as AsPartsSourcingType,
                      title: '임차처 방문',
                      sub: sInfo.ownerType === 'RENTED' ? sInfo.vendorName : '임차처 수령',
                    },
                  ].map((opt) => {
                    const active = sourcingType === opt.type;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => handleSelectSourcingType(opt.type, partsSourcingTargetTicket)}
                        className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition-all ${
                          active
                            ? 'bg-orange-600/25 border-orange-400 text-orange-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <span className="text-xs font-extrabold whitespace-nowrap">{opt.title}</span>
                        <span className="text-[10px] text-slate-400 truncate">{opt.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {sourcingType === 'COLLEAGUE_VAN' && asTeamMechanics.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-300">접선할 동료 AS차량 선택</label>
                  <div className="flex flex-wrap gap-1.5">
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
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold border whitespace-nowrap ${
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
                </div>
              )}

              {sourcingType === 'RENTAL_VENDOR' && (vendors || []).length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-300">임차처 선택</label>
                  <select
                    value={sourcingTargetName}
                    onChange={(e) => setSourcingTargetName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white"
                  >
                    {sInfo.vendorName && (
                      <option value={sInfo.vendorName}>
                        {sInfo.vendorName} (해당 장비 임차처)
                      </option>
                    )}
                    {(vendors || []).map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-300">수급 이동지 명칭</label>
                <input
                  type="text"
                  value={sourcingTargetName}
                  onChange={(e) => setSourcingTargetName(e.target.value)}
                  placeholder="예: 당사 주기장, 김기사 차량 접선, OO렌탈"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-300">
                  2. 수급 필요 부품 (터치 선택 또는 입력)
                </label>
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
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${
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
                  placeholder="수급 부품명 직접 입력"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white mt-1"
                />
              </div>

              {/* 당일 미완결 시 재방문 스케줄 동시 등록 */}
              <div
                className={`p-2.5 rounded-xl border flex flex-col gap-2 ${
                  sourcingAlsoRevisit
                    ? 'bg-pink-950/30 border-pink-500/40'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <label className="flex items-center gap-2 text-xs font-extrabold text-pink-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sourcingAlsoRevisit}
                    onChange={(e) => setSourcingAlsoRevisit(e.target.checked)}
                  />
                  <span>당일 미완결 — 다른 날짜 재방문 스케줄 함께 등록</span>
                </label>

                {sourcingAlsoRevisit && (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      {quickDates.map((opt) => {
                        const active = sourcingRevisitDate === opt.date;
                        return (
                          <button
                            key={opt.date}
                            type="button"
                            onClick={() => setSourcingRevisitDate(opt.date)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-extrabold border flex items-center justify-between ${
                              active
                                ? 'bg-pink-600/30 text-pink-200 border-pink-400'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            <span>{opt.label}</span>
                            <span className="text-[10px] text-slate-400">{opt.subLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="date"
                      value={sourcingRevisitDate}
                      onChange={(e) => setSourcingRevisitDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={sourcingRevisitReason}
                      onChange={(e) => setSourcingRevisitReason(e.target.value)}
                      placeholder="재방문 메모 (예: 부품 수령 후 익일 오전 재방문)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPartsSourcingTargetTicket(null)}
                  className="py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPartsSourcing}
                  className="py-2.5 rounded-xl bg-orange-600 text-white text-xs font-extrabold"
                >
                  {sourcingAlsoRevisit ? '수급이동 + 재방문 기록' : '부품수급 이동 기록'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 📅 당일 미완결 시 다음날/타일자 재방문 스케줄 원클릭 등록 바텀시트 */}
      {revisitTargetTicket && (() => {
        const quickDates = getQuickRevisitDateOptions(todayStr);
        const reasonPresets = [
          '부품 수급 후 재방문',
          '임차처 부품 입고 대기 후 재방문',
          '현장 작업시간 종료로 익일 재방문',
          '교환/타장비 대체 검토',
        ];
        return (
          <div
            onClick={() => setRevisitTargetTicket(null)}
            className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-3"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3 text-white shadow-2xl"
            >
              <div className="text-sm font-black text-pink-400">재방문 스케줄 등록</div>
              <div className="text-xs text-slate-400">
                대상 현장:{' '}
                <strong className="text-white">
                  {revisitTargetTicket.customerName || '-'} · {revisitTargetTicket.siteName || '현장'}
                </strong>{' '}
                ({revisitTargetTicket.assetNo || '-'})
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-300">재방문 예정일 빠른 선택</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {quickDates.map((opt) => {
                    const active = revisitModalDate === opt.date;
                    return (
                      <button
                        key={opt.date}
                        type="button"
                        onClick={() => setRevisitModalDate(opt.date)}
                        className={`p-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-between ${
                          active
                            ? 'bg-pink-600/30 border-pink-400 text-pink-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className="text-[11px] text-slate-400">{opt.subLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-300">달력에서 날짜 직접 선택</label>
                <input
                  type="date"
                  value={revisitModalDate}
                  onChange={(e) => setRevisitModalDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-300">재방문 사유</label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {reasonPresets.map((r) => {
                    const active = revisitModalReason === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRevisitModalReason(r)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${
                          active
                            ? 'bg-pink-600/30 text-pink-200 border-pink-400'
                            : 'bg-slate-950 text-slate-300 border-slate-800'
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={revisitModalReason}
                  onChange={(e) => setRevisitModalReason(e.target.value)}
                  placeholder="재방문 사유 및 필요 부품 입력"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRevisitTargetTicket(null)}
                  className="py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevisitSchedule}
                  className="py-2.5 rounded-xl bg-pink-600 text-white text-xs font-extrabold"
                >
                  재방문 일정 확정
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
