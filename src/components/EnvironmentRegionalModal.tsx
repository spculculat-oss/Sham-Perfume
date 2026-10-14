import React, { useState } from 'react';
import {
  Compass,
  MapPin,
  Thermometer,
  Sparkles,
  Droplets,
  DollarSign,
  X,
  Check,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FlaskConical,
} from 'lucide-react';
import {
  REGIONAL_ENVIRONMENTS,
  UserEnvironmentProfile,
  saveUserEnvironment,
} from '../utils/environmentAdapter';
import { PyramidNote } from '../types/perfume';
import { ExtractedAIPerfume } from '../utils/aiFormulaExtractor';
import { useLanguage } from '../context/LanguageContext';
import { LText, makeT, fmt, pickArEn } from '../utils/localize';
import { isRTL } from '../utils/localizedContent';


const S = {
  header_badge: { ar: 'نظام التكيف البيئي والموطن الإقليمي', en: 'Environmental & Regional Habitat Adaptation System', fr: 'Système d’adaptation environnementale et régionale', es: 'Sistema de adaptación ambiental y regional', it: 'Sistema di adattamento ambientale e regionale', de: 'Umwelt- und Regionalanpassungssystem', ru: 'Система адаптации к среде и региону', zh: '环境与地区适配系统', tr: 'Çevresel ve bölgesel uyum sistemi', fa: 'سازگارسازی محیطی و منطقه‌ای' },
  header_title: { ar: 'تخصيص تجربة الموقع وفق بيئتك وموطنك الجغرافي', en: 'Customize the platform to your environment and geographic habitat', fr: 'Personnalisez la plateforme selon votre environnement géographique', es: 'Personaliza la plataforma según tu entorno geográfico', it: 'Personalizza la piattaforma secondo il tuo ambiente geografico', de: 'Passen Sie die Plattform an Ihre Umgebung und Region an', ru: 'Настройте платформу под вашу среду и регион', zh: '根据您的环境与地理位置定制平台体验', tr: 'Platformu çevrenize ve coğrafi konumunuza göre özelleştirin', fa: 'سفارشی‌سازی تجربه پلتفرم بر اساس محیط و موقعیت جغرافیایی شما' },
  why_title: { ar: 'لماذا يتكيف الموقع مع بيئتك وموطنك؟', en: 'Why does the platform adapt to your environment?', fr: 'Pourquoi la plateforme s’adapte-t-elle à votre environnement ?', es: '¿Por qué la plataforma se adapta a tu entorno?', it: 'Perché la piattaforma si adatta al tuo ambiente?', de: 'Warum passt sich die Plattform Ihrer Umgebung an?', ru: 'Почему платформа подстраивается под вашу среду?', zh: '平台为何要适应您的环境？', tr: 'Platform neden çevrenize uyum sağlar?', fa: 'چرا پلتفرم با محیط شما سازگار می‌شود؟' },
  why_p: { ar: 'تتأثر سرعة تبخر العطور وثباتها على الجلد بنسبة الرطوبة ودرجة حرارة الطقس. منصة «صمم عطرك مع شام» تضبط نسب التركيز المقترحة، كميات المثبتات (Fixatives)، وتوفر أكوردات العطور التراثية لكل منطقة وعملاتها المحلية بدقة.', en: 'Evaporation speed and skin longevity depend on humidity and temperature. «Design Your Perfume with Sham» calibrates suggested concentrations, fixative amounts, and heritage accords with local currencies for every region.', fr: 'La vitesse d’évaporation et la tenue cutanée dépendent de l’humidité et de la température. « Créez votre parfum avec Sham » ajuste concentrations, fixateurs et accords patrimoniaux avec les devises locales.', es: 'La evaporación y la fijación en piel dependen de la humedad y la temperatura. «Diseña tu perfume con Sham» calibra concentraciones, fijadores y acordes tradicionales con las divisas locales.', it: 'L’evaporazione e la tenuta sulla pelle dipendono da umidità e temperatura. «Crea il tuo profumo con Sham» calibra concentrazioni, fissativi e accordi tradizionali con le valute locali.', de: 'Verdunstung und Hautbeständigkeit hängen von Luftfeuchte und Temperatur ab. „Gestalten Sie Ihr Parfüm mit Sham“ justiert Konzentrationen, Fixative und traditionelle Akkorde samt Landeswährungen.', ru: 'Скорость испарения и стойкость зависят от влажности и температуры. «Создайте свой аромат с Sham» калибрует концентрации, фиксаторы и традиционные аккорды с местными валютами.', zh: '香水的挥发速度与肌肤留香取决于湿度与气温。「与 Sham 一同设计香水」会按地区校准建议浓度、固定剂用量、传统香调与本地货币。', tr: 'Buharlaşma hızı ve ciltteki kalıcılık nem ve sıcaklığa bağlıdır. «Parfümünüzü Sham ile tasarlayın»; konsantrasyonları, sabitleyicileri ve yerel para birimleriyle geleneksel akorları ayarlar.', fa: 'سرعت تبخیر عطر و ماندگاری آن بر پوست به رطوبت و دما بستگی دارد. «عطر خود را با شام بسازید» غلظت‌های پیشنهادی، مقدار ثابت‌کننده‌ها و آکوردهای سنتی هر منطقه را با ارز محلی تنظیم می‌کند.' },
  select_region_lbl: { ar: 'اختر موطنك أو البيئة المناخية المستهدفة:', en: 'Select your habitat or target climate:', fr: 'Choisissez votre habitat ou climat cible :', es: 'Elige tu hábitat o clima objetivo:', it: 'Scegli il tuo habitat o clima target:', de: 'Wählen Sie Ihr Umfeld oder Zielklima:', ru: 'Выберите ваш регион или целевой климат:', zh: '选择您的所在地或目标气候：', tr: 'Yaşam alanınızı veya hedef iklimi seçin:', fa: 'زیستگاه یا اقلیم هدف خود را انتخاب کنید:' },
  rec_conc_tpl: { ar: 'التركيز الموصى: {v}%', en: 'Recommended: {v}%', fr: 'Concentration conseillée : {v} %', es: 'Concentración recomendada: {v}%', it: 'Concentrazione consigliata: {v}%', de: 'Empfohlene Konzentration: {v} %', ru: 'Рекомендуемая концентрация: {v}%', zh: '建议浓度：{v}%', tr: 'Önerilen konsantrasyon: %{v}', fa: 'غلظت پیشنهادی: {v}٪' },
  current_env_lbl: { ar: 'الموطن والبيئة الحالية:', en: 'Current habitat & environment:', fr: 'Habitat et environnement actuels :', es: 'Hábitat y entorno actuales:', it: 'Habitat e ambiente attuali:', de: 'Aktuelles Umfeld & Umgebung:', ru: 'Текущий регион и среда:', zh: '当前所在地与环境：', tr: 'Mevcut yaşam alanı ve çevre:', fa: 'زیستگاه و محیط فعلی:' },
  currency_tpl: { ar: 'العملة: {code} ({sym})', en: 'Currency: {code} ({sym})', fr: 'Devise : {code} ({sym})', es: 'Moneda: {code} ({sym})', it: 'Valuta: {code} ({sym})', de: 'Währung: {code} ({sym})', ru: 'Валюта: {code} ({sym})', zh: '货币：{code}（{sym}）', tr: 'Para birimi: {code} ({sym})', fa: 'ارز: {code} ({sym})' },
  climate_advice_lbl: { ar: 'التوصية الكيميائية الخاصة بالمناخ:', en: 'Climate-specific chemical advice:', fr: 'Conseil chimique selon le climat :', es: 'Consejo químico según el clima:', it: 'Consiglio chimico per il clima:', de: 'Klimaspezifischer Chemierat:', ru: 'Химическая рекомендация по климату:', zh: '针对气候的化学建议：', tr: 'İklime özgü kimyasal tavsiye:', fa: 'توصیه شیمیایی خاص اقلیم:' },
  traditional_lbl: { ar: 'الأكوردات والنوتات التراثية الأكثر أصالة في هذه البيئة:', en: 'Most authentic heritage accords & notes of this environment:', fr: 'Accords patrimoniaux les plus authentiques de cet environnement :', es: 'Acordes tradicionales más auténticos de este entorno:', it: 'Accordi tradizionali più autentici di questo ambiente:', de: 'Authentischsten Traditionakkorde dieser Umgebung:', ru: 'Самые аутентичные традиционные аккорды этой среды:', zh: '此地最具代表性的传统香调：', tr: 'Bu çevrenin en otantik geleneksel akorları:', fa: 'اصیل‌ترین آکوردهای سنتی این محیط:' },
  apply_btn: { ar: 'تطبيق توليفة هذه البيئة التراثية مباشرة في حاسبة العطر والمعمل', en: 'Apply this heritage accord directly to the perfume lab calculator', fr: 'Appliquer cet accord traditionnel directement au calculateur', es: 'Aplicar este acorde tradicional directamente a la calculadora', it: 'Applica questo accordo tradizionale direttamente al calcolatore', de: 'Diesen Traditionskord direkt in den Rechner übernehmen', ru: 'Применить этот традиционный аккорд в калькуляторе', zh: '将此传统香调直接应用到香水实验室计算器', tr: 'Bu geleneksel akoru doğrudan hesaplayıcıya uygula', fa: 'اعمال مستقیم این آکورد سنتی در ماشین‌حساب آزمایشگاه عطر' },
  footer_note: { ar: 'يتم حفظ إعدادات البيئة والموطن تلقائياً ومزامنتها مع حاسبة التكاليف والتركيب.', en: 'Environment and habitat settings are saved automatically and synced with the costing and formulation calculators.', fr: 'Les réglages d’environnement sont enregistrés automatiquement et synchronisés avec les calculateurs.', es: 'Los ajustes de entorno se guardan automáticamente y se sincronizan con las calculadoras.', it: 'Le impostazioni ambientali vengono salvate automaticamente e sincronizzate con i calcolatori.', de: 'Umgebungseinstellungen werden automatisch gespeichert und mit den Rechnern synchronisiert.', ru: 'Настройки среды сохраняются автоматически и синхронизируются с калькуляторами.', zh: '环境与地区设置自动保存，并与成本及配方计算器同步。', tr: 'Çevre ayarları otomatik kaydedilir ve hesaplayıcılarla eşitlenir.', fa: 'تنظیمات محیط به‌طور خودکار ذخیره و با ماشین‌حساب‌های هزینه و فرمولاسیون همگام می‌شود.' },
  close_apply: { ar: 'إغلاق وتطبيق', en: 'Close & Apply', fr: 'Fermer et appliquer', es: 'Cerrar y aplicar', it: 'Chiudi e applica', de: 'Schließen & anwenden', ru: 'Закрыть и применить', zh: '关闭并应用', tr: 'Kapat ve uygula', fa: 'بستن و اعمال' },
} satisfies Record<string, LText>;

