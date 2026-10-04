import { TenantPlugin } from './types';
import { giyeonliftPlugin } from './giyeonlift';

// 향후 다른 테넌트 플러그인들도 이곳에 임포트
// import { bRentalPlugin } from './b_rental';

const plugins: Record<string, TenantPlugin> = {
  'GIYEONLIFT': giyeonliftPlugin,
  'GIYEON': giyeonliftPlugin,
  'GIYEUN': giyeonliftPlugin,
  'GIYUEN': giyeonliftPlugin,
  'KIYUEN': giyeonliftPlugin,
  // 'B_RENTAL': bRentalPlugin,
};

export const getTenantPlugin = (tenantCode: string): TenantPlugin => {
  const normalized = (tenantCode || '').toUpperCase().trim();
  const plugin = plugins[normalized];
  
  if (plugin) {
    return plugin;
  }
  
  // 일치하는 플러그인이 없으면 기본적으로 기연리프트(GIYEONLIFT) 플러그인을 폴백으로 사용
  console.warn(`[TenantPluginManager] 플러그인을 찾을 수 없습니다: ${tenantCode}. 기본 플러그인(GIYEONLIFT)으로 폴백합니다.`);
  return giyeonliftPlugin; 
};
