// src/pages/Products.tsx - 전사 표준 헌장 준수 제품 모델 및 제원 관리
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Download, Search, RefreshCw, FileText, X, Folder, Trash2, ExternalLink, Upload, CheckCircle2, AlertCircle, Eye, Edit2, Save, Package, Layers } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { Product } from '../services/db';
import { LIFT_RETRACTED_IMG, LIFT_EXTENDED_IMG } from '../services/specImages';

interface R2DocFile {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  url: string;
}

export const Products: React.FC = () => {
  const { 
    products, saveProduct, hasPermission, assets, 
    refreshAllData, googleConfigs, setActiveTab 
  } = useApp();
  
  const canSave = hasPermission('product', 'save');

  // 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'WITH_ASSETS' | 'NO_ASSETS'>('ALL');
  const [manufacturerFilter, setManufacturerFilter] = useState('ALL');
  const [powerSourceFilter, setPowerSourceFilter] = useState('ALL');
  const [activeStatusFilter, setActiveStatusFilter] = useState('ALL');

  // 정렬 상태
  type ProductSortField = 'modelName' | 'feet' | 'manufacturer' | 'powerSource' | 'isActive' | 'assetCount' | 'createdAt';
  const [sortField, setSortField] = useState<ProductSortField>('modelName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // 상세조회 Dossier 슬라이드오버 및 수정 상태
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSpecPreviewModal, setShowSpecPreviewModal] = useState(false);

  // Cloudflare R2 제품별 문서함 상태
  const [r2Files, setR2Files] = useState<R2DocFile[]>([]);
  const [loadingR2Docs, setLoadingR2Docs] = useState<boolean>(false);
  const [uploadingDoc, setUploadingDoc] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);

  const clean = (s?: string) => (s || '').replace(/[- _/]/g, '').toUpperCase().trim();

  // Cloudflare R2 문서 목록 로드
  const fetchR2Files = async () => {
    const config = googleConfigs[0];
    const accountId = config?.r2AccountId || '35014a2514680107d74e1e68d96e6c32';
    const bucketName = config?.r2BucketName || 'kiyeun-storage';
    const accessKeyId = config?.r2AccessKeyId || '03cdb7560d37242de608a5db2a976030';
    const secretAccessKey = config?.r2SecretAccessKey || 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986';
    const publicDomain = config?.r2PublicDomain || 'https://pub-a2fd3c2ae0cc450b8ebe34baf1b051e1.r2.dev';

    setLoadingR2Docs(true);
    try {
      const res = await fetch('/api/r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          prefix: 'Eq_doc/',
          accountId,
          bucketName,
          accessKeyId,
          secretAccessKey
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        const mapped: R2DocFile[] = data.files
          .filter((f: any) => !f.isDirectory && f.key !== 'Eq_doc/')
          .map((f: any) => {
            const parts = f.key.split('/');
            const name = parts[parts.length - 1];
            return {
              key: f.key,
              name,
              size: f.size,
              lastModified: f.lastModified,
              url: `${publicDomain.replace(/\/$/, '')}/${encodeURIComponent(f.key).replace(/%2F/g, '/')}`
            };
          });
        setR2Files(mapped);
      }
    } catch (err) {
      console.warn('R2 docs fetch error:', err);
    } finally {
      setLoadingR2Docs(false);
    }
  };

  useEffect(() => {
    fetchR2Files();
  }, [googleConfigs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAllData();
      await fetchR2Files();
      showToast('최신 데이터를 동기화하였습니다.');
    } catch (err: any) {
      showToast('최신 데이터를 가져오는 데 실패했습니다.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // 모델별 보유 자산 통계 매핑
  const assetStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; owned: number; leased: number; available: number; rented: number; assigned: number; repairing: number }>();
    for (const p of products) {
      const pClean = clean(p.modelName);
      const matched = assets.filter(a => {
        const aClean = clean(a.modelName);
        return a.modelName === p.modelName || aClean === pClean;
      });
      const owned = matched.filter(a => a.ownerType === 'OWNED' || !a.ownerType).length;
      const leased = matched.filter(a => a.ownerType === 'RENTED').length;
      const available = matched.filter(a => a.status === 'AVAILABLE' && !a.actualRentReturnDate).length;
      const rented = matched.filter(a => a.status === 'RENTED' || (!a.actualRentReturnDate && a.currentCustomerId)).length;
      const assigned = matched.filter(a => a.status === 'ASSIGNED').length;
      const repairing = matched.filter(a => a.status === 'REPAIRING').length;
      map.set(p.id, { total: matched.length, owned, leased, available, rented, assigned, repairing });
    }
    return map;
  }, [products, assets]);

  // 모델별 R2 문서 매핑
  const r2FilesByModelMap = useMemo(() => {
    const map = new Map<string, R2DocFile[]>();
    for (const p of products) {
      const pClean = clean(p.modelName);
      const matched = r2Files.filter(f => {
        const parts = f.key.split('/');
        if (parts.length < 3) return false;
        const folderModel = parts[1];
        const fClean = clean(folderModel);
        return folderModel === p.modelName || fClean === pClean || fClean.includes(pClean) || pClean.includes(fClean);
      });
      map.set(p.id, matched);
    }
    return map;
  }, [products, r2Files]);

  // 고유 제조사 & 동력방식
  const uniqueManufacturers = useMemo(() => {
    return Array.from(new Set(products.map(p => p.manufacturer).filter(Boolean))) as string[];
  }, [products]);

  const uniquePowerSources = useMemo(() => {
    return Array.from(new Set(products.map(p => p.powerSource).filter(Boolean))) as string[];
  }, [products]);

  // KPI 통계
  const kpiStats = useMemo(() => {
    const totalModels = products.length;
    const withAssets = products.filter(p => (assetStatsMap.get(p.id)?.total || 0) > 0).length;
    const noAssets = totalModels - withAssets;
    const activeModels = products.filter(p => p.isActive !== false).length;
    const totalDocs = r2Files.length;
    const totalMappedAssets = Array.from(assetStatsMap.values()).reduce((sum, s) => sum + s.total, 0);

    return { totalModels, withAssets, noAssets, activeModels, totalDocs, totalMappedAssets };
  }, [products, assetStatsMap, r2Files]);

  // 필터링 및 정렬
  const filtered = useMemo(() => {
    return products.filter(p => {
      const stats = assetStatsMap.get(p.id) || { total: 0, owned: 0, leased: 0, available: 0, rented: 0, assigned: 0, repairing: 0 };
      if (assetFilter === 'WITH_ASSETS' && stats.total === 0) return false;
      if (assetFilter === 'NO_ASSETS' && stats.total > 0) return false;

      const matchesSearch =
        !searchTerm ||
        (p.modelName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.shortName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.manufacturer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.spec || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.powerSource || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesManufacturer = manufacturerFilter === 'ALL' || p.manufacturer === manufacturerFilter;
      const matchesPowerSource = powerSourceFilter === 'ALL' || p.powerSource === powerSourceFilter;
      const matchesActive = activeStatusFilter === 'ALL' ? true :
                            activeStatusFilter === 'ACTIVE' ? p.isActive !== false :
                            p.isActive === false;

      return matchesSearch && matchesManufacturer && matchesPowerSource && matchesActive;
    }).sort((a, b) => {
      let aVal: any = a[sortField as keyof Product];
      let bVal: any = b[sortField as keyof Product];

      if (sortField === 'assetCount') {
        aVal = assetStatsMap.get(a.id)?.total || 0;
        bVal = assetStatsMap.get(b.id)?.total || 0;
      } else if (sortField === 'isActive') {
        aVal = a.isActive !== false ? 1 : 0;
        bVal = b.isActive !== false ? 1 : 0;
      }

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), 'ko');
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [products, assetFilter, searchTerm, manufacturerFilter, powerSourceFilter, activeStatusFilter, sortField, sortDirection, assetStatsMap]);

  const handleSort = (field: ProductSortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortArrow = (field: ProductSortField) => {
    if (sortField !== field) return <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '3px' }}>↕</span>;
    return <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '11px', marginLeft: '3px' }}>{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsEditing(false);
    setEditForm({ ...product });
  };

  const handleStartEdit = () => {
    if (selectedProduct) {
      setEditForm({ ...selectedProduct });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(selectedProduct ? { ...selectedProduct } : {});
  };

  const handleSaveEdit = async () => {
    if (!selectedProduct || !editForm || !editForm.modelName) return;

    const feetValue = Number(editForm.feet);
    if (isNaN(feetValue) || feetValue <= 0) {
      showToast('피트 규격은 0보다 큰 숫자로 입력해야 합니다.', 'error');
      return;
    }

    try {
      const updated = { ...selectedProduct, ...editForm } as Product;
      await saveProduct(updated);
      setSelectedProduct(updated);
      setIsEditing(false);
      await refreshAllData();
      showToast(`제품 모델 [${updated.modelName}] 정보가 저장되었습니다.`);
    } catch (err: any) {
      showToast(`저장 실패: ${err?.message || err}`, 'error');
    }
  };

  const handleOpenAddModal = () => {
    setEditForm({
      modelName: '',
      shortName: '',
      feet: 19,
      spec: '',
      manufacturer: 'Skyjack',
      isActive: true,
      powerSource: '배터리',
      asContact: '031-334-5296',
      maxWindSpeed: '12.5 m/s 이내',
      safetyCertUrl: '',
      specSheetUrl: '',
      emergencyGuideUrl: ''
    });
    setShowAddModal(true);
  };

  const handleSaveAddModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.modelName) {
      showToast('모델명을 입력해주세요.', 'error');
      return;
    }
    const feetValue = Number(editForm.feet);
    if (isNaN(feetValue) || feetValue <= 0) {
      showToast('피트 규격은 0보다 큰 숫자로 입력해야 합니다.', 'error');
      return;
    }

    try {
      await saveProduct(editForm as Omit<Product, 'id' | 'createdAt'>);
      setShowAddModal(false);
      setEditForm({});
      await refreshAllData();
      showToast(`신규 모델 [${editForm.modelName}]이 등록되었습니다.`);
    } catch (err: any) {
      showToast(`등록 실패: ${err?.message || err}`, 'error');
    }
  };

  // R2 문서 업로드
  const handleUploadCustomDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct) return;

    setUploadingDoc(true);
    try {
      const config = googleConfigs[0];
      const accountId = config?.r2AccountId || '35014a2514680107d74e1e68d96e6c32';
      const bucketName = config?.r2BucketName || 'kiyeun-storage';
      const accessKeyId = config?.r2AccessKeyId || '03cdb7560d37242de608a5db2a976030';
      const secretAccessKey = config?.r2SecretAccessKey || 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986';

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Content = event.target?.result as string;
        const key = `Eq_doc/${selectedProduct.modelName}/${file.name}`;

        const res = await fetch('/api/r2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload',
            accountId,
            bucketName,
            accessKeyId,
            secretAccessKey,
            key,
            base64Content,
            contentType: file.type || 'application/pdf'
          })
        });

        const resJson = await res.json();
        if (resJson.success) {
          showToast(`문서 [${file.name}]이 R2 클라우드에 업로드되었습니다.`);
          await fetchR2Files();
        } else {
          showToast(`업로드 실패: ${resJson.error}`, 'error');
        }
        setUploadingDoc(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      showToast(`업로드 실패: ${err.message}`, 'error');
      setUploadingDoc(false);
    }
  };

  // R2 문서 삭제
  const handleDeleteDoc = async (key: string) => {
    try {
      const config = googleConfigs[0];
      const accountId = config?.r2AccountId || '35014a2514680107d74e1e68d96e6c32';
      const bucketName = config?.r2BucketName || 'kiyeun-storage';
      const accessKeyId = config?.r2AccessKeyId || '03cdb7560d37242de608a5db2a976030';
      const secretAccessKey = config?.r2SecretAccessKey || 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986';

      const res = await fetch('/api/r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          accountId,
          bucketName,
          accessKeyId,
          secretAccessKey,
          key
        })
      });
      const resJson = await res.json();
      if (resJson.success) {
        showToast('문서가 삭제되었습니다.');
        await fetchR2Files();
      } else {
        showToast(`삭제 실패: ${resJson.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`삭제 오류: ${err.message}`, 'error');
    }
  };

  // 엑셀 내보내기
  const handleExport = () => {
    const excelData = filtered.map((p, idx) => {
      const stats = assetStatsMap.get(p.id) || { total: 0, owned: 0, leased: 0, available: 0, rented: 0, assigned: 0, repairing: 0 };
      const docList = r2FilesByModelMap.get(p.id) || [];
      return {
        '번호': idx + 1,
        '모델명': p.modelName,
        '피트(Feet)': p.feet ? `${p.feet} ft` : '-',
        '동력': p.powerSource || '-',
        '작업높이': p.workingHeight || '-',
        '발판높이': p.platformHeight || '-',
        '장비중량': p.weight || '-',
        '적재중량': p.capacityPreExt || '-',
        '장비크기': p.machineDimensions || '-',
        '플랫폼크기': p.platformDimensions || '-',
        '등판능력': p.gradeability || '-',
        '주행속도': p.speed || '-',
        '최대풍속': p.maxWindSpeed || '-',
        'A/S접수': p.asContact || '031-334-5296',
        '제조사': p.manufacturer || '-',
        '사용여부': p.isActive !== false ? '사용' : '미사용',
        '총보유대수': stats.total,
        '당사자산대수': stats.owned,
        '외부임차대수': stats.leased,
        '임대가능대수': stats.available,
        '대여중대수': stats.rented,
        'R2문서건수': docList.length,
        '등록일': p.createdAt?.substring(0, 10) || '-'
      };
    });

    exportToExcel(excelData, `제품모델목록_${new Date().toISOString().split('T')[0]}`, '제품목록');
    showToast(`제품 모델 목록 (${filtered.length}건) 엑셀이 다운로드되었습니다.`);
  };

  const ef = (field: keyof Product) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value;
    setEditForm(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '8px', position: 'relative' }}>
      
      {/* 알림 토스트 배너 */}
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
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ① 상단 헤더 & 파이프라인 (좌상단 Scope + 우상단 Pipeline: 헌장 3.5) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontWeight: '700', fontSize: '17px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            제품 모델 관리
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            총 <strong>{products.length}</strong>개 모델 (조회 <strong>{filtered.length}</strong>개)
          </span>
        </div>

        {/* 우상단 파이프라인 액션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> 동기화
          </button>
          <button
            className="btn-secondary"
            onClick={handleExport}
            style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
          >
            <Download size={13} /> 엑셀 다운로드
          </button>
          {canSave && (
            <button
              className="btn-primary"
              onClick={handleOpenAddModal}
              style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
            >
              <Plus size={13} /> 모델 등록
            </button>
          )}
        </div>
      </div>

      {/* ② 모델 및 자산 매핑 KPI 바 (Scope) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px', flexShrink: 0 }}>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>등록 모델수</span>
          <strong style={{ fontSize: '14px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{kpiStats.totalModels}종</strong>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>자산 보유 모델</span>
          <strong style={{ fontSize: '14px', color: 'var(--success)', whiteSpace: 'nowrap' }}>{kpiStats.withAssets}종</strong>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>자산 미보유 모델</span>
          <strong style={{ fontSize: '14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{kpiStats.noAssets}종</strong>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>매핑 실물자산</span>
          <strong style={{ fontSize: '14px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{kpiStats.totalMappedAssets}대</strong>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>R2 보관 문서</span>
          <strong style={{ fontSize: '14px', color: '#0070C0', whiteSpace: 'nowrap' }}>{kpiStats.totalDocs}건</strong>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>사용 중 모델</span>
          <strong style={{ fontSize: '14px', color: 'var(--success)', whiteSpace: 'nowrap' }}>{kpiStats.activeModels}종</strong>
        </div>
      </div>

      {/* ③ 필터 컨트롤 바 (Vertical Header-Label Layout: 헌장 3.4) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1', minWidth: '180px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>통합 검색</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '8px', top: '7px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="모델명, 제조사, 동력방식, 규격 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 8px 4px 26px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '12px'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>자산 보유 여부</label>
          <select
            value={assetFilter}
            onChange={e => setAssetFilter(e.target.value as any)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '110px' }}
          >
            <option value="ALL">전체 ({kpiStats.totalModels})</option>
            <option value="WITH_ASSETS">자산 보유 ({kpiStats.withAssets})</option>
            <option value="NO_ASSETS">자산 미보유 ({kpiStats.noAssets})</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>제조사</label>
          <select
            value={manufacturerFilter}
            onChange={e => setManufacturerFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '100px' }}
          >
            <option value="ALL">전체 제조사</option>
            {uniqueManufacturers.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>동력 방식</label>
          <select
            value={powerSourceFilter}
            onChange={e => setPowerSourceFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '90px' }}
          >
            <option value="ALL">전체 동력</option>
            {uniquePowerSources.map(ps => (
              <option key={ps} value={ps}>{ps}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>사용 상태</label>
          <select
            value={activeStatusFilter}
            onChange={e => setActiveStatusFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '90px' }}
          >
            <option value="ALL">전체 상태</option>
            <option value="ACTIVE">사용</option>
            <option value="INACTIVE">미사용</option>
          </select>
        </div>

        {(searchTerm || assetFilter !== 'ALL' || manufacturerFilter !== 'ALL' || powerSourceFilter !== 'ALL' || activeStatusFilter !== 'ALL') && (
          <button
            onClick={() => { setSearchTerm(''); setAssetFilter('ALL'); setManufacturerFilter('ALL'); setPowerSourceFilter('ALL'); setActiveStatusFilter('ALL'); }}
            style={{
              marginTop: '16px',
              padding: '4px 8px',
              fontSize: '11.5px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            <RefreshCw size={11} /> 초기화
          </button>
        )}
      </div>

      {/* ④ 고밀도 제품 모델 대장 그리드 (Body / Inspection: 헌장 3.6 유형 B) */}
      <div style={{
        flex: 1,
        backgroundColor: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                <th style={{ padding: '7px 8px', width: '50px', textAlign: 'center', whiteSpace: 'nowrap' }}>상세</th>
                <th onClick={() => handleSort('modelName')} style={{ padding: '7px 8px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  모델명{renderSortArrow('modelName')}
                </th>
                <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                  축약명
                </th>
                <th onClick={() => handleSort('feet')} style={{ padding: '7px 8px', cursor: 'pointer', userSelect: 'none', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  피트(Feet){renderSortArrow('feet')}
                </th>
                <th onClick={() => handleSort('assetCount')} style={{ padding: '7px 8px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  실물자산 (당사/임차){renderSortArrow('assetCount')}
                </th>
                <th style={{ padding: '7px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>R2 문서함</th>
                <th onClick={() => handleSort('manufacturer')} style={{ padding: '7px 8px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  제조사{renderSortArrow('manufacturer')}
                </th>
                <th onClick={() => handleSort('powerSource')} style={{ padding: '7px 8px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  동력{renderSortArrow('powerSource')}
                </th>
                <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>작업높이</th>
                <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>발판높이</th>
                <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>장비중량</th>
                <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>적재중량</th>
                <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>장비크기</th>
                <th style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>주행속도</th>
                <th onClick={() => handleSort('isActive')} style={{ padding: '7px 8px', cursor: 'pointer', userSelect: 'none', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  상태{renderSortArrow('isActive')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    조회 조건에 해당하는 제품 모델이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const stats = assetStatsMap.get(p.id) || { total: 0, owned: 0, leased: 0, available: 0, rented: 0, assigned: 0, repairing: 0 };
                  const docList = r2FilesByModelMap.get(p.id) || [];

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s',
                        opacity: p.isActive !== false ? 1 : 0.65
                      }}
                      className="hover-row"
                    >
                      {/* 상세 버튼 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSelectProduct(p); }}
                          style={{
                            padding: '2px 6px',
                            fontSize: '11px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '3px',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--primary)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          보기
                        </button>
                      </td>

                      {/* 모델명 */}
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                        {p.modelName}
                      </td>

                      {/* 축약명 */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {p.shortName || <span style={{ opacity: 0.35 }}>—</span>}
                      </td>

                      {/* 피트 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <strong>{p.feet}</strong> ft
                      </td>

                      {/* 실물자산 보유 현황 */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                        {stats.total > 0 ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span className="badge badge-primary" style={{ fontSize: '10px', padding: '1px 5px' }}>
                              총 {stats.total}대
                            </span>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                              (자사 {stats.owned} · 임차 {stats.leased})
                            </span>
                          </div>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontSize: '9.5px', opacity: 0.6 }}>
                            미보유 (0대)
                          </span>
                        )}
                      </td>

                      {/* R2 문서함 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSelectProduct(p); }}
                          className={`badge ${docList.length > 0 ? 'badge-primary' : 'badge-secondary'}`}
                          style={{
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '1px 6px',
                            fontSize: '10px',
                            border: 'none',
                            opacity: docList.length > 0 ? 1 : 0.6
                          }}
                        >
                          <Folder size={11} /> {docList.length}건
                        </button>
                      </td>

                      {/* 제조사 */}
                      <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{p.manufacturer || '-'}</td>

                      {/* 동력 */}
                      <td style={{ padding: '6px 8px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{p.powerSource || '-'}</td>

                      {/* 작업높이 */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{p.workingHeight || '-'}</td>

                      {/* 발판높이 */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{p.platformHeight || '-'}</td>

                      {/* 장비중량 */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{p.weight || '-'}</td>

                      {/* 적재중량 */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{p.capacityPreExt || '-'}</td>

                      {/* 장비크기 */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{p.machineDimensions || '-'}</td>

                      {/* 주행속도 */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{p.speed || '-'}</td>

                      {/* 사용여부 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span className={`badge ${p.isActive !== false ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                          {p.isActive !== false ? '사용' : '미사용'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ⑤ 우하단 Terminal Action: 모델-자산 정합성 회계 대차대조식 검증 바 (헌장 3.5) */}
        <div style={{
          padding: '8px 14px',
          backgroundColor: 'var(--bg-app)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '11.5px',
          borderRadius: '0 0 6px 6px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span>전사 등록모델: <strong style={{ color: 'var(--primary)' }}>{kpiStats.totalModels}종</strong> (자산보유 {kpiStats.withAssets}종 / 미보유 {kpiStats.noAssets}종)</span>
            <span>|</span>
            <span>매핑 실물자산: <strong style={{ color: 'var(--primary)' }}>{kpiStats.totalMappedAssets}대</strong></span>
            <span>|</span>
            <span>R2 클라우드 보관문서: <strong style={{ color: '#0070C0' }}>{kpiStats.totalDocs}건</strong></span>
          </div>
          <span style={{
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--success-light)',
            color: 'var(--success)',
            fontWeight: 700,
            fontSize: '11px'
          }}>
            ⚖️ 대차 정상 (모델-자산 기준정보 100% 정합)
          </span>
        </div>
      </div>

      {/* ⑥ 서랍형 상세 Dossier 슬라이드오버 (헌장 3.6 마스터-디테일 스튜디오) */}
      {selectedProduct && (() => {
        const stats = assetStatsMap.get(selectedProduct.id) || { total: 0, owned: 0, leased: 0, available: 0, rented: 0, assigned: 0, repairing: 0 };
        const docList = r2FilesByModelMap.get(selectedProduct.id) || [];

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '520px',
            maxWidth: '92vw',
            backgroundColor: 'var(--bg-card)',
            borderLeft: '1px solid var(--border-color)',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.18)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideLeft 0.2s ease-in-out'
          }}>
            {/* 서랍 헤더 */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package className="text-primary" size={16} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                  [{selectedProduct.modelName}] {isEditing ? '제원 수정' : '모델 제원 원장'}
                </span>
                <span className={`badge ${selectedProduct.isActive !== false ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '10px' }}>
                  {selectedProduct.isActive !== false ? '사용' : '미사용'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => { if (!isEditing) setSelectedProduct(null); }}
                  style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 서랍 본문 스크롤 영역 */}
            <div style={{ padding: '16px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
              
              {/* 1. 실물 자산 보유 및 가동 현황 */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} className="text-primary" /> 실물 자산 보유 및 가동 현황
                  </div>
                  {stats.total > 0 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setActiveTab('asset')}
                      style={{ padding: '2px 6px', fontSize: '10.5px' }}
                    >
                      자산대장 바로가기
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center', fontSize: '11px' }}>
                  <div style={{ padding: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>총 보유</div>
                    <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{stats.total}대</strong>
                  </div>
                  <div style={{ padding: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>임대가능</div>
                    <strong style={{ fontSize: '13px', color: 'var(--success)' }}>{stats.available}대</strong>
                  </div>
                  <div style={{ padding: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>대여중</div>
                    <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>{stats.rented}대</strong>
                  </div>
                  <div style={{ padding: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>정비중</div>
                    <strong style={{ fontSize: '13px', color: 'var(--danger)' }}>{stats.repairing}대</strong>
                  </div>
                </div>

                <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>소유구분: 당사자산 {stats.owned}대 / 외부임차 {stats.leased}대</span>
                  <span>출고대기: {stats.assigned}대</span>
                </div>
              </div>

              {/* 2. R2 클라우드 문서함 스튜디오 (drcf) */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Folder size={14} style={{ color: '#0070C0' }} /> R2 클라우드 문서함 (drcf)
                  </div>
                  
                  {/* 파일 업로드 버튼 */}
                  <label style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    cursor: uploadingDoc ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Upload size={11} /> {uploadingDoc ? '업로드중...' : '문서 업로드'}
                    <input
                      type="file"
                      disabled={uploadingDoc}
                      onChange={handleUploadCustomDoc}
                      style={{ display: 'none' }}
                      accept=".pdf,.jpg,.jpeg,.png,.xlsx"
                    />
                  </label>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  보관 경로: <code style={{ color: 'var(--primary)' }}>Eq_doc/{selectedProduct.modelName}/</code>
                </div>

                {/* 문서 목록 */}
                <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {docList.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '14px 0', fontSize: '11px' }}>
                      보관된 안전인증서나 제원표 문서가 없습니다.
                    </div>
                  ) : (
                    docList.map((doc, dIdx) => (
                      <div
                        key={dIdx}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          fontSize: '11px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '340px' }}
                        >
                          <ExternalLink size={11} /> {doc.name}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(doc.key)}
                          style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                          title="삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 3. 기본 물리 제원 및 규격 */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    3. 상세 물리 제원 규격
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!isEditing && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setShowSpecPreviewModal(true)}
                        style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <FileText size={12} /> 제원표 그래픽
                      </button>
                    )}
                    {canSave && !isEditing && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleStartEdit}
                        style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit2 size={12} /> 수정
                      </button>
                    )}
                    {isEditing && (
                      <>
                        <button
                          type="button"
                          className="btn-success"
                          onClick={handleSaveEdit}
                          style={{ padding: '3px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Save size={12} /> 저장
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleCancelEdit}
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                        >
                          취소
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><label style={labelStyle}>모델명 *</label><input style={inputStyle} value={editForm.modelName || ''} onChange={ef('modelName')} /></div>
                    <div><label style={labelStyle}>축약 모델명</label><input style={inputStyle} placeholder="예: 1930, GS1930" value={editForm.shortName || ''} onChange={ef('shortName')} /></div>
                    <div><label style={labelStyle}>피트 *</label><input type="number" style={inputStyle} value={editForm.feet ?? ''} onChange={ef('feet')} /></div>
                    <div><label style={labelStyle}>제조사</label><input style={inputStyle} value={editForm.manufacturer || ''} onChange={ef('manufacturer')} /></div>
                    <div><label style={labelStyle}>동력 방식</label><input style={inputStyle} value={editForm.powerSource || ''} onChange={ef('powerSource')} /></div>
                    <div><label style={labelStyle}>작업 높이</label><input style={inputStyle} value={editForm.workingHeight || ''} onChange={ef('workingHeight')} /></div>
                    <div><label style={labelStyle}>발판 높이</label><input style={inputStyle} value={editForm.platformHeight || ''} onChange={ef('platformHeight')} /></div>
                    <div><label style={labelStyle}>장비 중량</label><input style={inputStyle} value={editForm.weight || ''} onChange={ef('weight')} /></div>
                    <div><label style={labelStyle}>적재 중량 (확장 전)</label><input style={inputStyle} value={editForm.capacityPreExt || ''} onChange={ef('capacityPreExt')} /></div>
                    <div><label style={labelStyle}>확장 후 본체 하중</label><input style={inputStyle} value={editForm.capacityPostExtMain || ''} onChange={ef('capacityPostExtMain')} /></div>
                    <div><label style={labelStyle}>확장 후 확장부 하중</label><input style={inputStyle} value={editForm.capacityPostExtDeck || ''} onChange={ef('capacityPostExtDeck')} /></div>
                    <div><label style={labelStyle}>장비 크기</label><input style={inputStyle} value={editForm.machineDimensions || ''} onChange={ef('machineDimensions')} /></div>
                    <div><label style={labelStyle}>플랫폼 크기</label><input style={inputStyle} value={editForm.platformDimensions || ''} onChange={ef('platformDimensions')} /></div>
                    <div><label style={labelStyle}>주행 속도</label><input style={inputStyle} value={editForm.speed || ''} onChange={ef('speed')} /></div>
                    <div><label style={labelStyle}>등판 능력</label><input style={inputStyle} value={editForm.gradeability || ''} onChange={ef('gradeability')} /></div>
                    <div><label style={labelStyle}>최대 풍속</label><input style={inputStyle} value={editForm.maxWindSpeed || ''} onChange={ef('maxWindSpeed')} /></div>
                    <div><label style={labelStyle}>A/S 접수처</label><input style={inputStyle} value={editForm.asContact || ''} onChange={ef('asContact')} /></div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={labelStyle}>기타 제원 메모</label>
                      <textarea style={{ ...inputStyle, minHeight: '44px' }} value={editForm.spec || ''} onChange={ef('spec')} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px' }}>
                    <div><span style={{ color: 'var(--text-secondary)' }}>모델명:</span> <strong>{selectedProduct.modelName}</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>피트 규격:</span> <strong>{selectedProduct.feet} ft</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>제조사:</span> {selectedProduct.manufacturer || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>동력 방식:</span> {selectedProduct.powerSource || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>작업 높이:</span> {selectedProduct.workingHeight || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>발판 높이:</span> {selectedProduct.platformHeight || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>장비 중량:</span> {selectedProduct.weight || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>적재 중량:</span> {selectedProduct.capacityPreExt || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>확장 후 하중:</span> 본체 {selectedProduct.capacityPostExtMain || '-'} / 확장 {selectedProduct.capacityPostExtDeck || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>장비 크기:</span> {selectedProduct.machineDimensions || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>플랫폼 크기:</span> {selectedProduct.platformDimensions || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>주행 속도:</span> {selectedProduct.speed || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>등판 능력:</span> {selectedProduct.gradeability || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>최대 풍속:</span> {selectedProduct.maxWindSpeed || '-'}</div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>A/S 접수처:</span> <strong>{selectedProduct.asContact || '031-334-5296'}</strong>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* 서랍 푸터 */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedProduct(null)}
                style={{ padding: '5px 14px', fontSize: '12px' }}
              >
                닫기
              </button>
            </div>
          </div>
        );
      })()}

      {/* ⑦ 신규 모델 등록 모달 */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          padding: '20px'
        }}>
          <form onSubmit={handleSaveAddModal} className="card" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>신규 제품 모델 등록</h3>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                <div><label style={labelStyle}>모델명 *</label><input style={inputStyle} placeholder="예: SJ3219" value={editForm.modelName || ''} onChange={ef('modelName')} required /></div>
                <div><label style={labelStyle}>축약 모델명</label><input style={inputStyle} placeholder="예: 1930, GS1930" value={editForm.shortName || ''} onChange={ef('shortName')} /></div>
                <div><label style={labelStyle}>피트 *</label><input type="number" style={inputStyle} placeholder="예: 19" value={editForm.feet ?? ''} onChange={ef('feet')} required /></div>
                <div><label style={labelStyle}>제조사</label><input style={inputStyle} placeholder="예: Skyjack" value={editForm.manufacturer || ''} onChange={ef('manufacturer')} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={labelStyle}>동력 방식</label><input style={inputStyle} placeholder="예: 배터리" value={editForm.powerSource || ''} onChange={ef('powerSource')} /></div>
                <div><label style={labelStyle}>A/S 접수처</label><input style={inputStyle} value={editForm.asContact || '031-334-5296'} onChange={ef('asContact')} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={labelStyle}>작업 높이</label><input style={inputStyle} placeholder="예: 7.79 M" value={editForm.workingHeight || ''} onChange={ef('workingHeight')} /></div>
                <div><label style={labelStyle}>발판 높이</label><input style={inputStyle} placeholder="예: 5.79 M" value={editForm.platformHeight || ''} onChange={ef('platformHeight')} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={labelStyle}>장비 중량</label><input style={inputStyle} placeholder="예: 1,312 kg" value={editForm.weight || ''} onChange={ef('weight')} /></div>
                <div><label style={labelStyle}>적재 중량</label><input style={inputStyle} placeholder="예: 227 kg" value={editForm.capacityPreExt || ''} onChange={ef('capacityPreExt')} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={labelStyle}>장비 크기</label><input style={inputStyle} placeholder="예: 1.78 x 0.81 x 2.11 M" value={editForm.machineDimensions || ''} onChange={ef('machineDimensions')} /></div>
                <div><label style={labelStyle}>주행 속도</label><input style={inputStyle} placeholder="예: 3.2 km/h" value={editForm.speed || ''} onChange={ef('speed')} /></div>
              </div>

              <div>
                <label style={labelStyle}>기타 제원 메모</label>
                <textarea style={{ ...inputStyle, minHeight: '44px' }} placeholder="특이사항 및 제원" value={editForm.spec || ''} onChange={ef('spec')} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)} style={{ padding: '6px 14px', fontSize: '12px' }}>취소</button>
              <button type="submit" className="btn-primary" style={{ padding: '6px 16px', fontSize: '12px' }}>등록 완료</button>
            </div>
          </form>
        </div>
      )}

      {/* ⑧ 제원표 그래픽 미리보기 모달 */}
      {showSpecPreviewModal && selectedProduct && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1150,
          padding: '20px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto',
            backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', padding: '20px', borderRadius: '8px', boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                [{selectedProduct.modelName}] 제원표 그래픽 규격
              </h3>
              <button
                type="button"
                onClick={() => setShowSpecPreviewModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 작업대 확장 전/후 적재중량 그래픽 헤더 */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '4px' }}>
                작업대 확장 전 / 후 적재중량
              </div>

              {/* 하중 분배 다이어그램 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                {/* 확장 전 */}
                <div style={{ textAlign: 'center', borderRight: '1px dashed var(--border-color)', paddingRight: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '2px' }}>
                    {selectedProduct.capacityPreExt || '227 kg'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70px', margin: '4px 0' }}>
                    <img
                      src={LIFT_RETRACTED_IMG}
                      alt="확장 전 형상"
                      style={{ maxHeight: '66px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '3px', borderRadius: '3px' }}>
                    작업대 확장 전 (작업자 2인)
                  </div>
                </div>

                {/* 확장 후 */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '2px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {selectedProduct.capacityPostExtMain || '159 kg'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>본체</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {selectedProduct.capacityPostExtDeck || '113 kg'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>확장부</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70px', margin: '4px 0' }}>
                    <img
                      src={LIFT_EXTENDED_IMG}
                      alt="확장 후 형상"
                      style={{ maxHeight: '66px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '3px', borderRadius: '3px' }}>
                    작업대 확장 후 (각 1인)
                  </div>
                </div>
              </div>

              {/* 최대풍속 배너 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <div style={{ backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 'bold', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
                  최대풍속: {selectedProduct.maxWindSpeed || '12.5 m/s 이내'}
                </div>
              </div>
            </div>

            {/* 장비 제원표 테이블 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-color)', fontSize: '11.5px', textAlign: 'center' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold', width: '22%', padding: '5px' }}>장 비 명</td>
                  <td style={{ width: '28%', padding: '5px', fontWeight: 'bold' }}>{selectedProduct.modelName}</td>
                  <td style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold', width: '22%', padding: '5px' }}>동 력</td>
                  <td style={{ width: '28%', padding: '5px' }}>{selectedProduct.powerSource || '배터리'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold', padding: '5px' }}>작업 높이</td>
                  <td style={{ padding: '5px' }}>{selectedProduct.workingHeight || '-'}</td>
                  <td style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold', padding: '5px' }}>발판 높이</td>
                  <td style={{ padding: '5px' }}>{selectedProduct.platformHeight || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold', padding: '5px' }}>장비 중량</td>
                  <td style={{ padding: '5px' }}>{selectedProduct.weight || '-'}</td>
                  <td style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold', padding: '5px' }}>적재 중량</td>
                  <td style={{ padding: '5px' }}>{selectedProduct.capacityPreExt || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold', padding: '5px' }}>장비 크기</td>
                  <td style={{ padding: '5px' }}>{selectedProduct.machineDimensions || '-'}</td>
                  <td style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold', padding: '5px' }}>주행 속도</td>
                  <td style={{ padding: '5px' }}>{selectedProduct.speed || '-'}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowSpecPreviewModal(false)}
                style={{ padding: '5px 14px', fontSize: '12px' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// 헬퍼 스타일
const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  fontWeight: '600',
  display: 'block',
  marginBottom: '3px',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: '12px',
  borderRadius: '4px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-app)',
  color: 'var(--text-main)',
  boxSizing: 'border-box',
};
