/**
 * مصفوفة الامتثال — Compliance Matrix
 * تربط كل مكون في المنصة بالمشاكل القانونية التي تمسه
 * يستخدمها الخبير القانوني لتوليد توصيات دقيقة لكل صفحة/مكون
 */

import { LEGAL_FINDINGS, type LegalFinding } from './legalExpert';

export interface ComponentRisk {
  component: string;
  file: string;
  descriptionAr: string;
  findings: string[]; // L-01...
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'safe';
}

export const COMPONENT_MATRIX: ComponentRisk[] = [
  {
    component: 'تسجيل الدخول / إنشاء حساب',
    file: 'src/components/AuthModal.tsx + src/utils/authStorage.ts',
    descriptionAr: 'نقطة جمع البيانات الشخصية الأساسية',
    findings: ['L-01', 'L-02', 'L-12', 'L-17', 'L-21'],
    riskLevel: 'critical',
  },
  {
    component: 'سياسة الخصوصية (Modal)',
    file: 'src/components/DataPrivacyModal.tsx',
    descriptionAr: 'الواجهة الحالية جميلة لكن غير كافية قانونًا',
    findings: ['L-02', 'L-12', 'L-21', 'L-22', 'L-23', 'L-24'],
    riskLevel: 'high',
  },
  {
    component: 'حاسبات التركيز والهرم والكحول',
    file: 'src/components/ConcentrationCalculator.tsx + AlcoholDilutionCalculator.tsx + PyramidCalculator.tsx + MacerationTimeSimulator.tsx',
    descriptionAr: 'تعطي وصفات كيميائية قابلة للتنفيذ',
    findings: ['L-04', 'L-18', 'L-29'],
    riskLevel: 'critical',
  },
  {
    component: 'موسوعة المواد الخام ودليل المثبتات',
    file: 'src/components/RawMaterialsEncyclopedia.tsx + AgingAndFixativesGuide.tsx',
    descriptionAr: 'معلومات كيميائية مفصلة، مواد مقيدة',
    findings: ['L-04', 'L-13', 'L-29'],
    riskLevel: 'high',
  },
  {
    component: 'المتجر والمنتجات',
    file: 'src/components/Storefront.tsx + ProductDetail.tsx + data/products.json',
    descriptionAr: 'عرض وبيع، هامش ربح، علامات تجارية',
    findings: ['L-03', 'L-08', 'L-09', 'L-13', 'L-18', 'L-20', 'L-28', 'L-36'],
    riskLevel: 'critical',
  },
  {
    component: 'الشحن والتوصيل',
    file: 'src/data/shipping.json + ProductDetail + checkout',
    descriptionAr: 'أسعار شحن، مواد خطرة، جمارك',
    findings: ['L-05', 'L-08', 'L-09', 'L-28'],
    riskLevel: 'critical',
  },
  {
    component: 'الخبير شاهين (AI Chat)',
    file: 'src/components/PerfumerAIChatbot.tsx + src/hooks/useShaheenChat.ts + server/core/engines.ts',
    descriptionAr: 'ردود مولدة بالذكاء الاصطناعي، نصائح كيميائية',
    findings: ['L-04', 'L-06', 'L-25', 'L-31'],
    riskLevel: 'critical',
  },
  {
    component: 'المساعد شام (Sham Assistant)',
    file: 'src/assistant/ShamAssistant.tsx + server/core/orchestrator.ts',
    descriptionAr: 'مساعد خدمات، يتعامل مع طلبات وعروض أسعار',
    findings: ['L-06', 'L-09', 'L-15', 'L-21'],
    riskLevel: 'high',
  },
  {
    component: 'المجتمع والرسائل',
    file: 'src/community/CommunityApp.tsx + Messenger.tsx + SocialPortal.tsx',
    descriptionAr: 'محتوى من المستخدمين، تفاعل اجتماعي',
    findings: ['L-14', 'L-17', 'L-23', 'L-25'],
    riskLevel: 'high',
  },
  {
    component: 'بوابة التجار',
    file: 'src/components/MerchantWorkspace.tsx + src/types/merchant.ts + src/community/MerchantPortal.tsx',
    descriptionAr: 'تسجيل تجار، بيانات بنكية، منتجات',
    findings: ['L-10', 'L-11', 'L-15', 'L-27', 'L-30'],
    riskLevel: 'high',
  },
  {
    component: 'إدارة المنصة (Admin)',
    file: 'src/admin/AdminApp.tsx + server/core/http.ts',
    descriptionAr: 'لوحة تحكم، وصول لبيانات حساسة',
    findings: ['L-01', 'L-10', 'L-15', 'L-16', 'L-21', 'L-22', 'L-33', 'L-35'],
    riskLevel: 'high',
  },
  {
    component: 'الخادم والـ API',
    file: 'server.ts + server/core/http.ts + api/main.py + firestore.rules',
    descriptionAr: 'CORS، تخزين، مصادقة، تشفير',
    findings: ['L-01', 'L-07', 'L-16', 'L-33', 'L-35'],
    riskLevel: 'critical',
  },
  {
    component: 'الـ Scraper والاستيراد',
    file: 'scripts/scraper/* + scripts/shaheen-import/*',
    descriptionAr: 'نسخ بيانات خارجية، علامات، صور',
    findings: ['L-03', 'L-13', 'L-18'],
    riskLevel: 'critical',
  },
  {
    component: 'الأخبار والمكتبات العالمية',
    file: 'src/components/WorldPerfumeNews.tsx + WorldPerfumesLibrary.tsx + src/data/perfumeNews.ts',
    descriptionAr: 'محتوى تحريري، صور، ذكر علامات',
    findings: ['L-13', 'L-18', 'L-20'],
    riskLevel: 'medium',
  },
  {
    component: 'التذييل والتنقل',
    file: 'src/components/Footer.tsx + Header.tsx + HomeHub.tsx',
    descriptionAr: 'روابط قانونية، معلومات شركة، لغة',
    findings: ['L-08', 'L-09', 'L-19', 'L-20', 'L-26', 'L-37'],
    riskLevel: 'high',
  },
  {
    component: 'البنية التحتية والنشر',
    file: 'vercel.json + edgeone.json + .github/workflows/* + docs/',
    descriptionAr: 'استضافة، نقل دولي، سجلات',
    findings: ['L-15', 'L-16', 'L-22', 'L-32', 'L-33', 'L-35'],
    riskLevel: 'medium',
  },
];

export function risksForComponent(fileFragment: string): ComponentRisk | undefined {
  return COMPONENT_MATRIX.find((c) => c.file.includes(fileFragment));
}

export function findingsForComponent(componentName: string): LegalFinding[] {
  const entry = COMPONENT_MATRIX.find((c) => c.component === componentName);
  if (!entry) return [];
  return entry.findings
    .map((id) => LEGAL_FINDINGS.find((f) => f.id === id)!)
    .filter(Boolean);
}

export function criticalComponents(): ComponentRisk[] {
  return COMPONENT_MATRIX.filter((c) => c.riskLevel === 'critical');
}

export function componentComplianceScore(componentName: string): number {
  const findings = findingsForComponent(componentName);
  if (findings.length === 0) return 100;
  const ded = findings.reduce((acc, f) => acc + (f.severity === 'critical' ? 8 : f.severity === 'high' ? 4 : f.severity === 'medium' ? 2 : 1), 0);
  return Math.max(0, 100 - ded * 2);
}
