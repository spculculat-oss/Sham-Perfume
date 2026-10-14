import React, { useState } from 'react';
import {
  MapPin,
  Search,
  Globe,
  Compass,
  Building,
  Phone,
  FileText,
  Copy,
  Check,
  CheckCircle2,
  X,
  Sparkles,
  Thermometer,
  Layers,
  FlaskConical,
  Save,
  Send,
  Download,
  Info,
  Coins,
  ArrowRightLeft,
  TrendingUp,
  DollarSign,
  Languages,
} from 'lucide-react';
import {
  WORLD_COUNTRIES,
  WorldCountryData,
  searchCountries,
  findCountryByCode,
} from '../data/worldCountries';
import {
  WORLD_CURRENCIES,
  WorldCurrency,
  findCurrencyByCode,
  convertCurrency,
} from '../data/worldCurrencies';
import { UserDetailedAddress, FACILITY_TYPE_LABELS } from '../types/address';
import {
  UserEnvironmentProfile,
  createEnvironmentProfileFromCountry,
  saveUserEnvironment,
  updateProfileCurrency,
} from '../utils/environmentAdapter';
import { saveDetailedAddress } from '../utils/addressStorage';
import { ExtractedAIPerfume } from '../utils/aiFormulaExtractor';
import { PyramidNote } from '../types/perfume';
import { UserProfile } from '../types/auth';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LanguageConfig } from '../types/i18n';
import { LText, makeT, fmt, pickArEn, LOCALE_MAP } from '../utils/localize';
import { isRTL } from '../utils/localizedContent';


