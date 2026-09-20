import React, { useState, useEffect } from 'react';
import { Sun, Cloud, CloudSun, CloudRain, Snowflake, CloudLightning, CloudFog, MapPin, X, RefreshCw, Calendar, Clock } from 'lucide-react';

export interface WeatherRegion {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const WEATHER_REGIONS: WeatherRegion[] = [
  { id: 'seoul', name: '서울', lat: 37.5665, lon: 126.9780 },
  { id: 'paju', name: '파주', lat: 37.7595, lon: 126.7803 },
  { id: 'suwon', name: '수원/경기', lat: 37.2636, lon: 127.0286 },
  { id: 'pyeongtaek', name: '평택', lat: 36.9921, lon: 127.0858 },
  { id: 'yongin', name: '용인', lat: 37.2411, lon: 127.1776 },
  { id: 'incheon', name: '인천', lat: 37.4563, lon: 126.7052 },
  { id: 'cheongju', name: '청주', lat: 36.6424, lon: 127.4890 },
  { id: 'busan', name: '부산', lat: 35.1796, lon: 129.0756 },
  { id: 'daegu', name: '대구', lat: 35.8714, lon: 128.6014 },
  { id: 'gwangju', name: '광주', lat: 35.1595, lon: 126.8526 },
];

export function getWeatherInfo(code: number) {
  if (code === 0) {
    return { text: '맑음', emoji: '☀️', color: '#F59E0B', icon: <Sun size={18} color="#F59E0B" /> };
  } else if (code >= 1 && code <= 3) {
    return { text: code === 1 ? '대체로 맑음' : code === 2 ? '구름 조금' : '흐림', emoji: '⛅', color: '#64748B', icon: <CloudSun size={18} color="#64748B" /> };
  } else if (code === 45 || code === 48) {
    return { text: '안개', emoji: '🌫️', color: '#94A3B8', icon: <CloudFog size={18} color="#94A3B8" /> };
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { text: '비', emoji: '🌧️', color: '#3B82F6', icon: <CloudRain size={18} color="#3B82F6" /> };
  } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return { text: '눈', emoji: '❄️', color: '#38BDF8', icon: <Snowflake size={18} color="#38BDF8" /> };
  } else if (code >= 95) {
    return { text: '뇌우', emoji: '⚡', color: '#8B5CF6', icon: <CloudLightning size={18} color="#8B5CF6" /> };
  }
  return { text: '구름', emoji: '☁️', color: '#64748B', icon: <Cloud size={18} color="#64748B" /> };
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
  weatherCode: number;
  pop: number;
}

interface DailyForecast {
  date: string;
  dayName: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  popMax: number;
}

