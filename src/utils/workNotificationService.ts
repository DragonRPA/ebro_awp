// src/utils/workNotificationService.ts
import { supabase } from '../services/db';

export interface WorkNotificationPayload {
  id?: string;
  type: 'OUTBOUND' | 'RETURN' | 'DISPATCH' | 'EXCHANGE' | 'AS';
  title: string;
  body: string;
  url?: string;
  targetDepts?: string[]; // e.g. ['DISPATCH', 'YARD', 'ADMIN', 'EXECUTIVE', 'SALES', 'AS']
  senderId?: string;
  senderName?: string;
  createdAt?: string;
}

/**
 * 🔔 2음계 차임벨 (딩동 사운드) 합성 재생
 */
export function playWorkNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // 1st note (E5 = 659.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    // 2nd note (A5 = 880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.22, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);
  } catch (err) {
    // 오디오 컨텍스트 제한 환경 안전 무시
  }
}

/**
 * 📲 브라우저/PWA 시스템 알림 표출 (소리, 진동, 잠금화면 렌더링)
 */
export async function showSystemNotification(params: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}) {
  // 1. 청각/촉각 알람 선제 실행
  playWorkNotificationChime();
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {}
  }

  // 2. 브라우저 알림 권한 체크
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          reg.showNotification(params.title, {
            body: params.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200, 100, 300],
            tag: params.tag || `work-${Date.now()}`,
            data: { url: params.url || '/' },
            renotify: true,
            requireInteraction: true
          } as any);
          return;
        }
      }
      new Notification(params.title, {
        body: params.body,
        icon: '/icon-192.png',
        tag: params.tag || `work-${Date.now()}`
      });
    } catch (err) {
      console.warn('showSystemNotification failed:', err);
    }
  }
}

/**
 * 📢 4대 핵심 업무 발생 시 전사 브로드캐스트 전송 (발생 즉시 1회)
 */
export async function broadcastWorkNotification(payload: WorkNotificationPayload) {
  // 1. 발신자 로컬 알림 및 차임벨 (확인용)
  playWorkNotificationChime();

  // 2. Supabase Realtime 메타 채널을 통한 전사 푸시 브로드캐스트
  if (!supabase) return;

  try {
    const channel = supabase.channel('work_notifications', {
      config: { broadcast: { self: false } }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'work_event_created',
          payload: {
            ...payload,
            createdAt: new Date().toISOString()
          }
        }).then(() => {
          // 전송 후 채널 정리
          setTimeout(() => {
            if (supabase) {
              supabase.removeChannel(channel);
            }
          }, 3000);
        }).catch(err => {
          console.warn('broadcastWorkNotification send error:', err);
        });
      }
    });
  } catch (err) {
    console.warn('broadcastWorkNotification subscription error:', err);
  }
}

import { Department, User } from '../services/db';
import { getUserDepartmentName, getUserHierarchyLevel, isDeveloperUser } from './userDepartmentHelper';

let isListenerInitialized = false;

export function initWorkNotificationListener(
  currentUser: User | { id?: string; department?: string; departmentId?: string | null; role?: string; position?: string; loginId?: string; name?: string } | null,
  departments: Department[] = []
) {
  if (isListenerInitialized || !supabase || typeof window === 'undefined') return;
  isListenerInitialized = true;

  // 알림 권한이 아직 요청되지 않은 경우 부드럽게 요청
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      Notification.requestPermission().catch(() => {});
    } catch {}
  }

  const workChannel = supabase.channel('work_notifications', {
    config: { broadcast: { self: false } }
  });

  workChannel.on('broadcast', { event: 'work_event_created' }, ({ payload }: { payload: WorkNotificationPayload }) => {
    if (!payload) return;
    
    // 1. 본인이 발생시킨 이벤트는 알림 제외
    if (currentUser?.id && payload.senderId === currentUser.id) return;

    // 2. 부서 필터링 (지정된 경우에만 검사, 미지정이면 전사 수신)
    if (payload.targetDepts && payload.targetDepts.length > 0 && currentUser) {
      const isDev = isDeveloperUser(currentUser);
      const hierarchyLevel = getUserHierarchyLevel(currentUser, departments);
      const isExec = hierarchyLevel === 1; // Level 1 (최상위 조직 / 임원 / 대표)은 전사 업무 수신
      
      if (!isDev && !isExec) {
        const myDeptName = getUserDepartmentName(currentUser, departments).toUpperCase();
        const uRole = (currentUser.role || '').toUpperCase();
        
        const isTarget = payload.targetDepts.some(d => {
          const dt = d.toUpperCase();
          if (myDeptName.includes(dt) || uRole.includes(dt)) return true;
          if (dt === 'SALES' && (myDeptName.includes('영업') || uRole.includes('SALES'))) return true;
          // 배차는 관리부 소관
          if (dt === 'DISPATCH' && (myDeptName.includes('관리') || myDeptName.includes('총무') || myDeptName.includes('배차') || uRole.includes('DISPATCH') || uRole.includes('OFFICE'))) return true;
          if (dt === 'YARD' && (myDeptName.includes('출고') || myDeptName.includes('주기장') || uRole.includes('YARD'))) return true;
          if (dt === 'AS' && (myDeptName.includes('정비') || myDeptName.includes('AS') || myDeptName.includes('서비스') || uRole.includes('MECHANIC'))) return true;
          if (dt === 'ADMIN' && (myDeptName.includes('관리') || myDeptName.includes('총무') || uRole.includes('ADMIN') || uRole.includes('ACCOUNTING'))) return true;
          return false;
        });
        if (!isTarget) return;
      }
    }

    // 3. 시스템 푸시 알림 + 사운드 + 진동 표출 (발생 즉시 1회)
    showSystemNotification({
      title: payload.title,
      body: payload.body,
      tag: `work-${payload.type}-${payload.id || Date.now()}`,
      url: payload.url || '/'
    });
  });

  workChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Work notifications realtime channel subscribed successfully.');
    }
  });
}
