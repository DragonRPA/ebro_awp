// src/utils/hardwareVault.ts
/**
 * 개발자 권한 물리 단말기 보안 및 하드웨어 바인딩 볼트
 * - 전사 표준 헌장 카테고리 I, II 준수 및 비인가 단말기 개발자 권한 로그인 원천 차단
 * - 물리적 PC MAC 주소 및 하드웨어 지문(CPU, GPU, 디바이스 메모리, 해상도, 플랫폼) 결합
 * - 중앙 DB(Supabase `developer_authorized_devices`) 영구 저장 및 자동 인식/통과
 * - 단말기 고장/도난/분실 비상 마스터 복구 및 원격 킬스위치 지원
 * - 복수 개발자 및 다수 기기(사무실/재택/랩탑) 통합 등록 관리부
 */

import { encryptSecret, decryptSecret } from './cryptoVault';
import { db, supabase, DeveloperDeviceProfile, PrivacyAccessLog } from '../services/db';
import { centralSupabase, saveCentralDeveloperDevice, fetchCentralDeveloperDevices } from '../services/centralDb';

export type { DeveloperDeviceProfile };

const STORAGE_KEY_AUTHORIZED_DEVICES = 'ebro_authorized_developer_devices_v1';
const STORAGE_KEY_LOCAL_DEVICE_TOKEN = 'ebro_local_developer_device_token_v1';

// 🔑 개발자 물리 단말기 2단계 인가 마스터 보안키 (사전에 허가된 보안 패스프레이즈)
export const MASTER_HARDWARE_SECURITY_KEY = 'ebro-dev-master-2026!';

// 🚨 비상 마스터 복구 보안키 (단말기 고장, 도난, 분실 시 긴급 Break-Glass 인증용)
export const EMERGENCY_BREAK_GLASS_KEY = 'ebro-breakglass-recovery-2026!';

// 🖥️ 최초 시스템 등록 기본 공인 개발자 물리 워크스테이션 목록
export const DEFAULT_AUTHORIZED_DEVICES: DeveloperDeviceProfile[] = [
  {
    id: 'DEV-PC-PRIMARY-01',
    deviceId: 'DEV-PC-PRIMARY-01',
    developerId: 'sys-admin',
    developerName: '대표 개발자 (시스템 총괄)',
    machineName: 'D-RPA_PRESIDENT (대표 개발자 공인 워크스테이션)',
    macAddress: 'D4-AB-61-46-47-82',
    hardwareFingerprint: 'HW-47A4-E661-24C32G',
    platform: 'Win32/x86_64',
    status: 'ACTIVE',
    isPrimary: true,
    emergencyBreakGlassUsed: false,
    note: '기본 공인 개발자 메인 PC (사전 인가)',
    registeredAt: '2026-10-11T00:00:00.000Z',
    lastVerifiedAt: '2026-10-11T00:00:00.000Z',
    tenant_id: 'tenant-giyeonlift'
  },
  {
    id: 'DEV-PC-PRIMARY-01-ALT',
    deviceId: 'DEV-PC-PRIMARY-01-ALT',
    developerId: 'sys-admin',
    developerName: '대표 개발자 (시스템 총괄)',
    machineName: 'D-RPA_PRESIDENT (대표 개발자 공인 워크스테이션 고해상도)',
    macAddress: 'D4-AB-61-46-47-82',
    hardwareFingerprint: 'HW-6A2F-F12E-24C32G',
    platform: 'Win32/x86_64',
    status: 'ACTIVE',
    isPrimary: true,
    emergencyBreakGlassUsed: false,
    note: '기본 공인 개발자 메인 PC (사전 인가)',
    registeredAt: '2026-10-11T00:00:00.000Z',
    lastVerifiedAt: '2026-10-11T00:00:00.000Z',
    tenant_id: 'tenant-giyeonlift'
  },
  {
    id: 'DEV-PC-PRIMARY-02',
    deviceId: 'DEV-PC-PRIMARY-02',
    developerId: 'sys-admin',
    developerName: '대표 개발자 (시스템 총괄)',
    machineName: 'D-RPA_PRESIDENT (Wi-Fi 2 메인 어댑터)',
    macAddress: 'D4-AB-61-46-47-81',
    hardwareFingerprint: 'HW-D4AB-6146-4781-MASTER',
    platform: 'Win32/x86_64',
    status: 'ACTIVE',
    isPrimary: false,
    emergencyBreakGlassUsed: false,
    note: '보조 개발 PC (사전 인가)',
    registeredAt: '2026-10-11T00:00:00.000Z',
    lastVerifiedAt: '2026-10-11T00:00:00.000Z',
    tenant_id: 'tenant-giyeonlift'
  },
  {
    id: 'DEV-PC-PRIMARY-03',
    deviceId: 'DEV-PC-PRIMARY-03',
    developerId: 'sys-admin',
    developerName: '대표 개발자 (시스템 총괄)',
    machineName: 'D-RPA_PRESIDENT (이더넷 I226-V)',
    macAddress: '18-3D-2D-58-F1-8C',
    hardwareFingerprint: 'HW-5AA3-E370-24C',
    platform: 'Win32/x86_64',
    status: 'ACTIVE',
    isPrimary: false,
    emergencyBreakGlassUsed: false,
    note: '공인 개발 단말기 원클릭 등록 (이더넷)',
    registeredAt: '2026-10-11T00:00:00.000Z',
    lastVerifiedAt: '2026-10-11T00:00:00.000Z',
    tenant_id: 'tenant-giyeonlift'
  }
];

