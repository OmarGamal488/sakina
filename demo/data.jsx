// data.jsx — sample conversation, mood points, bilingual strings

const EMOTION_COLORS = {
  neutral: '#5C8374',
  sad:     '#6B8FB5',
  anxious: '#B8A6C4',
  angry:   '#D4856B',
  happy:   '#E4B363',
  crisis:  '#88B2A8',
};

const EMOTION_LABELS = {
  en: { neutral: 'calm', sad: 'sad', anxious: 'anxious', angry: 'angry', happy: 'lighter', crisis: 'tender' },
  ar: { neutral: 'هادئ', sad: 'حزين', anxious: 'قلق', angry: 'غاضب', happy: 'أخف', crisis: 'حساس' },
};

// Bilingual strings table
const STRINGS = {
  en: {
    name: 'Sakina',
    statusBase: 'Here with you',
    todayMood: 'Today',
    moodSummary: 'Mostly calm with a soft afternoon dip',
    lastCheckin: 'Last check-in 2h ago',
    placeholder: 'Take your time…',
    voiceOn: 'Voice replies on',
    voiceOff: 'Voice replies off',
    attach: 'Attach (coming soon)',
    record: 'Record',
    stop: 'Stop',
    onboardTitle: "I'm Sakina.",
    onboardBody: "I'm here to listen. Whatever you're feeling right now is okay. We can take this at your pace.",
    cta: 'Start talking',
    foot1: 'Sakina is not a substitute for professional care.',
    foot2: 'Read the safety notes',
    moodTitle: 'Your mood over time',
    range7: '7d', range30: '30d', range90: '90d',
    insight1: 'Most common this week',
    insight2: 'Calmest day',
    insight3: 'Check-in streak',
    streak: '6 days',
    calmest: 'Sunday',
    crisisHeading: "I'm really glad you told me.",
    crisisBody: "You don't have to go through this alone. If you'd like, I can connect you with someone who can help right now.",
    crisisCall: 'Call 988',
    crisisCallSub: 'US, free, 24/7',
    crisisDecline: 'Not right now',
    crisisText: 'Or text HOME to 741741',
    journalTitle: 'Would you like to write about that?',
    journalP1: 'What went well today?',
    journalP2: "One thing I'm grateful for",
    journalP3: 'Something to revisit',
    journalSave: 'Save entry',
    journalSkip: 'Maybe later',
    settingsTitle: 'Settings',
    secLanguage: 'Language',
    secVoice: 'Voice',
    voiceRead: "Speak Sakina's replies aloud",
    voicePicker: 'Voice',
    voiceCalmF: 'Calm — female',
    voiceCalmM: 'Calm — male',
    voiceSys: 'System default',
    secMemory: 'Memory',
    memoryRemember: 'Remember our conversations',
    memoryRememberSub: "I'll reference past sessions gently.",
    memoryClear: 'Clear memory',
    secPrivacy: 'Privacy',
    privUse: 'How your data is used',
    privDelete: 'Delete account',
    secAbout: 'About',
    version: 'Version 0.4.2 · Built with care',
    credit: 'A research collaboration · ITI',
    menuSettings: 'Settings',
    menuMood: 'Your mood',
    menuClear: 'Clear chat',
    menuExport: 'Export conversation',
    open: 'Open',
    days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    todayLabel: 'Today',
    yesterdayLabel: 'Yesterday',
    chipsHeading: 'Try one of these',
    typing: 'Sakina is composing',
    you: 'You',
    placeholderRec: 'Listening…',
    enabled: 'On',
    disabled: 'Off',
  },
  ar: {
    name: 'سكينة',
    statusBase: 'أنا هنا معك',
    todayMood: 'اليوم',
    moodSummary: 'هادئ في معظمه مع لحظة عتاب بعد الظهر',
    lastCheckin: 'آخر تفقّد قبل ساعتين',
    placeholder: 'خذ وقتك…',
    voiceOn: 'الردود الصوتية مفعّلة',
    voiceOff: 'الردود الصوتية متوقّفة',
    attach: 'إرفاق (قريباً)',
    record: 'تسجيل',
    stop: 'إيقاف',
    onboardTitle: 'أنا سكينة.',
    onboardBody: 'أنا هنا للاستماع. مهما كان شعورك الآن فهو مقبول. سنمضي على راحتك.',
    cta: 'هيا نبدأ',
    foot1: 'سكينة لا تُغني عن الرعاية المتخصّصة.',
    foot2: 'اقرأ ملاحظات السلامة',
    moodTitle: 'حالتك المزاجية عبر الزمن',
    range7: '٧ أيام', range30: '٣٠ يوم', range90: '٩٠ يوم',
    insight1: 'الشعور الأكثر هذا الأسبوع',
    insight2: 'أهدأ يوم',
    insight3: 'سلسلة المتابعة',
    streak: '٦ أيام',
    calmest: 'الأحد',
    crisisHeading: 'يسعدني أنّك أخبرتني.',
    crisisBody: 'لست مضطرًا لتمرّ بهذا وحدك. لو أحببت، يمكنني أن أصلك بمن يقدر يساعدك الآن.',
    crisisCall: 'اتصل بـ ٨٠٠١٧١٧',
    crisisCallSub: 'مصر، مجاني',
    crisisDecline: 'ليس الآن',
    crisisText: 'أو راسل "أمان" على ١٦٠٢٣',
    journalTitle: 'تحبّ تكتب عن هذا الشعور؟',
    journalP1: 'ما الذي سار جيّدًا اليوم؟',
    journalP2: 'شيء أنا ممتنّ له',
    journalP3: 'شيء يستحقّ الرجوع إليه',
    journalSave: 'احفظ الكتابة',
    journalSkip: 'لاحقاً',
    settingsTitle: 'الإعدادات',
    secLanguage: 'اللغة',
    secVoice: 'الصوت',
    voiceRead: 'اقرأ ردود سكينة بصوت عالٍ',
    voicePicker: 'الصوت',
    voiceCalmF: 'هادئ — أنثى',
    voiceCalmM: 'هادئ — ذكر',
    voiceSys: 'الإعداد الافتراضي',
    secMemory: 'الذاكرة',
    memoryRemember: 'تذكّر محادثاتنا',
    memoryRememberSub: 'سأشير إلى الجلسات السابقة برفق.',
    memoryClear: 'امسح الذاكرة',
    secPrivacy: 'الخصوصية',
    privUse: 'كيف تُستخدم بياناتك',
    privDelete: 'احذف الحساب',
    secAbout: 'عن التطبيق',
    version: 'الإصدار ٠٫٤٫٢ · صُنع بعناية',
    credit: 'تعاون بحثي · معهد تكنولوجيا المعلومات',
    menuSettings: 'الإعدادات',
    menuMood: 'حالتك المزاجية',
    menuClear: 'امسح المحادثة',
    menuExport: 'تصدير المحادثة',
    open: 'افتح',
    days: ['الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد'],
    todayLabel: 'اليوم',
    yesterdayLabel: 'أمس',
    chipsHeading: 'جرّب واحدة من هذه',
    typing: 'سكينة تكتب',
    you: 'أنت',
    placeholderRec: 'أستمع…',
    enabled: 'مفعّل',
    disabled: 'متوقّف',
  }
};

