import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AudioLines, Ear, EarOff, Fingerprint, Keyboard, Languages, Mic, MicOff, Play, Trash2, VolumeX, X } from 'lucide-react';
import { DEFAULT_VOICE_CHOICE, type VoiceGender } from '../utils/voiceChoice';
import { DIALECT_INFO, DIALECTS, isDialectChoice } from '../utils/arabicDialect';
import type { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { makeT, type LText } from '../لغات/localize';
import type { useShaheenVoiceMode } from '../hooks/useShaheenVoiceMode';

type VoiceModeState = ReturnType<typeof useShaheenVoiceMode>;

const COPY = {
  title: { ar: 'التحدث مع شاهين', en: 'Talking with Shaheen', fr: 'Conversation avec Shaheen', es: 'Hablando con Shaheen', it: 'Parli con Shaheen', de: 'Gespräch mit Shaheen', ru: 'Разговор с Шахином', zh: '与 Shaheen 语音对话', tr: 'Shaheen ile konuşma', fa: 'گفتگو با شاهین' },
  listening: { ar: 'بسمعك…', en: 'Listening…', fr: 'Je vous écoute…', es: 'Te escucho…', it: 'Ti ascolto…', de: 'Ich höre zu…', ru: 'Слушаю…', zh: '正在聆听…', tr: 'Dinliyorum…', fa: 'گوش می‌دهم…' },
  speak_now: { ar: 'اتكلم براحتك، وأول ما تسكت هبعت كلامك.', en: 'Speak naturally — I’ll send it when you pause.', fr: 'Parlez naturellement, j’envoie dès que vous faites une pause.', es: 'Habla con calma; lo envío cuando hagas una pausa.', it: 'Parla con calma: invio quando fai una pausa.', de: 'Sprich ganz normal – ich sende, sobald du eine Pause machst.', ru: 'Говорите спокойно — отправлю, когда вы замолчите.', zh: '请自然地说话，停顿后我会发送。', tr: 'Rahatça konuş; durduğunda gönderirim.', fa: 'راحت صحبت کنید؛ وقتی مکث کنید می‌فرستم.' },
  thinking: { ar: 'شاهين بيفكّر…', en: 'Shaheen is thinking…', fr: 'Shaheen réfléchit…', es: 'Shaheen está pensando…', it: 'Shaheen sta pensando…', de: 'Shaheen denkt nach…', ru: 'Шахин думает…', zh: 'Shaheen 正在思考…', tr: 'Shaheen düşünüyor…', fa: 'شاهین در حال فکر کردن است…' },
  speaking: { ar: 'شاهين بيتكلم', en: 'Shaheen is speaking', fr: 'Shaheen parle', es: 'Shaheen está hablando', it: 'Shaheen sta parlando', de: 'Shaheen spricht', ru: 'Шахин говорит', zh: 'Shaheen 正在说话', tr: 'Shaheen konuşuyor', fa: 'شاهین صحبت می‌کند' },
  barge_hint: { ar: 'اتكلم في أي وقت عشان تقاطعه، أو اضغط عليه', en: 'Just start talking to interrupt, or tap Shaheen', fr: 'Parlez à tout moment pour l’interrompre, ou touchez Shaheen', es: 'Habla cuando quieras para interrumpir, o toca a Shaheen', it: 'Parla quando vuoi per interromperlo, o tocca Shaheen', de: 'Sprich einfach los, um zu unterbrechen, oder tippe auf Shaheen', ru: 'Просто начните говорить, чтобы перебить, или нажмите на Шахина', zh: '随时开口即可打断，或点按 Shaheen', tr: 'Sözünü kesmek için konuşmaya başla ya da Shaheen’e dokun', fa: 'هر وقت خواستید حرف بزنید تا قطع شود، یا روی شاهین بزنید' },
  barge_on: { ar: 'المقاطعة بالصوت شغالة', en: 'Voice interruption on', fr: 'Interruption vocale activée', es: 'Interrupción por voz activada', it: 'Interruzione vocale attiva', de: 'Unterbrechen per Stimme an', ru: 'Перебивать голосом: вкл.', zh: '语音打断：开', tr: 'Sesle araya girme açık', fa: 'قطع با صدا روشن' },
  barge_off: { ar: 'المقاطعة بالصوت مقفولة', en: 'Voice interruption off', fr: 'Interruption vocale désactivée', es: 'Interrupción por voz desactivada', it: 'Interruzione vocale disattivata', de: 'Unterbrechen per Stimme aus', ru: 'Перебивать голосом: выкл.', zh: '语音打断：关', tr: 'Sesle araya girme kapalı', fa: 'قطع با صدا خاموش' },
  barge_tip: { ar: 'لو شاهين بيقف لوحده من صوته هو، اقفلها أو استخدم سماعة أذن.', en: 'If Shaheen stops on his own voice, turn this off or use earphones.', fr: 'Si Shaheen s’arrête à cause de sa propre voix, désactivez ou utilisez des écouteurs.', es: 'Si Shaheen se detiene por su propia voz, desactívalo o usa auriculares.', it: 'Se Shaheen si ferma per la sua stessa voce, disattiva o usa gli auricolari.', de: 'Wenn Shaheen bei seiner eigenen Stimme stoppt, schalte es aus oder nutze Kopfhörer.', ru: 'Если Шахин останавливается от собственного голоса, выключите это или наденьте наушники.', zh: '如果 Shaheen 被自己的声音打断，请关闭此项或使用耳机。', tr: 'Shaheen kendi sesiyle duruyorsa bunu kapat veya kulaklık kullan.', fa: 'اگر شاهین با صدای خودش متوقف می‌شود، این را خاموش کنید یا از هدفون استفاده کنید.' },
  dialect: { ar: 'اللهجة', en: 'Dialect', fr: 'Dialecte', es: 'Dialecto', it: 'Dialetto', de: 'Dialekt', ru: 'Диалект', zh: '方言', tr: 'Lehçe', fa: 'لهجه' },
  dialect_auto: { ar: 'تلقائي', en: 'Automatic', fr: 'Automatique', es: 'Automático', it: 'Automatico', de: 'Automatisch', ru: 'Авто', zh: '自动', tr: 'Otomatik', fa: 'خودکار' },
  interrupt_hint: { ar: 'اضغط على شاهين عشان تقاطعه وتتكلم', en: 'Tap Shaheen to interrupt and speak', fr: 'Touchez Shaheen pour l’interrompre et parler', es: 'Toca a Shaheen para interrumpir y hablar', it: 'Tocca Shaheen per interromperlo e parlare', de: 'Tippe auf Shaheen, um zu unterbrechen und zu sprechen', ru: 'Нажмите на Шахина, чтобы перебить и говорить', zh: '点按 Shaheen 即可打断并开始说话', tr: 'Sözünü kesip konuşmak için Shaheen’e dokun', fa: 'برای قطع کردن و صحبت، روی شاهین بزنید' },
  muted: { ar: 'الميكروفون مقفول', en: 'Microphone muted', fr: 'Micro coupé', es: 'Micrófono silenciado', it: 'Microfono disattivato', de: 'Mikrofon stumm', ru: 'Микрофон выключен', zh: '麦克风已静音', tr: 'Mikrofon kapalı', fa: 'میکروفون خاموش است' },
  muted_hint: { ar: 'اضغط على الميكروفون أو على شاهين عشان تكمّل الكلام.', en: 'Tap the microphone or Shaheen to keep talking.', fr: 'Touchez le micro ou Shaheen pour reprendre.', es: 'Toca el micrófono o a Shaheen para seguir hablando.', it: 'Tocca il microfono o Shaheen per continuare.', de: 'Tippe auf das Mikrofon oder Shaheen, um weiterzusprechen.', ru: 'Нажмите на микрофон или Шахина, чтобы продолжить.', zh: '点按麦克风或 Shaheen 继续对话。', tr: 'Devam etmek için mikrofona veya Shaheen’e dokun.', fa: 'برای ادامه روی میکروفون یا شاهین بزنید.' },
  you: { ar: 'إنت:', en: 'You:', fr: 'Vous :', es: 'Tú:', it: 'Tu:', de: 'Du:', ru: 'Вы:', zh: '你：', tr: 'Sen:', fa: 'شما:' },
  mute: { ar: 'اقفل الميكروفون', en: 'Mute microphone', fr: 'Couper le micro', es: 'Silenciar micrófono', it: 'Disattiva microfono', de: 'Mikrofon stummschalten', ru: 'Выключить микрофон', zh: '静音麦克风', tr: 'Mikrofonu kapat', fa: 'خاموش کردن میکروفون' },
  unmute: { ar: 'افتح الميكروفون', en: 'Unmute microphone', fr: 'Réactiver le micro', es: 'Activar micrófono', it: 'Riattiva microfono', de: 'Mikrofon einschalten', ru: 'Включить микрофон', zh: '取消静音', tr: 'Mikrofonu aç', fa: 'روشن کردن میکروفون' },
  type: { ar: 'اكتب بدل الكلام', en: 'Type instead', fr: 'Écrire plutôt', es: 'Escribir en su lugar', it: 'Scrivi invece', de: 'Lieber tippen', ru: 'Написать текстом', zh: '改为打字', tr: 'Yazarak devam et', fa: 'به‌جای صحبت بنویسید' },
  end: { ar: 'إنهاء المحادثة الصوتية', en: 'End voice chat', fr: 'Terminer la conversation vocale', es: 'Terminar chat de voz', it: 'Termina chat vocale', de: 'Sprachchat beenden', ru: 'Завершить голосовой чат', zh: '结束语音对话', tr: 'Sesli sohbeti bitir', fa: 'پایان گفتگوی صوتی' },
  orb_listen: { ar: 'شاهين بيسمعك', en: 'Shaheen is listening', fr: 'Shaheen vous écoute', es: 'Shaheen te escucha', it: 'Shaheen ti ascolta', de: 'Shaheen hört zu', ru: 'Шахин слушает', zh: 'Shaheen 正在聆听', tr: 'Shaheen dinliyor', fa: 'شاهین گوش می‌دهد' },
  private: { ar: 'الصوت مش بيتسجّل ولا بيترفع؛ الكلام بيتحول لنص بس.', en: 'Audio is never recorded or uploaded — only the text is used.', fr: 'L’audio n’est ni enregistré ni envoyé : seul le texte est utilisé.', es: 'El audio no se graba ni se sube; solo se usa el texto.', it: 'L’audio non viene registrato né caricato: si usa solo il testo.', de: 'Audio wird weder aufgezeichnet noch hochgeladen – nur der Text zählt.', ru: 'Звук не записывается и не загружается — используется только текст.', zh: '不会录制或上传音频，只使用转写的文字。', tr: 'Ses kaydedilmez ve yüklenmez; yalnızca metin kullanılır.', fa: 'صدا ضبط یا بارگذاری نمی‌شود؛ فقط متن استفاده می‌شود.' },
  print_button: { ar: 'بصمتي', en: 'My voice print', fr: 'Mon empreinte vocale', es: 'Mi huella de voz', it: 'La mia impronta vocale', de: 'Mein Stimmabdruck', ru: 'Мой голосовой отпечаток', zh: '我的声纹', tr: 'Ses izim', fa: 'اثر صدای من' },
  print_title: { ar: 'بصمة صوتك', en: 'Your voice print', fr: 'Votre empreinte vocale', es: 'Tu huella de voz', it: 'La tua impronta vocale', de: 'Dein Stimmabdruck', ru: 'Ваш голосовой отпечаток', zh: '你的声纹', tr: 'Ses iziniz', fa: 'اثر صدای شما' },
  print_consent: { ar: 'شاهين يقدر يحفظ بصمة لصوتك عشان الأصوات اللي حواليك (التلفزيون، ناس جنبك) متقاطعهوش ومتتحسبش كلامك. البصمة أرقام بس عن طبقة صوتك، بتتحفظ على الجهاز ده بس ومش بتتبعت لأي حد، وتقدر تمسحها بضغطة. مش مضمونة ١٠٠٪: لو شاهين مش متأكد هيعتبر الصوت صوتك.', en: 'Shaheen can keep a print of your voice so sounds around you (a TV, people nearby) don’t interrupt him or count as you. It is only numbers about how your voice sounds, kept on this device only, never sent anywhere, and deleted with one tap. It isn’t 100% sure: when in doubt, Shaheen treats the voice as yours.', fr: 'Shaheen peut garder une empreinte de votre voix pour que les sons autour de vous (télé, personnes à côté) ne l’interrompent pas et ne comptent pas comme vous. Ce ne sont que des chiffres sur votre voix, gardés sur cet appareil uniquement, jamais envoyés, supprimables d’un geste. Ce n’est pas fiable à 100 % : en cas de doute, la voix est considérée comme la vôtre.', es: 'Shaheen puede guardar una huella de tu voz para que los sonidos de alrededor (la tele, gente cerca) no lo interrumpan ni cuenten como tú. Son solo números sobre cómo suena tu voz, guardados solo en este dispositivo, nunca enviados, y se borran con un toque. No es 100 % segura: si hay duda, la voz cuenta como tuya.', it: 'Shaheen può conservare un’impronta della tua voce, così i suoni intorno (la TV, persone vicine) non lo interrompono e non contano come te. Sono solo numeri su come suona la tua voce, salvati solo su questo dispositivo, mai inviati, e si cancellano con un tocco. Non è sicura al 100%: nel dubbio la voce conta come tua.', de: 'Shaheen kann einen Abdruck deiner Stimme speichern, damit Geräusche um dich herum (Fernseher, Leute in der Nähe) ihn nicht unterbrechen oder als du zählen. Es sind nur Zahlen über deinen Stimmklang, nur auf diesem Gerät gespeichert, nie gesendet und mit einem Tippen gelöscht. Nicht 100 % sicher: Im Zweifel zählt die Stimme als deine.', ru: 'Шахин может сохранить отпечаток вашего голоса, чтобы звуки вокруг (телевизор, люди рядом) не перебивали его и не считались вами. Это только числа о звучании голоса, хранятся только на этом устройстве, никуда не отправляются и удаляются одним нажатием. Не на 100 % надёжно: при сомнении голос считается вашим.', zh: 'Shaheen 可以保存你的声纹，让周围的声音（电视、旁人）不会打断他或被当成你说的话。声纹只是描述你声音特征的数字，只保存在这台设备上，绝不上传，一键即可删除。它并非百分之百准确：不确定时，Shaheen 会当作是你的声音。', tr: 'Shaheen sesinin bir izini saklayabilir; böylece etraftaki sesler (televizyon, yanındaki kişiler) onu bölmez ve senin sözün sayılmaz. Bu yalnızca sesinle ilgili sayılardır, sadece bu cihazda tutulur, hiçbir yere gönderilmez ve tek dokunuşla silinir. %100 kesin değildir: emin olmadığında ses senin sayılır.', fa: 'شاهین می‌تواند اثری از صدای شما نگه دارد تا صداهای اطراف (تلویزیون، افراد نزدیک) حرفش را قطع نکنند و حرف شما حساب نشوند. فقط چند عدد دربارهٔ صدای شماست، فقط روی همین دستگاه می‌ماند، به هیچ‌جا فرستاده نمی‌شود و با یک لمس پاک می‌شود. صددرصد مطمئن نیست: در صورت تردید، صدا مال شما حساب می‌شود.' },
  print_agree: { ar: 'موافق، يلا نبدأ', en: 'I agree, let’s start', fr: 'J’accepte, on commence', es: 'Acepto, empecemos', it: 'Accetto, iniziamo', de: 'Einverstanden, los geht’s', ru: 'Согласен, начнём', zh: '同意，开始', tr: 'Kabul ediyorum, başlayalım', fa: 'موافقم، شروع کنیم' },
  print_no: { ar: 'لا شكرًا', en: 'No thanks', fr: 'Non merci', es: 'No, gracias', it: 'No, grazie', de: 'Nein danke', ru: 'Нет, спасибо', zh: '不用了', tr: 'Hayır, teşekkürler', fa: 'نه، ممنون' },
  print_step: { ar: 'الجملة {n} من ٣ — اقراها بصوتك العادي', en: 'Sentence {n} of 3 — read it in your normal voice', fr: 'Phrase {n} sur 3 — lisez-la avec votre voix habituelle', es: 'Frase {n} de 3 — léela con tu voz normal', it: 'Frase {n} di 3 — leggila con la tua voce normale', de: 'Satz {n} von 3 – lies ihn mit deiner normalen Stimme', ru: 'Фраза {n} из 3 — прочитайте обычным голосом', zh: '第 {n} 句，共 3 句——用平常的声音读出来', tr: 'Cümle {n}/3 — normal sesinle oku', fa: 'جملهٔ {n} از ۳ — با صدای معمولی بخوانید' },
  print_record: { ar: 'اضغط واقرا الجملة', en: 'Tap and read the sentence', fr: 'Touchez et lisez la phrase', es: 'Toca y lee la frase', it: 'Tocca e leggi la frase', de: 'Tippe und lies den Satz', ru: 'Нажмите и прочитайте фразу', zh: '点按后朗读这句话', tr: 'Dokun ve cümleyi oku', fa: 'بزنید و جمله را بخوانید' },
  print_recording: { ar: 'بسمعك… اقرا الجملة', en: 'Listening… read the sentence', fr: 'J’écoute… lisez la phrase', es: 'Te escucho… lee la frase', it: 'Ti ascolto… leggi la frase', de: 'Ich höre… lies den Satz', ru: 'Слушаю… читайте фразу', zh: '正在聆听…请朗读', tr: 'Dinliyorum… cümleyi oku', fa: 'گوش می‌دهم… جمله را بخوانید' },
  print_short: { ar: 'ماسمعتش كفاية، جرّب تاني بصوت أوضح.', en: 'I didn’t hear enough — try again a bit clearer.', fr: 'Je n’ai pas assez entendu, réessayez plus clairement.', es: 'No oí lo suficiente; inténtalo de nuevo más claro.', it: 'Non ho sentito abbastanza, riprova più chiaramente.', de: 'Nicht genug gehört – versuch es etwas deutlicher.', ru: 'Недостаточно слышно — попробуйте ещё раз чётче.', zh: '没听清楚，请再清楚地读一次。', tr: 'Yeterince duyamadım, biraz daha net tekrar dene.', fa: 'به اندازهٔ کافی نشنیدم؛ دوباره واضح‌تر امتحان کنید.' },
  print_mic: { ar: 'الميكروفون مش متاح للبصمة على الجهاز ده.', en: 'The microphone isn’t available for a voice print on this device.', fr: 'Le micro n’est pas disponible pour l’empreinte sur cet appareil.', es: 'El micrófono no está disponible para la huella en este dispositivo.', it: 'Il microfono non è disponibile per l’impronta su questo dispositivo.', de: 'Das Mikrofon ist auf diesem Gerät für den Abdruck nicht verfügbar.', ru: 'Микрофон недоступен для отпечатка на этом устройстве.', zh: '此设备无法使用麦克风录制声纹。', tr: 'Bu cihazda ses izi için mikrofon kullanılamıyor.', fa: 'میکروفون برای اثر صدا روی این دستگاه در دسترس نیست.' },
  print_done: { ar: 'بصمتك اتحفظت على الجهاز ده بس.', en: 'Your print is saved on this device only.', fr: 'Votre empreinte est enregistrée sur cet appareil uniquement.', es: 'Tu huella se guardó solo en este dispositivo.', it: 'La tua impronta è salvata solo su questo dispositivo.', de: 'Dein Abdruck ist nur auf diesem Gerät gespeichert.', ru: 'Отпечаток сохранён только на этом устройстве.', zh: '声纹只保存在这台设备上。', tr: 'İzin yalnızca bu cihaza kaydedildi.', fa: 'اثر صدای شما فقط روی همین دستگاه ذخیره شد.' },
  print_on: { ar: 'البصمة شغالة', en: 'Voice print on', fr: 'Empreinte activée', es: 'Huella activada', it: 'Impronta attiva', de: 'Abdruck an', ru: 'Отпечаток: вкл.', zh: '声纹：开', tr: 'Ses izi açık', fa: 'اثر صدا روشن' },
  print_off: { ar: 'البصمة مقفولة', en: 'Voice print off', fr: 'Empreinte désactivée', es: 'Huella desactivada', it: 'Impronta disattivata', de: 'Abdruck aus', ru: 'Отпечаток: выкл.', zh: '声纹：关', tr: 'Ses izi kapalı', fa: 'اثر صدا خاموش' },
  print_delete: { ar: 'امسح البصمة', en: 'Delete the print', fr: 'Supprimer l’empreinte', es: 'Borrar la huella', it: 'Elimina l’impronta', de: 'Abdruck löschen', ru: 'Удалить отпечаток', zh: '删除声纹', tr: 'İzi sil', fa: 'پاک کردن اثر صدا' },
  print_redo: { ar: 'سجّلها من جديد', en: 'Record it again', fr: 'L’enregistrer à nouveau', es: 'Grabarla de nuevo', it: 'Registrala di nuovo', de: 'Neu aufnehmen', ru: 'Записать заново', zh: '重新录制', tr: 'Yeniden kaydet', fa: 'دوباره ضبط کنید' },
  print_close: { ar: 'قفل', en: 'Close', fr: 'Fermer', es: 'Cerrar', it: 'Chiudi', de: 'Schließen', ru: 'Закрыть', zh: '关闭', tr: 'Kapat', fa: 'بستن' },
  voice_button: { ar: 'صوت شاهين', en: 'Shaheen’s voice', fr: 'La voix de Shaheen', es: 'La voz de Shaheen', it: 'La voce di Shaheen', de: 'Shaheens Stimme', ru: 'Голос Шахина', zh: 'Shaheen 的声音', tr: 'Shaheen’in sesi', fa: 'صدای شاهین' },
  voice_title: { ar: 'اختار الصوت اللي تحبه', en: 'Choose the voice you like', fr: 'Choisissez la voix que vous aimez', es: 'Elige la voz que te guste', it: 'Scegli la voce che preferisci', de: 'Wähle die Stimme, die dir gefällt', ru: 'Выберите голос, который вам нравится', zh: '选择你喜欢的声音', tr: 'Sevdiğin sesi seç', fa: 'صدایی را که دوست دارید انتخاب کنید' },
  voice_all: { ar: 'الكل', en: 'All', fr: 'Toutes', es: 'Todas', it: 'Tutte', de: 'Alle', ru: 'Все', zh: '全部', tr: 'Tümü', fa: 'همه' },
  voice_male: { ar: 'رجالي', en: 'Male', fr: 'Homme', es: 'Hombre', it: 'Uomo', de: 'Männlich', ru: 'Мужской', zh: '男声', tr: 'Erkek', fa: 'مردانه' },
  voice_female: { ar: 'حريمي', en: 'Female', fr: 'Femme', es: 'Mujer', it: 'Donna', de: 'Weiblich', ru: 'Женский', zh: '女声', tr: 'Kadın', fa: 'زنانه' },
  voice_listen: { ar: 'اسمع', en: 'Listen', fr: 'Écouter', es: 'Escuchar', it: 'Ascolta', de: 'Anhören', ru: 'Послушать', zh: '试听', tr: 'Dinle', fa: 'گوش بده' },
  voice_pitch: { ar: 'طبقة الصوت', en: 'Pitch', fr: 'Hauteur', es: 'Tono', it: 'Tono', de: 'Tonhöhe', ru: 'Высота', zh: '音调', tr: 'Ses tonu', fa: 'زیر و بمی' },
  voice_rate: { ar: 'سرعة الكلام', en: 'Speed', fr: 'Vitesse', es: 'Velocidad', it: 'Velocità', de: 'Tempo', ru: 'Скорость', zh: '语速', tr: 'Hız', fa: 'سرعت' },
  voice_default: { ar: 'رجّع الافتراضي', en: 'Back to default', fr: 'Par défaut', es: 'Volver al predeterminado', it: 'Torna al predefinito', de: 'Zurück zum Standard', ru: 'По умолчанию', zh: '恢复默认', tr: 'Varsayılana dön', fa: 'بازگشت به پیش‌فرض' },
  voice_none: { ar: 'الجهاز ده مفيهوش أصوات للغة دي غير الصوت العادي.', en: 'This device has no other voices for this language.', fr: 'Cet appareil n’a pas d’autres voix pour cette langue.', es: 'Este dispositivo no tiene otras voces para este idioma.', it: 'Questo dispositivo non ha altre voci per questa lingua.', de: 'Dieses Gerät hat keine weiteren Stimmen für diese Sprache.', ru: 'На этом устройстве нет других голосов для этого языка.', zh: '此设备没有该语言的其他声音。', tr: 'Bu cihazda bu dil için başka ses yok.', fa: 'این دستگاه صدای دیگری برای این زبان ندارد.' },
  voice_hint: { ar: 'الأصوات من جهازك نفسه، ولو عايز أصوات أكتر نزّلها من إعدادات الجهاز (الكلام / تحويل النص لكلام).', en: 'Voices come from your own device; to get more, add them in your device settings (Speech / Text-to-speech).', fr: 'Les voix viennent de votre appareil ; pour en avoir plus, ajoutez-les dans les réglages (Synthèse vocale).', es: 'Las voces vienen de tu dispositivo; para tener más, añádelas en los ajustes (Texto a voz).', it: 'Le voci vengono dal tuo dispositivo; per averne altre, aggiungile nelle impostazioni (Sintesi vocale).', de: 'Die Stimmen kommen von deinem Gerät; weitere kannst du in den Einstellungen hinzufügen (Sprachausgabe).', ru: 'Голоса берутся с вашего устройства; добавить новые можно в настройках (Синтез речи).', zh: '声音来自你的设备；如需更多，请在设备设置（文字转语音）中添加。', tr: 'Sesler cihazının kendisinden gelir; daha fazlası için cihaz ayarlarından ekle (Metin okuma).', fa: 'صداها از خود دستگاه شماست؛ برای صداهای بیشتر از تنظیمات دستگاه (تبدیل متن به گفتار) اضافه کنید.' },
  voice_sample: { ar: 'أهلاً بيك، أنا شاهين. تحب أساعدك تختار عطر النهارده؟', en: 'Hi, I’m Shaheen. Shall I help you choose a perfume today?', fr: 'Bonjour, je suis Shaheen. Je vous aide à choisir un parfum ?', es: 'Hola, soy Shaheen. ¿Te ayudo a elegir un perfume hoy?', it: 'Ciao, sono Shaheen. Ti aiuto a scegliere un profumo oggi?', de: 'Hallo, ich bin Shaheen. Soll ich dir heute bei einem Parfum helfen?', ru: 'Привет, я Шахин. Помочь вам выбрать аромат?', zh: '你好，我是 Shaheen。今天要我帮你挑一款香水吗？', tr: 'Merhaba, ben Shaheen. Bugün parfüm seçmene yardım edeyim mi?', fa: 'سلام، من شاهین هستم. کمکتان کنم امروز عطری انتخاب کنید؟' },
  print_ignored: { ar: 'تجاهلت صوت تاني مش صوتك', en: 'I ignored a voice that isn’t yours', fr: 'J’ai ignoré une voix qui n’est pas la vôtre', es: 'Ignoré una voz que no es la tuya', it: 'Ho ignorato una voce che non è la tua', de: 'Eine fremde Stimme ignoriert', ru: 'Проигнорировал чужой голос', zh: '已忽略不是你的声音', tr: 'Senin olmayan bir sesi yok saydım', fa: 'صدایی را که مال شما نبود نادیده گرفتم' },
} satisfies Record<string, LText>;

type StagePhase = 'muted' | 'speaking' | 'thinking' | 'listening';

function stagePhase(voice: VoiceModeState): StagePhase {
  if (voice.speaking) return 'speaking';
  if (voice.waiting) return 'thinking';
  if (voice.muted) return 'muted';
  return 'listening';
}

/** Phones share one microphone between apps badly; only a desktop pointer gets the live level meter. */
function canMeterMicrophone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (!navigator.mediaDevices?.getUserMedia || typeof window.AudioContext === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')) return false;
  return window.matchMedia?.('(pointer: fine)').matches ?? false;
}

/**
 * A live loudness reading (0–1) of the visitor's microphone, used only to move the orb with their voice.
 * The sound is analysed on the device in real time: nothing is stored, recorded or sent anywhere.
 */
function useMicrophoneLevel(enabled: boolean) {
  const levelRef = useRef<number | null>(null);
  useEffect(() => {
    levelRef.current = null;
    if (!enabled || !canMeterMicrophone()) return undefined;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let frame = 0;
    void navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then((media) => {
      if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
      stream = media;
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(media).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const read = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) { const centred = (sample - 128) / 128; sum += centred * centred; }
        levelRef.current = Math.min(1, Math.sqrt(sum / samples.length) * 5);
        frame = requestAnimationFrame(read);
      };
      read();
    }).catch(() => { levelRef.current = null; });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => undefined);
      levelRef.current = null;
    };
  }, [enabled]);
  return levelRef;
}

