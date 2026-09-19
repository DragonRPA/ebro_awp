import { describe, it, expect } from 'vitest';
import { cleanOptionItem, normalizeOptionList } from '../services/migrationEngine';

describe('Option Normalization & Quantity Elimination Test', () => {
  it('단일 수량 표기(개, 대, EA, 세트 등)를 완벽히 제거해야 한다', () => {
    expect(cleanOptionItem('협착난간대 * 6')).toBe('협착난간대');
    expect(cleanOptionItem('협착 난간대 2 EA')).toBe('협착난간대');
    expect(cleanOptionItem('협착 난간대 * 1대')).toBe('협착난간대');
    expect(cleanOptionItem('중간발판 (소) 3개')).toBe('중간발판 (소)');
    expect(cleanOptionItem('소화기 2EA')).toBe('소화기');
    expect(cleanOptionItem('경광등 x 2')).toBe('경광등');
    expect(cleanOptionItem('감지봉 4EA')).toBe('감지봉');
    expect(cleanOptionItem('감지봉 4')).toBe('감지봉');
    expect(cleanOptionItem('과상승방지봉(4)')).toBe('과상승방지봉');
    expect(cleanOptionItem('불타방지막 2개')).toBe('불타방지막');
    expect(cleanOptionItem('상단 감지봉 / 협착 센서 설치 (4EA)')).toBe('상단 감지봉 / 협착 센서 설치');
  });

  it('면수 규격(3면, 4면) 및 길이(20m), 기종 호환(GS1930용) 등 고유 사양은 보존해야 한다', () => {
    expect(cleanOptionItem('3면 함석')).toBe('3면 함석');
    expect(cleanOptionItem('4면 철망')).toBe('4면 철망');
    expect(cleanOptionItem('충전선 20m')).toBe('충전선 20m');
    expect(cleanOptionItem('중간발판 (소)(GS1930용)')).toBe('중간발판 (소)(GS1930용)');
    expect(cleanOptionItem('소화기 T50')).toBe('소화기 T50');
  });

  it('복수 옵션 콤마 문자열에서 중복 수량 옵션을 순수 품목으로 통합 및 중복 제거해야 한다', () => {
    const raw = '협착난간대 * 6, 3면 철망, 감지봉 4EA, 협착난간대 * 4, 협착난간대 * 7, 소화기함, 협착난간대 * 2, 협착 5EA, 협착 난간대 3대';
    const normalized = normalizeOptionList(raw);
    expect(normalized).toBe('협착난간대, 3면 철망, 감지봉, 소화기함, 협착');
  });

  it('배열 및 JSON 형태의 옵션도 일관되게 정제해야 한다', () => {
    const rawArray = ['협착 난간대 2 ea', '감지봉 4', '3면 함석', '타이어 A급'];
    expect(normalizeOptionList(rawArray)).toBe('협착난간대, 감지봉, 3면 함석, 타이어 A급');

    const rawJson = '["협착 난간대 2 ea","감지봉 4","3면 함석","타이어 A급"]';
    expect(normalizeOptionList(rawJson)).toBe('협착난간대, 감지봉, 3면 함석, 타이어 A급');
  });
});