/**
 * 1. 브라우저 환경에서 물리적 하드웨어 특성(CPU 코어, GPU 렌더러, 메모리, 화면비)을 수집하여
 * 고유한 하드웨어 지문을 결정론적으로 생성
 */
export async function getPhysicalHardwareFingerprint(): Promise<{
  fingerprint: string;
  coreFingerprint: string;
  details: {
    cores: number;
    memoryGb: number;
    gpuRenderer: string;
    screenResolution: string;
    colorDepth: number;
    platform: string;
  };
}> {
  let cores = 4;
  let memoryGb = 8;
  let gpuRenderer = 'Generic GPU';
  let screenResolution = '1920x1080';
  let colorDepth = 24;
  let platform = 'Unknown';

  if (typeof window !== 'undefined') {
    cores = navigator.hardwareConcurrency || 4;
    memoryGb = (navigator as any).deviceMemory || 8;
    if (cores >= 16 && memoryGb === 8) {
      memoryGb = 32;
    }
    platform = navigator.platform || 'Browser';
    screenResolution = `${window.screen.width}x${window.screen.height} (${window.devicePixelRatio}x)`;
    colorDepth = window.screen.colorDepth || 24;

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuRenderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || gpuRenderer;
        }
      }
    } catch {}
  }

  // 특성 조합 문자열 (기존 호환용 전체 문자열 및 모니터 해상도 무관 본체 고유 문자열)
  const seedString = `${cores}:${memoryGb}:${gpuRenderer}:${screenResolution}:${colorDepth}:${platform}`;
  const coreSeedString = `${cores}:${memoryGb}:${gpuRenderer}:${platform}`;
  
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  const fingerprint = `HW-${hexHash.slice(0, 4)}-${hexHash.slice(4, 8)}-${cores}C${memoryGb}G`;

  let coreHash = 0;
  for (let i = 0; i < coreSeedString.length; i++) {
    const char = coreSeedString.charCodeAt(i);
    coreHash = (coreHash << 5) - coreHash + char;
    coreHash |= 0;
  }
  const coreHexHash = Math.abs(coreHash).toString(16).toUpperCase().padStart(8, '0');
  const coreFingerprint = `HW-${coreHexHash.slice(0, 4)}-${coreHexHash.slice(4, 8)}-${cores}C${memoryGb}G`;

  return {
    fingerprint,
    coreFingerprint,
    details: {
      cores,
      memoryGb,
      gpuRenderer,
      screenResolution,
      colorDepth,
      platform
    }
  };
}

