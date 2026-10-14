import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Zap, Clipboard, FileText, Check, Search, ArrowUpDown, Shield, AlertTriangle, Printer, RotateCcw, Copy, PhoneCall, Sparkles } from 'lucide-react';
import { SmartReturnData } from '../context/AppContext';
import { fetchMyDrafts, DraftDispatchOrder, discardDraft } from '../services/callUploadService';
import { createHangulMatcher, compareCustomerNames } from '../utils/hangulSearch';

// 출고 시 장착 옵션 회수 상속 검수 마스터
const RETURN_CHECK_SPECS = [
  { id: 'spec1', label: '철망 / 함석 설치 부속품 (판넬/볼트)', keywords: ['철망', '함석', '사면철망', '1면', '2면', '3면', '4면', '5면', '망'] },
  { id: 'spec2', label: '확장대 철망 / 함석 부속품', keywords: ['확장대 철망', '확장대 함석', '확장대철망', '확장대함석'] },
  { id: 'spec3', label: '상단 감지봉 / 협착 방지 센서', keywords: ['감지봉', '감지봉 4ea', '상단감지', '협착', '센서', '4ea', '감지봉4ea'] },
  { id: 'spec4', label: '원판 부착물', keywords: ['원판설치', '원판'] },
  { id: 'spec9', label: '소화기함 및 거치대 / 소화기', keywords: ['소화기함', '기타 스티커물', '소화기'] },
  { id: 'spec10', label: '조이스틱 보호 커버', keywords: ['조이스틱 커버', '커버 연장'] },
  { id: 'spec14', label: '전용 충전기 및 전원선', keywords: ['충전기', '전원선', '릴선'] }
];

