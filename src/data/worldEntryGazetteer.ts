/**
 * Global Gazetteer & Precision Geo-Entry Resolver for «روبوت التعداد — دولة المنصة».
 *
 * Maps edge/CDN city names, ISO-3166-2 region codes, and IANA timezones to bilingual
 * Arabic/English place names and city-level coordinates (`0.01°` precision — never house/street
 * level, preserving visitor privacy while pinpointing exact city/governorate entry inside each country).
 */

export type GeoPrecision = 'edge-coords' | 'edge-city' | 'timezone' | 'country';

export interface GazetteerCity {
  key: string;
  country: string;
  cityAr: string;
  cityEn: string;
  regionAr?: string;
  regionEn?: string;
  regionCodes?: string[];
  aliases?: string[];
  lat: number;
  lon: number;
}

export const WORLD_CITIES: readonly GazetteerCity[] = [
  // ── Egypt (All 27 Governorates & Major Cities) ──
  { key: 'cairo', country: 'EG', cityAr: 'القاهرة', cityEn: 'Cairo', regionAr: 'محافظة القاهرة', regionEn: 'Cairo Governorate', regionCodes: ['C', 'CAI'], aliases: ['al qahirah', 'new cairo', 'heliopolis', 'nasr city', 'maadi', 'helwan'], lat: 30.04, lon: 31.24 },
  { key: 'giza', country: 'EG', cityAr: 'الجيزة', cityEn: 'Giza', regionAr: 'محافظة الجيزة', regionEn: 'Giza Governorate', regionCodes: ['GZ', 'GIZ'], aliases: ['al jizah', '6th of october', 'october city', 'sheikh zayed', 'dokki', 'mohandessin', 'haram'], lat: 30.01, lon: 31.21 },
  { key: 'alexandria', country: 'EG', cityAr: 'الإسكندرية', cityEn: 'Alexandria', regionAr: 'محافظة الإسكندرية', regionEn: 'Alexandria Governorate', regionCodes: ['ALX'], aliases: ['al iskandariyah', 'borg el arab'], lat: 31.20, lon: 29.92 },
  { key: 'mansoura', country: 'EG', cityAr: 'المنصورة', cityEn: 'Mansoura', regionAr: 'الدقهلية', regionEn: 'Dakahlia', regionCodes: ['DK'], aliases: ['al mansurah', 'talkha', 'mit ghamr'], lat: 31.04, lon: 31.38 },
  { key: 'zagazig', country: 'EG', cityAr: 'الزقازيق', cityEn: 'Zagazig', regionAr: 'الشرقية', regionEn: 'Sharqia', regionCodes: ['SHR'], aliases: ['az zaqaziq', '10th of ramadan', 'tenth of ramadan', 'bilbeis'], lat: 30.59, lon: 31.50 },
  { key: 'tanta', country: 'EG', cityAr: 'طنطا', cityEn: 'Tanta', regionAr: 'الغربية', regionEn: 'Gharbia', regionCodes: ['GH'], aliases: ['el mahalla', 'mahalla el kubra'], lat: 30.79, lon: 31.00 },
  { key: 'banha', country: 'EG', cityAr: 'بنها / شبرا الخيمة', cityEn: 'Banha', regionAr: 'القليوبية', regionEn: 'Qalyubia', regionCodes: ['KB'], aliases: ['shubra al khaymah', 'shubra el kheima', 'obour', 'qalyub'], lat: 30.47, lon: 31.18 },
  { key: 'damanhur', country: 'EG', cityAr: 'دمنهور', cityEn: 'Damanhur', regionAr: 'البحيرة', regionEn: 'Beheira', regionCodes: ['BH'], aliases: ['kafr el dawwar'], lat: 31.03, lon: 30.47 },
  { key: 'shibin_el_kom', country: 'EG', cityAr: 'شبين الكوم', cityEn: 'Shibin El Kom', regionAr: 'المنوفية', regionEn: 'Monufia', regionCodes: ['MNF'], aliases: ['sadat city', 'menouf'], lat: 30.55, lon: 31.01 },
  { key: 'kafr_el_sheikh', country: 'EG', cityAr: 'كفر الشيخ', cityEn: 'Kafr El Sheikh', regionAr: 'محافظة كفر الشيخ', regionEn: 'Kafr El Sheikh', regionCodes: ['KFS'], aliases: ['desouk'], lat: 31.11, lon: 30.94 },
  { key: 'damietta', country: 'EG', cityAr: 'دمياط', cityEn: 'Damietta', regionAr: 'محافظة دمياط', regionEn: 'Damietta', regionCodes: ['DT'], aliases: ['dumyat', 'new damietta'], lat: 31.42, lon: 31.81 },
  { key: 'port_said', country: 'EG', cityAr: 'بورسعيد', cityEn: 'Port Said', regionAr: 'محافظة بورسعيد', regionEn: 'Port Said', regionCodes: ['PTS'], aliases: ['bur said'], lat: 31.27, lon: 32.30 },
  { key: 'ismailia', country: 'EG', cityAr: 'الإسماعيلية', cityEn: 'Ismailia', regionAr: 'محافظة الإسماعيلية', regionEn: 'Ismailia', regionCodes: ['IS'], aliases: ['al ismailiyah'], lat: 30.60, lon: 32.27 },
  { key: 'suez', country: 'EG', cityAr: 'السويس', cityEn: 'Suez', regionAr: 'محافظة السويس', regionEn: 'Suez', regionCodes: ['SUZ'], aliases: ['as suways', 'ain sokhna'], lat: 29.97, lon: 32.55 },
  { key: 'faiyum', country: 'EG', cityAr: 'الفيوم', cityEn: 'Faiyum', regionAr: 'محافظة الفيوم', regionEn: 'Faiyum', regionCodes: ['FYM'], aliases: ['fayoum', 'al fayyum'], lat: 29.31, lon: 30.84 },
  { key: 'beni_suef', country: 'EG', cityAr: 'بني سويف', cityEn: 'Beni Suef', regionAr: 'محافظة بني سويف', regionEn: 'Beni Suef', regionCodes: ['BNS'], aliases: ['bani suwayf'], lat: 29.07, lon: 31.10 },
  { key: 'minya', country: 'EG', cityAr: 'المنيا', cityEn: 'Minya', regionAr: 'محافظة المنيا', regionEn: 'Minya', regionCodes: ['MN'], aliases: ['al minya'], lat: 28.11, lon: 30.75 },
  { key: 'assiut', country: 'EG', cityAr: 'أسيوط', cityEn: 'Assiut', regionAr: 'محافظة أسيوط', regionEn: 'Assiut', regionCodes: ['AST'], aliases: ['asyut'], lat: 27.18, lon: 31.18 },
  { key: 'sohag', country: 'EG', cityAr: 'سوهاج', cityEn: 'Sohag', regionAr: 'محافظة سوهاج', regionEn: 'Sohag', regionCodes: ['SHG'], aliases: ['suhaj'], lat: 26.56, lon: 31.69 },
  { key: 'qena', country: 'EG', cityAr: 'قنا', cityEn: 'Qena', regionAr: 'محافظة قنا', regionEn: 'Qena', regionCodes: ['KN'], aliases: ['qina'], lat: 26.16, lon: 32.72 },
  { key: 'luxor', country: 'EG', cityAr: 'الأقصر', cityEn: 'Luxor', regionAr: 'محافظة الأقصر', regionEn: 'Luxor', regionCodes: ['LX'], aliases: ['al uqsur'], lat: 25.69, lon: 32.64 },
  { key: 'aswan', country: 'EG', cityAr: 'أسوان', cityEn: 'Aswan', regionAr: 'محافظة أسوان', regionEn: 'Aswan', regionCodes: ['ASN'], lat: 24.09, lon: 32.90 },
  { key: 'hurghada', country: 'EG', cityAr: 'الغردقة', cityEn: 'Hurghada', regionAr: 'البحر الأحمر', regionEn: 'Red Sea', regionCodes: ['BA'], aliases: ['el gouna', 'marsa alam', 'safaga'], lat: 27.26, lon: 33.81 },
  { key: 'sharm_el_sheikh', country: 'EG', cityAr: 'شرم الشيخ', cityEn: 'Sharm El Sheikh', regionAr: 'جنوب سيناء', regionEn: 'South Sinai', regionCodes: ['JS'], aliases: ['dahab', 'el tor'], lat: 27.92, lon: 34.33 },
  { key: 'arish', country: 'EG', cityAr: 'العريش', cityEn: 'Arish', regionAr: 'شمال سيناء', regionEn: 'North Sinai', regionCodes: ['SIN'], lat: 31.13, lon: 33.80 },
  { key: 'marsa_matruh', country: 'EG', cityAr: 'مرسى مطروح', cityEn: 'Marsa Matruh', regionAr: 'مطروح', regionEn: 'Matrouh', regionCodes: ['MT'], aliases: ['new alamein', 'el alamein', 'siwa'], lat: 31.35, lon: 27.24 },
  { key: 'kharga', country: 'EG', cityAr: 'الخارجة', cityEn: 'Kharga', regionAr: 'الوادي الجديد', regionEn: 'New Valley', regionCodes: ['WAD'], lat: 25.45, lon: 30.55 },

  // ── Saudi Arabia ──
  { key: 'riyadh', country: 'SA', cityAr: 'الرياض', cityEn: 'Riyadh', regionAr: 'منطقة الرياض', regionEn: 'Riyadh Region', regionCodes: ['01'], aliases: ['ar riyad'], lat: 24.71, lon: 46.68 },
  { key: 'jeddah', country: 'SA', cityAr: 'جدة', cityEn: 'Jeddah', regionAr: 'منطقة مكة المكرمة', regionEn: 'Makkah Region', aliases: ['jiddah'], lat: 21.49, lon: 39.19 },
  { key: 'mecca', country: 'SA', cityAr: 'مكة المكرمة', cityEn: 'Mecca', regionAr: 'منطقة مكة المكرمة', regionEn: 'Makkah Region', regionCodes: ['02'], aliases: ['makkah'], lat: 21.39, lon: 39.86 },
  { key: 'medina', country: 'SA', cityAr: 'المدينة المنورة', cityEn: 'Medina', regionAr: 'منطقة المدينة المنورة', regionEn: 'Madinah Region', regionCodes: ['03'], aliases: ['madinah', 'al madinah'], lat: 24.52, lon: 39.57 },
  { key: 'dammam', country: 'SA', cityAr: 'الدمام', cityEn: 'Dammam', regionAr: 'المنطقة الشرقية', regionEn: 'Eastern Province', regionCodes: ['04'], aliases: ['dhahran', 'jubail', 'qatif', 'al ahsa', 'hofuf'], lat: 26.42, lon: 50.09 },
  { key: 'khobar', country: 'SA', cityAr: 'الخبر', cityEn: 'Khobar', regionAr: 'المنطقة الشرقية', regionEn: 'Eastern Province', aliases: ['al khobar'], lat: 26.22, lon: 50.20 },
  { key: 'buraidah', country: 'SA', cityAr: 'بريدة', cityEn: 'Buraidah', regionAr: 'منطقة القصيم', regionEn: 'Qassim', regionCodes: ['05'], aliases: ['unaizah'], lat: 26.33, lon: 43.98 },
  { key: 'hail', country: 'SA', cityAr: 'حائل', cityEn: 'Hail', regionAr: 'منطقة حائل', regionEn: 'Hail', regionCodes: ['06'], lat: 27.51, lon: 41.72 },
  { key: 'tabuk', country: 'SA', cityAr: 'تبوك', cityEn: 'Tabuk', regionAr: 'منطقة تبوك', regionEn: 'Tabuk', regionCodes: ['07'], lat: 28.38, lon: 36.56 },
  { key: 'jazan', country: 'SA', cityAr: 'جازان', cityEn: 'Jazan', regionAr: 'منطقة جازان', regionEn: 'Jazan', regionCodes: ['09'], lat: 16.89, lon: 42.55 },
  { key: 'najran', country: 'SA', cityAr: 'نجران', cityEn: 'Najran', regionAr: 'منطقة نجران', regionEn: 'Najran', regionCodes: ['10'], lat: 17.49, lon: 44.13 },
  { key: 'abha', country: 'SA', cityAr: 'أبها / خميس مشيط', cityEn: 'Abha', regionAr: 'منطقة عسير', regionEn: 'Asir', regionCodes: ['14'], aliases: ['khamis mushait'], lat: 18.22, lon: 42.51 },
  { key: 'taif', country: 'SA', cityAr: 'الطائف', cityEn: 'Taif', regionAr: 'منطقة مكة المكرمة', regionEn: 'Makkah Region', lat: 21.27, lon: 40.42 },

  // ── United Arab Emirates ──
  { key: 'dubai', country: 'AE', cityAr: 'دبي', cityEn: 'Dubai', regionAr: 'إمارة دبي', regionEn: 'Dubai', regionCodes: ['DU'], lat: 25.20, lon: 55.27 },
  { key: 'abu_dhabi', country: 'AE', cityAr: 'أبوظبي', cityEn: 'Abu Dhabi', regionAr: 'إمارة أبوظبي', regionEn: 'Abu Dhabi', regionCodes: ['AZ'], aliases: ['al ain'], lat: 24.45, lon: 54.38 },
  { key: 'sharjah', country: 'AE', cityAr: 'الشارقة', cityEn: 'Sharjah', regionAr: 'إمارة الشارقة', regionEn: 'Sharjah', regionCodes: ['SH'], lat: 25.35, lon: 55.42 },
  { key: 'ajman', country: 'AE', cityAr: 'عجمان', cityEn: 'Ajman', regionAr: 'إمارة عجمان', regionEn: 'Ajman', regionCodes: ['AJ'], lat: 25.41, lon: 55.51 },
  { key: 'rak', country: 'AE', cityAr: 'رأس الخيمة', cityEn: 'Ras Al Khaimah', regionAr: 'رأس الخيمة', regionEn: 'Ras Al Khaimah', regionCodes: ['RK'], lat: 25.79, lon: 55.94 },
  { key: 'fujairah', country: 'AE', cityAr: 'الفجيرة', cityEn: 'Fujairah', regionAr: 'إمارة الفجيرة', regionEn: 'Fujairah', regionCodes: ['FU'], lat: 25.13, lon: 56.33 },

  // ── GCC, Levant, Iraq, North Africa ──
  { key: 'kuwait_city', country: 'KW', cityAr: 'مدينة الكويت', cityEn: 'Kuwait City', regionAr: 'العاصمة', regionEn: 'Al Asimah', aliases: ['kuwait', 'hawalli', 'salmiya', 'farwaniya', 'ahmadi'], lat: 29.38, lon: 47.98 },
  { key: 'doha', country: 'QA', cityAr: 'الدوحة', cityEn: 'Doha', regionAr: 'الدوحة', regionEn: 'Doha', aliases: ['al rayyan', 'al wakrah', 'lusail'], lat: 25.29, lon: 51.53 },
  { key: 'manama', country: 'BH', cityAr: 'المنامة', cityEn: 'Manama', regionAr: 'العاصمة', regionEn: 'Capital', aliases: ['muharraq', 'riffa'], lat: 26.22, lon: 50.59 },
  { key: 'muscat', country: 'OM', cityAr: 'مسقط', cityEn: 'Muscat', regionAr: 'محافظة مسقط', regionEn: 'Muscat', aliases: ['seeb', 'sohar', 'salalah'], lat: 23.59, lon: 58.38 },
  { key: 'amman', country: 'JO', cityAr: 'عمّان', cityEn: 'Amman', regionAr: 'العاصمة عمّان', regionEn: 'Amman', aliases: ['zarqa', 'irbid', 'aqaba'], lat: 31.95, lon: 35.91 },
  { key: 'beirut', country: 'LB', cityAr: 'بيروت', cityEn: 'Beirut', regionAr: 'محافظة بيروت', regionEn: 'Beirut', aliases: ['tripoli', 'sidon', 'jounieh'], lat: 33.89, lon: 35.50 },
  { key: 'jerusalem', country: 'PS', cityAr: 'القدس / رام الله', cityEn: 'Jerusalem / Ramallah', regionAr: 'فلسطين', regionEn: 'Palestine', aliases: ['ramallah', 'nablus', 'hebron', 'bethlehem'], lat: 31.90, lon: 35.20 },
  { key: 'gaza', country: 'PS', cityAr: 'غزة', cityEn: 'Gaza', regionAr: 'قطاع غزة', regionEn: 'Gaza', lat: 31.50, lon: 34.47 },
  { key: 'damascus', country: 'SY', cityAr: 'دمشق', cityEn: 'Damascus', regionAr: 'دمشق', regionEn: 'Damascus', aliases: ['homs', 'latakia'], lat: 33.51, lon: 36.29 },
  { key: 'aleppo', country: 'SY', cityAr: 'حلب', cityEn: 'Aleppo', regionAr: 'حلب', regionEn: 'Aleppo', lat: 36.20, lon: 37.13 },
  { key: 'baghdad', country: 'IQ', cityAr: 'بغداد', cityEn: 'Baghdad', regionAr: 'محافظة بغداد', regionEn: 'Baghdad', aliases: ['najaf', 'karbala'], lat: 33.31, lon: 44.37 },
  { key: 'basra', country: 'IQ', cityAr: 'البصرة', cityEn: 'Basra', regionAr: 'البصرة', regionEn: 'Basra', lat: 30.51, lon: 47.78 },
  { key: 'erbil', country: 'IQ', cityAr: 'أربيل', cityEn: 'Erbil', regionAr: 'أربيل', regionEn: 'Erbil', aliases: ['mosul', 'sulaymaniyah'], lat: 36.19, lon: 44.01 },
  { key: 'sanaa', country: 'YE', cityAr: 'صنعاء', cityEn: 'Sanaa', regionAr: 'صنعاء', regionEn: 'Sanaa', aliases: ['aden', 'taiz'], lat: 15.37, lon: 44.19 },
  { key: 'khartoum', country: 'SD', cityAr: 'الخرطوم', cityEn: 'Khartoum', regionAr: 'الخرطوم', regionEn: 'Khartoum', aliases: ['omdurman', 'port sudan'], lat: 15.50, lon: 32.56 },
  { key: 'tripoli_ly', country: 'LY', cityAr: 'طرابلس', cityEn: 'Tripoli', regionAr: 'طرابلس', regionEn: 'Tripoli', aliases: ['misrata'], lat: 32.89, lon: 13.19 },
  { key: 'benghazi', country: 'LY', cityAr: 'بنغازي', cityEn: 'Benghazi', regionAr: 'بنغازي', regionEn: 'Benghazi', lat: 32.12, lon: 20.09 },
  { key: 'tunis', country: 'TN', cityAr: 'تونس العاصمة', cityEn: 'Tunis', regionAr: 'تونس', regionEn: 'Tunis', aliases: ['sfax', 'sousse'], lat: 36.81, lon: 10.18 },
  { key: 'algiers', country: 'DZ', cityAr: 'الجزائر العاصمة', cityEn: 'Algiers', regionAr: 'الجزائر', regionEn: 'Algiers', aliases: ['oran', 'constantine'], lat: 36.75, lon: 3.06 },
  { key: 'casablanca', country: 'MA', cityAr: 'الدار البيضاء', cityEn: 'Casablanca', regionAr: 'الدار البيضاء - سطات', regionEn: 'Casablanca-Settat', lat: 33.57, lon: -7.59 },
  { key: 'rabat', country: 'MA', cityAr: 'الرباط', cityEn: 'Rabat', regionAr: 'الرباط - سلا', regionEn: 'Rabat-Sale', aliases: ['marrakesh', 'marrakech', 'tangier', 'fes'], lat: 34.02, lon: -6.84 },
  { key: 'nouakchott', country: 'MR', cityAr: 'نواكشوط', cityEn: 'Nouakchott', lat: 18.07, lon: -15.96 },
  { key: 'mogadishu', country: 'SO', cityAr: 'مقديشو', cityEn: 'Mogadishu', lat: 2.05, lon: 45.32 },
  { key: 'djibouti', country: 'DJ', cityAr: 'جيبوتي', cityEn: 'Djibouti', lat: 11.57, lon: 43.15 },

  // ── Europe & Turkey ──
  { key: 'istanbul', country: 'TR', cityAr: 'إسطنبول', cityEn: 'Istanbul', lat: 41.01, lon: 28.98 },
  { key: 'ankara', country: 'TR', cityAr: 'أنقرة', cityEn: 'Ankara', aliases: ['izmir', 'antalya'], lat: 39.93, lon: 32.86 },
  { key: 'london', country: 'GB', cityAr: 'لندن', cityEn: 'London', aliases: ['manchester', 'birmingham', 'edinburgh'], lat: 51.51, lon: -0.13 },
  { key: 'paris', country: 'FR', cityAr: 'باريس', cityEn: 'Paris', aliases: ['lyon', 'marseille', 'nice'], lat: 48.86, lon: 2.35 },
  { key: 'berlin', country: 'DE', cityAr: 'برلين', cityEn: 'Berlin', lat: 52.52, lon: 13.40 },
  { key: 'frankfurt', country: 'DE', cityAr: 'فرانكفورت', cityEn: 'Frankfurt', aliases: ['munich', 'hamburg', 'cologne', 'dusseldorf'], lat: 50.11, lon: 8.68 },
  { key: 'rome', country: 'IT', cityAr: 'روما', cityEn: 'Rome', aliases: ['milan', 'milano', 'naples'], lat: 41.90, lon: 12.50 },
  { key: 'madrid', country: 'ES', cityAr: 'مدريد', cityEn: 'Madrid', aliases: ['barcelona', 'valencia'], lat: 40.42, lon: -3.70 },
  { key: 'amsterdam', country: 'NL', cityAr: 'أمستردام', cityEn: 'Amsterdam', aliases: ['rotterdam'], lat: 52.37, lon: 4.90 },
  { key: 'brussels', country: 'BE', cityAr: 'بروكسل', cityEn: 'Brussels', lat: 50.85, lon: 4.35 },
  { key: 'zurich', country: 'CH', cityAr: 'زيورخ / جنيف', cityEn: 'Zurich', aliases: ['geneva'], lat: 47.37, lon: 8.54 },
  { key: 'vienna', country: 'AT', cityAr: 'فيينا', cityEn: 'Vienna', lat: 48.21, lon: 16.37 },
  { key: 'stockholm', country: 'SE', cityAr: 'ستوكهولم', cityEn: 'Stockholm', lat: 59.33, lon: 18.07 },
  { key: 'oslo', country: 'NO', cityAr: 'أوسلو', cityEn: 'Oslo', lat: 59.91, lon: 10.75 },
  { key: 'copenhagen', country: 'DK', cityAr: 'كوبنهاغن', cityEn: 'Copenhagen', lat: 55.68, lon: 12.57 },
  { key: 'warsaw', country: 'PL', cityAr: 'وارسو', cityEn: 'Warsaw', lat: 52.23, lon: 21.01 },
  { key: 'athens', country: 'GR', cityAr: 'أثينا', cityEn: 'Athens', lat: 37.98, lon: 23.73 },
  { key: 'moscow', country: 'RU', cityAr: 'موسكو', cityEn: 'Moscow', lat: 55.76, lon: 37.62 },
  { key: 'kyiv', country: 'UA', cityAr: 'كييف', cityEn: 'Kyiv', lat: 50.45, lon: 30.52 },
  { key: 'dublin', country: 'IE', cityAr: 'دبلن', cityEn: 'Dublin', lat: 53.35, lon: -6.26 },
  { key: 'lisbon', country: 'PT', cityAr: 'لشبونة', cityEn: 'Lisbon', lat: 38.72, lon: -9.14 },

  // ── Americas ──
  { key: 'new_york', country: 'US', cityAr: 'نيويورك', cityEn: 'New York', regionCodes: ['NY', 'NJ'], lat: 40.71, lon: -74.01 },
  { key: 'los_angeles', country: 'US', cityAr: 'لوس أنجلوس', cityEn: 'Los Angeles', regionCodes: ['CA'], aliases: ['san francisco', 'san jose', 'san diego'], lat: 34.05, lon: -118.24 },
  { key: 'chicago', country: 'US', cityAr: 'شيكاغو', cityEn: 'Chicago', regionCodes: ['IL'], lat: 41.88, lon: -87.63 },
  { key: 'houston', country: 'US', cityAr: 'هيوستن / دالاس', cityEn: 'Houston', regionCodes: ['TX'], aliases: ['dallas', 'austin'], lat: 29.76, lon: -95.37 },
  { key: 'miami', country: 'US', cityAr: 'ميامي', cityEn: 'Miami', regionCodes: ['FL'], aliases: ['orlando'], lat: 25.76, lon: -80.19 },
  { key: 'ashburn', country: 'US', cityAr: 'واشنطن / فيرجينيا', cityEn: 'Washington DC / Virginia', regionCodes: ['VA', 'DC', 'MD'], aliases: ['washington'], lat: 38.90, lon: -77.04 },
  { key: 'toronto', country: 'CA', cityAr: 'تورونتو', cityEn: 'Toronto', aliases: ['montreal', 'ottawa', 'vancouver'], lat: 43.65, lon: -79.38 },
  { key: 'mexico_city', country: 'MX', cityAr: 'مكسيكو سيتي', cityEn: 'Mexico City', lat: 19.43, lon: -99.13 },
  { key: 'sao_paulo', country: 'BR', cityAr: 'ساو باولو', cityEn: 'Sao Paulo', aliases: ['rio de janeiro'], lat: -23.55, lon: -46.63 },
  { key: 'buenos_aires', country: 'AR', cityAr: 'بوينس آيرس', cityEn: 'Buenos Aires', lat: -34.60, lon: -58.38 },
  { key: 'bogota', country: 'CO', cityAr: 'بوغوتا', cityEn: 'Bogota', lat: 4.71, lon: -74.07 },

  // ── Asia, Africa & Oceania ──
  { key: 'tokyo', country: 'JP', cityAr: 'طوكيو', cityEn: 'Tokyo', aliases: ['osaka', 'yokohama'], lat: 35.68, lon: 139.65 },
  { key: 'seoul', country: 'KR', cityAr: 'سيول', cityEn: 'Seoul', lat: 37.57, lon: 126.98 },
  { key: 'beijing', country: 'CN', cityAr: 'بكين', cityEn: 'Beijing', aliases: ['shanghai', 'shenzhen', 'guangzhou'], lat: 39.90, lon: 116.41 },
  { key: 'hong_kong', country: 'HK', cityAr: 'هونغ كونغ', cityEn: 'Hong Kong', lat: 22.32, lon: 114.17 },
  { key: 'mumbai', country: 'IN', cityAr: 'مومباي', cityEn: 'Mumbai', aliases: ['new delhi', 'delhi', 'bengaluru', 'bangalore', 'hyderabad'], lat: 19.08, lon: 72.88 },
  { key: 'karachi', country: 'PK', cityAr: 'كراتشي', cityEn: 'Karachi', aliases: ['lahore', 'islamabad'], lat: 24.86, lon: 67.01 },
  { key: 'dhaka', country: 'BD', cityAr: 'دكا', cityEn: 'Dhaka', lat: 23.81, lon: 90.41 },
  { key: 'jakarta', country: 'ID', cityAr: 'جاكرتا', cityEn: 'Jakarta', lat: -6.21, lon: 106.85 },
  { key: 'kuala_lumpur', country: 'MY', cityAr: 'كوالالمبور', cityEn: 'Kuala Lumpur', lat: 3.14, lon: 101.69 },
  { key: 'singapore', country: 'SG', cityAr: 'سنغافورة', cityEn: 'Singapore', lat: 1.35, lon: 103.82 },
  { key: 'bangkok', country: 'TH', cityAr: 'بانكوك', cityEn: 'Bangkok', lat: 13.76, lon: 100.50 },
  { key: 'manila', country: 'PH', cityAr: 'مانيلا', cityEn: 'Manila', lat: 14.60, lon: 120.98 },
  { key: 'lagos', country: 'NG', cityAr: 'لاغوس', cityEn: 'Lagos', aliases: ['abuja'], lat: 6.52, lon: 3.38 },
  { key: 'johannesburg', country: 'ZA', cityAr: 'جوهانسبرغ', cityEn: 'Johannesburg', aliases: ['cape town'], lat: -26.20, lon: 28.05 },
  { key: 'nairobi', country: 'KE', cityAr: 'نيروبي', cityEn: 'Nairobi', lat: -1.29, lon: 36.82 },
  { key: 'addis_ababa', country: 'ET', cityAr: 'أديس أبابا', cityEn: 'Addis Ababa', lat: 9.03, lon: 38.74 },
  { key: 'sydney', country: 'AU', cityAr: 'سيدني', cityEn: 'Sydney', aliases: ['melbourne', 'brisbane', 'perth'], lat: -33.87, lon: 151.21 },
  { key: 'auckland', country: 'NZ', cityAr: 'أوكلاند', cityEn: 'Auckland', lat: -36.85, lon: 174.76 },
];

