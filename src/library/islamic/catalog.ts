import type { LText } from '../../لغات/localize';
import { toLatinDigits } from '../../لغات/numerals';

const text = (ar: string, en: string): LText => ({ ar, en });

/** These are selected reading shelves. The directory links lead to the larger collections. */
export const ISLAMIC_SHELVES = [
  { id: 'quran', title: text('القرآن وعلومه', 'Quran & its sciences'), description: text('المصحف، وعلوم القرآن، والقراءات.', 'The complete mushaf, Quranic studies and recitations.'), directories: [4, 5] },
  { id: 'tafsir', title: text('التفسير', 'Tafsir'), description: text('قراءة في معاني الآيات عند مفسّرين من عصور مختلفة.', 'Quran commentaries from different periods.'), directories: [3] },
  { id: 'hadith', title: text('الحديث والسنة', 'Hadith & Sunnah'), description: text('الجوامع والصحاح والسنن ومختارات الحديث.', 'Primary collections and curated selections of hadith.'), directories: [6, 7] },
  { id: 'hadith-sciences', title: text('علوم الحديث', 'Hadith studies'), description: text('مصطلح الحديث، ودراسة الإسناد والرواية.', 'Terminology, transmission and the study of narration.'), directories: [10, 8, 9] },
  { id: 'seerah', title: text('السيرة والشمائل', 'Seerah & Shama’il'), description: text('السيرة النبوية وصفات النبي ﷺ.', 'Accounts of the Prophet’s life and character.'), directories: [24] },
  { id: 'fiqh', title: text('الفقه والمذاهب', 'Fiqh & schools of law'), description: text('نماذج من المذاهب الأربعة والفقه المقارن.', 'Works from the four Sunni schools and comparative jurisprudence.'), directories: [14, 15, 16, 17, 18, 21] },
  { id: 'usul', title: text('أصول الفقه', 'Principles of jurisprudence'), description: text('مناهج الاستدلال وأصول النظر الفقهي والمقاصد.', 'Legal reasoning, its principles and objectives.'), directories: [11, 12] },
  { id: 'creed', title: text('العقيدة', 'Creed'), description: text('مصنّفات تاريخية من مدارس مختلفة في الاعتقاد.', 'Historical writings from several traditions of theology.'), directories: [1, 2] },
  { id: 'adhkar', title: text('الأذكار والآداب', 'Adhkar & conduct'), description: text('الدعاء والذكر وكتب الآداب وتزكية النفس.', 'Supplications, remembrance, conduct and spiritual ethics.'), directories: [23] },
  { id: 'history', title: text('التاريخ والتراجم', 'History & biographies'), description: text('أخبار العصور وتراجم العلماء والأعلام.', 'Chronicles and biographies of scholars and notable figures.'), directories: [25, 26, 27, 28] },
  { id: 'language', title: text('اللغة والمعاجم', 'Arabic & lexicons'), description: text('مراجع النحو واللغة لفهم النصوص في سياقها.', 'Grammar and dictionaries for reading texts in context.'), directories: [29, 30, 31, 32, 35] },
] as const;

export type IslamicShelfId = (typeof ISLAMIC_SHELVES)[number]['id'];
export type IslamicShelf = (typeof ISLAMIC_SHELVES)[number];
export const ISLAMIC_SOURCES = {
  shamela: text('المكتبة الشاملة', 'Al-Maktaba al-Shamela'),
  sunnah: text('سُنّة.كوم', 'Sunnah.com'),
  islamhouse: text('دار الإسلام', 'IslamHouse'),
} as const;

type ExternalBookSource = { kind: 'source'; catalogue: keyof typeof ISLAMIC_SOURCES; url: string; edition?: LText };
export interface IslamicBook {
  id: string;
  title: LText;
  byline: LText;
  summary: LText;
  access: ExternalBookSource | { kind: 'mushaf' };
  tags?: readonly string[];
}

const shamela = (editionId: number, ar: string, en: string): ExternalBookSource => ({
  kind: 'source', catalogue: 'shamela', url: `https://shamela.ws/book/${editionId}`, edition: text(ar, en),
});
const sunnah = (collection: string): ExternalBookSource => ({ kind: 'source', catalogue: 'sunnah', url: `https://sunnah.com/${collection}` });
const book = (id: string, title: LText, byline: LText, summary: LText, access: IslamicBook['access'], tags?: readonly string[]): IslamicBook => (
  { id, title, byline, summary, access, tags }
);

