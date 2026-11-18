import { KB, SEMEN_PREP } from './kb'
import type { L10n, Sex } from './types'

/**
 * Reviewed notes: the only material the AI may answer questions from. Short, plain, sourced, written by the
 * team from the cited guidelines and studies (no guideline text is copied in). When no note fits a question,
 * the AI must say it has no reviewed answer and point to the family doctor.
 */
export interface Note {
  id: string
  q: L10n
  a: L10n
  sources: string[]
  /** Extra words that should find this note, in both languages. */
  keys: string[]
  /** Written for this sex only (about sperm, or about eggs and cycles). Notes without it are for everyone. */
  sex?: Sex
}

const MORE: Note[] = [
  {
    id: 'heat_work',
    sex: 'male',
    q: { en: 'Does working in the heat affect sperm?', ar: 'هل يؤثر العمل في الحرارة على الحيوانات المنوية؟' },
    a: {
      en: 'It can. Sperm are made best a little below body temperature. Regular strong heat at work, long hot drives, saunas and hot tubs can lower sperm quality, and it usually recovers within a few months once the heat is reduced. Cool breaks in the shade, loose cotton underwear and plenty of water help. In the UAE, work in direct sun is not allowed from 12:30 to 3:00 pm between 15 June and 15 September.',
      ar: 'قد يؤثر. تُنتَج الحيوانات المنوية بأفضل شكل عند حرارة أقل قليلاً من حرارة الجسم. قد تُضعف الحرارة الشديدة المنتظمة في العمل والقيادة الطويلة في الحر والسونا والأحواض الساخنة جودتها، وعادةً ما تتحسن خلال بضعة أشهر بعد تقليل الحرارة. تساعد فترات الراحة الباردة في الظل والملابس الداخلية القطنية الفضفاضة وشرب الكثير من الماء. وفي الإمارات لا يُسمح بالعمل تحت أشعة الشمس المباشرة من 12:30 إلى 3:00 عصراً بين 15 يونيو و15 سبتمبر.',
    },
    sources: ['HEAT_REVIEW', 'DRIVERS_HEAT', 'MIDDAY_BREAK'],
    keys: ['heat', 'hot', 'sun', 'outdoor', 'summer', 'sauna', 'temperature', 'site', 'construction', 'حرارة', 'حر', 'الحر', 'شمس', 'صيف', 'سونا', 'الخارج', 'موقع'],
  },
  {
    id: 'tobacco',
    sex: 'male',
    q: { en: 'Is shisha, medwakh or vaping safer than cigarettes?', ar: 'هل الشيشة أو المدواخ أو السجائر الإلكترونية أكثر أماناً من السجائر؟' },
    a: {
      en: 'No form of tobacco or nicotine is known to be safe for sperm or for the heart. Studies of smokers find lower sperm count, movement and shape. Stopping helps both, and the benefit for sperm shows after a few months. Your family doctor can help you quit.',
      ar: 'لا يُعرف أي شكل من التبغ أو النيكوتين بأنه آمن للحيوانات المنوية أو للقلب. تجد الدراسات لدى المدخنين انخفاضاً في عدد الحيوانات المنوية وحركتها وشكلها. الإقلاع يفيد الاثنين، ويظهر أثره على الحيوانات المنوية بعد بضعة أشهر. ويستطيع طبيب الأسرة مساعدتك على الإقلاع.',
    },
    sources: ['SMOKING'],
    keys: ['shisha', 'smoke', 'smoking', 'cigarette', 'vape', 'nicotine', 'medwakh', 'tobacco', 'quit', 'شيشة', 'الشيشة', 'تدخين', 'سجائر', 'مدواخ', 'نيكوتين', 'تبغ', 'إقلاع'],
  },
  {
    id: 'weight',
    sex: 'male',
    q: { en: 'Will losing weight help?', ar: 'هل سيفيد إنقاص الوزن؟' },
    a: {
      en: 'If your weight is above the healthy range, losing some helps your heart, blood pressure and blood sugar. In a trial of men with obesity, sperm counts rose after weight loss and stayed higher in men who kept the weight off. Steady change with more activity and better food works better than crash diets.',
      ar: 'إذا كان وزنك أعلى من المعدل الصحي، فإن إنقاص بعضه يفيد قلبك وضغط دمك وسكر دمك. وفي تجربة على رجال يعانون من السمنة، ارتفع عدد الحيوانات المنوية بعد إنقاص الوزن وبقي أعلى لدى من حافظوا عليه. التغيير الثابت مع نشاط أكثر وطعام أفضل أنجح من الحميات القاسية.',
    },
    sources: ['BMI_SPERM'],
    keys: ['weight', 'obese', 'obesity', 'diet', 'bmi', 'fat', 'lose', 'وزن', 'الوزن', 'سمنة', 'رجيم', 'حمية', 'إنقاص'],
  },
  {
    id: 'steroids',
    sex: 'male',
    q: { en: 'I use testosterone or steroids for the gym. What should I know?', ar: 'أستخدم التستوستيرون أو الستيرويدات للنادي الرياضي. ماذا يجب أن أعرف؟' },
    a: {
      en: 'Testosterone and anabolic steroids taken from outside tell the testes to stop making sperm, and counts can fall very low. Production usually recovers after stopping, but it can take months, and stopping suddenly can make you feel unwell. Talk to a men’s health specialist before stopping, so they can plan it with you.',
      ar: 'يجعل التستوستيرون والستيرويدات البنائية المأخوذة من الخارج الخصيتين تتوقفان عن إنتاج الحيوانات المنوية، وقد ينخفض عددها كثيراً. يعود الإنتاج عادةً بعد التوقف، لكن قد يستغرق ذلك أشهراً، وقد يسبب التوقف المفاجئ شعوراً بالتوعك. تحدّث مع أخصائي صحة الرجل قبل التوقف ليخطط لذلك معك.',
    },
    sources: ['AUA_T2018', 'AUA2020'],
    keys: ['steroid', 'steroids', 'testosterone', 'gym', 'sarms', 'trt', 'bodybuilding', 'ستيرويد', 'ستيرويدات', 'تستوستيرون', 'النادي', 'جيم', 'هرمون'],
  },
  {
    id: 'low_result',
    sex: 'male',
    q: { en: 'My semen analysis was below the normal range. Am I infertile?', ar: 'كانت نتيجة تحليل السائل المنوي أقل من المعدل الطبيعي. هل أنا عقيم؟' },
    a: {
      en: 'One result does not mean that. Results vary a lot from one sample to the next, so doctors repeat the test, usually about 3 months later, and look at both partners together. Many causes are treatable, and many men with a low result still father children.',
      ar: 'نتيجة واحدة لا تعني ذلك. تتفاوت النتائج كثيراً من عينة لأخرى، لذا يعيد الأطباء التحليل عادةً بعد نحو 3 أشهر، وينظرون إلى الشريكين معاً. كثير من الأسباب قابل للعلاج، وكثير من الرجال ذوي النتائج المنخفضة يُنجبون.',
    },
    sources: ['SEMEN_VARIABILITY', 'WHO2021'],
    keys: ['infertile', 'low', 'result', 'results', 'count', 'sterile', 'normal', 'below', 'عقيم', 'منخفض', 'نتيجة', 'النتيجة', 'عدد', 'تحليل'],
  },
  {
    id: 'when_to_see',
    sex: 'male',
    q: { en: 'When should we see a doctor about getting pregnant?', ar: 'متى يجب أن نراجع الطبيب بشأن الحمل؟' },
    a: {
      en: 'After 12 months of trying without success, or after 6 months if the woman is 35 or older. Go sooner if you know of a reason, such as past testicular surgery, cancer treatment, or symptoms that worry you. Both partners should be checked.',
      ar: 'بعد 12 شهراً من المحاولة دون نجاح، أو بعد 6 أشهر إذا كان عمر المرأة 35 عاماً أو أكثر. وراجعا في وقت أبكر إن كان هناك سبب معروف، مثل جراحة سابقة في الخصية أو علاج للسرطان أو أعراض مقلقة. ويجب فحص الشريكين معاً.',
    },
    sources: ['NICE_CG156', 'AUA2020'],
    keys: ['pregnant', 'pregnancy', 'trying', 'months', 'year', 'conceive', 'baby', 'when', 'حمل', 'الحمل', 'إنجاب', 'نحاول', 'متى', 'طفل'],
  },
  {
    id: 'sleep',
    sex: 'male',
    q: { en: 'Does sleep matter for fertility?', ar: 'هل يهم النوم للخصوبة؟' },
    a: {
      en: 'It seems to. Studies link short or disturbed sleep and night shifts with poorer semen quality, and short sleep also affects weight and blood pressure. About 7 hours a night, at regular times, is a sensible aim.',
      ar: 'يبدو ذلك. تربط الدراسات النوم القصير أو المضطرب والمناوبات الليلية بانخفاض جودة السائل المنوي، كما يؤثر النوم القصير على الوزن وضغط الدم. النوم نحو 7 ساعات ليلاً في مواعيد منتظمة هدف معقول.',
    },
    sources: ['SHIFT_SLEEP'],
    keys: ['sleep', 'night', 'shift', 'shifts', 'tired', 'insomnia', 'نوم', 'النوم', 'مناوبة', 'ليلية', 'سهر', 'أرق'],
  },
  {
    id: 'ifhas',
    q: { en: 'What is IFHAS, and can I use it?', ar: 'ما هو «إفحص»، وهل يمكنني الاستفادة منه؟' },
    a: {
      en: 'IFHAS is Abu Dhabi’s screening programme for Thiqa card holders aged 18 to 75, usually every 3 years. It checks the heart, blood sugar, common cancers and more, and since 2025 it also includes reproductive health screening for ages 20 to 35. You can book it in the Sahatna app or with an approved provider.',
      ar: '«إفحص» هو برنامج الفحص في أبوظبي لحاملي بطاقة «ثقة» من 18 إلى 75 عاماً، عادةً كل 3 سنوات. يفحص القلب وسكر الدم والسرطانات الشائعة وغيرها، ويشمل منذ 2025 أيضاً فحص الصحة الإنجابية للفئة العمرية 20-35. ويمكنك حجزه عبر تطبيق «صحتنا» أو لدى مقدم خدمة معتمد.',
    },
    sources: ['IFHAS'],
    keys: ['ifhas', 'screening', 'thiqa', 'check', 'checkup', 'sahatna', 'إفحص', 'فحص', 'ثقة', 'صحتنا', 'الفحص'],
  },
  {
    id: 'teleconsult',
    q: { en: 'Can I start with a video consultation?', ar: 'هل يمكنني البدء باستشارة بالفيديو؟' },
    a: {
      en: 'Yes. A family doctor can go through your result by video, order tests and refer you on. An examination in person may still be needed later. In Wiqaya you can send your summary with a request for a video call, and the doctor’s reply comes back to your phone.',
      ar: 'نعم. يستطيع طبيب الأسرة مناقشة نتيجتك بالفيديو وطلب التحاليل وتحويلك. وقد يلزم فحص حضوري لاحقاً. وفي «وقاية» يمكنك إرسال ملخصك مع طلب مكالمة فيديو، ويعود ردّ الطبيب إلى هاتفك.',
    },
    sources: [],
    keys: ['video', 'online', 'tele', 'teleconsultation', 'remote', 'call', 'فيديو', 'عن بعد', 'أونلاين', 'استشارة', 'مكالمة'],
  },
  {
    id: 'lens',
    sex: 'male',
    q: { en: 'What is the Lens home check?', ar: 'ما هو فحص العدسة المنزلي؟' },
    a: {
      en: 'It is a research prototype. From a short microscope video taken with a phone, it estimates how many sperm are moving. It is not a lab test. If the estimate is low, the next step is a lab semen analysis; if it looks normal, it still cannot rule a problem out.',
      ar: 'هو نموذج بحثي أولي. من فيديو قصير بالمجهر يُصوَّر بالهاتف، يقدّر عدد الحيوانات المنوية المتحركة. وهو ليس تحليلاً مخبرياً. إذا كان التقدير منخفضاً فالخطوة التالية تحليل مخبري للسائل المنوي، وإذا بدا طبيعياً فلا يستطيع مع ذلك استبعاد وجود مشكلة.',
    },
    sources: ['HOME_SPERM_TESTS'],
    keys: ['lens', 'home', 'microscope', 'phone', 'video', 'estimate', 'kit', 'العدسة', 'منزلي', 'مجهر', 'تقدير', 'المنزل'],
  },
  {
    id: 'link_privacy',
    q: { en: 'Who can read the summary I send to my doctor?', ar: 'من يستطيع قراءة الملخص الذي أرسله إلى طبيبي؟' },
    a: {
      en: 'Only someone with your private link or QR code. Your phone locks the summary before it is stored, so our server cannot read it. It deletes itself after 1 or 7 days, and you can withdraw it at any time.',
      ar: 'فقط من يملك رابطك الخاص أو رمز QR. يقفل هاتفك الملخص قبل حفظه، فلا يستطيع خادمنا قراءته. ويُحذف تلقائياً بعد يوم أو 7 أيام، ويمكنك سحبه في أي وقت.',
    },
    sources: [],
    keys: ['privacy', 'link', 'share', 'read', 'doctor', 'who', 'secret', 'خصوصية', 'رابط', 'مشاركة', 'يقرأ', 'سري'],
  },
  {
    id: 'ed_heart',
    sex: 'male',
    q: { en: 'Can erection problems be a sign of a heart problem?', ar: 'هل يمكن أن تكون مشكلات الانتصاب علامة على مشكلة في القلب؟' },
    a: {
      en: 'They can be an early sign of problems with blood vessels, such as high blood pressure, diabetes or high cholesterol, sometimes years before heart symptoms. A check with your family doctor is worthwhile, and treating the cause helps both.',
      ar: 'قد تكون علامة مبكرة على مشكلات في الأوعية الدموية، مثل ارتفاع ضغط الدم أو السكري أو ارتفاع الكوليسترول، وأحياناً قبل أعراض القلب بسنوات. يستحق الأمر فحصاً لدى طبيب الأسرة، وعلاج السبب يفيد الاثنين.',
    },
    sources: ['ED_CVD'],
    keys: ['erection', 'erectile', 'ed', 'heart', 'impotence', 'انتصاب', 'الانتصاب', 'ضعف', 'القلب', 'قلب'],
  },
  {
    id: 'varicocele',
    sex: 'male',
    q: { en: 'What is a varicocele?', ar: 'ما هي دوالي الخصية؟' },
    a: {
      en: 'It is a group of swollen veins in the scrotum, like varicose veins in the leg. Many men have one without any problem. It can feel like a soft lump or a dragging ache. A doctor can check it with an examination or an ultrasound; treatment is considered only in some situations.',
      ar: 'هي مجموعة من الأوردة المتورمة في كيس الصفن، تشبه دوالي الساق. لدى كثير من الرجال دوالي دون أي مشكلة. وقد تُحس ككتلة لينة أو ألم ساحب. يستطيع الطبيب فحصها سريرياً أو بالموجات فوق الصوتية، ولا يُفكَّر في علاجها إلا في حالات معينة.',
    },
    sources: ['AUA2020', 'EAU2024'],
    keys: ['varicocele', 'veins', 'vein', 'scrotum', 'dragging', 'دوالي', 'أوردة', 'الصفن'],
  },
  {
    id: 'infections',
    sex: 'male',
    q: { en: 'Can past infections affect fertility?', ar: 'هل يمكن أن تؤثر العدوى السابقة على الخصوبة؟' },
    a: {
      en: 'Some infections, such as chlamydia or gonorrhoea, can affect the tubes that carry sperm if they are not treated. Testing and treatment are simple and confidential. If you have symptoms now, such as discharge or burning, see a doctor soon.',
      ar: 'قد تؤثر بعض أنواع العدوى، مثل الكلاميديا أو السيلان، على القنوات التي تنقل الحيوانات المنوية إذا لم تُعالَج. الفحص والعلاج بسيطان وسريان. وإذا كانت لديك أعراض الآن، مثل الإفرازات أو الحرقة، فراجع طبيباً قريباً.',
    },
    sources: ['EAU2024'],
    keys: ['infection', 'sti', 'std', 'chlamydia', 'gonorrhoea', 'discharge', 'burning', 'عدوى', 'التهاب', 'إفرازات', 'حرقة', 'منقولة'],
  },
]

