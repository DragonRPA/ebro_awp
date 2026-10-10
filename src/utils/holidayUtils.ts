// src/utils/holidayUtils.ts
// 대한민국 법정공휴일(대체공휴일 포함), 근로자의 날, 주말 판정 및 연차/반차 소진일수 산출 표준 유틸리티

/**
 * 대한민국 법정 공휴일 (2024 ~ 2030)
 * 관공서의 공휴일에 관한 규정 및 근로자의 날 제정에 관한 법률(5월 1일 유급휴일) 기준
 */
const KOREAN_PUBLIC_HOLIDAYS: Record<string, string> = {
  // ── 2024년 ──
  '2024-01-01': '신정',
  '2024-02-09': '설날 연휴',
  '2024-02-10': '설날',
  '2024-02-11': '설날 연휴',
  '2024-02-12': '대체공휴일(설날)',
  '2024-03-01': '3·1절',
  '2024-04-10': '제22대 국회의원 선거일',
  '2024-05-01': '근로자의 날',
  '2024-05-05': '어린이날',
  '2024-05-06': '대체공휴일(어린이날)',
  '2024-05-15': '부처님오신날',
  '2024-06-06': '현충일',
  '2024-08-15': '광복절',
  '2024-09-16': '추석 연휴',
  '2024-09-17': '추석',
  '2024-09-18': '추석 연휴',
  '2024-10-01': '임시공휴일(국군의 날)',
  '2024-10-03': '개천절',
  '2024-10-09': '한글날',
  '2024-12-25': '성탄절',

  // ── 2025년 ──
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '3·1절',
  '2025-03-03': '대체공휴일(3·1절)',
  '2025-05-01': '근로자의 날',
  '2025-05-05': '어린이날',
  '2025-05-06': '대체공휴일(어린이날/부처님오신날)',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴',
  '2025-10-06': '추석',
  '2025-10-07': '추석 연휴',
  '2025-10-08': '대체공휴일(추석)',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절',

  // ── 2026년 ──
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '3·1절',
  '2026-03-02': '대체공휴일(3·1절)',
  '2026-05-01': '근로자의 날',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일(부처님오신날)',
  '2026-06-03': '제9회 전국동시지방선거일',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일(광복절)',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-05': '대체공휴일(개천절)',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',

  // ── 2027년 ──
  '2027-01-01': '신정',
  '2027-02-06': '설날 연휴',
  '2027-02-07': '설날',
  '2027-02-08': '설날 연휴',
  '2027-02-09': '대체공휴일(설날)',
  '2027-03-01': '3·1절',
  '2027-03-03': '제21대 대통령 선거일',
  '2027-05-01': '근로자의 날',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-08-15': '광복절',
  '2027-08-16': '대체공휴일(광복절)',
  '2027-09-14': '추석 연휴',
  '2027-09-15': '추석',
  '2027-09-16': '추석 연휴',
  '2027-10-03': '개천절',
  '2027-10-04': '대체공휴일(개천절)',
  '2027-10-09': '한글날',
  '2027-10-11': '대체공휴일(한글날)',
  '2027-12-25': '성탄절',

  // ── 2028년 ──
  '2028-01-01': '신정',
  '2028-01-26': '설날 연휴',
  '2028-01-27': '설날',
  '2028-01-28': '설날 연휴',
  '2028-03-01': '3·1절',
  '2028-04-12': '제23대 국회의원 선거일',
  '2028-05-01': '근로자의 날',
  '2028-05-02': '부처님오신날',
  '2028-05-05': '어린이날',
  '2028-06-06': '현충일',
  '2028-08-15': '광복절',
  '2028-10-02': '추석 연휴',
  '2028-10-03': '개천절 / 추석',
  '2028-10-04': '추석 연휴',
  '2028-10-05': '대체공휴일(추석)',
  '2028-10-09': '한글날',
  '2028-12-25': '성탄절',

  // ── 2029년 ──
  '2029-01-01': '신정',
  '2029-02-12': '설날 연휴',
  '2029-02-13': '설날',
  '2029-02-14': '설날 연휴',
  '2029-03-01': '3·1절',
  '2029-05-01': '근로자의 날',
  '2029-05-05': '어린이날',
  '2029-05-07': '대체공휴일(어린이날)',
  '2029-05-20': '부처님오신날',
  '2029-05-21': '대체공휴일(부처님오신날)',
  '2029-06-06': '현충일',
  '2029-08-15': '광복절',
  '2029-09-21': '추석 연휴',
  '2029-09-22': '추석',
  '2029-09-23': '추석 연휴',
  '2029-09-24': '대체공휴일(추석)',
  '2029-10-03': '개천절',
  '2029-10-09': '한글날',
  '2029-12-25': '성탄절',

  // ── 2030년 ──
  '2030-01-01': '신정',
  '2030-02-02': '설날 연휴',
  '2030-02-03': '설날',
  '2030-02-04': '설날 연휴',
  '2030-02-05': '대체공휴일(설날)',
  '2030-03-01': '3·1절',
  '2030-05-01': '근로자의 날',
  '2030-05-05': '어린이날',
  '2030-05-06': '대체공휴일(어린이날)',
  '2030-05-09': '부처님오신날',
  '2030-06-06': '현충일',
  '2030-08-15': '광복절',
  '2030-09-11': '추석 연휴',
  '2030-09-12': '추석',
  '2030-09-13': '추석 연휴',
  '2030-10-03': '개천절',
  '2030-10-09': '한글날',
  '2030-12-25': '성탄절'
};

