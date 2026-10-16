import React, { useState } from 'react';
import {
  HelpCircle,
  Beaker,
  Scale,
  Sparkles,
  Droplets,
  Layers,
  Thermometer,
  ShieldAlert,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Clock,
  Compass,
  AlertTriangle,
  Lightbulb,
  Search,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { SupportedLanguage } from '../types/i18n';
import { LText, makeT, pickArEn } from '../لغات/localize';

export interface CriterionExplanation {
  id: string;
  nameAr: string;
  nameEn: string;
  category: 'core' | 'chemistry' | 'pyramid' | 'production';
  summaryAr: string;
  summaryEn: string;
  importanceLevelAr: 'حرج جداً' | 'أساسي' | 'متقدم' | 'اختياري';
  importanceLevelEn: 'Critical' | 'Essential' | 'Advanced' | 'Optional';
  recommendedRangeAr: string;
  recommendedRangeEn: string;
  scientificDefinitionAr: string;
  scientificDefinitionEn: string;
  practicalImpactAr: string;
  practicalImpactEn: string;
  expertRuleAr: string;
  expertRuleEn: string;
  commonMistakesAr: string[];
  commonMistakesEn: string[];
  formulaOrExampleAr?: string;
  formulaOrExampleEn?: string;
}

export const CRITERIA_EXPLANATIONS: CriterionExplanation[] = [
  {
    id: 'bottle_volume',
    nameAr: 'حجم زجاجة العطر والفراغ الهوائي (Headspace)',
    nameEn: 'Bottle Volume & Expansion Headspace',
    category: 'core',
    importanceLevelAr: 'أساسي',
    importanceLevelEn: 'Essential',
    summaryAr: 'السعة الحجمية للزجاجة المستهدفة بالمليلتر، مع احتساب هامش الفراغ الهوائي لامتصاص التمدد الحراري.',
    summaryEn: 'Nominal bottle capacity in ml, including a critical headspace margin to absorb thermal liquid expansion.',
    recommendedRangeAr: '30ml (فاخر) · 50ml (شائع) · 100ml (قياسي)',
    recommendedRangeEn: '30ml (Luxury) · 50ml (Standard) · 100ml (Commercial)',
    scientificDefinitionAr:
      'الحجم الفعلي للسائل المعبأ داخل العبوة الزجاجية، مقاساً بالمليلتر عند درجة حرارة 20° مئوية.',
    scientificDefinitionEn:
      'The actual volumetric capacity filled inside the glass vial, measured at standard lab temperature (20°C).',
    practicalImpactAr:
      'يؤثر الحجم على كمية الرذاذ الخارجة وعمر الاستخدام. يجب ترك فراغ هوائي بنسبة (3% إلى 5%) أعلى الزجاجة ليعمل البخاخ (Atomizer) بسلاسة دون تسريب، ولتجنب انفجار أو شرخ الزجاجة عند ارتفاع درجات الحرارة صيفاً.',
    practicalImpactEn:
      'Volume dictates total sprays and packaging dimensions. Always leave a 3% to 5% air gap at the top to allow the atomizer dip tube to function smoothly without leaking or cracking the glass in warm climates.',
    expertRuleAr:
      'إذا كانت سعة الزجاجة 50 مل، فإن أفضل حجم للملء الصافي هو 48.5 إلى 50 مل بالضبط مع عدم ملء عنق الزجاجة حتى الفوهة.',
    expertRuleEn:
      'For a nominal 50ml bottle, target 48.5ml to 50ml net fill. Never fill into the narrow neck thread.',
    commonMistakesAr: [
      'ملء الزجاجة حتى الحافة تماماً، مما يمنع رأس المضخة من الانغماس ويسبب كسر الأنبوب أو التسريب.',
      'الخلط بين السعة الخارجية الكلية لجسم الزجاجة وبين السعة الداخلية المخصصة للسائل.',
    ],
    commonMistakesEn: [
      'Filling the bottle to the absolute brim, creating hydraulic pressure that damages the pump seal.',
      'Confusing the external outer glass mold dimensions with actual internal liquid capacity.',
    ],
    formulaOrExampleAr: 'حجم السائل المستهدف = حجم العبوة الاسمي (مثلاً 50ml)',
    formulaOrExampleEn: 'Net Target Fill = Nominal Bottle Capacity (e.g. 50ml)',
  },
  {
    id: 'batch_count',
    nameAr: 'عدد العبوات في التشغيلة (Batch Production)',
    nameEn: 'Batch Production Count & Scale-Up',
    category: 'production',
    importanceLevelAr: 'أساسي',
    importanceLevelEn: 'Essential',
    summaryAr: 'إجمالي العبوات المراد إنتاجها دفعة واحدة لحساب إجمالي الزيت والكحول والمثبتات دون هدر.',
    summaryEn: 'Total number of bottles produced in a single batch to compound raw materials without waste.',
    recommendedRangeAr: '1 عبوة (تجربة معملية) إلى 1000+ عبوة (إنتاج تجاري)',
    recommendedRangeEn: '1 unit (Lab prototype) to 1,000+ units (Commercial run)',
    scientificDefinitionAr:
      'مضاعف حجم التشغيلة الكيميائية (Batch Multiplier)، الذي يُحسب بناءً عليه إجمالي الكتلة المطلوب وزنها في وعاء المزج الأولي (Master Mixing Vessel).',
    scientificDefinitionEn:
      'Chemical batch scale multiplier used to calculate total mass weighed inside the primary compounding tank.',
    practicalImpactAr:
      'الإنتاج بالدفعات يقلل هدر الخامات بنسبة تصل إلى 12% مقارنة بتركيب كل زجاجة بمفردها، ويوحد التجانس ونقاء الرائحة عبر جميع الزجاجات الناتجة.',
    practicalImpactEn:
      'Batch compounding reduces raw material handling losses by up to 12% and ensures olfactory consistency across all bottles.',
    expertRuleAr:
      'في التشغيلات الكبيرة (أكثر من 20 عبوة)، اخلط الزيت والكحول في وعاء فولاذي غير قابل للصدأ (Stainless Steel 316) معتقاً إياهم معاً قبل التعبئة الفردية في الزجاجات.',
    expertRuleEn:
      'For batches over 20 bottles, compound oil and alcohol in a 316 stainless steel vessel, macerate together, then dispense into bottles.',
    commonMistakesAr: [
      'وزن كل عبوة في زجاجتها مباشرة عند إنتاج كميات تجارية بدلاً من خلط التشغيلة كاملة في وعاء موحد.',
      'عدم احتساب فاقد الفلترة (Filtration loss) البالغ عادة 1% إلى 2% في التشغيلات الكبيرة.',
    ],
    commonMistakesEn: [
      'Weighing ingredients into individual small bottles one by one during commercial production.',
      'Ignoring 1% to 2% filtration and transfer losses during large batch filtration.',
    ],
    formulaOrExampleAr: 'إجمالي وزن الزيت للتشغيلة = وزن الزيت للعبوة الواحدة × عدد العبوات',
    formulaOrExampleEn: 'Total Batch Oil Mass = Single Bottle Oil Mass × Unit Count',
  },
  {
    id: 'concentration_percent',
    nameAr: 'نسبة تركيز الزيت العطري (Fragrance Concentration %)',
    nameEn: 'Fragrance Oil Concentration Grade',
    category: 'core',
    importanceLevelAr: 'حرج جداً',
    importanceLevelEn: 'Critical',
    summaryAr: 'النسبة المئوية الحجمية للزيت العطري الخام النقي داخل الخليط الكلي، والتي تحدد درجة العطر وثباته وفوحانه.',
    summaryEn: 'Percentage of pure fragrance concentrate within the total formulation, determining longevity and category.',
    recommendedRangeAr: '15% - 22% (EDP) · 25% - 35% (Extrait) · 8% - 14% (EDT)',
    recommendedRangeEn: '15% - 22% (EDP) · 25% - 35% (Extrait) · 8% - 14% (EDT)',
    scientificDefinitionAr:
      'النسبة المئوية لحجم الزيت العطري العضوي النقي (Essential Oils & Aroma Chemicals) مقسوماً على الحجم الإجمالي النهائي للعطر (Volume/Volume %).',
    scientificDefinitionEn:
      'The volume percentage of neat aroma concentrate relative to the final total formulation volume (v/v %).',
    practicalImpactAr:
      'تحدد التركيزات العالية (Extrait) ثباتاً أطول على الجلد (12 - 24 ساعة) مع فوحان دافئ هادئ. بينما التركيزات المتوسطة (EDP و EDT) توفر انتشاراً ورذاذاً أوسع (Sillage & Projection) بسبب سرعة تطاير الكحول الحامل للنوتات.',
    practicalImpactEn:
      'High concentrations (Extrait) deliver outstanding skin longevity (12-24h) with intimate warmth, while EDP/EDT offer greater air projection due to higher alcohol evaporation rates.',
    expertRuleAr:
      'زيادة التركيز فوق 35% لا تعني بالضرورة عطراً أفضل! العطور عالية التركيز قد تفقد فوحانها وتصبح "مكتومة" لأن الكحول هو المحرك الأساسي لنقل الجزيئات العطرية في الهواء.',
    expertRuleEn:
      'Concentration above 35% does not mean better performance! Excess oil suppresses air sillage because ethanol is the carrier driving molecules into the air.',
    commonMistakesAr: [
      'الاعتقاد بأن تركيز 40% أو 50% يضمن فوحاناً أقوى؛ الحقيقة أنه يزيد الثبات لكنه يقيد الفوحان.',
      'استخدام نفس نسبة الزيت لجميع أنواع الزيوت دون مراعاة ثقل وقوة الرائحة.',
    ],
    commonMistakesEn: [
      'Believing 40% or 50% guarantees stronger projection; it increases tenacity but chokes air sillage.',
      'Using the exact same concentration for heavy ouds as delicate citruses.',
    ],
    formulaOrExampleAr: 'نسبة الزيت = (حجم الزيت العطري ÷ الحجم الكلي للعطر) × 100',
    formulaOrExampleEn: 'Oil % = (Fragrance Concentrate Volume ÷ Total Formula Volume) × 100',
  },
  {
    id: 'alcohol_purity',
    nameAr: 'درجة نقاوة الكحول الإيثيلي (Ethanol Alcohol Purity %)',
    nameEn: 'Ethanol Alcohol Purity Grade (% ABV)',
    category: 'chemistry',
    importanceLevelAr: 'حرج جداً',
    importanceLevelEn: 'Critical',
    summaryAr: 'نسبة الإيثانول النقي الخالي من الماء، والمطلوب إذابة الزيوت العطرية العضوية بكفاءة تامة.',
    summaryEn: 'Purity percentage of ethanol carrier, crucial for completely solubilizing organic aroma oils.',
    recommendedRangeAr: '96% (طبيعي زراعي) أو 99.9% (مطلق مقلوب للعطور)',
    recommendedRangeEn: '96% (Natural perfumers grade) or 99.9% (Anhydrous absolute)',
    scientificDefinitionAr:
      'نسبة نقاوة الإيثانول الطبيعي (C2H5OH) المستخلص من التقطير الزراعي، الممزوج بمغير رائحة معتمد مثل Bitrex أو Tert-Butanol.',
    scientificDefinitionEn:
      'Volumetric purity of natural ethanol (C2H5OH) derived from grain or sugar cane fermentation, denatured with certified food-grade bitters.',
    practicalImpactAr:
      'الكحول هو المذيب الأساسي والناقل لجميع مكونات العطر. كحول 96% يذيب كافة الزيوت والراتنجات الثقيلة. استخدام كحول أقل من 95% يسبب فشل الذوبان وتعكر العطر فوراً.',
    practicalImpactEn:
      'Ethanol is the universal solvent and carrier. 96% purity dissolves heavy resins and oils without cloudiness. Anything below 95% causes phase separation (louche effect).',
    expertRuleAr:
      'احرص دائماً على كحول خالي من رائحة الألدهيدات أو الخميرة. أفضل كحول هو كحول الحبوب أو الشمندر الفرنسي أو كحول القصب الطبيعي عالي النقاء.',
    expertRuleEn:
      'Always select cosmetic perfumers alcohol free of harsh heads or fusel oils. Grain or French beet neutral spirit provides the cleanest canvas.',
    commonMistakesAr: [
      'استخدام كحول الصيدليات الطبي بتركيز 70%؛ يحتوي على 30% ماء مما يؤدي لانفصال الزيت فوراً!',
      'استخدام كحول الميثانول الصناعي السام، وهو ممنوع دولياً ومسرطن.',
    ],
    commonMistakesEn: [
      'Using 70% rub alcohol from pharmacies; its 30% water content immediately causes cloudy oil separation.',
      'Using industrial toxic methanol, which is dangerous, prohibited, and carcinogenic.',
    ],
    formulaOrExampleAr: 'الكحول الموصى به: إيثانول 96% طبيعي مخصص للعطور',
    formulaOrExampleEn: 'Recommended Carrier: 96% Perfumers Ethyl Alcohol',
  },
  {
    id: 'distilled_water',
    nameAr: 'نسبة الماء المقطر (Distilled Water %)',
    nameEn: 'Purified Distilled Water Ratio (%)',
    category: 'chemistry',
    importanceLevelAr: 'متقدم',
    importanceLevelEn: 'Advanced',
    summaryAr: 'نسبة الماء المقطر المعقم المضاف لكسر حدة وخز الكحول الأولى وترطيب الرذاذ العطري.',
    summaryEn: 'Deionized distilled water added in micro amounts (0-2%) to soften initial alcohol harshness.',
    recommendedRangeAr: '0% إلى 2% كحد أقصى (اختياري)',
    recommendedRangeEn: '0% to 2% max (Optional formulation step)',
    scientificDefinitionAr:
      'ماء نقي تماماً منزوع الأيونات والأملاح والكلور (Aqua Deionata / Purified Water)، ذو كثافة 1.00 جم/مل.',
    scientificDefinitionEn:
      'Demineralized deionized water (Aqua Purificata), free of chlorine, minerals, and conductive salts, density 1.00 g/ml.',
    practicalImpactAr:
      'إضافة 1% إلى 2% ماء مقطر يساعد في إبطاء انفجار الكحول السريع في الثواني الأولى من الرش، مما يقلل "لسعة الكحول" في الأنف ويمنح ملمساً ناعماً على الجلد. لكن أي زيادة فوق 3% تؤدي فوراً لظاهرة التعكر.',
    practicalImpactEn:
      'Adding 1-2% softens initial sharp alcohol flare upon skin contact. Exceeding 2.5-3% triggers irreversible cloudiness and milky precipitation.',
    expertRuleAr:
      'إذا كانت تركيبتك تحتوي على زيوت حمضية غنية بالليمونين أو راتنجات ثقيلة كاللبان والجاوي، اجعل نسبة الماء 0% لتجنب أي تعكر.',
    expertRuleEn:
      'If your formula contains terpenes (citrus) or natural resins (frankincense, benzoin), keep water strictly at 0%.',
    commonMistakesAr: [
      'استخدام ماء الصنبور العادي؛ الأملاح والكلور ستتفاعل مع الزيوت وتسد فوهة البخاخ وترسب شوائب بيضاء.',
      'رفع نسبة الماء فوق 4% في محاولة للتوفير، مما يتسبب في عتامة العطر.',
    ],
    commonMistakesEn: [
      'Using tap or mineral water; chlorine and minerals react with oils, clogging atomizers with white scale.',
      'Adding 5%+ water to cut costs, ruining fragrance clarity and longevity.',
    ],
    formulaOrExampleAr: 'نسبة الماء المقطر القصوى المأمونة = 0% - 2.5% من إجمالي الحجم',
    formulaOrExampleEn: 'Safe Distilled Water Range = 0.0% to 2.0% max',
  },
  {
    id: 'fixatives',
    nameAr: 'نسبة ونوع المثبت العطري (Fixative Ratio & Chemistry)',
    nameEn: 'Fixative Chemical Ratio & Modern Carriers',
    category: 'chemistry',
    importanceLevelAr: 'أساسي',
    importanceLevelEn: 'Essential',
    summaryAr: 'مركبات بطيئة التبخر تخفض ضغط البخار الجزيئي للزيوت وتطيل عمر النوتات المتطايرة على الجلد.',
    summaryEn: 'High molecular weight compounds lowering vapor pressure and anchoring volatile accords on skin.',
    recommendedRangeAr: '0.5% إلى 2% (النموذجي 1%)',
    recommendedRangeEn: '0.5% to 2% (Benchmark: 1.0%)',
    scientificDefinitionAr:
      'مواد كيميائية ذات وزن جزيئي مرتفع وضغط بخار منخفض جداً، تعمل على إبطاء سرعة تبخر الجزيئات الخفيفة دون التأثير على توازن الرائحة.',
    scientificDefinitionEn:
      'High boiling-point carriers with low vapor pressures that form intermolecular van der Waals attractions with volatile aromatics.',
    practicalImpactAr:
      'تمنع المثبتات تبخر النوتات العليا في دقائق معدودة، وتحافظ على تماسك العطر وتجانسه طوال اليوم. كما تحسن التصاق العطر بألياف القماش ومسامات الجلد.',
    practicalImpactEn:
      'Fixatives prevent top notes from flashing off too quickly, prolonging harmonic progression and improving skin substantivity.',
    expertRuleAr:
      'من أشهر المثبتات الحديثة: DPG لرفع ثبات النوتات الزهرية، IPM لتسريع الانتشار وتقليل التزييت، وجزيئات Iso E Super و Ambroxan كمثبتات عطرية فاخرة.',
    expertRuleEn:
      'Standard modern fixatives include DPG (water-soluble stabilizer), IPM (dry-touch solvent enhancer), and captive aroma molecules like Iso E Super & Ambroxan.',
    commonMistakesAr: [
      'المبالغة في المثبت فوق 4%؛ يؤدي ذلك لكتم فوحان العطر وجعله ثقيلاً ولزجاً يترك بقعاً على الملابس.',
      'استخدام مثبتات زيتية غير نقية أو غير متوافقة مع الكحول.',
    ],
    commonMistakesEn: [
      'Over-dosing fixative past 4%, muffling sillage and causing oily stains on textiles.',
      'Using thick non-cosmetic oils that break alcohol solubility.',
    ],
    formulaOrExampleAr: 'النسبة المثالية = 0.5% إلى 1.5% من إجمالي حجم العطر',
    formulaOrExampleEn: 'Ideal Fixative Ratio = 0.5% to 1.5% total formula',
  },
  {
    id: 'oil_density',
    nameAr: 'كثافة الزيت العطري النوعية (Oil Specific Gravity - g/ml)',
    nameEn: 'Fragrance Oil Specific Gravity (Density g/ml)',
    category: 'chemistry',
    importanceLevelAr: 'حرج جداً',
    importanceLevelEn: 'Critical',
    summaryAr: 'وزن وحدة الحجم من الزيت مقارنة بالماء (المتوسط 0.92 جم/مل)، وهو سر التحويل بين الجرام والمليلتر.',
    summaryEn: 'Mass per unit volume of essential oil relative to water (average 0.92 g/ml), critical for gravimetric accuracy.',
    recommendedRangeAr: '0.88 إلى 0.96 جم/مل (الافتراضي المعياري: 0.92 g/ml)',
    recommendedRangeEn: '0.88 to 0.96 g/ml (Default lab standard: 0.92 g/ml)',
    scientificDefinitionAr:
      'كتلة السنتيمتر المكعب من الزيت العطري عند 20°م. نظراً لأن الزيوت العطرية تتكون من مركبات تربينية وكحولية أخف من الماء، فإن كثافتها أقل من 1.0 جم/مل.',
    scientificDefinitionEn:
      'Mass per cubic centimeter of neat aroma oil at 20°C. Because terpenes and aromatic alcohols are lighter than water, density is typically 0.88-0.96 g/ml.',
    practicalImpactAr:
      'لأن كثافة الزيت 0.92 جم/مل، فإن 10 مل زيت تزن 9.2 جرام فقط على الميزان! إهمال الكثافة يسبب خطأ بنسبة 8% في التركيز.',
    practicalImpactEn:
      'Because oil density is 0.92 g/ml, 10ml of oil weighs only 9.2 grams! Ignoring density introduces an 8% calculation error.',
    expertRuleAr:
      'الزيوت الحمضية خفيفة (~0.86 - 0.88). الزيوت الزهرية ~0.90 - 0.93. والزيوت الراتنجية الثقيلة كالعود والباتشولي تصل إلى 0.95 - 0.98.',
    expertRuleEn:
      'Citrus oils are lighter (~0.86-0.88 g/ml). Floral absolutes ~0.90-0.93. Heavy resins (oud, patchouli) reach 0.95-0.98 g/ml.',
    commonMistakesAr: [
      'افتراض أن 1 مل زيت = 1 جم زيت؛ هذا خطأ شائع يقع فيه الهواة ويؤدي لاختلال الميزان المعملي.',
    ],
    commonMistakesEn: [
      'Assuming 1ml of oil equals 1 gram of weight; this fundamental volumetric mistake ruins formula repeatability.',
    ],
    formulaOrExampleAr: 'الوزن بالجرام = الحجم بالمليلتر × الكثافة (جم/مل) [9.2g = 10ml × 0.92]',
    formulaOrExampleEn: 'Weight (g) = Volume (ml) × Specific Gravity [9.2g = 10ml × 0.92]',
  },
  {
    id: 'alcohol_density',
    nameAr: 'كثافة الكحول الإيثيلي (Ethanol Density - g/ml)',
    nameEn: 'Ethanol Specific Gravity (0.80 g/ml)',
    category: 'chemistry',
    importanceLevelAr: 'حرج جداً',
    importanceLevelEn: 'Critical',
    summaryAr: 'كثافة الإيثانول 96% تبلغ تقريباً 0.80 - 0.81 جم/مل عند 20°م، وهو أخف بكثير من الماء.',
    summaryEn: '96% ethanol density is approximately 0.80 g/ml at 20°C, significantly lighter than water.',
    recommendedRangeAr: '0.80 إلى 0.81 جم/مل للكحول 96%',
    recommendedRangeEn: '0.80 to 0.81 g/ml for 96% ethanol',
    scientificDefinitionAr:
      'الكثافة النوعية لمحلول الإيثانول النقي الممزوج بـ 4% ماء طبيعي.',
    scientificDefinitionEn:
      'Physical density of an azeotropic ethanol-water solution (96% vol alcohol, 4% vol water) at 20°C.',
    practicalImpactAr:
      'حجم 50 مل من الكحول الإيثيلي يزن 40 جراماً فقط على الميزان! لذلك عند وضع الزجاجة على الميزان، نزن 40 جراماً وليس 50.',
    practicalImpactEn:
      '50ml of ethanol weighs only 40.1 grams on the precision balance! Weighing 50 grams by mistake would overflow the bottle.',
    expertRuleAr:
      'استخدم ميزاناً حساساً بدقة 0.01 جم دائماً لتعبئة الكحول مباشرة بالجرامات دون الحاجة لمخبار زجاجي.',
    expertRuleEn:
      'Always tare the digital scale and dispense alcohol directly by grams without messy transfer cylinders.',
    commonMistakesAr: [
      'وزن 50 جم كحول اعتقاداً بأنه يعادل 50 مل، مما يؤدي إلى زيادة حجم السائل وفيضانه خارج الزجاجة.',
    ],
    commonMistakesEn: [
      'Weighing 50 grams of alcohol thinking it equals 50ml, resulting in liquid spilling over the neck.',
    ],
    formulaOrExampleAr: 'وزن الكحول (جم) = حجم الكحول (مل) × 0.803 [40.15g = 50ml × 0.803]',
    formulaOrExampleEn: 'Alcohol Mass (g) = Volume (ml) × 0.803 [40.15g = 50ml × 0.803]',
  },
  {
    id: 'mass_vs_volume',
    nameAr: 'معيار الوزن الرقمي بالجرام مقابل الحجم بالمخبار (Mass vs Volume)',
    nameEn: 'Gravimetric (Weight) vs Volumetric Measurement',
    category: 'core',
    importanceLevelAr: 'حرج جداً',
    importanceLevelEn: 'Critical',
    summaryAr: 'لماذا تعتمد معامل العطور العالمية الميزان الرقمي بالغرام كمعيار قطعي لا يقبل الخطأ.',
    summaryEn: 'Why professional perfumery laboratories strictly compound by gravimetric weight (0.01g).',
    recommendedRangeAr: 'ميزان رقمي بدقة 0.01 جم أو 0.001 جم',
    recommendedRangeEn: 'Analytical digital scale: 0.01g or 0.001g precision',
    scientificDefinitionAr:
      'القياس الكتلي المباشر (Gravimetric Formulation) حيث يُقاس كل مكون بكتلته الصافية على الميزان المعملي داخل وعاء الخلط مباشرة.',
    scientificDefinitionEn:
      'Direct gravimetric compounding where every ingredient is tared and measured strictly by net mass in grams.',
    practicalImpactAr:
      'الزيوت العطرية مادة لزجة تلتصق بجدران المخابر الزجاجية والماصات، مما يهدر حتى 1.5 مل في كل عبوة. الميزان يضمن دقة 100% دون أي فاقد.',
    practicalImpactEn:
      'Viscous perfume oils adhere to glass pipette walls, causing up to 1.5ml transfer loss. Weighing directly into the vessel guarantees 100% precision.',
    expertRuleAr:
      'ضع زجاجة العطر الفارغة على الميزان، واضغط "صفر" (Tare)، ثم صب الزيت مباشرة بالجرامات المطلوبة، ثم صفّر الميزان وصب الكحول والمثبت.',
    expertRuleEn:
      'Place bottle on scale, press Tare, dispense oil to the exact hundredth gram, tare again, and dispense alcohol.',
    commonMistakesAr: [
      'استخدام السرنجات أو المخابر البلاستيكية الرخيصة التي تتفاعل مع المذيبات العطرية.',
      'الاعتماد على موازين المطبخ ذات دقة 1 جم؛ صناعة العطور تتطلب دقة 0.01 جم.',
    ],
    commonMistakesEn: [
      'Using cheap plastic syringes that leach plasticizers into organic oils.',
      'Relying on kitchen scales with 1g precision; fragrance formulation demands at least 0.01g.',
    ],
    formulaOrExampleAr: 'دقة معيار شام: 0.01g ميزان معملي رقمي مباشر',
    formulaOrExampleEn: 'Sham Laboratory Precision Standard: 0.01g Gravimetric',
  },
  {
    id: 'maceration',
    nameAr: 'فترة التعتيق والإنضاج الكيميائي (Maceration & Maturation)',
    nameEn: 'Maceration Period & Olfactory Maturation',
    category: 'core',
    importanceLevelAr: 'أساسي',
    importanceLevelEn: 'Essential',
    summaryAr: 'الوقت اللازم لامتزاج جزيئات الزيت مع الكحول وتشكيل روابط إسترية متوازنة تخفي حدة الكحول.',
    summaryEn: 'Required resting period for oil and alcohol molecules to form acetals and esters, rounding off harshness.',
    recommendedRangeAr: '14 إلى 45 يوماً (النموذجي 30 يوماً في مكان بارد ومظلم)',
    recommendedRangeEn: '14 to 45 days (Benchmark: 30 days in cool, dark cellar)',
    scientificDefinitionAr:
      'تفاعل كيميائي بطيء بين كحول الإيثانول وجزيئات الألدهيدات والأحماض العضوية لتكوين الأسيتالات (Acetals) والإسترات العطرية المستقرة.',
    scientificDefinitionEn:
      'Slow equilibrium esterification and acetalization between ethanol and organic aromachemicals.',
    practicalImpactAr:
      'العطر الطازج بعد الخلط مباشرة يكون حاداً برائحة كحول بارزة. بعد التعتيق يندمج الكحول بالكامل وتصبح الرائحة ناعمة ومخملية وأكثر ثباتاً.',
    practicalImpactEn:
      'Freshly mixed perfume smells disjointed and harsh. Maceration rounds sharp edges into a cohesive, velvety luxury sillage.',
    expertRuleAr:
      'احفظ العطور أثناء التعتيق في قوارير زجاجية بنية أو أوعية ستانلس ستيل محكمة الإغلاق عند درجة حرارة 14° - 18° مئوية.',
    expertRuleEn:
      'Store macerating perfume in amber glass bottles away from sunlight at constant cellar temperatures (14-18°C).',
    commonMistakesAr: [
      'استخدام العطر أو الحكم عليه فور خلطه باليد دون إمهاله 3 أسابيع على الأقل.',
      'وضع العطر في الثلاجة (الفريزر) لتسريع التعتيق، مما يجمد الزيوت ويبطئ التفاعل الطبيعي.',
    ],
    commonMistakesEn: [
      'Judging or selling the perfume right after mixing without allowing proper 3-4 week maturation.',
      'Freezing the perfume in a domestic freezer, stopping natural esterification.',
    ],
    formulaOrExampleAr: 'مدة التعتيق القياسية = 30 يوماً في مكان معتم وبارد',
    formulaOrExampleEn: 'Recommended Maceration = 30 Days in Cool, Dark Cellar',
  },
];


const S = {
  header_title: { ar: 'دليل شرح معايير ومعادلات حاسبة العطور المعملية', en: 'Fragrance Formulation Laboratory Criteria & Chemistry Guide', fr: 'Guide des critères et formules du calculateur de parfum', es: 'Guía de criterios y fórmulas de la calculadora de perfumes', it: 'Guida ai criteri e alle formule del calcolatore di profumi', de: 'Leitfaden zu Kriterien und Formeln des Parfümrechners', ru: 'Руководство по критериям и формулам калькулятора парфюмерии', zh: '香水计算器准则与公式指南', tr: 'Parfüm hesaplayıcı kriterleri ve formülleri rehberi', fa: 'راهنمای معیارها و فرمول‌های ماشین‌حساب عطر' },
  back_to_calc_tooltip: { ar: 'العودة للحاسبة', en: 'Back to calculator', fr: 'Retour au calculateur', es: 'Volver a la calculadora', it: 'Torna al calcolatore', de: 'Zurück zum Rechner', ru: 'Вернуться к калькулятору', zh: '返回计算器', tr: 'Hesaplayıcıya dön', fa: 'بازگشت به ماشین‌حساب' },
  close_return: { ar: '✕ إغلاق الدليل والعودة للحاسبة', en: '✕ Close & Return to Calculator', fr: '✕ Fermer et revenir au calculateur', es: '✕ Cerrar y volver a la calculadora', it: '✕ Chiudi e torna al calcolatore', de: '✕ Schließen & zum Rechner zurück', ru: '✕ Закрыть и вернуться к калькулятору', zh: '✕ 关闭并返回计算器', tr: '✕ Kapat ve hesaplayıcıya dön', fa: '✕ بستن راهنما و بازگشت به ماشین‌حساب' },
  tab_all: { ar: 'جميع المعايير', en: 'All Criteria', fr: 'Tous les critères', es: 'Todos los criterios', it: 'Tutti i criteri', de: 'Alle Kriterien', ru: 'Все критерии', zh: '全部准则', tr: 'Tüm kriterler', fa: 'همه معیارها' },
  tab_core: { ar: 'المعايير الأساسية', en: 'Core Metrics', fr: 'Critères essentiels', es: 'Criterios esenciales', it: 'Criteri essenziali', de: 'Kernkriterien', ru: 'Основные критерии', zh: '核心指标', tr: 'Temel ölçütler', fa: 'معیارهای اصلی' },
  tab_chemistry: { ar: 'المذيبات والكيمياء', en: 'Solvents & Chemistry', fr: 'Solvants et chimie', es: 'Disolventes y química', it: 'Solventi e chimica', de: 'Lösemittel & Chemie', ru: 'Растворители и химия', zh: '溶剂与化学', tr: 'Çözücüler ve kimya', fa: 'حلال‌ها و شیمی' },
  tab_production: { ar: 'التشغيل والإنتاج', en: 'Batch Production', fr: 'Production en lot', es: 'Producción por lote', it: 'Produzione a lotto', de: 'Chargenproduktion', ru: 'Серийное производство', zh: '批量生产', tr: 'Parti üretimi', fa: 'تولید دسته‌ای' },
  search_ph: { ar: 'ابحث في المعايير (كحول، فراغ، مثبت)...', en: 'Search criteria (alcohol, fixative, headspace)...', fr: 'Rechercher (alcool, fixateur, headspace)...', es: 'Buscar criterios (alcohol, fijador, headspace)...', it: 'Cerca criteri (alcol, fissativo, headspace)...', de: 'Kriterien suchen (Alkohol, Fixativ, headspace)...', ru: 'Поиск по критериям (спирт, фиксатор, headspace)...', zh: '搜索准则（酒精、固定剂、顶空）……', tr: 'Kriter ara (alkol, sabitleyici, hava boşluğu)...', fa: 'جستجوی معیارها (الکل، ثابت‌کننده، فضای خالی)...' },
  no_results: { ar: 'لا توجد نتائج مطابقة لبحثك.', en: 'No criteria matching your search query.', fr: 'Aucun critère ne correspond à votre recherche.', es: 'Ningún criterio coincide con tu búsqueda.', it: 'Nessun criterio corrisponde alla tua ricerca.', de: 'Keine Kriterien stimmen mit Ihrer Suche überein.', ru: 'Нет критериев, соответствующих вашему запросу.', zh: '没有符合搜索的准则。', tr: 'Aramanızla eşleşen kriter yok.', fa: 'معیاری مطابق جستجوی شما یافت نشد.' },
  collapse: { ar: 'طي الشرح ▲', en: 'Collapse ▲', fr: 'Réduire ▲', es: 'Contraer ▲', it: 'Comprimi ▲', de: 'Einklappen ▲', ru: 'Свернуть ▲', zh: '收起 ▲', tr: 'Daralt ▲', fa: 'جمع‌کردن ▲' },
  read_full: { ar: 'قراءة الشرح الكامل ▼', en: 'Read Full Guide ▼', fr: 'Lire le guide complet ▼', es: 'Leer la guía completa ▼', it: 'Leggi la guida completa ▼', de: 'Vollständige Anleitung ▼', ru: 'Читать полностью ▼', zh: '阅读完整指南 ▼', tr: 'Tam rehberi oku ▼', fa: 'خواندن راهنمای کامل ▼' },
  range_lbl: { ar: 'النطاق والقيم النموذجية الموصى بها:', en: 'Recommended Lab Benchmark Range:', fr: 'Plage de référence recommandée :', es: 'Rango de referencia recomendado:', it: 'Intervallo di riferimento consigliato:', de: 'Empfohlener Labor-Richtwert:', ru: 'Рекомендуемый лабораторный диапазон:', zh: '推荐实验室基准范围：', tr: 'Önerilen laboratuvar aralığı:', fa: 'محدوده مرجع توصیه‌شده آزمایشگاهی:' },
  definition_lbl: { ar: 'التعريف العلمي والمعملي للمعيار:', en: 'Scientific Definition & Formulation Physics:', fr: 'Définition scientifique et physique :', es: 'Definición científica y física:', it: 'Definizione scientifica e fisica:', de: 'Wissenschaftliche Definition & Physik:', ru: 'Научное определение и физика:', zh: '科学定义与配方物理：', tr: 'Bilimsel tanım ve formülasyon fiziği:', fa: 'تعریف علمی و فیزیک فرمولاسیون:' },
  impact_lbl: { ar: 'أثر المعيار على العطر (الثبات والفوحان):', en: 'Practical Olfactory Impact (Longevity & Sillage):', fr: 'Impact olfactif pratique (tenue et sillage) :', es: 'Impacto olfativo práctico (fijación y estela):', it: 'Impatto olfattivo pratico (persistenza e scia):', de: 'Praktische Duftwirkung (Haltbarkeit & Sillage):', ru: 'Практическое влияние (стойкость и шлейф):', zh: '实际嗅觉影响（持久度与扩散）：', tr: 'Pratik koku etkisi (kalıcılık ve iz):', fa: 'اثر عملی بویایی (ماندگاری و انتشار):' },
  rule_lbl: { ar: 'قاعدة ونصيحة الخبير الكيميائي (Master Rule):', en: 'Master Perfumer Laboratory Rule:', fr: 'Règle du maître parfumeur :', es: 'Regla del perfumista maestro:', it: 'Regola del maestro profumiere:', de: 'Regel des Meisterparfümeurs:', ru: 'Правило мастера-парфюмера:', zh: '调香大师守则：', tr: 'Usta parfümör kuralı:', fa: 'قانون عطرساز حرفه‌ای:' },
  mistakes_lbl: { ar: 'أخطاء شائعة يقع فيها الكثيرون يجب تجنبها:', en: 'Common Formulating Pitfalls to Avoid:', fr: 'Erreurs courantes à éviter :', es: 'Errores comunes que conviene evitar:', it: 'Errori comuni da evitare:', de: 'Häufige Fehler, die es zu vermeiden gilt:', ru: 'Распространённые ошибки, которых следует избегать:', zh: '应避免的常见配方误区：', tr: 'Kaçınılması gereken yaygın hatalar:', fa: 'خطاهای رایجی که باید از آن‌ها پرهیز کرد:' },
  formula_lbl: { ar: 'المعادلة المعملية:', en: 'Lab Formula:', fr: 'Formule de laboratoire :', es: 'Fórmula de laboratorio:', it: 'Formula di laboratorio:', de: 'Laborformel:', ru: 'Лабораторная формула:', zh: '实验室公式：', tr: 'Laboratuvar formülü:', fa: 'فرمول آزمایشگاهی:' },
  footer_validated: { ar: 'تمت مراجعة جميع المعايير وفقاً لدساتير العطور العالمية ومعايير IFRA الدولية.', en: 'All criteria validated according to international IFRA safety standards and haute perfumery codex.', fr: 'Tous les critères validés selon les normes IFRA et le codex de la haute parfumerie.', es: 'Todos los criterios validados según las normas IFRA y el códice de la alta perfumería.', it: 'Tutti i criteri convalidati secondo le norme IFRA e il codice dell’alta profumeria.', de: 'Alle Kriterien geprüft nach IFRA-Normen und dem Codex der Haute Parfumerie.', ru: 'Все критерии проверены по стандартам IFRA и кодексу высокой парфюмерии.', zh: '所有准则均依据国际 IFRA 安全标准与高级香水准则审核。', tr: 'Tüm kriterler IFRA standartlarına göre doğrulandı.', fa: 'همه معیارها مطابق استانداردهای IFRA و قانون‌نامه عطرسازی حرفه‌ای بازبینی شده‌اند.' },
  return_to_calc: { ar: 'تطبيق المعايير في الحاسبة ←', en: 'Return to Formulation Calculator ←', fr: 'Revenir au calculateur ←', es: 'Volver a la calculadora ←', it: 'Torna al calcolatore ←', de: 'Zum Formulierungsrechner ←', ru: 'Вернуться к калькулятору ←', zh: '返回配方计算器 ←', tr: 'Formül hesaplayıcıya dön ←', fa: 'بازگشت به ماشین‌حساب فرمولاسیون ←' },
} satisfies Record<string, LText>;

interface CalculatorCriteriaGuideProps {
  onClose?: () => void;
  currentLang?: SupportedLanguage;
}

export const CalculatorCriteriaGuide: React.FC<CalculatorCriteriaGuideProps> = ({
  onClose,
  currentLang: propLang,
}) => {
  const { currentLang: ctxLang, t } = useLanguage();
  const effectiveLang = propLang || ctxLang || 'ar';
  const isRTL = effectiveLang === 'ar' || effectiveLang === 'fa';
  const L = makeT(effectiveLang, S);

  const [activeCategory, setActiveCategory] = useState<'all' | 'core' | 'chemistry' | 'pyramid' | 'production'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>('bottle_volume');

  const filteredCriteria = CRITERIA_EXPLANATIONS.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.nameAr.toLowerCase().includes(query) ||
      item.nameEn.toLowerCase().includes(query) ||
      item.summaryAr.toLowerCase().includes(query) ||
      item.summaryEn.toLowerCase().includes(query);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="bg-white rounded-3xl border border-stone-200/90 shadow-sm overflow-hidden space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t('guide_title', 'دليل المعايير الكيميائية والتصنيعية لحاسبة العطور')}</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold font-serif-luxury text-white">
            {L('header_title')}
          </h2>
          <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
            {t('guide_subtitle', 'شرح معملي وعلمي وتطبيقي شامل لكل معيار وخانة يتم إدخالها داخل الحاسبة لمساعدة العطار والمصمم.')}
          </p>
        </div>

        {onClose && (
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95 border border-amber-400/30"
              title={L('back_to_calc_tooltip')}
            >
              <span>{L('close_return')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Category Tabs */}
          <div className="inline-flex p-1 bg-stone-100 rounded-xl text-xs font-medium overflow-x-auto">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-stone-900 text-white font-bold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {L('tab_all')} ({CRITERIA_EXPLANATIONS.length})
            </button>
            <button
              onClick={() => setActiveCategory('core')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'core'
                  ? 'bg-amber-800 text-white font-bold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {L('tab_core')}
            </button>
            <button
              onClick={() => setActiveCategory('chemistry')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'chemistry'
                  ? 'bg-amber-800 text-white font-bold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {L('tab_chemistry')}
            </button>
            <button
              onClick={() => setActiveCategory('production')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'production'
                  ? 'bg-amber-800 text-white font-bold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {L('tab_production')}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={L('search_ph')}
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:border-amber-600"
            />
          </div>
        </div>
      </div>

      {/* Criteria Cards Accordion */}
      <div className="px-6 pb-6 space-y-3">
        {filteredCriteria.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-xs">
            {L('no_results')}
          </div>
        ) : (
          filteredCriteria.map((item) => {
            const isExpanded = expandedId === item.id;
            const title = pickArEn(effectiveLang, item.nameAr, item.nameEn);
            const subtitle = isRTL ? item.nameEn : item.nameAr;
            const summary = pickArEn(effectiveLang, item.summaryAr, item.summaryEn);
            const importance = pickArEn(effectiveLang, item.importanceLevelAr, item.importanceLevelEn);
            const range = pickArEn(effectiveLang, item.recommendedRangeAr, item.recommendedRangeEn);
            const definition = pickArEn(effectiveLang, item.scientificDefinitionAr, item.scientificDefinitionEn);
            const impact = pickArEn(effectiveLang, item.practicalImpactAr, item.practicalImpactEn);
            const expertRule = pickArEn(effectiveLang, item.expertRuleAr, item.expertRuleEn);
            const commonMistakes = isRTL ? item.commonMistakesAr : item.commonMistakesEn;
            const formula = pickArEn(effectiveLang, item.formulaOrExampleAr, item.formulaOrExampleEn ?? '');

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all ${
                  isExpanded
                    ? 'border-amber-400 bg-amber-50/20 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                {/* Accordion Bar */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 text-left cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-200">
                      <HelpCircle className="w-4 h-4 text-amber-800" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-stone-900">{title}</span>
                        <span className="text-[10px] text-stone-400 font-mono">({subtitle})</span>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                            item.importanceLevelAr === 'حرج جداً'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          {importance}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                        {summary}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 pt-1 sm:pt-0">
                    <span className="text-xs text-amber-800 font-semibold hidden md:inline">
                      {isExpanded ? L('collapse') : L('read_full')}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-xs">
                      {isExpanded ? '▲' : '▼'}
                    </div>
                  </div>
                </button>

                {/* Expanded In-Depth Details */}
                {isExpanded && (
                  <div className="px-5 pb-6 pt-2 border-t border-stone-100 space-y-5 text-xs text-stone-700 animate-in fade-in">
                    
                    {/* Range Ribbon */}
                    <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-amber-800 shrink-0" />
                        <span className="font-bold text-amber-950">
                          {L('range_lbl')}
                        </span>
                      </div>
                      <span className="font-mono-numbers font-bold text-stone-900 bg-white px-3 py-1 rounded-lg border border-amber-200 text-xs">
                        {range}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Scientific Definition */}
                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/70 space-y-1.5">
                        <div className="font-bold text-stone-900 flex items-center gap-2 text-xs">
                          <Beaker className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{L('definition_lbl')}</span>
                        </div>
                        <p className="text-stone-600 leading-relaxed text-[11px]">
                          {definition}
                        </p>
                      </div>

                      {/* Practical Impact */}
                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/70 space-y-1.5">
                        <div className="font-bold text-stone-900 flex items-center gap-2 text-xs">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>{L('impact_lbl')}</span>
                        </div>
                        <p className="text-stone-600 leading-relaxed text-[11px] whitespace-pre-line">
                          {impact}
                        </p>
                      </div>
                    </div>

                    {/* Expert Rule */}
                    <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/70 space-y-1.5">
                      <div className="font-bold text-emerald-950 flex items-center gap-2 text-xs">
                        <Lightbulb className="w-4 h-4 text-emerald-600" />
                        <span>{L('rule_lbl')}</span>
                      </div>
                      <p className="text-emerald-900 leading-relaxed text-[11px] whitespace-pre-line font-medium">
                        {expertRule}
                      </p>
                    </div>

                    {/* Common Mistakes */}
                    <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200/70 space-y-2">
                      <div className="font-bold text-rose-950 flex items-center gap-2 text-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>{L('mistakes_lbl')}</span>
                      </div>
                      <ul className="space-y-1 text-rose-900 text-[11px]">
                        {commonMistakes.map((mistake, mIdx) => (
                          <li key={mIdx} className="flex items-start gap-2">
                            <span className="text-rose-500 font-bold">•</span>
                            <span>{mistake}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Formula */}
                    {formula && (
                      <div className="p-3 bg-stone-900 text-amber-200 rounded-xl font-mono text-[11px] flex items-center justify-between">
                        <span className="text-stone-400">{L('formula_lbl')}</span>
                        <span className="font-bold">{formula}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Banner */}
      <div className="p-4 sm:p-5 bg-stone-100 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {L('footer_validated')}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 text-white hover:bg-stone-800 rounded-xl font-semibold transition-colors cursor-pointer"
          >
            {L('return_to_calc')}
          </button>
        )}
      </div>
    </div>
  );
};
