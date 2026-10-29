import React, { useRef, useState } from 'react';
import { FileText, Upload, Download, Printer, X, CheckCircle2, ExternalLink, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';
import { compressFileIfNeeded } from '../utils/imageCompressor';
import { uploadToSupabaseStorage } from '../services/supabaseStorage';

export interface PurchaseStatementLineItem {
  id?: string;
  date?: string;
  description: string;
  spec?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  evidenceFileUrl?: string;
  note?: string;
}

export interface PurchaseStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  settlementId?: string;
  settlementType: 'CONSUMABLE' | 'TRANSPORT' | 'EQUIPMENT_LEASE' | 'EXTERNAL_REPAIR';
  settlementYm: string;
  vendorName: string;
  vendorBizNo?: string;
  vendorRepName?: string;
  vendorPhone?: string;
  vendorAddress?: string;
  vendorBankAccount?: string;
  buyerName?: string;
  buyerBizNo?: string;
  buyerRepName?: string;
  status?: 'PENDING' | 'CONFIRMED' | 'PAID' | string;
  confirmedAt?: string;
  confirmedBy?: string;
  paymentDate?: string;
  paidAmount?: number;
  totalAmount: number;
  memo?: string;
  items: PurchaseStatementLineItem[];
  statementFileUrl?: string;
  statementFileName?: string;
  onSaveStatementFile?: (fileUrl: string, fileName: string) => Promise<void>;
}

export async function uploadStatementFileSafe(
  file: File,
  folder: string,
  prefix: string = 'STMT'
): Promise<{ fileUrl: string; fileName: string }> {
  const processed = await compressFileIfNeeded(file);
  const processedFile = processed.file;
  const ext = (processedFile.name.split('.').pop() || 'pdf').toLowerCase();
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
  const storageFileName = `${safePrefix}_${Date.now()}.${ext}`;

  try {
    const res = await uploadToSupabaseStorage({
      file: processedFile,
      fileName: storageFileName,
      folder
    });
    if (res.success && res.fileUrl) {
      return { fileUrl: res.fileUrl, fileName: file.name };
    }
  } catch {
    // 스토리지 버킷 미생성 또는 오프라인 환경 시 데이터 URL로 안전 폴백하여 무누락 보관 보장
  }

  if (processed.base64) {
    return { fileUrl: processed.base64, fileName: file.name };
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'));
    reader.readAsDataURL(processedFile);
  });

  return { fileUrl: dataUrl, fileName: file.name };
}

const TYPE_LABEL_MAP: Record<string, string> = {
  CONSUMABLE: '소모품 매입',
  TRANSPORT: '운송료 매입',
  EQUIPMENT_LEASE: '임차자산 매입',
  EXTERNAL_REPAIR: '외주정비 매입'
};

const STATUS_LABEL_MAP: Record<string, string> = {
  PENDING: '집계중',
  CONFIRMED: '정산확정',
  PAID: '지급완료'
};

