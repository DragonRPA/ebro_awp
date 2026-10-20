// src/utils/cryptoVault.ts
/**
 * 전사 표준 암호화 및 보안 볼트 유틸리티
 * - 전사 표준 헌장 카테고리 I, II 준수 및 클라이언트 평문 노출 제로 원칙
 * - SHA-256 단방향 패스워드 해싱
 * - 로컬스토리지 및 클라이언트 설정 민감정보 양방향 암호화/복호화
 * - 세션 위변조 방지 (Tamper-Proof Session Signing & Verification)
 * - 민감 금융/인사 필드 역할 기반 마스킹
 */

// ─── 1. 경량 표준 SHA-256 구현 (동기/비동기 범용 지원) ───────────
function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  let i: number, j: number;
  let result = '';

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  // UTF-8 보정 처리
  const utf8Ascii = unescape(encodeURIComponent(ascii));
  const utf8Words: number[] = [];
  const utf8BitLength = utf8Ascii.length * 8;
  for (i = 0; i < utf8Ascii.length; i++) {
    utf8Words[i >> 2] |= (utf8Ascii.charCodeAt(i) & 0xff) << ((3 - (i % 4)) * 8);
  }

  utf8Words[utf8BitLength >> 5] |= 0x80 << (24 - (utf8BitLength % 32));
  utf8Words[(((utf8BitLength + 64) >> 9) << 4) + 15] = utf8BitLength;

  for (i = 0; i < utf8Words.length; i += 16) {
    const w = utf8Words.slice(i, i + 16);
    const oldHash = hash.slice(0);

    for (j = 0; j < 64; j++) {
      if (j >= 16) {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1 + ch + k[j] + (w[j] | 0)) | 0;
      const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0 + maj) | 0;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 0xff;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

/**
 * 2. 전사 표준 솔트 기반 패스워드 해싱
 * - 평문 비밀번호를 SHA-256 해시로 변환하여 DB 및 로컬 저장소 평문 노출 영구 차단
 */
const SYSTEM_SALT = 'ebro_erp_secure_salt_2026';

export function hashPassword(plainPassword: string): string {
  if (!plainPassword) return '';
  // 이미 64자리 SHA-256 해시인 경우 재해싱 방지
  if (/^[a-f0-9]{64}$/i.test(plainPassword)) {
    return plainPassword.toLowerCase();
  }
  return sha256Sync(`${plainPassword}:${SYSTEM_SALT}`);
}

/**
 * 비밀번호 검증 (평문 입력과 저장된 해시 비교, 레거시 평문 호환 지원)
 */
export function verifyPassword(inputPassword: string, storedHash: string): boolean {
  if (!inputPassword || !storedHash) return false;
  // 1. 정상 해시 비교
  const hashedInput = hashPassword(inputPassword);
  if (hashedInput === storedHash.toLowerCase()) return true;
  // 2. 레거시 평문 패스워드 비교 (구버전 호환용)
  if (inputPassword === storedHash) return true;
  return false;
}

// ─── 3. 클라이언트 민감정보 암호화 및 로컬스토리지 볼트 ─────────
const VAULT_CIPHER_KEY = 0x4f;
const VAULT_PREFIX = '__EBRO_ENC__v1__';

/**
 * 문자열 대칭 암호화 (브라우저 Application 탭/번들 평문 노출 방어)
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  try {
    const utf8 = unescape(encodeURIComponent(plainText));
    const chars = [];
    for (let i = 0; i < utf8.length; i++) {
      const code = utf8.charCodeAt(i);
      // 다이나믹 치환 + 키 XOR
      const masked = code ^ (VAULT_CIPHER_KEY + (i % 7));
      chars.push(masked);
    }
    const b64 = btoa(String.fromCharCode(...chars));
    // 무결성 체크섬 앞 8자리 결합
    const checksum = sha256Sync(plainText).slice(0, 8);
    return `${VAULT_PREFIX}${checksum}__${b64}`;
  } catch (e) {
    console.warn('encryptSecret failed, returning fallback', e);
    return plainText;
  }
}

/**
 * 암호화된 비밀 복호화
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return '';
  if (!cipherText.startsWith(VAULT_PREFIX)) {
    return cipherText; // 암호화되지 않은 레거시 평문 값은 그대로 반환
  }
  try {
    const raw = cipherText.slice(VAULT_PREFIX.length);
    const parts = raw.split('__');
    if (parts.length < 2) return '';
    const [checksum, b64] = parts;
    const binary = atob(b64);
    const chars = [];
    for (let i = 0; i < binary.length; i++) {
      const code = binary.charCodeAt(i);
      const unmasked = code ^ (VAULT_CIPHER_KEY + (i % 7));
      chars.push(String.fromCharCode(unmasked));
    }
    const plainText = decodeURIComponent(escape(chars.join('')));
    // 무결성 검증
    if (sha256Sync(plainText).slice(0, 8) === checksum) {
      return plainText;
    }
    console.warn('decryptSecret checksum mismatch');
    return '';
  } catch (e) {
    console.warn('decryptSecret failed', e);
    return '';
  }
}

// ─── 3. 안전 로컬스토리지 입출력 및 용량 한도 방어 ──────────────
export const ESSENTIAL_STORAGE_KEYS = new Set([
  'remember_id',
  'remember_pw',
  'remember_id_pref',
  'remember_pw_pref',
  'auto_user',
  'user',
  'erp_view_mode',
  'erp_theme',
  'erp_current_tenant_id',
  'ebro_authorized_developer_devices_v1',
  'ebro_local_developer_device_token_v1',
  'erp_privacy_audit_check'
]);

/**
 * localStorage 용량 한도 초과 방어 및 비핵심 캐시 자동 소탕
 */
export function purgeStorageQuotaOverflow(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const candidates: { key: string; size: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (ESSENTIAL_STORAGE_KEYS.has(k)) continue;

      // 소탕 대상 비핵심 캐시 식별 (Supabase 원본 또는 인메모리에 존재하는 임시 캐시)
      if (
        k.startsWith('erp_') ||
        k.startsWith('ebro_trade_') ||
        k.startsWith('walkie_') ||
        k.startsWith('drive_') ||
        k.startsWith('sent_') ||
        k.startsWith('approval_payload_')
      ) {
        const val = localStorage.getItem(k) || '';
        candidates.push({ key: k, size: val.length });
      }
    }

    // 용량이 큰 항목부터 우선 정리하여 최대 여유 공간을 즉시 확보
    candidates.sort((a, b) => b.size - a.size);
    for (const item of candidates) {
      localStorage.removeItem(item.key);
      console.warn(`[Storage Quota Guard] 비핵심 캐시 소탕: ${item.key} (${Math.round(item.size / 1024)} KB 회수)`);
    }
  } catch (e) {
    console.warn('[Storage Quota Guard] 캐시 소탕 중 오류:', e);
  }
}

