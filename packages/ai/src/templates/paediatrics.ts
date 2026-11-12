import { COMMON_TAIL, DURATION, YES_NO } from './common';
import type { IntakeTemplate } from './schema';

const NONE = { en: ['None'], hi: ['कोई नहीं'], 'hi-Latn': ['Koi nahi'] };
const tail = COMMON_TAIL.filter((q) => ['reports', 'main_worry', 'questions_for_doctor'].includes(q.id));

/** Paediatrics v1 — usually answered by a parent ("your child"). */
export const paediatricsV1: IntakeTemplate = {
  key: 'paediatrics',
  specialty: 'paediatrics',
  version: 1,
  title: 'Paediatrics',
  maxQuestions: 20,
  // Specialty safety patterns (normalised text): not feeding, blue lips, very drowsy baby.
  extraSafetyPatterns: [
    '(not|no) (feeding|drinking)|doodh nahi pi|feed nahi le|दूध नहीं पी',
    'blue lips|neele (honth|hoth)|नीले होंठ',
    '(very|bahut) (sleepy|drowsy|sust)|uth nahi (raha|rahi)',
  ],
  questions: [
    {
      id: 'chief_complaint',
      section: 'chief_complaint',
      step: 1,
      mustAsk: true,
      text: {
        en: 'What problem does your child have that you want to show the doctor?',
        hi: 'बच्चे को कौन-सी तकलीफ़ है जिसके लिए आप डॉक्टर को दिखाना चाहते हैं?',
        'hi-Latn': 'Bachche ko kaunsi takleef hai jiske liye aap doctor ko dikhana chahte hain?',
      },
    },
    { id: 'onset', section: 'hpi', step: 1, mustAsk: true, text: { en: 'Since when has this been happening?', hi: 'यह कब से हो रहा है?', 'hi-Latn': 'Yeh kab se ho raha hai?' }, quickReplies: DURATION },
    {
      id: 'eating_drinking',
      section: 'hpi',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Is your child eating, drinking and passing urine as usual?',
        hi: 'क्या बच्चा हमेशा की तरह खा-पी रहा है और पेशाब कर रहा है?',
        'hi-Latn': 'Kya bachcha hamesha ki tarah kha-pi raha hai aur peshaab kar raha hai?',
      },
      quickReplies: YES_NO,
    },
    {
      id: 'associated',
      section: 'negatives',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Along with this, does your child have fever, cough, vomiting, loose motions or a rash?',
        hi: 'इसके साथ क्या बच्चे को बुखार, खांसी, उल्टी, दस्त या दाने हैं?',
        'hi-Latn': 'Iske saath kya bachche ko bukhar, khansi, ulti, loose motion ya daane hain?',
      },
      quickReplies: { en: ['None of these'], hi: ['इनमें से कुछ नहीं'], 'hi-Latn': ['Inmein se kuch nahi'] },
    },
    {
      id: 'activity',
      section: 'hpi',
      step: 1,
      mustAsk: false,
      text: { en: 'Is your child playing and active as usual?', hi: 'क्या बच्चा हमेशा की तरह खेल रहा है और चुस्त है?', 'hi-Latn': 'Kya bachcha hamesha ki tarah khel raha hai aur active hai?' },
      quickReplies: YES_NO,
    },
    {
      id: 'birth_history',
      section: 'specialty',
      step: 1,
      mustAsk: false,
      askIf: { maxAge: 5 },
      text: {
        en: 'Was your child born on time, and were there any problems at birth?',
        hi: 'क्या बच्चा समय पर पैदा हुआ था, और जन्म के समय कोई परेशानी हुई थी?',
        'hi-Latn': 'Kya bachcha samay par paida hua tha, aur janam ke samay koi pareshani hui thi?',
      },
    },
    {
      id: 'feeding',
      section: 'specialty',
      step: 1,
      mustAsk: false,
      askIf: { maxAge: 3 },
      text: {
        en: 'What does your child usually eat or drink — breast milk, other milk, or food?',
        hi: 'बच्चा आमतौर पर क्या खाता-पीता है — माँ का दूध, दूसरा दूध, या खाना?',
        'hi-Latn': 'Bachcha aam taur par kya khata-peeta hai — maa ka doodh, doosra doodh, ya khaana?',
      },
    },
    {
      id: 'vaccination',
      section: 'specialty',
      step: 2,
      mustAsk: true,
      text: {
        en: 'Are your child’s vaccinations up to date? A photo of the vaccination card helps.',
        hi: 'क्या बच्चे के सारे टीके समय पर लगे हैं? टीकाकरण कार्ड की फ़ोटो मददगार होगी।',
        'hi-Latn': 'Kya bachche ke saare teeke samay par lage hain? Vaccination card ki photo madad karegi.',
      },
      quickReplies: YES_NO,
      upload: 'report',
    },
    {
      id: 'growth',
      section: 'specialty',
      step: 2,
      mustAsk: false,
      text: {
        en: 'Do you know your child’s recent weight or height, and when it was checked?',
        hi: 'क्या आपको बच्चे का हाल का वज़न या लंबाई पता है, और कब नापा था?',
        'hi-Latn': 'Kya aapko bachche ka haal ka weight ya lambai pata hai, aur kab naapa tha?',
      },
      quickReplies: { en: ["Don't know"], hi: ['पता नहीं'], 'hi-Latn': ['Pata nahi'] },
    },
    {
      id: 'current_medicines',
      section: 'medications',
      step: 2,
      mustAsk: true,
      text: {
        en: 'Is your child on any medicines right now? You can add a photo of the bottle or strip.',
        hi: 'क्या बच्चा अभी कोई दवा ले रहा है? आप बोतल या पत्ते की फ़ोटो जोड़ सकते हैं।',
        'hi-Latn': 'Kya bachcha abhi koi dawa le raha hai? Aap bottle ya patte ki photo jod sakte hain.',
      },
      quickReplies: NONE,
      upload: 'medicine_strip',
    },
    {
      id: 'allergies',
      section: 'allergies',
      step: 2,
      mustAsk: true,
      text: { en: 'Is your child allergic to any medicine or food?', hi: 'क्या बच्चे को किसी दवा या खाने से एलर्जी है?', 'hi-Latn': 'Kya bachche ko kisi dawa ya khaane se allergy hai?' },
      quickReplies: YES_NO,
    },
    {
      id: 'past_history',
      section: 'past_history',
      step: 2,
      mustAsk: true,
      text: {
        en: 'Has your child had any long-standing health problem, an operation or a hospital stay before?',
        hi: 'क्या बच्चे को कोई पुरानी स्वास्थ्य समस्या रही है, या कभी ऑपरेशन हुआ है या अस्पताल में भर्ती हुआ है?',
        'hi-Latn': 'Kya bachche ko koi purani health problem rahi hai, ya kabhi operation hua hai ya hospital mein bharti hua hai?',
      },
      quickReplies: NONE,
    },
    {
      id: 'home_readings',
      section: 'home_readings',
      step: 3,
      mustAsk: false,
      text: {
        en: 'Have you checked your child’s temperature or weight at home? Please share the numbers and when.',
        hi: 'क्या आपने घर पर बच्चे का बुखार या वज़न नापा है? नंबर और कब नापा, बताइए।',
        'hi-Latn': 'Kya aapne ghar par bachche ka temperature ya weight naapa hai? Number aur kab naapa, bataiye.',
      },
      quickReplies: { en: ['Not checked'], hi: ['नहीं नापा'], 'hi-Latn': ['Nahi naapa'] },
    },
    ...tail,
  ],
};