export const ISLAMIC_MUSHAF = book('mushaf', text('المصحف الشريف', 'The Noble Quran'), text('رواية حفص عن عاصم', 'Hafs ‘an ‘Asim'),
  text('القرآن الكريم كاملًا بالرسم العثماني. اختار أي سورة من الفهرس واقرأ النص داخل المكتبة.', 'The complete Quran in Uthmani script. Choose a surah from the index and read it here.'),
  { kind: 'mushaf' }, ['القرآن الكريم', 'قران', 'مصحف', 'quran', 'qur’an', 'mushaf']);

// Each external entry describes the edition on the linked page; no book files are copied from these sites.
export const ISLAMIC_BOOKS: Readonly<Record<IslamicShelfId, readonly IslamicBook[]>> = {
  quran: [
    ISLAMIC_MUSHAF,
    book('itqan', text('الإتقان في علوم القرآن', 'Al-Itqan in Quranic Sciences'), text('جلال الدين السيوطي', 'Jalal al-Din al-Suyuti'),
      text('يجمع أنواعًا من علوم القرآن، منها المكي والمدني وأسباب النزول.', 'A survey of Quranic sciences, including revelation contexts and Meccan and Medinan passages.'), shamela(11728, 'تحقيق محمد أبو الفضل إبراهيم · الهيئة المصرية العامة للكتاب', 'Muhammad Abu al-Fadl Ibrahim edition · Egyptian General Book Organization')),
    book('burhan', text('البرهان في علوم القرآن', 'Al-Burhan in Quranic Sciences'), text('بدر الدين الزركشي', 'Badr al-Din al-Zarkashi'),
      text('مرجع تراثي يجمع مباحث الرسم والقراءات واللغة وغيرها من علوم القرآن.', 'A classical reference on Quranic orthography, recitation, language and other topics.'), shamela(11436, 'تحقيق محمد أبو الفضل إبراهيم · دار إحياء الكتب العربية', 'Muhammad Abu al-Fadl Ibrahim edition · Dar Ihya al-Kutub al-‘Arabiyya')),
    book('nashr', text('النشر في القراءات العشر', 'Al-Nashr in the Ten Readings'), text('ابن الجزري', 'Ibn al-Jazari'),
      text('مرجع في طرق القراءات العشر وأصول أدائها.', 'A reference on the transmission and recitation principles of the ten readings.'), shamela(22642, 'تحقيق علي محمد الضباع · المطبعة التجارية الكبرى', 'Ali Muhammad al-Dabba‘ edition · Al-Matba‘a al-Tijariyya'), ['التجويد', 'tajwid', 'qiraat']),
  ],
  tafsir: [
    book('tabari-tafsir', text('تفسير الطبري', 'Tafsir al-Tabari'), text('ابن جرير الطبري', 'Ibn Jarir al-Tabari'),
      text('جامع البيان عن تأويل آي القرآن؛ تفسير يعرض الروايات وأقوال المفسّرين واللغة.', 'Jami‘ al-Bayan: commentary drawing on transmitted reports, earlier interpretation and language.'), shamela(7798, 'تحقيق عبد الله التركي · دار هجر', 'Abdullah al-Turki edition · Dar Hajr'), ['جامع البيان']),
    book('ibn-kathir', text('تفسير ابن كثير', 'Tafsir Ibn Kathir'), text('إسماعيل بن كثير', 'Isma‘il Ibn Kathir'),
      text('تفسير القرآن العظيم، مع الاستدلال بالآيات والروايات في شرح المعنى.', 'Tafsir al-Qur’an al-‘Azim, with cross-references to verses and transmitted reports.'), shamela(8473, 'تحقيق سامي السلامة · دار طيبة', 'Sami al-Salama edition · Dar Tayba'), ['تفسير القرآن العظيم']),
    book('qurtubi', text('تفسير القرطبي', 'Tafsir al-Qurtubi'), text('محمد بن أحمد القرطبي', 'Muhammad ibn Ahmad al-Qurtubi'),
      text('الجامع لأحكام القرآن؛ يجمع بيان المعاني واللغة ومسائل الأحكام.', 'Al-Jami‘ li-Ahkam al-Qur’an: verses, language and legal questions.'), shamela(20855, 'تحقيق البردوني وأطفيش · دار الكتب المصرية', 'Al-Barduni and Atfish edition · Egyptian National Library'), ['الجامع لأحكام القرآن']),
    book('saadi', text('تفسير السعدي', 'Tafsir al-Sa‘di'), text('عبد الرحمن السعدي', '‘Abd al-Rahman al-Sa‘di'),
      text('تيسير الكريم الرحمن: شرح مختصر لمعاني الآيات.', 'Taysir al-Karim al-Rahman, a concise commentary on the Quran.'), shamela(42, 'تحقيق عبد الرحمن اللويحق · مؤسسة الرسالة', 'Al-Luwayhiq edition · Mu’assasat al-Risala'), ['تيسير الكريم الرحمن', 'saadi']),
    book('mujahid', text('تفسير مجاهد', 'Tafsir Mujahid'), text('مجاهد بن جبر', 'Mujahid ibn Jabr'),
      text('روايات تفسيرية منسوبة إلى أحد مفسّري التابعين.', 'Transmitted interpretations attributed to an early Quran commentator.'), shamela(12810, 'تحقيق محمد عبد السلام أبو النيل · دار الفكر الإسلامي الحديثة', 'Abu al-Nil edition · Dar al-Fikr al-Islami al-Haditha')),
  ],
  hadith: [
    book('bukhari', text('صحيح البخاري', 'Sahih al-Bukhari'), text('محمد بن إسماعيل البخاري', 'Muhammad ibn Isma‘il al-Bukhari'),
      text('الجامع الصحيح، مرتّب في كتب وأبواب.', 'The Sahih collection, arranged by book and chapter.'), sunnah('bukhari')),
    book('muslim', text('صحيح مسلم', 'Sahih Muslim'), text('مسلم بن الحجاج', 'Muslim ibn al-Hajjaj'),
      text('مجموعة الإمام مسلم الحديثية، مرتّبة حسب الموضوعات.', 'Imam Muslim’s hadith collection with its subject divisions.'), sunnah('muslim')),
    book('abu-dawud', text('سنن أبي داود', 'Sunan Abi Dawud'), text('سليمان بن الأشعث أبو داود', 'Sulayman ibn al-Ash‘ath Abu Dawud'),
      text('مجموعة من السنن، مرتبة حسب أبواب الفقه.', 'A Sunan collection organised by topics of jurisprudence.'), sunnah('abudawud')),
    book('tirmidhi', text('جامع الترمذي', 'Jami‘ al-Tirmidhi'), text('محمد بن عيسى الترمذي', 'Muhammad ibn ‘Isa al-Tirmidhi'),
      text('جامع حديثي يُعرف أيضًا بسنن الترمذي.', 'The hadith collection also known as Sunan al-Tirmidhi.'), sunnah('tirmidhi'), ['سنن الترمذي']),
    book('nasai', text('سنن النسائي', 'Sunan al-Nasa’i'), text('أحمد بن شعيب النسائي', 'Ahmad ibn Shu‘ayb al-Nasa’i'),
      text('سنن النسائي المعروفة بالمجتبى، مرتبة في كتب وأبواب.', 'The Sunan known as Al-Mujtaba, arranged in books and chapters.'), sunnah('nasai'), ['المجتبى']),
    book('ibn-majah', text('سنن ابن ماجه', 'Sunan Ibn Majah'), text('محمد بن يزيد ابن ماجه', 'Muhammad ibn Yazid Ibn Majah'),
      text('أحد كتب الحديث الستة المشهورة.', 'One of the six major Sunni hadith collections.'), sunnah('ibnmajah')),
    book('muwatta', text('موطأ الإمام مالك', 'Muwatta’ Malik'), text('مالك بن أنس', 'Malik ibn Anas'),
      text('رواية أبي مصعب الزهري، تجمع الحديث وآثار الفقهاء.', 'Abu Mus‘ab al-Zuhri’s transmission, collecting hadith and early legal reports.'), shamela(8140, 'رواية أبي مصعب · تحقيق بشار عواد معروف ومحمود خليل', 'Abu Mus‘ab recension · Bashshar ‘Awwad Ma‘ruf and Mahmud Khalil edition')),
    book('ahmad', text('مسند أحمد', 'Musnad Ahmad'), text('أحمد بن حنبل', 'Ahmad ibn Hanbal'),
      text('مسند مرتب بحسب الصحابي الراوي.', 'A musnad organised by the companion who narrated each report.'), shamela(25794, 'تحقيق شعيب الأرناؤوط وعادل مرشد وآخرين · مؤسسة الرسالة', 'Shu‘ayb al-Arna’ut, ‘Adil Murshid and others · Mu’assasat al-Risala')),
    book('darimi', text('سنن الدارمي', 'Sunan al-Darimi'), text('عبد الله بن عبد الرحمن الدارمي', 'Abdullah ibn ‘Abd al-Rahman al-Darimi'),
      text('مجموعة حديثية في أبواب متنوعة، تسبقها مقدمة في العلم.', 'A hadith collection organised by topic, beginning with an introduction on knowledge.'), sunnah('darimi')),
    book('nawawi-forty', text('الأربعون النووية', 'Al-Nawawi’s Forty Hadith'), text('يحيى بن شرف النووي', 'Yahya ibn Sharaf al-Nawawi'),
      text('مختارات موجزة من جوامع الحديث.', 'A short selection of foundational hadith.'), sunnah('nawawi40'), ['الاربعين النووية', '٤٠ حديث', '40 hadith']),
  ],
  'hadith-sciences': [
    book('ibn-salah', text('مقدمة ابن الصلاح', 'Muqaddimat Ibn al-Salah'), text('عثمان بن عبد الرحمن ابن الصلاح', 'Uthman ibn ‘Abd al-Rahman Ibn al-Salah'),
      text('معرفة أنواع علوم الحديث، وشرح مصطلحات الرواية.', 'A survey of hadith studies and the terminology of transmission.'), shamela(22870, 'تحقيق نور الدين عتر · دار الفكر', 'Nur al-Din ‘Itr edition · Dar al-Fikr')),
    book('nuzhat', text('نزهة النظر', 'Nuzhat al-Nazar'), text('ابن حجر العسقلاني', 'Ibn Hajar al-‘Asqalani'),
      text('شرح المؤلف لمتن نخبة الفكر في مصطلح الحديث.', 'The author’s explanation of Nukhbat al-Fikar on hadith terminology.'), shamela(1565, 'تحقيق نور الدين عتر · مطبعة الصباح', 'Nur al-Din ‘Itr edition · Matba‘at al-Sabah'), ['نخبة الفكر']),
    book('tadrib', text('تدريب الراوي', 'Tadrib al-Rawi'), text('جلال الدين السيوطي', 'Jalal al-Din al-Suyuti'),
      text('شرح تقريب النووي في أنواع الحديث وقواعد الرواية.', 'Commentary on al-Nawawi’s manual of hadith terminology.'), shamela(9329, 'تحقيق نظر محمد الفاريابي · دار طيبة', 'Nazar Muhammad al-Faryabi edition · Dar Tayba')),
    book('fath-mughith', text('فتح المغيث', 'Fath al-Mughith'), text('شمس الدين السخاوي', 'Shams al-Din al-Sakhawi'),
      text('شرح ألفية العراقي في علوم الحديث.', 'A commentary on al-‘Iraqi’s verse manual of hadith sciences.'), shamela(5963, 'تحقيق علي حسين علي · مكتبة السنة', 'Ali Husayn Ali edition · Maktabat al-Sunna')),
  ],
  seerah: [
    book('ibn-hisham', text('سيرة ابن هشام', 'Seerat Ibn Hisham'), text('عبد الملك بن هشام', '‘Abd al-Malik Ibn Hisham'),
      text('السيرة النبوية في رواية ابن هشام وتحريره لمادة ابن إسحاق.', 'Ibn Hisham’s recension of the prophetic biography transmitted from Ibn Ishaq.'), shamela(23833, 'تحقيق السقا والأبياري وشلبي · البابي الحلبي', 'Al-Saqqa, al-Abyari and Shalabi edition · Al-Babi al-Halabi'), ['السيرة النبوية لابن هشام', 'ابن اسحاق']),
    book('rahiq', text('الرحيق المختوم', 'The Sealed Nectar'), text('صفي الرحمن المباركفوري', 'Safi al-Rahman al-Mubarakfuri'),
      text('سيرة نبوية مرتّبة بحسب مراحل حياة النبي ﷺ.', 'A biography arranged by the stages of the Prophet’s life.'), shamela(9820, 'دار الفكر · طبعة دار ومكتبة الهلال', 'Dar al-Fikr · Dar wa Maktabat al-Hilal edition'), ['الرحيق']),
    book('shamail', text('الشمائل المحمدية', 'Al-Shama’il al-Muhammadiyya'), text('محمد بن عيسى الترمذي', 'Muhammad ibn ‘Isa al-Tirmidhi'),
      text('روايات في صفات النبي ﷺ وهيئته وآدابه.', 'Reports on the Prophet’s appearance, character and habits.'), shamela(13037, 'تحقيق سيد بن عباس الجليمي · المكتبة التجارية', 'Sayyid ‘Abbas al-Julaymi edition · Al-Maktaba al-Tijariyya')),
    book('jawami-seerah', text('جوامع السيرة', 'Jawami‘ al-Seera'), text('ابن حزم الأندلسي', 'Ibn Hazm al-Andalusi'),
      text('أحداث السيرة النبوية في عرض موجز.', 'A concise account of the principal events of the prophetic biography.'), shamela(9728, 'دار الكتب العلمية', 'Dar al-Kutub al-‘Ilmiyya')),
    book('zad', text('زاد المعاد', 'Zad al-Ma‘ad'), text('ابن قيم الجوزية', 'Ibn Qayyim al-Jawziyya'),
      text('السيرة والهدي النبوي، مع مباحث فقهية وتاريخية.', 'The Prophet’s life and practice, with historical and legal discussions.'), shamela(21713, 'تحقيق شعيب وعبد القادر الأرناؤوط · مؤسسة الرسالة', 'Shu‘ayb and ‘Abd al-Qadir al-Arna’ut edition · Mu’assasat al-Risala')),
  ],
  fiqh: [
    book('hidaya', text('الهداية', 'Al-Hidaya'), text('برهان الدين المرغيناني', 'Burhan al-Din al-Marghinani'),
      text('شرح بداية المبتدي في أبواب الفقه الحنفي.', 'A commentary on Bidayat al-Mubtadi in Hanafi jurisprudence.'), shamela(11820, 'اعتنى به طلال يوسف · دار إحياء التراث العربي', 'Talal Yusuf edition · Dar Ihya al-Turath al-‘Arabi'), ['حنفي', 'الفقه الحنفي', 'hanafi', 'شرح بداية المبتدي']),
    book('mudawwana', text('المدوّنة', 'Al-Mudawwana'), text('فقه مالك · رواية سحنون عن ابن القاسم', 'Malik’s jurisprudence · Sahnun from Ibn al-Qasim'),
      text('مسائل الفقه المالكي برواية سحنون، مرتّبة في أبواب.', 'Early Maliki jurisprudence arranged as questions and answers.'), shamela(587, 'دار الكتب العلمية', 'Dar al-Kutub al-‘Ilmiyya'), ['مالكي', 'الفقه المالكي', 'maliki', 'المدونة الكبرى']),
    book('umm', text('الأم', 'Al-Umm'), text('محمد بن إدريس الشافعي', 'Muhammad ibn Idris al-Shafi‘i'),
      text('جمع لأبواب الفقه وآراء الإمام الشافعي.', 'A collection of Imam al-Shafi‘i’s legal writings.'), shamela(1655, 'دار الفكر · بيروت', 'Dar al-Fikr · Beirut'), ['الفقه الشافعي', 'shafii']),
    book('mughni', text('المغني', 'Al-Mughni'), text('موفق الدين ابن قدامة', 'Muwaffaq al-Din Ibn Qudama'),
      text('شرح مختصر الخرقي، يعرض الفقه الحنبلي وأقوال مذاهب أخرى.', 'An exposition of al-Khiraqi’s manual, with Hanbali and comparative jurisprudence.'), shamela(8463, 'طبعة مكتبة القاهرة', 'Cairo Library edition'), ['حنبلي', 'الفقه الحنبلي', 'hanbali']),
    book('bidaya', text('بداية المجتهد', 'Bidayat al-Mujtahid'), text('ابن رشد الحفيد', 'Ibn Rushd (Averroes)'),
      text('بداية المجتهد ونهاية المقتصد؛ يعرض مسائل الخلاف الفقهي وأسبابها.', 'A comparative survey of juristic disagreements and the reasons behind them.'), shamela(21739, 'دار الحديث · القاهرة', 'Dar al-Hadith · Cairo'), ['الفقه المقارن', 'نهاية المقتصد', 'comparative fiqh']),
  ],
  usul: [
    book('risala', text('الرسالة', 'Al-Risala'), text('محمد بن إدريس الشافعي', 'Muhammad ibn Idris al-Shafi‘i'),
      text('من المصنفات المبكرة في أصول الفقه وطرق الاستدلال.', 'An early work on jurisprudential principles and legal reasoning.'), shamela(8180, 'تحقيق أحمد محمد شاكر · البابي الحلبي', 'Ahmad Muhammad Shakir edition · Al-Babi al-Halabi')),
    book('waraqat', text('الورقات', 'Al-Waraqat'), text('إمام الحرمين الجويني', 'Imam al-Haramayn al-Juwayni'),
      text('متن موجز في أبواب أصول الفقه ومصطلحاته.', 'A short primer on the concepts and terminology of legal theory.'), shamela(6297, 'تحقيق عبد اللطيف محمد العبد', '‘Abd al-Latif Muhammad al-‘Abd edition')),
    book('mustasfa', text('المستصفى', 'Al-Mustasfa'), text('أبو حامد الغزالي', 'Abu Hamid al-Ghazali'),
      text('بحث في الحكم وأدلته والاستنباط والاجتهاد.', 'A study of rulings, evidence, inference and independent legal reasoning.'), shamela(5459, 'تحقيق محمد عبد السلام عبد الشافي · دار الكتب العلمية', 'Muhammad ‘Abd al-Salam ‘Abd al-Shafi edition · Dar al-Kutub al-‘Ilmiyya')),
    book('muwafaqat', text('الموافقات', 'Al-Muwafaqat'), text('إبراهيم بن موسى الشاطبي', 'Ibrahim ibn Musa al-Shatibi'),
      text('مصنّف في أصول الفقه ومقاصد الشريعة.', 'A work on legal principles and the objectives of Islamic law.'), shamela(11435, 'تحقيق مشهور حسن آل سلمان · دار ابن عفان', 'Mashhur Hasan Al Salman edition · Dar Ibn ‘Affan'), ['مقاصد']),
  ],
  creed: [
    book('tahawiyya', text('العقيدة الطحاوية', 'Al-‘Aqida al-Tahawiyya'), text('أبو جعفر الطحاوي', 'Abu Ja‘far al-Tahawi'),
      text('المتن التراثي، في نسخة معها شرح وتعليق محمد ناصر الدين الألباني.', 'The classical text, linked in an edition with Muhammad Nasir al-Din al-Albani’s notes.'), shamela(9568, 'شرح وتعليق الألباني · المكتب الإسلامي', 'Al-Albani’s commentary · Al-Maktab al-Islami')),
    book('maturidi', text('كتاب التوحيد', 'Kitab al-Tawhid'), text('أبو منصور الماتريدي', 'Abu Mansur al-Maturidi'),
      text('كتاب في مسائل التوحيد والاستدلال عند الماتريدي.', 'Al-Maturidi’s treatment of divine unity and theological reasoning.'), shamela(6365, 'تحقيق فتح الله خليف · دار الجامعات المصرية', 'Fathallah Khulayf edition · Dar al-Jami‘at al-Misriyya')),
    book('qtisad', text('الاقتصاد في الاعتقاد', 'Al-Iqtisad fi al-I‘tiqad'), text('أبو حامد الغزالي', 'Abu Hamid al-Ghazali'),
      text('مصنّف كلامي في مسائل الاعتقاد وأدلتها عند الغزالي.', 'Al-Ghazali’s study of theological questions and arguments.'), shamela(9217, 'حواشي عبد الله محمد الخليلي · دار الكتب العلمية', 'Abdullah al-Khalili’s notes · Dar al-Kutub al-‘Ilmiyya')),
    book('usul-sunna', text('أصول السنة', 'Usul al-Sunna'), text('أحمد بن حنبل', 'Ahmad ibn Hanbal'),
      text('رسالة موجزة تُروى عن الإمام أحمد في الاعتقاد.', 'A short creed transmitted from Imam Ahmad.'), shamela(6418, 'دار المنار · الخرج', 'Dar al-Manar · Al-Kharj')),
  ],
  adhkar: [
    book('hisn', text('حصن المسلم', 'Hisn al-Muslim'), text('سعيد بن علي بن وهف القحطاني', 'Sa‘id ibn ‘Ali ibn Wahf al-Qahtani'),
      text('أذكار وأدعية من القرآن والسنة مرتّبة حسب الأحوال والمناسبات.', 'Supplications and remembrance from the Quran and Sunnah, organised by occasion.'),
      { kind: 'source', catalogue: 'islamhouse', url: 'https://islamhouse.com/read/ar/حصن-المسلم-من-أذكار-الكتاب-والسنة-2522' }),
    book('riyad', text('رياض الصالحين', 'Riyad al-Salihin'), text('يحيى بن شرف النووي', 'Yahya ibn Sharaf al-Nawawi'),
      text('أبواب مختارة من الحديث في العبادات والأخلاق والآداب.', 'Selections of hadith on worship, character and conduct.'), sunnah('riyadussalihin')),
    book('nawawi-adhkar', text('الأذكار للنووي', 'Al-Adhkar'), text('يحيى بن شرف النووي', 'Yahya ibn Sharaf al-Nawawi'),
      text('كتاب في أذكار اليوم والليلة والدعوات، مع مسائل في آدابها.', 'A collection of daily remembrance and supplications with notes on their practice.'), shamela(1956, 'تحقيق عبد القادر الأرنؤوط · دار الفكر', '‘Abd al-Qadir al-Arna’ut edition · Dar al-Fikr')),
    book('adab-mufrad', text('الأدب المفرد', 'Al-Adab al-Mufrad'), text('محمد بن إسماعيل البخاري', 'Muhammad ibn Isma‘il al-Bukhari'),
      text('مجموعة مستقلة في الآداب وصلة الرحم وحسن المعاملة.', 'A separate collection on conduct, kinship and good dealings.'), sunnah('adab')),
    book('wabil', text('الوابل الصيب', 'Al-Wabil al-Sayyib'), text('ابن قيم الجوزية', 'Ibn Qayyim al-Jawziyya'),
      text('رسالة في ذكر الله ومعانيه، تليها فصول في الأذكار.', 'A work on remembrance and its meanings, followed by topical chapters of supplications.'), shamela(18128, 'تحقيق عبد الرحمن بن حسن بن قائد · دار عطاءات العلم', '‘Abd al-Rahman ibn Hasan ibn Qa’id edition · Dar ‘Ata’at al-‘Ilm')),
    book('ihya', text('إحياء علوم الدين', 'Ihya’ ‘Ulum al-Din'), text('أبو حامد الغزالي', 'Abu Hamid al-Ghazali'),
      text('مصنّف في العبادات والعادات وأعمال القلوب والأخلاق.', 'A work on worship, daily habits, inward character and ethics.'), shamela(9472, 'دار المعرفة · بيروت', 'Dar al-Ma‘rifa · Beirut')),
  ],
  history: [
    book('bidaya-history', text('البداية والنهاية', 'Al-Bidaya wa al-Nihaya'), text('إسماعيل بن كثير', 'Isma‘il Ibn Kathir'),
      text('تاريخ يبدأ بأخبار الخلق والأنبياء، ثم السيرة وأخبار العصور الإسلامية.', 'A chronicle covering early accounts, the prophetic biography and Islamic history.'), shamela(30097, 'طبعة دار ابن كثير', 'Dar Ibn Kathir edition')),
    book('tabari-history', text('تاريخ الطبري', 'History of al-Tabari'), text('ابن جرير الطبري', 'Ibn Jarir al-Tabari'),
      text('تاريخ الرسل والملوك؛ تلي هذه النسخة صلة تاريخ الطبري وتكملته.', 'The History of Prophets and Kings, with subsequent continuations in this edition.'), shamela(9783, 'النسخة التي تضم الصلة والتكملة', 'Edition with the continuations'), ['تاريخ الرسل والملوك']),
    book('siyar', text('سير أعلام النبلاء', 'Siyar A‘lam al-Nubala’'), text('شمس الدين الذهبي', 'Shams al-Din al-Dhahabi'),
      text('تراجم لعلماء ورواة وأعلام مرتبة على الطبقات.', 'Biographies of scholars, narrators and other figures, arranged by generation.'), shamela(10906, 'تحقيق جماعة · مؤسسة الرسالة', 'Edited by a scholarly team · Mu’assasat al-Risala')),
    book('tabaqat', text('الطبقات الكبرى', 'Al-Tabaqat al-Kubra'), text('محمد بن سعد', 'Muhammad Ibn Sa‘d'),
      text('السيرة النبوية وتراجم الصحابة والتابعين ومن تلاهم.', 'The prophetic biography and biographies of companions and subsequent generations.'), shamela(146, 'تحقيق علي محمد عمر · مكتبة الخانجي', 'Ali Muhammad ‘Umar edition · Maktabat al-Khanji')),
  ],
  language: [
    book('lisan', text('لسان العرب', 'Lisan al-‘Arab'), text('ابن منظور', 'Ibn Manzur'),
      text('معجم تراثي واسع يجمع اللغة والشواهد الشعرية والنثرية.', 'An expansive classical dictionary with examples from poetry and prose.'), shamela(1687, 'دار صادر · بيروت', 'Dar Sadir · Beirut')),
    book('maqayis', text('مقاييس اللغة', 'Maqayis al-Lugha'), text('أحمد بن فارس', 'Ahmad Ibn Faris'),
      text('معجم يبحث معاني الجذور العربية وأصولها.', 'A lexicon examining the meanings and principles of Arabic roots.'), shamela(21710, 'تحقيق عبد السلام هارون · البابي الحلبي', '‘Abd al-Salam Harun edition · Al-Babi al-Halabi')),
    book('ajurrumiya', text('متن الآجرومية', 'Al-Ajurrumiyya'), text('ابن آجروم الصنهاجي', 'Ibn Ajurrum al-Sanhaji'),
      text('مدخل موجز إلى النحو العربي والإعراب.', 'A concise introduction to Arabic grammar and inflection.'), shamela(11371, 'دار الصميعي', 'Dar al-Sumay‘i'), ['الاجرومية', 'النحو']),
    book('ibn-aqil', text('شرح ابن عقيل', 'Ibn ‘Aqil’s Commentary'), text('عبد الله بن عبد الرحمن ابن عقيل', 'Abdullah ibn ‘Abd al-Rahman Ibn ‘Aqil'),
      text('شرح على ألفية ابن مالك في النحو والصرف.', 'A commentary on Ibn Malik’s verse manual of grammar and morphology.'), shamela(9904, 'تحقيق محمد محيي الدين عبد الحميد · دار التراث', 'Muhammad Muhyi al-Din ‘Abd al-Hamid edition · Dar al-Turath'), ['الفية ابن مالك', 'النحو']),
  ],
};

