// src/components/AgentRequiredModal.tsx
// 에이전트가 작동해야 할 시점에 반응하지 않을 때 표출되는 안내 모달

import React, { useState } from 'react';
import { Monitor, X, RefreshCw, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { triggerTenantAgentDownload } from '../services/agentService';
import { useApp } from '../context/AppContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  actionName?: string; // 실패한 작업명 (예: '라벨 인쇄', '계약서패키지 조립')
  onRetry?: () => Promise<boolean> | void;
}

export const AgentRequiredModal: React.FC<Props> = ({
  isOpen,
  onClose,
  actionName = '로컬 연동 작업',
  onRetry
}) => {
  const { currentTenant } = useApp();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = () => {
    triggerTenantAgentDownload(currentTenant);
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryResult(null);
    try {
      // 로컬 에이전트 헬스체크 핑 (5175 포트)
      const res = await fetch('http://127.0.0.1:5175/api/status', { method: 'GET' }).catch(() => null);
      if (res && res.ok) {
        setRetryResult('SUCCESS');
        if (onRetry) {
          await onRetry();
        }
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setRetryResult('FAILED');
      }
    } catch {
      setRetryResult('FAILED');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 10005,
      backdropFilter: 'blur(2px)'
    }}>
      <div style={{
        width: '460px',
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '14px 18px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Monitor size={18} color="#2563eb" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              PC 에이전트 실행 안내
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            padding: '12px',
            borderRadius: '6px'
          }}>
            <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ lineHeight: 1.5, color: '#92400e' }}>
              <b>[{actionName}]</b>을(를) 처리하려면 PC에 <b>eBro 에이전트</b>가 실행 중이어야 합니다. 현재 로컬 에이전트의 응답이 없습니다.
            </div>
          </div>

          <div style={{
            padding: '12px',
            background: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>조치 방법:</div>
            <ol style={{ margin: 0, paddingLeft: '18px', color: '#475569', lineHeight: 1.6, fontSize: '11.5px' }}>
              <li>PC 바탕화면 또는 시작프로그램의 <b>eBroAgent</b>를 실행해 주세요.</li>
              <li>프로그램이 설치되어 있지 않다면 아래 <b>[설치 프로그램 다운로드]</b>를 진행해 주세요.</li>
              <li>실행 후 아래 <b>[재연결 시도]</b> 버튼을 누르면 작업이 계속됩니다.</li>
            </ol>
          </div>

          {retryResult === 'FAILED' && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '5px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '11px',
              textAlign: 'center',
              fontWeight: 600
            }}>
              아직 에이전트가 응답하지 않습니다. 프로그램을 실행한 후 다시 시도해 주세요.
            </div>
          )}

          {retryResult === 'SUCCESS' && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '5px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              fontSize: '11px',
              textAlign: 'center',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <CheckCircle2 size={14} />
              에이전트 연결 성공! 작업을 재개합니다.
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          padding: '12px 18px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            type="button"
            onClick={handleDownload}
            style={{
              padding: '6px 12px',
              borderRadius: '5px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Download size={13} color="#2563eb" />
            통합 설치 프로그램 다운로드
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 14px',
                borderRadius: '5px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '11.5px',
                cursor: 'pointer'
              }}
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              style={{
                padding: '6px 16px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: isRetrying ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
              재연결 시도
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
