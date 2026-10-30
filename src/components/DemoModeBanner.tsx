// src/components/DemoModeBanner.tsx
// ebro_awp 시연 데모 모드 상단 고정 배너 및 기연리프트 DB 복제 / 데이터 초기화 컴포넌트

import React, { useState } from 'react';
import { isDemoMode, exitDemoMode, resetDemoDataToGolden, cloneKiyeunProdToDemoDb } from '../services/demoMode';
import { RotateCcw, LogOut, Database, Loader2 } from 'lucide-react';

export const DemoModeBanner: React.FC = () => {
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isDemoMode()) return null;

  const handleCloneKiyeunDb = async () => {
    if (
      !window.confirm(
        '기연리프트 실운영 DB의 최신 데이터를 현재 시연 데이터베이스로 전체 복제하시겠습니까?\n\n' +
          '• 기연리프트 실운영 DB에는 아무런 영향을 주지 않습니다 (읽기 전용 조회).\n' +
          '• 현재 시연 DB의 기존 테스트 데이터는 모두 삭제되고 기연리프트 최신 데이터로 덮어쓰기됩니다.'
      )
    ) {
      return;
    }

    setIsBusy(true);
    setStatusMessage('기연리프트 DB 복제 준비 중...');

    const res = await cloneKiyeunProdToDemoDb((msg) => {
      setStatusMessage(msg);
    });

    if (res.success) {
      setStatusMessage(
        `기연리프트 DB 복제 완료! (${res.tableCount || 0}개 테이블, ${(res.totalRows || 0).toLocaleString()}건) 화면을 새로고침합니다...`
      );
      setTimeout(() => {
        window.location.reload();
      }, 900);
    } else {
      alert(`기연리프트 DB 복제 실패: ${res.error}`);
      setIsBusy(false);
      setStatusMessage(null);
    }
  };

  const handleReset = async () => {
    if (
      !window.confirm(
        '시연용 가상 데이터를 최초 골든 상태로 전체 초기화하시겠습니까?\n(등록/수정된 모든 테스트 데이터가 초기화됩니다)'
      )
    ) {
      return;
    }

    setIsBusy(true);
    setStatusMessage('데이터 초기화 준비 중...');

    const res = await resetDemoDataToGolden((msg) => {
      setStatusMessage(msg);
    });

    if (res.success) {
      setStatusMessage('초기화 완료! 화면을 새로고침합니다...');
      setTimeout(() => {
        window.location.reload();
      }, 900);
    } else {
      alert(`초기화 실패: ${res.error}`);
      setIsBusy(false);
      setStatusMessage(null);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#0f172a',
        color: '#ffffff',
        borderBottom: '2px solid #2563eb',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12px',
        fontWeight: 600,
        zIndex: 99999,
        position: 'relative',
        whiteSpace: 'nowrap',
        gap: '12px',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.5px',
            border: '1px solid #60a5fa'
          }}
        >
          시연
        </span>
        <span style={{ color: '#93c5fd', fontWeight: 800 }}>ebro_awp 시연 모드</span>
        <span style={{ color: '#cbd5e1', fontSize: '11.5px', fontWeight: 500 }}>
          | 가상 시연 데이터베이스 연결됨
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
        {isBusy && (
          <span
            style={{
              color: '#38bdf8',
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid #0284c7',
              borderRadius: '5px',
              padding: '3px 10px',
              fontSize: '11.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Loader2 size={13} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            {statusMessage}
          </span>
        )}

        <button
          type="button"
          onClick={handleCloneKiyeunDb}
          disabled={isBusy}
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: '1.5px solid #60a5fa',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)'
          }}
          title="기연리프트 실운영 DB의 최신 데이터를 시연 DB로 즉시 1:1 복제합니다"
        >
          <Database size={13} />
          기연리프트 DB 복제
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={isBusy}
          style={{
            backgroundColor: '#d97706',
            color: '#ffffff',
            border: '1.5px solid #fbbf24',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)'
          }}
          title="모든 데모 데이터를 초기 골든 상태로 재설정합니다"
        >
          <RotateCcw size={13} />
          데이터 초기화
        </button>

        <button
          type="button"
          onClick={exitDemoMode}
          disabled={isBusy}
          style={{
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: '1.5px solid #f87171',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)'
          }}
          title="실운영 모드로 복귀합니다"
        >
          <LogOut size={13} />
          실운영 전환
        </button>
      </div>
    </div>
  );
};
