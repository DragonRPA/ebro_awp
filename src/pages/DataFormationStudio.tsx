import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { TargetEntity, MIGRATION_SCHEMAS, autoMapHeaders, analyzeGaps, GapAnalysisReport } from '../utils/migration/MigrationEngine';
import { Download, Upload, AlertCircle, CheckCircle, ArrowRight, Settings, FileSpreadsheet } from 'lucide-react';

export const DataFormationStudio: React.FC = () => {
  const [activeEntity, setActiveEntity] = useState<TargetEntity>('CUSTOMER');
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [reports, setReports] = useState<GapAnalysisReport[]>([]);
  const [isAnalyzed, setIsAnalyzed] = useState(false);

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
        
        // Auto map
        const initialMapping = autoMapHeaders(extractedHeaders, activeEntity);
        setMapping(initialMapping);
        setIsAnalyzed(false);
        setReports([]);
      }
    };
    reader.readAsBinaryString(file);
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

  const runAnalysis = () => {
    const results = analyzeGaps(rawData, mapping, activeEntity);
    setReports(results);
    setIsAnalyzed(true);
  };

  const schemaFields = MIGRATION_SCHEMAS[activeEntity];
  const errorCount = reports.reduce((sum, r) => sum + r.errors.length, 0);

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={24} color="var(--primary)" />
            초기자료형성 (Data Formation Studio)
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            다양한 테넌트의 불규칙한 엑셀 데이터를 당사 정규 스키마 템플릿으로 매핑하고 누락 요소(Gap)를 식별 및 최적화합니다.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        {['CUSTOMER', 'ASSET', 'CONTRACT'].map(entity => (
          <button
            key={entity}
            onClick={() => {
              setActiveEntity(entity as TargetEntity);
              setRawData([]); setHeaders([]); setMapping({}); setIsAnalyzed(false); setReports([]);
            }}
            className={`btn ${activeEntity === entity ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
          >
            {entity === 'CUSTOMER' ? '거래처 마스터' : entity === 'ASSET' ? '장비(자산) 마스터' : '수주(계약) 원장'}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Upload size={16} /> 데이터 업로드 및 스키마 매핑
        </h3>
        
        <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{ marginBottom: '16px' }} />

        {headers.length > 0 && (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 400px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>자동 매핑 결과 (Mapping Configuration)</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>원본 엑셀 컬럼</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}><ArrowRight size={14} /></th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>정규 스키마 템플릿 항목</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map(h => (
                    <tr key={h} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px', fontWeight: '500' }}>{h}</td>
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
            </div>

            <div style={{ flex: '1 1 300px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>정규 템플릿 요구사항 (Pre-template)</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {schemaFields.map((f: any) => {
                  const isMapped = Object.values(mapping).includes(f.key);
                  return (
                    <li key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '8px', backgroundColor: isMapped ? 'rgba(34, 197, 94, 0.1)' : (f.required ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-app)'), borderRadius: '6px', border: `1px solid ${isMapped ? 'rgba(34, 197, 94, 0.3)' : (f.required ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)')}` }}>
                      {isMapped ? <CheckCircle size={14} color="#22c55e" /> : (f.required ? <AlertCircle size={14} color="#ef4444" /> : <Settings size={14} color="var(--text-muted)" />)}
                      <span style={{ fontWeight: '600' }}>{f.label}</span>
                      <span style={{ color: 'var(--text-muted)' }}>({f.key})</span>
                      {f.required && <span style={{ marginLeft: 'auto', color: '#ef4444', fontSize: '10px', fontWeight: '800' }}>필수</span>}
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

      {isAnalyzed && (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: `1px solid ${errorCount > 0 ? '#ef4444' : '#22c55e'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', color: errorCount > 0 ? '#ef4444' : '#22c55e' }}>
              {errorCount > 0 ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
              검증 결과 리포트 (오류 {errorCount}건)
            </h3>
            {errorCount === 0 && <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}><Download size={14} style={{ marginRight: '4px' }} /> 정규화 데이터 다운로드</button>}
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px', textAlign: 'center', width: '60px' }}>행 번호</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>상태</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>진단 상세 (Gap & Errors)</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>변환된 데이터 Preview</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: r.errors.length > 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                    <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>{r.rowIndex}</td>
                    <td style={{ padding: '8px' }}>
                      {r.errors.length > 0 ? <span style={{ color: '#ef4444', fontWeight: '700' }}>오류</span> : <span style={{ color: '#22c55e', fontWeight: '700' }}>정상</span>}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {r.errors.map((e: string, j: number) => <div key={'e'+j} style={{ color: '#ef4444', marginBottom: '2px' }}>• {e}</div>)}
                      {r.warnings.map((w: string, j: number) => <div key={'w'+j} style={{ color: '#eab308', marginBottom: '2px' }}>• {w}</div>)}
                      {r.errors.length === 0 && r.warnings.length === 0 && <span style={{ color: 'var(--text-muted)' }}>완벽 일치</span>}
                    </td>
                    <td style={{ padding: '8px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {JSON.stringify(r.mappedData).substring(0, 60)}...
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
