// src/utils/secureApiKey.ts
/**
 * 공공데이터포털 및 외부 API 키 보안 관리 유틸리티
 * - 소스코드 및 번들 JS 내 평문 노출 방지 (XOR 마스킹 및 역공학 방지 캡슐화)
 * - 로컬 스토리지 암호화 저장/복호화
 * - UI 마스킹 (어깨너머 훔쳐보기 및 화면 캡처 방지)
 */

// 64-Byte 난독화 XOR 바이트 스트림 (정적 코드 분석 및 strings 추출 차단)
const OBFUSCATED_ARCHHUB_BYTES: number[] = [
  109, 60, 104, 110, 104, 111, 106, 56, 62, 106, 106, 104, 110, 107, 104, 59,
  59, 59, 107, 111, 104, 59, 108, 63, 105, 63, 57, 108, 105, 63, 111, 111,
  108, 108, 106, 110, 60, 109, 111, 56, 63, 106, 60, 59, 99, 107, 98, 107,
  99, 98, 105, 57, 105, 105, 59, 108, 107, 98, 57, 56, 104, 63, 106, 105
];
const RUNTIME_MASK = 0x5a;

/**
 * 런타임 메모리에서만 일시적으로 시스템 기본 공공데이터 인증키 복원
 * (정적 번들 검색 시 원본 키 문자열이 일체 존재하지 않음)
 */
export function getRuntimeDefaultArchHubKey(): string {
  try {
    return OBFUSCATED_ARCHHUB_BYTES.map(b => String.fromCharCode(b ^ RUNTIME_MASK)).join('');
  } catch {
    return '';
  }
}

/**
 * UI 표출용 키 마스킹 (앞 4자리, 뒤 6자리만 남기고 중간 전면 마스킹)
 * 예: 7f24••••••••••••••••••••••••••••••••cb2e03
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 12) return '••••••••••••••••';
  const prefix = key.slice(0, 4);
  const suffix = key.slice(-6);
  return `${prefix}••••••••••••••••••••••••••••••••${suffix}`;
}

/**
 * 로컬 스토리지에 암호화하여 저장 (브라우저 F12 Application 탭 평문 노출 방지)
 */
export function setEncryptedStorage(storageKey: string, plainValue: string): void {
  try {
    if (!plainValue) {
      localStorage.removeItem(storageKey);
      return;
    }
    const xorStr = Array.from(plainValue)
      .map(c => String.fromCharCode(c.charCodeAt(0) ^ 0x3c))
      .join('');
    const b64 = btoa(encodeURIComponent(xorStr));
    localStorage.setItem(storageKey, `__ENC__${b64}`);
  } catch (e) {
    console.error('Failed to encrypt storage value', e);
  }
}

/**
 * 로컬 스토리지에서 암호화된 값 복호화 로드
 */
export function getEncryptedStorage(storageKey: string, fallbackValue: string = ''): string {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallbackValue;
    if (raw.startsWith('__ENC__')) {
      const b64 = raw.slice(7);
      const xorStr = decodeURIComponent(atob(b64));
      return Array.from(xorStr)
        .map(c => String.fromCharCode(c.charCodeAt(0) ^ 0x3c))
        .join('');
    }
    // 기존 평문 저장된 키가 있는 경우 마이그레이션 암호화
    setEncryptedStorage(storageKey, raw);
    return raw;
  } catch (e) {
    return fallbackValue;
  }
}
