import { COMMON_TAIL, DURATION, YES_NO } from './common';
import type { IntakeTemplate } from './schema';

/** Gynaecology v1. */
export const gynaecologyV1: IntakeTemplate = {
  key: 'gynaecology',
  specialty: 'gynaecology',
  version: 1,
  title: 'Gynaecology',
  maxQuestions: 20,
  extraSafetyPatterns: [],
  questions: [
    {
      id: 'chief_complaint',
      section: 'chief_complaint',
      step: 1,
      mustAsk: true,
      text: {
        en: 'What is the main problem you want to see the doctor for?',
        hi: 'आप डॉक्टर को मुख्य रूप से किस तकलीफ़ के लिए दिखाना चाहती हैं?',
        'hi-Latn': 'Aap doctor ko mainly kis takleef ke liye dikhana chahti hain?',
      },
    },
    { id: 'onset', section: 'hpi', step: 1, mustAsk: true, text: { en: 'Since when have you had this?', hi: 'यह कब से हो रहा है?', 'hi-Latn': 'Yeh kab se ho raha hai?' }, quickReplies: DURATION },
    {
      id: 'lmp',
      section: 'specialty',
      step: 1,
      mustAsk: true,
      text: { en: 'When did your last period start?', hi: 'आपका पिछला पीरियड कब शुरू हुआ था?', 'hi-Latn': 'Aapka pichhla period kab shuru hua tha?' },
      quickReplies: { en: ["Don't remember"], hi: ['याद नहीं'], 'hi-Latn': ['Yaad nahi'] },
      lookFor: 'a date or how many days ago',
    },
    {
      id: 'cycle',
      section: 'specialty',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Are your periods regular? How many days apart are they, and how many days does the bleeding last?',
        hi: 'क्या आपके पीरियड नियमित हैं? कितने दिन के अंतर पर आते हैं, और कितने दिन रहते हैं?',
        'hi-Latn': 'Kya aapke periods regular hain? Kitne din ke antar par aate hain, aur kitne din rehte hain?',
      },
    },
    {
      id: 'bleeding_pain',
      section: 'negatives',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Do you have any unusual bleeding, discharge, or pain in the lower tummy?',
        hi: 'क्या आपको कोई असामान्य ब्लीडिंग, सफ़ेद पानी, या पेट के निचले हिस्से में दर्द है?',
        'hi-Latn': 'Kya aapko koi alag tarah ki bleeding, safed paani, ya pet ke neeche dard hai?',
      },
      quickReplies: { en: ['None of these'], hi: ['इनमें से कुछ नहीं'], 'hi-Latn': ['Inmein se kuch nahi'] },
    },
    {
      id: 'pregnancy_status',
      section: 'specialty',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Is there any chance you could be pregnant, or are you trying to get pregnant?',
        hi: 'क्या आप गर्भवती हो सकती हैं, या गर्भ धारण करने की कोशिश कर रही हैं?',
        'hi-Latn': 'Kya aap pregnant ho sakti hain, ya pregnancy ki koshish kar rahi hain?',
      },
      quickReplies: YES_NO,
    },
    {
      id: 'obstetric_history',
      section: 'specialty',
      step: 2,
      mustAsk: false,
      text: {
        en: 'How many pregnancies have you had and how many children? Any miscarriage or caesarean?',
        hi: 'आपके कितनी बार गर्भ ठहरा और कितने बच्चे हैं? कभी गर्भपात या सिज़ेरियन हुआ है?',
        'hi-Latn': 'Aapke kitni baar pregnancy hui aur kitne bachche hain? Kabhi miscarriage ya caesarean hua hai?',
      },
    },
    {
      id: 'family_planning',
      section: 'specialty',
      step: 2,
      mustAsk: false,
      text: { en: 'Are you using any family planning method right now?', hi: 'क्या आप अभी परिवार नियोजन का कोई तरीका अपना रही हैं?', 'hi-Latn': 'Kya aap abhi family planning ka koi tareeka use kar rahi hain?' },
      quickReplies: YES_NO,
    },
    ...COMMON_TAIL,
  ],
};
