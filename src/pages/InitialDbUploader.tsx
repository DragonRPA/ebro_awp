// @ts-nocheck
import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import {
  exportFullDatabaseBackup,
  resetAllDatabaseTables,
  parseWorkbookToEntities,
  ingestExcelInitialData,
  ParsedInitialData,
  ReconciliationReport,
  parseDispatchExcelWorkbook,
  ingestDispatchData,
  ParsedDispatchData,
  generateAndIngestHistoricalBillingsDirect,
  parseDispatchHistoryText,
  analyzeDispatchHistoryForCustomerDefaults,
  ingestCustomerDefaultsFromDispatchHistory,
  DispatchAnalysisResult,
  CustomerEnrichmentSummary,
  parseBandAsHistoryText,
  analyzeBandAsHistory,
  ingestBandAsHistoryDirect,
  rollbackDispatchData,
  rollbackBandAsHistory,
  reconcileUnassignedBandRepairsWithAssets,
  syncInspectionChecklistFromBandRepairs,
  BandAsAnalysisResult,
  ParsedBandAsRecord
} from '../services/migrationEngine';
import {
  parseConsumableInventoryText,
  ingestConsumablesToDatabase,
  ParsedConsumableItem,
  detectSupplier,
  detectCategory
} from '../services/consumableMigrationService';
import {
  parsePermissionJson,
  ingestPermissionsToDatabase,
  generatePermissionExportPayload,
  generateDefaultPermissionsForAllUsers,
  ParsedPermissionData,
  GenerateDefaultPermsResult
} from '../services/permissionMigrationService';
import { db } from '../services/db';
import * as XLSX from 'xlsx';
import {
  Database,
  Download,
  Trash2,
  Upload,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  XCircle,
  FileText,
  Truck,
  RotateCcw,
  Receipt,
  FileCheck,
  TrendingUp,
  History,
  Wrench,
  Search,
  Eye,
  X,
  Copy,
  Boxes,
  Package,
  ShieldAlert
} from 'lucide-react';
import { OrphanDataCleanupStudio } from '../components/OrphanDataCleanupStudio';

