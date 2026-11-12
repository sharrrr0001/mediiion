import { COMMON_TAIL, DURATION, YES_NO } from './common';
import type { IntakeTemplate } from './schema';

export const generalMedicineV1: IntakeTemplate = {
  key: 'general-medicine',
  specialty: 'general_medicine',
  version: 1,
  title: 'General Medicine',
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
        hi: 'आप डॉक्टर को मुख्य रूप से किस तकलीफ़ के लिए दिखाना चाहते हैं?',
        'hi-Latn': 'Aap doctor ko mainly kis takleef ke liye dikhana chahte hain?',
      },
      lookFor: 'the problem in the patient’s own words',
    },
    {
      id: 'onset',
      section: 'hpi',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Since when have you had this?',
        hi: 'यह कब से हो रहा है?',
        'hi-Latn': 'Yeh kab se ho raha hai?',
      },
      quickReplies: DURATION,
      lookFor: 'duration or start date',
    },
    {
      id: 'severity_pattern',
      section: 'hpi',
      step: 1,
      mustAsk: true,
      text: {
        en: 'How bad is it, and is it there all the time or does it come and go?',
        hi: 'यह कितना ज़्यादा है, और हर समय रहता है या आता-जाता है?',
        'hi-Latn': 'Yeh kitna zyada hai, aur har samay rehta hai ya aata-jaata hai?',
      },
      quickReplies: {
        en: ['Mild', 'Moderate', 'Very bad', 'Comes and goes'],
        hi: ['हल्का', 'मध्यम', 'बहुत ज़्यादा', 'आता-जाता है'],
        'hi-Latn': ['Halka', 'Beech ka', 'Bahut zyada', 'Aata-jaata hai'],
      },
    },
    {
      id: 'triggers',
      section: 'hpi',
      step: 1,
      mustAsk: false,
      text: {
        en: 'Does anything make it better or worse, like food, time of day or activity?',
        hi: 'क्या किसी चीज़ से यह कम या ज़्यादा होता है, जैसे खाना, दिन का समय या काम?',
        'hi-Latn': 'Kya kisi cheez se yeh kam ya zyada hota hai, jaise khaana, din ka samay ya kaam?',
      },
    },
    {
      id: 'associated',
      section: 'negatives',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Along with this, do you have fever, cough, vomiting, loose motions or weight loss?',
        hi: 'इसके साथ क्या बुखार, खांसी, उल्टी, दस्त या वज़न कम होना है?',
        'hi-Latn': 'Iske saath kya bukhar, khansi, ulti, loose motion ya weight kam hona hai?',
      },
      quickReplies: { en: ['None of these'], hi: ['इनमें से कुछ नहीं'], 'hi-Latn': ['Inmein se kuch nahi'] },
      lookFor: 'which are present and which are absent',
    },
    {
      id: 'tried_so_far',
      section: 'hpi',
      step: 1,
      mustAsk: false,
      text: {
        en: 'Have you already shown this to a doctor or used anything for it?',
        hi: 'क्या आपने यह पहले किसी डॉक्टर को दिखाया है या इसके लिए कुछ इस्तेमाल किया है?',
        'hi-Latn': 'Kya aapne yeh pehle kisi doctor ko dikhaya hai ya iske liye kuch istemaal kiya hai?',
      },
      quickReplies: YES_NO,
    },
    {
      id: 'pregnancy_status',
      section: 'specialty',
      step: 1,
      mustAsk: false,
      askIf: { gender: ['female'], minAge: 15, maxAge: 50 },
      text: {
        en: 'Is there any chance you could be pregnant, or when was your last period?',
        hi: 'क्या आप गर्भवती हो सकती हैं, या आपका पिछला पीरियड कब आया था?',
        'hi-Latn': 'Kya aap pregnant ho sakti hain, ya aapka pichhla period kab aaya tha?',
      },
    },
    {
      id: 'smoking_alcohol',
      section: 'family_social',
      step: 2,
      mustAsk: false,
      askIf: { minAge: 14 },
      text: {
        en: 'Do you smoke, chew tobacco or drink alcohol? If yes, how much?',
        hi: 'क्या आप सिगरेट, तंबाकू या शराब लेते हैं? अगर हाँ, तो कितना?',
        'hi-Latn': 'Kya aap smoke karte hain, tambaaku khaate hain ya sharaab peete hain? Agar haan, toh kitna?',
      },
      quickReplies: { en: ['No'], hi: ['नहीं'], 'hi-Latn': ['Nahi'] },
    },
    {
      id: 'family_history',
      section: 'family_social',
      step: 2,
      mustAsk: false,
      text: {
        en: 'Does anyone in your family have a long-standing health problem?',
        hi: 'क्या आपके परिवार में किसी को कोई पुरानी स्वास्थ्य समस्या है?',
        'hi-Latn': 'Kya aapke parivaar mein kisi ko koi purani health problem hai?',
      },
      quickReplies: YES_NO,
    },
    ...COMMON_TAIL,
  ],
};
