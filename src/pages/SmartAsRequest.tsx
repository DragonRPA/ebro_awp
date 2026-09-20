// src/pages/SmartAsRequest.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { db } from '../services/db';
import { fetchMyDrafts, DraftDispatchOrder, discardDraft } from '../services/callUploadService';
import { matchHangul, sortCustomersByName } from '../utils/hangulSearch';
import { Wrench, Send, AlertTriangle, CheckCircle2, Search, Building2, MapPin, Phone, User, Tag, HelpCircle, PhoneCall, Sparkles, Clock, Check, ClipboardPaste, ChevronUp, ChevronDown, FolderOpen, Zap } from 'lucide-react';


export const SmartAsRequest: React.FC = () => {
  const { customers, sites, contracts, contractAssets, assets, fieldAsTickets, createFieldAsTicket, currentUser, showErrorModal, setActiveTab, inspectionChecklistItems } = useApp();
  const defectSymptoms = useMemo(() => { const list = inspectionChecklistItems.filter(i => i.isDefectSymptom).map(i => i.name); return list.length > 0 ? list : ["불량증상(설정요망)"]; }, [inspectionChecklistItems]);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const filteredCustomerList = useMemo(() => {
    const list = customers.filter(c =>
      !customerSearch.trim() ||
      matchHangul(c.name, customerSearch) ||
      matchHangul(c.representative, customerSearch)
    );
    return sortCustomersByName(list);
  }, [customers, customerSearch]);

  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedAssetNo, setSelectedAssetNo] = useState('');
  const [customAssetNo, setCustomAssetNo] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [reporterName, setReporterName] = useState(currentUser?.name || '');
  const [reporterContact, setReporterContact] = useState(currentUser?.phone || '');
  const [selectedCategory, setSelectedCategory] = useState('諛⑹?遊??묒갑');
  const [issueDescription, setIssueDescription] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessTicket, setSubmitSuccessTicket] = useState<any | null>(null);
  // ?좎뒪???뚮┝ ?곹깭 (?뚯옣 5.2: 釉뚮씪?곗? alert/confirm ?꾨㈃ ?댁텧)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ?? ?듯솕 ?뱀쓬 珥덉븞 ?섏떊 ???곹깭 ??
  const [asDrafts, setAsDrafts] = useState<DraftDispatchOrder[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  // ?? ?띿뒪??遺숈뿬?ｊ린 ?뚯떛 ?곹깭 ??
  const [pasteZoneOpen, setPasteZoneOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const txtFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTextFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setPasteText(evt.target.result as string);
        showToast('?뚯씪 ?댁슜??遺덈윭?붿뒿?덈떎.', 'success');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const runParse = React.useCallback((text: string) => {
    if (!text.trim()) { showToast('?띿뒪?몃? ?낅젰?섏꽭??', 'error'); return; }
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const extractPhone = (s: string) => {
      const m = s.match(/(01[016789]\s*[-~]?\s*\d{3,4}\s*[-~]?\s*\d{4})/g);
      return m ? m[0].replace(/\s+/g, '') : '';
    };

    const extractName = (s: string) => {
      let namePart = s.split(/01[016789]/)[0] || s;
      namePart = namePart.split(/[a-zA-Z0-9._%+-]+@/)[0] || namePart;
      return namePart.replace(/[:竊?-]/g, '').replace(/?좎엫|梨낆엫|?대떦???뚯옣|遺??怨쇱옣|?由????諛섏옣|?몄닔??g, '').trim();
    };

    let pCustomerName = '';
    let pSiteName = '';
    let pReporterName = '';
    let pReporterPhone = '';
    let pAssetNo = '';
    let pCategory = '湲고?/誘몃텇瑜?;
    let pIssueDesc = '';

    lines.forEach(line => {
      const val = line.includes(':')
        ? line.substring(line.indexOf(':') + 1).trim()
        : (line.includes('竊?) ? line.substring(line.indexOf('竊?) + 1).trim() : '');

      if (/^(?:\d+[.)]\s*)?(?:怨좉컼?щ챸?|怨좉컼紐??낆껜紐?|?곹샇紐?|?곹샇|諛쒖＜泥?/i.test(line)) {
        pCustomerName = val || line.replace(/^(?:\d+[.)]\s*)?(?:怨좉컼?щ챸?|怨좉컼紐??낆껜紐?|?곹샇紐?|?곹샇|諛쒖＜泥?\s*[:竊??\s*/i, '');
      } else if (/^(?:\d+[.)]\s*)?(?:?꾩옣紐?|?꾩옣)(?!\s*?곸꽭|\s*二쇱냼|\s*?대떦|\s*?뚯옣)/i.test(line)) {
        pSiteName = val || line.replace(/^(?:\d+[.)]\s*)?(?:?꾩옣紐?|?꾩옣)\s*[:竊??\s*/i, '');
      } else if (/^(?:\d+[.)]\s*)?(?:?곕씫泥??대떦???꾪솕踰덊샇|?좉퀬??/i.test(line)) {
        const raw = val || line.replace(/^(?:\d+[.)]\s*)?(?:?곕씫泥??대떦???꾪솕踰덊샇|?좉퀬??\s*[:竊??\s*/i, '');
        pReporterName = extractName(raw);
        pReporterPhone = extractPhone(raw);
      } else if (/^(?:\d+[.)]\s*)?(?:?λ퉬踰덊샇|?멸린|?먯궛踰덊샇|?λ퉬紐?/i.test(line)) {
        pAssetNo = val || line.replace(/^(?:\d+[.)]\s*)?(?:?λ퉬踰덊샇|?멸린|?먯궛踰덊샇|?λ퉬紐?\s*[:竊??\s*/i, '');
      } else if (/^(?:\d+[.)]\s*)?(?:怨좎옣利앹긽|利앹긽|?댁슜|?먮윭肄붾뱶|AS?댁슜)/i.test(line)) {
        pIssueDesc = val || line.replace(/^(?:\d+[.)]\s*)?(?:怨좎옣利앹긽|利앹긽|?댁슜|?먮윭肄붾뱶|AS?댁슜)\s*[:竊??\s*/i, '');
      }
    });

    if (pCustomerName) {
      const matchedCustomer = customers.find(c => 
        c.name.toLowerCase().includes(pCustomerName.toLowerCase()) ||
        pCustomerName.toLowerCase().includes(c.name.toLowerCase())
      );
      if (matchedCustomer) {
        setSelectedCustomerId(matchedCustomer.id);
        if (pSiteName) {
          const customerSites = sites.filter(s => s.customerId === matchedCustomer.id);
          const matchedSite = customerSites.find(s => 
            s.name.toLowerCase().includes(pSiteName.toLowerCase()) ||
            pSiteName.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchedSite) setSelectedSiteId(matchedSite.id);
        }
      }
    }

    if (pReporterName) setReporterName(pReporterName);
    if (pReporterPhone) setReporterContact(pReporterPhone);
    if (pAssetNo) {
      const numericMatches = pAssetNo.match(/\d{3,5}/g);
      const assetKeyword = numericMatches ? numericMatches[0] : pAssetNo;
      const foundAsset = assets.find(a => a.assetNo.includes(assetKeyword));
      if (foundAsset) setSelectedAssetNo(foundAsset.assetNo);
      else setCustomAssetNo(pAssetNo);
    }

    let isCategoryFound = false;
    if (pIssueDesc) {
      const issueLower = pIssueDesc.toLowerCase();
      if (/諛고꽣由?異⑹쟾|諛⑹쟾|?덉폒吏?.test(issueLower)) { pCategory = '諛고꽣由?異⑹쟾'; isCategoryFound = true; }
      else if (/二쇳뻾|紐⑦꽣|?띾룄|?꾪썑吏?.test(issueLower)) { pCategory = '二쇳뻾/紐⑦꽣'; isCategoryFound = true; }
      else if (/?좎븬|?꾩쑀|?몄뒪|?ㅼ씪/.test(issueLower)) { pCategory = '?좎븬/?꾩쑀'; isCategoryFound = true; }
      else if (/諛⑹?遊??묒갑|諛?.test(issueLower)) { pCategory = '諛⑹?遊??묒갑'; isCategoryFound = true; }
      else if (/怨쇱긽??由щ????쇱꽌/.test(issueLower)) { pCategory = '?쇱꽌/由щ???; isCategoryFound = true; }
      else if (/議곗씠?ㅽ떛|?덈쾭|踰꾪듉|?ㅼ쐞移?.test(issueLower)) { pCategory = '議곗옉遺/?덈쾭'; isCategoryFound = true; }
      
      if (!isCategoryFound) pCategory = '湲고?/誘몃텇瑜?;
      setSelectedCategory(pCategory);
      setIssueDescription(pIssueDesc);
    }

    showToast('?곗씠??異붿텧 諛??먮룞 ?낅젰???꾨즺?섏뿀?듬땲??', 'success');
    setPasteZoneOpen(false);
  }, [customers, sites, assets]);
  // ?듯솕 珥덉븞 濡쒕뱶
  const loadAsDrafts = async () => {
    try {
      const list = await fetchMyDrafts();
      const asFiltered = list.filter(d => {
        const isAsContext = (d.context || []).some(c => (c as any) === 'FIELD_AS');
        const hasAsKeywords = /怨좎옣|as|?섎━|?덈맖|????硫덉땄|?꾩쑀|?먮윭|?먭?|?뚯넀|遺?|?덈쾭|?ㅼ옉???묐룞遺덇?|?ㅼ쐞移??⑥꽑/i.test(d.note || '');
        return isAsContext || hasAsKeywords;
      });
      setAsDrafts(asFiltered);
    } catch {
      // 濡쒖뺄/?ㅽ봽?쇱씤 臾댁쓬 諛⑹뼱
    }
  };

  useEffect(() => {
    loadAsDrafts();
  }, []);

  // ?듯솕 珥덉븞 ?대┃ ???쇱뿉 100% ?먮룞 二쇱엯 (Auto Injection)
  const handleApplyDraft = (draft: DraftDispatchOrder) => {
    setSelectedDraftId(draft.id);

    // 1. 怨좉컼??留ㅽ븨
    const custRaw = draft.customerName?.value?.trim() || '';
    if (custRaw) {
      const matchedCustomer = customers.find(c => 
        c.name.toLowerCase().includes(custRaw.toLowerCase()) ||
        custRaw.toLowerCase().includes(c.name.toLowerCase())
      );
      if (matchedCustomer) {
        setSelectedCustomerId(matchedCustomer.id);

        // 2. ?꾩옣 留ㅽ븨
        const siteRaw = draft.siteName?.value?.trim() || '';
        const customerSites = sites.filter(s => s.customerId === matchedCustomer.id);
        const matchedSite = customerSites.find(s => 
          s.name.toLowerCase().includes(siteRaw.toLowerCase()) ||
          siteRaw.toLowerCase().includes(s.name.toLowerCase())
        );
        if (matchedSite) {
          setSelectedSiteId(matchedSite.id);
        }
      }
    }

    // 3. ?곕씫泥?& ?묒닔??留ㅽ븨
    if (draft.contactPerson?.value) setReporterName(draft.contactPerson.value);
    if (draft.contactPhone) setReporterContact(draft.contactPhone);

    // 4. 怨좎옣 利앹긽 諛??먮윭肄붾뱶 ?뚯떛
    const noteText = draft.note || '';
    setIssueDescription(noteText);

    // ?먮윭肄붾뱶 ?뺢퇋??異붿텧 (?? LD, U038 ??
    const errMatch = noteText.match(/\b([A-Z]{1,3}\s*[-_]?\s*\d{2,4})\b/i);
    if (errMatch) {
      setErrorCode(errMatch[1].toUpperCase());
      setSelectedCategory('?먮윭肄붾뱶');
    } else if (/諛⑹?遊?媛먯?遊??묒갑/i.test(noteText)) {
      setSelectedCategory('諛⑹?遊??묒갑');
    } else if (/?곸듅|?섍컯/i.test(noteText)) {
      setSelectedCategory('?곹븯媛뺣텋??);
    } else if (/諛고꽣由?異⑹쟾/i.test(noteText)) {
      setSelectedCategory('異⑹쟾/?꾩썝');
    } else if (/?ㅼ씪|?꾩쑀/i.test(noteText)) {
      setSelectedCategory('?ㅼ씪?꾩쑀');
    } else if (/?ㅻ컯???ㅼ쐞移?i.test(noteText)) {
      setSelectedCategory('?ㅻ컯???ㅼ쐞移?);
    }

    if (draft.urgency === 'HIGH') {
      setPriority('URGENT');
    }

    showToast(`[${draft.customerName?.value || '?듯솕'}] ?댁슜??AS ?묒닔 ?쇱뿉 ?먮룞 ?낅젰?섏뿀?듬땲??`);
  };

  // ??? [Gutenberg Z-?⑦꽩 4?④퀎 理쒗븯???꾩옣 AS ?묒닔 ?꾪솴 ?李⑤?議곗떇 寃利? ???
  const asAuditSummary = useMemo(() => {
    const list = fieldAsTickets || [];
    const totalCount = list.length;
    const requestedCount = list.filter(t => t.status === 'REQUESTED').length;
    const inProgressCount = list.filter(t => t.status === 'SCHEDULED' || t.status === 'IN_PROGRESS').length;
    const completedCount = list.filter(t => t.status === 'COMPLETED').length;

    return { totalCount, requestedCount, inProgressCount, completedCount };
  }, [fieldAsTickets]);

  // ?좏깮??怨좉컼?ъ쓽 怨꾩빟 ?꾩옣 紐⑸줉 ?꾪꽣留?
  const availableSites = selectedCustomerId 
    ? sites.filter(s => s.customerId === selectedCustomerId)
    : sites;

  // ?좏깮???꾩옣?먯꽌 ??ъ쨷???쒖꽦 怨꾩빟 ?λ퉬 紐⑸줉 ?꾪꽣留?
  const activeContractsForSite = contracts.filter(c => 
    c.status === 'ACTIVE' && 
    (!selectedCustomerId || c.customerId === selectedCustomerId) &&
    (!selectedSiteId || c.siteId === selectedSiteId)
  );

  const activeContractAssetIds = contractAssets
    .filter(ca => activeContractsForSite.some(c => c.id === ca.contractId) && ca.status !== 'RETURNED')
    .map(ca => ca.assetId);

  const siteRentedAssets = assets.filter(a => activeContractAssetIds.includes(a.id));

  const handlePresetClick = (preset: string) => {
    const symptomItem = inspectionChecklistItems.find(i => i.name === preset && i.isDefectSymptom);
    if (symptomItem && (!symptomItem.relatedManualIds || symptomItem.relatedManualIds.length === 0)) {
      showToast('해당 증상은 매뉴얼이 등록되지 않았습니다. 매뉴얼 작성을 위해 현장 사진 촬영을 꼭 첨부해주세요.', 'error');
    }

    if (!issueDescription) {
      setIssueDescription(preset);
    } else if (!issueDescription.includes(preset)) {
      setIssueDescription(prev => `${prev}\n${preset}`);
    }

    if (preset.includes('방전') || preset.includes('감지봉')) setSelectedCategory('방전/감지봉/조작');
    else if (preset.includes('상승') || preset.includes('하강')) setSelectedCategory('상하강불량');
    else if (preset.includes('충전') || preset.includes('배터리')) setSelectedCategory('충전/전원');
    else if (preset.includes('오일') || preset.includes('누유')) setSelectedCategory('오일누유');
    else if (preset.includes('조이스틱') || preset.includes('스위치')) setSelectedCategory('조이스틱/스위치');
    else if (preset.includes('에러')) setSelectedCategory('에러코드');
    else if (preset.includes('원격')) setSelectedCategory('원격요청');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId && !selectedSiteId && !customAssetNo) {
      showToast('怨좉컼?? ?꾩옣 ?먮뒗 愿由щ쾲??以?理쒖냼 1媛??댁긽???낅젰??二쇱꽭??', 'error');
      return;
    }
    if (!issueDescription.trim()) {
      showToast('怨좎옣 利앹긽 諛??붿껌 ?댁슜???낅젰??二쇱꽭??', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      const site = sites.find(s => s.id === selectedSiteId);
      const finalAssetNo = selectedAssetNo === 'CUSTOM' ? (customAssetNo || '?꾩옣?뺤씤') : (selectedAssetNo || customAssetNo || '?꾩옣?뺤씤');
      const matchedAsset = assets.find(a => a.assetNo === finalAssetNo);

      const ticket = await createFieldAsTicket({
        source: 'SALES_REQUEST',
        customerId: customer?.id || '',
        customerName: customer?.name || (site?.name ? `${site.name} ?묐젰?? : '?곸뾽 ?섎ː 怨좉컼??),
        siteId: site?.id || '',
        siteName: site?.name || '?꾩옣 吏???붿껌',
        siteAddress: site?.address?.trim() || customer?.address?.trim() || '',
        assetId: matchedAsset?.id || '',
        assetNo: finalAssetNo,
        locationDetail: locationDetail.trim(),
        reporterName: reporterName.trim(),
        reporterContact: reporterContact.trim(),
        issueCategory: selectedCategory,
        issueDescription: issueDescription.trim(),
        errorCode: errorCode.trim(),
        priority,
        status: 'REQUESTED',
        billableType: 'FREE',
        billableAmount: 0
      });
      await db.awaitPendingWrites();

      if (selectedDraftId) {
        try {
          await discardDraft(selectedDraftId);
          setAsDrafts(prev => prev.filter(d => d.id !== selectedDraftId));
          setSelectedDraftId(null);
        } catch {
          // 議곗슜??諛⑹뼱
        }
      }

      setSubmitSuccessTicket(ticket);
      showToast(`${finalAssetNo} ?꾩옣 AS ?섎ː媛 ?묒닔?섏뿀?듬땲??`);
    } catch (err: any) {
      // showErrorModal handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedCustomerId('');
    setSelectedSiteId('');
    setSelectedAssetNo('');
    setCustomAssetNo('');
    setLocationDetail('');
    setIssueDescription('');
    setErrorCode('');
    setPriority('NORMAL');
    setSubmitSuccessTicket(null);
    setSelectedDraftId(null);
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', position: 'relative' }}>
      {/* ?뵒 ?몄빋 ?좎뒪???뚮┝ (?뚯옣 5.2) */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '10px 18px',
          borderRadius: '6px',
          backgroundColor: toastMessage.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          {toastMessage.text}
        </div>
      )}
      {/* ??댄? 諛??ㅻ뜑 (?뚯옣 3.1 臾댁닔?앹뼱 嫄댁“ ?쒖?) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={20} color="var(--primary)" />
            AS ?붿껌 ?묒닔
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            ?듯솕 ?뱀쓬 AI ?뚯떛 諛??꾩옣 怨좎옣 ?묒닔 ?꾩슜 ?ㅽ뒠?붿삤
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('field_as')}
            style={{
              padding: '7px 14px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '12.5px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            ?꾩옣 AS 愿由??대룞 ??
          </button>
        </div>
      </div>

      {submitSuccessTicket ? (
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 16px auto' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 8px 0' }}>
            AS ?섎ː媛 ?깃났?곸쑝濡??묒닔?섏뿀?듬땲??
          </h2>
          <p style={{ fontSize: '14px', color: '#10b981', margin: '0 0 20px 0' }}>
            ?묒닔踰덊샇: <strong>{submitSuccessTicket.ticketNo}</strong> (?꾩옣: {submitSuccessTicket.siteName} / ?λ퉬: {submitSuccessTicket.assetNo})
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button
              onClick={handleReset}
              style={{
                padding: '10px 20px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              異붽? AS ?묒닔?섍린
            </button>
            <button
              onClick={() => setActiveTab('field_as')}
              style={{
                padding: '10px 20px',
                backgroundColor: 'var(--primary)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              ?꾩옣 AS 愿由?????대룞
            </button>
          </div>
        </div>
      ) : (
        /* ?? ?뚯옣 3.6 留덉뒪???뷀뀒???ㅽ뒠?붿삤 ?덉씠?꾩썐 ?? */
        <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
          {/* 醫뚯륫 Master: ?듯솕 ?묒닔 AS ?湲???(?덈퉬 360px 怨좎젙) */}
          <div style={{
            width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px',
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px',
            padding: '14px', boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <PhoneCall size={15} /> ?듯솕 ?묒닔 ?湲?({asDrafts.length}嫄?
              </h3>
              <button
                onClick={loadAsDrafts}
                style={{ fontSize: '11px', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              >
                ?덈줈怨좎묠
              </button>
            </div>

            {asDrafts.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                ?湲?以묒씤 ?듯솕 AS 珥덉븞???놁뒿?덈떎.<br />
                ?곗륫 ?쇱뿉??吏곸젒 ?섎룞 ?묒닔?섏떗?쒖삤.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '620px', overflowY: 'auto' }}>
                {asDrafts.map(d => {
                  const isSelected = selectedDraftId === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => handleApplyDraft(d)}
                      style={{
                        padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s ease',
                        backgroundColor: isSelected ? 'rgba(59,130,246,0.12)' : 'var(--bg-body)',
                        border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                        display: 'flex', flexDirection: 'column', gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {d.customerName?.value || '怨좉컼??誘몄긽'}
                        </span>
                        <span style={{
                          fontSize: '10px', padding: '1px 5px', borderRadius: '4px', fontWeight: 800,
                          backgroundColor: d.urgency === 'HIGH' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                          color: d.urgency === 'HIGH' ? '#ef4444' : '#2563eb'
                        }}>
                          {d.urgency === 'HIGH' ? '?슚 湲닿툒' : '?쇰컲'}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        ?꾩옣: {d.siteName?.value || '?꾩옣 誘몄긽'} {d.contactPerson?.value ? `쨌 ${d.contactPerson.value}` : ''}
                      </div>

                      {d.note && (
                        <div style={{
                          fontSize: '11.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4'
                        }}>
                          {d.note}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        <span>{d.createdAt?.slice(5, 16) || ''}</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <Sparkles size={11} /> 1-?대┃ 苑귥븘?ｊ린 ??
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ?곗륫 Detail: AS ?묒닔 諛??곸꽭 寃????(flex: 1) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {selectedDraftId && (
              <div style={{
                backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px',
                padding: '8px 14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} /> ?좏깮???듯솕 ?댁슜???쇱뿉 ?먮룞 ?낅젰?섏뿀?듬땲?? 誘몃퉬???먯쓣 ?뺤씤 ???묒닔 ?뺤젙?섏떗?쒖삤.
                </span>
                <button
                  onClick={handleReset}
                  style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  珥덇린??
                </button>
              </div>
            )}

            {/* ?띿뒪??遺숈뿬?ｊ린 ?뚯떛 ?곸뿭 (異쒓퀬?섎ː ?듯빀 ?ㅽ??? */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px', boxShadow: 'var(--shadow-sm)' }}>
              <div
                onClick={() => setPasteZoneOpen(p => !p)}
                style={{
                  backgroundColor: 'var(--bg-main)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderBottom: pasteZoneOpen ? '1px solid var(--border-color)' : 'none',
                  transition: 'background-color 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                  <ClipboardPaste size={16} color="var(--primary)" />
                  <span>移댄넚/臾몄옄/諛대뱶 ?띿뒪??遺숈뿬?ｊ린 ?뚯떛</span>
                </div>
                {pasteZoneOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </div>
              {pasteZoneOpen && (
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--bg-main)' }}>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder="移댄넚, 臾몄옄, 諛대뱶 AS?붿껌 ?먮Ц??遺숈뿬?ｊ굅??[?뚯씪 遺덈윭?ㅺ린]瑜??ㅽ뻾????[???곗씠??蹂??(異붿텧)]???꾨Ⅴ?몄슂."
                    rows={5}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      color: 'var(--text-main)',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        ref={txtFileInputRef}
                        type="file"
                        accept=".txt,.csv,.log,text/plain"
                        style={{ display: 'none' }}
                        onChange={handleTextFileChange}
                      />
                      <button
                        type="button"
                        onClick={() => txtFileInputRef.current?.click()}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                          borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                          backgroundColor: 'var(--bg-card)', color: 'var(--warning)', border: '1px solid var(--border-color)',
                          cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <FolderOpen size={14} color="#f59e0b" />
                        <span>?뚯씪 遺덈윭?ㅺ린</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => { setPasteText(''); setPasteZoneOpen(false); }}
                        style={{
                          padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          backgroundColor: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer'
                        }}
                      >
                        ?リ린
                      </button>
                      <button
                        type="button"
                        onClick={() => runParse(pasteText)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px',
                          borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                          backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <Zap size={14} />
                        <span>???곗씠??蹂??(異붿텧)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. ?꾩옣 諛?????λ퉬 ?ㅼ퐫??移대뱶 */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={18} color="var(--primary)" />
              1. ?꾩옣 諛?????λ퉬 ?좏깮
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* 怨좉컼???좏깮 (珥덉꽦 寃??吏?? */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    怨좉컼??(?낆껜紐?
                  </label>
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      style={{ fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >寃??珥덇린??/button>
                  )}
                </div>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="怨좉컼紐?/ 珥덉꽦 寃??(?? ?끹뀉, ?롢꽬)..."
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    marginBottom: '2px'
                  }}
                />
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setSelectedSiteId('');
                    setSelectedAssetNo('');
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '13px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                >
                  <option value="">
                    {customerSearch ? `寃??寃곌낵 (${filteredCustomerList.length}媛쒖궗)` : '怨좉컼???좏깮 (?좏깮 ????媛??'}
                  </option>
                  {filteredCustomerList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* 怨듭궗 ?꾩옣 ?좏깮 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  怨듭궗 ?꾩옣紐?<span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => {
                    setSelectedSiteId(e.target.value);
                    setSelectedAssetNo('');
                  }}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                >
                  <option value="">?꾩옣 ?좏깮</option>
                  {availableSites.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.address || '二쇱냼誘몃벑濡?})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 愿由щ쾲???좏깮 (??ъ쨷 ?λ퉬 ?쒕∼?ㅼ슫 + 吏곸젒/?좎뿰 ?낅젰) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  ?대떦 ?꾩옣 ????λ퉬 紐⑸줉
                </label>
                <select
                  value={selectedAssetNo}
                  onChange={(e) => {
                    setSelectedAssetNo(e.target.value);
                    if (e.target.value !== 'CUSTOM') setCustomAssetNo('');
                  }}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                >
                  <option value="">????λ퉬 ?좏깮</option>
                  {siteRentedAssets.map(a => (
                    <option key={a.id} value={a.assetNo}>
                      {a.assetNo} ({a.modelName})
                    </option>
                  ))}
                  <option value="CUSTOM">吏곸젒 ?낅젰 (?꾩껜?λ퉬 / 誘명솗??/ ?ㅼ닔 ?λ퉬)</option>
                </select>
              </div>

              {/* ?λ퉬踰덊샇 吏곸젒?낅젰 ?먮뒗 ?꾩튂 ?곸꽭 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {selectedAssetNo === 'CUSTOM' || !selectedAssetNo ? '?λ퉬踰덊샇 吏곸젒?낅젰 (?? G10032, 14002 ??3?, ?꾩껜?λ퉬)' : '?λ퉬 ?몃? ?꾩튂 (痢?援ъ뿭/??'}
                </label>
                {selectedAssetNo === 'CUSTOM' || !selectedAssetNo ? (
                  <input
                    type="text"
                    value={customAssetNo}
                    onChange={(e) => setCustomAssetNo(e.target.value)}
                    placeholder="?? G19190, ?밸룞 ?꾩껜?λ퉬, ?뺤씤?꾩슂"
                    style={{
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '14px',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)'
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={locationDetail}
                    onChange={(e) => setLocationDetail(e.target.value)}
                    placeholder="?? ?밸룞 8痢?X27 Y17, 吏?먮룞 B2"
                    style={{
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '14px',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)'
                    }}
                  />
                )}
              </div>
            </div>

            {selectedAssetNo && selectedAssetNo !== 'CUSTOM' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  ?꾩옣 ?λ퉬 ?꾩튂 ?곸꽭 (?좏깮)
                </label>
                <input
                  type="text"
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder="?? ?밸룞 8痢?X27 Y17, 吏?먮룞 2怨듦뎄 B2 紐쎄낏?먰듃??
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            )}
          </div>

          {/* 2. 怨좎옣 利앹긽 諛??붿껌 ?댁슜 ?낅젰 移대뱶 */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={18} color="var(--primary)" />
              2. 怨좎옣 利앹긽 諛??붿껌 ?댁슜
            </h3>

            {/* ?ㅻ퉰??怨좎옣 1-Click ?꾨━???쒓렇 踰꾪듉援?*/}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                ???먯＜ ?묒닔?섎뒗 怨좎옣 利앹긽 (?대┃ ???먮룞 ?낅젰)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {defectSymptoms.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  怨좎옣 遺꾨쪟
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                >
                  <option value="諛⑹?遊??묒갑">諛⑹?遊?/ ?묒갑 ?쇱꽌</option>
                  <option value="?곹븯媛뺣텋??>?곸듅 / ?섍컯 ?묐룞 遺덈웾</option>
                  <option value="異⑹쟾/?꾩썝">異⑹쟾 遺덈웾 / 異⑹쟾???⑥꽑</option>
                  <option value="?ㅼ씪?꾩쑀">?좎븬 ?ㅼ씪 ?꾩쑀</option>
                  <option value="?ㅻ컯???ㅼ쐞移?>?ㅻ컯??/ ?ㅼ뒪?꾩튂 遺덈웾</option>
                  <option value="?먮윭肄붾뱶">?먮윭肄붾뱶 ?먮벑 (LD / U038)</option>
                  <option value="?뚯씠?꾧구由?>?꾩옣 諛곌?/?뚯씠??嫄몃┝</option>
                  <option value="?먭??붿껌">?뺢린 ?쒗쉶 ?먭?</option>
                  <option value="湲고?">湲고? 怨좎옣</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  怨꾧린???쒖떆 ?먮윭肄붾뱶 (?좏깮)
                </label>
                <input
                  type="text"
                  value={errorCode}
                  onChange={(e) => setErrorCode(e.target.value)}
                  placeholder="?? LD, U038, CH02, 02 ??
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                ?곸꽭 利앹긽 諛??꾨떖 ?ы빆 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <textarea
                rows={4}
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="?꾩옣?먯꽌 ?꾨떖諛쏆? 援ъ껜?곸씤 怨좎옣 ?댁슜怨?諛⑸Ц ??二쇱쓽?ы빆???곸뼱二쇱꽭?? (?? ?꾩갑 ???뚯옣?섍퍡 ?꾪솕 ?붾쭩, ?덉쟾紐?吏李??꾩닔 ??"
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '14px',
                  resize: 'vertical',
                  lineHeight: '1.5',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          {/* 3. ?묒닔???뺣낫 諛?湲닿툒??*/}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={18} color="var(--primary)" />
              3. ?묒닔???곕씫泥?諛??곗꽑?쒖쐞
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  ?꾩옣 ?묒닔???깅챸
                </label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="?? 源?뚯옣, ?대????由?
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  ?묒닔???곕씫泥?
                </label>
                <input
                  type="text"
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                  placeholder="?? 010-1234-5678"
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  異쒕룞 湲닿툒??
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: priority === 'URGENT' ? '2px solid var(--danger)' : '1px solid var(--border-color)',
                    fontSize: '14px',
                    backgroundColor: priority === 'URGENT' ? 'var(--danger-light)' : 'var(--bg-card)',
                    fontWeight: priority === 'URGENT' ? 700 : 400,
                    color: priority === 'URGENT' ? 'var(--danger)' : 'var(--text-main)'
                  }}
                >
                  <option value="NORMAL">蹂댄넻 (?쇰컲 ?쒗쉶/?듭씪 ?쇱젙)</option>
                  <option value="URGENT">?슚 湲닿툒 (?뱀씪 ?꾩옣 ?묒뾽 以묐떒)</option>
                </select>
              </div>
            </div>
          </div>

          {/* ?섎떒 理쒖쥌 諛쒗뻾 踰꾪듉 (?고븯??諛곗튂 - ?뚯옣 3.5 Gutenberg Z-Pattern) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: '12px 20px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              珥덇린??
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                backgroundColor: priority === 'URGENT' ? 'var(--danger)' : 'var(--primary)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-on-primary)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            >
              <Send size={18} />
              {isSubmitting ? '?섎ː ?꾩넚 以?..' : 'AS ?섎ː ?꾩넚'}
            </button>
          </div>
        </form>
          </div>
        </div>
      )}
      {/* ?뽳툘 Gutenberg Z-?⑦꽩 4?④퀎 理쒗븯???꾩옣 AS ?묒닔 ?李⑤?議곗떇 寃利?諛?(?뚯옣 3.5) */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 'var(--sidebar-width, 240px)',
        right: 0,
        height: '42px',
        backgroundColor: 'var(--bg-card)',
        borderTop: '2px solid var(--primary)',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 99,
        fontSize: '11.5px',
        fontWeight: 600
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <span>?뵩 <strong>?꾩쟻AS?묒닔:</strong> {asAuditSummary.totalCount}嫄?/span>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <span style={{ color: 'var(--danger)' }}>?슚 <strong>?묒닔?湲?</strong> {asAuditSummary.requestedCount}嫄?/span>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <span style={{ color: 'var(--warning)' }}>??<strong>諛곗젙/異쒕룞以?</strong> {asAuditSummary.inProgressCount}嫄?/span>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <span style={{ color: 'var(--success)' }}>?윟 <strong>議곗튂?꾨즺:</strong> {asAuditSummary.completedCount}嫄?/span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--success-light)',
            color: 'var(--success)',
            fontWeight: 700,
            fontSize: '11px'
          }}>
            ?뽳툘 ?李??뺤긽 (?꾩껜 AS ?곗폆 ?곹깭 ?뚯씠?꾨씪??臾닿껐)
          </span>
        </div>
      </div>
      <div style={{ height: '50px' }} aria-hidden="true" />
    </div>
  );
};
