/**
 * Golden rule 4 — safety keyword list (English + Hinglish + Hindi).
 * A match shows the fixed safety line from @medicos/shared (never AI-written).
 *
 * REVIEW STATUS: draft. Pranov decided (2026-11-12) that a doctor clinically reviews this list
 * before the pilot. The release checklist blocks the pilot until `reviewStatus` is 'reviewed'.
 *
 * Bias: show the line when in doubt. A negated mention ("no chest pain") still shows it — a false
 * positive costs one extra message; a false negative could cost a life.
 */
export const SAFETY_LIST_META = { version: 1, reviewStatus: 'draft' as 'draft' | 'reviewed', reviewedBy: null as string | null };

export interface SafetyRule {
  id: string;
  /** Matched against normalised text (lowercase, single spaces). */
  patterns: RegExp[];
}

const r = (s: string) => new RegExp(s, 'u');

export const SAFETY_RULES: SafetyRule[] = [
  {
    id: 'chest_pain',
    patterns: [
      r('chest pain'),
      r('pain in (my |the )?chest'),
      r('chest (tightness|pressure|heaviness)'),
      r('tight(ness)? (in|on) (my )?chest'),
      r('(seene|seeney|sine|chhati|chati|chaati) (mein|me|mai|par|pe) (dard|dabav|dabaav|bhaari|jakdan)'),
      r('(सीने|छाती) (में|पर) (दर्द|दबाव|भारीपन|जकड़न)'),
    ],
  },
  {
    id: 'breathing',
    patterns: [
      r("(can'?t|cannot|unable to|not able to) breathe"),
      r('(difficulty|trouble|problem) breathing'),
      r('gasping'),
      r('saa?ns? (nahi|nahin|nhi) (aa|le pa)'),
      r('saa?ns? (lene|lena) (mein|me|mai) (dikkat|dikat|takleef|taklif|pareshani|mushkil)'),
      r('saa?ns? (ruk|phool|ful)'),
      r('दम घुट'),
      r('(सांस|साँस) (नहीं आ|लेने में (तकलीफ|दिक्कत|परेशानी)|रुक|फूल)'),
    ],
  },
  {
    id: 'stroke_signs',
    patterns: [
      r('face (is )?(drooping|droop)'),
      r('slurred speech'),
      r("(can'?t|cannot|unable to) (speak|talk|move (my )?(arm|leg|hand))"),
      r('sudden (weakness|numbness)'),
      r('one side (of (my|the) )?(body|face) (is )?(weak|numb|not moving)'),
      r('la(k|q)wa'),
      r('(muh|munh|muhn) (tedha|terha|tirchha)'),
      r('(bolne|bolna) (mein|me|mai) (dikkat|takleef|pareshani)'),
      r('(लकवा|मुंह टेढ़ा|बोलने में (दिक्कत|तकलीफ))'),
    ],
  },
  {
    id: 'heavy_bleeding',
    patterns: [
      r('heavy bleeding'),
      r("bleeding (a lot|heavily|won'?t stop|not stopping|is not stopping)"),
      r('(vomiting|coughing|throwing up) blood'),
      r('blood in (my )?vomit'),
      r('khoon (ki|ka) (ulti|ultee)'),
      r('(bahut|bohot|zyada|jyada) khoon'),
      r('khoon (ruk nahi|nahi ruk|band nahi)'),
      r('(खून की उल्टी|बहुत खून|खून (नहीं|रुक नहीं))'),
    ],
  },
  {
    id: 'fainting',
    patterns: [
      r('faint(ed|ing)?\\b'),
      r('passed out'),
      r('unconscious'),
      r('blacked out'),
      r('behos(h|hi)'),
      r('(chakkar|chakar) (kha|aa) (ke|kar) gir'),
      r('बेहोश'),
    ],
  },
  {
    id: 'suicidal_thoughts',
    patterns: [
      r('suicid'),
      r('kill (myself|my self)'),
      r('end (my|this) life'),
      r('(want|wanted|going) to die'),
      r('self[- ]?harm'),
      r('hurt myself'),
      r('khudkushi'),
      r('aatm?hatya'),
      r('(mar|marna) (jaana|jana) (chahta|chahti|chahte)'),
      r('jeena nahi chahta|jeena nahi chahti|zindagi khatam'),
      r('(आत्महत्या|ख़ुदकुशी|खुदकुशी|जान देना|मर जाना चाह)'),
    ],
  },
  {
    id: 'severe_allergic_reaction',
    patterns: [
      r('(throat|tongue|lips?|face) (is |are )?(swelling|swollen)'),
      r('swollen (throat|tongue|lips?|face)'),
      r('anaphyla'),
      r("(can'?t|cannot) swallow"),
      r('(gala|gale|honth|hoth|jeebh|jeeb|chehra) (sooj|suj)'),
      r('(गला|होंठ|जीभ|चेहरा) सूज'),
    ],
  },
  {
    id: 'pregnancy_bleeding',
    patterns: [
      r('bleeding (during|in) (my )?pregnancy'),
      r('pregnan\\S* .{0,40}bleed'),
      r('bleed\\S* .{0,40}pregnan'),
      r('(pregnancy|garbh|pet se) .{0,30}khoon'),
      r('(गर्भ|प्रेगनेंसी).{0,30}खून'),
    ],
  },
  {
    id: 'child_not_responding',
    patterns: [
      r('(child|baby|son|daughter|kid) (is )?(not|isn\'t) (responding|waking|breathing)'),
      r('not waking up'),
      r('seizure|convulsion|fits?\\b.{0,10}(aa|hua|ho)'),
      r('(baccha|bachcha|bacha|beta|beti) .{0,20}(jawab nahi|hil nahi|uth nahi|hosh nahi)'),
      r('daura (pad|aa)'),
      r('(बच्चा|बच्ची).{0,20}(नहीं उठ|जवाब नहीं|होश नहीं)'),
      r('दौरा (पड़|आ)'),
    ],
  },
];