/** IANA Timezone -> fallback `[country, cityKey]` when edge geo headers are unavailable (e.g. local/direct Node). */
const TIMEZONE_TO_CITY: Record<string, { country: string; cityKey: string }> = {
  'Africa/Cairo': { country: 'EG', cityKey: 'cairo' },
  'Asia/Riyadh': { country: 'SA', cityKey: 'riyadh' },
  'Asia/Dubai': { country: 'AE', cityKey: 'dubai' },
  'Asia/Kuwait': { country: 'KW', cityKey: 'kuwait_city' },
  'Asia/Qatar': { country: 'QA', cityKey: 'doha' },
  'Asia/Bahrain': { country: 'BH', cityKey: 'manama' },
  'Asia/Muscat': { country: 'OM', cityKey: 'muscat' },
  'Asia/Amman': { country: 'JO', cityKey: 'amman' },
  'Asia/Beirut': { country: 'LB', cityKey: 'beirut' },
  'Asia/Jerusalem': { country: 'PS', cityKey: 'jerusalem' },
  'Asia/Hebron': { country: 'PS', cityKey: 'jerusalem' },
  'Asia/Gaza': { country: 'PS', cityKey: 'gaza' },
  'Asia/Damascus': { country: 'SY', cityKey: 'damascus' },
  'Asia/Baghdad': { country: 'IQ', cityKey: 'baghdad' },
  'Asia/Aden': { country: 'YE', cityKey: 'sanaa' },
  'Africa/Khartoum': { country: 'SD', cityKey: 'khartoum' },
  'Africa/Tripoli': { country: 'LY', cityKey: 'tripoli_ly' },
  'Africa/Tunis': { country: 'TN', cityKey: 'tunis' },
  'Africa/Algiers': { country: 'DZ', cityKey: 'algiers' },
  'Africa/Casablanca': { country: 'MA', cityKey: 'casablanca' },
  'Europe/Istanbul': { country: 'TR', cityKey: 'istanbul' },
  'Europe/London': { country: 'GB', cityKey: 'london' },
  'Europe/Paris': { country: 'FR', cityKey: 'paris' },
  'Europe/Berlin': { country: 'DE', cityKey: 'berlin' },
  'Europe/Rome': { country: 'IT', cityKey: 'rome' },
  'Europe/Madrid': { country: 'ES', cityKey: 'madrid' },
  'Europe/Amsterdam': { country: 'NL', cityKey: 'amsterdam' },
  'Europe/Brussels': { country: 'BE', cityKey: 'brussels' },
  'Europe/Zurich': { country: 'CH', cityKey: 'zurich' },
  'Europe/Vienna': { country: 'AT', cityKey: 'vienna' },
  'Europe/Stockholm': { country: 'SE', cityKey: 'stockholm' },
  'Europe/Oslo': { country: 'NO', cityKey: 'oslo' },
  'Europe/Copenhagen': { country: 'DK', cityKey: 'copenhagen' },
  'Europe/Warsaw': { country: 'PL', cityKey: 'warsaw' },
  'Europe/Athens': { country: 'GR', cityKey: 'athens' },
  'Europe/Moscow': { country: 'RU', cityKey: 'moscow' },
  'Europe/Kyiv': { country: 'UA', cityKey: 'kyiv' },
  'Europe/Dublin': { country: 'IE', cityKey: 'dublin' },
  'Europe/Lisbon': { country: 'PT', cityKey: 'lisbon' },
  'America/New_York': { country: 'US', cityKey: 'new_york' },
  'America/Chicago': { country: 'US', cityKey: 'chicago' },
  'America/Los_Angeles': { country: 'US', cityKey: 'los_angeles' },
  'America/Toronto': { country: 'CA', cityKey: 'toronto' },
  'America/Mexico_City': { country: 'MX', cityKey: 'mexico_city' },
  'America/Sao_Paulo': { country: 'BR', cityKey: 'sao_paulo' },
  'America/Argentina/Buenos_Aires': { country: 'AR', cityKey: 'buenos_aires' },
  'America/Bogota': { country: 'CO', cityKey: 'bogota' },
  'Asia/Tokyo': { country: 'JP', cityKey: 'tokyo' },
  'Asia/Seoul': { country: 'KR', cityKey: 'seoul' },
  'Asia/Shanghai': { country: 'CN', cityKey: 'beijing' },
  'Asia/Hong_Kong': { country: 'HK', cityKey: 'hong_kong' },
  'Asia/Kolkata': { country: 'IN', cityKey: 'mumbai' },
  'Asia/Karachi': { country: 'PK', cityKey: 'karachi' },
  'Asia/Dhaka': { country: 'BD', cityKey: 'dhaka' },
  'Asia/Jakarta': { country: 'ID', cityKey: 'jakarta' },
  'Asia/Kuala_Lumpur': { country: 'MY', cityKey: 'kuala_lumpur' },
  'Asia/Singapore': { country: 'SG', cityKey: 'singapore' },
  'Asia/Bangkok': { country: 'TH', cityKey: 'bangkok' },
  'Asia/Manila': { country: 'PH', cityKey: 'manila' },
  'Africa/Lagos': { country: 'NG', cityKey: 'lagos' },
  'Africa/Johannesburg': { country: 'ZA', cityKey: 'johannesburg' },
  'Africa/Nairobi': { country: 'KE', cityKey: 'nairobi' },
  'Africa/Addis_Ababa': { country: 'ET', cityKey: 'addis_ababa' },
  'Australia/Sydney': { country: 'AU', cityKey: 'sydney' },
  'Pacific/Auckland': { country: 'NZ', cityKey: 'auckland' },
};

