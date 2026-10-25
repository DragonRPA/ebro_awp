// src/utils/taskHandoverPipeline.ts
import { db, Todo, TaskCategory } from '../services/db';
import { broadcastWorkNotification } from './workNotificationService';

export interface IssueHandoverTaskParams {
  category: TaskCategory;
  title: string;
  content: string;
  priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  targetType?: 'USER' | 'DEPT';
  targetDept?: 'DISPATCH' | 'YARD' | 'AS' | 'ACCOUNTING' | 'SALES' | 'EXECUTIVE' | string;
  targetRole?: string;
  assignedUserId?: string;
  dueDate?: string;
  actionUrl?: string;
  entityType: 'CONTRACT' | 'DELIVERY' | 'INSPECTION' | 'REPAIR' | 'BILLING' | 'SETTLEMENT' | 'CUSTOMER' | 'CONSUMABLE' | 'LEAVE' | 'DIRECTIVE' | string;
  entityId: string;
  senderId?: string;
  senderName?: string;
}

export interface ClearHandoverTasksParams {
  entityType?: string;
  entityId: string;
  category?: TaskCategory;
  completedByUserId?: string;
  completedByName?: string;
  completionAction: string;
  resolutionNote?: string;
}

/**
 * 🚀 [1] 물리적 ToDo 발행 + 브로드캐스트 원스톱 파이프라인
 */