const InitialDbUploaderContent: React.FC = () => {
  const { showSuccessToast, showErrorModal, fullRefreshFromServer, users, customers, contracts, contractAssets, sites, customerSites: appCustomerSites, assets, importBandAsHistory, currentUser } = useApp();
  const customerSites = sites || appCustomerSites || db.sites || [];

  // ?곹깭 愿由?
  const [activeTab, setActiveTab] = useState<'INGEST' | 'CLEANUP' | 'BACKUP' | 'RESET'>('INGEST');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupResult, setBackupResult] = useState<{ filename: string; count: number } | null>(null);

  // 珥덇린???곹깭
  const [isResetting, setIsResetting] = useState(false);
  const [keepAdminUser, setKeepAdminUser] = useState(true);

  // ?묒? ?뚯떛 諛?留덉씠洹몃젅?댁뀡 ?곹깭
  const [fileName, setFileName] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedInitialData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [progressInfo, setProgressInfo] = useState<{ step: number; total: number; message: string }>({
    step: 0,
    total: 13,
    message: ''
  });
  const [reconciliationReport, setReconciliationReport] = useState<ReconciliationReport | null>(null);

  // ?뚭툒 泥?뎄???앹꽦 湲곌컙 ?ㅼ젙
  const [histBillingEnabled, setHistBillingEnabled] = useState(true);
  const [histBillingStart, setHistBillingStart] = useState('2026-01');
  const [histBillingEnd, setHistBillingEnd] = useState('2026-07');
  const [isHistBillingIngesting, setIsHistBillingIngesting] = useState(false);
  const [histBillingProgressMsg, setHistBillingProgressMsg] = useState('');

  // 諛곗감 ?대젰 ?낅줈???곹깭
  const [dispatchFileName, setDispatchFileName] = useState<string>('');
  const [dispatchParsedData, setDispatchParsedData] = useState<ParsedDispatchData | null>(null);
  const [isDispatchParsing, setIsDispatchParsing] = useState(false);
  const [isDispatchIngesting, setIsDispatchIngesting] = useState(false);
  const [isDispatchRollingBack, setIsDispatchRollingBack] = useState(false);
  const [dispatchProgressMsg, setDispatchProgressMsg] = useState('');

  const dispatchFileInputRef = useRef<HTMLInputElement>(null);

  // 諛대뱶 怨쇨굅 AS ?대젰 ?낅줈???곹깭
  const [bandFileName, setBandFileName] = useState<string>('');
  const [bandAnalysisResult, setBandAnalysisResult] = useState<BandAsAnalysisResult | null>(null);
  const [bandSearchTerm, setBandSearchTerm] = useState<string>('');
  const [bandStatusFilter, setBandStatusFilter] = useState<'ALL' | 'COMPLETED' | 'REVISIT' | 'GUIDED'>('ALL');
  const [bandContractFilter, setBandContractFilter] = useState<'ALL' | 'MATCHED' | 'UNMATCHED' | 'GUESSED'>('ALL');
  const [isBandParsing, setIsBandParsing] = useState(false);
  const [isBandIngesting, setIsBandIngesting] = useState(false);
  const [isBandRollingBack, setIsBandRollingBack] = useState(false);
  const [isReconcilingAs, setIsReconcilingAs] = useState(false);
  const [reconcileAsProgressMsg, setReconcileAsProgressMsg] = useState('');
  const [isSyncingInspectionItems, setIsSyncingInspectionItems] = useState(false);
  const [syncInspectionProgressMsg, setSyncInspectionProgressMsg] = useState('');
  const [bandProgressMsg, setBandProgressMsg] = useState('');
  const [selectedAsRecord, setSelectedAsRecord] = useState<ParsedBandAsRecord | null>(null);

  const bandFileInputRef = useRef<HTMLInputElement>(null);

  // ?뱤 ?낅줈???곸옱 嫄댁닔 吏묎퀎
  const uploadedDispatchCount = (db.deliveries || []).filter((d: any) => d.id?.startsWith('DEL-HIST-')).length;
  const uploadedBandAsCount = (db.repairs || []).filter((r: any) => r.source === 'BAND_IMPORT' || r.ticketNo?.startsWith('BAND-') || r.id?.startsWith('rep-band-')).length;
  const unassignedAsCount = (db.repairs || []).filter((r: any) => !r.siteId || r.siteName === '誘몄??뺥쁽?? || r.siteName === '?쇰컲 ?꾩옣').length;

  // ?뙚 諛대뱶 異쒓퀬?붿껌 遺꾩꽍 諛?怨좉컼???꾩옣 湲곕낯 ?붽뎄?ы빆 留덉뒪???숆린???곹깭
  const [dispatchHistFileName, setDispatchHistFileName] = useState<string>('');
  const [dispatchAnalysisResult, setDispatchAnalysisResult] = useState<DispatchAnalysisResult | null>(null);
  const [isAnalyzingDispatchHist, setIsAnalyzingDispatchHist] = useState(false);
  const [isIngestingCustomerDefaults, setIsIngestingCustomerDefaults] = useState(false);
  const [dispatchHistProgressMsg, setDispatchHistProgressMsg] = useState('');
  const [showIgnoredPostsModal, setShowIgnoredPostsModal] = useState(false);
  const dispatchHistFileInputRef = useRef<HTMLInputElement>(null);

  // ?벀 ?뚮え??諛?遺???ш퀬 ?낅줈???곹깭
  const [consumableFileName, setConsumableFileName] = useState<string>('');
  const [parsedConsumables, setParsedConsumables] = useState<ParsedConsumableItem[] | null>(null);
  const [isConsumableParsing, setIsConsumableParsing] = useState(false);
  const [isConsumableIngesting, setIsConsumableIngesting] = useState(false);
  const consumableFileInputRef = useRef<HTMLInputElement>(null);

  // ?뵍 ?꾩쭅??沅뚰븳 留덉뒪???낅줈???곹깭
  const [permFileName, setPermFileName] = useState<string>('');
  const [parsedPermData, setParsedPermData] = useState<ParsedPermissionData | null>(null);
  const [isPermParsing, setIsPermParsing] = useState(false);
  const [isPermIngesting, setIsPermIngesting] = useState(false);
  const [permProgressMsg, setPermProgressMsg] = useState('');
  const permFileInputRef = useRef<HTMLInputElement>(null);

  // ?? ?꾩쭅??沅뚰븳 JSON ?뚯씪 ?뚯떛 ?몃뱾????
  const handlePermFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setPermFileName(file.name);
    setIsPermParsing(true);
    setPermProgressMsg('沅뚰븳 JSON ?뚯씪 ?뚯떛 諛??ъ슜??留ㅽ븨 以?..');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const currentUsers = users || db.users || [];
        const currentDepts = db.departments || [];
        const parsed = parsePermissionJson(text, currentUsers, currentDepts);

        if (!parsed || parsed.validPermissions.length === 0) {
          showErrorModal?.('?좏슚??沅뚰븳 ?곗씠?곕? 李얠쓣 ???놁뒿?덈떎.');
          return;
        }

        setParsedPermData(parsed);
        showSuccessToast?.(`沅뚰븳 ?뚯씪 ?뚯떛 ?꾨즺: ?꾩쭅??${parsed.matchedUsersCount}紐? 沅뚰븳 ${parsed.totalPermissions}嫄?);
      } catch (err: any) {
        showErrorModal?.(`沅뚰븳 ?뚯씪 遺꾩꽍 ?ㅽ뙣: ${err.message || err}`);
      } finally {
        setIsPermParsing(false);
        setPermProgressMsg('');
      }
    };
    reader.readAsText(file);
  };

  // ?? ?꾩쭅??沅뚰븳 DB ?쇨큵 ?뺥솗 ?숆린????
  const handlePermIngest = async () => {
    if (!parsedPermData || parsedPermData.validPermissions.length === 0) {
      showErrorModal?.('?숆린?뷀븷 沅뚰븳 ?곗씠?곌? ?놁뒿?덈떎.');
      return;
    }

    setIsPermIngesting(true);
    setPermProgressMsg('沅뚰븳 ?곗씠??DB ?쇨큵 ?숆린???쒖옉...');
    try {
      const result = await ingestPermissionsToDatabase(parsedPermData, (step, total, msg) => {
        setPermProgressMsg(msg);
      });

      if (result.success) {
        showSuccessToast?.(result.message);
        await fullRefreshFromServer();
      } else {
        showErrorModal?.(result.message);
      }
    } catch (err: any) {
      showErrorModal?.(`沅뚰븳 DB ?숆린???ㅻ쪟: ${err.message || err}`);
    } finally {
      setIsPermIngesting(false);
      setPermProgressMsg('');
    }
  };

  // ?? ?꾩옱 ?쒖뒪??沅뚰븳 留덉뒪??JSON 諛깆뾽 ?ㅼ슫濡쒕뱶 ??
  const handleExportCurrentPermissions = () => {
    try {
      const currentPerms = db.permissions || [];
      const currentUsers = users || db.users || [];
      const currentDepts = db.departments || [];
      const payload = generatePermissionExportPayload(currentPerms, currentUsers, currentDepts);
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.download = `?ъ슜?먭텒??留덉뒪??${nowStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccessToast?.(`?꾩옱 沅뚰븳 ?곗씠??諛깆뾽 ?ㅼ슫濡쒕뱶 ?꾨즺 (?꾩쭅??${currentUsers.length}紐? 沅뚰븳 ${currentPerms.length}嫄?`);
    } catch (err: any) {
      showErrorModal?.(`沅뚰븳 諛깆뾽 ?앹꽦 ?ㅻ쪟: ${err.message}`);
    }
  };

  // ?? 吏곷Т ?쒗뵆由?湲곕컲 ???꾩쭅??沅뚰븳 ?쇨큵 ?먮룞 ?앹꽦 ??
  const [isGeneratingDefaultPerms, setIsGeneratingDefaultPerms] = useState(false);
  const [generatePermsMsg, setGeneratePermsMsg] = useState('');

  const handleGenerateDefaultPermissions = async () => {
    const currentUsersCount = (users || db.users || []).length;
    if (currentUsersCount === 0) {
      showErrorModal?.('?앹꽦???꾩쭅???곗씠?곌? ?놁뒿?덈떎. 癒쇱? ?ъ슜???곗씠?곕? ?낅줈?쒗븯?몄슂.');
      return;
    }
    setIsGeneratingDefaultPerms(true);
    setGeneratePermsMsg('吏곷Т ?쒗뵆由?湲곗? 沅뚰븳 ?먮룞 ?앹꽦 ?쒖옉...');
    try {
      const result = await generateDefaultPermissionsForAllUsers((step, total, msg) => {
        setGeneratePermsMsg(msg);
      });
      if (result.success) {
        showSuccessToast?.(result.message);
        await fullRefreshFromServer();
      } else {
        showErrorModal?.(result.message);
      }
    } catch (err: any) {
      showErrorModal?.(`沅뚰븳 ?먮룞 ?앹꽦 ?ㅻ쪟: ${err.message || err}`);
    } finally {
      setIsGeneratingDefaultPerms(false);
      setGeneratePermsMsg('');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ?? ?뚮え???뚯씪 ?뚯떛 ?몃뱾??(.txt ?먮뒗 .xlsx) ??
  const handleConsumableFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setConsumableFileName(file.name);
    setIsConsumableParsing(true);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const sheetName = wb.SheetNames[0];
          const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
          const items: ParsedConsumableItem[] = rows.map((r, idx) => {
            const mName = String(r['?덈ぉ紐?] || r['紐⑤뜽紐?] || r['?뚮え?덈챸'] || r['?덈챸'] || `?덈ぉ-${idx + 1}`).trim();
            const qty = Number(r['?섎웾'] || r['?꾩옱怨?] || r['?ш퀬?섎웾'] || 1);
            const price = Number(r['?④?'] || r['?낃퀬?④?'] || r['?④?(??'] || 0);
            return {
              modelName: mName,
              stockQty: isNaN(qty) ? 1 : qty,
              unit: String(r['?⑥쐞'] || '媛?).trim(),
              unitPrice: isNaN(price) ? 0 : price,
              supplier: String(r['?쒖“??] || r['怨듦툒泥?] || detectSupplier(mName)).trim(),
              category: String(r['遺꾨쪟'] || r['移댄뀒怨좊━'] || detectCategory(mName)).trim(),
              note: String(r['鍮꾧퀬'] || r['?뱀씠?ы빆'] || '').trim()
            };
          });
          setParsedConsumables(items);
          showSuccessToast?.(`?뚮え???묒? ?뚯떛 ?꾨즺: ${items.length}嫄?);
        } catch (err: any) {
          showErrorModal?.(`?뚮え???묒? ?뚯떛 ?ㅻ쪟: ${err.message}`);
        } finally {
          setIsConsumableParsing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const items = parseConsumableInventoryText(text);
          setParsedConsumables(items);
          showSuccessToast?.(`?뚮え???띿뒪???뚯떛 ?꾨즺: ${items.length}嫄?);
        } catch (err: any) {
          showErrorModal?.(`?뚮え???띿뒪???뚯떛 ?ㅻ쪟: ${err.message}`);
        } finally {
          setIsConsumableParsing(false);
        }
      };
      reader.readAsText(file);
    }
  };

  // ?? ?뚮え???ш퀬 ?쇨큵 DB 諛섏쁺 ??
  const handleConsumablesIngest = async () => {
    if (!parsedConsumables || parsedConsumables.length === 0) {
      showErrorModal?.('諛섏쁺???뚮え??紐⑸줉???놁뒿?덈떎. ?뚯씪???좏깮??二쇱꽭??');
      return;
    }
    setIsConsumableIngesting(true);
    try {
      const res = await ingestConsumablesToDatabase(parsedConsumables, currentUser?.id);
      showSuccessToast?.(`?뚮え??DB 諛섏쁺 ?꾨즺: ?좉퇋 ${res.addedCount}嫄? 媛깆떊 ${res.updatedCount}嫄? 珥??ш퀬 ${res.totalQty}媛?);
      await fullRefreshFromServer();
    } catch (err: any) {
      showErrorModal?.(`?뚮え??DB 諛섏쁺 ?ㅽ뙣: ${err.message}`);
    } finally {
      setIsConsumableIngesting(false);
    }
  };

  // ?? 1. DB ?꾩껜 諛깆뾽 ?ㅽ뻾 ??
  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const { backupData, filename } = await exportFullDatabaseBackup();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalRows = Object.values(backupData).reduce((acc, arr) => acc + (arr?.length || 0), 0);
      setBackupResult({ filename, count: totalRows });
      showSuccessToast?.(`?꾩껜 DB 諛깆뾽 ?꾨즺 (${totalRows.toLocaleString()}嫄?`);
    } catch (e: any) {
      showErrorModal?.(`諛깆뾽 ?ㅽ뙣: ${e.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  // ?? 2. DB 珥덇린???ㅽ뻾 ??
  const handleReset = async () => {
    if (!window.confirm('湲곗〈??紐⑤뱺 ?먯궛, 怨좉컼?? 怨꾩빟, 諛곗감, 泥?뎄 ??μ쓣 ??젣?섍퀬 珥덇린?뷀븯?쒓쿋?듬땲源?')) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetAllDatabaseTables(keepAdminUser);
      if (res.success) {
        showSuccessToast?.(res.message);
        // ??DB 珥덇린???꾨즺 ??localStorage stale 罹먯떆 李⑤떒 + Supabase 理쒖떊 ?곹깭濡?React state 利됱떆 ?숆린??
        await fullRefreshFromServer();
      } else {
        showErrorModal?.(res.message);
      }
    } catch (e: any) {
      showErrorModal?.(`珥덇린???ㅻ쪟: ${e.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  // ?? 3. ?묒? ?뚯씪 ?좏깮 諛?遺꾩꽍 ??
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setFileName(file.name);
    setIsParsing(true);
    setReconciliationReport(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const histRange = histBillingEnabled
          ? { start: histBillingStart, end: histBillingEnd }
          : undefined;
        const parsed = parseWorkbookToEntities(wb, users, histRange);
        setParsedData(parsed);
        showSuccessToast?.(`?묒? 遺꾩꽍 ?꾨즺: 怨꾩빟 ${parsed.stats.contractsCount}嫄? 異쒓퀬諛곗감 ${parsed.stats.outboundDeliveriesCount}嫄? ?뚭툒泥?뎄 ${parsed.stats.historicalBillingsCount}嫄?);
      } catch (err: any) {
        showErrorModal?.(`?묒? ?뚯떛 ?ㅻ쪟: ${err.message}`);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ?? 諛곗감 ?대젰 ?묒? ?뚯떛 ??
  const handleDispatchFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setDispatchFileName(file.name);
    setIsDispatchParsing(true);
    setDispatchParsedData(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const parsed = parseDispatchExcelWorkbook(
          wb,
          customers || [],
          contractAssets || [],
          contracts || [],
          customerSites || []
        );
        setDispatchParsedData(parsed);
        showSuccessToast?.(
          `諛곗감 ?대젰 ?뚯떛 ?꾨즺: 珥?${parsed.stats.total}嫄?/ EXCHANGE ${parsed.stats.exchangeCount}嫄?/ 怨좉컼誘몃ℓ??${parsed.stats.customerUnmatched}嫄?
        );
      } catch (err: any) {
        showErrorModal?.(`諛곗감 ?묒? ?뚯떛 ?ㅻ쪟: ${err.message}`);
      } finally {
        setIsDispatchParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ?? 諛곗감 ?대젰 ?쇨큵 ?곸옱 ??
  const handleDispatchIngest = async () => {
    if (!dispatchParsedData) {
      showErrorModal?.('遺꾩꽍??諛곗감 ?곗씠?곌? ?놁뒿?덈떎. 癒쇱? ?뚯씪???좏깮??二쇱꽭??');
      return;
    }
    setIsDispatchIngesting(true);
    setDispatchProgressMsg('諛곗감 ?대젰 ?곸옱 ?쒖옉...');
    try {
      const result = await ingestDispatchData(dispatchParsedData, (_step, _total, msg) => {
        setDispatchProgressMsg(msg);
      });
      if (result.success) {
        showSuccessToast?.(result.message);
        await fullRefreshFromServer();
      } else {
        showErrorModal?.(result.message);
      }
    } catch (e: any) {
      showErrorModal?.(`諛곗감 ?곸옱 ?ㅻ쪟: ${e.message}`);
    } finally {
      setIsDispatchIngesting(false);
      setDispatchProgressMsg('');
    }
  };

  // ?? 諛곗감 ?대젰 ?쇨큵 濡ㅻ갚 (??젣) ??
  const handleDispatchRollback = async () => {
    if (!window.confirm(`?꾩옱 DB???곸옱??諛곗감 ?대젰 ?곗씠??${uploadedDispatchCount.toLocaleString()}嫄?瑜???젣?섍퀬 ?낅줈???꾩쑝濡??섎룎由ъ떆寃좎뒿?덇퉴?`)) {
      return;
    }
    setIsDispatchRollingBack(true);
    setDispatchProgressMsg('諛곗감 ?대젰 濡ㅻ갚(??젣) 吏꾪뻾 以?..');
    try {
      const res = await rollbackDispatchData((msg) => setDispatchProgressMsg(msg));
      if (res.success) {
        showSuccessToast?.(res.message);
        setDispatchParsedData(null);
        setDispatchFileName('');
        await fullRefreshFromServer();
      } else {
        showErrorModal?.(res.message);
      }
    } catch (err: any) {
      showErrorModal?.(`諛곗감 ?대젰 濡ㅻ갚 ?ㅽ뙣: ${err.message || err}`);
    } finally {
      setIsDispatchRollingBack(false);
      setDispatchProgressMsg('');
    }
  };

  // ?? 怨쇨굅 ?뚭툒 泥?뎄???낅┰ ?좏깮 ?앹꽦 諛??곸옱 ??
  const handleDirectHistBillingIngest = async () => {
    if (!contracts || contracts.length === 0) {
      showErrorModal?.('DB???깅줉??怨꾩빟 ?곗씠?곌? ?놁뒿?덈떎. 癒쇱? 珥덇린 DB ?묒? ?뚯씪???낅줈?쒗빐 二쇱꽭??');
      return;
    }

    if (!histBillingStart || !histBillingEnd) {
      showErrorModal?.('?뚭툒 泥?뎄???앹꽦 ?쒖옉 ?붽낵 醫낅즺 ?붿쓣 ?낅젰??二쇱꽭??');
      return;
    }

    if (histBillingStart > histBillingEnd) {
      showErrorModal?.('?쒖옉 ?붿씠 醫낅즺 ?붾낫???????놁뒿?덈떎.');
      return;
    }

    setIsHistBillingIngesting(true);
    setHistBillingProgressMsg('?뚭툒 泥?뎄??怨꾩궛 諛??곸옱 ?쒖옉...');

    try {
      const result = await generateAndIngestHistoricalBillingsDirect(
        contracts,
        contractAssets || [],
        customers || [],
        assets || [],
        { start: histBillingStart, end: histBillingEnd },
        (_step, _total, msg) => {
          setHistBillingProgressMsg(msg);
        }
      );

      if (result.success) {
        showSuccessToast?.(result.message);
        await fullRefreshFromServer();
      } else {
        showErrorModal?.(result.message);
      }
    } catch (e: any) {
      showErrorModal?.(`?뚭툒 泥?뎄???앹꽦 ?ㅻ쪟: ${e.message}`);
    } finally {
      setIsHistBillingIngesting(false);
      setHistBillingProgressMsg('');
    }
  };

  // ?? 諛대뱶 AS ?대젰 ?띿뒪??JSON ?뚯꽌 諛??곸옱 濡쒖쭅 ??
  const extractFieldsFromBandRaw = (raw: string, date: string, author: string) => {
    let site = '';
    let address = '';
    let contractor = '';
    let assetNo = '';
    let location = '';
    let contact = '';
    let issue = '';

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    for (const l of lines) {
      const colonIdx = l.indexOf(':') !== -1 ? l.indexOf(':') : l.indexOf('竊?);
      if (colonIdx === -1) continue;
      const label = l.slice(0, colonIdx).replace(/\s+/g, '');
      const val = l.slice(colonIdx + 1).trim();

      if (label.includes('?꾩옣')) {
        site = val;
      } else if (label.includes('二쇱냼') || label.includes('?꾨줈紐?)) {
        address = val;
      } else if (label.includes('?낆껜')) {
        contractor = val;
      } else if (label.includes('?꾩튂') || label.includes('?λ퉬?꾩튂')) {
        // ?썳截??꾩튂瑜?癒쇱? ?뚯떛?섏뿬 ?λ퉬踰덊샇(assetNo) ?ㅼ뿼 ?먯쿇 諛⑹?
        location = val;
      } else if (label.includes('愿由щ쾲??) || label.includes('?먯궛踰덊샇') || label.includes('?멸린') || label === '?λ퉬') {
        assetNo = val;
      } else if (label.includes('?묒닔??) || label.includes('?곕씫泥?) || label.includes('?꾪솕') || label.includes('?대떦??)) {
        // ?썳截?諛대뱶 98% 鍮덈룄 '?묒닔?? ?쇰꺼 ?꾨꼍 吏??
        contact = val;
      } else if (label.includes('怨좎옣?댁슜') || label.includes('怨좎옣利앹긽') || label.includes('利앹긽') || label.includes('?댁슜') || label.includes('怨좎옣')) {
        issue = val;
      }
    }

    // ?대갚: 愿由щ쾲??誘몄씤????蹂몃Ц ?뺢퇋??留ㅼ묶
    if (!assetNo) {
      const assetMatch = raw.match(/([A-Za-z]{1,4}[- ]?\d{2,5}|\d{4,5})/);
      if (assetMatch) assetNo = assetMatch[1];
      else if (raw.includes('?꾩껜?λ퉬')) assetNo = '?꾩껜?λ퉬';
      else assetNo = '?꾩옣?뺤씤';
    }

    // ?대갚: ?곕씫泥?誘몄씤????蹂몃Ц ?꾪솕踰덊샇 留ㅼ묶
    if (!contact) {
      const phoneMatch = raw.match(/(01[016789]\d{7,8}|01[016789][-.\s]\d{3,4}[-.\s]\d{4})/);
      if (phoneMatch) contact = phoneMatch[0];
    }

    if (!site) {
      if (raw.includes('SK?섏씠?됱뒪') || raw.includes('?섏씠?됱뒪')) site = '?⑹씤 SK?섏씠?됱뒪';
      else if (raw.includes('?됲깮 P') || raw.includes('P3') || raw.includes('P4')) site = '?됲깮 怨좊뜒';
      else if (raw.includes('?먯＜')) site = '?먯＜ ?몃Ⅴ吏??;
      else site = '?쇰컲 ?꾩옣';
    }

    if (!issue) {
      const issueMatch = raw.match(/(?:怨좎옣|利앹긽)[^:\n]*[:竊??\s*([^\n]+)/);
      if (issueMatch) issue = issueMatch[1].trim();
      else issue = raw.slice(0, 100);
    }

    let inspectionItemCode = '';
    let degradationScore = 0;
    
    // ?뮕 [Phase 1/2] 諛대뱶 鍮낅뜲?댄꽣 怨좎옣 利앹긽 ?ㅼ썙??湲곕컲 ?뺣퉬 留덉뒪??肄붾뱶 諛??뺣퉬?먯닔 1:1 ?뺣? 留ㅽ븨
    const lowerIssue = issue.toLowerCase();
    if (lowerIssue.includes('??댁뼱') || lowerIssue.includes('諛뷀?) || lowerIssue.includes('二쇳뻾') || lowerIssue.includes('議고뼢') || lowerIssue.includes('嫄곕턿??) || lowerIssue.includes('?몃뱾') || lowerIssue.includes('?꾩쭊') || lowerIssue.includes('?꾩쭊')) {
      inspectionItemCode = 'CHK-000004'; // 二쇳뻾/??댁뼱/議고뼢
      degradationScore = 20;
    } else if (lowerIssue.includes('?곸듅') || lowerIssue.includes('?섍컯') || lowerIssue.includes('?묐룞?덈맖') || lowerIssue.includes('?덉삱?쇨컧') || lowerIssue.includes('?좎븬') || lowerIssue.includes('?ㅻ┛??) || lowerIssue.includes('紐⑦꽣') || lowerIssue.includes('?꾩쑀')) {
      inspectionItemCode = 'CHK-000002'; // ?좎븬/?밴컯/?숇젰
      degradationScore = 25;
    } else if (lowerIssue.includes('諛고꽣由?) || lowerIssue.includes('異⑹쟾') || lowerIssue.includes('?꾧린') || lowerIssue.includes('李⑤떒湲?) || lowerIssue.includes('ld') || lowerIssue.includes('81') || lowerIssue.includes('02') || lowerIssue.includes('03') || lowerIssue.includes('?먮윭')) {
      inspectionItemCode = 'CHK-000003'; // ?꾧린/諛고꽣由??먮윭肄붾뱶
      degradationScore = 15;
    } else if (lowerIssue.includes('?묒갑') || lowerIssue.includes('?쇱꽌') || lowerIssue.includes('媛먯?遊?) || lowerIssue.includes('?쒓컙?') || lowerIssue.includes('釉뚮씪耳?) || lowerIssue.includes('?멸?') || lowerIssue.includes('?뚯넀')) {
      inspectionItemCode = 'CHK-000001'; // ?덉쟾?듭뀡/?멸?
      degradationScore = 10;
    } else {
      inspectionItemCode = 'CHK-000005'; // 湲고?/?묒닔
      degradationScore = 5;
    }

    return {
      site: site || '誘몄??뺥쁽??,
      address: address || '',
      contractor: contractor || '?묐젰?낆껜',
      asset_no: assetNo,
      location,
      contact,
      issue,
      date,
      author,
      raw,
      inspectionItemCode,
      degradationScore
    };
  };

  const parseBandTextContent = (text: string) => {
    try {
      const json = JSON.parse(text);
      if (Array.isArray(json) && json.length > 0) return json;
    } catch (_) {}

    const lines = text.split('\n');
    const records: any[] = [];
    let currentPost: { author?: string; date?: string; lines: string[] } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const dateMatch = line.match(/(20\d{2})[.\-??s]+(\d{1,2})[.\-??s]+(\d{1,2})/);
      if (dateMatch && (line.includes('?ㅼ쟾') || line.includes('?ㅽ썑') || line.length < 50)) {
        if (currentPost && currentPost.lines.length > 0) {
          const raw = currentPost.lines.join('\n');
          records.push(extractFieldsFromBandRaw(raw, currentPost.date || '2026-08-01', currentPost.author || ''));
        }
        const y = dateMatch[1];
        const m = String(dateMatch[2]).padStart(2, '0');
        const d = String(dateMatch[3]).padStart(2, '0');
        currentPost = {
          date: `${y}-${m}-${d}`,
          author: line.split(/\s+/)[0] || '',
          lines: []
        };
      } else {
        if (currentPost) {
          currentPost.lines.push(line);
        } else {
          currentPost = { date: '2026-08-01', author: '', lines: [line] };
        }
      }
    }
    if (currentPost && currentPost.lines.length > 0) {
      const raw = currentPost.lines.join('\n');
      records.push(extractFieldsFromBandRaw(raw, currentPost.date || '2026-08-01', currentPost.author || ''));
    }
    return records;
  };

  const handleBandFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBandFileName(file.name);
    setIsBandParsing(true);
    try {
      const text = await file.text();
      const analysis = analyzeBandAsHistory(text, contracts, contractAssets, customers, customerSites, assets, users);
      if (!analysis || analysis.totalCount === 0) {
        showErrorModal?.('?뚯떛 媛?ν븳 AS 寃뚯떆湲 ?곗씠?곕? 李얠쓣 ???놁뒿?덈떎.');
        return;
      }

      setBandAnalysisResult(analysis);
      showSuccessToast?.(`諛대뱶 AS ?곗씠??珥?${analysis.totalCount.toLocaleString()}嫄??꾩닔 遺꾩꽍 ?꾨즺 (怨좎쑀?λ퉬 ${analysis.uniqueAssetsCount.toLocaleString()}?, 怨꾩빟 ${analysis.matchedContractCount.toLocaleString()}嫄?留ㅽ븨)`);
    } catch (err: any) {
      showErrorModal?.(`諛대뱶 ?뚯씪 遺꾩꽍 ?ㅽ뙣: ${err.message || err}`);
    } finally {
      setIsBandParsing(false);
      e.target.value = '';
    }
  };

  const handleBandIngest = async () => {
    if (!bandAnalysisResult || bandAnalysisResult.totalCount === 0) return;

    setIsBandIngesting(true);
    setBandProgressMsg('怨쇨굅 AS ?대젰 ?뺣퉬 留덉뒪??repairs) DB ?곸옱 以?..');
    try {
      const result = await ingestBandAsHistoryDirect(bandAnalysisResult, (curr, tot, msg) => {
        setBandProgressMsg(msg);
      });
      showSuccessToast?.(result.message);
      await fullRefreshFromServer();
    } catch (err: any) {
      showErrorModal?.(`諛대뱶 AS ?곸옱 ?ㅻ쪟: ${err.message || err}`);
    } finally {
      setIsBandIngesting(false);
      setBandProgressMsg('');
    }
  };

  // ?? 諛대뱶 AS ?대젰 ?쇨큵 濡ㅻ갚 (??젣) ??
  const handleBandRollback = async () => {
    if (!window.confirm(`?꾩옱 DB???곸옱??諛대뱶 AS ?대젰 ?곗씠??${uploadedBandAsCount.toLocaleString()}嫄?瑜???젣?섍퀬 ?낅줈???꾩쑝濡??섎룎由ъ떆寃좎뒿?덇퉴?`)) {
      return;
    }
    setIsBandRollingBack(true);
    setBandProgressMsg('諛대뱶 AS ?대젰 濡ㅻ갚(??젣) 吏꾪뻾 以?..');
    try {
      const res = await rollbackBandAsHistory((msg) => setBandProgressMsg(msg));
      if (res.success) {
        showSuccessToast?.(res.message);
        setBandAnalysisResult(null);
        setBandFileName('');
        await fullRefreshFromServer();
      } else {
        showErrorModal?.(res.message);
      }
    } catch (err: any) {
      showErrorModal?.(`諛대뱶 AS ?대젰 濡ㅻ갚 ?ㅽ뙣: ${err.message || err}`);
    } finally {
      setIsBandRollingBack(false);
      setBandProgressMsg('');
    }
  };

  // ?? 湲곗〈 DB 誘몄??뺥쁽??AS ?곗폆 ?먯궛 ???湲곗? ?쇨큵 ??텛??蹂듭썝 ??
  const handleReconcileUnassignedAs = async () => {
    if (unassignedAsCount === 0) {
      showSuccessToast?.('?꾩옱 DB??誘몄??뺥쁽??AS ?곗폆???놁뒿?덈떎. 紐⑤몢 ?뺤긽 留ㅽ븨?섏뼱 ?덉뒿?덈떎.');
      return;
    }
    if (!window.confirm(`?꾩옱 DB??誘몄??뺥쁽??AS ?곗폆(${unassignedAsCount.toLocaleString()}嫄????먯궛 留덉뒪??湲곗??쇰줈 ?쇨큵 ??텛??留ㅽ븨 蹂듭썝?섏떆寃좎뒿?덇퉴?`)) {
      return;
    }
    setIsReconcilingAs(true);
    setReconcileAsProgressMsg('誘몄??뺥쁽??AS ?곗폆 ?먯궛 ??????諛?蹂듭썝 ?쒖옉...');
    try {
      const res = await reconcileUnassignedBandRepairsWithAssets(
        assets || db.assets || [],
        customerSites || db.customerSites || [],
        customers || db.customers || [],
        contracts || db.contracts || [],
        (_step, _total, msg) => setReconcileAsProgressMsg(msg)
      );
      if (res.success) {
        showSuccessToast?.(res.message);
        await fullRefreshFromServer();
      } else {
        showErrorModal?.(res.message);
      }
    } catch (err: any) {
      showErrorModal?.(`誘몄??뺥쁽??留ㅽ븨 蹂듭썝 ?ㅽ뙣: ${err.message || err}`);
    } finally {
      setIsReconcilingAs(false);
      setReconcileAsProgressMsg('');
    }
  };

  // ?? ?뙚 ?뺣퉬??ぉ 留덉뒪???숆린??(AS 鍮낅뜲?댄꽣 ?대윭?ㅽ꽣留?湲곕컲) ??
  const handleSyncInspectionChecklist = async () => {
    if (!window.confirm('湲곗〈 DB??AS ?뺣퉬 ?대젰???좎궗???대윭?ㅽ꽣留?遺꾩꽍?섏뿬 ?뺣퉬??ぉ 留덉뒪?곕? ?뺤꽦?섍퀬 repairs 留ㅽ븨??媛깆떊?섏떆寃좎뒿?덇퉴?')) {
      return;
    }
    setIsSyncingInspectionItems(true);
    setSyncInspectionProgressMsg('?뺣퉬??ぉ 留덉뒪??鍮뚮뱶 諛??숆린???쒖옉...');
    try {
      const res = await syncInspectionChecklistFromBandRepairs((step, total, msg) => {
        setSyncInspectionProgressMsg(msg);
      });
      if (res.success) {
        showSuccessToast?.(res.message);
        await fullRefreshFromServer();
      } else {
        showErrorModal?.(res.message);
      }
    } catch (err: any) {
      showErrorModal?.(`?뺣퉬??ぉ ?숆린???ㅻ쪟: ${err.message || err}`);
    } finally {
      setIsSyncingInspectionItems(false);
      setSyncInspectionProgressMsg('');
    }
  };

  // ?? ?뙚 諛대뱶 異쒓퀬?붿껌 遺꾩꽍 諛?怨좉컼/?꾩옣 ?붽뎄?ы빆 ?숆린???몃뱾????
  const handleDispatchHistFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDispatchHistFileName(file.name);
    setIsAnalyzingDispatchHist(true);
    try {
      const text = await file.text();
      const posts = parseDispatchHistoryText(text);
      if (!posts || posts.length === 0) {
        showErrorModal?.('?뚯떛 媛?ν븳 異쒓퀬?붿껌 寃뚯떆湲 ?곗씠?곕? 李얠쓣 ???놁뒿?덈떎.');
        return;
      }

      const analysis = analyzeDispatchHistoryForCustomerDefaults(
        posts,
        customers || [],
        customerSites || [],
        contracts || [],
        []
      );

      setDispatchAnalysisResult(analysis);
      showSuccessToast?.(`異쒓퀬?붿껌 ${posts.length}嫄?遺꾩꽍 ?꾨즺 (?좏슚 怨꾩빟 怨좉컼 ${analysis.stats.contractedCustomerCount}媛쒖궗 留ㅼ묶)`);
    } catch (err: any) {
      showErrorModal?.(`異쒓퀬?붿껌 ?뚯씪 遺꾩꽍 ?ㅽ뙣: ${err.message || err}`);
    } finally {
      setIsAnalyzingDispatchHist(false);
      e.target.value = '';
    }
  };

  const handleCustomerDefaultsIngest = async () => {
    if (!dispatchAnalysisResult || dispatchAnalysisResult.matchedEnrichments.length === 0) {
      showErrorModal?.('?숆린?뷀븷 ?좏슚 怨꾩빟 怨좉컼 ?곗씠?곌? ?놁뒿?덈떎.');
      return;
    }

    setIsIngestingCustomerDefaults(true);
    setDispatchHistProgressMsg('怨좉컼???꾩옣 湲곕낯 ?붽뎄?ы빆 留덉뒪???숆린??以?..');
    try {
      const res = await ingestCustomerDefaultsFromDispatchHistory(
        dispatchAnalysisResult.matchedEnrichments,
        (step, total, msg) => {
          setDispatchHistProgressMsg(`[${step}/${total}] ${msg}`);
        }
      );

      if (res.success) {
        showSuccessToast?.(res.message);
        await fullRefreshFromServer();
      } else {
        showErrorModal?.(res.message);
      }
    } catch (err: any) {
      showErrorModal?.(`怨좉컼 ?붽뎄?ы빆 ?곸옱 ?ㅻ쪟: ${err.message || err}`);
    } finally {
      setIsIngestingCustomerDefaults(false);
      setDispatchHistProgressMsg('');
    }
  };

  // ?? 諛대뱶 肄섏넄 異붿텧 ?ㅽ겕由쏀듃 ?대┰蹂대뱶 蹂듭궗 ??
  const handleCopyBandScraperScript = () => {
    const scriptCode = `(async () => {
  console.log('?? [ERP] 諛대뱶 postDetailView ??txtBody ?뺣? ?쒖감 ?섏쭛湲?v8.0 ?쒖옉...');

  const hudId = 'band_modal_scraper_hud';
  const oldHud = document.getElementById(hudId);
  if (oldHud) oldHud.remove();

  const hud = document.createElement('div');
  hud.id = hudId;
  hud.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999999;background:rgba(15,23,42,0.96);color:#fff;padding:18px 22px;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,0.5);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;line-height:1.5;min-width:340px;border:2px solid #38bdf8;backdrop-filter:blur(8px);';
  hud.innerHTML = 
    '<div style="font-weight:700;font-size:15px;margin-bottom:10px;color:#38bdf8;display:flex;align-items:center;justify-content:space-between;">' +
      '<span>?슌 諛대뱶 ?쒖감 ?섏쭛湲?v8.0</span>' +
      '<span id="hud_status_badge" style="font-size:11px;font-weight:600;padding:3px 8px;background:#0284c7;border-radius:6px;color:#fff;">?섏쭛 以?/span>' +
    '</div>' +
    '<div style="margin-bottom:6px;display:flex;justify-content:space-between;border-bottom:1px solid #334155;padding-bottom:6px;">' +
      '<span>?섏쭛??寃뚯떆湲:</span>' +
      '<strong id="hud_post_count" style="color:#4ade80;font-size:17px;">0 嫄?/strong>' +
    '</div>' +
    '<div style="margin-bottom:8px;border-bottom:1px solid #334155;padding-bottom:6px;">' +
      '<div style="font-size:11px;color:#94a3b8;">?꾩옱 ?섏쭛???쇱떆 / ?묒꽦??</div>' +
      '<div id="hud_current_date" style="color:#facc15;font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">?湲?以?..</div>' +
    '</div>' +
    '<div style="margin-bottom:12px;font-size:11px;color:#cbd5e1;line-height:1.4;max-height:42px;overflow:hidden;text-overflow:ellipsis;" id="hud_info">寃뚯떆湲 蹂몃Ц(txtBody) ?쎈뒗 以?..</div>' +
    '<div style="display:flex;gap:8px;">' +
      '<button id="hud_btn_stop" style="flex:1;padding:8px 10px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;">以묐떒 諛????/button>' +
      '<button id="hud_btn_save" style="flex:1;padding:8px 10px;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;">吏湲??ㅼ슫濡쒕뱶</button>' +
    '</div>';
  document.body.appendChild(hud);

  const postMap = new Map();
  let isRunning = true;

  const updateHud = (statusText, dateStr, previewMsg, isDone = false) => {
    const elBadge = document.getElementById('hud_status_badge');
    const elCount = document.getElementById('hud_post_count');
    const elDate = document.getElementById('hud_current_date');
    const elInfo = document.getElementById('hud_info');

    if (elCount) elCount.innerText = postMap.size + ' 嫄?;
    if (elBadge && statusText) {
      elBadge.innerText = statusText;
      elBadge.style.background = isDone ? '#10b981' : '#0284c7';
    }
    if (elDate && dateStr) elDate.innerText = dateStr;
    if (elInfo && previewMsg) elInfo.innerText = previewMsg;
  };

  const triggerDownload = () => {
    if (postMap.size === 0) {
      alert('?섏쭛??寃뚯떆湲???놁뒿?덈떎.');
      return;
    }
    const allPosts = Array.from(postMap.values());
    const fullText = allPosts.join('\\n\\n');
    const blob = new Blob(['\\uFEFF' + fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'band_dispatch_history_full.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    updateHud('?꾨즺', null, '??珥?' + postMap.size + '嫄??뚯씪 ?ㅼ슫濡쒕뱶 ?꾨즺!', true);
    console.log('?럦 [ERP] 珥?' + postMap.size + '嫄??ㅼ슫濡쒕뱶 ?꾨즺! (band_dispatch_history_full.txt)');
  };

  document.getElementById('hud_btn_stop')?.addEventListener('click', () => {
    isRunning = false;
    triggerDownload();
  });
  document.getElementById('hud_btn_save')?.addEventListener('click', () => {
    triggerDownload();
  });

  const getDetailLayer = () => {
    return document.querySelector('.postDetailView, [data-viewname="DContentDetailLayerView"], .lyPostViewer, .cPostCard');
  };

  const extractCurrentPost = () => {
    const layer = getDetailLayer();
    if (!layer) return null;

    const authorWrap = layer.querySelector('[data-viewname="DPostAuthorView"], .postWriter');
    let author = '愿由ъ옄';
    let dateStr = '';

    if (authorWrap) {
      const authorText = authorWrap.innerText || '';
      const dm = authorText.match(/(\\d{4}??\s*\\d{1,2}??\s*\\d{1,2}??\s*(?:?ㅼ쟾|?ㅽ썑)\\s*\\d{1,2}:\\d{2})/);
      if (dm) dateStr = dm[1];

      const nameEl = authorWrap.querySelector('.name, strong, a.author, .author');
      if (nameEl && nameEl.innerText.trim()) {
        author = nameEl.innerText.trim();
      } else {
        const lines = authorText.split('\\n').map(s => s.trim()).filter(Boolean);
        if (lines.length > 0 && !lines[0].includes('??) && !lines[0].includes('??)) {
          author = lines[0];
        }
      }
    }

    if (!dateStr) {
      const dm2 = layer.innerText.match(/(\\d{4}??\s*\\d{1,2}??\s*\\d{1,2}??\s*(?:?ㅼ쟾|?ㅽ썑)\\s*\\d{1,2}:\\d{2})/);
      if (dm2) dateStr = dm2[1];
    }

    const bodyEl = layer.querySelector('.postBody .txtBody, [data-viewname="DPostTextView"] .txtBody, .txtBody') ||
                   layer.querySelector('.postBody .postText, .postText');
    if (!bodyEl) return null;

    const bodyText = bodyEl.innerText.trim();
    if (!bodyText) return null;

    let commentsText = '';
    const commentNodes = layer.querySelectorAll('[data-viewname="DCommentItemView"], .comment_item, .uComment, .cCommentItem');
    if (commentNodes.length > 0) {
      const cLines = [];
      commentNodes.forEach(cn => {
        const cText = cn.innerText.trim().replace(/\\n+/g, ' ');
        if (cText && !cText.includes('?볤????④꺼二쇱꽭??) && !cText.includes('?쒖젙吏볤린')) {
          cLines.push('?볤?: ' + cText);
        }
      });
      if (cLines.length > 0) {
        commentsText = '\\n\\n' + cLines.join('\\n');
      }
    }

    const headerLine = (dateStr || '?쇱떆誘몄긽') + ' 寃뚯떆湲';
    const fullText = headerLine + '\\n' + author + '\\n' + bodyText + commentsText;
    const signature = (dateStr || 'NODATE') + ' | ' + bodyText.slice(0, 40);

    return {
      date: dateStr || '?쇱떆誘몄긽',
      author,
      body: bodyText,
      fullText,
      signature
    };
  };

  const waitForNextButton = async (timeoutMs = 4000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const btn = document.querySelector('button.btnNextPost, button._btnNextPost, [class*="btnNextPost"]');
      if (btn) {
        const isHidden = (btn.style.display === 'none') || (window.getComputedStyle(btn).display === 'none');
        const isDisabled = btn.disabled || btn.classList.contains('disabled') || btn.classList.contains('-disabled') || btn.getAttribute('aria-disabled') === 'true';
        if (!isHidden && !isDisabled) {
          return btn;
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  };

  const clickNextButton = (btn) => {
    try {
      btn.scrollIntoView({ block: 'center' });
    } catch(e) {}

    const eventTypes = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    for (const evType of eventTypes) {
      try {
        btn.dispatchEvent(new MouseEvent(evType, { bubbles: true, cancelable: true, view: window }));
      } catch (e) {}
    }
    try { btn.click(); } catch(e) {}

    const innerSpan = btn.querySelector('span, .gSrOnly');
    if (innerSpan) {
      try { innerSpan.click(); } catch(e) {}
    }
  };

  const waitForPostChange = async (oldSignature, maxWaitMs = 6000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(r => setTimeout(r, 200));
      const cur = extractCurrentPost();
      if (cur && cur.body.length > 0 && cur.signature !== oldSignature) {
        await new Promise(r => setTimeout(r, 300));
        return true;
      }
    }
    return false;
  };

  let step = 0;
  let consecutiveFailCount = 0;

  console.log('?봽 諛대뱶 ?곸꽭酉?紐⑤떖 ?쒖감 ?섏쭛 ?쒖옉...');

  while (isRunning && step < 4000) {
    step++;

    const post = extractCurrentPost();
    if (!post) {
      updateHud('?湲?以?, null, '寃뚯떆湲 蹂몃Ц(txtBody) 濡쒕뵫 以?..');
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    if (!postMap.has(post.signature) || post.fullText.length > (postMap.get(post.signature)?.length || 0)) {
      postMap.set(post.signature, post.fullText);
      console.log('?벀 [' + postMap.size + '嫄??섏쭛] ' + post.date + ' | ' + post.author + ' | 蹂몃Ц湲몄씠: ' + post.body.length + '??);
    }

    updateHud('?섏쭛 以?, post.date + ' (' + post.author + ')', '[' + postMap.size + '嫄? ' + post.body.slice(0, 35) + '...');

    let nextBtn = await waitForNextButton(3500);
    if (!nextBtn) {
      await new Promise(r => setTimeout(r, 1000));
      nextBtn = await waitForNextButton(2000);
      if (!nextBtn) {
        console.log('?뢾 ?ㅼ쓬(>) 踰꾪듉?????댁긽 ?놁뒿?덈떎. 留덉?留?湲 ?꾨떖 ?꾨즺!');
        break;
      }
    }

    updateHud('濡쒕뵫 以?, post.date, '?ㅼ쓬(>) 湲 濡쒕뵫 以?..');
    clickNextButton(nextBtn);

    const changed = await waitForPostChange(post.signature, 5000);

    if (!changed) {
      console.warn('?좑툘 湲 ?꾪솚 吏??媛먯?. 踰꾪듉 ?ы겢由??쒕룄...');
      const retryBtn = await waitForNextButton(2000);
      if (retryBtn) {
        clickNextButton(retryBtn);
        const retryChanged = await waitForPostChange(post.signature, 4000);
        if (!retryChanged) {
          consecutiveFailCount++;
          if (consecutiveFailCount >= 2) {
            console.log('?뢾 2???곗냽 湲 蹂寃??놁쓬 -> 留덉?留?湲 ?꾨즺濡??먯젙!');
            break;
          }
        } else {
          consecutiveFailCount = 0;
        }
      } else {
        console.log('?뢾 ?ㅼ쓬 踰꾪듉 ?놁쓬 -> 留덉?留?湲 ?꾨즺!');
        break;
      }
    } else {
      consecutiveFailCount = 0;
    }
  }

  console.log('??理쒖쥌 ?섏쭛 ?꾨즺! 珥?' + postMap.size + '嫄??섏쭛??');
  triggerDownload();
})();`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(scriptCode).then(() => {
        showSuccessToast?.('?뱥 諛대뱶 異붿텧 ?ㅽ겕由쏀듃媛 蹂듭궗?섏뿀?듬땲?? ?ㅼ씠踰?諛대뱶 ?붾㈃??F12 肄섏넄??遺숈뿬?ｌ뼱 ?ㅽ뻾?섏꽭??');
      }).catch(() => {
        showErrorModal?.('?대┰蹂대뱶 蹂듭궗???ㅽ뙣?덉뒿?덈떎.');
      });
    }
  };

  // ?? 4. ?쒖옉???곗씠???쇨큵 ?곸옱 ?ㅽ뻾 ??
  const handleIngest = async () => {
    if (!parsedData) {
      showErrorModal?.('遺꾩꽍???묒? ?곗씠?곌? ?놁뒿?덈떎.');
      return;
    }

    setIsIngesting(true);
    setProgressInfo({ step: 0, total: 13, message: '珥덇린 DB ?곸옱 ?뚯씠?꾨씪???쒖옉...' });

    try {
      const result = await ingestExcelInitialData(parsedData, (step, total, message) => {
        setProgressInfo({ step, total, message });
      });

      if (result.success) {
        setReconciliationReport(result.report);
        showSuccessToast?.(result.message);
        // ???곸옱 ?꾨즺 ??localStorage stale 罹먯떆 ?꾩껜 李⑤떒 + Supabase 理쒖떊 ?곗씠?곕줈 React state 利됱떆 ?숆린??
        // (db.ts??pullFromSupabase媛 ALL_DB_KEYS ?꾩껜瑜??좎젣 珥덇린?뷀븳 ??Supabase pull???섑뻾??
        setProgressInfo({ step: 12, total: 12, message: 'Supabase 理쒖떊 ?곗씠???숆린??以?..' });
        await fullRefreshFromServer();
      } else {
        setReconciliationReport(result.report);
        showErrorModal?.(result.message);
        // ?ㅽ뙣 ?쒖뿉??Supabase ?꾩옱 ?곹깭濡??숆린??(遺遺??곸옱 寃곌낵 諛섏쁺)
        await fullRefreshFromServer();
      }
    } catch (e: any) {
      showErrorModal?.(`?곸옱 ?ㅽ뻾 ?ㅻ쪟: ${e.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* ?곷떒 ??댄? ?ㅻ뜑 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Database size={28} color="#2563eb" />
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>珥덇린DB ?낅줈??/h1>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              ?좉퇋 怨좉컼 ?쒕퉬??媛쒖떆瑜??꾪븳 怨쇨굅 ?쇱씠?꾩궗?댄겢 泥댁씤 蹂듭썝 諛?泥?뎄 留덇컧 ?쇨큵 ?곸옱
            </span>
          </div>
        </div>

        {/* ???ㅻ퉬寃뚯씠??*/}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('INGEST')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: activeTab === 'INGEST' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              backgroundColor: activeTab === 'INGEST' ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-card)',
              color: activeTab === 'INGEST' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Upload size={16} />
            珥덇린DB ?낅줈??
          </button>

          <button
            onClick={() => setActiveTab('CLEANUP')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: activeTab === 'CLEANUP' ? '1px solid #ef4444' : '1px solid var(--border-color)',
              backgroundColor: activeTab === 'CLEANUP' ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-card)',
              color: activeTab === 'CLEANUP' ? '#dc2626' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <ShieldAlert size={16} />
            遺덈????곗씠???뺣━
          </button>

          <button
            onClick={() => setActiveTab('BACKUP')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: activeTab === 'BACKUP' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              backgroundColor: activeTab === 'BACKUP' ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-card)',
              color: activeTab === 'BACKUP' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={16} />
            DB 諛깆뾽
          </button>

          <button
            onClick={() => setActiveTab('RESET')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: activeTab === 'RESET' ? '1px solid #ef4444' : '1px solid #cbd5e1',
              backgroundColor: activeTab === 'RESET' ? '#fef2f2' : 'var(--bg-card)',
              color: activeTab === 'RESET' ? '#b91c1c' : '#475569',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Trash2 size={16} />
            DB 珥덇린??
          </button>
        </div>
      </div>

      {/* ?? TAB 1: 珥덇린DB ?낅줈??(硫붿씤) ?? */}
      {activeTab === 'INGEST' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. ?뚯씪 ?좏깮 移대뱶 */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                ?묒? ?뚯씪 ?좏깮
              </label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                5媛??쒗듃(蹂댁쑀?먯궛?꾪솴, 蹂댁쑀?λ퉬 ?꾨??꾪솴, 嫄곕옒泥섏젙蹂댄쁽?? ?낆껜蹂꾨쭏媛먯씪?? 怨꾩빟?꾪솴)媛 ?ы븿??珥덇린 ?꾪솴 ?묒? ?뚯씪(.xlsx)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing || isIngesting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: isParsing || isIngesting ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <FileSpreadsheet size={18} />
                ?묒? ?뚯씪 ?좏깮
              </button>

              {fileName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  <FileText size={16} color="#475569" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{fileName}</span>
                </div>
              )}

              {isParsing && (
                <span style={{ fontSize: '13px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <RefreshCw size={14} className="animate-spin" />
                  ?묒? 5媛??쒗듃 諛??쇱씠?꾩궗?댄겢 ?대깽??遺꾩꽍 以?..
                </span>
              )}
            </div>
          </div>

          {/* 2. 怨쇨굅 ?뚭툒 泥?뎄???좏깮???앹꽦 移대뱶 */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Layers size={16} color="#d97706" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#d97706', whiteSpace: 'nowrap' }}>
                怨쇨굅 ?뚭툒 泥?뎄???앹꽦 (?좏깮 ?ㅽ뻾)
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                吏??湲곌컙 ??怨꾩빟蹂??붾퀎 泥?뎄?쒕? ?낅┰?곸쑝濡?怨꾩궛?섏뿬 DB???쇨큵 ?앹꽦?⑸땲??
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>?쒖옉 ??/label>
                <input
                  type="month"
                  value={histBillingStart}
                  onChange={e => setHistBillingStart(e.target.value)}
                  disabled={isHistBillingIngesting}
                  style={{
                    padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px',
                    fontSize: '14px', color: 'var(--text-main)', backgroundColor: 'var(--bg-app)', outline: 'none'
                  }}
                />
              </div>

              <span style={{ fontSize: '18px', color: 'var(--text-muted)', paddingBottom: '8px' }}>~</span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>醫낅즺 ??/label>
                <input
                  type="month"
                  value={histBillingEnd}
                  onChange={e => setHistBillingEnd(e.target.value)}
                  disabled={isHistBillingIngesting}
                  style={{
                    padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px',
                    fontSize: '14px', color: 'var(--text-main)', backgroundColor: 'var(--bg-app)', outline: 'none'
                  }}
                />
              </div>

              {/* 怨쇨굅 ?뚭툒 泥?뎄???앹꽦 ?ㅽ뻾 踰꾪듉 */}
              <button
                onClick={handleDirectHistBillingIngest}
                disabled={isHistBillingIngesting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                  padding: '9px 20px', backgroundColor: isHistBillingIngesting ? '#94a3b8' : '#d97706',
                  color: 'white', border: 'none', borderRadius: '6px',
                  cursor: isHistBillingIngesting ? 'not-allowed' : 'pointer',
                  fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap'
                }}
              >
                {isHistBillingIngesting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    ?뚭툒 泥?뎄???앹꽦 以?..
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    ?뚭툒 泥?뎄???앹꽦 諛??곸옱 ?쒖옉
                  </>
                )}
              </button>

              <div style={{
                padding: '7px 12px', backgroundColor: '#fffbeb', border: '1px solid #fcd34d',
                borderRadius: '6px', fontSize: '12px', color: '#92400e', whiteSpace: 'nowrap'
              }}>
                ?좑툘 {histBillingStart} ~ {histBillingEnd} 湲곌컙 怨꾩빟蹂??붾퀎 泥?뎄??????앹꽦
              </div>
            </div>

            {/* 吏꾪뻾 硫붿떆吏 */}
            {histBillingProgressMsg && (
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={13} className="animate-spin" />
                {histBillingProgressMsg}
              </div>
            )}
          </div>

          {/* ??諛곗감 ?대젰 ?낅줈??移대뱶 */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Truck size={16} color="#0369a1" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0369a1', whiteSpace: 'nowrap' }}>
                  諛곗감 ?대젰 ?낅줈??
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  諛곗감?꾪솴 ?묒? ?뚯씪 (2025-04 ~ 2026-09)
                </span>
                {uploadedDispatchCount > 0 && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    DB ?곸옱?? {uploadedDispatchCount.toLocaleString()}嫄?
                  </span>
                )}
              </div>

              {/* ?곗륫 諛곗감 ?대젰 濡ㅻ갚 踰꾪듉 */}
              {uploadedDispatchCount > 0 && (
                <button
                  type="button"
                  onClick={handleDispatchRollback}
                  disabled={isDispatchRollingBack || isDispatchIngesting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '6px',
                    border: '1px solid #fca5a5', backgroundColor: isDispatchRollingBack ? '#fee2e2' : '#fef2f2',
                    color: '#dc2626', fontSize: '12px', fontWeight: 600,
                    cursor: (isDispatchRollingBack || isDispatchIngesting) ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: (isDispatchRollingBack || isDispatchIngesting) ? 0.6 : 1
                  }}
                >
                  {isDispatchRollingBack ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  諛곗감 ?대젰 濡ㅻ갚 ({uploadedDispatchCount.toLocaleString()}嫄???젣)
                </button>
              )}
            </div>

            {/* ?뚯씪 ?좏깮 踰꾪듉 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <input
                ref={dispatchFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleDispatchFileSelect}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => dispatchFileInputRef.current?.click()}
                disabled={isDispatchParsing || isDispatchIngesting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', backgroundColor: '#0369a1', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
                  opacity: (isDispatchParsing || isDispatchIngesting) ? 0.5 : 1
                }}
              >
                <FileSpreadsheet size={14} />
                諛곗감 ?묒? ?뚯씪 ?좏깮
              </button>

              {dispatchFileName && (
                <span style={{ fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  {dispatchFileName}
                </span>
              )}

              {isDispatchParsing && (
                <span style={{ fontSize: '12px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <RefreshCw size={13} className="animate-spin" /> ?뚯떛 以?..
                </span>
              )}
            </div>

            {/* ?뚯떛 寃곌낵 ?꾨━酉?*/}
            {dispatchParsedData && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  {[
                    { label: '珥?諛곗감嫄?, value: `${dispatchParsedData.stats.total}嫄?, color: 'var(--text-main)' },
                    { label: '?꾨즺', value: `${dispatchParsedData.stats.completed}嫄?, color: '#059669' },
                    { label: '?뺣났(EXCHANGE)', value: `${dispatchParsedData.stats.exchangeCount}嫄?, color: '#7c3aed' },
                    { label: '2026 ?댁넚??, value: `${dispatchParsedData.stats.transportCompaniesCount}媛쒖궗`, color: '#0284c7' },
                    { label: '怨좉컼 誘몃ℓ??, value: `${dispatchParsedData.stats.customerUnmatched}嫄?, color: dispatchParsedData.stats.customerUnmatched > 0 ? '#dc2626' : '#059669' },
                    { label: '怨꾩빟 誘몃ℓ??, value: `${dispatchParsedData.stats.contractUnmatched}嫄?, color: dispatchParsedData.stats.contractUnmatched > 0 ? '#d97706' : '#059669' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ backgroundColor: 'var(--bg-app)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color, marginTop: '2px' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* 吏꾪뻾 硫붿떆吏 */}
                {dispatchProgressMsg && (
                  <div style={{ fontSize: '13px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={13} className="animate-spin" />
                    {dispatchProgressMsg}
                  </div>
                )}

                {/* ?곸옱 踰꾪듉 */}
                <button
                  onClick={handleDispatchIngest}
                  disabled={isDispatchIngesting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                    padding: '10px 20px', backgroundColor: isDispatchIngesting ? '#94a3b8' : '#0369a1',
                    color: 'white', border: 'none', borderRadius: '6px',
                    cursor: isDispatchIngesting ? 'not-allowed' : 'pointer',
                    fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'flex-start'
                  }}
                >
                  {isDispatchIngesting
                    ? <><RefreshCw size={15} className="animate-spin" /> 諛곗감 ?대젰 ?곸옱 以?..</>
                    : <><Upload size={15} /> 諛곗감 ?대젰 ?쇨큵 ?곸옱 ?쒖옉</>
                  }
                </button>
              </div>
            )}
          </div>

          {/* ??諛대뱶 怨쇨굅 AS ?대젰 鍮낅뜲?댄꽣 ?낅줈??移대뱶 */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <Wrench size={16} color="#16a34a" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#16a34a', whiteSpace: 'nowrap' }}>
                  ?꾩옣 AS 怨쇨굅 ?대젰 (?ㅼ씠踰?諛대뱶) 鍮낅뜲?댄꽣 ?낅줈??
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  ?ㅼ씠踰?諛대뱶 AS 寃뚯떆湲 ?띿뒪???뚯씪 (?먯궛 湲곕컲 ?꾩옣 ?먮룞 ??텛???묒옱)
                </span>
                {uploadedBandAsCount > 0 && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    DB ?곸옱?? {uploadedBandAsCount.toLocaleString()}嫄?
                  </span>
                )}
                {unassignedAsCount > 0 && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    誘몄??뺥쁽?? {unassignedAsCount.toLocaleString()}嫄?
                  </span>
                )}
              </div>

              {/* ?곗륫 ?≪뀡 踰꾪듉援?*/}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {unassignedAsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleReconcileUnassignedAs}
                    disabled={isReconcilingAs || isBandRollingBack || isBandIngesting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 12px', borderRadius: '6px',
                      border: '1px solid #fcd34d', backgroundColor: isReconcilingAs ? '#fef3c7' : '#fffbeb',
                      color: '#b45309', fontSize: '12px', fontWeight: 600,
                      cursor: (isReconcilingAs || isBandRollingBack || isBandIngesting) ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      opacity: (isReconcilingAs || isBandRollingBack || isBandIngesting) ? 0.6 : 1
                    }}
                  >
                    {isReconcilingAs ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    誘몄??뺥쁽??留ㅽ븨 蹂듭썝 ({unassignedAsCount.toLocaleString()}嫄?
                  </button>
                )}

                {uploadedBandAsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleSyncInspectionChecklist}
                    disabled={isSyncingInspectionItems || isBandRollingBack || isBandIngesting || isReconcilingAs}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 12px', borderRadius: '6px',
                      border: '1px solid #3b82f6', backgroundColor: isSyncingInspectionItems ? '#dbeafe' : '#eff6ff',
                      color: '#1d4ed8', fontSize: '12px', fontWeight: 600,
                      cursor: (isSyncingInspectionItems || isBandRollingBack || isBandIngesting || isReconcilingAs) ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      opacity: (isSyncingInspectionItems || isBandRollingBack || isBandIngesting || isReconcilingAs) ? 0.6 : 1
                    }}
                  >
                    {isSyncingInspectionItems ? <RefreshCw size={13} className="animate-spin" /> : <Layers size={13} />}
                    ?뺣퉬??ぉ 留덉뒪???숆린??
                  </button>
                )}

                {uploadedBandAsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleBandRollback}
                    disabled={isBandRollingBack || isBandIngesting || isReconcilingAs || isSyncingInspectionItems}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 12px', borderRadius: '6px',
                      border: '1px solid #fca5a5', backgroundColor: isBandRollingBack ? '#fee2e2' : '#fef2f2',
                      color: '#dc2626', fontSize: '12px', fontWeight: 600,
                      cursor: (isBandRollingBack || isBandIngesting || isReconcilingAs || isSyncingInspectionItems) ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      opacity: (isBandRollingBack || isBandIngesting || isReconcilingAs || isSyncingInspectionItems) ? 0.6 : 1
                    }}
                  >
                    {isBandRollingBack ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    諛대뱶 AS ?대젰 濡ㅻ갚 ({uploadedBandAsCount.toLocaleString()}嫄???젣)
                  </button>
                )}
              </div>
            </div>

            {/* ?뺣퉬??ぉ 留덉뒪???숆린??吏꾪뻾 ?곹깭 諛?*/}
            {syncInspectionProgressMsg && (
              <div style={{ marginBottom: '12px', fontSize: '13px', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#eff6ff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <RefreshCw size={14} className="animate-spin" />
                <span>{syncInspectionProgressMsg}</span>
              </div>
            )}

            {/* 誘몄??뺥쁽??蹂듭썝 吏꾪뻾 ?곹깭 諛?*/}
            {reconcileAsProgressMsg && (
              <div style={{ marginBottom: '12px', fontSize: '13px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fef3c7', padding: '10px 14px', borderRadius: '6px', border: '1px solid #fcd34d' }}>
                <RefreshCw size={14} className="animate-spin" />
                <span>{reconcileAsProgressMsg}</span>
              </div>
            )}

            {/* ?뚯씪 ?좏깮 踰꾪듉 & ?섑뵆 濡쒕뱶 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <input
                ref={bandFileInputRef}
                type="file"
                accept=".txt,.json,.html"
                onChange={handleBandFileSelect}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => bandFileInputRef.current?.click()}
                disabled={isBandParsing || isBandIngesting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', backgroundColor: '#16a34a', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
                  opacity: (isBandParsing || isBandIngesting) ? 0.5 : 1
                }}
              >
                <FileText size={14} />
                諛대뱶 AS ?뚯씪 (.txt / .json / .html) ?좏깮
              </button>

              {bandFileName && (
                <span style={{ fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  ?뱞 {bandFileName}
                </span>
              )}

              {isBandParsing && (
                <span style={{ fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <RefreshCw size={13} className="animate-spin" /> AS 鍮낅뜲?댄꽣 5? 留ㅽ듃由?뒪 ?꾩닔 遺꾩꽍 以?..
                </span>
              )}
            </div>

            {/* ?뚯떛 寃곌낵 ?꾨━酉?*/}
            {bandAnalysisResult && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 6? 吏??諛?*/}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  {[
                    { label: '珥?AS 遺꾩꽍 嫄댁닔', value: `${bandAnalysisResult.totalCount.toLocaleString()}嫄?, color: 'var(--text-main)' },
                    { label: '怨좎쑀 ?λ퉬 留ㅽ븨', value: `${bandAnalysisResult.uniqueAssetsCount.toLocaleString()}?`, color: '#2563eb' },
                    { label: '?먯궛 ??텛???꾩옣 留ㅽ븨', value: `${(bandAnalysisResult.assetBacktrackedSiteCount || 0).toLocaleString()}嫄?, color: '#059669', sub: '?꾩옣紐??먮룞 蹂듭썝' },
                    { label: '?좏슚 怨꾩빟 ?곕룞', value: `${bandAnalysisResult.matchedContractCount.toLocaleString()}嫄?, color: '#7c3aed', sub: bandAnalysisResult.singleAssetGuessedCount > 0 ? `(1? 怨꾩빟 異붿젙 ${bandAnalysisResult.singleAssetGuessedCount}嫄?` : undefined },
                    { label: '?꾩옣 議곗튂?꾨즺', value: `${bandAnalysisResult.completedCount.toLocaleString()}嫄?, color: '#16a34a' },
                    { label: '?듭씪諛⑸Ц / ?덈궡', value: `${(bandAnalysisResult.revisitCount + bandAnalysisResult.guidedCount).toLocaleString()}嫄?, color: '#d97706' },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label} style={{ backgroundColor: 'var(--bg-app)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color, marginTop: '2px' }}>{value}</div>
                      {sub && <div style={{ fontSize: '10px', color: '#059669', marginTop: '1px' }}>{sub}</div>}
                    </div>
                  ))}
                </div>

                {/* 寃??諛??꾪꽣 而⑦듃濡?諛?*/}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: 'var(--bg-app)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '200px' }}>
                    <Search size={14} color="#64748b" />
                    <input
                      type="text"
                      placeholder="?꾩옣紐? 怨좉컼?? ?λ퉬踰덊샇, 怨좎옣?댁슜, ?묒꽦??寃??.."
                      value={bandSearchTerm}
                      onChange={e => setBandSearchTerm(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['ALL', 'COMPLETED', 'REVISIT', 'GUIDED'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => setBandStatusFilter(st)}
                        style={{
                          padding: '4px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer',
                          backgroundColor: bandStatusFilter === st ? '#1e293b' : '#e2e8f0',
                          color: bandStatusFilter === st ? '#ffffff' : '#475569'
                        }}
                      >
                        {st === 'ALL' ? '?꾩껜 ?곹깭' : st === 'COMPLETED' ? '議곗튂?꾨즺' : st === 'REVISIT' ? '?듭씪諛⑸Ц' : '?덈궡醫낃껐'}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['ALL', 'MATCHED', 'GUESSED', 'UNMATCHED'] as const).map(cf => (
                      <button
                        key={cf}
                        onClick={() => setBandContractFilter(cf)}
                        style={{
                          padding: '4px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer',
                          backgroundColor: bandContractFilter === cf ? '#7c3aed' : '#e2e8f0',
                          color: bandContractFilter === cf ? '#ffffff' : '#475569'
                        }}
                      >
                        {cf === 'ALL' ? '怨꾩빟 ?꾩껜' : cf === 'MATCHED' ? '怨꾩빟 留ㅽ븨' : cf === 'GUESSED' ? '1? 異붿젙' : '誘몃ℓ??}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 怨좊???????뚯씠釉?*/}
                {(() => {
                  const filteredRecords = bandAnalysisResult.records.filter(r => {
                    const matchesSearch = !bandSearchTerm || 
                      r.site.includes(bandSearchTerm) || 
                      r.customer.includes(bandSearchTerm) || 
                      r.assetNo.includes(bandSearchTerm) || 
                      r.issue.includes(bandSearchTerm) || 
                      r.author.includes(bandSearchTerm) ||
                      (r.matchedCustomerName || '').includes(bandSearchTerm);
                    
                    const matchesStatus = bandStatusFilter === 'ALL' || r.status === bandStatusFilter;
                    const matchesContract = 
                      bandContractFilter === 'ALL' ? true :
                      bandContractFilter === 'MATCHED' ? Boolean(r.matchedContractId) :
                      bandContractFilter === 'GUESSED' ? r.isSingleAssetGuessed :
                      !r.matchedContractId;

                    return matchesSearch && matchesStatus && matchesContract;
                  });

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <span>?꾪꽣留곷맂 嫄댁닔: <strong>{filteredRecords.length.toLocaleString()}嫄?/strong> / 珥?{bandAnalysisResult.totalCount.toLocaleString()}嫄?/span>
                        <span style={{ fontSize: '11px' }}>???곸쐞 50嫄??쒖떆 以?(?꾩껜 {bandAnalysisResult.totalCount.toLocaleString()}嫄??쇨큵 ?곸옱 ???</span>
                      </div>

                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflowX: 'auto', maxHeight: '360px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                              <th style={{ padding: '8px 10px' }}>No</th>
                              <th style={{ padding: '8px 10px' }}>?묒닔?쇱옄</th>
                              <th style={{ padding: '8px 10px' }}>?묒꽦??/th>
                              <th style={{ padding: '8px 10px' }}>怨좉컼??/ ?꾩옣</th>
                              <th style={{ padding: '8px 10px' }}>愿由щ쾲??(紐⑤뜽)</th>
                              <th style={{ padding: '8px 10px' }}>怨좎옣 ?댁슜</th>
                              <th style={{ padding: '8px 10px' }}>議곗튂 ?댁슜</th>
                              <th style={{ padding: '8px 10px' }}>?뚯냽 怨꾩빟 留ㅽ븨</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center' }}>?곹깭</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center' }}>?먮Ц</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRecords.slice(0, 50).map(r => (
                              <tr key={r.idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{r.idx}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{r.date}</td>
                                <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.author || '-'}</td>
                                <td style={{ padding: '6px 10px' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>{r.matchedCustomerName || r.customer}</span>
                                    {r.isAssetBacktracked && (
                                      <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        ?먯궛??텛??
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.matchedSiteName || r.site}</div>
                                  <div style={{ fontSize: '10.5px', color: '#0284c7' }}>?뱧 {r.matchedSiteAddress || r.address || '二쇱냼 誘몃벑濡?}</div>
                                </td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span style={{ fontWeight: 700, color: r.matchedAssetId ? '#2563eb' : '#475569' }}>
                                    {r.matchedAssetNo || r.assetNo}
                                  </span>
                                  {r.isSingleAssetGuessed && (
                                    <span className="badge badge-warning" style={{ fontSize: '9px', marginLeft: '4px' }}>1?異붿젙</span>
                                  )}
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>({r.matchedModelName})</span>
                                </td>
                                <td style={{ padding: '6px 10px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {r.issue}
                                </td>
                                <td style={{ padding: '6px 10px', color: '#059669', fontWeight: 600 }}>
                                  {r.actionTaken}
                                </td>
                                <td style={{ padding: '6px 10px' }}>
                                  {r.matchedContractNo ? (
                                    <span className="badge badge-info" style={{ fontSize: '10px' }}>{r.matchedContractNo}</span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>- (?쇰컲?대젰)</span>
                                  )}
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                  <span className={`badge ${
                                    r.status === 'COMPLETED' ? 'badge-success' :
                                    r.status === 'REVISIT' ? 'badge-warning' :
                                    r.status === 'GUIDED' ? 'badge-info' : 'badge-secondary'
                                  }`} style={{ fontSize: '10px' }}>
                                    {r.status === 'COMPLETED' ? '議곗튂?꾨즺' : r.status === 'REVISIT' ? '?듭씪諛⑸Ц' : '?덈궡醫낃껐'}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                  <button
                                    onClick={() => setSelectedAsRecord(r)}
                                    style={{ padding: '2px 6px', fontSize: '10.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', cursor: 'pointer' }}
                                  >
                                    ?곸꽭
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* 吏꾪뻾 硫붿떆吏 */}
                {bandProgressMsg && (
                  <div style={{ fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <RefreshCw size={14} className="animate-spin" />
                    <strong>{bandProgressMsg}</strong>
                  </div>
                )}

                {/* ?고븯??醫낃껐 踰꾪듉 (Gutenberg Z-Pattern) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    ?뮕 珥?<strong>{bandAnalysisResult.totalCount.toLocaleString()}嫄?/strong>??怨쇨굅 AS ?대젰???뺣퉬 留덉뒪??`repairs`) 諛??먯궛/怨꾩빟 ??꾨씪?몄뿉 臾대늻????ν빀?덈떎.
                  </div>

                  <button
                    onClick={handleBandIngest}
                    disabled={isBandIngesting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 24px', backgroundColor: isBandIngesting ? '#94a3b8' : '#16a34a',
                      color: 'white', border: 'none', borderRadius: '6px',
                      cursor: isBandIngesting ? 'not-allowed' : 'pointer',
                      fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap'
                    }}
                  >
                    {isBandIngesting
                      ? <><RefreshCw size={15} className="animate-spin" /> 諛대뱶 AS ?대젰 ?쇨큵 ?곸옱 以?..</>
                      : <><Upload size={15} /> ?? 怨쇨굅 AS ?대젰 ?꾩닔 ?뺣퉬 留덉뒪??`repairs`) DB ?쇨큵 ?곸옱 ?ㅽ뻾</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ??諛대뱶 異쒓퀬?붿껌 遺꾩꽍 & ?좏슚 怨꾩빟泥?湲곕낯 ?붽뎄?ы빆(?듭뀡/蹂댁뼇/?ㅽ럺) 留덉뒪???숆린??移대뱶 */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <FileCheck size={16} color="#7c3aed" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                異쒓퀬?붿껌 ?대젰 遺꾩꽍 & 怨좉컼 ?붽뎄?ы빆 留덉뒪??DB ?숆린??
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                怨쇨굅 異쒓퀬?붿껌 ?띿뒪?몄뿉??怨좉컼???붽뎄??留욎땄 ?듭뀡쨌蹂댁뼇쨌?뱀씠?ы빆??留덉뒪??DB???뺥솗??湲곗뼲?섏뿬, ?ν썑 ?좉퇋 怨꾩빟 諛?異쒓퀬 ??100% ?먮룞 ?곸냽쨌?ъ궗?⑺빀?덈떎.
              </span>
            </div>

            {/* ?뚯씪 ?좏깮 踰꾪듉 & ?곹깭 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <input
                ref={dispatchHistFileInputRef}
                type="file"
                accept=".txt,.json,.html"
                onChange={handleDispatchHistFileSelect}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => dispatchHistFileInputRef.current?.click()}
                disabled={isAnalyzingDispatchHist || isIngestingCustomerDefaults}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', backgroundColor: '#7c3aed', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
                  opacity: (isAnalyzingDispatchHist || isIngestingCustomerDefaults) ? 0.5 : 1
                }}
              >
                <FileText size={14} />
                異쒓퀬?붿껌 ?뚯씪 (.txt / .json) ?좏깮
              </button>

              <button
                onClick={handleCopyBandScraperScript}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap'
                }}
                title="?ㅼ씠踰?諛대뱶 ?붾㈃?먯꽌 F12 肄섏넄??遺숈뿬?ｌ뼱 以묐났 ?놁씠 ?꾩껜 異쒓퀬 ?대젰??異붿텧?섎뒗 ?먮컮?ㅽ겕由쏀듃 肄붾뱶瑜??대┰蹂대뱶??蹂듭궗?⑸땲??"
              >
                <Copy size={13} />
                諛대뱶 ?꾩껜 寃뚯떆湲 異붿텧 ?ㅽ겕由쏀듃 蹂듭궗
              </button>

              {dispatchHistFileName && (
                <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {dispatchHistFileName}
                </span>
              )}

              {isAnalyzingDispatchHist && (
                <span style={{ fontSize: '12px', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <RefreshCw size={13} className="animate-spin" /> 異쒓퀬?붿껌 ?곗씠???뺣? 遺꾩꽍 以?..
                </span>
              )}
            </div>

            {/* ?뚯떛 諛?遺꾩꽍 寃곌낵 ?꾨━酉?*/}
            {dispatchAnalysisResult && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* ?듦퀎 吏??*/}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  {[
                    { label: '珥?異쒓퀬?붿껌 嫄댁닔', value: `${dispatchAnalysisResult.stats.totalParsed}嫄?, color: 'var(--text-main)' },
                    { label: '?좏슚 怨꾩빟 怨좉컼??, value: `${dispatchAnalysisResult.stats.contractedCustomerCount}媛쒖궗`, color: '#7c3aed' },
                    { label: '?좏슚 怨꾩빟 ?꾩옣', value: `${dispatchAnalysisResult.stats.contractedSiteCount}媛쒖냼`, color: '#2563eb' },
                    { label: '異붿텧 湲곕낯 ?좎긽?듭뀡', value: `${dispatchAnalysisResult.stats.extractedOptionCount}嫄?, color: '#059669' },
                    { label: '異붿텧 湲곕낯 蹂댁뼇?묒뾽', value: `${dispatchAnalysisResult.stats.extractedProtectionCount}嫄?, color: '#d97706' },
                    { label: '?쒖쇅??誘멸퀎??嫄?, value: `${dispatchAnalysisResult.stats.ignoredCount}嫄?, color: 'var(--text-muted)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ backgroundColor: 'var(--bg-app)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color, marginTop: '2px' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* 留ㅼ묶???좏슚 怨좉컼??湲곕낯?듭뀡 ?ㅼ젙 怨좊??????洹몃━??*/}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                      怨좉컼??湲곕낯?듭뀡 ?ㅼ젙(?좎긽?듭뀡쨌蹂댁뼇?묒뾽) 異붿텧 ?댁뿭 ({dispatchAnalysisResult.matchedEnrichments.length}媛쒖궗)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      * ?쒓퀎??理쒖떊媛??곗꽑 & 怨좉컼/?꾩옣 湲곕낯?듭뀡 ?먮룞 ?곸냽
                    </span>
                  </div>

                  <div style={{ maxHeight: '280px', overflowY: 'auto', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>怨좉컼?щ챸</th>
                          <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>怨꾩빟??/th>
                          <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>理쒖떊?쇱옄</th>
                          <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>湲곕낯 ?좎긽?듭뀡</th>
                          <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>湲곕낯 蹂댁뼇?묒뾽</th>
                          <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>?꾩옣/?대떦??/th>
                          <th style={{ padding: '8px 10px', minWidth: '180px' }}>怨좉컼 ?뱀씠?ы빆</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dispatchAnalysisResult.matchedEnrichments.map(item => {
                          return (
                            <tr key={item.customerId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                                {item.customerName}
                              </td>
                              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(37, 99, 235, 0.12)', color: 'var(--primary)', fontSize: '11px', fontWeight: 600 }}>
                                  {item.contractCount}嫄?
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {item.latestDate}
                              </td>
                              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: item.extractedDefaults.defaultPaidOptions ? '#059669' : '#94a3b8' }}>
                                {item.extractedDefaults.defaultPaidOptions || '(湲곕낯)'}
                              </td>
                              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: item.extractedDefaults.defaultProtection ? '#059669' : '#94a3b8' }}>
                                {item.extractedDefaults.defaultProtection || '(湲곕낯)'}
                              </td>
                              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                {item.sites.map(s => s.siteName).join(', ') || '-'}
                                {item.contacts.length > 0 && ` (${item.contacts[0].name} ${item.contacts[0].contact})`}
                              </td>
                              <td style={{ padding: '8px 10px', color: item.extractedDefaults.specialNotes ? '#1e293b' : '#94a3b8', fontSize: '11.5px', maxWidth: '300px' }}>
                                {item.extractedDefaults.specialNotes || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ?쒖쇅??怨쇨굅/誘멸퀎??嫄??덈궡 諛?*/}
                {dispatchAnalysisResult.ignoredPosts.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      ?슟 怨쇨굅 醫낅즺 嫄곕옒泥?/ 怨꾩빟 誘몃낫??嫄?<strong>{dispatchAnalysisResult.ignoredPosts.length}嫄?/strong>? ????ㅼ뿼 諛⑹? ?먯튃???곕씪 ?덉쟾?섍쾶 ?쒖쇅?섏뿀?듬땲??
                    </span>
                    <button
                      onClick={() => setShowIgnoredPostsModal(!showIgnoredPostsModal)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px', fontWeight: 600 }}
                    >
                      {showIgnoredPostsModal ? '?쒖쇅 紐⑸줉 ?リ린' : '?쒖쇅 ?곸꽭 紐⑸줉 ?뺤씤'}
                    </button>
                  </div>
                )}

                {/* ?쒖쇅 紐⑸줉 ?곸꽭 ?쒕∼?ㅼ슫 */}
                {showIgnoredPostsModal && (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fafafa', padding: '8px' }}>
                    <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '4px 6px' }}>?쇱떆</th>
                          <th style={{ padding: '4px 6px' }}>怨좉컼?щ챸</th>
                          <th style={{ padding: '4px 6px' }}>?꾩옣紐?/th>
                          <th style={{ padding: '4px 6px' }}>?쒖쇅 ?ъ쑀</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dispatchAnalysisResult.ignoredPosts.map((ip, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 6px', color: '#94a3b8' }}>{ip.date}</td>
                            <td style={{ padding: '4px 6px', fontWeight: 600 }}>{ip.customerName}</td>
                            <td style={{ padding: '4px 6px' }}>{ip.siteName}</td>
                            <td style={{ padding: '4px 6px', color: '#ef4444' }}>{ip.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 吏꾪뻾 硫붿떆吏 */}
                {dispatchHistProgressMsg && (
                  <div style={{ fontSize: '13px', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={13} className="animate-spin" />
                    {dispatchHistProgressMsg}
                  </div>
                )}

                {/* ?곸옱 ?꾧껐 踰꾪듉 (Gutenberg Terminal Action) */}
                <button
                  onClick={handleCustomerDefaultsIngest}
                  disabled={isIngestingCustomerDefaults}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                    padding: '10px 20px', backgroundColor: isIngestingCustomerDefaults ? '#94a3b8' : '#7c3aed',
                    color: 'white', border: 'none', borderRadius: '6px',
                    cursor: isIngestingCustomerDefaults ? 'not-allowed' : 'pointer',
                    fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'flex-start'
                  }}
                >
                  {isIngestingCustomerDefaults
                    ? <><RefreshCw size={15} className="animate-spin" /> 留덉뒪??DB ?숆린??以?..</>
                    : <><Upload size={15} /> 怨좉컼 ?붽뎄?ы빆 留덉뒪???쇨큵 DB ?숆린??(湲곗뼲 諛??먮룞 ?곸냽)</>
                  }
                </button>
              </div>
            )}
          </div>

          {/* ??愿由??뚮え??諛?遺???ш퀬 ?낅줈??移대뱶 */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Boxes size={18} color="#0284c7" />
                  <label style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    愿由??뚮え??諛?遺???ш퀬 ?낅줈??
                  </label>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                    諛대뱶 ?ш퀬 ?ㅼ궗 ?띿뒪??/ ?묒?
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  ?뚮え?덉옱怨?txt ?뚯씪 ?먮뒗 ?묒? 紐⑸줉??遺꾩꽍?섏뿬 二쇨린???ш퀬 諛?理쒖큹 ?낃퀬 ?대젰???쇨큵 ?깅줉?⑸땲??
                </span>
              </div>
            </div>

            {/* ?뚯씪 ?낅줈??諛?*/}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'var(--bg-main)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
              <input
                ref={consumableFileInputRef}
                type="file"
                accept=".txt,.xlsx,.xls"
                onChange={handleConsumableFileSelect}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => consumableFileInputRef.current?.click()}
                disabled={isConsumableParsing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '6px',
                  backgroundColor: '#0284c7', color: 'white',
                  border: 'none', fontSize: '13px', fontWeight: 600,
                  cursor: isConsumableParsing ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {isConsumableParsing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                ?뚯씪 ?좏깮 (.txt / .xlsx)
              </button>

              <span style={{ fontSize: '13px', color: consumableFileName ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: consumableFileName ? 600 : 400 }}>
                {consumableFileName || '?좏깮???뚯씪 ?놁쓬 (.txt / .xlsx ??'}
              </span>
            </div>

            {/* ?뚯떛 寃곌낵 怨좊????뚯씠釉?諛?理쒖쥌 諛섏쁺 踰꾪듉 */}
            {parsedConsumables && parsedConsumables.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    ?뚯떛 寃곌낵 紐⑸줉 ({parsedConsumables.length}嫄?
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    愿由??뚮え???쒗뭹 諛?湲곗큹 ?섎웾
                  </span>
                </div>

                <div style={{ maxHeight: '340px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 1, borderBottom: '1px solid var(--border-color)' }}>
                      <tr style={{ color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '40px' }}>No</th>
                        <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>遺꾨쪟</th>
                        <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>怨듦툒泥?釉뚮옖??/th>
                        <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>?덈ぉ紐?/ 紐⑤뜽紐?/th>
                        <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>?ш퀬 ?섎웾</th>
                        <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>湲곗? ?④?</th>
                        <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>?ш퀬 湲덉븸</th>
                        <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>鍮꾧퀬 / ?섎━?곹깭</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedConsumables.map((item, idx) => {
                        const totalItemVal = item.stockQty * (item.unitPrice || 0);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                            <td style={{ padding: '7px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{idx + 1}</td>
                            <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', fontSize: '11px', fontWeight: 600 }}>
                                {item.category || '湲고??뚮え??}
                              </span>
                            </td>
                            <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--text-main)' }}>{item.supplier}</td>
                            <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-main)' }}>{item.modelName}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: '#0284c7' }}>
                              {item.stockQty.toLocaleString()} {item.unit || '媛?}
                            </td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                              {item.unitPrice ? `??{item.unitPrice.toLocaleString()}` : '-'}
                            </td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-main)' }}>
                              {totalItemVal ? `??{totalItemVal.toLocaleString()}` : '-'}
                            </td>
                            <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                              {item.note ? (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: item.repairingQty ? '#fee2e2' : '#fef3c7', color: item.repairingQty ? '#b91c1c' : '#b45309', fontSize: '11px', fontWeight: 600 }}>
                                  {item.note}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>?뺤긽 媛??/span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 4?④퀎 ?고븯??Gutenberg Z-?⑦꽩: ?붿빟 寃利앹떇 & 理쒖쥌 ?곸옱 ?꾧껐 踰꾪듉 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '12px 16px', backgroundColor: 'var(--bg-main)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '13px' }}>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      珥??덈ぉ?? <strong style={{ color: 'var(--text-main)' }}>{parsedConsumables.length}醫?/strong>
                    </span>
                    <span style={{ color: 'var(--border-color)' }}>|</span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      珥??ш퀬 ?섎웾: <strong style={{ color: '#0284c7' }}>{parsedConsumables.reduce((acc, it) => acc + it.stockQty, 0).toLocaleString()}媛?/strong>
                    </span>
                    <span style={{ color: 'var(--border-color)' }}>|</span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      ?섎━以? <strong style={{ color: '#ef4444' }}>{parsedConsumables.reduce((acc, it) => acc + (it.repairingQty || 0), 0)}媛?/strong>
                    </span>
                    <span style={{ color: 'var(--border-color)' }}>|</span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      ?ш퀬 ?먯궛 ?됯??? <strong style={{ color: '#059669' }}>??parsedConsumables.reduce((acc, it) => acc + (it.stockQty * (it.unitPrice || 0)), 0).toLocaleString()}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleConsumablesIngest}
                    disabled={isConsumableIngesting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 20px', borderRadius: '6px',
                      backgroundColor: isConsumableIngesting ? '#94a3b8' : '#0284c7',
                      color: 'white', border: 'none',
                      fontSize: '14px', fontWeight: 600,
                      cursor: isConsumableIngesting ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isConsumableIngesting ? (
                      <><RefreshCw size={15} className="animate-spin" /> DB 諛섏쁺 以?..</>
                    ) : (
                      <><Upload size={15} /> ?뚮え???ш퀬 DB 諛섏쁺 ({parsedConsumables.length}嫄?</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ???꾩쭅??沅뚰븳 留덉뒪???낅줈??移대뱶 */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#4f46e5" />
                  <label style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    ?꾩쭅??沅뚰븳 留덉뒪???낅줈??
                  </label>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#eef2ff', color: '#4338ca', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    JSON 沅뚰븳 留덉뒪??
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  議곗젙 ?꾨즺???꾩쭅?먮퀎 硫붾돱 議고쉶(canView) 諛????canSave) 沅뚰븳???뚯씪?먯꽌 ?쎌뼱? ?뺥솗?섍쾶 ?쇨큵 ?숆린?뷀빀?덈떎.
                </span>
              </div>

              {/* ?곗긽???≪뀡 踰꾪듉援?*/}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* 吏곷Т ?쒗뵆由?沅뚰븳 ?먮룞 ?앹꽦 踰꾪듉 (?좉퇋) */}
                <button
                  type="button"
                  onClick={handleGenerateDefaultPermissions}
                  disabled={isGeneratingDefaultPerms || isPermIngesting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '6px',
                    border: '1px solid #059669', backgroundColor: isGeneratingDefaultPerms ? '#d1fae5' : '#ecfdf5',
                    color: '#065f46', fontSize: '13px', fontWeight: 600,
                    cursor: (isGeneratingDefaultPerms || isPermIngesting) ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: (isGeneratingDefaultPerms || isPermIngesting) ? 0.7 : 1
                  }}
                >
                  {isGeneratingDefaultPerms
                    ? <><RefreshCw size={14} className="animate-spin" /> {generatePermsMsg || '沅뚰븳 ?먮룞 ?앹꽦 以?..'}</>
                    : <><ShieldCheck size={14} /> 吏곷Т ?쒗뵆由?沅뚰븳 ?먮룞 ?앹꽦</>
                  }
                </button>
                <button
                  type="button"
                  onClick={handleExportCurrentPermissions}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '6px',
                    border: '1px solid #4f46e5', backgroundColor: '#eef2ff',
                    color: '#4338ca', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  <Download size={14} />
                  ?꾩옱 沅뚰븳 諛깆뾽 ?ㅼ슫濡쒕뱶 (.json)
                </button>
              </div>
            </div>

            {/* ?뚯씪 ?좏깮 諛?*/}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'var(--bg-main)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
              <input
                ref={permFileInputRef}
                type="file"
                accept=".json"
                onChange={handlePermFileSelect}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => permFileInputRef.current?.click()}
                disabled={isPermParsing || isPermIngesting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '6px',
                  backgroundColor: '#4f46e5', color: 'white',
                  border: 'none', fontSize: '13px', fontWeight: 600,
                  cursor: (isPermParsing || isPermIngesting) ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: (isPermParsing || isPermIngesting) ? 0.6 : 1
                }}
              >
                {isPermParsing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                沅뚰븳 ?뚯씪 ?좏깮 (.json)
              </button>

              <span style={{ fontSize: '13px', color: permFileName ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: permFileName ? 600 : 400, whiteSpace: 'nowrap' }}>
                {permFileName || `?좏깮???뚯씪 ?놁쓬 (?? ?ъ슜?먭텒??留덉뒪??${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json)`}
              </span>

              {isPermParsing && (
                <span style={{ fontSize: '12px', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                  <RefreshCw size={13} className="animate-spin" /> {permProgressMsg || '?뚯떛 以?..'}
                </span>
              )}
            </div>

            {/* ?뚯떛 寃곌낵 ?꾨━酉?諛??쇨큵 ?숆린??*/}
            {parsedPermData && (

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 4? ?붿빟 吏??*/}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>留ㅽ븨 ?꾩쭅??/div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>{parsedPermData.matchedUsersCount}紐?/div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>珥?沅뚰븳 ??ぉ</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#4f46e5', marginTop: '2px' }}>{parsedPermData.totalPermissions}嫄?/div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>誘몃ℓ??湲곕줉</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: parsedPermData.unmatchedRecordsCount > 0 ? '#dc2626' : '#059669', marginTop: '2px' }}>
                      {parsedPermData.unmatchedRecordsCount}嫄?
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>湲곗? ?뚯씪 ?쇱옄</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>
                      {parsedPermData.metadata?.exportedDateText || '?뱀씪'}
                    </div>
                  </div>
                </div>

                {/* 誘몃ℓ???뚮┝ (?덉쓣 寃쎌슦) */}
                {parsedPermData.unmatchedUsers.length > 0 && (
                  <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '12px', color: '#b91c1c' }}>
                    ?좑툘 ?꾩옱 DB?먯꽌 ?쇱튂?섏? ?딅뒗 ?ъ슜?? {parsedPermData.unmatchedUsers.join(', ')} ({parsedPermData.unmatchedRecordsCount}嫄??쒖쇅??
                  </div>
                )}

                {/* 怨좊????뚯씠釉? ?꾩쭅?먮퀎 沅뚰븳 ?명똿 ?꾨━酉?*/}
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 1, borderBottom: '1px solid var(--border-color)' }}>
                      <tr style={{ color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 10px', whiteSpace: 'nowrap', width: '40px' }}>No</th>
                        <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>遺??/th>
                        <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>?깅챸</th>
                        <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>濡쒓렇??ID</th>
                        <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>吏곴툒/??븷</th>
                        <th style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'center' }}>議고쉶 ?덉슜</th>
                        <th style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'center' }}>????덉슜</th>
                        <th style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>珥?沅뚰븳 ??ぉ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedPermData.userSummaries.map((u, idx) => (
                        <tr key={u.userId} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                          <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{idx + 1}</td>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', fontWeight: 500 }}>{u.departmentName}</td>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-main)' }}>{u.name}</td>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{u.loginId}</td>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: u.role === 'ADMIN' ? '#fee2e2' : u.role === 'MANAGER' ? '#fef3c7' : '#f1f5f9', color: u.role === 'ADMIN' ? '#b91c1c' : u.role === 'MANAGER' ? '#b45309' : '#475569', fontSize: '11px', fontWeight: 600 }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', textAlign: 'center', color: '#059669', fontWeight: 600 }}>
                            {u.viewPermsCount}媛?硫붾돱
                          </td>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', textAlign: 'center', color: '#4f46e5', fontWeight: 600 }}>
                            {u.savePermsCount}媛?硫붾돱
                          </td>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                            {u.totalPerms}嫄?
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Gutenberg Z-?⑦꽩 ?곕????≪뀡 諛?*/}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '12px 16px', backgroundColor: 'var(--bg-main)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      ?숆린????? <strong style={{ color: 'var(--text-main)' }}>{parsedPermData.matchedUsersCount}紐?/strong>
                    </span>
                    <span style={{ color: 'var(--border-color)' }}>|</span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      珥?沅뚰븳 ??ぉ: <strong style={{ color: '#4f46e5' }}>{parsedPermData.totalPermissions}嫄?/strong>
                    </span>
                    {permProgressMsg && (
                      <span style={{ color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                        <RefreshCw size={13} className="animate-spin" /> {permProgressMsg}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handlePermIngest}
                    disabled={isPermIngesting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 20px', borderRadius: '6px',
                      backgroundColor: isPermIngesting ? '#94a3b8' : '#4f46e5',
                      color: 'white', border: 'none',
                      fontSize: '14px', fontWeight: 600,
                      cursor: isPermIngesting ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isPermIngesting ? (
                      <><RefreshCw size={15} className="animate-spin" /> 沅뚰븳 DB ?숆린??吏꾪뻾 以?..</>
                    ) : (
                      <><Upload size={15} /> 沅뚰븳 ?쇨큵 ?뺥솗 ?숆린??({parsedPermData.totalPermissions}嫄?</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. ?뚯떛 ?듦퀎 ?꾨━酉?移대뱶?댁뒪 */}
          {parsedData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  ?쇱씠?꾩궗?댄겢 ?대깽??泥댁씤 諛??뚭퀎 ?곗씠??遺꾩꽍 ?꾪솴
                </h3>
                <span style={{ fontSize: '13px', color: '#059669', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  ???ㅽ궎留?諛??몃옒??FK) 臾닿껐??100% 寃利??꾨즺
                </span>
              </div>

              {/* ?듦퀎 移대뱶 洹몃━??(?쇱씠?꾩궗?댄겢 & ?뚭퀎) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                {/* 1. 留덉뒪???먯궛 */}
                <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={14} /> ?먯궛 ???(assets)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                    {parsedData.stats.assetsCount} ?
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    ??ъ쨷 怨꾩빟?곕룞 {parsedData.stats.activeRentedAssetsCount || 0}? 100% 留ㅽ븨
                  </div>
                </div>

                {/* 2. ?λ퉬 紐⑤뜽 & ?쒖썝臾몄꽌 */}
                <div style={{ backgroundColor: '#f0fdfa', padding: '14px', borderRadius: '8px', border: '1px solid #ccfbf1' }}>
                  <div style={{ fontSize: '12px', color: '#0f766e', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={14} /> 紐⑤뜽 & ?ㅻЪ ?쒖썝??(products)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#115e59', marginTop: '4px' }}>
                    {parsedData.stats.productsCount} 醫?
                  </div>
                  <div style={{ fontSize: '11px', color: '#0d9488', marginTop: '2px' }}>
                    R2 ?쒖썝???덉쟾臾몄꽌 {parsedData.stats.docLinkedProductsCount || 0}醫??먮룞 ?곕룞
                  </div>
                </div>

                {/* 3. ?뚰깉 怨꾩빟 */}
                <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileCheck size={14} /> ?뚰깉 怨꾩빟 (contracts)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                    {parsedData.stats.contractsCount} 嫄?
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>怨좉컼??{parsedData.stats.customersCount}??/ ?꾩옣 {parsedData.stats.sitesCount}媛쒖냼</div>
                </div>

                {/* 4. 異쒓퀬 諛곗감 泥댁씤 */}
                <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <div style={{ fontSize: '12px', color: '#3b82f6', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Truck size={14} /> 異쒓퀬 諛곗감 (deliveries)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                    {parsedData.stats.outboundDeliveriesCount} 嫄?
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>異쒓퀬寃??{parsedData.stats.outboundInspectionsCount}嫄??먮룞 ?뱀씤</div>
                </div>

                {/* 5. ?뚯닔 諛곗감 泥댁씤 */}
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: '12px', color: '#10b981', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <RotateCcw size={14} /> ?뚯닔 諛곗감 (deliveries)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                    {parsedData.stats.inboundDeliveriesCount} 嫄?
                  </div>
                  <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '2px' }}>醫낅즺 怨꾩빟 ?낃퀬 ?깅줉 100% 留ㅽ븨</div>
                </div>

                {/* 6. 怨쇨굅 ?뚭툒 泥?뎄??*/}
                <div style={{ backgroundColor: '#faf5ff', padding: '14px', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                  <div style={{ fontSize: '12px', color: '#7e22ce', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <History size={14} /> 怨쇨굅 ?뚭툒 泥?뎄??(billings)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#6b21a8', marginTop: '4px' }}>
                    {parsedData.stats.historicalBillingsCount} 嫄?
                  </div>
                  <div style={{ fontSize: '11px', color: '#9333ea', marginTop: '2px' }}>?꾩쟻 ??parsedData.stats.totalHistoricalBillingAmount.toLocaleString()}</div>
                </div>

                {/* 7. 2026-08 ?뱀썡 泥?뎄??*/}
                <div style={{ backgroundColor: '#fefce8', padding: '14px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                  <div style={{ fontSize: '12px', color: '#a16207', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Receipt size={14} /> 2026-08 ?뱀썡 泥?뎄 ?⑷퀎
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#854d0e', marginTop: '4px' }}>
                    ??parsedData.stats.currentMonthBillingAmount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#ca8a04', marginTop: '2px' }}>71媛쒖궗 泥?뎄??(李⑥븸 ?? ?쇱튂)</div>
                </div>

                {/* 8. ?꾨? 留ㅼ엯 & ?몄긽誘몄닔湲?*/}
                <div style={{ backgroundColor: '#fff7ed', padding: '14px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                  <div style={{ fontSize: '12px', color: '#c2410c', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={14} /> ?꾨? 留ㅼ엯 & 遺?鍮?
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#9a3412', marginTop: '4px' }}>
                    ??parsedData.stats.totalPurchaseBillingAmount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#ea580c', marginTop: '2px' }}>
                    ?몄긽誘몄닔湲?{parsedData.stats.receivablesCount}嫄?(?대컲鍮???
                  </div>
                </div>
              </div>

              {/* 3. ?쇨큵 ?곸옱 ?ㅽ뻾 踰꾪듉 諛??꾨줈洹몃젅??諛?*/}
              <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      ?쇱씠?꾩궗?댄겢 泥댁씤 & ?쒖옉???곗씠???쇨큵 ?곸옱 ?ㅽ뻾
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      13?④퀎 ?쒖감 DAG 諛곗튂 ?곸옱: 援щ쾭????젣 ??異쒓퀬/?뚯닔 諛곗감 + 寃??+ 怨쇨굅 ?뚭툒 泥?뎄 + 8??泥?뎄 + 留ㅼ엯 ?뺤궛
                    </div>
                  </div>

                  <button
                    onClick={handleIngest}
                    disabled={isIngesting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 28px',
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '15px',
                      cursor: isIngesting ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isIngesting ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                    ?꾩껜 ?곗씠???쇨큵 ?곸옱 ?쒖옉
                  </button>
                </div>

                {isIngesting && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-main)' }}>
                      <span>{progressInfo.message}</span>
                      <span>{progressInfo.step} / {progressInfo.total} ({Math.round((progressInfo.step / progressInfo.total) * 100)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(progressInfo.step / progressInfo.total) * 100}%`,
                          height: '100%',
                          backgroundColor: '#059669',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. 4? ?李⑤?議?Reconciliation) 寃利?由ы룷??*/}
          {reconciliationReport && (
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <ShieldCheck size={24} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  4? ?李⑤?議?Reconciliation) 臾닿껐??寃利?利앸챸??
                </h3>
                <span
                  style={{
                    marginLeft: 'auto',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: reconciliationReport.allPassed ? '#dcfce7' : '#fee2e2',
                    color: reconciliationReport.allPassed ? '#166534' : '#991b1b',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {reconciliationReport.allPassed ? '?꾩닔 寃利??듦낵 (李⑥븸 ??)' : '寃利?遺덉씪移?諛쒖깮'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {/* 1. ?먯궛 ?섎웾 ???*/}
                <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>1. ?먯궛 ?섎웾 ???/div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>?묒? 蹂댁쑀?먯궛:</span>
                    <span style={{ fontWeight: 600 }}>{reconciliationReport.assetCountMatch.excel} ?</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>DB ?먯궗 ?먯궛:</span>
                    <span style={{ fontWeight: 600, color: '#059669' }}>{reconciliationReport.assetCountMatch.db} ?</span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: reconciliationReport.assetCountMatch.isMatch ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {reconciliationReport.assetCountMatch.isMatch ? '??100% ?쇱튂' : '???섎웾 遺덉씪移?}
                  </div>
                </div>

                {/* 2. 8??留ㅼ텧 珥앹븸 ???*/}
                <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>2. 8??泥?뎄 珥앹븸 ???/div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>?묒? 泥?뎄?⑷퀎:</span>
                    <span style={{ fontWeight: 600 }}>??reconciliationReport.currentBillingTotalMatch.excel.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>DB 泥?뎄??珥앺빀:</span>
                    <span style={{ fontWeight: 600, color: '#059669' }}>??reconciliationReport.currentBillingTotalMatch.db.toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: reconciliationReport.currentBillingTotalMatch.isMatch ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {reconciliationReport.currentBillingTotalMatch.isMatch ? '??李⑥븸 ?? (?꾩쟾 ?쇱튂)' : `??李⑥븸 ??{reconciliationReport.currentBillingTotalMatch.diff.toLocaleString()}`}
                  </div>
                </div>

                {/* 3. 泥?뎄 ?곸꽭 ?쇱씤 ???*/}
                <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>3. 泥?뎄 ?곸꽭 ?쇱씤 ???/div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>泥?뎄 ?ㅻ뜑 ??</span>
                    <span style={{ fontWeight: 600 }}>??reconciliationReport.currentDetailsTotalMatch.headerSum.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>泥?뎄 ?곸꽭 ??</span>
                    <span style={{ fontWeight: 600, color: '#059669' }}>??reconciliationReport.currentDetailsTotalMatch.detailSum.toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: reconciliationReport.currentDetailsTotalMatch.isMatch ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {reconciliationReport.currentDetailsTotalMatch.isMatch ? '???⑥닔 ?ㅼ감 蹂댁젙 ?꾨즺 (??)' : `??李⑥븸 ??{reconciliationReport.currentDetailsTotalMatch.diff.toLocaleString()}`}
                  </div>
                </div>

                {/* 4. ?쇱씠?꾩궗?댄겢 諛곗감 留ㅽ븨 ???*/}
                <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>4. ?쇱씠?꾩궗?댄겢 諛곗감 留ㅽ븨</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>珥?怨꾩빟 嫄댁닔:</span>
                    <span style={{ fontWeight: 600 }}>{reconciliationReport.lifecycleChainMatch.contracts} 嫄?/span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>異쒓퀬 諛곗감 嫄댁닔:</span>
                    <span style={{ fontWeight: 600, color: '#059669' }}>{reconciliationReport.lifecycleChainMatch.outboundDeliveries} 嫄?/span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                    ??怨꾩빟 ?鍮?100% 異쒓퀬 諛곗감 ?곌퀎 ?꾨즺
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ?? TAB: 遺덈????곗씠???뺣━ (怨좎븘怨꾩빟, 媛곸쥌 ?섎ː ?? ?? */}
      {activeTab === 'CLEANUP' && (
        <OrphanDataCleanupStudio />
      )}

      {/* ?? TAB 2: DB ?꾩껜 諛깆뾽 ?? */}
      {activeTab === 'BACKUP' && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              ?꾩껜 ?곗씠?곕쿋?댁뒪 諛깆뾽 ?대낫?닿린
            </h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              ?꾩옱 Supabase / 濡쒖뺄 DB???곸옱??紐⑤뱺 20媛??뚯씠釉붿쓽 ?곗씠?곕? JSON ?뚯씪濡??ㅼ슫濡쒕뱶?섏뿬 蹂닿??⑸땲??
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: isBackingUp ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {isBackingUp ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
              ?꾩껜 DB 諛깆뾽 ?뚯씪 ?ㅼ슫濡쒕뱶 (.json)
            </button>

            {backupResult && (
              <span style={{ fontSize: '13px', color: '#059669', fontWeight: 600, whiteSpace: 'nowrap' }}>
                ??{backupResult.filename} ?ㅼ슫濡쒕뱶 ?꾨즺 ({backupResult.count.toLocaleString()}嫄?
              </span>
            )}
          </div>
        </div>
      )}

      {/* ?? TAB 3: DB 珥덇린???? */}
      {activeTab === 'RESET' && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid #fecaca', padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
              <AlertTriangle size={20} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                ?곗씠?곕쿋?댁뒪 ?꾩껜 珥덇린??
              </h3>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              湲곗〈???낅젰???먯궛, 怨좉컼?? ?꾩옣, 怨꾩빟, 泥?뎄?? ?섎궔 ??紐⑤뱺 鍮꾩쫰?덉뒪 ?곗씠?곕? ??젣?⑸땲??
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '16px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={keepAdminUser}
                onChange={(e) => setKeepAdminUser(e.target.checked)}
              />
              ?쒖뒪??愿由ъ옄 怨꾩젙(admin/users/departments)? 蹂댁〈
            </label>

            <button
              onClick={handleReset}
              disabled={isResetting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: isResetting ? '#94a3b8' : '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: isResetting ? 'not-allowed' : 'pointer',
                width: 'fit-content',
                whiteSpace: 'nowrap'
              }}
            >
              {isResetting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  ?곗씠???꾩껜 珥덇린??吏꾪뻾 以?..
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  ?곗씠???꾩껜 珥덇린???ㅽ뻾
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 諛대뱶 AS ?④굔 ?곸꽭 ?먮Ц 紐⑤떖 */}
      {selectedAsRecord && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', maxWidth: '600px', width: '100%', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={18} color="#16a34a" />
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                  AS 寃뚯떆湲 ?곸꽭 ?댁뿭 No. {selectedAsRecord.idx}
                </span>
              </div>
              <button
                onClick={() => setSelectedAsRecord(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>?묒닔?쇱옄:</span> <strong>{selectedAsRecord.date}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>?묒꽦???뺣퉬??</span> <strong>{selectedAsRecord.author}</strong> ({selectedAsRecord.mechanicName})
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>怨좉컼??</span> <strong>{selectedAsRecord.matchedCustomerName || selectedAsRecord.customer}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>?꾩옣紐?</span> <strong>{selectedAsRecord.matchedSiteName || selectedAsRecord.site}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>愿由щ쾲??</span> <strong style={{ color: '#2563eb' }}>{selectedAsRecord.matchedAssetNo || selectedAsRecord.assetNo}</strong> ({selectedAsRecord.matchedModelName})
                {selectedAsRecord.isSingleAssetGuessed && (
                  <span className="badge badge-warning" style={{ fontSize: '10px', marginLeft: '6px' }}>1?怨꾩빟 ?먮룞異붿젙</span>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>?뚯냽 怨꾩빟:</span> <strong>{selectedAsRecord.matchedContractNo || '誘몃ℓ???쇰컲?대젰)'}</strong>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)' }}>?λ퉬 ?몃??꾩튂:</span> {selectedAsRecord.location || '誘몄긽'}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)' }}>?꾩옣 ?묒닔???곕씫泥?</span> {selectedAsRecord.contact || '誘몄긽'}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)' }}>怨좎옣 ?댁슜:</span>
                <div style={{ marginTop: '4px', padding: '8px 12px', backgroundColor: 'rgba(239, 68, 68, 0.12)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontWeight: 600 }}>
                  {selectedAsRecord.issue}
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)' }}>議곗튂 ?댁슜:</span>
                <div style={{ marginTop: '4px', padding: '8px 12px', backgroundColor: 'rgba(16, 185, 129, 0.12)', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', fontWeight: 600 }}>
                  {selectedAsRecord.actionTaken}
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)' }}>諛대뱶 ?먮Ц ?띿뒪??</span>
                <div style={{ marginTop: '4px', padding: '10px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-main)', maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                  {selectedAsRecord.raw}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button
                onClick={() => setSelectedAsRecord(null)}
                style={{ padding: '8px 18px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                ?リ린
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InitialDbUploader;


export const InitialDbUploader: React.FC = () => (
  <ErrorBoundary fallbackTitle="초기 DB 업로드 화면 오류">
    <InitialDbUploaderContent />
  </ErrorBoundary>
);