const KB_MALE = new Set(['semen_prep', 'why_men', 'home_test', 'lifestyle_time', 'specialist_visit'])
const FROM_KB: Note[] = [SEMEN_PREP, ...KB.filter((k) => k.id !== SEMEN_PREP.id)].map((k) => ({ id: k.id, q: k.q, a: k.a, sources: [], keys: [], ...(KB_MALE.has(k.id) ? { sex: 'male' as const } : {}) }))

/** Notes for women: reviewed by the team from the cited guidelines, like the others. */
const WOMEN: Note[] = [
  {
    id: 'f_when_to_see',
    sex: 'female',
    q: { en: 'When should we see a doctor about getting pregnant?', ar: 'متى يجب أن نراجع الطبيب بشأن الحمل؟' },
    a: {
      en: 'After 12 months of trying, or after 6 months if you are 35 or older. From 40, or with a known reason such as absent or very irregular periods, endometriosis or a past pelvic infection, go now rather than waiting. Both partners should be assessed together.',
      ar: 'بعد 12 شهراً من المحاولة، أو بعد 6 أشهر إذا كان عمرك 35 عاماً أو أكثر. ومن سن 40، أو عند وجود سبب معروف مثل غياب الدورة أو عدم انتظامها الشديد أو بطانة الرحم المهاجرة أو التهاب سابق في الحوض، راجعي الطبيب الآن بدل الانتظار. ويجب تقييم الشريكين معاً.',
    },
    sources: ['NICE_CG156', 'ASRM_FEMALE_EVAL'],
    keys: ['pregnant', 'pregnancy', 'trying', 'doctor', 'months', 'conceive', 'حمل', 'الحمل', 'نحاول', 'أحاول', 'طبيب', 'أشهر', 'إنجاب'],
  },
  {
    id: 'f_partner',
    sex: 'female',
    q: { en: 'Does my husband need tests too?', ar: 'هل يحتاج زوجي إلى فحوصات أيضاً؟' },
    a: {
      en: 'Yes. A cause is found in the man about as often as in the woman, and his first test, a semen analysis, is quick and simple. Guidelines advise assessing both partners at the same time, so neither waits for the other. You can send him a private invitation to do his own check.',
      ar: 'نعم. يوجد السبب لدى الرجل بقدر ما يوجد لدى المرأة تقريباً، وفحصه الأول، أي تحليل السائل المنوي، سريع وبسيط. توصي الإرشادات بتقييم الشريكين في الوقت نفسه حتى لا ينتظر أحدهما الآخر. ويمكنك إرسال دعوة خاصة له لإجراء فحصه.',
    },
    sources: ['NICE_CG156', 'AUA2020'],
    keys: ['husband', 'partner', 'man', 'semen', 'sperm', 'زوج', 'زوجي', 'شريك', 'الرجل', 'السائل', 'المنوي'],
  },
  {
    id: 'f_amh',
    sex: 'female',
    q: { en: 'What does my AMH result mean?', ar: 'ماذا تعني نتيجة AMH لديّ؟' },
    a: {
      en: 'AMH gives a rough idea of how many eggs remain. It does not measure egg quality, and on its own it does not predict whether you can get pregnant naturally: in a large study, women with low AMH conceived about as often as others. It is most useful for planning IVF or egg freezing, and for timing. It falls slowly with age in everyone, so the direction over years means more than one value.',
      ar: 'يعطي AMH فكرة تقريبية عن عدد البويضات المتبقية. لا يقيس جودة البويضات، ولا يتنبأ وحده بقدرتك على الحمل الطبيعي: في دراسة كبيرة، حملت النساء ذوات AMH المنخفض بمعدل قريب من غيرهن. وهو أكثر فائدة في التخطيط لأطفال الأنابيب أو تجميد البويضات وفي التوقيت. وينخفض ببطء مع العمر لدى الجميع، لذا يعني الاتجاه عبر السنوات أكثر من قيمة واحدة.',
    },
    sources: ['ASRM_ORT2020', 'AMH_STEINER2017'],
    keys: ['amh', 'egg', 'eggs', 'reserve', 'ovarian', 'hormone', 'بويضات', 'البويضات', 'مخزون', 'المبيض', 'هرمون'],
  },
  {
    id: 'f_age',
    sex: 'female',
    q: { en: 'How does age affect my fertility?', ar: 'كيف يؤثر العمر على خصوبتي؟' },
    a: {
      en: 'Fertility falls gradually from the early 30s, faster after about 37, and steeply after 40, mostly because egg number and quality fall. It varies a lot between women, and no test can tell you exactly when it will become hard for you. That is why guidelines suggest getting help sooner from 35, and why it is worth knowing early if you plan to wait.',
      ar: 'تنخفض الخصوبة تدريجياً من أوائل الثلاثينيات، وبشكل أسرع بعد نحو 37، وبشدة بعد 40، ويرجع ذلك أساساً إلى انخفاض عدد البويضات وجودتها. ويختلف ذلك كثيراً بين النساء، ولا يوجد تحليل يحدد بدقة متى سيصبح الأمر صعباً عليكِ. لهذا توصي الإرشادات بطلب المساعدة مبكراً من سن 35، ومن المفيد المعرفة مبكراً إذا كنتِ تخططين للانتظار.',
    },
    sources: ['ACOG_AGE2014'],
    keys: ['age', 'old', 'older', '30s', '35', '40', 'late', 'wait', 'عمر', 'العمر', 'سن', 'كبر', 'تأخير', 'انتظار'],
  },
  {
    id: 'f_egg_freezing',
    sex: 'female',
    q: { en: 'Should I think about freezing my eggs?', ar: 'هل يجب أن أفكر في تجميد بويضاتي؟' },
    a: {
      en: 'It is a personal choice, and worth discussing if you would like children later. Eggs frozen at a younger age, ideally before 35, give better chances, but it is not a guarantee of a baby, and it involves hormone injections, a minor procedure and a cost. A counselling conversation can go through what it means for you, without any pressure to decide.',
      ar: 'هو قرار شخصي، ويستحق النقاش إذا كنتِ ترغبين في الإنجاب لاحقاً. تعطي البويضات المجمدة في عمر أصغر، ويُفضّل قبل 35، فرصاً أفضل، لكنها لا تضمن الإنجاب، وتتضمن حقناً هرمونية وإجراءً بسيطاً وتكلفة. ويمكن لجلسة استشارة أن تشرح ما يعنيه ذلك لكِ، دون أي ضغط لاتخاذ قرار.',
    },
    sources: ['ASRM_OOCYTE2018', 'ACOG_AGE2014'],
    keys: ['freeze', 'freezing', 'frozen', 'egg', 'preservation', 'later', 'تجميد', 'بويضات', 'حفظ', 'الخصوبة', 'لاحقا'],
  },
  {
    id: 'f_irregular',
    sex: 'female',
    q: { en: 'My periods are irregular. Should I worry?', ar: 'دورتي غير منتظمة. هل يجب أن أقلق؟' },
    a: {
      en: 'It is common and usually has a simple, treatable cause. In adults, cycles shorter than 21 days, longer than 35, or fewer than 8 a year often mean ovulation is not happening every month. The most common reason is PCOS; thyroid problems, weight change and stress are others. It is worth a visit to your family doctor or a women’s health clinic, and sooner if you are trying for a baby.',
      ar: 'هذا شائع وعادةً ما يكون سببه بسيطاً وقابلاً للعلاج. لدى البالغات، غالباً ما تعني الدورات الأقصر من 21 يوماً أو الأطول من 35 أو أقل من 8 دورات في السنة أن التبويض لا يحدث كل شهر. السبب الأكثر شيوعاً هو تكيّس المبايض، ومن الأسباب الأخرى مشكلات الغدة الدرقية وتغيّر الوزن والتوتر. تستحق زيارة طبيب الأسرة أو عيادة صحة المرأة، وفي وقت أبكر إذا كنتِ تحاولين الإنجاب.',
    },
    sources: ['PCOS2023', 'FIGO2018'],
    keys: ['irregular', 'period', 'periods', 'cycle', 'late', 'missed', 'ovulation', 'دورة', 'الدورة', 'منتظمة', 'تأخر', 'تبويض', 'الحيض'],
  },
  {
    id: 'f_pcos',
    sex: 'female',
    q: { en: 'What is PCOS, and can I still have children?', ar: 'ما هو تكيّس المبايض، وهل يمكنني الإنجاب؟' },
    a: {
      en: 'Polycystic ovary syndrome affects about 1 in 10 women. It can cause irregular periods, extra hair or acne, and makes weight and blood sugar harder to manage. Most women with PCOS do have children, sometimes with help to ovulate. Keeping active, a healthy weight and regular checks of blood sugar help both now and later.',
      ar: 'تصيب متلازمة تكيّس المبايض نحو امرأة من كل 10. قد تسبب عدم انتظام الدورة وزيادة الشعر أو حب الشباب، وتجعل التحكم في الوزن والسكر أصعب. معظم النساء المصابات ينجبن، أحياناً بمساعدة على التبويض. يفيد النشاط والوزن الصحي وفحص السكر بانتظام الآن ولاحقاً.',
    },
    sources: ['PCOS2023'],
    keys: ['pcos', 'polycystic', 'cysts', 'ovaries', 'hair', 'acne', 'تكيس', 'تكيّس', 'المبايض', 'شعر', 'حب'],
  },
  {
    id: 'f_endo',
    sex: 'female',
    q: { en: 'Is very painful period pain normal?', ar: 'هل ألم الدورة الشديد جداً طبيعي؟' },
    a: {
      en: 'Some pain is common, but pain that stops you working, studying or sleeping, or deep pain during sex, is not something to put up with. It can be a sign of endometriosis, which often takes years to be diagnosed and can affect fertility. Effective treatments exist. A pain diary for two or three cycles helps your doctor.',
      ar: 'بعض الألم شائع، لكن الألم الذي يمنعك من العمل أو الدراسة أو النوم، أو الألم العميق أثناء العلاقة الزوجية، ليس أمراً عليكِ تحمّله. قد يكون علامة على بطانة الرحم المهاجرة، التي يستغرق تشخيصها غالباً سنوات وقد تؤثر على الخصوبة. ويوجد علاج فعّال. ويساعد تدوين الألم لدورتين أو ثلاث طبيبك.',
    },
    sources: ['ESHRE_ENDO2022', 'NICE_NG73'],
    keys: ['pain', 'painful', 'cramps', 'endometriosis', 'ألم', 'مؤلمة', 'تقلصات', 'بطانة', 'المهاجرة'],
  },
  {
    id: 'f_folic',
    sex: 'female',
    q: { en: 'Do I need folic acid, and when?', ar: 'هل أحتاج إلى حمض الفوليك، ومتى؟' },
    a: {
      en: 'Yes, if you could become pregnant. 400 micrograms a day, starting at least a month before trying and continuing for the first 12 weeks of pregnancy, prevents most spinal cord problems in babies. Some women need a higher dose, for example with diabetes or certain medicines, so ask your doctor.',
      ar: 'نعم، إذا كان من الممكن أن تحملي. 400 ميكروغرام يومياً، بدءاً من شهر على الأقل قبل المحاولة وحتى الأسبوع الثاني عشر من الحمل، تقي من معظم مشكلات الحبل الشوكي لدى الأجنة. تحتاج بعض النساء جرعة أعلى، مثلاً مع السكري أو بعض الأدوية، فاسألي طبيبك.',
    },
    sources: ['FOLIC_USPSTF2023'],
    keys: ['folic', 'folate', 'vitamin', 'supplement', 'فوليك', 'الفوليك', 'فيتامين', 'مكمل'],
  },
  {
    id: 'f_preconception',
    sex: 'female',
    q: { en: 'What happens at a preconception visit?', ar: 'ماذا يحدث في زيارة ما قبل الحمل؟' },
    a: {
      en: 'A short conversation, often by video, before you start trying. It usually covers folic acid, vaccines such as rubella, any medicines or long-term conditions, weight, smoking, and whether genetic carrier screening makes sense for you. Sorting these out early is what makes the most difference.',
      ar: 'محادثة قصيرة، غالباً بالفيديو، قبل بدء المحاولة. تشمل عادةً حمض الفوليك، واللقاحات مثل الحصبة الألمانية، وأي أدوية أو حالات مزمنة، والوزن، والتدخين، وما إذا كان الفحص الوراثي للحاملين مناسباً لكِ. ومعالجة هذه الأمور مبكراً هي ما يُحدث الفرق الأكبر.',
    },
    sources: ['WHO_PRECONCEPTION'],
    keys: ['preconception', 'before', 'planning', 'plan', 'visit', 'rubella', 'vaccine', 'قبل', 'التخطيط', 'زيارة', 'لقاح', 'الحصبة'],
  },
  {
    id: 'f_weight',
    sex: 'female',
    q: { en: 'Will losing weight help me get pregnant?', ar: 'هل سيساعدني إنقاص الوزن على الحمل؟' },
    a: {
      en: 'If your weight is in the obesity range, losing even 5–10% can bring back regular ovulation and lowers the risk of diabetes and high blood pressure in pregnancy. Being underweight can also stop ovulation. Steady changes in food and activity work better than crash diets.',
      ar: 'إذا كان وزنك ضمن نطاق السمنة، فإن خسارة 5-10% فقط قد تعيد انتظام التبويض وتقلل خطر السكري وارتفاع الضغط أثناء الحمل. كما أن نقص الوزن قد يوقف التبويض. التغييرات الثابتة في الغذاء والنشاط أنجح من الحميات القاسية.',
    },
    sources: ['NICE_CG156', 'ASRM2022'],
    keys: ['weight', 'obese', 'obesity', 'diet', 'bmi', 'lose', 'thin', 'وزن', 'الوزن', 'سمنة', 'رجيم', 'حمية', 'نحافة'],
  },
  {
    id: 'f_smoking',
    sex: 'female',
    q: { en: 'Does shisha or vaping affect my fertility?', ar: 'هل تؤثر الشيشة أو السجائر الإلكترونية على خصوبتي؟' },
    a: {
      en: 'Smoking in any form is linked to lower fertility, earlier menopause and a higher chance of miscarriage, and no form of tobacco or nicotine is known to be safe. Stopping before trying helps most. Your family doctor can help you quit.',
      ar: 'يرتبط التدخين بأي شكل بانخفاض الخصوبة وتبكير انقطاع الطمث وزيادة احتمال الإجهاض، ولا يُعرف أي شكل من التبغ أو النيكوتين بأنه آمن. والإقلاع قبل المحاولة هو الأفضل. ويستطيع طبيب الأسرة مساعدتك على الإقلاع.',
    },
    sources: ['ASRM2022'],
    keys: ['shisha', 'smoke', 'smoking', 'cigarette', 'vape', 'nicotine', 'medwakh', 'tobacco', 'شيشة', 'تدخين', 'سجائر', 'مدواخ', 'نيكوتين', 'تبغ'],
  },
  {
    id: 'f_miscarriage',
    sex: 'female',
    q: { en: 'I have had two miscarriages. What now?', ar: 'تعرضتُ لإجهاضين. ماذا الآن؟' },
    a: {
      en: 'I am sorry. Most miscarriages happen by chance, and most women go on to have a baby. After two, guidelines advise looking for causes that can be treated, such as thyroid or clotting problems or the shape of the womb. Ask your doctor for a referral to a women’s health specialist or a recurrent pregnancy loss clinic.',
      ar: 'نأسف لذلك. تحدث معظم حالات الإجهاض صدفةً، وتنجب معظم النساء بعدها. بعد إجهاضين، توصي الإرشادات بالبحث عن أسباب قابلة للعلاج، مثل مشكلات الغدة الدرقية أو التخثر أو شكل الرحم. اطلبي من طبيبك تحويلاً إلى أخصائية صحة المرأة أو عيادة الإجهاض المتكرر.',
    },
    sources: ['ESHRE_RPL2022'],
    keys: ['miscarriage', 'miscarriages', 'loss', 'lost', 'إجهاض', 'إجهاضين', 'فقدان'],
  },
  {
    id: 'f_infections',
    sex: 'female',
    q: { en: 'Can past infections affect my fertility?', ar: 'هل يمكن أن تؤثر العدوى السابقة على خصوبتي؟' },
    a: {
      en: 'Some can. Chlamydia and other pelvic infections can scar the tubes that carry eggs, often without symptoms. Testing and treatment are simple and confidential. If you have had a pelvic infection and start trying, ask for help sooner rather than waiting a full year.',
      ar: 'بعضها قد يؤثر. قد تترك الكلاميديا والتهابات الحوض الأخرى ندوباً في قناتي فالوب، غالباً دون أعراض. الفحص والعلاج بسيطان وسريان. إذا أُصبتِ بالتهاب في الحوض سابقاً وبدأتِ المحاولة، فاطلبي المساعدة مبكراً بدلاً من انتظار عام كامل.',
    },
    sources: ['CDC_STI2021', 'NICE_CG156'],
    keys: ['infection', 'chlamydia', 'std', 'sti', 'pelvic', 'tubes', 'عدوى', 'التهاب', 'الكلاميديا', 'الحوض', 'قناتي'],
  },
  {
    id: 'f_cycle_tracking',
    sex: 'female',
    q: { en: 'Why does the app ask when my period starts?', ar: 'لماذا يسأل التطبيق عن موعد بدء دورتي؟' },
    a: {
      en: 'Your cycle is one of the best everyday signs of ovulation. One tap a week builds a record of your cycle lengths, so a change shows up early and you have real dates to show a doctor. It stays on your phone unless you choose to share it.',
      ar: 'الدورة الشهرية من أفضل العلامات اليومية على التبويض. نقرة واحدة أسبوعياً تبني سجلاً لأطوال دوراتك، فيظهر أي تغيّر مبكراً ويكون لديكِ تواريخ حقيقية تعرضينها على الطبيب. ويبقى على هاتفك إلا إذا اخترتِ مشاركته.',
    },
    sources: ['FIGO2018'],
    keys: ['track', 'tracking', 'record', 'period', 'cycle', 'تتبع', 'تسجيل', 'سجل', 'دورة', 'الدورة'],
  },
  {
    id: 'f_work',
    sex: 'female',
    q: { en: 'Does my work matter if I am planning a pregnancy?', ar: 'هل يهم عملي إذا كنت أخطط للحمل؟' },
    a: {
      en: 'It can. Some solvents, pesticides, lead and radiation need extra care before and during pregnancy, and protection rules change once your employer knows. Tell occupational health or your doctor what you work with when you start planning. Your employer never sees anything in this app.',
      ar: 'قد يهم. تحتاج بعض المذيبات والمبيدات والرصاص والإشعاع إلى عناية إضافية قبل الحمل وأثناءه، وتتغير قواعد الحماية بعد علم جهة العمل. أخبري الصحة المهنية أو طبيبك بما تعملين به عند بدء التخطيط. ولا ترى جهة عملك أي شيء في هذا التطبيق.',
    },
    sources: ['WHO_PRECONCEPTION'],
    keys: ['work', 'job', 'chemicals', 'solvents', 'pesticides', 'lead', 'radiation', 'employer', 'عمل', 'العمل', 'وظيفة', 'مواد', 'كيميائية', 'مبيدات', 'إشعاع'],
  },
]