const CITY_BY_KEY = new Map<string, GazetteerCity>(WORLD_CITIES.map((c) => [c.key, c]));

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/['`’_-]/g, ' ')
    .replace(/\b(governorate|province|region|city|district|al|el|as|az)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface ResolvedEntryLocation {
  placeId: string;
  country: string;
  cityAr: string;
  cityEn: string;
  regionAr?: string;
  regionEn?: string;
  lat: number;
  lon: number;
  precision: GeoPrecision;
}

function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

function safeDecode(raw?: string): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw).replace(/\+/g, ' ').trim();
  } catch {
    return raw.trim();
  }
}

/**
 * Resolves the exact city/governorate entry point inside a country using:
 *   1. Exact Edge/CDN coordinates + city/region headers (`x-vercel-ip-*`, `cf-*`, `x-eo-geo-*`),
 *   2. Gazetteer bilingual city/governorate match,
 *   3. Nearest known city within the same country when coordinates are provided,
 *   4. IANA timezone fallback when no edge geo headers exist,
 *   5. Country centroid fallback.
 */
export function resolveVisitorEntryLocation(input: {
  country?: string;
  cityHeader?: string;
  regionHeader?: string;
  latHeader?: number | string;
  lonHeader?: number | string;
  timezone?: string;
  fallbackCoords?: [number, number];
  countryNameAr?: string;
  countryNameEn?: string;
}): ResolvedEntryLocation {
  const tzEntry = input.timezone ? TIMEZONE_TO_CITY[input.timezone.trim()] : undefined;
  const country = (input.country && input.country !== 'UN' ? input.country : tzEntry?.country || 'UN').toUpperCase();

  const rawCity = safeDecode(input.cityHeader).slice(0, 64);
  const rawRegion = safeDecode(input.regionHeader).slice(0, 48);
  const parsedLat = typeof input.latHeader === 'number' ? input.latHeader : Number(input.latHeader);
  const parsedLon = typeof input.lonHeader === 'number' ? input.lonHeader : Number(input.lonHeader);
  const hasValidCoords =
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLon) &&
    Math.abs(parsedLat) <= 90 &&
    Math.abs(parsedLon) <= 180 &&
    !(parsedLat === 0 && parsedLon === 0);

  const countryCities = WORLD_CITIES.filter((c) => c.country === country);

  // 1. Match by city name or alias inside the country
  let matched: GazetteerCity | undefined;
  if (rawCity) {
    const nCity = norm(rawCity);
    matched = countryCities.find(
      (c) =>
        norm(c.cityEn) === nCity ||
        c.cityAr === rawCity ||
        (c.aliases && c.aliases.some((a) => norm(a) === nCity || nCity.includes(norm(a)))),
    );
  }

  // 2. Match by ISO region code (e.g. 'GZ' -> الجيزة, 'C' -> القاهرة, '01' -> الرياض, 'DU' -> دبي)
  if (!matched && rawRegion) {
    const upReg = rawRegion.toUpperCase().replace(/^[A-Z]{2}-/, '');
    matched = countryCities.find(
      (c) =>
        c.regionCodes?.includes(upReg) ||
        (c.regionEn && norm(c.regionEn) === norm(rawRegion)) ||
        c.regionAr === rawRegion,
    );
  }

  // 3. Nearest city within ~65km if edge coordinates are present without a recognized city string
  if (!matched && hasValidCoords && countryCities.length > 0 && !rawCity) {
    let bestDist = Infinity;
    for (const c of countryCities) {
      const d = Math.hypot(c.lat - parsedLat, c.lon - parsedLon);
      if (d < bestDist) {
        bestDist = d;
        matched = c;
      }
    }
    if (bestDist > 0.75) matched = undefined;
  }

  // Case A: Edge headers supplied an unrecognized real town/district name (keep its real name & exact coords!)
  if (rawCity && !matched) {
    const slug = rawCity.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '_').replace(/^_|_$/g, '').slice(0, 32) || 'city';
    const lat = hasValidCoords ? roundCoord(parsedLat) : (input.fallbackCoords?.[0] ?? 26.8);
    const lon = hasValidCoords ? roundCoord(parsedLon) : (input.fallbackCoords?.[1] ?? 30.8);
    return {
      placeId: `${country}:${slug}`,
      country,
      cityAr: rawCity,
      cityEn: rawCity,
      ...(rawRegion ? { regionAr: rawRegion, regionEn: rawRegion } : {}),
      lat,
      lon,
      precision: hasValidCoords ? 'edge-coords' : 'edge-city',
    };
  }

  // Case B: Matched a known city/governorate in our bilingual gazetteer
  if (matched) {
    const lat = hasValidCoords ? roundCoord(parsedLat) : matched.lat;
    const lon = hasValidCoords ? roundCoord(parsedLon) : matched.lon;
    return {
      placeId: `${country}:${matched.key}`,
      country,
      cityAr: matched.cityAr,
      cityEn: matched.cityEn,
      ...(matched.regionAr ? { regionAr: matched.regionAr } : {}),
      ...(matched.regionEn ? { regionEn: matched.regionEn } : {}),
      lat,
      lon,
      precision: hasValidCoords ? 'edge-coords' : 'edge-city',
    };
  }

  // Case C: Edge coordinates supplied without city name
  if (hasValidCoords) {
    const lat = roundCoord(parsedLat);
    const lon = roundCoord(parsedLon);
    const gridKey = `${lat.toFixed(1)}_${lon.toFixed(1)}`;
    return {
      placeId: `${country}:geo_${gridKey}`,
      country,
      cityAr: rawRegion || `${input.countryNameAr || country} (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
      cityEn: rawRegion || `${input.countryNameEn || country} (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
      lat,
      lon,
      precision: 'edge-coords',
    };
  }

  // Case D: Timezone-based city hub (when running without CDN geo headers)
  if (tzEntry && tzEntry.country === country) {
    const tzCity = CITY_BY_KEY.get(tzEntry.cityKey);
    if (tzCity) {
      return {
        placeId: `${country}:${tzCity.key}`,
        country,
        cityAr: `${tzCity.cityAr} (نطاق التوقيت)`,
        cityEn: `${tzCity.cityEn} (TZ zone)`,
        ...(tzCity.regionAr ? { regionAr: tzCity.regionAr } : {}),
        ...(tzCity.regionEn ? { regionEn: tzCity.regionEn } : {}),
        lat: tzCity.lat,
        lon: tzCity.lon,
        precision: 'timezone',
      };
    }
  }

  // Case E: Country-level fallback
  const fallbackLat = roundCoord(input.fallbackCoords?.[0] ?? 26.8);
  const fallbackLon = roundCoord(input.fallbackCoords?.[1] ?? 30.8);
  return {
    placeId: `${country}:country_center`,
    country,
    cityAr: input.countryNameAr ? `${input.countryNameAr} — عام` : country,
    cityEn: input.countryNameEn ? `${input.countryNameEn} — General` : country,
    lat: fallbackLat,
    lon: fallbackLon,
    precision: 'country',
  };
}

