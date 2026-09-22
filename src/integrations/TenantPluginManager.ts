import { TenantPlugin } from './types';
import { giyeunPlugin } from './giyeun';

// 향후 다른 테넌트 플러그인들도 이곳에 임포트
// import { bRentalPlugin } from './b_rental';

const plugins: Record<string, TenantPlugin> = {
  'GIYEUN': giyeunPlugin,
  // 'B_RENTAL': bRentalPlugin,
};

export const getTenantPlugin = (tenantCode: string): TenantPlugin => {
  const plugin = plugins[tenantCode];
  
  if (plugin) {
    return plugin;
  }
  
  // 만약 일치하는 플러그인이 없으면 기본적으로 첫 번째(혹은 GIYEUN) 플러그인을 폴백으로 사용
  // SaaS 확장을 위해선 default 플러그인을 별도 구현하는 것이 좋음
  console.warn(`[TenantPluginManager] 플러그인을 찾을 수 없습니다: ${tenantCode}. 기본 플러그인(GIYEUN)으로 폴백합니다.`);
  return giyeunPlugin; 
};
