import { db, SEED_TENANTS } from '../services/db';

export function generateReceiptHtml(
  delivery: any,
  contract: any,
  customer: any,
  site: any,
  tenant: any,
  options?: { signatureUrl?: string }
): string {
  const defaultSupplier = SEED_TENANTS[0];
  const effectiveTenant = tenant || db?.currentTenant || defaultSupplier;

  const sCorpName = effectiveTenant?.tradeName || 
                    effectiveTenant?.corporateName || 
                    effectiveTenant?.displayName || 
                    defaultSupplier.tradeName;

  const sRep = effectiveTenant?.representativeName || 
               effectiveTenant?.representative || 
               defaultSupplier.representativeName;

  const sBizNo = effectiveTenant?.businessNumber || 
                 effectiveTenant?.bizRegNo || 
                 defaultSupplier.businessNumber;

  const sAddr = effectiveTenant?.headOfficeAddress || 
                effectiveTenant?.businessAddress || 
                effectiveTenant?.address || 
                defaultSupplier.headOfficeAddress;

  const sTel = effectiveTenant?.tel || 
               effectiveTenant?.phone || 
               defaultSupplier.tel;

  const sFax = effectiveTenant?.fax || 
               defaultSupplier.fax;

  const sWebsite = effectiveTenant?.websiteUrl || 
                   defaultSupplier.websiteUrl || '';

  const contractNo = contract?.contractNo || contract?.id || delivery?.contractId || '-';
  const customerName = customer?.name || (delivery as any)?.customerName || '미확인';
  const siteName = site?.name || (delivery as any)?.siteName || '미확인';
  const siteAddress = site?.address || delivery?.destinationAddress || '-';

  let receiverName = site?.contactName || customer?.representative || '인수담당자';
  let receiverPhone = site?.contactPhone || customer?.phone || customer?.repContact || site?.safetyContactPhone || '-';
  let specialNotes = '';

  if (delivery?.memo) {
    const optMatch = delivery.memo.match(/\[옵션\]\s*([^|]+)/);
    if (optMatch) specialNotes = optMatch[1].trim();

    const contactMatch = delivery.memo.match(/현장담당:\s*([^\s(]+)(?:\s*\(([^)]+)\))?/);
    if (contactMatch) {
      if (contactMatch[1]) receiverName = contactMatch[1].trim();
      if (contactMatch[2]) receiverPhone = contactMatch[2].trim();
    }
  }

  const dType = delivery?.type === 'OUTBOUND' ? '출고 (OUTBOUND)' : delivery?.type === 'INBOUND' ? '회수 (INBOUND)' : delivery?.type === 'EXCHANGE' ? '교환 (EXCHANGE)' : '출고';
  const signDate = new Date().toISOString().split('T')[0];
  const dDate = delivery?.unloadingDate || delivery?.loadingDate || delivery?.requestDate || signDate;
  const dVehicle = delivery?.vehicleNumber || '화물 운송차량';
  const dDriver = delivery?.driverName ? `${delivery.driverName} (${delivery.driverContact || '-'})` : '지정 기사';

  let parsedCargos: any[] = [];
  if (delivery?.cargoItems) {
    try {
      const parsed = JSON.parse(delivery.cargoItems);
      if (Array.isArray(parsed)) {
        parsedCargos = parsed;
      } else {
        parsedCargos = [{ modelName: delivery.cargoItems, count: 1, note: '정상 납품' }];
      }
    } catch (e) {
      parsedCargos = [{ modelName: delivery.cargoItems, count: 1, note: '정상 납품' }];
    }
  }
  if (parsedCargos.length === 0) {
    parsedCargos = [{ modelName: '고소작업대 (장비 미지정)', count: 1, note: '정상 납품' }];
  }

  const minRows = 4;
  const displayRows: any[] = [...parsedCargos];
  while (displayRows.length < minRows) {
    displayRows.push(null);
  }

  const totalCount = parsedCargos.reduce((acc, c) => acc + (Number(c.count) || 1), 0);
  const itemCount = parsedCargos.length;

  let signatureUrl = options?.signatureUrl;
  if (!signatureUrl && delivery?.closingMemo) {
    const match = delivery.closingMemo.match(/\[(전자 서명|납품증 사진)\]:\s*(https?:\/\/[^\s\n\r]+)/);
    if (match) {
      signatureUrl = match[2];
    }
  }

  const signDateFormatted = signDate.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년  $2월  $3일');

  return `
    <style>
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
          background: #fff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .receipt-container {
          border: 2px solid #1e293b !important;
          box-shadow: none !important;
          margin: 0 auto !important;
          max-width: 100% !important;
          page-break-inside: avoid;
        }
      }
    </style>
    <div class="receipt-container" style="box-sizing: border-box; font-family: 'Malgun Gothic', Pretendard, 'Apple SD Gothic Neo', sans-serif; width: 100%; max-width: 760px; margin: 0 auto; color: #000; background-color: #fff; border: 2.5px solid #1e293b; padding: 4px;">
      <div style="border: 1px solid #94a3b8; padding: 18px 24px; box-sizing: border-box;">
        
        <!-- 1. Header Title -->
        <h1 style="text-align: center; font-size: 24px; font-weight: 800; color: #0f172a; margin: 10px 0 6px; letter-spacing: 4px;">
          납 &nbsp; 품 &nbsp; (인 &nbsp; 수) &nbsp; 확 &nbsp; 인 &nbsp; 서
        </h1>
        <div style="width: 360px; margin: 0 auto 12px auto;">
          <div style="height: 2px; background: #0f172a; margin-bottom: 2px;"></div>
          <div style="height: 1px; background: #64748b;"></div>
        </div>

        <!-- 2. Metadata Bar -->
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 8px;">
          <span>배차번호 : ${delivery?.id || '-'}</span>
          <span>계약번호 : ${contractNo}</span>
          <span>발행일자 : ${signDate}</span>
        </div>

        <!-- 3. Top Boxes: 공급자 vs 공급받는자 -->
        <div style="display: flex; gap: 10px; margin-bottom: 8px;">
          <!-- Left: 공급자 -->
          <div style="flex: 1; border: 1.5px solid #334155; box-sizing: border-box;">
            <div style="background: #f1f5f9; border-bottom: 1.5px solid #334155; padding: 5px; text-align: center; font-size: 12.5px; font-weight: 700; color: #0f172a;">
              공 &nbsp; &nbsp; 급 &nbsp; &nbsp; 자
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <tr style="border-bottom: 1px solid #cbd5e1; height: 24px;">
                <td style="width: 95px; background: #f8fafc; border-right: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #334155; padding: 2px 4px;">상호(법인명)</td>
                <td style="padding: 2px 8px; color: #0f172a; font-weight: 700;">${sCorpName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #cbd5e1; height: 24px;">
                <td style="background: #f8fafc; border-right: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #334155; padding: 2px 4px;">대표자 성명</td>
                <td style="padding: 2px 8px; color: #0f172a;">${sRep ? `${sRep} (직인생략)` : '(직인생략)'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #cbd5e1; height: 24px;">
                <td style="background: #f8fafc; border-right: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #334155; padding: 2px 4px;">사업자등록번호</td>
                <td style="padding: 2px 8px; color: #0f172a;">${sBizNo}</td>
              </tr>
              <tr style="border-bottom: 1px solid #cbd5e1; height: 24px;">
                <td style="background: #f8fafc; border-right: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #334155; padding: 2px 4px;">사업장 소재지</td>
                <td style="padding: 2px 8px; color: #0f172a; font-size: 10.5px;">${sAddr}</td>
              </tr>
              <tr style="height: 24px;">
                <td style="background: #f8fafc; border-right: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #334155; padding: 2px 4px;">대표전화/FAX</td>
                <td style="padding: 2px 8px; color: #0f172a;">${sFax && sFax !== '-' ? `${sTel} / ${sFax}` : sTel}</td>
              </tr>
            </table>
          </div>

          <!-- Right: 공급받는자 -->
          <div style="flex: 1; border: 1.5px solid #334155; box-sizing: border-box;">
            <div style="background: #f1f5f9; border-bottom: 1.5px solid #334155; padding: 5px; text-align: center; font-size: 12.5px; font-weight: 700; color: #0f172a;">
              공 &nbsp; 급 &nbsp; 받 &nbsp; 는 &nbsp; 자 &nbsp; (인 &nbsp; 수 &nbsp; 처)
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <tr style="border-bottom: 1px solid #cbd5e1; height: 24px;">
                <td style="width: 95px; background: #f8fafc; border-right: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #334155; padding: 2px 4px;">고객사 (상호)</td>
                <td style="padding: 2px 8px; color: #0f172a; font-weight: 700;">${customerName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #cbd5e1; height: 24px;">
                <td style="background: #f8fafc; border-right: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #334155; padding: 2px 4px;">현 &nbsp; &nbsp;장 &nbsp; &nbsp;명</td>
                <td style="padding: 2px 8px; color: #0f172a;">${siteName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #cbd5e1; height: 24px;">
                <td style="background: #f8fafc; border-right: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #334155; padding: 2px 4px;">하차지 주소</td>
                <td style="padding: 2px 8px; color: #0f172a; font-size: 10.5px;">${siteAddress}</td>
              </tr>
              <tr style="border-bottom: 1px solid #cbd5e1; height: 24px;">
                <td style="background: #f8fafc; border-right: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #334155; padding: 2px 4px;">인수 담당자</td>
                <td style="padding: 2px 8px; color: #0f172a; font-weight: 700;">${receiverName}</td>
              </tr>
              <tr style="height: 24px;">
                <td style="background: #f8fafc; border-right: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #334155; padding: 2px 4px;">인수자 연락처</td>
                <td style="padding: 2px 8px; color: #2563eb; font-weight: 700;">${receiverPhone}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- 4. Delivery Details Bar -->
        <div style="border: 1.5px solid #334155; display: flex; font-size: 11px; margin-bottom: 10px;">
          <div style="flex: 1; display: flex; border-right: 1px solid #cbd5e1;">
            <div style="width: 65px; background: #f8fafc; border-right: 1px solid #cbd5e1; font-weight: 700; color: #475569; text-align: center; padding: 5px 2px;">배차구분</div>
            <div style="flex: 1; padding: 5px 6px; text-align: center; font-weight: 700; color: #0f172a;">${dType}</div>
          </div>
          <div style="flex: 1; display: flex; border-right: 1px solid #cbd5e1;">
            <div style="width: 65px; background: #f8fafc; border-right: 1px solid #cbd5e1; font-weight: 700; color: #475569; text-align: center; padding: 5px 2px;">납품일자</div>
            <div style="flex: 1; padding: 5px 6px; text-align: center; color: #0f172a;">${dDate}</div>
          </div>
          <div style="flex: 1.2; display: flex; border-right: 1px solid #cbd5e1;">
            <div style="width: 65px; background: #f8fafc; border-right: 1px solid #cbd5e1; font-weight: 700; color: #475569; text-align: center; padding: 5px 2px;">운송차량</div>
            <div style="flex: 1; padding: 5px 6px; text-align: center; color: #0f172a;">${dVehicle}</div>
          </div>
          <div style="flex: 1.4; display: flex;">
            <div style="width: 65px; background: #f8fafc; border-right: 1px solid #cbd5e1; font-weight: 700; color: #475569; text-align: center; padding: 5px 2px;">운송기사</div>
            <div style="flex: 1; padding: 5px 6px; text-align: center; color: #0f172a;">${dDriver}</div>
          </div>
        </div>

        <!-- 5. Equipment List Table -->
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 8px 0 4px;">
          ■ 납품 장비 목록
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #334155; margin-bottom: 8px;">
          <thead>
            <tr style="background: #f1f5f9; height: 28px;">
              <th style="border: 1px solid #94a3b8; width: 45px; text-align: center; font-size: 11px; font-weight: 700; color: #1e293b;">No.</th>
              <th style="border: 1px solid #94a3b8; text-align: center; font-size: 11px; font-weight: 700; color: #1e293b;">품목 (장비 모델명)</th>
              <th style="border: 1px solid #94a3b8; width: 65px; text-align: center; font-size: 11px; font-weight: 700; color: #1e293b;">수량</th>
              <th style="border: 1px solid #94a3b8; width: 45px; text-align: center; font-size: 11px; font-weight: 700; color: #1e293b;">단위</th>
              <th style="border: 1px solid #94a3b8; width: 170px; text-align: center; font-size: 11px; font-weight: 700; color: #1e293b;">하차지 (현장명)</th>
              <th style="border: 1px solid #94a3b8; width: 110px; text-align: center; font-size: 11px; font-weight: 700; color: #1e293b;">비고</th>
            </tr>
          </thead>
          <tbody>
            ${displayRows.map((item, idx) => {
              if (item) {
                return `
                  <tr style="height: 28px;">
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-size: 11px; color: #0f172a;">${idx + 1}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px 8px; text-align: center; font-size: 11px; font-weight: 700; color: #0f172a;">${item.modelName || '고소작업대'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-size: 11px; font-weight: 700; color: #2563eb;">${item.count || 1}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-size: 11px; color: #0f172a;">대</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px 8px; text-align: center; font-size: 11px; color: #0f172a;">${siteName}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px 8px; text-align: center; font-size: 10.5px; color: #64748b;">${item.note || '정상 납품'}</td>
                  </tr>
                `;
              } else {
                return `
                  <tr style="height: 28px;">
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-size: 11px;">&nbsp;</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px 8px; text-align: center; font-size: 11px;">&nbsp;</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-size: 11px;">&nbsp;</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-size: 11px;">&nbsp;</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px 8px; text-align: center; font-size: 11px;">&nbsp;</td>
                    <td style="border: 1px solid #cbd5e1; padding: 4px 8px; text-align: center; font-size: 10.5px;">&nbsp;</td>
                  </tr>
                `;
              }
            }).join('')}
            <tr style="height: 28px; background: #f8fafc;">
              <td colspan="6" style="border: 1.5px solid #334155; padding: 5px 12px; text-align: center; font-size: 12px; font-weight: 700; color: #0f172a;">
                합 계 : &nbsp; 총 ${itemCount}개 품목 &nbsp; / &nbsp; ${totalCount}대
              </td>
            </tr>
          </tbody>
        </table>

        ${specialNotes ? `
          <div style="margin-bottom: 8px; padding: 5px 10px; background: #fffbeb; border: 1px solid #e2e8f0; font-size: 10.5px; color: #92400e; font-weight: 700;">
            ※ 장비 옵션 및 요청사항 : ${specialNotes}
          </div>
        ` : ''}

        <!-- 6. Confirmation Statement -->
        <div style="margin: 14px 0 10px; text-align: center;">
          <div style="font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px;">
            상기 장비를 이상 없이 정히 납품 (인수) 하였음을 상호 확인합니다.
          </div>
          <div style="margin-top: 5px; font-size: 12.5px; font-weight: 700; color: #334155;">
            ${signDateFormatted}
          </div>
        </div>

        <!-- 7. Signatures Cards (Left: Supplier Stamp / Right: Receiver Signature) -->
        <div style="display: flex; gap: 12px; margin-bottom: 10px;">
          <!-- Left: 공급자 확인 -->
          <div style="flex: 1; border: 1.5px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #fff;">
            <div style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; padding: 5px; text-align: center; font-size: 11.5px; font-weight: 700; color: #334155;">
              공 &nbsp; 급 &nbsp; 자 &nbsp; 확 &nbsp; 인 &nbsp; (출 &nbsp; 고)
            </div>
            <div style="padding: 8px 12px; font-size: 10.5px; color: #475569; line-height: 1.5;">
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
                <tr>
                  <td style="width: 65px; color: #475569; font-weight: 700; padding: 1px 0;">상 &nbsp; &nbsp; &nbsp; 호 :</td>
                  <td style="color: #0f172a;">${sCorpName}</td>
                </tr>
                <tr>
                  <td style="color: #475569; font-weight: 700; padding: 1px 0;">대 &nbsp; 표 &nbsp; 자 :</td>
                  <td style="color: #0f172a;">${sRep} (직인생략)</td>
                </tr>
                <tr>
                  <td style="color: #475569; font-weight: 700; padding: 1px 0;">사업자번호 :</td>
                  <td style="color: #0f172a;">${sBizNo}</td>
                </tr>
                <tr>
                  <td style="color: #475569; font-weight: 700; vertical-align: top; padding: 1px 0;">소 &nbsp; 재 &nbsp; 지 :</td>
                  <td style="color: #0f172a; font-size: 10px;">${sAddr}</td>
                </tr>
              </table>
              
              <div style="width: 140px; height: 44px; border: 1.5px dashed #94a3b8; background: #f8fafc; margin: 8px auto 6px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 13px; font-weight: 800; color: #64748b; letter-spacing: 2px;">[ 직 인 생 략 ]</span>
              </div>
              
              <div style="text-align: center; font-size: 10.5px; font-weight: 700; color: #475569; margin-top: 4px;">
                ${sCorpName} 대표이사 ${sRep} (직인생략)
              </div>
              <div style="text-align: center; font-size: 9px; color: #94a3b8; margin-top: 2px;">
                ※ 전자문서법에 의거 당사 직인을 생략하여 발행함
              </div>
            </div>
          </div>

          <!-- Right: 인수자 확인 및 자필 서명 -->
          <div style="flex: 1; border: 2px solid #2563eb; border-radius: 4px; overflow: hidden; background: #fff;">
            <div style="background: #eff6ff; border-bottom: 1px solid #bfdbfe; padding: 5px; text-align: center; font-size: 11.5px; font-weight: 700; color: #1e40af;">
              인 &nbsp; 수 &nbsp; 자 &nbsp; 확 &nbsp; 인 &nbsp; 및 &nbsp; 자 &nbsp; 필 &nbsp; 서 &nbsp; 명
            </div>
            <div style="padding: 8px 12px;">
              <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 2px;">
                인수자(담당자) : <span style="color: #0f172a;">${receiverName}</span>
              </div>
              <div style="font-size: 11px; font-weight: 700; color: #2563eb; margin-bottom: 6px;">
                인수자 연락처 : <span>${receiverPhone}</span>
              </div>
              
              <div style="height: 84px; border: 1.5px solid #0f172a; background: #f8fafc; border-radius: 3px; display: flex; align-items: center; justify-content: center; position: relative;">
                ${signatureUrl ? `
                  <img src="${signatureUrl}" style="max-height: 76px; max-width: 90%; object-fit: contain;" alt="인수자 서명" />
                ` : `
                  <div style="text-align: center;">
                    <div style="color: #94a3b8; font-size: 12px; font-weight: 700; letter-spacing: 1px;">(인수자 서명 또는 날인)</div>
                  </div>
                `}
              </div>
              
              <div style="text-align: center; margin-top: 5px;">
                ${signatureUrl ? `
                  <span style="color: #15803d; font-size: 9.5px; font-weight: 700;">✓ 모바일 전자 자필 서명 확인 완료</span>
                ` : `
                  <span style="color: #64748b; font-size: 9.5px;">✓ 모바일 전자 자필 서명 또는 현장 수기 서명</span>
                `}
              </div>
            </div>
          </div>
        </div>

        <!-- 8. Footer Legal & Brand Notice -->
        <div style="border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: center;">
          <div style="font-size: 9.5px; color: #64748b;">
            ※ 본 확인서는 모바일 전자서명 시스템 및 현장 납품 확인 표준 서식에 의거 발행된 정식 납품확인서입니다.
          </div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">
            ${effectiveTenant?.systemName || defaultSupplier.systemName || 'eBro Management System'} &nbsp;|&nbsp; ${sCorpName} &nbsp;|&nbsp; 고객센터: ${sTel} &nbsp;|&nbsp; ${sWebsite ? sWebsite.replace(/^https?:\/\//, '') : defaultSupplier.websiteUrl?.replace(/^https?:\/\//, '')}
          </div>
        </div>

      </div>
    </div>
  `;
}