interface EnvironmentRegionalModalProps {
  currentProfile: UserEnvironmentProfile;
  onUpdateProfile: (newProfile: UserEnvironmentProfile) => void;
  onApplyRegionalFormulaToWorkbench: (formula: ExtractedAIPerfume) => void;
  onClose: () => void;
}

export const EnvironmentRegionalModal: React.FC<EnvironmentRegionalModalProps> = ({
  currentProfile,
  onUpdateProfile,
  onApplyRegionalFormulaToWorkbench,
  onClose,
}) => {
  const { currentLang } = useLanguage();
  const L = makeT(currentLang, S);
  const [selectedRegionId, setSelectedRegionId] = useState<string>(currentProfile.regionId);
  const activeProfile = REGIONAL_ENVIRONMENTS[selectedRegionId] || currentProfile;

  const handleSelectAndSave = (id: string) => {
    setSelectedRegionId(id);
    const updated = REGIONAL_ENVIRONMENTS[id] || currentProfile;
    saveUserEnvironment(updated);
    onUpdateProfile(updated);
  };

  const handleApplyRegionalFormula = () => {
    const rawNotes = activeProfile.traditionalNotes || [];
    const transformedNotes: PyramidNote[] = rawNotes.map((n: any, i: number) => ({
      id: `regional-note-${activeProfile.regionId}-${i}`,
      nameAr: n.nameAr,
      nameEn: n.nameEn,
      category: n.category,
      percentageOfOil: n.percentageOfOil,
      description: n.description,
    }));

    const formula: ExtractedAIPerfume = {
      title: `${pickArEn(currentLang, 'توليفة موطن: ', 'Home Blend: ')}${pickArEn(currentLang, activeProfile.countryNameAr, activeProfile.countryNameEn).split('(')[0].trim()}`,
      author: pickArEn(currentLang, 'معمل صمم عطرك مع شام الإقليمي', 'Sham Regional Perfume Lab'),
      bottleVolumeMl: 50,
      concentrationPercent: activeProfile.recommendedConcentrationPercent,
      concentrationType: activeProfile.recommendedConcentrationType,
      alcoholPercentage: 96,
      waterPercent: 0,
      fixativePercent: activeProfile.recommendedFixativePercent,
      macerationDays: activeProfile.climateType === 'hot_arid' ? 40 : 30,
      summary: `${pickArEn(currentLang, activeProfile.climateAdviceAr, activeProfile.climateAdviceEn)} - ${pickArEn(currentLang, 'مخصصة لبيئة ومناخ', 'Tailored for the climate of')} ${pickArEn(currentLang, activeProfile.countryNameAr, activeProfile.countryNameEn)}.`,
      pyramidNotes: transformedNotes.length > 0 ? transformedNotes : [
        { id: 'tn-1', nameAr: 'برغموت منعش', nameEn: 'Bergamot', category: 'top', percentageOfOil: 20 },
        { id: 'hn-1', nameAr: 'ياسمين وزهور', nameEn: 'Jasmine', category: 'heart', percentageOfOil: 40 },
        { id: 'bn-1', nameAr: 'صندل وعنبر', nameEn: 'Sandalwood', category: 'base', percentageOfOil: 40 },
      ],
    };

    onApplyRegionalFormulaToWorkbench(formula);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 text-stone-900">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-amber-400 animate-spin" />
              <span>{L('header_badge')}</span>
            </span>
            <h3 className="text-xl sm:text-2xl font-bold font-serif-luxury">
              {L('header_title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-full bg-stone-800 hover:bg-stone-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-8 space-y-6 text-xs sm:text-sm">
          
          {/* Explanation Banner */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-stone-700 leading-relaxed text-xs flex items-start gap-3">
            <Thermometer className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900 block mb-0.5">
                {L('why_title')}
              </span>
              {L('why_p')}
            </div>
          </div>

          {/* Region Selector Grid */}
          <div>
            <label className="font-bold text-stone-900 block mb-3 text-xs uppercase tracking-wider">
              {L('select_region_lbl')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(REGIONAL_ENVIRONMENTS).map((profile) => {
                const isSelected = profile.regionId === selectedRegionId;
                return (
                  <button
                    key={profile.regionId}
                    onClick={() => handleSelectAndSave(profile.regionId)}
                    className={`p-3.5 rounded-2xl border ${isRTL(currentLang) ? 'text-right' : 'text-left'} transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-amber-700 bg-amber-50/70 shadow-sm ring-2 ring-amber-700/20'
                        : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-stone-900 text-xs">
                          {pickArEn(currentLang, profile.countryNameAr, profile.countryNameEn).split('(')[0]}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-amber-600" />
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 line-clamp-1 mb-2">
                        {pickArEn(currentLang, profile.climateLabelAr, profile.climateLabelEn)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[10px] text-stone-600">
                      <span>{fmt(L('rec_conc_tpl'), { v: profile.recommendedConcentrationPercent })}</span>
                      <span className="font-bold text-amber-800">{pickArEn(currentLang, profile.currencySymbolAr, profile.currencySymbolEn)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Profile Details Card */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <span className="text-[11px] text-stone-500 block">{L('current_env_lbl')}</span>
                <span className="text-base font-bold text-stone-950 font-serif-luxury">
                  {pickArEn(currentLang, activeProfile.countryNameAr, activeProfile.countryNameEn)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200">
                  {pickArEn(currentLang, activeProfile.climateLabelAr, activeProfile.climateLabelEn)}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-stone-200 text-stone-800 text-xs font-mono font-bold">
                  {fmt(L('currency_tpl'), { code: activeProfile.currencyCode, sym: pickArEn(currentLang, activeProfile.currencySymbolAr, activeProfile.currencySymbolEn) })}
                </span>
              </div>
            </div>

            {/* Scientific Advice */}
            <div className="space-y-1">
              <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>{L('climate_advice_lbl')}</span>
              </span>
              <p className="text-stone-600 text-xs leading-relaxed">
                {pickArEn(currentLang, activeProfile.climateAdviceAr, activeProfile.climateAdviceEn)}
              </p>
            </div>

            {/* Traditional Accords */}
            <div className="space-y-2 pt-2">
              <span className="font-bold text-stone-900 text-xs block">
                {L('traditional_lbl')}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(activeProfile.traditionalNotes || []).map((note: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-stone-900">{note.nameAr}</div>
                      <div className="text-[10px] text-stone-400">{note.description}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-mono-numbers text-xs font-bold shrink-0">
                      {note.percentageOfOil}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="pt-2">
              <button
                onClick={handleApplyRegionalFormula}
                className="w-full py-3 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <FlaskConical className="w-4 h-4 text-amber-300" />
                <span>{L('apply_btn')}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            {L('footer_note')}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold cursor-pointer"
          >
            {L('close_apply')}
          </button>
        </div>

      </div>
    </div>
  );
};
