// src/mobile/pages/MobileAsCreate.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { CameraUploader } from '../components/CameraUploader';
import { 
  ArrowLeft, Check, Plus, AlertTriangle, Mic, MicOff, 
  FileText, RotateCcw, Sparkles, X, CheckCircle2, MapPin, Volume2, VolumeX
} from 'lucide-react';
import { extractAsRequestFromVoice } from '../../services/voiceOrderDraftService';
import { resolveSiteDetailedAddress } from '../../utils/nativeLauncher';
import { ttsService } from '../../services/ttsService';

interface MobileAsCreateProps {
  onBack: () => void;
  onCreated: (ticketId: string) => void;
  initialAssetNo?: string;
}

export const MobileAsCreate: React.FC<MobileAsCreateProps> = ({ 
  onBack, 
  onCreated,
  initialAssetNo
}) => {
  const { createFieldAsTicket, showErrorModal, customers, sites, assets, contracts, contractAssets, inspectionChecklistItems } = useApp();

  const defectSymptoms = useMemo(() => {
    const list = inspectionChecklistItems.filter(i => i.isDefectSymptom).map(i => i.name);
    return list.length > 0 ? list : ['불량증상(설정요망)'];
  }, [inspectionChecklistItems]);

  const [customerName, setCustomerName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [assetNo, setAssetNo] = useState(typeof initialAssetNo === 'string' ? initialAssetNo : '');
  const [locationDetail, setLocationDetail] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [issueCategory, setIssueCategory] = useState('?곹븯媛뺣텋??);
  const [issueDescription, setIssueDescription] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ?뚯꽦 諛??듯솕 ?띿뒪???뚯떛 ?곹깭
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => ttsService.getIsEnabled());
  const [interimText, setInterimText] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedTranscript, setPastedTranscript] = useState('');
  const [recentModifiedFields, setRecentModifiedFields] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // ?뙚 1. ?λ퉬踰덊샇 ?낅젰 ??怨꾩빟 ?꾩옣 諛?怨좉컼??룸룄濡쒕챸 二쇱냼 ?ㅼ떆媛??먮룞 ??텛??
  const handleAssetNoChange = (val: string) => {
    if (typeof val !== 'string') return;
    setAssetNo(val);
    const clean = val.trim().toUpperCase();
    if (!clean) return;

    const matchedAsset = (assets || []).find(a => (a?.assetNo && typeof a.assetNo === 'string') && a.assetNo.toUpperCase() === clean);
    if (matchedAsset) {
      const ca = (contractAssets || []).find(c => c.assetId === matchedAsset.id && !c.actualReturnDate);
      if (ca) {
        const contract = (contracts || []).find(c => c.id === ca.contractId);
        if (contract) {
          const cust = (customers || []).find(c => c.id === contract.customerId);
          if (cust && !customerName) setCustomerName(cust.name || '');
          if (contract.siteId) {
            const site = (sites || []).find(s => s.id === contract.siteId);
            if (site) {
              setSiteName(site.name || '');
              if (site.address?.trim()) setSiteAddress(site.address.trim());
              else if (cust?.address?.trim()) setSiteAddress(cust.address.trim());
            }
          } else if (cust?.address?.trim()) {
            setSiteAddress(cust.address.trim());
          }
        }
      }
    }
  };

  // ?뙚 珥덇린 ?멸퀎 ?뚮씪誘명꽣(?댄쁽???먯궛議고쉶 ?깆뿉???좎엯) ?먮룞 諛붿씤??(?뚯옣 1.1 & 怨쇱젣 6)
  useEffect(() => {
    if (typeof initialAssetNo === 'string' && initialAssetNo.trim()) {
      handleAssetNoChange(initialAssetNo);
    }
    if (typeof initialSiteId === 'string' && initialSiteId.trim()) {
      const site = (sites || []).find(s => s.id === initialSiteId);
      if (site) {
        setSiteName(site.name || '');
        if (site.address?.trim()) setSiteAddress(site.address.trim());
        const cust = (customers || []).find(c => c.id === site.customerId);
        if (cust && !customerName) setCustomerName(cust.name || '');
      }
    }
  }, [initialAssetNo, initialSiteId]);

  // ?뙚 2. 怨좉컼?щ챸 ?낅젰 ??留덉뒪???쇱튂 諛??꾩옣쨌?꾨줈紐?二쇱냼 ?곸냽
  const handleCustomerNameChange = (val: string) => {
    if (typeof val !== 'string') return;
    setCustomerName(val);
    const clean = val.trim();
    if (!clean) return;

    const cust = (customers || []).find(c => (c?.name && typeof c.name === 'string') && (c.name.trim() === clean || c.name.includes(clean)));
    if (cust) {
      const cSites = (sites || []).filter(s => s.customerId === cust.id);
      if (cSites.length === 1) {
        setSiteName(cSites[0].name || '');
        if (cSites[0].address?.trim()) {
          setSiteAddress(cSites[0].address.trim());
        } else if (cust.address?.trim()) {
          setSiteAddress(cust.address.trim());
        }
      } else if (cust.address?.trim() && !siteAddress) {
        setSiteAddress(cust.address.trim());
      }
    }
  };

  // ?뙚 3. ?꾩옣紐??낅젰 ???꾩옣 ?곸꽭 二쇱냼 ?곸냽
  const handleSiteNameChange = (val: string) => {
    if (typeof val !== 'string') return;
    setSiteName(val);
    const clean = val.trim();
    if (!clean) return;

    const cNameClean = (customerName || '').trim();
    const matchedCust = (customers || []).find(c => (c?.name && typeof c.name === 'string') && (c.name.trim() === cNameClean || c.name.includes(cNameClean)));
    const cSites = matchedCust ? (sites || []).filter(s => s.customerId === matchedCust.id) : (sites || []);
    const site = cSites.find(s => (s?.name && typeof s.name === 'string') && (s.name.trim() === clean || s.name.includes(clean) || clean.includes(s.name.trim())));
    if (site?.address?.trim()) {
      setSiteAddress(site.address.trim());
    }
  };

  // ?듯솕 ?띿뒪???뚯떛 諛????먮룞 諛섏쁺 怨듯넻 ?⑥닔
  const applyTranscript = (text: string) => {
    if (!text.trim()) return;
    const result = parseAsCallTranscript(text, customers || [], sites || [], assets || []);

    if (result.customerName) setCustomerName(result.customerName);
    if (result.siteName) setSiteName(result.siteName);
    if (result.siteAddress) {
      setSiteAddress(result.siteAddress);
    } else {
      const resolved = resolveSiteDetailedAddress({
        siteName: result.siteName || siteName,
        customerName: result.customerName || customerName,
        assetNo: result.assetNo || assetNo,
        locationDetail: result.locationDetail || locationDetail,
        customerSites: sites,
        contracts,
        contractAssets,
        customers,
      });
      if (resolved && resolved !== (result.siteName || result.customerName || '?꾩옣')) {
        setSiteAddress(resolved);
      }
    }
    if (result.assetNo) setAssetNo(result.assetNo);
    if (result.locationDetail) setLocationDetail(result.locationDetail);
    if (result.reporterName) setReporterName(result.reporterName);
    if (result.reporterContact) setReporterContact(result.reporterContact);
    if (result.issueCategory && defectSymptoms.includes(result.issueCategory)) {
      setIssueCategory(result.issueCategory);
    }
    if (result.issueDescription) setIssueDescription(result.issueDescription);
    if (result.priority) setPriority(result.priority);

    setRecentModifiedFields(result.modifiedFields);
  };

  // 怨좎젙諛 Groq Whisper STT 諛?Web Speech ?대갚 ?뚯꽦 ?쒖뼱
  const toggleListening = async () => {
    if (isListening) {
      // ?뱀쓬 醫낅즺 諛?STT 遺꾩꽍
      setIsListening(false);

      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
        return;
      }

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        return;
      }

      setIsProcessing(true);
      setInterimText('?뚯꽦??遺꾩꽍?섍퀬 ?덉뒿?덈떎...');

      mediaRecorderRef.current.onstop = async () => {
        try {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
          }

          const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: mime });

          if (blob.size < 200) {
            setIsProcessing(false);
            setInterimText('');
            return;
          }

          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            try {
              const res = await fetch('/api/groq-stt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioBase64: base64Audio,
                  mimeType: mime,
                  language: 'ko',
                  prompt: '怨좎냼?묒뾽? ?꾩옣 湲닿툒 AS ?묒닔 怨좎옣?섎━. 利앹긽: ?곹븯媛뺣텋?? 異⑹쟾 ?꾩썝 諛⑹쟾, ?ㅼ씪?꾩쑀, ?ㅻ컯???ㅼ쐞移??덈쾭 議곗씠?ㅽ떛, ?먮윭肄붾뱶, 諛⑹?遊??묒갑, ?뚯씠?꾧구由? 湲닿툒, ?뱀옣. 愿由щ쾲???λ퉬踰덊샇 ?멸린.'
                })
              });

              if (res.ok) {
                const data = await res.json();
                const text = (data?.textTranscript || '').trim();
                if (text) {
                  applyTranscript(text);
                  setInterimText(`?몄떇?꾨즺: "${text}"`);
                  if (ttsService.getIsEnabled()) {
                    ttsService.speak('AS ?뺣낫媛 ?쇱뿉 諛섏쁺?섏뿀?듬땲??');
                  }
                  setTimeout(() => setInterimText(''), 3000);
                } else {
                  setInterimText('?뚯꽦??紐낇솗?섏? ?딆뒿?덈떎.');
                }
              } else {
                throw new Error('STT API ?ㅻ쪟');
              }
            } catch (err) {
              console.warn('Groq STT failed:', err);
              setInterimText('?뚯꽦 遺꾩꽍 ?ㅽ뙣. ?ㅼ떆 ?쒕룄?댁＜?몄슂.');
            } finally {
              setIsProcessing(false);
            }
          };
        } catch (e) {
          setIsProcessing(false);
          setInterimText('');
        }
      };

      mediaRecorderRef.current.stop();
      return;
    }

    // ?뱀쓬 ?쒖옉
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      if (typeof MediaRecorder !== 'undefined') {
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const candidates = isSafari
          ? ['audio/mp4', 'audio/aac']
          : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
        const mimeType = candidates.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';

        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsListening(true);
        setInterimText('?뚯꽦 ?ｋ뒗 以?.. (留먯? ???곗튂?섏뿬 ?꾨즺)');
      } else {
        startBrowserAsStt();
      }
    } catch (err: any) {
      console.warn('Microphone error, fallback to browser STT:', err);
      startBrowserAsStt();
    }
  };

  const startBrowserAsStt = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showErrorModal('??釉뚮씪?곗????뚯꽦 ?몄떇??吏?먰븯吏 ?딆뒿?덈떎.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimText('?뚯꽦 ?ｋ뒗 以?.. (留먯???二쇱꽭??');
      };

      recognition.onresult = (event: any) => {
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript;
        }
        if (finalChunk.trim()) {
          applyTranscript(finalChunk.trim());
          setInterimText('');
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsListening(false);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedTranscript.trim()) return;
    applyTranscript(pastedTranscript);
    setShowPasteModal(false);
    setPastedTranscript('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !assetNo.trim()) {
      showErrorModal('怨좉컼?щ챸怨??λ퉬踰덊샇???꾩닔 ?낅젰 ??ぉ?낅땲??');
      return;
    }

    setIsSubmitting(true);
    try {
      // ?뙚 怨좉컼??諛??꾩옣 留덉뒪??ID ?먮룞 留ㅽ븨 (?꾨줈紐?二쇱냼 ?곸냽 蹂댁옣)
      const cleanCustomerName = customerName.trim();
      const cleanSiteName = siteName.trim();
      const matchedCust = (customers || []).find(c => 
        (c?.name && typeof c.name === 'string') && 
        (c.name.trim() === cleanCustomerName || c.name.includes(cleanCustomerName))
      );
      const matchedSite = (sites || []).find(s => 
        (matchedCust ? s.customerId === matchedCust.id : true) && 
        (s?.name && typeof s.name === 'string') && 
        (s.name.trim() === cleanSiteName || s.name.includes(cleanSiteName) || cleanSiteName.includes(s.name))
      );

      const ticket = await createFieldAsTicket({
        customerId: matchedCust?.id,
        customerName: cleanCustomerName,
        siteId: matchedSite?.id,
        siteName: cleanSiteName,
        siteAddress: siteAddress.trim(),
        assetNo: assetNo.toUpperCase(),
        locationDetail,
        reporterName,
        reporterContact,
        issueCategory,
        issueDescription,
        priority,
        visitDate,
        scheduleDate: visitDate,
        faultImageUrl: images[0] || '',
        evidenceImages: images,
      });

      onCreated(ticket.id);
    } catch (err: any) {
      showErrorModal('?묒닔 ?깅줉 ?ㅽ뙣: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const cleanCustName = (customerName || '').trim();
  const matchedCustomer = cleanCustName ? (customers || []).find(c => 
    (c?.name && typeof c.name === 'string') && 
    (c.name.trim() === cleanCustName || (cleanCustName.length >= 2 && c.name.includes(cleanCustName)))
  ) : undefined;
  const matchedCustomerSites = matchedCustomer 
    ? (sites || []).filter(s => s.customerId === matchedCustomer.id) 
    : [];

  const matchedSite = siteName ? matchedCustomerSites.find(s => s.name === siteName) : undefined;

  // ?뙚 怨좉컼???꾩옣 媛?숈쨷 ?먯궛 ????됲듃??(?몃낫?좎씠??????뺢퀬媛?100~200? ?λ퉬 AS ?묒닔 ?몄쓽??
  const activeRentedAssets = React.useMemo(() => {
    if (!matchedCustomer) return [];
    
    // Find active contracts
    const activeContracts = (contracts || []).filter(c => {
      if (c.customerId !== matchedCustomer.id) return false;
      if (matchedSite && c.siteId !== matchedSite.id) return false;
      return c.status === 'ACTIVE'; 
    });
    
    const contractIds = new Set(activeContracts.map(c => c.id));
    
    // Find active contract assets
    const activeContractAssets = (contractAssets || []).filter(ca => 
      contractIds.has(ca.contractId) && !ca.actualReturnDate
    );
    
    // Map to actual assets
    return activeContractAssets.map(ca => {
      return (assets || []).find(ast => ast.id === ca.assetId);
    }).filter(Boolean);
  }, [matchedCustomer, matchedSite, contracts, contractAssets, assets]);

  const handleCategorySelect = (cat: string) => {
    setIssueCategory(cat);
    const symptomItem = inspectionChecklistItems.find(i => i.name === cat && i.isDefectSymptom);
    if (symptomItem && (!symptomItem.relatedManualIds || symptomItem.relatedManualIds.length === 0)) {
      showErrorModal('해당 증상은 매뉴얼이 등록되지 않았습니다. 매뉴얼 작성을 위해 현장 사진 촬영을 꼭 첨부해주세요.');
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-28 p-4 bg-slate-950 min-h-screen">
      {/* ?곷떒 ?ㅻ뜑 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          ?ㅻ줈媛€湲?
        </button>
        <span className="text-sm font-black text-white">?꾩옣 AS ?묒닔</span>
        <button
          type="button"
          onClick={() => {
            const next = ttsService.toggle();
            setTtsEnabled(next);
          }}
          className={`flex items-center gap-1 text-[11px] font-bold py-1.5 px-2.5 rounded-xl border transition-all ${
            ttsEnabled
              ? 'bg-blue-600/20 border-blue-500 text-blue-400'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}
          title="?뚯꽦 ?덈궡(TTS) 耳쒓린/?꾧린"
        >
          {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span>{ttsEnabled ? '?뚮━ ON' : '?뚮━ OFF'}</span>
        </button>
      </div>

      {/* ?럺截??뚯꽦 & ?듯솕 ?띿뒪???낅젰 諛?*/}
      <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-800/40 flex flex-col gap-2 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-blue-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              ?듯솕 ?뚯꽦/?띿뒪???먮룞 ?낅젰
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 border border-slate-700 active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              ?듯솕 ?띿뒪??
            </button>
            <button
              type="button"
              onClick={toggleListening}
              className={`py-1 px-3 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  ?ｋ뒗以?..
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  ?뚯꽦 ?묒닔
                </>
              )}
            </button>
          </div>
        </div>

        {/* ?ㅼ떆媛??뚯꽦 ?섏떊 誘몃━蹂닿린 */}
        {isListening && interimText && (
          <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-200 text-xs font-medium">
            ?럺截?{interimText}
          </div>
        )}

        {/* 理쒓렐 ?몄떇/異붿텧???꾨뱶 ?쒓렇 */}
        {recentModifiedFields.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800/80">
            {recentModifiedFields.map((field, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold flex items-center gap-1"
              >
                <Check className="w-3 h-3 text-blue-400" />
                {field}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* AS ?묒닔 ??*/}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* ?λ퉬踰덊샇 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
            ?λ퉬踰덊샇 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={assetNo}
            onChange={(e) => handleAssetNoChange(e.target.value)}
            placeholder="?? 102, G19-01, 1001"
            className="w-full rounded-xl p-3 text-sm font-mono uppercase placeholder-slate-500 focus:outline-none"
            style={{
              backgroundColor: '#090d16',
              color: '#f8fafc',
              border: '1px solid #334155',
              colorScheme: 'dark'
            }}
          />
          
          {/* ?꾩옣 ?뚰깉 ?먯궛 ????(100~200?€ 怨좉컼??AS ?몄쓽??媛쒖꽑) */}
          {activeRentedAssets.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[11px] font-bold text-slate-400">
                媛€?숈쨷 ?λ퉬 ???좏깮 ({activeRentedAssets.length}?€)
              </span>
              <div className="w-full min-w-0 max-w-full overflow-x-auto flex items-center gap-1.5 pb-1 scrollbar-none">
                {activeRentedAssets
                  .filter(a => !assetNo || (a.assetNo && a.assetNo.includes(assetNo.toUpperCase())) || (a.modelName && a.modelName.includes(assetNo.toUpperCase())))
                  .map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleAssetNoChange(a.assetNo)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap flex-shrink-0 transition-colors ${
                      assetNo === a.assetNo
                        ? 'bg-amber-600/90 text-white border-amber-500 font-bold'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {a.assetNo} <span className="text-[10px] opacity-70 ml-1">{a.modelName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 怨좉컼?щ챸 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
            怨좉컼?щ챸 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={customerName}
            onChange={(e) => handleCustomerNameChange(e.target.value)}
            placeholder="怨좉컼???곹샇紐??낅젰"
            className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
            style={{
              backgroundColor: '#090d16',
              color: '#f8fafc',
              border: '1px solid #334155',
              colorScheme: 'dark'
            }}
          />
        </div>

        {/* 怨좉컼???뚯냽 ?꾩옣 ???€?됲듃 移?*/}
        {matchedCustomerSites.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap flex-shrink-0">
              ?깅줉 ?꾩옣 ?좏깮
            </span>
            <div className="w-full min-w-0 max-w-full overflow-x-auto flex items-center gap-1.5 pb-1 scrollbar-none">
              {matchedCustomerSites.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSiteName(s.name);
                    if (s.address?.trim()) setSiteAddress(s.address.trim());
                    else if (matchedCustomer?.address?.trim()) setSiteAddress(matchedCustomer.address.trim());
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg border whitespace-nowrap flex-shrink-0 transition-colors ${
                    siteName === s.name
                      ? 'bg-blue-600 text-white border-blue-500 font-bold'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ?꾩옣紐?/ ?곸꽭 ?꾩튂 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">?꾩옣紐?/label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => handleSiteNameChange(e.target.value)}
              placeholder="?꾩옣 ?대쫫"
              className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">?곸꽭 ?꾩튂</label>
            <input
              type="text"
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              placeholder="?? 吏€??1痢? ?섏뿭??
              className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />
          </div>
        </div>

        {/* ?꾩옣 ?꾨줈紐?二쇱냼 (T留?移댁뭅?ㅻ궡鍮??ㅼ씠踰꾩????곕룞) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
              ?꾩옣 ?꾨줈紐?二쇱냼
            </label>
            {matchedCustomer?.address && typeof matchedCustomer.address === 'string' && siteAddress !== matchedCustomer.address.trim() && (
              <button
                type="button"
                onClick={() => setSiteAddress(matchedCustomer.address.trim())}
                className="text-[10px] font-bold text-sky-400 bg-sky-950/40 hover:bg-sky-900/60 px-2 py-0.5 rounded border border-sky-800/40 whitespace-nowrap flex-shrink-0"
              >
                怨좉컼??二쇱냼 ?곸슜
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="?꾨줈紐?二쇱냼 ?낅젰 (怨좉컼 ?뺣낫 ?먮룞 ?곕룞)"
              className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none pr-9"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />
            {siteAddress && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none">
                <MapPin className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        {/* 怨좎옣 遺꾨쪟 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">怨좎옣 遺꾨쪟</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">?곗꽑?쒖쐞:</span>
              <button
                type="button"
                onClick={() => setPriority(priority === 'NORMAL' ? 'URGENT' : 'NORMAL')}
                className={`px-2 py-0.5 rounded text-[11px] font-black border transition-colors ${
                  priority === 'URGENT'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {priority === 'URGENT' ? '?슚 湲닿툒(URGENT)' : '?쇰컲'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {defectSymptoms.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategorySelect(cat)}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  issueCategory === cat
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 怨좎옣 ?곸꽭 利앹긽 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">怨좎옣 ?곸꽭 ?댁슜</label>
          <textarea
            rows={3}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            placeholder="怨좎옣 ?몄냼 ?댁슜 ?낅젰"
            className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
            style={{
              backgroundColor: '#090d16',
              color: '#f8fafc',
              border: '1px solid #334155',
              colorScheme: 'dark'
            }}
          />
        </div>

        {/* ?묒닔???깊븿 諛??곕씫泥?*/}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">?묒닔???깊븿</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="?? 源諛섏옣, ?댁냼??
              className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">?곕씫泥?/label>
            <input
              type="tel"
              value={reporterContact}
              onChange={(e) => setReporterContact(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />
          </div>
        </div>

        {/* 諛⑸Ц ?덉젙??*/}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">諛⑸Ц ?덉젙??/label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
            style={{
              backgroundColor: '#090d16',
              color: '#f8fafc',
              border: '1px solid #334155',
              colorScheme: 'dark'
            }}
          />
        </div>

        {/* 怨좎옣 ?꾩옣 ?ъ쭊 泥⑤? */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <CameraUploader
            label="怨좎옣 ?꾩옣 ?ъ쭊 泥⑤? / 珥ъ쁺"
            images={images}
            onChange={setImages}
            maxImages={4}
          />
        </div>

        {/* ?묒닔 ?깅줉 踰꾪듉 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-base shadow-xl active:scale-98 transition-all"
        >
          {isSubmitting ? '?묒닔 ?깅줉 以?..' : '?꾩옣 AS ?묒닔 ?깅줉'}
        </button>
      </form>

      {/* ?뱥 ?듯솕 ?띿뒪??遺숈뿬?ｊ린 紐⑤떖 */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                怨좉컼 ?듯솕 ?뱀쓬 ?띿뒪???낅젰
              </h3>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={5}
              value={pastedTranscript}
              onChange={(e) => setPastedTranscript(e.target.value)}
              placeholder="?듯솕 ?댁슜??遺숈뿬?ｌ쑝?몄슂...\n?? 102?멸린 ?곸듅???덈릺怨??먯냼由??? ?댁씪 ?ㅼ쟾 源諛섏옣 010-1234-5678 ?먭탳 ?꾩옣 湲됲빐??
              className="w-full rounded-xl p-3 text-xs placeholder-slate-500 focus:outline-none font-sans leading-relaxed"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />

            {/* ?뚯뒪?몄슜 ?덉떆 踰꾪듉 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">?뚯뒪???덉떆:</span>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setPastedTranscript('102?멸린 ?곸듅???덈릺怨??먯냼由??? 源諛섏옣 010-1234-5678 吏??1痢?湲됲빐??)}
                  className="text-left py-1.5 px-2.5 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  "102?멸린 ?곸듅???덈릺怨??먯냼由??? 源諛섏옣 010-1234-5678 吏??1痢?湲됲빐??
                </button>
                <button
                  type="button"
                  onClick={() => setPastedTranscript('205??諛고꽣由?諛⑹쟾 ?쒕룞 ?덇구由??섏뿭???댁냼??010-9876-5432 ?먭??붿껌')}
                  className="text-left py-1.5 px-2.5 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  "205??諛고꽣由?諛⑹쟾 ?쒕룞 ?덇구由??섏뿭???댁냼??010-9876-5432 ?먭??붿껌"
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                痍⑥냼
              </button>
              <button
                type="button"
                onClick={handlePasteSubmit}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg"
              >
                ?뚯떛 諛??먮룞 諛섏쁺
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
