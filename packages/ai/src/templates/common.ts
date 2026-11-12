import type { TemplateQuestion } from './schema';

/** Quick-reply sets reused across templates (spec §6.1). */
export const YES_NO = {
  en: ['Yes', 'No', "Don't know"],
  hi: ['हाँ', 'नहीं', 'पता नहीं'],
  'hi-Latn': ['Haan', 'Nahi', 'Pata nahi'],
};
export const DURATION = {
  en: ['1 day', '2–3 days', '1 week', 'Longer'],
  hi: ['1 दिन', '2–3 दिन', '1 हफ़्ता', 'ज़्यादा'],
  'hi-Latn': ['1 din', '2–3 din', '1 hafta', 'Zyada'],
};
const NONE = { en: ['None'], hi: ['कोई नहीं'], 'hi-Latn': ['Koi nahi'] };
const SKIP = { en: ['Skip'], hi: ['छोड़ें'], 'hi-Latn': ['Skip karein'] };

/** Step 2 + 3 questions shared by every specialty. */
export const COMMON_TAIL: TemplateQuestion[] = [
  {
    id: 'current_medicines',
    section: 'medications',
    step: 2,
    mustAsk: true,
    text: {
      en: 'Are you on any medicines right now, for this problem or anything else? You can also add a photo of the strip.',
      hi: 'क्या आप अभी कोई दवा ले रहे हैं, इस तकलीफ़ के लिए या किसी और के लिए? आप पत्ते की फ़ोटो भी जोड़ सकते हैं।',
      'hi-Latn': 'Kya aap abhi koi dawa le rahe hain, is takleef ke liye ya kisi aur cheez ke liye? Aap patte ki photo bhi jod sakte hain.',
    },
    quickReplies: NONE,
    upload: 'medicine_strip',
    lookFor: 'name as the patient says it, how often, since when',
  },
  {
    id: 'allergies',
    section: 'allergies',
    step: 2,
    mustAsk: true,
    text: {
      en: 'Are you allergic to any medicine or food?',
      hi: 'क्या आपको किसी दवा या खाने से एलर्जी है?',
      'hi-Latn': 'Kya aapko kisi dawa ya khaane se allergy hai?',
    },
    quickReplies: YES_NO,
  },
  {
    id: 'past_history',
    section: 'past_history',
    step: 2,
    mustAsk: true,
    text: {
      en: 'Do you have any long-standing health problem, or have you had an operation or a hospital stay before?',
      hi: 'क्या आपको कोई पुरानी स्वास्थ्य समस्या है, या पहले कभी ऑपरेशन हुआ है या अस्पताल में भर्ती हुए हैं?',
      'hi-Latn': 'Kya aapko koi purani health problem hai, ya pehle kabhi operation hua hai ya hospital mein bharti hue hain?',
    },
    quickReplies: NONE,
  },
  {
    id: 'home_readings',
    section: 'home_readings',
    step: 3,
    mustAsk: false,
    text: {
      en: 'Have you checked anything at home recently, like BP, sugar, temperature or weight? Please share the numbers and when.',
      hi: 'क्या आपने हाल में घर पर कुछ नापा है, जैसे BP, शुगर, बुखार या वज़न? नंबर और कब नापा, बताइए।',
      'hi-Latn': 'Kya aapne haal mein ghar par kuch naapa hai, jaise BP, sugar, temperature ya weight? Number aur kab naapa, bataiye.',
    },
    quickReplies: { en: ['Not checked'], hi: ['नहीं नापा'], 'hi-Latn': ['Nahi naapa'] },
  },
  {
    id: 'reports',
    section: 'uploads',
    step: 3,
    mustAsk: false,
    text: {
      en: 'Do you have any old reports or prescriptions? You can add photos of them now.',
      hi: 'क्या आपके पास कोई पुरानी रिपोर्ट या पर्चा है? आप अभी उनकी फ़ोटो जोड़ सकते हैं।',
      'hi-Latn': 'Kya aapke paas koi purani report ya parcha hai? Aap abhi unki photo jod sakte hain.',
    },
    quickReplies: { en: ['No reports'], hi: ['कोई रिपोर्ट नहीं'], 'hi-Latn': ['Koi report nahi'] },
    upload: 'report',
  },
  {
    id: 'main_worry',
    section: 'concern',
    step: 3,
    mustAsk: true,
    text: {
      en: 'What worries you the most about this?',
      hi: 'आपको इस बारे में सबसे ज़्यादा किस बात की चिंता है?',
      'hi-Latn': 'Aapko sabse zyada kis baat ki chinta hai?',
    },
    quickReplies: SKIP,
  },
  {
    id: 'questions_for_doctor',
    section: 'questions',
    step: 3,
    mustAsk: true,
    text: {
      en: 'Is there anything you want to ask the doctor?',
      hi: 'क्या आप डॉक्टर से कुछ पूछना चाहते हैं?',
      'hi-Latn': 'Doctor se kya poochna chahte hain?',
    },
    quickReplies: { en: ['Nothing else'], hi: ['और कुछ नहीं'], 'hi-Latn': ['Aur kuch nahi'] },
  },
];
