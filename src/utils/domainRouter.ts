// src/utils/domainRouter.ts
// 🌐 멀티테넌트 도메인 라우팅 엔진 (전사 표준 헌장 1.1, 7.1)
// 1. ebro.run (루트) ➔ 공식 홍보 및 마케팅 랜딩 페이지 (LANDING)
// 2. admin.ebro.run ➔ 플랫폼 최고관리자 전용 테넌트 관리 센터 (ADMIN)
// 3. *.ebro.run (서브도메인) ➔ 개별 렌탈사 전용 ERP (TENANT)

export type DomainMode = 'LANDING' | 'ADMIN' | 'TENANT';

/**
 * 현재 브라우저의 호스트명 및 URL 매개변수를 분석하여 도메인 동작 모드를 판정합니다.
 */
export function getDomainMode(): DomainMode {
  if (typeof window === 'undefined') return 'TENANT';

  const hostname = (window.location.hostname || '').toLowerCase();
  const search = (window.location.search || '').toLowerCase();

  // 🧪 개발 및 테스트용 URL 쿼리 파라미터 강제 시뮬레이션 지원 (?mode=landing | ?mode=admin | ?mode=tenant)
  if (search.includes('mode=landing') || search.includes('view=landing')) return 'LANDING';
  if (search.includes('mode=admin') || search.includes('view=admin')) return 'ADMIN';
  if (search.includes('mode=tenant') || search.includes('view=tenant')) return 'TENANT';

  // 1. 공식 루트 홍보 도메인 (ebro.run, www.ebro.run)
  if (hostname === 'ebro.run' || hostname === 'www.ebro.run') {
    return 'LANDING';
  }

  // 2. 플랫폼 최고관리자 전용 관제 서브도메인 (admin.ebro.run, hq.ebro.run, center.ebro.run)
  if (hostname === 'admin.ebro.run' || hostname === 'hq.ebro.run' || hostname === 'center.ebro.run') {
    return 'ADMIN';
  }

  // 3. 개별 테넌트 서브도메인 (giyeon.ebro.run, awp-demo.ebro.run 등) 또는 로컬 개발 환경
  return 'TENANT';
}

/**
 * 특정 테넌트의 서브도메인 정규 URL을 생성합니다.
 */
export function getTenantUrl(subdomain: string): string {
  const cleanSub = (subdomain || '').trim().toLowerCase();
  if (!cleanSub) return 'https://ebro.run';

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    // 로컬 개발 환경 (localhost / 127.0.0.1) 지원
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${window.location.protocol}//${cleanSub}.localhost${port}`;
    }
  }

  return `https://${cleanSub}.ebro.run`;
}

/**
 * 플랫폼 최고관리자 관제탑 URL을 반환합니다.
 */
export function getAdminConsoleUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${window.location.protocol}//localhost${port}?mode=admin`;
    }
  }
  return 'https://admin.ebro.run';
}

/**
 * 공식 홍보 메인 랜딩 URL을 반환합니다.
 */
export function getLandingUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${window.location.protocol}//localhost${port}?mode=landing`;
    }
  }
  return 'https://ebro.run';
}
