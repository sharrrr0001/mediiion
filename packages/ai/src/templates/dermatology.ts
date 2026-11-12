import { COMMON_TAIL, DURATION, YES_NO } from './common';
import type { IntakeTemplate } from './schema';

export const dermatologyV1: IntakeTemplate = {
  key: 'dermatology',
  specialty: 'dermatology',
  version: 1,
  title: 'Dermatology',
  maxQuestions: 20,
  extraSafetyPatterns: [],
  questions: [
    {
      id: 'chief_complaint',
      section: 'chief_complaint',
      step: 1,
      mustAsk: true,
      text: {
        en: 'What problem with your skin, hair or nails do you want to show the doctor?',
        hi: 'आप त्वचा, बाल या नाखून की किस तकलीफ़ के लिए डॉक्टर को दिखाना चाहते हैं?',
        'hi-Latn': 'Aap skin, baal ya naakhun ki kis takleef ke liye doctor ko dikhana chahte hain?',
      },
    },
    {
      id: 'location',
      section: 'hpi',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Where on the body is it? You can add a clear photo of the area.',
        hi: 'यह शरीर में कहाँ है? आप उस जगह की साफ़ फ़ोटो जोड़ सकते हैं।',
        'hi-Latn': 'Yeh body mein kahan hai? Aap us jagah ki saaf photo jod sakte hain.',
      },
      upload: 'photo_of_problem',
    },
    {
      id: 'onset',
      section: 'hpi',
      step: 1,
      mustAsk: true,
      text: { en: 'Since when have you had this?', hi: 'यह कब से है?', 'hi-Latn': 'Yeh kab se hai?' },
      quickReplies: DURATION,
    },
    {
      id: 'spread',
      section: 'specialty',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Has it spread to other places, or stayed the same?',
        hi: 'क्या यह दूसरी जगहों पर फैला है, या वैसा ही है?',
        'hi-Latn': 'Kya yeh doosri jagah par phaila hai, ya waisa hi hai?',
      },
      quickReplies: {
        en: ['Spreading', 'Same as before', 'Getting smaller'],
        hi: ['फैल रहा है', 'पहले जैसा', 'कम हो रहा है'],
        'hi-Latn': ['Phail raha hai', 'Pehle jaisa', 'Kam ho raha hai'],
      },
    },
    {
      id: 'itching',
      section: 'specialty',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Does it itch, burn or hurt? Is it worse at any time, like at night?',
        hi: 'क्या इसमें खुजली, जलन या दर्द होता है? क्या किसी समय ज़्यादा होता है, जैसे रात में?',
        'hi-Latn': 'Kya ismein khujli, jalan ya dard hota hai? Kya kisi samay zyada hota hai, jaise raat mein?',
      },
    },
    {
      id: 'new_products',
      section: 'specialty',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Have you started any new soap, cream, cosmetic, detergent or clothing recently?',
        hi: 'क्या आपने हाल में कोई नया साबुन, क्रीम, कॉस्मेटिक, डिटर्जेंट या कपड़ा इस्तेमाल करना शुरू किया है?',
        'hi-Latn': 'Kya aapne haal mein koi naya sabun, cream, cosmetic, detergent ya kapda istemaal karna shuru kiya hai?',
      },
      quickReplies: YES_NO,
    },
    {
      id: 'family_affected',
      section: 'specialty',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Does anyone else at home have something similar?',
        hi: 'क्या घर में किसी और को भी ऐसा ही कुछ है?',
        'hi-Latn': 'Kya ghar mein kisi aur ko bhi aisa hi kuch hai?',
      },
      quickReplies: YES_NO,
    },
    {
      id: 'tried_so_far',
      section: 'hpi',
      step: 1,
      mustAsk: true,
      text: {
        en: 'Have you put anything on it or used anything for it, including from a chemist? A photo of the tube helps.',
        hi: 'क्या आपने इस पर कुछ लगाया है या इसके लिए कुछ इस्तेमाल किया है, केमिस्ट से भी? ट्यूब की फ़ोटो मददगार होगी।',
        'hi-Latn': 'Kya aapne is par kuch lagaya hai ya iske liye kuch istemaal kiya hai, chemist se bhi? Tube ki photo madad karegi.',
      },
      quickReplies: YES_NO,
      upload: 'medicine_strip',
    },
    ...COMMON_TAIL,
  ],
};
