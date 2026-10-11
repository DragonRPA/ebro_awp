// src/utils/hardwareVault.ts
/**
 * 개발자 권한 물리 단말기 보안 및 하드웨어 바인딩 볼트 (Developer Hardware Vault)
 * - 전사 표준 헌장 카테고리 I, II 준수 및 비인가 단말기 개발자 권한 로그인 원천 차단
 * - 물리적 PC MAC 주소 및 하드웨어 지문(CPU, GPU, 디바이스 메모리, 해상도, 오디오) 결합
 * - 인가된 개발자 물리 단말기 화이트리스트(Whitelisting) 및 마스터 하드웨어 보안키 검증
 */

import { encryptSecret, decryptSecret } from './cryptoVault';

export interface DeveloperDeviceProfile {
  deviceId: string;
  machineName: string;
  macAddress: string;
  hardwareFingerprint: string;
  platform: string;
  status: 'ACTIVE' | 'REVOKED';
  registeredAt: string;
  lastVerifiedAt: string;
}

const STORAGE_KEY_AUTHORIZED_DEVICES = 'ebro_authorized_developer_devices_v1';
const STORAGE_KEY_LOCAL_DEVICE_TOKEN = 'ebro_local_developer_device_token_v1';

// 🔑 개발자 물리 단말기 2단계 인가 마스터 보안키 (사전에 허가된 보안 패스프레이즈)
export const MASTER_HARDWARE_SECURITY_KEY = 'ebro-dev-master-2026!';

// 🖥️ 최초 시스템 등록 기본 공인 개발자 물리 워크스테이션 (Primary Dev PC)
export const DEFAULT_AUTHORIZED_DEVICES: DeveloperDeviceProfile[] = [
  {
    deviceId: 'DEV-PC-PRIMARY-01',
    machineName: '대표 개발자 공인 워크스테이션',
    macAddress: 'D4-AB-61-46-47-81',
    hardwareFingerprint: 'HW-D4AB-6146-4781-MASTER',
    platform: 'Win32/x86_64',
    status: 'ACTIVE',
    registeredAt: '2026-10-11T00:00:00.000Z',
    lastVerifiedAt: '2026-10-11T00:00:00.000Z'
  }
];

/**
 * 1. 브라우저 환경에서 물리적 하드웨어 특성(CPU 코어, GPU 렌더러, 메모리, 화면비)을 수집하여
 * 고유한 하드웨어 지문(Hardware Fingerprint)을 결정론적으로 생성
 */
export async function getPhysicalHardwareFingerprint(): Promise<{
  fingerprint: string;
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

  // 특성 조합 문자열
  const seedString = `${cores}:${memoryGb}:${gpuRenderer}:${screenResolution}:${colorDepth}:${platform}`;
  
  // 경량 해시 생성
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  const fingerprint = `HW-${hexHash.slice(0, 4)}-${hexHash.slice(4, 8)}-${cores}C${memoryGb}G`;

  return {
    fingerprint,
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
 * 2. 로컬 개발 환경 또는 API를 통해 물리적 PC의 네트워크 MAC 주소 자동 획득 시도
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
  return [];
}

/**
 * 3. 인가된 개발자 단말기 목록 조회
 */
export function getAuthorizedDeveloperDevices(): DeveloperDeviceProfile[] {
  if (typeof localStorage === 'undefined') return DEFAULT_AUTHORIZED_DEVICES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTHORIZED_DEVICES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_AUTHORIZED_DEVICES, JSON.stringify(DEFAULT_AUTHORIZED_DEVICES));
      return DEFAULT_AUTHORIZED_DEVICES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {}
  return DEFAULT_AUTHORIZED_DEVICES;
}

/**
 * 4. 현재 접속 기기가 인가된 개발자 물리 단말기인지 검증
 */
