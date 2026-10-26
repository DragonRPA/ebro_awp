import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Truck,
  Phone,
  Navigation,
  Check,
  Search,
  Copy,
  X,
  Plus,
  Send,
  MessageSquare,
  Printer,
  Sun,
  Link2,
  RotateCcw,
} from 'lucide-react';
import {
  db,
  Delivery,
  Asset,
  Contract,
  ContractAsset,
  ContractHistory,
  TransportDriver,
  isCustomerRestricted,
} from '../../services/db';
import {
  buildDispatchSmsText,
  launchDispatchSms,
  buildDispatchKakaoTalkText,
  DispatchBundleStopParam,
  copyToClipboard,
  sanitizeDispatcherSpecialNote,
  resolveDispatchStaffContact,
} from '../../utils/nativeLauncher';
import { parseDispatchDriverCallTranscript } from '../../services/voiceOrderDraftService';
import { broadcastWorkNotification } from '../../utils/workNotificationService';
import { issueHandoverTask, clearHandoverTasks } from '../../utils/taskHandoverPipeline';
import { jobNotificationService } from '../../services/jobNotificationService';
import { createHangulMatcher } from '../../utils/hangulSearch';
import { canViewUnitPrice } from '../../utils/userDepartmentHelper';
import { DestinationWeatherModal } from '../../components/DestinationWeatherModal';
import {
  CUSTOMER_DIRECT_TRANSPORT,
  DispatchCategoryType,
  CATEGORY_QUICK_OPTIONS,
  AssignedVehicleRow,
  getNormalizedDeliveryStatus,
  getOriginalDeliveryCategoryLabel,
  getDeliveryCategoryLabel,
  getEffectiveDeliveryCost,
  parseCargoItems,
  extractReturnAssetIdsFromDelivery,
  findSubleaseVendorForAsset,
  checkDeliveryOutboundReadiness,
  getDateOffsetStr,
} from '../components/MobileDispatchHelpers';
import { MobileDispatchStudioSheet } from '../components/MobileDispatchStudioSheet';
import {
  MobileDispatchManualModal,
  ManualDispatchSubmitPayload,
} from '../components/MobileDispatchManualModal';