const KOREAN_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * YYYY-MM-DD 형식의 문자열을 로컬 타임존(연, 월, 일) 안전 Date 객체로 변환
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 12, 0, 0); // 낮 12시로 설정하여 서머타임/시간대 왜곡 방지
}

/**
 * Date 객체를 YYYY-MM-DD 문자열로 변환
 */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 한국어 요일 반환 ('일', '월', '화', '수', '목', '금', '토')
 */
export function getKoreanDayOfWeek(date: Date | string): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  return KOREAN_DAY_NAMES[d.getDay()];
}

/**
 * 주말 여부 판정 (토요일: 6, 일요일: 0)
 */
export function isWeekend(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * 공휴일 명칭 조회 (법정 공휴일 또는 근로자의 날)
 */
export function getHolidayName(date: Date | string): string | null {
  const dateStr = typeof date === 'string' ? date : formatLocalDate(date);
  
  // 1. 등록된 공식 공휴일 매핑 확인
  if (KOREAN_PUBLIC_HOLIDAYS[dateStr]) {
    return KOREAN_PUBLIC_HOLIDAYS[dateStr];
  }

  // 2. 2030년 이후 등 미등록 연도를 위한 고정 양력 공휴일 폴백 알고리즘
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const mmdd = `${parts[1]}-${parts[2]}`;
    const fixedHolidays: Record<string, string> = {
      '01-01': '신정',
      '03-01': '3·1절',
      '05-01': '근로자의 날',
      '05-05': '어린이날',
      '06-06': '현충일',
      '08-15': '광복절',
      '10-03': '개천절',
      '10-09': '한글날',
      '12-25': '성탄절'
    };
    if (fixedHolidays[mmdd]) {
      return fixedHolidays[mmdd];
    }
  }

  return null;
}

/**
 * 개별 일자별 근무일/비근무일(주말, 공휴일) 판정 결과 인터페이스
 */
export interface DayDetail {
  dateStr: string;           // '2026-10-10'
  dayOfWeek: string;         // '토'
  isWeekend: boolean;        // 토, 일 여부
  holidayName: string | null;// 공휴일 명칭 (없으면 null)
  isWorkingDay: boolean;     // 실 근무일 여부 (주말도 아니고 공휴일도 아님)
  reason: string;            // '근무일', '주말(토)', '공휴일(개천절)' 등
}

/**
 * 연차/반차 신청 기간 계산 종합 결과 인터페이스
 */