export async function isCurrentDeviceAuthorizedForDeveloper(): Promise<{
  isAuthorized: boolean;
  matchedDevice?: DeveloperDeviceProfile;
  detectedFingerprint: string;
  detectedMacs: string[];
}> {
  const { fingerprint } = await getPhysicalHardwareFingerprint();
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
          if (tokenData && tokenData.deviceId && tokenData.status === 'ACTIVE') {
            const matched = authorizedList.find(d => d.deviceId === tokenData.deviceId && d.status === 'ACTIVE');
            if (matched) {
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
      d => d.status === 'ACTIVE' && d.macAddress.toUpperCase().replace(/:/g, '-') === normalizedMac
    );
    if (matched) {
      // 로컬 토큰 자동 동기화
      sealLocalDeviceToken(matched);
      return {
        isAuthorized: true,
        matchedDevice: matched,
        detectedFingerprint: fingerprint,
        detectedMacs
      };
    }
  }

  // 3순위: 하드웨어 지문 일치 검증
  const matchedFp = authorizedList.find(
    d => d.status === 'ACTIVE' && d.hardwareFingerprint === fingerprint
  );
  if (matchedFp) {
    sealLocalDeviceToken(matchedFp);
    return {
      isAuthorized: true,
      matchedDevice: matchedFp,
      detectedFingerprint: fingerprint,
      detectedMacs
    };
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
      deviceId: device.deviceId,
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
 * 6. 신규 개발자 물리 단말기 인가 등록 및 바인딩 (마스터 보안키 인증 필수)
 */
export async function registerAndAuthorizeDeveloperDevice(params: {
  machineName: string;
  macAddress: string;
  masterSecurityKey: string;
}): Promise<{ success: boolean; error?: string; device?: DeveloperDeviceProfile }> {
  // 1. 마스터 보안키 검증
  if (params.masterSecurityKey.trim() !== MASTER_HARDWARE_SECURITY_KEY) {
    return {
      success: false,
      error: '물리 마스터 보안키가 일치하지 않습니다. 인가 권한이 없습니다.'
    };
  }

  // 2. MAC 주소 유효성 검증 (XX-XX-XX-XX-XX-XX 또는 XX:XX:XX:XX:XX:XX 형식)
  const cleanMac = params.macAddress.trim().toUpperCase().replace(/:/g, '-');
  const macRegex = /^([0-9A-F]{2}-){5}[0-9A-F]{2}$/;
  if (!macRegex.test(cleanMac)) {
    return {
      success: false,
      error: '올바른 물리 MAC 주소 형식이 아닙니다 (예: D4-AB-61-46-47-81).'
    };
  }

  const { fingerprint, details } = await getPhysicalHardwareFingerprint();
  const nowIso = new Date().toISOString();
  const deviceId = `DEV-PC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const newDevice: DeveloperDeviceProfile = {
    deviceId,
    machineName: params.machineName.trim() || `개발자 워크스테이션 (${cleanMac})`,
    macAddress: cleanMac,
    hardwareFingerprint: fingerprint,
    platform: details.platform,
    status: 'ACTIVE',
    registeredAt: nowIso,
    lastVerifiedAt: nowIso
  };

  // 화이트리스트에 추가
  const currentList = getAuthorizedDeveloperDevices();
  const updatedList = [
    newDevice,
    ...currentList.filter(d => d.macAddress.toUpperCase().replace(/:/g, '-') !== cleanMac)
  ];

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_AUTHORIZED_DEVICES, JSON.stringify(updatedList));
  }

  // 로컬 단말기에 암호화 토큰 봉인
  sealLocalDeviceToken(newDevice);

  return {
    success: true,
    device: newDevice
  };
}

/**
 * 7. 개발자 단말기 인가 회수 (Revoke)
 */
export function revokeDeveloperDevice(deviceId: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const list = getAuthorizedDeveloperDevices();
    const updated = list.map(d => d.deviceId === deviceId ? { ...d, status: 'REVOKED' as const } : d);
    localStorage.setItem(STORAGE_KEY_AUTHORIZED_DEVICES, JSON.stringify(updated));

    // 현재 기기가 회수 대상이면 로컬 토큰 삭제
    const localToken = localStorage.getItem(STORAGE_KEY_LOCAL_DEVICE_TOKEN);
    if (localToken) {
      const dec = decryptSecret(localToken);
      if (dec && dec.includes(deviceId)) {
        localStorage.removeItem(STORAGE_KEY_LOCAL_DEVICE_TOKEN);
      }
    }
    return true;
  } catch {
    return false;
  }
}
