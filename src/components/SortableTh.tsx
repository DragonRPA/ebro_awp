import React from 'react';
import { SortConfig } from '../hooks/useSortableData';

interface SortableThProps {
  label: string;
  sortKey: string;
  currentSort: SortConfig | null;
  onSort: (key: string) => void;
  style?: React.CSSProperties;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export const SortableTh: React.FC<SortableThProps> = ({ 
  label, sortKey, currentSort, onSort, style, className, align = 'left' 
}) => {
  const isSorted = currentSort?.key === sortKey;
  const direction = isSorted ? currentSort.direction : null;
  
  const getJustify = () => {
    if (align === 'center') return 'center';
    if (align === 'right') return 'flex-end';
    return 'flex-start';
  };

  return (
    <th 
      style={{ cursor: 'pointer', userSelect: 'none', ...style }} 
      className={className}
      onClick={() => onSort(sortKey)}
      title={`${label} 기준으로 정렬 (현재: ${direction === 'asc' ? '오름차순' : direction === 'desc' ? '내림차순' : '없음'})`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: getJustify() }}>
        {label}
        <span style={{ 
          fontSize: '10px', 
          color: isSorted ? 'var(--primary)' : 'var(--text-muted)', 
          opacity: isSorted ? 1 : 0.3,
          lineHeight: 1
        }}>
          {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕'}
        </span>
      </div>
    </th>
  );
};