const S = {
  header_badge: { ar: 'دليل دول العالم والعنوان التفصيلي', en: 'World Countries & Detailed Address Guide', fr: 'Guide des pays et adresse détaillée', es: 'Guía de países y dirección detallada', it: 'Guida ai paesi e indirizzo dettagliato', de: 'Weltländer- & Adressleitfaden', ru: 'Справочник стран и адресов', zh: '世界国家与详细地址指南', tr: 'Dünya ülkeleri ve detaylı adres rehberi', fa: 'راهنمای کشورهای جهان و نشانی تفصیلی' },
  header_title: { ar: 'تحديد بلد ومقر المعمل العطري والعنوان التفصيلي', en: 'Set your country, perfumery facility, and detailed address', fr: 'Définissez votre pays, votre laboratoire et votre adresse', es: 'Configura tu país, instalación perfumera y dirección', it: 'Imposta paese, laboratorio e indirizzo dettagliato', de: 'Land, Parfümlabor und genaue Adresse festlegen', ru: 'Укажите страну, лабораторию и подробный адрес', zh: '设置您的国家、香水实验室与详细地址', tr: 'Ülkenizi, parfüm laboratuvarınızı ve adresinizi belirleyin', fa: 'کشور، آزمایشگاه عطرسازی و نشانی تفصیلی خود را تعیین کنید' },
  close_window_tooltip: { ar: 'إغلاق النافذة (Escape)', en: 'Close window (Escape)', fr: 'Fermer la fenêtre (Échap)', es: 'Cerrar ventana (Escape)', it: 'Chiudi finestra (Esc)', de: 'Fenster schließen (Esc)', ru: 'Закрыть окно (Esc)', zh: '关闭窗口（Esc）', tr: 'Pencereyi kapat (Esc)', fa: 'بستن پنجره (Escape)' },
  close_btn: { ar: 'إغلاق ✕', en: 'Close ✕', fr: 'Fermer ✕', es: 'Cerrar ✕', it: 'Chiudi ✕', de: 'Schließen ✕', ru: 'Закрыть ✕', zh: '关闭 ✕', tr: 'Kapat ✕', fa: 'بستن ✕' },
  tab1_tpl: { ar: '1. اختيار الدولة والمناخ العطري ({n} دولة)', en: '1. Country & Fragrance Climate ({n})', fr: '1. Pays et climat olfactif ({n})', es: '1. País y clima olfativo ({n})', it: '1. Paese e clima olfattivo ({n})', de: '1. Land & Duftklima ({n})', ru: '1. Страна и парфюмерный климат ({n})', zh: '1. 国家与香水气候（{n}）', tr: '1. Ülke ve koku iklimi ({n})', fa: '۱. انتخاب کشور و اقلیم عطری ({n} کشور)' },
  tab2: { ar: '2. خانات العنوان ومقر المعمل', en: '2. Facility Address Fields', fr: '2. Champs d’adresse', es: '2. Campos de dirección', it: '2. Campi indirizzo', de: '2. Adressfelder', ru: '2. Поля адреса', zh: '2. 地址与实验室信息', tr: '2. Adres alanları', fa: '۲. فیلدهای نشانی و مقر آزمایشگاه' },
  tab3_tpl: { ar: '3. العملات ({n})', en: '3. Currencies ({n})', fr: '3. Devises ({n})', es: '3. Monedas ({n})', it: '3. Valute ({n})', de: '3. Währungen ({n})', ru: '3. Валюты ({n})', zh: '3. 货币（{n}）', tr: '3. Para birimleri ({n})', fa: '۳. ارزها ({n})' },
  tab4_tpl: { ar: '4. خانة تغيير اللغة ({n} لغات)', en: '4. Language Selector ({n})', fr: '4. Sélecteur de langue ({n})', es: '4. Selector de idioma ({n})', it: '4. Selettore lingua ({n})', de: '4. Sprachauswahl ({n})', ru: '4. Выбор языка ({n})', zh: '4. 语言选择（{n}）', tr: '4. Dil seçici ({n})', fa: '۴. انتخاب زبان ({n} زبان)' },
  currency_tpl: { ar: 'العملة: {sym} ({code})', en: 'Currency: {sym} ({code})', fr: 'Devise : {sym} ({code})', es: 'Moneda: {sym} ({code})', it: 'Valuta: {sym} ({code})', de: 'Währung: {sym} ({code})', ru: 'Валюта: {sym} ({code})', zh: '货币：{sym}（{code}）', tr: 'Para birimi: {sym} ({code})', fa: 'ارز: {sym} ({code})' },
  phone_code_tpl: { ar: 'مفتاح الاتصال: {code}', en: 'Dial code: {code}', fr: 'Indicatif : {code}', es: 'Prefijo: {code}', it: 'Prefisso: {code}', de: 'Vorwahl: {code}', ru: 'Телефонный код: {code}', zh: '电话区号：{code}', tr: 'Alan kodu: {code}', fa: 'کد تلفن: {code}' },
  apply_country_tpl: { ar: 'تطبيق تركيبة {country} بالمعمل', en: 'Apply {country} accord to the lab', fr: 'Appliquer l’accord de {country}', es: 'Aplicar acorde de {country}', it: 'Applica l’accordo di {country}', de: 'Akkord von {country} anwenden', ru: 'Применить аккорд {country}', zh: '将 {country} 香调应用到实验室', tr: '{country} akorunu uygula', fa: 'اعمال آکورد {country} در آزمایشگاه' },
  write_address: { ar: 'كتابة العنوان', en: 'Write Address', fr: 'Saisir l’adresse', es: 'Escribir dirección', it: 'Inserisci indirizzo', de: 'Adresse eingeben', ru: 'Ввести адрес', zh: '填写地址', tr: 'Adresi yaz', fa: 'نوشتن نشانی' },
  rec_conc_lbl: { ar: 'التركيز الموصى به للمناخ', en: 'Recommended climate concentration', fr: 'Concentration conseillée', es: 'Concentración recomendada', it: 'Concentrazione consigliata', de: 'Empfohlene Konzentration', ru: 'Рекомендуемая концентрация', zh: '气候建议浓度', tr: 'Önerilen iklim konsantrasyonu', fa: 'غلظت پیشنهادی برای اقلیم' },
  rec_conc_note: { ar: 'مضبوط لمنع التبخر أو الاختناق', en: 'Tuned to prevent evaporation or fatigue', fr: 'Calibré contre l’évaporation ou la saturation', es: 'Calibrado contra evaporación o saturación', it: 'Calibrato contro evaporazione o saturazione', de: 'Abgestimmt gegen Verdunstung oder Übersättigung', ru: 'Настроено против испарения или перенасыщения', zh: '调校以防过快挥发或气味压抑', tr: 'Buharlaşma veya doygunluğu önleyecek şekilde ayarlı', fa: 'برای جلوگیری از تبخیر یا اشباع تنظیم شده' },
  fixative_lbl: { ar: 'نسبة المثبت الكيميائي', en: 'Chemical fixative ratio', fr: 'Taux de fixateur', es: 'Ratio de fijador', it: 'Rapporto fissativo', de: 'Fixativanteil', ru: 'Доля фиксатора', zh: '化学固定剂比例', tr: 'Sabitleyici oranı', fa: 'نسبت ثابت‌کننده شیمیایی' },
  fixative_note: { ar: 'يحافظ على ثبات الفوحان', en: 'Preserves sillage longevity', fr: 'Préserve la tenue du sillage', es: 'Preserva la duración de la estela', it: 'Preserva la durata della scia', de: 'Erhält die Sillage', ru: 'Сохраняет стойкость шлейфа', zh: '维持扩散持久', tr: 'İz kalıcılığını korur', fa: 'ماندگاری انتشار را حفظ می‌کند' },
  tola_lbl: { ar: 'دعم وزن التولة (Tola)', en: 'Tola weight support', fr: 'Prise en charge du tola', es: 'Soporte del tola', it: 'Supporto tola', de: 'Tola-Gewichtsunterstützung', ru: 'Поддержка веса тола', zh: '托拉（Tola）重量支持', tr: 'Tola ağırlık desteği', fa: 'پشتیبانی وزن تولا' },
  tola_on: { ar: 'مفعل (11.66g)', en: 'Enabled (11.66g)', fr: 'Activé (11,66 g)', es: 'Activado (11.66g)', it: 'Attivo (11,66 g)', de: 'Aktiviert (11,66 g)', ru: 'Включено (11,66 г)', zh: '已启用（11.66克）', tr: 'Etkin (11.66g)', fa: 'فعال (۱۱.۶۶ گرم)' },
  tola_off: { ar: 'معايير الجرام الدولية', en: 'International gram standards', fr: 'Grammes standards', es: 'Gramos estándar', it: 'Grammi standard', de: 'Internationale Grammnorm', ru: 'Международные граммы', zh: '国际克标准', tr: 'Uluslararası gram standardı', fa: 'استاندارد بین‌المللی گرم' },
  tola_on_note: { ar: 'معتمد في التراث العطري', en: 'Certified in fragrance heritage', fr: 'Certifié par le patrimoine', es: 'Certificado por la tradición', it: 'Certificato dalla tradizione', de: 'In der Dufttradition verankert', ru: 'Признано парфюмерной традицией', zh: '香水传统认证', tr: 'Parfüm geleneğinde onaylı', fa: 'مصوب در سنت عطرسازی' },
  tola_off_note: { ar: 'وفق مقاييس IFRA العالمية', en: 'Per IFRA global measures', fr: 'Selon les normes IFRA', es: 'Según normas IFRA', it: 'Secondo le norme IFRA', de: 'Nach IFRA-Maßgaben', ru: 'По стандартам IFRA', zh: '依据 IFRA 全球标准', tr: 'IFRA ölçülerine göre', fa: 'مطابق استانداردهای جهانی IFRA' },
  climate_advice_tpl: { ar: 'نصيحة الخبير شاهين لمناخ {country}:', en: 'Master Shahin advice for {country} climate:', fr: 'Conseil du Maître Shahin pour {country} :', es: 'Consejo del Maestro Shahin para {country}:', it: 'Consiglio del Maestro Shahin per {country}:', de: 'Meister-Shahin-Rat für {country}:', ru: 'Совет мастера Шахина для {country}:', zh: 'Shahin 大师对 {country} 气候的建议：', tr: '{country} iklimi için Usta Shahin tavsiyesi:', fa: 'توصیه استاد شاهین برای اقلیم {country}:' },
  search_country_ph: { ar: 'ابحث عن أي دولة بالاسم العربي أو الإنجليزي أو كود الدولة (SA, EG, FR, KW...)', en: 'Search any country by Arabic or English name or code (SA, EG, FR, KW...)', fr: 'Recherchez un pays par nom ou code (SA, EG, FR, KW…)', es: 'Busca cualquier país por nombre o código (SA, EG, FR, KW...)', it: 'Cerca un paese per nome o codice (SA, EG, FR, KW...)', de: 'Land nach Name oder Code suchen (SA, EG, FR, KW…)', ru: 'Поиск страны по названию или коду (SA, EG, FR, KW…)', zh: '按名称或国家代码搜索（SA、EG、FR、KW…）', tr: 'Ülke ara (isim veya kod: SA, EG, FR, KW...)', fa: 'جستجوی کشور بر اساس نام یا کد (SA, EG, FR, KW...)' },
  region_all: { ar: 'جميع الدول', en: 'All Countries', fr: 'Tous les pays', es: 'Todos los países', it: 'Tutti i paesi', de: 'Alle Länder', ru: 'Все страны', zh: '全部国家', tr: 'Tüm ülkeler', fa: 'همه کشورها' },
  region_arab: { ar: 'الدول العربية', en: 'Arab Countries', fr: 'Pays arabes', es: 'Países árabes', it: 'Paesi arabi', de: 'Arabische Länder', ru: 'Арабские страны', zh: '阿拉伯国家', tr: 'Arap ülkeleri', fa: 'کشورهای عربی' },
  region_europe: { ar: 'أوروبا', en: 'Europe', fr: 'Europe', es: 'Europa', it: 'Europa', de: 'Europa', ru: 'Европа', zh: '欧洲', tr: 'Avrupa', fa: 'اروپا' },
  region_asia: { ar: 'آسيا', en: 'Asia', fr: 'Asie', es: 'Asia', it: 'Asia', de: 'Asien', ru: 'Азия', zh: '亚洲', tr: 'Asya', fa: 'آسیا' },
  region_americas: { ar: 'الأمريكتان', en: 'Americas', fr: 'Amériques', es: 'Américas', it: 'Americhe', de: 'Amerika', ru: 'Америка', zh: '美洲', tr: 'Amerika', fa: 'قاره آمریکا' },
  no_country_tpl: { ar: 'لم يتم العثور على دولة مطابقة لبحثك "{q}".', en: 'No country matching your search "{q}".', fr: 'Aucun pays ne correspond à « {q} ».', es: 'Ningún país coincide con "{q}".', it: 'Nessun paese corrisponde a "{q}".', de: 'Kein Land entspricht „{q}“.', ru: 'Страна по запросу «{q}» не найдена.', zh: '没有符合“{q}”的国家。', tr: '"{q}" aramanıza uyan ülke yok.', fa: 'کشوری مطابق جستجوی «{q}» یافت نشد.' },
  addr_banner_title: { ar: 'بيانات العنوان ومقر المعمل:', en: 'Address & facility data:', fr: 'Données d’adresse et d’établissement :', es: 'Datos de dirección e instalación:', it: 'Dati di indirizzo e sede:', de: 'Adress- und Standortdaten:', ru: 'Данные адреса и лаборатории:', zh: '地址与实验室信息：', tr: 'Adres ve tesis verileri:', fa: 'اطلاعات نشانی و مقر:' },
  addr_banner_p: { ar: 'تُستخدم هذه الخانات لتحديد موقع معملك الرسمي، وتضمينها تلقائياً في بطاقات تصنيع العطور المطبوعة، بوالص الشحن، وإرسال العينات للعملاء أو المختبرات.', en: 'These fields locate your official facility and are automatically embedded in printed manufacturing cards, shipping labels, and sample dispatches.', fr: 'Ces champs localisent votre laboratoire et s’intègrent aux cartes de fabrication, bons d’expédition et envois d’échantillons.', es: 'Estos campos ubican tu instalación y se incluyen en tarjetas de fabricación, etiquetas de envío y envíos de muestras.', it: 'Questi campi individuano la tua sede e vengono inclusi in schede di produzione, etichette e spedizioni di campioni.', de: 'Diese Felder lokalisieren Ihr Labor und fließen in Produktionskarten, Versandetiketten und Mustersendungen ein.', ru: 'Эти поля определяют адрес вашей лаборатории и автоматически попадают в производственные карты, накладные и отправки образцов.', zh: '这些字段用于定位您的官方实验室，并自动嵌入打印的生产卡、运输标签与样品寄送。', tr: 'Bu alanlar laboratuvarınızın konumunu belirler; üretim kartlarına, kargo etiketlerine ve numune gönderilerine otomatik eklenir.', fa: 'این فیلدها محل آزمایشگاه رسمی شما را مشخص می‌کنند و به‌طور خودکار در کارت‌های تولید، برچسب‌های حمل و ارسال نمونه درج می‌شوند.' },
  country_lbl: { ar: 'الدولة / البلد المعتمد', en: 'Country', fr: 'Pays', es: 'País', it: 'Paese', de: 'Land', ru: 'Страна', zh: '国家/地区', tr: 'Ülke', fa: 'کشور' },
  change_country: { ar: 'تغيير الدولة', en: 'Change country', fr: 'Changer de pays', es: 'Cambiar país', it: 'Cambia paese', de: 'Land ändern', ru: 'Сменить страну', zh: '更换国家', tr: 'Ülkeyi değiştir', fa: 'تغییر کشور' },
  facility_name_lbl: { ar: 'اسم المنشأة أو المعمل العطري', en: 'Facility / perfume lab name', fr: 'Nom de l’établissement', es: 'Nombre de la instalación', it: 'Nome della struttura', de: 'Name der Einrichtung', ru: 'Название лаборатории', zh: '机构或香水实验室名称', tr: 'Tesis / laboratuvar adı', fa: 'نام مؤسسه یا آزمایشگاه عطر' },
  facility_name_ph: { ar: 'مثال: مختبر عطور الشام، دار الفخامة...', en: 'e.g. Sham Perfume Lab, Maison de Luxe...', fr: 'ex. Laboratoire Sham, Maison de Luxe…', es: 'ej. Laboratorio Sham, Casa de Lujo...', it: 'es. Laboratorio Sham, Maison de Luxe...', de: 'z. B. Sham-Labor, Maison de Luxe…', ru: 'напр. Лаборатория Sham, Maison de Luxe…', zh: '例如：Sham 香水实验室、奢华之家……', tr: 'örn. Sham Parfüm Laboratuvarı...', fa: 'مثال: آزمایشگاه عطر شام، دار لوکس...' },
  facility_type_lbl: { ar: 'نوع النشاط / المقر العطري', en: 'Activity / facility type', fr: 'Type d’activité', es: 'Tipo de actividad', it: 'Tipo di attività', de: 'Aktivitätsart', ru: 'Тип деятельности', zh: '业务/机构类型', tr: 'Faaliyet türü', fa: 'نوع فعالیت / مؤسسه' },
  city_lbl: { ar: 'المدينة / المحافظة / الإمارة / الولاية', en: 'City / Governorate / State', fr: 'Ville / Gouvernorat / État', es: 'Ciudad / Provincia / Estado', it: 'Città / Provincia / Stato', de: 'Stadt / Bundesland', ru: 'Город / штат / провинция', zh: '城市/省/州', tr: 'Şehir / Eyalet', fa: 'شهر / استان / ایالت' },
  city_ph: { ar: 'مثال: الرياض، دبي، القاهرة، باريس...', en: 'e.g. Riyadh, Dubai, Cairo, Paris...', fr: 'ex. Riyad, Dubaï, Le Caire, Paris…', es: 'ej. Riad, Dubái, El Cairo, París...', it: 'es. Riyadh, Dubai, Il Cairo, Parigi...', de: 'z. B. Riad, Dubai, Kairo, Paris…', ru: 'напр. Эр-Рияд, Дубай, Каир, Париж…', zh: '例如：利雅得、迪拜、开罗、巴黎……', tr: 'örn. Riyad, Dubai, Kahire, Paris...', fa: 'مثال: ریاض، دبی، قاهره، پاریس...' },
  district_lbl: { ar: 'الحي / المنطقة', en: 'District / Neighborhood', fr: 'Quartier', es: 'Barrio / Zona', it: 'Quartiere / Zona', de: 'Bezirk / Viertel', ru: 'Район', zh: '街区/社区', tr: 'Mahalle / Bölge', fa: 'محله / منطقه' },
  district_ph: { ar: 'مثال: حي الياسمين، المعادي، وسط البلد...', en: 'e.g. Yasmin District, Maadi, Downtown...', fr: 'ex. Quartier Yasmin, Maadi, centre-ville…', es: 'ej. Barrio Yasmin, Maadi, Centro...', it: 'es. Quartiere Yasmin, Maadi, Centro...', de: 'z. B. Yasmin-Viertel, Maadi, Innenstadt…', ru: 'напр. район Ясмин, Маади, центр…', zh: '例如：茉莉区、马adi、市中心……', tr: 'örn. Yasmin Mahallesi, Merkez...', fa: 'مثال: محله یاسمین، معادی، مرکز شهر...' },
  street_lbl: { ar: 'اسم الشارع ورقم المبنى أو المعمل', en: 'Street name & building / lab number', fr: 'Rue et numéro de bâtiment', es: 'Calle y número de edificio', it: 'Via e numero civico', de: 'Straße und Gebäudenummer', ru: 'Улица и номер здания', zh: '街道名称与楼栋/实验室编号', tr: 'Sokak adı ve bina numarası', fa: 'نام خیابان و شماره ساختمان' },
  street_ph: { ar: 'مثال: طريق الملك فهد - مبنى رقم 12 - الطابق الثاني', en: 'e.g. King Fahd Rd - Bldg 12 - 2nd Floor', fr: 'ex. Route King Fahd - Bât. 12 - 2e étage', es: 'ej. Av. Rey Fahd - Edif. 12 - 2º piso', it: 'es. Via King Fahd - Edif. 12 - 2° piano', de: 'z. B. King-Fahd-Straße – Gebäude 12, 2. OG', ru: 'напр. ул. Короля Фахда, д. 12, 2 этаж', zh: '例如：法赫德国王路 - 12 号楼 - 2 层', tr: 'örn. Kral Fahd Cad. - No 12 - 2. kat', fa: 'مثال: بزرگراه شاه فهد - ساختمان ۱۲ - طبقه دوم' },
  postal_lbl: { ar: 'الرمز البريدي (Postal / ZIP Code)', en: 'Postal / ZIP Code', fr: 'Code postal', es: 'Código postal', it: 'Codice postale', de: 'Postleitzahl', ru: 'Почтовый индекс', zh: '邮政编码', tr: 'Posta kodu', fa: 'کد پستی' },
  postal_ph: { ar: 'مثال: 12345 أو 75001', en: 'e.g. 12345 or 75001', fr: 'ex. 12345 ou 75001', es: 'ej. 12345 o 75001', it: 'es. 12345 o 75001', de: 'z. B. 12345 oder 75001', ru: 'напр. 12345 или 75001', zh: '例如：12345 或 75001', tr: 'örn. 12345 veya 75001', fa: 'مثال: ۱۲۳۴۵ یا ۷۵۰۰۱' },
  phone_lbl: { ar: 'رقم هاتف التواصل مع كود الدولة الدولي', en: 'Contact phone with international dial code', fr: 'Téléphone avec indicatif international', es: 'Teléfono con prefijo internacional', it: 'Telefono con prefisso internazionale', de: 'Telefon mit internationaler Vorwahl', ru: 'Телефон с международным кодом', zh: '含国际区号的联系电话', tr: 'Uluslararası kodlu telefon', fa: 'تلفن تماس با کد بین‌المللی کشور' },
  notes_lbl: { ar: 'ملاحظات الشحن والتخزين المبرد للعينات والزيوت', en: 'Shipping & cold-storage notes for samples and oils', fr: 'Notes d’expédition et de stockage frigorifique', es: 'Notas de envío y almacenamiento en frío', it: 'Note di spedizione e conservazione refrigerata', de: 'Versand- und Kühlhinweise', ru: 'Заметки о доставке и холодном хранении', zh: '样品与精油的运输及冷藏备注', tr: 'Numune ve yağlar için taşıma ve soğuk depolama notları', fa: 'یادداشت‌های حمل و نگهداری سرد نمونه‌ها و روغن‌ها' },
  notes_ph: { ar: 'تعليمات خاصة للاستلام، شحن الكحول، درجات الحرارة المطلوبة لحفظ الزيوت العطرية...', en: 'Special receiving instructions, alcohol shipping, oil storage temperatures...', fr: 'Instructions de réception, expédition d’alcool, températures de conservation…', es: 'Instrucciones de recepción, envío de alcohol, temperaturas de conservación...', it: 'Istruzioni di ricezione, spedizione alcol, temperature di conservazione...', de: 'Empfangshinweise, Alkoholversand, Lagertemperaturen…', ru: 'Особые инструкции приёма, пересылка спирта, температуры хранения…', zh: '收货特别说明、酒精运输、精油保存温度……', tr: 'Teslim talimatları, alkol taşıma, saklama sıcaklıkları...', fa: 'دستورالعمل ویژه تحویل، حمل الکل، دمای نگهداری روغن‌ها...' },
  save_addr: { ar: 'حفظ وتحديث العنوان التفصيلي', en: 'Save & update detailed address', fr: 'Enregistrer l’adresse', es: 'Guardar y actualizar dirección', it: 'Salva e aggiorna indirizzo', de: 'Adresse speichern & aktualisieren', ru: 'Сохранить адрес', zh: '保存并更新详细地址', tr: 'Adresi kaydet ve güncelle', fa: 'ذخیره و به‌روزرسانی نشانی' },
  copied_ok: { ar: 'تم نسخ العنوان!', en: 'Address copied!', fr: 'Adresse copiée !', es: '¡Dirección copiada!', it: 'Indirizzo copiato!', de: 'Adresse kopiert!', ru: 'Адрес скопирован!', zh: '地址已复制！', tr: 'Adres kopyalandı!', fa: 'نشانی کپی شد!' },
  copy_addr: { ar: 'نسخ العنوان للشحن', en: 'Copy address for shipping', fr: 'Copier l’adresse d’expédition', es: 'Copiar dirección para envío', it: 'Copia indirizzo per spedizione', de: 'Adresse für Versand kopieren', ru: 'Скопировать адрес для доставки', zh: '复制配送地址', tr: 'Gönderim için adresi kopyala', fa: 'کپی نشانی برای ارسال' },
  saved_ok: { ar: 'تم حفظ العنوان وتحديث بيانات المعمل بنجاح!', en: 'Address saved and facility data updated successfully!', fr: 'Adresse enregistrée et données mises à jour !', es: '¡Dirección guardada y datos actualizados!', it: 'Indirizzo salvato e dati aggiornati!', de: 'Adresse gespeichert und Daten aktualisiert!', ru: 'Адрес сохранён, данные обновлены!', zh: '地址已保存，实验室资料已更新！', tr: 'Adres kaydedildi ve tesis verileri güncellendi!', fa: 'نشانی ذخیره و اطلاعات آزمایشگاه به‌روزرسانی شد!' },
  lab_currency_p: { ar: 'العملة الرسمية المعتمدة حالياً لحساب التكاليف والأرباح وتسعير زجاجات العطر في المعمل.', en: 'Official currency currently used for costing, profits, and bottle pricing in the lab.', fr: 'Devise officielle des coûts, marges et tarifs du laboratoire.', es: 'Moneda oficial actual para costes, beneficios y precios del laboratorio.', it: 'Valuta ufficiale per costi, profitti e prezzi del laboratorio.', de: 'Offizielle Währung für Kosten, Gewinne und Preiskalkulation.', ru: 'Официальная валюта расчётов себестоимости, прибыли и цен.', zh: '当前实验室成本、利润与定价所用的官方货币。', tr: 'Laboratuvarda maliyet, kâr ve fiyatlandırmada kullanılan resmi para birimi.', fa: 'ارز رسمی فعلی برای محاسبه هزینه‌ها، سود و قیمت‌گذاری بطری‌ها.' },
  exchange_lbl: { ar: 'سعر الصرف المرجعي:', en: 'Reference exchange rate:', fr: 'Taux de change de référence :', es: 'Tipo de cambio de referencia:', it: 'Tasso di cambio di riferimento:', de: 'Referenzwechselkurs:', ru: 'Справочный курс:', zh: '参考汇率：', tr: 'Referans döviz kuru:', fa: 'نرخ ارز مرجع:' },
  converter_title: { ar: 'محول ومطابق العملات العالمية اللحظي', en: 'Live World Currency Converter', fr: 'Convertisseur de devises en direct', es: 'Conversor de divisas en vivo', it: 'Convertitore di valute in tempo reale', de: 'Live-Währungsumrechner', ru: 'Онлайн-конвертер валют', zh: '实时货币换算器', tr: 'Canlı döviz çevirici', fa: 'مبدل لحظه‌ای ارزهای جهانی' },
  converter_note: { ar: 'أسعار مرجعية محدثة لجميع العملات', en: 'Updated reference rates for all currencies', fr: 'Taux de référence actualisés', es: 'Tasas de referencia actualizadas', it: 'Tassi di riferimento aggiornati', de: 'Aktualisierte Referenzkurse', ru: 'Обновлённые справочные курсы', zh: '全部货币的更新参考汇率', tr: 'Tüm para birimleri için güncel referans kurları', fa: 'نرخ‌های مرجع به‌روز برای همه ارزها' },
  amount_lbl: { ar: 'المبلغ:', en: 'Amount:', fr: 'Montant :', es: 'Importe:', it: 'Importo:', de: 'Betrag:', ru: 'Сумма:', zh: '金额：', tr: 'Tutar:', fa: 'مبلغ:' },
  from_lbl: { ar: 'من عملة:', en: 'From:', fr: 'De :', es: 'De:', it: 'Da:', de: 'Von:', ru: 'Из:', zh: '从：', tr: 'Kaynak:', fa: 'از ارز:' },
  to_lbl: { ar: 'إلى عملة:', en: 'To:', fr: 'Vers :', es: 'A:', it: 'A:', de: 'Nach:', ru: 'В:', zh: '到：', tr: 'Hedef:', fa: 'به ارز:' },
  swap_tooltip: { ar: 'تبديل اتجاه التحويل', en: 'Swap conversion direction', fr: 'Inverser la conversion', es: 'Invertir conversión', it: 'Inverti conversione', de: 'Umrechnungsrichtung tauschen', ru: 'Поменять направление', zh: '切换换算方向', tr: 'Çevirme yönünü değiştir', fa: 'جهت تبدیل را عوض کنید' },
  result_lbl: { ar: 'النتيجة:', en: 'Result:', fr: 'Résultat :', es: 'Resultado:', it: 'Risultato:', de: 'Ergebnis:', ru: 'Результат:', zh: '结果：', tr: 'Sonuç:', fa: 'نتیجه:' },
  search_currency_ph: { ar: 'ابحث عن أي عملة بكود الأيزو (USD, SAR, EUR, EGP) أو الاسم (ريال، درهم، دولار، دينار)...', en: 'Search currencies by ISO code (USD, SAR, EUR, EGP) or name...', fr: 'Recherchez par code ISO (USD, SAR, EUR, EGP) ou nom…', es: 'Busca por código ISO (USD, SAR, EUR, EGP) o nombre...', it: 'Cerca per codice ISO (USD, SAR, EUR, EGP) o nome...', de: 'Nach ISO-Code (USD, SAR, EUR, EGP) oder Name suchen…', ru: 'Поиск по коду ISO (USD, SAR, EUR, EGP) или названию…', zh: '按 ISO 代码（USD、SAR、EUR、EGP）或名称搜索……', tr: 'ISO kodu (USD, SAR, EUR, EGP) veya isimle ara...', fa: 'جستجوی ارز با کد ایزو (USD, SAR, EUR, EGP) یا نام...' },
  currencies_count_tpl: { ar: '{n} عملة عالمية متاحة', en: '{n} currencies available', fr: '{n} devises disponibles', es: '{n} monedas disponibles', it: '{n} valute disponibili', de: '{n} Währungen verfügbar', ru: 'Доступно валют: {n}', zh: '{n} 种可用货币', tr: '{n} para birimi mevcut', fa: '{n} ارز جهانی در دسترس' },
  curr_all: { ar: 'كافة العملات', en: 'All Currencies', fr: 'Toutes les devises', es: 'Todas las monedas', it: 'Tutte le valute', de: 'Alle Währungen', ru: 'Все валюты', zh: '全部货币', tr: 'Tüm para birimleri', fa: 'همه ارزها' },
  curr_asia: { ar: 'آسيا والشرق الأوسط', en: 'Asia & Middle East', fr: 'Asie et Moyen-Orient', es: 'Asia y Oriente Medio', it: 'Asia e Medio Oriente', de: 'Asien & Naher Osten', ru: 'Азия и Ближний Восток', zh: '亚洲与中东', tr: 'Asya ve Orta Doğu', fa: 'آسیا و خاورمیانه' },
  curr_africa: { ar: 'إفريقيا', en: 'Africa', fr: 'Afrique', es: 'África', it: 'Africa', de: 'Afrika', ru: 'Африка', zh: '非洲', tr: 'Afrika', fa: 'آفریقا' },
  curr_oceania: { ar: 'أوقيانوسيا', en: 'Oceania', fr: 'Océanie', es: 'Oceanía', it: 'Oceania', de: 'Ozeanien', ru: 'Океания', zh: '大洋洲', tr: 'Okyanusya', fa: 'اقیانوسیه' },
  popular: { ar: 'شائعة', en: 'Popular', fr: 'Populaire', es: 'Popular', it: 'Popolare', de: 'Beliebt', ru: 'Популярная', zh: '常用', tr: 'Yaygın', fa: 'پرکاربرد' },
  active_in_lab: { ar: 'مفعلة بالمعمل', en: 'Active in lab', fr: 'Active au laboratoire', es: 'Activa en el laboratorio', it: 'Attiva nel laboratorio', de: 'Im Labor aktiv', ru: 'Активна в лаборатории', zh: '实验室启用', tr: 'Laboratuvarda etkin', fa: 'فعال در آزمایشگاه' },
  set_lab_currency: { ar: 'تعيين كعملة المعمل', en: 'Set as lab currency', fr: 'Définir comme devise du laboratoire', es: 'Establecer como moneda', it: 'Imposta come valuta', de: 'Als Labowährung festlegen', ru: 'Сделать валютой лаборатории', zh: '设为实验室货币', tr: 'Laboratuvar para birimi yap', fa: 'تنظیم به‌عنوان ارز آزمایشگاه' },
  lang_header: { ar: 'خانة تغيير واختيار لغة المنصة', en: 'Platform language selector', fr: 'Sélecteur de langue de la plateforme', es: 'Selector de idioma de la plataforma', it: 'Selettore lingua della piattaforma', de: 'Sprachauswahl der Plattform', ru: 'Выбор языка платформы', zh: '平台语言选择', tr: 'Platform dil seçici', fa: 'انتخابگر زبان پلتفرم' },
  langs_badge: { ar: '{n} لغات عالمية', en: '{n} world languages', fr: '{n} langues', es: '{n} idiomas', it: '{n} lingue', de: '{n} Weltsprachen', ru: '{n} языков', zh: '{n} 种世界语言', tr: '{n} dünya dili', fa: '{n} زبان جهانی' },
  lang_header_p: { ar: 'اختر اللغة المفضلة للعمل بها داخل المعمل؛ يتم فوراً ضبط اتجاه الواجهة (RTL ⇄ LTR) وترجمة كافة المصطلحات المعملية، مع حفظ التفضيل تلقائياً في متصفحك.', en: 'Choose your preferred lab language; the interface direction (RTL ⇄ LTR) and all lab terminology switch instantly, and your preference is saved in your browser.', fr: 'Choisissez votre langue ; l’interface (RTL ⇄ LTR) et la terminologie basculent instantanément, et votre choix est mémorisé.', es: 'Elige tu idioma; la dirección (RTL ⇄ LTR) y la terminología cambian al instante y se guarda tu preferencia.', it: 'Scegli la lingua; direzione (RTL ⇄ LTR) e terminologia cambiano all’istante e la preferenza viene salvata.', de: 'Wählen Sie Ihre Sprache; Richtung (RTL ⇄ LTR) und Terminologie wechseln sofort, die Auswahl wird gespeichert.', ru: 'Выберите язык: направление (RTL ⇄ LTR) и терминология переключаются мгновенно, выбор сохраняется.', zh: '选择您的实验室语言；界面方向（RTL ⇄ LTR）与全部术语即时切换，偏好自动保存在浏览器中。', tr: 'Dilinizi seçin; yön (RTL ⇄ LTR) ve terminoloji anında değişir, tercihiniz tarayıcınızda saklanır.', fa: 'زبان مورد نظر خود را انتخاب کنید؛ جهت رابط (RTL ⇄ LTR) و همه اصطلاحات فوری تغییر می‌کند و ترجیح شما در مرورگر ذخیره می‌شود.' },
  current_lang_lbl: { ar: 'اللغة الحالية المفعلة:', en: 'Current active language:', fr: 'Langue active :', es: 'Idioma activo:', it: 'Lingua attiva:', de: 'Aktive Sprache:', ru: 'Текущий язык:', zh: '当前启用语言：', tr: 'Etkin dil:', fa: 'زبان فعال فعلی:' },
  search_lang_ph: { ar: 'ابحث عن لغة (مثال: العربية, English, Français, Deutsch, 中文)...', en: 'Search a language (e.g. English, Français, Deutsch, 中文)...', fr: 'Rechercher une langue (ex. English, Français…)…', es: 'Buscar idioma (ej. English, Français, 中文)...', it: 'Cerca lingua (es. English, Français, 中文)...', de: 'Sprache suchen (z. B. English, Français, 中文)…', ru: 'Поиск языка (напр. English, Français, 中文)…', zh: '搜索语言（如 English、Français、中文）……', tr: 'Dil ara (örn. English, Français, 中文)...', fa: 'جستجوی زبان (مثال: فارسی, English, Français)...' },
  langs_count_tpl: { ar: 'عرض {a} من أصل {b} لغة عالمية', en: 'Showing {a} of {b} languages', fr: '{a} langues sur {b}', es: 'Mostrando {a} de {b} idiomas', it: '{a} di {b} lingue', de: '{a} von {b} Sprachen', ru: 'Показано {a} из {b} языков', zh: '显示 {a}/{b} 种语言', tr: '{b} dilin {a} tanesi gösteriliyor', fa: 'نمایش {a} از {b} زبان' },
  rtl_lbl: { ar: 'RTL (يمين)', en: 'RTL', fr: 'RTL', es: 'RTL', it: 'RTL', de: 'RTL', ru: 'RTL', zh: 'RTL（从右向左）', tr: 'RTL', fa: 'RTL (راست)' },
  ltr_lbl: { ar: 'LTR (يسار)', en: 'LTR', fr: 'LTR', es: 'LTR', it: 'LTR', de: 'LTR', ru: 'LTR', zh: 'LTR（从左向右）', tr: 'LTR', fa: 'LTR (چپ)' },
  active_lang: { ar: 'اللغة النشطة حالياً للمنصة', en: 'Currently active platform language', fr: 'Langue active de la plateforme', es: 'Idioma activo de la plataforma', it: 'Lingua attiva della piattaforma', de: 'Aktuell aktive Sprache', ru: 'Активный язык платформы', zh: '当前启用的平台语言', tr: 'Şu an etkin platform dili', fa: 'زبان فعال فعلی پلتفرم' },
  click_switch: { ar: 'انقر للتبديل الفوري', en: 'Click to switch instantly', fr: 'Cliquez pour basculer', es: 'Haz clic para cambiar', it: 'Clicca per cambiare', de: 'Zum sofortigen Wechsel klicken', ru: 'Нажмите для мгновенного переключения', zh: '点击即时切换', tr: 'Anında geçmek için tıkla', fa: 'برای تغییر فوری کلیک کنید' },
  enabled: { ar: 'مفعلة', en: 'Enabled', fr: 'Activée', es: 'Activado', it: 'Attiva', de: 'Aktiviert', ru: 'Включён', zh: '已启用', tr: 'Etkin', fa: 'فعال' },
  enable_lang: { ar: 'تفعيل هذه اللغة', en: 'Activate this language', fr: 'Activer cette langue', es: 'Activar este idioma', it: 'Attiva questa lingua', de: 'Diese Sprache aktivieren', ru: 'Включить этот язык', zh: '启用此语言', tr: 'Bu dili etkinleştir', fa: 'فعال‌سازی این زبان' },
  active_country_tpl: { ar: 'البلد النشط: {flag} {name}', en: 'Active country: {flag} {name}', fr: 'Pays actif : {flag} {name}', es: 'País activo: {flag} {name}', it: 'Paese attivo: {flag} {name}', de: 'Aktives Land: {flag} {name}', ru: 'Активная страна: {flag} {name}', zh: '当前国家：{flag} {name}', tr: 'Etkin ülke: {flag} {name}', fa: 'کشور فعال: {flag} {name}' },
  footer_currency_tpl: { ar: 'العملة: {code}', en: 'Currency: {code}', fr: 'Devise : {code}', es: 'Moneda: {code}', it: 'Valuta: {code}', de: 'Währung: {code}', ru: 'Валюта: {code}', zh: '货币：{code}', tr: 'Para birimi: {code}', fa: 'ارز: {code}' },
  close: { ar: 'إغلاق', en: 'Close', fr: 'Fermer', es: 'Cerrar', it: 'Chiudi', de: 'Schließen', ru: 'Закрыть', zh: '关闭', tr: 'Kapat', fa: 'بستن' },
  lang_saved_tpl: { ar: 'تم تغيير لغة المنصة فوراً إلى: {flag} «{native} ({name})» وتطبيق اتجاه ({dir})', en: 'Platform language switched instantly to: {flag} «{native} ({name})» with direction ({dir})', fr: 'Langue changée en : {flag} « {native} ({name}) », direction ({dir})', es: 'Idioma cambiado a: {flag} «{native} ({name})» con dirección ({dir})', it: 'Lingua cambiata in: {flag} «{native} ({name})», direzione ({dir})', de: 'Sprache geändert zu: {flag} „{native} ({name})“, Richtung ({dir})', ru: 'Язык переключён на: {flag} «{native} ({name})», направление ({dir})', zh: '平台语言已即时切换为：{flag}「{native} ({name})」，方向（{dir}）', tr: 'Dil anında değiştirildi: {flag} «{native} ({name})», yön ({dir})', fa: 'زبان پلتفرم فوراً به {flag} «{native} ({name})» با جهت ({dir}) تغییر کرد' },
  currency_saved_tpl: { ar: 'تم تعيين {flag} «{name} ({code})» كعملة رسمية للمعمل بنجاح!', en: '{flag} «{name} ({code})» set as official lab currency!', fr: '{flag} « {name} ({code})» défini comme devise officielle !', es: '¡{flag} «{name} ({code})» establecida como moneda oficial!', it: '{flag} «{name} ({code})» impostata come valuta ufficiale!', de: '{flag} „{name} ({code})“ als offizielle Währung festgelegt!', ru: '{flag} «{name} ({code})» назначена официальной валютой!', zh: '{flag}「{name} ({code})」已设为实验室官方货币！', tr: '{flag} «{name} ({code})» resmi para birimi olarak ayarlandı!', fa: '{flag} «{name} ({code})» با موفقیت ارز رسمی آزمایشگاه شد!' },
  not_set: { ar: 'غير محدد', en: 'Not specified', fr: 'Non spécifié', es: 'No especificado', it: 'Non specificato', de: 'Nicht angegeben', ru: 'Не указано', zh: '未填写', tr: 'Belirtilmedi', fa: 'مشخص نشده' },
  none: { ar: 'لا توجد', en: 'None', fr: 'Aucune', es: 'Ninguna', it: 'Nessuna', de: 'Keine', ru: 'Нет', zh: '无', tr: 'Yok', fa: 'وجود ندارد' },
  default_facility: { ar: 'مختبر تركيب العطور', en: 'Fragrance Compounding Lab', fr: 'Laboratoire de composition', es: 'Laboratorio de composición', it: 'Laboratorio di composizione', de: 'Kompositionslabor', ru: 'Лаборатория составления', zh: '香水调配实验室', tr: 'Kompozisyon laboratuvarı', fa: 'آزمایشگاه ترکیب عطر' },
  clip_tpl: {
    ar: `═══════════════════════════════════════════════════
بيانات مقر المعمل والعنوان التفصيلي · منصة صمم عطرك مع شام
═══════════════════════════════════════════════════
المنشأة العطرية: {facility}
نوع المنشأة: {type}
الدولة: {flag} {country} ({code})
المدينة / المحافظة: {city}
الحي / المنطقة: {district}
الشارع / رقم المعمل: {street}
الرمز البريدي: {postal}
هاتف التواصل: {phone}
ملاحظات الشحن والتخزين: {notes}
═══════════════════════════════════════════════════`,
    en: `═══════════════════════════════════════════════════
Lab Facility & Detailed Address · Design Your Perfume with Sham
═══════════════════════════════════════════════════
Facility: {facility}
Type: {type}
Country: {flag} {country} ({code})
City: {city}
District: {district}
Street / Lab No.: {street}
Postal Code: {postal}
Phone: {phone}
Shipping & Storage Notes: {notes}
═══════════════════════════════════════════════════`,
    fr: `═══════════════════════════════════════════════════
Laboratoire et adresse détaillée · Créez votre parfum avec Sham
═══════════════════════════════════════════════════
Établissement : {facility}
Type : {type}
Pays : {flag} {country} ({code})
Ville : {city}
Quartier : {district}
Rue / N° : {street}
Code postal : {postal}
Téléphone : {phone}
Notes d’expédition : {notes}
═══════════════════════════════════════════════════`,
    es: `═══════════════════════════════════════════════════
Instalación y dirección detallada · Diseña tu perfume con Sham
═══════════════════════════════════════════════════
Instalación: {facility}
Tipo: {type}
País: {flag} {country} ({code})
Ciudad: {city}
Barrio: {district}
Calle / Nº: {street}
Código postal: {postal}
Teléfono: {phone}
Notas de envío: {notes}
═══════════════════════════════════════════════════`,
    it: `═══════════════════════════════════════════════════
Struttura e indirizzo dettagliato · Crea il tuo profumo con Sham
═══════════════════════════════════════════════════
Struttura: {facility}
Tipo: {type}
Paese: {flag} {country} ({code})
Città: {city}
Quartiere: {district}
Via / N.: {street}
CAP: {postal}
Telefono: {phone}
Note di spedizione: {notes}
═══════════════════════════════════════════════════`,
    de: `═══════════════════════════════════════════════════
Labor und genaue Adresse · Gestalten Sie Ihr Parfüm mit Sham
═══════════════════════════════════════════════════
Einrichtung: {facility}
Typ: {type}
Land: {flag} {country} ({code})
Stadt: {city}
Bezirk: {district}
Straße / Nr.: {street}
Postleitzahl: {postal}
Telefon: {phone}
Versandhinweise: {notes}
═══════════════════════════════════════════════════`,
    ru: `═══════════════════════════════════════════════════
Лаборатория и подробный адрес · Создайте свой аромат с Sham
═══════════════════════════════════════════════════
Организация: {facility}
Тип: {type}
Страна: {flag} {country} ({code})
Город: {city}
Район: {district}
Улица / №: {street}
Индекс: {postal}
Телефон: {phone}
Заметки о доставке: {notes}
═══════════════════════════════════════════════════`,
    zh: `═══════════════════════════════════════════════════
实验室与详细地址 · 与 Sham 一同设计您的香水
═══════════════════════════════════════════════════
机构：{facility}
类型：{type}
国家：{flag} {country}（{code}）
城市：{city}
街区：{district}
街道/编号：{street}
邮编：{postal}
电话：{phone}
运输与储存备注：{notes}
═══════════════════════════════════════════════════`,
    tr: `═══════════════════════════════════════════════════
Laboratuvar ve detaylı adres · Parfümünüzü Sham ile tasarlayın
═══════════════════════════════════════════════════
Tesis: {facility}
Tür: {type}
Ülke: {flag} {country} ({code})
Şehir: {city}
Mahalle: {district}
Sokak / No: {street}
Posta kodu: {postal}
Telefon: {phone}
Taşıma notları: {notes}
═══════════════════════════════════════════════════`,
    fa: `═══════════════════════════════════════════════════
مقر آزمایشگاه و نشانی تفصیلی · عطر خود را با شام بسازید
═══════════════════════════════════════════════════
مؤسسه: {facility}
نوع: {type}
کشور: {flag} {country} ({code})
شهر: {city}
محله: {district}
خیابان / پلاک: {street}
کد پستی: {postal}
تلفن: {phone}
یادداشت حمل و نگهداری: {notes}
═══════════════════════════════════════════════════`,
  },
} satisfies Record<string, LText>;

