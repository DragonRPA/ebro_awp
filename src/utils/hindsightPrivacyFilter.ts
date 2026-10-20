// src/utils/hindsightPrivacyFilter.ts
// 🛡️ 대한민국 개인정보보호법 준수 Hindsight 텔레메트리 4단계 사전 정제 필터

const RRN_REGEX = /\b\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[- ][1-8]\d{6}\b/g;
const CARD_REGEX = /\b(?:\d{4}[- ]?){3}\d{4}\b/g;
const DRIVER_LICENSE_REGEX = /\b\d{2}[- ]?\d{2}[- ]?\d{6}[- ]?\d{2}\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// 민감 키워드 필터 목록 (비밀번호, 보안토큰, OTP 등)
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /pwd/i,
  /secret/i,
  /token/i,
  /auth_key/i,
  /apikey/i,
  /credential/i,
  /otp/i,
  /pin/i,
  /cvv/i,
  /cvc/i
];

/**
 * 텍스트 문자열 내에 포함된 법정 식별정보 및 인증정보 정규식 마스킹
 */
export function sanitizeSensitiveString(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let sanitized = text
    .replace(RRN_REGEX, '[REDACTED:RRN]')
    .replace(CARD_REGEX, '[REDACTED:CARD]')
    .replace(DRIVER_LICENSE_REGEX, '[REDACTED:LICENSE]');

  return sanitized;
}

/**
 * 특정 키가 보안/비밀번호 필드인지 검사
 */
export function isSensitiveFieldKey(key: string): boolean {
  if (!key) return false;
  return SENSITIVE_KEY_PATTERNS.some(regex => regex.test(key));
}

/**
 * DOM 엘리먼트가 비밀번호나 토큰 입력창인지 검사
 */
export function isSensitiveDomElement(el: HTMLElement | null): boolean {
  if (!el) return false;

  if (el instanceof HTMLInputElement) {
    if (el.type === 'password' || el.autocomplete === 'current-password' || el.autocomplete === 'new-password') {
      return true;
    }
  }

  const nameAttr = el.getAttribute('name') || '';
  const idAttr = el.id || '';
  const ariaLabel = el.getAttribute('aria-label') || '';

  if (isSensitiveFieldKey(nameAttr) || isSensitiveFieldKey(idAttr) || isSensitiveFieldKey(ariaLabel)) {
    return true;
  }

  if (el.closest('[data-hs-ignore="true"]') || el.closest('[data-privacy-sensitive="true"]')) {
    return true;
  }

  return false;
}

/**
 * 임의의 객체/배열/원시값을 재귀 순회하여 PII 및 민감정보를 완전 정제
 */
export function sanitizePrivacyDeep<T>(target: T, depth = 0): T {
  if (depth > 10 || target === null || target === undefined) {
    return target;
  }

  if (typeof target === 'string') {
    return sanitizeSensitiveString(target) as unknown as T;
  }

  if (Array.isArray(target)) {
    return target.map(item => sanitizePrivacyDeep(item, depth + 1)) as unknown as T;
  }

  if (typeof target === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(target)) {
      if (isSensitiveFieldKey(key)) {
        cleaned[key] = '[REDACTED:SECRET]';
      } else {
        cleaned[key] = sanitizePrivacyDeep(val, depth + 1);
      }
    }
    return cleaned as T;
  }

  return target;
}
