import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getSystemReadiness, ErpReadinessDiagnostics } from '../services/appReadySignal';

/**
 * 전사 표준 헌장 3.1 (무수식어 건조 명사 UI 표준) 준수 Ready 상태 인디케이터 배지
 */
export const ErpReadinessBadge: React.FC = () => {
  const [readiness, setReadiness] = useState<ErpReadinessDiagnostics>(getSystemReadiness());

  useEffect(() => {
    // 윈도우 커스텀 이벤트 리스닝
    const handleReady = (e: any) => {
      if (e.detail) {
        setReadiness(e.detail);
      }
    };

    window.addEventListener('erp:ready', handleReady);
    // 폴링 인터벌 (1초마다 상태 갱신)
    const timer = setInterval(() => {
      setReadiness(getSystemReadiness());
    }, 1000);

    return () => {
      window.removeEventListener('erp:ready', handleReady);
      clearInterval(timer);
    };
  }, []);

  const isReady = readiness.isReady;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 9px',
        borderRadius: '16px',
        backgroundColor: isReady ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
        border: `1px solid ${isReady ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
        fontSize: '11.5px',
        fontWeight: '700',
        color: isReady ? '#10b981' : '#f59e0b',
        cursor: 'default',
        whiteSpace: 'nowrap',
        userSelect: 'none'
      }}
      title={`시스템 상태: ${isReady ? '준비완료' : '초기화중'}\n활성 메뉴: ${readiness.activeMenu}\n가드레일: 헌장 1.3, 2.3, 4.1, 5.2 활성화`}
      data-uia="badge-erp-readiness"
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: isReady ? '#10b981' : '#f59e0b',
          display: 'inline-block'
        }}
      />
      <span>{isReady ? '준비완료' : '초기화중'}</span>
      {isReady && <ShieldCheck size={12} style={{ opacity: 0.8 }} />}
    </div>
  );
};