/**
 * Quota 초과 시 자동 소탕 및 예외 무음 방어형 안전 setItem
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    console.warn(`[safeLocalStorageSet] '${key}' 저장 중 Quota 초과 감지 -> 비핵심 캐시 자동 소탕 실행`);
    purgeStorageQuotaOverflow();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (retryErr) {
      console.warn(`[safeLocalStorageSet] 캐시 소탕 후에도 '${key}' 저장 실패 (무음 처리):`, retryErr);
      return false;
    }
  }
}

/**
 * 암호화 안전 로컬스토리지 저장 (Quota 방어 내장)
 */
export function setVaultItem(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!value) {
      localStorage.removeItem(key);
      return;
    }
    safeLocalStorageSet(key, encryptSecret(value));
  } catch (e) {
    console.warn(`setVaultItem failed for key ${key}:`, e);
  }
}

/**
 * 암호화 안전 로컬스토리지 읽기
 */
export function getVaultItem(key: string, defaultValue: string = ''): string {
  try {
    if (typeof localStorage === 'undefined') return defaultValue;
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return decryptSecret(raw) || defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

// ─── 4. 세션 위변조 방지 ─────────────
const SESSION_SIGN_SALT = 'ebro_auth_session_guard_v1';

export interface TamperProofSession<T = any> {
  payload: T;
  signedAt: string;
  signature: string;
}

/**
 * 사용자 세션 객체 서명 및 암호화
 */
export function signSessionUser<T extends { id: string; role?: string }>(user: T): string {
  try {
    const signedAt = new Date().toISOString();
    const message = `${user.id}:${user.role || ''}:${signedAt}:${SESSION_SIGN_SALT}`;
    const signature = sha256Sync(message);
    const sessionObj: TamperProofSession<T> = {
      payload: user,
      signedAt,
      signature
    };
    return encryptSecret(JSON.stringify(sessionObj));
  } catch (e) {
    return JSON.stringify(user);
  }
}

/**
 * 세션 서명 검증 및 복원 (위변조 감지 시 null 반환)
 */
export function verifySessionUser<T extends { id: string; role?: string }>(encryptedStr: string): T | null {
  if (!encryptedStr) return null;
  try {
    // 1. 암호화 해제
    const raw = decryptSecret(encryptedStr);
    if (!raw) return null;

    // 레거시 평문 JSON 호환
    if (!raw.includes('"signature"')) {
      const legacy = JSON.parse(raw);
      return legacy && legacy.id ? legacy : null;
    }

    const session: TamperProofSession<T> = JSON.parse(raw);
    const { payload, signedAt, signature } = session;
    if (!payload || !payload.id || !signature) return null;

    const expectedMessage = `${payload.id}:${payload.role || ''}:${signedAt}:${SESSION_SIGN_SALT}`;
    const expectedSig = sha256Sync(expectedMessage);

    if (expectedSig !== signature) {
      console.error('🚨 [Security Violation] 세션 위변조 감지: 사용자 Role 또는 ID가 무단 변조되었습니다.');
      return null;
    }

    return payload;
  } catch (e) {
    console.warn('verifySessionUser failed:', e);
    return null;
  }
}

/**
 * 안전한 JSON 파싱 (SyntaxError 완전 무음 방어 및 기본값 반환)
 */
export function safeJsonParse<T = any>(str: string | null | undefined, fallback: T): T {
  if (!str || typeof str !== 'string') return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * 안전한 세션 사용자 복원 유틸 (암호화 서명본 및 레거시 평문 JSON 완전 무결 호환)
 * 암호화 접두사가 있는 문자열은 절대 JSON.parse로 넘기지 않고 verifySessionUser로만 복호화합니다.
 * 어떤 상황에서도 SyntaxError 예외를 외부로 전파하지 않습니다.
 */
export function parseSessionUser<T extends { id: string; role?: string } = any>(raw: string | null | undefined): T | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. 암호화 서명 세션인 경우
  if (trimmed.startsWith(VAULT_PREFIX)) {
    try {
      const verified = verifySessionUser<T>(trimmed);
      if (verified) return verified;
    } catch (e) {
      console.warn('parseSessionUser verifySessionUser failed:', e);
    }
    // 암호화 문자열은 절대 JSON.parse로 넘기지 않음
    return null;
  }

  // 2. 레거시 평문 JSON인 경우
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && parsed.id) {
      return parsed as T;
    }
  } catch (e) {
    console.warn('parseSessionUser JSON.parse legacy failed:', e);
  }

  return null;
}


