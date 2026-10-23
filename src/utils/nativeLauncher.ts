// src/utils/nativeLauncher.ts
// 폰 앱 딥링크, 클립보드 복사 및 전화걸기 안전 실행 유틸리티

import { db, User } from '../services/db';
import { decryptPrivacyField } from './cryptoVault';

/**
 * 👤 배차 건(또는 현재 로그인하여 배차를 입력/조작 중인 임직원)을 기준으로 '당사 보관소' 담당 직원 이름 및 전화번호를 임직원 정보(users)에서 조회
 * 1순위: 현재 로그인하여 배차 화면에서 입력/조작 중인 임직원(currentUser) 정보
 * 2순위: 배차 메모에 기록된 [배차담당자: 이름 (연락처) | ID] 태그 및 해당 User 최신 정보
 * 3순위: cargoItems 내 requestMeta.requesterId 또는 연결된 계약의 영업담당자(salespersonId) User 정보
 * 4순위: 테넌트 기본 주기장/대표 연락처 폴백
 */
export function resolveDispatchStaffContact(params?: {
  delivery?: {
    contractId?: string;
    cargoItems?: string;
    memo?: string;
    closingMemo?: string;
    rawText?: string;
  } | null;
  currentUser?: User | null;
  users?: User[];
  contracts?: Array<{ id: string; salespersonId?: string }>;
  currentTenant?: any;
}): { name: string; phone: string; fullText: string } {
  const userList: User[] = params?.users || db.users || [];
  const contractList = params?.contracts || db.contracts || [];
  const tenant = params?.currentTenant || db.currentTenant;
  const delivery = params?.delivery;
  const activeUser = params?.currentUser;

  const formatUserContact = (u?: User | null, fallbackName?: string, fallbackPhone?: string) => {
    if (!u && !fallbackName) return null;
    const rawName = (u?.name || fallbackName || '').trim();
    if (!rawName) return null;
    const pos = (u?.position || '').trim();
    const displayName = pos && !rawName.includes(pos) && pos !== '개발자' ? `${rawName} ${pos}` : rawName;
    const rawPhone = decryptPrivacyField(u?.phone || '') || (fallbackPhone || '').trim() || tenant?.tel || '';
    const cleanPhone = rawPhone.trim();
    return {
      name: displayName,
      phone: cleanPhone || '연락처 미등록',
      fullText: cleanPhone ? `${displayName} ${cleanPhone}` : displayName
    };
  };

  // 1. 현재 로그인하여 배차 화면에서 입력/조작 중인 임직원(currentUser)
  if (activeUser) {
    const dbUser = userList.find(u => u.id === activeUser.id) || activeUser;
    const resolved = formatUserContact(dbUser);
    if (resolved) return resolved;
  }

  // 2. 배차 메모 내 [배차담당자: 이름 (연락처) | userId] 또는 [배차담당자: 이름 (연락처)] 추출 (저장된 배차 담당 직원)
  const memoText = `${delivery?.memo || ''} ${delivery?.closingMemo || ''} ${delivery?.rawText || ''}`;
  const staffTagMatch = memoText.match(/\[배차담당자:\s*([^|\]]+?)(?:\s*\|\s*([^\]]+))?\]/);
  if (staffTagMatch) {
    const bodyPart = (staffTagMatch[1] || '').trim();
    const taggedUserId = (staffTagMatch[2] || '').trim();
    const namePhoneMatch = bodyPart.match(/^([^\(]+?)(?:\s*\(([^\)]+)\))?$/);
    const parsedName = (namePhoneMatch?.[1] || bodyPart).trim();
    const parsedPhone = (namePhoneMatch?.[2] || '').trim();

    const matchedById = taggedUserId ? userList.find(u => u.id === taggedUserId) : undefined;
    const matchedByName = !matchedById && parsedName
      ? userList.find(u => u.name === parsedName || `${u.name} ${u.position || ''}`.trim() === parsedName)
      : undefined;
    const resolved = formatUserContact(
      matchedById || matchedByName,
      parsedName,
      parsedPhone !== '연락처 미등록' && parsedPhone !== '-' ? parsedPhone : undefined
    );
    if (resolved) return resolved;
  }

  // 3. cargoItems 내 requestMeta.requesterId / requesterName (출고 요청자)
  if (delivery?.cargoItems) {
    try {
      const parsed = typeof delivery.cargoItems === 'string' ? JSON.parse(delivery.cargoItems) : delivery.cargoItems;
      if (Array.isArray(parsed) && parsed[0]?.requestMeta) {
        const reqMeta = parsed[0].requestMeta;
        const reqUser = reqMeta.requesterId
          ? userList.find(u => u.id === reqMeta.requesterId)
          : (reqMeta.requesterName ? userList.find(u => u.name === reqMeta.requesterName) : undefined);
        const resolved = formatUserContact(reqUser, reqMeta.requesterName);
        if (resolved) return resolved;
      }
    } catch {}
  }

  // 4. 계약서에 지정된 담당 임직원(salespersonId)
  if (delivery?.contractId) {
    const contract = contractList.find(c => c.id === delivery.contractId);
    if (contract?.salespersonId) {
      const salesUser = userList.find(u => u.id === contract.salespersonId);
      const resolved = formatUserContact(salesUser);
      if (resolved) return resolved;
    }
  }

  // 4. 폴백: 테넌트 기본 주기장 정보
  const defaultYard = tenant?.yards?.find((y: any) => y.isDefault) || tenant?.yards?.[0];
  const fbName = defaultYard?.managerName || tenant?.representativeName || '배차담당';
  const fbPhone = defaultYard?.managerPhone || defaultYard?.tel || tenant?.tel || '연락처 미등록';
  return {
    name: fbName,
    phone: fbPhone,
    fullText: fbPhone && fbPhone !== '연락처 미등록' ? `${fbName} ${fbPhone}` : fbName
  };
}

export type NavAppType = 'TMAP' | 'KAKAO' | 'NAVER' | 'WEB';

// 🌟 연속 클릭으로 인한 OS 액티비티 충돌 및 데드락 방지 락 (2초)
let lastNavLaunchTime = 0;

/**
 * 모바일 클립보드 안전 복사 헬퍼 (iOS / Android / PWA 전 플랫폼 호환)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText failed:', err);
  }

  // 폴백: textarea execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback execCommand copy failed:', err);
    return false;
  }
}

/**
 * 화면 상단/하단 비간섭 안내 토스트 표출
 */
function showFloatingToast(message: string) {
  const existing = document.getElementById('nav-floating-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'nav-floating-toast';
  toast.style.position = 'fixed';
  toast.style.bottom = '90px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
  toast.style.color = '#38bdf8';
  toast.style.border = '1px solid rgba(56, 189, 248, 0.4)';
  toast.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.5)';
  toast.style.padding = '10px 16px';
  toast.style.borderRadius = '12px';
  toast.style.fontSize = '12px';
  toast.style.fontWeight = 'bold';
  toast.style.zIndex = '99999';
  toast.style.textAlign = 'center';
  toast.style.whiteSpace = 'pre-line';
  toast.style.pointerEvents = 'none';
  toast.innerText = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3500);
}

