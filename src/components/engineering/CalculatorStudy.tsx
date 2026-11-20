import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookOpen, Check, Lightbulb, ListOrdered, Sparkles } from 'lucide-react';
import { ApiError, isStaticHosting, requestApi } from '../../utils/api';
import { exactExpression } from '../../utils/engineeringAlgebra';
import type { EngineeringValue } from '../../utils/engineeringCalculator';
import { compareStudyAnswer, localStudyPlan, privateStudyText, readStudyPlan, readTutorReply, runStudyPlan, STUDY_QUESTION_LIMIT, type StudyAction, type StudyOutcome, type StudyPlan, type TutorReply } from '../../utils/engineeringStudy';
import { usesNativeDigits } from '../../لغات/numerals';
import { displayDigits, exactDecimalText, formatComplex } from './calculatorDisplay';
import { CalcInput, CalcSelect, DataList, optionsFor, type ModeProps } from './calculatorFields';

export const STUDY_LABELS: Record<StudyAction, [string, string]> = {
  calculate: ['احسب التعبير', 'Evaluate expression'], solve: ['حل معادلة في x', 'Solve an equation in x'],
  simplify: ['فك الأقواس وبسّط', 'Expand and simplify'], factor: ['حلّل تربيعية لعوامل نسبية', 'Factor a rational quadratic'],
  differentiate: ['اشتق متعددة حدود', 'Differentiate a polynomial'], integrate: ['هات التكامل غير المحدد لمتعددة حدود', 'Integrate a polynomial'],
};
const EXAMPLES: [string, string, string, string][] = [
  ['نسبة مئوية', 'Percentage', '١٥٪ من ٢٤٠؟', '15% of 240?'],
  ['معادلة', 'Equation', 'حل س² - ٥س + ٦ = ٠', 'Solve x^2 - 5x + 6 = 0'],
  ['تفاضل', 'Derivative', 'اشتق ٣س^٤ - ٢س + ٧', 'Differentiate 3x^4 - 2x + 7'],
  ['تكامل عددي', 'Numerical integral', 'integral(exp(-x^2),0,1)', 'integral(exp(-x^2),0,1)'],
];