export interface SignedReceiptCargoItem {
  modelName?: string;
  count?: number | string;
  note?: string;
}

export interface SignedReceiptOptions {
  delivery: any;
  contractNo?: string;
  customerName?: string;
  siteName?: string;
  siteAddress?: string;
  receiverName?: string;
  receiverPhone?: string;
  supplierName?: string;
  supplierInfo?: any;
  cargoList?: SignedReceiptCargoItem[];
  specialNotes?: string;
  signatureCanvas?: HTMLCanvasElement | null;
  signatureDataUrl?: string | null;
  signDate?: string;
}

export async function generateSignedReceiptCanvas(options: SignedReceiptOptions): Promise<HTMLCanvasElement> {
  const {
    delivery,
    contractNo = '-',
    customerName = '미확인',
    siteName = '미확인',
    siteAddress = '-',
    receiverName = '인수담당자',
    receiverPhone = '-',
    supplierName = '공급자',
    supplierInfo = null,
    cargoList = [],
    specialNotes = '',
    signatureCanvas = null,
    signatureDataUrl = null,
    signDate = new Date().toISOString().split('T')[0]
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1700;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');

  // 1. Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1200, 1700);

  // 2. Double border (Formal legal frame)
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(45, 45, 1110, 1610);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(51, 51, 1098, 1598);

  // 3. Document Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('납 품 (인 수) 확 인 서', 600, 108);

  ctx.beginPath();
  ctx.moveTo(410, 124);
  ctx.lineTo(790, 124);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(410, 128);
  ctx.lineTo(790, 128);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#64748b';
  ctx.stroke();

  // 4. Metadata bar
  ctx.font = '15px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.fillText(`배차번호 : ${delivery?.id || '-'}`, 65, 158);
  ctx.textAlign = 'center';
  ctx.fillText(`계약번호 : ${contractNo || '-'}`, 600, 158);
  ctx.textAlign = 'right';
  ctx.fillText(`발행일자 : ${signDate}`, 1135, 158);

  // Helper: draw formal table grid
  function drawTableGrid(x: number, y: number, w: number, h: number, headerTitle: string, rows: Array<{ label: string; value: string }>) {
    if (!ctx) return;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Header
    const headerH = 36;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(x, y, w, headerH);
    ctx.strokeRect(x, y, w, headerH);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(headerTitle, x + w / 2, y + 24);

    // Rows
    const rowCount = rows.length;
    const rowH = (h - headerH) / rowCount;
    const labelW = 125;

    rows.forEach((row, idx) => {
      const curY = y + headerH + (idx * rowH);
      if (idx > 0) {
        ctx.beginPath();
        ctx.moveTo(x, curY);
        ctx.lineTo(x + w, curY);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();
      }
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x, curY, labelW, rowH);
      ctx.beginPath();
      ctx.moveTo(x + labelW, curY);
      ctx.lineTo(x + labelW, curY + rowH);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(row.label, x + (labelW / 2), curY + (rowH / 2) + 5);

      ctx.fillStyle = '#0f172a';
      ctx.font = '14px "Malgun Gothic", Pretendard, sans-serif';
      ctx.textAlign = 'left';
      
      const val = row.value || '-';
      if (ctx.measureText(val).width > (w - labelW - 20)) {
        ctx.font = '12px "Malgun Gothic", Pretendard, sans-serif';
      }
      ctx.fillText(val, x + labelW + 12, curY + (rowH / 2) + 5);
    });
  }

  // 5. Left Box (공급자) & Right Box (공급받는자)
  const boxY = 175;
  const boxH = 215;
  const boxW = 525;

  const defaultSupplier = SEED_TENANTS[0];
  const effectiveSupplier = supplierInfo || db?.currentTenant || defaultSupplier;

  const sCorpName = effectiveSupplier?.tradeName || 
                    effectiveSupplier?.corporateName || 
                    effectiveSupplier?.displayName || 
                    (supplierName && supplierName !== '공급자' ? supplierName : '') || 
                    defaultSupplier.tradeName;

  const sRep = effectiveSupplier?.representativeName || 
               effectiveSupplier?.representative || 
               defaultSupplier.representativeName;

  const sBizNo = effectiveSupplier?.businessNumber || 
                 effectiveSupplier?.bizRegNo || 
                 defaultSupplier.businessNumber;

  const sAddr = effectiveSupplier?.headOfficeAddress || 
                effectiveSupplier?.businessAddress || 
                effectiveSupplier?.address || 
                defaultSupplier.headOfficeAddress;

  const sTel = effectiveSupplier?.tel || 
               effectiveSupplier?.phone || 
               defaultSupplier.tel;

  const sFax = effectiveSupplier?.fax || 
               defaultSupplier.fax;

  const sWebsite = effectiveSupplier?.websiteUrl || 
                   defaultSupplier.websiteUrl || '';

  drawTableGrid(65, boxY, boxW, boxH, '공    급    자', [
    { label: '상호(법인명)', value: sCorpName },
    { label: '대표자 성명', value: sRep ? `${sRep} (직인생략)` : '(직인생략)' },
    { label: '사업자등록번호', value: sBizNo },
    { label: '사업장 소재지', value: sAddr },
    { label: '대표전화/FAX', value: sFax && sFax !== '-' ? `${sTel} / ${sFax}` : sTel }
  ]);

  drawTableGrid(610, boxY, boxW, boxH, '공 급 받 는 자  (인 수 처)', [
    { label: '고객사 (상호)', value: customerName },
    { label: '현   장   명', value: siteName },
    { label: '하차지 주소', value: siteAddress },
    { label: '인수 담당자', value: receiverName },
    { label: '인수자 연락처', value: receiverPhone }
  ]);

  // 6. Delivery details bar
  const delBarY = 405;
  const delBarH = 50;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(65, delBarY, 1070, delBarH);

  const colW = 1070 / 4;
  const dType = delivery?.type === 'OUTBOUND' ? '출고 (OUTBOUND)' : delivery?.type === 'INBOUND' ? '회수 (INBOUND)' : delivery?.type === 'EXCHANGE' ? '교환 (EXCHANGE)' : '출고';
  const dDate = delivery?.unloadingDate || delivery?.requestDate || signDate;
  const dVehicle = delivery?.vehicleNumber || '화물 운송차량';
  const dDriver = delivery?.driverName ? `${delivery.driverName} (${delivery.driverContact || '-'})` : '지정 기사';

  const subCols = [
    { label: '배차구분', val: dType },
    { label: '납품일자', val: dDate },
    { label: '운송차량', val: dVehicle },
    { label: '운송기사', val: dDriver }
  ];

  subCols.forEach((col, idx) => {
    const cx = 65 + (idx * colW);
    if (idx > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, delBarY);
      ctx.lineTo(cx, delBarY + delBarH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const lW = 85;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx, delBarY, lW, delBarH);
    ctx.beginPath();
    ctx.moveTo(cx + lW, delBarY);
    ctx.lineTo(cx + lW, delBarY + delBarH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 13px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(col.label, cx + (lW / 2), delBarY + 30);

    ctx.fillStyle = '#0f172a';
    ctx.font = '13.5px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(col.val, cx + lW + 10, delBarY + 30);
  });

  // 7. Equipment List Table (Centering all columns per user rule)
  const eqTitleY = 480;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 17px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('■ 납품 장비 목록', 65, eqTitleY);

  const tblY = 492;
  const tblW = 1070;
  const tblHdrH = 38;
  const tblRowH = 40;
  const columns = [
    { key: 'no', title: 'No.', w: 70 },
    { key: 'model', title: '품목 (장비 모델명)', w: 310 },
    { key: 'count', title: '수량', w: 120 },
    { key: 'unit', title: '단위', w: 90 },
    { key: 'site', title: '하차지 (현장명)', w: 300 },
    { key: 'note', title: '비고', w: 180 }
  ];

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(65, tblY, tblW, tblHdrH);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(65, tblY, tblW, tblHdrH);

  let curColX = 65;
  columns.forEach((col, idx) => {
    if (idx > 0) {
      ctx.beginPath();
      ctx.moveTo(curColX, tblY);
      ctx.lineTo(curColX, tblY + tblHdrH);
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();
    }
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(col.title, curColX + (col.w / 2), tblY + 24);
    curColX += col.w;
  });

  const minRows = 5;
  const displayRows: Array<SignedReceiptCargoItem | null> = [...cargoList];
  if (displayRows.length === 0 && delivery?.cargoItems) {
    try {
      const parsed = JSON.parse(delivery.cargoItems);
      if (Array.isArray(parsed)) {
        displayRows.push(...parsed);
      } else {
        displayRows.push({ modelName: delivery.cargoItems, count: 1, note: '정상 납품' });
      }
    } catch (e) {
      displayRows.push({ modelName: delivery.cargoItems, count: 1, note: '정상 납품' });
    }
  }
  while (displayRows.length < minRows) {
    displayRows.push(null);
  }

  displayRows.forEach((item, rIdx) => {
    const ry = tblY + tblHdrH + (rIdx * tblRowH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(65, ry, tblW, tblRowH);

    let rx = 65;
    columns.forEach((col, cIdx) => {
      if (cIdx > 0) {
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx, ry + tblRowH);
        ctx.stroke();
      }

      ctx.font = '14px "Malgun Gothic", Pretendard, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center'; // User rule: All equipment list columns centered

      if (item) {
        if (col.key === 'no') ctx.fillText(String(rIdx + 1), rx + col.w / 2, ry + 25);
        else if (col.key === 'model') {
          ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
          ctx.fillText(item.modelName || '고소작업대', rx + col.w / 2, ry + 25);
        } else if (col.key === 'count') {
          ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
          ctx.fillStyle = '#2563eb';
          ctx.fillText(`${item.count || 1} 대`, rx + col.w / 2, ry + 25);
        } else if (col.key === 'unit') {
          ctx.fillText('대', rx + col.w / 2, ry + 25);
        } else if (col.key === 'site') {
          ctx.fillText(siteName || '-', rx + col.w / 2, ry + 25);
        } else if (col.key === 'note') {
          ctx.fillStyle = '#64748b';
          ctx.fillText(item.note || '-', rx + col.w / 2, ry + 25);
        }
      }
      rx += col.w;
    });
  });

  // Summary Row
  const totalCount = cargoList.length > 0 
    ? cargoList.reduce((acc, c) => acc + (Number(c.count) || 1), 0)
    : 1;
  const sumY = tblY + tblHdrH + (displayRows.length * tblRowH);
  const sumH = 38;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(65, sumY, tblW, sumH);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(65, sumY, tblW, sumH);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14.5px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`합 계 :  총 ${Math.max(cargoList.length, 1)}개 품목  /  ${totalCount}대`, 65 + (tblW / 2), sumY + 24);

  // Optional: Notes box
  let currentY = sumY + sumH;
  if (specialNotes) {
    const noteY = currentY + 10;
    const noteH = 38;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(65, noteY, tblW, noteH);
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(65, noteY, tblW, noteH);

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 13px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`※ 장비 옵션 및 요청사항 : ${specialNotes}`, 80, noteY + 24);
    currentY = noteY + noteH;
  }

  // 8. Confirmation statement
  const stmtY = currentY + 45;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('상기 장비를 이상 없이 정히 납품 (인수) 하였음을 상호 확인합니다.', 600, stmtY);

  const dateY = stmtY + 34;
  ctx.font = 'bold 17px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(signDate.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년  $2월  $3일'), 600, dateY);

  // 9. Signatures Area
  const signCardY = dateY + 35;
  const signCardH = 430;
  const signCardW = 525;

  // --- Left: Supplier Stamp Card ---
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(65, signCardY, signCardW, signCardH);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(65, signCardY, signCardW, 36);
  ctx.strokeRect(65, signCardY, signCardW, 36);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 15px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('공  급  자  확  인  (출  고)', 65 + (signCardW / 2), signCardY + 24);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '14px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillText(`상      호 :  ${sCorpName}`, 90, signCardY + 70);
  ctx.fillText(`대  표  자 :  ${sRep}  (직인생략)`, 90, signCardY + 102);
  ctx.fillText(`사업자번호 :  ${sBizNo}`, 90, signCardY + 134);
  ctx.fillText(`소  재  지 :  ${sAddr}`, 90, signCardY + 166);

  // Official [직인생략] Notice Area per user legal instruction
  const sealX = 65 + (signCardW / 2);
  const sealBoxW = 220;
  const sealBoxH = 100;
  const sealBoxX = sealX - (sealBoxW / 2);
  const sealBoxY = signCardY + 230;

  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(sealBoxX, sealBoxY, sealBoxW, sealBoxH);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(sealBoxX, sealBoxY, sealBoxW, sealBoxH);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 20px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('[ 직 인 생 략 ]', sealX, sealBoxY + 56);
  ctx.restore();

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  const repTitle = sRep ? `대표이사  ${sRep} ` : '';
  ctx.fillText(`${sCorpName}  ${repTitle}(직인생략)`, sealX, signCardY + 365);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('※ 전자문서법에 의거 당사 직인을 생략하여 발행함', sealX, signCardY + 392);

  // --- Right: Receiver Signature Card ---
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.strokeRect(610, signCardY, signCardW, signCardH);

  ctx.fillStyle = '#eff6ff';
  ctx.fillRect(610, signCardY, signCardW, 36);
  ctx.strokeRect(610, signCardY, signCardW, 36);

  ctx.fillStyle = '#1e40af';
  ctx.font = 'bold 15px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('인 수 자  확 인  및  자 필 서 명', 610 + (signCardW / 2), signCardY + 24);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 15px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillText(`인수자(담당자) :  ${receiverName}`, 635, signCardY + 68);
  ctx.font = '14.5px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillStyle = '#2563eb';
  ctx.fillText(`인수자 연락처 :  ${receiverPhone}`, 635, signCardY + 98);

  // Signature Box
  const sigBoxX = 635;
  const sigBoxY = signCardY + 115;
  const sigBoxW = signCardW - 50;
  const sigBoxH = 245;

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sigBoxX, sigBoxY, sigBoxW, sigBoxH);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(sigBoxX, sigBoxY, sigBoxW, sigBoxH);

  // Draw signature if provided
  if (signatureCanvas) {
    const pad = 12;
    const targetW = sigBoxW - pad * 2;
    const targetH = sigBoxH - pad * 2;
    const scale = Math.min(targetW / signatureCanvas.width, targetH / signatureCanvas.height);
    const drawW = signatureCanvas.width * scale;
    const drawH = signatureCanvas.height * scale;
    const drawX = sigBoxX + (sigBoxW - drawW) / 2;
    const drawY = sigBoxY + (sigBoxH - drawH) / 2;

    ctx.drawImage(signatureCanvas, drawX, drawY, drawW, drawH);
  } else if (signatureDataUrl) {
    const sigImg = new Image();
    sigImg.crossOrigin = 'anonymous';
    sigImg.src = signatureDataUrl;
    await new Promise((resolve) => {
      sigImg.onload = resolve;
      sigImg.onerror = resolve;
    });
    if (sigImg.width > 0) {
      const pad = 12;
      const targetW = sigBoxW - pad * 2;
      const targetH = sigBoxH - pad * 2;
      const scale = Math.min(targetW / sigImg.width, targetH / sigImg.height);
      const drawW = sigImg.width * scale;
      const drawH = sigImg.height * scale;
      const drawX = sigBoxX + (sigBoxW - drawW) / 2;
      const drawY = sigBoxY + (sigBoxH - drawH) / 2;

      ctx.drawImage(sigImg, drawX, drawY, drawW, drawH);
    }
  }

  // Badge below signature
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 13px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✓ 모바일 전자 자필 서명 확인 완료', 610 + (signCardW / 2), signCardY + 380);

  // 10. Footer
  const footLineY = signCardY + signCardH + 30;
  ctx.beginPath();
  ctx.moveTo(65, footLineY);
  ctx.lineTo(1135, footLineY);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '13px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('※ 본 확인서는 모바일 전자서명 시스템을 통하여 인수자 본인이 직접 확인 및 자필 서명한 정식 납품확인서입니다.', 600, footLineY + 26);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px "Malgun Gothic", Pretendard, sans-serif';
  const footerContact = sTel && sTel !== '-' ? `고객센터: ${sTel}` : `고객센터: ${defaultSupplier.tel}`;
  const footerWeb = sWebsite ? sWebsite.replace(/^https?:\/\//, '') : defaultSupplier.websiteUrl?.replace(/^https?:\/\//, '');
  const footerText = [
    effectiveSupplier?.systemName || defaultSupplier.systemName || 'eBro Management System',
    sCorpName,
    footerContact,
    footerWeb
  ].filter(Boolean).join('  |  ');
  ctx.fillText(footerText, 600, footLineY + 48);

  return canvas;
}

export async function generateSignedReceiptBlob(options: SignedReceiptOptions): Promise<Blob> {
  const canvas = await generateSignedReceiptCanvas(options);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create blob from signed receipt canvas'));
    }, 'image/png');
  });
}