/**
 * 안전한 길안내 내비게이션 앱 실행기
 * 
 * 📌 [T맵 연동 실패 원인 및 구조적 해결]:
 * 1. 일상에서 공유하는 티맵 링크는 티맵 서버에 이미 저장된 목적지의 위도/경도(GPS 좌표)를 품고 있습니다.
 *    반면 당사 ERP DB에는 사용자가 입력한 문자열 텍스트 주소('창업로 42')만 존재합니다.
 * 2. 티맵의 길안내 스킴은 위경도 숫자 좌표가 없으면 경로 계산을 시작하지 못하고 메인 홈 화면만 엽니다.
 *    좌표가 없는 텍스트 주소는 티맵의 '검색 스킴(tmap://search?name=...)'으로 호출해야 검색창에 주소가 전달됩니다.
 * 3. 현장 상세 주소에 동/호수나 특수문자가 섞여 티맵 POI 검색이 빗나가는 경우를 100% 방지하기 위해,
 *    내비 버튼 클릭 즉시 목적지 주소를 폰 클립보드에 자동 복사하여 필요 시 1-Click 붙여넣기를 보장합니다.
 */
export async function launchNavigation(destination: string, app: NavAppType = 'TMAP') {
  if (!destination || !destination.trim()) {
    alert('길안내 목적지 정보가 없습니다.');
    return;
  }

  // 1. 연속 클릭 방지 락 (2초 이내 중복 호출 차단)
  const now = Date.now();
  if (now - lastNavLaunchTime < 2000) {
    console.warn('내비게이션 호출 쿨다운 중입니다 (중복 호출 차단)');
    return;
  }
  lastNavLaunchTime = now;

  const cleanDest = destination.trim();

  // 2. 📋 폰 클립보드에 고객/현장 주소 100% 선제적 자동 복사 (붙여넣기 대비)
  await copyToClipboard(cleanDest);
  showFloatingToast(`📋 현장 주소가 클립보드에 복사되었습니다!\n(T맵 검색창에 길게 눌러 바로 붙여넣기 가능)`);

  // 3. 검색 쿼리 정제 (부연 설명, 괄호, 층수 등 제거하여 T맵/내비 검색 성공률 극대화)
  const cleanSearchQuery = cleanDest
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/지하\s*\d+층|지상\s*\d+층|\d+층|하역장|게이트.*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || cleanDest;

  const encodedDest = encodeURIComponent(cleanSearchQuery);
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(ua);
  const isIos = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let targetUrl = '';

  if (app === 'TMAP') {
    // 💡 TMAP은 좌표 없는 문자열 주소 전달 시 'search' 스킴을 사용해야 검색창에 주소가 자동 입력됨
    targetUrl = `tmap://search?name=${encodedDest}`;
  } else if (app === 'KAKAO') {
    // 카카오내비 정식 길안내 모드 (텍스트 주소로도 내부 POI 길안내 자동 매핑)
    targetUrl = `kakaonavi://navigate?name=${encodedDest}&coord_type=wgs84`;
  } else if (app === 'NAVER') {
    // 네이버지도 내비게이션 정식 길안내 모드
    targetUrl = `nmap://navigation?dname=${encodedDest}&appname=com.ebro.lift`;
  } else {
    // WEB 모드: 웹 길찾기
    targetUrl = `https://map.kakao.com/link/to/${encodedDest}`;
  }

  // 데스크톱 브라우저이거나 웹 링크인 경우 새 탭 열기
  if (!isAndroid && !isIos && targetUrl.startsWith('http')) {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // 모바일 환경: 브라우저 윈도우 스택 및 DOM을 오염시키지 않는 안전한 다이렉트 디스패치
  try {
    window.location.href = targetUrl;
  } catch {
    const a = document.createElement('a');
    a.href = targetUrl;
    a.target = '_self';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * 안전한 전화걸기 헬퍼
 * - window.location.href 직접 대입으로 인한 PWA 흰 화면 및 세션 리셋 방지
 * - DOM <a> 태그 클릭 방식을 사용하여 폰 기본 전화 다이얼러를 안전하게 호출
 */
export function safePhoneCall(phone: string | undefined | null) {
  if (!phone) {
    alert('전화번호 정보가 없습니다.');
    return;
  }

  const cleanNumber = phone.replace(/[^0-9+*#]/g, '');
  if (!cleanNumber) {
    alert('유효하지 않은 전화번호입니다.');
    return;
  }

  const a = document.createElement('a');
  a.href = `tel:${cleanNumber}`;
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    } catch {
      // ignore
    }
  }, 300);
}

/**
 * 현장 티켓/의뢰 정보로부터 실제 내비게이션 목적지 상세 도로명 주소를 정밀 다단계 역추적
 * 1. siteId 기준 customerSites.address 매핑
 * 2. siteName 기준 customerSites 공백 무시 일치 검색
 * 3. contractId 기준 contracts.siteAddress / customerSites 매핑
 * 4. assetNo / assetId 기준 현재 가동 중인 계약의 현장 도로명 주소 매핑
 * 5. locationDetail 내 도로명 주소 패턴 정규식 매칭
 * 6. customerName 기준 고객사 소속 현장 주소 역추적
 * 7. 최후 폴백: siteName 또는 '현장'
 */
export function resolveSiteDetailedAddress(params: {
  siteAddress?: string;
  siteId?: string;
  siteName?: string;
  contractId?: string;
  assetNo?: string;
  assetId?: string;
  customerName?: string;
  locationDetail?: string;
  customerSites?: Array<{ id: string; customerId?: string; name: string; address?: string }>;
  contracts?: Array<{ id: string; siteId?: string; siteAddress?: string }>;
  contractAssets?: Array<{ contractId: string; assetId?: string; assetNo?: string; actualReturnDate?: string | null }>;
  customers?: Array<{ id: string; name: string; address?: string }>;
}): string {
  const {
    siteAddress,
    siteId,
    siteName,
    contractId,
    assetNo,
    assetId,
    customerName,
    locationDetail,
    customerSites = [],
    contracts = [],
    contractAssets = [],
    customers = []
  } = params;

  // 0. 티켓 자체에 명시된 siteAddress가 있는 경우 최우선 반환 (단일 진실의 원천 SSOT)
  if (siteAddress && siteAddress.trim()) {
    return siteAddress.trim();
  }

  // 1. siteId 기준 매핑
  if (siteId) {
    const site = customerSites.find(s => s.id === siteId);
    if (site?.address && site.address.trim()) {
      return site.address.trim();
    }
  }

  // 2. siteName 기준 customerSites 공백 무시/포함 검색
  if (siteName && siteName.trim()) {
    const sClean = siteName.replace(/\s+/g, '');
    const site = customerSites.find(s => {
      if (!s.name || !s.address?.trim()) return false;
      const msClean = s.name.replace(/\s+/g, '');
      return msClean === sClean || msClean.includes(sClean) || sClean.includes(msClean);
    });
    if (site?.address && site.address.trim()) {
      return site.address.trim();
    }
  }

  // 3. contractId 기준 매핑
  if (contractId) {
    const contract = contracts.find(c => c.id === contractId);
    if (contract?.siteAddress && contract.siteAddress.trim()) {
      return contract.siteAddress.trim();
    }
    if (contract?.siteId) {
      const site = customerSites.find(s => s.id === contract.siteId);
      if (site?.address && site.address.trim()) {
        return site.address.trim();
      }
    }
  }

  // 4. assetNo / assetId 기준 현재 대여 중인 계약 현장 역추적
  if (assetNo || assetId) {
    const targetNo = assetNo?.trim();
    const ca = contractAssets.find(c => 
      !c.actualReturnDate && 
      ((assetId && c.assetId === assetId) || (targetNo && c.assetNo === targetNo))
    );
    if (ca) {
      const contract = contracts.find(c => c.id === ca.contractId);
      if (contract?.siteAddress && contract.siteAddress.trim()) {
        return contract.siteAddress.trim();
      }
      if (contract?.siteId) {
        const site = customerSites.find(s => s.id === contract.siteId);
        if (site?.address && site.address.trim()) {
          return site.address.trim();
        }
      }
    }
  }

  // 5. locationDetail 내에 도로명/지번 주소 패턴이 있는 경우
  if (locationDetail && /(?:시|군|구)\s+[가-힣0-9]+(?:로|길|읍|면|동)/.test(locationDetail)) {
    return locationDetail.trim();
  }

  // 6. customerName 기준 고객사 소속 현장 주소 역추적
  if (customerName && customerName.trim()) {
    const cClean = customerName.replace(/\s+/g, '');
    const cust = customers.find(c => {
      const mcClean = c.name.replace(/\s+/g, '');
      return mcClean === cClean || mcClean.includes(cClean) || cClean.includes(mcClean);
    });
    if (cust) {
      const cSites = customerSites.filter(s => s.customerId === cust.id && s.address?.trim());
      if (cSites.length === 1) {
        return cSites[0].address!.trim();
      } else if (cSites.length > 1 && siteName) {
        const matched = cSites.find(s => s.name.includes(siteName) || siteName.includes(s.name));
        if (matched?.address?.trim()) return matched.address.trim();
      }
      // 고객사에 등록된 기본 도로명 주소가 있는 경우 상속
      if (cust.address && cust.address.trim()) {
        return cust.address.trim();
      }
    }
  }

  // 7. 최후 폴백: 현장명 또는 상세위치
  return siteName || locationDetail || customerName || '현장';
}

/**
 * 🧹 배차 특이사항 정제 헬퍼
 * - 시스템이 자동 기록했던 [마감조건], [회수조건], 유상옵션:, 무상옵션:, 보양:, 부착물:, 마감일/결제일, 납품증 링크 등
 *   장비·옵션·정산 메타데이터를 100% 제거하고, 오직 배차 직원이 직접 입력한 순수 특이사항만 추출한다.
 */
export function sanitizeDispatcherSpecialNote(rawNote?: string | null): string {
  if (!rawNote || !rawNote.trim()) return '';

  const segments = rawNote
    .split('|')
    .map(seg => seg.trim())
    .filter(Boolean);

  const kept: string[] = [];
  for (const seg of segments) {
    // [마감조건] 또는 [회수조건] 접두 제거 후 판별
    const stripped = seg
      .replace(/^\[(?:마감조건|회수조건)\]\s*/g, '')
      .trim();

    if (!stripped) continue;

    // 옵션·정산·시스템 자동 생성 조각은 전면 배제
    if (
      /^(?:마감일|결제일)\s*:/.test(stripped) ||
      /^(?:유상옵션|무상옵션|회수옵션|출고옵션|보양|부착물|현장요구사양)\s*:/.test(stripped) ||
      /^\[(?:회수옵션|출고옵션|무상옵션|유상옵션|옵션|보양작업|정산일정|차종|하차일정|현장상세주소|배차담당자|임차처|고객담당자)/.test(stripped) ||
      /^\[(?:납품증 사진|전자 서명)\]\s*:/.test(stripped) ||
      stripped === '출고 파이프라인 자동 지시건' ||
      stripped === '없음' ||
      stripped === 'NONE' ||
      stripped === '-'
    ) {
      continue;
    }

    kept.push(stripped);
  }

  return kept.join(' | ').trim();
}

/**
 * 🧹 (영업)배차 및 특이사항 메모 순수 추출 헬퍼
 * - 영업사원이 출고/교환/회수 요청 시 직접 기재한 특이사항 메모만 추출하고,
 *   시스템이 자동으로 생성/하드코딩한 태그([고객담당자:...], [배차담당자:...], [출고 요청 통합 발행]..., 현장담당:..., 상차:..., [하차일정]..., [옵션]..., [정산일정]... 등)는 전면 제거한다.
 */
export function stripOptionsFromDispatchRawText(
  rawText?: string | null,
  cargoItems?: string | null,
  fallbackMemo?: string | null
): string {
  const cleanSingleText = (input?: string | null): string => {
    if (!input || !input.trim()) return '';

    // [고객담당자: ...], [배차담당자: ...] 등 인라인 시스템 태그 선제 제거 및 구분자 정규화
    const withoutInlineTags = input
      .replace(/\[출고\s*요청\s*통합\s*(?:발행|확정)\][^\n|]*/g, '')
      .replace(/\[고객담당자:\s*[^\]]*\]/g, '')
      .replace(/\[배차담당자:\s*[^\]]*\]/g, '')
      .replace(/\[외주정비회수\][^\n|]*/g, '')
      .replace(/\]\s*\[(?=(?:회수옵션|출고옵션|무상옵션|유상옵션|옵션|보양작업|배차담당자|임차처|고객담당자|하차일정|시차출고|교환회수대상|대차회수대상|현장상세주소|차종|정산일정|운송료청구기준|운송비부담))/g, '] | [');

    const segments = withoutInlineTags
      .split('|')
      .map(seg => seg.trim())
      .filter(Boolean);

    const kept: string[] = [];
    for (const seg of segments) {
      let cleaned = seg
        .replace(/^\[(?:마감조건|회수조건)\]\s*/g, '')
        .replace(/^특이사항\s*:\s*/g, '')
        .replace(/\[(?:회수옵션|출고옵션|무상옵션|유상옵션|옵션|보양작업|배차담당자|고객담당자|임차처)\][^\]]*\]?/g, '')
        .replace(/(?:유상옵션|무상옵션|회수옵션|출고옵션|보양|부착물|현장요구사양)\s*:\s*[^|]*/g, '')
        .trim();

      if (!cleaned) continue;

      if (
        /^(?:현장담당|상차|하차|청구담당|계산서|마감일|결제일)\s*:/.test(cleaned) ||
        /^\[(?:하차일정|옵션|출고옵션|회수옵션|무상옵션|유상옵션|보양작업|교환회수대상|대차회수대상|현장상세주소|차종|정산일정|운송료청구기준|운송비부담|배차담당자|고객담당자|임차처|납품증 사진|전자 서명)\]/.test(cleaned) ||
        /^\[출고\s*요청\s*통합/.test(cleaned) ||
        cleaned === '출고 파이프라인 자동 지시건' ||
        cleaned === '없음' ||
        cleaned === 'NONE' ||
        cleaned === '-' ||
        cleaned === '특이사항:' ||
        cleaned === '특이사항: 없음'
      ) {
        continue;
      }

      kept.push(cleaned);
    }

    return kept.join(' | ').trim();
  };

  // 1순위: cargoItems 내 requestMeta.userNote (영업사원이 출고 요청 시 직접 입력한 원본 메모)
  if (cargoItems) {
    try {
      const parsed = typeof cargoItems === 'string' ? JSON.parse(cargoItems) : cargoItems;
      if (Array.isArray(parsed) && parsed[0]?.requestMeta && parsed[0].requestMeta.userNote !== undefined) {
        return cleanSingleText(String(parsed[0].requestMeta.userNote || ''));
      }
    } catch {}
  }

  // 2순위: rawText 정제 후 반환, 비어있으면 fallbackMemo 정제 후 반환
  const fromRaw = cleanSingleText(rawText);
  if (fromRaw) return fromRaw;

  return cleanSingleText(fallbackMemo);
}

