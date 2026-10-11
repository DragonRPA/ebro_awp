// src/components/BiometricAuthModal.tsx
import React, { useState, useEffect } from 'react';
import { Fingerprint, ShieldCheck, AlertCircle, X, CheckCircle2, RefreshCw, KeyRound } from 'lucide-react';
import { 
  getSavedAdminCredential, 
  registerAdminFingerprint, 
  verifyAdminFingerprint,
  isWebAuthnSupported 
} from '../utils/webAuthnVault';

interface BiometricAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetLoginId?: string;
}

export const BiometricAuthModal: React.FC<BiometricAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetLoginId = 'admin'
}) => {
  const [hasCredential, setHasCredential] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('지문 센서에 손가락을 터치해 주십시오.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    isWebAuthnSupported().then(supported => {
      setIsSupported(supported);
      if (!supported) {
        setErrorMessage('현재 브라우저 또는 PC에서 Windows Hello/생체인증을 지원하지 않습니다.');
        return;
      }

      const cred = getSavedAdminCredential();
      setHasCredential(!!cred);
      if (cred) {
        // 이미 등록된 경우 바로 지문 검증 팝업 트리거
        triggerVerify();
      } else {
        setStatusMessage('이 PC에 등록된 관리자 지문이 없습니다. [신규 지문 등록]을 눌러주십시오.');
      }
    });
  }, [isOpen]);

  const triggerVerify = async () => {
    setIsVerifying(true);
    setErrorMessage(null);
    setStatusMessage('Windows Hello 지문 센서를 확인하고 있습니다...');

    const res = await verifyAdminFingerprint();
    setIsVerifying(false);

    if (res.success) {
      setStatusMessage('지문 인증이 완료되었습니다. 로그인 중...');
      setTimeout(() => {
        onSuccess();
      }, 500);
    } else {
      if (res.requireRegistration) {
        setHasCredential(false);
        setStatusMessage('등록된 지문 정보가 없습니다. 먼저 지문을 등록해 주십시오.');
      } else {
        setErrorMessage(res.error || '지문 인증에 실패했습니다.');
        setStatusMessage('인증이 취소되었거나 일치하지 않습니다. 다시 시도해 주십시오.');
      }
    }
  };

  const handleRegisterNew = async () => {
    setIsVerifying(true);
    setErrorMessage(null);
    setStatusMessage('Windows Hello 창에서 신규 지문(또는 PIN)을 등록해 주십시오...');

    const res = await registerAdminFingerprint(targetLoginId);
    setIsVerifying(false);

    if (res.success) {
      setHasCredential(true);
      setStatusMessage('지문이 안전하게 등록되었습니다! 이제 지문으로 인증합니다.');
      // 등록 성공 후 즉시 1차 검증 트리거 또는 바로 통과
      setTimeout(() => {
        onSuccess();
      }, 600);
    } else {
      setErrorMessage(res.error || '지문 등록에 실패했습니다.');
      setStatusMessage('등록이 취소되었습니다. 다시 시도해 주십시오.');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        width: '420px',
        maxWidth: '92vw',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        textAlign: 'center'
      }}>
        {/* 상단 닫기 & 타이틀 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Fingerprint size={20} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>
              2단계 지문 생체인증
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 안내 아이콘 & 문구 */}
        <div style={{
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          backgroundColor: 'var(--bg-app)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: isVerifying ? 'var(--primary-light)' : 'var(--bg-card)',
            border: '2px solid var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            transition: 'all 0.2s ease'
          }}>
            <Fingerprint size={38} className={isVerifying ? 'animate-pulse' : ''} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
              {targetLoginId} 관리자 계정 2차 인증
            </span>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {statusMessage}
            </span>
          </div>

          {errorMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'var(--danger-light)',
              color: 'var(--danger)',
              fontSize: '12px',
              fontWeight: '600',
              textAlign: 'left',
              width: '100%'
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* 액션 버튼군 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {hasCredential ? (
            <button
              type="button"
              disabled={isVerifying}
              onClick={triggerVerify}
              className="btn btn-primary"
              style={{
                padding: '10px 16px',
                fontSize: '13.5px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Fingerprint size={16} />
              지문 인증 재시도
            </button>
          ) : (
            <button
              type="button"
              disabled={isVerifying}
              onClick={handleRegisterNew}
              className="btn btn-primary"
              style={{
                padding: '10px 16px',
                fontSize: '13.5px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <KeyRound size={16} />
              이 PC에 신규 관리자 지문 등록
            </button>
          )}

          {hasCredential && (
            <button
              type="button"
              disabled={isVerifying}
              onClick={handleRegisterNew}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '12px',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              다른 손가락 또는 신규 기기로 지문 재등록
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: '12.5px',
              marginTop: '4px'
            }}
          >
            로그인 취소
          </button>
        </div>
      </div>
    </div>
  );
};
