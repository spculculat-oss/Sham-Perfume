import type { SupportedLanguage } from '../types/i18n';
import { isStaticHosting } from '../utils/api';
import { loc, type LText } from '../لغات/localize';

const STATIC_HOSTING_NOTICE: LText = {
  ar: 'هذه نسخة GitHub Pages الثابتة. الحاسبات والمكتبات متاحة، لكن المحادثة الذكية وتحديث الأخبار يحتاجان إلى خادم Node.js ولا يعملان على هذه الاستضافة.',
  en: 'This is the static GitHub Pages edition. Calculators and libraries are available, but AI chat and news refresh require a Node.js server and are not available on this hosting.',
  fr: 'Cette version GitHub Pages est statique. Les calculateurs et bibliothèques sont disponibles, mais le chat IA et l’actualisation des nouvelles nécessitent un serveur Node.js.',
  es: 'Esta es la versión estática de GitHub Pages. Las calculadoras y bibliotecas están disponibles, pero el chat IA y la actualización de noticias requieren un servidor Node.js.',
  it: 'Questa è la versione statica di GitHub Pages. Calcolatori e librerie sono disponibili, ma chat IA e aggiornamento delle notizie richiedono un server Node.js.',
  de: 'Dies ist die statische GitHub-Pages-Version. Rechner und Bibliotheken sind verfügbar. KI-Chat und Nachrichtenaktualisierung benötigen einen Node.js-Server.',
  ru: 'Это статическая версия GitHub Pages. Калькуляторы и библиотеки доступны, но для ИИ-чата и обновления новостей нужен сервер Node.js.',
  zh: '这是 GitHub Pages 静态版。计算器和资料库可用，但 AI 聊天和新闻更新需要 Node.js 服务器，无法在此托管环境中运行。',
  tr: 'Bu, statik GitHub Pages sürümüdür. Hesaplayıcılar ve kütüphaneler kullanılabilir; YZ sohbeti ve haber güncellemesi için Node.js sunucusu gerekir.',
  fa: 'این نسخه ایستای GitHub Pages است. ماشین‌حساب‌ها و کتابخانه‌ها در دسترس‌اند، اما گفتگوی هوشمند و به‌روزرسانی اخبار به سرور Node.js نیاز دارند و روی این میزبانی فعال نیستند.',
};

export const API_ERROR_NOTICE: LText = {
  ar: 'تعذّر الاتصال بخدمة الخادم أو كانت الاستجابة غير صالحة. لم يتم إنشاء رد جديد أو تحديث الأخبار. تأكد من تشغيل الخادم وإعداد مفاتيح الخدمة ثم حاول مرة أخرى.',
  en: 'The server could not be reached or returned an invalid response. No new reply or news update was generated. Check the server and its API key configuration before retrying.',
  fr: 'Le serveur est inaccessible ou sa réponse est invalide. Aucune réponse ni actualisation n’a été générée. Vérifiez le serveur et ses clés API.',
  es: 'El servidor no responde o devolvió una respuesta no válida. No se generó una respuesta ni se actualizaron noticias. Revisa el servidor y sus claves API.',
  it: 'Il server non è raggiungibile o ha risposto in modo non valido. Nessuna risposta o notizia è stata generata. Controlla il server e le chiavi API.',
  de: 'Der Server ist nicht erreichbar oder antwortet ungültig. Es wurde keine Antwort oder Nachrichtenaktualisierung erstellt. Prüfen Sie Server und API-Schlüssel.',
  ru: 'Сервер недоступен или вернул неверный ответ. Ответ и обновление новостей не созданы. Проверьте сервер и его API-ключи.',
  zh: '无法连接服务器或响应无效。未生成新回复或新闻更新。请检查服务器及其 API 密钥配置后重试。',
  tr: 'Sunucuya ulaşılamadı veya yanıt geçersiz. Yeni yanıt ya da haber güncellemesi oluşturulmadı. Sunucuyu ve API anahtarlarını kontrol edin.',
  fa: 'سرور در دسترس نیست یا پاسخ نامعتبر است. پاسخ یا خبر تازه‌ای تولید نشده است. سرور و کلیدهای API را بررسی و دوباره تلاش کنید.',
};

export function StaticHostingNotice({ currentLang }: { currentLang: SupportedLanguage }) {
  if (!isStaticHosting) return null;

  return (
    <p role="status" className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
      {loc(currentLang, STATIC_HOSTING_NOTICE)}
    </p>
  );
}