/**
 * 🚚 화물 기사 배차 안내 문자 포맷팅 파라미터
 */
export interface DispatchBundleStopParam {
  order: number;
  delivery: {
    id?: string;
    type?: string;
    dispatchCategory?: string;
    originalDispatchCategory?: string | null;
    loadingDate?: string;
    loadingTimeSlot?: string;
    unloadingDate?: string;
    unloadingTimeSlot?: string;
    scheduledDate?: string;
    requestDate?: string;
    originAddress?: string;
    destinationAddress?: string;
    cargoItems?: string;
    memo?: string;
    closingMemo?: string;
  };
  originalCategoryLabel?: string;
  siteName?: string;
  siteAddress?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  siteContactPosition?: string;
  customerName?: string;
  cargoFormattedString?: string;
  dispatcherNote?: string;
}

export interface DispatchSmsParams {
  delivery: {
    id?: string;
    type?: string;
    dispatchCategory?: string;
    loadingDate?: string;
    loadingTimeSlot?: string;
    unloadingDate?: string;
    unloadingTimeSlot?: string;
    scheduledDate?: string;
    requestDate?: string;
    originAddress?: string;
    destinationAddress?: string;
    vehicleNo?: string;
    vehicleType?: string;
    driverName?: string;
    driverContact?: string;
    deliveryCost?: number;
    finalCost?: number;
    cargoItems?: string;
    memo?: string;
    closingMemo?: string;
  };
  siteName?: string;
  siteAddress?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  customerName?: string;
  companyName?: string;
  hqYardAddress?: string;
  hqYardPhone?: string;
  hqYardContactPerson?: string;
  bundleStops?: DispatchBundleStopParam[];
}

