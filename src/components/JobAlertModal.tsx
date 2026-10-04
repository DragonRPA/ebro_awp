// src/components/JobAlertModal.tsx
// 주기장/공장 현장 소음 대응 직무별 업무 알림(소리 차임벨, 확인 버튼형 팝업) 설정 모달

import React, { useState, useEffect } from 'react';
import { 
  X, Bell, Volume2, VolumeX, Play, Check, ShieldAlert,
  Truck, ArrowLeftRight, Wrench, PackageCheck, UserCheck
} from 'lucide-react';
import { 
  jobNotificationService, JobNotificationSettings, JobRolePreset 
} from '../services/jobNotificationService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const JobAlertModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<JobNotificationSettings>(
    jobNotificationService.getSettings()
  );

  useEffect(() => {
    if (isOpen) {
      setSettings(jobNotificationService.getSettings());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: JobRolePreset) => {
    jobNotificationService.applyPreset(preset);
    setSettings(jobNotificationService.getSettings());
  };

  const handleToggleSound = () => {
    const next = !settings.soundEnabled;
    const updated = { ...settings, soundEnabled: next };
    setSettings(updated);
    jobNotificationService.updateSettings({ soundEnabled: next });
    if (next) {
      jobNotificationService.playChime(settings.chimeTone, settings.volume);
    }
  };

  const handleTogglePopup = () => {
    const next = !settings.popupEnabled;
    const updated = { ...settings, popupEnabled: next };
    setSettings(updated);
    jobNotificationService.updateSettings({ popupEnabled: next });
  };

  const handleToneChange = (tone: 'DING_DONG' | 'HARMONIC' | 'ALERT_BELL') => {
    const updated = { ...settings, chimeTone: tone };
    setSettings(updated);
    jobNotificationService.updateSettings({ chimeTone: tone });
    jobNotificationService.playChime(tone, settings.volume);
  };

  const handleVolumeChange = (vol: number) => {
    const updated = { ...settings, volume: vol };
    setSettings(updated);
    jobNotificationService.updateSettings({ volume: vol });
  };

  const handleTestChime = () => {
    jobNotificationService.playChime(settings.chimeTone, settings.volume);
  };

  const handleEventToggle = (key: keyof JobNotificationSettings['events']) => {
    const updatedEvents = {
      ...settings.events,
      [key]: !settings.events[key]
    };
    const updated = { ...settings, events: updatedEvents };
    setSettings(updated);
    jobNotificationService.updateSettings({ events: updatedEvents });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(2px)'
    }}>
      <div style={{
        width: '520px',
        maxHeight: '90vh',
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}>
        {/* 모달 헤더: 전사 표준 헌장 3.1 무수식어 건조 표준 */}
        <div style={{
          padding: '14px 18px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="#2563eb" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              업무 알림 설정
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div style={{
          padding: '18px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          fontSize: '12px'
        }}>
          {/* 1. 직무별 기본 설정 (원클릭 프리셋) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              직무별 기본 설정
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {[
                { key: 'YARD_PLANT', label: '주기장·공장', desc: '소리 ON / 팝업 ON' },
                { key: 'DISPATCH', label: '배차·물류', desc: '소리 ON / 팝업 ON' },
                { key: 'SALES', label: '영업', desc: '소리 OFF / 팝업 ON' },
                { key: 'ADMIN', label: '사무·관리', desc: '소리 OFF / 팝업 ON' },
              ].map(item => {
                const isSelected = settings.selectedPreset === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleApplyPreset(item.key as JobRolePreset)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '6px',
                      border: `1px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      color: isSelected ? '#1e40af' : '#334155',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      fontWeight: isSelected ? 700 : 500,
                      textAlign: 'center'
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: '9.5px', color: isSelected ? '#2563eb' : '#64748b' }}>
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 알림 방식 2대 축 (소리 차임벨 & 확인 버튼형 안내 팝업) */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* 소리 (차임벨) 토글 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {settings.soundEnabled ? <Volume2 size={16} color="#2563eb" /> : <VolumeX size={16} color="#94a3b8" />}
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>소리 (차임벨)</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>주기장/공장 현장 소음 청취용 스피커 알림음</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleSound}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: settings.soundEnabled ? '#2563eb' : '#cbd5e1',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                {settings.soundEnabled ? '사용중' : '꺼짐'}
              </button>
            </div>

            {/* 소리 상세 옵션 (음색 선택, 볼륨 슬라이더, 테스트 재생) */}
            {settings.soundEnabled && (
              <div style={{
                paddingTop: '10px',
                borderTop: '1px dashed #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { key: 'DING_DONG', label: '2톤 딩동' },
                      { key: 'HARMONIC', label: '3톤 하모닉' },
                      { key: 'ALERT_BELL', label: '현장 비상벨' },
                    ].map(tone => (
                      <button
                        key={tone.key}
                        type="button"
                        onClick={() => handleToneChange(tone.key as any)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          border: `1px solid ${settings.chimeTone === tone.key ? '#2563eb' : '#cbd5e1'}`,
                          backgroundColor: settings.chimeTone === tone.key ? '#eff6ff' : '#ffffff',
                          color: settings.chimeTone === tone.key ? '#1e40af' : '#334155',
                          fontWeight: settings.chimeTone === tone.key ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {tone.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleTestChime}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600
                    }}
                  >
                    <Play size={12} color="#16a34a" />
                    소리 테스트
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>음량 ({settings.volume}%)</span>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={settings.volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    style={{ flex: 1, cursor: 'pointer' }}
                  />
                </div>
              </div>
            )}

            {/* 안내 팝업 토스트 (확인 버튼) 토글 */}
            <div style={{
              paddingTop: '10px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>안내 팝업 토스트 (확인 버튼)</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>확인 버튼을 누를 때까지 화면에 고정 노출 (자동 소멸 차단)</div>
              </div>
              <button
                type="button"
                onClick={handleTogglePopup}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: settings.popupEnabled ? '#2563eb' : '#cbd5e1',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                {settings.popupEnabled ? '사용중' : '꺼짐'}
              </button>
            </div>
          </div>

          {/* 3. 업무 이벤트별 개별 수신 여부 (체크리스트) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              알림 수신 업무 선택
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { 
                  key: 'outboundRequested' as const,
                  title: '신규 출고의뢰 (출고요청서 발행)',
                  desc: '영업부 출고요청 접수 즉시 알림 (주기장 출고검수 및 장비 점검 착수)',
                  icon: <PackageCheck size={15} color="#2563eb" />
                },
                { 
                  key: 'exchangeRequested' as const,
                  title: '교환 의뢰',
                  desc: '현장 고장/규격 교체 1:1 왕복 배차 및 대체 장비 준비 알림',
                  icon: <ArrowLeftRight size={15} color="#7c3aed" />
                },
                { 
                  key: 'inboundReturn' as const,
                  title: '입고·반납 장비 주기장 도착',
                  desc: '현장 임대 종료 후 반납 장비 하차 및 입고 검수 착수 알림',
                  icon: <Truck size={15} color="#16a34a" />
                },
                { 
                  key: 'repairRequested' as const,
                  title: '정비·수리 의뢰 접수',
                  desc: '검수 불량 장비 또는 현장 긴급 AS 입고 수리 지시 알림',
                  icon: <Wrench size={15} color="#d97706" />
                },
                { 
                  key: 'dispatchAssigned' as const,
                  title: '배차 기사 배정 완료',
                  desc: '탁송 트럭 배정 완료 및 상차 준비 알림',
                  icon: <UserCheck size={15} color="#0891b2" />
                },
              ].map(evt => {
                const checked = settings.events[evt.key];
                return (
                  <div
                    key={evt.key}
                    onClick={() => handleEventToggle(evt.key)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${checked ? '#93c5fd' : '#e2e8f0'}`,
                      backgroundColor: checked ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {evt.icon}
                      <div>
                        <div style={{ fontWeight: 600, color: checked ? '#0f172a' : '#64748b' }}>
                          {evt.title}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '1px' }}>
                          {evt.desc}
                        </div>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}} // 부모 div 클릭으로 처리
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
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
            onClick={() => {
              jobNotificationService.triggerJobAlert({
                type: 'OUTBOUND_REQUESTED',
                title: '신규 출고의뢰 접수 (출고요청서)',
                customerName: '(주)삼정건설',
                siteName: '판교 제2테크노밸리 신축현장',
                modelName: 'GS-2646 (시저리프트)',
                quantity: 2,
                deliveryDate: '내일 오전 08:00',
                memo: '안전가드 필수 장착, 세척 완료 후 상차 요청',
                actionMenuId: 'outbound_inspection'
              });
            }}
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
            <Bell size={13} color="#2563eb" />
            현장 알림 테스트 발생
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            설정 완료
          </button>
        </div>
      </div>
    </div>
  );
};