export function StudyWalkthrough({ plan, outcome, props, translated, showInitially = false }: { plan: StudyPlan; outcome: StudyOutcome; props: ModeProps; translated: boolean; showInitially?: boolean }) {
  const { t, lang } = props;
  const angle = props.options.angleMode ?? 'DEG';
  const d = (s: string) => displayDigits(s, lang);
  const val = (value: EngineeringValue) => {
    if (!value.exact) return formatComplex(value, lang);
    const exact = d(exactExpression(value.exact));
    const decimal = exactDecimalText(value, lang);
    return decimal ? `${decimal} = ${exact}` : exact;
  };
  const [hint, setHint] = useState(false);
  const [solution, setSolution] = useState(showInitially);
  const [attempt, setAttempt] = useState('');
  const [feedback, setFeedback] = useState('');
  const hintText = outcome.kind === 'equation'
    ? t('انقل الحدود لطرف واحد ورتّبها بقوة س. لو المعادلة تربيعية ابدأ بالمميّز عشان تعرف نوع الجذور.', 'Move everything to one side and collect like powers of x. For a quadratic, start with the discriminant to find the type of roots.')
    : outcome.kind === 'algebra'
      ? plan.action === 'differentiate' ? t('اشتق حد حد: اضرب في الأس، ونقص الأس واحد. الثابت مشتقته صفر.', 'Use the power rule term by term: multiply by the exponent, lower it by one, and drop constants.')
        : plan.action === 'integrate' ? t('زود كل أس واحد واقسم معامل الحد على الأس الجديد. افتكر ثابت التكامل.', 'Increase each power by one and divide by the new power. Remember the constant of integration.')
          : plan.action === 'factor' ? t('دور على جذور نسبية. لو لقيت جذر r، يبقى x − r عامل.', 'Look for rational roots: a root r gives a factor x − r.')
            : t('وزّع الضرب داخل الأقواس واجمع الحدود اللي ليها نفس الأس.', 'Distribute across parentheses, then combine terms with the same exponent.')
      : plan.math.includes('%') ? t('حوّل النسبة المئوية لكسر مقامه مية قبل ما تكمل.', 'Turn the percentage into a fraction over one hundred first.')
        : t('ابدأ باللي جوّه الأقواس، بعدها القوى، وبعدها الضرب والقسمة، ثم الجمع والطرح. خليك واخد بالك من وحدة الزوايا.', 'Start inside parentheses, then powers, multiplication and division, and addition and subtraction. Check the angle unit for trig.');
  return <section className="cw-study-card cw-study-local" aria-label={t('حساب الحاسبة المحلي', 'Local calculator work')}>
    <h3><Check size={15} aria-hidden="true" />{t('المحرك المحلي حسب الصيغة', 'Formula evaluated by the local calculator')}</h3>
    <div className="cw-math-block" dir="ltr">{d(plan.math)} <small>· {angle}</small></div>
    {translated && <p>{t('الحاسبة راجعت الحساب للصيغة دي بس، مش تفسير نص المسألة.', 'This checks the math for this formula only, not the interpretation of the question.')}</p>}
    <div className="cw-study-buttons">
      <button type="button" className="cw-secondary" aria-expanded={hint} onClick={() => setHint((v) => !v)}><Lightbulb size={15} />{hint ? t('اخفي التلميح', 'Hide hint') : t('وريني تلميح', 'Show a hint')}</button>
      <button type="button" className="cw-secondary" aria-expanded={solution} onClick={() => setSolution((v) => !v)}><ListOrdered size={15} />{solution ? t('اخفي الخطوات', 'Hide steps') : t('وريني خطوات الحل', 'Show solution steps')}</button>
    </div>
    {hint && <p className="cw-study-hint">{hintText}</p>}
    {outcome.kind === 'calculation' && <details className="cw-details cw-attempt"><summary>{t('جرّب إجابتك الأول', 'Check your own answer first')}</summary>
      <CalcInput label={t('إجابتك (عدد أو كسر)', 'Your answer (number or fraction)')} value={attempt} set={(next) => { setAttempt(next); setFeedback(''); }} />
      <button type="button" className="cw-secondary" disabled={!attempt.trim()} onClick={() => {
        try {
          const comparison = compareStudyAnswer(outcome.value, attempt, angle);
          setFeedback(comparison === 'exact' ? t('إجابتك العددية مطابقة بالضبط.', 'Your numerical answer matches exactly.') : comparison === 'close'
            ? t('إجابتك العددية قريبة من نتيجة الحاسبة.', 'Your numerical answer is close to the calculator’s result.')
            : t('إجابتك مختلفة. شوف التلميح وجرّب تاني.', 'Your answer differs. Try the hint and have another go.'));
        } catch { setFeedback(t('اكتب إجابة رقمية صالحة، من غير متغيّرات مخزّنة.', 'Enter a valid numerical answer without stored variables.')); }
      }}>{t('قارن إجابتي', 'Check my answer')}</button>
      {feedback && <p role="status">{feedback}</p>}
    </details>}
    {solution && <div className="cw-study-solution">
      {outcome.kind === 'calculation' ? <>
        <p>{t('الحاسبة بتقيّم الأجزاء الأصغر الأول. علامة ≈ تعني قيمة عددية تقريبية.', 'The calculator evaluates smaller parts first. The ≈ sign marks a numerical approximation.')}</p>
        {outcome.steps.length > 0 && <ol className="cw-study-steps" dir="ltr">{outcome.steps.map((step, i) => <li key={`${i}:${step.expression}`}><code>{d(step.expression)} {step.value.exact ? '=' : '≈'} {val(step.value)}</code></li>)}</ol>}
        <DataList rows={[[t('الناتج', 'Result'), `${outcome.value.exact ? '' : '≈ '}${val(outcome.value)}`]]} />
      </> : outcome.kind === 'algebra' ? <>
        <p>{hintText}</p>
        <DataList rows={[[t('بعد فك الأقواس وتجميع الحدود', 'After expanding and collecting terms'), d(outcome.original)],
          [t('الناتج', 'Result'), outcome.changed === false ? t('مفيش تحليل نسبي تربيعي مدعوم هنا.', 'No supported rational quadratic factorization here.') : d(outcome.result)]]} />
      </> : <>
        <p>{hintText}</p>
        <DataList rows={[[t('انقل الأطراف ورتّب', 'Collect terms on one side'), `${d(outcome.solution.polynomial)} = ${d('0')}`],
          ...(outcome.solution.discriminant === undefined ? [] : [[t('احسب المميّز', 'Compute the discriminant'), d(`Δ = b² − 4ac = ${outcome.solution.discriminant}`)] as [string, string]])]} />
        {outcome.solution.kind === 'identity' ? <p>{t('الطرفين متساويين لكل قيم x.', 'The two sides agree for every x.')}</p>
          : outcome.solution.kind === 'inconsistent' ? <p>{t('مفيش قيمة تحقق المعادلة.', 'No value satisfies this equation.')}</p> : <>
            <p className="cw-math-block" dir="ltr">{outcome.solution.degree === 1 ? d('ax + b = 0 → x = −b/a')
              : outcome.solution.degree === 2 ? d('x = (−b ± √Δ)/(2a)') : t('جذور عددية، مش حل رمزي.', 'Numerical roots, not a symbolic solution.')}</p>
            <DataList rows={outcome.solution.roots.map((root, i) => [d(`x${i + 1}`), root.exact ? d(root.exact) : `≈ ${formatComplex(root.value, lang)}`])} />
          </>}
      </>}
    </div>}
  </section>;
}

