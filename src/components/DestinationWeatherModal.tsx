// d:\Kiyeun_Lift\src\components\DestinationWeatherModal.tsx
import React, { useState, useEffect } from 'react';
import { Sun, Cloud, CloudSun, CloudRain, Snowflake, CloudLightning, CloudFog, MapPin, X, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

// === 한국 광역시/도 및 시/군/구 기상 좌표 데이터베이스 ===
export interface DestinationRegion {
  id: string;
  sido: string;
  sigungu: string;
  name: string;
  lat: number;
  lon: number;
  keywords: string[];
}

export const KOREA_DESTINATION_REGIONS: DestinationRegion[] = [
  // 서울
  { id: 'seoul', sido: '서울특별시', sigungu: '전체', name: '서울특별시', lat: 37.5665, lon: 126.9780, keywords: ['서울', '서울특별시'] },
  
  // 경기
  { id: 'suwon', sido: '경기도', sigungu: '수원시', name: '경기도 수원시', lat: 37.2636, lon: 127.0286, keywords: ['수원', '수원시', '권선', '영통', '장안', '팔달'] },
  { id: 'yongin', sido: '경기도', sigungu: '용인시', name: '경기도 용인시', lat: 37.2411, lon: 127.1776, keywords: ['용인', '용인시', '처인', '모현', '기흥', '수지', '남사', '포곡', '백암', '양지'] },
  { id: 'hwaseong', sido: '경기도', sigungu: '화성시', name: '경기도 화성시', lat: 37.1995, lon: 126.8313, keywords: ['화성', '화성시', '향남', '동탄', '남양', '봉담', '우정', '팔탄', '마도', '송산'] },
  { id: 'pyeongtaek', sido: '경기도', sigungu: '평택시', name: '경기도 평택시', lat: 36.9921, lon: 127.0858, keywords: ['평택', '평택시', '포승', '안중', '고덕', '팽성', '청북', '진위'] },
  { id: 'paju', sido: '경기도', sigungu: '파주시', name: '경기도 파주시', lat: 37.7595, lon: 126.7803, keywords: ['파주', '파주시', '문산', '운정', '조리', '법원', '탄현'] },
  { id: 'gimpo', sido: '경기도', sigungu: '김포시', name: '경기도 김포시', lat: 37.6153, lon: 126.7156, keywords: ['김포', '김포시', '통진', '고촌', '양촌', '대곶'] },
  { id: 'icheon', sido: '경기도', sigungu: '이천시', name: '경기도 이천시', lat: 37.2723, lon: 127.4348, keywords: ['이천', '이천시', '부발', '장호원', '대월', '마장', '모가'] },
  { id: 'anseong', sido: '경기도', sigungu: '안성시', name: '경기도 안성시', lat: 37.0080, lon: 127.2797, keywords: ['안성', '안성시', '공도', '보개', '대덕', '원곡', '죽산'] },
  { id: 'siheung', sido: '경기도', sigungu: '시흥시', name: '경기도 시흥시', lat: 37.3802, lon: 126.8029, keywords: ['시흥', '시흥시', '정왕', '배곧', '목감', '은계'] },
  { id: 'namyangju', sido: '경기도', sigungu: '남양주시', name: '경기도 남양주시', lat: 37.6360, lon: 127.2165, keywords: ['남양주', '남양주시', '진접', '화도', '와부', '별내'] },
  { id: 'gwangju_gyeonggi', sido: '경기도', sigungu: '광주시', name: '경기도 광주시', lat: 37.4089, lon: 127.2560, keywords: ['경기 광주', '광주시', '오포', '초월', '곤지암'] },
  { id: 'goyang', sido: '경기도', sigungu: '고양시', name: '경기도 고양시', lat: 37.6584, lon: 126.8320, keywords: ['고양', '고양시', '일산', '덕양'] },
  { id: 'seongnam', sido: '경기도', sigungu: '성남시', name: '경기도 성남시', lat: 37.4200, lon: 127.1265, keywords: ['성남', '성남시', '분당', '수정', '중원'] },
  { id: 'bucheon', sido: '경기도', sigungu: '부천시', name: '경기도 부천시', lat: 37.5034, lon: 126.7660, keywords: ['부천', '부천시'] },
  { id: 'anyang', sido: '경기도', sigungu: '안양시', name: '경기도 안양시', lat: 37.3943, lon: 126.9568, keywords: ['안양', '안양시', '만안', '동안'] },

  // 인천
  { id: 'incheon', sido: '인천광역시', sigungu: '전체', name: '인천광역시', lat: 37.4563, lon: 126.7052, keywords: ['인천', '인천광역시', '송도', '청라', '영종', '검단', '남동', '부평'] },

  // 충북
  { id: 'cheongju', sido: '충청북도', sigungu: '청주시', name: '충청북도 청주시', lat: 36.6424, lon: 127.4890, keywords: ['청주', '청주시', '흥덕', '청원', '상당', '서원', '오창', '오송'] },
  { id: 'chungju', sido: '충청북도', sigungu: '충주시', name: '충청북도 충주시', lat: 36.9910, lon: 127.9260, keywords: ['충주', '충주시', '주덕', '대소원'] },
  { id: 'jecheon', sido: '충청북도', sigungu: '제천시', name: '충청북도 제천시', lat: 37.1326, lon: 128.1909, keywords: ['제천', '제천시', '봉양'] },
  { id: 'eumseong', sido: '충청북도', sigungu: '음성군', name: '충청북도 음성군', lat: 36.9367, lon: 127.6908, keywords: ['음성', '음성군', '금왕', '대소', '맹동'] },
  { id: 'jincheon', sido: '충청북도', sigungu: '진천군', name: '충청북도 진천군', lat: 36.8553, lon: 127.4357, keywords: ['진천', '진천군', '덕산', '광혜원'] },

  // 충남
  { id: 'cheonan', sido: '충청남도', sigungu: '천안시', name: '충청남도 천안시', lat: 36.8151, lon: 127.1139, keywords: ['천안', '천안시', '동남', '서북', '직산', '성환', '목천'] },
  { id: 'asan', sido: '충청남도', sigungu: '아산시', name: '충청남도 아산시', lat: 36.7898, lon: 127.0018, keywords: ['아산', '아산시', '둔포', '음봉', '인주', '탕정', '배방'] },
  { id: 'dangjin', sido: '충청남도', sigungu: '당진시', name: '충청남도 당진시', lat: 36.8897, lon: 126.6459, keywords: ['당진', '당진시', '합덕', '송악', '석문'] },
  { id: 'seosan', sido: '충청남도', sigungu: '서산시', name: '충청남도 서산시', lat: 36.7845, lon: 126.4503, keywords: ['서산', '서산시', '대산', '지곡', '성연'] },

  // 대전 / 세종
  { id: 'daejeon', sido: '대전광역시', sigungu: '전체', name: '대전광역시', lat: 36.3504, lon: 127.3845, keywords: ['대전', '대전광역시', '유성', '대덕', '둔산'] },
  { id: 'sejong', sido: '세종특별자치시', sigungu: '전체', name: '세종특별자치시', lat: 36.4800, lon: 127.2890, keywords: ['세종', '세종시', '조치원'] },

  // 경북 / 대구
  { id: 'daegu', sido: '대구광역시', sigungu: '전체', name: '대구광역시', lat: 35.8714, lon: 128.6014, keywords: ['대구', '대구광역시', '달서', '달성', '수성', '칠곡'] },
  { id: 'pohang', sido: '경상북도', sigungu: '포항시', name: '경상북도 포항시', lat: 36.0190, lon: 129.3435, keywords: ['포항', '포항시', '남구', '북구', '지곡', '흥해', '오천'] },
  { id: 'gumi', sido: '경상북도', sigungu: '구미시', name: '경상북도 구미시', lat: 36.1195, lon: 128.3446, keywords: ['구미', '구미시', '산동', '옥계', '인동'] },
  { id: 'gyeongju', sido: '경상북도', sigungu: '경주시', name: '경상북도 경주시', lat: 35.8562, lon: 129.2247, keywords: ['경주', '경주시', '안강', '외동'] },

  // 경남 / 부산 / 울산
  { id: 'busan', sido: '부산광역시', sigungu: '전체', name: '부산광역시', lat: 35.1796, lon: 129.0756, keywords: ['부산', '부산광역시', '강서', '사상', '기장', '해운대'] },
  { id: 'ulsan', sido: '울산광역시', sigungu: '전체', name: '울산광역시', lat: 35.5384, lon: 129.3114, keywords: ['울산', '울산광역시', '울주', '온산'] },
  { id: 'changwon', sido: '경상남도', sigungu: '창원시', name: '경상남도 창원시', lat: 35.2280, lon: 128.6811, keywords: ['창원', '창원시', '마산', '진해', '성산', '의창'] },
  { id: 'gimhae', sido: '경상남도', sigungu: '김해시', name: '경상남도 김해시', lat: 35.2343, lon: 128.8810, keywords: ['김해', '김해시', '진영', '장유', '한림'] },

  // 전라 / 광주
  { id: 'gwangju', sido: '광주광역시', sigungu: '전체', name: '광주광역시', lat: 35.1595, lon: 126.8526, keywords: ['광주', '광주광역시', '광산', '첨단'] },
  { id: 'jeonju', sido: '전북특별자치도', sigungu: '전주시', name: '전북특별자치도 전주시', lat: 35.8242, lon: 127.1480, keywords: ['전주', '전주시', '덕진', '완산'] },
  { id: 'gunsan', sido: '전북특별자치도', sigungu: '군산시', name: '전북특별자치도 군산시', lat: 35.9676, lon: 126.7366, keywords: ['군산', '군산시', '소룡', '산북'] },
  { id: 'yeosu', sido: '전라남도', sigungu: '여수시', name: '전라남도 여수시', lat: 34.7604, lon: 127.6622, keywords: ['여수', '여수시', '율촌', '묘도'] },
  { id: 'suncheon', sido: '전라남도', sigungu: '순천시', name: '전라남도 순천시', lat: 34.9506, lon: 127.4872, keywords: ['순천', '순천시', '해룡'] },

  // 강원
  { id: 'chuncheon', sido: '강원특별자치도', sigungu: '춘천시', name: '강원특별자치도 춘천시', lat: 37.8813, lon: 127.7298, keywords: ['춘천', '춘천시'] },
  { id: 'wonju', sido: '강원특별자치도', sigungu: '원주시', name: '강원특별자치도 원주시', lat: 37.3422, lon: 127.9202, keywords: ['원주', '원주시', '문막'] },
  { id: 'gangneung', sido: '강원특별자치도', sigungu: '강릉시', name: '강원특별자치도 강릉시', lat: 37.7519, lon: 128.8761, keywords: ['강릉', '강릉시', '주문진'] },

  // 제주
  { id: 'jeju', sido: '제주특별자치도', sigungu: '전체', name: '제주특별자치도', lat: 33.4996, lon: 126.5312, keywords: ['제주', '제주도', '제주시', '서귀포'] }
];

// 시/도 목록 추출
export const SIDO_LIST = Array.from(new Set(KOREA_DESTINATION_REGIONS.map(r => r.sido)));

/**
 * 1단계 지능형 주소 파서 Engine
 * 입력된 주소문자열을 정규화 및 패턴 매칭하여 가장 정밀한 기상 지역 반환
 */
export function parseAddressToRegion(rawAddress: string): { region: DestinationRegion; isMatched: boolean; matchedKeyword: string } {
  if (!rawAddress || typeof rawAddress !== 'string') {
    return { region: KOREA_DESTINATION_REGIONS[1], isMatched: false, matchedKeyword: '' }; // 기본 용인시
  }

  const clean = rawAddress.trim();

  // 1. 키워드 일치 점수 산출
  let bestMatch: DestinationRegion | null = null;
  let maxScore = 0;
  let matchedKeyword = '';

  for (const reg of KOREA_DESTINATION_REGIONS) {
    for (const kw of reg.keywords) {
      if (clean.includes(kw)) {
        const score = kw.length; // 더 긴 키워드 일치 시 높은 우선순위 (예: "용인시 처인구" > "용인")
        if (score > maxScore) {
          maxScore = score;
          bestMatch = reg;
          matchedKeyword = kw;
        }
      }
    }
  }

  if (bestMatch) {
    return { region: bestMatch, isMatched: true, matchedKeyword };
  }

  // 2. 광역시/도 단위 Fallback
  if (clean.includes('서울')) return { region: KOREA_DESTINATION_REGIONS[0], isMatched: true, matchedKeyword: '서울' };
  if (clean.includes('인천')) return { region: KOREA_DESTINATION_REGIONS.find(r => r.id === 'incheon')!, isMatched: true, matchedKeyword: '인천' };
  if (clean.includes('경기')) return { region: KOREA_DESTINATION_REGIONS.find(r => r.id === 'suwon')!, isMatched: true, matchedKeyword: '경기' };
  if (clean.includes('충북')) return { region: KOREA_DESTINATION_REGIONS.find(r => r.id === 'cheongju')!, isMatched: true, matchedKeyword: '충북' };
  if (clean.includes('충남')) return { region: KOREA_DESTINATION_REGIONS.find(r => r.id === 'cheonan')!, isMatched: true, matchedKeyword: '충남' };
  if (clean.includes('경북')) return { region: KOREA_DESTINATION_REGIONS.find(r => r.id === 'pohang')!, isMatched: true, matchedKeyword: '경북' };
  if (clean.includes('경남')) return { region: KOREA_DESTINATION_REGIONS.find(r => r.id === 'changwon')!, isMatched: true, matchedKeyword: '경남' };
  if (clean.includes('전북')) return { region: KOREA_DESTINATION_REGIONS.find(r => r.id === 'jeonju')!, isMatched: true, matchedKeyword: '전북' };
  if (clean.includes('전남')) return { region: KOREA_DESTINATION_REGIONS.find(r => r.id === 'yeosu')!, isMatched: true, matchedKeyword: '전남' };
  if (clean.includes('강원')) return { region: KOREA_DESTINATION_REGIONS.find(r => r.id === 'chuncheon')!, isMatched: true, matchedKeyword: '강원' };
  if (clean.includes('제주')) return { region: KOREA_DESTINATION_REGIONS.find(r => r.id === 'jeju')!, isMatched: true, matchedKeyword: '제주' };

  // 3. 매칭 실패 시 기본값 (수원/경기)
  return { region: KOREA_DESTINATION_REGIONS[1], isMatched: false, matchedKeyword: '' };
}

export function getWeatherInfo(code: number) {
  if (code === 0) {
    return { text: '맑음', emoji: '☀️', color: '#F59E0B', icon: <Sun size={18} color="#F59E0B" /> };
  } else if (code >= 1 && code <= 3) {
    return { text: code === 1 ? '대체로 맑음' : code === 2 ? '구름 조금' : '흐림', emoji: '⛅', color: 'var(--text-muted)', icon: <CloudSun size={18} color="#64748B" /> };
  } else if (code === 45 || code === 48) {
    return { text: '안개', emoji: '🌫️', color: 'var(--text-muted)', icon: <CloudFog size={18} color="#94A3B8" /> };
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { text: '비', emoji: '🌧️', color: 'var(--primary)', icon: <CloudRain size={18} color="#3B82F6" /> };
  } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return { text: '눈', emoji: '❄️', color: 'var(--info)', icon: <Snowflake size={18} color="#38BDF8" /> };
  } else if (code >= 95) {
    return { text: '뇌우', emoji: '⚡', color: '#8B5CF6', icon: <CloudLightning size={18} color="#8B5CF6" /> };
  }
  return { text: '구름', emoji: '☁️', color: 'var(--text-muted)', icon: <Cloud size={18} color="#64748B" /> };
}