/**
 * 🚚 기사 배차 안내 문자 전문 조립기 (한글 표준 템플릿)
 */
export function buildDispatchSmsText(params: DispatchSmsParams): string {
  const { delivery } = params;
  const defaultYard = db.currentTenant?.yards?.find(y => y.isDefault) || db.currentTenant?.yards?.[0];
  const defaultYardAddress = db.currentTenant?.businessAddress || defaultYard?.address || db.currentTenant?.headOfficeAddress || db.currentTenant?.mainYardAddress || '본사 주기장';
  const defaultYardName = defaultYard?.name || '본사 주기장';
  const defaultCompany = db.currentTenant?.displayName || db.currentTenant?.tradeName || db.currentTenant?.corporateName || '기연리프트';
  const resolvedStaff = resolveDispatchStaffContact({ delivery });

  const hqAddress = params.hqYardAddress || defaultYardAddress;
  const hqContactPerson = params.hqYardContactPerson || resolvedStaff.name;
  const hqPhone = params.hqYardPhone || resolvedStaff.phone || db.currentTenant?.tel || '배차/출고팀';
  const hqContactFull = hqContactPerson
    ? (hqPhone && !hqContactPerson.includes(hqPhone) ? `${hqContactPerson} ${hqPhone}` : hqContactPerson)
    : hqPhone;
  const companyName = params.companyName || defaultCompany;

  const type = delivery.type || 'OUTBOUND';
  const typeLabel = 
    type === 'EXCHANGE' ? '🔄 [왕복 교환배차]' :
    type === 'RETURN' || type === 'INBOUND' ? '📦 [장비 회수배차]' :
    '🚚 [장비 출고배차]';

  const category = delivery.dispatchCategory || (type === 'EXCHANGE' ? '교환' : type === 'RETURN' ? '반납' : '출고');
  const dNo = delivery.id ? delivery.id.slice(0, 8).toUpperCase() : 'NEW';

  const driver = delivery.driverName || '기사님';
  const vehicle = [delivery.vehicleType, delivery.vehicleNo].filter(Boolean).join(' ') || '지정차량';
  const cost = delivery.finalCost || delivery.deliveryCost || 0;
  const costStr = cost > 0 ? `${cost.toLocaleString()}원 (부가세별도)` : '운송사 약정단가';

  const loadingDate = delivery.loadingDate || delivery.scheduledDate || delivery.requestDate || '일정 확인요망';
  const loadingTime = delivery.loadingTimeSlot || '오전';

  const siteName = params.siteName || params.customerName || '현장';
  const siteAddress = delivery.destinationAddress || params.siteAddress || '하차지 주소 확인요망';
  const contactName = params.siteContactName || '현장담당자';
  const contactPhone = params.siteContactPhone || '';

  let cargoSummary = '';
  if (delivery.cargoItems) {
    try {
      if (typeof delivery.cargoItems === 'string' && delivery.cargoItems.startsWith('[')) {
        const parsed = JSON.parse(delivery.cargoItems);
        if (Array.isArray(parsed)) {
          cargoSummary = parsed.map((p: any) => `${p.modelName || p.ft || '장비'} ${p.count || 1}대`).join(', ');
        }
      } else {
        cargoSummary = delivery.cargoItems;
      }
    } catch {
      cargoSummary = delivery.cargoItems;
    }
  }

  // 상차지와 하차지 분기
  let origin = formatAddressWithCompanyYard(delivery.originAddress || hqAddress, hqAddress);
  let destination = formatAddressWithCompanyYard(siteAddress, hqAddress);
  let originContact = hqContactFull;
  let destContact = [contactName, contactPhone].filter(Boolean).join(' ');

  // 임차자산 반납(RETURN)은 당사 보관소 상차 -> 임차처 하차 / 일반 회수(INBOUND)는 현장 상차 -> 당사 보관소 하차
  const isHqOrigin = !delivery.originAddress || delivery.originAddress.includes('당사 보관소') || delivery.originAddress.includes('주기장') || delivery.originAddress === hqAddress;
  if ((type === 'RETURN' || type === 'INBOUND') && !isHqOrigin) {
    origin = formatAddressWithCompanyYard(siteAddress, hqAddress);
    originContact = [contactName, contactPhone].filter(Boolean).join(' ');
    destination = formatAddressWithCompanyYard(delivery.destinationAddress || '당사 보관소', hqAddress);
    destContact = hqContactFull;
  }

  const headerTitle = `[${companyName} 배차안내]`;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://giyoon.ebro.run';

  // 🔗 [경유/합짐 묶음 배차] 2건 이상 묶인 경우 처리 순서대로 안내문 조립
  if (params.bundleStops && params.bundleStops.length >= 2) {
    const sortedStops = [...params.bundleStops].sort((a, b) => a.order - b.order);
    const bundleLines: string[] = [
      headerTitle,
      `■ 배차유형: 🔗 [경유/합짐 배차 (총 ${sortedStops.length}건)]`,
      `■ 배정기사: ${driver} (${vehicle})`,
      `■ 확정운송료: ${costStr}`,
      `※ 아래 처리 순서(1 ➔ ${sortedStops.length})대로 상·하차를 진행해 주십시오.`
    ];

    sortedStops.forEach((stop, idx) => {
      const sDeliv = stop.delivery;
      const sType = (sDeliv.type || '').toUpperCase();
      const sOrigCat = stop.originalCategoryLabel || sDeliv.originalDispatchCategory || (
        sType === 'EXCHANGE' ? '교환' : sType === 'RETURN' ? '반납' : sType === 'INBOUND' ? '회수' : '출고'
      );
      const sLoadingDate = sDeliv.loadingDate || sDeliv.scheduledDate || sDeliv.requestDate || loadingDate;
      const sLoadingTime = sDeliv.loadingTimeSlot || '오전';
      const sUnloadingDate = sDeliv.unloadingDate || sLoadingDate;
      const sUnloadingTime = sDeliv.unloadingTimeSlot || '';
      const sSiteName = stop.siteName || stop.customerName || '현장';
      const sSiteAddr = stop.siteAddress || sDeliv.destinationAddress || '주소 확인요망';
      const sSiteContact = [stop.siteContactName, stop.siteContactPhone].filter(Boolean).join(' ') || '도착 전 확인';
      const sCargo = stop.cargoFormattedString || sDeliv.cargoItems || '고소작업대';

      const isStopReturn = sOrigCat === '입고' || sOrigCat === '회수' || (sType === 'INBOUND' && sOrigCat !== '반납');
      let sOrigin = formatAddressWithCompanyYard(sDeliv.originAddress || hqAddress, hqAddress);
      let sDest = formatAddressWithCompanyYard(sSiteAddr, hqAddress);
      let sOriginContact = hqContactFull;
      let sDestContact = sSiteContact;

      if (isStopReturn) {
        sOrigin = formatAddressWithCompanyYard(sSiteAddr, hqAddress);
        sOriginContact = sSiteContact;
        sDest = formatAddressWithCompanyYard(sDeliv.destinationAddress || '당사 보관소', hqAddress);
        sDestContact = hqContactFull;
      }

      bundleLines.push(
        ``,
        `━━━━━━━━━━━━━━`,
        `[순서 ${idx + 1} : ${sOrigCat}] ${stop.customerName || ''} (${sSiteName})`.trim(),
        `- 상차일시: ${sLoadingDate} ${sLoadingTime}`,
        `- 상차위치: ${sOrigin} (${sOriginContact})`,
        `- 하차일시: ${sUnloadingDate} ${sUnloadingTime}`.trim(),
        `- 하차위치: ${sDest} (${sDestContact})`,
        `- 적재장비: ${sCargo}`
      );
      if (sOrigCat === '교환' || sType === 'EXCHANGE') {
        bundleLines.push(`- 교환안내: 신규 장비 하차 후 현장 회수 장비 상차 (${defaultYardName} 입고)`);
      }
      const stopNote = sanitizeDispatcherSpecialNote(stop.dispatcherNote ?? sDeliv.closingMemo);
      if (stopNote) {
        bundleLines.push(`- 특이사항: ${stopNote}`);
      }
    });

    bundleLines.push(``, `※ 현장 도착 30분 전 각 현장 인수자에게 사전 연락 부탁드립니다.`);
    bundleLines.push(``);
    bundleLines.push(`──────────────`);
    bundleLines.push(`▶ 기사용 운송/납품 완료 ◀`);
    bundleLines.push(`아래 링크를 눌러 납품증 사진을 찍으면 운송완료 처리됩니다.`);
    sortedStops.forEach((stop, idx) => {
      if (stop.delivery.id) {
        bundleLines.push(`[순서 ${idx + 1}] ${stop.customerName || stop.siteName || '현장'}: ${baseUrl}/driver-portal/${stop.delivery.id}`);
      }
    });

    return bundleLines.join('\n');
  }

  const lines = [
    headerTitle,
    `■ 배차유형: ${typeLabel} (${category})`,
    `■ 배차번호: DP-${dNo}`,
    `■ 배정기사: ${driver} (${vehicle})`,
    `■ 확정운송료: ${costStr}`,
    ``,
    `[1. 상차지 (출발지)]`,
    `- 일시: ${loadingDate} ${loadingTime}`,
    `- 위치: ${origin}`,
    `- 연락처: ${originContact}`,
    ``,
    `[2. 하차지 (도착지)]`,
    `- 일시: ${delivery.unloadingDate || loadingDate} ${delivery.unloadingTimeSlot || ''}`.trim(),
    `- 현장명: ${siteName}`,
    `- 위치: ${destination}`,
    `- 현장연락처: ${destContact || '도착 전 확인'}`,
  ];

  if (cargoSummary) {
    lines.push(``, `[3. 적재 장비]`, `- ${cargoSummary}`);
  }

  if (type === 'EXCHANGE') {
    lines.push(``, `※ [교환 배차 주의사항]`, `- 신규 장비 하차 후, 현장 회수 장비를 상차하여 ${defaultYardName}(으)로 복귀하는 왕복 배차입니다.`);
  }

  const specialNote = sanitizeDispatcherSpecialNote(delivery.closingMemo);
  if (specialNote) {
    lines.push(``, `[특이사항]`, `- ${specialNote}`);
  }

  lines.push(``, `※ 현장 도착 30분 전 인수자에게 사전 연락 부탁드립니다.`);

  // 기사용 모바일 포털 링크 추가
  lines.push('');
  lines.push('──────────────');
  lines.push('▶ 기사용 운송/납품 완료 ◀');
  lines.push('아래 링크를 눌러 납품증 사진을 찍으면 운송완료 처리됩니다.');
  lines.push(`${baseUrl}/driver-portal/${delivery.id}`);

  return lines.join('\n');

}

