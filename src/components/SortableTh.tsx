import React from 'react';
import { SortConfig, SortDirection } from '../hooks/useSortableData';

export interface SortableThProps {
  label?: React.ReactNode;
  children?: React.ReactNode;
  sortKey?: string;
  columnKey?: string;
  currentSort?: SortConfig | null;
  currentSortKey?: string | null;
  currentDirection?: SortDirection | null;
  onSort: (key: any) => void;
  style?: React.CSSProperties;
  className?: string;
  align?: 'left' | 'center' | 'right';
  width?: string | number;
}

/**
 * 3-State 정렬 헤더 셀 (Sortable Table Header)
 * - 오름차순(▲) / 내림차순(▼) / 정렬안함(↕)
 * - 클릭 시 3단계 순환 토글: None ➔ 오름차순 ➔ 내림차순 ➔ 정렬안함
 * - sticky thead 및 셀 줄바꿈 방지(nowrap) 내장
 */
export const SortableTh: React.FC<SortableThProps> = ({ 
  label, 
  children,
  sortKey, 
  columnKey,
  currentSort, 
  currentSortKey,
  currentDirection,
  onSort, 
  style, 
  className, 
  align = 'left',
  width 
}) => {
  const effectiveKey = sortKey || columnKey || '';
  const isSorted = currentSort ? currentSort.key === effectiveKey : currentSortKey === effectiveKey;
  const direction = isSorted ? (currentSort ? currentSort.direction : currentDirection) : null;
  const content = children !== undefined ? children : label;
  
  const getJustify = () => {
    if (align === 'center') return 'center';
    if (align === 'right') return 'flex-end';
    return 'flex-start';
  };

  const getTitle = () => {
    const labelStr = typeof content === 'string' ? content : effectiveKey;
    if (direction === 'asc') return `${labelStr}: 현재 [오름차순] (클릭 시 내림차순)`;
    if (direction === 'desc') return `${labelStr}: 현재 [내림차순] (클릭 시 정렬안함)`;
    return `${labelStr}: 현재 [정렬안함] (클릭 시 오름차순)`;
  };

  return (
    <th 
      style={{ 
        cursor: 'pointer', 
        userSelect: 'none', 
        whiteSpace: 'nowrap',
        width,
        transition: 'background-color 0.15s ease',
        ...style 
      }} 
      className={className}
      onClick={() => onSort(effectiveKey)}
      title={getTitle()}
    >
      <div style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '4px', 
        justifyContent: getJustify(), 
        width: align === 'center' ? '100%' : undefined 
      }}>
        <span>{content}</span>
        <span style={{ 
          fontSize: '11px', 
          fontWeight: isSorted ? 700 : 400,
          color: isSorted ? 'var(--primary)' : 'var(--text-muted)', 
          opacity: isSorted ? 1 : 0.35,
          lineHeight: 1,
          display: 'inline-block',
          marginLeft: '2px',
          verticalAlign: 'middle'
        }}>
          {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕'}
        </span>
      </div>
    </th>
  );
};

export default SortableTh;