export const MobileDispatchList: React.FC = () => {
  const {
    deliveries,
    contracts,
    customers,
    sites,
    assets,
    products,
    vendors,
    contacts,
    users,
    departments,
    contractAssets,
    outboundInspections,
    transportCompanies,
    transportDrivers,
    printQueue,
    printStations,
    enqueuePrintJob,
    completeDelivery,
    returnRentedAsset,
    refreshAllData,
    currentUser,
    currentTenant,
    hasPermission,
    showErrorModal,
    navigationPayload,
    setNavigationPayload,
  } = useApp();

  const canSave = hasPermission ? hasPermission('delivery', 'save') : true;
  const canViewCost = useMemo(
    () => canViewUnitPrice(currentUser, departments),
    [currentUser, departments]
  );

  // Maps for fast lookup
  const contractMap = useMemo(
    () => new Map((contracts || []).map((c) => [c.id, c])),
    [contracts]
  );
  const customerMap = useMemo(
    () => new Map((customers || []).map((c) => [c.id, c])),
    [customers]
  );
  const siteMap = useMemo(() => new Map((sites || []).map((s) => [s.id, s])), [sites]);
  const assetMap = useMemo(() => new Map((assets || []).map((a) => [a.id, a])), [assets]);

  // Filter states (Quick Buttons)
  const [statusTab, setStatusTab] = useState<'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED' | 'ALL'>('PENDING');
  const [dateQuick, setDateQuick] = useState<'TODAY' | 'TOMORROW' | 'WEEK' | 'MONTH' | 'ALL'>('ALL');
  const [categoryQuick, setCategoryQuick] = useState<'ALL' | DispatchCategoryType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Bundling multi-select mode
  const [bundleMode, setBundleMode] = useState<boolean>(false);
  const [selectedBundleIds, setSelectedBundleIds] = useState<string[]>([]);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  // Studio Modal state
  const [studioOpen, setStudioOpen] = useState<boolean>(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [dispatchCategory, setDispatchCategory] = useState<DispatchCategoryType>('출고');
  const [loadingDate, setLoadingDate] = useState<string>(getDateOffsetStr(0));
  const [loadingTimeSlot, setLoadingTimeSlot] = useState<string>('오전');
  const [unloadingDate, setUnloadingDate] = useState<string>(getDateOffsetStr(0));
  const [unloadingTimeSlot, setUnloadingTimeSlot] = useState<string>('오전');
  const [originAddress, setOriginAddress] = useState<string>('당사 보관소');
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [closingMemo, setClosingMemo] = useState<string>('');
  const [billableToCust, setBillableToCust] = useState<boolean>(false);
  const [billableCustId, setBillableCustId] = useState<string>('');
  const [assignedVehicles, setAssignedVehicles] = useState<AssignedVehicleRow[]>([]);
  const [selectedReturnAssetIds, setSelectedReturnAssetIds] = useState<string[]>([]);
  const [isSavingDispatch, setIsSavingDispatch] = useState<boolean>(false);

  // Manual Creation Modal state
  const [manualModalOpen, setManualModalOpen] = useState<boolean>(false);

  // Weather & Nav & Kakao Modals
  const [weatherTarget, setWeatherTarget] = useState<{ address: string; title?: string } | null>(null);
  const [navTargetAddress, setNavTargetAddress] = useState<string | null>(null);
  const [kakaoModalData, setKakaoModalData] = useState<{ text: string; delivery: Delivery } | null>(null);

  // Voice Recognition
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Available sublease assets for RETURN
  const availableReturnAssets = useMemo(() => {
    const selectedSet = new Set(selectedReturnAssetIds);
    return (assets || []).filter(
      (a) =>
        a.ownerType === 'RENTED' &&
        (selectedSet.has(a.id) || (a.status !== 'RENTED_RETURNED' && !a.actualRentReturnDate))
    );
  }, [assets, selectedReturnAssetIds]);

  const getCustomerNameForDelivery = (d: Delivery): string => {
    const ct = d.contractId ? contractMap.get(d.contractId) : undefined;
    const cust = ct?.customerId
      ? customerMap.get(ct.customerId)
      : d.billableCustomerId
      ? customerMap.get(d.billableCustomerId)
      : undefined;
    const site = ct?.siteId ? siteMap.get(ct.siteId) : undefined;
    if (cust && site) return `${cust.name} · ${site.name}`;
    if (cust) return cust.name;
    if (site) return site.name;
    return d.destinationAddress || '현장';
  };

  const getHqYardOriginInfo = (deliv?: Delivery | null) => {
    const tenantAddr =
      (currentTenant as any)?.yardAddress ||
      (currentTenant as any)?.address ||
      '경기도 화성시 남양읍 주석로 180번길 53';
    const staff = resolveDispatchStaffContact({
      delivery: deliv || null,
      currentUser,
      users,
      contracts,
      currentTenant,
    });
    return {
      address: tenantAddr,
      contactName: staff.name,
      contactPhone: staff.phone,
    };
  };

  const getBundleGroupDeliveries = (bundleGroupId?: string | null): Delivery[] => {
    if (!bundleGroupId) return [];
    return (deliveries || [])
      .filter((d) => d.bundleGroupId === bundleGroupId)
      .sort(
        (a, b) =>
          (a.bundleOrder || 999) - (b.bundleOrder || 999) ||
          (a.id || '').localeCompare(b.id || '')
      );
  };

  // Select delivery and populate studio state
  const handleSelectDelivery = (d: Delivery, openSheet = true) => {
    const todayStr = getDateOffsetStr(0);
    setSelectedDelivery(d);
    const cat: DispatchCategoryType =
      d.bundleGroupId || d.dispatchCategory === '경유/합짐'
        ? '경유/합짐'
        : getOriginalDeliveryCategoryLabel(d);
    setDispatchCategory(cat);
    setSelectedReturnAssetIds(extractReturnAssetIdsFromDelivery(d));

    setLoadingDate(d.loadingDate || d.scheduledDate || d.requestDate || todayStr);
    setLoadingTimeSlot(d.loadingTimeSlot || '오전');
    setUnloadingDate(d.unloadingDate || d.loadingDate || d.scheduledDate || todayStr);
    setUnloadingTimeSlot(d.unloadingTimeSlot || '오전');
    setClosingMemo(sanitizeDispatcherSpecialNote(d.closingMemo));
    setOriginAddress(d.originAddress || '당사 보관소');

    const ct = d.contractId ? contractMap.get(d.contractId) : undefined;
    const cust = ct?.customerId ? customerMap.get(ct.customerId) : undefined;
    const site = ct?.siteId ? siteMap.get(ct.siteId) : undefined;
    setDestinationAddress(
      d.destinationAddress || site?.address || site?.name || (cust ? `${cust.name} 현장` : '')
    );
    setBillableToCust(Boolean(d.billableToCustomer));
    setBillableCustId(d.billableCustomerId || ct?.customerId || '');

    const costSource = d.bundleGroupId
      ? getBundleGroupDeliveries(d.bundleGroupId)[0] || d
      : d;

    let loadedVehicles: AssignedVehicleRow[] | null = null;
    if (costSource.vehicles) {
      try {
        const parsed = JSON.parse(costSource.vehicles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedVehicles = parsed.map((row: any, idx: number) => {
            const rExp = Number(row.expectedCost) || 0;
            const rFin = Number(row.finalCost) || 0;
            const dExp = idx === 0 ? Number(costSource.expectedCost) || 0 : 0;
            const dFin = idx === 0 ? Number(costSource.finalCost) || 0 : 0;
            const dCost = idx === 0 ? Number(costSource.deliveryCost) || 0 : 0;
            return {
              id: row.id || `v-${Date.now()}-${idx}`,
              transportCompany: row.transportCompany || '',
              vehicleType: row.vehicleType || '3.5T',
              vehicleNo: row.vehicleNo || '',
              driverName: row.driverName || '',
              driverContact: row.driverContact || '',
              expectedCost: rExp > 0 ? rExp : dExp,
              finalCost: rFin > 0 ? rFin : dFin > 0 ? dFin : dCost,
              deliveryCost: (rFin > 0 ? rFin : dFin) || (rExp > 0 ? rExp : dExp) || dCost || 0,
            };
          });
        }
      } catch {}
    }

    if (!loadedVehicles) {
      const effCost = getEffectiveDeliveryCost(costSource);
      loadedVehicles = [
        {
          id: `v-${Date.now()}`,
          transportCompany: costSource.transportCompany || d.transportCompany || '',
          vehicleType: costSource.vehicleType || d.vehicleType || '3.5T',
          vehicleNo: costSource.vehicleNo || d.vehicleNo || '',
          driverName: costSource.driverName || d.driverName || '',
          driverContact: costSource.driverContact || d.driverContact || '',
          expectedCost: effCost,
          finalCost:
            costSource.finalCost !== undefined && costSource.finalCost !== null
              ? Number(costSource.finalCost)
              : effCost,
          deliveryCost: effCost,
        },
      ];
    }

    setAssignedVehicles(loadedVehicles);
    if (openSheet) setStudioOpen(true);
  };

  // Deep-link from ToDo / Notification
  useEffect(() => {
    if (!navigationPayload || !deliveries || deliveries.length === 0) return;
    const targetDelivId =
      navigationPayload.deliveryId ||
      (navigationPayload.entityType === 'DELIVERY' ? navigationPayload.entityId : '');
    const targetContractId =
      navigationPayload.contractId ||
      (navigationPayload.entityType === 'CONTRACT' ? navigationPayload.entityId : '');
    if (!targetDelivId && !targetContractId) return;

    let matched = targetDelivId
      ? deliveries.find((d) => d.id === targetDelivId)
      : undefined;
    if (!matched && targetContractId) {
      const cDelivs = deliveries
        .filter((d) => d.contractId === targetContractId && d.status !== 'CANCELLED')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      matched =
        cDelivs.find((d) => getNormalizedDeliveryStatus(d) === 'PENDING') ||
        cDelivs.find((d) => getNormalizedDeliveryStatus(d) === 'DISPATCHED') ||
        cDelivs[0];
    }
    if (matched) {
      setStatusTab(getNormalizedDeliveryStatus(matched));
      setDateQuick('ALL');
      setCategoryQuick('ALL');
      handleSelectDelivery(matched, true);
    }
    if (setNavigationPayload) setNavigationPayload(null);
  }, [navigationPayload, deliveries]);

  // Status counts
  const statusCounts = useMemo(() => {
    let pending = 0;
    let dispatched = 0;
    let delivered = 0;
    let cancelled = 0;
    for (const d of deliveries || []) {
      const st = getNormalizedDeliveryStatus(d);
      if (st === 'PENDING') pending++;
      else if (st === 'DISPATCHED') dispatched++;
      else if (st === 'DELIVERED') delivered++;
      else if (st === 'CANCELLED') cancelled++;
    }
    return {
      pending,
      dispatched,
      delivered,
      cancelled,
      all: (deliveries || []).length,
    };
  }, [deliveries]);

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    const todayStr = getDateOffsetStr(0);
    const tomorrowStr = getDateOffsetStr(1);
    const weekEndStr = getDateOffsetStr(7);
    const monthEndStr = getDateOffsetStr(30);

    const q = searchQuery.trim();
    const qLower = q.toLowerCase();
    const matcher = q ? createHangulMatcher(q) : null;

    const list = (deliveries || []).filter((d) => {
      const dStatus = getNormalizedDeliveryStatus(d);
      if (statusTab !== 'ALL' && dStatus !== statusTab) return false;

      const dCat = getDeliveryCategoryLabel(d);
      const origCat = getOriginalDeliveryCategoryLabel(d);
      if (categoryQuick !== 'ALL' && dCat !== categoryQuick && origCat !== categoryQuick) {
        return false;
      }

      const dDate = (
        d.loadingDate ||
        d.requestDate ||
        d.scheduledDate ||
        d.createdAt?.substring(0, 10) ||
        ''
      ).slice(0, 10);

      if (dateQuick === 'TODAY' && dDate !== todayStr) return false;
      if (dateQuick === 'TOMORROW' && dDate !== tomorrowStr) return false;
      if (dateQuick === 'WEEK' && (dDate < todayStr || dDate > weekEndStr)) return false;
      if (dateQuick === 'MONTH' && (dDate < todayStr || dDate > monthEndStr)) return false;

      if (!matcher) return true;
      const ct = d.contractId ? contractMap.get(d.contractId) : undefined;
      const cust = ct?.customerId ? customerMap.get(ct.customerId) : undefined;
      const site = ct?.siteId ? siteMap.get(ct.siteId) : undefined;

      return Boolean(
        (d.id && d.id.toLowerCase().includes(qLower)) ||
          (d.bundleGroupId && d.bundleGroupId.toLowerCase().includes(qLower)) ||
          (d.driverName && matcher(d.driverName)) ||
          (d.vehicleNo && d.vehicleNo.toLowerCase().includes(qLower)) ||
          (d.transportCompany && matcher(d.transportCompany)) ||
          (d.destinationAddress && matcher(d.destinationAddress)) ||
          (cust?.name && matcher(cust.name)) ||
          (site?.name && matcher(site.name))
      );
    });

    const bundleGroupMaxTime = new Map<string, number>();
    for (const d of list) {
      if (d.bundleGroupId) {
        const t = d.createdAt ? new Date(d.createdAt).getTime() : 0;
        const cur = bundleGroupMaxTime.get(d.bundleGroupId) ?? -Infinity;
        if (t > cur) bundleGroupMaxTime.set(d.bundleGroupId, t);
      }
    }

    return list.sort((a, b) => {
      if (a.bundleGroupId && b.bundleGroupId && a.bundleGroupId === b.bundleGroupId) {
        return (
          (a.bundleOrder || 999) - (b.bundleOrder || 999) ||
          (a.id || '').localeCompare(b.id || '')
        );
      }
      const timeA = a.bundleGroupId
        ? bundleGroupMaxTime.get(a.bundleGroupId) || 0
        : a.createdAt
        ? new Date(a.createdAt).getTime()
        : 0;
      const timeB = b.bundleGroupId
        ? bundleGroupMaxTime.get(b.bundleGroupId) || 0
        : b.createdAt
        ? new Date(b.createdAt).getTime()
        : 0;
      if (timeA !== timeB) return timeB - timeA;
      const dateA = a.loadingDate || a.requestDate || '';
      const dateB = b.loadingDate || b.requestDate || '';
      return dateB.localeCompare(dateA);
    });
  }, [deliveries, statusTab, dateQuick, categoryQuick, searchQuery, contractMap, customerMap, siteMap]);

  // Vehicle field handlers
  const handleVehicleFieldChange = (
    index: number,
    field: keyof AssignedVehicleRow,
    value: any
  ) => {
    setAssignedVehicles((prev) => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      let sanitized = value;
      if (field === 'expectedCost' || field === 'finalCost' || field === 'deliveryCost') {
        sanitized = Math.max(0, Number(value) || 0);
      }
      updated[index] = { ...updated[index], [field]: sanitized };

      if (field === 'expectedCost') {
        const curFin = Number(updated[index].finalCost) || 0;
        if (curFin <= 0) updated[index].deliveryCost = sanitized;
      } else if (field === 'finalCost') {
        const curExp = Number(updated[index].expectedCost) || 0;
        updated[index].deliveryCost = sanitized > 0 ? sanitized : curExp;
      }

      if (
        field === 'transportCompany' &&
        String(value || '').trim() === CUSTOMER_DIRECT_TRANSPORT
      ) {
        updated[index].expectedCost = 0;
        updated[index].finalCost = 0;
        updated[index].deliveryCost = 0;
        if (!updated[index].driverName || !updated[index].driverName.trim()) {
          updated[index].driverName = CUSTOMER_DIRECT_TRANSPORT;
        }
      }
      return updated;
    });
  };

  const handleSelectDriverQuick = (index: number, drv: TransportDriver) => {
    setAssignedVehicles((prev) => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      const comp = (transportCompanies || []).find((c) => c.id === drv.companyId);
      updated[index] = {
        ...updated[index],
        driverName: drv.driverName || updated[index].driverName,
        driverContact: drv.driverContact || updated[index].driverContact,
        vehicleNo: drv.vehicleNo || updated[index].vehicleNo,
        vehicleType: drv.vehicleType || updated[index].vehicleType || '3.5T',
        transportCompany: comp?.name || updated[index].transportCompany,
      };
      return updated;
    });
  };

  const handleAddVehicleRow = () => {
    setAssignedVehicles((prev) => [
      ...prev,
      {
        id: `v-${Date.now()}-${prev.length}`,
        transportCompany: '',
        vehicleType: '3.5T',
        vehicleNo: '',
        driverName: '',
        driverContact: '',
        expectedCost: 0,
        finalCost: 0,
        deliveryCost: 0,
      },
    ]);
  };

  const handleRemoveVehicleRow = (index: number) => {
    setAssignedVehicles((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleToggleReturnAsset = (asset: Asset) => {
    setSelectedReturnAssetIds((prev) => {
      const exists = prev.includes(asset.id);
      const next = exists ? prev.filter((id) => id !== asset.id) : [...prev, asset.id];
      if (!exists) {
        const vendor = findSubleaseVendorForAsset(asset, vendors, destinationAddress);
        const autoDest = vendor?.address || vendor?.name || asset.renter || '';
        if (autoDest) setDestinationAddress(autoDest);
      }
      return next;
    });
  };

  // Voice & Transcript Parsing
  const handleApplyDriverTranscript = (rawText: string, vehicleIdx = 0) => {
    if (!rawText.trim()) return;
    const parsed = parseDispatchDriverCallTranscript(rawText, deliveries || []);
    setAssignedVehicles((prev) => {
      const updated = [...prev];
      const target = updated[vehicleIdx] || updated[0];
      if (!target) return prev;
      updated[vehicleIdx] = {
        ...target,
        vehicleNo: parsed.vehicleNo || target.vehicleNo,
        vehicleType: parsed.vehicleType || target.vehicleType,
        driverName: parsed.driverName || target.driverName,
        driverContact: parsed.driverContact || target.driverContact,
        expectedCost:
          parsed.finalCost !== undefined && parsed.finalCost > 0
            ? parsed.finalCost
            : target.expectedCost,
        finalCost:
          parsed.finalCost !== undefined && parsed.finalCost > 0
            ? parsed.finalCost
            : target.finalCost,
        deliveryCost:
          parsed.finalCost !== undefined && parsed.finalCost > 0
            ? parsed.finalCost
            : target.deliveryCost,
      };
      return updated;
    });
    showToast('기사 정보 자동 입력 완료');
  };

  const handleToggleVoiceRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showErrorModal('브라우저가 음성 인식을 지원하지 않습니다.');
      return;
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) handleApplyDriverTranscript(transcript, 0);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  // Bundle stops builder for SMS / Kakao
  const buildBundleStopsForDelivery = (
    targetDelivery: Delivery
  ): DispatchBundleStopParam[] | undefined => {
    if (!targetDelivery.bundleGroupId) return undefined;
    const groupItems = getBundleGroupDeliveries(targetDelivery.bundleGroupId);
    if (groupItems.length < 2) return undefined;

    return groupItems.map((item, idx) => {
      const isSelected = selectedDelivery?.id === item.id;
      const itemContract = item.contractId ? contractMap.get(item.contractId) : undefined;
      const itemCustomer = itemContract?.customerId
        ? customerMap.get(itemContract.customerId)
        : item.billableCustomerId
        ? customerMap.get(item.billableCustomerId)
        : undefined;
      const itemSite = itemContract?.siteId ? siteMap.get(itemContract.siteId) : undefined;
      const origCat = getOriginalDeliveryCategoryLabel(item);

      const effectiveItem: Delivery = isSelected
        ? {
            ...item,
            originAddress: originAddress || item.originAddress,
            destinationAddress: destinationAddress || item.destinationAddress,
            loadingDate: loadingDate || item.loadingDate,
            loadingTimeSlot: loadingTimeSlot || item.loadingTimeSlot,
            unloadingDate: unloadingDate || item.unloadingDate,
            unloadingTimeSlot: unloadingTimeSlot || item.unloadingTimeSlot,
            closingMemo: sanitizeDispatcherSpecialNote(closingMemo),
          }
        : item;

      const parsedCargos = parseCargoItems(effectiveItem).filter(
        (p) => p.modelName && !p.modelName.includes('미지정')
      );
      const cargoFormatted = parsedCargos.map((p) => `${p.modelName}*${p.count}`).join(' / ');
      const actContacts = (itemSite?.contacts || []).filter(
        (c) => c.isActive !== false && c.name && c.name !== '미상'
      );

      return {
        order: item.bundleOrder || idx + 1,
        delivery: effectiveItem,
        originalCategoryLabel: origCat,
        siteName: itemSite?.name || effectiveItem.destinationAddress || '현장',
        siteAddress: effectiveItem.destinationAddress || itemSite?.address,
        siteContactName: actContacts[0]?.name || itemSite?.contactName,
        siteContactPhone: actContacts[0]?.contact || itemSite?.contact,
        siteContactPosition: actContacts[0]?.position,
        customerName: itemCustomer?.name,
        cargoFormattedString: cargoFormatted,
        dispatcherNote: sanitizeDispatcherSpecialNote(effectiveItem.closingMemo),
      };
    });
  };

  // SMS Dispatch Launch
  const handleSendDriverSms = (targetDelivery: Delivery, overrideVeh?: AssignedVehicleRow) => {
    const isCurrent = selectedDelivery?.id === targetDelivery.id;
    const mainVeh =
      overrideVeh ||
      (isCurrent
        ? assignedVehicles.find((v) => v.driverContact && v.driverContact.trim()) ||
          assignedVehicles[0]
        : undefined);
    const contact = mainVeh?.driverContact || targetDelivery.driverContact;
    const name = mainVeh?.driverName || targetDelivery.driverName;
    const vNo = mainVeh?.vehicleNo || targetDelivery.vehicleNo;
    const vType = mainVeh?.vehicleType || targetDelivery.vehicleType;
    const cost =
      (mainVeh?.finalCost && mainVeh.finalCost > 0
        ? mainVeh.finalCost
        : mainVeh?.expectedCost) ||
      targetDelivery.finalCost ||
      targetDelivery.deliveryCost;

    if (!contact || !contact.trim()) {
      showErrorModal('기사 연락처를 입력해 주세요.');
      return;
    }

    const ct = targetDelivery.contractId ? contractMap.get(targetDelivery.contractId) : undefined;
    const customer = ct?.customerId
      ? customerMap.get(ct.customerId)
      : targetDelivery.billableCustomerId
      ? customerMap.get(targetDelivery.billableCustomerId)
      : undefined;
    const site = ct?.siteId ? siteMap.get(ct.siteId) : undefined;
    const actContacts = (site?.contacts || []).filter(
      (c) => c.isActive !== false && c.name && c.name !== '미상'
    );

    const dObj: Delivery = {
      ...targetDelivery,
      driverName: name,
      driverContact: contact,
      vehicleNo: vNo,
      vehicleType: vType,
      finalCost: cost,
      destinationAddress: isCurrent
        ? destinationAddress || targetDelivery.destinationAddress
        : targetDelivery.destinationAddress,
      originAddress: isCurrent
        ? originAddress || targetDelivery.originAddress
        : targetDelivery.originAddress,
      loadingDate: isCurrent
        ? loadingDate || targetDelivery.loadingDate
        : targetDelivery.loadingDate,
      loadingTimeSlot: isCurrent
        ? loadingTimeSlot || targetDelivery.loadingTimeSlot
        : targetDelivery.loadingTimeSlot,
      closingMemo: sanitizeDispatcherSpecialNote(
        isCurrent ? closingMemo : targetDelivery.closingMemo
      ),
    };

    const hqInfo = getHqYardOriginInfo(dObj);
    const companyName =
      currentTenant?.displayName ||
      currentTenant?.tradeName ||
      currentTenant?.corporateName ||
      '기연리프트';

    const smsBody = buildDispatchSmsText({
      delivery: dObj,
      siteName: site?.name || dObj.destinationAddress,
      siteAddress: dObj.destinationAddress || site?.address,
      siteContactName: actContacts[0]?.name || site?.contactName,
      siteContactPhone: actContacts[0]?.contact || site?.contact,
      customerName: customer?.name,
      companyName,
      hqYardAddress: hqInfo.address,
      hqYardPhone: hqInfo.contactPhone,
      hqYardContactPerson: hqInfo.contactName,
      bundleStops: buildBundleStopsForDelivery(targetDelivery),
    });

    launchDispatchSms({ driverContact: contact, smsBody });
  };

  // Kakao Dispatch Message Copy
  const handleCopyKakaoDispatchMessage = async (targetDelivery: Delivery) => {
    const isCurrent = selectedDelivery?.id === targetDelivery.id;
    const ct = targetDelivery.contractId ? contractMap.get(targetDelivery.contractId) : undefined;
    const customer = ct?.customerId ? customerMap.get(ct.customerId) : undefined;
    const site = ct?.siteId ? siteMap.get(ct.siteId) : undefined;
    const actContacts = (site?.contacts || []).filter(
      (c) => c.isActive !== false && c.name && c.name !== '미상'
    );

    const dObj: Delivery = {
      ...targetDelivery,
      dispatchCategory: isCurrent
        ? dispatchCategory || targetDelivery.dispatchCategory
        : targetDelivery.dispatchCategory,
      vehicleType: isCurrent
        ? assignedVehicles[0]?.vehicleType || targetDelivery.vehicleType
        : targetDelivery.vehicleType,
      originAddress: isCurrent
        ? originAddress || targetDelivery.originAddress
        : targetDelivery.originAddress,
      destinationAddress: isCurrent
        ? destinationAddress || targetDelivery.destinationAddress
        : targetDelivery.destinationAddress,
      loadingDate: isCurrent
        ? loadingDate || targetDelivery.loadingDate
        : targetDelivery.loadingDate,
      loadingTimeSlot: isCurrent
        ? loadingTimeSlot || targetDelivery.loadingTimeSlot
        : targetDelivery.loadingTimeSlot,
      unloadingDate: isCurrent
        ? unloadingDate || targetDelivery.unloadingDate
        : targetDelivery.unloadingDate,
      unloadingTimeSlot: isCurrent
        ? unloadingTimeSlot || targetDelivery.unloadingTimeSlot
        : targetDelivery.unloadingTimeSlot,
      closingMemo: sanitizeDispatcherSpecialNote(
        isCurrent ? closingMemo : targetDelivery.closingMemo
      ),
    };

    const parsedCargos = parseCargoItems(dObj).filter(
      (p) => p.modelName && !p.modelName.includes('미지정')
    );
    const cargoFormatted = parsedCargos.map((p) => `${p.modelName}*${p.count}`).join(' / ');
    const hqInfo = getHqYardOriginInfo(dObj);

    const text = buildDispatchKakaoTalkText({
      delivery: dObj,
      siteName: site?.name || dObj.destinationAddress || '현장',
      siteAddress: dObj.destinationAddress || site?.address,
      siteContactName: actContacts[0]?.name || site?.contactName,
      siteContactPhone: actContacts[0]?.contact || site?.contact,
      siteContactPosition: actContacts[0]?.position,
      customerName: customer?.name,
      companyName:
        currentTenant?.displayName ||
        currentTenant?.tradeName ||
        currentTenant?.corporateName ||
        '기연리프트',
      hqYardAddress: hqInfo.address,
      hqYardPhone: hqInfo.contactPhone,
      hqYardContactPerson: hqInfo.contactName,
      cargoFormattedString: cargoFormatted,
      dispatcherNote: dObj.closingMemo,
      bundleStops: buildBundleStopsForDelivery(targetDelivery),
    });

    await copyToClipboard(text);
    setKakaoModalData({ text, delivery: targetDelivery });
    showToast('카카오톡 배차 안내문 복사 완료');
  };

  // Driver Portal Link Copy
  const handleCopyDriverPortalUrl = async (d: Delivery) => {
    const portalUrl = `${window.location.origin}/driver-portal?deliveryId=${encodeURIComponent(d.id)}`;
    await copyToClipboard(portalUrl);
    showToast('기사 포털 링크 복사 완료');
  };

  // Remote Print Queue (`출고요청서` / `입고요청서`)
  const handleRemotePrint = async (d: Delivery, forceDocType?: 'OUTBOUND' | 'INBOUND') => {
    const origCat = getOriginalDeliveryCategoryLabel(d);
    const isInbound =
      forceDocType === 'INBOUND' ||
      (!forceDocType && (d.type === 'INBOUND' || origCat === '입고'));
    const targetDocType = isInbound ? 'RETURN_ORDER' : 'DISPATCH_ORDER';
    const labelName = isInbound ? '입고요청서' : '출고요청서';

    const ct = d.contractId ? contractMap.get(d.contractId) : undefined;
    const cust = ct?.customerId ? customerMap.get(ct.customerId) : undefined;
    const site = ct?.siteId ? siteMap.get(ct.siteId) : undefined;
    const cargos = parseCargoItems(d);
    const cargoSummary = cargos.map((c) => `${c.modelName} x ${c.count}대`).join(', ');

    const targetStation =
      (printStations || []).find((s) => s.docTypeDefault === targetDocType) ||
      (printStations || [])[0];
    const docNo = ct?.contractNo || d.id;
    const docTitle = `${labelName}_${cust?.name || '고객사'}_${site?.name || d.id}`;
    const simpleHtml = `<html><body style="font-family:sans-serif;padding:16px;"><h2>${labelName} (${docNo})</h2><p>고객사: ${cust?.name || '-'} / 현장: ${site?.name || d.destinationAddress || '-'}</p><p>일정: ${d.loadingDate || ''} (${d.loadingTimeSlot || '오전'}) ➔ ${d.unloadingDate || ''} (${d.unloadingTimeSlot || '오전'})</p><p>장비: ${cargoSummary}</p><p>기사: ${d.driverName || '-'} (${d.vehicleNo || '-'} / ${d.driverContact || '-'})</p><p>메모: ${d.closingMemo || d.memo || '-'}</p></body></html>`;

    try {
      await enqueuePrintJob({
        stationId: targetStation?.id,
        docType: targetDocType,
        docNo,
        title: docTitle,
        documentHtml: simpleHtml,
        requestedById: currentUser?.id,
        requestedByName: currentUser?.name,
      });
      showToast(`${labelName} 인쇄 큐 전송 완료`);
    } catch (err: any) {
      showErrorModal(`인쇄 전송 실패: ${err?.message || err}`);
    }
  };

  // 1-Tap Customer Direct Transport Quick Action on Card
  const handleQuickCustomerDirect = async (d: Delivery) => {
    if (!canSave) {
      showErrorModal('배차 수정 권한이 없습니다.');
      return;
    }
    try {
      const nowIso = new Date().toISOString();
      const directVeh: AssignedVehicleRow = {
        id: `v-${Date.now()}`,
        transportCompany: CUSTOMER_DIRECT_TRANSPORT,
        vehicleType: d.vehicleType || '3.5T',
        vehicleNo: CUSTOMER_DIRECT_TRANSPORT,
        driverName: CUSTOMER_DIRECT_TRANSPORT,
        driverContact: '',
        expectedCost: 0,
        finalCost: 0,
        deliveryCost: 0,
      };
      db.updateRow<Delivery>('deliveries', d.id, {
        status: 'DISPATCHED',
        transportCompany: CUSTOMER_DIRECT_TRANSPORT,
        driverName: CUSTOMER_DIRECT_TRANSPORT,
        vehicleNo: CUSTOMER_DIRECT_TRANSPORT,
        expectedCost: 0,
        finalCost: 0,
        deliveryCost: 0,
        deliveryCostConfirmed: 0,
        isCostSettled: true,
        reconciliationStatus: 'PAID',
        vehicles: JSON.stringify([directVeh]),
        updatedAt: nowIso,
      });
      await db.awaitPendingWrites();
      await clearHandoverTasks({
        entityId: d.id,
        category: 'DISPATCH_REQUEST',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name,
        completionAction: 'DISPATCH_ASSIGNED',
      });
      refreshAllData();
      showToast('고객직접운송 배차 확정 완료');
    } catch (err: any) {
      showErrorModal(`처리 실패: ${err?.message || err}`);
    }
  };

  // Save Dispatch (PC Mode 1:1 parity)
  const handleSaveDispatch = async (sendSmsAfter = false) => {
    if (isSavingDispatch || !selectedDelivery) return;
    if (!canSave) {
      showErrorModal('배차 수정 권한이 없습니다.');
      return;
    }
    if (loadingDate && unloadingDate && loadingDate > unloadingDate) {
      showErrorModal('상차일이 하차일보다 늦을 수 없습니다.');
      return;
    }

    const validDrivers = assignedVehicles.filter(
      (v) =>
        (v.driverName || '').trim() !== '' ||
        (v.transportCompany || '').trim() === CUSTOMER_DIRECT_TRANSPORT
    );
    const origCategory = getOriginalDeliveryCategoryLabel(selectedDelivery);
    const isReturnCategory =
      dispatchCategory === '반납' || origCategory === '반납' || selectedDelivery.type === 'RETURN';
    const prevStatus = getNormalizedDeliveryStatus(selectedDelivery);

    if (validDrivers.length === 0 && prevStatus !== 'DELIVERED' && !isReturnCategory) {
      showErrorModal('배차 기사를 선택/입력하거나 [고객직접운송]을 선택해 주세요.');
      return;
    }

    const targetContract = selectedDelivery.contractId
      ? contractMap.get(selectedDelivery.contractId)
      : undefined;
    const targetCustomer = targetContract?.customerId
      ? customerMap.get(targetContract.customerId)
      : undefined;
    const isOutboundOrExchange =
      selectedDelivery.type === 'OUTBOUND' || origCategory === '출고' || origCategory === '교환';
    if (
      prevStatus !== 'DELIVERED' &&
      isOutboundOrExchange &&
      isCustomerRestricted(targetCustomer?.transactionStatus)
    ) {
      showErrorModal(
        `[출고제한] 거래처 [${targetCustomer?.name}]은(는) 신규 출고가 차단된 상태입니다.`
      );
      return;
    }

    const effectiveReturnDate = unloadingDate || loadingDate || getDateOffsetStr(0);
    if (isReturnCategory && selectedReturnAssetIds.length > 0) {
      for (const assetId of selectedReturnAssetIds) {
        const targetAsset = assetMap.get(assetId);
        if (targetAsset && targetAsset.rentStart && effectiveReturnDate < targetAsset.rentStart) {
          showErrorModal(
            `임차자산 [${targetAsset.assetNo}] 반납일(${effectiveReturnDate})은 임차 시작일(${targetAsset.rentStart}) 이전일 수 없습니다.`
          );
          return;
        }
      }
    }

    const nextStatus: Delivery['status'] =
      prevStatus === 'DELIVERED'
        ? selectedDelivery.status === 'COMPLETED'
          ? 'COMPLETED'
          : 'DELIVERED'
        : validDrivers.length === 0 && prevStatus === 'PENDING' && isReturnCategory
        ? 'PENDING'
        : 'DISPATCHED';

    setIsSavingDispatch(true);
    try {
      const sanitizedVehicles = assignedVehicles.map((v) => {
        const isCustDirect = (v.transportCompany || '').trim() === CUSTOMER_DIRECT_TRANSPORT;
        const expCost = isCustDirect ? 0 : Math.max(0, Number(v.expectedCost) || 0);
        const finCost = isCustDirect ? 0 : Math.max(0, Number(v.finalCost) || 0);
        return {
          ...v,
          driverName:
            isCustDirect && !(v.driverName || '').trim()
              ? CUSTOMER_DIRECT_TRANSPORT
              : v.driverName,
          expectedCost: expCost,
          finalCost: finCost,
          deliveryCost: isCustDirect ? 0 : finCost > 0 ? finCost : expCost,
        };
      });

      const totalExpectedCost = sanitizedVehicles.reduce(
        (sum, v) => sum + (Number(v.expectedCost) || 0),
        0
      );
      const totalFinalCost = sanitizedVehicles.reduce(
        (sum, v) => sum + (Number(v.finalCost) || 0),
        0
      );
      const isAllCustDirect =
        sanitizedVehicles.length > 0 &&
        sanitizedVehicles.every(
          (v) => (v.transportCompany || '').trim() === CUSTOMER_DIRECT_TRANSPORT
        );

      const mainVeh = sanitizedVehicles[0] || ({} as AssignedVehicleRow);
      const selectedReturnAssets = isReturnCategory
        ? (selectedReturnAssetIds.map((id) => assetMap.get(id)).filter(Boolean) as Asset[])
        : [];
      const returnCargoJson = isReturnCategory
        ? JSON.stringify(
            selectedReturnAssets.map((a) => {
              const assetVendor = findSubleaseVendorForAsset(a, vendors, destinationAddress);
              return {
                modelName: `${a.modelName} (${a.assetNo})`,
                count: 1,
                returnAssetId: a.id,
                assetNo: a.assetNo,
                renter: assetVendor?.name || a.renter || '',
                vendorId: assetVendor?.id || a.vendorId || '',
                vendorName: assetVendor?.name || a.renter || '',
                vendorAddress: assetVendor?.address || '',
                vendorContactName: assetVendor?.contactName || '',
                vendorContactPhone: assetVendor?.contact || '',
              };
            })
          )
        : undefined;

      const bundleGroupItems = selectedDelivery.bundleGroupId
        ? getBundleGroupDeliveries(selectedDelivery.bundleGroupId)
        : [];
      const isBundledGroup = bundleGroupItems.length >= 2;
      const isPrimaryBundleStop =
        !isBundledGroup ||
        (selectedDelivery.bundleOrder || 1) === 1 ||
        bundleGroupItems[0]?.id === selectedDelivery.id;
      const zeroCostVehicles = sanitizedVehicles.map((v) => ({
        ...v,
        expectedCost: 0,
        finalCost: 0,
        deliveryCost: 0,
      }));

      const payload: Partial<Delivery> = {
        status: nextStatus,
        type: isReturnCategory ? 'RETURN' : selectedDelivery.type,
        dispatchCategory: isBundledGroup ? '경유/합짐' : dispatchCategory,
        loadingDate,
        loadingTimeSlot,
        unloadingDate,
        unloadingTimeSlot,
        scheduledDate: loadingDate,
        originAddress,
        destinationAddress,
        billableToCustomer: billableToCust,
        billableCustomerId: billableCustId,
        transportCompany: mainVeh.transportCompany || '',
        vehicleType: mainVeh.vehicleType || '3.5T',
        vehicleNo: mainVeh.vehicleNo || '',
        driverName: mainVeh.driverName || '',
        driverContact: mainVeh.driverContact || '',
        expectedCost: isAllCustDirect || !isPrimaryBundleStop ? 0 : totalExpectedCost,
        finalCost: isAllCustDirect || !isPrimaryBundleStop ? 0 : totalFinalCost,
        deliveryCost:
          isAllCustDirect || !isPrimaryBundleStop
            ? 0
            : totalFinalCost > 0
            ? totalFinalCost
            : totalExpectedCost,
        deliveryCostConfirmed:
          isAllCustDirect || !isPrimaryBundleStop
            ? 0
            : totalFinalCost > 0
            ? totalFinalCost
            : selectedDelivery.deliveryCostConfirmed,
        isCostSettled: isAllCustDirect ? true : selectedDelivery.isCostSettled,
        reconciliationStatus: isAllCustDirect
          ? 'PAID'
          : selectedDelivery.reconciliationStatus || 'PENDING',
        vehicles: JSON.stringify(isPrimaryBundleStop ? sanitizedVehicles : zeroCostVehicles),
        ...(returnCargoJson !== undefined ? { cargoItems: returnCargoJson } : {}),
        closingMemo: sanitizeDispatcherSpecialNote(closingMemo),
        updatedAt: new Date().toISOString(),
      };

      db.updateRow<Delivery>('deliveries', selectedDelivery.id, payload);

      // 출고/교환 하차일 변경 시 계약·청구 개시일 자동 동기화 (PC 모드 100% 동일)
      if (
        !isReturnCategory &&
        isOutboundOrExchange &&
        unloadingDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(unloadingDate) &&
        selectedDelivery.contractId
      ) {
        const prevUnloadDate = (
          selectedDelivery.unloadingDate ||
          selectedDelivery.loadingDate ||
          ''
        ).trim();
        const prevLoadDate = (selectedDelivery.loadingDate || '').trim();
        const targetCaIds = new Set<string>();
        try {
          if (selectedDelivery.cargoItems) {
            const raw = JSON.parse(selectedDelivery.cargoItems);
            if (Array.isArray(raw)) {
              raw.forEach((ci: any) => {
                if (Array.isArray(ci?.contractAssetIds)) {
                  ci.contractAssetIds.forEach((id: string) => id && targetCaIds.add(id));
                }
              });
            }
          }
        } catch {}

        db.outboundInspections
          .filter((ins) => ins.deliveryId === selectedDelivery.id && (ins as any).contractAssetId)
          .forEach((ins) => targetCaIds.add((ins as any).contractAssetId));

        if (targetCaIds.size === 0) {
          db.contractAssets
            .filter(
              (ca) =>
                ca.contractId === selectedDelivery.contractId &&
                ca.status !== 'RETURNED' &&
                ca.status !== 'SOLD' &&
                (!ca.startDate ||
                  ca.startDate === prevUnloadDate ||
                  ca.startDate === prevLoadDate ||
                  ca.startDate === loadingDate)
            )
            .forEach((ca) => targetCaIds.add(ca.id));
        }

        targetCaIds.forEach((caId) => {
          const caObj = db.contractAssets.find(
            (c) => c.id === caId && c.contractId === selectedDelivery.contractId
          );
          if (!caObj) return;
          const shouldSyncFirstStart =
            !caObj.firstStartDate ||
            caObj.firstStartDate === caObj.startDate ||
            caObj.firstStartDate === prevUnloadDate ||
            caObj.firstStartDate === prevLoadDate;
          db.updateRow<ContractAsset>('contractAssets', caObj.id, {
            startDate: unloadingDate,
            ...(shouldSyncFirstStart ? { firstStartDate: unloadingDate } : {}),
          });
          if (caObj.assetId) {
            db.updateRow<Asset>('assets', caObj.assetId, {
              contractStart: unloadingDate,
            });
          }
        });

        const parentContract = db.contracts.find((c) => c.id === selectedDelivery.contractId);
        if (parentContract && unloadingDate !== prevUnloadDate) {
          db.insertRow<ContractHistory>('contractHistory', {
            contractId: parentContract.id,
            changeType: 'FEE_CHANGE',
            changeDate: getDateOffsetStr(0),
            description: `[배차 일정 변경] 배차 ${selectedDelivery.id}: 하차일(계약개시일) [${prevUnloadDate || '-'} ➔ ${unloadingDate}] 동기화`,
            createdAt: new Date().toISOString(),
          });
        }
      }

      // 경유/합짐 형제 배차건 동기화
      if (isBundledGroup) {
        const primaryStopId = bundleGroupItems[0]?.id;
        for (const sibling of bundleGroupItems) {
          if (sibling.id === selectedDelivery.id) continue;
          const isSiblingPrimary = sibling.id === primaryStopId;
          const siblingNormSt = getNormalizedDeliveryStatus(sibling);
          db.updateRow<Delivery>('deliveries', sibling.id, {
            status: siblingNormSt === 'DELIVERED' ? sibling.status : nextStatus,
            dispatchCategory: '경유/합짐',
            dropoffType: 'MULTI_STOP',
            transportCompany: mainVeh.transportCompany || '',
            vehicleType: mainVeh.vehicleType || '3.5T',
            vehicleNo: mainVeh.vehicleNo || '',
            driverName: mainVeh.driverName || '',
            driverContact: mainVeh.driverContact || '',
            expectedCost: isAllCustDirect || !isSiblingPrimary ? 0 : totalExpectedCost,
            finalCost: isAllCustDirect || !isSiblingPrimary ? 0 : totalFinalCost,
            deliveryCost:
              isAllCustDirect || !isSiblingPrimary
                ? 0
                : totalFinalCost > 0
                ? totalFinalCost
                : totalExpectedCost,
            vehicles: JSON.stringify(isSiblingPrimary ? sanitizedVehicles : zeroCostVehicles),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      await db.awaitPendingWrites();

      // 반납 배차 시 선택된 임차자산 반납 처리
      if (isReturnCategory) {
        for (const assetId of selectedReturnAssetIds) {
          const targetAsset = assetMap.get(assetId);
          if (!targetAsset) continue;
          if (targetAsset.status !== 'RENTED_RETURNED' || !targetAsset.actualRentReturnDate) {
            await returnRentedAsset(assetId, effectiveReturnDate, {
              memo: `[임차자산 반납 배차] 배차ID: ${selectedDelivery.id} / 반납일: ${effectiveReturnDate}`,
            });
          }
        }
      }

      await clearHandoverTasks({
        entityId: selectedDelivery.id,
        category: 'DISPATCH_REQUEST',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name,
        completionAction: 'DISPATCH_ASSIGNED',
      });

      if (selectedDelivery.type === 'OUTBOUND' && prevStatus === 'PENDING') {
        await issueHandoverTask({
          category: 'OUTBOUND_PDI_INSPECTION',
          title: `[출고검수 요망] ${targetCustomer?.name || '고객사'} (${mainVeh.driverName || '기사'})`,
          content: `차량 배정 완료 (${mainVeh.driverName || '기사'}, ${mainVeh.vehicleNo || '차량번호'}). 상차 전 출고검수를 진행해 주십시오.`,
          targetDept: 'YARD',
          priority: 'HIGH',
          actionUrl: '/admin/outbound_inspections',
          entityType: 'DELIVERY',
          entityId: selectedDelivery.id,
          senderId: currentUser?.id,
          senderName: currentUser?.name,
        });
      }

      broadcastWorkNotification({
        type: 'DISPATCH',
        title: '배차 완료 안내',
        body: `${getCustomerNameForDelivery(selectedDelivery)} · ${mainVeh.driverName || '기사'} (${mainVeh.vehicleType || '차량'}) 배정 완료`,
        url: '/admin/dispatch',
        targetDepts: ['SALES', 'YARD', 'ADMIN', 'EXECUTIVE'],
      }).catch(console.warn);

      refreshAllData();
      const updatedObj: Delivery = { ...selectedDelivery, ...payload, status: nextStatus };
      setSelectedDelivery(updatedObj);
      setStudioOpen(false);
      showToast('배차 저장 완료');

      if (sendSmsAfter) {
        handleSendDriverSms(updatedObj, mainVeh);
      }
    } catch (err: any) {
      showErrorModal(`배차 저장 실패:\n${err?.message || err}`);
    } finally {
      setIsSavingDispatch(false);
    }
  };

  // 상차 완료 확정 (PC Mode `handleCompleteLoadingStatus` 1:1 parity)
  const handleCompleteLoadingStatus = async (deliveryId: string) => {
    if (!canSave) {
      showErrorModal('배차 권한이 없습니다.');
      return;
    }
    const targetDelivery = (deliveries || []).find((d) => d.id === deliveryId);
    if (!targetDelivery) return;

    const readiness = checkDeliveryOutboundReadiness(
      targetDelivery,
      contractAssets || [],
      outboundInspections || [],
      assetMap
    );
    if (readiness.isOutboundLike && !readiness.ready) {
      showErrorModal(
        `출고 절차가 완료되지 않아 상차 완료를 진행할 수 없습니다.\n\n• 사유: ${readiness.reason}\n\n[장비 할당] ➔ [출고 검수 승인]을 먼저 완료해 주십시오.`,
        '상차 완료 불가'
      );
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const todayStr = getDateOffsetStr(0);
      const effectiveUnloadingDate = (
        targetDelivery.unloadingDate ||
        targetDelivery.loadingDate ||
        targetDelivery.scheduledDate ||
        todayStr
      ).slice(0, 10);
      const nextStatus: Delivery['status'] =
        effectiveUnloadingDate <= todayStr ? 'DELIVERED' : 'DISPATCHED';

      const origCat = getOriginalDeliveryCategoryLabel(targetDelivery);
      const isSimpleTransit =
        targetDelivery.type === 'INBOUND' ||
        targetDelivery.type === 'MOVEMENT' ||
        origCat === '입고' ||
        origCat === '반납' ||
        origCat === '이동';

      if (isSimpleTransit) {
        db.updateRow<Delivery>('deliveries', deliveryId, {
          status: nextStatus,
          loadingCompletedAt: nowIso,
          unloadingCompletedAt: effectiveUnloadingDate,
          updatedAt: nowIso,
        });
        await db.awaitPendingWrites();
      } else {
        await completeDelivery(deliveryId);
      }

      await clearHandoverTasks({
        entityId: deliveryId,
        completionAction: 'DELIVERED',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name,
      });

      const targetContract = targetDelivery.contractId
        ? contractMap.get(targetDelivery.contractId)
        : undefined;
      await issueHandoverTask({
        category: 'SITE_ARRIVAL_CONFIRM',
        title: `[상차완료] ${targetDelivery.destinationAddress || '현장'} (${effectiveUnloadingDate} 하차)`,
        content: `상차 완료 처리되어 하차예정일(${effectiveUnloadingDate}) 기준으로 운송 완료 및 계약·청구 개시가 확정되었습니다.`,
        targetDept: 'SALES',
        assignedUserId: targetContract?.salespersonId,
        priority: 'HIGH',
        actionUrl: '/admin/contract',
        entityType: 'DELIVERY',
        entityId: deliveryId,
        senderId: currentUser?.id,
        senderName: currentUser?.name,
      });

      refreshAllData();
      setStudioOpen(false);
      showToast('상차 완료 처리되었습니다.');
    } catch (err: any) {
      showErrorModal(`상차 완료 실패:\n${err?.message || err}`);
    }
  };

  // 상차 완료 취소 / 운송 완료 취소 원복 (자산 RENTED ➔ AWAITING_TRANSPORT 롤백)
  const handleRevertLoadingStatus = async (deliveryId: string) => {
    if (!canSave) return;
    const targetDelivery = (deliveries || []).find((d) => d.id === deliveryId);
    try {
      const nowIso = new Date().toISOString();
      db.updateRow<Delivery>('deliveries', deliveryId, {
        status: 'DISPATCHED',
        loadingCompletedAt: null as any,
        unloadingCompletedAt: null as any,
        updatedAt: nowIso,
      });

      if (targetDelivery) {
        const isOutboundLike =
          targetDelivery.type === 'OUTBOUND' ||
          targetDelivery.type === 'EXCHANGE' ||
          targetDelivery.dispatchCategory === '출고' ||
          targetDelivery.dispatchCategory === '교환';

        if (isOutboundLike && targetDelivery.contractId) {
          const revertCaIds = new Set<string>();
          if (targetDelivery.cargoItems) {
            try {
              const parsed =
                typeof targetDelivery.cargoItems === 'string'
                  ? JSON.parse(targetDelivery.cargoItems)
                  : targetDelivery.cargoItems;
              if (Array.isArray(parsed)) {
                parsed.forEach((ci: any) => {
                  if (Array.isArray(ci?.contractAssetIds)) {
                    ci.contractAssetIds.forEach((id: string) => {
                      if (id) revertCaIds.add(id);
                    });
                  }
                });
              }
            } catch {}
          }
          db.outboundInspections
            .filter((ins) => ins.deliveryId === deliveryId && ins.contractAssetId)
            .forEach((ins) => {
              if (ins.contractAssetId) revertCaIds.add(ins.contractAssetId);
            });
          if (revertCaIds.size === 0) {
            db.contractAssets
              .filter((ca) => ca.contractId === targetDelivery.contractId && ca.status === 'RENTED')
              .forEach((ca) => revertCaIds.add(ca.id));
          }

          revertCaIds.forEach((caId) => {
            const caObj = db.contractAssets.find((c) => c.id === caId);
            if (caObj && caObj.status === 'RENTED') {
              db.updateRow<ContractAsset>('contractAssets', caObj.id, {
                status: 'AWAITING_TRANSPORT',
              });
            }
            if (caObj?.assetId) {
              const assetObj = db.assets.find((a) => a.id === caObj.assetId);
              if (assetObj && assetObj.status === 'RENTED') {
                db.updateRow<Asset>('assets', assetObj.id, {
                  status: 'AWAITING_TRANSPORT',
                  updatedAt: nowIso,
                });
              }
            }
          });
        }
      }

      await db.awaitPendingWrites();
      refreshAllData();
      setStudioOpen(false);
      showToast('배차완료 및 자산 운송대기 상태로 원복되었습니다.');
    } catch (err: any) {
      showErrorModal(`원복 실패:\n${err?.message || err}`);
    }
  };

  // 배차 취소 또는 대기 원복
  const handleCancelOrRevertDelivery = async (deliveryId: string) => {
    if (!canSave) return;
    const targetDelivery = (deliveries || []).find((d) => d.id === deliveryId);
    if (!targetDelivery) return;

    try {
      const nowIso = new Date().toISOString();
      const normSt = getNormalizedDeliveryStatus(targetDelivery);
      const origCat = getOriginalDeliveryCategoryLabel(targetDelivery);
      const isOutboundOrExchange =
        targetDelivery.type === 'OUTBOUND' ||
        targetDelivery.type === 'EXCHANGE' ||
        origCat === '출고' ||
        origCat === '교환';

      if (normSt === 'DISPATCHED' || normSt === 'CANCELLED' || isOutboundOrExchange) {
        db.updateRow<Delivery>('deliveries', deliveryId, {
          status: 'REQUESTED',
          transportCompany: '',
          vehicleNo: '',
          driverName: '',
          driverContact: '',
          expectedCost: 0,
          finalCost: 0,
          deliveryCost: 0,
          vehicles: '[]',
          updatedAt: nowIso,
        });
        await db.awaitPendingWrites();
        await clearHandoverTasks({
          entityId: deliveryId,
          category: 'OUTBOUND_PDI_INSPECTION',
          completedByUserId: currentUser?.id,
          completedByName: currentUser?.name,
          completionAction: 'DISPATCH_REVERTED',
        });
        refreshAllData();
        setStudioOpen(false);
        showToast('배차대기 상태로 전환되었습니다.');
        return;
      }

      db.updateRow<Delivery>('deliveries', deliveryId, {
        status: 'CANCELLED',
        updatedAt: nowIso,
      });
      await db.awaitPendingWrites();
      await clearHandoverTasks({
        entityId: deliveryId,
        completionAction: 'CANCELLED',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name,
      });
      refreshAllData();
      setStudioOpen(false);
      showToast('배차가 취소되었습니다.');
    } catch (err: any) {
      showErrorModal(`취소 실패:\n${err?.message || err}`);
    }
  };

  // 경유/합짐 묶음 생성/순서변경/해제
  const handleCreateBundleFromIds = async (targetIds: string[]) => {
    if (!canSave) return;
    const uniqueIds = Array.from(new Set(targetIds.filter(Boolean)));
    if (uniqueIds.length < 2) {
      showErrorModal('최소 2건 이상 선택해 주세요.');
      return;
    }
    const targets = uniqueIds
      .map((id) => (deliveries || []).find((d) => d.id === id))
      .filter(Boolean) as Delivery[];
    if (targets.length < 2) return;

    try {
      const nowIso = new Date().toISOString();
      const dateTag = nowIso.slice(2, 10).replace(/-/g, '');
      const existingBundleId = targets.find((d) => d.bundleGroupId)?.bundleGroupId;
      const bundleGroupId =
        existingBundleId || `BND-${dateTag}-${Math.floor(100 + Math.random() * 900)}`;

      const donor = targets.find(
        (d) => (d.driverName && d.driverName.trim()) || (d.transportCompany && d.transportCompany.trim())
      );
      const maxExpectedCost = Math.max(
        0,
        ...targets.map((d) => Number(d.expectedCost) || Number(d.deliveryCost) || 0)
      );
      const maxFinalCost = Math.max(0, ...targets.map((d) => Number(d.finalCost) || 0));

      for (let i = 0; i < targets.length; i++) {
        const d = targets[i];
        const origCat = getOriginalDeliveryCategoryLabel(d);
        const isPrimary = i === 0;
        const updatePayload: Partial<Delivery> = {
          bundleGroupId,
          bundleOrder: i + 1,
          originalDispatchCategory: origCat,
          dispatchCategory: '경유/합짐',
          dropoffType: 'MULTI_STOP',
          updatedAt: nowIso,
        };
        if (donor) {
          updatePayload.transportCompany = donor.transportCompany || d.transportCompany || '';
          updatePayload.vehicleType = donor.vehicleType || d.vehicleType || '3.5T';
          updatePayload.vehicleNo = donor.vehicleNo || d.vehicleNo || '';
          updatePayload.driverName = donor.driverName || d.driverName || '';
          updatePayload.driverContact = donor.driverContact || d.driverContact || '';
        }
        if (isPrimary) {
          if (maxExpectedCost > 0 || maxFinalCost > 0) {
            updatePayload.expectedCost = maxExpectedCost;
            updatePayload.finalCost = maxFinalCost;
            updatePayload.deliveryCost = maxFinalCost > 0 ? maxFinalCost : maxExpectedCost;
          }
        } else {
          updatePayload.expectedCost = 0;
          updatePayload.finalCost = 0;
          updatePayload.deliveryCost = 0;
        }
        db.updateRow<Delivery>('deliveries', d.id, updatePayload);
      }

      await db.awaitPendingWrites();
      refreshAllData();
      setBundleMode(false);
      setSelectedBundleIds([]);
      showToast(`${targets.length}건 경유/합짐 묶음 완료`);
    } catch (err: any) {
      showErrorModal(`합짐 묶기 실패:\n${err?.message || err}`);
    }
  };

  const handleAddDeliveryToCurrentBundle = async (addDeliveryId: string) => {
    if (!selectedDelivery) return;
    const currentGroup = selectedDelivery.bundleGroupId
      ? getBundleGroupDeliveries(selectedDelivery.bundleGroupId).map((d) => d.id)
      : [selectedDelivery.id];
    if (currentGroup.includes(addDeliveryId)) return;
    await handleCreateBundleFromIds([...currentGroup, addDeliveryId]);
  };

  const handleMoveBundleStopOrder = async (
    targetDeliveryId: string,
    direction: 'UP' | 'DOWN'
  ) => {
    if (!canSave) return;
    const target = (deliveries || []).find((d) => d.id === targetDeliveryId);
    if (!target || !target.bundleGroupId) return;
    const groupItems = getBundleGroupDeliveries(target.bundleGroupId);
    const curIdx = groupItems.findIndex((d) => d.id === targetDeliveryId);
    const swapIdx = direction === 'UP' ? curIdx - 1 : curIdx + 1;
    if (curIdx === -1 || swapIdx < 0 || swapIdx >= groupItems.length) return;

    const reordered = [...groupItems];
    const tmp = reordered[curIdx];
    reordered[curIdx] = reordered[swapIdx];
    reordered[swapIdx] = tmp;

    try {
      const nowIso = new Date().toISOString();
      const groupExpectedCost = Math.max(
        0,
        ...groupItems.map((d) => Number(d.expectedCost) || Number(d.deliveryCost) || 0)
      );
      const groupFinalCost = Math.max(0, ...groupItems.map((d) => Number(d.finalCost) || 0));

      for (let i = 0; i < reordered.length; i++) {
        const item = reordered[i];
        const isPrimary = i === 0;
        db.updateRow<Delivery>('deliveries', item.id, {
          bundleOrder: i + 1,
          expectedCost: isPrimary ? groupExpectedCost : 0,
          finalCost: isPrimary ? groupFinalCost : 0,
          deliveryCost: isPrimary
            ? groupFinalCost > 0
              ? groupFinalCost
              : groupExpectedCost
            : 0,
          updatedAt: nowIso,
        });
      }
      await db.awaitPendingWrites();
      refreshAllData();
      showToast('경유 순서 변경 완료');
    } catch (err: any) {
      showErrorModal(`순서 변경 실패:\n${err?.message || err}`);
    }
  };

  const handleUnbundleEntireGroup = async (bundleGroupId: string) => {
    if (!canSave || !bundleGroupId) return;
    const groupItems = getBundleGroupDeliveries(bundleGroupId);
    try {
      const nowIso = new Date().toISOString();
      for (const item of groupItems) {
        const origCat = getOriginalDeliveryCategoryLabel(item);
        db.updateRow<Delivery>('deliveries', item.id, {
          dispatchCategory: origCat,
          bundleGroupId: null,
          bundleOrder: null,
          dropoffType: 'SINGLE',
          updatedAt: nowIso,
        });
      }
      await db.awaitPendingWrites();
      refreshAllData();
      showToast('합짐 묶음 해제 완료');
    } catch (err: any) {
      showErrorModal(`묶음 해제 실패:\n${err?.message || err}`);
    }
  };

  const handleRemoveSingleFromBundle = async (targetDeliveryId: string) => {
    const target = (deliveries || []).find((d) => d.id === targetDeliveryId);
    if (!target || !target.bundleGroupId) return;
    const groupItems = getBundleGroupDeliveries(target.bundleGroupId);
    if (groupItems.length <= 2) {
      await handleUnbundleEntireGroup(target.bundleGroupId);
      return;
    }
    try {
      const nowIso = new Date().toISOString();
      const origCat = getOriginalDeliveryCategoryLabel(target);
      db.updateRow<Delivery>('deliveries', target.id, {
        dispatchCategory: origCat,
        bundleGroupId: null,
        bundleOrder: null,
        dropoffType: 'SINGLE',
        expectedCost: 0,
        finalCost: 0,
        deliveryCost: 0,
        updatedAt: nowIso,
      });
      const remaining = groupItems.filter((d) => d.id !== target.id);
      for (let i = 0; i < remaining.length; i++) {
        db.updateRow<Delivery>('deliveries', remaining[i].id, {
          bundleOrder: i + 1,
          updatedAt: nowIso,
        });
      }
      await db.awaitPendingWrites();
      refreshAllData();
      showToast('개별 분리 완료');
    } catch (err: any) {
      showErrorModal(`개별 분리 실패:\n${err?.message || err}`);
    }
  };

  // 수동 배차 신규 등록 핸들러
  const handleManualDispatchSubmit = async (payload: ManualDispatchSubmitPayload) => {
    const isManualReturn = payload.category === '반납';
    const selectedManualReturnAssets = isManualReturn
      ? (payload.returnAssetIds.map((id) => assetMap.get(id)).filter(Boolean) as Asset[])
      : [];
    const effectiveOrigin =
      (payload.originAddress || '').trim() || (isManualReturn ? '당사 보관소' : '');
    const effectiveDest =
      (payload.destinationAddress || '').trim() ||
      (isManualReturn ? selectedManualReturnAssets[0]?.renter || '임차처' : '');

    if (!effectiveOrigin || !effectiveDest) {
      showErrorModal('상차지와 하차지를 입력해 주세요.');
      return;
    }

    if (payload.category === '출고' || payload.category === '교환') {
      const targetCust = customerMap.get(payload.customerId);
      if (isCustomerRestricted(targetCust?.transactionStatus)) {
        showErrorModal(
          `[출고제한] 거래처 [${targetCust?.name}]은(는) 신규 출고가 차단된 상태입니다.`
        );
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const cargoItemsPayload = isManualReturn
      ? JSON.stringify(
          selectedManualReturnAssets.map((a) => ({
            modelName: `${a.modelName} (${a.assetNo})`,
            count: 1,
            returnAssetId: a.id,
            assetNo: a.assetNo,
            renter: a.renter || '',
          }))
        )
      : JSON.stringify(payload.cargos);

    db.insertRow<Delivery>('deliveries', {
      type:
        payload.category === '출고'
          ? 'OUTBOUND'
          : payload.category === '교환'
          ? 'EXCHANGE'
          : payload.category === '이동'
          ? 'MOVEMENT'
          : payload.category === '반납'
          ? 'RETURN'
          : 'INBOUND',
      status: 'PENDING',
      dispatchCategory: payload.category,
      contractId: payload.contractId || undefined,
      requestDate: payload.loadingDate,
      scheduledDate: payload.loadingDate,
      loadingDate: payload.loadingDate,
      loadingTimeSlot: payload.loadingTimeSlot,
      unloadingDate: payload.unloadingDate,
      unloadingTimeSlot: payload.unloadingTimeSlot,
      originAddress: effectiveOrigin,
      destinationAddress: effectiveDest,
      vehicleType: payload.vehicleType || '3.5T',
      deliveryCost: payload.expectedCost,
      expectedCost: payload.expectedCost,
      finalCost: payload.expectedCost,
      billableToCustomer: payload.billableToCustomer,
      billableCustomerId: payload.customerId || undefined,
      isCostSettled: false,
      memo: payload.memo || '',
      closingMemo: payload.memo || '',
      vehicleRequirements: JSON.stringify([
        { vehicleType: payload.vehicleType || '3.5T', count: 1 },
      ]),
      cargoItems: cargoItemsPayload,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await db.awaitPendingWrites();

    if (isManualReturn && selectedManualReturnAssets.length > 0) {
      const retDate = payload.unloadingDate || payload.loadingDate || getDateOffsetStr(0);
      for (const a of selectedManualReturnAssets) {
        if (a.status !== 'RENTED_RETURNED' || !a.actualRentReturnDate) {
          await returnRentedAsset(a.id, retDate, {
            memo: `[임차자산 반납 배차 등록] 반납일: ${retDate}`,
          });
        }
      }
    }

    jobNotificationService.triggerJobAlert({
      type:
        payload.category === '교환'
          ? 'EXCHANGE_REQUESTED'
          : payload.category === '반납'
          ? 'INBOUND_RETURN'
          : 'OUTBOUND_REQUESTED',
      title: `${payload.category} 배차 등록`,
      customerName: customerMap.get(payload.customerId)?.name || effectiveDest,
      siteName: effectiveDest,
      modelName: payload.cargos[0]?.modelName || payload.category,
      quantity: payload.cargos.reduce((s, c) => s + (c.count || 1), 0) || 1,
      deliveryDate: payload.loadingDate,
      memo: payload.memo || undefined,
      actionMenuId: 'outbound_inspection',
    });

    refreshAllData();
    setManualModalOpen(false);
    showToast('배차 등록 완료');
  };

  // Navigation Launchers
  const launchTmap = (addr: string) => {
    window.location.href = `tmap://search?name=${encodeURIComponent(addr)}`;
    setNavTargetAddress(null);
  };
  const launchKakaoNavi = (addr: string) => {
    window.open(`https://map.kakao.com/link/search/${encodeURIComponent(addr)}`, '_blank');
    setNavTargetAddress(null);
  };

  // Bundle candidates for current selectedDelivery
  const bundleCandidateDeliveries = useMemo(() => {
    if (!selectedDelivery) return [];
    const currentGroup = selectedDelivery.bundleGroupId
      ? new Set(getBundleGroupDeliveries(selectedDelivery.bundleGroupId).map((d) => d.id))
      : new Set([selectedDelivery.id]);
    return (deliveries || [])
      .filter((d) => {
        if (currentGroup.has(d.id)) return false;
        const st = getNormalizedDeliveryStatus(d);
        return st === 'PENDING' || st === 'DISPATCHED';
      })
      .slice(0, 15);
  }, [deliveries, selectedDelivery]);

  const currentReadiness = useMemo(() => {
    if (!selectedDelivery) {
      return {
        isOutboundLike: false,
        ready: true,
        stage: 'NOT_APPLICABLE' as const,
        badgeLabel: '',
        reason: '',
      };
    }
    return checkDeliveryOutboundReadiness(
      selectedDelivery,
      contractAssets || [],
      outboundInspections || [],
      assetMap
    );
  }, [selectedDelivery, contractAssets, outboundInspections, assetMap]);

  return (
    <div
      className="font-sans text-slate-100"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '100%',
        paddingBottom: '96px',
        paddingTop: '4px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      {/* 토스트 알림 */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9700,
          }}
          className="bg-emerald-600 text-white text-sm font-black px-4 py-2.5 rounded-full shadow-xl flex items-center gap-1.5 whitespace-nowrap"
        >
          <Check className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* 1. 상단 타이틀 & 액션 퀵버튼 바 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-sky-400 flex-shrink-0" />
          <h2 className="text-lg font-black text-white whitespace-nowrap flex-shrink-0">
            배차관리
          </h2>
        </div>

        {canSave && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setBundleMode((v) => !v);
                setSelectedBundleIds([]);
              }}
              className={`px-3 py-2 rounded-xl text-sm font-black border flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                bundleMode
                  ? 'bg-indigo-600 border-indigo-400 text-white'
                  : 'bg-slate-900 border-slate-700 text-indigo-300'
              }`}
            >
              <Link2 className="w-4 h-4" />
              {bundleMode ? '합짐선택중' : '합짐묶기'}
            </button>
            <button
              type="button"
              onClick={() => setManualModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              배차등록
            </button>
          </div>
        )}
      </div>

      {/* 합짐 다중선택 실행 바 */}
      {bundleMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
          }}
          className="bg-indigo-950/80 border border-indigo-500 rounded-xl p-3"
        >
          <span className="text-sm font-bold text-indigo-200 whitespace-nowrap flex-shrink-0">
            합짐 선택: {selectedBundleIds.length}건
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setBundleMode(false);
                setSelectedBundleIds([]);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold whitespace-nowrap flex-shrink-0"
            >
              취소
            </button>
            <button
              type="button"
              disabled={selectedBundleIds.length < 2}
              onClick={() => handleCreateBundleFromIds(selectedBundleIds)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 disabled:opacity-40 text-white text-xs font-black whitespace-nowrap flex-shrink-0"
            >
              {selectedBundleIds.length}건 합짐 확정
            </button>
          </div>
        </div>
      )}

      {/* 2. 상태 퀵탭 (좌우 스크롤 없이 줄바꿈 배치) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: '6px',
        }}
      >
        {[
          { key: 'PENDING' as const, label: '대기', count: statusCounts.pending },
          { key: 'DISPATCHED' as const, label: '배차완료', count: statusCounts.dispatched },
          { key: 'DELIVERED' as const, label: '완료', count: statusCounts.delivered },
          { key: 'CANCELLED' as const, label: '취소', count: statusCounts.cancelled },
          { key: 'ALL' as const, label: '전체', count: statusCounts.all },
        ].map((tab) => {
          const active = statusTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusTab(tab.key)}
              className={`py-2.5 px-1 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-0.5 whitespace-nowrap transition-colors ${
                active
                  ? 'bg-blue-600 border-blue-400 text-white shadow'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-xs font-mono font-black ${
                  active ? 'text-white' : 'text-sky-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. 기간 퀵버튼 + 구분 퀵버튼 + 검색창 (좌우 스크롤 없이 아래로 줄바꿈) */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
        className="bg-slate-900 border border-slate-800 rounded-xl p-3"
      >
        {/* 기간 퀵버튼 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            { key: 'ALL' as const, label: '전체기간' },
            { key: 'TODAY' as const, label: '오늘' },
            { key: 'TOMORROW' as const, label: '내일' },
            { key: 'WEEK' as const, label: '7일' },
            { key: 'MONTH' as const, label: '1개월' },
          ].map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDateQuick(d.key)}
              style={{ flex: '1 1 auto' }}
              className={`px-3 py-2 rounded-lg text-xs font-black border whitespace-nowrap text-center ${
                dateQuick === d.key
                  ? 'bg-sky-600 border-sky-400 text-white'
                  : 'bg-slate-950 border-slate-700 text-slate-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* 구분 퀵버튼 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(['ALL', ...CATEGORY_QUICK_OPTIONS] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryQuick(cat)}
              style={{ flex: '1 1 auto' }}
              className={`px-3 py-2 rounded-lg text-xs font-black border whitespace-nowrap text-center ${
                categoryQuick === cat
                  ? 'bg-blue-600 border-blue-400 text-white'
                  : 'bg-slate-950 border-slate-700 text-slate-300'
              }`}
            >
              {cat === 'ALL' ? '전체구분' : cat}
            </button>
          ))}
        </div>

        {/* 검색창 */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="거래처, 현장, 기사, 차량번호 검색"
            style={{ paddingLeft: '34px', paddingRight: '32px' }}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 4. 배차 카드 리스트 */}
      {filteredDeliveries.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-400">
          조회된 배차 내역이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredDeliveries.map((d) => {
            const normSt = getNormalizedDeliveryStatus(d);
            const cat = getDeliveryCategoryLabel(d);
            const origCat = getOriginalDeliveryCategoryLabel(d);
            const readiness = checkDeliveryOutboundReadiness(
              d,
              contractAssets || [],
              outboundInspections || [],
              assetMap
            );
            const cargos = parseCargoItems(d);
            const cargoText = cargos.map((c) => `${c.modelName}×${c.count}`).join(', ');
            const effCost = getEffectiveDeliveryCost(d);
            const loadShort = (d.loadingDate || d.requestDate || '').slice(5, 10);
            const unloadShort = (d.unloadingDate || d.loadingDate || '').slice(5, 10);
            const isBundleSelected = selectedBundleIds.includes(d.id);

            const ctForPrint = d.contractId ? contractMap.get(d.contractId) : undefined;
            const printJob = (printQueue || []).find(
              (j) =>
                j.docNo &&
                (j.docNo.includes(d.id) ||
                  (ctForPrint?.contractNo && j.docNo.includes(ctForPrint.contractNo)))
            );

            const catColor =
              cat === '출고'
                ? 'bg-blue-600 text-white'
                : cat === '입고'
                ? 'bg-amber-600 text-white'
                : cat === '교환'
                ? 'bg-emerald-600 text-white'
                : cat === '반납'
                ? 'bg-rose-600 text-white'
                : cat === '경유/합짐'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-100';

            return (
              <div
                key={d.id}
                onClick={() => {
                  if (bundleMode) {
                    setSelectedBundleIds((prev) =>
                      prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev, d.id]
                    );
                    return;
                  }
                  handleSelectDelivery(d, true);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                className={`bg-slate-900 rounded-xl p-3.5 border cursor-pointer transition-colors ${
                  isBundleSelected
                    ? 'border-indigo-400 bg-indigo-950/30'
                    : d.bundleGroupId
                    ? 'border-indigo-500/50'
                    : normSt === 'PENDING'
                    ? 'border-amber-500/40'
                    : normSt === 'DISPATCHED'
                    ? 'border-blue-500/40'
                    : 'border-slate-800'
                }`}
              >
                {/* Row 1: 배지 + 상하차 일시 (줄바꿈 허용) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {bundleMode && (
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center border text-xs font-black flex-shrink-0 ${
                          isBundleSelected
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'bg-slate-950 border-slate-600 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-black whitespace-nowrap flex-shrink-0 ${catColor}`}
                    >
                      {cat}
                    </span>
                    {cat === '경유/합짐' && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-bold text-indigo-300 whitespace-nowrap flex-shrink-0">
                        {d.bundleOrder || 1}순위·{origCat}
                      </span>
                    )}
                    {readiness.isOutboundLike && readiness.badgeLabel && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-black border whitespace-nowrap flex-shrink-0 ${
                          readiness.ready
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : readiness.stage === 'REJECTED'
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        }`}
                      >
                        {readiness.badgeLabel}
                      </span>
                    )}
                    {d.loadingCompletedAt && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black whitespace-nowrap flex-shrink-0">
                        상차완료
                      </span>
                    )}
                    {printJob && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 text-xs font-bold whitespace-nowrap flex-shrink-0">
                        {printJob.status === 'COMPLETED' ? '인쇄완료' : '인쇄대기'}
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                    {loadShort}({d.loadingTimeSlot || '오전'})➔{unloadShort}({d.unloadingTimeSlot || '오전'})
                  </span>
                </div>

                {/* Row 2: 고객사·현장 + 장비 요약 (줄바꿈 배치) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span className="text-sm font-black text-white break-words">
                    {getCustomerNameForDelivery(d)}
                  </span>
                  {cargoText && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-sky-300 whitespace-nowrap flex-shrink-0">
                      {cargoText}
                    </span>
                  )}
                </div>

                {/* Row 3: 상차지 ➔ 하차지 + 날씨/내비 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                  className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800/80"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-xs text-slate-300 min-w-0 break-words">
                    <span className="text-slate-400">{d.originAddress || '당사 보관소'}</span>
                    <span className="mx-1.5 text-slate-500">➔</span>
                    <span className="text-slate-100 font-bold">
                      {d.destinationAddress || '현장'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setWeatherTarget({
                          address: d.destinationAddress || '서울',
                          title: getCustomerNameForDelivery(d),
                        })
                      }
                      className="p-2 rounded-lg bg-slate-800 text-amber-300 hover:bg-slate-700"
                    >
                      <Sun className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setNavTargetAddress(d.destinationAddress || '당사 보관소')}
                      className="p-2 rounded-lg bg-slate-800 text-emerald-300 hover:bg-slate-700"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Row 4: 배정된 운송사 · 기사 · 차량 · 운송료 요약 (좌우 스크롤 없이 줄바꿈, 당사/고객부담 제거) */}
                {(d.driverName || d.transportCompany || d.vehicleNo || effCost > 0) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                    className="text-xs px-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {d.transportCompany && (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-xs font-bold whitespace-nowrap">
                          {d.transportCompany}
                        </span>
                      )}
                      {d.driverName && (
                        <span className="font-bold text-white text-sm whitespace-nowrap">
                          {d.driverName}
                        </span>
                      )}
                      {d.vehicleNo && (
                        <span className="text-xs font-mono text-slate-300 whitespace-nowrap">
                          {d.vehicleNo}
                        </span>
                      )}
                      {d.vehicleType && (
                        <span className="text-xs font-bold text-amber-300 whitespace-nowrap">
                          {d.vehicleType}
                        </span>
                      )}
                      {d.driverContact && (
                        <a
                          href={`tel:${d.driverContact}`}
                          className="p-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 flex-shrink-0"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {canViewCost && effCost > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="font-mono font-black text-emerald-400 text-sm whitespace-nowrap flex-shrink-0">
                          ₩{effCost.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Row 5: 카드 인라인 퀵액션 버튼 바 (좌우 스크롤 없이 줄바꿈 배치) */}
                {!bundleMode && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                      paddingTop: '8px',
                    }}
                    className="border-t border-slate-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {normSt === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSelectDelivery(d, true)}
                          style={{ flex: '1 1 auto' }}
                          className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black whitespace-nowrap text-center"
                        >
                          배차하기
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickCustomerDirect(d)}
                          className="py-2.5 px-3 rounded-xl bg-teal-600/30 border border-teal-500/50 text-teal-200 text-xs font-bold whitespace-nowrap"
                        >
                          고객직접
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemotePrint(d)}
                          className="py-2.5 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sky-300 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          인쇄
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelOrRevertDelivery(d.id)}
                          className="py-2.5 px-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-bold whitespace-nowrap"
                        >
                          취소
                        </button>
                      </>
                    )}

                    {normSt === 'DISPATCHED' && (
                      <>
                        {d.loadingCompletedAt ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCompleteLoadingStatus(d.id)}
                              style={{ flex: '1 1 auto' }}
                              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black flex items-center justify-center gap-1 whitespace-nowrap"
                            >
                              <Check className="w-4 h-4" />
                              운송완료
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevertLoadingStatus(d.id)}
                              className="py-2.5 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 text-xs font-bold whitespace-nowrap"
                            >
                              상차취소
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCompleteLoadingStatus(d.id)}
                            style={{ flex: '1 1 auto' }}
                            className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black flex items-center justify-center gap-1 whitespace-nowrap"
                          >
                            <Truck className="w-4 h-4" />
                            상차완료
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSelectDelivery(d, true)}
                          className="py-2.5 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold whitespace-nowrap"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendDriverSms(d)}
                          className="py-2.5 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-emerald-300 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                        >
                          <Send className="w-3.5 h-3.5" />
                          문자
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyKakaoDispatchMessage(d)}
                          className="py-2.5 px-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          카톡
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemotePrint(d)}
                          className="py-2.5 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sky-300 text-xs font-bold whitespace-nowrap"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {normSt === 'DELIVERED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSelectDelivery(d, true)}
                          style={{ flex: '1 1 auto' }}
                          className="py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold whitespace-nowrap text-center"
                        >
                          상세/수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevertLoadingStatus(d.id)}
                          className="py-2.5 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          완료취소
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyKakaoDispatchMessage(d)}
                          className="py-2.5 px-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold whitespace-nowrap"
                        >
                          카톡
                        </button>
                      </>
                    )}

                    {normSt === 'CANCELLED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSelectDelivery(d, true)}
                          style={{ flex: '1 1 auto' }}
                          className="py-2.5 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold whitespace-nowrap text-center"
                        >
                          재배차
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelOrRevertDelivery(d.id)}
                          className="py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold whitespace-nowrap"
                        >
                          대기원복
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. 퀵버튼 배차 스튜디오 시트 */}
      <MobileDispatchStudioSheet
        isOpen={studioOpen}
        delivery={selectedDelivery}
        onClose={() => setStudioOpen(false)}
        dispatchCategory={dispatchCategory}
        setDispatchCategory={setDispatchCategory}
        loadingDate={loadingDate}
        setLoadingDate={setLoadingDate}
        loadingTimeSlot={loadingTimeSlot}
        setLoadingTimeSlot={setLoadingTimeSlot}
        unloadingDate={unloadingDate}
        setUnloadingDate={setUnloadingDate}
        unloadingTimeSlot={unloadingTimeSlot}
        setUnloadingTimeSlot={setUnloadingTimeSlot}
        originAddress={originAddress}
        setOriginAddress={setOriginAddress}
        destinationAddress={destinationAddress}
        setDestinationAddress={setDestinationAddress}
        closingMemo={closingMemo}
        setClosingMemo={setClosingMemo}
        billableToCust={billableToCust}
        setBillableToCust={setBillableToCust}
        billableCustId={billableCustId}
        setBillableCustId={setBillableCustId}
        assignedVehicles={assignedVehicles}
        onVehicleFieldChange={handleVehicleFieldChange}
        onSelectDriverQuick={handleSelectDriverQuick}
        onAddVehicleRow={handleAddVehicleRow}
        onRemoveVehicleRow={handleRemoveVehicleRow}
        selectedReturnAssetIds={selectedReturnAssetIds}
        onToggleReturnAsset={handleToggleReturnAsset}
        availableReturnAssets={availableReturnAssets}
        transportCompanies={transportCompanies || []}
        transportDrivers={transportDrivers || []}
        customers={customers || []}
        canViewCost={canViewCost}
        readiness={currentReadiness}
        bundleGroupDeliveries={
          selectedDelivery?.bundleGroupId
            ? getBundleGroupDeliveries(selectedDelivery.bundleGroupId)
            : []
        }
        bundleCandidateDeliveries={bundleCandidateDeliveries}
        onSelectDelivery={(d) => handleSelectDelivery(d, true)}
        onMoveBundleStopOrder={handleMoveBundleStopOrder}
        onRemoveSingleFromBundle={handleRemoveSingleFromBundle}
        onUnbundleEntireGroup={handleUnbundleEntireGroup}
        onAddDeliveryToCurrentBundle={handleAddDeliveryToCurrentBundle}
        isListening={isListening}
        onToggleVoiceRecognition={handleToggleVoiceRecognition}
        onApplyDriverTranscript={handleApplyDriverTranscript}
        isSaving={isSavingDispatch}
        onSaveDispatch={handleSaveDispatch}
        onCompleteLoading={handleCompleteLoadingStatus}
        onRevertLoading={handleRevertLoadingStatus}
        onCancelOrRevertDelivery={handleCancelOrRevertDelivery}
        onSendSms={(d) => handleSendDriverSms(d)}
        onCopyKakao={handleCopyKakaoDispatchMessage}
        onCopyDriverPortal={handleCopyDriverPortalUrl}
        onRemotePrint={handleRemotePrint}
        onOpenWeather={(address, title) => setWeatherTarget({ address, title })}
        onOpenNav={(address) => setNavTargetAddress(address)}
        getCustomerNameForDelivery={getCustomerNameForDelivery}
      />

      {/* 6. 수동 배차 신규 등록 모달 */}
      <MobileDispatchManualModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        onSubmit={handleManualDispatchSubmit}
        customers={customers || []}
        contracts={contracts || []}
        sites={sites || []}
        vendors={vendors || []}
        models={products || []}
        availableReturnAssets={availableReturnAssets}
        canViewCost={canViewCost}
      />

      {/* 7. 도착지 날씨 모달 */}
      {weatherTarget && (
        <DestinationWeatherModal
          isOpen={true}
          onClose={() => setWeatherTarget(null)}
          customerName={weatherTarget.title || '현장'}
          siteName={weatherTarget.title || '현장'}
          rawAddress={weatherTarget.address}
        />
      )}

      {/* 8. 내비게이션 선택 시트 */}
      {navTargetAddress && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9600,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setNavTargetAddress(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-white">내비게이션 실행</span>
              <button
                type="button"
                onClick={() => setNavTargetAddress(null)}
                className="p-1 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 break-words">
              {navTargetAddress}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
              <button
                type="button"
                onClick={() => launchTmap(navTargetAddress)}
                className="py-3 rounded-xl bg-blue-600 text-white text-xs font-black whitespace-nowrap"
              >
                티맵
              </button>
              <button
                type="button"
                onClick={() => launchKakaoNavi(navTargetAddress)}
                className="py-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-black whitespace-nowrap"
              >
                카카오내비
              </button>
              <button
                type="button"
                onClick={async () => {
                  await copyToClipboard(navTargetAddress);
                  setNavTargetAddress(null);
                  showToast('주소 복사 완료');
                }}
                className="py-3 rounded-xl bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                복사
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. 카카오톡 배차 안내문 모달 */}
      {kakaoModalData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9600,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setKakaoModalData(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-amber-300">카카오톡 배차 안내문</span>
              <button
                type="button"
                onClick={() => setKakaoModalData(null)}
                className="p-1 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              readOnly
              rows={10}
              value={kakaoModalData.text}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 font-mono"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setKakaoModalData(null)}
                className="px-4 py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold whitespace-nowrap"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={async () => {
                  await copyToClipboard(kakaoModalData.text);
                  showToast('복사 완료');
                }}
                className="flex-1 py-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <Copy className="w-4 h-4" />
                전문 다시 복사
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
