// src/services/visionOcrService.ts
// 법인차량 계기판 및 주유영수증 Vision AI 자동인식 클라이언트 서비스

export interface OdometerAnalysisResult {
  success: boolean;
  mileage?: number;
  confidence?: number;
  rawText?: string;
  error?: string;
}

export interface FuelReceiptAnalysisResult {
  success: boolean;
  fuelDate?: string;
  gasStationName?: string;
  fuelType?: '경유' | '휘발유' | 'LPG' | '전기';
  fuelVolume?: number;
  fuelAmount?: number;
  unitPrice?: number;
  paymentMethod?: 'CORPORATE_CARD' | 'PERSONAL_EXPENSE';
  cardLast4?: string;
  confidence?: number;
  error?: string;
}

/**
 * 1. 자동차 계기판 사진 분석
 */
export async function analyzeOdometerPhoto(
  imageBase64: string,
  vehicleContext?: { vehicleNo?: string; modelName?: string; currentMileage?: number }
): Promise<OdometerAnalysisResult> {
  try {
    const res = await fetch('/api/vision-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'ODOMETER',
        imageBase64,
        vehicleContext
      })
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      return { success: false, error: json.error || '인식 실패' };
    }

    const data = json.data;
    const mileageNum = typeof data.mileage === 'number' ? data.mileage : parseInt(String(data.mileage).replace(/[^0-9]/g, ''), 10);

    if (isNaN(mileageNum) || mileageNum <= 0) {
      return { success: false, error: '유효한 주행거리를 인식하지 못했습니다.' };
    }

    return {
      success: true,
      mileage: mileageNum,
      confidence: data.confidence || 0.9,
      rawText: data.rawText
    };
  } catch (err: any) {
    console.warn('[VisionOcrService] analyzeOdometerPhoto exception:', err);
    return { success: false, error: err?.message || '네트워크 오류' };
  }
}

/**
 * 2. 주유 영수증 사진 분석
 */
export async function analyzeFuelReceiptPhoto(
  imageBase64: string,
  vehicleContext?: { vehicleNo?: string; fuelType?: string }
): Promise<FuelReceiptAnalysisResult> {
  try {
    const res = await fetch('/api/vision-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'FUEL_RECEIPT',
        imageBase64,
        vehicleContext
      })
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      return { success: false, error: json.error || '영수증 인식 실패' };
    }

    const data = json.data;

    // 숫자 데이터 정제
    const fuelVolume = typeof data.fuelVolume === 'number'
      ? data.fuelVolume
      : parseFloat(String(data.fuelVolume || '').replace(/[^0-9.]/g, '')) || undefined;

    const fuelAmount = typeof data.fuelAmount === 'number'
      ? data.fuelAmount
      : parseInt(String(data.fuelAmount || '').replace(/[^0-9]/g, ''), 10) || undefined;

    const unitPrice = typeof data.unitPrice === 'number'
      ? data.unitPrice
      : parseInt(String(data.unitPrice || '').replace(/[^0-9]/g, ''), 10) || undefined;

    return {
      success: true,
      fuelDate: data.fuelDate || undefined,
      gasStationName: data.gasStationName || undefined,
      fuelType: data.fuelType || undefined,
      fuelVolume,
      fuelAmount,
      unitPrice,
      paymentMethod: data.paymentMethod === 'PERSONAL_EXPENSE' ? 'PERSONAL_EXPENSE' : 'CORPORATE_CARD',
      cardLast4: data.cardLast4 || undefined,
      confidence: data.confidence || 0.9
    };
  } catch (err: any) {
    console.warn('[VisionOcrService] analyzeFuelReceiptPhoto exception:', err);
    return { success: false, error: err?.message || '네트워크 오류' };
  }
}

// ─── 3. 사업자등록증 Vision AI & 하이브리드 전자문서 분석 ───

export interface BusinessLicenseAnalysisResult {
  success: boolean;
  bizRegNo?: string;           // 사업자등록번호 (10자리, 000-00-00000)
  companyName?: string;         // 상호 또는 법인명
  representative?: string;      // 대표자 성명
  openingDate?: string;         // 개업연월일(일자)
  address?: string;             // 사업장 소재지
  headOfficeAddress?: string;   // 본점 소재지
  bizType?: string;             // 업태
  bizItem?: string;             // 종목
  taxEmail?: string;            // 전자세금계산서 전용 이메일
  repContact?: string;          // 대표 전화번호
  taxOffice?: string;           // 관할 세무서
  isCorporate?: boolean;        // 법인 여부
  confidence?: number;
  rawText?: string;
  sourceType?: 'DIGITAL_PDF' | 'VISION_IMAGE' | 'HYBRID';
  error?: string;
}