export const ISLAMIC_BOOK_COUNT = ISLAMIC_SHELVES.reduce((total, shelf) => total + ISLAMIC_BOOKS[shelf.id].length, 0);

/** Al-Shamela's own category names, linked without mirroring its collection. */
export const SHAMELA_CATEGORIES: Readonly<Record<IslamicShelf['directories'][number], LText>> = {
  1: text('العقيدة', 'Creed'), 2: text('الفرق والردود', 'Schools and responses'),
  3: text('التفسير', 'Tafsir'), 4: text('علوم القرآن وأصول التفسير', 'Quranic studies'),
  5: text('التجويد والقراءات', 'Tajwid & readings'), 6: text('كتب السنة', 'Sunnah collections'),
  7: text('شروح الحديث', 'Hadith commentary'), 8: text('التخريج والأطراف', 'Hadith sourcing'),
  9: text('العلل والسؤالات الحديثية', 'Hadith criticism'), 10: text('علوم الحديث', 'Hadith studies'),
  11: text('أصول الفقه', 'Legal principles'), 12: text('القواعد الفقهية', 'Legal maxims'),
  14: text('الفقه الحنفي', 'Hanafi fiqh'), 15: text('الفقه المالكي', 'Maliki fiqh'),
  16: text('الفقه الشافعي', 'Shafi‘i fiqh'), 17: text('الفقه الحنبلي', 'Hanbali fiqh'),
  18: text('الفقه العام', 'General fiqh'), 21: text('الفرائض والوصايا', 'Inheritance and wills'),
  23: text('الرقائق والآداب والأذكار', 'Conduct and remembrance'), 24: text('السيرة النبوية', 'Prophetic biography'),
  25: text('التاريخ', 'History'), 26: text('التراجم والطبقات', 'Biographies'),
  27: text('الأنساب', 'Genealogies'), 28: text('البلدان والرحلات', 'Geography and travels'),
  29: text('كتب اللغة', 'Arabic language'), 30: text('الغريب والمعاجم', 'Lexicons'),
  31: text('النحو والصرف', 'Grammar and morphology'), 32: text('الأدب', 'Literature'), 35: text('البلاغة', 'Rhetoric'),
};

