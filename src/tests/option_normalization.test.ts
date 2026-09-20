import { cleanOptionItem, normalizeOptionList } from '../services/migrationEngine';

export function runOptionNormalizationTests() {
  const assertions: Array<{ name: string; pass: boolean; expected: string; actual: string }> = [];

  function assertEqual(name: string, actual: string, expected: string) {
    const pass = actual === expected;
    assertions.push({ name, pass, expected, actual });
    if (!pass) {
      console.error(`❌ [FAIL] ${name} -> expected "${expected}", but got "${actual}"`);
    }
  }

  // 1. 단일 수량 표기 제거
  assertEqual('협착난간대 * 6', cleanOptionItem('협착난간대 * 6'), '협착난간대');
  assertEqual('협착 난간대 2 EA', cleanOptionItem('협착 난간대 2 EA'), '협착난간대');
  assertEqual('협착 난간대 * 1대', cleanOptionItem('협착 난간대 * 1대'), '협착난간대');
  assertEqual('중간발판 (소) 3개', cleanOptionItem('중간발판 (소) 3개'), '중간발판 (소)');
  assertEqual('소화기 2EA', cleanOptionItem('소화기 2EA'), '소화기');
  assertEqual('경광등 x 2', cleanOptionItem('경광등 x 2'), '경광등');
  assertEqual('감지봉 4EA', cleanOptionItem('감지봉 4EA'), '감지봉');
  assertEqual('감지봉 4', cleanOptionItem('감지봉 4'), '감지봉');
  assertEqual('과상승방지봉(4)', cleanOptionItem('과상승방지봉(4)'), '과상승방지봉');
  assertEqual('불타방지막 2개', cleanOptionItem('불타방지막 2개'), '불타방지막');
  assertEqual('상단 감지봉 / 협착 센서 설치 (4EA)', cleanOptionItem('상단 감지봉 / 협착 센서 설치 (4EA)'), '상단 감지봉 / 협착 센서 설치');
  assertEqual('협착난간대 *６', cleanOptionItem('협착난간대 *６'), '협착난간대');
  assertEqual('튜브소화기 *６', cleanOptionItem('튜브소화기 *６'), '튜브소화기');
  assertEqual('확장대 고정 와이어 (1개설치)', cleanOptionItem('확장대 고정 와이어 (1개설치)'), '확장대 고정 와이어');
  assertEqual('와이어설치 (2개설치, U볼트 체결)', cleanOptionItem('와이어설치 (2개설치, U볼트 체결)'), '와이어설치 (U볼트 체결)');

  // 2. 고유 사양(면수, 길이, 모델명 호환 등) 보존
  assertEqual('3면 함석', cleanOptionItem('3면 함석'), '3면 함석');
  assertEqual('4면 철망', cleanOptionItem('4면 철망'), '4면 철망');
  assertEqual('충전선 20m', cleanOptionItem('충전선 20m'), '충전선 20m');
  assertEqual('중간발판 (소) 3개 (GS1330)', cleanOptionItem('중간발판 (소) 3개 (GS1330)'), '중간발판 (소) (GS1330)');
  assertEqual('중간발판 (소)(GS1930용)', cleanOptionItem('중간발판 (소)(GS1930용)'), '중간발판 (소)(GS1930용)');
  assertEqual('소화기 T50', cleanOptionItem('소화기 T50'), '소화기 T50');

  // 3. 복수 옵션 리스트 정규화 및 중복 제거
  const raw = '협착난간대 * 6, 3면 철망, 감지봉 4EA, 협착난간대 * 4, 협착난간대 * 7, 소화기함, 협착난간대 * 2, 협착 5EA, 협착 난간대 3대';
  assertEqual('중복 옵션 통합', normalizeOptionList(raw), '협착난간대, 3면 철망, 감지봉, 소화기함, 협착');

  // 4. 배열 및 JSON 형태 정제
  const rawArray = ['협착 난간대 2 ea', '감지봉 4', '3면 함석', '타이어 A급'];
  assertEqual('배열 옵션 정제', normalizeOptionList(rawArray), '협착난간대, 감지봉, 3면 함석, 타이어 A급');

  const allPassed = assertions.every(a => a.pass);
  console.log(`[OptionNormalizationTests] ${assertions.length}개 테스트 완료 - 결과: ${allPassed ? 'ALL PASS ✅' : 'FAIL ❌'}`);
  return { allPassed, assertions };
}

// 직접 실행 시
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('option_normalization.test')) {
  const res = runOptionNormalizationTests();
  if (!res.allPassed) process.exit(1);
}