/**
 * 사업자등록번호 포맷 정규화 ("000-00-00000")
 */
export function formatBizRegNo(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  return raw.trim();
}

/**
 * 고해상도 모바일 사진 및 스캔본을 최적 Base64 이미지로 리사이징 변환
 */
export async function processImageFile(file: File, maxDim: number = 1800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('이미지 렌더링에 실패했습니다.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * PDF 파일을 래스터 이미지 및 텍스트 힌트로 동시 추출 (하이브리드 엔진)
 */
async function processPdfFile(file: File): Promise<{ base64Image: string; textHint: string }> {
  const pdfjsLib = await import('pdfjs-dist');
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
    cMapPacked: true
  });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(1);

  // 1. 디지털 텍스트 추출 (국세청 홈택스 전자발급본 힌트용)
  let textHint = '';
  try {
    const textContent = await page.getTextContent();
    textHint = (textContent.items as any[]).map(item => item.str).join(' ');
  } catch (err) {
    console.warn('[VisionOcrService] PDF textContent extraction warning:', err);
  }

  // 2. 1페이지를 고해상도 Canvas로 래스터 렌더링
  const viewport = page.getViewport({ scale: 1.8 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context 생성을 실패했습니다.');
  }

  await page.render({ canvasContext: ctx, viewport }).promise;
  const base64Image = canvas.toDataURL('image/jpeg', 0.88);

  return { base64Image, textHint };
}

/**
 * 3. 사업자등록증 (이미지 또는 PDF) Vision AI 자동 인식
 */
export async function analyzeBusinessLicense(file: File): Promise<BusinessLicenseAnalysisResult> {
  try {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    let imageBase64 = '';
    let textHint = '';
    let sourceType: BusinessLicenseAnalysisResult['sourceType'] = 'VISION_IMAGE';

    if (isPdf) {
      const pdfProcessed = await processPdfFile(file);
      imageBase64 = pdfProcessed.base64Image;
      textHint = pdfProcessed.textHint;
      sourceType = textHint.length > 30 ? 'HYBRID' : 'VISION_IMAGE';
    } else {
      imageBase64 = await processImageFile(file, 1800);
      sourceType = 'VISION_IMAGE';
    }

    const res = await fetch('/api/vision-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'BUSINESS_LICENSE',
        imageBase64,
        textHint: textHint || undefined
      })
    });

    if (!res.ok) {
      return { success: false, error: `서버 통신 오류 (HTTP ${res.status})` };
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      return { success: false, error: json.error || '사업자등록증 분석에 실패했습니다.' };
    }

    const data = json.data;
    const cleanBizNo = formatBizRegNo(data.bizRegNo || '');

    return {
      success: true,
      bizRegNo: cleanBizNo || undefined,
      companyName: data.companyName ? String(data.companyName).trim() : undefined,
      representative: data.representative ? String(data.representative).trim() : undefined,
      openingDate: data.openingDate ? String(data.openingDate).trim() : undefined,
      address: data.address ? String(data.address).trim() : undefined,
      headOfficeAddress: data.headOfficeAddress ? String(data.headOfficeAddress).trim() : undefined,
      bizType: data.bizType ? String(data.bizType).trim() : undefined,
      bizItem: data.bizItem ? String(data.bizItem).trim() : undefined,
      taxEmail: data.taxEmail ? String(data.taxEmail).trim() : undefined,
      repContact: data.repContact ? String(data.repContact).trim() : undefined,
      taxOffice: data.taxOffice ? String(data.taxOffice).trim() : undefined,
      isCorporate: typeof data.isCorporate === 'boolean' ? data.isCorporate : undefined,
      confidence: data.confidence || 0.95,
      sourceType
    };
  } catch (err: any) {
    console.error('[VisionOcrService] analyzeBusinessLicense exception:', err);
    return { success: false, error: err?.message || '사업자등록증 처리 중 오류가 발생했습니다.' };
  }
}

