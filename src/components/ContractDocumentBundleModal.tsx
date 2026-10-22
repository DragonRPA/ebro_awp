// src/components/ContractDocumentBundleModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { getTenantPlugin } from '../integrations/TenantPluginManager';
import { useApp } from '../context/AppContext';
import { 
  X, FileText, FolderOpen, CheckCircle2, AlertCircle, 
  RefreshCw, FileCheck, Mail, Send, Plus, Users, Check, Play, Filter
} from 'lucide-react';
import { emailService } from '../services/email';
import { db, formatContractEndDate } from '../services/db';
import { clearHandoverTasks } from '../utils/taskHandoverPipeline';
import { fetchWithAgentFallback, launchLocalAgentFromBrowser, isAgentOnlineGlobal, subscribeAgentStatus, setGlobalAgentStatus } from '../services/agentService';
import { getCanonicalModelKey } from '../utils/modelUtils';
import { PRESET_PRODUCT_SPECS } from '../data/presetProductSpecs';
import { splitMasterAwareOptions } from '../types/siteOption';

// 안전인증서 파일명/URL에서 안전인증일(일자) 자동 추출 헬퍼
const extractCertDateFromText = (raw?: string | null): string | null => {
  if (!raw) return null;
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}
  const krMatch = decoded.match(/(20\d{2}|\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (krMatch) {
    const yr = krMatch[1].length === 2 ? `20${krMatch[1]}` : krMatch[1];
    const mo = krMatch[2].padStart(2, '0');
    const dy = krMatch[3].padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  }
  const dotMatch = decoded.match(/(20\d{2})[.\-](\d{1,2})[.\-](\d{1,2})/);
  if (dotMatch) {
    return `${dotMatch[1]}-${dotMatch[2].padStart(2, '0')}-${dotMatch[3].padStart(2, '0')}`;
  }
  return null;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialContractId?: string;
  initialDeliveryId?: string;
  initialContractAssetIds?: string[];
}

export interface RecipientItem {
  id: string;
  email: string;
  name?: string;
  roleLabel?: string;
  source: 'CUSTOMER' | 'CONTACT' | 'SITE' | 'DELIVERY' | 'MANUAL';
}

export const ContractDocumentBundleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialContractId,
  initialDeliveryId,
  initialContractAssetIds
}) => {
  const { 
    contracts, customers, contacts, sites, assets, 
    contractAssets, deliveries, products, officialMailConfigs, currentUser,
    currentTenant, showErrorModal, hasPermission, users, outboundInspections, standardOptions
  } = useApp();

  // 계약서 패키지 생성 권한: 계약 저장/열람 권한 또는 에이전트 권한 보유자
  const canGeneratePackage = hasPermission('contract', 'view') || hasPermission('contract', 'save') || hasPermission('agent_badge', 'view');

  // 로컬 에이전트(포트 5175) 실시간 통신 상태 점검 (확장 프로그램 및 전역 동기화 즉시 바인딩)
  const [isAgentOnline, setIsAgentOnline] = useState<boolean | null>(() => isAgentOnlineGlobal());
  const [agentChecking, setAgentChecking] = useState<boolean>(() => !isAgentOnlineGlobal());

  useEffect(() => {
    let isMounted = true;

    // 전역 상태 실시간 구독 (확장 프로그램 및 헤더 배지 연동)
    const unsubscribe = subscribeAgentStatus((online) => {
      if (isMounted && online) {
        setIsAgentOnline(true);
        setAgentChecking(false);
      }
    });

    const checkAgent = async () => {
      try {
        const res = await fetchWithAgentFallback('/health', {
          method: 'GET',
          signal: AbortSignal.timeout(2500),
          cache: 'no-store'
        });
        if (isMounted) {
          setIsAgentOnline(res.ok);
          setAgentChecking(false);
          setGlobalAgentStatus(res.ok);
        }
      } catch (e) {
        if (isMounted) {
          if (!isAgentOnlineGlobal()) {
            setIsAgentOnline(false);
          }
          setAgentChecking(false);
        }
      }
    };

    if (isOpen) {
      if (!isAgentOnlineGlobal()) {
        setAgentChecking(true);
      }
      checkAgent();
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen]);

  const [selectedContractId, setSelectedContractId] = useState<string>(
    initialContractId || contracts[0]?.id || ''
  );

  const [filterDate, setFilterDate] = useState<string>('ALL');

  const availableStartDates = useMemo(() => {
    if (!selectedContractId) return [];
    const caList = contractAssets.filter(
      ca => ca.contractId === selectedContractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD'
    );
    const dates = Array.from(new Set(caList.map(ca => ca.startDate).filter(Boolean)));
    return dates.sort();
  }, [selectedContractId, contractAssets]);

  // 해당 계약에 연결된 개별 출고/교환 요청 건(Delivery) 목록 및 각 요청 건별 체결자산 ID 역추적
  const contractOutboundDeliveries = useMemo(() => {
    if (!selectedContractId) return [];
    const caList = contractAssets.filter(
      ca => ca.contractId === selectedContractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD'
    );
    return (deliveries || [])
      .filter(d => d.contractId === selectedContractId && d.status !== 'CANCELLED' && (d.type === 'OUTBOUND' || d.type === 'EXCHANGE' || d.dispatchCategory === '출고' || d.dispatchCategory === '교환'))
      .sort((a, b) => String(b.createdAt || b.id).localeCompare(String(a.createdAt || a.id)))
      .map(d => {
        const caIds: string[] = [];
        let modelSummary = '';
        let totalCount = 0;
        let reqSiteContactName = '';
        let reqSiteContactPhone = '';
        try {
          if (d.cargoItems) {
            const parsed = JSON.parse(d.cargoItems);
            if (Array.isArray(parsed)) {
              const snapMeta = parsed.find((ci: any) => ci?.requestMeta)?.requestMeta;
              if (snapMeta?.siteContactName) reqSiteContactName = String(snapMeta.siteContactName).trim();
              if (snapMeta?.siteContactPhone) reqSiteContactPhone = String(snapMeta.siteContactPhone).trim();
              parsed.forEach((ci: any) => {
                if (Array.isArray(ci?.contractAssetIds)) {
                  ci.contractAssetIds.forEach((id: string) => {
                    if (id && !caIds.includes(id)) caIds.push(id);
                  });
                }
              });
              modelSummary = parsed.map((ci: any) => `${ci.modelName || '장비'}×${Number(ci.count) || 1}대`).join(', ');
              totalCount = parsed.reduce((s: number, ci: any) => s + (Number(ci?.count) || 1), 0);
            }
          }
        } catch {}
        if (!reqSiteContactName && d.memo) {
          const mContact = d.memo.match(/현장담당:\s*([^(\|]+?)(?:\s*\(([^)]+)\))?(?:\s*\||$)/);
          if (mContact) {
            const n = (mContact[1] || '').trim();
            const p = (mContact[2] || '').trim();
            if (n && n !== '-') reqSiteContactName = n;
            if (p && p !== '-') reqSiteContactPhone = p;
          }
        }
        if (caIds.length === 0 && outboundInspections) {
          outboundInspections
            .filter(ins => ins.deliveryId === d.id)
            .forEach(ins => {
              const caId = (ins as any).contractAssetId;
              if (caId && !caIds.includes(caId)) caIds.push(caId);
            });
        }
        if (caIds.length === 0 && d.loadingDate) {
          caList
            .filter(ca => ca.startDate === d.loadingDate)
            .forEach(ca => {
              if (!caIds.includes(ca.id)) caIds.push(ca.id);
            });
        }
        const matchedCas = caIds.map(id => caList.find(c => c.id === id)).filter(Boolean);
        const assignedCount = matchedCas.filter(ca => Boolean(ca?.assetId)).length;
        const effectiveCount = matchedCas.length || totalCount || 0;
        if (!modelSummary && matchedCas.length > 0) {
          const mMap = new Map<string, number>();
          matchedCas.forEach(ca => {
            const m = ca?.expectedModel || '장비';
            mMap.set(m, (mMap.get(m) || 0) + 1);
          });
          modelSummary = Array.from(mMap.entries()).map(([m, cnt]) => `${m}×${cnt}대`).join(', ');
        }
        const dateLabel = d.loadingDate || d.unloadingDate || d.scheduledDate || (d.createdAt ? d.createdAt.slice(0, 10) : '-');
        return {
          delivery: d,
          id: d.id,
          dateLabel,
          caIds,
          effectiveCount,
          assignedCount,
          modelSummary: modelSummary || `${effectiveCount}대`,
          siteContactName: reqSiteContactName,
          siteContactPhone: reqSiteContactPhone
        };
      });
  }, [selectedContractId, deliveries, contractAssets, outboundInspections]);
  
  useEffect(() => {
    if (!selectedContractId) {
      setFilterDate('ALL');
      return;
    }
    // 1순위: 출고 요청 내역에서 특정 출고 요청(initialDeliveryId)을 지정해 모달을 호출한 경우 해당 출고 요청 건으로 즉시 고정
    if (initialDeliveryId && (!initialContractId || selectedContractId === initialContractId)) {
      setFilterDate(`DELIVERY:${initialDeliveryId}`);
      return;
    }
    // 2순위: 계약에 복수의 출고 요청 건 또는 복수의 투입일이 존재하는 경우 가장 최근 출고 요청 건을 기본 선택하여 대량 페이지 일괄 생성을 방지
    if (contractOutboundDeliveries.length > 0 && (contractOutboundDeliveries.length > 1 || availableStartDates.length > 1)) {
      setFilterDate(`DELIVERY:${contractOutboundDeliveries[0].id}`);
      return;
    }
    if (availableStartDates.length > 1) {
      setFilterDate(availableStartDates[availableStartDates.length - 1]);
    } else {
      setFilterDate('ALL');
    }
  }, [selectedContractId, initialDeliveryId, initialContractId, contractOutboundDeliveries.length, availableStartDates.length]);

  useEffect(() => {
    if (isOpen) {
      const nextContractId = initialContractId || contracts[0]?.id || '';
      setSelectedContractId(nextContractId);
      if (initialDeliveryId) {
        setFilterDate(`DELIVERY:${initialDeliveryId}`);
      }
    }
  }, [isOpen, initialContractId, initialDeliveryId, contracts]);

  // 생성 진행 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [generatedResult, setGeneratedResult] = useState<{ 
    filePath: string; 
    fileName: string; 
    pageCount: number; 
    url: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 이메일 수신인 및 발송 상태
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [manualInputEmail, setManualInputEmail] = useState('');
  const [manualInputName, setManualInputName] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [isEmailContentOpen, setIsEmailContentOpen] = useState(false);

  // 선택된 계약 상세 정보 계산
  const selectedContract = useMemo(() => {
    return contracts.find(c => c.id === selectedContractId) || contracts[0];
  }, [contracts, selectedContractId]);

  const customer = useMemo(() => {
    if (!selectedContract) return null;
    return customers.find(cust => cust.id === selectedContract.customerId);
  }, [customers, selectedContract]);

  const site = useMemo(() => {
    if (!selectedContract) return null;
    return (
      sites?.find(s => s.id === selectedContract.siteId) ||
      sites?.find(
        s =>
          s.customerId === selectedContract.customerId &&
          s.name &&
          s.name.trim() === ((selectedContract as any).siteName || '').trim()
      ) ||
      null
    );
  }, [sites, selectedContract]);

  // 해당 계약의 출고 배차 조회 (선택된 출고 요청 건 최우선 -> 투입일자 매칭 -> 최근 활성 출고/교환 배차 순)
  const outboundDelivery = useMemo(() => {
    if (!selectedContract) return null;
    const candidates = (deliveries || [])
      .filter(d => d.contractId === selectedContract.id && d.status !== 'CANCELLED' && (d.type === 'OUTBOUND' || d.type === 'EXCHANGE' || d.dispatchCategory === '출고' || d.dispatchCategory === '교환'))
      .sort((a, b) => String(b.createdAt || b.id).localeCompare(String(a.createdAt || a.id)));
    if (filterDate.startsWith('DELIVERY:')) {
      const targetDelId = filterDate.slice('DELIVERY:'.length);
      const exactDel = candidates.find(d => d.id === targetDelId);
      if (exactDel) return exactDel;
    }
    if (filterDate !== 'ALL') {
      const byDate = candidates.find(d =>
        d.loadingDate === filterDate ||
        d.unloadingDate === filterDate ||
        d.scheduledDate === filterDate ||
        (d.cargoItems && contractAssets.some(ca => ca.contractId === selectedContract.id && ca.startDate === filterDate && d.cargoItems!.includes(ca.id)))
      );
      if (byDate) return byDate;
    }
    return candidates[0] || null;
  }, [deliveries, selectedContract, filterDate, contractAssets]);

  // 기준 배차일 (점검일시 D-2 자동 계산용: 상차일 최우선)
  const baseDeliveryDate = useMemo(() => {
    if (filterDate.startsWith('DELIVERY:')) {
      return outboundDelivery?.loadingDate || outboundDelivery?.scheduledDate || outboundDelivery?.unloadingDate || selectedContract?.startDate || new Date().toISOString().split('T')[0];
    }
    if (filterDate !== 'ALL') {
      return outboundDelivery?.loadingDate || outboundDelivery?.scheduledDate || outboundDelivery?.unloadingDate || filterDate;
    }
    return outboundDelivery?.scheduledDate || outboundDelivery?.loadingDate || outboundDelivery?.unloadingDate || selectedContract?.startDate || new Date().toISOString().split('T')[0];
  }, [outboundDelivery, selectedContract, filterDate]);

  // 장비 인도 일시 (출고 요청의 희망 하차일 최우선 -> 미지정 시 상차일/계약시작일)
  const equipmentUnloadingDate = useMemo(() => {
    const extractYmd = (raw?: string | null): string => {
      if (!raw) return '';
      const m = String(raw).trim().match(/\d{4}-\d{2}-\d{2}/);
      return m ? m[0] : '';
    };
    if (outboundDelivery) {
      if (outboundDelivery.unloadingDate) {
        const d = extractYmd(outboundDelivery.unloadingDate);
        if (d) return d;
      }
      if (outboundDelivery.cargoItems) {
        try {
          const parsed = JSON.parse(outboundDelivery.cargoItems);
          const metaUnload = Array.isArray(parsed) ? parsed.find((ci: any) => ci?.requestMeta)?.requestMeta?.unloadingTime : undefined;
          const d = extractYmd(metaUnload);
          if (d) return d;
        } catch {}
      }
      if (outboundDelivery.memo) {
        const mUnload = outboundDelivery.memo.match(/(?:하차일정\]|하차:)\s*(\d{4}-\d{2}-\d{2})/);
        if (mUnload?.[1]) return mUnload[1];
      }
      const fallbackDel = extractYmd(outboundDelivery.loadingDate || outboundDelivery.scheduledDate);
      if (fallbackDel) return fallbackDel;
    }
    if (filterDate !== 'ALL' && !filterDate.startsWith('DELIVERY:')) {
      return filterDate;
    }
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return selectedContract?.startDate || todayLocal;
  }, [outboundDelivery, selectedContract, filterDate]);

  // 계약일 (출고 요청을 입력한 날 = 주문 접수일 최우선)
  const orderReceivedDate = useMemo(() => {
    const toLocalYmd = (raw?: string | null): string => {
      if (!raw) return '';
      const trimmed = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      const m = trimmed.match(/\d{4}-\d{2}-\d{2}/);
      return m ? m[0] : '';
    };
    if (outboundDelivery) {
      if (outboundDelivery.cargoItems) {
        try {
          const parsed = JSON.parse(outboundDelivery.cargoItems);
          const requestedAt = Array.isArray(parsed) ? parsed.find((ci: any) => ci?.requestMeta)?.requestMeta?.requestedAt : undefined;
          const d = toLocalYmd(requestedAt);
          if (d) return d;
        } catch {}
      }
      if (outboundDelivery.createdAt) {
        const d = toLocalYmd(outboundDelivery.createdAt);
        if (d) return d;
      }
      if (outboundDelivery.requestDate) {
        const d = toLocalYmd(outboundDelivery.requestDate);
        if (d) return d;
      }
    }
    if (selectedContract?.createdAt) {
      const d = toLocalYmd(selectedContract.createdAt);
      if (d) return d;
    }
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return toLocalYmd(selectedContract?.startDate) || todayLocal;
  }, [outboundDelivery, selectedContract]);

  // 배차일 기준 2일 전 자동 계산
  const defaultInspectionDate = useMemo(() => {
    if (!baseDeliveryDate) return new Date().toISOString().split('T')[0];
    const cleanDate = baseDeliveryDate.replace(/[^0-9-]/g, '').slice(0, 10);
    const d = new Date(cleanDate);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    d.setDate(d.getDate() - 2);
    return d.toISOString().split('T')[0];
  }, [baseDeliveryDate]);

  const [customInspectionDate, setCustomInspectionDate] = useState<string>('');
  const [customInspectorName, setCustomInspectorName] = useState<string>('');
  const [freightBillingStandard, setFreightBillingStandard] = useState<'2/4' | '3/5'>('3/5');

  const defaultFreightBillingStandard = useMemo<'2/4' | '3/5'>(() => {
    const checkDelivery = (del?: any): '2/4' | '3/5' | null => {
      if (!del) return null;
      if (del.cargoItems) {
        try {
          const parsed = JSON.parse(del.cargoItems);
          const metaStd = Array.isArray(parsed)
            ? parsed.find((ci: any) => ci?.requestMeta?.freightBillingStandard)?.requestMeta?.freightBillingStandard
            : undefined;
          if (metaStd === '2/4' || metaStd === '3/5') return metaStd;
        } catch {}
      }
      const combinedText = `${del.memo || ''} ${del.rawText || ''}`;
      if (combinedText.includes('[운송료청구기준] 2/4') || combinedText.includes('운송료청구기준: 2/4')) return '2/4';
      if (combinedText.includes('[운송료청구기준] 3/5') || combinedText.includes('운송료청구기준: 3/5')) return '3/5';
      return null;
    };

    const fromTarget = checkDelivery(outboundDelivery);
    if (fromTarget) return fromTarget;

    for (const entry of contractOutboundDeliveries) {
      const fromEntry = checkDelivery(entry.delivery);
      if (fromEntry) return fromEntry;
    }
    if (selectedContract?.freightBillingStandard === '2/4' || selectedContract?.freightBillingStandard === '3/5') {
      return selectedContract.freightBillingStandard;
    }
    return '3/5';
  }, [outboundDelivery, contractOutboundDeliveries, selectedContract]);

  useEffect(() => {
    setFreightBillingStandard(defaultFreightBillingStandard);
  }, [defaultFreightBillingStandard]);

  const defaultInspectorName = useMemo(() => {
    return '김관주';
  }, []);

  useEffect(() => {
    setCustomInspectionDate(defaultInspectionDate);
  }, [defaultInspectionDate]);

  useEffect(() => {
    setCustomInspectorName(defaultInspectorName);
  }, [defaultInspectorName]);

  useEffect(() => {
    setGeneratedResult(null);
    setEmailSentSuccess(false);
    setErrorMessage(null);
  }, [selectedContractId, filterDate, customInspectionDate, customInspectorName, freightBillingStandard]);

  const mappedAssets = useMemo(() => {
    if (!selectedContract) return [];
    let caList = contractAssets.filter(
      ca => ca.contractId === selectedContract.id && ca.status !== 'RETURNED' && ca.status !== 'SOLD'
    );
    
    if (filterDate.startsWith('DELIVERY:')) {
      const targetDelId = filterDate.slice('DELIVERY:'.length);
      const delEntry = contractOutboundDeliveries.find(x => x.id === targetDelId);
      const targetCaIds = new Set<string>([
        ...(delEntry?.caIds || []),
        ...(initialDeliveryId === targetDelId && Array.isArray(initialContractAssetIds) ? initialContractAssetIds : [])
      ]);
      if (targetCaIds.size > 0) {
        caList = caList.filter(ca => targetCaIds.has(ca.id));
      } else if (delEntry?.delivery?.loadingDate) {
        caList = caList.filter(ca => ca.startDate === delEntry.delivery.loadingDate);
      }
    } else if (filterDate !== 'ALL') {
      caList = caList.filter(ca => ca.startDate === filterDate);
    }

    const mapped = caList.map(ca => {
      const a = assets.find(ast => ast.id === ca.assetId) || db.assets.find(ast => ast.id === ca.assetId);
      const rawModel = a?.modelName || ca.expectedModel || 'GS-2646';
      const upperModel = rawModel.trim().toUpperCase();
      const canonicalModel = getCanonicalModelKey(rawModel);

      // 💡 1. 모델 마스터 조회 (정확 일치 -> 대소문자 무관 -> 축약명 -> 정규화 키 순)
      const allProducts = products.length > 0 ? products : db.products;
      const prod =
        allProducts.find(p => p.modelName === rawModel) ||
        allProducts.find(p => (p.modelName || '').trim().toUpperCase() === upperModel) ||
        allProducts.find(p => p.shortName && p.shortName.trim().toUpperCase() === upperModel) ||
        allProducts.find(p => getCanonicalModelKey(p.modelName) === canonicalModel);

      const preset =
        PRESET_PRODUCT_SPECS[prod?.modelName || ''] ||
        PRESET_PRODUCT_SPECS[upperModel] ||
        Object.values(PRESET_PRODUCT_SPECS).find(ps => getCanonicalModelKey(ps.modelName) === canonicalModel);

      const model = prod?.modelName || preset?.modelName || rawModel;

      // 💡 2. 모델별 안전인증일: Product 마스터 -> 안전인증서 URL 파일명 -> Preset 순
      const resolvedCertDate =
        prod?.safetyCertDate ||
        (prod as any)?.certDate ||
        extractCertDateFromText(prod?.safetyCertUrl) ||
        preset?.safetyCertDate ||
        extractCertDateFromText(preset?.safetyCertUrl) ||
        '-';

      // 💡 3. 자산별 제조연도(연식): Asset 대장의 manufactureYear 사용 ('2025' -> '2025년', '2026년7월' -> '2026년7월')
      const rawYear = a?.manufactureYear ? String(a.manufactureYear).trim().replace(/월년$/, '월').replace(/년년$/, '년') : '';
      const resolvedManufactureYear = rawYear
        ? (/^\d{4}$/.test(rawYear) ? `${rawYear}년` : rawYear)
        : '-';

      const assetInspector = customInspectorName.trim() || defaultInspectorName;
      // 💡 02.반입전체크리스트 {점검일시} 값은 03.안전점검결과서 {{배차일)-2} 또는 {지정} 값과 100% 동일한 값 사용
      const unifiedInspectionDate = customInspectionDate || defaultInspectionDate;

      return {
        // [자산별 정보]
        caId: ca.id,
        assetNo: a?.assetNo || '-',
        sn: a?.serialNo || '',
        manufactureYear: resolvedManufactureYear,
        rentalFee: ca.monthlyRentalFee || a?.monthlyRentalFee || 0,
        inspectionDate: unifiedInspectionDate,
        inspectorName: assetInspector,
        // [자산별 제조사 최우선 -> 모델별 정보]
        modelName: model,
        manufacturer: a?.manufacturer || prod?.manufacturer || preset?.manufacturer || '-',
        powerSource: prod?.powerSource || preset?.powerSource || '배터리',
        weight: prod?.weight || preset?.weight || '-',
        speed: prod?.speed || preset?.speed || '-',
        workingHeight: prod?.workingHeight || preset?.workingHeight || '-',
        platformHeight: prod?.platformHeight || preset?.platformHeight || '-',
        capacityPreExt: prod?.capacityPreExt || preset?.capacityPreExt || '-',
        safetyCertDate: resolvedCertDate,
        certDate: resolvedCertDate
      };
    });

    return mapped.sort((a, b) => {
      const mCmp = String(a.modelName || '').localeCompare(String(b.modelName || ''), 'ko');
      if (mCmp !== 0) return mCmp;
      return String(a.assetNo || '').localeCompare(String(b.assetNo || ''), 'ko');
    });
  }, [selectedContract, contractAssets, assets, products, filterDate, contractOutboundDeliveries, initialDeliveryId, initialContractAssetIds, customInspectorName, customInspectionDate, defaultInspectorName, defaultInspectionDate]);

  // 💡 계약서 품목 테이블에 표기할 유상옵션 목록 산출 (오직 유상옵션(PAID)만 표기, 무상옵션·부착물·현장요구사양 제외)
  const mappedPaidOptions = useMemo(() => {
    if (!selectedContract) return [];
    const activeCaIds = new Set(mappedAssets.map(a => a.caId));
    const contractOutbounds = (deliveries || [])
      .filter(d => d.contractId === selectedContract.id && d.status !== 'CANCELLED' && (d.type === 'OUTBOUND' || d.type === 'EXCHANGE' || d.dispatchCategory === '출고' || d.dispatchCategory === '교환'))
      .sort((a, b) => String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id)));

    const matchedDeliveries = filterDate.startsWith('DELIVERY:')
      ? contractOutbounds.filter(d => d.id === filterDate.slice('DELIVERY:'.length))
      : filterDate !== 'ALL'
        ? contractOutbounds.filter(d => {
            if (d.loadingDate === filterDate || d.unloadingDate === filterDate || d.scheduledDate === filterDate) return true;
            if (d.cargoItems) {
              try {
                const parsed = JSON.parse(d.cargoItems);
                if (Array.isArray(parsed)) {
                  return parsed.some((ci: any) => Array.isArray(ci?.contractAssetIds) && ci.contractAssetIds.some((id: string) => activeCaIds.has(id)));
                }
              } catch {}
            }
            return false;
          })
        : contractOutbounds;

    const targetDeliveries = matchedDeliveries.length > 0 ? matchedDeliveries : contractOutbounds;
    const allMasters = (standardOptions && standardOptions.length > 0) ? standardOptions : (db.standardOptions || []);

    const optAccumulator = new Map<string, { name: string; quantity: number; unit: '월' | '대' | '건'; unitPrice: number; subTotal: number }>();

    for (const d of targetDeliveries) {
      let parsed: any[] = [];
      try {
        if (d.cargoItems) {
          const r = JSON.parse(d.cargoItems);
          if (Array.isArray(r)) parsed = r;
        }
      } catch { parsed = []; }

      const batchQty = parsed.reduce((s, ci) => s + (Number(ci?.count) || 1), 0) || mappedAssets.length || 1;
      const snapMeta = parsed[0]?.requestMeta;
      let paidStr = parsed[0]?.paidOptions || '';
      const priceMap: Record<string, number> = parsed[0]?.paidOptionPrices || snapMeta?.paidOptionPrices || {};
      const unitMap: Record<string, '월' | '대' | '건'> = parsed[0]?.paidOptionUnits || snapMeta?.paidOptionUnits || {};
      const qtyMap: Record<string, number> = parsed[0]?.paidOptionQtys || snapMeta?.paidOptionQtys || {};

      if (!paidStr && d.closingMemo) {
        const mOpt = d.closingMemo.match(/유상옵션:\s*([^|]+)/);
        if (mOpt && mOpt[1].trim() !== '없음') paidStr = mOpt[1].trim();
      }

      const optNames = splitMasterAwareOptions(paidStr, allMasters, { onlyMasterOptions: false, stripPrice: true })
        .filter(o => o && o !== '없음' && o !== 'NONE');

      for (const optName of optNames) {
        const cleanTarget = optName.replace(/\s+/g, '');
        const masterOpt = allMasters.find(so => so && so.name && so.name.replace(/\s+/g, '') === cleanTarget);
        // 유상옵션(PAID) 카테고리만 허용 (무상옵션/부착물/현장요구사양 제외)
        if (masterOpt && masterOpt.category !== 'PAID') continue;

        const customPrice = priceMap[optName];
        const unitPrice = customPrice !== undefined ? Number(customPrice) : Number(masterOpt?.defaultPrice || 0);
        const rawDefUnit = (masterOpt?.unit || '월').trim();
        const defUnit: '월' | '대' | '건' = rawDefUnit === '건' ? '건' : rawDefUnit === '대' ? '대' : '월';
        const customUnit = unitMap[optName];
        const unit: '월' | '대' | '건' = (customUnit === '건' || customUnit === '대' || customUnit === '월') ? customUnit : defUnit;
        const customPerUnitQty = qtyMap[optName] !== undefined ? qtyMap[optName] : (masterOpt as any)?.defaultQtyPerUnit;
        const perUnitQty = unit === '대' ? Math.max(1, Number(customPerUnitQty) || 1) : 1;
        const quantity = unit === '건' ? 1 : unit === '대' ? batchQty * perUnitQty : batchQty;
        const subTotal = unitPrice * quantity;

        const existing = optAccumulator.get(optName);
        if (existing) {
          existing.quantity += quantity;
          existing.subTotal += subTotal;
        } else {
          optAccumulator.set(optName, {
            name: optName,
            quantity,
            unit,
            unitPrice,
            subTotal
          });
        }
      }
    }

    return Array.from(optAccumulator.values());
  }, [selectedContract, deliveries, mappedAssets, filterDate, standardOptions]);

  // 고유 모델 목록
  const uniqueModelList = useMemo(() => {
    const models: string[] = [];
    mappedAssets.forEach(a => {
      if (a.modelName && !models.includes(a.modelName)) {
        models.push(a.modelName);
      }
    });
    return models.length > 0 ? models : ['GS-2646'];
  }, [mappedAssets]);

  // 등록된 현장(CustomerSite)에 저장된 담당자 및 수신인 풀 수집 (타 현장 담당자 무분별 유입 차단)
  const siteContactDirectory = useMemo(() => {
    const emailContacts: { id: string; name: string; position: string; email: string; phone?: string; typeLabel: string; roleLabel: string }[] = [];
    const noEmailContacts: { id: string; name: string; position: string; phone: string; roleLabel: string }[] = [];
    if (!site) return { emailContacts, noEmailContacts };

    const normPersonName = (raw?: string | null) =>
      String(raw || '')
        .replace(/\s+/g, '')
        .replace(/(과장님|차장님|부장님|대리님|소장님|팀장님|대표님|기사님|선임님|책임님|주임님|사원님|님|과장|차장|부장|대리|소장|팀장|대표|이사|선임|책임|주임|사원|공무과장|공무차장|공무대리|공무|안전관리자|안전담당|현장소장|현장담당자|현장담당|마감담당|장비담당|담당자|담당)$/g, '')
        .trim();

    const normPhoneDigits = (raw?: string | null) => String(raw || '').replace(/[^0-9]/g, '');

    const custContacts = (contacts || []).filter(
      c => c.customerId === site.customerId && c.isActive !== false
    );

    const resolveEmailFromCustomerContacts = (name?: string, phone?: string, explicitEmail?: string): string => {
      if (explicitEmail && explicitEmail.includes('@')) return explicitEmail;
      const pName = normPersonName(name);
      const pPhone = normPhoneDigits(phone);
      if (!pName && !pPhone) return '';

      const matched = custContacts.filter(cc => {
        const ccEmail = String(cc.email || '').trim();
        if (!ccEmail.includes('@')) return false;
        const ccPhone = normPhoneDigits(cc.contact);
        const ccName = normPersonName(cc.name);
        if (pPhone && pPhone.length >= 8 && ccPhone === pPhone) return true;
        if (pName && pName.length >= 2 && ccName === pName) return true;
        return false;
      });

      if (matched.length > 0) {
        return matched.map(m => m.email).filter(Boolean).join(', ');
      }
      return '';
    };

    const buildRoleLabel = (typeLabel: string, position?: string) => {
      const cleanPos = (position || '').trim();
      if (!cleanPos || cleanPos === typeLabel || cleanPos === '담당자' || cleanPos === '담당') {
        return typeLabel;
      }
      return `${typeLabel} · ${cleanPos}`;
    };

    const pushCandidate = (baseId: string, name: string, position: string, phone: string | undefined, rawEmail: string | undefined, typeLabel: string) => {
      const cleanName = (name || '').trim();
      const cleanPhone = (phone || '').trim();
      const resolvedRawEmail = resolveEmailFromCustomerContacts(cleanName, cleanPhone, rawEmail);
      const roleLabel = buildRoleLabel(typeLabel, position);

      if (resolvedRawEmail) {
        const parts = String(resolvedRawEmail).split(/[\s,;/]+/).map(e => e.trim()).filter(Boolean);
        let pushedAny = false;
        parts.forEach((em, i) => {
          if (em.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            pushedAny = true;
            emailContacts.push({
              id: parts.length > 1 ? `${baseId}-${i}` : baseId,
              name: cleanName || typeLabel,
              position: (position || '').trim() || typeLabel,
              email: em,
              phone: cleanPhone,
              typeLabel,
              roleLabel
            });
          }
        });
        if (pushedAny) return;
      }

      if (cleanName && cleanName !== '-' && cleanName !== site.name) {
        noEmailContacts.push({
          id: `${baseId}-noemail`,
          name: cleanName,
          position: (position || '').trim() || typeLabel,
          phone: cleanPhone,
          roleLabel
        });
      }
    };

    // 1) 등록된 현장의 contacts 배열 내 담당자 (장비담당 / 마감담당 / 안전담당 / 추가담당)
    if (site.contacts && site.contacts.length > 0) {
      site.contacts.filter(sc => sc.isActive !== false).forEach((sc, idx) => {
        const typeLabel =
          sc.contactType === 'EQUIPMENT' ? '장비담당' :
          sc.contactType === 'CLOSING' ? '마감담당' :
          sc.contactType === 'SAFETY' ? '안전담당' :
          sc.isPrimary ? '현장대표' : '현장담당';
        pushCandidate(
          `site-${site.id}-c-${sc.id || idx}`,
          sc.name || site.contactName || '',
          sc.position || typeLabel,
          sc.contact,
          sc.email,
          typeLabel
        );
      });
    }

    // 2) 등록된 현장의 기본/마감/안전 플랫 필드 보완
    if ((site.contactName && site.contactName.trim()) || (site.email && site.email.trim())) {
      pushCandidate(
        `site-${site.id}-eq`,
        site.contactName || site.name || '장비담당',
        '장비담당',
        site.contact,
        site.email,
        '장비담당'
      );
    }
    if ((site.billingContactName && site.billingContactName.trim()) || (site.billingContactEmail && site.billingContactEmail.trim())) {
      pushCandidate(
        `site-${site.id}-cl`,
        site.billingContactName || site.name || '마감담당',
        '마감담당',
        site.billingContactPhone,
        site.billingContactEmail,
        '마감담당'
      );
    }
    if ((site.safetyContactName && site.safetyContactName.trim()) || (site.safetyContactEmail && site.safetyContactEmail.trim())) {
      pushCandidate(
        `site-${site.id}-sf`,
        site.safetyContactName || site.name || '안전담당',
        '안전담당',
        site.safetyContactPhone,
        site.safetyContactEmail,
        '안전담당'
      );
    }

    // 3) 선택된 출고 요청(Delivery)에 현장담당자가 명시되어 있는 경우 보완
    if (outboundDelivery) {
      const delEntry = contractOutboundDeliveries.find(x => x.id === outboundDelivery.id);
      if (delEntry?.siteContactName && delEntry.siteContactName !== '-') {
        pushCandidate(
          `del-${outboundDelivery.id}-sc`,
          delEntry.siteContactName,
          '출고현장담당',
          delEntry.siteContactPhone,
          undefined,
          '현장담당'
        );
      }
    }

    // 이메일 기준 중복 제거
    const uniqueEmailMap = new Map<string, typeof emailContacts[0]>();
    emailContacts.forEach(item => {
      if (item.email && !uniqueEmailMap.has(item.email.toLowerCase())) {
        uniqueEmailMap.set(item.email.toLowerCase(), item);
      }
    });
    const dedupedEmailContacts = Array.from(uniqueEmailMap.values());

    // 이메일이 이미 확보된 담당자 이름은 미등록 목록에서 제외
    const namesWithEmail = new Set(dedupedEmailContacts.map(c => normPersonName(c.name)).filter(Boolean));
    const uniqueNoEmailMap = new Map<string, typeof noEmailContacts[0]>();
    noEmailContacts.forEach(item => {
      const key = normPersonName(item.name) || item.name;
      if (key && !namesWithEmail.has(key) && !uniqueNoEmailMap.has(key)) {
        uniqueNoEmailMap.set(key, item);
      }
    });

    return {
      emailContacts: dedupedEmailContacts,
      noEmailContacts: Array.from(uniqueNoEmailMap.values())
    };
  }, [site, contacts, outboundDelivery, contractOutboundDeliveries]);

  const availableCustomerContacts = siteContactDirectory.emailContacts;
  const siteContactsMissingEmail = siteContactDirectory.noEmailContacts;

  // ── 계약 변경 시 등록된 현장(CustomerSite)에 저장된 수신인만 자동 지정 ──
  useEffect(() => {
    if (!selectedContract || !isOpen) return;

    const initialList: RecipientItem[] = availableCustomerContacts.map((c, idx) => ({
      id: `recip-site-${site?.id || 'default'}-${idx}`,
      email: c.email,
      name: c.name,
      roleLabel: c.roleLabel,
      source: 'SITE'
    }));

    setRecipients(initialList);

    // 생성 결과 초기화
    setGeneratedResult(null);
    setErrorMessage(null);
    setEmailSentSuccess(false);
  }, [selectedContractId, site?.id, isOpen, currentTenant, availableCustomerContacts]);

  // 분할 발행 범위(출고 요청 건별 / 투입일별 / 전체) 변경 시 이메일 제목·본문 장비 대수 및 모델 목록 즉시 동기화
  useEffect(() => {
    if (!selectedContract || !isOpen) return;
    const custName = customer?.name || '고객사';
    const siteName = site?.name || '현장';
    const tenantBrand = currentTenant?.displayName || currentTenant?.tradeName || 'e-Bro Lift';
    const tenantCorp = currentTenant?.tradeName || currentTenant?.corporateName || tenantBrand;
    const tenantTel = currentTenant?.tel || '031-334-5296';
    const plugin = getTenantPlugin(currentTenant?.tenantCode || 'GIYEUN');
    const emailResult = plugin.templates.emails.contractBundle({
      custName,
      tenantCorp,
      tenantBrand,
      tenantTel,
      siteName,
      mappedAssetsCount: mappedAssets.length,
      uniqueModelList
    });
    setEmailSubject(emailResult.subject);
    setEmailBody(emailResult.body);
  }, [selectedContractId, filterDate, mappedAssets.length, uniqueModelList.join(','), isOpen, currentTenant]);

  // ── 수신인 추가 / 제거 핸들러 ──
  const handleRemoveRecipient = (id: string) => {
    setRecipients(prev => prev.filter(r => r.id !== id));
  };

  const handleAddManualRecipient = () => {
    const cleanEmail = manualInputEmail.trim();
    if (!cleanEmail) return;
    if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert('올바른 이메일 주소 형식을 입력해 주세요.');
      return;
    }
    if (recipients.some(r => r.email.toLowerCase() === cleanEmail.toLowerCase())) {
      alert('이미 추가된 이메일 주소입니다.');
      return;
    }

    setRecipients(prev => [
      ...prev,
      {
        id: `recip-manual-${Date.now()}`,
        email: cleanEmail,
        name: manualInputName.trim() || cleanEmail.split('@')[0],
        roleLabel: '직접입력',
        source: 'MANUAL'
      }
    ]);
    setManualInputEmail('');
    setManualInputName('');
  };

  const handleToggleContactRecipient = (contactItem: { name: string; position: string; email: string; typeLabel: string; roleLabel: string }) => {
    const exists = recipients.some(r => r.email.toLowerCase() === contactItem.email.toLowerCase());
    if (exists) {
      setRecipients(prev => prev.filter(r => r.email.toLowerCase() !== contactItem.email.toLowerCase()));
    } else {
      setRecipients(prev => [
        ...prev,
        {
          id: `recip-quick-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          email: contactItem.email,
          name: contactItem.name,
          roleLabel: contactItem.roleLabel,
          source: 'SITE'
        }
      ]);
    }
  };

  // ── 💡 핵심 PDF 조립 헬퍼 (로컬 에이전트 COM 엔진 가동) ──
  const buildBundlePdf = async (): Promise<{ filePath: string; fileName: string; pageCount: number; url: string; }> => {
    if (generatedResult?.filePath) {
      return generatedResult;
    }

    setIsGenerating(true);
    setProgressPercent(10);
    setProgressText('계약서패키지 조립 시작...');
    setErrorMessage(null);

    const custName = customer?.name || '고객사';
    const siteName = site?.name || '현장';
    const siteAddress = site?.address || customer?.address || '현장 주소';

    try {
      const activeTenantId = currentTenant?.id || import.meta.env.VITE_TENANT_ID || 'giyuen';
      const config = officialMailConfigs.find(c => (c.tenantId || 'giyuen') === activeTenantId) || officialMailConfigs[0];

      const tenantCorp = currentTenant?.corporateName || currentTenant?.tradeName || currentTenant?.displayName || '(주)기연리프트';

      // 💡 영업담당자 동적 산출 (1순위: 계약 배정 영업사원, 2순위: 현재 로그인 사용자, 3순위: 테넌트 대표/기본값)
      const salesUser = (selectedContract?.salespersonId ? users?.find(u => u.id === selectedContract.salespersonId) : null) || currentUser;
      const salesDuty = salesUser?.duty || salesUser?.position || '';
      const dynamicSalesRepName = salesUser?.name
        ? (salesDuty ? `${salesUser.name} ${salesDuty}` : salesUser.name)
        : (currentTenant?.representativeName ? `${currentTenant.representativeName} 대표` : '영업담당자');
      const dynamicSalesRepPhone = salesUser?.phone || currentTenant?.salesPhone || currentTenant?.tel || '010-0000-0000';

      // 💡 테넌트 주거래 입금계좌 포맷팅
      const primaryAccount = currentTenant?.bankAccounts?.[0];
      const bankAccountText = primaryAccount
        ? `${primaryAccount.bankName} ${primaryAccount.accountNumber} (${primaryAccount.accountHolder})`
        : '';

      // 💡 현장 담당자(장비담당자/대표담당자) 성명 및 휴대폰 번호 산출 (고객현장 CustomerSite SSOT 최우선, 대표자명·비전화번호 유입 원천 차단)
      const isValidPhoneText = (raw?: string | null): boolean => {
        if (!raw) return false;
        const digits = String(raw).replace(/[^0-9]/g, '');
        return digits.length >= 8 && digits.length <= 12;
      };
      const isGenericRoleTitle = (pos?: string | null): boolean => {
        const clean = String(pos || '').trim();
        return !clean || ['장비담당', '장비담당자', '현장담당', '현장담당자', '현장대표', '마감담당', '마감담당자', '안전담당', '안전담당자', '담당자', '담당'].includes(clean);
      };
      const activeSiteContacts = (site?.contacts || []).filter(
        c => c && c.isActive !== false && (c.name || '').trim() && (c.name || '').trim() !== '-'
      );
      const targetDelEntry = filterDate.startsWith('DELIVERY:')
        ? contractOutboundDeliveries.find(x => x.id === filterDate.slice('DELIVERY:'.length))
        : (outboundDelivery ? contractOutboundDeliveries.find(x => x.id === outboundDelivery.id) : undefined);

      const delContactName = (targetDelEntry?.siteContactName || '').trim();
      const delContactPhone = (targetDelEntry?.siteContactPhone || '').trim();
      const ceoNameTrimmed = (customer?.representative || '').trim();

      const matchedByDelName = (delContactName && delContactName !== '-' && delContactName !== ceoNameTrimmed)
        ? activeSiteContacts.find(c => (c.name || '').trim() === delContactName && c.contactType !== 'CLOSING')
        : undefined;

      const primarySiteContact =
        matchedByDelName ||
        activeSiteContacts.find(c => c.contactType === 'EQUIPMENT' && c.isPrimary) ||
        activeSiteContacts.find(c => c.contactType === 'EQUIPMENT') ||
        activeSiteContacts.find(c => c.isPrimary && c.contactType !== 'CLOSING') ||
        activeSiteContacts.find(c => c.contactType !== 'CLOSING' && c.contactType !== 'SAFETY') ||
        activeSiteContacts[0];

      const resolvedSiteManagerName = (() => {
        if (primarySiteContact?.name) {
          const baseName = primarySiteContact.name.trim();
          const pos = (primarySiteContact.position || '').trim();
          if (pos && !isGenericRoleTitle(pos) && !baseName.endsWith(pos)) {
            return `${baseName} ${pos}`;
          }
          return baseName;
        }
        const flatSiteName = (site?.contactName || '').trim();
        if (flatSiteName && flatSiteName !== '-' && flatSiteName !== ceoNameTrimmed) {
          return flatSiteName;
        }
        if (delContactName && delContactName !== '-' && delContactName !== ceoNameTrimmed) {
          return delContactName;
        }
        return '';
      })();

      const resolvedSiteManagerPhone = (() => {
        if (primarySiteContact?.contact && isValidPhoneText(primarySiteContact.contact)) {
          return primarySiteContact.contact.trim();
        }
        if (site?.contact && isValidPhoneText(site.contact)) {
          return site.contact.trim();
        }
        if (delContactPhone && isValidPhoneText(delContactPhone)) {
          return delContactPhone;
        }
        const anyPhoneContact = activeSiteContacts.find(c => isValidPhoneText(c.contact));
        if (anyPhoneContact?.contact) {
          return anyPhoneContact.contact.trim();
        }
        return '';
      })();

      const bundleOptions = {
        customerName: custName,
        tenantName: tenantCorp,
        corporateName: currentTenant?.corporateName || tenantCorp,
        businessNumber: currentTenant?.businessNumber || '138-81-83251',
        representativeName: currentTenant?.representativeName || '이수용',
        stampImageUrl: currentTenant?.stampImageUrl || '',
        bankAccount: bankAccountText,
        bankAccounts: currentTenant?.bankAccounts || [],
        bankName: primaryAccount?.bankName || '',
        accountNumber: primaryAccount?.accountNumber || '',
        accountHolder: primaryAccount?.accountHolder || '',
        bizRegNo: customer?.bizRegNo || '118-81-00241',
        ceoName: customer?.representative || '대표자',
        contractDate: orderReceivedDate,
        contractStartDate: equipmentUnloadingDate,
        contractEndDate: selectedContract.endDate,
        deliveryDate: equipmentUnloadingDate,
        unloadingDate: equipmentUnloadingDate,
        remarksText: '',
        inspectionDate: customInspectionDate || defaultInspectionDate,
        inspectorName: customInspectorName.trim() || defaultInspectorName,
        siteName: siteName,
        siteAddress: siteAddress,
        contractNo: selectedContract.id,
        managerName: resolvedSiteManagerName,
        managerPhone: resolvedSiteManagerPhone,
        siteManagerName: resolvedSiteManagerName,
        siteManagerPhone: resolvedSiteManagerPhone,
        salesRepName: dynamicSalesRepName,
        salesRepPhone: dynamicSalesRepPhone,
        freightBillingStandard,
        minRentalMonths: freightBillingStandard === '2/4' ? '2' : '3',
        baseRentalMonths: freightBillingStandard === '2/4' ? '4' : '5',
        optionsText: '',
        paidOptions: mappedPaidOptions,
        assets: mappedAssets.length > 0 ? mappedAssets : undefined,
        r2Config: config ? {
          accountId: config.r2AccountId,
          bucketName: config.r2BucketName,
          accessKeyId: config.r2AccessKeyId,
          secretAccessKey: config.r2SecretAccessKey,
          publicDomain: config.r2PublicDomain,
        } : undefined,
        excelMappingRules: currentTenant?.excelMappingRules,
      };

      setProgressText('로컬 에이전트 정품 엑셀 엔진 가동 중...');
      setProgressPercent(40);

      const agentResp = await fetchWithAgentFallback('/api/generate-contract-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bundleOptions, asyncQueue: true }),
        requireAgent: true,
        actionName: '계약서 패키지 PDF 생성'
      });

      if (!agentResp.ok) {
        const errJson = await agentResp.json().catch(() => null);
        throw new Error(errJson?.error ? `에이전트 오류: ${errJson.error}` : `에이전트 응답 오류: HTTP ${agentResp.status}`);
      }

      let agentRes = await agentResp.json();

      if (agentRes.queued && agentRes.jobId) {
        const jobId = agentRes.jobId;
        setProgressText(`에이전트 큐(${jobId})에서 엑셀 조립 및 PDF 병합 진행 중...`);
        setProgressPercent(50);

        let nullJobCount = 0;
        while (true) {
          await new Promise(r => setTimeout(r, 1200));
          try {
            const pollResp = await fetchWithAgentFallback(`/api/job-queue?jobId=${encodeURIComponent(jobId)}`, {
              method: 'GET',
              skipPrecheck: true
            });
            if (pollResp.ok) {
              const pollData = await pollResp.json();
              const job = pollData.job;
              if (job) {
                nullJobCount = 0;
                if (job.status === 'COMPLETED' && job.result) {
                  agentRes = job.result;
                  break;
                } else if (job.status === 'FAILED') {
                  throw new Error(job.error || '에이전트 큐 작업 중 오류가 발생했습니다.');
                } else {
                  setProgressPercent(prev => Math.min(88, prev + 6));
                }
              } else {
                nullJobCount++;
                if (nullJobCount >= 10) {
                  throw new Error(`에이전트 작업 큐에서 작업(${jobId})을 찾을 수 없습니다. 에이전트가 재시작되었거나 구버전일 수 있습니다.`);
                }
              }
            }
          } catch (pollErr: any) {
            if (pollErr?.message?.includes('큐 작업 중 오류') || pollErr?.message?.includes('찾을 수 없습니다')) {
              throw pollErr;
            }
            // 일시적 루프백 지연 시 다음 폴링 주기로 안전 재시도
          }
        }
      }

      const returnedPath = agentRes.localPath || agentRes.filePath || agentRes.localFilePath;
      if (!agentRes.success || !returnedPath) {
        throw new Error(agentRes.error || '에이전트에서 PDF 생성 및 문서고 저장에 실패했습니다. (경로가 반환되지 않았습니다.)');
      }

      const tenantBrand = currentTenant?.displayName || currentTenant?.tradeName || 'e-Bro Lift';
      const finalRes = {
        url: '',
        filePath: returnedPath,
        fileName: agentRes.fileName || `[${tenantBrand}]_계약서패키지_${custName}_${siteName}(${agentRes.pageCount || 37}p).pdf`,
        pageCount: agentRes.pageCount || 37
      };

      setProgressPercent(100);
      let successMsg = `총 ${finalRes.pageCount}페이지 계약서패키지 조립 완료`;
      if (agentRes.missingAttachments && agentRes.missingAttachments.length > 0) {
        successMsg += ` (일부 첨부 미보유: ${agentRes.missingAttachments.join(', ')})`;
      }
      setProgressText(successMsg);
      setGeneratedResult(finalRes);
      return finalRes;
    } catch (err: any) {
      const msg = err.message || 'PDF 생성 중 오류가 발생했습니다.';
      setErrorMessage(msg);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  // ── [액션 1, 2 공통] 로컬 문서고 PDF 파일 즉시 열기 (base64 전송 없이 에이전트가 로컬 파일 오픈) ──
  const handleOpenLocalFile = async () => {
    try {
      let pdf = generatedResult;
      if (!pdf || !pdf.filePath) {
        pdf = await buildBundlePdf();
      }

      const openResp = await fetchWithAgentFallback('/api/open-local-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: pdf.filePath }),
        requireAgent: true,
        actionName: '로컬 PDF 파일 열기'
      });
      if (!openResp.ok) {
        const errJson = await openResp.json().catch(() => null);
        throw new Error(errJson?.error || `로컬 파일 열기 실패 (HTTP ${openResp.status})`);
      }
    } catch (err: any) {
      showErrorModal?.(`파일 열기 실패:\n${err.message || err}`);
    }
  };

  const handleDownloadPdf = handleOpenLocalFile;
  const handlePreviewPdf = handleOpenLocalFile;

  // ── [액션 3] 계약서패키지 이메일 발송 핸들러 (1-A, 2-A, 3-yes 완벽 적용) ──
  const handleSendPackageEmail = async () => {
    if (recipients.length === 0) {
      alert('이메일 수신인을 1명 이상 지정해 주세요.');
      return;
    }

    setIsSendingEmail(true);
    try {
      // 1. PDF가 아직 없으면 논스톱 자동 조립 실행
      let pdf = generatedResult;
      if (!pdf || !pdf.filePath) {
        pdf = await buildBundlePdf();
      }

      // 2. 단일 메일에 복수 수신인(TO: 1번째, CC: 나머지) 바인딩
      const primaryRecipient = recipients[0].email;
      const ccRecipients = recipients.slice(1).map(r => r.email).join(', ');

      if (!pdf || !pdf.filePath) {
        throw new Error('[증빙 부재 발송 차단] 계약서패키지 실물 PDF 조립 및 저장이 완료되지 않아 발송을 중단합니다. (증빙 없는 계약서 발송 금지)');
      }

      const attachments = [{ filename: pdf.fileName, localPath: pdf.filePath }];

      const tenantBrand = currentTenant?.displayName || currentTenant?.tradeName || 'e-Bro Lift';
      const tenantCorp = currentTenant?.tradeName || currentTenant?.corporateName || tenantBrand;

      // 3. Gmail SMTP 서비스 호출
      await emailService.sendEmail(
        primaryRecipient,
        emailSubject,
        emailBody,
        attachments,
        ccRecipients || undefined,
        tenantCorp
      );

      // 4. 계약 변경 이력에 감사 로그 DB 저장
      // 메일은 이미 발송되어 철회 불가. 이력 저장 실패 시 무음 처리하지 않고 오류 모달로 표출한다.
      let historySaved = true;
      try {
        const historyId = db.generateNextId('contractHistory', db.contractHistory);
        const recipientSummary = recipients.map(r => `${r.name ? `${r.name}(${r.email})` : r.email}`).join(', ');
        const senderName = currentUser?.name || '영업담당';

        db.insertRow<any>('contractHistory', {
          id: historyId,
          contractId: selectedContract.id,
          changeType: 'DOCUMENT_SENT',
          description: `계약서패키지 이메일 발송 완료 (총 ${recipients.length}명: ${recipientSummary} / 발송자: ${senderName})`,
          changeDate: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString()
        });

        // 💡 계약 레코드에 패키지 발송 일시 직접 저장 (즉각적인 배지 상태 반영)
        db.updateRow<any>('contracts', selectedContract.id, {
          packageSentAt: new Date().toISOString()
        });

        // 🌟 [ToDo 자동 상계]: 계약서패키지 재발송 ToDo가 존재했다면 원자적 자동 완료
        await clearHandoverTasks({
          entityType: 'CONTRACT',
          entityId: selectedContract.id,
          category: 'CONTRACT_PACKAGE_RESEND',
          completedByUserId: currentUser?.id,
          completedByName: currentUser?.name || senderName,
          completionAction: 'PACKAGE_RESENT',
          resolutionNote: `계약서패키지 이메일 재발송 완료 (${recipients.length}명 수신)`
        });

        await db.awaitPendingWrites();
      } catch (histErr: any) {
        historySaved = false;
        console.error('발송 이력 저장 실패:', histErr);
        showErrorModal?.(`계약서패키지 이메일은 발송되었으나 발송 이력 DB 저장에 실패했습니다.\n계약 변경 이력과 발송 상태가 기록되지 않았습니다.\n${histErr?.message || histErr}`);
      }

      setEmailSentSuccess(true);
      alert(`계약서패키지 이메일이 성공적으로 발송되었습니다!\n\n• 수신인: ${primaryRecipient}\n${ccRecipients ? `• 참조: ${ccRecipients}\n` : ''}• 제목: ${emailSubject}\n• 첨부: ${pdf.fileName} (${pdf.pageCount}p)${historySaved ? '\n• 계약 변경 이력 DB 기록 완료' : '\n• 발송 이력 DB 기록 실패'}`);
    } catch (err: any) {
      console.error('이메일 발송 실패:', err);
      const errMsg = String(err?.message || err || '');
      // 로컬 에이전트 미실행/통신 불가의 경우에만 전용 안내 모달이 뜨므로, 그 외(SMTP 인증 오류 등)는 상세 에러 모달을 즉시 표출
      if (!errMsg.includes('eBroAgent)가 실행되고 있지 않습니다') && !errMsg.includes('eBroAgent)와 통신할 수 없습니다')) {
        showErrorModal?.(`이메일 발송 실패:\n${errMsg}`);
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '20px'
      }}
    >
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* 모달 헤더 */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-app)',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              계약서패키지 PDF 생성 및 이메일 발송
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 1. 권한 없음 경고 배너 */}
          {!canGeneratePackage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', color: 'var(--danger)', fontSize: '13px' }}>
              <AlertCircle size={18} />
              <div>
                <strong>계약서 패키지 생성 권한 없음</strong>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  현재 사용자 계정에 계약서 패키지 생성 권한이 부여되지 않았습니다. 관리자에게 문의하세요.
                </span>
              </div>
            </div>
          )}

          {/* 2. 에이전트 오프라인 경고 배너 */}
          {!agentChecking && isAgentOnline === false && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '8px', color: 'var(--warning)', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>로컬 에이전트(eBroAgent, 포트 5175) 통신 대기</strong>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    엑셀 COM 엔진을 통한 계약서 번들 PDF 생성을 위해 PC에서 eBroAgent가 가동 중이어야 합니다.
                    {typeof window !== 'undefined' && window.location.protocol === 'https:' && (
                      <span style={{ display: 'block', marginTop: '3px', color: '#ea580c' }}>
                        * HTTPS 보안 정책 안내: ebro web agent 확장 프로그램 활성화 또는 주소창 좌측 사이트 설정 ➔ '기기에서 호스팅되는 앱' 허용 필요
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    setAgentChecking(true);
                    try {
                      const res = await fetchWithAgentFallback('/health', { method: 'GET', signal: AbortSignal.timeout(2500) });
                      setIsAgentOnline(res.ok);
                      setGlobalAgentStatus(res.ok);
                    } catch (e) {
                      setIsAgentOnline(false);
                    } finally {
                      setAgentChecking(false);
                    }
                  }}
                  style={{ padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={13} /> 재점검
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => launchLocalAgentFromBrowser()}
                  style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Play size={13} /> 에이전트 실행
                </button>
              </div>
            </div>
          )}

          {/* 3. 에이전트 정상 온라인 상태 배너 */}
          {!agentChecking && isAgentOnline === true && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '6px', color: 'var(--success)', fontSize: '12px' }}>
              <CheckCircle2 size={15} />
              <span>로컬 에이전트 정상 연결됨 (포트 5175, 엑셀 COM 자동화 및 PDF 생성 준비 완료)</span>
            </div>
          )}

          {/* 1. 대상 계약 선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              대상 계약 선택 (계약 DB 연동)
            </label>
            <select
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              disabled={isGenerating || isSendingEmail}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '13.5px',
                fontWeight: 600,
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)'
              }}
            >
              {contracts.map(c => {
                const cust = customers.find(cust => cust.id === c.customerId);
                const s = sites?.find(site => site.id === c.siteId);
                const custName = cust?.name || '고객사미지정';
                const siteName = s?.name || '현장미지정';
                return (
                  <option key={c.id} value={c.id}>
                    {c.contractNo || c.id} {custName} — {siteName} ({c.startDate} ~ {formatContractEndDate(c.endDate)})
                  </option>
                );
              })}
            </select>
          </div>

          {/* 출고 요청 건별 / 투입일별 분할 출력 필터 */}
            {(contractOutboundDeliveries.length > 0 || availableStartDates.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', padding: '12px', backgroundColor: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Filter size={14} color="var(--primary)" /> 계약서패키지 분할 발행 (출고 요청 건별 / 투입일별)
                  </span>
                  {filterDate.startsWith('DELIVERY:') && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)', fontWeight: 700 }}>
                      출고 요청 지정됨 ({mappedAssets.length}대)
                    </span>
                  )}
                </label>
                <select
                  className="form-input"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  style={{ width: '100%', fontSize: '13px', fontWeight: 600 }}
                  disabled={isGenerating || emailSentSuccess}
                >
                  {contractOutboundDeliveries.length > 0 && (
                    <optgroup label="출고 요청 건별 분리 생성 (권장)">
                      {contractOutboundDeliveries.map(item => (
                        <option key={`DELIVERY:${item.id}`} value={`DELIVERY:${item.id}`}>
                          [출고 요청] {item.dateLabel} 상차 · {item.id} ({item.modelSummary} — 총 {item.effectiveCount}대 / 할당 {item.assignedCount}대)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {availableStartDates.length > 0 && (
                    <optgroup label="투입일자별 분리 생성">
                      {availableStartDates.map(date => {
                        const count = contractAssets.filter(ca => ca.contractId === selectedContractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD' && ca.startDate === date).length;
                        return (
                          <option key={date} value={date}>
                            [투입일자] {date} 투입 장비 분리 생성 ({count}대)
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                  <optgroup label="계약 전체">
                    <option value="ALL">
                      전체 체결 자산 일괄 생성 ({contractAssets.filter(ca => ca.contractId === selectedContractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD').length}대)
                    </option>
                  </optgroup>
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  * 대형 현장에 누적 출고된 계약은 개별 출고 요청 건을 선택하여 당일 출고 장비만 계약서패키지로 신속하게 생성·발송할 수 있습니다.
                </span>
              </div>
            )}
            
            {/* 2. 선택된 계약 요약 카드 */}
          {selectedContract && (
            <div
              style={{
                backgroundColor: 'var(--bg-app)',
                borderRadius: '8px',
                padding: '12px 16px',
                border: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
                fontSize: '12.5px'
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '6px' }}>고객사:</span>
                <strong>{customer?.name || '미지정'}</strong> <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({customer?.bizRegNo || '사업자번호 미지정'})</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '6px' }}>현장명:</span>
                <strong>{site?.name || '현장미지정'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '6px' }}>계약일 / 장비 인도일시:</span>
                <span>계약일 <strong>{orderReceivedDate}</strong> · 인도(하차) <strong>{equipmentUnloadingDate}</strong></span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '6px' }}>투입 자산 ({mappedAssets.length}대):</span>
                <strong style={{ color: 'var(--primary)' }}>
                  {mappedAssets.length > 0
                    ? mappedAssets.map(a => a.modelName + ' (' + a.assetNo + ')').join(', ')
                    : 'GS-2646 (12대 기본 매핑)'}
                </strong>
              </div>
            </div>
          )}

          {/* 2-1. 반입전체크리스트 & 안전점검결과서 점검일시·점검자 설정 (배차일 D-2 자동 또는 직접 지정) */}
          <div style={{
            backgroundColor: 'var(--bg-app)',
            borderRadius: '8px',
            padding: '12px 16px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  점검일시:
                </span>
                <input
                  type="date"
                  value={customInspectionDate}
                  onChange={e => setCustomInspectionDate(e.target.value)}
                  disabled={isGenerating || isSendingEmail}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '13px',
                    fontWeight: 600,
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  점검자:
                </span>
                <input
                  type="text"
                  value={customInspectorName}
                  onChange={e => setCustomInspectorName(e.target.value)}
                  placeholder="점검자 성명"
                  disabled={isGenerating || isSendingEmail}
                  style={{
                    width: '100px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '13px',
                    fontWeight: 600,
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
              <span style={{
                fontSize: '11.5px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: customInspectionDate === defaultInspectionDate ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                color: customInspectionDate === defaultInspectionDate ? 'var(--primary)' : '#d97706',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}>
                {customInspectionDate === defaultInspectionDate ? `배차일 D-2 자동 산출 (${baseDeliveryDate} 기준)` : '사용자 지정 일자 적용'}
              </span>
            </div>
            {(customInspectionDate !== defaultInspectionDate || customInspectorName !== defaultInspectorName) && (
              <button
                type="button"
                onClick={() => {
                  setCustomInspectionDate(defaultInspectionDate);
                  setCustomInspectorName(defaultInspectorName);
                }}
                style={{
                  fontSize: '11.5px',
                  color: 'var(--primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                기본값({defaultInspectionDate} / {defaultInspectorName}) 복원
              </button>
            )}
          </div>

          {/* 3. 이메일 수신인 관리 섹션 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 16px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <Mail size={15} color="var(--primary)" />
                이메일 수신인 ({recipients.length}명 지정됨)
              </label>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                * 등록된 현장에 저장된 수신인 자동 지정됨 (임의 추가 및 삭제 가능)
              </span>
            </div>

            {/* 3-1. 선택된 수신인 칩 목록 */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                minHeight: '38px',
                padding: '8px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                alignItems: 'center'
              }}
            >
              {recipients.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                  지정된 수신인이 없습니다. 아래 선택 또는 직접 입력을 통해 추가해 주세요.
                </span>
              ) : (
                recipients.map(r => (
                  <div
                    key={r.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 8px 4px 10px',
                      borderRadius: '16px',
                      backgroundColor: r.source === 'DELIVERY' ? 'rgba(234, 88, 12, 0.12)' : 'var(--primary-light)',
                      border: `1px solid ${r.source === 'DELIVERY' ? 'rgba(234, 88, 12, 0.4)' : 'var(--primary)'}`,
                      color: r.source === 'DELIVERY' ? '#ea580c' : 'var(--primary)',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    <span>
                      {r.name ? `${r.name} ` : ''}
                      <span style={{ fontWeight: 400, opacity: 0.9 }}>&lt;{r.email}&gt;</span>
                      <span style={{ fontSize: '10.5px', marginLeft: '4px', opacity: 0.75 }}>({r.roleLabel})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(r.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '1px',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'inherit',
                        opacity: 0.8
                      }}
                      title="수신인 제거"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 3-2. 수신인 직접 입력창 */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={manualInputName}
                onChange={e => setManualInputName(e.target.value)}
                placeholder="이름/직책 (선택)"
                style={{
                  padding: '7px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px'
                }}
              />
              <input
                type="email"
                value={manualInputEmail}
                onChange={e => setManualInputEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddManualRecipient(); } }}
                placeholder="추가할 수신인 이메일 (예: manager@company.com)"
                style={{
                  padding: '7px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px'
                }}
              />
              <button
                type="button"
                onClick={handleAddManualRecipient}
                style={{
                  padding: '7px 14px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={14} /> 추가
              </button>
            </div>

            {/* 3-3. 등록된 현장 수신인 추가/제외 헬퍼 */}
            {(availableCustomerContacts.length > 0 || siteContactsMissingEmail.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={12} color="var(--primary)" />
                  등록된 현장 담당자 선택 (클릭하여 추가/제외):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {availableCustomerContacts.map(c => {
                    const isAdded = recipients.some(r => r.email.toLowerCase() === c.email.toLowerCase());
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleToggleContactRecipient(c)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: isAdded ? '1px solid var(--primary)' : '1px dashed var(--border-color)',
                          backgroundColor: isAdded ? 'var(--primary-light)' : 'var(--bg-card)',
                          color: isAdded ? 'var(--primary)' : 'var(--text-muted)',
                          fontSize: '11.5px',
                          fontWeight: isAdded ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isAdded ? <Check size={11} /> : <Plus size={11} />}
                        <span>{c.name} ({c.roleLabel})</span>
                        <span style={{ opacity: 0.7, fontSize: '10.5px' }}>&lt;{c.email}&gt;</span>
                      </button>
                    );
                  })}
                  {siteContactsMissingEmail.map(mc => (
                    <button
                      key={mc.id}
                      type="button"
                      onClick={() => setManualInputName(mc.name)}
                      title="이메일이 미등록된 현장 담당자입니다. 클릭 시 이름란에 입력됩니다."
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px dashed rgba(245, 158, 11, 0.5)',
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        color: '#b45309',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <span>{mc.name} ({mc.roleLabel}{mc.phone ? ` · ${mc.phone}` : ''})</span>
                      <span style={{ fontSize: '10.5px', opacity: 0.85 }}>[이메일 미등록]</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3-4. 이메일 발송 내용 (제목 및 본문 점검/편집) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 16px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <Mail size={15} color="var(--primary)" />
                이메일 발송 서식 및 본문
              </label>
              <button
                type="button"
                onClick={() => setIsEmailContentOpen(prev => !prev)}
                style={{
                  fontSize: '11.5px',
                  color: 'var(--primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                {isEmailContentOpen ? '내용 접기 ▲' : '내용 확인 및 수정 ▼'}
              </button>
            </div>

            {isEmailContentOpen ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    메일 제목
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    disabled={isGenerating || isSendingEmail}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '12.5px',
                      fontWeight: 600
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    메일 본문
                  </label>
                  <textarea
                    rows={9}
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    disabled={isGenerating || isSendingEmail}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '12px',
                      lineHeight: '1.5',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong style={{ color: 'var(--text-main)' }}>제목:</strong> {emailSubject || '메일 제목 생성 대기'}
              </div>
            )}
          </div>

          {/* 4. 계약서패키지 서류 구성 그리드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              계약서패키지 서류 구성 (첨부 실물 표준 순서)
            </label>
            <div
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-app)',
                padding: '12px 16px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="var(--success)" />
                <span><strong>1. 고소작업대 임대차 계약서</strong> (1p)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="var(--success)" />
                <span><strong>2. 자산별 반입전 체크리스트</strong> ({mappedAssets.length}대)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="var(--success)" />
                <span><strong>3. 자산별 안전점검 결과서</strong> ({mappedAssets.length}대)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="var(--primary)" />
                <span><strong>4. 모델별 정규문서 일체</strong> ({uniqueModelList.join(', ')})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="var(--primary)" />
                <span><strong>5. 생산물배상책임 보험증권</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="var(--primary)" />
                <span><strong>6. 사업자등록증</strong> (원본)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="var(--primary)" />
                <span><strong>7. 통장사본</strong> (원본)</span>
              </div>
            </div>
          </div>

          {/* 5. 진행 상태 게이지 */}
          {isGenerating && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--primary-light)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 700, color: 'var(--primary)' }}>
                <span>{progressText}</span>
                <span>{progressPercent}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: progressPercent + '%',
                    height: '100%',
                    backgroundColor: 'var(--primary)',
                    transition: 'width 0.2s ease-in-out'
                  }}
                />
              </div>
            </div>
          )}

          {/* 6. 에러 메시지 표출 */}
          {errorMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: '6px', color: 'var(--danger)', fontSize: '13px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 7. 조립 완료 배지 */}
          {generatedResult && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: '8px', color: 'var(--success)', fontSize: '12.5px', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCheck size={16} color="var(--success)" />
                <span>{generatedResult.fileName} (총 {generatedResult.pageCount}페이지 조립 완료)</span>
              </div>
              {emailSentSuccess && (
                <span style={{ fontSize: '11.5px', backgroundColor: 'var(--success)', color: '#fff', padding: '2px 8px', borderRadius: '10px' }}>
                  ✓ 이메일 발송 완료
                </span>
              )}
            </div>
          )}

        </div>

        {/* 모달 푸터 (2대 핵심 액션 버튼 배치) */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-app)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px'
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating || isSendingEmail}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              닫기
            </button>


          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {/* 1. PDF 다운로드 버튼 */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating || isSendingEmail || !canGeneratePackage || isAgentOnline === false}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--primary)',
                backgroundColor: (!canGeneratePackage || isAgentOnline === false) ? 'var(--bg-card)' : 'var(--primary-light)',
                color: (!canGeneratePackage || isAgentOnline === false) ? 'var(--text-muted)' : 'var(--primary)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: (isGenerating || !canGeneratePackage || isAgentOnline === false) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: (!canGeneratePackage || isAgentOnline === false) ? 0.5 : 1
              }}
            >
              {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : <FolderOpen size={14} />}
              문서고 저장 파일 열기
            </button>

            {/* 2. 이메일 발송 버튼 (논스톱 발송) */}
            <button
              type="button"
              onClick={handleSendPackageEmail}
              disabled={isGenerating || isSendingEmail || recipients.length === 0 || !canGeneratePackage || isAgentOnline === false}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: (!canGeneratePackage || recipients.length === 0 || isAgentOnline === false) ? 'var(--text-muted)' : 'var(--primary)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: (isGenerating || isSendingEmail || recipients.length === 0 || !canGeneratePackage || isAgentOnline === false) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: (canGeneratePackage && recipients.length > 0 && isAgentOnline !== false) ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
                opacity: (!canGeneratePackage || isAgentOnline === false) ? 0.5 : 1
              }}
            >
              {isSendingEmail ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {isSendingEmail ? '발송 중...' : `계약서패키지 이메일 발송 (${recipients.length}명)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