export const SmartReturn: React.FC = () => {
  const { hasPermission, saveSmartReturn, contracts, customers, sites, siteMasters, contacts, deliveries, contractAssets, assets, repairs, vendors, currentUser, users, currentTenant, printStations, enqueuePrintJob, showPrintSuccessModal } = useApp();
  const canSave = hasPermission('delivery', 'save');

  // 토스트 알림 상태 (헌장 5.2: 브라우저 alert 전면 퇴출)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ⚡ O(1) 엔티티 조회용 Map 사전 인덱싱
  const customerMap = useMemo(() => new Map((customers || []).map(c => [c.id, c])), [customers]);
  const siteMap = useMemo(() => new Map((sites || []).map(s => [s.id, s])), [sites]);
  const siteMasterMap = useMemo(() => new Map((siteMasters || []).map(sm => [sm.id, sm])), [siteMasters]);
  const contractMap = useMemo(() => new Map((contracts || []).map(c => [c.id, c])), [contracts]);
  const assetMap = useMemo(() => new Map((assets || []).map(a => [a.id, a])), [assets]);
  const contactMap = useMemo(() => new Map((contacts || []).map(ct => [ct.id, ct])), [contacts]);
  const vendorMap = useMemo(() => new Map((vendors || []).map(v => [v.id, v])), [vendors]);
  const repairMap = useMemo(() => new Map((repairs || []).map(r => [r.id, r])), [repairs]);

  const contractAssetsByContractMap = useMemo(() => {
    const map = new Map<string, typeof contractAssets>();
    for (const ca of contractAssets || []) {
      if (!ca.contractId || !ca.assetId) continue;
      let list = map.get(ca.contractId);
      if (!list) {
        list = [];
        map.set(ca.contractId, list);
      }
      list.push(ca);
    }
    return map;
  }, [contractAssets]);

  const deliveryLookupByContract = useMemo(() => {
    const outboundMap = new Map<string, any>();
    const anyDeliveryMap = new Map<string, any>();
    for (const d of deliveries || []) {
      if (!d.contractId) continue;
      if (!anyDeliveryMap.has(d.contractId)) {
        anyDeliveryMap.set(d.contractId, d);
      }
      if (d.type === 'OUTBOUND' && !outboundMap.has(d.contractId)) {
        outboundMap.set(d.contractId, d);
      }
    }
    return { outboundMap, anyDeliveryMap };
  }, [deliveries]);

  // 🖨️ 원격 분산 인쇄 큐 타겟 스테이션 설정 (1회 선택 시 기억)
  const PREFERRED_RETURN_STATION_KEY = 'preferred_print_station_return';
  const [isAgentPrinting, setIsAgentPrinting] = useState<boolean>(false);

  const defaultStationId = useMemo(() => {
    const saved = localStorage.getItem(PREFERRED_RETURN_STATION_KEY);
    if (saved && saved !== 'BROWSER_DIRECT' && printStations.some(s => s.id === saved)) {
      return saved;
    }
    const matchDocType = printStations.find(s => s.docTypeDefault === 'RETURN_ORDER');
    if (matchDocType) return matchDocType.id;
    const matchName = printStations.find(s => s.stationName.includes('입고') || s.stationName.includes('프린터2'));
    if (matchName) return matchName.id;
    if (printStations.length > 0) return printStations[0].id;
    return '';
  }, [printStations]);

  const [targetStationId, setTargetStationId] = useState<string>(() => {
    const saved = localStorage.getItem(PREFERRED_RETURN_STATION_KEY);
    return (saved && saved !== 'BROWSER_DIRECT') ? saved : '';
  });

  useEffect(() => {
    if (!targetStationId && defaultStationId) {
      setTargetStationId(defaultStationId);
      localStorage.setItem(PREFERRED_RETURN_STATION_KEY, defaultStationId);
    }
  }, [defaultStationId, targetStationId]);

  const handleStationChange = (newStationId: string) => {
    setTargetStationId(newStationId);
    if (newStationId && newStationId !== 'BROWSER_DIRECT') {
      localStorage.setItem(PREFERRED_RETURN_STATION_KEY, newStationId);
    }
  };

  const getInheritedOutboundSpecs = (contractId?: string) => {
    if (!contractId) return [];
    const outboundDel = deliveryLookupByContract.outboundMap.get(contractId);
    const contract = contractMap.get(contractId);
    const site = contract?.siteId ? siteMap.get(contract.siteId) : undefined;
    const siteMaster = site?.siteMasterId ? siteMasterMap.get(site.siteMasterId) : undefined;
    const text = `${outboundDel?.rawText || ''} ${outboundDel?.memo || ''} ${outboundDel?.closingMemo || ''} ${(contract as any)?.memo || ''} ${siteMaster?.paidOptions || ''} ${siteMaster?.protection || ''} ${siteMaster?.checkedSpecs ? JSON.stringify(siteMaster.checkedSpecs) : ''}`.toLowerCase();
    
    return RETURN_CHECK_SPECS.filter(s => s.keywords.some(kw => text.includes(kw.toLowerCase())));
  };

  // 모드 상태: 'SALES' (영업사원 - Case 1,2,3) | 'MAINTENANCE' (정비직원 - Case 4)
  const [activeMode, setActiveMode] = useState<'SALES' | 'MAINTENANCE'>('SALES');

  const getTodayString = () => new Date().toISOString().split('T')[0];

  // 📊 상단 KPI 요약 바 (1-pass 단일 순회 메모이제이션)
  const returnSummaryStats = useMemo(() => {
    const todayStr = getTodayString();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    let activeContractsCount = 0;
    let expiringSoonCount = 0;
    for (const c of contracts) {
      if (c.status === 'ACTIVE') {
        activeContractsCount++;
        if (c.endDate && c.endDate >= todayStr && c.endDate <= nextWeekStr) {
          expiringSoonCount++;
        }
      }
    }

    let totalRentedAssets = 0;
    for (const ca of contractAssets) {
      if (ca.assetId && !ca.actualReturnDate) {
        totalRentedAssets++;
      }
    }

    return { activeContractsCount, totalRentedAssets, expiringSoonCount };
  }, [contracts, contractAssets]);

  // ==========================================
  // [1] 영업사원 모드 (SALES) 상태
  // ==========================================
  const [salesSearch, setSalesSearch] = useState('');
  const [returnStartDate, setReturnStartDate] = useState('');
  const [returnEndDate, setReturnEndDate] = useState('');
  const [salesSortBy, setSalesSortBy] = useState<'END_DATE' | 'CUSTOMER_NAME' | 'SITE_NAME'>('END_DATE');
  const [salesSortDesc, setSalesSortDesc] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [returnDate, setReturnDate] = useState(getTodayString()); // 오늘 날짜 기본 제공
  const [loadingTime, setLoadingTime] = useState('오전');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [note, setNote] = useState('');

  // 💡 [사장님 지시] 계약 선택 시 회수예정일자 오늘날짜 세팅 및 담당자 정보 자동 기본값 세팅 (수정 가능)
  useEffect(() => {
    if (!selectedContractId) return;
    const contract = contractMap.get(selectedContractId);
    if (!contract) return;

    setReturnDate(getTodayString());

    const outboundDelivery = deliveryLookupByContract.anyDeliveryMap.get(selectedContractId);
    const site: any = contract.siteId ? siteMap.get(contract.siteId) : undefined;
    const contact: any = contract.contactId ? contactMap.get(contract.contactId) : undefined;

    const defaultContactName = (outboundDelivery as any)?.siteContactName || (outboundDelivery as any)?.recipientName || contact?.name || site?.contactName || '';
    const defaultContactPhone = (outboundDelivery as any)?.siteContactPhone || (outboundDelivery as any)?.recipientPhone || contact?.contact || site?.contact || '';

    if (defaultContactName) setContactName(defaultContactName);
    if (defaultContactPhone) setContactPhone(defaultContactPhone);
  }, [selectedContractId, contractMap, deliveryLookupByContract, siteMap, contactMap]);

  // 통화 녹음 회수 초안 대기 큐
  const [returnDrafts, setReturnDrafts] = useState<DraftDispatchOrder[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  const loadReturnDrafts = async () => {
    try {
      const list = await fetchMyDrafts();
      const filtered = list.filter(d => 
        d.status === 'DRAFT' && 
        (
          d.context?.includes('RETURN') ||
          d.note?.toLowerCase().includes('회수') ||
          d.note?.toLowerCase().includes('반납') ||
          d.note?.toLowerCase().includes('철수') ||
          d.note?.toLowerCase().includes('빼가')
        )
      );
      setReturnDrafts(filtered);
    } catch (e) {
      // non-blocking
    }
  };

  useEffect(() => {
    loadReturnDrafts();
  }, []);

  const handleApplyReturnDraft = (d: DraftDispatchOrder) => {
    setSelectedDraftId(d.id);

    const custQuery = (d.customerName?.value || '').trim().toLowerCase();
    const siteQuery = (d.siteName?.value || '').trim().toLowerCase();

    // 1) 고객사 매칭
    const matchedCust = customers.find(c =>
      c.name.toLowerCase().includes(custQuery) || (custQuery && custQuery.includes(c.name.toLowerCase()))
    );

    // 2) 계약 매칭
    let matchedContractId = '';
    if (matchedCust) {
      const custContracts = contracts.filter(c => c.customerId === matchedCust.id && c.status !== 'COMPLETED');
      if (siteQuery) {
        const matchedSite = sites.find(s => s.name.toLowerCase().includes(siteQuery) || siteQuery.includes(s.name.toLowerCase()));
        if (matchedSite) {
          const c = custContracts.find(con => con.siteId === matchedSite.id);
          if (c) matchedContractId = c.id;
        }
      }
      if (!matchedContractId && custContracts.length === 1) {
        matchedContractId = custContracts[0].id;
      }
    }

    if (matchedContractId) {
      setSelectedContractId(matchedContractId);
      const assetsForContract = contractAssetsByContractMap.get(matchedContractId) || [];
      setSelectedAssetIds(assetsForContract.map(ca => ca.assetId!));
    } else if (custQuery) {
      setSalesSearch(d.customerName?.value || '');
    }

    // 3) 회수 정보 자동 꽂아넣기
    if (d.loadingDate?.value) {
      setReturnDate(d.loadingDate.value);
    }
    if (d.loadingTime?.value) {
      setLoadingTime(d.loadingTime.value);
    }
    if (d.contactPerson?.value) {
      setContactName(d.contactPerson.value);
    }
    if (d.contactPhone) {
      setContactPhone(d.contactPhone);
    }
    if (d.note) {
      setNote(d.note);
    }

    showToast(`[${d.customerName?.value || '고객'}] 통화 내용이 회수 의뢰 폼에 자동 입력되었습니다.`);
  };


  // ==========================================
  // [2] 정비직원 모드 (MAINTENANCE) 상태
  // ==========================================
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedRepairIds, setSelectedRepairIds] = useState<string[]>([]);
  const [maintReturnDate, setMaintReturnDate] = useState(getTodayString()); // 오늘 날짜 기본 제공
  const [maintLoadingTime, setMaintLoadingTime] = useState('오전');
  const [maintNote, setMaintNote] = useState('');


  // ==========================================
  // [4] 영업용 데이터 정렬/필터 (useMemo + O(1) Map + createHangulMatcher)
  // ==========================================
  const activeContracts = useMemo(
    () => contracts.filter(c => c.status !== 'COMPLETED'),
    [contracts]
  );

  const filteredContracts = useMemo(() => {
    const trimmed = salesSearch.trim();
    const matcher = trimmed ? createHangulMatcher(trimmed) : null;
    const lowerTrimmed = trimmed.toLowerCase();

    return activeContracts.filter(c => {
      if (returnStartDate && (c.endDate || '') < returnStartDate) return false;
      if (returnEndDate && (c.endDate || '') > returnEndDate) return false;
      if (!matcher) return true;

      const custName = customerMap.get(c.customerId)?.name || '';
      const siteName = (c.siteId ? siteMap.get(c.siteId)?.name : '') || '';

      return (
        matcher.test(custName) ||
        matcher.test(siteName) ||
        Boolean(c.contractNo && c.contractNo.toLowerCase().includes(lowerTrimmed))
      );
    });
  }, [activeContracts, customerMap, siteMap, salesSearch, returnStartDate, returnEndDate]);

  const sortedContracts = useMemo(() => {
    return filteredContracts.slice().sort((a, b) => {
      if (salesSortBy === 'CUSTOMER_NAME') {
        const custA = customerMap.get(a.customerId)?.name || '';
        const custB = customerMap.get(b.customerId)?.name || '';
        const cmp = compareCustomerNames(custA, custB);
        return salesSortDesc ? -cmp : cmp;
      }

      let valA = '';
      let valB = '';

      if (salesSortBy === 'END_DATE') {
        valA = a.endDate || '';
        valB = b.endDate || '';
      } else if (salesSortBy === 'SITE_NAME') {
        valA = (a.siteId ? siteMap.get(a.siteId)?.name : '') || '';
        valB = (b.siteId ? siteMap.get(b.siteId)?.name : '') || '';
      }

      const compare = valA.localeCompare(valB, 'ko');
      return salesSortDesc ? -compare : compare;
    });
  }, [filteredContracts, salesSortBy, salesSortDesc, customerMap, siteMap]);

  // 계약 선택에 따른 자산 매칭 (O(1) Map 조회)
  const activeContractAssets = useMemo(
    () => (selectedContractId ? (contractAssetsByContractMap.get(selectedContractId) || []) : []),
    [selectedContractId, contractAssetsByContractMap]
  );

  const selectedAssetIdSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  const handleSalesAssetCheckboxChange = (assetId: string) => {
    if (selectedAssetIdSet.has(assetId)) {
      setSelectedAssetIds(selectedAssetIds.filter(id => id !== assetId));
    } else {
      setSelectedAssetIds([...selectedAssetIds, assetId]);
    }
  };

  const handleSelectAllSalesAssets = () => {
    const allIds = activeContractAssets.map(ca => ca.assetId!).filter(Boolean);
    if (selectedAssetIds.length === allIds.length) {
      setSelectedAssetIds([]);
    } else {
      setSelectedAssetIds(allIds);
    }
  };

  const handleSalesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!selectedContractId) {
      showToast('회수할 대상 계약을 목록에서 선택해 주세요.', 'error');
      return;
    }
    const targetContract = contractMap.get(selectedContractId);
    if (targetContract && targetContract.startDate && returnDate < targetContract.startDate) {
      showToast(`회수 예정일(${returnDate})은 계약 시작일(${targetContract.startDate})보다 이전일 수 없습니다.`, 'error');
      return;
    }
    if (selectedAssetIds.length === 0) {
      showToast('회수할 장비를 1대 이상 선택해 주세요.', 'error');
      return;
    }
    if (!returnDate) {
      showToast('회수 예정일자를 입력해 주세요.', 'error');
      return;
    }

    try {
      await saveSmartReturn({
        contractId: selectedContractId,
        returnDate,
        assetIds: selectedAssetIds,
        loadingTime,
        contactName,
        contactPhone,
        note
      });

      // 통화 초안 연동 처리 (헌장 1.2 무누락, 5.2)
      if (selectedDraftId) {
        try {
          await discardDraft(selectedDraftId);
          setReturnDrafts(prev => prev.filter(x => x.id !== selectedDraftId));
          setSelectedDraftId(null);
        } catch (draftErr) {
          console.error('Failed to discard return draft:', draftErr);
        }
      }

      showToast('회수 의뢰 등록이 완료되었습니다. 배차 대기열에 회수 의뢰 건이 추가되었습니다.');
      setSelectedContractId('');
      setSelectedAssetIds([]);
      setReturnDate(getTodayString());
      setLoadingTime('오전');
      setContactName('');
      setContactPhone('');
      setNote('');
    } catch (err: any) {
      showToast(err?.message || '회수의뢰 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // 🖨️ 현장 분산 인쇄 큐 전송 메소드 (입고장 프린터2 무인 자동 출력)
  const handleRemoteQueuePrint = async () => {
    const printContent = document.getElementById('return-sheet-print');
    if (!printContent) {
      showToast('인쇄할 입고의뢰서 콘텐츠를 찾을 수 없습니다.', 'error');
      return;
    }

    const selContract = contractMap.get(selectedContractId);
    const selCust = selContract?.customerId ? customerMap.get(selContract.customerId) : undefined;
    const selSite = selContract?.siteId ? siteMap.get(selContract.siteId) : undefined;

    const htmlDoc = `
      <!DOCTYPE html>
      <html lang="ko">
        <head>
          <meta charset="utf-8">
          <title>입고요청서_${selCust?.name || '고객사'}_${selSite?.name || '현장'}</title>
          <style>
            :root {
              --bg-card: #ffffff;
              --bg-app: #ffffff;
              --bg-body: #ffffff;
              --text-main: #000000;
              --text-primary: #000000;
              --text-secondary: #333333;
              --text-muted: #555555;
              --border-color: #000000;
            }
            @page {
              size: A4 portrait;
              margin: 7mm 10mm 7mm 10mm;
            }
            @media print {
              @page { size: A4 portrait; margin: 7mm 10mm; }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                color: #000000 !important;
                background-color: #f5f2eb !important;
              }
              .no-print { display: none !important; }
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Malgun Gothic', '맑은 고딕', Dotum, sans-serif;
              padding: 0;
              margin: 0 auto;
              color: #000000;
              background-color: #f5f2eb;
              width: 100%;
              max-width: 210mm;
              font-size: 8.5pt;
              line-height: 1.15;
            }
            p, div, span, table, tr, td, th {
              margin: 0;
              padding: 0;
              line-height: 1.15;
              color: #000000;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 2px;
              margin-bottom: 3px;
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #000000;
              padding: 2.5px 5px !important;
              font-size: 8pt;
              vertical-align: middle;
              white-space: nowrap;
              overflow: hidden;
              color: #000000;
            }
            th {
              background-color: #f0f0f0 !important;
              font-weight: 700;
              color: #000000;
              text-align: left;
            }
          </style>
        </head>
        <body>
          <div style="padding: 2px 0;">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `;

    try {
      setIsAgentPrinting(true);
      const st = printStations.find(s => s.id === targetStationId) ||
        printStations.find(s => s.docTypeDefault === 'RETURN_ORDER') ||
        printStations.find(s => s.stationName.includes('입고') || s.stationName.includes('프린터2')) ||
        printStations[0];

      const docNo = selContract?.contractNo || `RET-${Date.now().toString().slice(-6)}`;
      const docTitle = `입고요청서_${selCust?.name || '미지정'}_${selSite?.name || '현장'}`;
      const stationName = st?.stationName || '입고장 프린터';

      await enqueuePrintJob({
        stationId: st?.id,
        docType: 'RETURN_ORDER',
        docNo,
        title: docTitle,
        documentHtml: htmlDoc,
        requestedById: currentUser?.id,
        requestedByName: currentUser?.name
      });
      showToast(`[${stationName}] 인쇄 큐 전송 완료`);
      showPrintSuccessModal({
        docType: '회수요청서',
        docTitle,
        docNo,
        stationName,
        printerName: st?.localPrinterName
      });
    } catch (err: any) {
      showToast(`원격 인쇄 큐 전송 실패: ${err.message || err}`, 'error');
    } finally {
      setIsAgentPrinting(false);
    }
  };

  // 🖨️ 원격 인쇄 큐 전송 실행 핸들러
  const handlePrintAction = async () => {
    await handleRemoteQueuePrint();
  };

  // ==========================================
  // [5] 정비용 데이터 가공 (외주 정비 자산, useMemo + O(1) Map)
  // ==========================================
  // repairs 중에서 repairType === 'EXTERNAL' 이고 status !== 'COMPLETED' (외주수리중)인 수리 건 필터링
  const ongoingRepairs = useMemo(
    () => repairs.filter(r => r.repairType === 'EXTERNAL' && r.status !== 'COMPLETED'),
    [repairs]
  );

  const ongoingRepairsByVendorMap = useMemo(() => {
    const map = new Map<string, typeof ongoingRepairs>();
    for (const r of ongoingRepairs) {
      if (!r.vendorId) continue;
      let list = map.get(r.vendorId);
      if (!list) {
        list = [];
        map.set(r.vendorId, list);
      }
      list.push(r);
    }
    return map;
  }, [ongoingRepairs]);

  // 외주정비 중인 자산이 존재하는 정비 업체(Vendor)들만 추출
  const repairVendors = useMemo(
    () => vendors.filter(v => v.type === 'REPAIR' && ongoingRepairsByVendorMap.has(v.id)),
    [vendors, ongoingRepairsByVendorMap]
  );

  // 선택된 외주업체에서 외주정비 중인 정비 리스트
  const repairsAtSelectedVendor = useMemo(
    () => (selectedVendorId ? (ongoingRepairsByVendorMap.get(selectedVendorId) || []) : []),
    [selectedVendorId, ongoingRepairsByVendorMap]
  );

  const selectedRepairIdSet = useMemo(() => new Set(selectedRepairIds), [selectedRepairIds]);

  const handleMaintAssetCheckboxChange = (repairId: string) => {
    if (selectedRepairIdSet.has(repairId)) {
      setSelectedRepairIds(selectedRepairIds.filter(id => id !== repairId));
    } else {
      setSelectedRepairIds([...selectedRepairIds, repairId]);
    }
  };

  const handleSelectAllMaintAssets = () => {
    const allIds = repairsAtSelectedVendor.map(r => r.id);
    if (selectedRepairIds.length === allIds.length) {
      setSelectedRepairIds([]);
    } else {
      setSelectedRepairIds(allIds);
    }
  };

  const handleMaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!selectedVendorId) {
      showToast('회수해 올 외주정비 업체를 선택해 주세요.', 'error');
      return;
    }
    if (selectedRepairIds.length === 0) {
      showToast('회수할 정비 자산을 1개 이상 선택해 주세요.', 'error');
      return;
    }
    if (!maintReturnDate) {
      showToast('회수 일자를 입력해 주세요.', 'error');
      return;
    }

    // 선택된 수리건들의 assetId 목록 추출 (O(1) Map 조회)
    const targetAssetIds: string[] = [];
    selectedRepairIds.forEach(rId => {
      const rep = repairMap.get(rId);
      if (rep && rep.assetId) {
        targetAssetIds.push(rep.assetId);
      }
    });

    try {
      await saveSmartReturn({
        returnDate: maintReturnDate,
        assetIds: targetAssetIds,
        loadingTime: maintLoadingTime,
        repairId: selectedRepairIds.join(','),
        vendorId: selectedVendorId,
        note: maintNote
      });

      showToast('외주 정비 완료 자산 회수의뢰 등록이 완료되었습니다.');
      setSelectedVendorId('');
      setSelectedRepairIds([]);
      setMaintReturnDate('');
      setMaintLoadingTime('');
      setMaintNote('');
    } catch (err: any) {
      showToast(err?.message || '외주정비 회수의뢰 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  return (
    <div data-hs-observe="smart_return" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* 알림 토스트 배너 (헌장 5.2) */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          padding: '10px 18px',
          borderRadius: '6px',
          backgroundColor: toastMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {toastMessage.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}
      
      {/* 타이틀 및 가이드 배너 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontWeight: '700', marginBottom: '2px', fontSize: '18px' }}>회수 의뢰 관리</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
            영업 계약 만료/단축/고장 및 외주정비업체 수리 완료 건에 대한 회수 의뢰 프로세스를 등록합니다.
          </p>
        </div>
      </div>

      {/* 📊 회수 대상 및 계약 만료 현황 요약 바 */}
      <div data-mid="smart_return-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', flexShrink: 0 }}>
        <div style={{ padding: '8px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>진행중인 계약</span>
          <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>{returnSummaryStats.activeContractsCount}건</strong>
        </div>
        <div style={{ padding: '8px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>현장 대여중 장비</span>
          <strong style={{ fontSize: '15px', color: 'var(--success)' }}>{returnSummaryStats.totalRentedAssets}대</strong>
        </div>
        <div style={{ padding: '8px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>7일 내 만료예정 계약</span>
          <strong style={{ fontSize: '15px', color: returnSummaryStats.expiringSoonCount > 0 ? '#d97706' : 'var(--text-muted)' }}>{returnSummaryStats.expiringSoonCount}건</strong>
        </div>
      </div>

      {/* 모드 전환 탭 */}
      <div data-mid="smart_return-mode-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border-color)', paddingBottom: '6px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => {
            setActiveMode('SALES');
            setSelectedContractId('');
            setSelectedAssetIds([]);
          }}
          className={activeMode === 'SALES' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 'bold' }}
        >
          임대 계약 회수 의뢰
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveMode('MAINTENANCE');
            setSelectedVendorId('');
            setSelectedRepairIds([]);
          }}
          className={activeMode === 'MAINTENANCE' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 'bold' }}
        >
          외주 정비 수리완료 회수 의뢰
        </button>
      </div>

      {/* [1] 영업사용자 모드 UI */}
      {activeMode === 'SALES' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(360px, 4.5fr) minmax(420px, 5.5fr)',
          gap: '14px',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden'
        }}>
          
          {/* 왼쪽: 계약 목록 / 검색 / 파서 */}
          <div className="card" style={{
            padding: '14px',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Search size={16} className="text-primary" />
                <h4 style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>임대 계약 조회</h4>
              </div>

            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                
                {/* 📞 통화 접수 회수 대기 큐 (헌장 3.1 무수식어 건조 표준) */}
                {returnDrafts.length > 0 && (
                  <div data-mid="smart_return-call-drafts" style={{
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <PhoneCall size={14} color="var(--primary)" />
                        통화 접수 회수 대기 ({returnDrafts.length}건)
                      </span>
                      <button
                        type="button"
                        onClick={loadReturnDrafts}
                        style={{ fontSize: '11px', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                      >
                        새로고침
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {returnDrafts.map(d => {
                        const isSelected = selectedDraftId === d.id;
                        return (
                          <div
                            key={d.id}
                            onClick={() => handleApplyReturnDraft(d)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? 'rgba(59,130,246,0.12)' : 'var(--bg-card)',
                              border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '3px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', fontWeight: 800 }}>{d.customerName?.value || '고객사 미상'}</span>
                              <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>
                                회수 요청
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              현장: {d.siteName?.value || '현장 미상'} {d.contactPerson?.value ? `· ${d.contactPerson.value}` : ''}
                            </div>
                            {d.note && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {d.note}
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', fontSize: '10px', color: 'var(--text-muted)' }}>
                              <span>{d.createdAt?.slice(5, 16) || ''}</span>
                              <span style={{ color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <Sparkles size={11} /> 1-클릭 꽂아넣기 ➔
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 검색 필터 */}
                <div data-mid="smart_return-search-filter" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="고객명 / 초성 (예: ㅅㅅ, ㅎㄷ), 현장명, 계약번호 검색..."
                      value={salesSearch}
                      onChange={e => setSalesSearch(e.target.value)}
                      style={{ flex: 1, padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                    />
                    
                    <button
                      type="button"
                      onClick={() => {
                        if (salesSortBy === 'END_DATE') {
                          setSalesSortDesc(!salesSortDesc);
                        } else {
                          setSalesSortBy('END_DATE');
                          setSalesSortDesc(false);
                        }
                      }}
                      className={salesSortBy === 'END_DATE' ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}
                    >
                      <ArrowUpDown size={12} /> 만료일 {salesSortBy === 'END_DATE' && (salesSortDesc ? '▼' : '▲')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (salesSortBy === 'CUSTOMER_NAME') {
                          setSalesSortDesc(!salesSortDesc);
                        } else {
                          setSalesSortBy('CUSTOMER_NAME');
                          setSalesSortDesc(false);
                        }
                      }}
                      className={salesSortBy === 'CUSTOMER_NAME' ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}
                    >
                      <ArrowUpDown size={12} /> 고객명 {salesSortBy === 'CUSTOMER_NAME' && (salesSortDesc ? '▼' : '▲')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (salesSortBy === 'SITE_NAME') {
                          setSalesSortDesc(!salesSortDesc);
                        } else {
                          setSalesSortBy('SITE_NAME');
                          setSalesSortDesc(false);
                        }
                      }}
                      className={salesSortBy === 'SITE_NAME' ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}
                    >
                      <ArrowUpDown size={12} /> 현장명 {salesSortBy === 'SITE_NAME' && (salesSortDesc ? '▼' : '▲')}
                    </button>
                  </div>

                  {/* 날짜 필터 추가 */}
                  <div style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--bg-app)', padding: '8px', borderRadius: '6px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: '600', display: 'block', whiteSpace: 'nowrap' }}>계약 만료일 범위</label>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input type="date" value={returnStartDate} onChange={e => setReturnStartDate(e.target.value)} style={{ padding: '6px', fontSize: '12.5px', flex: 1, border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                        <span>~</span>
                        <input type="date" value={returnEndDate} onChange={e => setReturnEndDate(e.target.value)} style={{ padding: '6px', fontSize: '12.5px', flex: 1, border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', paddingBottom: '2px' }}>
                      <button type="button" className="btn-secondary" style={{ fontSize: '11px', padding: '4px 6px' }} onClick={() => {
                        const today = new Date();
                        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
                        setReturnStartDate(firstDay); setReturnEndDate(lastDay);
                      }}>이번달</button>
                      <button type="button" className="btn-secondary" style={{ fontSize: '11px', padding: '4px 6px' }} onClick={() => {
                        const today = new Date();
                        const firstDayNext = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().split('T')[0];
                        const lastDayNext = new Date(today.getFullYear(), today.getMonth() + 2, 0).toISOString().split('T')[0];
                        setReturnStartDate(firstDayNext); setReturnEndDate(lastDayNext);
                      }}>다음달</button>
                      <button type="button" className="btn-secondary" style={{ fontSize: '11px', padding: '4px 6px' }} onClick={() => {
                        setReturnStartDate(''); setReturnEndDate('');
                      }}>전체</button>
                    </div>
                  </div>
                </div>

                {/* 계약 목록 */}
                <div data-mid="smart_return-contract-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)' }}>
                  {sortedContracts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      검색 조건에 맞는 활성 임대계약이 없습니다.
                    </div>
                  ) : (
                    sortedContracts.map(c => {
                      const cust = customerMap.get(c.customerId);
                      const site = c.siteId ? siteMap.get(c.siteId) : undefined;
                      const isSelected = selectedContractId === c.id;
                      
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedContractId(c.id);
                            setSelectedAssetIds([]);
                          }}
                          style={{
                            padding: '10px 12px',
                            borderBottom: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                            borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '13.5px', color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                              {cust?.name}
                            </strong>
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                              {c.contractNo}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>현장: {site?.name || '미정'}</span>
                            <span style={{ fontWeight: '600', color: 'var(--danger)' }}>
                              만료일: {c.endDate || '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
          </div>

          {/* 오른쪽: 상세 정보 입력 및 폼 제출 */}
          <div className="card" style={{ padding: '16px', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexShrink: 0 }}>
              <h4 style={{ margin: 0, fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clipboard size={17} className="text-success" />
                회수 지시 세부 설정
              </h4>
            </div>

            {selectedDraftId && (
              <div style={{
                backgroundColor: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: '6px',
                padding: '8px 12px',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} /> 선택된 통화 회수 내용이 자동 입력되었습니다. 회수 장비 및 일자를 확인 후 등록하십시오.
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDraftId(null)}
                  style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  선택 해제
                </button>
              </div>
            )}

            {selectedContractId ? (
              <form onSubmit={handleSalesSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* 1. 계약 기본 확인 */}
                <div data-mid="smart_return-contract-info" style={{ padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px' }}>
                  {(() => {
                    const c = contractMap.get(selectedContractId);
                    const cust = c?.customerId ? customerMap.get(c.customerId) : undefined;
                    const site = c?.siteId ? siteMap.get(c.siteId) : undefined;
                    const siteMaster = site?.siteMasterId ? siteMasterMap.get(site.siteMasterId) : undefined;
                    const outboundDel = c?.id ? deliveryLookupByContract.outboundMap.get(c.id) : undefined;

                    const inheritedSpecs = getInheritedOutboundSpecs(selectedContractId);
                    const optMatch = outboundDel?.closingMemo?.match(/유상옵션:\s*([^\|]+)/) || outboundDel?.memo?.match(/\[(?:회수)?옵션\]\s*([^\|]+)/);
                    const protMatch = outboundDel?.closingMemo?.match(/보양:\s*([^\|]+)/) || outboundDel?.memo?.match(/\[보양작업\]\s*([^\|]+)/);

                    const displayOpt = siteMaster?.paidOptions || (optMatch ? optMatch[1].trim() : '') || '없음';
                    const displayProt = siteMaster?.protection || (protMatch ? protMatch[1].trim() : '') || 'NONE';

                    return (
                      <>
                        <div style={{ marginBottom: '4px' }}><strong>계약번호:</strong> {c?.contractNo}</div>
                        <div style={{ marginBottom: '4px' }}><strong>고객사:</strong> {cust?.name}</div>
                        <div><strong>현장명:</strong> {site?.name} ({site?.address || '-'})</div>
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)', fontSize: '12px' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--primary-color, #2563eb)' }}>출고 장착 옵션/보양:</span>{' '}
                          <span>유상옵션: {displayOpt} | 보양: {displayProt}</span>
                          {inheritedSpecs.length > 0 && (
                            <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {inheritedSpecs.map(s => (
                                <span key={s.id} style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>
                                  회수대상: {s.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 2. 자산 선택 (전부 vs 일부) */}
                <div data-mid="smart_return-asset-select">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>회수할 자산 지정 *</label>
                    <button
                      type="button"
                      onClick={handleSelectAllSalesAssets}
                      style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      전체선택 / 해제
                    </button>
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-app)' }}>
                    {activeContractAssets.length === 0 ? (
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px' }}>
                        대여 중인 자산 정보가 없습니다.
                      </div>
                    ) : (
                      activeContractAssets.map(ca => {
                        const asset = ca.assetId ? assetMap.get(ca.assetId) : undefined;
                        if (!asset) return null;
                        const isChecked = selectedAssetIdSet.has(asset.id);
                        return (
                          <label
                            key={ca.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              fontSize: '12.5px',
                              cursor: 'pointer',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                              backgroundColor: isChecked ? 'var(--primary-light)' : 'var(--bg-card)',
                              transition: 'all 0.15s ease',
                              margin: 0
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleSalesAssetCheckboxChange(asset.id)}
                              style={{ display: 'none' }}
                            />
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              border: isChecked ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                              backgroundColor: isChecked ? 'var(--primary)' : 'var(--bg-app)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              flexShrink: 0,
                              transition: 'all 0.15s ease'
                            }}>
                              {isChecked && <Check size={13} style={{ strokeWidth: 3.5, color: '#ffffff' }} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <strong style={{ color: 'var(--primary)' }}>{asset.assetNo}</strong>
                              <span style={{ fontWeight: 600 }}>{asset.modelName}</span>
                              {asset.serialNo && <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>(S/N: {asset.serialNo})</span>}
                              {asset.ownerType === 'RENTED' && asset.antiEntrapmentOwnership === 'VENDOR' && (
                                <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700, backgroundColor: 'rgba(220, 38, 38, 0.1)', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(220,38,38,0.25)', whiteSpace: 'nowrap' }}>
                                  🚨 원사협착봉 (탈거금지)
                                </span>
                              )}
                              {asset.ownerType === 'RENTED' && asset.antiEntrapmentOwnership === 'OURS' && (
                                <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700, backgroundColor: 'rgba(37, 99, 235, 0.1)', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(37,99,235,0.25)', whiteSpace: 'nowrap' }}>
                                  🔧 당사협착봉 (회수)
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    * 일부 장비만 부분 조기반송하는 경우 해당하는 장비만 체크하세요.
                  </div>
                </div>

                {/* 3. 일정 */}
                <div data-mid="smart_return-schedule" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>회수 예정일자 *</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={e => setReturnDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>회수 희망시간</label>
                    <div style={{ display: 'flex', gap: '6px', position: 'relative', height: '38px' }}>
                      <select
                        value={loadingTime}
                        onChange={e => {
                          setLoadingTime(e.target.value);
                          (e.target as HTMLSelectElement).blur();
                        }}
                        onFocus={e => { (e.target as HTMLSelectElement).size = 10; }}
                        onBlur={e => { (e.target as HTMLSelectElement).size = 1; }}
                        style={{
                          flex: 1,
                          position: 'absolute',
                          width: '100%',
                          zIndex: 30,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                      >
                        <option value="오전">오전</option>
                        <option value="오후">오후</option>
                        <option value="수시">수시</option>
                        <option value="06시">06시</option>
                        <option value="07시">07시</option>
                        <option value="08시">08시</option>
                        <option value="09시">09시</option>
                        <option value="10시">10시</option>
                        <option value="11시">11시</option>
                        <option value="12시">12시</option>
                        <option value="13시">13시</option>
                        <option value="14시">14시</option>
                        <option value="15시">15시</option>
                        <option value="16시">16시</option>
                        <option value="17시">17시</option>
                        <option value="18시">18시</option>
                        <option value="19시">19시</option>
                        <option value="20시">20시</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. 고객 담당 정보 */}
                <div data-mid="smart_return-contact" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>방문지 고객 담당자명 *</label>
                    <input
                      type="text"
                      placeholder="이름 입력"
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>담당자 연락처 *</label>
                    <input
                      type="text"
                      placeholder="연락처 입력"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* 5. 비고 */}
                <div data-mid="smart_return-note">
                  <label>특이사항 및 비고</label>
                  <textarea
                    rows={2}
                    placeholder="조기 반납 조건 명시 또는 운반비 조건 등 입력..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </div>

                <button data-hs-trigger="Register"
                  data-mid="smart_return-submit-btn"
                  type="submit"
                  className="btn-success"
                  style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 'bold' }}
                  disabled={!canSave || selectedAssetIds.length === 0}
                >
                  <Check size={16} /> 회수 의뢰 등록 확정
                </button>

              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '360px', color: 'var(--text-muted)', textAlign: 'center', gap: '8px' }}>
                <Shield size={48} style={{ strokeWidth: 1.2, marginBottom: '8px', color: selectedDraftId ? 'var(--primary)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {selectedDraftId ? '통화 회수 초안이 선택되었습니다.' : '왼쪽 계약 목록에서 회수 요청 대상을 선택해 주세요.'}
                </span>
                {selectedDraftId && (
                  <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                    왼쪽 계약 목록에서 일치하는 공사 현장 계약을 클릭하면 세부 설정이 즉시 완성됩니다.
                  </span>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* [2] 정비직원 모드 UI */}
      {activeMode === 'MAINTENANCE' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(360px, 4.5fr) minmax(420px, 5.5fr)',
          gap: '14px',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden'
        }}>
          
          {/* 왼쪽: 외주 정비 수리중인 외주업체 목록 */}
          <div className="card" style={{
            padding: '14px',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', flexShrink: 0 }}>
              <Search size={16} className="text-primary" />
              <h4 style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>외주 정비 진행중인 업체 목록</h4>
            </div>
            
            <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11.5px', marginBottom: '10px', flexShrink: 0 }}>
              ℹ 현재 외주 정비 (`EXTERNAL`) 중인 리프트 자산이 존재하는 정비소들만 노출됩니다.
            </div>

            <div data-mid="smart_return-maint-vendors" style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              {repairVendors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  현재 외주정비 진행 중인 자산이 없습니다.
                </div>
              ) : (
                repairVendors.map(v => {
                  const cnt = (ongoingRepairsByVendorMap.get(v.id) || []).length;
                  const isSelected = selectedVendorId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        setSelectedVendorId(v.id);
                        setSelectedRepairIds([]);
                      }}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                        transition: 'all 0.15s',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '13.5px' }}>{v.name}</strong>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          대표자: {(v as any).contactName || '-'} | 연락처: {(v as any).contact || '-'}
                        </div>
                      </div>
                      <span className="badge badge-warning" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                        정비중 {cnt}대
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 오른쪽: 외주정비 자산 리스트 및 회수 폼 */}
          <div className="card" style={{ padding: '16px', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexShrink: 0 }}>
              <h4 style={{ margin: 0, fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clipboard size={17} className="text-success" />
                외주정비 완료 회수 의뢰
              </h4>
            </div>

            {selectedVendorId ? (
              <form data-mid="smart_return-maint-form" onSubmit={handleMaintSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* 외주업체 정보 */}
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px' }}>
                  {(() => {
                    const v = vendorMap.get(selectedVendorId);
                    return (
                      <>
                        <div style={{ marginBottom: '4px' }}><strong>회수장소 (외주정비업체):</strong> {v?.name}</div>
                        <div><strong>업체 주소/연락처:</strong> {v?.memo || '공장'} / {v?.contact || '-'}</div>
                      </>
                    );
                  })()}
                </div>

                {/* 해당 외주업체 정비 리스트 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>수리완료 회수 대상 자산 선택 (전부 또는 일부) *</label>
                    <button
                      type="button"
                      onClick={handleSelectAllMaintAssets}
                      style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      전체선택 / 해제
                    </button>
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-app)' }}>
                    {repairsAtSelectedVendor.map(r => {
                      const asset = r.assetId ? assetMap.get(r.assetId) : undefined;
                      if (!asset) return null;
                      return (
                        <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={selectedRepairIdSet.has(r.id)}
                            onChange={() => handleMaintAssetCheckboxChange(r.id)}
                          />
                          <span>
                            <strong>{asset.assetNo}</strong> {asset.modelName} (수리의뢰내역: {r.details || '내용없음'})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 일정 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>회수 예정일자 *</label>
                    <input
                      type="date"
                      value={maintReturnDate}
                      onChange={e => setMaintReturnDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>상차 희망시간</label>
                    <div style={{ display: 'flex', gap: '6px', position: 'relative', height: '38px' }}>
                      <select
                        value={maintLoadingTime}
                        onChange={e => {
                          setMaintLoadingTime(e.target.value);
                          (e.target as HTMLSelectElement).blur();
                        }}
                        onFocus={e => { (e.target as HTMLSelectElement).size = 10; }}
                        onBlur={e => { (e.target as HTMLSelectElement).size = 1; }}
                        style={{
                          flex: 1,
                          position: 'absolute',
                          width: '100%',
                          zIndex: 30,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                      >
                        <option value="오전">오전</option>
                        <option value="오후">오후</option>
                        <option value="수시">수시</option>
                        <option value="06시">06시</option>
                        <option value="07시">07시</option>
                        <option value="08시">08시</option>
                        <option value="09시">09시</option>
                        <option value="10시">10시</option>
                        <option value="11시">11시</option>
                        <option value="12시">12시</option>
                        <option value="13시">13시</option>
                        <option value="14시">14시</option>
                        <option value="15시">15시</option>
                        <option value="16시">16시</option>
                        <option value="17시">17시</option>
                        <option value="18시">18시</option>
                        <option value="19시">19시</option>
                        <option value="20시">20시</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 비고 */}
                <div>
                  <label>인수 특이사항</label>
                  <textarea
                    rows={3}
                    placeholder="수리 완료 부품 확인 필요, 또는 물류 기사 사전 인수 통화 요청..."
                    value={maintNote}
                    onChange={e => setMaintNote(e.target.value)}
                  />
                </div>

                <button
                  data-mid="smart_return-maint-submit-btn"
                  type="submit"
                  className="btn-success"
                  style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 'bold' }}
                  disabled={!canSave || selectedRepairIds.length === 0}
                >
                  <Check size={16} /> 외주정비 회수 요청 생성
                </button>

              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '360px', color: 'var(--text-muted)' }}>
                <AlertTriangle size={48} style={{ strokeWidth: 1.2, marginBottom: '12px' }} />
                <span>왼쪽 외주업체 목록에서 회수 대상을 선택해 주세요.</span>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
