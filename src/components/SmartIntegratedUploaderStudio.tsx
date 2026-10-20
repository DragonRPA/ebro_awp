import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useApp } from '../context/AppContext';
import {
  IntegratedDomainEntities,
  ParseResult,
  StagingDraft,
  DomainValidationItem,
  generateIntegratedTemplateWorkbook,
  getIntegratedSampleDataset,
  parseIntegratedWorkbook,
  saveDraftToStaging,
  loadDraftFromStaging,
  clearDraftFromStaging,
  validateIntegratedEntities,
  ingestIntegratedEntitiesToDatabase,
  IngestionResult
} from '../utils/migration/smartMigrationEngine';
import {
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  Save,
  RotateCcw,
  Layers,
  Users,
  Truck,
  Wrench,
  Shield,
  FileText,
  Loader,
  DatabaseIcon,
  Package,
  FolderOpen
} from 'lucide-react';

type DomainKey = 
  | 'departments'
  | 'products'
  | 'siteMasters'
  | 'customers'
  | 'inspectionItems'
  | 'consumables'
  | 'vendors'
  | 'contracts';

interface DomainMeta {
  key: DomainKey;
  label: string;
  icon: React.ReactNode;
  subLabel: string;
  countFn: (entities: IntegratedDomainEntities) => string;
  tableKey: keyof IntegratedDomainEntities;
  subTableKey?: keyof IntegratedDomainEntities;
  mainTabLabel: string;
  subTabLabel?: string;
}

const DOMAIN_CARDS: DomainMeta[] = [
  {
    key: 'departments',
    label: '조직 및 사원',
    icon: <Users size={18} color="var(--primary)" />,
    subLabel: '부서, 임직원 계정',
    countFn: (e) => `${e.departments.length}개 부서 / ${e.users.length}명 사원`,
    tableKey: 'departments',
    subTableKey: 'users',
    mainTabLabel: '부서 목록',
    subTabLabel: '임직원 계정'
  },
  {
    key: 'products',
    label: '제품 및 장비',
    icon: <Layers size={18} color="var(--primary)" />,
    subLabel: '10대 상세제원 카탈로그, 보유 호기',
    countFn: (e) => `${e.products.length}개 모델 / ${e.assets.length}대 장비`,
    tableKey: 'products',
    subTableKey: 'assets',
    mainTabLabel: '제품 카탈로그(10대 제원)',
    subTabLabel: '보유 장비(호기)'
  },
  {
    key: 'siteMasters',
    label: '현장 및 옵션',
    icon: <Shield size={18} color="var(--primary)" />,
    subLabel: '물리 현장, 표준 옵션 마스터',
    countFn: (e) => `${e.siteMasters.length}개 현장 / ${e.standardOptions.length}개 옵션`,
    tableKey: 'siteMasters',
    subTableKey: 'standardOptions',
    mainTabLabel: '물리 현장',
    subTabLabel: '전사 표준 옵션 마스터'
  },
  {
    key: 'customers',
    label: '고객 및 담당자',
    icon: <Users size={18} color="var(--primary)" />,
    subLabel: '고객사, 현장연결, 3대 담당자',
    countFn: (e) => `${e.customers.length}개사 / ${e.customerSites.length}현장 / ${e.customerContacts.length}명`,
    tableKey: 'customers',
    subTableKey: 'customerContacts',
    mainTabLabel: '고객사 목록',
    subTabLabel: '3대 현장담당자 (장비/마감/안전)'
  },
  {
    key: 'inspectionItems',
    label: '정비점검 및 이력',
    icon: <Wrench size={18} color="var(--primary)" />,
    subLabel: '점검항목 마스터, 정비수리 대장',
    countFn: (e) => `${e.inspectionItems.length}개 항목 / ${e.repairs.length}건 정비이력`,
    tableKey: 'inspectionItems',
    subTableKey: 'repairs',
    mainTabLabel: '점검항목 마스터',
    subTabLabel: '정비/수리/점검 대장'
  },
  {
    key: 'consumables',
    label: '부품 및 소모품',
    icon: <Package size={18} color="var(--primary)" />,
    subLabel: '부품/소모품 마스터, 구매입고 내역',
    countFn: (e) => `${e.consumables.length}개 부품 / ${e.consumablePurchases.length}건 입고`,
    tableKey: 'consumables',
    subTableKey: 'consumablePurchases',
    mainTabLabel: '부품/소모품 마스터',
    subTabLabel: '구매/입고 내역'
  },
  {
    key: 'vendors',
    label: '매입거래처 및 운송사',
    icon: <Truck size={18} color="var(--primary)" />,
    subLabel: '5대 매입유형, 운송사 전속 기사',
    countFn: (e) => `${e.vendors.length}개 매입처 / ${e.transportDrivers.length}명 기사`,
    tableKey: 'vendors',
    subTableKey: 'transportDrivers',
    mainTabLabel: '매입거래처 (5대 유형)',
    subTabLabel: '운송사 전속 기사'
  },
  {
    key: 'contracts',
    label: '대여계약 및 투입장비',
    icon: <FileText size={18} color="var(--primary)" />,
    subLabel: '렌탈 계약, 호기 매핑',
    countFn: (e) => `${e.contracts.length}건 계약 / ${e.contractAssets.length}대 투입`,
    tableKey: 'contracts',
    subTableKey: 'contractAssets',
    mainTabLabel: '임대 계약 대장',
    subTabLabel: '계약 투입 장비'
  }
];

