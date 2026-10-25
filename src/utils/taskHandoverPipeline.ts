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

  const eid = (t.entityId || t.relatedEntityId || '').trim();
  const cat = (t.taskCategory || '').toUpperCase();
  const etype = (t.entityType || '').toUpperCase();

  // 0. 경영진 특별지시(EXECUTIVE_DIRECTIVE)는 명시적 완료 처리 전까지 유지 (단, 연결된 대상 엔티티가 삭제된 경우는 제외)
  if (cat === 'EXECUTIVE_DIRECTIVE') {
    return false;
  }

  // 1. 계약서패키지 재발송 (CONTRACT_PACKAGE_RESEND)
  if (cat === 'CONTRACT_PACKAGE_RESEND') {
    if (!eid) return true;
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
                return ca && ca.status !== 'RETURNED' && ca.status !== 'SOLD' && !ca.assetId;
              });
              if (!hasUnassigned) return true;
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
        ca => ca.contractId === contract.id && ca.status !== 'RETURNED' && ca.status !== 'SOLD' && !ca.assetId
      );
      if (unassignedSlots.length === 0) return true;
    } else if (!deliv) {
      const slot = db.contractAssets.find(ca => ca.id === eid);
      if (!slot || Boolean(slot.assetId) || slot.status === 'RETURNED' || slot.status === 'SOLD') return true;
    }
    return false;
  }

  // 3. 출고검수 / PDI (INSPECTION 관련)
  if (etype === 'INSPECTION' || cat.includes('INSPECTION') || cat.includes('PDI')) {
    if (!eid) return true;
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
        if (!ca || ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD') return true;
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
        if (i.status !== 'PENDING') return false;
        if (i.deliveryId) {
          const d = db.deliveries.find(x => x.id === i.deliveryId);
          if (d && d.status === 'CANCELLED') return false;
        }
        if ((i as any).contractAssetId) {
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
    const deliv = db.deliveries.find(d => d.id === eid);
    if (deliv) {
      const dStatus = (deliv.status || '').toUpperCase();
      if (dStatus === 'CANCELLED' || dStatus === 'DELIVERED' || dStatus === 'COMPLETED') return true;
      if (deliv.unloadingCompletedAt) return true;

      // 배차 매칭 요청(DISPATCH_REQUEST 등)인데 이미 기사/차량이 배정되어 DISPATCHED 상태이거나 상차 완료된 경우
      const isDriverAssigned = Boolean(
        dStatus === 'DISPATCHED' &&
        (deliv.driverName || deliv.vehicleNo || deliv.transportCompany || deliv.loadingCompletedAt)
      );
      if (isDriverAssigned && !cat.includes('ARRIVAL') && !cat.includes('UNLOAD')) {
        return true;
      }

      // 출고 배차인데 연결된 체결자산이 이미 모두 대여중(RENTED) 또는 반납완료(RETURNED)인 경우
      if (deliv.type === 'OUTBOUND' && deliv.contractId) {
        const cAssets = db.contractAssets.filter(ca => ca.contractId === deliv.contractId);
        if (cAssets.length > 0 && cAssets.every(ca => ca.status === 'RENTED' || ca.status === 'RETURNED' || ca.status === 'SOLD')) {
          return true;
        }
      }
      // 회수/입고 배차인데 연결된 자산이 이미 주기장 입고 완료된 경우
      if (deliv.type === 'INBOUND' && deliv.contractId) {
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

  // 5. 정비 / AS (REPAIR 관련)
  if (etype === 'REPAIR' || cat.includes('REPAIR') || cat.includes('AS')) {
    if (!eid) return true;
    const rep = db.repairs.find(r => r.id === eid);
    if (rep) {
      const rStatus = (rep.status || '').toUpperCase();
      if (rStatus === 'COMPLETED' || rStatus === 'CANCELLED' || rStatus === 'WAIVED' || rStatus === 'RESOLVED') return true;
      return false;
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
    const bill = db.billings.find(b => b.id === eid);
    if (!bill) return true;
    const bStatus = (bill.status || '').toUpperCase();
    if (bStatus === 'PAID' || bStatus === 'CANCELLED' || bStatus === 'COMPLETED') return true;
    return false;
  }

  // 7. 매입 정산 (SETTLEMENT 관련)
  if (etype === 'SETTLEMENT' || cat.includes('SETTLEMENT')) {
    if (!eid) return true;
    const stl = db.purchaseSettlements.find(s => s.id === eid);
    if (!stl) return true;
    const sStatus = (stl.status || '').toUpperCase();
    if (sStatus === 'PAID' || sStatus === 'CONFIRMED' || sStatus === 'COMPLETED') return true;
    return false;
  }

  // 8. 고객 정보 보완 (CUSTOMER / MISSING_INFO)
  if (etype === 'CUSTOMER' || t.type === 'MISSING_INFO') {
    if (!eid) return true;
    const cust = db.customers.find(c => c.id === eid);
    if (!cust) return true;
    if (cust.bizRegNo && cust.bizRegNo !== '미상' && cust.bizRegNo.trim() !== '') return true;
    return false;
  }

  // 9. 소모품 구매/입고 (CONSUMABLE)
  if (etype === 'CONSUMABLE' || cat.includes('CONSUMABLE')) {
    if (!eid) return true;
    const cp = db.consumablePurchases.find(p => p.id === eid);
    if (!cp) return true;
    const cpStatus = (cp.status || '').toUpperCase();
    if (cpStatus === 'COMPLETED' || cpStatus === 'INBOUNDED' || cpStatus === 'CANCELLED') return true;
    return false;
  }

  // 10. 연차 신청 (LEAVE)
  if (etype === 'LEAVE' || cat.includes('LEAVE')) {
    if (!eid) return true;
    const lv = db.leaveUsages.find(l => l.id === eid);
    if (!lv) return true;
    const lvStatus = ((lv as any).status || '').toUpperCase();
    if (lvStatus === 'APPROVED' || lvStatus === 'REJECTED' || lvStatus === 'COMPLETED' || lvStatus === 'CANCELLED') return true;
    return false;
  }

  // 11. 계약 일반 (CONTRACT)
  if (etype === 'CONTRACT') {
    if (!eid) return true;
    const contract = db.contracts.find(c => c.id === eid);
    if (!contract) return true;
    const cStatus = (contract.status || '').toUpperCase();
    if (cStatus === 'TERMINATED' || cStatus === 'CANCELLED' || cStatus === 'COMPLETED') return true;
    if (cat === 'SITE_ARRIVAL_CONFIRM') {
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
 * 🔍 [3] 로그인 사용자의 직무·부서에 특화된 활성 ToDo 필터링 헬퍼
 */
export function findActiveTasksForUser(
  todos: Todo[],
  currentUser: { id?: string; department?: string; role?: string } | null,
  hasPermission?: (menuId: string, action: 'view' | 'save') => boolean,
  overrideDeptMode?: string
): Todo[] {
  if (!currentUser || !todos) return [];

  const rawDept = (currentUser.department || '').toUpperCase();
  const rawRole = (currentUser.role || '').toUpperCase();
  const rawIsExec = rawDept.includes('경영') || rawDept.includes('대표') || rawRole === 'ADMIN' || rawRole === 'MASTER' || rawRole === 'EXECUTIVE';

  // 🏛️ overrideDeptMode(모바일 부서 퀵체인저 등)가 지정된 경우 해당 부서 시뮬레이션 모드 강제 적용
  // 사용자가 특정 부서 탭을 선택하여 보고 있을 때는 관리자/경영진이라도 해당 부서의 R&R 렌즈로 격리 필터링
  const activeMode = overrideDeptMode?.toUpperCase();
  const isSimulation = !!activeMode && activeMode !== 'EXECUTIVE';
  const isExec = !isSimulation && rawIsExec;

  // 🏛️ 유효 부서 식별 플래그
  const isSalesDept = isSimulation ? (activeMode === 'SALES') : (rawDept.includes('SALES') || rawDept.includes('영업') || rawRole.includes('SALES'));
  const isYardDept = isSimulation ? (activeMode === 'OUTBOUND') : (rawDept.includes('YARD') || rawDept.includes('출고') || rawDept.includes('주기장'));
  const isAsDept = isSimulation ? (activeMode === 'AS') : (rawDept.includes('AS') || rawDept.includes('정비') || rawRole.includes('MECHANIC'));
  const isAdminDept = isSimulation ? (activeMode === 'ADMIN') : (rawDept.includes('관리') || rawDept.includes('총무') || rawDept.includes('회계') || rawRole.includes('ADMIN'));
  // 🚚 [기연리프트 R&R] 배차 업무는 관리부 소관
  const isDispatchDept = isSimulation ? (activeMode === 'ADMIN') : (isAdminDept || rawDept.includes('DISPATCH') || rawDept.includes('배차') || rawDept.includes('운송') || rawRole.includes('LOGISTICS'));

  const filtered = todos.filter(t => {
    if (t.isCompleted) return false;
    // 원장 엔티티 상태와 교차 검증하여 이미 처리 완료된 업무는 즉시 제외
    if (isTaskEntityAlreadyResolved(t)) return false;

    // 0. 🛡️ [전사 표준 헌장 2.1 영업 부서와 출고/배차/자산 부서 간 R&R 엄격 분리]
    // 일반 부서원 또는 부서 시뮬레이션 모드에서는 자신의 R&R과 무관한 타 부서 전용 업무가 노출되지 않도록 상위에서 강력 차단
    if (!isExec) {
      // 0-1. 영업부 모드/임직원:
      // 배차, 주기장, 정비 타겟 업무는 절대 영업부 대시보드에 노출되지 않음
      if (isSalesDept) {
        const isSalesPermitted = 
          t.taskCategory === 'CONTRACT_PACKAGE_RESEND' ||
          t.taskCategory === 'SITE_ARRIVAL_CONFIRM' ||
          t.targetDept === 'SALES' ||
          (!isSimulation && t.assignedUserId && t.assignedUserId === currentUser.id);

        if (!isSalesPermitted) {
          // 배차 의뢰, 상차 출발, PDI 검수, 수리 등은 배차/출고/AS팀 전용
          if (t.targetDept === 'DISPATCH' || t.targetDept === 'YARD' || t.targetDept === 'AS' ||
              t.taskCategory?.includes('DISPATCH') || t.taskCategory?.includes('SHIPMENT') ||
              t.taskCategory?.includes('INSPECTION') || t.taskCategory?.includes('PDI') ||
              t.taskCategory?.includes('REPAIR') || t.entityType === 'DELIVERY' || t.entityType === 'INSPECTION' || t.entityType === 'REPAIR') {
            return false;
          }
        }
      }

      // 0-2. AS팀 모드/임직원:
      // 배차, 주기장, 영업 타겟 업무는 절대 AS팀 대시보드에 노출되지 않음
      if (isAsDept) {
        const isAsPermitted = 
          t.targetDept === 'AS' ||
          t.taskCategory?.includes('AS') ||
          t.taskCategory?.includes('REPAIR') ||
          t.entityType === 'REPAIR' ||
          (!isSimulation && t.assignedUserId && t.assignedUserId === currentUser.id);

        if (!isAsPermitted) {
          return false;
        }
      }

      // 0-3. 출고팀(주기장) 모드/임직원:
      // 배차, 정비, 영업 타겟 업무는 출고팀 대시보드에서 차단
      if (isYardDept && !isAdminDept) {
        if (t.targetDept === 'DISPATCH' || t.targetDept === 'AS' || t.targetDept === 'SALES' ||
            t.taskCategory?.includes('DISPATCH') || t.entityType === 'DELIVERY' ||
            (!t.targetDept && (t.taskCategory?.includes('AS') || t.taskCategory?.includes('CONTRACT')))) {
          if (!isSimulation && t.assignedUserId && t.assignedUserId === currentUser.id) {
            // 본인 직접 할당 예외
          } else {
            return false;
          }
        }
      }

      // 0-4. 타겟 부서가 명시되어 있고 현재 활성 부서와 다른 경우 차단
      if (t.targetDept && (isSimulation || !t.assignedUserId || t.assignedUserId !== currentUser.id)) {
        const td = t.targetDept.toUpperCase();
        if (td === 'DISPATCH' && !isDispatchDept) return false;
        if (td === 'YARD' && !isYardDept) return false;
        if (td === 'AS' && !isAsDept) return false;
        if (td === 'SALES' && !isSalesDept) return false;
        if (td === 'ACCOUNTING' && !isAdminDept) return false;
        if (td === 'ADMIN' && !isAdminDept) return false;
      }
    }

    // 1. 개인 지정 ToDo: 본인에게 직접 지정된 경우 (시뮬레이션 모드가 아닐 때만)
    if (!isSimulation && t.assignedUserId && t.assignedUserId === currentUser.id) return true;

    // 1-1. 특정 개인에게 지정된 건은 타 일반 직원은 볼 수 없음 (격리)
    if (t.targetType === 'USER' && t.assignedUserId && t.assignedUserId !== currentUser.id) {
      return isExec; // 경영진만 감독 목적으로 조회 가능
    }

    // 2. 최고관리자/경영진은 전사 미결 ToDo 모두 조망 가능 (단, overrideDeptMode 시뮬레이션 중이 아닐 때)
    if (isExec) return true;

    // 3. 타겟 부서 매칭
    if (t.targetDept) {
      const td = t.targetDept.toUpperCase();
      if (td === 'DISPATCH' && isDispatchDept) return true;
      if (td === 'YARD' && (isYardDept || rawRole.includes('YARD') || rawRole.includes('MECHANIC'))) return true;
      if (td === 'AS' && (isAsDept || rawRole.includes('MECHANIC'))) return true;
      if (td === 'ACCOUNTING' && isAdminDept) return true;
      if (td === 'SALES' && isSalesDept) return true;
      if (td === 'ADMIN' && isAdminDept) return true;
      if (!isSimulation && rawDept.includes(td)) return true;
    }

    // 4. 타겟 역할 매칭
    if (!isSimulation && t.targetRole) {
      const tr = t.targetRole.toUpperCase();
      if (rawRole.includes(tr)) return true;
    }

    // 5. 🌟 계약서패키지 재발송 ToDo: 발송 권한 보유자 또는 영업/출고 부서원 매칭
    if (t.taskCategory === 'CONTRACT_PACKAGE_RESEND') {
      if (t.assignedUserId && t.assignedUserId === currentUser.id) return true;
      if (isSalesDept) return true;
      if (isDispatchDept || isYardDept) return true;
      if (hasPermission && (hasPermission('contract', 'view') || hasPermission('agent_badge', 'view'))) return true;
    }

    // 6. 업무 카테고리별 시스템 메뉴 권한 매칭 (해당 부서 업무에 한함)
    if (hasPermission) {
      if (isDispatchDept && (t.taskCategory?.includes('DISPATCH') || t.entityType === 'DELIVERY') && hasPermission('delivery', 'view')) return true;
      if ((isYardDept || isAsDept) && (t.taskCategory?.includes('INSPECTION') || t.entityType === 'INSPECTION') && (hasPermission('outbound_inspections', 'view') || hasPermission('repair', 'view'))) return true;
      if (isYardDept && t.taskCategory?.includes('ASSIGN') && hasPermission('dispatch_assign', 'view')) return true;
      if (isAsDept && (t.taskCategory?.includes('AS') || t.entityType === 'REPAIR') && (hasPermission('repair', 'view') || hasPermission('field_as', 'view'))) return true;
      if (t.entityType === 'BILLING' && hasPermission('billing', 'view')) return true;
      if (isSalesDept && t.entityType === 'CONTRACT' && hasPermission('contract', 'view')) return true;
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
