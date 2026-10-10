// src/utils/koreaRegions.ts
/**
 * 대한민국 전국 17개 광역시·도 및 기초자치단체(시·군·구) 행정표준코드 (5자리 시군구코드)
 * 국토교통부 세움터(건축행정시스템) 및 공공데이터포털 공식 기술문서(첨부 2) 기반
 */

export interface SigunguItem {
  name: string;
  code: string; // 5자리 시군구코드
  defaultBjdongCd?: string; // 기본 법정동코드(5자리)
}

// 대한민국 17개 광역시·도 전체 목록
export const KOREA_SIDO_LIST = [
  '전체',
  '경기도',
  '서울특별시',
  '인천광역시',
  '충청남도',
  '충청북도',
  '대전광역시',
  '세종특별자치시',
  '강원특별자치도',
  '대구광역시',
  '경상북도',
  '부산광역시',
  '울산광역시',
  '경상남도',
  '광주광역시',
  '전북특별자치도',
  '전라남도',
  '제주특별자치도'
] as const;

// 전국 17개 시도별 시·군·구 및 5자리 행정표준코드 맵
export const KOREA_SIGUNGU_MAP: Record<string, SigunguItem[]> = {
  '경기도': [
    { name: '화성시', code: '41590', defaultBjdongCd: '25921' },
    { name: '평택시', code: '41220', defaultBjdongCd: '12000' },
    { name: '용인시 처인구', code: '41461', defaultBjdongCd: '25300' },
    { name: '용인시 기흥구', code: '41463', defaultBjdongCd: '10700' },
    { name: '용인시 수지구', code: '41465', defaultBjdongCd: '10100' },
    { name: '이천시', code: '41500', defaultBjdongCd: '25300' },
    { name: '안성시', code: '41550', defaultBjdongCd: '35000' },
    { name: '김포시', code: '41570', defaultBjdongCd: '25900' },
    { name: '시흥시', code: '41390', defaultBjdongCd: '10100' },
    { name: '파주시', code: '41480', defaultBjdongCd: '25000' },
    { name: '수원시', code: '41110', defaultBjdongCd: '10100' },
    { name: '성남시', code: '41130', defaultBjdongCd: '10100' },
    { name: '안양시', code: '41170', defaultBjdongCd: '10100' },
    { name: '부천시', code: '41190', defaultBjdongCd: '10100' },
    { name: '안산시', code: '41270', defaultBjdongCd: '10100' },
    { name: '고양시', code: '41280', defaultBjdongCd: '10100' },
    { name: '남양주시', code: '41360', defaultBjdongCd: '10100' },
    { name: '광주시', code: '41610', defaultBjdongCd: '10100' },
    { name: '하남시', code: '41450', defaultBjdongCd: '10100' },
    { name: '오산시', code: '41370', defaultBjdongCd: '10100' },
    { name: '군포시', code: '41410', defaultBjdongCd: '10100' },
    { name: '양주시', code: '41630', defaultBjdongCd: '10100' },
    { name: '포천시', code: '41650', defaultBjdongCd: '10100' },
    { name: '여주시', code: '41670', defaultBjdongCd: '10100' }
  ],
  '서울특별시': [
    { name: '강남구', code: '11680', defaultBjdongCd: '10300' },
    { name: '서초구', code: '11650', defaultBjdongCd: '10800' },
    { name: '송파구', code: '11710', defaultBjdongCd: '10100' },
    { name: '강서구', code: '11500', defaultBjdongCd: '10100' },
    { name: '영등포구', code: '11560', defaultBjdongCd: '10100' },
    { name: '구로구', code: '11530', defaultBjdongCd: '10100' },
    { name: '금천구', code: '11545', defaultBjdongCd: '10100' },
    { name: '마포구', code: '11440', defaultBjdongCd: '10100' },
    { name: '용산구', code: '11170', defaultBjdongCd: '10100' },
    { name: '성동구', code: '11200', defaultBjdongCd: '11500' },
    { name: '중구', code: '11140', defaultBjdongCd: '10100' },
    { name: '종로구', code: '11110', defaultBjdongCd: '10100' },
    { name: '동대문구', code: '11230', defaultBjdongCd: '10100' },
    { name: '노원구', code: '11350', defaultBjdongCd: '10100' },
    { name: '강동구', code: '11740', defaultBjdongCd: '10100' }
  ],
  '인천광역시': [
    { name: '서구', code: '28260', defaultBjdongCd: '12000' },
    { name: '중구', code: '28110', defaultBjdongCd: '10100' },
    { name: '남동구', code: '28200', defaultBjdongCd: '10100' },
    { name: '연수구', code: '28185', defaultBjdongCd: '10100' },
    { name: '부평구', code: '28237', defaultBjdongCd: '10100' },
    { name: '계양구', code: '28245', defaultBjdongCd: '10100' },
    { name: '미추홀구', code: '28177', defaultBjdongCd: '10100' },
    { name: '강화군', code: '28710', defaultBjdongCd: '25000' }
  ],
  '충청남도': [
    { name: '천안시 서북구', code: '44133', defaultBjdongCd: '25600' },
    { name: '천안시 동남구', code: '44131', defaultBjdongCd: '10100' },
    { name: '아산시', code: '44200', defaultBjdongCd: '10100' },
    { name: '당진시', code: '44270', defaultBjdongCd: '10100' },
    { name: '서산시', code: '44210', defaultBjdongCd: '10100' },
    { name: '공주시', code: '44150', defaultBjdongCd: '10100' },
    { name: '보령시', code: '44180', defaultBjdongCd: '10100' },
    { name: '논산시', code: '44230', defaultBjdongCd: '10100' },
    { name: '홍성군', code: '44800', defaultBjdongCd: '25000' },
    { name: '예산군', code: '44810', defaultBjdongCd: '25000' }
  ],
  '충청북도': [
    { name: '청주시 흥덕구', code: '43113', defaultBjdongCd: '10100' },
    { name: '청주시 청원구', code: '43114', defaultBjdongCd: '10100' },
    { name: '청주시 상당구', code: '43111', defaultBjdongCd: '10100' },
    { name: '청주시 서원구', code: '43112', defaultBjdongCd: '10100' },
    { name: '충주시', code: '43130', defaultBjdongCd: '10100' },
    { name: '제천시', code: '43150', defaultBjdongCd: '10100' },
    { name: '진천군', code: '43750', defaultBjdongCd: '25000' },
    { name: '음성군', code: '43770', defaultBjdongCd: '25000' }
  ],
  '대전광역시': [
    { name: '유성구', code: '30200', defaultBjdongCd: '10100' },
    { name: '서구', code: '30170', defaultBjdongCd: '10100' },
    { name: '대덕구', code: '30230', defaultBjdongCd: '10100' },
    { name: '중구', code: '30140', defaultBjdongCd: '10100' },
    { name: '동구', code: '30110', defaultBjdongCd: '10100' }
  ],
  '세종특별자치시': [
    { name: '세종시', code: '36110', defaultBjdongCd: '10100' }
  ],
  '강원특별자치도': [
    { name: '원주시', code: '51130', defaultBjdongCd: '10100' },
    { name: '춘천시', code: '51110', defaultBjdongCd: '10100' },
    { name: '강릉시', code: '51150', defaultBjdongCd: '10100' },
    { name: '동해시', code: '51170', defaultBjdongCd: '10100' },
    { name: '속초시', code: '51210', defaultBjdongCd: '10100' },
    { name: '홍천군', code: '51720', defaultBjdongCd: '25000' }
  ],
  '대구광역시': [
    { name: '달서구', code: '27290', defaultBjdongCd: '10100' },
    { name: '북구', code: '27230', defaultBjdongCd: '10100' },
    { name: '수성구', code: '27260', defaultBjdongCd: '10100' },
    { name: '동구', code: '27140', defaultBjdongCd: '10100' },
    { name: '서구', code: '27170', defaultBjdongCd: '10100' },
    { name: '달성군', code: '27710', defaultBjdongCd: '25000' }
  ],
  '경상북도': [
    { name: '구미시', code: '47190', defaultBjdongCd: '10100' },
    { name: '포항시 남구', code: '47111', defaultBjdongCd: '10100' },
    { name: '포항시 북구', code: '47113', defaultBjdongCd: '10100' },
    { name: '경주시', code: '47130', defaultBjdongCd: '10100' },
    { name: '김천시', code: '47150', defaultBjdongCd: '10100' },
    { name: '경산시', code: '47290', defaultBjdongCd: '10100' },
    { name: '안동시', code: '47170', defaultBjdongCd: '10100' },
    { name: '칠곡군', code: '47850', defaultBjdongCd: '25000' }
  ],
  '부산광역시': [
    { name: '강서구', code: '26440', defaultBjdongCd: '10100' },
    { name: '사상구', code: '26530', defaultBjdongCd: '10100' },
    { name: '사하구', code: '26380', defaultBjdongCd: '10100' },
    { name: '해운대구', code: '26350', defaultBjdongCd: '10100' },
    { name: '부산진구', code: '26230', defaultBjdongCd: '10100' },
    { name: '기장군', code: '26710', defaultBjdongCd: '25000' },
    { name: '금정구', code: '26410', defaultBjdongCd: '10100' }
  ],
  '울산광역시': [
    { name: '울주군', code: '31710', defaultBjdongCd: '25000' },
    { name: '북구', code: '31200', defaultBjdongCd: '10100' },
    { name: '남구', code: '31140', defaultBjdongCd: '10100' },
    { name: '중구', code: '31110', defaultBjdongCd: '10100' },
    { name: '동구', code: '31170', defaultBjdongCd: '10100' }
  ],
  '경상남도': [
    { name: '김해시', code: '48250', defaultBjdongCd: '10100' },
    { name: '창원시 의창구', code: '48121', defaultBjdongCd: '10100' },
    { name: '창원시 성산구', code: '48123', defaultBjdongCd: '10100' },
    { name: '창원시 마산회원구', code: '48127', defaultBjdongCd: '10100' },
    { name: '양산시', code: '48330', defaultBjdongCd: '10100' },
    { name: '진주시', code: '48170', defaultBjdongCd: '10100' },
    { name: '거제시', code: '48310', defaultBjdongCd: '10100' },
    { name: '함안군', code: '48730', defaultBjdongCd: '25000' }
  ],
  '광주광역시': [
    { name: '광산구', code: '29200', defaultBjdongCd: '10100' },
    { name: '북구', code: '29170', defaultBjdongCd: '10100' },
    { name: '서구', code: '29140', defaultBjdongCd: '10100' },
    { name: '남구', code: '29150', defaultBjdongCd: '10100' },
    { name: '동구', code: '29110', defaultBjdongCd: '10100' }
  ],
  '전북특별자치도': [
    { name: '전주시 완산구', code: '52111', defaultBjdongCd: '10100' },
    { name: '전주시 덕진구', code: '52113', defaultBjdongCd: '10100' },
    { name: '군산시', code: '52130', defaultBjdongCd: '10100' },
    { name: '익산시', code: '52140', defaultBjdongCd: '10100' },
    { name: '완주군', code: '52710', defaultBjdongCd: '25000' }
  ],
  '전라남도': [
    { name: '광양시', code: '46230', defaultBjdongCd: '10100' },
    { name: '여수시', code: '46130', defaultBjdongCd: '10100' },
    { name: '순천시', code: '46150', defaultBjdongCd: '10100' },
    { name: '나주시', code: '46170', defaultBjdongCd: '10100' },
    { name: '목포시', code: '46110', defaultBjdongCd: '10100' },
    { name: '영암군', code: '46830', defaultBjdongCd: '25000' }
  ],
  '제주특별자치도': [
    { name: '제주시', code: '50110', defaultBjdongCd: '10100' },
    { name: '서귀포시', code: '50130', defaultBjdongCd: '10100' }
  ]
};

/**
 * 시·도와 시·군·구 명칭으로 5자리 공식 시군구코드 및 법정동코드 조회
 */
export function getRegionCodeInfo(sido: string, sigungu: string): { 
  sigunguCd: string; 
  bjdongCd: string; 
  sido: string; 
  sigungu: string; 
  bjdongName: string; 
} {
  const effectiveSido = (sido && sido !== '전체') ? sido : '경기도';
  const list = KOREA_SIGUNGU_MAP[effectiveSido] || KOREA_SIGUNGU_MAP['경기도'];
  if (list && list.length > 0) {
    const item = list.find(s => s.name === sigungu || sigungu.includes(s.name) || s.name.includes(sigungu)) || list[0];
    return {
      sigunguCd: item.code,
      bjdongCd: item.defaultBjdongCd || '10100',
      sido: effectiveSido,
      sigungu: item.name,
      bjdongName: '중심가'
    };
  }
  // 기본값 (경기 화성시)
  return { sigunguCd: '41590', bjdongCd: '25921', sido: '경기도', sigungu: '화성시', bjdongName: '남양읍' };
}

