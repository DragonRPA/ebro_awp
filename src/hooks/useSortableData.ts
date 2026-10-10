import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

/**
 * 3단계 토글 정렬 훅 (오름차순 ➔ 내림차순 ➔ 정렬안함)
 * - 한국어 문자열 localeCompare('ko', { numeric: true }) 완벽 지원
 * - 쉼표 포함 숫자(₩, 건, 대, 원 등), 날짜, 불리언 자동 파싱 비교
 * - 정렬안함(null) 시 원본 순서(Array insertion order) 100% 보존
 */
export function useSortableData<T>(
  items: T[], 
  initialConfig: SortConfig | null = null,
  getSortValue?: (item: T, key: string) => any
) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(initialConfig);

  const sortedItems = useMemo(() => {
    if (!items || items.length <= 1) return items;
    if (!sortConfig || !sortConfig.direction) {
      return items;
    }

    const sortableItems = [...items];
    const { key, direction } = sortConfig;

    sortableItems.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (getSortValue) {
        aValue = getSortValue(a, key);
        bValue = getSortValue(b, key);
      } else {
        // Handle nested keys like "customer.name"
        const keys = key.split('.');
        aValue = a;
        bValue = b;
        for (const k of keys) {
          aValue = aValue != null ? (aValue as any)[k] : undefined;
          bValue = bValue != null ? (bValue as any)[k] : undefined;
        }
      }

      // 1. null / undefined / 빈값 처리: 항상 맨 뒤로 배치
      const aEmpty = aValue === undefined || aValue === null || aValue === '';
      const bEmpty = bValue === undefined || bValue === null || bValue === '';
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      // 2. 숫자(Number) 직접 비교
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // 3. Date 객체 비교
      if (aValue instanceof Date && bValue instanceof Date) {
        return direction === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
      }

      // 4. 불리언(Boolean) 비교
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        const numA = aValue ? 1 : 0;
        const numB = bValue ? 1 : 0;
        return direction === 'asc' ? numA - numB : numB - numA;
      }

      // 5. 문자열 전처리 및 숫자 추출 (예: "₩1,200,000", "12대", "3건", "2026-10-11")
      const strA = String(aValue).trim();
      const strB = String(bValue).trim();

      // 통화/단위 기호 제거 후 순수 숫자로 변환 가능한지 검사
      const cleanNumA = strA.replace(/^[₩$\s]+|[,\s대건개원명]/g, '');
      const cleanNumB = strB.replace(/^[₩$\s]+|[,\s대건개원명]/g, '');
      if (cleanNumA !== '' && cleanNumB !== '' && !isNaN(Number(cleanNumA)) && !isNaN(Number(cleanNumB))) {
        const numA = Number(cleanNumA);
        const numB = Number(cleanNumB);
        return direction === 'asc' ? numA - numB : numB - numA;
      }

      // 6. 날짜 형식 문자열 ("YYYY-MM-DD" or "YYYY.MM.DD")
      const dateRegex = /^\d{4}[-./]\d{1,2}[-./]\d{1,2}/;
      if (dateRegex.test(strA) && dateRegex.test(strB)) {
        const timeA = new Date(strA.replace(/\./g, '-')).getTime();
        const timeB = new Date(strB.replace(/\./g, '-')).getTime();
        if (!isNaN(timeA) && !isNaN(timeB)) {
          return direction === 'asc' ? timeA - timeB : timeB - timeA;
        }
      }

      // 7. 한글/영문 텍스트 사전식 정렬 (numeric: true 적용으로 'A10'이 'A2' 뒤로 정렬)
      const comp = strA.localeCompare(strB, 'ko', { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? comp : -comp;
    });

    return sortableItems;
  }, [items, sortConfig, getSortValue]);

  // 3단계 토글: None ➔ asc ➔ desc ➔ None
  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null; // 정렬안함 (초기 원본 상태로 복귀)
      }
    }
    setSortConfig(direction ? { key, direction } : null);
  };

  const resetSort = () => {
    setSortConfig(null);
  };

  return { 
    items: sortedItems, 
    sortedData: sortedItems,
    requestSort, 
    handleSort: requestSort,
    sortConfig, 
    sortKey: sortConfig?.key || null,
    sortDirection: sortConfig?.direction || null,
    setSortConfig, 
    resetSort 
  };
}
