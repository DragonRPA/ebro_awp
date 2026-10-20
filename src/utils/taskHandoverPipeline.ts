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

  // 1. 해당 계약에 고객 발송 이력이 존재하는지 확인
  const sentHistories = db.contractHistory.filter(
    h => h.contractId === params.contractId && h.changeType === 'DOCUMENT_SENT'
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