export interface LeaveCalculationResult {
  leaveType: 'ANNUAL' | 'HALF_AM' | 'HALF_PM' | string;
  startDate: string;
  endDate: string;
  totalCalendarDays: number; // 시작일~종료일 단순 달력 일수
  workingDays: number;       // 주말 및 공휴일을 제외한 실제 소정근로일수
  weekendDays: number;       // 기간 내 포함된 주말 일수
  holidayDays: number;       // 기간 내 포함된 공휴일 일수 (주말과 겹치지 않는 평일 공휴일)
  excludedDays: number;      // 차감(제외)된 비근무일 합계 (주말 + 평일 공휴일)
  deductedDays: number;      // 실제 연차 잔여 한도에서 차감될 수치 (반차 0.5일, 연차는 workingDays)
  isValid: boolean;          // 신청 가능 여부
  errorMessage?: string;     // 신청 불가 사유 (예: 근무일 0일, 주말 반차 신청 등)
  summaryText: string;       // UI 표기용 요약 텍스트
  excludedBreakdownText: string; // 제외 사유 상세 텍스트
  days: DayDetail[];         // 일자별 세부 판정 목록
}

/**
 * 개별 일자의 상태 판정
 */
export function checkDayStatus(dateStr: string): DayDetail {
  const d = parseLocalDate(dateStr);
  const dayOfWeek = getKoreanDayOfWeek(d);
  const weekend = isWeekend(d);
  const holiday = getHolidayName(dateStr);
  const workingDay = !weekend && !holiday;

  let reason = '근무일';
  if (weekend && holiday) {
    reason = `주말(${dayOfWeek})·${holiday}`;
  } else if (weekend) {
    reason = `주말(${dayOfWeek})`;
  } else if (holiday) {
    reason = `공휴일(${holiday})`;
  }

  return {
    dateStr,
    dayOfWeek,
    isWeekend: weekend,
    holidayName: holiday,
    isWorkingDay: workingDay,
    reason
  };
}

/**
 * 연차 / 반차 신청 기간의 소진 일수 정밀 계산 함수
 * - 시작일과 종료일 사이의 모든 일자를 순회
 * - 주말(토/일) 및 법정공휴일/대체공휴일/근로자의 날은 사용기간(차감일수)에서 자동 제외(차감)
 * - 반차의 경우 해당 일자가 비근무일이면 신청 불가 방어
 */