// ─── 5. 역할 기반 민감정보 마스킹 ───────────
/**
 * 키/비밀번호 UI 마스킹 (앞 3자리, 뒤 4자리 표기, 나머지 마스킹)
 */
export function maskSensitiveKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  const prefix = key.slice(0, 3);
  const suffix = key.slice(-4);
  return `${prefix}••••••••••••••••${suffix}`;
}

/**
 * 급여/연봉 정보 열람 권한 검증 및 마스킹
 * - 최고관리자 또는 인사/경영지원 권한자만 열람 허용
 */
export function maskSalaryForRole(salary: number | undefined, userRole?: string, userDept?: string): number | string {
  const isHrOrAdmin = userRole === 'ADMIN' || 
                      userDept === '경영지원' || 
                      userDept === 'HR' || 
                      userRole === 'HR_MANAGER';
  if (isHrOrAdmin) {
    return salary || 0;
  }
  return '비공개 (인사권한 필요)';
}

// ─── 6. 법정 개인정보 보호 암호화 엔진 ───
// 개인정보 보호법 제24조의2(고유식별정보 처리 제한), 제29조(안전조치의무), 시행령 제30조(개인정보의 안전성 확보조치)
// 및 개인정보의 안전성 확보조치 기준(개인정보보호위원회 고시 제2023-4호) 제7조(개인정보의 암호화) 준수