export async function issueHandoverTask(params: IssueHandoverTaskParams): Promise<Todo> {
  const nowIso = new Date().toISOString();
  const todoId = db.generateNextId('todos', db.todos);

  // fallback userId for legacy compatibility
  const systemFallbackUserId = db.users.find(u => u.id === 'u-1')?.id || db.users.find(u => !['sys-admin', 'usr-admin'].includes(u.id))?.id || 'u-1';
  let validUserId = params.assignedUserId;
  if (!validUserId) {
    if (params.targetDept === 'DISPATCH') {
      const dispatchUser = db.users.find(u => (u.department || '').includes('배차') || (u.role || '').includes('LOGISTICS'));
      validUserId = dispatchUser?.id || systemFallbackUserId;
    } else if (params.targetDept === 'YARD') {
      const yardUser = db.users.find(u => (u.department || '').includes('출고') || (u.department || '').includes('주기장'));
      validUserId = yardUser?.id || systemFallbackUserId;
    } else if (params.targetDept === 'AS') {
      const asUser = db.users.find(u => (u.department || '').includes('정비') || (u.role || '').includes('MECHANIC'));
      validUserId = asUser?.id || systemFallbackUserId;
    } else if (params.targetDept === 'ACCOUNTING') {
      const acctUser = db.users.find(u => (u.department || '').includes('관리') || (u.department || '').includes('회계'));
      validUserId = acctUser?.id || systemFallbackUserId;
    } else {
      validUserId = systemFallbackUserId;
    }
  }

  const newTodo: Todo = {
    id: todoId,
    userId: validUserId,
    assignedUserId: params.assignedUserId,
    targetType: params.targetType || (params.assignedUserId ? 'USER' : 'DEPT'),
    targetDept: params.targetDept,
    targetRole: params.targetRole,
    taskCategory: params.category,
    type: params.priority === 'URGENT' ? 'URGENT' : 'GENERAL',
    title: params.title,
    content: params.content,
    priority: params.priority || 'NORMAL',
    dueDate: params.dueDate,
    actionUrl: params.actionUrl || '/',
    entityType: params.entityType,
    entityId: params.entityId,
    relatedEntityId: params.entityId,
    senderId: params.senderId && !['sys-admin', 'usr-admin'].includes(params.senderId) ? params.senderId : undefined,
    senderName: params.senderName,
    isCompleted: false,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  // 1. 물리 DB 적재
  db.insertRow<Todo>('todos', newTodo);

  // 2. 푸시 & 차임벨 알림 병행 (휘발 유실 방어)
  try {
    const notifType = params.category === 'EXECUTIVE_DIRECTIVE' ? 'URGENT_DIRECTIVE' :
      params.category.includes('DISPATCH') ? 'DISPATCH' :
      params.category.includes('INSPECTION') ? 'OUTBOUND' :
      params.category.includes('AS') ? 'AS' :
      params.category.includes('EXCHANGE') ? 'EXCHANGE' : 'OUTBOUND';

    broadcastWorkNotification({
      type: notifType as any,
      title: params.title,
      body: params.content,
      url: params.actionUrl,
      targetDepts: params.targetDept ? [params.targetDept] : undefined,
      senderId: params.senderId,
      senderName: params.senderName
    }).catch(err => {
      console.warn('broadcastWorkNotification send warning:', err);
    });
  } catch (err) {
    console.warn('taskHandover broadcast error:', err);
  }

  return newTodo;
}

/**
 * 🟢 [2] 비즈니스 액션 완료 시 선행 ToDo 원자적 자동 상계
 */
export async function clearHandoverTasks(params: ClearHandoverTasksParams): Promise<number> {
  const nowIso = new Date().toISOString();
  const matchedTodos = db.todos.filter(t => 
    !t.isCompleted &&
    (t.entityId === params.entityId || t.relatedEntityId === params.entityId) &&
    (!params.entityType || t.entityType === params.entityType) &&
    (!params.category || t.taskCategory === params.category)
  );

  matchedTodos.forEach(t => {
    db.updateRow<Todo>('todos', t.id, {
      isCompleted: true,
      completedAt: nowIso,
      completedByUserId: params.completedByUserId,
      completedByName: params.completedByName,
      completionAction: params.completionAction,
      resolutionNote: params.resolutionNote,
      updatedAt: nowIso
    });
  });

  return matchedTodos.length;
}

/**
 * 🛡️ [2.5] 도메인 원장 상태 교차 검증을 통한 기완료 ToDo 자동 판별 및 상계
 * - 업무 처리 경로(장비 할당, 배차 확정, 출고검수 승인, 입고 완료, 정비 완료, 수납 완료, 계약서 재발송 등)에서
 *   개별 엔티티 ID 차이로 인해 미상계 상태로 남은 고아/기완료 ToDo를 실시간 감지하여 자동 상계 처리한다.
 */
export function isTaskEntityAlreadyResolved(t: Todo): boolean {
  if (!t || t.isCompleted) return true;

  // 초기 부팅 중 도메인 테이블이 아직 로드되지 않은 상태에서는 오판 상계 방지를 위해 false 반환
  if (db.contracts.length === 0 && db.deliveries.length === 0 && db.assets.length === 0) {
    return false;
  }

  const eid = (t.entityId || t.relatedEntityId || '').trim();
  const cat = (t.taskCategory || '').toUpperCase();
  const etype = (t.entityType || '').toUpperCase();

  // 0. 경영진 특별지시(EXECUTIVE_DIRECTIVE)는 명시적 완료 처리 전까지 유지
  if (cat === 'EXECUTIVE_DIRECTIVE') {
    return false;
  }

  // 1. 계약서패키지 재발송 (CONTRACT_PACKAGE_RESEND)
  if (cat === 'CONTRACT_PACKAGE_RESEND') {
    if (!eid) return true;
    if (db.contracts.length === 0 || db.contractAssets.length === 0) return false;
    const contract = db.contracts.find(c => c.id === eid);
    if (!contract) return true;
    const cStatus = (contract.status || '').toUpperCase();
    if (cStatus === 'TERMINATED' || cStatus === 'CANCELLED' || cStatus === 'COMPLETED') return true;

    // ToDo 생성 시각 이후에 계약서 패키지(DOCUMENT_SENT)가 발송되었으면 완료로 판정
    const todoTime = new Date(t.updatedAt || t.createdAt || 0).getTime();
    const sentAfterTodo = db.contractHistory.some(
      h =>
        h.contractId === eid &&
        h.changeType === 'DOCUMENT_SENT' &&
        !(h.description && h.description.includes('월간 안전점검 체크리스트')) &&
        new Date(h.createdAt || 0).getTime() >= todoTime
    );
    if (sentAfterTodo) return true;

    // 해당 계약의 활성 체결자산이 모두 반납/매각 종료된 경우 완료로 판정
    const activeSlots = db.contractAssets.filter(
      ca => ca.contractId === eid && ca.status !== 'RETURNED' && ca.status !== 'SOLD'
    );
    if (activeSlots.length === 0) return true;
    return false;
  }

  // 2. 장비 할당 요청 (ASSIGN 관련 카테고리)
  if (cat.includes('ASSIGN')) {
    if (!eid) return true;
    if (db.contracts.length === 0 || db.contractAssets.length === 0) return false;
    const deliv = db.deliveries.find(d => d.id === eid);
    if (deliv) {
      const dStatus = (deliv.status || '').toUpperCase();
      if (dStatus === 'CANCELLED' || dStatus === 'DELIVERED' || dStatus === 'COMPLETED' || Boolean(deliv.loadingCompletedAt)) {
        return true;
      }
      if (deliv.cargoItems) {
        try {
          const parsed = typeof deliv.cargoItems === 'string' ? JSON.parse(deliv.cargoItems) : deliv.cargoItems;
          if (Array.isArray(parsed)) {
            const caIds: string[] = [];
            parsed.forEach((ci: any) => {
              if (Array.isArray(ci?.contractAssetIds)) caIds.push(...ci.contractAssetIds.filter(Boolean));
            });
            if (caIds.length > 0) {
              const hasUnassigned = caIds.some(id => {
                const ca = db.contractAssets.find(c => c.id === id);
                return ca && ca.status !== 'RETURNED' && ca.status !== 'SOLD' && ca.status !== 'RENTED' && !ca.assetId;
              });
              if (!hasUnassigned) return true;
              return false;
            }
          }
        } catch {}
      }
    }

    const contract = db.contracts.find(c => c.id === eid || (deliv && c.id === deliv.contractId));
    if (contract) {
      const cStatus = (contract.status || '').toUpperCase();
      if (cStatus === 'TERMINATED' || cStatus === 'CANCELLED' || cStatus === 'COMPLETED') return true;
      const unassignedSlots = db.contractAssets.filter(
        ca => ca.contractId === contract.id && ca.status !== 'RETURNED' && ca.status !== 'SOLD' && ca.status !== 'RENTED' && !ca.assetId
      );
      if (unassignedSlots.length === 0) return true;
    } else if (!deliv) {
      const slot = db.contractAssets.find(ca => ca.id === eid);
      if (!slot || Boolean(slot.assetId) || slot.status === 'RETURNED' || slot.status === 'SOLD' || slot.status === 'RENTED') return true;
    }
    return false;
  }

  // 3. 출고검수 / PDI (INSPECTION 관련)
  if (etype === 'INSPECTION' || cat.includes('INSPECTION') || cat.includes('PDI')) {
    if (!eid) return true;
    if (db.outboundInspections.length === 0) return false;
    const directInsp = db.outboundInspections.find(i => i.id === eid);
    if (directInsp) {
      const iStatus = (directInsp.status || '').toUpperCase();
      if (iStatus === 'COMPLETED' || iStatus === 'APPROVED' || iStatus === 'CANCELLED') return true;
      if (directInsp.deliveryId) {
        const d = db.deliveries.find(x => x.id === directInsp.deliveryId);
        if (d && (d.status === 'CANCELLED' || d.status === 'DELIVERED' || (d.status as string) === 'COMPLETED')) return true;
      }
      if ((directInsp as any).contractAssetId) {
        const ca = db.contractAssets.find(c => c.id === (directInsp as any).contractAssetId);
        if (ca && (ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD')) return true;
      }
      if (directInsp.assetId) {
        const asset = db.assets.find(a => a.id === directInsp.assetId);
        if (asset && asset.status === 'RENTED') return true;
      }
      return false;
    }

    // entityId가 deliveryId 또는 contractId 또는 contractAssetId인 경우
    const relatedInsps = db.outboundInspections.filter(
      i => i.deliveryId === eid || i.contractId === eid || (i as any).contractAssetId === eid || i.assetId === eid
    );
    if (relatedInsps.length > 0) {
      const hasPending = relatedInsps.some(i => {
        if (i.status !== 'PENDING' && i.status !== 'IN_PROGRESS') return false;
        if (i.deliveryId) {
          const d = db.deliveries.find(x => x.id === i.deliveryId);
          if (d && d.status === 'CANCELLED') return false;
        }
        if ((i as any).contractAssetId && db.contractAssets.length > 0) {
          const ca = db.contractAssets.find(c => c.id === (i as any).contractAssetId);
          if (ca && (ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD')) return false;
        }
        return true;
      });
      if (!hasPending) return true;
      return false;
    }

    // 연결된 검수 레코드가 아예 없으면 계약/배차 상태 확인
    const d = db.deliveries.find(x => x.id === eid);
    if (d && (d.status === 'CANCELLED' || d.status === 'DELIVERED' || (d.status as string) === 'COMPLETED')) return true;
    const ca = db.contractAssets.find(x => x.id === eid);
    if (ca && (ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD')) return true;
    const asset = db.assets.find(x => x.id === eid);
    if (asset && asset.status === 'RENTED') return true;
    return false;
  }

  // 4. 배차 / 운송 / 상차 / 하차 (DELIVERY 관련)
  if (etype === 'DELIVERY' || cat.includes('DISPATCH') || cat.includes('SHIPMENT')) {
    if (!eid) return true;
    if (db.deliveries.length === 0) return false;
    const deliv = db.deliveries.find(d => d.id === eid);
    if (deliv) {
      const dStatus = (deliv.status || '').toUpperCase();
      if (dStatus === 'CANCELLED' || dStatus === 'DELIVERED' || dStatus === 'COMPLETED') return true;
      if (deliv.unloadingCompletedAt) return true;

      const isShipmentStartTask =
        cat.includes('SHIPMENT') ||
        cat === 'OUTBOUND_SHIPMENT_START' ||
        (t.title || '').includes('상차 출발');

      // 4-A. [장비 상차 출발] (PDI 검수 완료 후 상차/출발/운송완료 처리가 필요한 단계)
      // 헌장 1.3에 의해 PDI 검수 승인 시점에 이미 자산은 RENTED 상태이고 기사도 DISPATCHED 상태이므로,
      // 실제 상차 완료(loadingCompletedAt) 또는 운송 완료(DELIVERED/COMPLETED/unloadingCompletedAt)가 되었을 때만 해소 판정
      if (isShipmentStartTask) {
        if (deliv.loadingCompletedAt) return true;
        return false;
      }

      // 4-B. [출고/회수/반납 배차 의뢰] (DISPATCH_REQUEST 등 차량·기사 매칭 단계)
      // 이미 기사/차량이 배정되어 DISPATCHED 상태이거나 상차 완료된 경우 해소
      const isDriverAssigned = Boolean(
        dStatus === 'DISPATCHED' &&
        (deliv.driverName || deliv.vehicleNo || deliv.transportCompany || deliv.loadingCompletedAt)
      );
      if (isDriverAssigned && !cat.includes('ARRIVAL') && !cat.includes('UNLOAD')) {
        return true;
      }

      // 동일 배차 건에 대해 후행 단계인 [장비 상차 출발] (OUTBOUND_SHIPMENT_START) ToDo가 이미 발행되어 열려 있는 경우,
      // 선행 [출고 배차 의뢰]가 중복 노출되지 않도록 후행 업무로 통합 상계
      const hasSupersedingShipmentTask = (db.todos || []).some(
        other =>
          other.id !== t.id &&
          !other.isCompleted &&
          other.entityId === eid &&
          ((other.taskCategory || '').toUpperCase().includes('SHIPMENT') || (other.title || '').includes('상차 출발'))
      );
      if (hasSupersedingShipmentTask) {
        return true;
      }

      // 출고 배차인데 연결된 체결자산이 이미 모두 대여중(RENTED) 또는 반납완료(RETURNED)이고 상차까지 끝난 경우
      if (deliv.type === 'OUTBOUND' && deliv.contractId && deliv.loadingCompletedAt && db.contractAssets.length > 0) {
        const cAssets = db.contractAssets.filter(ca => ca.contractId === deliv.contractId);
        if (cAssets.length > 0 && cAssets.every(ca => ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD')) {
          return true;
        }
      }
      // 회수/입고 배차인데 연결된 자산이 이미 주기장 입고 완료된 경우
      if (deliv.type === 'INBOUND' && deliv.contractId && db.contractAssets.length > 0) {
        const cAssets = db.contractAssets.filter(ca => ca.contractId === deliv.contractId);
        if (cAssets.length > 0 && cAssets.every(ca => ca.status === 'RETURNED' || ca.status === 'SOLD')) {
          return true;
        }
      }
      return false;
    }

    // eid가 contractId인 경우
    const contractDeliveries = db.deliveries.filter(d => d.contractId === eid && d.status !== 'CANCELLED');
    if (contractDeliveries.length === 0) return true;
    const allDone = contractDeliveries.every(d => {
      const st = (d.status || '').toUpperCase();
      return st === 'DELIVERED' || st === 'COMPLETED' || Boolean(d.unloadingCompletedAt) || (st === 'DISPATCHED' && Boolean(d.driverName || d.vehicleNo));
    });
    if (allDone) return true;
    return false;
  }

  // 5. 정비 / AS (FIELD_AS 및 REPAIR 관련)
  if (etype === 'REPAIR' || etype === 'FIELD_AS' || cat.includes('REPAIR') || cat.includes('AS')) {
    if (!eid) return true;
    const isFieldAsTask =
      cat === 'AS_DISPATCH_REPAIR' ||
      etype === 'FIELD_AS' ||
      eid.startsWith('FAS-') ||
      (t.actionUrl || '').toLowerCase().includes('field_as');

    // 5-A. 현장 정비(fieldAsTickets) 원장 확인
    const fieldTickets: any[] = ((db as any).fieldAsTickets || []);
    if (fieldTickets.length > 0) {
      const ticket = fieldTickets.find((tk: any) => tk.id === eid || tk.ticketNo === eid);
      if (ticket) {
        const tkStatus = (ticket.status || '').toUpperCase();
        if (tkStatus === 'COMPLETED' || tkStatus === 'CANCELED' || tkStatus === 'CANCELLED') return true;
        return false;
      }
      if (isFieldAsTask) {
        const activeTickets = fieldTickets.filter(
          (tk: any) =>
            (tk.assetId === eid || tk.contractId === eid || tk.assetNo === eid) &&
            tk.status !== 'COMPLETED' &&
            tk.status !== 'CANCELED' &&
            (tk.status as string) !== 'CANCELLED'
        );
        if (activeTickets.length > 0) return false;
      }
    } else if (isFieldAsTask && db.repairs.length === 0) {
      return false;
    }

    // 5-B. 주기장/일반 수리(repairs) 원장 확인
    if (db.repairs.length === 0) return false;
    const rep = db.repairs.find(r => r.id === eid);
    if (rep) {
      const rStatus = (rep.status || '').toUpperCase();
      if (rStatus === 'COMPLETED' || rStatus === 'CANCELLED' || rStatus === 'WAIVED' || rStatus === 'RESOLVED') return true;
      return false;
    }
    // 현장 AS 전용 티켓(FAS-...)인데 fieldAsTickets가 아직 로드 전이면 보류, 로드 후에도 없으면 완료 처리
    if (eid.startsWith('FAS-')) {
      return fieldTickets.length > 0;
    }
    // eid가 assetId 또는 contractId인 경우 미완료 수리 건 존재 여부 확인
    const activeRepairs = db.repairs.filter(
      r => (r.assetId === eid || r.contractId === eid) && r.status !== 'COMPLETED' && (r.status as string) !== 'CANCELLED'
    );
    if (activeRepairs.length === 0) return true;
    return false;
  }

  // 6. 청구 / 수납 (BILLING 관련)
  if (etype === 'BILLING' || cat.includes('BILLING') || cat.includes('COLLECTION')) {
    if (!eid) return true;
    if (db.billings.length === 0) return false;
    const bill = db.billings.find(b => b.id === eid);
    if (!bill) return true;
    const bStatus = (bill.status || '').toUpperCase();
    if (bStatus === 'PAID' || bStatus === 'CANCELLED' || bStatus === 'COMPLETED') return true;
    return false;
  }

  // 7. 매입 정산 (SETTLEMENT 관련)
  if (etype === 'SETTLEMENT' || cat.includes('SETTLEMENT')) {
    if (!eid) return true;
    if (db.purchaseSettlements.length === 0) return false;
    const stl = db.purchaseSettlements.find(s => s.id === eid);
    if (!stl) return true;
    const sStatus = (stl.status || '').toUpperCase();
    if (sStatus === 'PAID' || sStatus === 'CONFIRMED' || sStatus === 'COMPLETED') return true;
    return false;
  }

  // 8. 고객 정보 보완 (CUSTOMER / MISSING_INFO)
  if (etype === 'CUSTOMER' || t.type === 'MISSING_INFO') {
    if (!eid) return true;
    if (db.customers.length === 0) return false;
    const cust = db.customers.find(c => c.id === eid);
    if (!cust) return true;
    if (cust.bizRegNo && cust.bizRegNo !== '미상' && cust.bizRegNo.trim() !== '') return true;
    return false;
  }

  // 9. 소모품 구매/입고 (CONSUMABLE)
  if (etype === 'CONSUMABLE' || cat.includes('CONSUMABLE')) {
    if (!eid) return true;
    if (db.consumablePurchases.length === 0) return false;
    const cp = db.consumablePurchases.find(p => p.id === eid);
    if (!cp) return true;
    const cpStatus = (cp.status || '').toUpperCase();
    if (cpStatus === 'COMPLETED' || cpStatus === 'INBOUNDED' || cpStatus === 'CANCELLED') return true;
    return false;
  }

  // 10. 연차 신청 (LEAVE)
  if (etype === 'LEAVE' || cat.includes('LEAVE')) {
    if (!eid) return true;
    if (db.leaveUsages.length === 0) return false;
    const lv = db.leaveUsages.find(l => l.id === eid);
    if (!lv) return true;
    const lvStatus = ((lv as any).status || '').toUpperCase();
    if (lvStatus === 'APPROVED' || lvStatus === 'REJECTED' || lvStatus === 'COMPLETED' || lvStatus === 'CANCELLED') return true;
    return false;
  }

  // 11. 계약 일반 (CONTRACT)
  if (etype === 'CONTRACT') {
    if (!eid) return true;
    if (db.contracts.length === 0) return false;
    const contract = db.contracts.find(c => c.id === eid);
    if (!contract) return true;
    const cStatus = (contract.status || '').toUpperCase();
    if (cStatus === 'TERMINATED' || cStatus === 'CANCELLED' || cStatus === 'COMPLETED') return true;
    if (cat === 'SITE_ARRIVAL_CONFIRM' && db.contractAssets.length > 0) {
      const cAssets = db.contractAssets.filter(ca => ca.contractId === contract.id);
      if (cAssets.length > 0 && cAssets.every(ca => ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 🧹 [2.6] 기완료된 미결 ToDo를 일괄 스캔하여 DB 상에서 완료(isCompleted: true) 처리하는 정리 헬퍼
 */
export function reconcileCompletedTodosInDb(): number {
  const nowIso = new Date().toISOString();
  let cleanedCount = 0;
  (db.todos || []).forEach(t => {
    if (!t.isCompleted && isTaskEntityAlreadyResolved(t)) {
      db.updateRow<Todo>('todos', t.id, {
        isCompleted: true,
        completedAt: nowIso,
        completionAction: '원장 상태 연동 자동 상계',
        updatedAt: nowIso
      });
      cleanedCount += 1;
    }
  });
  return cleanedCount;
}

/**
 * 🔄 [2.7] 실시간 도메인 원장(장비 할당, 출고 검수, 배차 운송, 현장 AS, 입고 수리)에서
 * 실제 미완결 상태인 업무를 스캔하여, DB todos에 누락된 건이 있더라도 대시보드에 100% 직결 노출시키는 동기화 엔진
 */
export function synthesizeMissingDomainTasks(existingOpenTodos: Todo[]): Todo[] {
  const synthesized: Todo[] = [];
  const nowIso = new Date().toISOString();

  const contractMap = new Map((db.contracts || []).map(c => [c.id, c]));
  const customerMap = new Map((db.customers || []).map(c => [c.id, c]));
  const siteMap = new Map((db.sites || []).map(s => [s.id, s]));
  const assetMap = new Map((db.assets || []).map(a => [a.id, a]));
  const userMap = new Map((db.users || []).map(u => [u.id, u]));

  const extractCaIdsFromDelivery = (d: any): string[] => {
    if (!d?.cargoItems) return [];
    try {
      const raw = typeof d.cargoItems === 'string' ? JSON.parse(d.cargoItems) : d.cargoItems;
      if (!Array.isArray(raw)) return [];
      const ids: string[] = [];
      raw.forEach((ci: any) => {
        if (Array.isArray(ci?.contractAssetIds)) {
          ids.push(...ci.contractAssetIds.filter(Boolean));
        }
      });
      return ids;
    } catch {
      return [];
    }
  };

  // ── 1. [장비 할당] (dispatch_assign / asset_assignment.tsx 직결) ──
  const completedInspCaIds = new Set<string>();
  (db.outboundInspections || []).forEach(ins => {
    if (ins.status === 'COMPLETED' && (ins as any).contractAssetId) {
      completedInspCaIds.add((ins as any).contractAssetId);
    }
  });

  const unassignedByContract = new Map<string, typeof db.contractAssets>();
  (db.contractAssets || []).forEach(ca => {
    if (!ca.contractId) return;
    if (ca.status === 'RETURNED' || ca.status === 'SOLD' || ca.status === 'RENTED') return;
    if (completedInspCaIds.has(ca.id)) return;
    if (ca.assetId) return; // 미할당 슬롯만 추출
    const c = contractMap.get(ca.contractId);
    if (!c) return;
    const cSt = (c.status || '').toUpperCase();
    if (cSt === 'CANCELLED' || cSt === 'TERMINATED' || cSt === 'COMPLETED') return;
    const list = unassignedByContract.get(ca.contractId) || [];
    list.push(ca);
    unassignedByContract.set(ca.contractId, list);
  });

  const outboundDeliveriesByContract = new Map<string, typeof db.deliveries>();
  (db.deliveries || []).forEach(d => {
    if (!d.contractId || d.status === 'CANCELLED' || d.status === 'DELIVERED' || (d.status as string) === 'COMPLETED') return;
    const isOutOrEx =
      d.type === 'OUTBOUND' ||
      d.type === 'EXCHANGE' ||
      d.dispatchCategory === '출고' ||
      d.dispatchCategory === '교환' ||
      (d as any).originalDispatchCategory === '출고' ||
      (d as any).originalDispatchCategory === '교환';
    if (!isOutOrEx) return;
    const list = outboundDeliveriesByContract.get(d.contractId) || [];
    list.push(d);
    outboundDeliveriesByContract.set(d.contractId, list);
  });

  unassignedByContract.forEach((unassignedSlots, contractId) => {
    const c = contractMap.get(contractId);
    if (!c) return;
    const custName = (c.customerId && customerMap.get(c.customerId)?.name) || (c as any).customerName || '고객사';
    const siteName = (c.siteId && siteMap.get(c.siteId)?.name) || (c as any).siteName || '현장';
    const salespersonName = (c.salespersonId && userMap.get(c.salespersonId)?.name) || '영업부';

    const cDeliveries = (outboundDeliveriesByContract.get(contractId) || []).slice().sort((a, b) =>
      (b.createdAt || b.requestDate || '').localeCompare(a.createdAt || a.requestDate || '')
    );

    const claimedCaIds = new Set<string>();
    const groups: { delivery?: (typeof db.deliveries)[number]; slots: typeof db.contractAssets }[] = [];

    for (const d of cDeliveries) {
      const dCaIds = new Set(extractCaIdsFromDelivery(d));
      if (dCaIds.size === 0) continue;
      const matched = unassignedSlots.filter(ca => dCaIds.has(ca.id) && !claimedCaIds.has(ca.id));
      if (matched.length === 0) continue;
      matched.forEach(ca => claimedCaIds.add(ca.id));
      groups.push({ delivery: d, slots: matched });
    }

    const remaining = unassignedSlots.filter(ca => !claimedCaIds.has(ca.id));
    if (remaining.length > 0) {
      const fallbackDeliv = cDeliveries.find(d => extractCaIdsFromDelivery(d).length === 0) || (groups.length === 0 ? cDeliveries[0] : undefined);
      groups.push({ delivery: fallbackDeliv, slots: remaining });
    }

    groups.forEach(grp => {
      const targetEntityId = grp.delivery?.id || c.id;
      const alreadyExists = existingOpenTodos.some(
        t =>
          (t.taskCategory || '').toUpperCase().includes('ASSIGN') &&
          (t.entityId === targetEntityId || t.relatedEntityId === targetEntityId || t.entityId === c.id)
      );
      if (alreadyExists) return;

      const modelCounts = new Map<string, number>();
      grp.slots.forEach(s => {
        const m = s.expectedModel || '미지정';
        modelCounts.set(m, (modelCounts.get(m) || 0) + 1);
      });
      const modelSummary = Array.from(modelCounts.entries())
        .map(([m, cnt]) => `${m} × ${cnt}대`)
        .join(', ');
      const schedDate = (
        grp.delivery?.loadingDate ||
        grp.delivery?.scheduledDate ||
        grp.slots.map(s => s.startDate).filter(Boolean).sort().pop() ||
        c.startDate ||
        ''
      ).slice(0, 10);
      const isExchange =
        grp.delivery?.type === 'EXCHANGE' ||
        grp.delivery?.dispatchCategory === '교환' ||
        (db.contractHistory || []).some(h => h.contractId === c.id && h.changeType === 'EXCHANGE');

      synthesized.push({
        id: `SYNTH-ASSIGN-${targetEntityId}`,
        userId: 'u-1',
        targetType: 'DEPT',
        targetDept: 'YARD',
        taskCategory: 'ASSET_ASSIGNMENT',
        type: isExchange ? 'URGENT' : 'GENERAL',
        priority: isExchange ? 'URGENT' : 'HIGH',
        title: `[장비 할당] ${custName} (미할당 ${grp.slots.length}대)`,
        content: `${siteName} | 미할당 요구: ${modelSummary}${schedDate ? ` | 출고예정: ${schedDate}` : ''}`,
        dueDate: schedDate || undefined,
        actionUrl: `/admin/dispatch_assign?contractId=${c.id}${grp.delivery ? `&deliveryId=${grp.delivery.id}` : ''}`,
        entityType: grp.delivery ? 'DELIVERY' : 'CONTRACT',
        entityId: targetEntityId,
        relatedEntityId: c.id,
        senderName: salespersonName,
        isCompleted: false,
        createdAt: grp.delivery?.createdAt || c.createdAt || nowIso,
        updatedAt: grp.delivery?.updatedAt || c.updatedAt || nowIso,
      });
    });
  });

  // ── 2. [출고 검수] (outbound_inspections / outbound_inspections.tsx 직결) ──
  const pendingInsGroups = new Map<string, typeof db.outboundInspections>();
  (db.outboundInspections || []).forEach(ins => {
    if (ins.status !== 'PENDING' && ins.status !== 'IN_PROGRESS') return;
    if (!ins.contractId || !contractMap.has(ins.contractId)) return;
    if (ins.deliveryId) {
      const d = (db.deliveries || []).find(x => x.id === ins.deliveryId);
      if (d && (d.status === 'CANCELLED' || d.status === 'DELIVERED' || (d.status as string) === 'COMPLETED')) return;
    }
    if ((ins as any).contractAssetId) {
      const ca = (db.contractAssets || []).find(x => x.id === (ins as any).contractAssetId);
      if (ca && (ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD')) return;
    }
    if (ins.assetId) {
      const a = assetMap.get(ins.assetId);
      if (a && a.status === 'RENTED') return;
    }
    const key = ins.deliveryId || ins.contractId;
    const list = pendingInsGroups.get(key) || [];
    list.push(ins);
    pendingInsGroups.set(key, list);
  });

  pendingInsGroups.forEach((insList, groupKey) => {
    const first = insList[0];
    const c = first.contractId ? contractMap.get(first.contractId) : undefined;
    const deliv = first.deliveryId ? (db.deliveries || []).find(d => d.id === first.deliveryId) : undefined;
    const alreadyExists = existingOpenTodos.some(t => {
      const cat = (t.taskCategory || '').toUpperCase();
      const et = (t.entityType || '').toUpperCase();
      if (et !== 'INSPECTION' && !cat.includes('INSPECTION') && !cat.includes('PDI')) return false;
      return (
        t.entityId === groupKey ||
        t.relatedEntityId === groupKey ||
        (first.deliveryId && (t.entityId === first.deliveryId || t.relatedEntityId === first.deliveryId)) ||
        (first.contractId && t.entityId === first.contractId && !first.deliveryId) ||
        insList.some(i => i.id === t.entityId)
      );
    });
    if (alreadyExists) return;

    const custName = (c?.customerId && customerMap.get(c.customerId)?.name) || (c as any)?.customerName || '고객사';
    const siteName = (c?.siteId && siteMap.get(c.siteId)?.name) || (c as any)?.siteName || '현장';
    const hasInProgress = insList.some(i => i.status === 'IN_PROGRESS');
    const statusLabel = hasInProgress ? '검수 진행중' : '검수 대기';
    const driverLabel = deliv?.driverName ? ` · ${deliv.driverName} 배정` : '';
    const loadingDate = (deliv?.loadingDate || deliv?.scheduledDate || c?.startDate || '').slice(0, 10);
    const assetNos = insList
      .map(i => (i.assetId ? assetMap.get(i.assetId)?.assetNo : undefined))
      .filter(Boolean)
      .join(', ');

    synthesized.push({
      id: `SYNTH-INSP-${groupKey}`,
      userId: 'u-1',
      targetType: 'DEPT',
      targetDept: 'YARD',
      taskCategory: 'OUTBOUND_PDI_INSPECTION',
      type: 'GENERAL',
      priority: 'HIGH',
      title: `[출고 검수] ${custName} (${insList.length}대 ${statusLabel}${driverLabel})`,
      content: `${siteName}${assetNos ? ` | 할당장비: ${assetNos}` : ''}${loadingDate ? ` | 상차예정: ${loadingDate}` : ''}`,
      dueDate: loadingDate || undefined,
      actionUrl: `/admin/outbound_inspections?deliveryId=${first.deliveryId || ''}&contractId=${first.contractId || ''}`,
      entityType: 'INSPECTION',
      entityId: first.deliveryId || first.contractId || first.id,
      relatedEntityId: first.contractId,
      senderName: '장비할당시스템',
      isCompleted: false,
      createdAt: first.createdAt || deliv?.createdAt || nowIso,
      updatedAt: first.updatedAt || deliv?.updatedAt || nowIso,
    });
  });

  // ── 2.5 [배차 관리] (delivery / TruckDispatch.tsx / MobileDispatchList.tsx 직결) ──
  (db.deliveries || []).forEach(d => {
    const dSt = (d.status || '').toUpperCase();
    if (dSt !== 'PENDING' && dSt !== 'REQUESTED') return;
    if (!d.contractId || !contractMap.has(d.contractId)) return;
    const c = contractMap.get(d.contractId)!;
    const cSt = (c.status || '').toUpperCase();
    if (cSt === 'CANCELLED' || cSt === 'TERMINATED' || cSt === 'COMPLETED') return;
    if (d.driverName || d.vehicleNo || d.loadingCompletedAt || d.unloadingCompletedAt) return;

    const cAssets = (db.contractAssets || []).filter(ca => ca.contractId === d.contractId);
    if (d.type !== 'INBOUND') {
      if (cAssets.length > 0 && cAssets.every(ca => ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD')) {
        return;
      }
    } else {
      if (cAssets.length > 0 && cAssets.every(ca => ca.status === 'RETURNED' || ca.status === 'SOLD')) {
        return;
      }
    }

    const alreadyExists = existingOpenTodos.some(t => {
      const cat = (t.taskCategory || '').toUpperCase();
      const et = (t.entityType || '').toUpperCase();
      if (et !== 'DELIVERY' && !cat.includes('DISPATCH')) return false;
      if (cat.includes('ASSIGN') && !cat.includes('VEHICLE')) return false;
      return t.entityId === d.id || t.relatedEntityId === d.id || (t.entityId === d.contractId && et === 'DELIVERY');
    });
    if (alreadyExists) return;

    const custName = (c.customerId && customerMap.get(c.customerId)?.name) || (c as any).customerName || '고객사';
    const siteName = (c.siteId && siteMap.get(c.siteId)?.name) || (c as any).siteName || '현장';
    const isExchange =
      d.type === 'EXCHANGE' ||
      d.dispatchCategory === '교환' ||
      (db.contractHistory || []).some(h => h.contractId === c.id && h.changeType === 'EXCHANGE');
    const dispatchTypeLabel = isExchange
      ? '교환'
      : d.type === 'INBOUND' || (d.dispatchCategory as string) === '회수' || d.dispatchCategory === '입고'
      ? '회수'
      : '출고';
    const schedDate = (d.loadingDate || d.scheduledDate || d.requestDate || c.startDate || '').slice(0, 10);
    const salespersonName = (c.salespersonId && userMap.get(c.salespersonId)?.name) || '영업부';

    synthesized.push({
      id: `SYNTH-DISP-${d.id}`,
      userId: 'u-1',
      targetType: 'DEPT',
      targetDept: 'DISPATCH',
      taskCategory: 'DISPATCH_VEHICLE_ASSIGN' as any,
      type: isExchange ? 'URGENT' : 'GENERAL',
      priority: isExchange ? 'URGENT' : 'HIGH',
      title: `[배차 관리] ${custName} (${dispatchTypeLabel} 배차 대기)`,
      content: `${siteName}${d.vehicleType ? ` | 요청차종: ${d.vehicleType}` : ''}${schedDate ? ` | 예정일: ${schedDate}` : ''}`,
      dueDate: schedDate || undefined,
      actionUrl: `/admin/delivery?deliveryId=${d.id}&contractId=${c.id}`,
      entityType: 'DELIVERY',
      entityId: d.id,
      relatedEntityId: c.id,
      senderName: salespersonName,
      isCompleted: false,
      createdAt: d.createdAt || c.createdAt || nowIso,
      updatedAt: d.updatedAt || c.updatedAt || nowIso,
    });
  });

  // ── 3-A. [현장 정비 요청] (field_as / FieldAsManagement.tsx / MobileAsList.tsx 직결) ──
  (((db as any).fieldAsTickets || []) as any[]).forEach((tk: any) => {
    const tkSt = (tk.status || '').toUpperCase();
    if (tkSt === 'COMPLETED' || tkSt === 'CANCELED' || tkSt === 'CANCELLED') return;

    const alreadyExists = existingOpenTodos.some(t => {
      const cat = (t.taskCategory || '').toUpperCase();
      const et = (t.entityType || '').toUpperCase();
      if (et !== 'REPAIR' && et !== 'FIELD_AS' && !cat.includes('REPAIR') && !cat.includes('AS')) return false;
      return (
        t.entityId === tk.id ||
        t.entityId === tk.ticketNo ||
        t.relatedEntityId === tk.id ||
        (tk.assetId && t.entityId === tk.assetId && cat === 'AS_DISPATCH_REPAIR')
      );
    });
    if (alreadyExists) return;

    const custName = tk.customerName || (tk.customerId && customerMap.get(tk.customerId)?.name) || '고객사';
    const siteName = tk.siteName || (tk.siteId && siteMap.get(tk.siteId)?.name) || '현장';
    const assetLabel = tk.assetNo || (tk.assetId && assetMap.get(tk.assetId)?.assetNo) || tk.modelName || '장비';
    const symptom = tk.category || tk.issueDescription || '현장점검';
    const isUrgent = tk.priority === 'URGENT';
    const schedDate = (tk.visitScheduledDate || tk.requestDate || '').slice(0, 10);

    synthesized.push({
      id: `SYNTH-FAS-${tk.id}`,
      userId: 'u-1',
      targetType: 'DEPT',
      targetDept: 'AS',
      taskCategory: 'AS_DISPATCH_REPAIR',
      type: isUrgent ? 'URGENT' : 'GENERAL',
      priority: isUrgent ? 'URGENT' : 'HIGH',
      title: `[현장 정비 요청] ${custName} (${assetLabel} · ${symptom})`,
      content: `${siteName} | 증상: ${tk.issueDescription || symptom}${tk.requestDate ? ` | 접수일: ${tk.requestDate.slice(0, 10)}` : ''}`,
      dueDate: schedDate || undefined,
      actionUrl: `/admin/field_as?ticketId=${tk.id}`,
      entityType: 'REPAIR',
      entityId: tk.id,
      relatedEntityId: tk.contractId || tk.id,
      senderName: tk.reporterName || '현장접수',
      isCompleted: false,
      createdAt: tk.createdAt || nowIso,
      updatedAt: tk.updatedAt || tk.createdAt || nowIso,
    });
  });

  // ── 3-B. [입고 수리 / 현장 정비 보조] (repairs 직결) ──
  (db.repairs || []).forEach(rep => {
    const rSt = (rep.status || '').toUpperCase();
    if (rSt === 'COMPLETED' || rSt === 'CANCELLED' || rSt === 'RESOLVED' || rSt === 'WAIVED') return;

    const alreadyExists =
      existingOpenTodos.some(t => {
        const cat = (t.taskCategory || '').toUpperCase();
        const et = (t.entityType || '').toUpperCase();
        if (et !== 'REPAIR' && !cat.includes('REPAIR') && !cat.includes('AS')) return false;
        return t.entityId === rep.id || t.relatedEntityId === rep.id || (rep.assetId && t.entityId === rep.assetId);
      }) ||
      synthesized.some(t => t.entityId === rep.id || (rep.assetId && t.relatedEntityId === rep.assetId && t.taskCategory === 'INBOUND_REPAIR_DEFECT'));
    if (alreadyExists) return;

    const isFieldAs = (rep as any).workCategory === 'FIELD_AS' || (rep as any).workLocation === 'SITE';
    const custName = (rep as any).customerName || (rep.contractId && contractMap.get(rep.contractId)?.customerId && customerMap.get(contractMap.get(rep.contractId)!.customerId)?.name) || '고객사';
    const siteName = (rep as any).siteName || (rep.contractId && contractMap.get(rep.contractId)?.siteId && siteMap.get(contractMap.get(rep.contractId)!.siteId!)?.name) || '현장';
    const assetLabel = (rep as any).assetNo || (rep.assetId && assetMap.get(rep.assetId)?.assetNo) || (rep as any).modelName || '장비';
    const symptom = (rep as any).issueCategory || rep.issueDescription || (rep as any).symptom || '점검 요망';

    if (isFieldAs) {
      synthesized.push({
        id: `SYNTH-AS-${rep.id}`,
        userId: 'u-1',
        targetType: 'DEPT',
        targetDept: 'AS',
        taskCategory: 'AS_DISPATCH_REPAIR',
        type: 'URGENT',
        priority: 'HIGH',
        title: `[현장 정비 요청] ${custName} (${assetLabel} · ${symptom})`,
        content: `${siteName} | 증상: ${symptom}${(rep as any).requestDate ? ` | 접수일: ${(rep as any).requestDate}` : ''}`,
        dueDate: (rep as any).scheduleDate || (rep as any).requestDate || undefined,
        actionUrl: `/admin/field_as?ticketId=${rep.id}`,
        entityType: 'REPAIR',
        entityId: rep.id,
        relatedEntityId: rep.contractId || rep.id,
        senderName: (rep as any).reporterName || '현장접수',
        isCompleted: false,
        createdAt: rep.createdAt || nowIso,
        updatedAt: (rep as any).updatedAt || rep.createdAt || nowIso,
      });
    } else {
      synthesized.push({
        id: `SYNTH-REP-${rep.id}`,
        userId: 'u-1',
        targetType: 'DEPT',
        targetDept: 'YARD',
        taskCategory: 'INBOUND_REPAIR_DEFECT',
        type: 'GENERAL',
        priority: 'HIGH',
        title: `[입고 수리/정비] ${assetLabel} (${symptom})`,
        content: `주기장 입고 정비 대기 | 사유: ${symptom}`,
        actionUrl: `/admin/repairs?repairId=${rep.id}${rep.assetId ? `&assetId=${rep.assetId}` : ''}`,
        entityType: 'REPAIR',
        entityId: rep.id,
        relatedEntityId: rep.assetId || rep.id,
        senderName: '입고검수시스템',
        isCompleted: false,
        createdAt: rep.createdAt || nowIso,
        updatedAt: (rep as any).updatedAt || rep.createdAt || nowIso,
      });
    }
  });

  return synthesized;
}

export function resolveTaskMenuId(t: Todo): string {
  const cat = (t.taskCategory || '').toUpperCase();
  const etype = (t.entityType || '').toUpperCase();
  const url = (t.actionUrl || '').toLowerCase();
  const eid = (t.entityId || t.relatedEntityId || '').toUpperCase();

  if (cat.includes('ASSIGN') && !cat.includes('VEHICLE')) {
    return 'dispatch_assign';
  }
  if (url.includes('dispatch_assign') || url.includes('asset_assignment')) {
    return 'dispatch_assign';
  }
  if (etype === 'INSPECTION' || cat.includes('INSPECTION') || cat.includes('PDI') || url.includes('outbound_inspections')) {
    return 'outbound_inspections';
  }
  if (cat === 'AS_DISPATCH_REPAIR' || etype === 'FIELD_AS' || eid.startsWith('FAS-') || url.includes('field_as')) {
    return 'field_as';
  }
  if (etype === 'REPAIR' || cat.includes('REPAIR') || url.includes('repairs') || url.includes('/repair')) {
    return 'repair';
  }
  if (etype === 'DELIVERY' || cat.includes('DISPATCH') || cat.includes('SHIPMENT') || url.includes('/dispatch') || url.includes('/delivery')) {
    return 'delivery';
  }
  if (cat.includes('DELINQUEN') || url.includes('delinquency')) {
    return 'delinquency';
  }
  if (cat === 'CONTRACT_PACKAGE_RESEND' || cat === 'SITE_ARRIVAL_CONFIRM' || etype === 'CONTRACT' || url.includes('contract')) {
    return 'contract';
  }
  if (etype === 'BILLING' || cat.includes('BILLING') || cat.includes('COLLECTION') || url.includes('billing') || url.includes('receivables')) {
    return 'billing';
  }
  if (etype === 'SETTLEMENT' || cat.includes('SETTLEMENT') || url.includes('purchase_settlement')) {
    return 'purchase_settlement';
  }
  if (etype === 'CONSUMABLE' || cat.includes('CONSUMABLE') || url.includes('consumable_purchase') || url.includes('consumable')) {
    return 'consumable_purchase';
  }
  if (etype === 'LEAVE' || cat.includes('LEAVE') || url.includes('leave')) {
    return 'leave_management';
  }
  if (etype === 'CUSTOMER' || t.type === 'MISSING_INFO' || url.includes('customer')) {
    return 'customer';
  }
  return '';
}

/**
 * 🏛️ 부서 모드('SALES' | 'OUTBOUND' | 'AS' | 'ADMIN' | 'EXECUTIVE')별 단일 업무 매칭 SSOT
 * PC 대시보드(Dashboard.tsx)와 모바일 웹앱(MobileHome / MobileAdminHome / MobileExecutiveHome)이
 * 100% 동일한 조건으로 부서별 담당 업무를 판별하도록 보장한다.
 */
export function matchesDepartmentTask(
  t: Todo,
  deptMode: 'SALES' | 'OUTBOUND' | 'AS' | 'ADMIN' | 'EXECUTIVE'
): boolean {
  const taskMenuId = resolveTaskMenuId(t);
  const cat = (t.taskCategory || '').toUpperCase();
  const td = (t.targetDept || '').toUpperCase();
  const title = t.title || '';

  if (deptMode === 'EXECUTIVE') {
    return td === 'EXECUTIVE' || td.includes('경영') || td.includes('대표');
  }

  if (deptMode === 'SALES') {
    return (
      td === 'SALES' ||
      td.includes('영업') ||
      cat === 'CONTRACT_PACKAGE_RESEND' ||
      cat === 'SITE_ARRIVAL_CONFIRM' ||
      taskMenuId === 'contract' ||
      taskMenuId === 'delinquency' ||
      (taskMenuId === 'customer' && td !== 'ADMIN' && td !== 'ACCOUNTING')
    );
  }

  if (deptMode === 'OUTBOUND') {
    return (
      taskMenuId === 'dispatch_assign' ||
      taskMenuId === 'outbound_inspections' ||
      taskMenuId === 'repair' ||
      cat === 'OUTBOUND_SHIPMENT_START' ||
      title.includes('상차 출발') ||
      td === 'YARD' ||
      td.includes('출고') ||
      td.includes('주기장')
    );
  }

  if (deptMode === 'AS') {
    return (
      taskMenuId === 'field_as' ||
      taskMenuId === 'repair' ||
      td === 'AS' ||
      td.includes('정비')
    );
  }

  if (deptMode === 'ADMIN') {
    return (
      taskMenuId === 'delivery' ||
      taskMenuId === 'billing' ||
      taskMenuId === 'delinquency' ||
      taskMenuId === 'purchase_settlement' ||
      taskMenuId === 'consumable_purchase' ||
      taskMenuId === 'leave_management' ||
      taskMenuId === 'customer' ||
      td === 'DISPATCH' ||
      td === 'ACCOUNTING' ||
      td === 'ADMIN' ||
      td.includes('관리') ||
      td.includes('배차') ||
      td.includes('회계') ||
      td.includes('총무')
    );
  }

  return false;
}

/**
 * 📱 모바일 웹앱에서 각 업무(Todo)의 `[처리 이동]` 클릭 시 연결될 모바일 탭 ID 반환 SSOT
 */
export function resolveMobileTabForTask(t: Todo): string {
  const menuId = resolveTaskMenuId(t);
  const cat = (t.taskCategory || '').toUpperCase();
  const url = (t.actionUrl || '').toLowerCase();

  if (menuId === 'dispatch_assign') return 'assignment';
  if (menuId === 'outbound_inspections') return 'inspection';
  if (menuId === 'delivery') return 'dispatch';
  if (menuId === 'field_as' || menuId === 'repair') return 'as';
  if (menuId === 'contract') return 'my_contracts';
  if (menuId === 'customer') return 'customers';
  if (menuId === 'delinquency' || menuId === 'billing' || cat.includes('DELINQUEN') || cat.includes('COLLECTION')) {
    return 'delinquency';
  }
  if (url.includes('inbound_register') || url.includes('asset_inout') || cat.includes('INBOUND_REGISTER')) {
    return 'inbound_register';
  }
  if (menuId === 'consumable_purchase' || url.includes('consumable')) {
    return 'consumable_stock';
  }
  if (url.includes('rent_asset') || url.includes('sublease') || cat.includes('SUBLEASE')) {
    return 'sublease';
  }
  if (url.includes('sales_order') || url.includes('smart_dispatch')) {
    return 'sales_order';
  }
  return 'assets';
}

/**
 * 🏷️ PC 대시보드 및 모바일 웹앱 공통 업무 배지(메뉴명 + 담당부서명) 반환 SSOT
 */
export function getTaskDisplayBadges(t: Todo): { menuLabel: string; deptLabel: string; categoryKey: 'ASSIGN' | 'INSPECT' | 'DISPATCH' | 'REPAIR' } {
  const menuId = resolveTaskMenuId(t);
  const td = (t.targetDept || '').toUpperCase();

  const menuLabel =
    menuId === 'dispatch_assign' ? '장비 할당' :
    menuId === 'outbound_inspections' ? '출고 검수' :
    menuId === 'delivery' ? '배차 관리' :
    menuId === 'field_as' ? '현장 정비' :
    menuId === 'repair' ? '입고 정비' :
    menuId === 'contract' ? '계약 관리' :
    menuId === 'delinquency' ? '연체 관리' :
    menuId === 'billing' ? '청구/수납' :
    menuId === 'purchase_settlement' ? '매입 정산' :
    menuId === 'consumable_purchase' ? '소모품 관리' :
    menuId === 'leave_management' ? '근태 결재' :
    menuId === 'customer' ? '고객 관리' : '일반 업무';

  const deptLabel =
    td === 'YARD' || menuId === 'dispatch_assign' || menuId === 'outbound_inspections' ? '출고팀' :
    td === 'DISPATCH' || menuId === 'delivery' ? '배차/관리부' :
    td === 'AS' || menuId === 'field_as' ? 'AS팀' :
    menuId === 'repair' ? '출고/AS팀' :
    td === 'SALES' || menuId === 'contract' ? '영업부' :
    td === 'ACCOUNTING' || td === 'ADMIN' || menuId === 'billing' || menuId === 'delinquency' || menuId === 'purchase_settlement' ? '관리부' :
    t.targetDept || '공통';

  const categoryKey: 'ASSIGN' | 'INSPECT' | 'DISPATCH' | 'REPAIR' =
    menuId === 'dispatch_assign' ? 'ASSIGN' :
    menuId === 'outbound_inspections' ? 'INSPECT' :
    menuId === 'delivery' ? 'DISPATCH' : 'REPAIR';

  return { menuLabel, deptLabel, categoryKey };
}

/**
 * 🔍 [3] 로그인 사용자의 직무·권한·부서에 특화된 활성 ToDo 필터링 헬퍼
 */
export function findActiveTasksForUser(
  todos: Todo[],
  currentUser: { id?: string; department?: string; role?: string } | null,
  hasPermission?: (menuId: string, action: 'view' | 'save') => boolean,
  overrideDeptMode?: string
): Todo[] {
  if (!currentUser) return [];

  const rawDept = (currentUser.department || '').toUpperCase();
  const rawRole = (currentUser.role || '').toUpperCase();
  const rawPos = ((currentUser as any).position || '').toUpperCase();
  const rawIsExec =
    rawDept.includes('경영') ||
    rawDept.includes('대표') ||
    rawPos.includes('대표') ||
    rawPos.includes('사장') ||
    rawPos.includes('임원') ||
    rawRole === 'EXECUTIVE';

  // 사용자의 실제 소속 부서 판별
  const naturalSales = rawDept.includes('SALES') || rawDept.includes('영업') || rawRole.includes('SALES');
  const naturalYard = rawDept.includes('YARD') || rawDept.includes('출고') || rawDept.includes('주기장');
  const naturalAs = rawDept.includes('AS') || rawDept.includes('정비') || rawRole.includes('MECHANIC');
  const naturalDispatch = rawDept.includes('DISPATCH') || rawDept.includes('배차') || rawDept.includes('운송') || rawRole.includes('LOGISTICS');
  const naturalAdmin = rawDept.includes('관리') || rawDept.includes('총무') || rawDept.includes('회계') || naturalDispatch;

  // 🏛️ overrideDeptMode(모바일 부서 퀵체인저 등)가 지정된 경우 해당 부서 모드 적용
  const activeMode = overrideDeptMode?.toUpperCase() as ('SALES' | 'OUTBOUND' | 'AS' | 'ADMIN' | 'EXECUTIVE' | undefined);
  const isDeptOverride = !!activeMode && activeMode !== 'EXECUTIVE';
  const isExec = !isDeptOverride && (activeMode === 'EXECUTIVE' || rawIsExec);

  // 현재 조회 모드가 로그인 사용자의 실제 소속 부서와 일치하는지 확인 (일치 시 개인 지정 ToDo도 함께 표시)
  const isOwnDeptView =
    !isDeptOverride ||
    (activeMode === 'SALES' && naturalSales) ||
    (activeMode === 'OUTBOUND' && naturalYard) ||
    (activeMode === 'AS' && naturalAs) ||
    (activeMode === 'ADMIN' && naturalAdmin);

  // 1. DB todos 중 미완료 + 원장 교차검증 통과 건 추출
  const openDbTodos = (todos || []).filter(t => !t.isCompleted && !isTaskEntityAlreadyResolved(t));

  // 2. 실시간 도메인 원장(장비 할당, 출고 검수, 배차 관리, 현장 AS, 입고 정비)에서 누락된 미완결 업무 자동 합성 병합
  const synthesizedTodos = synthesizeMissingDomainTasks(openDbTodos);
  const combinedOpenTodos = [...openDbTodos, ...synthesizedTodos];

  const filtered = combinedOpenTodos.filter(t => {
    const taskMenuId = resolveTaskMenuId(t);
    const td = (t.targetDept || '').toUpperCase();

    // 1. 특정 개인에게 지정된 건은 타 직원은 볼 수 없음 (격리)
    if (t.targetType === 'USER' && t.assignedUserId && t.assignedUserId !== currentUser.id) {
      return false;
    }

    // 2. 경영진(EXECUTIVE)은 전사 모든 부서의 일반 미결 업무를 조회하지 않고, 경영진 직접 지정 건만 표시
    if (isExec) {
      if (t.assignedUserId && t.assignedUserId === currentUser.id) return true;
      return matchesDepartmentTask(t, 'EXECUTIVE');
    }

    // 3. 본인에게 직접 지정된 개인 ToDo (본인 소속 부서 뷰이거나 해당 부서 성격에 부합할 때)
    if (t.assignedUserId && t.assignedUserId === currentUser.id) {
      if (isOwnDeptView) return true;
      if (activeMode && matchesDepartmentTask(t, activeMode)) return true;
    }

    // 4. 부서 모드(overrideDeptMode)가 명시된 경우 단일 부서 매칭 SSOT(matchesDepartmentTask) 적용
    if (isDeptOverride && activeMode) {
      return matchesDepartmentTask(t, activeMode);
    }

    // 5. 🛡️ PC 대시보드(overrideDeptMode 미지정)에서도 로그인 사용자의 소속 부서 R&R과 100% 동일한 조건 적용
    if (naturalSales && !naturalYard && !naturalAs && !naturalAdmin) {
      return matchesDepartmentTask(t, 'SALES');
    }

    let matchedByDept = false;
    if (naturalSales && matchesDepartmentTask(t, 'SALES')) matchedByDept = true;
    if (naturalYard && matchesDepartmentTask(t, 'OUTBOUND')) matchedByDept = true;
    if (naturalAs && matchesDepartmentTask(t, 'AS')) matchedByDept = true;
    if (naturalAdmin && matchesDepartmentTask(t, 'ADMIN')) matchedByDept = true;
    if (matchedByDept) return true;

    // 6. 🎯 권한 기반 대시보드 직결 (소속 부서가 미지정이거나 복합 권한 담당자인 경우)
    if (hasPermission && taskMenuId) {
      if (hasPermission(taskMenuId, 'view')) {
        return true;
      }
    }

    // 7. 타겟 부서/역할 폴백 매칭
    if (td && rawDept.includes(td)) return true;
    if (t.targetRole) {
      const tr = t.targetRole.toUpperCase();
      if (rawRole.includes(tr)) return true;
    }

    return false;
  });

  // 정렬 우선순위:
  // 1) EXECUTIVE_DIRECTIVE (경영진 특별지시) 최우선
  // 2) priority (URGENT > HIGH > NORMAL > LOW)
  // 3) 마감기한 임박순 / 최신순
  return filtered.sort((a, b) => {
    const isAExec = a.taskCategory === 'EXECUTIVE_DIRECTIVE' ? 1 : 0;
    const isBExec = b.taskCategory === 'EXECUTIVE_DIRECTIVE' ? 1 : 0;
    if (isAExec !== isBExec) return isBExec - isAExec;

    const pWeight = (p?: string) => (p === 'URGENT' ? 4 : p === 'HIGH' ? 3 : p === 'NORMAL' ? 2 : 1);
    const pDiff = pWeight(b.priority) - pWeight(a.priority);
    if (pDiff !== 0) return pDiff;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * 🎯 [3.5] ToDo 항목에서 대상 메뉴 이동 시 즉시 해당 건을 자동 선택/포커스하기 위한 딥링크 페이로드 빌더
 */
export interface TaskNavigationPayload {
  todoId?: string;
  entityId?: string;
  entityType?: string;
  taskCategory?: string;
  deliveryId?: string;
  contractId?: string;
  inspectionId?: string;
  repairId?: string;
  ticketId?: string;
  billingId?: string;
  customerId?: string;
  assetId?: string;
  actionUrl?: string;
}

export function buildTaskNavigationPayload(task: Todo): TaskNavigationPayload {
  const eid = (task.entityId || task.relatedEntityId || '').trim();
  const etype = (task.entityType || '').toUpperCase();
  const cat = (task.taskCategory || '').toUpperCase();
  const rawUrl = (task.actionUrl || '').trim();

  const payload: TaskNavigationPayload = {
    todoId: task.id,
    entityId: eid || undefined,
    entityType: etype || undefined,
    taskCategory: cat || undefined,
    actionUrl: rawUrl || undefined,
  };

  // 1. actionUrl 쿼리 파라미터 파싱 (?contractId=..., ?deliveryId=..., ?customerId=... 등)
  if (rawUrl.includes('?')) {
    try {
      const qs = rawUrl.split('?')[1];
      const params = new URLSearchParams(qs);
      if (params.get('contractId')) payload.contractId = params.get('contractId')!;
      if (params.get('deliveryId')) payload.deliveryId = params.get('deliveryId')!;
      if (params.get('inspectionId')) payload.inspectionId = params.get('inspectionId')!;
      if (params.get('repairId')) payload.repairId = params.get('repairId')!;
      if (params.get('ticketId')) payload.ticketId = params.get('ticketId')!;
      if (params.get('billingId')) payload.billingId = params.get('billingId')!;
      if (params.get('customerId')) payload.customerId = params.get('customerId')!;
      if (params.get('assetId')) payload.assetId = params.get('assetId')!;
    } catch {}
  }

  // 2. ID 접두어 및 엔티티 타입 기반 자동 매핑
  if (eid) {
    if (eid.startsWith('DLV-') || eid.startsWith('DEL-') || etype === 'DELIVERY') {
      payload.deliveryId = payload.deliveryId || eid;
      const d = db.deliveries.find(x => x.id === eid);
      if (d?.contractId && !payload.contractId) {
        payload.contractId = d.contractId;
      }
    } else if (eid.startsWith('OIN-') || etype === 'INSPECTION') {
      if (eid.startsWith('OIN-')) {
        payload.inspectionId = payload.inspectionId || eid;
        const ins = db.outboundInspections.find(x => x.id === eid);
        if (ins?.deliveryId && !payload.deliveryId) payload.deliveryId = ins.deliveryId;
        if (ins?.contractId && !payload.contractId) payload.contractId = ins.contractId;
      } else {
        // INSPECTION 업무인데 entityId가 DLV-... 또는 CONT-... 인 경우
        if (eid.startsWith('CONT')) payload.contractId = payload.contractId || eid;
        else payload.deliveryId = payload.deliveryId || eid;
      }
    } else if (eid.startsWith('CONT') || etype === 'CONTRACT') {
      payload.contractId = payload.contractId || eid;
    } else if (eid.startsWith('FAS-') || eid.startsWith('AS-') || etype === 'FIELD_AS' || cat === 'AS_DISPATCH_REPAIR') {
      payload.ticketId = payload.ticketId || eid;
      const tk = (((db as any).fieldAsTickets || []) as any[]).find((x: any) => x.id === eid || x.ticketNo === eid);
      if (tk?.assetId && !payload.assetId) payload.assetId = tk.assetId;
      if (tk?.contractId && !payload.contractId) payload.contractId = tk.contractId;
    } else if (eid.startsWith('REP-') || etype === 'REPAIR') {
      payload.repairId = payload.repairId || eid;
      const rep = db.repairs.find(x => x.id === eid);
      if (rep?.assetId && !payload.assetId) payload.assetId = rep.assetId;
    } else if (eid.startsWith('BILL-') || eid.startsWith('BIL-') || etype === 'BILLING') {
      payload.billingId = payload.billingId || eid;
      const bill = (db.billings || []).find(x => x.id === eid);
      if (bill?.customerId && !payload.customerId) payload.customerId = bill.customerId;
    } else if (eid.startsWith('CUST-') || etype === 'CUSTOMER') {
      payload.customerId = payload.customerId || eid;
    } else if (eid.startsWith('AST-') || etype === 'ASSET') {
      payload.assetId = payload.assetId || eid;
    }
  }

  return payload;
}

/**
 * 🚀 [4] 출고 진행 중 자산 변경 감지 시 계약서패키지 재발송 ToDo 자동 발행
 */
export async function checkAndIssuePackageResendTask(params: {
  contractId: string;
  oldAssetId?: string;
  newAssetId?: string;
  reason?: string;
  senderName?: string;
}): Promise<Todo | null> {
  const contract = db.contracts.find(c => c.id === params.contractId);
  if (!contract) return null;

  // 1. 해당 계약에 고객 발송 이력이 존재하는지 확인 (월간 안전점검 체크리스트 제외)
  const sentHistories = db.contractHistory.filter(
    h =>
      h.contractId === params.contractId &&
      h.changeType === 'DOCUMENT_SENT' &&
      !(h.description && h.description.includes('월간 안전점검 체크리스트'))
  );
  if (sentHistories.length === 0) {
    // 발송된 적이 없으면 변경되어도 재발송 ToDo 불필요 (초기 출고 정상 진행)
    return null;
  }

  // 2. 자산 정보 및 고객사 정보 조회
  const oldAsset = params.oldAssetId ? db.assets.find(a => a.id === params.oldAssetId) : undefined;
  const newAsset = params.newAssetId ? db.assets.find(a => a.id === params.newAssetId) : undefined;
  const customer = db.customers.find(c => c.id === contract.customerId);

  const oldAssetStr = oldAsset ? `${oldAsset.assetNo}(${oldAsset.modelName})` : '기존장비';
  const newAssetStr = newAsset ? `${newAsset.assetNo}(${newAsset.modelName})` : '신규대체장비';
  const custName = customer?.name || '고객사';

  // 3. 이미 미완료 상태인 동일 계약의 CONTRACT_PACKAGE_RESEND ToDo가 있다면 내용만 갱신 (Idempotency 보장)
  const existingTodo = db.todos.find(
    t => !t.isCompleted && t.entityId === contract.id && t.taskCategory === 'CONTRACT_PACKAGE_RESEND'
  );

  const title = `[계약서패키지 재발송 필요] ${contract.contractNo} (${custName})`;
  const content = `출고 진행 중 자산이 변경(${oldAssetStr} ➔ ${newAssetStr})되었습니다.\n` +
    `기존 발송된 패키지 구성 서류(반입전점검표, 안전인증서, 제원표 등)와 실출고 장비가 불일치하므로, 서류를 갱신하여 고객사(${custName})로 재발송해 주십시오.` +
    (params.reason ? `\n• 교체 사유: ${params.reason}` : '');

  if (existingTodo) {
    return db.updateRow<Todo>('todos', existingTodo.id, {
      title,
      content,
      updatedAt: new Date().toISOString()
    });
  }

  // 4. ToDo 신규 발행
  // 대상: 계약 담당자 및 계약서패키지 발송 권한자
  const todo = await issueHandoverTask({
    category: 'CONTRACT_PACKAGE_RESEND',
    title,
    content,
    priority: 'HIGH',
    targetType: 'DEPT',
    targetDept: 'SALES',
    assignedUserId: contract.salespersonId || undefined,
    actionUrl: '/admin/contract',
    entityType: 'CONTRACT',
    entityId: contract.id,
    senderName: params.senderName || '출고검수시스템'
  });

  return todo;
}
