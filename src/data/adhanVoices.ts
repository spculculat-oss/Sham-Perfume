import { prayerAssetUrl, type AdhanVoiceId } from '../utils/prayerConfig';
import type { LText } from '../لغات/localize';

export type AdhanVariant = 'regular' | 'fajr';
export interface AdhanRecording {
  title: LText;
  file: string;
  credit: string;
  source: string;
  license: string;
  licenseUrl: string;
}

const khalaf = {
  title: { ar: 'أحمد خلف', en: 'Ahmed Khalaf' },
  credit: 'Ahmed Khalaf',
  source: 'https://github.com/nandxorandor/Athan/blob/main/LICENSE',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};
export const ADHAN_RECORDINGS: Record<AdhanVariant, Partial<Record<AdhanVoiceId, AdhanRecording>>> = {
  regular: {
    'ahmed-khalaf': { ...khalaf, file: 'ahmed-khalaf.mp3' },
    'aaqib-azeez': {
      title: { ar: 'عاقب عزيز', en: 'Aaqib Azeez' },
      credit: 'Aaqib Azeez (Atcovi)', file: 'aaqib-azeez.mp3',
      source: 'https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3',
      license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
  },
  fajr: {
    'ahmed-khalaf': { ...khalaf, file: 'ahmed-khalaf-fajr.mp3' },
    'besim-azemi-fajr': {
      title: { ar: 'بسيم عزمي · مسجد مالمو', en: 'Besim Azemi · Malmö Mosque' },
      credit: 'Besim Azemi / Islamic Center Malmö · excerpt / AAC adaptation by PrayerTime', file: 'besim-azemi-fajr.m4a',
      source: 'https://commons.wikimedia.org/wiki/File:Eid_al-Fitr_Fajr_azan_at_Malm%C3%B6_Mosque_-_19_August_2012.webm',
      license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    },
  },
};

export const adhanFileUrl = (recording: AdhanRecording): string => prayerAssetUrl(`audio/adhan/${recording.file}`);

export const MAX_ADHAN_FILE_BYTES = 12 * 1024 * 1024;
export const validAdhanFile = (file: Pick<File, 'name' | 'size' | 'type'>): boolean => file.size > 0 && file.size <= MAX_ADHAN_FILE_BYTES
  && /\.(mp3|m4a|aac|wav)$/i.test(file.name) && (!file.type || file.type === 'application/octet-stream' || file.type.startsWith('audio/') || file.type === 'video/mp4');