/**
 * The full-screen voice conversation: a living golden orb that breathes while it listens, follows the
 * visitor's voice, swirls while Shaheen thinks and pulses with every spoken word — with live captions and
 * mute / type / end controls. Tapping the orb while Shaheen speaks cuts him off and listens.
 */
export function ShaheenVoiceStage({ language, voice, avatarSrc }: {
  language: SupportedLanguage;
  voice: VoiceModeState;
  avatarSrc?: string;
}) {
  const L = makeT(language, COPY);
  const rtl = isRTL(language);
  const phase = stagePhase(voice);
  const stageRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLButtonElement>(null);
  // The hook's own ear already reads the microphone on a computer: its level is used then (one microphone, not two).
  const micLevel = useMicrophoneLevel(voice.active && !voice.muted && !voice.earActive);
  const earLevel = useRef(voice.micLevel);
  earLevel.current = voice.micLevel;
  const [printPanel, setPrintPanel] = useState(false);
  const [voicePanel, setVoicePanel] = useState(false);
  // «بصمتي»: offered once, with one tap, when the voice conversation opens (never again after a yes or a no).
  useEffect(() => {
    if (!voice.active || !voice.print.supported || voice.print.saved) return;
    try {
      if (localStorage.getItem(PRINT_ASKED)) return;
      localStorage.setItem(PRINT_ASKED, '1');
    } catch { return; }
    setPrintPanel(true);
  }, [voice.active, voice.print.supported, voice.print.saved]);
  const [ignoredNote, setIgnoredNote] = useState(false);
  useEffect(() => {
    if (!voice.ignoredVoices) return undefined;
    setIgnoredNote(true);
    const timer = setTimeout(() => setIgnoredNote(false), 2600);
    return () => clearTimeout(timer);
  }, [voice.ignoredVoices]);

  // Everything the animation loop reads lives in refs so the loop never restarts on a re-render.
  const live = useRef({ phase, hearing: voice.hearing });
  live.current.phase = phase;
  live.current.hearing = voice.hearing;
  const energy = useRef(0);
  useEffect(() => { energy.current = Math.max(energy.current, 0.85); }, [voice.speechBeat]);
  useEffect(() => { if (voice.interim) energy.current = Math.max(energy.current, 0.55); }, [voice.interim]);
  useEffect(() => { if (voice.bargedIn) energy.current = 1; }, [voice.bargedIn]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof window === 'undefined') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      node.style.setProperty('--sham-voice-level', '0.2');
      return undefined;
    }
    let level = 0;
    let frame = 0;
    const tick = (time: number) => {
      const t = time / 1000;
      const { phase: current, hearing } = live.current;
      energy.current *= 0.9;
      let target: number;
      if (current === 'muted') target = 0.02;
      else if (current === 'thinking') target = 0.16 + 0.06 * Math.sin(t * 3.2);
      else if (current === 'speaking') target = 0.24 + 0.1 * Math.sin(t * 7) + energy.current * 0.6;
      else {
        const fromEar = earLevel.current();
        const measured = fromEar !== null ? Math.min(1, fromEar * 5) : micLevel.current;
        target = measured !== null
          ? 0.08 + measured * 0.9
          : (hearing ? 0.42 + 0.18 * Math.sin(t * 9) : 0.1 + 0.05 * Math.sin(t * 2.2)) + energy.current * 0.35;
      }
      level += (Math.max(0, Math.min(1, target)) - level) * 0.16;
      node.style.setProperty('--sham-voice-level', level.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [micLevel]);

  // Escape ends the conversation; the end button takes focus so keyboard users land on a control.
  useEffect(() => {
    endRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') voice.stop(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [voice.stop]);

  const onOrb = () => {
    if (voice.speaking) voice.interrupt();
    else if (voice.muted) voice.toggleMute();
  };

  const status = phase === 'speaking' ? L('speaking') : phase === 'thinking' ? L('thinking') : phase === 'muted' ? L('muted') : L('listening');
  let caption: ReactNode;
  if (phase === 'speaking') caption = voice.spokenText ? <p className="text-lg leading-relaxed text-white sm:text-xl">{voice.spokenText}</p> : null;
  else if (phase === 'thinking') caption = voice.lastHeard ? <p className="text-base leading-relaxed text-amber-100/70"><span className="font-semibold text-amber-200/90">{L('you')}</span> {voice.lastHeard}</p> : null;
  else if (phase === 'muted') caption = <p className="text-base text-stone-300">{L('muted_hint')}</p>;
  else caption = voice.interim
    ? <p className="text-lg leading-relaxed text-white sm:text-xl">{voice.interim}</p>
    : <p className="text-base text-stone-300">{L('speak_now')}</p>;

  const stage = (
    <div
      ref={stageRef}
      className="sham-voice-stage fixed inset-0 z-[150] flex flex-col items-center justify-between overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white"
      data-phase={phase}
      dir={rtl ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-label={L('title')}
    >
      <div className="sham-voice-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />

      <header className="relative flex w-full max-w-xl items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {avatarSrc && <img src={avatarSrc} alt="" className="h-9 w-9 rounded-full border border-amber-300/70 object-cover object-top" />}
          <div>
            <p className="text-sm font-bold text-amber-100">{L('title')}</p>
            <p className="flex items-center gap-1.5 text-xs text-stone-300" role="status" aria-live="polite">
              <span className={`h-1.5 w-1.5 rounded-full ${phase === 'listening' ? 'bg-emerald-400 motion-safe:animate-pulse' : phase === 'speaking' ? 'bg-amber-300' : phase === 'thinking' ? 'bg-sky-300 motion-safe:animate-pulse' : 'bg-stone-500'}`} aria-hidden="true" />
              {status}
            </p>
          </div>
        </div>
        <button type="button" onClick={voice.stop} className="rounded-full p-2 text-stone-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={L('end')} title={L('end')}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-8">
        <button
          type="button"
          onClick={onOrb}
          className="sham-voice-orb group relative grid h-52 w-52 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60 sm:h-60 sm:w-60"
          aria-label={phase === 'speaking' ? L('interrupt_hint') : phase === 'muted' ? L('unmute') : L('orb_listen')}
          title={phase === 'speaking' ? L('interrupt_hint') : undefined}
        >
          <span className="sham-voice-halo" aria-hidden="true" />
          <span className="sham-voice-ring" aria-hidden="true" />
          <span className="sham-voice-core" aria-hidden="true">
            <span className="sham-voice-sheen" />
            <span className="sham-voice-bars">
              {[0, 1, 2, 3, 4].map((bar) => <i key={bar} style={{ animationDelay: `${bar * -0.17}s` }} />)}
            </span>
          </span>
        </button>

        <div className="min-h-[5.5rem] w-full max-w-xl text-center" aria-live="polite">
          {caption && <div className="sham-voice-caption line-clamp-4 break-words">{caption}</div>}
          {phase === 'speaking' && <p className="mt-3 text-xs text-amber-200/70">{voice.bargeEnabled ? L('barge_hint') : L('interrupt_hint')}</p>}
          {ignoredNote && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-stone-200"><VolumeX className="h-3.5 w-3.5" aria-hidden="true" />{L('print_ignored')}</p>}
        </div>
      </div>

      <footer className="relative flex w-full max-w-xl flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          {voice.dialect && (
            <label className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1 pe-1 ps-3 text-stone-200 backdrop-blur">
              <Languages className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
              <span>{L('dialect')}</span>
              <select
                value={voice.dialectChoice}
                onChange={(event) => { if (isDialectChoice(event.target.value)) voice.setDialectChoice(event.target.value); }}
                className="rounded-full border-0 bg-white/10 px-2 py-1 text-xs font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 [&>option]:text-stone-900"
                aria-label={L('dialect')}
              >
                <option value="auto">{`${L('dialect_auto')} (${DIALECT_INFO[voice.dialect].ar})`}</option>
                {DIALECTS.map((code) => <option key={code} value={code}>{DIALECT_INFO[code].ar}</option>)}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => voice.setBargeEnabled(!voice.bargeEnabled)}
            aria-pressed={voice.bargeEnabled}
            title={L('barge_tip')}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${voice.bargeEnabled ? 'border-amber-300/40 bg-amber-300/10 text-amber-100' : 'border-white/15 bg-white/5 text-stone-400'}`}
          >
            {voice.bargeEnabled ? <Ear className="h-3.5 w-3.5" aria-hidden="true" /> : <EarOff className="h-3.5 w-3.5" aria-hidden="true" />}
            {voice.bargeEnabled ? L('barge_on') : L('barge_off')}
          </button>
          <button
            type="button"
            onClick={() => setVoicePanel(true)}
            aria-haspopup="dialog"
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-stone-300 backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <AudioLines className="h-3.5 w-3.5" aria-hidden="true" />
            {L('voice_button')}
          </button>
          {voice.print.supported && (
            <button
              type="button"
              onClick={() => setPrintPanel(true)}
              aria-haspopup="dialog"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${voice.print.saved && voice.print.on ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100' : 'border-white/15 bg-white/5 text-stone-300'}`}
            >
              <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
              {L('print_button')}
            </button>
          )}
        </div>
        <div className="flex items-center justify-center gap-5">
          <button type="button" onClick={voice.stop} className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-stone-100 backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={L('type')} title={L('type')}>
            <Keyboard className="h-6 w-6" aria-hidden="true" />
          </button>
          <button type="button" onClick={voice.toggleMute} aria-pressed={voice.muted} className={`grid h-16 w-16 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${voice.muted ? 'bg-white text-stone-900 hover:bg-stone-200' : 'bg-white/15 text-white backdrop-blur hover:bg-white/25'}`} aria-label={voice.muted ? L('unmute') : L('mute')} title={voice.muted ? L('unmute') : L('mute')}>
            {voice.muted ? <MicOff className="h-7 w-7" aria-hidden="true" /> : <Mic className="h-7 w-7" aria-hidden="true" />}
          </button>
          <button ref={endRef} type="button" onClick={voice.stop} className="grid h-14 w-14 place-items-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300" aria-label={L('end')} title={L('end')}>
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <p className="text-center text-[11px] text-stone-400">{L('private')}</p>
      </footer>

      {voicePanel && <VoicePickerPanel L={L} voice={voice} onClose={() => setVoicePanel(false)} />}
      {printPanel && (
        <VoicePrintPanel
          L={L}
          voice={voice}
          onClose={() => { if (voice.enrolment) voice.closeEnrolment(); setPrintPanel(false); }}
        />
      )}
    </div>
  );

  return typeof document === 'undefined' ? stage : createPortal(stage, document.body);
}