/** Extracts geo headers across Vercel, Cloudflare, Tencent EdgeOne, CloudFront, Fastly, and AppEngine. */
export function geoDetailsFromHeaders(headers: Record<string, string | string[] | undefined>): {
  city?: string;
  region?: string;
  lat?: string;
  lon?: string;
  timezone?: string;
} {
  const first = (key: string): string | undefined => {
    const raw = headers[key];
    const v = Array.isArray(raw) ? raw[0] : raw;
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };

  const appEngineLatLon = first('x-appengine-citylatlong');
  const [aeLat, aeLon] = appEngineLatLon ? appEngineLatLon.split(',') : [undefined, undefined];

  return {
    city:
      first('x-vercel-ip-city') ||
      first('cf-ipcity') ||
      first('x-eo-geo-city') ||
      first('cloudfront-viewer-city') ||
      first('fastly-client-geo-city') ||
      first('x-appengine-city'),
    region:
      first('x-vercel-ip-country-region') ||
      first('cf-region') ||
      first('cf-region-code') ||
      first('x-eo-geo-region') ||
      first('cloudfront-viewer-country-region-name') ||
      first('x-appengine-region'),
    lat:
      first('x-vercel-ip-latitude') ||
      first('cf-iplatitude') ||
      first('x-eo-geo-latitude') ||
      first('cloudfront-viewer-latitude') ||
      first('fastly-client-geo-latitude') ||
      aeLat,
    lon:
      first('x-vercel-ip-longitude') ||
      first('cf-iplongitude') ||
      first('x-eo-geo-longitude') ||
      first('cloudfront-viewer-longitude') ||
      first('fastly-client-geo-longitude') ||
      aeLon,
    timezone:
      first('x-vercel-ip-timezone') ||
      first('cf-timezone') ||
      first('cloudfront-viewer-time-zone'),
  };
}