export const ISLAMIC_DIRECTORIES = [
  { title: text('المكتبة الشاملة', 'Al-Maktaba al-Shamela'), description: text('أقسام أوسع وقراءة نصية حسب الكتاب والمؤلف.', 'Broader subject shelves and searchable full-text books.'), url: 'https://shamela.ws/#categories' },
  { title: text('المكتبة الوقفية', 'Al-Maktaba al-Waqfeya'), description: text('فهارس الطبعات المصوّرة والكتب والسلاسل.', 'Browse scanned editions, books and series.'), url: 'https://waqfeya.net/categories' },
  { title: text('مجموعات الحديث', 'Hadith collections'), description: text('كتب السنة مرتّبة بالأبواب مع الترجمة حسب الإتاحة.', 'Hadith collections by chapter, with translations where available.'), url: 'https://sunnah.com/' },
];

/** Search folds Arabic accents and common spelling variants; display text is never changed. */
function searchKey(value: string): string {
  return toLatinDigits(value.normalize('NFKD').toLowerCase())
    .replace(/[\p{Mark}ـ]/gu, '').replace(/ٱ/g, 'ا').replace(/[ىی]/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim();
}

const searchIndex = new Map(ISLAMIC_SHELVES.flatMap((shelf) => ISLAMIC_BOOKS[shelf.id].map((entry) => [entry.id, searchKey([
  entry.id, entry.title.ar, entry.title.en, entry.byline.ar, entry.byline.en, shelf.title.ar, shelf.title.en, ...(entry.tags ?? []),
].join(' '))] as const)));

export function searchIslamicShelves(value: string, filter: IslamicShelfId | 'all') {
  const key = searchKey(value);
  const tokens = key ? key.split(' ') : [];
  return ISLAMIC_SHELVES.filter((shelf) => filter === 'all' || shelf.id === filter)
    .map((shelf) => ({ shelf, books: ISLAMIC_BOOKS[shelf.id].filter((entry) => tokens.every((token) => searchIndex.get(entry.id)?.includes(token))) }))
    .filter(({ books }) => books.length > 0);
}
