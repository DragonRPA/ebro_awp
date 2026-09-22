import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;
export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function useSortableData<T>(
  items: T[], 
  initialConfig: SortConfig | null = null,
  getSortValue?: (item: T, key: string) => any
) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(initialConfig);

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null && sortConfig.direction !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (getSortValue) {
          aValue = getSortValue(a, sortConfig.key);
          bValue = getSortValue(b, sortConfig.key);
        } else {
          // Handle nested keys like "customer.name"
          const keys = sortConfig.key.split('.');
          aValue = a;
          bValue = b;
          for (const k of keys) {
            aValue = aValue ? aValue[k as keyof typeof aValue] : undefined;
            bValue = bValue ? bValue[k as keyof typeof bValue] : undefined;
          }
        }

        // String comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comp = aValue.localeCompare(bValue, 'ko');
          return sortConfig.direction === 'asc' ? comp : -comp;
        }
        
        // Number / Boolean / Date fallback
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig, getSortValue]);

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      }
    }
    setSortConfig(direction ? { key, direction } : null);
  };

  return { items: sortedItems, requestSort, sortConfig };
}