const PRINT_ASKED = 'sham_voice_print_asked_v1';

/**
 * «صوت شاهين»: every voice the device has for this language, male and female, each with «اسمع» to hear it first, plus
 * how high and how fast he talks. Kept in this browser.
 */
function VoicePickerPanel({ L, voice, onClose }: { L: (key: keyof typeof COPY & string) => string; voice: VoiceModeState; onClose: () => void }) {
  const [show, setShow] = useState<VoiceGender | 'all'>(voice.voiceChoice.gender || 'all');
  const { voiceChoice: choice, setVoiceChoice } = voice;
  const base = voice.language;
  const list = voice.voices.filter((option) => show === 'all' || option.gender === show);
  const chip = (active: boolean) => `rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${active ? 'bg-amber-300 text-stone-900' : 'bg-white/10 text-stone-200 hover:bg-white/20'}`;
  const pickGender = (gender: VoiceGender | 'all') => {
    setShow(gender);
    const { gender: _old, ...rest } = choice;
    const names = { ...choice.names };
    // A gender chosen: his picked voice stays only if it is that gender.
    const current = voice.voices.find((option) => option.name === names[base]);
    if (gender !== 'all' && current && current.gender !== gender) delete names[base];
    setVoiceChoice(gender === 'all' ? { ...rest, names } : { ...rest, names, gender });
  };
  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={L('voice_title')}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 rounded-3xl border border-white/10 bg-stone-900/95 p-5 shadow-2xl">
        <p className="flex items-center gap-2 text-base font-bold text-amber-100"><AudioLines className="h-5 w-5" aria-hidden="true" />{L('voice_title')}</p>
        <div className="flex flex-wrap gap-2" role="group">
          {(['all', 'male', 'female'] as const).map((gender) => (
            <button key={gender} type="button" aria-pressed={show === gender} onClick={() => pickGender(gender)} className={chip(show === gender)}>
              {L(gender === 'all' ? 'voice_all' : gender === 'male' ? 'voice_male' : 'voice_female')}
            </button>
          ))}
        </div>
        <ul className="flex min-h-0 flex-col gap-1.5 overflow-y-auto pe-1" role="radiogroup" aria-label={L('voice_title')}>
          {list.length === 0 && <li className="text-sm text-stone-300">{L('voice_none')}</li>}
          {list.map((option) => {
            const selected = option.name === voice.currentVoiceName;
            return (
              <li key={option.name} className={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${selected ? 'border-amber-300/60 bg-amber-300/10' : 'border-white/10 bg-white/5'}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setVoiceChoice({ ...choice, names: { ...choice.names, [base]: option.name } })}
                  className="flex min-w-0 flex-1 items-center gap-2 text-start text-sm text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  <span className={`h-3 w-3 shrink-0 rounded-full border ${selected ? 'border-amber-300 bg-amber-300' : 'border-stone-400'}`} aria-hidden="true" />
                  <span className="truncate" dir="ltr">{option.label}</span>
                  {option.gender && <span className="shrink-0 text-[11px] text-stone-400">{L(option.gender === 'male' ? 'voice_male' : 'voice_female')}</span>}
                </button>
                <button type="button" onClick={() => voice.previewVoice(option.name, L('voice_sample'))} className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-stone-100 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                  <Play className="h-3 w-3" aria-hidden="true" />{L('voice_listen')}
                </button>
              </li>
            );
          })}
        </ul>
        <label className="flex flex-col gap-1 text-xs text-stone-300">
          {L('voice_pitch')}
          <input type="range" min={0.6} max={1.5} step={0.05} value={choice.pitch} onChange={(event) => setVoiceChoice({ ...choice, pitch: Number(event.target.value) })} className="accent-amber-300" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-300">
          {L('voice_rate')}
          <input type="range" min={0.7} max={1.3} step={0.02} value={choice.rate} onChange={(event) => setVoiceChoice({ ...choice, rate: Number(event.target.value) })} className="accent-amber-300" />
        </label>
        <p className="text-[11px] leading-relaxed text-stone-400">{L('voice_hint')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => { setShow('all'); setVoiceChoice({ ...DEFAULT_VOICE_CHOICE, names: {} }); }} className={chip(false)}>{L('voice_default')}</button>
          <button type="button" onClick={onClose} className={chip(false)}>{L('print_close')}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * «بصمتي»: consent first (what it is, where it stays, that it is not 100%), then three sentences read aloud, then on/off
 * and a one-tap delete. Only numbers about the voice are kept, in this browser; no sound is recorded or sent.
 */
function VoicePrintPanel({ L, voice, onClose }: { L: (key: keyof typeof COPY & string) => string; voice: VoiceModeState; onClose: () => void }) {
  const { enrolment, print } = voice;
  const button = 'rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300';
  let body: ReactNode;
  if (enrolment && !enrolment.done) {
    const sentence = voice.enrolSentences[Math.min(enrolment.step, 2)];
    body = (
      <>
        <p className="text-xs text-amber-200/80">{L('print_step').replace('{n}', String(enrolment.step + 1))}</p>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step < enrolment.step ? 'bg-emerald-400' : step === enrolment.step ? 'bg-amber-300' : 'bg-white/15'}`} />)}
        </div>
        <p className="rounded-2xl bg-white/5 p-4 text-center text-lg leading-relaxed text-white">{sentence}</p>
        {enrolment.error && <p className="text-sm text-rose-200" role="alert">{enrolment.error === 'microphone' ? L('print_mic') : L('print_short')}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={voice.recordEnrolment} disabled={enrolment.recording} className={`${button} flex items-center gap-2 bg-amber-300 text-stone-900 hover:bg-amber-200 disabled:opacity-80`}>
            <Mic className={`h-4 w-4 ${enrolment.recording ? 'motion-safe:animate-pulse' : ''}`} aria-hidden="true" />
            {enrolment.recording ? L('print_recording') : L('print_record')}
          </button>
          <button type="button" onClick={onClose} className={`${button} bg-white/10 text-stone-200 hover:bg-white/20`}>{L('print_close')}</button>
        </div>
      </>
    );
  } else if (print.saved) {
    body = (
      <>
        {enrolment?.done && <p className="text-sm text-emerald-200" role="status">{L('print_done')}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => voice.setPrintOn(!print.on)} aria-pressed={print.on} className={`${button} border ${print.on ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100' : 'border-white/15 bg-white/5 text-stone-300'}`}>
            {print.on ? L('print_on') : L('print_off')}
          </button>
          <button type="button" onClick={voice.startEnrolment} className={`${button} bg-white/10 text-stone-200 hover:bg-white/20`}>{L('print_redo')}</button>
          <button type="button" onClick={voice.deletePrint} className={`${button} flex items-center gap-1.5 bg-rose-600 text-white hover:bg-rose-500`}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />{L('print_delete')}
          </button>
        </div>
        <button type="button" onClick={onClose} className={`${button} mx-auto bg-white/10 text-stone-200 hover:bg-white/20`}>{L('print_close')}</button>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-sm leading-relaxed text-stone-200">{L('print_consent')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={voice.startEnrolment} className={`${button} bg-amber-300 text-stone-900 hover:bg-amber-200`}>{L('print_agree')}</button>
          <button type="button" onClick={onClose} className={`${button} bg-white/10 text-stone-200 hover:bg-white/20`}>{L('print_no')}</button>
        </div>
      </>
    );
  }
  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={L('print_title')}>
      <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-white/10 bg-stone-900/95 p-5 shadow-2xl">
        <p className="flex items-center gap-2 text-base font-bold text-amber-100"><Fingerprint className="h-5 w-5" aria-hidden="true" />{L('print_title')}</p>
        {body}
      </div>
    </div>
  );
}