/**
 * 2. 로컬 개발 환경 또는 로컬 에이전트 API를 통해 물리적 PC의 네트워크 MAC 주소 자동 획득 시도
 */
export async function fetchPhysicalMacAddress(): Promise<string[]> {
  try {
    const res = await fetch('/api/device/physical-mac');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.macAddresses) && data.macAddresses.length > 0) {
        return data.macAddresses.map((m: string) => m.toUpperCase().replace(/:/g, '-'));
      }
    }
  } catch {}
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const agentRes = await fetch('http://127.0.0.1:43210/api/device/physical-mac', { signal: controller.signal });
    clearTimeout(timer);
    if (agentRes.ok) {
      const data = await agentRes.json();
      if (data.success && Array.isArray(data.macAddresses) && data.macAddresses.length > 0) {
        return data.macAddresses.map((m: string) => m.toUpperCase().replace(/:/g, '-'));
      }
    }
  } catch {}
  return [];
}

/**
 * 3. 인가된 개발자 단말기 목록 조회 (DB SSOT + LocalStorage + 기본 Seed 통합 병합)
 */
export function getAuthorizedDeveloperDevices(): DeveloperDeviceProfile[] {
  const mergedMap = new Map<string, DeveloperDeviceProfile>();
  const revokedIds = new Set<string>();

  const addList = (list: DeveloperDeviceProfile[] | undefined | null) => {
    if (!Array.isArray(list)) return;
    for (const dev of list) {
      if (!dev) continue;
      const key = dev.id || dev.deviceId || `${dev.macAddress || ''}_${dev.hardwareFingerprint || ''}`;
      if (!key) continue;
      if (dev.status === 'REVOKED') {
        revokedIds.add(key);
      }
      if (!mergedMap.has(key)) {
        mergedMap.set(key, dev);
      } else if (dev.status === 'REVOKED') {
        mergedMap.set(key, dev);
      }
    }
  };

  // 1순위: DB 인메모리/캐시 SSOT
  try {
    addList(db.developerAuthorizedDevices);
  } catch {}

  // 2순위: 로컬 스토리지
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AUTHORIZED_DEVICES);
      if (raw) {
        addList(JSON.parse(raw));
      }
    } catch {}
  }

  // 3순위: 기본 공인 개발자 시드 (구버전 DB 캐시로 인해 기본 공인 PC가 누락되는 현상 원천 차단)
  addList(DEFAULT_AUTHORIZED_DEVICES);

  return Array.from(mergedMap.values()).map(d => {
    const key = d.id || d.deviceId || '';
    if (revokedIds.has(key)) {
      return { ...d, status: 'REVOKED' as const };
    }
    return d;
  });
}

/**
 * 3-1. 원격 DB 실시간 인가 단말기 목록 조회 (테넌트 DB + 중앙 플랫폼 DB 통합)
 */
export async function fetchAuthorizedDeveloperDevicesLive(): Promise<DeveloperDeviceProfile[]> {
  const mergedMap = new Map<string, DeveloperDeviceProfile>();
  const addList = (list: any[]) => {
    if (!Array.isArray(list)) return;
    for (const dev of list) {
      if (!dev) continue;
      const key = dev.id || dev.deviceId || `${dev.macAddress || ''}_${dev.hardwareFingerprint || ''}`;
      if (key && !mergedMap.has(key)) {
        mergedMap.set(key, dev as DeveloperDeviceProfile);
      }
    }
  };

  try {
    if (supabase) {
      const { data } = await supabase
        .from('developer_authorized_devices')
        .select('*')
        .order('registeredAt', { ascending: false });
      if (Array.isArray(data)) addList(data);
    }
  } catch {}

  try {
    const centralDevices = await fetchCentralDeveloperDevices();
    if (Array.isArray(centralDevices)) addList(centralDevices);
  } catch (e) {
    console.warn('fetchAuthorizedDeveloperDevicesLive fallback warn:', e);
  }

  addList(getAuthorizedDeveloperDevices());
  return Array.from(mergedMap.values());
}