/**
 * 📲 폰 기본 문자메시지 앱 딥링크 호출 (sms:?body=...)
 * - 선제 클립보드 복사를 수행하여 앱 미연동 환경에서도 1-Click 붙여넣기 지원
 */
export async function launchDispatchSms(options: {
  driverContact: string;
  smsBody: string;
}): Promise<boolean> {
  const { driverContact, smsBody } = options;
  if (!driverContact || !driverContact.trim()) {
    alert('화물 기사 연락처가 없습니다.');
    return false;
  }

  // 1. 선제 클립보드 안전 복사
  await copyToClipboard(smsBody);

  // 2. 모바일 브라우저 sms: 딥링크 호출
  const cleanPhone = driverContact.replace(/[^0-9]/g, '');
  const isApple = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const separator = isApple ? '&' : '?';
  const smsUrl = `sms:${cleanPhone}${separator}body=${encodeURIComponent(smsBody)}`;

  try {
    window.location.href = smsUrl;
    showFloatingToast('기사 배차 안내문이 문자 앱에 입력되었습니다.\n(클립보드에도 복사 완료)');
    return true;
  } catch (err) {
    console.warn('launchDispatchSms failed:', err);
    alert('문자 앱을 호출하지 못했습니다. 배차 안내문이 클립보드에 복사되었으니 메시지 창에 붙여넣기 하세요.');
    return false;
  }
}
/**
 * 💬 날짜 포맷팅 헬퍼 (MM월 DD일(요일))
 */
export function formatKakaoDate(dateStr?: string): { formatted: string; monthDay: string; dayOfWeek: string } {
  if (!dateStr) return { formatted: '', monthDay: '', dayOfWeek: '' };
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m - 1, d);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dow = days[dt.getDay()] || '월';
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return {
      formatted: `${mm}월 ${dd}일(${dow})`,
      monthDay: `${mm}월 ${dd}일`,
      dayOfWeek: `(${dow})`
    };
  }
  return { formatted: dateStr, monthDay: dateStr, dayOfWeek: '' };
}

/**
 * 💬 차량 톤수 포맷팅 헬퍼 ((5톤), (8.5톤))
 */
export function formatVehicleTon(vehicleType?: string): string {
  if (!vehicleType) return '(5톤)';
  let clean = vehicleType.trim();
  if (clean.endsWith('T') || clean.endsWith('t')) {
    clean = clean.slice(0, -1) + '톤';
  } else if (!clean.endsWith('톤') && !isNaN(Number(clean))) {
    clean = clean + '톤';
  }
  return `(${clean})`;
}

/**
 * 💬 시간 문자열 포맷팅 헬퍼
 */
export function formatKakaoTimeSlot(timeSlot?: string, defaultPrefix = '오전'): string {
  if (!timeSlot || timeSlot === 'NONE' || timeSlot === '시간미정') return '시간협의';
  let t = timeSlot.trim();
  t = t.replace(/(상차|하차)$/, '').trim();
  return t || defaultPrefix;
}

/**
 * 💬 상차지/하차지가 '당사 보관소'(또는 '본사 주기장'/'당사 주기장')인 경우 당사 주소를 함께 표시하는 헬퍼
 */
