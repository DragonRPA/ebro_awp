import React, { useEffect } from 'react';
import { Printer, CheckCircle2, X } from 'lucide-react';

export interface PrintSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType?: string;
  docTitle: string;
  docNo?: string;
  stationName: string;
  printerName?: string;
  detailMessage?: string;
}

export const PrintSuccessModal: React.FC<PrintSuccessModalProps> = ({
  isOpen,
  onClose,
  docType = '문서',
  docTitle,
  docNo,
  stationName,
  printerName,
  detailMessage
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        data-uia="print-success-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          color: 'var(--text-main, #f8fafc)',
          animation: 'fadeIn 0.15s ease-out'
        }}
      >
        {/* 모달 헤더 */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                backgroundColor: '#10b981',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Printer size={18} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#34d399', letterSpacing: '-0.02em' }}>
                인쇄 요청 전송 완료
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
                프린터 큐에 등록되었습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 요약 그리드 */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '12.5px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>문서 구분</span>
              <span style={{ fontWeight: 800, color: '#60a5fa', whiteSpace: 'nowrap' }}>{docType}</span>
            </div>

            {docNo && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>문서 번호</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#f1f5f9', whiteSpace: 'nowrap' }}>{docNo}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>문서 제목</span>
              <span style={{ fontWeight: 700, color: '#f1f5f9', textAlign: 'right', wordBreak: 'break-all' }}>{docTitle}</span>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border-color, #334155)', margin: '2px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>출력 스테이션</span>
              <span style={{ fontWeight: 800, color: '#34d399', whiteSpace: 'nowrap' }}>
                {stationName} {printerName ? `(${printerName})` : ''}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>처리 상태</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 700,
                fontSize: '11.5px',
                color: '#34d399',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                padding: '2px 8px',
                borderRadius: '6px',
                whiteSpace: 'nowrap'
              }}>
                <CheckCircle2 size={12} /> 전송 완료 (에이전트 출력 대기)
              </span>
            </div>
          </div>

          {detailMessage && (
            <div style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.4', padding: '0 4px' }}>
              {detailMessage}
            </div>
          )}

          <div style={{ fontSize: '11px', color: '#64748b', padding: '0 4px', lineHeight: '1.4' }}>
            현장 스테이션 PC의 eBroAgent가 큐를 감지하여 자동 출력을 진행합니다.
          </div>
        </div>

        {/* 모달 하단 버튼 */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            borderTop: '1px solid var(--border-color, #334155)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}
        >
          <button
            type="button"
            autoFocus
            onClick={onClose}
            style={{
              padding: '8px 22px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