export interface WeatherWidgetProps {
  compact?: boolean;
  style?: React.CSSProperties;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ compact = false, style: customStyle }) => {
  const [selectedRegion, setSelectedRegion] = useState<WeatherRegion>(() => {
    const savedId = localStorage.getItem('weather_region_id');
    if (savedId) {
      const found = WEATHER_REGIONS.find(r => r.id === savedId);
      if (found) return found;
    }
    return WEATHER_REGIONS[0];
  });
  const [current, setCurrent] = useState<CurrentWeatherData | null>(null);
  const [hourly, setHourly] = useState<HourlyForecast[]>([]);
  const [daily, setDaily] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);

  const fetchWeatherData = async (region: WeatherRegion) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('날씨 정보를 불러오지 못했습니다.');
      const data = await res.json();

      // Parse current
      if (data.current) {
        setCurrent({
          temp: Math.round(data.current.temperature_2m * 10) / 10,
          apparentTemp: Math.round(data.current.apparent_temperature * 10) / 10,
          humidity: data.current.relative_humidity_2m,
          windSpeed: data.current.wind_speed_10m,
          precipitation: data.current.precipitation,
          weatherCode: data.current.weather_code,
        });
      }

      // Parse hourly (next 24h, step 3)
      if (data.hourly && data.hourly.time) {
        const hourlyArr: HourlyForecast[] = [];
        const nowHour = new Date().getHours();
        for (let i = nowHour; i < Math.min(nowHour + 24, data.hourly.time.length); i += 3) {
          const tStr = data.hourly.time[i];
          const dateObj = new Date(tStr);
          const hourLabel = `${dateObj.getHours()}시`;
          hourlyArr.push({
            time: hourLabel,
            temp: Math.round(data.hourly.temperature_2m[i]),
            weatherCode: data.hourly.weather_code[i],
            pop: data.hourly.precipitation_probability ? data.hourly.precipitation_probability[i] : 0,
          });
        }
        setHourly(hourlyArr);
      }

      // Parse daily (7 days)
      if (data.daily && data.daily.time) {
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dailyArr: DailyForecast[] = [];
        for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
          const dStr = data.daily.time[i];
          const dateObj = new Date(dStr);
          const dayLabel = i === 0 ? '오늘' : i === 1 ? '내일' : `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${dayNames[dateObj.getDay()]})`;
          dailyArr.push({
            date: dStr,
            dayName: dayLabel,
            maxTemp: Math.round(data.daily.temperature_2m_max[i]),
            minTemp: Math.round(data.daily.temperature_2m_min[i]),
            weatherCode: data.daily.weather_code[i],
            popMax: data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[i] : 0,
          });
        }
        setDaily(dailyArr);
      }
    } catch (err: any) {
      console.error('Weather fetch error:', err);
      setError('날씨 로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherData(selectedRegion);
  }, [selectedRegion]);

  const weatherMeta = current ? getWeatherInfo(current.weatherCode) : null;

  return (
    <>
      {/* 헤더 좌측 날씨 요약 뱃지 (클릭 시 상세 모달) */}
      <div
        onClick={() => setShowModal(true)}
        title="클릭하여 시간대별 및 이번주 상세 날씨 확인"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? '4px' : '6px',
          padding: compact ? '3.5px 8px' : '5px 10px',
          borderRadius: compact ? '10px' : '20px',
          backgroundColor: compact ? '#1e293b' : 'var(--bg-app)',
          border: compact ? '1px solid #334155' : '1px solid var(--border-color)',
          cursor: 'pointer',
          fontSize: compact ? '11px' : '12.5px',
          fontWeight: 600,
          color: compact ? '#f8fafc' : 'var(--text-primary)',
          transition: 'all 0.15s ease',
          userSelect: 'none',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          ...customStyle
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = compact ? '#334155' : 'var(--border-color)')}
      >
        {loading ? (
          <span style={{ fontSize: compact ? '10.5px' : '11.5px', color: 'var(--text-muted)' }}>🌤️ 날씨 조회중</span>
        ) : error || !current || !weatherMeta ? (
          <span style={{ fontSize: compact ? '10.5px' : '11.5px', color: 'var(--text-muted)' }}>🌤️ 날씨 ({selectedRegion.name})</span>
        ) : (
          <>
            <span style={{ display: 'flex', alignItems: 'center', transform: compact ? 'scale(0.85)' : 'none' }}>{weatherMeta.icon}</span>
            <span style={{ color: compact ? '#94a3b8' : 'var(--text-muted)', fontSize: compact ? '10.5px' : '11.5px' }}>{selectedRegion.name}</span>
            <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{current.temp}°C</span>
            {!compact && <span style={{ color: weatherMeta.color, fontSize: '11.5px' }}>{weatherMeta.text}</span>}
          </>
        )}
      </div>

      {/* 상세 날씨 모달 */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
          padding: '12px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '520px', backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '14px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 35px -5px rgba(0,0,0,0.5)'
          }}>
            {/* 모달 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>현장 날씨 정보</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => fetchWeatherData(selectedRegion)}
                  title="새로고침"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 지역 선택 바 */}
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>현장 지역 선택:</label>
              <select
                value={selectedRegion.id}
                onChange={e => {
                  const reg = WEATHER_REGIONS.find(r => r.id === e.target.value);
                  if (reg) {
                    setSelectedRegion(reg);
                    localStorage.setItem('weather_region_id', reg.id);
                  }
                }}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none'
                }}
              >
                {WEATHER_REGIONS.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* 메인 현재 날씨 카드 */}
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>날씨 정보 로딩 중...</div>
            ) : current && weatherMeta ? (
              <>
                <div style={{
                  padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>{selectedRegion.name} 현재 기온</div>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {current.temp}°C
                      <span style={{ fontSize: '14px', fontWeight: 600, color: weatherMeta.color }}>{weatherMeta.text} {weatherMeta.emoji}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      체감 {current.apparentTemp}°C · 습도 {current.humidity}% · 풍속 {current.windSpeed} m/s
                    </div>
                  </div>
                  <div style={{ transform: 'scale(1.8)', transformOrigin: 'center right', paddingRight: '12px' }}>
                    {weatherMeta.icon}
                  </div>
                </div>

                {/* 시간대별 예보 (24시간) */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={15} color="var(--primary)" /> 시간대별 예보 (24시간)
                  </div>
                  <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
                    {hourly.map((h, idx) => {
                      const hMeta = getWeatherInfo(h.weatherCode);
                      return (
                        <div key={idx} style={{
                          minWidth: '68px', padding: '10px 6px', borderRadius: '8px', border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-app)', textAlign: 'center', flexShrink: 0
                        }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{h.time}</div>
                          <div style={{ margin: '4px 0', display: 'flex', justifyContent: 'center' }}>{hMeta.icon}</div>
                          <div style={{ fontSize: '13px', fontWeight: 700 }}>{h.temp}°C</div>
                          {h.pop > 0 && (
                            <div style={{ fontSize: '10px', color: '#3B82F6', marginTop: '2px' }}>☔ {h.pop}%</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 주간 예보 (7일간) */}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={15} color="var(--primary)" /> 주간 예보 (7일)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {daily.map((d, idx) => {
                      const dMeta = getWeatherInfo(d.weatherCode);
                      return (
                        <div key={idx} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px',
                          borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', fontSize: '12.5px'
                        }}>
                          <div style={{ width: '100px', fontWeight: idx === 0 ? 800 : 600, color: idx === 0 ? 'var(--primary)' : 'var(--text-primary)' }}>
                            {d.dayName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }}>
                            {dMeta.icon}
                            <span style={{ fontSize: '12px', color: dMeta.color }}>{dMeta.text}</span>
                            {d.popMax > 0 && (
                              <span style={{ fontSize: '11px', color: '#3B82F6', marginLeft: '4px' }}>☔ {d.popMax}%</span>
                            )}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#3B82F6' }}>{d.minTemp}°</span> / <span style={{ color: '#EF4444' }}>{d.maxTemp}°</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
};
