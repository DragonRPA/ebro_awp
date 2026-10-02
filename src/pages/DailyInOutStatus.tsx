// src/pages/DailyInOutStatus.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Calendar, Table, ChevronLeft, ChevronRight, Download, RefreshCw, 
  ArrowDownLeft, ArrowUpRight, Search, Filter, Truck, CheckCircle2, 
  Clock, Package, Layers, X, FileSpreadsheet
} from 'lucide-react';
import { exportToExcel } from '../services/excel';

export interface InOutEventItem {
  id: string;
  sourceType: 'ACTUAL' | 'SCHEDULED'; // 실적 vs 배차 예정
  inOutType: 'INBOUND' | 'OUTBOUND';  // 입고 vs 출고
  date: string;                       // YYYY-MM-DD
  time?: string;                      // HH:mm 또는 시간대
  modelName: string;
  quantity: number;
  assetNos: string[];
  customerName?: string;
  siteName?: string;
  contractNo?: string;
  driverName?: string;
  transportCompany?: string;
  statusText: string;
  memo?: string;
}

export const DailyInOutStatus: React.FC = () => {
  const { 
    assetInOutLogs, deliveries, assets, contracts, customers, sites, 
    contractAssets, fullRefreshFromServer, showErrorModal 
  } = useApp();

  const now = new Date();
  const getTodayStr = () => now.toISOString().split('T')[0];
  const todayStr = getTodayStr();

  // 1. 뷰 모드: CALENDAR vs TABLE
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'TABLE'>('CALENDAR');

  // 2. 기준 연월 상태
  const [calYear, setCalYear] = useState<number>(now.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(now.getMonth() + 1); // 1~12

  // 3. 필터 상태
  const [filterType, setFilterType] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'ACTUAL' | 'SCHEDULED'>('ALL');
  const [modelFilter, setModelFilter] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 4. 선택된 일자 (상세 패널용)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // ── 🔄 연월 이동 핸들러 ──
  const handlePrevMonth = () => {
    if (calMonth === 1) {
      setCalYear(prev => prev - 1);
      setCalMonth(12);
    } else {
      setCalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 12) {
      setCalYear(prev => prev + 1);
      setCalMonth(1);
    } else {
      setCalMonth(prev => prev + 1);
    }
  };

  const handleTodayMonth = () => {
    const d = new Date();
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // ── 📦 전체 자산 모델명 매핑 맵 구축 ──
  const assetMap = useMemo(() => {
    const map = new Map<string, { assetNo: string; modelName: string }>();
    (assets || []).forEach(a => {
      map.set(a.id, { assetNo: a.assetNo || '', modelName: a.modelName || '' });
    });
    return map;
  }, [assets]);

  // ── 🏢 고객사 및 현장명 매핑 맵 ──
  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    (customers || []).forEach(c => map.set(c.id, c.name));
    return map;
  }, [customers]);

  const siteMap = useMemo(() => {
    const map = new Map<string, string>();
    (sites || []).forEach(s => map.set(s.id, s.name));
    return map;
  }, [sites]);

  // ── 📋 통합 비즈니스 이벤트 추출 파이프라인 (실적 + 예정) ──
  const allEvents = useMemo(() => {
    const list: InOutEventItem[] = [];

    // 1. assetInOutLogs 실적 추출
    (assetInOutLogs || []).forEach(log => {
      if (!log.eventDate) return;
      if (log.type !== 'INBOUND' && log.type !== 'OUTBOUND') return;

      const assetInfo = log.assetId ? assetMap.get(log.assetId) : null;
      const modelName = log.modelName || assetInfo?.modelName || '기타 기종';
      const assetNo = log.assetNo || assetInfo?.assetNo || '';

      list.push({
        id: `log-${log.id}`,
        sourceType: 'ACTUAL',
        inOutType: log.type === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
        date: log.eventDate.substring(0, 10),
        time: log.createdAt ? log.createdAt.substring(11, 16) : undefined,
        modelName,
        quantity: 1,
        assetNos: assetNo ? [assetNo] : [],
        customerName: log.customerName || (log.customerId ? customerMap.get(log.customerId) : undefined),
        siteName: log.siteName || (log.siteId ? siteMap.get(log.siteId) : undefined),
        contractNo: undefined,
        statusText: log.type === 'INBOUND' ? '입고 완료' : '출고 완료',
        memo: log.memo
      });
    });

    // 2. deliveries 배차 예정 추출 (완료/취소 건 처리)
    (deliveries || []).forEach(del => {
      if (del.status === 'CANCELLED') return;

      // 이미 실적으로 완료된 출고/입고는 중복 집계를 피하기 위해 
      // 배차 상태가 DELIVERED이면서 해당 날짜에 완료된 건은 로그에 존재할 수 있음
      // 하지만 실적+예정 전체를 투명하게 보되, 소스를 명확히 분리
      const isActualDelivered = del.status === 'DELIVERED';

      const relContract = del.contractId ? contracts.find(c => c.id === del.contractId) : null;
      const custName = relContract?.customerId ? customerMap.get(relContract.customerId) : undefined;
      const sName = relContract?.siteId ? siteMap.get(relContract.siteId) : undefined;

      // 장비번호 및 모델명 파싱
      const rawAssetIds = (del.assetIds || '').split(',').map(s => s.trim()).filter(Boolean);
      const matchedAssets = rawAssetIds.map(id => assetMap.get(id)).filter(Boolean) as { assetNo: string; modelName: string }[];

      // cargoItems 파싱 [{ modelName, count }]
      let parsedCargo: { modelName: string; count: number }[] = [];
      if (del.cargoItems) {
        try {
          const parsed = JSON.parse(del.cargoItems);
          if (Array.isArray(parsed)) {
            parsedCargo = parsed.map((item: any) => ({
              modelName: item.modelName || item.model || '기타 기종',
              count: Number(item.count || item.qty || 1)
            }));
          }
        } catch (e) {}
      }

      // 기종별 수량 리스트 구성
      const modelQtyMap = new Map<string, { qty: number; nos: string[] }>();

      if (matchedAssets.length > 0) {
        matchedAssets.forEach(a => {
          const m = a.modelName || '기타 기종';
          const cur = modelQtyMap.get(m) || { qty: 0, nos: [] };
          cur.qty += 1;
          if (a.assetNo) cur.nos.push(a.assetNo);
          modelQtyMap.set(m, cur);
        });
      } else if (parsedCargo.length > 0) {
        parsedCargo.forEach(c => {
          const cur = modelQtyMap.get(c.modelName) || { qty: 0, nos: [] };
          cur.qty += c.count;
          modelQtyMap.set(c.modelName, cur);
        });
      } else {
        // 둘 다 없으면 기본 1대
        modelQtyMap.set('기타 기종', { qty: 1, nos: rawAssetIds });
      }

      // ── 유형 분기: OUTBOUND / INBOUND / EXCHANGE ──
      if (del.type === 'OUTBOUND') {
        const outDate = del.loadingDate || del.scheduledDate || del.requestDate;
        if (outDate) {
          modelQtyMap.forEach((val, mName) => {
            list.push({
              id: `del-out-${del.id}-${mName}`,
              sourceType: isActualDelivered ? 'ACTUAL' : 'SCHEDULED',
              inOutType: 'OUTBOUND',
              date: outDate.substring(0, 10),
              time: del.loadingTimeSlot,
              modelName: mName,
              quantity: val.qty,
              assetNos: val.nos,
              customerName: custName,
              siteName: sName,
              contractNo: relContract?.contractNo,
              driverName: del.driverName,
              transportCompany: del.transportCompany,
              statusText: isActualDelivered ? '배차 완료(운송완료)' : del.status === 'DISPATCHED' ? '배차 완료(운송중)' : '배차 대기',
              memo: del.memo
            });
          });
        }
      } else if (del.type === 'INBOUND' || del.type === 'RETURN') {
        const inDate = del.unloadingDate || del.scheduledDate || del.requestDate;
        if (inDate) {
          modelQtyMap.forEach((val, mName) => {
            list.push({
              id: `del-in-${del.id}-${mName}`,
              sourceType: isActualDelivered ? 'ACTUAL' : 'SCHEDULED',
              inOutType: 'INBOUND',
              date: inDate.substring(0, 10),
              time: del.unloadingTimeSlot,
              modelName: mName,
              quantity: val.qty,
              assetNos: val.nos,
              customerName: custName,
              siteName: sName,
              contractNo: relContract?.contractNo,
              driverName: del.driverName,
              transportCompany: del.transportCompany,
              statusText: isActualDelivered ? '회수 완료(도착)' : del.status === 'DISPATCHED' ? '회수 진행(운송중)' : '회수 대기',
              memo: del.memo
            });
          });
        }
      } else if (del.type === 'EXCHANGE') {
        // 교환: 출고(상차) + 입고(하차) 1:1 동시 발행
        const outDate = del.loadingDate || del.scheduledDate || del.requestDate;
        const inDate = del.unloadingDate || del.scheduledDate || del.requestDate;

        if (outDate) {
          modelQtyMap.forEach((val, mName) => {
            list.push({
              id: `del-exc-out-${del.id}-${mName}`,
              sourceType: isActualDelivered ? 'ACTUAL' : 'SCHEDULED',
              inOutType: 'OUTBOUND',
              date: outDate.substring(0, 10),
              time: del.loadingTimeSlot,
              modelName: mName,
              quantity: val.qty,
              assetNos: val.nos,
              customerName: custName,
              siteName: sName,
              contractNo: relContract?.contractNo,
              driverName: del.driverName,
              transportCompany: del.transportCompany,
              statusText: isActualDelivered ? '교환출고 완료' : '교환출고 진행',
              memo: del.memo
            });
          });
        }
        if (inDate) {
          modelQtyMap.forEach((val, mName) => {
            list.push({
              id: `del-exc-in-${del.id}-${mName}`,
              sourceType: isActualDelivered ? 'ACTUAL' : 'SCHEDULED',
              inOutType: 'INBOUND',
              date: inDate.substring(0, 10),
              time: del.unloadingTimeSlot,
              modelName: mName,
              quantity: val.qty,
              assetNos: val.nos,
              customerName: custName,
              siteName: sName,
              contractNo: relContract?.contractNo,
              driverName: del.driverName,
              transportCompany: del.transportCompany,
              statusText: isActualDelivered ? '교환입고 완료' : '교환입고 진행',
              memo: del.memo
            });
          });
        }
      }
    });

    return list;
  }, [assetInOutLogs, deliveries, assetMap, customerMap, siteMap, contracts]);

  // ── 🔍 전체 모델명 목록 추출 (필터 드롭다운용) ──
  const uniqueModelList = useMemo(() => {
    const set = new Set<string>();
    allEvents.forEach(e => {
      if (e.modelName) set.add(e.modelName);
    });
    (assets || []).forEach(a => {
      if (a.modelName) set.add(a.modelName);
    });
    return Array.from(set).sort();
  }, [allEvents, assets]);

  // ── 🎯 필터링 적용된 이벤트 목록 ──
  const filteredEvents = useMemo(() => {
    return allEvents.filter(e => {
      // 1. 유형 필터 (입고 / 출고)
      if (filterType !== 'ALL' && e.inOutType !== filterType) return false;

      // 2. 소스 필터 (실적 / 예정)
      if (sourceFilter !== 'ALL' && e.sourceType !== sourceFilter) return false;

      // 3. 모델 필터
      if (modelFilter !== 'ALL' && e.modelName !== modelFilter) return false;

      // 4. 검색어 필터
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        const matchModel = e.modelName.toLowerCase().includes(kw);
        const matchCust = (e.customerName || '').toLowerCase().includes(kw);
        const matchSite = (e.siteName || '').toLowerCase().includes(kw);
        const matchAsset = e.assetNos.some(no => no.toLowerCase().includes(kw));
        const matchContract = (e.contractNo || '').toLowerCase().includes(kw);
        if (!matchModel && !matchCust && !matchSite && !matchAsset && !matchContract) {
          return false;
        }
      }

      return true;
    });
  }, [allEvents, filterType, sourceFilter, modelFilter, searchKeyword]);

  // ── 📅 월간 기준 필터링 및 일자별 그룹핑 맵 ──
  const monthPrefix = `${calYear}-${String(calMonth).padStart(2, '0')}`;

  const currentMonthEvents = useMemo(() => {
    return filteredEvents.filter(e => e.date.startsWith(monthPrefix));
  }, [filteredEvents, monthPrefix]);

  // 일자별 통계 및 모델 요약 집계
  const eventsByDateMap = useMemo(() => {
    const map = new Map<string, {
      inEvents: InOutEventItem[];
      outEvents: InOutEventItem[];
      totalIn: number;
      totalOut: number;
      inModelSummary: string;
      outModelSummary: string;
    }>();

    currentMonthEvents.forEach(e => {
      const cur = map.get(e.date) || {
        inEvents: [],
        outEvents: [],
        totalIn: 0,
        totalOut: 0,
        inModelSummary: '',
        outModelSummary: ''
      };

      if (e.inOutType === 'INBOUND') {
        cur.inEvents.push(e);
        cur.totalIn += e.quantity;
      } else {
        cur.outEvents.push(e);
        cur.totalOut += e.quantity;
      }

      map.set(e.date, cur);
    });

    // 모델명 * 수량 요약 문자열 합성
    map.forEach(val => {
      // 입고 모델 요약
      const inModelCount = new Map<string, number>();
      val.inEvents.forEach(e => {
        inModelCount.set(e.modelName, (inModelCount.get(e.modelName) || 0) + e.quantity);
      });
      val.inModelSummary = Array.from(inModelCount.entries())
        .map(([m, c]) => `${m} * ${c}대`)
        .join(', ');

      // 출고 모델 요약
      const outModelCount = new Map<string, number>();
      val.outEvents.forEach(e => {
        outModelCount.set(e.modelName, (outModelCount.get(e.modelName) || 0) + e.quantity);
      });
      val.outModelSummary = Array.from(outModelCount.entries())
        .map(([m, c]) => `${m} * ${c}대`)
        .join(', ');
    });

    return map;
  }, [currentMonthEvents]);

  // ── 📊 당월 총계 대차대조 계산 ──
  const monthStats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    currentMonthEvents.forEach(e => {
      if (e.inOutType === 'INBOUND') totalIn += e.quantity;
      else totalOut += e.quantity;
    });
    const netYardMovement = totalIn - totalOut; // +: 주기장 유입, -: 현장 출고 유출
    return {
      totalIn,
      totalOut,
      netYardMovement,
      eventCount: currentMonthEvents.length
    };
  }, [currentMonthEvents]);

  // ── 📅 캘린더 날짜 계산 ──
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay(); // 0: 일요일 ~ 6: 토요일
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // ── 📄 선택된 일자의 상세 목록 ──
  const selectedDateData = useMemo(() => {
    const dayData = eventsByDateMap.get(selectedDate);
    const inEvents = dayData?.inEvents || [];
    const outEvents = dayData?.outEvents || [];
    return {
      date: selectedDate,
      totalIn: dayData?.totalIn || 0,
      totalOut: dayData?.totalOut || 0,
      inModelSummary: dayData?.inModelSummary || '입고 없음',
      outModelSummary: dayData?.outModelSummary || '출고 없음',
      allList: [...inEvents, ...outEvents]
    };
  }, [selectedDate, eventsByDateMap]);

  // ── 📥 엑셀 내보내기 ──
  const handleExportExcel = () => {
    const rows = filteredEvents.map(e => ({
      '일자': e.date,
      '구분': e.inOutType === 'INBOUND' ? '입고' : '출고',
      '상태': e.sourceType === 'ACTUAL' ? '실적' : '예정',
      '기종(모델명)': e.modelName,
      '수량': e.quantity,
      '표기': `${e.modelName} * ${e.quantity}대`,
      '자산번호': e.assetNos.join(', ') || '-',
      '거래처명': e.customerName || '-',
      '현장명': e.siteName || '-',
      '계약번호': e.contractNo || '-',
      '배차진행상태': e.statusText,
      '운송기사': e.driverName || '-',
      '운송업체': e.transportCompany || '-',
      '비고': e.memo || '-'
    }));

    exportToExcel(rows, `일일입출고조회_${calYear}년${calMonth}월_${todayStr}`);
  };

  return (
    <div 
      data-subview="daily_inout" 
      data-subview-title="일일 입출고 조회" 
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '30px' }}
    >
      {/* ──────────────────────────────────────────────────────── */}
      {/* 헌장 3.5 Gutenberg Z-패턴: ①좌상단 스코프 & ②우상단 파이프라인 */}
      {/* ──────────────────────────────────────────────────────── */}
      <div 
        data-mid="filter-panel"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        {/* ① 좌상단 (Start / Scope): 연월 네비게이션 & 기본 필터 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
          {/* 기준 연월 이동 바 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              조회 연월
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="이전달"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ 
                fontSize: '16px', 
                fontWeight: 800, 
                minWidth: '115px', 
                textAlign: 'center', 
                color: 'var(--text-primary)',
                letterSpacing: '-0.3px',
                whiteSpace: 'nowrap'
              }}>
                {calYear}년 {calMonth}월
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="다음달"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={handleTodayMonth}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                오늘
              </button>
            </div>
          </div>

          {/* 입출 구분 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              입출구분
            </span>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                outline: 'none',
                minWidth: '100px'
              }}
            >
              <option value="ALL">전체 (입·출고)</option>
              <option value="INBOUND">🔵 입고만</option>
              <option value="OUTBOUND">🔴 출고만</option>
            </select>
          </div>

          {/* 실적/예정 소스 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              진행상태
            </span>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value as any)}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                outline: 'none',
                minWidth: '115px'
              }}
            >
              <option value="ALL">전체 (실적+예정)</option>
              <option value="ACTUAL">실적 완료만</option>
              <option value="SCHEDULED">배차 예정만</option>
            </select>
          </div>

          {/* 기종(모델명) 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              모델 선택
            </span>
            <select
              value={modelFilter}
              onChange={e => setModelFilter(e.target.value)}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                outline: 'none',
                maxWidth: '150px'
              }}
            >
              <option value="ALL">전체 모델 ({uniqueModelList.length})</option>
              {uniqueModelList.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ② 우상단 (Input / Pipeline): 뷰 전환 & 검색 & 엑셀 내보내기 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          {/* 통합 검색창 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              통합 검색
            </span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="거래처/현장/장비번호"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                style={{
                  height: '34px',
                  paddingLeft: '30px',
                  paddingRight: '10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  outline: 'none',
                  width: '160px'
                }}
              />
            </div>
          </div>

          {/* 뷰 모드 토글 스위치 (캘린더 vs 표) */}
          <div 
            data-mid="view-mode-toggle"
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid var(--border-color)'
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('CALENDAR')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: viewMode === 'CALENDAR' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'CALENDAR' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Calendar size={13} />
              캘린더 형태
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: viewMode === 'TABLE' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'TABLE' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Table size={13} />
              표 형태
            </button>
          </div>

          {/* 엑셀 내보내기 버튼 */}
          <button
            type="button"
            onClick={handleExportExcel}
            data-mid="btn-export-excel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px',
              padding: '0 14px',
              borderRadius: '6px',
              border: '1px solid #10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#059669',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            title="현재 조건 엑셀 다운로드"
          >
            <Download size={14} />
            엑셀 내보내기
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 헌장 3.5 Gutenberg Z-패턴: ③중앙 본문 Body / Inspection */}
      {/* ──────────────────────────────────────────────────────── */}

      {/* ── [모드 A: 캘린더 형태 보기] ── */}
      {viewMode === 'CALENDAR' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 월간 7열 달력 그리드 */}
          <div 
            data-mid="calendar-grid-card"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              overflowX: 'auto'
            }}
          >
            {/* 요일 헤더 (일 ~ 토) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))',
              gap: '8px',
              textAlign: 'center',
              fontWeight: 800,
              fontSize: '12.5px',
              paddingBottom: '10px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <div style={{ color: '#ef4444' }}>일 (Sun)</div>
              <div style={{ color: 'var(--text-secondary)' }}>월 (Mon)</div>
              <div style={{ color: 'var(--text-secondary)' }}>화 (Tue)</div>
              <div style={{ color: 'var(--text-secondary)' }}>수 (Wed)</div>
              <div style={{ color: 'var(--text-secondary)' }}>목 (Thu)</div>
              <div style={{ color: 'var(--text-secondary)' }}>금 (Fri)</div>
              <div style={{ color: '#3b82f6' }}>토 (Sat)</div>
            </div>

            {/* 날짜 그리드 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))',
              gap: '8px',
              marginTop: '8px'
            }}>
              {/* 시작 요일 전 빈 셀 */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  style={{
                    minHeight: '120px',
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: '8px',
                    opacity: 0.25,
                    border: '1px dashed var(--border-color)'
                  }}
                />
              ))}

              {/* 1일 ~ 말일 셀 */}
              {daysArray.map(day => {
                const dayStr = String(day).padStart(2, '0');
                const monthStr = String(calMonth).padStart(2, '0');
                const dateStr = `${calYear}-${monthStr}-${dayStr}`;
                const dayData = eventsByDateMap.get(dateStr);
                const totalIn = dayData?.totalIn || 0;
                const totalOut = dayData?.totalOut || 0;
                const isToday = dateStr === todayStr;
                const isSelected = selectedDate === dateStr;
                const dayOfWeek = (firstDayOfWeek + day - 1) % 7; // 0: 일, 6: 토
                const netMovement = totalIn - totalOut;

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    style={{
                      minHeight: '125px',
                      borderRadius: '8px',
                      border: isSelected 
                        ? '2px solid var(--primary)' 
                        : isToday 
                          ? '2px solid #3b82f6' 
                          : '1px solid var(--border-color)',
                      backgroundColor: isSelected 
                        ? 'rgba(37, 99, 235, 0.06)' 
                        : isToday 
                          ? 'rgba(59, 130, 246, 0.03)' 
                          : 'var(--bg-card)',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                    title={`${dateStr} 클릭 시 상세 내역 조회`}
                  >
                    {/* 셀 상단: 일자 번호 & 순유동 뱃지 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '12.5px',
                        fontWeight: isToday || isSelected ? 800 : 700,
                        color: isToday ? '#ffffff' : dayOfWeek === 0 ? '#ef4444' : dayOfWeek === 6 ? '#3b82f6' : 'var(--text-primary)',
                        backgroundColor: isToday ? 'var(--primary)' : 'transparent',
                        borderRadius: isToday ? '50%' : '0',
                        width: isToday ? '22px' : 'auto',
                        height: isToday ? '22px' : 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap'
                      }}>
                        {day}
                      </span>

                      {/* 순유동 배지 (입고-출고 차액) */}
                      {(totalIn > 0 || totalOut > 0) && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: netMovement > 0 ? 'rgba(37, 99, 235, 0.1)' : netMovement < 0 ? 'rgba(220, 38, 38, 0.1)' : 'var(--bg-secondary)',
                          color: netMovement > 0 ? '#2563eb' : netMovement < 0 ? '#dc2626' : 'var(--text-muted)',
                          whiteSpace: 'nowrap'
                        }}>
                          {netMovement > 0 ? `+${netMovement} 유입` : netMovement < 0 ? `${netMovement} 유출` : '±0'}
                        </span>
                      )}
                    </div>

                    {/* 🔵 입고 칩 (청색 계열) */}
                    {totalIn > 0 && (
                      <div 
                        data-mid="chip-inbound"
                        style={{
                          backgroundColor: 'rgba(37, 99, 235, 0.12)',
                          border: '1px solid rgba(37, 99, 235, 0.3)',
                          borderRadius: '5px',
                          padding: '3px 6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1px',
                          fontSize: '11px',
                          color: '#1d4ed8',
                          lineHeight: '1.2'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                            <ArrowDownLeft size={12} color="#2563eb" /> 입고
                          </span>
                          <span style={{ whiteSpace: 'nowrap' }}>{totalIn}대</span>
                        </div>
                        {/* 모델명 * 수량 표기 */}
                        <div style={{ 
                          fontSize: '10px', 
                          color: '#2563eb', 
                          fontWeight: 600,
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap' 
                        }} title={dayData?.inModelSummary}>
                          {dayData?.inModelSummary}
                        </div>
                      </div>
                    )}

                    {/* 🔴 출고 칩 (적색 계열) */}
                    {totalOut > 0 && (
                      <div 
                        data-mid="chip-outbound"
                        style={{
                          backgroundColor: 'rgba(220, 38, 38, 0.1)',
                          border: '1px solid rgba(220, 38, 38, 0.28)',
                          borderRadius: '5px',
                          padding: '3px 6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1px',
                          fontSize: '11px',
                          color: '#b91c1c',
                          lineHeight: '1.2'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                            <ArrowUpRight size={12} color="#dc2626" /> 출고
                          </span>
                          <span style={{ whiteSpace: 'nowrap' }}>{totalOut}대</span>
                        </div>
                        {/* 모델명 * 수량 표기 */}
                        <div style={{ 
                          fontSize: '10px', 
                          color: '#b91c1c', 
                          fontWeight: 600,
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap' 
                        }} title={dayData?.outModelSummary}>
                          {dayData?.outModelSummary}
                        </div>
                      </div>
                    )}

                    {/* 무활동 일자 */}
                    {totalIn === 0 && totalOut === 0 && (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', opacity: 0.5 }}>-</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 📋 하단 상세 도시에 패널: 선택된 일자 실사 내역 */}
          <div 
            data-mid="daily-detail-panel"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={18} color="var(--primary)" />
                <h4 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {selectedDate} 일일 입출고 상세 내역
                </h4>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  총 {selectedDateData.allList.length}건
                </span>
              </div>

              {/* 당일 요약 배지 */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(37, 99, 235, 0.12)',
                  color: '#1d4ed8',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap'
                }}>
                  🔵 입고 {selectedDateData.totalIn}대 ({selectedDateData.inModelSummary})
                </span>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(220, 38, 38, 0.1)',
                  color: '#b91c1c',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap'
                }}>
                  🔴 출고 {selectedDateData.totalOut}대 ({selectedDateData.outModelSummary})
                </span>
              </div>
            </div>

            {selectedDateData.allList.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                해당 일자에는 등록된 입출고 실적 및 배차 예정 내역이 없습니다.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '420px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '70px', backgroundColor: 'var(--bg-secondary)' }}>구분</th>
                      <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '80px', backgroundColor: 'var(--bg-secondary)' }}>진행구분</th>
                      <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '130px', backgroundColor: 'var(--bg-secondary)' }}>모델명 * 수량</th>
                      <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '60px', backgroundColor: 'var(--bg-secondary)' }}>수량</th>
                      <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '140px', backgroundColor: 'var(--bg-secondary)' }}>자산번호</th>
                      <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-secondary)' }}>거래처 / 현장</th>
                      <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '120px', backgroundColor: 'var(--bg-secondary)' }}>배차/진행상태</th>
                      <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '120px', backgroundColor: 'var(--bg-secondary)' }}>운송기사/업체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDateData.allList.map(item => {
                      const isIn = item.inOutType === 'INBOUND';
                      return (
                        <tr 
                          key={item.id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: isIn ? 'rgba(37, 99, 235, 0.02)' : 'rgba(220, 38, 38, 0.02)'
                          }}
                        >
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 800,
                              backgroundColor: isIn ? 'rgba(37, 99, 235, 0.15)' : 'rgba(220, 38, 38, 0.15)',
                              color: isIn ? '#1d4ed8' : '#b91c1c'
                            }}>
                              {isIn ? '🔵 입고' : '🔴 출고'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: item.sourceType === 'ACTUAL' ? '#10b981' : '#f59e0b'
                            }}>
                              {item.sourceType === 'ACTUAL' ? '● 실적완료' : '○ 배차예정'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {item.modelName} * {item.quantity}대
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 700 }}>
                            {item.quantity}대
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                            {item.assetNos.join(', ') || '-'}
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {item.customerName || '-'}
                            </div>
                            {item.siteName && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {item.siteName}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            {item.statusText}
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            {item.driverName ? `${item.driverName} (${item.transportCompany || '자차'})` : (item.transportCompany || '-')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── [모드 B: 표 형태 보기] (고밀도 1:1 대사 그리드) ── */}
      {viewMode === 'TABLE' && (
        <div 
          data-mid="table-grid-card"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {calYear}년 {calMonth}월 입출고 대장 (총 {filteredEvents.length}건)
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              * 기종별 수량 단일 표준 표기 (`모델명 * 수량`)
            </span>
          </div>

          <div 
            style={{ 
              overflowY: 'auto', 
              overflowX: 'auto', 
              maxHeight: 'calc(100vh - 330px)', 
              minHeight: '480px',
              border: '1px solid var(--border-color)', 
              borderRadius: '8px' 
            }}
          >
            <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '95px', backgroundColor: 'var(--bg-secondary)' }}>일자</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '70px', backgroundColor: 'var(--bg-secondary)' }}>구분</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '80px', backgroundColor: 'var(--bg-secondary)' }}>진행상태</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '160px', backgroundColor: 'var(--bg-secondary)' }}>모델명 * 수량</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '60px', backgroundColor: 'var(--bg-secondary)' }}>수량</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '130px', backgroundColor: 'var(--bg-secondary)' }}>자산번호</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-secondary)' }}>거래처 / 현장</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '110px', backgroundColor: 'var(--bg-secondary)' }}>배차/상태</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '130px', backgroundColor: 'var(--bg-secondary)' }}>운송기사 / 업체</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-secondary)' }}>비고</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      조회 조건에 부합하는 일일 입출고 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map(item => {
                    const isIn = item.inOutType === 'INBOUND';
                    return (
                      <tr 
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: isIn ? 'rgba(37, 99, 235, 0.015)' : 'rgba(220, 38, 38, 0.015)'
                        }}
                      >
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.date}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 800,
                            backgroundColor: isIn ? 'rgba(37, 99, 235, 0.15)' : 'rgba(220, 38, 38, 0.15)',
                            color: isIn ? '#1d4ed8' : '#b91c1c'
                          }}>
                            {isIn ? '🔵 입고' : '🔴 출고'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: item.sourceType === 'ACTUAL' ? '#10b981' : '#f59e0b'
                          }}>
                            {item.sourceType === 'ACTUAL' ? '● 실적' : '○ 예정'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {item.modelName} * {item.quantity}대
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 700 }}>
                          {item.quantity}대
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {item.assetNos.join(', ') || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.customerName || '-'}
                          </div>
                          {item.siteName && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {item.siteName}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          {item.statusText}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          {item.driverName ? `${item.driverName} (${item.transportCompany || '자차'})` : (item.transportCompany || '-')}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {item.memo || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 헌장 3.5 Gutenberg Z-패턴: ④우하단 대차대조 합계 검증 바 */}
      {/* ──────────────────────────────────────────────────────── */}
      <div 
        data-mid="audit-summary-bar"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '14px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={17} color="var(--primary)" />
          <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            {calYear}년 {calMonth}월 입출고 대차대조 집계
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* 총 입고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              총 입고:
            </span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
              🔵 {monthStats.totalIn}대
            </span>
          </div>

          {/* 총 출고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              총 출고:
            </span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#b91c1c', whiteSpace: 'nowrap' }}>
              🔴 {monthStats.totalOut}대
            </span>
          </div>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-color)' }} />

          {/* ⚖️ 주기장 순유동 대차 차액 검증 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              ⚖️ 주기장 실물 순유동:
            </span>
            <span style={{
              fontSize: '13px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: monthStats.netYardMovement > 0 
                ? 'rgba(37, 99, 235, 0.12)' 
                : monthStats.netYardMovement < 0 
                  ? 'rgba(220, 38, 38, 0.12)' 
                  : 'var(--bg-secondary)',
              color: monthStats.netYardMovement > 0 
                ? '#1d4ed8' 
                : monthStats.netYardMovement < 0 
                  ? '#b91c1c' 
                  : 'var(--text-primary)',
              whiteSpace: 'nowrap'
            }}>
              {monthStats.netYardMovement > 0 
                ? `순유입 +${monthStats.netYardMovement}대 (재고 증가)` 
                : monthStats.netYardMovement < 0 
                  ? `순유출 ${monthStats.netYardMovement}대 (현장 투입)` 
                  : '수지 균형 0대'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
