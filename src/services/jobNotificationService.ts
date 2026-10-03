// src/services/jobNotificationService.ts
// 주기장/공장 현장용 업무 알림(소리 차임벨, 확인 버튼형 안내 팝업 토스트) 및 직무별 설정 엔진

export type JobEventType = 
  | 'OUTBOUND_REQUESTED'   // 신규 출고의뢰 (출고요청서 발행)
  | 'EXCHANGE_REQUESTED'   // 대차/교환 의뢰
  | 'INBOUND_RETURN'       // 입고/반납 장비 주기장 도착
  | 'REPAIR_REQUESTED'     // 정비/수리 접수
  | 'DISPATCH_ASSIGNED';   // 배차 기사 배정 완료

export interface JobAlertItem {
  id: string;
  type: JobEventType;
  title: string;
  customerName: string;
  siteName: string;
  modelName?: string;
  quantity?: number;
  deliveryDate?: string;
  memo?: string;
  timestamp: string;
  actionMenuId?: string; // 이동할 ERP 메뉴 ID (e.g. 'outbound_inspection', 'truck_dispatch')
}

export type JobRolePreset = 'YARD_PLANT' | 'DISPATCH' | 'SALES' | 'ADMIN';

export interface JobNotificationSettings {
  soundEnabled: boolean;           // 소리 (차임벨) 켜기/끄기
  popupEnabled: boolean;           // 안내 팝업 토스트 (확인 버튼) 켜기/끄기
  volume: number;                  // 음량 (10 ~ 100)
  chimeTone: 'DING_DONG' | 'HARMONIC' | 'ALERT_BELL';
  voiceGuideEnabled: boolean;      // TTS 음성 안내 병행 여부
  selectedPreset: JobRolePreset;
  events: {
    outboundRequested: boolean;
    exchangeRequested: boolean;
    inboundReturn: boolean;
    repairRequested: boolean;
    dispatchAssigned: boolean;
  };
}

export const DEFAULT_ROLE_PRESETS: Record<JobRolePreset, JobNotificationSettings> = {
  YARD_PLANT: {
    soundEnabled: true,
    popupEnabled: true,
    volume: 90,
    chimeTone: 'DING_DONG',
    voiceGuideEnabled: false,
    selectedPreset: 'YARD_PLANT',
    events: {
      outboundRequested: true,
      exchangeRequested: true,
      inboundReturn: true,
      repairRequested: true,
      dispatchAssigned: false
    }
  },
  DISPATCH: {
    soundEnabled: true,
    popupEnabled: true,
    volume: 80,
    chimeTone: 'HARMONIC',
    voiceGuideEnabled: false,
    selectedPreset: 'DISPATCH',
    events: {
      outboundRequested: true,
      exchangeRequested: true,
      inboundReturn: false,
      repairRequested: false,
      dispatchAssigned: true
    }
  },
  SALES: {
    soundEnabled: false,
    popupEnabled: true,
    volume: 60,
    chimeTone: 'HARMONIC',
    voiceGuideEnabled: false,
    selectedPreset: 'SALES',
    events: {
      outboundRequested: true,
      exchangeRequested: true,
      inboundReturn: false,
      repairRequested: false,
      dispatchAssigned: true
    }
  },
  ADMIN: {
    soundEnabled: false,
    popupEnabled: true,
    volume: 70,
    chimeTone: 'DING_DONG',
    voiceGuideEnabled: false,
    selectedPreset: 'ADMIN',
    events: {
      outboundRequested: true,
      exchangeRequested: true,
      inboundReturn: true,
      repairRequested: true,
      dispatchAssigned: true
    }
  }
};

const STORAGE_KEY = 'ebro_job_notification_settings_v2';

