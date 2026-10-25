import {
  db,
  supabase,
  AsRouteEventType,
  AsRouteStage,
  AsRouteLog,
  Repair,
  RepairTimelineEvent,
} from './db';
import { clockIn, clockOut } from './workStatusService';

const LOCAL_MIRROR_KEY = 'ebro_as_route_logs_mirror_v1';
const SUPABASE_SETTINGS_KEY = 'as_route_logs_store_v1';

export interface AsRouteEventMeta {
  type: AsRouteEventType;
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  dotColor: string;
}

export const AS_ROUTE_EVENT_META: Record<AsRouteEventType, AsRouteEventMeta> = {
  CLOCK_IN: {
    type: 'CLOCK_IN',
    label: '출근',
    shortLabel: '출근',
    badgeBg: 'rgba(16, 185, 129, 0.14)',
    badgeColor: '#10b981',
    badgeBorder: 'rgba(16, 185, 129, 0.35)',
    dotColor: '#10b981',
  },
  DEPART_TO_SITE: {
    type: 'DEPART_TO_SITE',
    label: '현장 출발',
    shortLabel: '출발',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    badgeColor: '#3b82f6',
    badgeBorder: 'rgba(59, 130, 246, 0.38)',
    dotColor: '#3b82f6',
  },
  ARRIVE_AT_SITE: {
    type: 'ARRIVE_AT_SITE',
    label: '현장 도착',
    shortLabel: '도착',
    badgeBg: 'rgba(14, 165, 233, 0.16)',
    badgeColor: '#0ea5e9',
    badgeBorder: 'rgba(14, 165, 233, 0.38)',
    dotColor: '#0ea5e9',
  },
  WORK_START: {
    type: 'WORK_START',
    label: '작업 시작',
    shortLabel: '작업시작',
    badgeBg: 'rgba(245, 158, 11, 0.16)',
    badgeColor: '#f59e0b',
    badgeBorder: 'rgba(245, 158, 11, 0.4)',
    dotColor: '#f59e0b',
  },
  PARTS_SOURCING: {
    type: 'PARTS_SOURCING',
    label: '부품 수급 이동',
    shortLabel: '부품수급',
    badgeBg: 'rgba(236, 72, 153, 0.16)',
    badgeColor: '#ec4899',
    badgeBorder: 'rgba(236, 72, 153, 0.4)',
    dotColor: '#ec4899',
  },
  REVISIT_SCHEDULED: {
    type: 'REVISIT_SCHEDULED',
    label: '재방문 일정 등록',
    shortLabel: '재방문예약',
    badgeBg: 'rgba(249, 115, 22, 0.16)',
    badgeColor: '#f97316',
    badgeBorder: 'rgba(249, 115, 22, 0.4)',
    dotColor: '#f97316',
  },
  WORK_COMPLETE: {
    type: 'WORK_COMPLETE',
    label: '작업 완료',
    shortLabel: '작업완료',
    badgeBg: 'rgba(34, 197, 94, 0.16)',
    badgeColor: '#22c55e',
    badgeBorder: 'rgba(34, 197, 94, 0.4)',
    dotColor: '#22c55e',
  },
  MOVE_NEXT_SITE: {
    type: 'MOVE_NEXT_SITE',
    label: '다음 현장 이동',
    shortLabel: '다음현장',
    badgeBg: 'rgba(139, 92, 246, 0.16)',
    badgeColor: '#8b5cf6',
    badgeBorder: 'rgba(139, 92, 246, 0.4)',
    dotColor: '#8b5cf6',
  },
  RETURN_TO_YARD: {
    type: 'RETURN_TO_YARD',
    label: '주기장 복귀',
    shortLabel: '주기장복귀',
    badgeBg: 'rgba(100, 116, 139, 0.18)',
    badgeColor: '#94a3b8',
    badgeBorder: 'rgba(100, 116, 139, 0.4)',
    dotColor: '#64748b',
  },
  CLOCK_OUT: {
    type: 'CLOCK_OUT',
    label: '퇴근',
    shortLabel: '퇴근',
    badgeBg: 'rgba(244, 63, 94, 0.14)',
    badgeColor: '#f43f5e',
    badgeBorder: 'rgba(244, 63, 94, 0.35)',
    dotColor: '#f43f5e',
  },
};

