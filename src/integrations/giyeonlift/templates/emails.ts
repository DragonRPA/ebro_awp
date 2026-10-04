import { EmailTemplateContext, EmailTemplateResult } from '../../types';

export const contractBundleEmail = (ctx: EmailTemplateContext): EmailTemplateResult => {
  const { custName, tenantCorp, tenantBrand, tenantTel, siteName, mappedAssetsCount = 0, uniqueModelList = [] } = ctx;
  const modelsText = uniqueModelList.length > 0 ? uniqueModelList.join(', ') : '전체 장비';

  return {
    subject: `[${tenantBrand}] ${custName} - ${siteName} 계약서패키지`,
    body: `안녕하십니까, ${custName} 담당자님.
${tenantCorp} 입니다.

요청하신 [${siteName}] 현장의 계약서패키지를 첨부 파일로 송부드립니다.

■ 첨부 서류 내역 (단일 패키지 PDF):
1. 고소작업대 임대차 계약서 (1p)
2. 자산별 반입 전 CHECK LIST (${mappedAssetsCount}대)
3. 자산별 안전점검 결과서 (${mappedAssetsCount}대)
4. 장비 모델별(${modelsText}) 제원표 (제원, 도면, 작동법 등 명세서)
5. 생산물배상책임(PL)보험증권 (계약기간 보증)
6. 사업자등록증 (사본)
7. 통장사본 (사본)

내용 검토 후 서명 및 직인 날인하시어 회신 부탁드립니다.

감사합니다.
${tenantCorp} 배상
전화: ${tenantTel}`
  };
};

export const statementEmail = (ctx: EmailTemplateContext): EmailTemplateResult => {
  const { custName, tenantCorp, tenantBrand, tenantTel } = ctx;
  return {
    subject: `[${tenantBrand}] ${custName} 거래명세표 송부`,
    body: `안녕하십니까, ${custName} 담당자님.
${tenantCorp} 입니다.

요청하신 거래명세표를 첨부 파일로 송부드립니다.

내용 확인 부탁드리며, 문의사항이 있으시면 언제든지 연락 주시기 바랍니다.

감사합니다.
${tenantCorp} 배상
전화: ${tenantTel}`
  };
};