// ─── 4. 명함 및 이메일 서명 Vision AI 자동 분석 ───

export interface ContactCardAnalysisResult {
  success: boolean;
  companyName?: string;
  name?: string;
  position?: string;
  contact?: string;
  email?: string;
  confidence?: number;
  error?: string;
}

/**
 * 4. 명함 및 이메일 서명 이미지 Vision AI 자동 인식
 */
export async function analyzeContactCard(file: File): Promise<ContactCardAnalysisResult> {
  try {
    const imageBase64 = await processImageFile(file, 1800);
    
    const res = await fetch('/api/vision-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'CONTACT_CARD',
        imageBase64
      })
    });

    if (!res.ok) {
      return { success: false, error: `서버 통신 오류 (HTTP ${res.status})` };
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      return { success: false, error: json.error || '명함/서명 분석에 실패했습니다.' };
    }

    const data = json.data;
    
    return {
      success: true,
      companyName: data.companyName ? String(data.companyName).trim() : undefined,
      name: data.name ? String(data.name).trim() : undefined,
      position: data.position ? String(data.position).trim() : undefined,
      contact: data.contact ? String(data.contact).trim() : undefined,
      email: data.email ? String(data.email).trim() : undefined,
      confidence: data.confidence || 0.95
    };
  } catch (err: any) {
    console.error('[VisionOcrService] analyzeContactCard exception:', err);
    return { success: false, error: err?.message || '명함/서명 이미지 처리 중 오류가 발생했습니다.' };
  }
}


// ─── 5. 고소작업대/렌탈장비 자산번호(관리번호) 및 제조번호 실시간 카메라 OCR 분석 ───

export interface AssetNumberOcrResult {
  success: boolean;
  assetNo?: string;
  matchedCandidate?: string;
  serialNo?: string;
  modelName?: string;
  rawTokens?: string[];
  rawText?: string;
  confidence?: number;
  elapsedMs?: number;
  error?: string;
}

/**
 * 실시간 카메라 프레임(Base64) 또는 촬영된 파일에서 자산번호(관리번호) / 제조번호 판독
 */
export async function analyzeAssetNumberFrame(
  imageInput: string | File,
  assetContext?: { expectedModels?: string[]; candidateAssetNos?: string[] }
): Promise<AssetNumberOcrResult> {
  try {
    const imageBase64 = typeof imageInput === 'string'
      ? imageInput
      : await processImageFile(imageInput, 1280);

    const res = await fetch('/api/vision-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'ASSET_NO',
        imageBase64,
        assetContext
      })
    });

    if (!res.ok) {
      return { success: false, error: `서버 통신 오류 (HTTP ${res.status})` };
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      return { success: false, error: json.error || '자산번호 인식에 실패했습니다.' };
    }

    const data = json.data;
    const assetNo = data.assetNo ? String(data.assetNo).trim() : undefined;
    const matchedCandidate = data.matchedCandidate ? String(data.matchedCandidate).trim() : undefined;
    const serialNo = data.serialNo ? String(data.serialNo).trim() : undefined;
    const modelName = data.modelName ? String(data.modelName).trim() : undefined;
    const rawTokens = Array.isArray(data.rawTokens)
      ? data.rawTokens.map((t: any) => String(t || '').trim()).filter(Boolean)
      : [];
    const rawText = data.rawText ? String(data.rawText).trim() : (assetNo || serialNo || rawTokens.join(' '));

    return {
      success: Boolean(assetNo || matchedCandidate || serialNo || rawTokens.length > 0),
      assetNo,
      matchedCandidate,
      serialNo,
      modelName,
      rawTokens,
      rawText,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.9,
      elapsedMs: json.elapsedMs
    };
  } catch (err: any) {
    console.warn('[VisionOcrService] analyzeAssetNumberFrame exception:', err);
    return { success: false, error: err?.message || '카메라 프레임 판독 중 오류가 발생했습니다.' };
  }
}

/**
 * OCR 인식 결과와 가용 장비 풀(availableAssets)을 대조하여 일치/유사 장비 후보를 순위별로 반환
 */
