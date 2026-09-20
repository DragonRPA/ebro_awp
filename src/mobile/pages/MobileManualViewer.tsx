// src/mobile/pages/MobileManualViewer.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BookOpen,
  Search,
  FileText,
  Download,
  Eye,
  X,
  ChevronLeft,
  Filter,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Cpu,
  Wrench,
  Tag,
  Play,
  Globe,
  ExternalLink
} from 'lucide-react';
import { EquipmentManual } from '../../services/db';

const Youtube: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

interface MobileManualViewerProps {
  onBack?: () => void;
  initialModelName?: string;
}

// 현장 다발 고장 증상 및 에러코드 퀵 필터 칩 목록
const QUICK_SYMPTOM_CHIPS = [
  { label: '02번 에러', term: '02' },
  { label: '18번 틸트', term: '18' },
  { label: '상승 불가', term: '상승불가' },
  { label: '주행 불가', term: '주행' },
  { label: '솔레노이드', term: '솔레노이드' },
  { label: '충전기 점멸', term: '충전기' },
  { label: '조이스틱', term: '조이스틱' },
  { label: '비상하강', term: '비상하강' }
];

export const MobileManualViewer: React.FC<MobileManualViewerProps> = ({
  onBack,
  initialModelName
}) => {
  const { equipmentManuals, products } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(initialModelName || '전체');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [selectedMediaType, setSelectedMediaType] = useState<'전체' | 'PDF' | 'YOUTUBE' | 'WEB_LINK'>('전체');
  const [previewManual, setPreviewManual] = useState<EquipmentManual | null>(null);

  // 모델 고유 목록
  const modelOptions = useMemo(() => {
    const set = new Set<string>();
    (equipmentManuals || []).forEach(m => {
      if (m.modelName) set.add(m.modelName);
    });
    (products || []).forEach(p => {
      if (p.modelName) set.add(p.modelName);
    });
    return Array.from(set).sort();
  }, [equipmentManuals, products]);

  // 매뉴얼 다차원 AI 메타데이터 필터링
  const filteredManuals = useMemo(() => {
    return (equipmentManuals || []).filter(m => {
      const matchModel = selectedModel === '전체' || m.modelName === selectedModel;
      const matchCat = selectedCategory === '전체' || m.category === selectedCategory;
      const matchMedia =
        selectedMediaType === '전체' ||
        (selectedMediaType === 'PDF' && (!m.mediaType || m.mediaType === 'PDF')) ||
        m.mediaType === selectedMediaType;

      if (!matchModel || !matchCat || !matchMedia) return false;
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();

      // 1. 기본 텍스트 필드 검사
      const basicMatch = 
        m.title.toLowerCase().includes(term) ||
        m.modelName.toLowerCase().includes(term) ||
        m.manufacturer.toLowerCase().includes(term) ||
        (m.memo && m.memo.toLowerCase().includes(term)) ||
        (m.version && m.version.toLowerCase().includes(term));

      if (basicMatch) return true;

      // 2. AI 추출 에러코드 인덱스 검사
      const matchErrorCode = (m.errorCodes || []).some(
        ec => ec.toLowerCase() === term || ec.toLowerCase().includes(term) || term.includes(ec.toLowerCase())
      );
      if (matchErrorCode) return true;

      // 3. AI 추출 증상(symptoms) 검사
      const matchSymptoms = (m.symptoms || []).some(s => s.toLowerCase().includes(term));
      if (matchSymptoms) return true;

      // 4. AI 추출 주요 부품(majorParts) 검사
      const matchParts = (m.majorParts || []).some(p => p.toLowerCase().includes(term));
      if (matchParts) return true;

      // 5. AI 추출 키워드(keywords) 및 AI 요약문 검사
      const matchKeywords = (m.keywords || []).some(kw => kw.toLowerCase().includes(term));
      const matchSummary = m.aiSummary ? m.aiSummary.toLowerCase().includes(term) : false;

      return matchKeywords || matchSummary;
    });
  }, [equipmentManuals, selectedModel, selectedCategory, searchTerm]);

  const getCategoryBadgeClass = (category: EquipmentManual['category']) => {
    switch (category) {
      case 'PARTS_BOOK':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'ERROR_CODE':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'WIRING_DIAGRAM':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'OPERATOR_MANUAL':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getCategoryLabel = (category: EquipmentManual['category']) => {
    switch (category) {
      case 'PARTS_BOOK':
        return '부품 파츠북';
      case 'ERROR_CODE':
        return '에러코드 진단표';
      case 'WIRING_DIAGRAM':
        return '전기/유압 회로도';
      case 'OPERATOR_MANUAL':
        return '취급 운전 설명서';
      default:
        return category;
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-24 p-3 font-sans text-slate-100 max-w-full">
      {/* 상단 네비게이션 헤더 */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">장비 매뉴얼 라이브러리</h2>
              <p className="text-[11px] text-slate-400">현장 출고·AS 전용 파츠북 & 에러코드표</p>
            </div>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
          {filteredManuals.length}건
        </span>
      </div>

      {/* 검색창 */}
      <div className="relative w-full">
        <input
          type="text"
          placeholder="모델명, 고장증상(상승불가 등), 에러코드(02 등), 부품명 검색..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full py-2.5 pl-9 pr-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ⚡ 현장 다발 증상/에러 원터치 핫 키워드 칩 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 whitespace-nowrap pl-0.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>빠른 증상:</span>
        </span>
        {QUICK_SYMPTOM_CHIPS.map(chip => {
          const isActive = searchTerm.toLowerCase().includes(chip.term.toLowerCase());
          return (
            <button
              key={chip.term}
              type="button"
              onClick={() => setSearchTerm(isActive ? '' : chip.term)}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* 모델 퀵 필터 (가로 스크롤 칩) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedModel('전체')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedModel === '전체'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400'
          }`}
        >
          전체 모델
        </button>
        {modelOptions.map(model => (
          <button
            key={model}
            type="button"
            onClick={() => setSelectedModel(model)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedModel === model
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400'
            }`}
          >
            {model}
          </button>
        ))}
      </div>

      {/* 미디어 포맷 및 문서 유형 칩 필터 */}
      <div className="flex flex-col gap-1.5">
        {/* 미디어 포맷 칩 */}
        <div className="grid grid-cols-4 gap-1">
          {[
            { key: '전체', label: '전체' },
            { key: 'PDF', label: '📄 PDF' },
            { key: 'YOUTUBE', label: '🎬 정비영상' },
            { key: 'WEB_LINK', label: '🌐 웹문서' }
          ].map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedMediaType(item.key as any)}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-bold text-center transition-all ${
                selectedMediaType === item.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900/80 border border-slate-800 text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 문서 분류 칩 필터 */}
        <div className="grid grid-cols-5 gap-1">
          {[
            { key: '전체', label: '전체' },
            { key: 'PARTS_BOOK', label: '파츠북' },
            { key: 'ERROR_CODE', label: '에러코드' },
            { key: 'WIRING_DIAGRAM', label: '회로도' },
            { key: 'OPERATOR_MANUAL', label: '취급서' }
          ].map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedCategory(item.key)}
              className={`py-1.5 px-1 rounded-lg text-[10.5px] font-bold text-center transition-all ${
                selectedCategory === item.key
                  ? 'bg-slate-200 text-slate-900 shadow-sm'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 매뉴얼 카드 리스트 */}
      <div className="flex flex-col gap-2.5 mt-1">
        {filteredManuals.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <div className="text-xs text-slate-400 font-bold">조건에 맞는 지식 자료가 없습니다.</div>
            <div className="text-[11px] text-slate-500 mt-1">검색어를 변경하거나 PC에서 신규 자료를 등록해 주세요.</div>
          </div>
        ) : (
          filteredManuals.map(manual => (
            <div
              key={manual.id}
              className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex flex-col gap-2.5 hover:border-slate-700 transition-all"
            >
              {/* 상단 배지 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* 미디어 유형 배지 */}
                  {manual.mediaType === 'YOUTUBE' ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                      <Youtube className="w-3 h-3" />
                      <span>유튜브 영상</span>
                    </span>
                  ) : manual.mediaType === 'WEB_LINK' ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      <span>웹 문서</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>PDF 문서</span>
                    </span>
                  )}

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getCategoryBadgeClass(
                      manual.category
                    )}`}
                  >
                    {getCategoryLabel(manual.category)}
                  </span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
                    {manual.modelName}
                  </span>
                  {manual.aiProcessed && (
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>AI 색인완료</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-500">{manual.version}</span>
              </div>

              {/* 유튜브 영상일 경우 실무 썸네일 박스 */}
              {manual.mediaType === 'YOUTUBE' && manual.youtubeVideoId && (
                <div
                  className="relative w-full h-36 rounded-xl overflow-hidden bg-black cursor-pointer shadow-inner mt-0.5"
                  onClick={() => setPreviewManual(manual)}
                >
                  <img
                    src={`https://img.youtube.com/vi/${manual.youtubeVideoId}/hqdefault.jpg`}
                    alt={manual.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/50">
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </div>
                  </div>
                  {manual.fileSizeLabel && (
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono font-bold">
                      {manual.fileSizeLabel}
                    </span>
                  )}
                </div>
              )}

              {/* 매뉴얼 제목 */}
              <div>
                <h3 className="text-xs font-black text-white leading-snug line-clamp-2">
                  {manual.title}
                </h3>
                <div className="flex items-center gap-2 text-[10.5px] text-slate-400 mt-1">
                  <span>제조사: <strong className="text-slate-300">{manual.manufacturer}</strong></span>
                  {manual.targetSpecFt && <span>• 규격: <strong className="text-slate-300">{manual.targetSpecFt}ft</strong></span>}
                  <span>• 분량/크기: <strong className="text-slate-300">{manual.fileSizeLabel || '0 KB'}</strong></span>
                </div>
              </div>

              {/* ⚡ AI 2줄 트러블슈팅 요약 콜아웃 */}
              {manual.aiSummary && (
                <div className="text-[11px] text-sky-200/90 bg-sky-950/40 p-2.5 rounded-xl border border-sky-800/40 leading-relaxed flex gap-1.5 items-start">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold text-sky-400 mr-1">[AI 수록 요약]</span>
                    <span>{manual.aiSummary}</span>
                  </div>
                </div>
              )}

              {/* 🏷️ AI 다차원 색인 태그 (에러코드, 고장증상, 주요부품, 키워드) */}
              {(manual.errorCodes?.length || manual.symptoms?.length || manual.majorParts?.length || manual.keywords?.length) ? (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800/40">
                  {/* 에러코드 칩 */}
                  {(manual.errorCodes || []).map(ec => (
                    <span
                      key={ec}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                        searchTerm && ec.toLowerCase().includes(searchTerm.toLowerCase())
                          ? 'bg-rose-500 text-white border-rose-400'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      🔴 코드: {ec}
                    </span>
                  ))}

                  {/* 증상 칩 */}
                  {(manual.symptoms || []).slice(0, 3).map(sym => (
                    <span
                      key={sym}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                        searchTerm && sym.toLowerCase().includes(searchTerm.toLowerCase())
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      ⚠️ {sym}
                    </span>
                  ))}

                  {/* 주요 부품 칩 */}
                  {(manual.majorParts || []).slice(0, 2).map(part => (
                    <span
                      key={part}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                        searchTerm && part.toLowerCase().includes(searchTerm.toLowerCase())
                          ? 'bg-blue-500 text-white border-blue-400'
                          : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                      }`}
                    >
                      🔧 {part}
                    </span>
                  ))}

                  {/* 키워드 태그 */}
                  {(manual.keywords || []).slice(0, 3).map(kw => (
                    <span
                      key={kw}
                      className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* 기본 비고 및 요약 가이드 (aiSummary 없을 시 표시) */}
              {!manual.aiSummary && manual.memo && (
                <div className="text-[11px] text-slate-400 bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 leading-relaxed">
                  💡 {manual.memo}
                </div>
              )}

              {/* 하단 액션 버튼 바 */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                {manual.mediaType === 'YOUTUBE' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewManual(manual)}
                      className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/20 active:scale-98 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>영상 즉시 재생</span>
                    </button>
                    <a
                      href={manual.externalUrl || manual.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 active:scale-98 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>YouTube</span>
                    </a>
                  </>
                ) : manual.mediaType === 'WEB_LINK' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewManual(manual)}
                      className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 active:scale-98 transition-all"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>웹문서 열람</span>
                    </button>
                    <a
                      href={manual.externalUrl || manual.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 active:scale-98 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>새창</span>
                    </a>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewManual(manual)}
                      className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20 active:scale-98 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>즉시 열람</span>
                    </button>
                    <a
                      href={manual.fileUrl}
                      download={manual.fileName}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 active:scale-98 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>저장</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── 인앱 전체화면 PDF/문서/유튜브 뷰어 모달 ─── */}
      {previewManual && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          {/* 뷰어 상단 바 */}
          <div className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getCategoryBadgeClass(
                  previewManual.category
                )}`}
              >
                {previewManual.modelName}
              </span>
              <span className="text-xs font-bold text-white truncate">{previewManual.title}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {previewManual.mediaType === 'YOUTUBE' ? (
                <a
                  href={previewManual.externalUrl || previewManual.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>YouTube</span>
                </a>
              ) : previewManual.mediaType === 'WEB_LINK' ? (
                <a
                  href={previewManual.externalUrl || previewManual.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>새창열기</span>
                </a>
              ) : (
                <a
                  href={previewManual.fileUrl}
                  download={previewManual.fileName}
                  className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:text-white"
                  title="다운로드"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}

              <button
                type="button"
                onClick={() => setPreviewManual(null)}
                className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 뷰어 본문 */}
          <div className="flex-1 bg-black overflow-hidden relative">
            {previewManual.mediaType === 'YOUTUBE' && previewManual.youtubeVideoId ? (
              /* 유튜브 모바일 반응형 임베드 플레이어 */
              <div className="w-full h-full flex flex-col items-center justify-center">
                <iframe
                  src={`https://www.youtube.com/embed/${previewManual.youtubeVideoId}?autoplay=1&rel=0`}
                  title={previewManual.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full max-h-[85vh] border-none"
                />
              </div>
            ) : previewManual.mediaType === 'WEB_LINK' ? (
              /* 웹 기술문서 안내 카드 */
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-200 bg-slate-950">
                <Globe className="w-14 h-14 text-indigo-400 mb-3" />
                <div className="text-sm font-bold text-white">{previewManual.title}</div>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                  {previewManual.memo || '제조사 공식 웹 기술문서 포털 페이지입니다.'}
                </p>
                <a
                  href={previewManual.externalUrl || previewManual.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                >
                  <ExternalLink className="w-4 h-4" /> 새 창에서 공식 웹사이트 열기
                </a>
              </div>
            ) : previewManual.fileUrl.startsWith('data:application/pdf') || previewManual.fileName.endsWith('.pdf') ? (
              <iframe
                src={previewManual.fileUrl}
                title={previewManual.title}
                className="w-full h-full border-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-200">
                <FileText className="w-14 h-14 text-blue-400 mb-3" />
                <div className="text-sm font-bold">{previewManual.title}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {previewManual.fileName} ({previewManual.fileSizeLabel || '0 KB'})
                </div>
                <p className="text-xs text-slate-500 mt-3 max-w-xs">
                  {previewManual.memo || '모바일 브라우저 내장 뷰어가 지원되지 않는 형식입니다. 다운로드하여 확인하세요.'}
                </p>
                <a
                  href={previewManual.fileUrl}
                  download={previewManual.fileName}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/30"
                >
                  <Download className="w-4 h-4" /> 파일 다운로드
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

