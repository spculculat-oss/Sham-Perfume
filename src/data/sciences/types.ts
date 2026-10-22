/**
 * «علوم الأرض عند شاهين» — the science curriculum Shaheen studies on his own, without any AI service.
 *
 * Each lesson is a short, accurate, self-contained answer that can be served to a visitor exactly as written.
 * The curriculum is deliberately scholarly and safety-first: the tracks about medicine, nuclear science,
 * biotechnology, war and electronic warfare teach the science, the history, the law, the safety rules and the
 * defensive/medical side — never weapon design, attack recipes, targeting or instructions for harming people.
 * See SCIENCE_POLICY_AR below and SHAHEEN_SCIENCES.md.
 */
export type ScienceTrackId =
  | 'human-medicine'
  | 'veterinary'
  | 'space'
  | 'war-studies'
  | 'electronic-warfare'
  | 'nuclear'
  | 'biosafety'
  | 'semiconductors'
  | 'earth'
  | 'chemistry'
  | 'physics'
  | 'biology'
  | 'math'
  | 'computing'
  | 'nutrition'
  | 'agriculture';

export interface ScienceLesson {
  /** Stable id, also the filename-safe key used in the report. */
  id: string;
  track: ScienceTrackId;
  /** Short Arabic title; the generated wordings («اشرحلي …») are built from it. */
  titleAr: string;
  /** The question as a visitor would ask it (never carries a year, a price or personal data). */
  questionAr: string;
  /** The answer Shaheen learns and serves as-is: plain Arabic, self-contained, with its safety note when needed. */
  answerAr: string;
  /** Words that identify the lesson for the panel and the tests. */
  keywords: string[];
}

export interface ScienceTrack {
  id: ScienceTrackId;
  titleAr: string;
  titleEn: string;
  /** One line: what the track covers. */
  summaryAr: string;
  /** The hard limit of the track: what Shaheen does not teach here. */
  boundaryAr: string;
  lessons: ScienceLesson[];
}

/** The policy every science answer follows; shown in the admin panel and checked by the tests. */
export const SCIENCE_POLICY_AR =
  'العلوم هنا للفهم والوقاية والبناء: تشريح ووظائف، وطب بشري وبيطري، وفضاء مدني، ودراسات حرب والقانون الدولي الإنساني، وحرب إلكترونية دفاعية، وفيزياء نووية سلمية، وسلامة حيوية وأمن بيولوجي، وتصنيع إلكترونيات، وعلوم الأرض، وكيمياء وفيزياء وأحياء ورياضيات وحاسبات وتغذية وزراعة. مفيش هنا تصميم أسلحة أو خطوات تصنيع مواد خطرة أو وصفات هجوم أو استهداف، وأي سؤال طبي ده تعليم عام مش تشخيص ولا بديل عن الطبيب.';
