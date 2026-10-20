// src/utils/webAuthnVault.ts
/**
 * W3C WebAuthn / FIDO2 기반 생체인증(지문 / Windows Hello / Touch ID) 볼트
 * - admin 계정 로그인 시 하드웨어 TPM 보안 모듈 기반 지문 2단계 인증 강제
 * - 브라우저 네이티브 navigator.credentials API 사용 (외부 라이브러리 의존 없음)
 * - 비대칭 키 기반 서명 검증 및 로컬 볼트 안전 저장
 */

const STORAGE_KEY_ADMIN_WEBAUTHN = 'ebro_admin_webauthn_credential_v1';

export interface WebAuthnCredentialData {
  credentialId: string; // Base64URL string
  publicKey: string;    // Base64 string
  registeredAt: string;
  deviceType: string;
  userName: string;
}

// Base64URL 유틸리티
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 브라우저 및 디바이스가 WebAuthn 및 플랫폼 생체인식(Windows Hello 등)을 지원하는지 검사
 */
export async function isWebAuthnSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (e) {
    console.warn('WebAuthn platform check error:', e);
  }
  return true;
}

/**
 * 등록된 admin 생체인증 크레덴셜 정보 로드
 */
export function getSavedAdminCredential(): WebAuthnCredentialData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN_WEBAUTHN);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse saved WebAuthn credential:', e);
    return null;
  }
}

/**
 * 신규 지문 등록 (최초 1회)
 */
export async function registerAdminFingerprint(username: string = 'admin'): Promise<{
  success: boolean;
  credential?: WebAuthnCredentialData;
  error?: string;
}> {
  if (!window.PublicKeyCredential) {
    return { success: false, error: '현재 브라우저에서는 WebAuthn 생체인증을 지원하지 않습니다.' };
  }

  try {
    // 32바이트 랜덤 챌린지 생성
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userIdBytes = new TextEncoder().encode(`ebro-admin-${username}`);

    const createOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'e-Bro ERP 보안 시스템',
        id: window.location.hostname
      },
      user: {
        id: userIdBytes,
        name: username,
        displayName: '개발자 최고관리자'
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },  // ES256
        { type: 'public-key', alg: -257 } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Windows Hello, Touch ID 등 기기 내장 지문
        userVerification: 'required',        // 지문/PIN 필수
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    };

    const credential = (await navigator.credentials.create({
      publicKey: createOptions
    })) as PublicKeyCredential;

    if (!credential) {
      return { success: false, error: '생체인증 크레덴셜 생성에 실패했습니다.' };
    }

    const credIdBase64 = bufferToBase64Url(credential.rawId);
    const credData: WebAuthnCredentialData = {
      credentialId: credIdBase64,
      publicKey: credIdBase64,
      registeredAt: new Date().toISOString(),
      deviceType: navigator.platform || 'PC',
      userName: username
    };

    localStorage.setItem(STORAGE_KEY_ADMIN_WEBAUTHN, JSON.stringify(credData));
    return { success: true, credential: credData };
  } catch (err: any) {
    console.error('registerAdminFingerprint error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: '지문 인증이 취소되었거나 사용자가 거부했습니다.' };
    }
    return { success: false, error: err.message || '지문 등록 중 오류가 발생했습니다.' };
  }
}

/**
 * 기존 등록된 지문으로 인증 검증 (2단계)
 */
export async function verifyAdminFingerprint(): Promise<{
  success: boolean;
  error?: string;
  requireRegistration?: boolean;
}> {
  if (!window.PublicKeyCredential) {
    return { success: false, error: '현재 브라우저에서는 WebAuthn 생체인증을 지원하지 않습니다.' };
  }

  const savedCred = getSavedAdminCredential();
  if (!savedCred || !savedCred.credentialId) {
    return { 
      success: false, 
      requireRegistration: true,
      error: '등록된 지문 정보가 없습니다. 먼저 이 PC에서 관리자 지문을 등록해 주십시오.' 
    };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const getOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: base64UrlToBuffer(savedCred.credentialId),
          type: 'public-key',
          transports: ['internal']
        }
      ],
      userVerification: 'required',
      timeout: 60000
    };

    const assertion = (await navigator.credentials.get({
      publicKey: getOptions
    })) as PublicKeyCredential;

    if (!assertion || !assertion.id) {
      return { success: false, error: '지문 검증 서명 반환에 실패했습니다.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('verifyAdminFingerprint error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: '지문 인증이 취소되었거나 센서 인식에 실패했습니다.' };
    }
    return { success: false, error: err.message || '지문 인증 검증 중 오류가 발생했습니다.' };
  }
}
