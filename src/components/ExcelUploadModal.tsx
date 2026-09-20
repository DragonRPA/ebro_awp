// src/components/ExcelUploadModal.tsx
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, FileSpreadsheet, X, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

export interface ExcelColumnDef {
  key: string;
  label: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date';
  sample?: string | number;
  description?: string;
}

export interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  templateFileName: string;
  columns: ExcelColumnDef[];
  onUpload: (rows: Record<string, any>[]) => Promise<{ successCount: number; errorCount?: number; message?: string }>;
}

export const ExcelUploadModal: React.FC<ExcelUploadModalProps> = ({
  isOpen,
  onClose,
  title,
  templateFileName,
  columns,
  onUpload
}) => {
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ successCount: number; errorCount?: number; message?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. 서식 엑셀 파일 다운로드 (전사 표준 헌장 3.1 건조한 명사·동사 규격)
  const handleDownloadTemplate = () => {
    const headers = columns.map(c => c.label + (c.required ? ' *' : ''));
    const samples = columns.map(c => c.sample !== undefined ? c.sample : '');

    const wsData = [
      headers,
      samples
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 컬럼 너비 자동 설정
    const colWidths = columns.map(c => ({ wch: Math.max(c.label.length * 3, 15) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '일괄업로드양식');
    XLSX.writeFile(wb, `${templateFileName}_서식.xlsx`);
  };

  // 2. 파일 파싱 및 유효성 검증
  const handleFile = (file: File) => {
    setValidationErrors([]);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        if (!ws) {
          setValidationErrors(['유효한 워크시트를 찾을 수 없습니다.']);
          return;
        }

        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rawRows.length < 2) {
          setValidationErrors(['데이터가 비어 있습니다. 1행 헤더와 2행 이상의 데이터를 입력해 주세요.']);
          return;
        }

        const headerRow = rawRows[0].map(h => String(h || '').trim().replace(/\s*\*/g, ''));
        const dataRows = rawRows.slice(1).filter(r => r.some(cell => String(cell || '').trim() !== ''));

        const errors: string[] = [];
        const processed: Record<string, any>[] = [];

        // 필수 컬럼 매핑 검증
        const colMap: Record<number, ExcelColumnDef> = {};
        columns.forEach(col => {
          const idx = headerRow.findIndex(h => h === col.label || h.includes(col.label));
          if (idx >= 0) {
            colMap[idx] = col;
          } else if (col.required) {
            errors.push(`필수 컬럼 [${col.label}] 헤더가 누락되었습니다.`);
          }
        });

        if (errors.length > 0) {
          setValidationErrors(errors);
          return;
        }

        // 행별 데이터 파싱
        dataRows.forEach((row, rowIdx) => {
          const rowNum = rowIdx + 2;
          const record: Record<string, any> = {};
          let rowHasError = false;

          Object.entries(colMap).forEach(([idxStr, col]) => {
            const val = row[Number(idxStr)];
            let parsedVal: any = val !== undefined && val !== null ? String(val).trim() : '';

            if (col.type === 'number') {
              const num = Number(String(parsedVal).replace(/,/g, ''));
              if (isNaN(num)) {
                if (col.required) {
                  errors.push(`${rowNum}행 [${col.label}]: 유효한 숫자가 아닙니다.`);
                  rowHasError = true;
                } else {
                  parsedVal = 0;
                }
              } else {
                parsedVal = num;
              }
            } else if (col.type === 'date') {
              if (typeof val === 'number') {
                const dateObj = XLSX.SSF.parse_date_code(val);
                parsedVal = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
              } else if (parsedVal && !/^\d{4}-\d{2}-\d{2}$/.test(parsedVal)) {
                const cleaned = parsedVal.replace(/[^0-9]/g, '');
                if (cleaned.length === 8) {
                  parsedVal = `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
                }
              }
            }

            if (col.required && (parsedVal === '' || parsedVal === undefined)) {
              errors.push(`${rowNum}행 [${col.label}]: 필수 입력값이 누락되었습니다.`);
              rowHasError = true;
            }

            record[col.key] = parsedVal;
          });

          if (!rowHasError) {
            processed.push(record);
          }
        });

        setParsedRows(processed);
        if (errors.length > 0) {
          setValidationErrors(errors.slice(0, 10));
        }
      } catch (err: any) {
        setValidationErrors([`파일 파싱 오류: ${err.message || '알 수 없는 파일 오류'}`]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // 3. 업로드 확정 실행
  const handleConfirmUpload = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    try {
      const res = await onUpload(parsedRows);
      setUploadResult(res);
      setParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setValidationErrors([`저장 실패: ${err.message || '데이터베이스 처리 오류'}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setValidationErrors([]);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '780px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        {/* 모달 헤더 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-header)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 모달 본문 */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 1단계: 서식 다운로드 안내 영역 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(59, 130, 246, 0.06)',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                엑셀 표준 서식 다운로드
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                표준 양식에 맞추어 작성 후 업로드하면 1초 만에 일괄 적재됩니다.
              </span>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                whiteSpace: 'nowrap'
              }}
            >
              <Download size={14} />
              <span>양식 다운로드</span>
            </button>
          </div>

          {/* 2단계: 파일 드래그앤드롭 업로드 영역 */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '28px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: dragOver ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-app)',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".xlsx, .xls, .csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
            <Upload size={28} color="var(--primary)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
            <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
              엑셀 파일을 드래그하거나 클릭하여 선택
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              지원 형식: .xlsx, .xls, .csv
            </div>
          </div>

          {/* 3단계: 유효성 검증 오류 메시지 표출 */}
          {validationErrors.length > 0 && (
            <div style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--danger-light)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--danger)',
              fontSize: '12px',
              lineHeight: 1.5
            }}>
              <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <AlertCircle size={14} />
                <span>데이터 검증 오류 ({validationErrors.length}건)</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 4단계: 업로드 완료 성공 메시지 */}
          {uploadResult && (
            <div style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--success)',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={16} />
              <span>
                성공적으로 <strong>{uploadResult.successCount}건</strong>이 데이터베이스에 일괄 등록되었습니다.
                {uploadResult.message ? ` (${uploadResult.message})` : ''}
              </span>
            </div>
          )}

          {/* 5단계: 파싱 데이터 미리보기 테이블 */}
          {parsedRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  업로드 대상 데이터 미리보기 (총 {parsedRows.length}건)
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11.5px', textDecoration: 'underline' }}
                >
                  초기화
                </button>
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '6px 8px', whiteSpace: 'nowrap', width: '35px' }}>#</th>
                      {columns.map(col => (
                        <th key={col.key} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 15).map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        {columns.map(col => (
                          <td key={col.key} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                            {String(row[col.key] !== undefined ? row[col.key] : '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 15 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                  * 화면에는 상위 15건만 표시되며, 총 {parsedRows.length}건 전체가 등록됩니다.
                </div>
              )}
            </div>
          )}

        </div>

        {/* 모달 푸터 */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '7px 16px', fontSize: '12.5px', fontWeight: '600' }}
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleConfirmUpload}
            disabled={parsedRows.length === 0 || isProcessing}
            className="btn-primary"
            style={{
              padding: '7px 18px',
              fontSize: '12.5px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: (parsedRows.length === 0 || isProcessing) ? 0.5 : 1,
              cursor: (parsedRows.length === 0 || isProcessing) ? 'not-allowed' : 'pointer'
            }}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={14} className="spin" />
                <span>처리중...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>{parsedRows.length > 0 ? `${parsedRows.length}건 일괄 등록` : '일괄 등록'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};