class JobNotificationService {
  private settings: JobNotificationSettings;
  private audioCtx: AudioContext | null = null;
  private alertListeners: ((item: JobAlertItem) => void)[] = [];
  private settingsListeners: ((settings: JobNotificationSettings) => void)[] = [];

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): JobNotificationSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_ROLE_PRESETS.YARD_PLANT, ...JSON.parse(saved) };
      }
    } catch {}
    return { ...DEFAULT_ROLE_PRESETS.YARD_PLANT };
  }

  public getSettings(): JobNotificationSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<JobNotificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {}
    this.settingsListeners.forEach(cb => cb(this.settings));
  }

  public applyPreset(preset: JobRolePreset): void {
    const template = DEFAULT_ROLE_PRESETS[preset];
    this.updateSettings(template);
  }

  public onSettingsChange(callback: (settings: JobNotificationSettings) => void): () => void {
    this.settingsListeners.push(callback);
    return () => {
      this.settingsListeners = this.settingsListeners.filter(cb => cb !== callback);
    };
  }

  public onJobAlert(callback: (item: JobAlertItem) => void): () => void {
    this.alertListeners.push(callback);
    return () => {
      this.alertListeners = this.alertListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * 브라우저 AudioContext 안전 초기화
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.audioCtx) {
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Web Audio API 기반 청명한 차임벨 합성음 재생 (외부 의존성 없음)
   */
  public playChime(tone?: 'DING_DONG' | 'HARMONIC' | 'ALERT_BELL', customVolume?: number): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const chimeType = tone || this.settings.chimeTone;
    const volLevel = Math.max(0.05, Math.min(1.0, ((customVolume ?? this.settings.volume) / 100)));

    const now = ctx.currentTime;

    if (chimeType === 'DING_DONG') {
      // 2톤 딩~동 (주기장/공장 고가청도 주파수: 784Hz(G5) ➔ 523Hz(C5))
      this.playSineTone(ctx, 784.0, now, 0.45, volLevel);
      this.playSineTone(ctx, 523.25, now + 0.35, 0.85, volLevel);
    } else if (chimeType === 'HARMONIC') {
      // 3톤 하모닉 (C5 ➔ E5 ➔ G5)
      this.playSineTone(ctx, 523.25, now, 0.3, volLevel * 0.9);
      this.playSineTone(ctx, 659.25, now + 0.15, 0.3, volLevel * 0.9);
      this.playSineTone(ctx, 783.99, now + 0.30, 0.6, volLevel);
    } else {
      // 강력 알림벨 (880Hz A5 연속 2회 펄스)
      this.playSineTone(ctx, 880.0, now, 0.2, volLevel);
      this.playSineTone(ctx, 880.0, now + 0.22, 0.45, volLevel);
    }
  }

  private playSineTone(ctx: AudioContext, freq: number, startTime: number, duration: number, maxGain: number) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Attack & Exponential Decay (맑은 타종 음색)
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch (e) {
      console.warn('Tone synth failed:', e);
    }
  }

  /**
   * 업무 이벤트 발생 시 알림 트리거 (소리 및 팝업 토스트 분기)
   */
  public triggerJobAlert(item: Omit<JobAlertItem, 'id' | 'timestamp'>): void {
    const isEventActive = this.checkEventActive(item.type);
    if (!isEventActive) return;

    const alertItem: JobAlertItem = {
      ...item,
      id: `ALERT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };

    // 1. 소리 알림 (설정된 경우)
    if (this.settings.soundEnabled) {
      this.playChime();
    }

    // 2. 안내 팝업 토스트 (설정된 경우 리스너 전파)
    if (this.settings.popupEnabled) {
      this.alertListeners.forEach(cb => cb(alertItem));
    }
  }

  private checkEventActive(type: JobEventType): boolean {
    const e = this.settings.events;
    switch (type) {
      case 'OUTBOUND_REQUESTED': return e.outboundRequested;
      case 'EXCHANGE_REQUESTED': return e.exchangeRequested;
      case 'INBOUND_RETURN': return e.inboundReturn;
      case 'REPAIR_REQUESTED': return e.repairRequested;
      case 'DISPATCH_ASSIGNED': return e.dispatchAssigned;
      default: return true;
    }
  }
}

export const jobNotificationService = new JobNotificationService();
