import { ENGINEERING_CONSTANTS } from '../../utils/engineeringCalculator';

interface CatalogEntry { label: string; expression: string; detail?: [string, string] }
const item = (label: string, expression: string, ar?: string, en?: string): CatalogEntry => ({ label, expression, detail: ar && en ? [ar, en] : undefined });
export const CATALOG = [
  { id: 'numeric', label: ['أعداد', 'Numeric'], entries: [
    item('π', 'π', 'باي', 'Pi'), item('e', 'e', 'عدد أويلر', 'Euler’s number'), item('|x|', 'abs(', 'قيمة مطلقة', 'Absolute value'),
    item('∛', 'cbrt(', 'جذر تكعيبي', 'Cube root'), item('ⁿ√', 'root(', 'القيمة، درجة الجذر', 'Value, root index'),
    item('logₐ', 'log(', 'القيمة، الأساس (اختياري)', 'Value, base (optional)'), item('x⁻¹', '^(-1)', 'المقلوب', 'Reciprocal'),
    item('⌊x⌋', 'floor(', 'تقريب لأسفل', 'Floor'), item('⌈x⌉', 'ceil(', 'تقريب لأعلى', 'Ceiling'), item('Round', 'round('), item('Int', 'trunc('),
    item('GCD', 'gcd(', 'أكبر قاسم مشترك', 'Greatest common divisor'), item('LCM', 'lcm(', 'أصغر مضاعف مشترك', 'Least common multiple'),
    item('RPT', 'repeat(', 'عشري دوري: البداية، أرقام الدورة. مثال repeat(0.1,6)', 'Recurring decimal: prefix and cycle digits, e.g. repeat(0.1,6)'),
    item('DMS', 'dms(', 'درجات، دقائق، ثوانٍ', 'Degrees, minutes, seconds'), item('mod', ' mod ', 'باقي القسمة', 'Remainder'), item('%', '%', 'قسمة على ١٠٠. لزيادة ١٠٪: اكتب ٢٠٠×(١+١٠٪)', 'Divide by 100. To add 10%, enter 200×(1+10%).'),
  ] },
  { id: 'trig', label: ['زوايا', 'Trig'], entries: [
    ...['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh'].map((name) => item(name, `${name}(`)),
  ] },
  { id: 'calculus', label: ['تفاضل وتكامل', 'Calculus'], entries: [
    item('∫', 'integral(', 'دالة في x، الحد الأدنى، الحد الأعلى', 'Expression in x, lower bound, upper bound'),
    item('d/dx', 'deriv(', 'دالة في x، النقطة', 'Expression in x, point'),
    item('Σ', 'sumx(', 'دالة في x، أول حد، آخر حد', 'Expression in x, first term, last term'),
    item('Π', 'prodx(', 'دالة في x، أول حد، آخر حد', 'Expression in x, first term, last term'),
    item('∫  x²', 'integral(x^2,0,1)', 'مثال: تكامل x² من ٠ إلى ١', 'Example: integrate x² from 0 to 1'),
    item('d/dx  x³', 'deriv(x^3,2)', 'مثال: مشتقة x³ عند ٢', 'Example: derivative of x³ at 2'),
  ] },
  { id: 'probability', label: ['احتمالات', 'Probability'], entries: [
    item('x!', '!', 'مضروب العدد', 'Factorial'), item('nCr', 'nCr(', 'توافيق: n، r', 'Combinations: n, r'), item('nPr', 'nPr(', 'تباديل: n، r', 'Permutations: n, r'),
    item('Rand', 'rand()', 'عشوائي من صفر إلى أقل من واحد', 'Random value in [0, 1)'), item('RandInt', 'randint(', 'عدد صحيح بين حدّين', 'Random integer between bounds'),
    item('Min', 'min('), item('Max', 'max('), item('Mean', 'avg('), item('Σ', 'sum('), item('Hypot', 'hypot('),
  ] },
  { id: 'complex', label: ['مركبة', 'Complex'], entries: [
    item('i', 'i'), item('∠', 'arg(', 'زاوية العدد المركب', 'Complex argument'), item('Conj', 'conj(', 'المرافق', 'Conjugate'),
    item('Re', 're(', 'الجزء الحقيقي', 'Real part'), item('Im', 'im(', 'الجزء التخيلي', 'Imaginary part'),
    item('rect', 'rect(', 'المقدار، الزاوية', 'Magnitude, angle'),
  ] },
  { id: 'constants', label: ['ثوابت', 'Constants'], entries: ENGINEERING_CONSTANTS.map(([name, symbol, , unit]) => item(symbol, name, `${name} · ${unit}`, `${name} · ${unit}`)) },
] as const;