export interface TicketRouteSummary {
  repairId: string;
  currentStage: AsRouteStage;
  currentStageLabel: string;
  departedAt?: string;
  arrivedAt?: string;
  workStartedAt?: string;
  workCompletedAt?: string;
  movedNextAt?: string;
  nextRepairId?: string;
  nextSiteName?: string;
  travelMinutes?: number;
  workMinutes?: number;
  lastMechanicName?: string;
}

export function getLocalWorkDateStr(isoOrDate?: string | Date): string {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatTimeHm(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function calcDiffMinutes(startIso?: string, endIso?: string): number | undefined {
  if (!startIso || !endIso) return undefined;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return undefined;
  return Math.max(1, Math.round((e - s) / 60000));
}

function readLocalMirrorLogs(): AsRouteLog[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(LOCAL_MIRROR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalMirrorLogs(logs: AsRouteLog[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const trimmed = logs.slice(-1500);
    window.localStorage.setItem(LOCAL_MIRROR_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota error
  }
}

async function syncLogsToSystemSettings(logs: AsRouteLog[]): Promise<void> {
  if (!supabase) return;
  try {
    const recentLogs = logs.slice(-800);
    await supabase
      .from('system_settings')
      .upsert(
        [
          {
            key: SUPABASE_SETTINGS_KEY,
            value: JSON.stringify(recentLogs),
          },
        ],
        { onConflict: 'key' }
      );
  } catch {
    // ignore fallback sync errors
  }
}

export async function pullAsRouteLogsFromRemote(): Promise<AsRouteLog[]> {
  const mergedMap = new Map<string, AsRouteLog>();

  (db.asRouteLogs || []).forEach(l => {
    if (l && l.id) mergedMap.set(l.id, l);
  });
  readLocalMirrorLogs().forEach(l => {
    if (l && l.id) mergedMap.set(l.id, l);
  });

  if (supabase) {
    try {
      const { data: tableRows, error: tableErr } = await supabase
        .from('as_route_logs')
        .select('*')
        .order('recordedAt', { ascending: true })
        .limit(1000);
      if (!tableErr && Array.isArray(tableRows)) {
        tableRows.forEach((row: any) => {
          if (row && row.id) {
            mergedMap.set(row.id, row as AsRouteLog);
          }
        });
      }
    } catch {
      // ignore if table not yet migrated
    }

    try {
      const { data: settingRow } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', SUPABASE_SETTINGS_KEY)
        .maybeSingle();
      if (settingRow?.value) {
        const parsed = typeof settingRow.value === 'string' ? JSON.parse(settingRow.value) : settingRow.value;
        if (Array.isArray(parsed)) {
          parsed.forEach((row: any) => {
            if (row && row.id && !mergedMap.has(row.id)) {
              mergedMap.set(row.id, row as AsRouteLog);
            }
          });
        }
      }
    } catch {
      // ignore
    }
  }

  const all = Array.from(mergedMap.values()).sort((a, b) =>
    (a.recordedAt || '').localeCompare(b.recordedAt || '')
  );
  db.asRouteLogs = all;
  writeLocalMirrorLogs(all);
  return all;
}

/**
 * 모든 repairs.timelineEvents 와 asRouteLogs 를 통합하여 중복 없는 단일 동선 로그 배열을 반환합니다.
 */
export function getAllUnifiedAsRouteLogs(
  repairs?: Repair[],
  workDateFilter?: string,
  mechanicIdFilter?: string
): AsRouteLog[] {
  const sourceRepairs = repairs || db.repairs || [];
  const mergedMap = new Map<string, AsRouteLog>();

  // 1. 로컬 미러 + db.asRouteLogs
  readLocalMirrorLogs().forEach(l => {
    if (l && l.id) mergedMap.set(l.id, l);
  });
  (db.asRouteLogs || []).forEach(l => {
    if (l && l.id) mergedMap.set(l.id, l);
  });

  // 2. repairs.timelineEvents 내 저장된 동선 이벤트 복원 (원격 DB 100% 관통 보장)
  sourceRepairs.forEach(ticket => {
    if (!ticket || !Array.isArray(ticket.timelineEvents)) return;
    ticket.timelineEvents.forEach((evt: RepairTimelineEvent) => {
      if (!evt || !evt.timestamp) return;
      let mappedType: AsRouteEventType | null = null;
      if (
        evt.eventType === 'CLOCK_IN' ||
        evt.eventType === 'DEPART_TO_SITE' ||
        evt.eventType === 'ARRIVE_AT_SITE' ||
        evt.eventType === 'WORK_START' ||
        evt.eventType === 'WORK_COMPLETE' ||
        evt.eventType === 'MOVE_NEXT_SITE' ||
        evt.eventType === 'RETURN_TO_YARD' ||
        evt.eventType === 'CLOCK_OUT'
      ) {
        mappedType = evt.eventType;
      } else if (evt.eventType === 'TRANSIT_START') {
        mappedType = 'DEPART_TO_SITE';
      } else if (evt.eventType === 'ARRIVED') {
        mappedType = 'ARRIVE_AT_SITE';
      } else if (evt.eventType === 'COMPLETED') {
        mappedType = 'WORK_COMPLETE';
      }

      if (!mappedType) return;
      const meta = AS_ROUTE_EVENT_META[mappedType];
      const workDate = evt.workDate || getLocalWorkDateStr(evt.timestamp);
      const id = evt.id || `RTL-${ticket.id}-${mappedType}-${evt.timestamp}`;
      if (mergedMap.has(id)) return;

      mergedMap.set(id, {
        id,
        workDate,
        mechanicId: evt.mechanicId || ticket.mechanicId || ticket.assignedMechanicId || '',
        mechanicName: evt.mechanicName || ticket.mechanicName || '담당기사',
        eventType: mappedType,
        eventLabel: meta.label,
        repairId: evt.repairId || ticket.id,
        ticketNo: evt.ticketNo || ticket.ticketNo || ticket.id,
        customerId: evt.customerId || ticket.customerId,
        customerName: evt.customerName || ticket.customerName,
        siteId: evt.siteId || ticket.siteId,
        siteName: evt.siteName || ticket.siteName,
        siteAddress: evt.siteAddress || ticket.siteAddress || ticket.locationDetail,
        assetId: evt.assetId || ticket.assetId,
        assetNo: evt.assetNo || ticket.assetNo,
        modelName: evt.modelName || ticket.modelName,
        nextRepairId: evt.nextRepairId,
        nextSiteName: evt.nextSiteName,
        durationMinutes: evt.durationMinutes,
        memo: evt.detail || '',
        recordedAt: evt.timestamp,
        createdAt: evt.timestamp,
        updatedAt: evt.timestamp,
      });
    });
  });

  // 동일 티켓 + 동일 이벤트타입 + 1분 이내 중복 방지 정규화
  const dedupedBySignature = new Map<string, AsRouteLog>();
  const sorted = Array.from(mergedMap.values()).sort((a, b) =>
    (a.recordedAt || '').localeCompare(b.recordedAt || '')
  );

  for (const log of sorted) {
    const minuteKey = (log.recordedAt || '').slice(0, 16);
    const sig = `${log.mechanicId || log.mechanicName}|${log.eventType}|${log.repairId || 'NONE'}|${minuteKey}`;
    dedupedBySignature.set(sig, log);
  }

  let result = Array.from(dedupedBySignature.values()).sort((a, b) =>
    (a.recordedAt || '').localeCompare(b.recordedAt || '')
  );

  if (workDateFilter) {
    result = result.filter(l => l.workDate === workDateFilter);
  }
  if (mechanicIdFilter && mechanicIdFilter !== 'ALL') {
    result = result.filter(
      l => l.mechanicId === mechanicIdFilter || l.mechanicName === mechanicIdFilter
    );
  }

  return result;
}

/**
 * 개별 현장AS 티켓의 동선 단계 요약(출발/도착/작업시작/작업완료/다음현장이동 시각 및 현재 단계)을 계산합니다.
 */
export function getTicketRouteSummary(ticket: Repair, allLogs?: AsRouteLog[]): TicketRouteSummary {
  const logsForTicket = (allLogs || getAllUnifiedAsRouteLogs([ticket])).filter(
    l => l.repairId === ticket.id
  );

  let departedAt: string | undefined;
  let arrivedAt: string | undefined;
  let workStartedAt: string | undefined;
  let workCompletedAt: string | undefined;
  let movedNextAt: string | undefined;
  let nextRepairId: string | undefined;
  let nextSiteName: string | undefined;
  let lastMechanicName = ticket.mechanicName;

  for (const log of logsForTicket) {
    if (log.mechanicName) lastMechanicName = log.mechanicName;
    if (log.eventType === 'DEPART_TO_SITE') {
      departedAt = log.recordedAt;
    } else if (log.eventType === 'ARRIVE_AT_SITE') {
      arrivedAt = log.recordedAt;
    } else if (log.eventType === 'WORK_START') {
      workStartedAt = log.recordedAt;
    } else if (log.eventType === 'WORK_COMPLETE') {
      workCompletedAt = log.recordedAt;
    } else if (log.eventType === 'MOVE_NEXT_SITE') {
      movedNextAt = log.recordedAt;
      if (log.nextRepairId) nextRepairId = log.nextRepairId;
      if (log.nextSiteName) nextSiteName = log.nextSiteName;
    }
  }

  if (!workCompletedAt && ticket.status === 'COMPLETED' && ticket.updatedAt) {
    workCompletedAt = ticket.updatedAt;
  }

  let currentStage: AsRouteStage = 'WAITING';
  let currentStageLabel = '출동 대기';

  if (ticket.status === 'COMPLETED' || workCompletedAt) {
    if (movedNextAt) {
      currentStage = 'MOVING_NEXT';
      currentStageLabel = nextSiteName ? `다음 이동 (${nextSiteName})` : '다음 현장 이동';
    } else {
      currentStage = 'COMPLETED';
      currentStageLabel = '작업 완료';
    }
  } else if (movedNextAt) {
    currentStage = 'MOVING_NEXT';
    currentStageLabel = nextSiteName ? `다음 이동 (${nextSiteName})` : '다음 현장 이동';
  } else if (workStartedAt) {
    currentStage = 'WORKING';
    currentStageLabel = '작업 진행중';
  } else if (arrivedAt) {
    currentStage = 'ARRIVED';
    currentStageLabel = '현장 도착';
  } else if (departedAt) {
    currentStage = 'DEPARTED';
    currentStageLabel = '현장 이동중';
  }

  const travelMinutes = calcDiffMinutes(departedAt, arrivedAt);
  const workMinutes = calcDiffMinutes(workStartedAt || arrivedAt, workCompletedAt || movedNextAt);

  return {
    repairId: ticket.id,
    currentStage,
    currentStageLabel,
    departedAt,
    arrivedAt,
    workStartedAt,
    workCompletedAt,
    movedNextAt,
    nextRepairId,
    nextSiteName,
    travelMinutes,
    workMinutes,
    lastMechanicName,
  };
}

/**
 * AS팀 동선 버튼 클릭 시 실시간 기록 및 티켓 상태/타임라인 동기화를 수행합니다.
 */
export async function recordAsRouteStep(params: {
  eventType: AsRouteEventType;
  mechanicId: string;
  mechanicName: string;
  ticket?: Repair | null;
  nextTicket?: Repair | null;
  nextSiteCustomName?: string;
  memo?: string;
  customRecordedAt?: string;
}): Promise<AsRouteLog> {
  const nowIso = params.customRecordedAt || new Date().toISOString();
  const workDate = getLocalWorkDateStr(nowIso);
  const meta = AS_ROUTE_EVENT_META[params.eventType];
  const ticket = params.ticket || (params.ticket === undefined ? null : null);
  const nextTicket = params.nextTicket || null;

  // 직전 단계 대비 소요시간(분) 자동 계산
  const todayMechanicLogs = getAllUnifiedAsRouteLogs(db.repairs, workDate, params.mechanicId);
  let durationMinutes: number | undefined;

  if (params.eventType === 'ARRIVE_AT_SITE') {
    const prevDepart = [...todayMechanicLogs]
      .reverse()
      .find(
        l =>
          (ticket ? l.repairId === ticket.id : true) &&
          (l.eventType === 'DEPART_TO_SITE' || l.eventType === 'MOVE_NEXT_SITE')
      );
    if (prevDepart) {
      durationMinutes = calcDiffMinutes(prevDepart.recordedAt, nowIso);
    }
  } else if (params.eventType === 'WORK_START') {
    const prevArrive = [...todayMechanicLogs]
      .reverse()
      .find(l => (ticket ? l.repairId === ticket.id : true) && l.eventType === 'ARRIVE_AT_SITE');
    if (prevArrive) {
      durationMinutes = calcDiffMinutes(prevArrive.recordedAt, nowIso);
    }
  } else if (params.eventType === 'WORK_COMPLETE' || params.eventType === 'MOVE_NEXT_SITE') {
    const prevStart = [...todayMechanicLogs]
      .reverse()
      .find(
        l =>
          (ticket ? l.repairId === ticket.id : true) &&
          (l.eventType === 'WORK_START' || l.eventType === 'ARRIVE_AT_SITE')
      );
    if (prevStart) {
      durationMinutes = calcDiffMinutes(prevStart.recordedAt, nowIso);
    }
  }

  const nextSiteNameResolved =
    nextTicket?.siteName ||
    nextTicket?.customerName ||
    params.nextSiteCustomName ||
    undefined;

  const newLogId = `ARL-${workDate.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .substring(2, 5)
    .toUpperCase()}`;

  const newLog: AsRouteLog = {
    id: newLogId,
    workDate,
    mechanicId: params.mechanicId,
    mechanicName: params.mechanicName,
    eventType: params.eventType,
    eventLabel: meta.label,
    repairId: ticket?.id,
    ticketNo: ticket?.ticketNo || ticket?.id,
    customerId: ticket?.customerId,
    customerName: ticket?.customerName,
    siteId: ticket?.siteId,
    siteName: ticket?.siteName,
    siteAddress: ticket?.siteAddress || ticket?.locationDetail,
    assetId: ticket?.assetId,
    assetNo: ticket?.assetNo,
    modelName: ticket?.modelName,
    nextRepairId: nextTicket?.id,
    nextSiteName: nextSiteNameResolved,
    durationMinutes,
    memo: params.memo || '',
    recordedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // 1. 로컬 미러 및 db.asRouteLogs 즉시 반영
  const existingLogs = readLocalMirrorLogs();
  const updatedLogs = [...existingLogs.filter(l => l.id !== newLog.id), newLog];
  writeLocalMirrorLogs(updatedLogs);

  try {
    db.insertRow<AsRouteLog>('asRouteLogs', newLog);
  } catch (e) {
    console.warn('[asRouteTrackingService] asRouteLogs insert fallback:', e);
  }

  // 2. 티켓이 연결된 경우 repairs.timelineEvents 및 티켓 상태/담당자 자동 갱신
  if (ticket) {
    const latestTicket = db.repairs.find(r => r.id === ticket.id) || ticket;
    const hm = formatTimeHm(nowIso);
    let labelText = `[${hm}] ${params.mechanicName} ${meta.label}`;
    if (params.eventType === 'ARRIVE_AT_SITE' && durationMinutes) {
      labelText += ` (이동 ${durationMinutes}분)`;
    } else if (params.eventType === 'WORK_COMPLETE' && durationMinutes) {
      labelText += ` (작업 ${durationMinutes}분)`;
    } else if (params.eventType === 'MOVE_NEXT_SITE' && nextSiteNameResolved) {
      labelText += ` ➔ ${nextSiteNameResolved}`;
    }
    if (params.memo) {
      labelText += ` - ${params.memo}`;
    }

    const timelineEvt: RepairTimelineEvent = {
      id: newLogId,
      eventType: params.eventType,
      label: labelText,
      mechanicId: params.mechanicId,
      mechanicName: params.mechanicName,
      detail: params.memo || (nextSiteNameResolved ? `다음 현장: ${nextSiteNameResolved}` : undefined),
      timestamp: nowIso,
      workDate,
      repairId: latestTicket.id,
      ticketNo: latestTicket.ticketNo || latestTicket.id,
      customerId: latestTicket.customerId,
      customerName: latestTicket.customerName,
      siteId: latestTicket.siteId,
      siteName: latestTicket.siteName,
      siteAddress: latestTicket.siteAddress || latestTicket.locationDetail,
      assetId: latestTicket.assetId,
      assetNo: latestTicket.assetNo,
      modelName: latestTicket.modelName,
      nextRepairId: nextTicket?.id,
      nextSiteName: nextSiteNameResolved,
      durationMinutes,
    };

    const prevEvents = Array.isArray(latestTicket.timelineEvents) ? latestTicket.timelineEvents : [];
    let nextStatus = latestTicket.status;
    if (
      (params.eventType === 'DEPART_TO_SITE' ||
        params.eventType === 'ARRIVE_AT_SITE' ||
        params.eventType === 'WORK_START') &&
      (latestTicket.status === 'REQUESTED' || latestTicket.status === 'SCHEDULED')
    ) {
      nextStatus = 'IN_PROGRESS';
    }

    const assignedMechId = latestTicket.mechanicId || latestTicket.assignedMechanicId || params.mechanicId;
    const assignedMechName = latestTicket.mechanicName || params.mechanicName;

    db.updateRow<Repair>('repairs', latestTicket.id, {
      status: nextStatus,
      mechanicId: assignedMechId,
      assignedMechanicId: assignedMechId,
      mechanicName: assignedMechName,
      visitDate: latestTicket.visitDate || workDate,
      timelineEvents: [...prevEvents, timelineEvt],
      updatedAt: nowIso,
    });
  }

  // 3. 다음 현장 이동 시 대상 다음 티켓(nextTicket)이 지정되어 있으면 자동으로 해당 티켓에도 'DEPART_TO_SITE' 기록 및 진행중 전환
  if (params.eventType === 'MOVE_NEXT_SITE' && nextTicket && nextTicket.id !== ticket?.id) {
    const targetNext = db.repairs.find(r => r.id === nextTicket.id) || nextTicket;
    const nextDepartId = `ARL-${workDate.replace(/-/g, '')}-${(Date.now() + 1).toString(36).toUpperCase()}-NXT`;
    const hm = formatTimeHm(nowIso);
    const fromSiteLabel = ticket?.siteName || ticket?.customerName || '이전 현장';
    const nextDepartEvt: RepairTimelineEvent = {
      id: nextDepartId,
      eventType: 'DEPART_TO_SITE',
      label: `[${hm}] ${params.mechanicName} 현장 출발 (${fromSiteLabel}에서 이동 출발)`,
      mechanicId: params.mechanicId,
      mechanicName: params.mechanicName,
      detail: `${fromSiteLabel} 작업 후 연속 이동 출발`,
      timestamp: nowIso,
      workDate,
      repairId: targetNext.id,
      ticketNo: targetNext.ticketNo || targetNext.id,
      customerId: targetNext.customerId,
      customerName: targetNext.customerName,
      siteId: targetNext.siteId,
      siteName: targetNext.siteName,
      siteAddress: targetNext.siteAddress || targetNext.locationDetail,
      assetId: targetNext.assetId,
      assetNo: targetNext.assetNo,
      modelName: targetNext.modelName,
    };

    const nextLogEntry: AsRouteLog = {
      id: nextDepartId,
      workDate,
      mechanicId: params.mechanicId,
      mechanicName: params.mechanicName,
      eventType: 'DEPART_TO_SITE',
      eventLabel: '현장 출발',
      repairId: targetNext.id,
      ticketNo: targetNext.ticketNo || targetNext.id,
      customerId: targetNext.customerId,
      customerName: targetNext.customerName,
      siteId: targetNext.siteId,
      siteName: targetNext.siteName,
      siteAddress: targetNext.siteAddress || targetNext.locationDetail,
      assetId: targetNext.assetId,
      assetNo: targetNext.assetNo,
      modelName: targetNext.modelName,
      memo: `${fromSiteLabel}에서 연속 이동 출발`,
      recordedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    writeLocalMirrorLogs([...readLocalMirrorLogs(), nextLogEntry]);
    try {
      db.insertRow<AsRouteLog>('asRouteLogs', nextLogEntry);
    } catch {}

    const prevNextEvts = Array.isArray(targetNext.timelineEvents) ? targetNext.timelineEvents : [];
    const nextTicketStatus =
      targetNext.status === 'REQUESTED' || targetNext.status === 'SCHEDULED'
        ? 'IN_PROGRESS'
        : targetNext.status;

    db.updateRow<Repair>('repairs', targetNext.id, {
      status: nextTicketStatus,
      mechanicId: targetNext.mechanicId || params.mechanicId,
      assignedMechanicId: targetNext.assignedMechanicId || params.mechanicId,
      mechanicName: targetNext.mechanicName || params.mechanicName,
      visitDate: targetNext.visitDate || workDate,
      timelineEvents: [...prevNextEvts, nextDepartEvt],
      updatedAt: nowIso,
    });
  }

  // 4. 출근 / 퇴근 시 workStatusService 연동
  if (params.eventType === 'CLOCK_IN') {
    try {
      await clockIn(params.mechanicId);
    } catch {}
  } else if (params.eventType === 'CLOCK_OUT') {
    try {
      await clockOut(params.mechanicId);
    } catch {}
  }

  // 5. 원격 DB 저장 대기 및 system_settings 미러링
  await syncLogsToSystemSettings(readLocalMirrorLogs());
  await db.awaitPendingWrites();

  return newLog;
}

/**
 * 잘못 누른 동선 기록 1건을 삭제합니다.
 */
export async function deleteAsRouteStep(log: AsRouteLog): Promise<void> {
  const remainingMirror = readLocalMirrorLogs().filter(l => l.id !== log.id);
  writeLocalMirrorLogs(remainingMirror);

  try {
    db.deleteRow('asRouteLogs', log.id);
  } catch {}

  if (log.repairId) {
    const ticket = db.repairs.find(r => r.id === log.repairId);
    if (ticket && Array.isArray(ticket.timelineEvents)) {
      const nextEvts = ticket.timelineEvents.filter(e => e.id !== log.id);
      if (nextEvts.length !== ticket.timelineEvents.length) {
        db.updateRow<Repair>('repairs', ticket.id, {
          timelineEvents: nextEvts,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  await syncLogsToSystemSettings(remainingMirror);
  await db.awaitPendingWrites();
}