export const PurchaseStatementModal: React.FC<PurchaseStatementModalProps> = ({
  isOpen,
  onClose,
  settlementId,
  settlementType,
  settlementYm,
  vendorName,
  vendorBizNo,
  vendorRepName,
  vendorPhone,
  vendorAddress,
  vendorBankAccount,
  buyerName = '(주)기연리프트',
  buyerBizNo = '135-81-59866',
  buyerRepName = '이정용',
  status = 'PENDING',
  confirmedAt,
  confirmedBy,
  paymentDate,
  paidAmount = 0,
  totalAmount,
  memo,
  items,
  statementFileUrl,
  statementFileName,
  onSaveStatementFile
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localFileUrl, setLocalFileUrl] = useState<string | undefined>(undefined);
  const [localFileName, setLocalFileName] = useState<string | undefined>(undefined);
  const [activeViewTab, setActiveViewTab] = useState<'BOTH' | 'DOCUMENT' | 'ORIGINAL_FILE'>('BOTH');

  if (!isOpen) return null;

  // 대표 명세서 파일 URL 탐색 (직접 전달된 URL 또는 상세 항목의 증빙 URL 중 첫 번째 유효값)
  const effectiveFileUrl =
    localFileUrl ||
    statementFileUrl ||
    items.find(it => it.evidenceFileUrl && it.evidenceFileUrl.trim() !== '')?.evidenceFileUrl ||
    '';

  const isActualUrlOrData =
    effectiveFileUrl.startsWith('http://') ||
    effectiveFileUrl.startsWith('https://') ||
    effectiveFileUrl.startsWith('data:') ||
    effectiveFileUrl.startsWith('blob:');

  const effectiveFileName =
    localFileName ||
    statementFileName ||
    (!isActualUrlOrData && effectiveFileUrl ? effectiveFileUrl : '') ||
    (effectiveFileUrl.startsWith('http') ? decodeURIComponent(effectiveFileUrl.split('/').pop() || '매입거래명세서') : '매입거래명세서 원본파일');

  const lowerUrl = (effectiveFileUrl || '').toLowerCase();
  const lowerName = (effectiveFileName || '').toLowerCase();

  const isImageFile =
    lowerUrl.startsWith('data:image/') ||
    /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(lowerUrl) ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(lowerName);

  const isPdfFile =
    lowerUrl.startsWith('data:application/pdf') ||
    /\.pdf(\?|$)/i.test(lowerUrl) ||
    /\.pdf$/i.test(lowerName);

  const supplyAmount = Math.round(totalAmount);
  const vatRefAmount = Math.round(totalAmount * 0.1);
  const unpaidBalance = Math.max(0, totalAmount - paidAmount);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const folderMap: Record<string, string> = {
        CONSUMABLE: 'consumables',
        TRANSPORT: 'transport_statements',
        EQUIPMENT_LEASE: 'lease_statements',
        EXTERNAL_REPAIR: 'repair_statements'
      };
      const folder = folderMap[settlementType] || 'purchase_statements';
      const prefix = settlementId || `${settlementType}_${settlementYm}`;
      const { fileUrl, fileName } = await uploadStatementFileSafe(file, folder, prefix);
      setLocalFileUrl(fileUrl);
      setLocalFileName(fileName);
      if (onSaveStatementFile) {
        await onSaveStatementFile(fileUrl, fileName);
      }
    } catch (err: any) {
      alert(err?.message || '매입거래명세서 파일 저장 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadOriginal = () => {
    if (!effectiveFileUrl || !isActualUrlOrData) return;
    const a = document.createElement('a');
    a.href = effectiveFileUrl;
    a.download = effectiveFileName || `매입거래명세서_${vendorName}_${settlementYm}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  const typeLabel = TYPE_LABEL_MAP[settlementType] || '매입 정산';
  const statusLabel = STATUS_LABEL_MAP[status] || status;

  return (
    <div
      className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-5 overflow-y-auto print:bg-white print:p-0"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:border-none"
        onClick={e => e.stopPropagation()}
      >
        {/* 상단 액션 바 */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black tracking-tight whitespace-nowrap">매입거래명세서 보관 및 열람</h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-black bg-indigo-600 text-white whitespace-nowrap">
                  {typeLabel}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-200 border border-slate-700 whitespace-nowrap">
                  {settlementYm} 귀속
                </span>
                {effectiveFileUrl ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 원본 명세서 파일 보관됨
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap">
                    전자 정산명세 보관중 · 원본파일 추가 가능
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                매입처: {vendorName} {settlementId ? `| 정산번호: ${settlementId}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 보기 모드 전환 */}
            {effectiveFileUrl && (
              <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveViewTab('BOTH')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
                    activeViewTab === 'BOTH' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  통합 보기
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewTab('DOCUMENT')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
                    activeViewTab === 'DOCUMENT' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  정산 명세표
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewTab('ORIGINAL_FILE')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
                    activeViewTab === 'ORIGINAL_FILE' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  원본 첨부파일
                </button>
              </div>
            )}

            {/* 명세서 파일 업로드/저장 버튼 */}
            {onSaveStatementFile && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,.xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-black transition-all shadow-sm whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {isUploading ? '명세서 저장 중...' : effectiveFileUrl ? '명세서 파일 교체 저장' : '매입거래명세서 파일 저장'}
                </button>
              </>
            )}

            {/* 원본 파일 다운로드/새창 */}
            {effectiveFileUrl && isActualUrlOrData && (
              <button
                type="button"
                onClick={handleDownloadOriginal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> 원본 파일 다운로드
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> 명세서 인쇄
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 본문 영역 */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 bg-slate-50/60 flex-1 print:bg-white print:p-2 print:overflow-visible">
          {/* 1. 표준 매입거래명세서 양식 */}
          {(activeViewTab === 'BOTH' || activeViewTab === 'DOCUMENT') && (
            <div className="bg-white rounded-xl border-2 border-slate-800 p-5 sm:p-6 shadow-sm space-y-5">
              {/* 문서 타이틀 */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b-2 border-slate-800 pb-4">
                <div>
                  <div className="text-[11px] font-black text-indigo-700 tracking-widest uppercase">
                    매입정산 증빙 원장 · {typeLabel}
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-[0.2em] mt-0.5 whitespace-nowrap">
                    매 입 거 래 명 세 서
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                  <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 whitespace-nowrap">
                    <span className="font-bold text-slate-500 mr-1.5">귀속연월</span>
                    <span className="font-black text-slate-900">{settlementYm}</span>
                  </div>
                  <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 whitespace-nowrap">
                    <span className="font-bold text-slate-500 mr-1.5">정산상태</span>
                    <span className="font-black text-indigo-700">{statusLabel}</span>
                  </div>
                  {confirmedAt && (
                    <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 whitespace-nowrap">
                      <span className="font-bold text-slate-500 mr-1.5">확정일시</span>
                      <span className="font-bold text-slate-800">{confirmedAt.slice(0, 10)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 공급자(매입처) vs 공급받는자(당사) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 공급자 (매입 거래처) */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-slate-800 text-white px-3.5 py-2 text-xs font-black flex items-center justify-between">
                    <span className="whitespace-nowrap">공급자 (매입 거래처)</span>
                    <span className="text-[11px] text-slate-300 font-bold whitespace-nowrap">{typeLabel}</span>
                  </div>
                  <div className="p-3.5 grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">상호(법인명)</div>
                      <div className="font-black text-slate-900 text-sm mt-0.5 whitespace-nowrap truncate">{vendorName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">사업자등록번호</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5 whitespace-nowrap">{vendorBizNo || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">대표자 / 연락처</div>
                      <div className="font-bold text-slate-700 mt-0.5 whitespace-nowrap truncate">
                        {[vendorRepName, vendorPhone].filter(Boolean).join(' / ') || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">정산 계좌정보</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5 whitespace-nowrap truncate">
                        {vendorBankAccount || '-'}
                      </div>
                    </div>
                    {vendorAddress && (
                      <div className="col-span-2">
                        <div className="text-[10px] font-bold text-slate-400">사업장 주소</div>
                        <div className="font-medium text-slate-700 mt-0.5 truncate">{vendorAddress}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 공급받는자 (당사) */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 text-slate-800 border-b border-slate-300 px-3.5 py-2 text-xs font-black flex items-center justify-between">
                    <span className="whitespace-nowrap">공급받는자 (당사)</span>
                    <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap">매입 정산 주체</span>
                  </div>
                  <div className="p-3.5 grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">상호(법인명)</div>
                      <div className="font-black text-slate-900 text-sm mt-0.5 whitespace-nowrap">{buyerName}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">사업자등록번호</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5 whitespace-nowrap">{buyerBizNo}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">대표자</div>
                      <div className="font-bold text-slate-700 mt-0.5 whitespace-nowrap">{buyerRepName}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">정산 확인자 / 지급일</div>
                      <div className="font-bold text-slate-700 mt-0.5 whitespace-nowrap">
                        {confirmedBy || '담당자'} {paymentDate ? `(${paymentDate})` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 정산 금액 요약 바 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 text-white rounded-xl p-4">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap">품목 건수</div>
                  <div className="text-lg font-black text-white mt-0.5 whitespace-nowrap">{items.length}건</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap">매입 정산 합계액</div>
                  <div className="text-lg font-black text-amber-300 font-mono mt-0.5 whitespace-nowrap">
                    ₩{supplyAmount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                    부가세 별도 시 참고세액 ₩{vatRefAmount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap">기지급 금액</div>
                  <div className="text-lg font-black text-emerald-400 font-mono mt-0.5 whitespace-nowrap">
                    ₩{paidAmount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap">미지급 잔액</div>
                  <div className={`text-lg font-black font-mono mt-0.5 whitespace-nowrap ${unpaidBalance > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                    ₩{unpaidBalance.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 품목별 매입 거래 내역 테이블 */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-300 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 whitespace-nowrap">매입 거래 상세 명세</span>
                  <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">단위: 원</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300 text-slate-600 font-black">
                        <th className="py-2.5 px-3 text-center w-12 whitespace-nowrap">순번</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">품목 및 거래 내역</th>
                        <th className="py-2.5 px-3 text-right w-20 whitespace-nowrap">수량</th>
                        <th className="py-2.5 px-3 text-right w-32 whitespace-nowrap">단가</th>
                        <th className="py-2.5 px-3 text-right w-36 whitespace-nowrap">매입금액</th>
                        <th className="py-2.5 px-3 text-center w-28 whitespace-nowrap print:hidden">개별증빙</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-bold whitespace-nowrap">
                            등록된 상세 품목 내역이 없습니다. (총 정산액: ₩{totalAmount.toLocaleString()})
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => {
                          const hasItemFile = Boolean(item.evidenceFileUrl && (item.evidenceFileUrl.startsWith('http') || item.evidenceFileUrl.startsWith('data:')));
                          return (
                            <tr key={item.id || idx} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500 whitespace-nowrap">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                                <div>{item.description}</div>
                                {(item.spec || item.note) && (
                                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                    {[item.spec, item.note].filter(Boolean).join(' | ')}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 whitespace-nowrap">
                                {(item.quantity || 1).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                                ₩{(item.unitPrice || 0).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                                ₩{(item.amount || 0).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap print:hidden">
                                {hasItemFile ? (
                                  <a
                                    href={item.evidenceFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold whitespace-nowrap"
                                  >
                                    <ExternalLink className="w-3 h-3" /> 열람
                                  </a>
                                ) : item.evidenceFileUrl ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold whitespace-nowrap">
                                    {item.evidenceFileUrl}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-[11px]">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-800 font-black text-slate-900">
                        <td colSpan={2} className="py-2.5 px-3 whitespace-nowrap">합계</td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                          {items.reduce((s, i) => s + (Number(i.quantity) || 0), 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">-</td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-700 text-sm whitespace-nowrap">
                          ₩{totalAmount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 print:hidden"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 비고란 */}
              {memo && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                  <span className="font-black text-slate-600 mr-2 whitespace-nowrap">정산 비고:</span>
                  <span className="text-slate-700 font-medium">{memo}</span>
                </div>
              )}
            </div>
          )}

          {/* 2. 보관된 원본 매입거래명세서 첨부파일 뷰어 */}
          {(activeViewTab === 'BOTH' || activeViewTab === 'ORIGINAL_FILE') && (
            <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden print:hidden">
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-black text-slate-800 whitespace-nowrap">
                    보관된 매입거래명세서 원본 파일
                  </span>
                  {effectiveFileName && effectiveFileUrl && (
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 whitespace-nowrap">
                      {effectiveFileName}
                    </span>
                  )}
                </div>
                {onSaveStatementFile && (
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {effectiveFileUrl ? '다른 명세서 파일로 교체' : '매입거래명세서 파일 업로드'}
                  </button>
                )}
              </div>

              <div className="p-4">
                {!effectiveFileUrl ? (
                  <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-600">첨부된 원본 매입거래명세서 파일이 없습니다.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      상단의 표준 매입거래명세서로 내역을 확인하거나, 매입처에서 수령한 거래명세서(이미지, 문서, 엑셀) 파일을 업로드하여 보관할 수 있습니다.
                    </p>
                    {onSaveStatementFile && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-sm cursor-pointer whitespace-nowrap"
                      >
                        <Upload className="w-4 h-4" /> 매입거래명세서 파일 선택 및 저장
                      </button>
                    )}
                  </div>
                ) : isImageFile && isActualUrlOrData ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-full max-h-[600px] overflow-auto border border-slate-200 rounded-lg bg-slate-900/5 p-2 flex justify-center">
                      <img
                        src={effectiveFileUrl}
                        alt="매입거래명세서 원본"
                        className="max-w-full h-auto object-contain rounded"
                      />
                    </div>
                  </div>
                ) : isPdfFile && isActualUrlOrData ? (
                  <div className="w-full h-[560px] border border-slate-200 rounded-lg overflow-hidden">
                    <iframe
                      src={effectiveFileUrl}
                      title="매입거래명세서 원본 문서"
                      className="w-full h-full border-0"
                    />
                  </div>
                ) : isActualUrlOrData ? (
                  <div className="py-8 px-4 text-center bg-emerald-50/50 border border-emerald-200 rounded-xl flex flex-col items-center gap-3">
                    <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                    <div>
                      <div className="text-sm font-black text-slate-800">
                        원본 매입거래명세서 파일이 보관되어 있습니다 ({effectiveFileName})
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        엑셀 또는 문서 원본 파일을 다운로드하여 열람할 수 있으며, 상단 표에서 전체 명세 내역을 바로 확인할 수 있습니다.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadOriginal}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-sm whitespace-nowrap cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> 보관된 원본 명세서 다운로드 ({effectiveFileName})
                    </button>
                  </div>
                ) : (
                  <div className="py-6 px-4 text-center bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center gap-2">
                    <ImageIcon className="w-8 h-8 text-slate-400" />
                    <div className="text-xs font-bold text-slate-700">
                      업로드 파일 기록: <span className="font-mono text-indigo-700">{effectiveFileUrl}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      파일 원본을 다시 첨부하려면 우측 상단의 파일 교체 버튼을 눌러 저장하십시오.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