function isHardwareFingerprintMatched(
  deviceFp: string | undefined,
  currentFp: string,
  coreFp: string,
  cores: number,
  memoryGb: number,
  platform: string
): boolean {
  if (!deviceFp) return false;
  if (deviceFp === currentFp || deviceFp === coreFp) return true;
  // 동일 물리 본체(24코어 32GB Win32 대표 개발자 메인 워크스테이션)에서 모니터 해상도/배율 변경으로 앞 해시만 바뀐 경우 호환 인정
  const suffix = `-${cores}C${memoryGb}G`;
  if (cores >= 24 && platform.toLowerCase().includes('win') && deviceFp.endsWith(suffix) && currentFp.endsWith(suffix)) {
    return true;
  }
  return false;
}

/**
 * 4. 현재 접속 기기가 인가된 개발자 물리 단말기인지 검증
 * - 일치하는 경우 자동으로 통과하며, 로컬 서명 토큰 및 DB 최종 검증 시각을 갱신
 */
export async function isCurrentDeviceAuthorizedForDeveloper(): Promise<{
  isAuthorized: boolean;
  matchedDevice?: DeveloperDeviceProfile;
  detectedFingerprint: string;
  detectedMacs: string[];
}> {
  const { fingerprint, coreFingerprint, details } = await getPhysicalHardwareFingerprint();
  const detectedMacs = await fetchPhysicalMacAddress();
  const authorizedList = getAuthorizedDeveloperDevices();

  // 1순위: 로컬 스토리지에 유효한 단말 바인딩 서명 토큰이 존재하는지 검증
  if (typeof localStorage !== 'undefined') {
    const localToken = localStorage.getItem(STORAGE_KEY_LOCAL_DEVICE_TOKEN);
    if (localToken) {
      const decrypted = decryptSecret(localToken);
      if (decrypted) {
        try {
          const tokenData = JSON.parse(decrypted);
          if (tokenData && (tokenData.deviceId || tokenData.id) && tokenData.status === 'ACTIVE') {
            const matched = authorizedList.find(
              d => (d.id === tokenData.id || d.deviceId === tokenData.deviceId) && d.status === 'ACTIVE'
            );
            if (matched) {
              updateDeviceLastVerified(matched);
              return {
                isAuthorized: true,
                matchedDevice: matched,
                detectedFingerprint: fingerprint,
                detectedMacs
              };
            }
          }
        } catch {}
      }
    }
  }

  // 2순위: 감지된 물리 MAC 주소가 인가 목록에 일치하는지 검증
  for (const mac of detectedMacs) {
    const normalizedMac = mac.toUpperCase().replace(/:/g, '-');
    const matched = authorizedList.find(
      d => d.status === 'ACTIVE' && d.macAddress && d.macAddress.toUpperCase().replace(/:/g, '-') === normalizedMac
    );
    if (matched) {
      sealLocalDeviceToken(matched);
      updateDeviceLastVerified(matched);
      return {
        isAuthorized: true,
        matchedDevice: matched,
        detectedFingerprint: fingerprint,
        detectedMacs
      };
    }
  }

  // 3순위: 하드웨어 지문 일치 검증 (모니터 해상도 무관 코어 지문 포함)
  const matchedFp = authorizedList.find(
    d =>
      d.status === 'ACTIVE' &&
      isHardwareFingerprintMatched(d.hardwareFingerprint, fingerprint, coreFingerprint, details.cores, details.memoryGb, details.platform)
  );
  if (matchedFp) {
    sealLocalDeviceToken(matchedFp);
    updateDeviceLastVerified(matchedFp);
    return {
      isAuthorized: true,
      matchedDevice: matchedFp,
      detectedFingerprint: fingerprint,
      detectedMacs
    };
  }

  // 4순위: 원격 DB(테넌트 DB + 중앙 플랫폼 DB 통합) 실시간 조회
  try {
    const liveData = await fetchAuthorizedDeveloperDevicesLive();

    if (liveData.length > 0) {
      // MAC 주소 일치 검증
      for (const mac of detectedMacs) {
        const normalizedMac = mac.toUpperCase().replace(/:/g, '-');
        const matched = liveData.find(
          (d: any) => d.status === 'ACTIVE' && d.macAddress && d.macAddress.toUpperCase().replace(/:/g, '-') === normalizedMac
        );
        if (matched) {
          sealLocalDeviceToken(matched);
          updateDeviceLastVerified(matched);
          return {
            isAuthorized: true,
            matchedDevice: matched,
            detectedFingerprint: fingerprint,
            detectedMacs
          };
        }
      }

      // 하드웨어 지문 일치 검증
      const matchedLiveFp = liveData.find(
        (d: any) =>
          d.status === 'ACTIVE' &&
          isHardwareFingerprintMatched(d.hardwareFingerprint, fingerprint, coreFingerprint, details.cores, details.memoryGb, details.platform)
      );
      if (matchedLiveFp) {
        sealLocalDeviceToken(matchedLiveFp);
        updateDeviceLastVerified(matchedLiveFp);
        return {
          isAuthorized: true,
          matchedDevice: matchedLiveFp,
          detectedFingerprint: fingerprint,
          detectedMacs
        };
      }
    }
  } catch (liveErr) {
    console.warn('[hardwareVault] 원격 실시간 인가 조회 경고:', liveErr);
  }

  return {
    isAuthorized: false,
    detectedFingerprint: fingerprint,
    detectedMacs
  };
}

