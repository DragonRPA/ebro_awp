import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Navigation,
  Clock,
  Wrench,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Download,
  UserCheck,
  MapPin,
  LogOut,
  LogIn,
  Home,
  Search,
  Trash2,
  Calendar,
  Play,
  Flag,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AsRouteEventType, AsPartsSourcingType, AsRouteLog, Repair } from '../services/db';
import {
  AS_ROUTE_EVENT_META,
  AS_PARTS_SOURCING_TYPE_LABELS,
  COMMON_AS_PARTS_PRESETS,
  COMMON_REVISIT_REASON_PRESETS,
  getTicketAssetSourcingInfo,
  getQuickRevisitDateOptions,
  getAllUnifiedAsRouteLogs,
  getTicketRouteSummary,
  getLocalWorkDateStr,
  formatTimeHm,
  pullAsRouteLogsFromRemote,
  deleteAsRouteStep,
} from '../services/asRouteTrackingService';
import { getUserDepartmentName } from '../utils/userDepartmentHelper';

interface AsRouteTrackingPageProps {
  isMobileEmbedded?: boolean;
  onOpenTicketDetail?: (ticketId: string) => void;
}

export const AsRouteTrackingPage: React.FC<AsRouteTrackingPageProps> = ({
  isMobileEmbedded = false,
  onOpenTicketDetail,
}) => {
  const {
    fieldAsTickets,
    repairs,
    assets,
    vendors,
    users,
    departments,
    currentUser,
    recordAsRouteEvent,
    refreshAllData,
  } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalWorkDateStr());
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>('ALL');
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [viewMode, setViewMode] = useState<'TIMELINE' | 'TICKETS' | 'LEDGER'>('TIMELINE');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const [syncVersion, setSyncVersion] = useState<number>(0);

  // 다음 현장 이동 모달 상태
  const [moveNextTargetTicket, setMoveNextTargetTicket] = useState<Repair | null>(null);
  const [selectedNextTicketId, setSelectedNextTicketId] = useState<string>('');
  const [customNextSiteName, setCustomNextSiteName] = useState<string>('');

  // 부품 수급 이동 모달 상태 (당사 주기장 / 타 차량 접선 / 임차처 방문 + 재방문 일정 연동)
  const [partsSourcingTargetTicket, setPartsSourcingTargetTicket] = useState<Repair | null>(null);
  const [sourcingType, setSourcingType] = useState<AsPartsSourcingType>('HQ_YARD');
  const [sourcingTargetName, setSourcingTargetName] = useState<string>('');
  const [sourcingPartName, setSourcingPartName] = useState<string>('');
  const [sourcingMemo, setSourcingMemo] = useState<string>('');
  const [sourcingWithRevisit, setSourcingWithRevisit] = useState<boolean>(false);
  const [sourcingRevisitDate, setSourcingRevisitDate] = useState<string>('');
  const [sourcingMechanicOverride, setSourcingMechanicOverride] = useState<{ id?: string; name?: string }>({});

  // 재방문 스케줄 단독 등록 모달 상태
  const [revisitTargetTicket, setRevisitTargetTicket] = useState<Repair | null>(null);
  const [revisitDateInput, setRevisitDateInput] = useState<string>('');
  const [revisitReasonInput, setRevisitReasonInput] = useState<string>('');
  const [revisitPartNameInput, setRevisitPartNameInput] = useState<string>('');
  const [revisitMechanicOverride, setRevisitMechanicOverride] = useState<{ id?: string; name?: string }>({});

  const handleSyncRemote = useCallback(async () => {
    setIsSyncing(true);
    try {
      await pullAsRouteLogsFromRemote();
      refreshAllData();
      setSyncVersion(v => v + 1);
    } finally {
      setIsSyncing(false);
    }
  }, [refreshAllData]);

  useEffect(() => {
    handleSyncRemote();
    const timer = setInterval(() => {
      pullAsRouteLogsFromRemote().then(() => setSyncVersion(v => v + 1));
    }, 15000);
    return () => clearInterval(timer);
  }, [handleSyncRemote]);

  // 전체 통합 동선 로그
  const allUnifiedLogs = useMemo(() => {
    void syncVersion;
    return getAllUnifiedAsRouteLogs(repairs);
  }, [repairs, syncVersion]);

  // 선택 일자 동선 로그
  const dateLogs = useMemo(() => {
    return allUnifiedLogs.filter(l => l.workDate === selectedDate);
  }, [allUnifiedLogs, selectedDate]);

  // AS팀 기사 목록 추출 (조직도 기준 실제 AS팀 소속 임직원만 엄격 필터링)
  const asMechanics = useMemo(() => {
    const map = new Map<string, { id: string; name: string; position?: string; deptName?: string }>();

    const isActualAsTeamUser = (u: any): boolean => {
      if (!u || u.status === 'RETIRED') return false;
      if (u.id === 'sys-admin' || u.id === 'u-1' || u.loginId === 'admin' || u.name === '개발자') return false;
      if (u.position === '대표이사' || u.position === '대표' || u.position?.includes('대표')) return false;
      const deptName = getUserDepartmentName(u, departments || []).trim();
      const dId = String(u.departmentId || '').toUpperCase();

      // 외국인(DEPT-0000006), 출고팀, 영업부, 관리부, 본사/경영진은 제외
      if (
        deptName.includes('외국인') ||
        deptName.includes('출고') ||
        deptName.includes('영업') ||
        deptName.includes('관리') ||
        deptName.includes('기연리프트') ||
        dId.includes('0000006') ||
        dId === 'DEPT-6' ||
        dId.includes('0000004') ||
        dId === 'DEPT-4' ||
        dId.includes('0000003') ||
        dId === 'DEPT-3' ||
        dId.includes('0000002') ||
        dId === 'DEPT-2' ||
        dId.includes('0000001') ||
        dId === 'DEPT-1'
      ) {
        return false;
      }

      return (
        dId.includes('0000005') ||
        dId === 'DEPT-5' ||
        deptName.toUpperCase().includes('AS') ||
        deptName.includes('정비')
      );
    };

    (users || []).forEach(u => {
      if (isActualAsTeamUser(u)) {
        const deptName = getUserDepartmentName(u, departments || []).trim();
        map.set(u.id, {
          id: u.id,
          name: u.name,
          position: u.position,
          deptName: deptName || 'AS팀',
        });
      }
    });

    dateLogs.forEach(l => {
      if (l.mechanicId && l.mechanicName && !map.has(l.mechanicId)) {
        const u = (users || []).find(usr => usr.id === l.mechanicId);
        if (!u || isActualAsTeamUser(u)) {
          map.set(l.mechanicId, {
            id: l.mechanicId,
            name: u?.name || l.mechanicName,
            position: u?.position,
            deptName: (u && getUserDepartmentName(u, departments || '').trim()) || 'AS팀',
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [users, departments, dateLogs]);

  // 해당 일자 관련 현장AS 티켓 목록 (접수일/방문예정일/완료일이 선택 일자이거나, 해당일 동선 기록이 존재하는 건, 또는 선택일이 오늘일 때 미완료 건)
  const todayStr = useMemo(() => getLocalWorkDateStr(), []);
  const targetTickets = useMemo(() => {
    const ticketIdsInLogs = new Set(dateLogs.map(l => l.repairId).filter(Boolean));
    return (fieldAsTickets || [])
      .filter(t => {
        if (t.status === 'CANCELED') return false;
        const reqMatch = (t.requestDate || '').slice(0, 10) === selectedDate;
        const visitMatch = (t.visitDate || t.scheduleDate || '').slice(0, 10) === selectedDate;
        const revisitMatch = (t.revisitDate || '').slice(0, 10) === selectedDate;
        const compMatch = (t.completedDate || '').slice(0, 10) === selectedDate;
        const logMatch = ticketIdsInLogs.has(t.id);
        const activeTodayMatch =
          selectedDate === todayStr &&
          (t.status === 'REQUESTED' ||
            t.status === 'SCHEDULED' ||
            t.status === 'IN_PROGRESS' ||
            t.status === 'REVISIT');

        if (!(reqMatch || visitMatch || revisitMatch || compMatch || logMatch || activeTodayMatch)) {
          return false;
        }

        if (selectedMechanicId !== 'ALL') {
          const mId = t.mechanicId || t.assignedMechanicId || '';
          const hasMechLog = dateLogs.some(
            l => l.repairId === t.id && (l.mechanicId === selectedMechanicId || l.mechanicName === selectedMechanicId)
          );
          if (mId !== selectedMechanicId && t.mechanicName !== selectedMechanicId && !hasMechLog) {
            return false;
          }
        }

        if (searchKeyword.trim()) {
          const kw = searchKeyword.trim().toLowerCase();
          const hay = [
            t.ticketNo,
            t.id,
            t.customerName,
            t.siteName,
            t.siteAddress,
            t.locationDetail,
            t.assetNo,
            t.modelName,
            t.mechanicName,
            t.issueCategory,
            t.issueDescription,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(kw)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const order: Record<string, number> = {
          IN_PROGRESS: 0,
          SCHEDULED: 1,
          REQUESTED: 2,
          REVISIT: 3,
          COMPLETED: 4,
        };
        const oa = order[a.status] ?? 5;
        const ob = order[b.status] ?? 5;
        if (oa !== ob) return oa - ob;
        return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
      });
  }, [fieldAsTickets, dateLogs, selectedDate, todayStr, selectedMechanicId, searchKeyword]);

  // 필터링된 동선 로그
  const filteredLogs = useMemo(() => {
    return dateLogs.filter(l => {
      if (selectedMechanicId !== 'ALL') {
        if (l.mechanicId !== selectedMechanicId && l.mechanicName !== selectedMechanicId) {
          return false;
        }
      }
      if (selectedEventType !== 'ALL' && l.eventType !== selectedEventType) {
        return false;
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        const hay = [
          l.mechanicName,
          l.eventLabel,
          l.ticketNo,
          l.customerName,
          l.siteName,
          l.siteAddress,
          l.assetNo,
          l.modelName,
          l.nextSiteName,
          l.memo,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [dateLogs, selectedMechanicId, selectedEventType, searchKeyword]);

  // 기사별 일일 동선 그룹핑 및 현재 상태 산출
  const mechanicDailySummaries = useMemo(() => {
    const targetMechs =
      selectedMechanicId === 'ALL'
        ? asMechanics
        : asMechanics.filter(m => m.id === selectedMechanicId || m.name === selectedMechanicId);

    return targetMechs.map(mech => {
      const logs = dateLogs
        .filter(l => l.mechanicId === mech.id || l.mechanicName === mech.name)
        .sort((a, b) => (a.recordedAt || '').localeCompare(b.recordedAt || ''));

      const assignedTickets = targetTickets.filter(
        t =>
          t.mechanicId === mech.id ||
          t.assignedMechanicId === mech.id ||
          t.mechanicName === mech.name ||
          logs.some(l => l.repairId === t.id)
      );

      const clockInLog = logs.find(l => l.eventType === 'CLOCK_IN');
      const clockOutLog = [...logs].reverse().find(l => l.eventType === 'CLOCK_OUT');
      const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

      let liveStateLabel = '기록 전';
      let liveStateColor = '#64748b';
      let liveStateBg = 'rgba(100, 116, 139, 0.14)';
      let currentSiteLabel = '-';

      if (lastLog) {
        const siteStr = lastLog.siteName || lastLog.customerName || '';
        if (lastLog.eventType === 'CLOCK_IN') {
          liveStateLabel = '출근 완료 (대기)';
          liveStateColor = '#10b981';
          liveStateBg = 'rgba(16, 185, 129, 0.14)';
        } else if (lastLog.eventType === 'DEPART_TO_SITE') {
          liveStateLabel = '현장 이동중';
          liveStateColor = '#3b82f6';
          liveStateBg = 'rgba(59, 130, 246, 0.16)';
          currentSiteLabel = siteStr ? `${siteStr} 이동중` : '현장 이동중';
        } else if (lastLog.eventType === 'ARRIVE_AT_SITE') {
          liveStateLabel = '현장 도착';
          liveStateColor = '#0ea5e9';
          liveStateBg = 'rgba(14, 165, 233, 0.16)';
          currentSiteLabel = siteStr || '현장 도착';
        } else if (lastLog.eventType === 'WORK_START') {
          liveStateLabel = '현장 작업중';
          liveStateColor = '#f59e0b';
          liveStateBg = 'rgba(245, 158, 11, 0.16)';
          currentSiteLabel = siteStr ? `${siteStr} (${lastLog.modelName || lastLog.assetNo || '장비'})` : '작업중';
        } else if (lastLog.eventType === 'PARTS_SOURCING') {
          liveStateLabel = '부품 수급 이동중';
          liveStateColor = '#06b6d4';
          liveStateBg = 'rgba(6, 182, 212, 0.16)';
          const targetDest = lastLog.sourcingTargetName || lastLog.nextSiteName || '부품수급처';
          currentSiteLabel = siteStr ? `${siteStr} ➔ ${targetDest}` : targetDest;
        } else if (lastLog.eventType === 'REVISIT_SCHEDULED') {
          liveStateLabel = '재방문 예약 완료';
          liveStateColor = '#fb7185';
          liveStateBg = 'rgba(244, 63, 94, 0.16)';
          currentSiteLabel = siteStr
            ? `${siteStr} (재방문: ${lastLog.revisitDate || '-'})`
            : `재방문 예정 (${lastLog.revisitDate || '-'})`;
        } else if (lastLog.eventType === 'WORK_COMPLETE') {
          liveStateLabel = '작업 완료';
          liveStateColor = '#22c55e';
          liveStateBg = 'rgba(34, 197, 94, 0.16)';
          currentSiteLabel = siteStr ? `${siteStr} 완료` : '작업 완료';
        } else if (lastLog.eventType === 'MOVE_NEXT_SITE') {
          liveStateLabel = '다음 현장 이동중';
          liveStateColor = '#8b5cf6';
          liveStateBg = 'rgba(139, 92, 246, 0.16)';
          currentSiteLabel = lastLog.nextSiteName
            ? `${siteStr || '이전 현장'} ➔ ${lastLog.nextSiteName}`
            : '다음 현장 이동중';
        } else if (lastLog.eventType === 'RETURN_TO_YARD') {
          liveStateLabel = '주기장 복귀';
          liveStateColor = '#94a3b8';
          liveStateBg = 'rgba(148, 163, 184, 0.16)';
          currentSiteLabel = '본사 주기장';
        } else if (lastLog.eventType === 'CLOCK_OUT') {
          liveStateLabel = '퇴근 완료';
          liveStateColor = '#f43f5e';
          liveStateBg = 'rgba(244, 63, 94, 0.15)';
          currentSiteLabel = `퇴근 (${formatTimeHm(lastLog.recordedAt)})`;
        }
      }

      const travelMins = logs
        .filter(l => l.eventType === 'ARRIVE_AT_SITE' && l.durationMinutes)
        .reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);

      const workMins = logs
        .filter(
          l =>
            (l.eventType === 'WORK_COMPLETE' || l.eventType === 'MOVE_NEXT_SITE') &&
            l.durationMinutes
        )
        .reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);

      const visitedSitesCount = new Set(
        logs
          .filter(l => l.repairId || l.siteName)
          .map(l => l.repairId || l.siteName)
      ).size;

      const completedCount = logs.filter(l => l.eventType === 'WORK_COMPLETE').length;

      return {
        mechanic: mech,
        logs,
        assignedTickets,
        clockInTime: clockInLog ? formatTimeHm(clockInLog.recordedAt) : (logs[0] ? formatTimeHm(logs[0].recordedAt) : '-'),
        clockOutTime: clockOutLog ? formatTimeHm(clockOutLog.recordedAt) : '-',
        liveStateLabel,
        liveStateColor,
        liveStateBg,
        currentSiteLabel,
        travelMins,
        workMins,
        visitedSitesCount,
        completedCount,
      };
    });
  }, [asMechanics, selectedMechanicId, dateLogs, targetTickets]);

  // 상단 KPI 요약 지표
  const kpiStats = useMemo(() => {
    const activeMechanicsCount = mechanicDailySummaries.filter(m => m.logs.length > 0).length;
    const movingCount = mechanicDailySummaries.filter(
      m => m.liveStateLabel === '현장 이동중' || m.liveStateLabel === '다음 현장 이동중'
    ).length;
    const workingCount = mechanicDailySummaries.filter(
      m => m.liveStateLabel === '현장 작업중' || m.liveStateLabel === '현장 도착'
    ).length;
    const completedLogs = dateLogs.filter(l => l.eventType === 'WORK_COMPLETE');
    const arriveLogsWithDur = dateLogs.filter(
      l => l.eventType === 'ARRIVE_AT_SITE' && typeof l.durationMinutes === 'number'
    );
    const workLogsWithDur = dateLogs.filter(
      l => l.eventType === 'WORK_COMPLETE' && typeof l.durationMinutes === 'number'
    );
    const avgTravelMin =
      arriveLogsWithDur.length > 0
        ? Math.round(
            arriveLogsWithDur.reduce((s, c) => s + (c.durationMinutes || 0), 0) /
              arriveLogsWithDur.length
          )
        : 0;
    const avgWorkMin =
      workLogsWithDur.length > 0
        ? Math.round(
            workLogsWithDur.reduce((s, c) => s + (c.durationMinutes || 0), 0) /
              workLogsWithDur.length
          )
        : 0;
    const clockedOutCount = mechanicDailySummaries.filter(m => m.liveStateLabel === '퇴근 완료').length;

    return {
      activeMechanicsCount,
      movingCount,
      workingCount,
      completedCount: completedLogs.length,
      avgTravelMin,
      avgWorkMin,
      clockedOutCount,
    };
  }, [mechanicDailySummaries, dateLogs]);

  // 날짜 이동 헬퍼
  const shiftDate = (days: number) => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + days);
    setSelectedDate(getLocalWorkDateStr(d));
  };

  // 원클릭 동선 기록 핸들러
  const handleQuickRecord = async (
    eventType: AsRouteEventType,
    ticket?: Repair | null,
    overrideMechId?: string,
    overrideMechName?: string
  ) => {
    const key = `${eventType}-${ticket?.id || 'DUTY'}-${overrideMechId || ''}`;
    if (recordingKey) return;
    setRecordingKey(key);
    try {
      await recordAsRouteEvent({
        eventType,
        ticketId: ticket?.id,
        mechanicId: overrideMechId || ticket?.mechanicId || ticket?.assignedMechanicId || currentUser?.id,
        mechanicName: overrideMechName || ticket?.mechanicName || currentUser?.name,
      });
      setSyncVersion(v => v + 1);
    } finally {
      setRecordingKey(null);
    }
  };

  // 다음 현장 이동 확정 핸들러
  const handleConfirmMoveNext = async () => {
    if (!moveNextTargetTicket) return;
    setRecordingKey(`MOVE_NEXT-${moveNextTargetTicket.id}`);
    try {
      await recordAsRouteEvent({
        eventType: 'MOVE_NEXT_SITE',
        ticketId: moveNextTargetTicket.id,
        nextTicketId: selectedNextTicketId || undefined,
        nextSiteCustomName: customNextSiteName.trim() || undefined,
        mechanicId:
          moveNextTargetTicket.mechanicId ||
          moveNextTargetTicket.assignedMechanicId ||
          currentUser?.id,
        mechanicName: moveNextTargetTicket.mechanicName || currentUser?.name,
      });
      setMoveNextTargetTicket(null);
      setSelectedNextTicketId('');
      setCustomNextSiteName('');
      setSyncVersion(v => v + 1);
    } finally {
      setRecordingKey(null);
    }
  };

  // 부품 수급 이동 모달 열기 (자산 소유구분에 따라 당사 주기장 vs 임차처 자동 세팅)
  const handleOpenPartsSourcingModal = (
    ticket: Repair,
    overrideMechId?: string,
    overrideMechName?: string
  ) => {
    const assetInfo = getTicketAssetSourcingInfo(ticket, assets || [], vendors || []);
    const quickDates = getQuickRevisitDateOptions(selectedDate);
    setPartsSourcingTargetTicket(ticket);
    setSourcingType(assetInfo.defaultSourcingType);
    setSourcingTargetName(assetInfo.defaultSourcingTargetName);
    setSourcingPartName('');
    setSourcingMemo('');
    setSourcingWithRevisit(false);
    setSourcingRevisitDate(ticket.revisitDate || quickDates[0]?.dateStr || '');
    setSourcingMechanicOverride({ id: overrideMechId, name: overrideMechName });
  };

  // 부품 수급 이동 유형 전환 시 기본 이동지 명칭 자동 전환
  const handleSelectSourcingType = (nextType: AsPartsSourcingType) => {
    setSourcingType(nextType);
    const assetInfo = getTicketAssetSourcingInfo(partsSourcingTargetTicket, assets || [], vendors || []);
    if (nextType === 'HQ_YARD') {
      setSourcingTargetName(assetInfo.yardName ? `당사 주기장 (${assetInfo.yardName})` : '당사 주기장');
    } else if (nextType === 'RENTAL_VENDOR') {
      setSourcingTargetName(assetInfo.vendorName ? `임차처 (${assetInfo.vendorName})` : '임차처');
    } else {
      const colleague = asMechanics.find(
        m => m.id !== (sourcingMechanicOverride.id || partsSourcingTargetTicket?.mechanicId || currentUser?.id)
      );
      setSourcingTargetName(colleague ? `${colleague.name} 기사 차량 접선` : '타 차량 접선');
    }
  };

  // 부품 수급 이동 저장 핸들러
  const handleConfirmPartsSourcing = async () => {
    if (!partsSourcingTargetTicket) return;
    setRecordingKey(`PARTS_SOURCING-${partsSourcingTargetTicket.id}`);
    try {
      await recordAsRouteEvent({
        eventType: 'PARTS_SOURCING',
        ticketId: partsSourcingTargetTicket.id,
        sourcingType,
        sourcingTargetName: sourcingTargetName.trim() || AS_PARTS_SOURCING_TYPE_LABELS[sourcingType],
        partName: sourcingPartName.trim() || undefined,
        revisitDate: sourcingWithRevisit && sourcingRevisitDate ? sourcingRevisitDate : undefined,
        memo: sourcingMemo.trim() || undefined,
        mechanicId:
          sourcingMechanicOverride.id ||
          partsSourcingTargetTicket.mechanicId ||
          partsSourcingTargetTicket.assignedMechanicId ||
          currentUser?.id,
        mechanicName:
          sourcingMechanicOverride.name ||
          partsSourcingTargetTicket.mechanicName ||
          currentUser?.name,
      });
      setPartsSourcingTargetTicket(null);
      setSyncVersion(v => v + 1);
    } finally {
      setRecordingKey(null);
    }
  };

  // 재방문 스케줄 단독 모달 열기
  const handleOpenRevisitModal = (
    ticket: Repair,
    overrideMechId?: string,
    overrideMechName?: string
  ) => {
    const assetInfo = getTicketAssetSourcingInfo(ticket, assets || [], vendors || []);
    const quickDates = getQuickRevisitDateOptions(selectedDate);
    setRevisitTargetTicket(ticket);
    setRevisitDateInput(ticket.revisitDate || quickDates[0]?.dateStr || '');
    setRevisitReasonInput(
      ticket.revisitReason ||
        (assetInfo.ownerType === 'RENTED'
          ? `부품 부족 (${assetInfo.defaultSourcingTargetName} 부품 수령 후 재방문)`
          : '부품 부족 (당사 주기장 수급 후 재방문)')
    );
    setRevisitPartNameInput('');
    setRevisitMechanicOverride({ id: overrideMechId, name: overrideMechName });
  };

  // 재방문 스케줄 단독 확정 핸들러
  const handleConfirmRevisitSchedule = async () => {
    if (!revisitTargetTicket || !revisitDateInput) return;
    setRecordingKey(`REVISIT_SCHEDULED-${revisitTargetTicket.id}`);
    try {
      await recordAsRouteEvent({
        eventType: 'REVISIT_SCHEDULED',
        ticketId: revisitTargetTicket.id,
        revisitDate: revisitDateInput,
        partName: revisitPartNameInput.trim() || undefined,
        memo: revisitReasonInput.trim() || '당일 미완결 재방문 예약',
        mechanicId:
          revisitMechanicOverride.id ||
          revisitTargetTicket.mechanicId ||
          revisitTargetTicket.assignedMechanicId ||
          currentUser?.id,
        mechanicName:
          revisitMechanicOverride.name ||
          revisitTargetTicket.mechanicName ||
          currentUser?.name,
      });
      setRevisitTargetTicket(null);
      setSyncVersion(v => v + 1);
    } finally {
      setRecordingKey(null);
    }
  };

  const handleDeleteLog = async (log: AsRouteLog) => {
    if (!window.confirm(`[${formatTimeHm(log.recordedAt)}] ${log.mechanicName} - ${log.eventLabel} 기록을 삭제하시겠습니까?`)) {
      return;
    }
    await deleteAsRouteStep(log);
    refreshAllData();
    setSyncVersion(v => v + 1);
  };

  // 엑셀 다운로드
  const handleExportExcel = () => {
    const headers = [
      '근무일자',
      '기록시각',
      '담당기사',
      '동선단계',
      '소요시간(분)',
      '접수번호',
      '고객사',
      '현장명',
      '현장주소',
      '자산번호',
      '모델명',
      '다음 이동 현장',
      '비고',
    ];
    const rows = filteredLogs.map(l => [
      l.workDate,
      formatTimeHm(l.recordedAt),
      l.mechanicName,
      l.eventLabel,
      l.durationMinutes ?? '',
      l.ticketNo || '',
      l.customerName || '',
      l.siteName || '',
      l.siteAddress || '',
      l.assetNo || '',
      l.modelName || '',
      l.nextSiteName || '',
      l.memo || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '현장정비동선대장');
    XLSX.writeFile(wb, `현장정비_동선관리_${selectedDate}.xlsx`);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: isMobileEmbedded ? '8px 4px 84px 4px' : '4px 0 24px 0',
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 상단 타이틀 & 빠른 출퇴근/동선 기록 바 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: isMobileEmbedded ? '12px' : '12px 16px',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
              flexShrink: 0,
            }}
          >
            <Navigation size={18} />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: isMobileEmbedded ? '15px' : '17px',
                fontWeight: 800,
                color: 'var(--text-main, #f8fafc)',
                whiteSpace: 'nowrap',
              }}
            >
              현장정비 동선 관리
            </h2>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-muted, #94a3b8)',
                whiteSpace: 'nowrap',
              }}
            >
              일자별 AS팀 출발 · 도착 · 작업시작 · 다음현장 이동 · 퇴근 기록 및 조회
            </div>
          </div>
        </div>

        {/* 우상단 빠른 일과 기록 & 도구 버튼군 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleQuickRecord('CLOCK_IN', null, currentUser?.id, currentUser?.name)}
            disabled={!!recordingKey}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <LogIn size={14} /> 출근 기록
          </button>
          <button
            type="button"
            onClick={() => handleQuickRecord('RETURN_TO_YARD', null, currentUser?.id, currentUser?.name)}
            disabled={!!recordingKey}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.4)',
              background: 'rgba(100, 116, 139, 0.16)',
              color: 'var(--text-main, #e2e8f0)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <Home size={14} /> 주기장 복귀
          </button>
          <button
            type="button"
            onClick={() => handleQuickRecord('CLOCK_OUT', null, currentUser?.id, currentUser?.name)}
            disabled={!!recordingKey}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(244, 63, 94, 0.45)',
              background: 'rgba(244, 63, 94, 0.15)',
              color: '#f43f5e',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <LogOut size={14} /> 퇴근 기록
          </button>
          <button
            type="button"
            onClick={handleSyncRemote}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 11px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #334155)',
              background: 'var(--bg-secondary, #0f172a)',
              color: 'var(--text-main, #e2e8f0)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} /> 새로고침
          </button>
          {!isMobileEmbedded && (
            <button
              type="button"
              onClick={handleExportExcel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <Download size={13} /> 엑셀 내보내기
            </button>
          )}
        </div>
      </div>

      {/* ① 조회 조건 및 뷰 전환 바 (헌장 3.4 상하 스택 배치) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 14px',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '10px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '10px' }}>
          {/* 조회 일자 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted, #94a3b8)',
                whiteSpace: 'nowrap',
              }}
            >
              조회 일자
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => shiftDate(-1)}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #334155)',
                  background: 'var(--bg-secondary, #0f172a)',
                  color: 'var(--text-main, #e2e8f0)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                전일
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #334155)',
                  background: 'var(--bg-secondary, #0f172a)',
                  color: 'var(--text-main, #f8fafc)',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              />
              <button
                type="button"
                onClick={() => setSelectedDate(getLocalWorkDateStr())}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.45)',
                  background:
                    selectedDate === todayStr
                      ? '#2563eb'
                      : 'rgba(59, 130, 246, 0.12)',
                  color: selectedDate === todayStr ? '#ffffff' : '#60a5fa',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                오늘
              </button>
              <button
                type="button"
                onClick={() => shiftDate(1)}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #334155)',
                  background: 'var(--bg-secondary, #0f172a)',
                  color: 'var(--text-main, #e2e8f0)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                익일
              </button>
            </div>
          </div>

          {/* 담당 기사 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted, #94a3b8)',
                whiteSpace: 'nowrap',
              }}
            >
              담당 기사
            </label>
            <select
              value={selectedMechanicId}
              onChange={e => setSelectedMechanicId(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--bg-secondary, #0f172a)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '12px',
                fontWeight: 700,
                minWidth: '120px',
              }}
            >
              <option value="ALL">전체 기사 ({asMechanics.length}명)</option>
              {asMechanics.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.position ? `(${m.position})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 동선 단계 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted, #94a3b8)',
                whiteSpace: 'nowrap',
              }}
            >
              동선 단계
            </label>
            <select
              value={selectedEventType}
              onChange={e => setSelectedEventType(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--bg-secondary, #0f172a)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '12px',
                fontWeight: 700,
                minWidth: '120px',
              }}
            >
              <option value="ALL">전체 단계</option>
              <option value="CLOCK_IN">출근</option>
              <option value="DEPART_TO_SITE">현장 출발</option>
              <option value="ARRIVE_AT_SITE">현장 도착</option>
              <option value="WORK_START">작업 시작</option>
              <option value="PARTS_SOURCING">부품수급 이동</option>
              <option value="REVISIT_SCHEDULED">재방문 예약</option>
              <option value="WORK_COMPLETE">작업 완료</option>
              <option value="MOVE_NEXT_SITE">다음 현장 이동</option>
              <option value="RETURN_TO_YARD">주기장 복귀</option>
              <option value="CLOCK_OUT">퇴근</option>
            </select>
          </div>

          {/* 검색어 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
            <label
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted, #94a3b8)',
                whiteSpace: 'nowrap',
              }}
            >
              검색어
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  left: '9px',
                  color: 'var(--text-muted, #94a3b8)',
                }}
              />
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="고객사, 현장명, 자산번호, 기사명"
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 28px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #334155)',
                  background: 'var(--bg-secondary, #0f172a)',
                  color: 'var(--text-main, #f8fafc)',
                  fontSize: '12px',
                }}
              />
            </div>
          </div>
        </div>

        {/* 보기 모드 전환 탭 */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '3px',
            borderRadius: '8px',
            background: 'var(--bg-secondary, #0f172a)',
            border: '1px solid var(--border-color, #334155)',
          }}
        >
          {[
            { id: 'TIMELINE', label: '기사별 동선 타임라인' },
            { id: 'TICKETS', label: `현장AS 건별 단계 기록 (${targetTickets.length})` },
            { id: 'LEDGER', label: `시간순 기록 대장 (${filteredLogs.length})` },
          ].map(tab => {
            const active = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id as any)}
                style={{
                  padding: '6px 11px',
                  borderRadius: '6px',
                  border: 'none',
                  background: active ? '#2563eb' : 'transparent',
                  color: active ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                  fontSize: '12px',
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ③ 상단 KPI 요약 바 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobileEmbedded
            ? 'repeat(3, minmax(0, 1fr))'
            : 'repeat(6, minmax(0, 1fr))',
          gap: '8px',
        }}
      >
        {[
          { label: '활동 기사', value: `${kpiStats.activeMechanicsCount}명`, color: '#3b82f6' },
          { label: '현장 이동중', value: `${kpiStats.movingCount}명`, color: '#0ea5e9' },
          { label: '현장 작업중', value: `${kpiStats.workingCount}명`, color: '#f59e0b' },
          { label: '작업 완료', value: `${kpiStats.completedCount}건`, color: '#22c55e' },
          { label: '평균 이동시간', value: kpiStats.avgTravelMin ? `${kpiStats.avgTravelMin}분` : '-', color: '#8b5cf6' },
          { label: '퇴근 인원', value: `${kpiStats.clockedOutCount}명`, color: '#f43f5e' },
        ].map((card, idx) => (
          <div
            key={idx}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'var(--bg-card, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted, #94a3b8)',
                whiteSpace: 'nowrap',
              }}
            >
              {card.label}
            </span>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 900,
                color: card.color,
                whiteSpace: 'nowrap',
              }}
            >
              {card.value}
            </span>
          </div>
        ))}
      </div>

      {/* ④ 본문 뷰 1: 기사별 일자별 동선 타임라인 */}
      {viewMode === 'TIMELINE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mechanicDailySummaries.map(summary => {
            const {
              mechanic,
              logs,
              assignedTickets,
              clockInTime,
              clockOutTime,
              liveStateLabel,
              liveStateColor,
              liveStateBg,
              currentSiteLabel,
              travelMins,
              workMins,
              visitedSitesCount,
              completedCount,
            } = summary;

            return (
              <div
                key={mechanic.id}
                style={{
                  background: 'var(--bg-card, #1e293b)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                {/* 기사 상단 헤더 */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border-color, #334155)',
                    background: 'var(--bg-secondary, rgba(15, 23, 42, 0.55))',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: 900,
                        color: 'var(--text-main, #f8fafc)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {mechanic.name}
                    </span>
                    {mechanic.position && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--text-muted, #94a3b8)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {mechanic.position}
                      </span>
                    )}
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: '999px',
                        background: liveStateBg,
                        color: liveStateColor,
                        border: `1px solid ${liveStateColor}55`,
                        fontSize: '11px',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {liveStateLabel}
                    </span>
                    {currentSiteLabel !== '-' && (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--text-main, #cbd5e1)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        📍 {currentSiteLabel}
                      </span>
                    )}
                  </div>

                  {/* 기사 일일 통계 배지 + 기사별 출근/복귀/퇴근 버튼 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '11px',
                        color: 'var(--text-muted, #94a3b8)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'var(--bg-card, #1e293b)',
                        border: '1px solid var(--border-color, #334155)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>출근 <strong style={{ color: '#10b981' }}>{clockInTime}</strong></span>
                      <span>·</span>
                      <span>방문 <strong style={{ color: 'var(--text-main, #f8fafc)' }}>{visitedSitesCount}곳</strong></span>
                      <span>·</span>
                      <span>완료 <strong style={{ color: '#22c55e' }}>{completedCount}건</strong></span>
                      <span>·</span>
                      <span>이동 <strong style={{ color: '#3b82f6' }}>{travelMins}분</strong></span>
                      <span>·</span>
                      <span>작업 <strong style={{ color: '#f59e0b' }}>{workMins}분</strong></span>
                      <span>·</span>
                      <span>퇴근 <strong style={{ color: '#f43f5e' }}>{clockOutTime}</strong></span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleQuickRecord('CLOCK_IN', null, mechanic.id, mechanic.name)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        출근
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickRecord('RETURN_TO_YARD', null, mechanic.id, mechanic.name)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(148, 163, 184, 0.35)',
                          background: 'rgba(100, 116, 139, 0.14)',
                          color: 'var(--text-main, #cbd5e1)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        주기장복귀
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickRecord('CLOCK_OUT', null, mechanic.id, mechanic.name)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(244, 63, 94, 0.4)',
                          background: 'rgba(244, 63, 94, 0.12)',
                          color: '#f43f5e',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        퇴근
                      </button>
                    </div>
                  </div>
                </div>

                {/* 본문: 시간순 동선 흐름 타임라인 + 배정된 현장AS 원클릭 스텝 카드 */}
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* 시간순 동선 노드 스트립 */}
                  {logs.length === 0 ? (
                    <div
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        background: 'var(--bg-secondary, rgba(15, 23, 42, 0.4))',
                        border: '1px dashed var(--border-color, #334155)',
                        fontSize: '12px',
                        color: 'var(--text-muted, #64748b)',
                        textAlign: 'center',
                      }}
                    >
                      {selectedDate} 기록된 동선 이력이 없습니다. 아래 현장AS 건에서 [출발] · [도착] · [작업시작] 버튼을 누르면 즉시 기록됩니다.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {logs.map((log, idx) => {
                        const meta = AS_ROUTE_EVENT_META[log.eventType] || AS_ROUTE_EVENT_META.DEPART_TO_SITE;
                        return (
                          <React.Fragment key={log.id}>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '7px',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                background: meta.badgeBg,
                                border: `1px solid ${meta.badgeBorder}`,
                                fontSize: '12px',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 900,
                                  color: meta.badgeColor,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatTimeHm(log.recordedAt)}
                              </span>
                              <span
                                style={{
                                  fontWeight: 800,
                                  color: meta.badgeColor,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {meta.label}
                              </span>
                              {(log.siteName || log.customerName) && (
                                <span
                                  style={{
                                    color: 'var(--text-main, #f8fafc)',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {log.siteName || log.customerName}
                                  {log.assetNo && log.assetNo !== '현장확인' ? ` (${log.assetNo})` : ''}
                                </span>
                              )}
                              {log.eventType === 'MOVE_NEXT_SITE' && log.nextSiteName && (
                                <span
                                  style={{
                                    color: '#c4b5fd',
                                    fontWeight: 800,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  ➔ {log.nextSiteName}
                                </span>
                              )}
                              {log.eventType === 'PARTS_SOURCING' && (
                                <span
                                  style={{
                                    color: '#fb923c',
                                    fontWeight: 800,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  ➔ {log.sourcingTargetName || log.nextSiteName || '부품수급처'}
                                  {log.partName ? ` [${log.partName}]` : ''}
                                </span>
                              )}
                              {log.eventType === 'REVISIT_SCHEDULED' && log.revisitDate && (
                                <span
                                  style={{
                                    color: '#f472b6',
                                    fontWeight: 800,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  📅 재방문: {log.revisitDate}
                                </span>
                              )}
                              {typeof log.durationMinutes === 'number' && log.durationMinutes > 0 && (
                                <span
                                  style={{
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(15, 23, 42, 0.55)',
                                    color: '#cbd5e1',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {log.durationMinutes}분
                                </span>
                              )}
                            </div>
                            {idx < logs.length - 1 && (
                              <ArrowRight size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  {/* 해당 기사 배정/진행 현장AS 건별 원클릭 동선 제어 바 */}
                  {assignedTickets.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        담당 현장AS 건별 단계 기록 ({assignedTickets.length}건)
                      </div>
                      {assignedTickets.map(ticket => {
                        const routeSum = getTicketRouteSummary(ticket, allUnifiedLogs, selectedDate);
                        const assetSourcing = getTicketAssetSourcingInfo(ticket, assets || [], vendors || []);
                        const revisitDateLabel = ticket.revisitDate || routeSum.revisitScheduledFor;
                        return (
                          <div
                            key={ticket.id}
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              background: 'var(--bg-secondary, #0f172a)',
                              border: '1px solid var(--border-color, #334155)',
                            }}
                          >
                            <div
                              onClick={() => onOpenTicketDetail && onOpenTicketDetail(ticket.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '7px',
                                flexWrap: 'wrap',
                                cursor: onOpenTicketDetail ? 'pointer' : 'default',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  color: '#60a5fa',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {ticket.ticketNo || ticket.id}
                              </span>
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  color: 'var(--text-main, #f8fafc)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {ticket.customerName || '-'} · {ticket.siteName || '현장'}
                              </span>
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--text-muted, #94a3b8)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                [{ticket.assetNo || '현장확인'} / {ticket.modelName || '-'}]
                              </span>
                              {/* 당사자산 vs 임차자산 배지 */}
                              <span
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  background:
                                    assetSourcing.ownerType === 'RENTED'
                                      ? 'rgba(249, 115, 22, 0.16)'
                                      : 'rgba(16, 185, 129, 0.14)',
                                  color:
                                    assetSourcing.ownerType === 'RENTED' ? '#fb923c' : '#34d399',
                                  border:
                                    assetSourcing.ownerType === 'RENTED'
                                      ? '1px solid rgba(249, 115, 22, 0.35)'
                                      : '1px solid rgba(16, 185, 129, 0.35)',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {assetSourcing.ownerLabel}
                              </span>
                              <span
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  background: 'rgba(59, 130, 246, 0.14)',
                                  color: '#93c5fd',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {routeSum.currentStageLabel}
                              </span>
                              {revisitDateLabel && (
                                <span
                                  style={{
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    background: 'rgba(236, 72, 153, 0.16)',
                                    color: '#f472b6',
                                    border: '1px solid rgba(236, 72, 153, 0.35)',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  재방문예정 {revisitDateLabel}
                                </span>
                              )}
                            </div>

                            {/* 원클릭 기록 버튼 + 부품수급 / 재방문예약 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickRecord('DEPART_TO_SITE', ticket, mechanic.id, mechanic.name)
                                }
                                style={{
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  border: routeSum.departedAt
                                    ? '1px solid #3b82f6'
                                    : '1px solid rgba(59, 130, 246, 0.4)',
                                  background: routeSum.departedAt
                                    ? 'rgba(59, 130, 246, 0.22)'
                                    : 'rgba(59, 130, 246, 0.08)',
                                  color: '#60a5fa',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                출발 {routeSum.departedAt ? formatTimeHm(routeSum.departedAt) : '기록'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickRecord('ARRIVE_AT_SITE', ticket, mechanic.id, mechanic.name)
                                }
                                style={{
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  border: routeSum.arrivedAt
                                    ? '1px solid #0ea5e9'
                                    : '1px solid rgba(14, 165, 233, 0.4)',
                                  background: routeSum.arrivedAt
                                    ? 'rgba(14, 165, 233, 0.22)'
                                    : 'rgba(14, 165, 233, 0.08)',
                                  color: '#38bdf8',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                도착 {routeSum.arrivedAt ? formatTimeHm(routeSum.arrivedAt) : '기록'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickRecord('WORK_START', ticket, mechanic.id, mechanic.name)
                                }
                                style={{
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  border: routeSum.workStartedAt
                                    ? '1px solid #f59e0b'
                                    : '1px solid rgba(245, 158, 11, 0.4)',
                                  background: routeSum.workStartedAt
                                    ? 'rgba(245, 158, 11, 0.22)'
                                    : 'rgba(245, 158, 11, 0.08)',
                                  color: '#fbbf24',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                작업시작 {routeSum.workStartedAt ? formatTimeHm(routeSum.workStartedAt) : '기록'}
                              </button>

                              {/* 부품 수급 이동 (당사 주기장 / 타 차량 접선 / 임차처 방문) */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenPartsSourcingModal(ticket, mechanic.id, mechanic.name)
                                }
                                style={{
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  border: routeSum.partsSourcingAt
                                    ? '1px solid #f97316'
                                    : '1px solid rgba(249, 115, 22, 0.45)',
                                  background: routeSum.partsSourcingAt
                                    ? 'rgba(249, 115, 22, 0.22)'
                                    : 'rgba(249, 115, 22, 0.09)',
                                  color: '#fb923c',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                부품수급{' '}
                                {routeSum.partsSourcingAt
                                  ? formatTimeHm(routeSum.partsSourcingAt)
                                  : assetSourcing.ownerType === 'RENTED'
                                    ? '(임차처)'
                                    : '(주기장/차량)'}
                              </button>

                              {/* 당일 미완결 시 타 일자 재방문 스케줄 원클릭 예약 */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenRevisitModal(ticket, mechanic.id, mechanic.name)
                                }
                                style={{
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  border:
                                    routeSum.revisitScheduledAt || ticket.status === 'REVISIT'
                                      ? '1px solid #ec4899'
                                      : '1px solid rgba(236, 72, 153, 0.45)',
                                  background:
                                    routeSum.revisitScheduledAt || ticket.status === 'REVISIT'
                                      ? 'rgba(236, 72, 153, 0.22)'
                                      : 'rgba(236, 72, 153, 0.09)',
                                  color: '#f472b6',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                재방문예약{' '}
                                {revisitDateLabel ? revisitDateLabel.slice(5) : ''}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickRecord('WORK_COMPLETE', ticket, mechanic.id, mechanic.name)
                                }
                                style={{
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  border: routeSum.workCompletedAt
                                    ? '1px solid #22c55e'
                                    : '1px solid rgba(34, 197, 94, 0.4)',
                                  background: routeSum.workCompletedAt
                                    ? 'rgba(34, 197, 94, 0.22)'
                                    : 'rgba(34, 197, 94, 0.08)',
                                  color: '#4ade80',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                작업완료 {routeSum.workCompletedAt ? formatTimeHm(routeSum.workCompletedAt) : '기록'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setMoveNextTargetTicket(ticket);
                                  setSelectedNextTicketId('');
                                  setCustomNextSiteName('');
                                }}
                                style={{
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  border: routeSum.movedNextAt
                                    ? '1px solid #8b5cf6'
                                    : '1px solid rgba(139, 92, 246, 0.4)',
                                  background: routeSum.movedNextAt
                                    ? 'rgba(139, 92, 246, 0.22)'
                                    : 'rgba(139, 92, 246, 0.08)',
                                  color: '#c4b5fd',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                다음현장 이동{' '}
                                {routeSum.movedNextAt ? formatTimeHm(routeSum.movedNextAt) : ''}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ④ 본문 뷰 2: 현장AS 건별 단계 기록 표 */}
      {viewMode === 'TICKETS' && (
        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '10px',
            overflowX: 'auto',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'var(--bg-secondary, #0f172a)',
                  borderBottom: '1px solid var(--border-color, #334155)',
                  color: 'var(--text-muted, #94a3b8)',
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: '10px 12px' }}>접수번호</th>
                <th style={{ padding: '10px 12px' }}>담당기사</th>
                <th style={{ padding: '10px 12px' }}>고객사 / 현장명</th>
                <th style={{ padding: '10px 12px' }}>장비 (자산구분 · 모델)</th>
                <th style={{ padding: '10px 12px' }}>현재 단계</th>
                <th style={{ padding: '10px 12px' }}>1. 현장 출발</th>
                <th style={{ padding: '10px 12px' }}>2. 현장 도착 (이동시간)</th>
                <th style={{ padding: '10px 12px' }}>3. 작업 시작</th>
                <th style={{ padding: '10px 12px' }}>4. 부품수급 / 재방문예약</th>
                <th style={{ padding: '10px 12px' }}>5. 작업 완료 (작업시간)</th>
                <th style={{ padding: '10px 12px' }}>6. 다음 현장 이동</th>
              </tr>
            </thead>
            <tbody>
              {targetTickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    style={{
                      padding: '28px',
                      textAlign: 'center',
                      color: 'var(--text-muted, #64748b)',
                    }}
                  >
                    해당 일자에 등록 또는 진행된 현장AS 건이 없습니다.
                  </td>
                </tr>
              ) : (
                targetTickets.map(ticket => {
                  const sum = getTicketRouteSummary(ticket, allUnifiedLogs, selectedDate);
                  const assetSourcing = getTicketAssetSourcingInfo(ticket, assets || [], vendors || []);
                  const revisitDateLabel = ticket.revisitDate || sum.revisitScheduledFor;
                  return (
                    <tr
                      key={ticket.id}
                      style={{
                        borderBottom: '1px solid var(--border-color, #334155)',
                      }}
                    >
                      <td
                        style={{
                          padding: '10px 12px',
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          color: '#60a5fa',
                        }}
                      >
                        {ticket.ticketNo || ticket.id}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 800 }}>
                        {ticket.mechanicName || sum.lastMechanicName || '미배정'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main, #f8fafc)' }}>
                          {ticket.customerName || '-'} · {ticket.siteName || '-'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                          {ticket.siteAddress || ticket.locationDetail || '-'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800 }}>{ticket.assetNo || '현장확인'}</span>
                          <span style={{ color: 'var(--text-muted, #94a3b8)' }}>
                            ({ticket.modelName || '-'})
                          </span>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background:
                                assetSourcing.ownerType === 'RENTED'
                                  ? 'rgba(249, 115, 22, 0.16)'
                                  : 'rgba(16, 185, 129, 0.14)',
                              color:
                                assetSourcing.ownerType === 'RENTED' ? '#fb923c' : '#34d399',
                              fontSize: '10px',
                              fontWeight: 800,
                            }}
                          >
                            {assetSourcing.ownerLabel}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#60a5fa',
                              fontWeight: 800,
                              fontSize: '11px',
                            }}
                          >
                            {sum.currentStageLabel}
                          </span>
                          {revisitDateLabel && (
                            <span
                              style={{
                                padding: '3px 7px',
                                borderRadius: '6px',
                                background: 'rgba(236, 72, 153, 0.16)',
                                color: '#f472b6',
                                fontWeight: 800,
                                fontSize: '10px',
                              }}
                            >
                              재방문 {revisitDateLabel.slice(5)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          type="button"
                          onClick={() => handleQuickRecord('DEPART_TO_SITE', ticket)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(59, 130, 246, 0.45)',
                            background: sum.departedAt
                              ? 'rgba(59, 130, 246, 0.2)'
                              : 'transparent',
                            color: '#60a5fa',
                            fontWeight: 800,
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          {sum.departedAt ? `🚗 ${formatTimeHm(sum.departedAt)}` : '[출발 기록]'}
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          type="button"
                          onClick={() => handleQuickRecord('ARRIVE_AT_SITE', ticket)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(14, 165, 233, 0.45)',
                            background: sum.arrivedAt
                              ? 'rgba(14, 165, 233, 0.2)'
                              : 'transparent',
                            color: '#38bdf8',
                            fontWeight: 800,
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          {sum.arrivedAt
                            ? `📍 ${formatTimeHm(sum.arrivedAt)}${sum.travelMinutes ? ` (${sum.travelMinutes}분)` : ''}`
                            : '[도착 기록]'}
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          type="button"
                          onClick={() => handleQuickRecord('WORK_START', ticket)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(245, 158, 11, 0.45)',
                            background: sum.workStartedAt
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'transparent',
                            color: '#fbbf24',
                            fontWeight: 800,
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          {sum.workStartedAt ? `🔧 ${formatTimeHm(sum.workStartedAt)}` : '[작업시작]'}
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenPartsSourcingModal(ticket)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              border: '1px solid rgba(249, 115, 22, 0.45)',
                              background: sum.partsSourcingAt
                                ? 'rgba(249, 115, 22, 0.2)'
                                : 'transparent',
                              color: '#fb923c',
                              fontWeight: 800,
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            {sum.partsSourcingAt
                              ? `📦 ${formatTimeHm(sum.partsSourcingAt)} (${sum.sourcingTargetName || '부품수급'})`
                              : '[부품수급]'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenRevisitModal(ticket)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              border: '1px solid rgba(236, 72, 153, 0.45)',
                              background:
                                sum.revisitScheduledAt || ticket.status === 'REVISIT'
                                  ? 'rgba(236, 72, 153, 0.2)'
                                  : 'transparent',
                              color: '#f472b6',
                              fontWeight: 800,
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            {revisitDateLabel
                              ? `📅 재방문 (${revisitDateLabel.slice(5)})`
                              : '[재방문예약]'}
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          type="button"
                          onClick={() => handleQuickRecord('WORK_COMPLETE', ticket)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(34, 197, 94, 0.45)',
                            background: sum.workCompletedAt
                              ? 'rgba(34, 197, 94, 0.2)'
                              : 'transparent',
                            color: '#4ade80',
                            fontWeight: 800,
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          {sum.workCompletedAt
                            ? `✅ ${formatTimeHm(sum.workCompletedAt)}${sum.workMinutes ? ` (${sum.workMinutes}분)` : ''}`
                            : '[작업완료]'}
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setMoveNextTargetTicket(ticket);
                            setSelectedNextTicketId('');
                            setCustomNextSiteName('');
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(139, 92, 246, 0.45)',
                            background: sum.movedNextAt
                              ? 'rgba(139, 92, 246, 0.2)'
                              : 'transparent',
                            color: '#c4b5fd',
                            fontWeight: 800,
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          {sum.movedNextAt
                            ? `➔ ${formatTimeHm(sum.movedNextAt)} ${sum.nextSiteName ? `(${sum.nextSiteName})` : ''}`
                            : '[다음 현장 이동]'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ④ 본문 뷰 3: 시간순 전체 동선 기록 대장 */}
      {viewMode === 'LEDGER' && (
        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '10px',
            overflowX: 'auto',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'var(--bg-secondary, #0f172a)',
                  borderBottom: '1px solid var(--border-color, #334155)',
                  color: 'var(--text-muted, #94a3b8)',
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: '10px 12px' }}>기록시각</th>
                <th style={{ padding: '10px 12px' }}>근무일자</th>
                <th style={{ padding: '10px 12px' }}>담당기사</th>
                <th style={{ padding: '10px 12px' }}>동선단계</th>
                <th style={{ padding: '10px 12px' }}>소요시간</th>
                <th style={{ padding: '10px 12px' }}>접수번호</th>
                <th style={{ padding: '10px 12px' }}>고객사</th>
                <th style={{ padding: '10px 12px' }}>현장명</th>
                <th style={{ padding: '10px 12px' }}>자산번호 / 모델</th>
                <th style={{ padding: '10px 12px' }}>다음 이동지 / 수급·재방문</th>
                <th style={{ padding: '10px 12px' }}>비고</th>
                <th style={{ padding: '10px 12px' }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    style={{
                      padding: '28px',
                      textAlign: 'center',
                      color: 'var(--text-muted, #64748b)',
                    }}
                  >
                    조회 조건에 해당하는 동선 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                [...filteredLogs].reverse().map(log => {
                  const meta = AS_ROUTE_EVENT_META[log.eventType] || AS_ROUTE_EVENT_META.DEPART_TO_SITE;
                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border-color, #334155)',
                      }}
                    >
                      <td
                        style={{
                          padding: '9px 12px',
                          fontFamily: 'monospace',
                          fontWeight: 900,
                          color: meta.badgeColor,
                        }}
                      >
                        {formatTimeHm(log.recordedAt)}
                      </td>
                      <td style={{ padding: '9px 12px' }}>{log.workDate}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 800 }}>{log.mechanicName}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: meta.badgeBg,
                            color: meta.badgeColor,
                            border: `1px solid ${meta.badgeBorder}`,
                            fontWeight: 800,
                            fontSize: '11px',
                          }}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 700 }}>
                        {log.durationMinutes ? `${log.durationMinutes}분` : '-'}
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: '#60a5fa' }}>
                        {log.ticketNo || '-'}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 700 }}>
                        {log.customerName || '-'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>{log.siteName || '-'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        {log.assetNo ? `${log.assetNo} (${log.modelName || '-'})` : '-'}
                      </td>
                      <td
                        style={{
                          padding: '9px 12px',
                          color:
                            log.eventType === 'PARTS_SOURCING'
                              ? '#fb923c'
                              : log.eventType === 'REVISIT_SCHEDULED'
                                ? '#f472b6'
                                : '#c4b5fd',
                          fontWeight: 700,
                        }}
                      >
                        {log.eventType === 'PARTS_SOURCING'
                          ? `${log.sourcingTargetName || log.nextSiteName || '부품수급처'}${log.partName ? ` [${log.partName}]` : ''}`
                          : log.eventType === 'REVISIT_SCHEDULED'
                            ? `재방문 예정: ${log.revisitDate || '-'}`
                            : log.nextSiteName || '-'}
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-muted, #94a3b8)' }}>
                        {log.memo || '-'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteLog(log)}
                          style={{
                            padding: '4px 7px',
                            borderRadius: '6px',
                            border: '1px solid rgba(244, 63, 94, 0.35)',
                            background: 'transparent',
                            color: '#f43f5e',
                            cursor: 'pointer',
                          }}
                          title="기록 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 다음 현장 이동 선택 모달 */}
      {moveNextTargetTicket && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(2, 6, 23, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '14px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              color: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 900 }}>
              다음 현장 이동 기록
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              현재 현장: <strong style={{ color: '#ffffff' }}>{moveNextTargetTicket.siteName || moveNextTargetTicket.customerName}</strong> ({moveNextTargetTicket.assetNo || '-'})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                다음 이동 대상 현장AS 선택 (선택 시 다음 현장 출발도 동시 기록)
              </label>
              <select
                value={selectedNextTicketId}
                onChange={e => setSelectedNextTicketId(e.target.value)}
                style={{
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#ffffff',
                  fontSize: '12px',
                }}
              >
                <option value="">직접 입력 또는 미지정 이동</option>
                {(fieldAsTickets || [])
                  .filter(
                    t =>
                      t.id !== moveNextTargetTicket.id &&
                      (t.status === 'REQUESTED' ||
                        t.status === 'SCHEDULED' ||
                        t.status === 'IN_PROGRESS' ||
                        t.status === 'REVISIT')
                  )
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      [{t.ticketNo || t.id}] {t.customerName || '-'} · {t.siteName || '-'} ({t.modelName || '-'})
                    </option>
                  ))}
              </select>
            </div>

            {!selectedNextTicketId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                  다음 이동지 직접 입력 (선택사항)
                </label>
                <input
                  type="text"
                  value={customNextSiteName}
                  onChange={e => setCustomNextSiteName(e.target.value)}
                  placeholder="예: 평택 P4 현장, 본사 주기장 등"
                  style={{
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setMoveNextTargetTicket(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmMoveNext}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#7c3aed',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                다음 현장 이동 기록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 부품 수급 이동 및 재방문 스케줄 입력 모달 */}
      {partsSourcingTargetTicket && (() => {
        const sourcingInfo = getTicketAssetSourcingInfo(
          partsSourcingTargetTicket,
          assets || [],
          vendors || []
        );
        const quickDateOptions = getQuickRevisitDateOptions(selectedDate);
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(2, 6, 23, 0.78)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '520px',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '14px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                color: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#fb923c' }}>
                  부품 수급 이동 기록
                </div>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: '999px',
                    background:
                      sourcingInfo.ownerType === 'RENTED'
                        ? 'rgba(249, 115, 22, 0.18)'
                        : 'rgba(16, 185, 129, 0.16)',
                    color: sourcingInfo.ownerType === 'RENTED' ? '#fb923c' : '#34d399',
                    border:
                      sourcingInfo.ownerType === 'RENTED'
                        ? '1px solid rgba(249, 115, 22, 0.45)'
                        : '1px solid rgba(16, 185, 129, 0.4)',
                    fontSize: '11px',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sourcingInfo.ownerLabel}
                </span>
              </div>

              <div
                style={{
                  padding: '9px 11px',
                  borderRadius: '8px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  fontSize: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                <div>
                  현장:{' '}
                  <strong style={{ color: '#ffffff' }}>
                    {partsSourcingTargetTicket.customerName || '-'} ·{' '}
                    {partsSourcingTargetTicket.siteName || '현장'}
                  </strong>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                  장비: {partsSourcingTargetTicket.assetNo || '현장확인'} (
                  {partsSourcingTargetTicket.modelName || '-'})
                  {sourcingInfo.ownerType === 'RENTED'
                    ? ` · 임차처: ${sourcingInfo.vendorName}`
                    : ` · 주기장: ${sourcingInfo.yardName}`}
                </div>
              </div>

              {/* 1. 수급 방식 원클릭 선택 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                  부품 수급 이동지 구분 ({sourcingInfo.ownerType === 'RENTED' ? '임차자산 → 임차처 자동 매칭' : '당사자산 → 당사 주기장 또는 타 차량 접선'})
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {(
                    [
                      {
                        type: 'HQ_YARD' as AsPartsSourcingType,
                        title: '당사 주기장 수급',
                        sub: sourcingInfo.yardName || '당사 주기장',
                        recommended: sourcingInfo.ownerType === 'OWNED',
                      },
                      {
                        type: 'COLLEAGUE_VAN' as AsPartsSourcingType,
                        title: '타 차량 접선 수급',
                        sub: '동료 AS차량 부픔 수령',
                        recommended: sourcingInfo.ownerType === 'OWNED',
                      },
                      {
                        type: 'RENTAL_VENDOR' as AsPartsSourcingType,
                        title: '임차처 방문 수급',
                        sub:
                          sourcingInfo.ownerType === 'RENTED'
                            ? sourcingInfo.vendorName
                            : '임차처 부품 수령',
                        recommended: sourcingInfo.ownerType === 'RENTED',
                      },
                    ]
                  ).map(opt => {
                    const active = sourcingType === opt.type;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => handleSelectSourcingType(opt.type)}
                        style={{
                          padding: '9px 8px',
                          borderRadius: '8px',
                          border: active
                            ? '2px solid #f97316'
                            : opt.recommended
                              ? '1px solid rgba(249, 115, 22, 0.45)'
                              : '1px solid #334155',
                          background: active
                            ? 'rgba(249, 115, 22, 0.2)'
                            : '#1e293b',
                          color: active ? '#fdba74' : '#e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '2px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {opt.title}
                        </span>
                        <span style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {opt.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 타 차량 접선 선택 시 동료 AS 기사 빠른 선택 */}
              {sourcingType === 'COLLEAGUE_VAN' && asMechanics.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                    접선할 동료 AS차량 빠른 선택
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {asMechanics
                      .filter(m => m.id !== sourcingMechanicOverride.id)
                      .map(m => {
                        const targetLabel = `${m.name} 차량 접선`;
                        const selected = sourcingTargetName === targetLabel;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSourcingTargetName(targetLabel)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: selected ? '1px solid #f97316' : '1px solid #334155',
                              background: selected ? 'rgba(249, 115, 22, 0.22)' : '#1e293b',
                              color: selected ? '#fdba74' : '#cbd5e1',
                              fontSize: '11px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            🚐 {m.name} {m.position || ''}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* 임차처 방문 선택 시 등록된 매입처/임차처 빠른 선택 (임차처 미지정 자산 대비) */}
              {sourcingType === 'RENTAL_VENDOR' && (vendors || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                    임차처 선택 (장비 임차처 자동 입력됨 · 변경 가능)
                  </label>
                  <select
                    value={sourcingTargetName}
                    onChange={e => setSourcingTargetName(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      background: '#1e293b',
                      color: '#ffffff',
                      fontSize: '12px',
                    }}
                  >
                    {sourcingInfo.vendorName && (
                      <option value={sourcingInfo.vendorName}>
                        {sourcingInfo.vendorName} (해당 장비 임차처)
                      </option>
                    )}
                    {(vendors || []).map(v => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 수급 이동지 상세 명칭 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                  수급 이동지 명칭
                </label>
                <input
                  type="text"
                  value={sourcingTargetName}
                  onChange={e => setSourcingTargetName(e.target.value)}
                  placeholder="예: 당사 주기장, 김기사 차량 접선, OO렌탈 주기장"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
              </div>

              {/* 2. 수급 대상 부품 빠른 칩 선택 + 입력 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                  수급 필요 부품 (칩 선택 또는 직접 입력)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '4px' }}>
                  {COMMON_AS_PARTS_PRESETS.map(part => {
                    const selected = sourcingPartName.includes(part);
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
                                .map(s => s.trim())
                                .filter(s => s && s !== part)
                                .join(', ')
                            );
                          } else {
                            setSourcingPartName(`${sourcingPartName}, ${part}`);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: selected ? '1px solid #f97316' : '1px solid #334155',
                          background: selected ? 'rgba(249, 115, 22, 0.2)' : '#1e293b',
                          color: selected ? '#fdba74' : '#cbd5e1',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {part}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={sourcingPartName}
                  onChange={e => setSourcingPartName(e.target.value)}
                  placeholder="수급할 부품명 입력 (예: 상부 조이스틱, 유압 호스)"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
              </div>

              {/* 3. 당일 미완결 시 다음날/타일자 재방문 스케줄 동시 등록 옵션 */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: sourcingWithRevisit
                    ? 'rgba(236, 72, 153, 0.12)'
                    : 'rgba(15, 23, 42, 0.65)',
                  border: sourcingWithRevisit
                    ? '1px solid rgba(236, 72, 153, 0.45)'
                    : '1px solid #334155',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: sourcingWithRevisit ? '#f472b6' : '#cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sourcingWithRevisit}
                    onChange={e => setSourcingWithRevisit(e.target.checked)}
                  />
                  당일 완결 불가 — 다음날/다른 날짜 재방문 스케줄 함께 등록
                </label>

                {sourcingWithRevisit && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {quickDateOptions.map(opt => {
                        const active = sourcingRevisitDate === opt.date;
                        return (
                          <button
                            key={opt.date}
                            type="button"
                            onClick={() => setSourcingRevisitDate(opt.date)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              border: active ? '1px solid #ec4899' : '1px solid #334155',
                              background: active ? 'rgba(236, 72, 153, 0.24)' : '#1e293b',
                              color: active ? '#f9a8d4' : '#cbd5e1',
                              fontSize: '11px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {opt.label} ({opt.subLabel})
                          </button>
                        );
                      })}
                      <input
                        type="date"
                        value={sourcingRevisitDate}
                        onChange={e => setSourcingRevisitDate(e.target.value)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #334155',
                          background: '#1e293b',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      />
                    </div>
                    <input
                      type="text"
                      value={sourcingMemo}
                      onChange={e => setSourcingMemo(e.target.value)}
                      placeholder="재방문 메모 (예: 부품 수급 후 익일 오전 재방문)"
                      style={{
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1px solid #334155',
                        background: '#1e293b',
                        color: '#ffffff',
                        fontSize: '12px',
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setPartsSourcingTargetTicket(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#cbd5e1',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPartsSourcing}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ea580c',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {sourcingWithRevisit
                    ? '부품수급 이동 + 재방문 일정 동시 기록'
                    : '부품수급 이동 기록'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 당일 미완결 시 다음날/타일자 재방문 스케줄 원클릭 등록 모달 */}
      {revisitTargetTicket && (() => {
        const quickDateOptions = getQuickRevisitDateOptions(selectedDate);
        const reasonPresets = [
          '부품 수급 후 재방문',
          '임차처 부품 입고 대기 후 재방문',
          '현장 작업시간 종료로 익일 재방문',
          '추가 정밀 진단/장비 교환 검토',
        ];
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(2, 6, 23, 0.78)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '460px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '14px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                color: '#f8fafc',
              }}
            >
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#f472b6' }}>
                재방문 스케줄 등록
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                대상 현장:{' '}
                <strong style={{ color: '#ffffff' }}>
                  {revisitTargetTicket.customerName || '-'} · {revisitTargetTicket.siteName || '현장'}
                </strong>{' '}
                ({revisitTargetTicket.assetNo || '현장확인'})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                  재방문 예정일 빠른 선택
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {quickDateOptions.map(opt => {
                    const active = revisitDateInput === opt.date;
                    return (
                      <button
                        key={opt.date}
                        type="button"
                        onClick={() => setRevisitDateInput(opt.date)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: active ? '2px solid #ec4899' : '1px solid #334155',
                          background: active ? 'rgba(236, 72, 153, 0.22)' : '#1e293b',
                          color: active ? '#f9a8d4' : '#e2e8f0',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>{opt.label}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{opt.subLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                  또는 달력에서 날짜 직접 지정
                </label>
                <input
                  type="date"
                  value={revisitDateInput}
                  onChange={e => setRevisitDateInput(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                  재방문 사유 선택 또는 직접 입력
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '4px' }}>
                  {reasonPresets.map(reason => {
                    const active = revisitReasonInput === reason;
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setRevisitReasonInput(reason)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: active ? '1px solid #ec4899' : '1px solid #334155',
                          background: active ? 'rgba(236, 72, 153, 0.2)' : '#1e293b',
                          color: active ? '#f9a8d4' : '#cbd5e1',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {reason}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={revisitReasonInput}
                  onChange={e => setRevisitReasonInput(e.target.value)}
                  placeholder="재방문 사유 및 필요 부품 메모"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setRevisitTargetTicket(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#cbd5e1',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevisitSchedule}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#db2777',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
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