export const NOTES: Note[] = [...FROM_KB, ...MORE, ...WOMEN]

const STOP = new Set('a an the is are am i my me do does did can could should would will to of in on for and or with what how when who it this that be have has there about any you your ar'.split(' ').concat(['هل', 'ما', 'ماذا', 'كيف', 'متى', 'من', 'في', 'على', 'عن', 'إلى', 'أن', 'هو', 'هي', 'لي', 'أنا', 'يمكن', 'يمكنني', 'ذلك', 'هذا', 'او', 'أو', 'و']))

/** Arabic letters folded so that common spelling variants match. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
}

function tokens(s: string): string[] {
  return norm(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.startsWith('ال') && w.length > 4 ? w.slice(2) : w))
}

/** The notes that best match a question (simple word overlap, weighted towards the note's own question and keywords). */
export function retrieve(question: string, k = 3, sex: Sex = 'male'): Note[] {
  const q = new Set(tokens(question))
  if (!q.size) return []
  const scored = NOTES.filter((n) => !n.sex || n.sex === sex).map((n) => {
    const head = new Set([...tokens(n.q.en), ...tokens(n.q.ar), ...n.keys.flatMap(tokens)])
    const body = new Set([...tokens(n.a.en), ...tokens(n.a.ar)])
    let score = 0
    for (const w of q) score += head.has(w) ? 3 : body.has(w) ? 1 : 0
    return { n, score }
  })
  return scored
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.n)
}