/**
 * 5. 물리 단말기 로컬 토큰 암호화 봉인
 */
function sealLocalDeviceToken(device: DeveloperDeviceProfile): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const tokenPayload = {
      id: device.id || device.deviceId,
      deviceId: device.deviceId || device.id,
      macAddress: device.macAddress,
      hardwareFingerprint: device.hardwareFingerprint,
      status: device.status,
      sealedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY_LOCAL_DEVICE_TOKEN, encryptSecret(JSON.stringify(tokenPayload)));
  } catch (e) {
    console.warn('Failed to seal local device token:', e);
  }
}

/**
 * 6. 단말기 최종 인증 일시 DB 및 캐시 갱신
 */
function updateDeviceLastVerified(device: DeveloperDeviceProfile): void {
  const nowIso = new Date().toISOString();
  try {
    const targetId = device.id || device.deviceId;
    if (targetId) {
      db.updateRow<DeveloperDeviceProfile>('developerAuthorizedDevices', targetId, {
        lastVerifiedAt: nowIso
      });
    }
  } catch {}
}

/**
 * 7. 신규 개발자 물리 단말기 인가 등록 및 바인딩 (마스터 보안키 또는 비상 키 인증 필수)
 */
export async function registerAndAuthorizeDeveloperDevice(params: {
  developerId?: string;
  developerName?: string;
  machineName: string;
  macAddress: string;
  masterSecurityKey: string;
  note?: string;
  isEmergency?: boolean;
}): Promise<{ success: boolean; error?: string; device?: DeveloperDeviceProfile }> {
  const isMaster = params.masterSecurityKey.trim() === MASTER_HARDWARE_SECURITY_KEY;
  const isEmergency = params.masterSecurityKey.trim() === EMERGENCY_BREAK_GLASS_KEY;

  if (!isMaster && !isEmergency) {
    return {
      success: false,
      error: '물리 마스터 보안키 또는 비상 복구키가 일치하지 않습니다.'
    };
  }

  const cleanMac = params.macAddress.trim().toUpperCase().replace(/:/g, '-');
  const macRegex = /^([0-9A-F]{2}-){5}[0-9A-F]{2}$/;
  if (!macRegex.test(cleanMac)) {
    return {
      success: false,
      error: '올바른 물리 MAC 주소 형식이 아닙니다 (예: D4-AB-61-46-47-82).'
    };
  }

  const { fingerprint, details } = await getPhysicalHardwareFingerprint();
  const nowIso = new Date().toISOString();
  const id = `DEV-PC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const newDevice: DeveloperDeviceProfile = {
    id,
    deviceId: id,
    developerId: params.developerId || 'sys-admin',
    developerName: params.developerName || '대표 개발자',
    machineName: params.machineName.trim() || `개발자 워크스테이션 (${cleanMac})`,
    macAddress: cleanMac,
    hardwareFingerprint: fingerprint,
    platform: details.platform,
    status: 'ACTIVE',
    isPrimary: false,
    emergencyBreakGlassUsed: Boolean(params.isEmergency || isEmergency),
    note: params.note || (isEmergency ? '비상 복구 인가 등록' : '신규 공인 단말기 등록'),
    registeredAt: nowIso,
    lastVerifiedAt: nowIso
  };

  // 1. 중앙 플랫폼 DB(ebro-platform-core) 영구 저장 (테넌트 독립)
  try {
    saveCentralDeveloperDevice(newDevice).catch(err => console.warn('saveCentralDeveloperDevice async warn:', err));
  } catch {}

  // 2. 클라이언트 인메모리/캐시 동기화
  try {
    const existing = db.developerAuthorizedDevices.find(
      d => d.macAddress.toUpperCase().replace(/:/g, '-') === cleanMac
    );
    if (existing) {
      db.updateRow<DeveloperDeviceProfile>('developerAuthorizedDevices', existing.id, {
        ...newDevice,
        id: existing.id,
        deviceId: existing.id
      });
    } else {
      db.insertRow<DeveloperDeviceProfile>('developerAuthorizedDevices', newDevice);
    }
  } catch (e) {
    console.warn('Failed to insert device to DB:', e);
  }

  // localStorage 백업
  try {
    const currentList = getAuthorizedDeveloperDevices();
    const updatedList = [
      newDevice,
      ...currentList.filter(d => d.macAddress.toUpperCase().replace(/:/g, '-') !== cleanMac)
    ];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_AUTHORIZED_DEVICES, JSON.stringify(updatedList));
    }
  } catch {}

  // 로컬 단말기에 암호화 토큰 봉인
  sealLocalDeviceToken(newDevice);

  return {
    success: true,
    device: newDevice
  };
}

/**
 * 8. 개발자 단말기 인가 회수 (Revoke - 도난/분실/퇴사 즉시 킬스위치)
 */
export function revokeDeveloperDevice(deviceId: string, reason?: string): boolean {
  try {
    const device = db.developerAuthorizedDevices.find(d => d.id === deviceId || d.deviceId === deviceId);
    if (device) {
      db.updateRow<DeveloperDeviceProfile>('developerAuthorizedDevices', device.id, {
        status: 'REVOKED' as const,
        note: reason ? `${device.note || ''} [회수 사유: ${reason}]` : device.note,
        lastVerifiedAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn('Failed to update DB on revoke:', e);
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const list = getAuthorizedDeveloperDevices();
      const updated = list.map(d => (d.id === deviceId || d.deviceId === deviceId) ? { ...d, status: 'REVOKED' as const } : d);
      localStorage.setItem(STORAGE_KEY_AUTHORIZED_DEVICES, JSON.stringify(updated));

      const localToken = localStorage.getItem(STORAGE_KEY_LOCAL_DEVICE_TOKEN);
      if (localToken) {
        const dec = decryptSecret(localToken);
        if (dec && dec.includes(deviceId)) {
          localStorage.removeItem(STORAGE_KEY_LOCAL_DEVICE_TOKEN);
        }
      }
    } catch {}
  }
  return true;
}

/**
 * 9. 개발자 단말기 인가 재승인
 */
export function reactivateDeveloperDevice(deviceId: string): boolean {
  try {
    const device = db.developerAuthorizedDevices.find(d => d.id === deviceId || d.deviceId === deviceId);
    if (device) {
      db.updateRow<DeveloperDeviceProfile>('developerAuthorizedDevices', device.id, {
        status: 'ACTIVE' as const,
        lastVerifiedAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn('Failed to update DB on reactivate:', e);
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const list = getAuthorizedDeveloperDevices();
      const updated = list.map(d => (d.id === deviceId || d.deviceId === deviceId) ? { ...d, status: 'ACTIVE' as const } : d);
      localStorage.setItem(STORAGE_KEY_AUTHORIZED_DEVICES, JSON.stringify(updated));
    } catch {}
  }
  return true;
}

/**
 * 10. 🚨 비상 마스터 복구 인증 실행
 * - PC 고장, 도난, 분실 시 긴급 복구키로 개발자 접근을 복원하고 감사 로그를 즉시 생성
 */
export async function executeBreakGlassEmergencyLogin(params: {
  emergencyKey: string;
  reason: string;
  registerCurrentDevice?: boolean;
  revokeStolenDeviceId?: string;
}): Promise<{ success: boolean; error?: string; device?: DeveloperDeviceProfile }> {
  if (params.emergencyKey.trim() !== EMERGENCY_BREAK_GLASS_KEY && params.emergencyKey.trim() !== MASTER_HARDWARE_SECURITY_KEY) {
    return {
      success: false,
      error: '비상 마스터 복구키가 일치하지 않습니다.'
    };
  }

  if (!params.reason.trim()) {
    return {
      success: false,
      error: '비상 복구 사유(PC 고장, 도난, 분실 등)를 반드시 입력해야 합니다.'
    };
  }

  const { fingerprint, details } = await getPhysicalHardwareFingerprint();
  const detectedMacs = await fetchPhysicalMacAddress();
  const activeMac = detectedMacs[0] || 'EMERGENCY-TEMP-MAC';
  const nowIso = new Date().toISOString();

  // 1. 도난/분실 단말기 지정 시 원격 킬스위치 가동 (즉시 인가 회수)
  if (params.revokeStolenDeviceId) {
    revokeDeveloperDevice(params.revokeStolenDeviceId, `비상 복구 절차 중 분실/도난 신고로 즉시 회수 (${params.reason})`);
  }

  // 2. 비상 감사 로그 무누락 DB 기록
  try {
    db.insertRow<PrivacyAccessLog>('privacyAccessLogs', {
      id: `pal-emg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      userId: 'sys-admin',
      userName: '대표 개발자 (비상 복구)',
      ipAddress: typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1',
      actionType: 'LOGIN',
      targetMenu: 'login',
      targetSubjectId: 'developer_emergency_break_glass',
      targetSubjectName: '개발자 비상 마스터 복구 접속',
      actionDetail: `🚨 [비상 마스터 복구 접속 승인] 사유: ${params.reason} | 감지 MAC: ${activeMac} | 지문: ${fingerprint} | 플랫폼: ${details.platform} | 신규등록: ${params.registerCurrentDevice ? 'Y' : 'N'}`,
      isMasked: false,
      createdAt: nowIso
    });
  } catch (e) {
    console.warn('Failed to insert emergency privacy log:', e);
  }

  // 3. 단말기 생성 및 바인딩
  const id = `DEV-PC-EMERGENCY-${Date.now().toString(36).toUpperCase()}`;
  const emergencyDevice: DeveloperDeviceProfile = {
    id,
    deviceId: id,
    developerId: 'sys-admin',
    developerName: '대표 개발자 (비상 복구)',
    machineName: params.registerCurrentDevice ? `비상 복구 신규 개발 PC (${details.platform})` : `비상 임시 접속 단말 (${activeMac})`,
    macAddress: activeMac,
    hardwareFingerprint: fingerprint,
    platform: details.platform,
    status: params.registerCurrentDevice ? 'ACTIVE' : 'EMERGENCY_TEMP',
    isPrimary: false,
    emergencyBreakGlassUsed: true,
    note: `[비상 복구 접속] 사유: ${params.reason}`,
    registeredAt: nowIso,
    lastVerifiedAt: nowIso,
    tenant_id: 'tenant-giyeonlift'
  };

  if (params.registerCurrentDevice) {
    try {
      db.insertRow<DeveloperDeviceProfile>('developerAuthorizedDevices', emergencyDevice);
    } catch {}
  }

  sealLocalDeviceToken(emergencyDevice);

  return {
    success: true,
    device: emergencyDevice
  };
}
