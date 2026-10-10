import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { TargetEntity, MIGRATION_SCHEMAS, autoMapHeaders, analyzeGaps, generateTemplateAoA, GapAnalysisReport } from '../utils/migration/MigrationEngine';
import { Download, Upload, AlertCircle, CheckCircle, ArrowRight, Settings, FileSpreadsheet, Database, Sparkles, Table, RotateCcw } from 'lucide-react';
import { supabase, db } from '../services/db';

const SAMPLE_DATASETS: Record<TargetEntity, any[]> = {
  CUSTOMER: [
    { '업체명': '(주)대한건설', '사업자등록번호': '123-45-67890', '대표자명': '김철수', '사업장주소': '경기도 화성시 동탄면 123', '연락처': '031-123-4567', '비고': '우수거래처' },
    { '업체명': '한양토건(주)', '사업자등록번호': '234-56-78901', '대표자명': '이영희', '사업장주소': '서울시 강남구 테헤란로 456', '연락처': '02-987-6543', '비고': '현장직송' },
    { '업체명': '성지산업개발', '사업자등록번호': '345-67-89012', '대표자명': '박민수', '사업장주소': '인천시 서구 북항로 789', '연락처': '032-456-7890', '비고': '신규등록' },
    { '업체명': '미래인프라건설', '사업자등록번호': '456-78-90123', '대표자명': '정우성', '사업장주소': '충남 아산시 배방읍 101', '연락처': '041-555-1234', '비고': '장기임대' },
    { '업체명': '(주)태평양엔지니어링', '사업자등록번호': '567-89-01234', '대표자명': '한지민', '사업장주소': '대전시 유성구 대덕대로 202', '연락처': '042-333-7777', '비고': '익월결제' }
  ],
  ASSET: [
    { '호기': 'SJ-3219-01', '장비명': 'SJ3219', '차대번호': 'SN20230101', '소유구분': '자사', '상태': '대여중', '연식': '2023', '주기장': '백암주기장' },
    { '호기': 'SJ-3219-02', '장비명': 'SJ3219', '차대번호': 'SN20230102', '소유구분': '자사', '상태': '대기', '연식': '2023', '주기장': '백암주기장' },
    { '호기': 'GS-1930-05', '장비명': 'GS1930', '차대번호': 'SN20220511', '소유구분': '전대(타사)', '상태': '대여중', '연식': '2022', '주기장': '인천북항' },
    { '호기': 'E-400-01', '장비명': 'E400AJ', '차대번호': 'SN20210815', '소유구분': '자사', '상태': '정비중', '연식': '2021', '주기장': '수리공장' },
    { '호기': 'Z-34-03', '장비명': 'Z34-22N', '차대번호': 'SN20240320', '소유구분': '자사', '상태': '가용', '연식': '2024', '주기장': '백암주기장' }
  ],
  CONTRACT: [
    { '문서번호': 'CT-2026-001', '거래처': '(주)대한건설', '현장명': '동탄 물류센터 신축공사', '출고일': '2026-03-01', '반납일': '2026-05-31', '결제일': '31' },
    { '문서번호': 'CT-2026-002', '거래처': '한양토건(주)', '현장명': '역삼동 오피스 리모델링', '출고일': '2026-03-15', '반납일': '2026-06-30', '결제일': '25' },
    { '문서번호': 'CT-2026-003', '거래처': '성지산업개발', '현장명': '아산 배방 아파트 2공구', '출고일': '2026-04-01', '반납일': '2026-04-30', '결제일': '말일' },
    { '문서번호': 'CT-2026-004', '거래처': '미래인프라건설', '현장명': '화성 바이오밸리 공장', '출고일': '2026-02-10', '반납일': '2026-08-31', '결제일': '31' }
  ]
};