export interface CalcKey { face: string; insert?: string; alt?: string; shift?: string; label?: [string, string]; action?: 'del' | 'clear' | 'format' | 'execute' | 'exponent'; tone?: 'edit' | 'operator' | 'exe' }
export const FUNCTION_KEYS: CalcKey[] = [
  { face: 'x', insert: 'x', alt: 'i', shift: 'i' },
  { face: 'ⁿ⁄ₘ', insert: '/', alt: 'x⁻¹', shift: '^(-1)', label: ['كسر', 'Fraction'] },
  { face: '√', insert: '√(', alt: '∛', shift: 'cbrt(', label: ['جذر تربيعي', 'Square root'] },
  { face: 'x²', insert: '²', alt: 'x³', shift: '³' },
  { face: 'xʸ', insert: '^', alt: 'ⁿ√', shift: 'root(' },
  { face: 'log', insert: 'log(', alt: 'ln', shift: 'ln(' },
  { face: 'Ans', insert: 'Ans', alt: '%', shift: '%' },
  { face: 'sin', insert: 'sin(', alt: 'sin⁻¹', shift: 'asin(' },
  { face: 'cos', insert: 'cos(', alt: 'cos⁻¹', shift: 'acos(' },
  { face: 'tan', insert: 'tan(', alt: 'tan⁻¹', shift: 'atan(' },
  { face: '(', insert: '(', alt: 'abs', shift: 'abs(', label: ['فتح قوس', 'Open parenthesis'] },
  { face: ')', insert: ')', alt: ',', shift: ',', label: ['إغلاق قوس', 'Close parenthesis'] },
];
export const NUMBER_KEYS: CalcKey[] = [
  { face: '7', insert: '7', alt: 'π', shift: 'π' }, { face: '8', insert: '8', alt: 'e', shift: 'e' }, { face: '9', insert: '9', alt: 'x!', shift: '!' },
  { face: 'DEL', action: 'del', tone: 'edit', label: ['حذف', 'Delete'] }, { face: 'AC', action: 'clear', tone: 'edit', label: ['مسح الكل', 'All clear'] },
  { face: '4', insert: '4' }, { face: '5', insert: '5' }, { face: '6', insert: '6' }, { face: '×', insert: '×', tone: 'operator' }, { face: '÷', insert: '÷', tone: 'operator' },
  { face: '1', insert: '1' }, { face: '2', insert: '2' }, { face: '3', insert: '3' }, { face: '+', insert: '+', tone: 'operator' }, { face: '−', insert: '−', tone: 'operator' },
  { face: '0', insert: '0' }, { face: '.', insert: '.' }, { face: '×10ˣ', action: 'exponent', alt: 'eˣ', shift: 'exp(' },
  { face: 'FORMAT', action: 'format', label: ['صيغة الناتج', 'Result format'], tone: 'operator' }, { face: 'EXE', action: 'execute', tone: 'exe', label: ['تنفيذ', 'Execute'] },
];

/** The ordinary desk keypad keeps the four operations and equals visible without SHIFT. */
export const STANDARD_KEYS: CalcKey[] = [
  { face: 'AC', action: 'clear', tone: 'edit', label: ['مسح الكل', 'All clear'] },
  { face: 'DEL', action: 'del', tone: 'edit', label: ['حذف', 'Delete'] },
  { face: 'Ans', insert: 'Ans', label: ['آخر ناتج', 'Last answer'] },
  { face: '÷', insert: '÷', tone: 'operator' },
  { face: '7', insert: '7' }, { face: '8', insert: '8' }, { face: '9', insert: '9' }, { face: '×', insert: '×', tone: 'operator' },
  { face: '4', insert: '4' }, { face: '5', insert: '5' }, { face: '6', insert: '6' }, { face: '−', insert: '−', tone: 'operator' },
  { face: '1', insert: '1' }, { face: '2', insert: '2' }, { face: '3', insert: '3' }, { face: '+', insert: '+', tone: 'operator' },
  { face: '0', insert: '0' }, { face: '.', insert: '.' }, { face: '=', action: 'execute', tone: 'exe', label: ['يساوي', 'Equals'] },
];
