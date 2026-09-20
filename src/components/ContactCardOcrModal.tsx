import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, 
  User, Building2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Customer, CustomerContact } from '../services/db';
import { analyzeContactCard, ContactCardAnalysisResult } from '../services/visionOcrService';
import { uploadToSupabaseStorage } from '../services/supabaseStorage';

interface ContactCardOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (contact: CustomerContact, isNewCustomer: boolean) => void;
  targetCustomerId?: string;
}

export const ContactCardOcrModal: React.FC<ContactCardOcrModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetCustomerId
}) => {
  const { customers, saveCustomer, saveContact, showErrorModal } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'UPLOAD' | 'ANALYZING' | 'RESULT'>('UPLOAD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ContactCardAnalysisResult | null>(null);
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newForm, setNewForm] = useState({
    companyName: '',
    name: '',
    position: '',
    contact: '',
    email: ''
  });

  useEffect(() => {
    if (isOpen) {
      setStep('UPLOAD');
      setSelectedFile(null);
      setFilePreview(null);
      setAnalysisResult(null);
      setMatchedCustomer(null);
      setIsSaving(false);
      if (targetCustomerId) {
        const found = customers.find(c => c.id === targetCustomerId);
        if (found) setMatchedCustomer(found);
      }
    }
  }, [isOpen, targetCustomerId, customers]);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    if (!file) return;

    setSelectedFile(file);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      setFilePreview(null);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }

    await executeAnalysis(file);
  };

  const executeAnalysis = async (file: File) => {
    setStep('ANALYZING');
    try {
      const result = await analyzeContactCard(file);

      if (!result.success) {
        showErrorModal(result.error || '명함/이메일 분석에 실패했습니다.');
        setStep('UPLOAD');
        return;
      }

      setAnalysisResult(result);

      let matched: Customer | null = null;
      if (targetCustomerId) {
        matched = customers.find(c => c.id === targetCustomerId) || null;
      }

      if (!matched && result.companyName) {
        const cleanExtractedName = result.companyName.replace(/주식회사|\(주\)/g, '').trim();
        matched = customers.find(c => {
          const cleanDbName = c.name.replace(/주식회사|\(주\)/g, '').trim();
          return cleanExtractedName.length >= 2 && cleanDbName === cleanExtractedName;
        }) || null;
      }

      setMatchedCustomer(matched);

      setNewForm({
        companyName: result.companyName || matched?.name || '',
        name: result.name || '',
        position: result.position || '',
        contact: result.contact || '',
        email: result.email || ''
      });

      setStep('RESULT');
    } catch (err: any) {
      console.error('[ContactCardOcrModal] Error:', err);
      showErrorModal(err?.message || '분석 중 오류가 발생했습니다.');
      setStep('UPLOAD');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    if (!analysisResult) return;
    setIsSaving(true);

    try {
      let finalCustomerId = matchedCustomer?.id;
      let isNewCustomer = false;

      // 1) 고객사가 없으면 신규 생성 (Dummy Customer)
      if (!finalCustomerId) {
        if (!newForm.companyName.trim()) {
          showErrorModal('소속 상호명(고객사명)을 입력해야 담당자를 등록할 수 있습니다.');
          setIsSaving(false);
          return;
        }
        
        const newCustData: Omit<Customer, 'id' | 'createdAt'> = {
          name: newForm.companyName.trim(),
          bizRegNo: '미상',
          representative: '미상',
          repContact: '미상',
          repEmail: '미상',
          address: '미상',
          isClosed: false,
          transactionStatus: 'ALLOWED',
          defaultBillingDay: 30,
          defaultStatementClosingDay: 25,
          paymentDueDay: 25
        };

        const savedCust = await saveCustomer(newCustData);
        finalCustomerId = savedCust.id;
        isNewCustomer = true;
      }

      if (!newForm.name.trim()) {
        showErrorModal('담당자명은 필수 입력 항목입니다.');
        setIsSaving(false);
        return;
      }

      // 2) 담당자 정보 생성 및 저장
      const newContactData: Omit<CustomerContact, 'id' | 'createdAt'> = {
        customerId: finalCustomerId,
        name: newForm.name.trim(),
        position: newForm.position.trim(),
        contact: newForm.contact.trim(),
        email: newForm.email.trim(),
        isActive: true
      };

      const savedContact = await saveContact(newContactData);
      
      onSuccess?.(savedContact, isNewCustomer);
      onClose();
    } catch (err: any) {
      console.error('[ContactCardOcrModal] Save error:', err);
      showErrorModal(err?.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <User size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                명함 / 이메일 담당자 자동 등록
                {step === 'RESULT' && (
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                    matchedCustomer 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {matchedCustomer ? '기존 고객사에 추가' : '신규 고객사 동시 생성'}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {step === 'UPLOAD' && '명함 사진이나 이메일 캡처 이미지를 업로드하세요.'}
                {step === 'ANALYZING' && 'AI가 명함/이메일 서명에서 담당자 정보를 추출 중입니다...'}
                {step === 'RESULT' && (matchedCustomer 
                  ? `[${matchedCustomer.name}] 소속으로 담당자를 등록합니다.` 
                  : '등록되지 않은 고객사입니다. 고객사와 담당자를 함께 생성합니다.')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving || step === 'ANALYZING'}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          
          {step === 'UPLOAD' && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[260px] ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/70'
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
                  <Upload size={24} />
                </div>
                <p className="text-base font-medium text-white mb-1">
                  명함 이미지 또는 이메일 캡처 선택
                </p>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  드래그 앤 드롭으로 간편하게 업로드하세요.
                </p>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors">
                    파일 선택
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                    className="sm:hidden px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
                  >
                    📷 촬영
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                />
              </div>

              {targetCustomerId && matchedCustomer && (
                <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-lg text-xs flex items-center justify-between">
                  <span className="text-slate-400">등록 대상 고객사:</span>
                  <span className="font-semibold text-amber-300">{matchedCustomer.name}</span>
                </div>
              )}
            </div>
          )}

          {step === 'ANALYZING' && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 animate-spin">
                <RefreshCw size={24} />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">AI 정보 추출 중</p>
                <p className="text-xs text-slate-400">명함 및 서명에서 이름, 연락처, 직급을 식별하고 있습니다.</p>
              </div>
            </div>
          )}

          {step === 'RESULT' && analysisResult && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText size={15} className="text-indigo-400 shrink-0" />
                  <span className="text-slate-300 truncate font-medium">{selectedFile?.name}</span>
                </div>
                <button
                  onClick={() => setStep('UPLOAD')}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
                >
                  재업로드
                </button>
              </div>

              <div className="space-y-3.5">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-300 font-medium">소속 고객사 (상호명) *</label>
                    {matchedCustomer ? (
                      <div className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs text-white opacity-80 cursor-not-allowed">
                        {matchedCustomer.name} (기존 등록됨)
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={newForm.companyName}
                        onChange={(e) => setNewForm({ ...newForm, companyName: e.target.value })}
                        placeholder="새로 생성될 고객사명"
                        className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-300 font-medium">담당자 성명 *</label>
                    <input
                      type="text"
                      value={newForm.name}
                      onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                      className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-300 font-medium">직급/직책</label>
                    <input
                      type="text"
                      value={newForm.position}
                      onChange={(e) => setNewForm({ ...newForm, position: e.target.value })}
                      className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-300 font-medium">연락처</label>
                    <input
                      type="text"
                      value={newForm.contact}
                      onChange={(e) => setNewForm({ ...newForm, contact: e.target.value })}
                      className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-300 font-medium">이메일</label>
                    <input
                      type="email"
                      value={newForm.email}
                      onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                      className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {step === 'RESULT' && (
          <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-2 shrink-0">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> 저장 중...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> 최종 등록
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