const COLUMN_LABEL_MAP: Record<string, string> = {
  id: '식별코드',
  code: '점검코드',
  name: '명칭/이름',
  modelName: '모델명/품명',
  manufacturer: '제조사',
  serialNo: '제조번호',
  manufactureYear: '제작연도',
  assetNo: '관리번호(호기)',
  ownerType: '소유구분',
  status: '상태',
  acquisitionPrice: '취득원가',
  monthlyRentFee: '기준월렌탈료',
  dailyRentFee: '기준일렌탈료',
  workingHeight: '작업높이(미터)',
  platformHeight: '발판높이(미터)',
  machineDimensions: '장비외형규격',
  platformDimensions: '작업대규격',
  weight: '장비자중',
  powerSource: '동력원',
  capacityPreExt: '확장전적재하중',
  capacityPostExtMain: '메인확장적재하중',
  capacityPostExtDeck: '데크확장적재하중',
  speed: '주행속도',
  gradeability: '등판능력',
  maxWindSpeed: '허용풍속',
  asContact: 'AS문의처',
  spec: '제원/비고사양',
  feet: '피트',
  department: '부서명',
  departmentId: '부서코드',
  loginId: '아이디',
  position: '직급',
  duty: '직책',
  role: '권한',
  phone: '연락처',
  contact: '연락처',
  email: '이메일',
  baseSalary: '기본급(원)',
  address: '주소',
  detailAddress: '상세주소',
  birthDate: '생년월일',
  joinDate: '입사일',
  retireDate: '퇴사일',
  bizRegNo: '사업자등록번호',
  representative: '대표자명',
  repContact: '대표연락처',
  repEmail: '계산서이메일',
  defaultBillingDay: '정기청구일',
  paymentDueDay: '결제마감일',
  contactType: '담당자유형',
  siteMasterId: '현장코드',
  customerId: '고객코드',
  customerName: '고객사명',
  siteName: '현장명',
  category: '카테고리',
  defaultPrice: '기본단가',
  unitPrice: '단가(원)',
  unit: '단위',
  stockQty: '현재고수량',
  supplier: '주공급처',
  maintenanceScore: '정비배점',
  standardManHours: '표준공수(시간)',
  isDefectSymptom: '불량증상여부',
  actionGuide: '조치/수리가이드',
  description: '설명/증상요약',
  sortOrder: '정렬순서',
  ticketNo: '정비티켓번호',
  workCategory: '작업구분',
  repairType: '정비구분',
  issueCategory: '고장분류',
  issueDescription: '고장내용/증상',
  actionTaken: '조치내용',
  mechanicName: '정비사',
  repairDate: '정비완료일',
  requestedQty: '요청수량',
  receivedQty: '입고수량',
  sellerName: '매입처',
  requesterName: '입고요청자',
  requestDate: '입고일자',
  type: '매입유형',
  types: '세부유형',
  bankAccount: '은행계좌정보',
  companyName: '소속운송사',
  companyId: '운송사ID',
  driverName: '기사성명',
  driverContact: '기사연락처',
  vehicleNo: '차량번호',
  vehicleType: '차종/톤수',
  contractNo: '계약번호',
  startDate: '대여시작일',
  endDate: '대여종료일',
  monthlyRentalFee: '월렌탈료',
  dailyRentalFee: '일렌탈료',
  expectedModel: '약정모델',
  note: '비고',
  memo: '메모',
  isActive: '사용여부',
  isPrimary: '대표여부'
};