type LocalWork = { id: number; plan: StudyPlan; outcome: StudyOutcome; fromAI: boolean; angle: string };
type RemoteWork = { key: string; reply?: TutorReply; error?: 'rate' | 'network'; pending?: boolean };

export function StudyMode({ initial, ...props }: ModeProps & { initial?: string }) {
  const { t, lang, options } = props;
  const angle = options.angleMode ?? 'DEG';
  const [question, setQuestion] = useState(initial ?? '');
  const [local, setLocal] = useState<LocalWork>();
  const [remote, setRemote] = useState<RemoteWork>();
  const [problem, setProblem] = useState<'unsupported' | 'private' | 'formula'>();
  const [manual, setManual] = useState<StudyPlan>({ action: 'calculate', math: '' });
  const [proposal, setProposal] = useState<StudyPlan>();
  const running = useRef<AbortController | null>(null);
  const id = useRef(0);
  const key = `${lang}:${angle}`;
  const shown = remote?.key === key ? remote : undefined;
  const blocked = privateStudyText(question);
  useEffect(() => () => { running.current?.abort(); running.current = null; }, [key]);
  const cancel = () => { running.current?.abort(); running.current = null; setRemote(undefined); };
  const edit = (text: string) => { cancel(); setQuestion(text); setLocal(undefined); setProblem(undefined); setProposal(undefined); };
  const evaluate = (possible: StudyPlan | undefined, fromAI = false) => {
    setLocal(undefined);
    const plan = readStudyPlan(possible);
    if (!plan) { setProblem(fromAI ? 'formula' : 'unsupported'); return false; }
    try {
      setLocal({ id: ++id.current, plan, outcome: runStudyPlan(plan, angle), fromAI, angle });
      setProblem(undefined);
      return true;
    } catch { setProblem(fromAI ? 'formula' : 'unsupported'); return false; }
  };
  const localSubmit = (event: FormEvent) => {
    event.preventDefault(); cancel(); setProposal(undefined);
    if (blocked) { setLocal(undefined); setProblem('private'); return; }
    evaluate(localStudyPlan(question));
  };
  const ask = async () => {
    if (!question.trim() || blocked || running.current || isStaticHosting) return;
    // Even pressing the online button does not upload a question we can handle here.
    const known = localStudyPlan(question);
    if (known && evaluate(known)) { setRemote(undefined); return; }
    setProblem(undefined); setLocal(undefined); setProposal(undefined);
    const controller = new AbortController();
    running.current = controller;
    setRemote({ key, pending: true });
    try {
      const data = await requestApi<unknown>('/api/calculator/tutor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
        signal: controller.signal, body: JSON.stringify({ question, angle, language: lang }),
      }, 15_000);
      if (controller.signal.aborted) return;
      const reply = readTutorReply(data);
      if (reply?.kind === 'local') { evaluate(reply.plan); setRemote(undefined); }
      else {
        setRemote(reply ? { key, reply } : { key, error: 'network' });
        if (reply?.kind === 'suggestion') setProposal(reply.plan);
      }
    } catch (error) { if (!controller.signal.aborted) setRemote({ key, error: error instanceof ApiError && error.status === 429 ? 'rate' : 'network' }); }
    finally { if (running.current === controller) running.current = null; }
  };
  return <div className="cw-study">
    <div className="cw-study-intro"><BookOpen size={20} aria-hidden="true" /><p>{t('ابدأ بتلميح، جرّب بنفسك، وبعدها شوف خطوات الحل. الحسابات المدعومة بتتعمل على جهازك.', 'Start with a hint, try it yourself, then reveal the steps. Supported calculations run on your device.')}</p></div>
    <form className="cw-mode-form" onSubmit={localSubmit}>
      <label className="cw-field"><span>{t('المسألة أو التعبير الرياضي', 'Problem or math expression')}</span><textarea className="cw-control cw-study-question" dir="auto" rows={3} spellCheck={false} autoComplete="off" maxLength={STUDY_QUESTION_LIMIT}
        value={question} onChange={(event) => edit(event.target.value)} placeholder={t('مثال: حل س² − ٥س + ٦ = ٠', 'Example: Solve x^2 − 5x + 6 = 0')} /></label>
      <div className="cw-chip-list" aria-label={t('أمثلة', 'Examples')}>{EXAMPLES.map(([ar, en, qa, qe]) => <button type="button" key={en} onClick={() => edit(t(qa, qe))}>{t(ar, en)}</button>)}</div>
      <button type="submit" className="cw-action" disabled={!question.trim()}>{t('ابدأ الحل محليًا', 'Work it out locally')}<span dir="ltr">EXE</span></button>
    </form>
    <div className="cw-study-online">
      <button type="button" className="cw-secondary" disabled={!question.trim() || blocked || shown?.pending || isStaticHosting} onClick={() => { void ask(); }}><Sparkles size={15} />{t('اطلب تلميح من شاهين', 'Ask Shaheen for a hint')}</button>
      {shown?.pending && <><span role="status">{t('شاهين بيراجع سؤالك…', 'Shaheen is reviewing the question…')}</span><button type="button" className="cw-secondary" onClick={cancel}>{t('إلغاء', 'Cancel')}</button></>}
      <p>{t('للمسائل المكتوبة بالكلام. الضغط يرسل نص السؤال لخدمة الشرح لو الحساب المحلي مش قادر يفهمه. ما تكتبش اسمك أو بيانات شخصية.', 'For word problems. This sends the question to the tutoring service only if the local calculator cannot handle it. Don’t include a name or personal details.')}</p>
      {isStaticHosting && <p>{t('الشرح أونلاين مش متاح في النسخة دي. الحساب المحلي شغال.', 'Online hints are unavailable in this build. Local calculation still works.')}</p>}
    </div>
    {(blocked || problem === 'private') && <p className="cw-form-error" role="alert">{t('شيل أي رابط أو بيانات شخصية وخلي نص المسألة بس.', 'Remove any links or personal information and keep only the problem.')}</p>}
    {!blocked && problem && problem !== 'private' && <p className="cw-form-error" role="alert">{problem === 'formula'
      ? t('الصيغة دي مش مدعومة أو نتيجتها غير معرّفة. عدّلها قبل ما تعتمد عليها.', 'This formula is unsupported or undefined. Edit it before relying on it.')
      : t('الحاسبة ماقدرتش تحل النص ده محليًا. اكتب الصيغة بنفسك أو اطلب تلميح من شاهين.', 'The local calculator could not solve this text. Enter the formula yourself or ask Shaheen for a hint.')}</p>}
    {(shown?.error || shown?.reply?.kind === 'unavailable') && <p className="cw-form-error" role="status">{shown.error === 'rate'
      ? t('وصلت لحد الطلبات. جرّب كمان دقيقة أو كمّل بالحساب المحلي.', 'Too many requests. Try again in a minute or continue locally.')
      : t('شاهين مش متاح دلوقتي. تقدر تكتب الصيغة بنفسك وتتحقق منها محليًا.', 'Shaheen is unavailable right now. You can enter a formula and work it out locally.')}</p>}
    {shown?.reply?.kind === 'suggestion' && <section className="cw-study-card cw-study-ai" aria-label={t('اقتراح شاهين غير متحقق', 'Unverified Shaheen suggestion')}>
      <h3><Sparkles size={15} />{t('اقتراح شاهين · مش متحقق', 'Shaheen suggestion · unverified')}</h3>
      <p className="cw-study-hint" dir="auto">{displayDigits(shown.reply.hint, lang)}</p>
      {proposal ? <>
        <p>{t('راجع إن الصيغة مطابقة للمسألة، وعدّلها لو محتاجة. الحساب المحلي مش دليل إن شاهين فهم السؤال صح.', 'Check the suggested formula against your question and edit it if needed. A local calculation cannot prove the question was interpreted correctly.')}</p>
        <CalcSelect label={t('طريقة الحل المقترحة', 'Suggested action')} value={proposal.action} set={(action) => { setProposal({ ...proposal, action }); setLocal(undefined); setProblem(undefined); }} items={optionsFor(STUDY_LABELS, t)} />
        <CalcInput label={t('الصيغة المقترحة', 'Suggested formula')} value={usesNativeDigits(lang) ? displayDigits(proposal.math, lang) : proposal.math} set={(math) => { setProposal({ ...proposal, math }); setLocal(undefined); setProblem(undefined); }} />
        <button type="button" className="cw-secondary" onClick={() => evaluate(proposal, true)}>{t('احسب الصيغة دي محليًا', 'Evaluate this formula locally')}</button>
      </> : <p>{t('شاهين ماقدّمش صيغة تدعمها الحاسبة. التلميح مش نتيجة حساب متحققة.', 'No supported formula was supplied. The hint is not a checked calculation.')}</p>}
    </section>}
    <details className="cw-details cw-manual"><summary>{t('اكتب الصيغة بإيدك', 'Enter a formula manually')}</summary>
      <form className="cw-mode-form" onSubmit={(event) => { event.preventDefault(); cancel(); evaluate(manual); }}>
        <CalcSelect label={t('نوع العملية', 'Math action')} value={manual.action} set={(action) => setManual({ ...manual, action })} items={optionsFor(STUDY_LABELS, t)} />
        <CalcInput label={t('الصيغة اليدوية', 'Manual formula')} value={manual.math} set={(math) => setManual({ ...manual, math })} placeholder="(x+2)^2" />
        <button type="submit" className="cw-secondary" disabled={!manual.math.trim()}>{t('احسب الصيغة على الجهاز', 'Evaluate entered formula')}</button>
      </form>
    </details>
    {local?.angle === angle && <StudyWalkthrough key={local.id} plan={local.plan} outcome={local.outcome} props={props} translated={local.fromAI} />}
  </div>;
}