/** Which note answers the obvious question behind a finding. */
const BY_FLAG: [RegExp, string][] = [
  [/^(AN_SEMEN|LT_SEMEN_LOW_TWICE|LT_SEMEN_RECENT_LOW)$/, 'low_result'],
  [/^(LT_LENS_LOW|LT_LENS_OK)$/, 'lens'],
  [/^(SC_HEAT|EX_HEAT|EX_SITTING|LT_HEAT_WEEKS)$/, 'heat_work'],
  [/^SC_TOBACCO$/, 'tobacco'],
  [/^(SC_OVERWEIGHT|PC_OBESITY|LT_WEIGHT_DOWN)$/, 'weight'],
  [/^(SC_SLEEP|EX_NIGHT|LT_SLEEP_SHORT|PC_SLEEP_APNOEA)$/, 'sleep'],
  [/^(AN_TESTOSTERONE|LT_TESTOSTERONE_LOW|PC_MEDS)$/, 'steroids'],
  [/^AN_VARICOCELE$/, 'varicocele'],
  [/^PC_ED_LIBIDO$/, 'ed_heart'],
  [/^FS_DURATION$/, 'when_to_see'],
  [/^(PC_STI_NOW|INFO_STI_PAST)$/, 'infections'],
  [/^(PC_SCREENING_OVERDUE|SC_SCREENING_SOON)$/, 'ifhas'],
]