export function formatAddressWithCompanyYard(rawAddr: string | undefined, hqAddress?: string): string {
  const defaultYard = db.currentTenant?.yards?.find(y => y.isDefault) || db.currentTenant?.yards?.[0];
  const fallbackHq =
    db.currentTenant?.businessAddress ||
    defaultYard?.address ||
    db.currentTenant?.headOfficeAddress ||
    db.currentTenant?.mainYardAddress ||
    '';
  const cleanHq =
    hqAddress && hqAddress.trim() && hqAddress.trim() !== '당사 보관소' && hqAddress.trim() !== '본사 주기장'
      ? hqAddress.trim()
      : fallbackHq;

  const trimmed = (rawAddr || '').trim();
  if (!trimmed) {
    return cleanHq ? `당사 보관소 (${cleanHq})` : '당사 보관소';
  }

  const normalized = trimmed.replace(/\s+/g, '');
  if (
    normalized === '당사보관소' ||
    normalized === '본사보관소' ||
    normalized === '당사주기장' ||
    normalized === '본사주기장'
  ) {
    return cleanHq ? `${trimmed} (${cleanHq})` : trimmed;
  }

  if (
    (trimmed.includes('당사 보관소') ||
      trimmed.includes('당사보관소') ||
      trimmed.includes('본사 주기장') ||
      trimmed.includes('당사 주기장')) &&
    cleanHq &&
    !trimmed.includes(cleanHq)
  ) {
    return `${trimmed} (${cleanHq})`;
  }

  return trimmed;
}

/**
 * 💬 카카오톡 배차 안내 메시지 생성 파라미터
 */
export interface DispatchKakaoParams {
  delivery: {
    id?: string;
    type?: string;
    dispatchCategory?: string;
    loadingDate?: string;
    loadingTimeSlot?: string;
    unloadingDate?: string;
    unloadingTimeSlot?: string;
    scheduledDate?: string;
    requestDate?: string;
    originAddress?: string;
    destinationAddress?: string;
    vehicleNo?: string;
    vehicleType?: string;
    driverName?: string;
    driverContact?: string;
    deliveryCost?: number;
    finalCost?: number;
    cargoItems?: string;
    memo?: string;
    closingMemo?: string;
  };
  siteName?: string;
  siteAddress?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  siteContactPosition?: string;
  customerName?: string;
  companyName?: string;
  hqYardAddress?: string;
  hqYardPhone?: string;
  hqYardContactPerson?: string;
  cargoFormattedString?: string;
  dispatcherNote?: string;
  isSelfCar?: boolean;
  bundleStops?: DispatchBundleStopParam[];
}

/**
 * 💬 영업사원 및 화물기사용 카카오톡 배차 안내 전문 조립기 (유형별 단일 표준 양식)
 */