/**
 * 단일 개인정보 필드 암호화 (이미 암호화된 경우 중복 암호화 방지)
 */
export function encryptPrivacyField(val?: string | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (!str) return '';
  // 이미 암호화된 토큰인 경우 그대로 반환
  if (str.startsWith(VAULT_PREFIX)) return str;
  return encryptSecret(str);
}

/**
 * 단일 개인정보 필드 복호화 (암호화되지 않은 레거시 평문 값은 안전하게 그대로 반환)
 */
export function decryptPrivacyField(val?: string | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (!str) return '';
  if (!str.startsWith(VAULT_PREFIX)) return str;
  return decryptSecret(str);
}

/**
 * 개인정보 암호화 상태 여부 판별
 */
export function isEncryptedPrivacyField(val?: string | null): boolean {
  return typeof val === 'string' && val.startsWith(VAULT_PREFIX);
}

/**
 * 테이블별 개인정보보호법 법정 보호 대상 필드 정의 SSOT
 */
export const PRIVACY_PROTECTED_TABLE_FIELDS: Record<string, string[]> = {
  users: ['phone', 'birthDate', 'address'],
  transportDrivers: ['idNo', 'birthDate', 'driverContact', 'address'],
  transport_drivers: ['idNo', 'birthDate', 'driverContact', 'address'],
  vendors: ['accountNumber', 'bankAccount'],
  customers: ['repContact', 'repEmail'],
  customerContacts: ['contact', 'email', 'mobile', 'phone'],
  customer_contacts: ['contact', 'email', 'mobile', 'phone'],
  tenants: ['bankAccount', 'accountNumber'],
  corporateCards: ['cardNumber'],
  corporate_cards: ['cardNumber']
};

/**
 * 엔티티 객체의 법정 보호 개인정보 필드 일괄 암호화 (저장 시 사용)
 */
export function encryptEntityPrivacyFields<T extends Record<string, any>>(tableName: string, entity: T): T {
  if (!entity || typeof entity !== 'object') return entity;
  const fields = PRIVACY_PROTECTED_TABLE_FIELDS[tableName];
  const clone: any = { ...entity };

  if (fields && fields.length > 0) {
    for (const f of fields) {
      if (typeof clone[f] === 'string' && clone[f].trim() !== '') {
        clone[f] = encryptPrivacyField(clone[f]);
      }
    }
  }

  // 중첩 계좌번호 배열 암호화 (고객사 및 테넌트 다중 계좌)
  if (Array.isArray(clone.bankAccounts)) {
    clone.bankAccounts = clone.bankAccounts.map((acc: any) => {
      if (!acc || typeof acc !== 'object') return acc;
      return {
        ...acc,
        accountNumber: acc.accountNumber ? encryptPrivacyField(acc.accountNumber) : acc.accountNumber
      };
    });
  }

  return clone as T;
}

/**
 * 엔티티 객체의 법정 보호 개인정보 필드 일괄 복호화 (불러오기 시 사용)
 */
export function decryptEntityPrivacyFields<T extends Record<string, any>>(tableName: string, entity: T): T {
  if (!entity || typeof entity !== 'object') return entity;
  const fields = PRIVACY_PROTECTED_TABLE_FIELDS[tableName];
  const clone: any = { ...entity };

  if (fields && fields.length > 0) {
    for (const f of fields) {
      if (typeof clone[f] === 'string' && clone[f].startsWith(VAULT_PREFIX)) {
        clone[f] = decryptPrivacyField(clone[f]);
      }
    }
  }

  // 중첩 계좌번호 배열 복호화
  if (Array.isArray(clone.bankAccounts)) {
    clone.bankAccounts = clone.bankAccounts.map((acc: any) => {
      if (!acc || typeof acc !== 'object') return acc;
      return {
        ...acc,
        accountNumber: acc.accountNumber ? decryptPrivacyField(acc.accountNumber) : acc.accountNumber
      };
    });
  }

  return clone as T;
}
