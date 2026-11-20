import { useState } from 'react';
import { amortizeLoan, bondPrice, breakEven, cashFlowAnalysis, countCalendarDays, depreciation, effectiveRate, simpleInterest, timeValue } from '../../utils/engineeringFinance';
import { engineeringPercentField, splitEngineeringValues } from '../../utils/engineeringInput';
import { engineeringSequence } from '../../utils/engineeringGraph';
import { runStudyPlan, type StudyAction, type StudyPlan } from '../../utils/engineeringStudy';
import { displayDigits, displayNumber } from './calculatorDisplay';
import { CalcInput, CalcSelect, DataList, ModeForm, ResultTable, nfmt, num, optionsFor, type ModeProps } from './calculatorFields';
import { STUDY_LABELS, StudyWalkthrough } from './CalculatorStudy';

export function AlgebraMode(props: ModeProps) {
  const { lang, t, options } = props;
  const [action, setAction] = useState<Exclude<StudyAction, 'calculate'>>('simplify');
  const [text, setText] = useState('(x+2)*(x-3)');
  const examples: Record<typeof action, string> = { simplify: '(x+2)*(x-3)', factor: 'x^2-x-6', solve: 'x^2-5x+6=0', differentiate: '3*x^4-2*x+7', integrate: 'x^2+3*x-2' };
  return <ModeForm t={t} revision={lang} action={t('اعمل العملية الرمزية', 'Run algebra')}
    note={t('لمتعددات الحدود في x بمعاملات نسبية. الحل لحد الدرجة الرابعة، والتحليل لتربيعيات بعوامل نسبية. باقي العمليات لحد الدرجة ١٢ في المدخل.', 'Rational polynomial input in x through degree 12. Equations through degree four; factorization for quadratics with rational factors.')}
    run={() => {
      const plan: StudyPlan = { action, math: text };
      const outcome = runStudyPlan(plan, options.angleMode);
      return <StudyWalkthrough plan={plan} outcome={outcome} props={props} translated={false} showInitially />;
    }}>
    <CalcSelect label={t('عملية الجبر', 'Algebra action')} value={action} set={(next) => { setAction(next); setText(examples[next]); }} items={optionsFor<Exclude<StudyAction, 'calculate'>>({ simplify: STUDY_LABELS.simplify, factor: STUDY_LABELS.factor,
      solve: STUDY_LABELS.solve, differentiate: STUDY_LABELS.differentiate, integrate: STUDY_LABELS.integrate }, t)} />
    <CalcInput label={action === 'solve' ? t('المعادلة في x', 'Equation in x') : t('التعبير في x', 'Expression in x')} value={text} set={setText} />
  </ModeForm>;
}

