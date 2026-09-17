// src/components/DemoModeBanner.tsx
// ebro_awp 시연 데모 모드 상단 고정 배너 및 원클릭 데이터 초기화 컴포넌트

import React, { useState } from 'react';
import { isDemoMode, exitDemoMode, resetDemoDataToGolden } from '../services/demoMode';
import { RotateCcw, LogOut, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const DemoModeBanner: React.FC = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  if (!isDemoMode()) return null;

  const handleReset = async () => {
    if (!window.confirm('시연용 가상 데이터를 최초 골든 상태로 전체 초기화하시겠습니까?\n(등록/수정된 모든 테스트 데이터가 초기화됩니다)')) {
      return;
    }

    setIsResetting(true);
    setResetStatus('데이터 초기화 준비 중...');

    const res = await resetDemoDataToGolden((msg) => {
      setResetStatus(msg);
    });

    if (res.success) {
      setResetStatus('초기화 완료! 화면을 새로고침합니다...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      alert(`초기화 실패: ${res.error}`);
      setIsResetting(false);
      setResetStatus(null);
    }
  };

  return (
    <div style={{
      backgroundColor: '#0f172a',
      color: '#ffffff',
      borderBottom: '2px solid #3b82f6',
      padding: '6px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '12px',
      fontWeight: '600',
      zIndex: 99999,
      position: 'relative',
      whiteSpace: 'nowrap',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{
          backgroundColor: '#2563eb',
          color: '#ffffff',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.5px'
        }}>
          DEMO
        </span>
        <span style={{ color: '#93c5fd', fontWeight: '700' }}>ebro_awp 시연 모드</span>
        <span style={{ color: '#94a3b8', fontSize: '11px' }}>| 가상 시연 데이터베이스 연결됨</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {isResetting && (
          <span style={{ color: '#38bdf8', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Loader2 size={13} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            {resetStatus}
          </span>
        )}

        <button
          type="button"
          onClick={handleReset}
          disabled={isResetting}
          style={{
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #475569',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: '600',
            cursor: isResetting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap'
          }}
          title="모든 데모 데이터를 초기 골든 상태로 재설정합니다"
        >
          <RotateCcw size={12} />
          데이터 초기화
        </button>

        <button
          type="button"
          onClick={exitDemoMode}
          disabled={isResetting}
          style={{
            backgroundColor: '#b91c1c',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: '600',
            cursor: isResetting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap'
          }}
          title="실운영 모드로 복귀합니다"
        >
          <LogOut size={12} />
          실운영 전환
        </button>
      </div>
    </div>
  );
};