interface CurrentWeatherData {
  temp: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
}

interface HourlyForecast {
  time: string;
  temp: number;
  pop: number;
  weatherCode: number;
}

interface DailyForecast {
  date: string;
  dayLabel: string;
  tempMax: number;
  tempMin: number;
  popMax: number;
  weatherCode: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customerName?: string;
  siteName?: string;
  rawAddress?: string;
}

export const DestinationWeatherModal: React.FC<Props> = ({
  isOpen,
  onClose,
  customerName = '-',
  siteName = '-',
  rawAddress = ''
}) => {
  // 배차 하차지 전용 독립 local state (전역 헤더 날씨 위젯에 영향주지 않음)
  const [selectedRegion, setSelectedRegion] = useState<DestinationRegion>(KOREA_DESTINATION_REGIONS[1]);
  const [selectedSido, setSelectedSido] = useState<string>('경기도');
  const [isAutoParsed, setIsAutoParsed] = useState<boolean>(false);
  const [parsedKeyword, setParsedKeyword] = useState<string>('');

  const [current, setCurrent] = useState<CurrentWeatherData | null>(null);
  const [hourly, setHourly] = useState<HourlyForecast[]>([]);
  const [daily, setDaily] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 모달 오픈 시 1단계 주소 파싱 실행
  useEffect(() => {
    if (isOpen) {
      const { region, isMatched, matchedKeyword } = parseAddressToRegion(rawAddress);
      setSelectedRegion(region);
      setSelectedSido(region.sido);
      setIsAutoParsed(isMatched);
      setParsedKeyword(matchedKeyword);
      fetchWeatherData(region);
    }
  }, [isOpen, rawAddress]);

  const fetchWeatherData = async (region: DestinationRegion) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('날씨 정보 로드 실패');
      const data = await res.json();

      if (data.current) {
        setCurrent({
          temp: Math.round(data.current.temperature_2m * 10) / 10,
          apparentTemp: Math.round(data.current.apparent_temperature * 10) / 10,
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m * 10) / 10,
          precipitation: data.current.precipitation,
          weatherCode: data.current.weather_code,
        });
      }

      if (data.hourly && data.hourly.time) {
        const now = new Date();
        const currentHour = now.getHours();
        const hourlyArr: HourlyForecast[] = [];
        for (let i = currentHour; i < currentHour + 24 && i < data.hourly.time.length; i++) {
          const timeStr = data.hourly.time[i];
          const hourNum = new Date(timeStr).getHours();
          hourlyArr.push({
            time: `${hourNum}시`,
            temp: Math.round(data.hourly.temperature_2m[i]),
            pop: data.hourly.precipitation_probability[i] || 0,
            weatherCode: data.hourly.weather_code[i],
          });
        }
        setHourly(hourlyArr);
      }

      if (data.daily && data.daily.time) {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dailyArr: DailyForecast[] = [];
        for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
          const dObj = new Date(data.daily.time[i]);
          const dayLabel = i === 0 ? '오늘' : i === 1 ? '내일' : `${dObj.getMonth() + 1}/${dObj.getDate()} (${days[dObj.getDay()]})`;
          dailyArr.push({
            date: data.daily.time[i],
            dayLabel,
            tempMax: Math.round(data.daily.temperature_2m_max[i]),
            tempMin: Math.round(data.daily.temperature_2m_min[i]),
            popMax: data.daily.precipitation_probability_max[i] || 0,
            weatherCode: data.daily.weather_code[i],
          });
        }
        setDaily(dailyArr);
      }
    } catch (err) {
      console.error('Destination weather fetch error:', err);
      setError('기상 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 2단계 주소 수동 선택 핸들러 (1단계: 시/도 변경)
  const handleSidoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sido = e.target.value;
    setSelectedSido(sido);
    const availableSigungu = KOREA_DESTINATION_REGIONS.filter(r => r.sido === sido);
    if (availableSigungu.length > 0) {
      const target = availableSigungu[0];
      setSelectedRegion(target);
      fetchWeatherData(target);
    }
  };

  // 2단계 주소 수동 선택 핸들러 (2단계: 시/군/구 변경)
  const handleSigunguChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const regId = e.target.value;
    const target = KOREA_DESTINATION_REGIONS.find(r => r.id === regId);
    if (target) {
      setSelectedRegion(target);
      fetchWeatherData(target);
    }
  };

  if (!isOpen) return null;

  const weatherMeta = current ? getWeatherInfo(current.weatherCode) : null;
  const sigunguOptions = KOREA_DESTINATION_REGIONS.filter(r => r.sido === selectedSido);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-main)',
        borderRadius: '16px',
        width: '580px',
        maxWidth: '94vw',
        border: '1px solid var(--border-color)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden'
      }}>
        {/* 모달 헤더 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: 'var(--bg-card-header)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} color="#3B82F6" />
            <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '800', color: 'var(--text-main)' }}>
              운송 하차지 날씨 및 예보
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto' }}>
          
          {/* 하차지 입력 정보 카드 & 1단계 파싱 결과 표시 */}
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-app)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--primary)' }}>
                🏢 {customerName} | 📍 {siteName}
              </div>
              {isAutoParsed ? (
                <span style={{ fontSize: '11.5px', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                  <CheckCircle2 size={13} /> 주소 자동파싱 성공 ('{parsedKeyword}')
                </span>
              ) : (
                <span style={{ fontSize: '11.5px', color: '#F59E0B', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                  <AlertTriangle size={13} /> 하차지 직접 2단계 선택
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              주소: {rawAddress || '미입력 (하단에서 지역을 직접 선택해 주세요)'}
            </div>
          </div>

          {/* 2단계 주소 선택기 (1단계 시/도 -> 2단계 시/군/구) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>🎯 하차지 기상지역 2단계 정밀 선택 (전역 지정 지역 독립 설정)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>1단계: 시 / 도</label>
                <select
                  value={selectedSido}
                  onChange={handleSidoChange}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', fontSize: '13px', fontWeight: '600' }}
                >
                  {SIDO_LIST.map(sido => (
                    <option key={sido} value={sido}>{sido}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>2단계: 시 / 군 / 구</label>
                <select
                  value={selectedRegion.id}
                  onChange={handleSigunguChange}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', fontSize: '13px', fontWeight: '600' }}
                >
                  {sigunguOptions.map(r => (
                    <option key={r.id} value={r.id}>{r.sigungu === '전체' ? r.name : r.sigungu}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 날씨 데이터 출력 영역 */}
          {loading ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <RefreshCw size={20} className="spin" style={{ marginBottom: '8px' }} />
              <div>하차지 기상 데이터를 수신 중...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--danger)', fontSize: '13px' }}>{error}</div>
          ) : current && weatherMeta ? (
            <>
              {/* 현재 기온 카드 */}
              <div style={{
                padding: '16px', borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                    {selectedRegion.name} 하차지 현재 기온
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-main)' }}>{current.temp}°C</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: weatherMeta.color }}>{weatherMeta.text} {weatherMeta.emoji}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    체감 {current.apparentTemp}°C · 습도 {current.humidity}% · 풍속 {current.windSpeed} m/s
                  </div>
                </div>
                <div>{weatherMeta.icon}</div>
              </div>

              {/* 시간별 예보 (24시간) */}
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: '700', marginBottom: '8px' }}>⏰ 시간별 예보 (24시간)</div>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                  {hourly.map((h, i) => {
                    const hMeta = getWeatherInfo(h.weatherCode);
                    return (
                      <div key={i} style={{
                        flexShrink: 0, width: '64px', padding: '8px 4px', borderRadius: '8px',
                        border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)',
                        textAlign: 'center', fontSize: '11px'
                      }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>{h.time}</div>
                        <div style={{ marginBottom: '2px' }}>{hMeta.icon}</div>
                        <div style={{ fontWeight: '700' }}>{h.temp}°C</div>
                        <div style={{ color: 'var(--primary)', fontSize: '10px', marginTop: '2px' }}>☔{h.pop}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 주간 예보 (7일) */}
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: '700', marginBottom: '8px' }}>📅 주간 예보 (7일)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {daily.map((d, i) => {
                    const dMeta = getWeatherInfo(d.weatherCode);
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-app)', fontSize: '12px'
                      }}>
                        <span style={{ fontWeight: '700', width: '80px' }}>{d.dayLabel}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                          {dMeta.icon}
                          <span style={{ color: dMeta.color }}>{dMeta.text}</span>
                          <span style={{ color: 'var(--primary)', fontSize: '11px', marginLeft: '6px' }}>☔ {d.popMax}%</span>
                        </div>
                        <span style={{ fontWeight: '700' }}>
                          <span style={{ color: 'var(--primary)' }}>{d.tempMin}°</span> / <span style={{ color: 'var(--danger)' }}>{d.tempMax}°</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