const SEQUENCES = { explicit: ['حد مباشر aₙ', 'Explicit aₙ'], first: ['تكرار من الحد اللي قبله', 'First-order recurrence'], second: ['تكرار من حدّين قبله', 'Second-order recurrence'] } satisfies Record<string, [string, string]>;
type SequenceKind = keyof typeof SEQUENCES;
export function SequenceMode(props: ModeProps) {
  const { lang, t, options } = props;
  const [kind, setKind] = useState<SequenceKind>('explicit');
  const [text, setText] = useState('n^2');
  const [count, setCount] = useState('12');
  const [first, setFirst] = useState('1');
  const [second, setSecond] = useState('1');
  return <ModeForm t={t} revision={`${lang}:${options.angleMode}`} action={t('كوّن المتتالية', 'Generate sequence')}
    note={t('الفهرس n بيبدأ من ١؛ y الحد السابق وz اللي قبله. استخدم لحد ١٠٠ حد.', 'Index n starts at 1; y is the previous term and z the one before that. Up to 100 terms.')}
    run={() => {
      const values = engineeringSequence(text, kind, num(count, props), kind === 'explicit' ? 0 : num(first, props), kind === 'second' ? num(second, props) : 0, options);
      const min = Math.min(...values), max = Math.max(...values);
      const x = (i: number) => 13 + 255 * i / Math.max(1, values.length - 1);
      const y = (v: number) => min === max ? 49 : 85 - 71 * ((v / 2 - min / 2) / (max / 2 - min / 2));
      return <>
        <svg className="cw-plot" viewBox="0 0 282 99" role="img" aria-label={t('نقاط المتتالية', 'Sequence points')}>
          <rect className="cw-plot-bg" width="282" height="99" rx="6" />
          <path className="cw-plot-grid-line" d="M13 85H268 M13 14H268" />
          <polyline className="cw-plot-line" stroke="#126854" points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
          {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.1" fill="#126854" />)}
        </svg>
        <ResultTable headers={['n', 'aₙ']} rows={values.map((value, i) => [nfmt(i + 1, props), nfmt(value, props)])} />
      </>;
    }}>
    <CalcSelect label={t('نوع المتتالية', 'Sequence type')} value={kind} set={(next) => { setKind(next); setText(next === 'explicit' ? 'n^2' : next === 'first' ? '2*y' : 'y+z'); }} items={optionsFor(SEQUENCES, t)} />
    <CalcInput label={t('صيغة الحد', 'Term formula')} value={text} set={setText} />
    <div className="cw-form-grid"><CalcInput label={t('عدد الحدود', 'Terms')} value={count} set={setCount} />
      {kind !== 'explicit' && <CalcInput label={displayDigits('a1', lang)} value={first} set={setFirst} />}
      {kind === 'second' && <CalcInput label={displayDigits('a2', lang)} value={second} set={setSecond} />}
    </div>
  </ModeForm>;
}

const FINANCE = {
  simple: ['فائدة بسيطة', 'Simple interest'], tvm: ['القيمة الزمنية للنقود', 'Time value of money'], effective: ['الفائدة السنوية الفعلية', 'Effective annual rate'],
  loan: ['جدول سداد قرض', 'Loan amortization'], cash: ['تدفقات نقدية · NPV / IRR', 'Cash flow · NPV / IRR'], bond: ['سعر سند نظري', 'Theoretical bond price'],
  depreciation: ['إهلاك أصل', 'Depreciation'], breakEven: ['نقطة التعادل', 'Break-even'], days: ['الفرق بين تاريخين', 'Calendar day difference'],
} satisfies Record<string, [string, string]>;
type FinanceKind = keyof typeof FINANCE;
type Timing = 'end' | 'begin';
type TVM = 'future' | 'present' | 'payment';
const FIELD = {
  principal: ['المبلغ الأولي', 'Principal'], rate: ['معدل الفترة (%)', 'Periodic rate (%)'], duration: ['مدة بنفس وحدة الفترة', 'Duration in matching periods'],
  annual: ['المعدل السنوي الاسمي (%)', 'Nominal annual rate (%)'], periods: ['عدد الفترات', 'Number of periods'], frequency: ['مرات التركيب في السنة', 'Compounding periods per year'],
  months: ['عدد الشهور', 'Number of months'], future: ['القيمة المستقبلية', 'Future value'], payment: ['الدفعة الدورية', 'Periodic payment'],
  flows: ['التدفقات بدايةً من الوقت صفر', 'Cash flows starting at time zero'], discount: ['معدل الخصم لكل فترة (%)', 'Discount per period (%)'],
  face: ['القيمة الاسمية للسند', 'Face value'], coupon: ['الكوبون السنوي (%)', 'Annual coupon (%)'], yield: ['عائد السند السنوي الاسمي (%)', 'Nominal annual yield (%)'], coupons: ['دفعات الكوبون في السنة', 'Coupons per year'],
  cost: ['التكلفة الأصلية', 'Original cost'], salvage: ['القيمة المتبقية', 'Salvage value'], life: ['عمر الأصل بالسنوات', 'Useful life in years'], year: ['السنة المطلوبة', 'Year to evaluate'], decline: ['معدل الإهلاك السنوي (%)', 'Annual declining rate (%)'],
  fixed: ['تكلفة ثابتة', 'Fixed cost'], price: ['سعر بيع الوحدة', 'Selling price per unit'], variable: ['تكلفة متغيرة للوحدة', 'Variable cost per unit'],
  from: ['من تاريخ (سنة-شهر-يوم)', 'From date (year-month-day)'], to: ['إلى تاريخ (سنة-شهر-يوم)', 'To date (year-month-day)'],
} satisfies Record<string, [string, string]>;
type Field = keyof typeof FIELD;
const START: Record<Field, string> = { principal: '10000', rate: '1', duration: '12', annual: '6', periods: '36', frequency: '12', months: '12', future: '15000', payment: '100',
  flows: '-1000 400 400 400', discount: '5', face: '1000', coupon: '5', yield: '6', coupons: '2', cost: '8000', salvage: '800', life: '5', year: '1', decline: '20',
  fixed: '1000', price: '40', variable: '15', from: '2024-02-28', to: '2024-03-01' };
const coreFields: Record<FinanceKind, Field[]> = { simple: ['principal', 'rate', 'duration'], tvm: [], effective: ['annual', 'frequency'], loan: ['principal', 'annual', 'months'], cash: ['flows', 'discount'],
  bond: ['face', 'coupon', 'yield', 'coupons', 'periods'], depreciation: ['cost', 'salvage', 'life', 'year'], breakEven: ['fixed', 'price', 'variable'], days: ['from', 'to'] };
const FINANCE_NOTES: Record<FinanceKind, [string, string]> = {
  simple: ['معدل ومدة بنفس الوحدة؛ من غير تركيب أو رسوم.', 'Use matching time units for rate and duration. No compounding or fees.'],
  tvm: ['دفعات ثابتة، ومعدل ثابت لكل فترة. الإشارة بتحدد اتجاه المبلغ: زيادة أو سحب.', 'Constant payments and rate per period. Use the sign to distinguish deposits from withdrawals.'],
  effective: ['النتيجة بافتراض ثبات المعدل والتركيب طوال سنة.', 'Assumes a constant rate and compounding schedule over a year.'],
  loan: ['المعدل الاسمي ÷ ١٢، والسداد آخر الشهر. من غير رسوم أو تقريب لأصغر وحدة نقدية.', 'Nominal rate divided by 12, month-end payments. No fees or currency rounding.'],
  cash: ['افصل الأرقام بمسافات، واكتب صفر للفترة من غير تدفّق. IRR وفترة الاسترداد البسيطة تظهر لو التدفق الأول سالب والباقي غير سالب، وفيه حل داخل النطاق.', 'Separate values with spaces; use an explicit 0 for a period without cash flow. IRR and simple payback are only shown for conventional flows and when a result is found in the search range.'],
  bond: ['عدد فترات الكوبون المتبقية. السعر في تاريخ دفعة كوبون، بدون فائدة مستحقة أو ضرائب.', 'Use the number of remaining coupon periods. Prices at a coupon date; no accrued interest or taxes.'],
  depreciation: ['اختار طريقة الإهلاك. قيمة الدفتر لا تقل عن القيمة المتبقية.', 'Choose a method. Book value is floored at the salvage value.'],
  breakEven: ['نموذج ثابت: سعر وتكلفة للوحدة مش بيتغيروا مع الكمية.', 'Uses a fixed price and variable cost per unit.'],
  days: ['فرق التقويم الميلادي بالأيام، مش قاعدة ٣٠/٣٦٠ أو عدد أيام العمل.', 'Actual Gregorian calendar days, not a 30/360 convention or business days.'],
};

export function FinanceMode(props: ModeProps) {
  const { t, lang, options } = props;
  const [kind, setKind] = useState<FinanceKind>('tvm');
  const [values, setValues] = useState<Record<FinanceKind, Partial<Record<Field, string>>>>({ simple: {}, tvm: {}, effective: {}, loan: {}, cash: {}, bond: {}, depreciation: {}, breakEven: {}, days: {} });
  const [timing, setTiming] = useState<Timing>('end');
  const [tvm, setTvm] = useState<TVM>('future');
  const [method, setMethod] = useState<'line' | 'decline'>('line');
  const text = (id: Field) => values[kind][id] ?? START[id];
  const n = (id: Field) => num(text(id), props);
  const pct = (id: Field) => engineeringPercentField(text(id), options);
  const fmt = (n: number) => nfmt(n, props);
  const amount = (label: string, value: number) => <DataList rows={[[label, fmt(value)]]} />;
  const percentage = (v?: number) => v === undefined ? '—' : `${displayNumber(v * 100, lang)}%`;
  const fields: Field[] = kind === 'tvm' ? [...(tvm !== 'present' ? ['principal' as const] : []), ...(tvm !== 'future' ? ['future' as const] : []), ...(tvm !== 'payment' ? ['payment' as const] : []), 'rate', 'periods']
    : kind === 'depreciation' && method === 'decline' ? [...coreFields[kind], 'decline'] : coreFields[kind];
  return <ModeForm t={t} revision={`${lang}:${kind}:${options.angleMode}`} note={`${t(...FINANCE_NOTES[kind])} ${t('للتعلّم، مش تسعير أو نصيحة مالية.', 'For learning, not a quote or financial advice.')}`} run={() => {
    switch (kind) {
      case 'simple': { const output = simpleInterest(n('principal'), pct('rate'), n('duration')); return <DataList rows={[[t('الفائدة', 'Interest'), fmt(output.interest)], [t('الإجمالي', 'Balance'), fmt(output.total)]]} />; }
      case 'tvm': return amount(tvm === 'future' ? t('القيمة المستقبلية', 'Future value') : tvm === 'present' ? t('القيمة الحالية', 'Present value') : t('الدفعة المطلوبة', 'Required payment'),
        timeValue(tvm, tvm === 'present' ? 0 : n('principal'), tvm === 'payment' ? 0 : n('payment'), tvm === 'future' ? 0 : n('future'), pct('rate'), n('periods'), timing === 'begin'));
      case 'effective': return <DataList rows={[[t('معدل سنوي فعلي', 'Effective annual rate'), percentage(effectiveRate(pct('annual'), n('frequency')))]]} />;
      case 'loan': {
        const output = amortizeLoan(n('principal'), pct('annual'), n('months'));
        return <><DataList rows={[[t('القسط الشهري', 'Monthly payment'), fmt(output.payment)], [t('إجمالي الفائدة', 'Total interest'), fmt(output.totalInterest)], [t('إجمالي السداد', 'Total repaid'), fmt(output.totalPaid)]]} />
          <details className="cw-details"><summary>{t('جدول السداد الشهري', 'Monthly schedule')}</summary>
            <ResultTable headers={[t('شهر', 'Month'), t('دفعة', 'Payment'), t('الأصل', 'Principal'), t('فائدة', 'Interest'), t('رصيد', 'Balance')]} rows={output.rows.map(({ month, payment, principal, interest, balance }) => [month, payment, principal, interest, balance].map(fmt))} />
          </details></>;
      }
      case 'cash': {
        const flows = splitEngineeringValues(text('flows'), 201).map((v) => num(v, props));
        const output = cashFlowAnalysis(flows, pct('discount'));
        return <DataList rows={[[t('صافي القيمة الحالية', 'Net present value'), fmt(output.npv)], [t('عائد داخلي لكل فترة', 'Internal rate per period'), percentage(output.irr)],
          [t('الاسترداد البسيط (فترات)', 'Simple payback (periods)'), output.payback === undefined ? '—' : fmt(output.payback)]]} />;
      }
      case 'bond': return amount(t('سعر السند النظري', 'Theoretical price'), bondPrice(n('face'), pct('coupon'), pct('yield'), n('coupons'), n('periods')));
      case 'depreciation': {
        const output = depreciation(n('cost'), n('salvage'), n('life'), n('year'), method === 'decline' ? pct('decline') : undefined);
        return <DataList rows={[[t('مصروف إهلاك السنة', 'Year’s depreciation'), fmt(output.expense)], [t('القيمة الدفترية', 'Book value'), fmt(output.bookValue)]]} />;
      }
      case 'breakEven': {
        const output = breakEven(n('fixed'), n('price'), n('variable'));
        return <DataList rows={[[t('كمية التعادل', 'Break-even quantity'), fmt(output.units)], [t('أقل عدد وحدات كاملة', 'Minimum whole units'), fmt(output.wholeUnits)],
          [t('إيراد التعادل', 'Break-even revenue'), fmt(output.revenue)], [t('نسبة هامش المساهمة', 'Contribution margin ratio'), percentage(output.margin)]]} />;
      }
      case 'days': return amount(t('فرق الأيام', 'Calendar days'), countCalendarDays(text('from'), text('to')));
    }
  }}>
    <CalcSelect label={t('نوع الحساب المالي', 'Finance tool')} value={kind} set={setKind} items={optionsFor(FINANCE, t)} />
    {kind === 'tvm' && <div className="cw-form-grid">
      <CalcSelect label={t('المجهول', 'Find')} value={tvm} set={setTvm} items={[[ 'future', t('قيمة مستقبلية', 'Future value')], ['present', t('قيمة حالية', 'Present value')], ['payment', t('دفعة', 'Payment')]]} />
      <CalcSelect label={t('توقيت الدفعة', 'Payment timing')} value={timing} set={setTiming} items={[[ 'end', t('آخر الفترة', 'End of period')], ['begin', t('أول الفترة', 'Start of period')]]} />
    </div>}
    {kind === 'depreciation' && <CalcSelect label={t('طريقة الإهلاك', 'Depreciation method')} value={method} set={setMethod} items={[[ 'line', t('قسط ثابت', 'Straight line')], ['decline', t('رصيد متناقص', 'Declining balance')]]} />}
    {fields.includes('flows') && <CalcInput label={t(...FIELD.flows)} value={text('flows')} set={(v) => setValues({ ...values, [kind]: { ...values[kind], flows: v } })} area max={1700} />}
    <div className="cw-form-grid">{fields.filter((id) => id !== 'flows').map((id) => <CalcInput key={id} label={t(...FIELD[id])} value={text(id)} set={(v) => setValues({ ...values, [kind]: { ...values[kind], [id]: v } })} />)}</div>
  </ModeForm>;
}