export const DataFormationStudio: React.FC = () => {
  const [activeEntity, setActiveEntity] = useState<TargetEntity>('CUSTOMER');
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fixedValues, setFixedValues] = useState<Record<string, string>>({});
  const [reports, setReports] = useState<GapAnalysisReport[]>([]);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [isInserting, setIsInserting] = useState(false);

  const resetData = () => {
    setRawData([]);
    setHeaders([]);
    setMapping({});
    setFixedValues({});
    setIsAnalyzed(false);
    setReports([]);
  };

  const loadSampleData = (entityToLoad: TargetEntity) => {
    const samples = SAMPLE_DATASETS[entityToLoad] || [];
    if (samples.length === 0) return;
    setActiveEntity(entityToLoad);
    setRawData(samples);
    const extractedHeaders = Object.keys(samples[0]);
    setHeaders(extractedHeaders);
    setMapping(autoMapHeaders(extractedHeaders, entityToLoad));
    setFixedValues({});
    setIsAnalyzed(false);
    setReports([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
      
      if (data.length > 0) {
        setRawData(data);
        const extractedHeaders = Object.keys(data[0] as Record<string, any>);
        setHeaders(extractedHeaders);
        setMapping(autoMapHeaders(extractedHeaders, activeEntity));
        setFixedValues({});
        setIsAnalyzed(false);
        setReports([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const aoa = generateTemplateAoA(activeEntity);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${activeEntity}_TEMPLATE.xlsx`);
  };

  const handleMapChange = (header: string, schemaKey: string) => {
    setMapping(prev => {
      const next = { ...prev };
      if (schemaKey) next[header] = schemaKey;
      else delete next[header];
      return next;
    });
    setIsAnalyzed(false);
  };

  const handleFixedValueChange = (schemaKey: string, value: string) => {
    setFixedValues(prev => {
      const next = { ...prev };
      if (value) next[schemaKey] = value;
      else delete next[schemaKey];
      return next;
    });
    setIsAnalyzed(false);
  };

  const runAnalysis = () => {
    const results = analyzeGaps(rawData, mapping, fixedValues, activeEntity);
    setReports(results);
    setIsAnalyzed(true);
  };

  const executeDbInsert = async () => {
    if (!confirm('에러가 없는 정상 데이터를 실제 데이터베이스에 일괄 이관하시겠습니까? (취소 불가)')) return;
    
    setIsInserting(true);
    try {
      const tenantId = db.currentTenant?.id || 'tenant-giyeonlift';
      const validData = reports.filter(r => r.errors.length === 0).map((r, idx) => {
        const item = { ...r.mappedData };
        if (!item.id) {
          const prefix = activeEntity === 'CUSTOMER' ? 'CUST-' : activeEntity === 'ASSET' ? 'ASSET-' : 'CONT-';
          item.id = `${prefix}${Date.now().toString().slice(-6)}${String(idx + 1).padStart(3, '0')}`;
        }
        item.tenant_id = tenantId;
        if (!item.createdAt) item.createdAt = new Date().toISOString();
        if (!item.updatedAt) item.updatedAt = new Date().toISOString();
        return item;
      });
      
      let tableName = '';
      if (activeEntity === 'CUSTOMER') tableName = 'customers';
      else if (activeEntity === 'ASSET') tableName = 'assets';
      else if (activeEntity === 'CONTRACT') tableName = 'contracts';

      if (validData.length > 0) {
        // [규칙 5.2] DB 저장 성공 검증 및 무음 실패 방지 (글로벌 핸들러 연계 및 명시적 Await)
        const { error } = await supabase!.from(tableName).insert(validData);
        if (error) throw new Error(error.message);
        
        await db.pullFromSupabase();
        alert(`총 ${validData.length}건의 ${activeEntity} 데이터가 성공적으로 이관되었습니다.`);
      } else {
        alert('이관할 정상 데이터가 없습니다.');
      }
    } catch (err: any) {
      alert(`데이터베이스 이관 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsInserting(false);
    }
  };

  const schemaFields = MIGRATION_SCHEMAS[activeEntity];
  const errorCount = reports.reduce((sum, r) => sum + r.errors.length, 0);

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
      {/* 타이틀 및 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={24} color="var(--primary)" />
            초기자료형성 (Data Formation Studio)
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            다양한 테넌트의 불규칙한 엑셀 데이터를 정규 스키마 템플릿으로 맵핑하고, 부족 요소(Gap)를 식별 및 보정하여 실 DB에 이관합니다.
          </p>
        </div>
        <button onClick={downloadTemplate} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Download size={16} /> 표준 템플릿 다운로드
        </button>
      </div>

      {/* 탭 선택 바 & 탭별 샘플 데이터 주입 버튼군 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['CUSTOMER', 'ASSET', 'CONTRACT'] as TargetEntity[]).map(entity => {
            const label = entity === 'CUSTOMER' ? '거래처 마스터' : entity === 'ASSET' ? '장비(자산) 마스터' : '수주(계약) 원장';
            const isActive = activeEntity === entity;
            return (
              <button
                key={entity}
                onClick={() => {
                  setActiveEntity(entity);
                  resetData();
                }}
                className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px', fontWeight: 700 }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* 탭별 샘플 데이터 주입 버튼 그룹 */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>샘플 데이터:</span>
          <button
            type="button"
            onClick={() => loadSampleData('CUSTOMER')}
            className={`btn ${activeEntity === 'CUSTOMER' && rawData.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Sparkles size={13} />
            거래처 샘플 주입
          </button>
          <button
            type="button"
            onClick={() => loadSampleData('ASSET')}
            className={`btn ${activeEntity === 'ASSET' && rawData.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Sparkles size={13} />
            장비 샘플 주입
          </button>
          <button
            type="button"
            onClick={() => loadSampleData('CONTRACT')}
            className={`btn ${activeEntity === 'CONTRACT' && rawData.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Sparkles size={13} />
            계약 샘플 주입
          </button>
        </div>
      </div>

      {/* 데이터 업로드 영역 */}
      <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Upload size={16} /> 데이터 업로드 및 스키마 매핑
        </h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
            <button
              type="button"
              onClick={() => loadSampleData(activeEntity)}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <Sparkles size={14} color="var(--primary)" />
              {activeEntity === 'CUSTOMER' ? '거래처' : activeEntity === 'ASSET' ? '장비' : '수주'} 샘플 데이터 주입
            </button>
          </div>

          {rawData.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                로드 완료: {rawData.length}건 ({headers.length}개 컬럼)
              </span>
              <button
                type="button"
                onClick={resetData}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}
              >
                <RotateCcw size={12} />
                초기화
              </button>
            </div>
          )}
        </div>

        {/* 1. 업로드 원본 데이터 미리보기 테이블 (사용자가 요청한 핵심 영역) */}
        {rawData.length > 0 && (
          <div style={{ marginBottom: '24px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Table size={15} color="var(--primary)" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                  업로드 데이터 미리보기 ({rawData.length}건)
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  * 원본 엑셀 행 데이터 실물입니다. 아래에서 항목별 매핑 설정을 확인하십시오.
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                상위 {Math.min(rawData.length, 10)}건 표시
              </span>
            </div>
            <div style={{ maxHeight: '260px', overflowX: 'auto', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: '50px', backgroundColor: 'var(--bg-app)', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>No</th>
                    {headers.map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', backgroundColor: 'var(--bg-app)', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap', fontWeight: 700 }}>
                        {h}
                        {mapping[h] ? (
                          <span style={{ marginLeft: '6px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                            ➔ {schemaFields.find(f => f.key === mapping[h])?.label || mapping[h]}
                          </span>
                        ) : (
                          <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>
                            (제외)
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawData.slice(0, 10).map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{rIdx + 1}</td>
                      {headers.map(h => (
                        <td key={h} style={{ padding: '6px 12px', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap', color: row[h] ? 'var(--text-main)' : 'var(--text-muted)' }}>
                          {row[h] !== undefined && row[h] !== '' ? String(row[h]) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. 자동 매핑 설정 & 일괄 고정값 할당 */}
        {headers.length > 0 && (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 400px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>자동 매핑 결과 (Mapping Configuration)</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px', textAlign: 'left', whiteSpace: 'nowrap' }}>원본 엑셀 컬럼</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '30px' }}><ArrowRight size={14} /></th>
                    <th style={{ padding: '8px', textAlign: 'left', whiteSpace: 'nowrap' }}>정규 스키마 템플릿 항목</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map(h => (
                    <tr key={h} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px', fontWeight: '500', whiteSpace: 'nowrap' }}>{h}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}><ArrowRight size={14} /></td>
                      <td style={{ padding: '8px' }}>
                        <select 
                          value={mapping[h] || ''}
                          onChange={(e) => handleMapChange(h, e.target.value)}
                          style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', width: '100%', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                        >
                          <option value="">-- 제외(매핑 안함) --</option>
                          {schemaFields.map((f: any) => (
                            <option key={f.key} value={f.key}>{f.label} {f.required ? '(필수)' : ''}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '24px', marginBottom: '8px' }}>일괄 고정값 할당 (Fixed Value Injection)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {schemaFields.filter(f => !Object.values(mapping).includes(f.key)).map(f => (
                  <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                     <label style={{ fontSize: '12px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{f.label} ({f.key})</label>
                     <input 
                        type="text" 
                        placeholder={f.defaultValue ? `기본값: ${f.defaultValue}` : '고정값 입력...'}
                        value={fixedValues[f.key] || ''}
                        onChange={e => handleFixedValueChange(f.key, e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                     />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: '1 1 300px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>정규 템플릿 요구사항 (Pre-template)</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {schemaFields.map((f: any) => {
                  const isMapped = Object.values(mapping).includes(f.key) || !!fixedValues[f.key];
                  return (
                    <li key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '8px', backgroundColor: isMapped ? 'rgba(34, 197, 94, 0.1)' : (f.required ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-app)'), borderRadius: '6px', border: `1px solid ${isMapped ? 'rgba(34, 197, 94, 0.3)' : (f.required ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)')}` }}>
                      {isMapped ? <CheckCircle size={14} color="#22c55e" /> : (f.required ? <AlertCircle size={14} color="#ef4444" /> : <Settings size={14} color="var(--text-muted)" />)}
                      <span style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>{f.label}</span>
                      <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>({f.key})</span>
                      {f.required && <span style={{ marginLeft: 'auto', color: '#ef4444', fontSize: '10px', fontWeight: '800', whiteSpace: 'nowrap' }}>필수</span>}
                    </li>
                  )
                })}
              </ul>
              
              <button onClick={runAnalysis} className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '16px', fontSize: '14px', fontWeight: '700' }}>
                갭 분석 및 정규화 검증 실행 (Gap Analysis)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. 갭 분석 검증 결과 리포트 */}
      {isAnalyzed && (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: `1px solid ${errorCount > 0 ? '#ef4444' : '#22c55e'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', color: errorCount > 0 ? '#ef4444' : '#22c55e' }}>
              {errorCount > 0 ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
              검증 결과 리포트 (오류 {errorCount}건)
            </h3>
            {errorCount === 0 && (
              <button 
                onClick={executeDbInsert}
                disabled={isInserting}
                className="btn btn-primary" 
                style={{ fontSize: '13px', padding: '8px 16px', backgroundColor: '#22c55e', borderColor: '#22c55e', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Database size={16} /> 
                {isInserting ? '이관 중...' : 'DB 최종 이관 (Bulk Insert)'}
              </button>
            )}
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px', textAlign: 'center', width: '60px', whiteSpace: 'nowrap' }}>행 번호</th>
                  <th style={{ padding: '8px', textAlign: 'left', width: '80px', whiteSpace: 'nowrap' }}>상태</th>
                  <th style={{ padding: '8px', textAlign: 'left', whiteSpace: 'nowrap' }}>진단 상세 (Gap & Errors)</th>
                  <th style={{ padding: '8px', textAlign: 'left', whiteSpace: 'nowrap' }}>변환된 데이터 Preview</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: r.errors.length > 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                    <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.rowIndex}</td>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                      {r.errors.length > 0 ? <span style={{ color: '#ef4444', fontWeight: '700' }}>오류</span> : <span style={{ color: '#22c55e', fontWeight: '700' }}>정상</span>}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {r.errors.map((e: string, j: number) => <div key={'e'+j} style={{ color: '#ef4444', marginBottom: '2px' }}>• {e}</div>)}
                      {r.warnings.map((w: string, j: number) => <div key={'w'+j} style={{ color: '#eab308', marginBottom: '2px' }}>• {w}</div>)}
                      {r.errors.length === 0 && r.warnings.length === 0 && <span style={{ color: 'var(--text-muted)' }}>완벽 일치</span>}
                    </td>
                    <td style={{ padding: '8px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {JSON.stringify(r.mappedData).substring(0, 70)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataFormationStudio;