interface CountryAndAddressModalProps {
  currentProfile: UserEnvironmentProfile;
  currentAddress: UserDetailedAddress;
  currentUser: UserProfile | null;
  onUpdateProfile: (newProfile: UserEnvironmentProfile) => void;
  onUpdateAddress: (newAddress: UserDetailedAddress) => void;
  onApplyRegionalFormulaToWorkbench: (formula: ExtractedAIPerfume) => void;
  onClose: () => void;
  currentLang?: SupportedLanguage;
  onSelectLanguage?: (lang: SupportedLanguage) => void;
}

export const CountryAndAddressModal: React.FC<CountryAndAddressModalProps> = ({
  currentProfile,
  currentAddress,
  currentUser,
  onUpdateProfile,
  onUpdateAddress,
  onApplyRegionalFormulaToWorkbench,
  onClose,
  currentLang = 'ar',
  onSelectLanguage,
}) => {
  const L = makeT(currentLang, S);
  const [activeTab, setActiveTab] = useState<'country' | 'address' | 'currencies' | 'languages'>('country');
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<'all' | 'arab' | 'europe' | 'asia' | 'americas'>('all');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(
    currentProfile.countryCode || 'SA'
  );

  // Address form fields
  const [addressForm, setAddressForm] = useState<UserDetailedAddress>({ ...currentAddress });
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Currencies tab state
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyRegion, setCurrencyRegion] = useState<'all' | 'arab' | 'europe' | 'asia' | 'americas' | 'africa' | 'oceania'>('all');
  const [currencySavedMessage, setCurrencySavedMessage] = useState<string | null>(null);

  // Language tab state
  const [languageSearch, setLanguageSearch] = useState('');
  const [languageSavedMessage, setLanguageSavedMessage] = useState<string | null>(null);

  // Live Currency Converter state
  const [calcAmount, setCalcAmount] = useState<number>(100);
  const [calcFromCurrency, setCalcFromCurrency] = useState<string>(currentProfile.currencyCode || 'SAR');
  const [calcToCurrency, setCalcToCurrency] = useState<string>('USD');
  const selectedCountry = findCountryByCode(selectedCountryCode) || WORLD_COUNTRIES[0];
  const activeProfile = createEnvironmentProfileFromCountry(selectedCountry);

  // Close on Escape and lock body scroll
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Filtered world currencies
  const filteredCurrencies = WORLD_CURRENCIES.filter((c) => {
    if (currencyRegion !== 'all' && c.region !== currencyRegion) return false;
    if (!currencySearch.trim()) return true;
    const q = currencySearch.toLowerCase().trim();
    return (
      c.code.toLowerCase().includes(q) ||
      c.nameAr.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.symbolAr.toLowerCase().includes(q) ||
      c.symbolEn.toLowerCase().includes(q)
    );
  });

  // Filtered languages
  const filteredLanguages = SUPPORTED_LANGUAGES.filter((l) => {
    if (!languageSearch.trim()) return true;
    const q = languageSearch.toLowerCase().trim();
    return (
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  const handleSelectLanguage = (langCode: SupportedLanguage) => {
    if (onSelectLanguage) {
      onSelectLanguage(langCode);
      const conf = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      setLanguageSavedMessage(fmt(L('lang_saved_tpl'), { flag: conf?.flag || '', native: conf?.nativeName || '', name: conf?.name || '', dir: (conf?.dir || 'ltr').toUpperCase() }));
      setTimeout(() => {
        setLanguageSavedMessage(null);
      }, 3500);
    }
  };

  const handleSelectLabCurrency = (curr: WorldCurrency) => {
    const updated = updateProfileCurrency(
      currentProfile,
      curr.code
    );
    onUpdateProfile(updated);
    setCalcFromCurrency(curr.code);
    setCurrencySavedMessage(fmt(L('currency_saved_tpl'), { flag: curr.flag, name: pickArEn(currentLang, curr.nameAr, curr.nameEn), code: curr.code }));
    setTimeout(() => {
      setCurrencySavedMessage(null);
    }, 3500);
  };

  // Filtered countries
  const filteredCountries = searchCountries(searchQuery).filter((c) => {
    if (regionFilter === 'all') return true;
    return c.regionCategory === regionFilter;
  });

  const handleSelectCountry = (country: WorldCountryData) => {
    setSelectedCountryCode(country.code);
    const newProfile = createEnvironmentProfileFromCountry(country);
    saveUserEnvironment(newProfile);
    onUpdateProfile(newProfile);

    // Sync country with address form
    const phone = addressForm.phoneNumber || addressForm.phone || '';
    const updatedAddress: UserDetailedAddress = {
      ...addressForm,
      countryCode: country.code,
      countryNameAr: country.nameAr,
      countryNameEn: country.nameEn,
      phoneNumber: phone.startsWith('+')
        ? phone
        : `${country.phoneCode} `,
    };
    setAddressForm(updatedAddress);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    saveDetailedAddress(addressForm);
    onUpdateAddress(addressForm);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCopyFormattedAddress = () => {
    const formatted = fmt(L('clip_tpl'), {
      facility: addressForm.labOrFacilityName || addressForm.facilityName || L('default_facility'),
      type: pickArEn(currentLang, FACILITY_TYPE_LABELS[addressForm.facilityType]?.ar || 'معمل تركيب', FACILITY_TYPE_LABELS[addressForm.facilityType]?.en || 'Compounding Lab'),
      flag: selectedCountry.flag,
      country: pickArEn(currentLang, addressForm.countryNameAr, addressForm.countryNameEn),
      code: addressForm.countryCode,
      city: addressForm.city || addressForm.cityName || L('not_set'),
      district: addressForm.district || addressForm.districtName || L('not_set'),
      street: addressForm.street || addressForm.streetAddress || L('not_set'),
      postal: addressForm.postalCode || L('not_set'),
      phone: addressForm.phoneNumber || addressForm.phone || L('not_set'),
      notes: addressForm.additionalNotes || L('none'),
    });

    navigator.clipboard.writeText(formatted);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  const handleApplyRegionalFormula = () => {
    const rawNotes = activeProfile.traditionalNotes || [];
    const transformedNotes: PyramidNote[] = rawNotes.map((n: any, i: number) => ({
      id: `regional-note-${activeProfile.countryCode}-${i}`,
      nameAr: n.nameAr,
      nameEn: n.nameEn,
      category: n.category,
      percentageOfOil: n.percentageOfOil,
      description: n.description,
    }));

    const formula: ExtractedAIPerfume = {
      title: `${pickArEn(currentLang, 'توليفة موطن: ', 'Home Blend: ')}${pickArEn(currentLang, activeProfile.countryNameAr, activeProfile.countryNameEn).split('(')[0].trim()}`,
      author: `${pickArEn(currentLang, 'معمل صمم عطرك مع شام', 'Sham Perfume Lab')} · ${pickArEn(currentLang, activeProfile.countryNameAr, activeProfile.countryNameEn)}`,
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
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 text-stone-900 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 text-xl font-bold shadow-inner">
              {selectedCountry.flag}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  <span>{L('header_badge')}</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 text-[10px] font-mono border border-stone-700">
                  {selectedCountry.code} · {selectedCountry.currencyCode}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-serif-luxury mt-0.5">
                {L('header_title')}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-stone-800 hover:bg-rose-700 text-stone-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-stone-700 shadow-sm"
            title={L('close_window_tooltip')}
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>{L('close_btn')}</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-200 bg-stone-100/70 p-2 gap-2 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('country')}
            className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'country'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-bold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Globe className="w-4 h-4 text-amber-700" />
            <span>{fmt(L('tab1_tpl'), { n: WORLD_COUNTRIES.length })}</span>
          </button>
          <button
            onClick={() => setActiveTab('address')}
            className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'address'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-bold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Building className="w-4 h-4 text-amber-700" />
            <span>{L('tab2')}</span>
            {addressForm.city && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('currencies')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'currencies'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-bold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-700" />
            <span>{fmt(L('tab3_tpl'), { n: WORLD_CURRENCIES.length })}</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-mono font-bold">
              {currentProfile.currencyCode}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('languages')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'languages'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-bold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Languages className="w-4 h-4 text-amber-700" />
            <span>{fmt(L('tab4_tpl'), { n: SUPPORTED_LANGUAGES.length })}</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 text-[10px] font-mono font-bold">
              {currentLang.toUpperCase()}
            </span>
          </button>
        </div>

        {/* Body Container (Scrollable) */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          
          {/* TAB 1: ALL COUNTRIES SELECTOR & CLIMATE ADVICE */}
          {activeTab === 'country' && (
            <div className="space-y-6">
              
              {/* Active Selected Country Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-stone-50 border border-amber-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <span className="text-4xl shadow-xs">{selectedCountry.flag}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-950 text-base sm:text-lg">
                        {pickArEn(currentLang, selectedCountry.nameAr, selectedCountry.nameEn)}
                      </span>
                      <span className="text-xs text-stone-500 font-mono">
                        ({selectedCountry.nameEn})
                      </span>
                    </div>
                    <div className="text-xs text-stone-600 mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                        <Thermometer className="w-3.5 h-3.5" />
                        <span>{pickArEn(currentLang, selectedCountry.climateLabelAr, selectedCountry.climateLabelEn)}</span>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-stone-700">
                        {fmt(L('currency_tpl'), { sym: pickArEn(currentLang, selectedCountry.currencySymbolAr, selectedCountry.currencySymbolEn), code: selectedCountry.currencyCode })}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-stone-700">
                        {fmt(L('phone_code_tpl'), { code: selectedCountry.phoneCode })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={handleApplyRegionalFormula}
                    className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <FlaskConical className="w-4 h-4 text-amber-300" />
                    <span>{fmt(L('apply_country_tpl'), { country: pickArEn(currentLang, selectedCountry.nameAr, selectedCountry.nameEn).split('(')[0] })}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('address')}
                    className="px-3 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-stone-200"
                  >
                    <span>{L('write_address')}</span>
                  </button>
                </div>
              </div>

              {/* Fragrance Compounding Recommendations Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                  <span className="text-[11px] text-stone-500">{L('rec_conc_lbl')}</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-amber-900">
                      {selectedCountry.recommendedConcentrationPercent}%
                    </span>
                    <span className="text-xs font-semibold text-stone-700 uppercase">
                      ({selectedCountry.recommendedConcentrationType})
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1">
                    {L('rec_conc_note')}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                  <span className="text-[11px] text-stone-500">{L('fixative_lbl')}</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-amber-900">
                      {selectedCountry.recommendedFixativePercent}%
                    </span>
                    <span className="text-xs font-semibold text-stone-700">Ambroxan/DPG</span>
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1">
                    {L('fixative_note')}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                  <span className="text-[11px] text-stone-500">{L('tola_lbl')}</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-stone-900">
                      {selectedCountry.tolaSupport ? L('tola_on') : L('tola_off')}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1">
                    {selectedCountry.tolaSupport ? L('tola_on_note') : L('tola_off_note')}
                  </span>
                </div>
              </div>

              {/* Climate Advice Text */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-700 leading-relaxed flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-900">{fmt(L('climate_advice_tpl'), { country: pickArEn(currentLang, selectedCountry.nameAr, selectedCountry.nameEn) })} </span>
                  <span>{pickArEn(currentLang, selectedCountry.climateAdviceAr, selectedCountry.climateAdviceEn)}</span>
                </div>
              </div>

              {/* Search & Region Filter Bar */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={L('search_country_ph')}
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto text-[11px] no-scrollbar">
                    {[
                      { id: 'all', label: L('region_all') },
                      { id: 'arab', label: L('region_arab') },
                      { id: 'europe', label: L('region_europe') },
                      { id: 'asia', label: L('region_asia') },
                      { id: 'americas', label: L('region_americas') },
                    ].map((pill) => (
                      <button
                        key={pill.id}
                        onClick={() => setRegionFilter(pill.id as any)}
                        className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                          regionFilter === pill.id
                            ? 'bg-stone-900 text-white font-bold'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Countries Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                  {filteredCountries.map((country) => {
                    const isSelected = country.code === selectedCountryCode;
                    return (
                      <button
                        key={country.code}
                        onClick={() => handleSelectCountry(country)}
                        className={`p-3 rounded-xl border ${isRTL(currentLang) ? 'text-right' : 'text-left'} transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50/90 border-amber-800/70 shadow-xs ring-1 ring-amber-800/20'
                            : 'bg-white hover:bg-stone-50 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl shrink-0">{country.flag}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-stone-900 text-xs truncate">
                              {pickArEn(currentLang, country.nameAr, country.nameEn)}
                            </div>
                            <div className="text-[10px] text-stone-500 font-mono truncate">
                              {country.nameEn} · {country.currencyCode}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-amber-800 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {filteredCountries.length === 0 && (
                    <div className="col-span-full py-8 text-center text-stone-500 text-xs">
                      {fmt(L('no_country_tpl'), { q: searchQuery })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: DETAILED ADDRESS INQUIRY FIELDS */}
          {activeTab === 'address' && (
            <form onSubmit={handleSaveAddress} className="space-y-6">
              
              {/* Info Banner */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-stone-700 text-xs leading-relaxed flex items-start gap-3">
                <Building className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-900">{L('addr_banner_title')} </span>
                  {L('addr_banner_p')}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* 1. Country Selection */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {L('country_lbl')}
                  </label>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-300 bg-stone-50 text-stone-900 text-xs">
                    <span className="text-xl">{selectedCountry.flag}</span>
                    <span className="font-bold">{pickArEn(currentLang, selectedCountry.nameAr, selectedCountry.nameEn)}</span>
                    <span className="text-stone-500 font-mono">({selectedCountry.code})</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('country')}
                      className="mr-auto text-[11px] text-amber-800 hover:underline font-semibold cursor-pointer"
                    >
                      {L('change_country')}
                    </button>
                  </div>
                </div>

                {/* 2. Facility Name */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {L('facility_name_lbl')}
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.labOrFacilityName}
                    onChange={(e) => setAddressForm({ ...addressForm, labOrFacilityName: e.target.value })}
                    placeholder={L('facility_name_ph')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>

                {/* 3. Facility Type */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {L('facility_type_lbl')}
                  </label>
                  <select
                    value={addressForm.facilityType}
                    onChange={(e) => setAddressForm({ ...addressForm, facilityType: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 cursor-pointer"
                  >
                    {Object.entries(FACILITY_TYPE_LABELS).map(([key, val]) => (
                      <option key={key} value={key}>
                        {pickArEn(currentLang, val.ar, val.en)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. City / Governorate / State */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {L('city_lbl')}
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder={L('city_ph')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>

                {/* 5. District / Neighborhood */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {L('district_lbl')}
                  </label>
                  <input
                    type="text"
                    value={addressForm.district}
                    onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })}
                    placeholder={L('district_ph')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>

                {/* 6. Street Address & Building / Lab Number */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {L('street_lbl')}
                  </label>
                  <input
                    type="text"
                    value={addressForm.street}
                    onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                    placeholder={L('street_ph')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>

                {/* 7. Postal / ZIP Code */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {L('postal_lbl')}
                  </label>
                  <input
                    type="text"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    placeholder={L('postal_ph')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>

                {/* 8. Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {L('phone_lbl')}
                  </label>
                  <input
                    type="tel"
                    value={addressForm.phoneNumber}
                    onChange={(e) => setAddressForm({ ...addressForm, phoneNumber: e.target.value })}
                    placeholder={`${selectedCountry.phoneCode} 5XXXXXXXX`}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 ltr:text-left text-left font-mono"
                  />
                </div>

                {/* 9. Additional Notes (Full width) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {L('notes_lbl')}
                  </label>
                  <textarea
                    rows={2}
                    value={addressForm.additionalNotes}
                    onChange={(e) => setAddressForm({ ...addressForm, additionalNotes: e.target.value })}
                    placeholder={L('notes_ph')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 resize-none"
                  />
                </div>

              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{L('save_addr')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyFormattedAddress}
                    className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs flex items-center gap-1.5 border border-stone-200 transition-all cursor-pointer"
                  >
                    {copiedAddress ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">{L('copied_ok')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-stone-500" />
                        <span>{L('copy_addr')}</span>
                      </>
                    )}
                  </button>
                </div>

                {savedSuccess && (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{L('saved_ok')}</span>
                  </span>
                )}
              </div>

            </form>
          )}

          {/* TAB 3: ALL WORLD CURRENCIES & LIVE CONVERTER */}
          {activeTab === 'currencies' && (
            <div className="space-y-6 animate-in fade-in">
              
              {/* Active Lab Currency Highlight Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-50 to-stone-50 border border-amber-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-2xl font-bold shadow-md">
                    {findCurrencyByCode(currentProfile.currencyCode).flag}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-base sm:text-lg">
                        {pickArEn(currentLang, findCurrencyByCode(currentProfile.currencyCode).nameAr, findCurrencyByCode(currentProfile.currencyCode).nameEn)}
                      </span>
                      <span className="text-xs text-amber-900 font-mono font-bold bg-amber-200/80 px-2 py-0.5 rounded-md">
                        {currentProfile.currencyCode} · {pickArEn(currentLang, currentProfile.currencySymbolAr, currentProfile.currencySymbolEn)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {L('lab_currency_p')}
                    </p>
                  </div>
                </div>

                <div className="text-left md:text-right text-xs text-stone-500 font-mono">
                  <span>{L('exchange_lbl')}</span>
                  <div className="font-bold text-stone-800 text-sm">
                    1 USD ≈ {findCurrencyByCode(currentProfile.currencyCode).rateToUSD} {currentProfile.currencyCode}
                  </div>
                </div>
              </div>

              {currencySavedMessage && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{currencySavedMessage}</span>
                </div>
              )}

              {/* Live Interactive Currency Converter */}
              <div className="p-5 rounded-2xl bg-stone-900 text-white border border-stone-800 shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                    <span>{L('converter_title')}</span>
                  </div>
                  <span className="text-[11px] text-stone-400 font-mono">
                    {L('converter_note')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  {/* Amount Input */}
                  <div className="md:col-span-3">
                    <label className="text-[11px] text-stone-400 block mb-1">{L('amount_lbl')}</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={calcAmount}
                      onChange={(e) => setCalcAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* From Currency */}
                  <div className="md:col-span-4">
                    <label className="text-[11px] text-stone-400 block mb-1">{L('from_lbl')}</label>
                    <select
                      value={calcFromCurrency}
                      onChange={(e) => setCalcFromCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-xs font-semibold text-stone-200 focus:outline-none focus:border-amber-400"
                    >
                      {WORLD_CURRENCIES.map((c) => (
                        <option key={`from-${c.code}`} value={c.code}>
                          {c.flag} {c.code} - {pickArEn(currentLang, c.nameAr, c.nameEn)} ({pickArEn(currentLang, c.symbolAr, c.symbolEn)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Swap Button */}
                  <div className="md:col-span-1 flex justify-center pt-4 md:pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const temp = calcFromCurrency;
                        setCalcFromCurrency(calcToCurrency);
                        setCalcToCurrency(temp);
                      }}
                      className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 border border-stone-700 transition-colors cursor-pointer"
                      title={L('swap_tooltip')}
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                  </div>

                  {/* To Currency */}
                  <div className="md:col-span-4">
                    <label className="text-[11px] text-stone-400 block mb-1">{L('to_lbl')}</label>
                    <select
                      value={calcToCurrency}
                      onChange={(e) => setCalcToCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-xs font-semibold text-stone-200 focus:outline-none focus:border-amber-400"
                    >
                      {WORLD_CURRENCIES.map((c) => (
                        <option key={`to-${c.code}`} value={c.code}>
                          {c.flag} {c.code} - {pickArEn(currentLang, c.nameAr, c.nameEn)} ({pickArEn(currentLang, c.symbolAr, c.symbolEn)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Conversion Result Display */}
                <div className="p-3.5 bg-stone-850 rounded-xl border border-stone-750 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-stone-400">{L('result_lbl')}</span>
                    <span className="font-mono font-extrabold text-base sm:text-lg text-amber-400">
                      {calcAmount.toLocaleString(LOCALE_MAP[currentLang])} {pickArEn(currentLang, findCurrencyByCode(calcFromCurrency).symbolAr, findCurrencyByCode(calcFromCurrency).symbolEn)} ={' '}
                      {convertCurrency(calcAmount, calcFromCurrency, calcToCurrency).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{' '}
                      {pickArEn(currentLang, findCurrencyByCode(calcToCurrency).symbolAr, findCurrencyByCode(calcToCurrency).symbolEn)} ({calcToCurrency})
                    </span>
                  </div>

                  <div className="text-[11px] text-stone-400 font-mono">
                    1 {calcFromCurrency} ≈{' '}
                    {convertCurrency(1, calcFromCurrency, calcToCurrency).toFixed(4)} {calcToCurrency}
                  </div>
                </div>
              </div>

              {/* Search & Category Filter */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  
                  {/* Search Bar */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={L('search_currency_ph')}
                      value={currencySearch}
                      onChange={(e) => setCurrencySearch(e.target.value)}
                      className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-amber-700 focus:bg-white transition-colors"
                    />
                  </div>

                  <span className="text-xs text-stone-500 font-medium shrink-0 self-center">
                    {fmt(L('currencies_count_tpl'), { n: filteredCurrencies.length })}
                  </span>
                </div>

                {/* Region Filter Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  {[
                    { id: 'all', label: L('curr_all') },
                    { id: 'arab', label: L('region_arab') },
                    { id: 'europe', label: L('region_europe') },
                    { id: 'asia', label: L('curr_asia') },
                    { id: 'americas', label: L('region_americas') },
                    { id: 'africa', label: L('curr_africa') },
                    { id: 'oceania', label: L('curr_oceania') },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCurrencyRegion(cat.id as any)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        currencyRegion === cat.id
                          ? 'bg-amber-800 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of All World Currencies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {filteredCurrencies.map((curr) => {
                  const isActive = currentProfile.currencyCode === curr.code;

                  return (
                    <div
                      key={curr.code}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                        isActive
                          ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/30 shadow-xs'
                          : 'bg-white border-stone-200/90 hover:border-stone-300 hover:bg-stone-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{curr.flag}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-stone-900 text-xs">
                                {pickArEn(currentLang, curr.nameAr, curr.nameEn)}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.2 rounded">
                                {curr.code}
                              </span>
                            </div>
                            <span className="text-[10px] text-stone-500 font-mono">
                              {curr.nameEn} · {pickArEn(currentLang, curr.symbolAr, curr.symbolEn)}
                            </span>
                          </div>
                        </div>

                        {curr.popular && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-bold">
                            {L('popular')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[10px]">
                        <span className="text-stone-500 font-mono">
                          1 USD ≈ {curr.rateToUSD} {curr.code}
                        </span>

                        {isActive ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{L('active_in_lab')}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectLabCurrency(curr)}
                            className="px-2.5 py-1 rounded-md bg-stone-900 hover:bg-amber-700 text-white font-semibold transition-colors cursor-pointer"
                          >
                            {L('set_lab_currency')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* TAB 4: PLATFORM LANGUAGES SELECTOR (10 LANGUAGES) */}
          {activeTab === 'languages' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white p-5 rounded-2xl shadow-sm border border-amber-900/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/40 text-xl shrink-0">
                      <Languages className="w-6 h-6 text-amber-300" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <span>{L('lang_header')}</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                          {fmt(L('langs_badge'), { n: SUPPORTED_LANGUAGES.length })}
                        </span>
                      </h4>
                      <p className="text-xs text-stone-300 mt-1 max-w-xl">
                        {L('lang_header_p')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-stone-850/80 p-2.5 rounded-xl border border-stone-700/60 shrink-0">
                    <span className="text-2xl leading-none">
                      {SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.flag || '🇸🇦'}
                    </span>
                    <div className="text-right">
                      <div className="text-[10px] text-stone-400">{L('current_lang_lbl')}</div>
                      <div className="font-bold text-xs text-amber-300">
                        {SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.nativeName} ({currentLang.toUpperCase()})
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification Banner */}
              {languageSavedMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{languageSavedMessage}</span>
                </div>
              )}

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={L('search_lang_ph')}
                    value={languageSearch}
                    onChange={(e) => setLanguageSearch(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="text-xs text-stone-500 font-medium px-2">
                  {fmt(L('langs_count_tpl'), { a: filteredLanguages.length, b: SUPPORTED_LANGUAGES.length })}
                </div>
              </div>

              {/* Languages Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredLanguages.map((lang: LanguageConfig) => {
                  const isActive = lang.code === currentLang;
                  return (
                    <div
                      key={lang.code}
                      onClick={() => handleSelectLanguage(lang.code)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                        isActive
                          ? 'bg-amber-50/80 border-amber-400 shadow-sm ring-2 ring-amber-300/40'
                          : 'bg-white hover:bg-stone-50 border-stone-200 hover:border-amber-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl group-hover:scale-110 transition-transform">
                              {lang.flag}
                            </span>
                            <div>
                              <div className="font-bold text-sm text-stone-900 group-hover:text-amber-900 transition-colors">
                                {lang.nativeName}
                              </div>
                              <div className="text-xs text-stone-500">
                                {lang.name} · <span className="font-mono font-bold uppercase">{lang.code}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                                lang.dir === 'rtl'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {lang.dir === 'rtl' ? L('rtl_lbl') : L('ltr_lbl')}
                            </span>
                          </div>
                        </div>

                        {/* Sample preview text */}
                        <div className="mt-2.5 p-2 rounded-lg bg-stone-100/70 border border-stone-200/60 text-[11px] text-stone-600 font-serif-luxury truncate">
                          {lang.code === 'ar' && '«صمم عطرك مع شام: الدقة الكيميائية والإبداع الفني العالمي»'}
                          {lang.code === 'en' && '“Design Perfume with Sham: Chemical Precision & Haute Artistry”'}
                          {lang.code === 'fr' && '«Créez Votre Parfum avec Sham : Précision Chimique et Haute Parfumerie»'}
                          {lang.code === 'es' && '«Diseña tu Perfume con Sham: Precisión Química y Arte Olfativo»'}
                          {lang.code === 'it' && '«Disegna il tuo Profumo con Sham: Precisione Chimica e Bellezza»'}
                          {lang.code === 'de' && '«Parfüm Kreieren mit Sham: Chemische Präzision & Duftkunst»'}
                          {lang.code === 'ru' && '«Создай свой парфюм с Шам: Точность и парфюмерное искусство»'}
                          {lang.code === 'zh' && '“与Sham一起设计香水：化学精密与高定时香水艺术”'}
                          {lang.code === 'tr' && '«Sham ile Parfümünü Tasarla: Kimyasal Hassasiyet ve Koku Sanatı»'}
                          {lang.code === 'fa' && '«عطر خود را با شام طراحی کنید: دقت شیمیایی و هنر عطرسازی»'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-stone-150 text-xs">
                        <span className="text-[11px] text-stone-500">
                          {isActive ? L('active_lang') : L('click_switch')}
                        </span>

                        {isActive ? (
                          <span className="text-amber-900 font-bold flex items-center gap-1.5 bg-amber-200/80 px-2.5 py-1 rounded-lg">
                            <Check className="w-3.5 h-3.5 text-amber-900 stroke-[3]" />
                            <span>{L('enabled')}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectLanguage(lang.code);
                            }}
                            className="px-3 py-1 rounded-lg bg-stone-900 hover:bg-amber-800 text-white font-semibold transition-colors cursor-pointer text-xs"
                          >
                            {L('enable_lang')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-stone-100 p-4 sm:p-5 border-t border-stone-200 flex items-center justify-between shrink-0 text-xs">
          <div className="text-stone-500 text-[11px] flex items-center gap-2">
            <span>{fmt(L('active_country_tpl'), { flag: selectedCountry.flag, name: pickArEn(currentLang, selectedCountry.nameAr, selectedCountry.nameEn) })}</span>
            <span>•</span>
            <span>{fmt(L('footer_currency_tpl'), { code: selectedCountry.currencyCode })}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium transition-colors cursor-pointer"
          >
            {L('close')}
          </button>
        </div>

      </div>
    </div>
  );
};