const BY_FLAG_F: [RegExp, string][] = [
  [/^(GY_IRREGULAR|GY_NO_PERIODS|LT_CYCLE_IRREGULAR|LT_CYCLE_GAP)$/, 'f_irregular'],
  [/^GY_KNOWN_CONDITION$/, 'f_pcos'],
  [/^PR_TIMING$/, 'f_age'],
  [/^(PR_TIMING|INFO_EARLY_MENOPAUSE_FH)$/, 'f_egg_freezing'],
  [/^(GY_AMH_LOW|LT_AMH_LOW|LT_AMH_DIRECTION|GY_FSH_RAISED|LT_FSH_RAISED)$/, 'f_amh'],
  [/^GY_ENDO_SIGNS$/, 'f_endo'],
  [/^(SC_FOLIC|PR_PRECONCEPTION|PC_MEDS)$/, 'f_folic'],
  [/^PR_PRECONCEPTION$/, 'f_preconception'],
  [/^FS_DURATION$/, 'f_when_to_see'],
  [/^FS_DURATION$/, 'f_partner'],
  [/^GY_RECURRENT_LOSS$/, 'f_miscarriage'],
  [/^(PC_STI_NOW|INFO_STI_PAST|INFO_PELVIC_HISTORY)$/, 'f_infections'],
  [/^SC_TOBACCO$/, 'f_smoking'],
  [/^(SC_OVERWEIGHT|PC_OBESITY|SC_UNDERWEIGHT|LT_WEIGHT_DOWN)$/, 'f_weight'],
  [/^EX_/, 'f_work'],
  [/^(PC_SCREENING_OVERDUE|SC_SCREENING_SOON)$/, 'ifhas'],
]

/** Up to k notes worth suggesting for these findings, most relevant first, then general ones. */
export function suggestNotes(flagIds: string[], k = 3, sex: Sex = 'male'): Note[] {
  const ids: string[] = []
  for (const f of flagIds) for (const [re, id] of sex === 'female' ? BY_FLAG_F : BY_FLAG) if (re.test(f) && !ids.includes(id)) ids.push(id)
  for (const id of sex === 'female' ? ['f_cycle_tracking', 'teleconsult', 'not_diagnosis'] : ['teleconsult', 'not_diagnosis', 'link_privacy']) if (!ids.includes(id)) ids.push(id)
  return ids
    .slice(0, k)
    .map((id) => NOTES.find((n) => n.id === id))
    .filter((n): n is Note => !!n)
}