export const SmartIntegratedUploaderStudio: React.FC = () => {
  const { showNoticeModal, showErrorModal, fullRefreshFromServer, currentTenant } = useApp();
  const tenantId = (currentTenant as any)?.id || 'giyeonlift';

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainKey>('customers');
  const [selectedSubTab, setSelectedSubTab] = useState<'MAIN' | 'SUB'>('MAIN');
  const [existingDraft, setExistingDraft] = useState<StagingDraft | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionResult, setIngestionResult] = useState<IngestionResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftFileInputRef = useRef<HTMLInputElement>(null);

  // 마운트 시 로컬스토리지 임시보관본 확인
  useEffect(() => {
    const draft = loadDraftFromStaging();
    if (draft) {
      setExistingDraft(draft);
    }
  }, []);

  // 1. 표준 통합 엑셀 양식 다운로드
  const handleDownloadTemplate = () => {
    try {
      const wb = generateIntegratedTemplateWorkbook(tenantId);
      const fileName = `eBro_통합_기초데이터_업로드_표준양식_8도메인_${tenantId}.xlsx`;
      XLSX.writeFile(wb, fileName);
      if (showNoticeModal) showNoticeModal('표준 8개 시트 양식 엑셀 파일이 다운로드되었습니다.');
    } catch (err: any) {
      if (showErrorModal) showErrorModal(`양식 다운로드 실패: ${err?.message || String(err)}`);
    }
  };

  // 2. 샘플 데이터 즉시 로드
  const handleLoadSampleData = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const entities = getIntegratedSampleDataset(tenantId);
      const now = new Date().toISOString();
      const validationList = validateIntegratedEntities(entities);
      const errorCount = validationList.reduce((acc, v) => acc + v.errorRows, 0);
      const warningCount = validationList.reduce((acc, v) => acc + v.warnings.length, 0);

      const totalEntitiesCount = Object.values(entities).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);

      const res: ParseResult = {
        entities,
        stats: {
          departmentsCount: entities.departments.length,
          usersCount: entities.users.length,
          productsCount: entities.products.length,
          assetsCount: entities.assets.length,
          siteMastersCount: entities.siteMasters.length,
          standardOptionsCount: entities.standardOptions.length,
          customersCount: entities.customers.length,
          customerSitesCount: entities.customerSites.length,
          customerContactsCount: entities.customerContacts.length,
          inspectionItemsCount: entities.inspectionItems.length,
          repairsCount: entities.repairs.length,
          consumablesCount: entities.consumables.length,
          consumablePurchasesCount: entities.consumablePurchases.length,
          vendorsCount: entities.vendors.length,
          transportDriversCount: entities.transportDrivers.length,
          contractsCount: entities.contracts.length,
          contractAssetsCount: entities.contractAssets.length,
          totalEntitiesCount,
          errorCount,
          warningCount
        },
        validationList,
        sourceType: 'SAMPLE',
        fileName: 'eBro_기초데이터_표준샘플_8대도메인.xlsx',
        analyzedAt: now
      };

      setParseResult(res);
      setSelectedDomain('customers');
      setSelectedSubTab('MAIN');
      setIsProcessing(false);
      if (showNoticeModal) {
        showNoticeModal(`8대 도메인 17개 엔티티 총 ${res.stats.totalEntitiesCount}건의 표준 샘플 데이터가 성공적으로 로드되었습니다.`);
      }
    }, 150);
  };

  // 3. 엑셀 파일 업로드 및 지능 분석
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const result = parseIntegratedWorkbook(wb, file.name, tenantId);
        setParseResult(result);
        setSelectedDomain('customers');
        setSelectedSubTab('MAIN');
        if (showNoticeModal) {
          showNoticeModal(`엑셀 파일 [${file.name}] 분석 완료: 총 ${result.stats.totalEntitiesCount}건 수집`);
        }
      } catch (err: any) {
        if (showErrorModal) {
          showErrorModal(`파일 파싱 실패: ${err?.message || String(err)}`);
        }
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // 4-1. 중간 작업 내보내기 (JSON 파일 로컬 다운로드)
  const handleExportDraftFile = () => {
    if (!parseResult) return;
    try {
      const draft: StagingDraft = {
        id: `draft-${Date.now()}`,
        savedAt: new Date().toISOString(),
        fileName: parseResult.fileName,
        sourceType: parseResult.sourceType,
        stats: parseResult.stats,
        entities: parseResult.entities
      };

      const jsonStr = JSON.stringify(draft, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const safeTime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const exportName = `eBro_중간저장데이터_${tenantId}_${safeTime}.json`;
      saveAs(blob, exportName);

      if (showNoticeModal) {
        showNoticeModal(`현재 작업 중인 데이터(총 ${draft.stats.totalEntitiesCount}건)가 [${exportName}] 파일로 안전하게 내보내졌습니다.`);
      }
    } catch (err: any) {
      if (showErrorModal) {
        showErrorModal(`중간 저장 파일 내보내기 실패: ${err?.message || String(err)}`);
      }
    }
  };

  // 4-2. 중간 작업 불러오기 (로컬 JSON/XLSX 파일 열기)
  const handleDraftFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target?.result as string;
          const draft: StagingDraft = JSON.parse(content);

          if (!draft.entities) {
            throw new Error('유효한 eBro 중간 저장 데이터 파일 형식이 아닙니다.');
          }

          const entities: IntegratedDomainEntities = {
            departments: draft.entities.departments || [],
            users: draft.entities.users || [],
            products: draft.entities.products || [],
            assets: draft.entities.assets || [],
            siteMasters: draft.entities.siteMasters || [],
            standardOptions: draft.entities.standardOptions || [],
            customers: draft.entities.customers || [],
            customerSites: draft.entities.customerSites || [],
            customerContacts: draft.entities.customerContacts || [],
            inspectionItems: draft.entities.inspectionItems || [],
            repairs: draft.entities.repairs || [],
            consumables: draft.entities.consumables || [],
            consumablePurchases: draft.entities.consumablePurchases || [],
            vendors: draft.entities.vendors || [],
            transportDrivers: draft.entities.transportDrivers || [],
            contracts: draft.entities.contracts || [],
            contractAssets: draft.entities.contractAssets || []
          };

          const validationList = validateIntegratedEntities(entities);
          const errorCount = validationList.reduce((acc, v) => acc + v.errorRows, 0);
          const warningCount = validationList.reduce((acc, v) => acc + v.warnings.length, 0);

          const totalEntitiesCount = Object.values(entities).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);

          const now = new Date().toISOString();
          const restoredResult: ParseResult = {
            entities,
            stats: {
              departmentsCount: entities.departments.length,
              usersCount: entities.users.length,
              productsCount: entities.products.length,
              assetsCount: entities.assets.length,
              siteMastersCount: entities.siteMasters.length,
              standardOptionsCount: entities.standardOptions.length,
              customersCount: entities.customers.length,
              customerSitesCount: entities.customerSites.length,
              customerContactsCount: entities.customerContacts.length,
              inspectionItemsCount: entities.inspectionItems.length,
              repairsCount: entities.repairs.length,
              consumablesCount: entities.consumables.length,
              consumablePurchasesCount: entities.consumablePurchases.length,
              vendorsCount: entities.vendors.length,
              transportDriversCount: entities.transportDrivers.length,
              contractsCount: entities.contracts.length,
              contractAssetsCount: entities.contractAssets.length,
              totalEntitiesCount,
              errorCount,
              warningCount
            },
            validationList,
            sourceType: (draft.sourceType as any) || 'MULTI_SHEET',
            fileName: `[로컬 파일 복원] ${file.name}`,
            analyzedAt: now
          };

          setParseResult(restoredResult);
          setSelectedDomain('customers');
          setSelectedSubTab('MAIN');
          saveDraftToStaging(draft);
          setExistingDraft(draft);

          if (showNoticeModal) {
            showNoticeModal(`로컬에 저장된 중간 작업 파일 [${file.name}]이 성공적으로 복원되었습니다. (총 ${totalEntitiesCount}건)`);
          }
        } catch (err: any) {
          if (showErrorModal) {
            showErrorModal(`중간 저장 파일 불러오기 실패: ${err?.message || String(err)}`);
          }
        } finally {
          setIsProcessing(false);
          if (draftFileInputRef.current) draftFileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const result = parseIntegratedWorkbook(wb, file.name, tenantId);
          setParseResult(result);
          setSelectedDomain('customers');
          setSelectedSubTab('MAIN');
          if (showNoticeModal) {
            showNoticeModal(`로컬 엑셀 파일 [${file.name}] 분석 완료: 총 ${result.stats.totalEntitiesCount}건 수집`);
          }
        } catch (err: any) {
          if (showErrorModal) {
            showErrorModal(`파일 파싱 실패: ${err?.message || String(err)}`);
          }
        } finally {
          setIsProcessing(false);
          if (draftFileInputRef.current) draftFileInputRef.current.value = '';
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  // 4-3. 중간 저장 (Staging Draft 브라우저 보관)
  const handleSaveDraft = () => {
    if (!parseResult) return;
    const draft: StagingDraft = {
      id: `draft-${Date.now()}`,
      savedAt: new Date().toISOString(),
      fileName: parseResult.fileName,
      sourceType: parseResult.sourceType,
      stats: parseResult.stats,
      entities: parseResult.entities
    };

    const success = saveDraftToStaging(draft);
    if (success) {
      setExistingDraft(draft);
      if (showNoticeModal) {
        showNoticeModal('임시보관본이 브라우저에 안전하게 저장되었습니다.');
      }
    } else {
      if (showErrorModal) showErrorModal('임시보관본 저장에 실패했습니다.');
    }
  };

  // 5. 임시 저장본 불러오기
  const handleRestoreDraft = () => {
    if (!existingDraft) return;
    const now = new Date().toISOString();
    const restoredResult: ParseResult = {
      entities: existingDraft.entities,
      stats: existingDraft.stats,
      validationList: [],
      sourceType: existingDraft.sourceType as any,
      fileName: `[임시저장 복원] ${existingDraft.fileName}`,
      analyzedAt: now
    };
    setParseResult(restoredResult);
    if (showNoticeModal) {
      showNoticeModal(`${existingDraft.savedAt.slice(0, 16)}에 저장된 임시보관본이 복원되었습니다.`);
    }
  };

  // 6. 임시 저장본 폐기
  const handleDiscardDraft = () => {
    clearDraftFromStaging();
    setExistingDraft(null);
    if (showNoticeModal) showNoticeModal('임시보관본이 삭제되었습니다.');
  };

  // 7. 전체 초기화
  const handleReset = () => {
    setParseResult(null);
    setIngestionResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (showNoticeModal) showNoticeModal('화면이 초기화되었습니다.');
  };

  // 8. 2-Phase 최종 DB 확정 주입
  const handleCommitIngestion = async () => {
    if (!parseResult) return;
    const confirmed = window.confirm(
      `총 ${parseResult.stats.totalEntitiesCount}건의 기초 데이터를 운영 DB에 확정 적재하시겠습니까?\n\n` +
      `• 대상: 8대 도메인 17개 테이블\n` +
      `• 참조 무결성 순차 계층 적재가 실행됩니다.`
    );
    if (!confirmed) return;

    setIsIngesting(true);
    try {
      const result = await ingestIntegratedEntitiesToDatabase(parseResult.entities, tenantId);
      setIngestionResult(result);
      if (result.success) {
        if (showNoticeModal) showNoticeModal(result.message);
        clearDraftFromStaging();
        setExistingDraft(null);
        if (fullRefreshFromServer) fullRefreshFromServer();
      } else {
        if (showErrorModal) showErrorModal(result.message);
      }
    } catch (err: any) {
      if (showErrorModal) showErrorModal(`적재 중 시스템 오류: ${err?.message || String(err)}`);
    } finally {
      setIsIngesting(false);
    }
  };

  // 현재 선택된 도메인 데이터 산출
  const currentDomainMeta = DOMAIN_CARDS.find(d => d.key === selectedDomain) || DOMAIN_CARDS[0];
  const activeDataKey = selectedSubTab === 'MAIN' ? currentDomainMeta.tableKey : (currentDomainMeta.subTableKey || currentDomainMeta.tableKey);
  const currentTableData: any[] = parseResult ? (parseResult.entities[activeDataKey] || []) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
      {/* ── 임시보관본 알림 배너 ── */}
      {existingDraft && !parseResult && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid var(--primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            <Save size={16} color="var(--primary)" />
            <span>
              <strong>작업 중이던 임시보관본 발견:</strong> {existingDraft.savedAt.slice(0, 16)} 저장 ({existingDraft.fileName}, 총 {existingDraft.stats.totalEntitiesCount}건)
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="btn-primary"
              style={{ height: '32px', padding: '0 14px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              임시보관본 불러오기
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="btn-secondary"
              style={{ height: '32px', padding: '0 12px', fontSize: '12px', color: 'var(--text-muted)' }}
            >
              폐기
            </button>
          </div>
        </div>
      )}

      {/* ── 상단 조작 및 유입 바 (Z-패턴 ①좌상단 Scope & ②우상단 Pipeline) ── */}
      <div className="card" style={{ padding: '16px 20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* 양식 다운로드 */}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="btn-secondary"
            style={{ height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            <Download size={15} />
            표준 엑셀 양식 다운로드 (8개 시트)
          </button>

          {/* 샘플 데이터 로드 */}
          <button
            type="button"
            onClick={handleLoadSampleData}
            disabled={isProcessing}
            className="btn-secondary"
            style={{ height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            <FileSpreadsheet size={15} color="var(--primary)" />
            샘플 데이터 로드 (8대 도메인 전수)
          </button>

          {/* 엑셀 파일 선택 */}
          <label
            className="btn-primary"
            style={{
              height: '36px',
              padding: '0 18px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Upload size={15} />
            엑셀 파일 업로드 (멀티시트/단일시트 자동 판별)
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              disabled={isProcessing}
              style={{ display: 'none' }}
            />
          </label>

          {/* 중간 저장 파일 불러오기 */}
          <label
            className="btn-secondary"
            style={{
              height: '36px',
              padding: '0 16px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <FolderOpen size={15} color="var(--primary)" />
            중간 저장 파일 불러오기
            <input
              ref={draftFileInputRef}
              type="file"
              accept=".json, .xlsx, .xls"
              onChange={handleDraftFileUpload}
              disabled={isProcessing}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {/* 우측 보조 액션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {parseResult && (
            <>
              <button
                type="button"
                onClick={handleExportDraftFile}
                className="btn-secondary"
                style={{ height: '36px', padding: '0 14px', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <Download size={15} />
                중간 저장 파일 내보내기
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="btn-secondary"
                style={{ height: '36px', padding: '0 14px', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <Save size={15} />
                중간 저장 (임시보관)
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="btn-secondary"
                style={{ height: '36px', padding: '0 12px', fontSize: '13px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <RotateCcw size={14} />
                초기화
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 데이터 상태 요약 바 ── */}
      {parseResult && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-body)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px'
        }}>
          <div>
            📄 분석 대상: <strong>{parseResult.fileName}</strong> · 형식: <strong>{parseResult.sourceType === 'MULTI_SHEET' ? '8시트 통합 양식' : parseResult.sourceType === 'SAMPLE' ? '검증용 샘플 데이터' : '단일 대여장부 플랫 시트 (지능 분해됨)'}</strong> · 분석일시: {parseResult.analyzedAt.slice(0, 19).replace('T', ' ')}
          </div>
          <div style={{ display: 'flex', gap: '12px', fontWeight: 700 }}>
            <span>총 수집 데이터: <strong style={{ color: 'var(--primary)' }}>{parseResult.stats.totalEntitiesCount}건</strong></span>
            <span>정상: <strong style={{ color: 'var(--success, #22c55e)' }}>{parseResult.stats.totalEntitiesCount - parseResult.stats.errorCount}건</strong></span>
            {parseResult.stats.errorCount > 0 && (
              <span>오류: <strong style={{ color: 'var(--danger)' }}>{parseResult.stats.errorCount}건</strong></span>
            )}
          </div>
        </div>
      )}

      {/* ── 수집 현황 대시보드 (8개 도메인 카드 매트릭스) ── */}
      {parseResult && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {DOMAIN_CARDS.map(card => {
            const isSelected = selectedDomain === card.key;
            return (
              <div
                key={card.key}
                data-uia={`domain-card-${card.key}`}
                onClick={() => {
                  setSelectedDomain(card.key);
                  setSelectedSubTab('MAIN');
                }}
                className="card"
                style={{
                  padding: '14px 16px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--bg-card)' : 'var(--bg-body)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'border-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {card.icon}
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      {card.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(34, 197, 94, 0.12)',
                    color: 'var(--success, #22c55e)',
                    whiteSpace: 'nowrap'
                  }}>
                    정상
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                  {card.countFn(parseResult.entities)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {card.subLabel}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 중앙 본문: 도메인 상세 검증 그리드 ── */}
      {parseResult && (
        <div className="card" style={{ padding: '16px 20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                {currentDomainMeta.label} 데이터 검증 목록 ({currentTableData.length}건)
              </h3>
              {currentDomainMeta.subTableKey && (
                <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedSubTab('MAIN')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: selectedSubTab === 'MAIN' ? 'var(--primary)' : 'var(--bg-body)',
                      color: selectedSubTab === 'MAIN' ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {currentDomainMeta.mainTabLabel} ({parseResult.entities[currentDomainMeta.tableKey]?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubTab('SUB')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: selectedSubTab === 'SUB' ? 'var(--primary)' : 'var(--bg-body)',
                      color: selectedSubTab === 'SUB' ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {currentDomainMeta.subTabLabel || '하위/연결 엔티티'} ({parseResult.entities[currentDomainMeta.subTableKey]?.length || 0})
                  </button>
                </div>
              )}
            </div>

            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              * 중복 제거 및 N:M 정규화 연결이 적용된 데이터입니다.
            </span>
          </div>

          {/* 고밀도 데이터 테이블 */}
          <div style={{ maxHeight: '340px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            {currentTableData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                해당 도메인에 수집된 데이터가 없습니다.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)', height: '36px' }}>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 800 }}>순번</th>
                    {Object.keys(currentTableData[0] || {})
                      .filter(k => !['tenant_id', 'createdAt', 'updatedAt', 'passwordHash'].includes(k))
                      .map(col => (
                        <th key={col} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 800, color: 'var(--text-main)' }}>
                          {COLUMN_LABEL_MAP[col] || col}
                        </th>
                      ))}
                    <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 800 }}>검증상태</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTableData.slice(0, 50).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', height: '36px' }}>
                      <td style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>{i + 1}</td>
                      {Object.keys(row)
                        .filter(k => !['tenant_id', 'createdAt', 'updatedAt', 'passwordHash'].includes(k))
                        .map(col => (
                          <td key={col} style={{ padding: '6px 12px', color: 'var(--text-main)' }}>
                            {typeof row[col] === 'boolean' ? (row[col] ? 'Y' : 'N') : String(row[col] ?? '-')}
                          </td>
                        ))}
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--success, #22c55e)', fontWeight: 700 }}>
                          정상
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {currentTableData.length > 50 && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
              상위 50건 미리보기 표시 중 (전체 {currentTableData.length}건)
            </div>
          )}
        </div>
      )}

      {/* ── 우하단 최종 완결 액션 (Z-패턴 ④ Terminal Action) ── */}
      {parseResult && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            총 <strong>{parseResult.stats.totalEntitiesCount}건</strong>의 데이터가 검증을 통과했습니다. 중간 저장하거나 운영 DB로 확정 적재하세요.
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleExportDraftFile}
              className="btn-secondary"
              style={{ height: '40px', padding: '0 18px', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <Download size={16} />
              중간 저장 파일 내보내기
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="btn-secondary"
              style={{ height: '40px', padding: '0 18px', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <Save size={16} />
              중간 저장 (임시보관)
            </button>
            <button
              type="button"
              onClick={handleCommitIngestion}
              disabled={isIngesting || parseResult.stats.totalEntitiesCount === 0}
              className="btn-primary"
              style={{
                height: '40px',
                padding: '0 24px',
                fontSize: '14px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--primary)',
                cursor: isIngesting ? 'not-allowed' : 'pointer'
              }}
            >
              {isIngesting ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <DatabaseIcon size={16} />}
              DB 확정 주입 (최종 적재 실행)
            </button>
          </div>
        </div>
      )}

      {/* ── 완료 리포트 모달/배너 ── */}
      {ingestionResult && (
        <div className="card" style={{
          padding: '16px 20px',
          backgroundColor: ingestionResult.success ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          border: `1px solid ${ingestionResult.success ? 'var(--success, #22c55e)' : 'var(--danger)'}`,
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '14px', color: ingestionResult.success ? 'var(--success, #22c55e)' : 'var(--danger)' }}>
            {ingestionResult.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span>{ingestionResult.message}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ingestionResult.tableResults.map(tr => (
              <span key={tr.table} style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor: tr.success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: tr.success ? 'var(--success, #22c55e)' : 'var(--danger)',
                fontWeight: 700
              }}>
                {tr.table}: {tr.count}건 {tr.success ? '성공' : `실패(${tr.error})`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 초기 미선택 안내 상태 */}
      {!parseResult && (
        <div className="card" style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <FileSpreadsheet size={48} color="var(--primary)" style={{ opacity: 0.8 }} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
            통합 엑셀 지능 적재 (8대 도메인 17개 엔티티)
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '640px', lineHeight: 1.6 }}>
            조직도(부서/사원), 제품(10대 상세제원) 및 장비, 물리현장과 전사표준옵션, 고객사 및 3대 담당자, 정비점검 및 수리이력, 부품/소모품 마스터 및 입고, 매입거래처(5대 유형) 및 운송기사, 대여계약까지<br />
            <strong>1개의 엑셀 파일</strong>로 분석하고 수집 현황을 조망하여, 중간 저장 및 안전한 계층적 DB 적재를 수행합니다.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleLoadSampleData}
              className="btn-primary"
              style={{ height: '36px', padding: '0 18px', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <FileSpreadsheet size={15} />
              샘플 데이터 로드 (8대 도메인)
            </button>
            <label
              className="btn-secondary"
              style={{
                height: '36px',
                padding: '0 16px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <FolderOpen size={15} color="var(--primary)" />
              중간 저장 파일 불러오기
              <input
                type="file"
                accept=".json, .xlsx, .xls"
                onChange={handleDraftFileUpload}
                disabled={isProcessing}
                style={{ display: 'none' }}
              />
            </label>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="btn-secondary"
              style={{ height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <Download size={15} />
              표준 양식 엑셀 다운로드 (8개 시트)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
