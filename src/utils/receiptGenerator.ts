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

  const dType = delivery?.type === 'OUTBOUND' ? '출고' : delivery?.type === 'INBOUND' ? '회수' : delivery?.type === 'EXCHANGE' ? '교환' : '출고';
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

  const totalCount = parsedCargos.reduce((acc, c) => acc + (Number(c.count) || 1), 0);
  const itemCount = parsedCargos.length;

  // ── 다중 페이지(Multi-Page) 분할 알고리즘 ──
  // 1페이지에 공급자/공급받는자/운송정보/서명부까지 완벽 수용 가능한 기준: 최대 12행
  // 13행 이상 시 다중 페이지로 자동 전환하며, 2페이지 이상일 때 모든 페이지에 배차번호/계약번호/발행일자/페이지번호 공통 출력
  function chunkCargosForPages(cargos: any[]): any[][] {
    const total = cargos.length;
    if (total <= 12) {
      return [cargos];
    }

    const P1_MAX = 14;
    const MID_MAX = 20;
    const LAST_MAX = 14;

    let numPages = 2;
    while (true) {
      const maxCapacity = P1_MAX + (numPages - 2) * MID_MAX + LAST_MAX;
      if (total <= maxCapacity || numPages >= 10) break;
      numPages++;
    }

    const pages: any[][] = [];
    let remaining = [...cargos];

    for (let p = 0; p < numPages; p++) {
      const isFirst = p === 0;
      const isLast = p === numPages - 1;
      const pagesLeft = numPages - p;

      if (isLast) {
        pages.push(remaining);
        break;
      }

      const currentMax = isFirst ? P1_MAX : MID_MAX;
      const target = Math.ceil(remaining.length / pagesLeft);
      const safeTake = Math.min(currentMax, Math.max(1, target), remaining.length - (pagesLeft - 1));
      pages.push(remaining.slice(0, safeTake));
      remaining = remaining.slice(safeTake);
    }

    return pages;
  }

  const pageChunks = chunkCargosForPages(parsedCargos);
  const totalPages = pageChunks.length;

  let signatureUrl = options?.signatureUrl;
  if (!signatureUrl && delivery?.closingMemo) {
    const match = delivery.closingMemo.match(/\[(전자 서명|납품증 사진)\]:\s*(https?:\/\/[^\s\n\r]+)/);
    if (match) {
      signatureUrl = match[2];
    }
  }

  const signDateFormatted = signDate.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년  $2월  $3일');

  // 각 페이지 HTML 렌더링
  let accumulatedRowIndex = 0;
  const pagesHtml = pageChunks.map((chunk, pageIdx) => {
    const isFirstPage = pageIdx === 0;
    const isLastPage = pageIdx === totalPages - 1;
    const rowOffset = accumulatedRowIndex;
    accumulatedRowIndex += chunk.length;

    // 단일 페이지이면서 6행 미만일 경우 표의 격식을 위해 빈 행 보정
    const displayRows: any[] = [...chunk];
    if (totalPages === 1 && displayRows.length < 6) {
      while (displayRows.length < 6) {
        displayRows.push(null);
      }
    }

    return `
      <div class="receipt-page">
        <div style="border: 1px solid #000000; padding: 14px 18px; box-sizing: border-box;">
          
          <!-- 1. Header Title -->
          <h1 style="text-align: center; font-size: 24px; font-weight: 800; color: #000000; margin: 6px 0 6px; letter-spacing: 4px;">
            납 &nbsp; 품 &nbsp; (인 &nbsp; 수) &nbsp; 확 &nbsp; 인 &nbsp; 서${!isFirstPage ? ' &nbsp;<span style="font-size: 16px; font-weight: 700;">(계 속)</span>' : ''}
          </h1>
          <div style="width: 360px; margin: 0 auto 10px auto;">
            <div style="height: 2px; background: #000000; margin-bottom: 2px;"></div>
            <div style="height: 1px; background: #000000;"></div>
          </div>

          <!-- 2. 공통 메타데이터 바 (다중 페이지 발생 시 전 페이지 동일 건 인식 보장) -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #000000; margin-bottom: 8px; font-weight: 700; border-bottom: 1px dashed #000000; padding-bottom: 4px;">
            <span>배차번호 : ${delivery?.id || '-'}</span>
            <span>계약번호 : ${contractNo}</span>
            <span>발행일자 : ${signDate}</span>
            <span style="background: #f0f0f0; border: 1px solid #000000; padding: 1px 6px;">페이지 : ${pageIdx + 1} / ${totalPages}</span>
          </div>

          ${isFirstPage ? `
            <!-- 3. Top Boxes: 공급자 vs 공급받는자 (1페이지 전용) -->
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <!-- Left: 공급자 -->
              <div style="flex: 1; border: 1px solid #000000; box-sizing: border-box;">
                <div style="background: #f0f0f0; border-bottom: 1px solid #000000; padding: 4px; text-align: center; font-size: 12px; font-weight: 700; color: #000000;">
                  공 &nbsp; &nbsp; 급 &nbsp; &nbsp; 자
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
                  <tr style="border-bottom: 1px solid #000000; height: 23px;">
                    <td style="width: 90px; background: #f0f0f0; border-right: 1px solid #000000; text-align: center; font-weight: 700; color: #000000; padding: 2px 4px;">상호(법인명)</td>
                    <td style="padding: 2px 6px; color: #000000; font-weight: 700;">${sCorpName}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #000000; height: 23px;">
                    <td style="background: #f0f0f0; border-right: 1px solid #000000; text-align: center; font-weight: 700; color: #000000; padding: 2px 4px;">대표자 성명</td>
                    <td style="padding: 2px 6px; color: #000000;">${sRep || '-'}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #000000; height: 23px;">
                    <td style="background: #f0f0f0; border-right: 1px solid #000000; text-align: center; font-weight: 700; color: #000000; padding: 2px 4px;">사업자등록번호</td>
                    <td style="padding: 2px 6px; color: #000000;">${sBizNo}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #000000; height: 23px;">
                    <td style="background: #f0f0f0; border-right: 1px solid #000000; text-align: center; font-weight: 700; color: #000000; padding: 2px 4px;">사업장 소재지</td>
                    <td style="padding: 2px 6px; color: #000000; font-size: 10px;">${sAddr}</td>
                  </tr>
                  <tr style="height: 23px;">
                    <td style="background: #f0f0f0; border-right: 1px solid #000000; text-align: center; font-weight: 700; color: #000000; padding: 2px 4px;">대표전화/FAX</td>
                    <td style="padding: 2px 6px; color: #000000;">${sFax && sFax !== '-' ? `${sTel} / ${sFax}` : sTel}</td>
                  </tr>
                </table>
              </div>

              <!-- Right: 공급받는자 -->
              <div style="flex: 1; border: 1px solid #000000; box-sizing: border-box;">
                <div style="background: #f0f0f0; border-bottom: 1px solid #000000; padding: 4px; text-align: center; font-size: 12px; font-weight: 700; color: #000000;">
                  공 &nbsp; 급 &nbsp; 받 &nbsp; 는 &nbsp; 자 &nbsp; (인 &nbsp; 수 &nbsp; 처)
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
                  <tr style="border-bottom: 1px solid #000000; height: 23px;">
                    <td style="width: 90px; background: #f0f0f0; border-right: 1px solid #000000; text-align: center; font-weight: 700; color: #000000; padding: 2px 4px;">고객사 (상호)</td>
                    <td style="padding: 2px 6px; color: #000000; font-weight: 700;">${customerName}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #000000; height: 23px;">
                    <td style="background: #f0f0f0; border-right: 1px solid #000000; text-align: center; font-weight: 700; color: #000000; padding: 2px 4px;">현 &nbsp; &nbsp;장 &nbsp; &nbsp;명</td>
                    <td style="padding: 2px 6px; color: #000000;">${siteName}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #000000; height: 23px;">
                    <td style="background: #f0f0f0; border-right: 1px solid #000000; text-align: center; font-weight: 700; color: #000000; padding: 2px 4px;">하차지 주소</td>
                    <td style="padding: 2px 6px; color: #000000; font-size: 10px;">${siteAddress}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #000000; height: 23px;">
                    <td style="background: #f0f0f0; border-right: 1px solid #000000; text-align: center; font-weight: 700; color: #000000; padding: 2px 4px;">인수 담당자</td>
                    <td style="padding: 2px 6px; color: #000000; font-weight: 700;">${receiverName}</td>
                  </tr>
                  <tr style="height: 23px;">
                    <td style="background: #f0f0f0; border-right: 1px solid #000000; text-align: center; font-weight: 700; color: #000000; padding: 2px 4px;">인수자 연락처</td>
                    <td style="padding: 2px 6px; color: #000000; font-weight: 700;">${receiverPhone}</td>
                  </tr>
                </table>
              </div>
            </div>

            <!-- 4. Delivery Details Bar (1페이지 전용) -->
            <div style="border: 1px solid #000000; display: flex; font-size: 10.5px; margin-bottom: 8px;">
              <div style="flex: 1; display: flex; border-right: 1px solid #000000;">
                <div style="width: 60px; background: #f0f0f0; border-right: 1px solid #000000; font-weight: 700; color: #000000; text-align: center; padding: 4px 2px;">배차구분</div>
                <div style="flex: 1; padding: 4px 6px; text-align: center; font-weight: 700; color: #000000;">${dType}</div>
              </div>
              <div style="flex: 1; display: flex; border-right: 1px solid #000000;">
                <div style="width: 60px; background: #f0f0f0; border-right: 1px solid #000000; font-weight: 700; color: #000000; text-align: center; padding: 4px 2px;">납품일자</div>
                <div style="flex: 1; padding: 4px 6px; text-align: center; color: #000000;">${dDate}</div>
              </div>
              <div style="flex: 1.2; display: flex; border-right: 1px solid #000000;">
                <div style="width: 60px; background: #f0f0f0; border-right: 1px solid #000000; font-weight: 700; color: #000000; text-align: center; padding: 4px 2px;">운송차량</div>
                <div style="flex: 1; padding: 4px 6px; text-align: center; color: #000000;">${dVehicle}</div>
              </div>
              <div style="flex: 1.4; display: flex;">
                <div style="width: 60px; background: #f0f0f0; border-right: 1px solid #000000; font-weight: 700; color: #000000; text-align: center; padding: 4px 2px;">운송기사</div>
                <div style="flex: 1; padding: 4px 6px; text-align: center; color: #000000;">${dDriver}</div>
              </div>
            </div>

            <!-- 5. Equipment List Title -->
            <div style="font-size: 12.5px; font-weight: 700; color: #000000; margin: 6px 0 4px;">
              ■ 납품 장비 목록 ${totalPages > 1 ? `<span style="font-size: 11px; font-weight: normal; color: #555555;">(1 / ${totalPages} 페이지)</span>` : ''}
            </div>
          ` : `
            <!-- 3. 속행 페이지 참조 바 (2페이지 이상 공통) -->
            <div style="border: 1px solid #000000; background: #f0f0f0; padding: 5px 10px; display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 700; color: #000000; margin-bottom: 8px;">
              <span>공급자 : ${sCorpName}</span>
              <span>고객사 : ${customerName}</span>
              <span>하차지(현장명) : ${siteName}</span>
            </div>
            <div style="font-size: 12.5px; font-weight: 700; color: #000000; margin: 6px 0 4px;">
              ■ 납품 장비 목록 (계속 - ${pageIdx + 1} / ${totalPages} 페이지)
            </div>
          `}

          <!-- Equipment Table for this page -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000000; margin-bottom: 6px;">
            <thead>
              <tr style="background: #f0f0f0; height: 26px;">
                <th style="border: 1px solid #000000; width: 45px; text-align: center; font-size: 10.5px; font-weight: 700; color: #000000;">No.</th>
                <th style="border: 1px solid #000000; text-align: center; font-size: 10.5px; font-weight: 700; color: #000000;">품목 (상품명 / 모델명)</th>
                <th style="border: 1px solid #000000; width: 65px; text-align: center; font-size: 10.5px; font-weight: 700; color: #000000;">수량</th>
                <th style="border: 1px solid #000000; width: 45px; text-align: center; font-size: 10.5px; font-weight: 700; color: #000000;">단위</th>
                <th style="border: 1px solid #000000; width: 170px; text-align: center; font-size: 10.5px; font-weight: 700; color: #000000;">하차지 (현장 / 납품처)</th>
                <th style="border: 1px solid #000000; width: 110px; text-align: center; font-size: 10.5px; font-weight: 700; color: #000000;">비고</th>
              </tr>
            </thead>
            <tbody>
              ${displayRows.map((item, idx) => {
                if (item) {
                  const itemUnit = item.unit || (item.modelName?.includes('장비') || item.modelName?.includes('리프트') ? '대' : '개');
                  return `
                    <tr style="height: 25px;">
                      <td style="border: 1px solid #000000; padding: 2px 4px; text-align: center; font-size: 10.5px; color: #000000;">${rowOffset + idx + 1}</td>
                      <td style="border: 1px solid #000000; padding: 2px 8px; text-align: center; font-size: 10.5px; font-weight: 700; color: #000000;">${item.modelName || '납품 물품'}</td>
                      <td style="border: 1px solid #000000; padding: 2px 4px; text-align: center; font-size: 10.5px; font-weight: 700; color: #000000;">${item.count || 1}</td>
                      <td style="border: 1px solid #000000; padding: 2px 4px; text-align: center; font-size: 10.5px; color: #000000;">${itemUnit}</td>
                      <td style="border: 1px solid #000000; padding: 2px 8px; text-align: center; font-size: 10.5px; color: #000000;">${siteName}</td>
                      <td style="border: 1px solid #000000; padding: 2px 8px; text-align: center; font-size: 10px; color: #000000;">${item.note || '정상 납품'}</td>
                    </tr>
                  `;
                } else {
                  return `
                    <tr style="height: 25px;">
                      <td style="border: 1px solid #000000; padding: 2px 4px; text-align: center; font-size: 10.5px;">&nbsp;</td>
                      <td style="border: 1px solid #000000; padding: 2px 8px; text-align: center; font-size: 10.5px;">&nbsp;</td>
                      <td style="border: 1px solid #000000; padding: 2px 4px; text-align: center; font-size: 10.5px;">&nbsp;</td>
                      <td style="border: 1px solid #000000; padding: 2px 4px; text-align: center; font-size: 10.5px;">&nbsp;</td>
                      <td style="border: 1px solid #000000; padding: 2px 8px; text-align: center; font-size: 10.5px;">&nbsp;</td>
                      <td style="border: 1px solid #000000; padding: 2px 8px; text-align: center; font-size: 10px;">&nbsp;</td>
                    </tr>
                  `;
                }
              }).join('')}

              ${isLastPage ? `
                <tr style="height: 25px; background: #f0f0f0;">
                  <td colspan="6" style="border: 1px solid #000000; padding: 3px 12px; text-align: center; font-size: 11px; font-weight: 700; color: #000000;">
                    합 계 : &nbsp; 총 ${itemCount}개 품목 &nbsp; / &nbsp; ${totalCount}개(대)
                  </td>
                </tr>
              ` : `
                <tr style="height: 24px; background: #f0f0f0;">
                  <td colspan="6" style="border: 1px solid #000000; padding: 3px 12px; text-align: center; font-size: 10.5px; font-weight: 700; color: #000000;">
                    [ 다음 페이지 (${pageIdx + 2} / ${totalPages}) 에 계속 연결됩니다 ➔ ]
                  </td>
                </tr>
              `}
            </tbody>
          </table>

          ${isLastPage && specialNotes ? `
            <div style="margin-bottom: 6px; padding: 4px 8px; background: #f0f0f0; border: 1px solid #000000; font-size: 10px; color: #000000; font-weight: 700;">
              ※ 특이사항 및 요청사항 : ${specialNotes}
            </div>
          ` : ''}

          ${isLastPage ? `
            <!-- 6. Confirmation & Signatures (최종 페이지 전용) -->
            <div class="sign-section" style="margin-top: 6px; margin-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: stretch; border: 1px solid #000000; padding: 8px 12px; background: #ffffff;">
                
                <!-- Left: Confirmation Statement & Company (No redundant supplier table) -->
                <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding-right: 14px;">
                  <div>
                    <div style="font-size: 13.5px; font-weight: 800; color: #000000; letter-spacing: -0.2px; line-height: 1.4;">
                      상기 물품/장비를 이상 없이 정히 납품 (인수) 하였음을 상호 확인합니다.
                    </div>
                    <div style="margin-top: 4px; font-size: 11.5px; font-weight: 700; color: #000000;">
                      ${signDateFormatted}
                    </div>
                  </div>
                  
                  <div style="margin-top: 8px;">
                    <div style="font-size: 12.5px; font-weight: 800; color: #000000;">
                      ${sCorpName} 대표이사 ${sRep} <span style="font-size: 11px; font-weight: 700;">(직인생략)</span>
                    </div>
                    <div style="font-size: 9.5px; color: #555555; margin-top: 3px;">
                      ※ 전자문서법에 의거 당사 직인을 생략하여 발행함
                    </div>
                  </div>
                </div>

                <!-- Right: Compact Receiver Confirmation Table -->
                <div style="width: 290px; flex-shrink: 0;">
                  <table style="width: 100%; border-collapse: collapse; border: 1px solid #000000;">
                    <thead>
                      <tr style="background: #f0f0f0; height: 23px;">
                        <th colspan="2" style="border: 1px solid #000000; text-align: center; font-size: 11px; font-weight: 700; color: #000000; padding: 2px;">
                          인 &nbsp; 수 &nbsp; 자 &nbsp; 확 &nbsp; 인
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="height: 23px;">
                        <td style="width: 80px; background: #f0f0f0; border: 1px solid #000000; text-align: center; font-size: 10px; font-weight: 700; color: #000000; padding: 2px 4px;">인수 담당자</td>
                        <td style="border: 1px solid #000000; padding: 2px 8px; font-size: 10.5px; font-weight: 700; color: #000000;">${receiverName}</td>
                      </tr>
                      <tr style="height: 23px;">
                        <td style="background: #f0f0f0; border: 1px solid #000000; text-align: center; font-size: 10px; font-weight: 700; color: #000000; padding: 2px 4px;">인수자 연락처</td>
                        <td style="border: 1px solid #000000; padding: 2px 8px; font-size: 10.5px; color: #000000;">${receiverPhone}</td>
                      </tr>
                      <tr style="height: 52px;">
                        <td style="background: #f0f0f0; border: 1px solid #000000; text-align: center; font-size: 10px; font-weight: 700; color: #000000; padding: 2px 4px;">서명 또는 (인)</td>
                        <td style="border: 1px solid #000000; padding: 2px 6px; text-align: center; vertical-align: middle;">
                          ${signatureUrl ? `
                            <img src="${signatureUrl}" style="max-height: 46px; max-width: 180px; object-fit: contain;" alt="인수자 서명" />
                          ` : `
                            <span style="font-size: 10px; color: #555555;">(인수자 서명 또는 날인)</span>
                          `}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          ` : ''}

          <!-- 7. Footer Legal & Brand Notice (전 페이지 공통) -->
          <div style="border-top: 1px solid #000000; padding-top: 5px; margin-top: ${isLastPage ? '6px' : '14px'}; text-align: center;">
            <div style="font-size: 9.5px; color: #000000;">
              ※ 본 확인서는 모바일 전자서명 시스템 및 현장 납품 확인 표준 서식에 의거 발행된 정식 납품확인서입니다.
            </div>
            <div style="font-size: 9px; color: #555555; margin-top: 2px;">
              ${effectiveTenant?.systemName || defaultSupplier.systemName || 'eBro Management System'} &nbsp;|&nbsp; ${sCorpName} &nbsp;|&nbsp; 고객센터: ${sTel} &nbsp;|&nbsp; ${sWebsite ? sWebsite.replace(/^https?:\/\//, '') : defaultSupplier.websiteUrl?.replace(/^https?:\/\//, '')} &nbsp;|&nbsp; (${pageIdx + 1} / ${totalPages})
            </div>
          </div>

        </div>
      </div>
    `;
  }).join('');

  return `
    <style>
      @page {
        size: A4 portrait;
        margin: 8mm 10mm;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .receipt-page {
          border: 2px solid #000000 !important;
          box-shadow: none !important;
          margin: 0 auto !important;
          max-width: 100% !important;
          page-break-after: always !important;
          break-after: page !important;
          box-sizing: border-box !important;
        }
        .receipt-page:last-child {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        .sign-section {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
      .receipt-page {
        box-sizing: border-box;
        font-family: 'Malgun Gothic', Pretendard, 'Apple SD Gothic Neo', sans-serif;
        width: 100%;
        max-width: 760px;
        margin: 0 auto 24px auto;
        color: #000000;
        background-color: #ffffff;
        border: 2px solid #000000;
        padding: 4px;
      }
      .receipt-page:last-child {
        margin-bottom: 0;
      }
    </style>
    <div class="receipt-print-wrapper" style="width: 100%; margin: 0; padding: 0;">
      ${pagesHtml}
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
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(45, 45, 1110, 1610);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(51, 51, 1098, 1598);

  // 3. Document Title
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 36px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('납 품 (인 수) 확 인 서', 600, 108);

  ctx.beginPath();
  ctx.moveTo(410, 124);
  ctx.lineTo(790, 124);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(410, 128);
  ctx.lineTo(790, 128);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  // 4. Metadata bar
  ctx.font = '15px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.fillText(`배차번호 : ${delivery?.id || '-'}`, 65, 158);
  ctx.textAlign = 'center';
  ctx.fillText(`계약번호 : ${contractNo || '-'}`, 600, 158);
  ctx.textAlign = 'right';
  ctx.fillText(`발행일자 : ${signDate}`, 1135, 158);

  // Helper: draw formal table grid
  function drawTableGrid(x: number, y: number, w: number, h: number, headerTitle: string, rows: Array<{ label: string; value: string }>) {
    if (!ctx) return;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Header
    const headerH = 36;
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(x, y, w, headerH);
    ctx.strokeRect(x, y, w, headerH);

    ctx.fillStyle = '#000000';
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
        ctx.strokeStyle = '#000000';
        ctx.stroke();
      }
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(x, curY, labelW, rowH);
      ctx.beginPath();
      ctx.moveTo(x + labelW, curY);
      ctx.lineTo(x + labelW, curY + rowH);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(row.label, x + (labelW / 2), curY + (rowH / 2) + 5);

      ctx.fillStyle = '#000000';
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
    { label: '대표자 성명', value: sRep || '-' },
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
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(65, delBarY, 1070, delBarH);

  const colW = 1070 / 4;
  const dType = delivery?.type === 'OUTBOUND' ? '출고' : delivery?.type === 'INBOUND' ? '회수' : delivery?.type === 'EXCHANGE' ? '교환' : '출고';
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
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const lW = 85;
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(cx, delBarY, lW, delBarH);
    ctx.beginPath();
    ctx.moveTo(cx + lW, delBarY);
    ctx.lineTo(cx + lW, delBarY + delBarH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 13px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(col.label, cx + (lW / 2), delBarY + 30);

    ctx.fillStyle = '#000000';
    ctx.font = '13.5px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(col.val, cx + lW + 10, delBarY + 30);
  });

  // 7. Equipment List Table (Centering all columns per user rule)
  const eqTitleY = 480;
  ctx.fillStyle = '#000000';
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

  const rawCargos: SignedReceiptCargoItem[] = [...cargoList];
  if (rawCargos.length === 0 && delivery?.cargoItems) {
    try {
      const parsed = JSON.parse(delivery.cargoItems);
      if (Array.isArray(parsed)) {
        rawCargos.push(...parsed);
      } else {
        rawCargos.push({ modelName: delivery.cargoItems, count: 1, note: '정상 납품' });
      }
    } catch (e) {
      rawCargos.push({ modelName: delivery.cargoItems, count: 1, note: '정상 납품' });
    }
  }

  const isMultiCol = rawCargos.length > 10;
  const isCompact = rawCargos.length > 6 && rawCargos.length <= 10;
  const totalCount = rawCargos.length > 0 
    ? rawCargos.reduce((acc, c) => acc + (Number(c.count) || 1), 0)
    : 1;

  let sumY = tblY + tblHdrH;
  if (isMultiCol) {
    // 11대 이상: 2단 분할 테이블 (좌/우 병렬)
    const half = Math.ceil(rawCargos.length / 2);
    const subColW = tblW / 2;
    const cCols = [
      { key: 'no', title: 'No.', w: 45 },
      { key: 'model', title: '품목 (장비 모델명)', w: 260 },
      { key: 'count', title: '수량', w: 90 },
      { key: 'note', title: '비고', w: 140 }
    ];

    // Header
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(65, tblY, tblW, tblHdrH);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(65, tblY, tblW, tblHdrH);

    [0, subColW].forEach(offset => {
      let curX = 65 + offset;
      cCols.forEach((col, idx) => {
        if (idx > 0 || offset > 0) {
          ctx.beginPath();
          ctx.moveTo(curX, tblY);
          ctx.lineTo(curX, tblY + tblHdrH);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 13px "Malgun Gothic", Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(col.title, curX + (col.w / 2), tblY + 24);
        curX += col.w;
      });
    });

    const cRowH = 28;
    for (let rIdx = 0; rIdx < half; rIdx++) {
      const ry = tblY + tblHdrH + (rIdx * cRowH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(65, ry, tblW, cRowH);

      // Center divider
      ctx.beginPath();
      ctx.moveTo(65 + subColW, ry);
      ctx.lineTo(65 + subColW, ry + cRowH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();

      const lItem = rawCargos[rIdx];
      const rItem = rawCargos[rIdx + half];

      if (lItem) {
        let lx = 65;
        cCols.forEach((col, cIdx) => {
          if (cIdx > 0) {
            ctx.beginPath();
            ctx.moveTo(lx, ry);
            ctx.lineTo(lx, ry + cRowH);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.font = '12.5px "Malgun Gothic", Pretendard, sans-serif';
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          if (col.key === 'no') ctx.fillText(String(rIdx + 1), lx + col.w / 2, ry + 19);
          else if (col.key === 'model') {
            ctx.font = 'bold 12.5px "Malgun Gothic", Pretendard, sans-serif';
            ctx.fillText(lItem.modelName || '고소작업대', lx + col.w / 2, ry + 19);
          } else if (col.key === 'count') {
            ctx.font = 'bold 12.5px "Malgun Gothic", Pretendard, sans-serif';
            ctx.fillStyle = '#000000';
            ctx.fillText(`${lItem.count || 1} 대`, lx + col.w / 2, ry + 19);
          } else if (col.key === 'note') {
            ctx.fillStyle = '#000000';
            ctx.fillText(lItem.note || '정상', lx + col.w / 2, ry + 19);
          }
          lx += col.w;
        });
      }

      if (rItem) {
        let rx = 65 + subColW;
        cCols.forEach((col, cIdx) => {
          if (cIdx > 0) {
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx, ry + cRowH);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.font = '12.5px "Malgun Gothic", Pretendard, sans-serif';
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          if (col.key === 'no') ctx.fillText(String(rIdx + half + 1), rx + col.w / 2, ry + 19);
          else if (col.key === 'model') {
            ctx.font = 'bold 12.5px "Malgun Gothic", Pretendard, sans-serif';
            ctx.fillText(rItem.modelName || '고소작업대', rx + col.w / 2, ry + 19);
          } else if (col.key === 'count') {
            ctx.font = 'bold 12.5px "Malgun Gothic", Pretendard, sans-serif';
            ctx.fillStyle = '#000000';
            ctx.fillText(`${rItem.count || 1} 대`, rx + col.w / 2, ry + 19);
          } else if (col.key === 'note') {
            ctx.fillStyle = '#000000';
            ctx.fillText(rItem.note || '정상', rx + col.w / 2, ry + 19);
          }
          rx += col.w;
        });
      }
    }
    sumY = tblY + tblHdrH + (half * cRowH);
  } else {
    // 1~10대: 1단 테이블
    const minRows = isCompact ? rawCargos.length : 6;
    const displayRows: Array<SignedReceiptCargoItem | null> = [...rawCargos];
    while (displayRows.length < minRows) {
      displayRows.push(null);
    }
    const cRowH = isCompact ? 32 : 38;

    // Header
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(65, tblY, tblW, tblHdrH);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(65, tblY, tblW, tblHdrH);

    let curColX = 65;
    columns.forEach((col, idx) => {
      if (idx > 0) {
        ctx.beginPath();
        ctx.moveTo(curColX, tblY);
        ctx.lineTo(curColX, tblY + tblHdrH);
        ctx.strokeStyle = '#000000';
        ctx.stroke();
      }
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(col.title, curColX + (col.w / 2), tblY + 24);
      curColX += col.w;
    });

    displayRows.forEach((item, rIdx) => {
      const ry = tblY + tblHdrH + (rIdx * cRowH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(65, ry, tblW, cRowH);

      let rx = 65;
      columns.forEach((col, cIdx) => {
        if (cIdx > 0) {
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx, ry + cRowH);
          ctx.strokeStyle = '#000000';
          ctx.stroke();
        }

        ctx.font = isCompact ? '13px "Malgun Gothic", Pretendard, sans-serif' : '14px "Malgun Gothic", Pretendard, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';

        const textY = ry + (cRowH / 2) + 5;
        if (item) {
          if (col.key === 'no') ctx.fillText(String(rIdx + 1), rx + col.w / 2, textY);
          else if (col.key === 'model') {
            ctx.font = isCompact ? 'bold 13px "Malgun Gothic", Pretendard, sans-serif' : 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
            ctx.fillText(item.modelName || '고소작업대', rx + col.w / 2, textY);
          } else if (col.key === 'count') {
            ctx.font = isCompact ? 'bold 13px "Malgun Gothic", Pretendard, sans-serif' : 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
            ctx.fillStyle = '#000000';
            ctx.fillText(`${item.count || 1} 대`, rx + col.w / 2, textY);
          } else if (col.key === 'unit') {
            ctx.fillText('대', rx + col.w / 2, textY);
          } else if (col.key === 'site') {
            ctx.fillText(siteName || '-', rx + col.w / 2, textY);
          } else if (col.key === 'note') {
            ctx.fillStyle = '#000000';
            ctx.fillText(item.note || '-', rx + col.w / 2, textY);
          }
        }
        rx += col.w;
      });
    });
    sumY = tblY + tblHdrH + (displayRows.length * cRowH);
  }

  // Summary Row
  const sumH = 38;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(65, sumY, tblW, sumH);
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(65, sumY, tblW, sumH);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 14.5px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`합 계 :  총 ${Math.max(rawCargos.length, 1)}개 품목  /  ${totalCount}대`, 65 + (tblW / 2), sumY + 24);

  // Optional: Notes box
  let currentY = sumY + sumH;
  if (specialNotes) {
    const noteY = currentY + 10;
    const noteH = 38;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(65, noteY, tblW, noteH);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(65, noteY, tblW, noteH);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 13px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`※ 장비 옵션 및 요청사항 : ${specialNotes}`, 80, noteY + 24);
    currentY = noteY + noteH;
  }

  // 8. Confirmation statement
  const stmtY = currentY + 36;
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 18px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('상기 장비를 이상 없이 정히 납품 (인수) 하였음을 상호 확인합니다.', 600, stmtY);

  const dateY = stmtY + 30;
  ctx.font = 'bold 15px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText(signDate.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년  $2월  $3일'), 600, dateY);

  // 9. Signatures Area (Left: Confirmation/Company / Right: Compact Receiver Table)
  const signCardY = dateY + 24;
  const signCardH = 175;

  // --- Left: Company & Exemption notice (No duplicate supplier table) ---
  const leftX = 85;
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 17px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'left';
  const repTitle = sRep ? `대표이사 ${sRep} ` : '';
  ctx.fillText(`${sCorpName}  ${repTitle}(직인생략)`, leftX, signCardY + 68);

  ctx.fillStyle = '#555555';
  ctx.font = '13px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillText('※ 전자문서법에 의거 당사 직인을 생략하여 발행함', leftX, signCardY + 100);

  // --- Right: Compact Receiver Table ---
  const rTableX = 695;
  const rTableW = 440;
  const rHdrH = 34;
  const rRowH1 = 34;
  const rRowH2 = 34;
  const rSigH = signCardH - rHdrH - rRowH1 - rRowH2; // 73px
  const rLabelW = 120;

  // Outer border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(rTableX, signCardY, rTableW, signCardH);

  // Header
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(rTableX, signCardY, rTableW, rHdrH);
  ctx.strokeRect(rTableX, signCardY, rTableW, rHdrH);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 15px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('인  수  자  확  인', rTableX + rTableW / 2, signCardY + 23);

  // Row 1: 인수 담당자
  const r1Y = signCardY + rHdrH;
  ctx.beginPath();
  ctx.moveTo(rTableX, r1Y);
  ctx.lineTo(rTableX + rTableW, r1Y);
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(rTableX, r1Y, rLabelW, rRowH1);
  ctx.beginPath();
  ctx.moveTo(rTableX + rLabelW, r1Y);
  ctx.lineTo(rTableX + rLabelW, r1Y + rRowH1);
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 13.5px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('인수 담당자', rTableX + rLabelW / 2, r1Y + 22);

  ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(receiverName, rTableX + rLabelW + 14, r1Y + 22);

  // Row 2: 인수자 연락처
  const r2Y = r1Y + rRowH1;
  ctx.beginPath();
  ctx.moveTo(rTableX, r2Y);
  ctx.lineTo(rTableX + rTableW, r2Y);
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(rTableX, r2Y, rLabelW, rRowH2);
  ctx.beginPath();
  ctx.moveTo(rTableX + rLabelW, r2Y);
  ctx.lineTo(rTableX + rLabelW, r2Y + rRowH2);
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 13.5px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('인수자 연락처', rTableX + rLabelW / 2, r2Y + 22);

  ctx.font = '14px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(receiverPhone, rTableX + rLabelW + 14, r2Y + 22);

  // Row 3: 서명 또는 (인)
  const r3Y = r2Y + rRowH2;
  ctx.beginPath();
  ctx.moveTo(rTableX, r3Y);
  ctx.lineTo(rTableX + rTableW, r3Y);
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(rTableX, r3Y, rLabelW, rSigH);
  ctx.beginPath();
  ctx.moveTo(rTableX + rLabelW, r3Y);
  ctx.lineTo(rTableX + rLabelW, r3Y + rSigH);
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 13.5px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('서명 또는 (인)', rTableX + rLabelW / 2, r3Y + (rSigH / 2) + 5);

  // Signature Content
  const sigBoxX = rTableX + rLabelW;
  const sigBoxY = r3Y;
  const sigBoxW = rTableW - rLabelW;
  const sigBoxH = rSigH;

  if (signatureCanvas) {
    const pad = 6;
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
      const pad = 6;
      const targetW = sigBoxW - pad * 2;
      const targetH = sigBoxH - pad * 2;
      const scale = Math.min(targetW / sigImg.width, targetH / sigImg.height);
      const drawW = sigImg.width * scale;
      const drawH = sigImg.height * scale;
      const drawX = sigBoxX + (sigBoxW - drawW) / 2;
      const drawY = sigBoxY + (sigBoxH - drawH) / 2;

      ctx.drawImage(sigImg, drawX, drawY, drawW, drawH);
    }
  } else {
    ctx.fillStyle = '#555555';
    ctx.font = '13px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('(인수자 서명 또는 날인)', sigBoxX + sigBoxW / 2, sigBoxY + (sigBoxH / 2) + 5);
  }

  // 10. Footer
  const footLineY = signCardY + signCardH + 30;
  ctx.beginPath();
  ctx.moveTo(65, footLineY);
  ctx.lineTo(1135, footLineY);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = '13px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('※ 본 확인서는 모바일 전자서명 시스템을 통하여 인수자 본인이 직접 확인 및 자필 서명한 정식 납품확인서입니다.', 600, footLineY + 26);

  ctx.fillStyle = '#555555';
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
