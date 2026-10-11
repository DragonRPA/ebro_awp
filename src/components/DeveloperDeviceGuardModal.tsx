// src/components/DeveloperDeviceGuardModal.tsx
import React, { useState, useEffect } from 'react';
import { ShieldAlert, Cpu, Network, Key, CheckCircle2, X, AlertTriangle, Laptop, Lock, RefreshCw } from 'lucide-react';
import { 
  getPhysicalHardwareFingerprint, 
  fetchPhysicalMacAddress, 
  registerAndAuthorizeDeveloperDevice,
  executeBreakGlassEmergencyLogin,
  getAuthorizedDeveloperDevices,
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
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'BREAK_GLASS'>('REGISTER');
  const [hardwareFingerprint, setHardwareFingerprint] = useState<string>('분석 중...');
  const [hardwareDetails, setHardwareDetails] = useState<any>(null);
  const [detectedMacs, setDetectedMacs] = useState<string[]>([]);
  const [macAddress, setMacAddress] = useState<string>('');
  const [machineName, setMachineName] = useState<string>('');
  const [developerName, setDeveloperName] = useState<string>('대표 개발자');
  const [masterSecurityKey, setMasterSecurityKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 🚨 비상 마스터 복구 (Break-Glass) 필드
  const [emergencyKey, setEmergencyKey] = useState<string>('');
  const [emergencyReason, setEmergencyReason] = useState<string>('메인 PC 고장으로 인한 비상 복구 접속');
  const [registerAsPermanent, setRegisterAsPermanent] = useState<boolean>(true);
  const [revokeStolenDeviceId, setRevokeStolenDeviceId] = useState<string>('');
  const [activeDeviceList, setActiveDeviceList] = useState<DeveloperDeviceProfile[]>([]);

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

    // 기존 등록 단말기 목록 로드 (비상 시 도난/분실 기기 즉시 차단 선택용)
    const devices = getAuthorizedDeveloperDevices();
    setActiveDeviceList(devices.filter(d => d.status === 'ACTIVE'));
  }, [isOpen]);

  if (!isOpen) return null;

  // 신규 단말기 등록 제출
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await registerAndAuthorizeDeveloperDevice({
        developerId: targetLoginId,
        developerName: developerName.trim() || '개발자',
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

  // 🚨 비상 마스터 복구 제출 (Break-Glass)
  const handleBreakGlassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await executeBreakGlassEmergencyLogin({
        emergencyKey: emergencyKey.trim(),
        reason: emergencyReason.trim(),
        registerCurrentDevice: registerAsPermanent,
        revokeStolenDeviceId: revokeStolenDeviceId || undefined
      });

      if (res.success && res.device) {
        onSuccess(res.device);
      } else {
        setErrorMessage(res.error || '비상 마스터 복구 인증에 실패했습니다.');
      }
    } catch (err: any) {
      setErrorMessage(`비상 복구 처리 중 오류가 발생했습니다: ${err?.message || err}`);
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
        maxWidth: '540px',
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
          backgroundColor: activeTab === 'BREAK_GLASS' ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: activeTab === 'BREAK_GLASS' ? '#fee2e2' : '#e0e7ff',
              color: activeTab === 'BREAK_GLASS' ? '#dc2626' : '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {activeTab === 'BREAK_GLASS' ? <AlertTriangle size={18} /> : <ShieldAlert size={18} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                {activeTab === 'BREAK_GLASS' ? '🚨 개발자 비상 마스터 복구 (Break-Glass)' : '개발자 물리 단말기 인가 절차'}
              </h3>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary, #64748b)' }}>
                대상 계정: [{targetLoginId}] • {activeTab === 'BREAK_GLASS' ? '단말기 고장/도난/분실 비상 절차' : '비인가 기기 감지'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 탭 전환 바 */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary, #f1f5f9)'
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('REGISTER'); setErrorMessage(null); }}
            style={{
              flex: 1,
              padding: '10px 14px',
              fontSize: '12.5px',
              fontWeight: 700,
              border: 'none',
              borderBottom: activeTab === 'REGISTER' ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
              backgroundColor: activeTab === 'REGISTER' ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: activeTab === 'REGISTER' ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #64748b)',
              cursor: 'pointer'
            }}
          >
            공인 단말기 등록 및 바인딩
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('BREAK_GLASS'); setErrorMessage(null); }}
            style={{
              flex: 1,
              padding: '10px 14px',
              fontSize: '12.5px',
              fontWeight: 700,
              border: 'none',
              borderBottom: activeTab === 'BREAK_GLASS' ? '2px solid #dc2626' : '2px solid transparent',
              backgroundColor: activeTab === 'BREAK_GLASS' ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: activeTab === 'BREAK_GLASS' ? '#dc2626' : 'var(--text-secondary, #64748b)',
              cursor: 'pointer'
            }}
          >
            🚨 비상 마스터 복구 (고장/도난/분실)
          </button>
        </div>

        {/* 탭 1: 일반 공인 단말기 등록 */}
        {activeTab === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#92400e',
              lineHeight: 1.5
            }}>
              <strong>안내:</strong> 현재 PC의 하드웨어 지문과 MAC 주소를 개발자 공인 기기로 DB에 등록하면, 이후 로그인 시 추가 확인 없이 즉시 자동 통과됩니다.
            </div>

            {errorMessage && (
              <div style={{
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#991b1b',
                lineHeight: 1.4
              }}>
                {errorMessage}
              </div>
            )}

            {/* 하드웨어 지문 */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #334155)', marginBottom: '4px' }}>
                <Cpu size={14} color="var(--primary, #2563eb)" />
                감지된 물리 하드웨어 지문
              </label>
              <input
                type="text"
                readOnly
                value={hardwareFingerprint}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--primary, #2563eb)'
                }}
              />
              {hardwareDetails && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '2px', display: 'block' }}>
                  CPU {hardwareDetails.cores}코어 • RAM 약 {hardwareDetails.memoryGb}GB • 해상도 {hardwareDetails.screenResolution} • {hardwareDetails.platform}
                </span>
              )}
            </div>

            {/* MAC 주소 */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #334155)', marginBottom: '4px' }}>
                <Network size={14} color="#0d9488" />
                개발자 PC 물리 MAC 주소
              </label>
              <input
                type="text"
                value={macAddress}
                onChange={e => setMacAddress(e.target.value.toUpperCase())}
                placeholder="예: D4-AB-61-46-47-82"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-main)'
                }}
              />
            </div>

            {/* 개발자 담당자명 */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #334155)', marginBottom: '4px' }}>
                담당 개발자명
              </label>
              <input
                type="text"
                value={developerName}
                onChange={e => setDeveloperName(e.target.value)}
                placeholder="예: 이정용 (대표개발자)"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  fontSize: '12.5px',
                  color: 'var(--text-main)'
                }}
              />
            </div>

            {/* 단말기 명칭 */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #334155)', marginBottom: '4px' }}>
                <Laptop size={14} />
                단말기 명칭
              </label>
              <input
                type="text"
                value={machineName}
                onChange={e => setMachineName(e.target.value)}
                placeholder="예: 대표 개발자 워크스테이션 (Win32)"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  fontSize: '12.5px',
                  color: 'var(--text-main)'
                }}
              />
            </div>

            {/* 마스터 보안키 */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #334155)', marginBottom: '4px' }}>
                <Key size={14} color="#d97706" />
                물리 마스터 보안키 (Master Hardware Passkey)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={masterSecurityKey}
                  onChange={e => setMasterSecurityKey(e.target.value)}
                  placeholder="사전 인가된 마스터 보안키 입력"
                  style={{
                    width: '100%',
                    padding: '8px 45px 8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: '12.5px',
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
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted, #64748b)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                >
                  {showKey ? '숨김' : '표시'}
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-color)'
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--primary, #2563eb)',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
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
        )}

        {/* 탭 2: 🚨 비상 마스터 복구 (고장/도난/분실 시) */}
        {activeTab === 'BREAK_GLASS' && (
          <form onSubmit={handleBreakGlassSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '12px',
              color: '#991b1b',
              lineHeight: 1.5
            }}>
              <strong>🚨 비상 복구(Break-Glass) 절차 안내:</strong><br />
              개발자 PC의 고장, 도난, 침수, 분실 등 정상 단말기로 접근할 수 없는 비상 상황 시 긴급 로그인 절차입니다. 본 비상 접속은 시스템 전산 감사 로그에 전수 영구 기록됩니다.
            </div>

            {errorMessage && (
              <div style={{
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#991b1b',
                lineHeight: 1.4
              }}>
                {errorMessage}
              </div>
            )}

            {/* 비상 복구 사유 */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
                비상 복구 사유 (감사 로그 필수 저장 항목)
              </label>
              <input
                type="text"
                required
                value={emergencyReason}
                onChange={e => setEmergencyReason(e.target.value)}
                placeholder="예: 메인 개발 PC 메인보드 고장으로 임시 노트북에서 비상 접속"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #fca5a5',
                  backgroundColor: 'var(--bg-card)',
                  fontSize: '12.5px',
                  color: 'var(--text-main)'
                }}
              />
            </div>

            {/* 비상 마스터 복구키 */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #334155)', marginBottom: '4px' }}>
                <Lock size={14} color="#dc2626" />
                비상 마스터 복구 보안키 (Emergency Break-Glass Passkey)
              </label>
              <input
                type="password"
                required
                value={emergencyKey}
                onChange={e => setEmergencyKey(e.target.value)}
                placeholder="사전에 안전 금고에 보관된 비상 복구키 입력"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  fontSize: '12.5px',
                  color: 'var(--text-main)'
                }}
              />
            </div>

            {/* 도난/분실 기존 단말기 즉시 차단(Revoke) 선택 */}
            {activeDeviceList.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>
                  도난/분실된 기존 단말기 즉시 인가 회수 (선택 시 해당 PC 접속 영구 차단)
                </label>
                <select
                  value={revokeStolenDeviceId}
                  onChange={e => setRevokeStolenDeviceId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: '12px',
                    color: 'var(--text-main)'
                  }}
                >
                  <option value="">-- 분실/도난 기기 없음 (단순 고장 또는 임시 접속) --</option>
                  {activeDeviceList.map(d => (
                    <option key={d.id || d.deviceId} value={d.id || d.deviceId}>
                      [차단 대상] {d.machineName} ({d.macAddress}) - {d.developerName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 영구 등록 여부 */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input
                type="checkbox"
                checked={registerAsPermanent}
                onChange={e => setRegisterAsPermanent(e.target.checked)}
              />
              <span>현재 접속 중인 이 단말기를 신규 공인 개발자 PC로 영구 등록합니다.</span>
            </label>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-color)'
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <AlertTriangle size={14} />
                {isSubmitting ? '비상 복구 검증 중...' : '🚨 비상 마스터 복구 접속 승인'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