export function calculateLeaveDaysInfo(
  leaveType: 'ANNUAL' | 'HALF_AM' | 'HALF_PM' | string,
  startDateStr: string,
  endDateStr: string
): LeaveCalculationResult {
  if (!startDateStr) {
    return {
      leaveType,
      startDate: '',
      endDate: '',
      totalCalendarDays: 0,
      workingDays: 0,
      weekendDays: 0,
      holidayDays: 0,
      excludedDays: 0,
      deductedDays: 0,
      isValid: false,
      errorMessage: '시작 일자를 선택해 주십시오.',
      summaryText: '-',
      excludedBreakdownText: '',
      days: []
    };
  }

  // 반차인 경우 종료일은 시작일과 동일하게 강제
  const effectiveEndDateStr = (leaveType === 'HALF_AM' || leaveType === 'HALF_PM') ? startDateStr : (endDateStr || startDateStr);

  const startDate = parseLocalDate(startDateStr);
  const endDate = parseLocalDate(effectiveEndDateStr);

  if (endDate < startDate) {
    return {
      leaveType,
      startDate: startDateStr,
      endDate: effectiveEndDateStr,
      totalCalendarDays: 0,
      workingDays: 0,
      weekendDays: 0,
      holidayDays: 0,
      excludedDays: 0,
      deductedDays: 0,
      isValid: false,
      errorMessage: '종료 일자는 시작 일자보다 빠를 수 없습니다.',
      summaryText: '날짜 오류',
      excludedBreakdownText: '',
      days: []
    };
  }

  // 일자 순회
  const days: DayDetail[] = [];
  const cur = new Date(startDate.getTime());
  while (cur <= endDate) {
    const curStr = formatLocalDate(cur);
    days.push(checkDayStatus(curStr));
    cur.setDate(cur.getDate() + 1);
  }

  const totalCalendarDays = days.length;
  let weekendDays = 0;
  let holidayDays = 0;
  let workingDays = 0;

  const excludedDescriptions: string[] = [];

  for (const day of days) {
    if (day.isWorkingDay) {
      workingDays++;
    } else {
      if (day.isWeekend) {
        weekendDays++;
        excludedDescriptions.push(`${day.dateStr.substring(5)}(${day.dayOfWeek}) 주말`);
      } else if (day.holidayName) {
        holidayDays++;
        excludedDescriptions.push(`${day.dateStr.substring(5)}(${day.dayOfWeek}) ${day.holidayName}`);
      }
    }
  }

  const excludedDays = weekendDays + holidayDays;

  // 1. 반차 처리
  if (leaveType === 'HALF_AM' || leaveType === 'HALF_PM') {
    const typeLabel = leaveType === 'HALF_AM' ? '오전 반차' : '오후 반차';
    const singleDay = days[0];

    if (!singleDay.isWorkingDay) {
      const offReason = singleDay.isWeekend ? '주말' : (singleDay.holidayName || '공휴일');
      return {
        leaveType,
        startDate: startDateStr,
        endDate: effectiveEndDateStr,
        totalCalendarDays: 1,
        workingDays: 0,
        weekendDays,
        holidayDays,
        excludedDays: 1,
        deductedDays: 0,
        isValid: false,
        errorMessage: `선택하신 일자는 ${offReason}이므로 반차를 신청할 수 없습니다.`,
        summaryText: `${typeLabel} 불가 (${offReason})`,
        excludedBreakdownText: `${singleDay.reason} 제외`,
        days
      };
    }

    return {
      leaveType,
      startDate: startDateStr,
      endDate: effectiveEndDateStr,
      totalCalendarDays: 1,
      workingDays: 1,
      weekendDays: 0,
      holidayDays: 0,
      excludedDays: 0,
      deductedDays: 0.5,
      isValid: true,
      summaryText: `${typeLabel} (0.5일 차감)`,
      excludedBreakdownText: '',
      days
    };
  }

  // 2. 일반 연차(ANNUAL) 처리
  if (workingDays === 0) {
    return {
      leaveType,
      startDate: startDateStr,
      endDate: effectiveEndDateStr,
      totalCalendarDays,
      workingDays: 0,
      weekendDays,
      holidayDays,
      excludedDays,
      deductedDays: 0,
      isValid: false,
      errorMessage: `선택하신 기간(${totalCalendarDays}일)에 소정근로일(평일)이 없습니다. 주말과 공휴일은 연차가 소진되지 않습니다.`,
      summaryText: `신청 불가 (비근무일 ${excludedDays}일)`,
      excludedBreakdownText: excludedDescriptions.join(', '),
      days
    };
  }

  const deductedDays = workingDays;

  // 요약 및 제외 사유 텍스트 포맷팅
  let summaryText = '';
  if (excludedDays === 0) {
    summaryText = `신청 일수: ${deductedDays}일 (실 차감: ${deductedDays}.0일)`;
  } else {
    const parts: string[] = [];
    if (weekendDays > 0) parts.push(`주말 ${weekendDays}일`);
    if (holidayDays > 0) parts.push(`공휴일 ${holidayDays}일`);
    summaryText = `신청 기간: 총 ${totalCalendarDays}일 (${parts.join(', ')} 제외 ➔ 실 차감: ${deductedDays}.0일)`;
  }

  const excludedBreakdownText = excludedDescriptions.length > 0 
    ? `제외 내역: ${excludedDescriptions.join(', ')}`
    : '';

  return {
    leaveType,
    startDate: startDateStr,
    endDate: effectiveEndDateStr,
    totalCalendarDays,
    workingDays,
    weekendDays,
    holidayDays,
    excludedDays,
    deductedDays,
    isValid: true,
    summaryText,
    excludedBreakdownText,
    days
  };
}
