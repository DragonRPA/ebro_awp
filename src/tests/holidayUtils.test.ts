import { calculateLeaveDaysInfo, checkDayStatus, isWeekend, getHolidayName } from '../utils/holidayUtils';

function testHolidayUtils() {
  console.log('--- Testing holidayUtils ---');

  // Test 1: Weekend Bridge (Fri ~ Mon)
  const res1 = calculateLeaveDaysInfo('ANNUAL', '2026-10-16', '2026-10-19');
  console.log('Test 1 (Fri~Mon):', {
    totalCalendarDays: res1.totalCalendarDays,
    workingDays: res1.workingDays,
    weekendDays: res1.weekendDays,
    holidayDays: res1.holidayDays,
    deductedDays: res1.deductedDays,
    summaryText: res1.summaryText,
    isValid: res1.isValid
  });
  if (res1.totalCalendarDays !== 4 || res1.workingDays !== 2 || res1.deductedDays !== 2) {
    throw new Error('Test 1 failed!');
  }

  // Test 2: Holiday & Substitute Holiday Bridge (2026-10-02 to 2026-10-06)
  // 10/2: Fri, 10/3: Sat(개천절), 10/4: Sun, 10/5: Mon(대체공휴일), 10/6: Tue
  const res2 = calculateLeaveDaysInfo('ANNUAL', '2026-10-02', '2026-10-06');
  console.log('Test 2 (10/02~10/06):', {
    totalCalendarDays: res2.totalCalendarDays,
    workingDays: res2.workingDays,
    weekendDays: res2.weekendDays,
    holidayDays: res2.holidayDays,
    deductedDays: res2.deductedDays,
    summaryText: res2.summaryText,
    breakdownText: res2.excludedBreakdownText,
    isValid: res2.isValid
  });
  if (res2.totalCalendarDays !== 5 || res2.workingDays !== 2 || res2.deductedDays !== 2) {
    throw new Error('Test 2 failed!');
  }

  // Test 3: Only Weekend (Sat ~ Sun)
  const res3 = calculateLeaveDaysInfo('ANNUAL', '2026-10-17', '2026-10-18');
  console.log('Test 3 (Sat~Sun):', {
    totalCalendarDays: res3.totalCalendarDays,
    workingDays: res3.workingDays,
    deductedDays: res3.deductedDays,
    isValid: res3.isValid,
    errorMessage: res3.errorMessage
  });
  if (res3.isValid !== false || res3.workingDays !== 0) {
    throw new Error('Test 3 failed!');
  }

  // Test 4: Half Day on Weekday vs Weekend/Holiday
  const res4_workday = calculateLeaveDaysInfo('HALF_AM', '2026-10-16', '2026-10-16');
  console.log('Test 4 (Half AM on Friday):', {
    deductedDays: res4_workday.deductedDays,
    isValid: res4_workday.isValid
  });
  if (res4_workday.deductedDays !== 0.5 || !res4_workday.isValid) {
    throw new Error('Test 4 failed (workday)!');
  }

  const res4_weekend = calculateLeaveDaysInfo('HALF_PM', '2026-10-17', '2026-10-17');
  console.log('Test 4 (Half PM on Saturday):', {
    isValid: res4_weekend.isValid,
    errorMessage: res4_weekend.errorMessage
  });
  if (res4_weekend.isValid !== false) {
    throw new Error('Test 4 failed (weekend)!');
  }

  const res4_holiday = calculateLeaveDaysInfo('HALF_AM', '2026-10-05', '2026-10-05');
  console.log('Test 4 (Half AM on Substitute Holiday):', {
    isValid: res4_holiday.isValid,
    errorMessage: res4_holiday.errorMessage
  });
  if (res4_holiday.isValid !== false) {
    throw new Error('Test 4 failed (holiday)!');
  }

  console.log('ALL HOLIDAY UTILS TESTS PASSED!');
}

testHolidayUtils();