export function buildDispatchKakaoTalkText(params: DispatchKakaoParams): string {
  const { delivery } = params;

  // 1. 기본 주기장 및 당사 담당자 정보 (임직원 정보 기반 담당자 이름 + 전화번호 우선 적용)
  const defaultYard = db.currentTenant?.yards?.find(y => y.isDefault) || db.currentTenant?.yards?.[0];
  const defaultYardAddress = db.currentTenant?.businessAddress || defaultYard?.address || db.currentTenant?.headOfficeAddress || db.currentTenant?.mainYardAddress || '당사 보관소';
  const resolvedStaff = resolveDispatchStaffContact({ delivery });
  const staffContactPerson = params.hqYardContactPerson || resolvedStaff.name;
  const staffContactPhone = params.hqYardPhone || resolvedStaff.phone;
  const defaultYardContact = staffContactPerson
    ? (staffContactPhone && staffContactPhone !== '연락처 미등록' && !staffContactPerson.includes(staffContactPhone)
        ? `${staffContactPerson} ${staffContactPhone}`
        : staffContactPerson)
    : (defaultYard?.managerName ? `${defaultYard.managerName} ${defaultYard.managerPhone || defaultYard.tel || ''}`.trim() : (db.currentTenant?.tel || '배차담당'));

  const hqAddress = params.hqYardAddress || defaultYardAddress;
  const hqContact = defaultYardContact;

  // 2. 배차 유형 판정 (출고 / 반납(임차처반납) / 입고(회수) / 교환)
  const rawType = (delivery.type || '').toUpperCase();
  const rawCat = (delivery.dispatchCategory || '').trim();

  const isExchange = rawType === 'EXCHANGE' || rawCat === '교환';
  const isSubleaseReturn = rawType === 'RETURN' || rawCat === '반납';
  const isReturn = isSubleaseReturn || rawType === 'INBOUND' || rawCat === '입고' || rawCat === '회수';

  // 3. 날짜 & 요일 포맷팅
  const baseLoadingDateStr = delivery.loadingDate || delivery.scheduledDate || delivery.requestDate || new Date().toISOString().slice(0, 10);
  const loadingDateInfo = formatKakaoDate(baseLoadingDateStr);

  const baseUnloadingDateStr = delivery.unloadingDate || baseLoadingDateStr;
  const unloadingDateInfo = formatKakaoDate(baseUnloadingDateStr);

  // 4. 셀프카 여부 판정
  const vType = (delivery.vehicleType || '').trim();
  const memoText = [delivery.memo, delivery.closingMemo, delivery.cargoItems].filter(Boolean).join(' ');
  const isSelfCar = params.isSelfCar || vType.includes('셀프') || memoText.includes('셀프');

  // 5. 차량 톤수 포맷
  const vehicleTon = formatVehicleTon(vType);

  // 6. 상차시간 & 하차시간 포맷
  const loadingTimeFormatted = formatKakaoTimeSlot(delivery.loadingTimeSlot, '오전');
  const unloadingTimeFormatted = formatKakaoTimeSlot(delivery.unloadingTimeSlot, '오후');

  // 7. 장비종류 포맷 (예: GS3246*1 / GS2646*1 / GS1930*2 또는 0808E*4)
  let cargoStr = params.cargoFormattedString;
  if (!cargoStr && delivery.cargoItems) {
    try {
      if (typeof delivery.cargoItems === 'string' && delivery.cargoItems.startsWith('[')) {
        const parsed = JSON.parse(delivery.cargoItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cargoStr = parsed.map((p: any) => `${p.modelName || '장비'}*${p.count || 1}`).join(' / ');
        }
      }
    } catch {}
  }
  if (!cargoStr) {
    cargoStr = delivery.cargoItems || '고소작업대*1';
  }

  // 8. 고객사 및 현장 정보
  const customerName = params.customerName || '고객사';
  const siteName = params.siteName || '현장';
  const siteAddress = params.siteAddress || delivery.destinationAddress || '현장 주소 확인요망';

  // 현장 담당자 (이름 + 직함 + 연락처 결합)
  const contactParts: string[] = [];
  if (params.siteContactName) contactParts.push(params.siteContactName);
  if (params.siteContactPosition && !params.siteContactName?.includes(params.siteContactPosition)) {
    contactParts.push(params.siteContactPosition);
  }
  if (params.siteContactPhone) contactParts.push(params.siteContactPhone);
  const siteContactFull = contactParts.join(' ') || '현장담당자 확인요망';

  const lines: string[] = [];

  // ───────────────────────────────────────────────
  // 헤더: 날짜 + (셀프카) + 차량톤수
  // ───────────────────────────────────────────────
  lines.push(`날짜:${loadingDateInfo.formatted}`);
  lines.push(``);

  if (isSelfCar) {
    lines.push(`셀프카`);
    lines.push(``);
  }

  lines.push(`차량톤수:${vehicleTon}`);

  // ───────────────────────────────────────────────
  // 🔗 [경유/합짐 묶음 배차] 2건 이상 묶인 경우 처리 순서대로 안내문 조립
  // ───────────────────────────────────────────────
  if (params.bundleStops && params.bundleStops.length >= 2) {
    const sortedStops = [...params.bundleStops].sort((a, b) => a.order - b.order);
    lines.push(``);
    lines.push(`[경유/합짐 배차 (총 ${sortedStops.length}건)]`);
    lines.push(`※ 아래 처리 순서(1 ➔ ${sortedStops.length})대로 상·하차를 진행해 주십시오.`);

    const notesList: string[] = [];

    sortedStops.forEach((stop, idx) => {
      const sDeliv = stop.delivery;
      const sRawType = (sDeliv.type || '').toUpperCase();
      const sOrigCat = (
        stop.originalCategoryLabel ||
        sDeliv.originalDispatchCategory ||
        (sDeliv.dispatchCategory && sDeliv.dispatchCategory !== '경유/합짐' ? sDeliv.dispatchCategory : '') ||
        (sRawType === 'EXCHANGE' ? '교환' : sRawType === 'RETURN' ? '반납' : sRawType === 'INBOUND' ? '입고' : '출고')
      ).trim();

      const sIsExchange = sRawType === 'EXCHANGE' || sOrigCat === '교환';
      const sIsSubleaseReturn = sRawType === 'RETURN' || sOrigCat === '반납';
      const sIsReturn = sIsSubleaseReturn || sRawType === 'INBOUND' || sOrigCat === '입고' || sOrigCat === '회수';

      const sLoadDateStr = sDeliv.loadingDate || sDeliv.scheduledDate || sDeliv.requestDate || baseLoadingDateStr;
      const sUnloadDateStr = sDeliv.unloadingDate || sLoadDateStr;
      const sUnloadDateInfo = formatKakaoDate(sUnloadDateStr);
      const sLoadTime = formatKakaoTimeSlot(sDeliv.loadingTimeSlot, '오전');
      const sUnloadTime = formatKakaoTimeSlot(sDeliv.unloadingTimeSlot, '오후');

      let sCargo = stop.cargoFormattedString;
      if (!sCargo && sDeliv.cargoItems) {
        try {
          if (typeof sDeliv.cargoItems === 'string' && sDeliv.cargoItems.startsWith('[')) {
            const parsed = JSON.parse(sDeliv.cargoItems);
            if (Array.isArray(parsed) && parsed.length > 0) {
              sCargo = parsed.map((p: any) => `${p.modelName || '장비'}*${p.count || 1}`).join(' / ');
            }
          }
        } catch {}
      }
      if (!sCargo) sCargo = sDeliv.cargoItems || '고소작업대*1';

      const sCustName = stop.customerName || '고객사';
      const sSiteName = stop.siteName || '현장';
      const sSiteAddr = stop.siteAddress || sDeliv.destinationAddress || '현장 주소 확인요망';

      const sContactParts: string[] = [];
      if (stop.siteContactName) sContactParts.push(stop.siteContactName);
      if (stop.siteContactPosition && !stop.siteContactName?.includes(stop.siteContactPosition)) {
        sContactParts.push(stop.siteContactPosition);
      }
      if (stop.siteContactPhone) sContactParts.push(stop.siteContactPhone);
      const sSiteContactFull = sContactParts.join(' ') || '현장담당자 확인요망';

      const displayCatLabel = sOrigCat === '입고' ? '회수' : sOrigCat;

      lines.push(``);
      lines.push(`━━━━━━━━━━━━━━`);
      lines.push(`[순서 ${idx + 1} : ${displayCatLabel}]`);

      if (sIsReturn) {
        const sRawOrigin = (sDeliv.originAddress || '').trim();
        const sIsOriginHq = !sRawOrigin || sRawOrigin.includes('당사 보관소') || sRawOrigin.includes('주기장') || sRawOrigin === hqAddress;
        if (sIsSubleaseReturn && sIsOriginHq) {
          const subOrigin = formatAddressWithCompanyYard(sDeliv.originAddress || '당사 보관소', hqAddress);
          const subDest = formatAddressWithCompanyYard(sSiteAddr || sDeliv.destinationAddress || '임차처', hqAddress);
          lines.push(`상차시간 : ${sLoadTime} 상차`);
          lines.push(`상차지 : ${subOrigin}`);
          lines.push(`담당자 : ${hqContact}`);
          lines.push(`장비종류 : ${sCargo}`);
          lines.push(``);
          lines.push(`하차시간 : ${sUnloadDateInfo.formatted} ${sUnloadTime} 하차`);
          lines.push(`업체명 : ${sCustName}`);
          lines.push(`하차지 : ${subDest}`);
          lines.push(`담당자 : ${sSiteContactFull}`);
        } else {
          const retOrigin = formatAddressWithCompanyYard(sDeliv.originAddress || sSiteAddr, hqAddress);
          const retDest = formatAddressWithCompanyYard(sDeliv.destinationAddress || '당사 보관소', hqAddress);
          lines.push(`상차시간 : ${sLoadTime} 상차`);
          lines.push(`업체명 : ${sCustName}`);
          lines.push(`현장명 : ${sSiteName}`);
          lines.push(`상차지 : ${retOrigin}`);
          lines.push(`담당자 : ${sSiteContactFull}`);
          lines.push(`장비종류 : ${sCargo}`);
          lines.push(``);
          lines.push(`하차시간 : ${sUnloadDateInfo.formatted} ${sUnloadTime} 하차`);
          lines.push(`하차지: ${retDest}`);
          lines.push(`담당자: ${hqContact}`);
        }
      } else if (sIsExchange) {
        const exOrigin = formatAddressWithCompanyYard(sDeliv.originAddress || '당사 보관소', hqAddress);
        const exSiteAddr = formatAddressWithCompanyYard(sSiteAddr, hqAddress);
        const exReturnDest = formatAddressWithCompanyYard(
          sDeliv.destinationAddress && sDeliv.destinationAddress.includes('보관소')
            ? sDeliv.destinationAddress
            : '당사 보관소',
          hqAddress
        );
        lines.push(`상차시간 : ${sLoadTime} 상차`);
        lines.push(`상차지 : ${exOrigin}`);
        lines.push(`담당자 : ${hqContact}`);
        lines.push(`출고장비 : ${sCargo}`);
        lines.push(``);
        lines.push(`하차시간 : ${sUnloadDateInfo.formatted} ${sUnloadTime} 하차`);
        lines.push(`현장명 : ${sSiteName}`);
        lines.push(`현장 상세 : ${exSiteAddr}`);
        lines.push(`업체명 : ${sCustName}`);
        lines.push(`담당자 : ${sSiteContactFull}`);
        lines.push(`회수장비 : ${sCargo} (회수)`);
        lines.push(``);
        lines.push(`하차지: ${exReturnDest}`);
        lines.push(`담당자: ${hqContact}`);
      } else {
        const outOrigin = formatAddressWithCompanyYard(sDeliv.originAddress || '당사 보관소', hqAddress);
        const outDest = formatAddressWithCompanyYard(sDeliv.destinationAddress || sSiteAddr, hqAddress);
        lines.push(`상차시간 : ${sLoadTime} 상차`);
        lines.push(`상차지: ${outOrigin}`);
        lines.push(`담당자: ${hqContact}`);
        lines.push(`장비종류 : ${sCargo}`);
        lines.push(``);
        lines.push(`하차시간 : ${sUnloadDateInfo.formatted} ${sUnloadTime} 하차`);
        lines.push(`현장명 : ${sSiteName}`);
        lines.push(`현장 상세 : ${outDest}`);
        lines.push(`업체명 : ${sCustName}`);
        lines.push(`담당자 : ${sSiteContactFull}`);
      }

      const stopNote = sanitizeDispatcherSpecialNote(
        stop.dispatcherNote !== undefined ? stop.dispatcherNote : sDeliv.closingMemo
      );
      if (stopNote) {
        notesList.push(`[순서 ${idx + 1}] ${stopNote}`);
      }
    });

    lines.push(`━━━━━━━━━━━━━━`);

    if (notesList.length > 0) {
      lines.push(``);
      lines.push(`특이사항 : ${notesList.join(' / ')}`);
    } else {
      const fallbackNote = sanitizeDispatcherSpecialNote(
        params.dispatcherNote !== undefined ? params.dispatcherNote : delivery.closingMemo
      );
      if (fallbackNote) {
        lines.push(``);
        lines.push(`특이사항 : ${fallbackNote}`);
      }
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://giyoon.ebro.run';
    lines.push('');
    lines.push('──────────────');
    lines.push('▶ 기사용 운송/납품 완료 ◀');
    lines.push('아래 링크를 눌러 납품증 사진을 찍으면 운송완료 처리됩니다.');
    sortedStops.forEach((stop, idx) => {
      if (stop.delivery.id) {
        lines.push(`[순서 ${idx + 1}] ${stop.customerName || stop.siteName || '현장'}: ${baseUrl}/driver-portal/${stop.delivery.id}`);
      }
    });

    return lines.join('\n');
  }

  // ───────────────────────────────────────────────
  // 본문: 유형별 분기
  // ───────────────────────────────────────────────
  if (isReturn) {
    const rawOrigin = (delivery.originAddress || '').trim();
    const isOriginHq = !rawOrigin || rawOrigin.includes('당사 보관소') || rawOrigin.includes('주기장') || rawOrigin === hqAddress;
    if (isSubleaseReturn && isOriginHq) {
      // ═══════════════════════════════════════════════
      // [유형 1-A: 임차자산 반납 배차] (당사 보관소 상차 -> 임차처 하차)
      // ═══════════════════════════════════════════════
      const subleaseOrigin = formatAddressWithCompanyYard(delivery.originAddress || '당사 보관소', hqAddress);
      const subleaseDest = formatAddressWithCompanyYard(siteAddress || delivery.destinationAddress || '임차처', hqAddress);
      lines.push(``);
      lines.push(`상차시간 : ${loadingTimeFormatted} 상차`);
      lines.push(`상차지 : ${subleaseOrigin}`);
      lines.push(`담당자 : ${hqContact}`);
      lines.push(`장비종류 : ${cargoStr}`);
      lines.push(``);
      lines.push(`하차시간 : ${unloadingDateInfo.formatted} ${unloadingTimeFormatted} 하차`);
      lines.push(`업체명 : ${customerName}`);
      lines.push(`하차지 : ${subleaseDest}`);
      lines.push(`담당자 : ${siteContactFull}`);
    } else {
      // ═══════════════════════════════════════════════
      // [유형 1-B: 입고/회수 배차] (현장 상차 -> 당사 보관소 하차)
      // ═══════════════════════════════════════════════
      const returnOrigin = formatAddressWithCompanyYard(delivery.originAddress || siteAddress, hqAddress);
      const returnDest = formatAddressWithCompanyYard(delivery.destinationAddress || '당사 보관소', hqAddress);
      lines.push(``);
      lines.push(`상차시간 : ${loadingTimeFormatted} 상차`);
      lines.push(`업체명 : ${customerName}`);
      lines.push(`현장명 : ${siteName}`);
      lines.push(`상차지 : ${returnOrigin}`);
      lines.push(`담당자 : ${siteContactFull}`);
      lines.push(`장비종류 : ${cargoStr}`);
      lines.push(``);
      lines.push(`하차시간 : ${unloadingDateInfo.formatted} ${unloadingTimeFormatted} 하차`);
      lines.push(`하차지: ${returnDest}`);
      lines.push(`담당자: ${hqContact}`);
    }
  } else if (isExchange) {
    // ═══════════════════════════════════════════════
    // [유형 3: 교환 배차] (당사 출고 상차 -> 현장 교환 -> 당사 회수 입고)
    // ═══════════════════════════════════════════════
    const exOrigin = formatAddressWithCompanyYard(delivery.originAddress || '당사 보관소', hqAddress);
    const exSiteAddr = formatAddressWithCompanyYard(siteAddress, hqAddress);
    const exReturnDest = formatAddressWithCompanyYard(
      delivery.destinationAddress && delivery.destinationAddress.includes('보관소')
        ? delivery.destinationAddress
        : '당사 보관소',
      hqAddress
    );
    lines.push(``);
    lines.push(`[교환배차]`);
    lines.push(`상차시간 : ${loadingTimeFormatted} 상차`);
    lines.push(`상차지 : ${exOrigin}`);
    lines.push(`담당자 : ${hqContact}`);
    lines.push(`출고장비 : ${cargoStr}`);
    lines.push(``);
    lines.push(`하차시간 : ${unloadingDateInfo.formatted} ${unloadingTimeFormatted} 하차`);
    lines.push(`현장명 : ${siteName}`);
    lines.push(`현장 상세 : ${exSiteAddr}`);
    lines.push(`업체명 : ${customerName}`);
    lines.push(`담당자 : ${siteContactFull}`);
    lines.push(`회수장비 : ${cargoStr} (회수)`);
    lines.push(``);
    lines.push(`하차지: ${exReturnDest}`);
    lines.push(`담당자: ${hqContact}`);

  } else {
    // ═══════════════════════════════════════════════
    // [유형 2: 출고 배차 (기본)] (당사 상차 -> 고객 현장 하차)
    // ═══════════════════════════════════════════════
    const outOrigin = formatAddressWithCompanyYard(delivery.originAddress || '당사 보관소', hqAddress);
    const outDest = formatAddressWithCompanyYard(delivery.destinationAddress || siteAddress, hqAddress);
    lines.push(`상차시간 : ${loadingTimeFormatted} 상차`);
    lines.push(`상차지: ${outOrigin}`);
    lines.push(`담당자: ${hqContact}`);
    lines.push(`장비종류 : ${cargoStr}`);
    lines.push(``);
    lines.push(`하차시간 : ${unloadingDateInfo.formatted} ${unloadingTimeFormatted} 하차`);
    lines.push(`현장명 : ${siteName}`);
    lines.push(`현장 상세 : ${outDest}`);
    lines.push(`업체명 : ${customerName}`);
    lines.push(`담당자 : ${siteContactFull}`);
  }

  // 9. 배차직원이 직접 입력한 특이사항만 전달 (출고/회수 장비 옵션은 화물차 기사에게 전달하지 않음)
  const dispatcherSpecialNote = sanitizeDispatcherSpecialNote(
    params.dispatcherNote !== undefined ? params.dispatcherNote : delivery.closingMemo
  );
  if (dispatcherSpecialNote) {
    lines.push(``);
    lines.push(`특이사항 : ${dispatcherSpecialNote}`);
  }

  // 기사용 모바일 포털 링크 추가
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://giyoon.ebro.run';
  lines.push('');
  lines.push('──────────────');
  lines.push('▶ 기사용 운송/납품 완료 ◀');
  lines.push('아래 링크를 눌러 납품증 사진을 찍으면 운송완료 처리됩니다.');
  lines.push(`${baseUrl}/driver-portal/${delivery.id}`);

  return lines.join('\n');

}


