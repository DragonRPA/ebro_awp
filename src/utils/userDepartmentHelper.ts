// src/utils/userDepartmentHelper.ts
import { User, Department } from '../services/db';

export type MobileDeptMode = 'SALES' | 'AS' | 'OUTBOUND' | 'EXECUTIVE' | 'ADMIN';

/**
 * 🏛️ 조직도 기반 사용자의 소속 부서명 도출
 */
export function getUserDepartmentName(
  user: User | { departmentId?: string | null; department?: string } | null,
  departments: Department[] = []
): string {
  if (!user) return '미배정';

  if (user.departmentId) {
    const matched = departments.find(d => d.id === user.departmentId);
    if (matched && matched.name) return matched.name;

    const dId = String(user.departmentId).toUpperCase();
    if (dId.includes('0000001') || dId === 'DEPT-1') return '기연리프트';
    if (dId.includes('0000002') || dId === 'DEPT-2') return '관리부';
    if (dId.includes('0000003') || dId === 'DEPT-3') return '영업부';
    if (dId.includes('0000004') || dId === 'DEPT-4') return '출고팀';
    if (dId.includes('0000005') || dId === 'DEPT-5') return 'AS팀';
    if (dId.includes('0000006') || dId === 'DEPT-6') return '외국인';
  }

  if (user.department && user.department.trim()) {
    return user.department.trim();
  }

  return '미배정';
}

/**
 * 🏛️ 조직계층 레벨 계산 (1: 최상위 조직/본사/경영진, 2: 1차 사업부서, 3: 하위부서/외국인, 999: 미배정)
 */
export function getUserHierarchyLevel(
  user: User | { id?: string; loginId?: string; departmentId?: string | null; department?: string; position?: string; role?: string } | null,
  departments: Department[] = []
): number {
  if (!user) return 999;

  // 1. 대표/사장/임원 직급 우선 판정
  const pos = (user.position || '').toLowerCase();
  if (['대표', '대표이사', '사장', '부사장', '총괄'].some(p => pos.includes(p))) {
    return 1;
  }

  // 2. Department 트리 구조 탐색: parentDepartmentId가 없는 최상위 부서 소속인 경우 Level 1 (경영진)
  if (user.departmentId && departments.length > 0) {
    const userDept = departments.find(d => d.id === user.departmentId);
    if (userDept) {
      if (userDept.parentDepartmentId === null || userDept.parentDepartmentId === '') {
        return 1;
      }
      let level = 1;
      let cur: Department | undefined = userDept;
      const visited = new Set<string>();
      while (cur && cur.parentDepartmentId) {
        if (visited.has(cur.id)) break;
        visited.add(cur.id);
        cur = departments.find(d => d.id === cur!.parentDepartmentId);
        level++;
        if (level > 20) break;
      }
      return level;
    }
  }

  // 3. Fallback: 부서명/부서ID 기반
  const dName = getUserDepartmentName(user, departments);
  const dId = String(user.departmentId || '').toUpperCase();
  if (dId.includes('0000001') || dId === 'DEPT-1' || dName === '기연리프트' || dName.includes('본사') || dName.includes('경영')) {
    return 1;
  }
  if (['관리부', '영업부', '출고팀', 'AS팀'].some(d => dName.includes(d))) {
    return 2;
  }

  return 3;
}

/**
 * 🏛️ 개발자(특수 존재) 여부 판정
 * "개발자는 조직이 어디로 되어있던지 실존하는 직원이 아니므로 무시하되 그냥 모든 권한이 있는 예외적인 존재로 작동해야 한다."
 */
export function isDeveloperUser(user: { id?: string; loginId?: string; role?: string; name?: string } | null): boolean {
  if (!user) return false;
  return (
    user.id === 'sys-admin' ||
    user.id === 'u-1' ||
    user.loginId === 'admin' ||
    user.role === 'ADMIN' ||
    user.name === '개발자'
  );
}

/**
 * 🏛️ 직원의 실제 소속에 따른 MobileDeptMode 단일 결정
 */
export function resolveUserMobileDeptMode(
  user: User | { id?: string; loginId?: string; role?: string; position?: string; departmentId?: string | null; department?: string } | null,
  departments: Department[] = []
): MobileDeptMode {
  if (!user) return 'SALES';

  // 1. 조직도 최상위 레벨(Level 1) 또는 대표/사장/임원은 EXECUTIVE(경영진 모드)
  const hierarchyLevel = getUserHierarchyLevel(user, departments);
  if (hierarchyLevel === 1) {
    return 'EXECUTIVE';
  }

  const deptName = getUserDepartmentName(user, departments).toUpperCase();
  const role = (user.role || '').toUpperCase();

  if (deptName.includes('영업') || role.includes('SALES')) {
    return 'SALES';
  }
  if (deptName.includes('AS') || deptName.includes('정비') || deptName.includes('외국인') || role.includes('MECHANIC')) {
    return 'AS';
  }
  if (deptName.includes('출고') || deptName.includes('주기장') || role.includes('YARD')) {
    return 'OUTBOUND';
  }
  if (deptName.includes('관리') || deptName.includes('총무') || deptName.includes('회계') || role.includes('ADMIN') || role.includes('OFFICE') || role.includes('ACCOUNTING')) {
    return 'ADMIN';
  }

  return 'SALES';
}
