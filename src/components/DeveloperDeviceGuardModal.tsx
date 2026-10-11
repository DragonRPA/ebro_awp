// src/components/DeveloperDeviceGuardModal.tsx
import React, { useState, useEffect } from 'react';
import { ShieldAlert, Cpu, Network, Key, CheckCircle2, X, Lock, Laptop } from 'lucide-react';
import { 
  getPhysicalHardwareFingerprint, 
  fetchPhysicalMacAddress, 
  registerAndAuthorizeDeveloperDevice,
  DeveloperDeviceProfile
} from '../utils/hardwareVault';

interface DeveloperDeviceGuardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (device: DeveloperDeviceProfile) => void;
  targetLoginId?: string;
}

export const DeveloperDeviceGuardModal: React.FC<DeveloperDeviceGuardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetLoginId = 'admin'
}) => {
  const [hardwareFingerprint, setHardwareFingerprint] = useState<string>('분석 중...');
  const [hardwareDetails, setHardwareDetails] = useState<any>(null);
  const [detectedMacs, setDetectedMacs] = useState<string[]>([]);
  const [macAddress, setMacAddress] = useState<string>('');
  const [machineName, setMachineName] = useState<string>('');
  const [masterSecurityKey, setMasterSecurityKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // 물리적 하드웨어 분석 및 MAC 주소 감지
    getPhysicalHardwareFingerprint().then(res => {
      setHardwareFingerprint(res.fingerprint);
      setHardwareDetails(res.details);
      if (!machineName) {
        setMachineName(`개발자 워크스테이션 (${res.details.platform || 'PC'})`);
      }
    });

    fetchPhysicalMacAddress().then(macs => {
      setDetectedMacs(macs);
      if (macs.length > 0 && !macAddress) {
        setMacAddress(macs[0]);
      }
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await registerAndAuthorizeDeveloperDevice({
        machineName: machineName.trim() || '공인 개발자 PC',
        macAddress: macAddress.trim(),
        masterSecurityKey: masterSecurityKey.trim()
      });

      if (res.success && res.device) {
        onSuccess(res.device);
      } else {
        setErrorMessage(res.error || '물리 단말기 인가에 실패했습니다.');
      }
    } catch (err: any) {
      setErrorMessage(`인가 처리 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 모달 헤더 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-surface, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                개발자 물리 단말기 2단계 인가 절차
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                대상 계정: [{targetLoginId}] • 비인가 단말기 접근 방어
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 안내 배너 */}
        <div style={{
          padding: '10px 18px',
          backgroundColor: '#fffbeb',
          borderBottom: '1px solid #fef3c7',
          color: '#92400e',
          fontSize: '11.5px',
          lineHeight: '1.5'
        }}>
          <strong>보안 통제:</strong> 개발자 권한은 시스템 전권 및 데이터베이스 접근 권한을 포함하므로, 사전 인가된 개발자 물리 PC(MAC 주소 및 하드웨어 지문)에서만 접속이 허용됩니다.
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {errorMessage && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fca5a5',
              color: '#b91c1c',
              fontSize: '12px',
              fontWeight: 600
            }}>
              ⚠️ {errorMessage}
            </div>
          )}

          {/* 1. 감지된 물리 하드웨어 지문 (읽기 전용) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Cpu size={13} color="var(--primary)" />
              감지된 물리 하드웨어 지문 (Hardware Signature)
            </label>
            <div style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-surface, #f8fafc)',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              fontFamily: 'monospace',
              fontWeight: 700,
              color: 'var(--primary)'
            }}>
              {hardwareFingerprint}
            </div>
            {hardwareDetails && (
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                CPU {hardwareDetails.cores}코어 • RAM 약 {hardwareDetails.memoryGb}GB • 해상도 {hardwareDetails.screenResolution} • {hardwareDetails.platform}
              </span>
            )}
          </div>

          {/* 2. 물리적 PC MAC 주소 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Network size={13} color="var(--primary)" />
              개발자 PC 물리 MAC 주소
            </label>
            <input
              type="text"
              value={macAddress}
              onChange={e => setMacAddress(e.target.value.toUpperCase())}
              placeholder="예: D4-AB-61-46-47-81"
              required
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                fontFamily: 'monospace',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)'
              }}
            />
            {detectedMacs.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>감지된 로컬 NIC:</span>
                {detectedMacs.map(mac => (
                  <button
                    key={mac}
                    type="button"
                    onClick={() => setMacAddress(mac)}
                    style={{
                      fontSize: '10.5px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: macAddress === mac ? 'var(--primary-light)' : 'var(--bg-surface)',
                      color: macAddress === mac ? 'var(--primary)' : 'var(--text-main)',
                      cursor: 'pointer',
                      fontFamily: 'monospace'
                    }}
                  >
                    {mac}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. 단말기 명칭 지정 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Laptop size={13} color="var(--primary)" />
              단말기 명칭
            </label>
            <input
              type="text"
              value={machineName}
              onChange={e => setMachineName(e.target.value)}
              placeholder="예: 기연 본사 개발 PC"
              required
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          {/* 4. 마스터 물리 보안키 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Key size={13} color="var(--primary)" />
              물리 마스터 보안키 (Master Hardware Passkey)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={masterSecurityKey}
                onChange={e => setMasterSecurityKey(e.target.value)}
                placeholder="사전 인가된 개발자 마스터 보안키 입력"
                required
                style={{
                  width: '100%',
                  padding: '8px 40px 8px 12px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)'
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600
                }}
              >
                {showKey ? '숨김' : '표시'}
              </button>
            </div>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              * 최초 등록 시 사전에 발급된 물리 하드웨어 마스터 키 인증이 필요합니다.
            </span>
          </div>

          {/* 모달 액션 버튼 */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            marginTop: '8px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-color)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !macAddress || !masterSecurityKey}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                cursor: isSubmitting || !macAddress || !masterSecurityKey ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle2 size={14} />
              {isSubmitting ? '인가 검증 중...' : '물리 단말기 인가 및 바인딩 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