// Sample conversation — walks through emotions
// Each message: { id, role, text:{en, ar}, emotion?, time, kind? }
const SAMPLE_MESSAGES_EN = [
  { id: 'm1', role: 'assistant', emotion: 'neutral', time: '14:02',
    text: { en: "Hi. Take a breath if you'd like. I'm here when you're ready.", ar: "أهلاً. خذ نفساً عميقاً لو حابب. أنا هنا متى ما كنت مستعد." } },
  { id: 'm2', role: 'user', time: '14:03',
    text: { en: "I've had a heavy week. Couldn't sleep again last night.", ar: "كان أسبوع تقيل. تاني ليلة ما قدرتش أنام." } },
  { id: 'm3', role: 'assistant', emotion: 'sad', time: '14:03',
    text: { en: "That sounds exhausting — the kind of tired that goes past the body. Would you tell me what was on your mind when you tried to sleep?", ar: "ده شكله إرهاق ما بيقفش عند الجسد. تحبّ تقولّي كان في بالك إيه وأنت بتحاول تنام؟" } },
  { id: 'm4', role: 'user', time: '14:05',
    text: { en: "Work mostly. And I keep thinking I'm letting my family down. Nothing feels like enough.", ar: "الشغل، أكتر حاجة. وحاسس إني بخذل أهلي. مفيش حاجة شكلها كفاية." } },
  { id: 'm5', role: 'assistant', emotion: 'anxious', time: '14:05',
    text: { en: "It sounds like that's been weighing on you — work pressing on one side, the people you love on the other. Both of those are loud. They make it hard to hear yourself.", ar: "حاسس إن كل ده تقيل عليك — الشغل من ناحية، وأهلك من ناحية تانية. الاتنين أصواتهم عالية. وبيصعّبوا إنك تسمع نفسك." } },
  { id: 'm6', role: 'user', time: '14:08',
    text: { en: "Sometimes I think it'd be easier if I just stopped trying.", ar: "ساعات بحس إن الأسهل إني أبطل أحاول خلاص." } },
  { id: 'crisis-card', kind: 'crisis', role: 'system' },
  { id: 'm7', role: 'user', time: '14:11',
    text: { en: "Thanks. I think I just needed to say it out loud.", ar: "متشكر. أعتقد كنت محتاج بس أقولها بصوت عالي." } },
  { id: 'm8', role: 'assistant', emotion: 'happy', time: '14:11',
    text: { en: "I'm here. Saying it out loud is its own kind of brave. Nothing has to be solved today.", ar: "أنا معك. إنك قلتها بصوت عالي — ده شجاعة بحد ذاته. مش لازم نحلّ كل حاجة النهاردة." } },
  { id: 'journal-card', kind: 'journal', role: 'system' },
];

