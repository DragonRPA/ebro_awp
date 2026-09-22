import { EmailTemplateContext, EmailTemplateResult } from '../../types';

export const contractBundleEmail = (ctx: EmailTemplateContext): EmailTemplateResult => {
  const { custName, tenantCorp, tenantBrand, tenantTel, siteName, mappedAssetsCount = 0, uniqueModelList = [] } = ctx;
  return {
    subject: `[${tenantBrand}] ${custName} - ${siteName} 怨꾩빟???⑦궎吏`,
    body: `?덈뀞?섏떗?덇퉴, ${custName} ?대떦?먮떂.\n${tenantCorp} ?낅땲??\n\n?붿껌?섏떊 [${siteName}] ?꾩옣??怨꾩빟???⑦궎吏 泥⑤? ?뚯씪濡??〓??쒕┰?덈떎.\n\n??泥⑤? ?댁뿭 (?⑥씪 PDF):\n1. ?꾨?李?怨꾩빟??(1p)\n2. ?먯궛蹂?諛섏엯??CHECK LIST (${mappedAssetsCount}??\n3. ?먯궛蹂??덉쟾?먭?寃곌낵??(${mappedAssetsCount}??\n4. ?λ퉬 紐⑤뜽蹂?${uniqueModelList.join(', ')}) ?쒖썝???쒖썝, ?꾨㈃, ?묐룞踰??? 紐낆꽭??n5. ?곸뾽諛곗긽梨낆엫(PL)利앷텒 (湲곌컙 ??\n6. ?ъ뾽?먮벑濡앹쬆 (?낅줈????寃쎌슦)\n7. ?듭옣?щ낯 (?낅줈????寃쎌슦)\n\n?댁슜 寃?????쒕챸 諛?吏곸씤 ?좎씤?섏뿬 ?뚯떊 遺?곷뱶由쎈땲??\n\n媛먯궗?⑸땲??\n${tenantCorp} 諛곗긽\n?꾪솕: ${tenantTel}`
  };
};

export const statementEmail = (ctx: EmailTemplateContext): EmailTemplateResult => {
  const { custName, tenantCorp, tenantBrand, tenantTel } = ctx;
  return {
    subject: `[${tenantBrand}] ${custName} 嫄곕옒紐낆꽭???〓?`,
    body: `?덈뀞?섏떗?덇퉴, ${custName} ?대떦?먮떂.\n${tenantCorp} ?낅땲??\n\n?붿껌?섏떊 嫄곕옒紐낆꽭?쒕? 泥⑤? ?뚯씪濡??〓??쒕┰?덈떎.\n\n媛먯궗?⑸땲??\n${tenantCorp} 諛곗긽\n?꾪솕: ${tenantTel}`
  };
};