export function matchRecognizedAssetFromPool<T extends { id: string; assetNo?: string; serialNo?: string; modelName?: string }>(
  ocr: AssetNumberOcrResult,
  pool: T[],
  alreadySelectedIds: string[] = []
): { exactMatch: T | null; candidates: T[]; recognizedLabel: string } {
  const cleanToken = (s?: string | null) => String(s || '').trim().toUpperCase().replace(/[\s_]/g, '');
  const digitsOnly = (s?: string | null) => String(s || '').replace(/[^0-9]/g, '');

  const primaryTokens = [
    ocr.matchedCandidate,
    ocr.assetNo,
    ocr.serialNo,
    ...(ocr.rawTokens || [])
  ]
    .map(t => String(t || '').trim())
    .filter(t => t.length >= 2);

  const recognizedLabel = ocr.matchedCandidate || ocr.assetNo || ocr.serialNo || primaryTokens[0] || '';
  if (primaryTokens.length === 0 || pool.length === 0) {
    return { exactMatch: null, candidates: [], recognizedLabel };
  }

  const unselectedPool = pool.filter(a => !alreadySelectedIds.includes(a.id));
  const searchPool = unselectedPool.length > 0 ? unselectedPool : pool;

  const scored: { asset: T; score: number }[] = [];

  for (const asset of searchPool) {
    const aNo = cleanToken(asset.assetNo);
    const aNoNoHyphen = aNo.replace(/-/g, '');
    const aDigits = digitsOnly(asset.assetNo);
    const sNo = cleanToken(asset.serialNo);
    const sNoNoHyphen = sNo.replace(/-/g, '');

    let bestScore = 0;

    for (let tokenIdx = 0; tokenIdx < primaryTokens.length; tokenIdx++) {
      const rawTok = primaryTokens[tokenIdx];
      const tok = cleanToken(rawTok);
      const tokNoHyphen = tok.replace(/-/g, '');
      const tokDigits = digitsOnly(rawTok);
      if (!tok) continue;

      // 중앙 조준선(0번 인덱스)에 가까운 토큰일수록 우선순위 가산점(0~0.9점) 부여
      const centerLinePriorityBonus = Math.max(0, (10 - tokenIdx) * 0.09);

      // 1순위: 완전 일치 (100점 + 중앙선 우선순위)
      if ((aNo && (aNo === tok || aNoNoHyphen === tokNoHyphen)) || (sNo && (sNo === tok || sNoNoHyphen === tokNoHyphen))) {
        bestScore = Math.max(bestScore, 100 + centerLinePriorityBonus);
        continue;
      }

      // 2순위: 접미사 일치 (예: K-3219-05 vs 3219-05 또는 19-05) (88점)
      if (tokNoHyphen.length >= 3 && aNoNoHyphen.endsWith(tokNoHyphen)) {
        bestScore = Math.max(bestScore, 88 + centerLinePriorityBonus);
        continue;
      }

      // 3순위: 숫자열 완전 일치 (예: 321905 vs SJ-3219-05) (82점)
      if (tokDigits.length >= 3 && aDigits && aDigits === tokDigits) {
        bestScore = Math.max(bestScore, 82 + centerLinePriorityBonus);
        continue;
      }

      // 4순위: 숫자열 접미사 일치 (예: 끝 2~4자리 번호가 고유하게 일치) (70점)
      if (tokDigits.length >= 2 && aDigits && aDigits.endsWith(tokDigits)) {
        bestScore = Math.max(bestScore, 70 + centerLinePriorityBonus);
        continue;
      }

      // 5순위: 부분 포함 (60점)
      if (tokNoHyphen.length >= 3 && (aNoNoHyphen.includes(tokNoHyphen) || (sNoNoHyphen && sNoNoHyphen.includes(tokNoHyphen)))) {
        bestScore = Math.max(bestScore, 60 + centerLinePriorityBonus);
      }
    }

    if (bestScore > 0) {
      scored.push({ asset, score: bestScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.map(s => s.asset);

  // 최상위 후보가 82점 이상이거나, 70점 이상이면서 유일한 매칭인 경우 exactMatch로 판정
  let exactMatch: T | null = null;
  if (scored.length > 0) {
    const top = scored[0];
    const second = scored[1];
    if (top.score >= 88) {
      exactMatch = top.asset;
    } else if (top.score >= 70 && (!second || top.score > second.score)) {
      exactMatch = top.asset;
    }
  }

  return {
    exactMatch,
    candidates: candidates.slice(0, 6),
    recognizedLabel
  };
}