// Mood timeline data — 7 days of emotion mix
const MOOD_7D = [
  { date: 'Mon', emotions: { neutral: 0.4, sad: 0.3, anxious: 0.2, angry: 0.05, happy: 0.05, crisis: 0 } },
  { date: 'Tue', emotions: { neutral: 0.5, sad: 0.2, anxious: 0.2, angry: 0.05, happy: 0.05, crisis: 0 } },
  { date: 'Wed', emotions: { neutral: 0.3, sad: 0.4, anxious: 0.2, angry: 0.05, happy: 0.05, crisis: 0 } },
  { date: 'Thu', emotions: { neutral: 0.45, sad: 0.25, anxious: 0.15, angry: 0.05, happy: 0.10, crisis: 0 } },
  { date: 'Fri', emotions: { neutral: 0.3, sad: 0.35, anxious: 0.25, angry: 0.05, happy: 0.05, crisis: 0 } },
  { date: 'Sat', emotions: { neutral: 0.55, sad: 0.15, anxious: 0.1, angry: 0.0, happy: 0.2, crisis: 0 } },
  { date: 'Sun', emotions: { neutral: 0.6, sad: 0.1, anxious: 0.08, angry: 0.02, happy: 0.2, crisis: 0 } },
];

// Mood dots for top strip (5 segments of day)
const TODAY_DOTS = [true, true, true, false, false];

// Simulated assistant responses keyed by detected emotion
const SIM_RESPONSES = {
  neutral: {
    en: "Mm. I'm listening. Whatever comes up is welcome here.",
    ar: "أنا سامعك. أيًا كان اللي بيجي على بالك، فيه مساحة هنا."
  },
  sad: {
    en: "That sounds really heavy. I'm sitting with you in it for a moment.",
    ar: "ده شكله تقيل فعلاً. أنا قاعد معاك فيه لحظة."
  },
  anxious: {
    en: "Your mind is moving fast — that's okay. We can slow it down together if you'd like.",
    ar: "بالك بيجري بسرعة، ودا طبيعي. لو حابب نهدّيه مع بعض."
  },
  angry: {
    en: "That frustration makes sense. You don't have to soften it for me.",
    ar: "إحباطك ده له سبب. مش لازم تليّنه عشاني."
  },
  happy: {
    en: "I can hear that lightness in your words. It's good to notice it together.",
    ar: "حاسس بالخفّة في كلامك. حلو إننا ناخد بالنا منها مع بعض."
  },
  crisis: {
    en: "Thank you for trusting me with that. You don't have to be alone in it.",
    ar: "متشكرة إنك ائتمنتني على ده. مش لازم تعدّيه لوحدك."
  },
};

// Very simple emotion detector for the demo
function detectEmotion(text, fallback = 'neutral') {
  const t = text.toLowerCase();
  if (/(end it|hurt myself|kill|stop trying|can'?t go on|أتمنى أموت|أنهي|أبطل أحاول)/i.test(text)) return 'crisis';
  if (/(angry|furious|hate|frustrated|مش طايق|غضبان|زهقت)/i.test(t)) return 'angry';
  if (/(anxious|panic|worried|nervous|قلق|متوتر|خايف)/i.test(t)) return 'anxious';
  if (/(sad|tired|exhausted|lonely|empty|down|تعبان|حزين|وحيد)/i.test(t)) return 'sad';
  if (/(better|grateful|thank|happy|good|relief|أحسن|ممتن|شكراً|مبسوط)/i.test(t)) return 'happy';
  return fallback;
}

Object.assign(window, {
  EMOTION_COLORS, EMOTION_LABELS, STRINGS,
  SAMPLE_MESSAGES_EN, MOOD_7D, TODAY_DOTS, SIM_RESPONSES, detectEmotion
});
