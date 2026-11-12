/**
 * Word lists for the output filter (golden rule 6). Draft — reviewed together with the safety list.
 * Lowercase. Roman-script and Devanagari forms. Common Indian brand names included on purpose.
 */
export const DRUG_NAMES: string[] = [
  // analgesics / antipyretics
  'paracetamol', 'acetaminophen', 'crocin', 'dolo', 'calpol', 'ibuprofen', 'brufen', 'combiflam', 'aspirin', 'disprin',
  'diclofenac', 'voveran', 'nimesulide', 'nise', 'aceclofenac', 'zerodol', 'tramadol', 'mefenamic', 'meftal',
  // antibiotics / antifungals / antiparasitics
  'azithromycin', 'azithral', 'azee', 'amoxicillin', 'augmentin', 'mox', 'cefixime', 'taxim', 'ciprofloxacin', 'ofloxacin',
  'levofloxacin', 'doxycycline', 'metronidazole', 'flagyl', 'norflox', 'clotrimazole', 'candid', 'fluconazole',
  'terbinafine', 'itraconazole', 'ketoconazole', 'luliconazole', 'albendazole', 'ivermectin', 'permethrin',
  // allergy / respiratory / GI
  'cetirizine', 'cetzine', 'levocetirizine', 'levocet', 'allegra', 'fexofenadine', 'montelukast', 'montair',
  'salbutamol', 'asthalin', 'budesonide', 'pantoprazole', 'pan-d', 'pan 40', 'omeprazole', 'rabeprazole', 'ranitidine',
  'rantac', 'famotidine', 'digene', 'gelusil', 'ondansetron', 'domperidone', 'loperamide', 'eldoper', 'electral',
  // chronic disease
  'metformin', 'glimepiride', 'gliclazide', 'sitagliptin', 'insulin', 'amlodipine', 'telmisartan', 'losartan',
  'atenolol', 'metoprolol', 'atorvastatin', 'rosuvastatin', 'ecosprin', 'clopidogrel', 'thyronorm', 'eltroxin',
  'levothyroxine',
  // steroids / topicals
  'prednisolone', 'dexamethasone', 'betamethasone', 'clobetasol', 'hydrocortisone', 'mometasone', 'betnovate',
  'panderm', 'quadriderm', 'candid-b', 'soframycin', 'neosporin', 'betadine', 'calamine', 'mupirocin', 't-bact',
  // generic medicine words
  'antibiotic', 'painkiller', 'steroid', 'ointment', 'syrup', 'capsule', 'injection',
  // Devanagari
  'पैरासिटामोल', 'क्रोसिन', 'डोलो', 'एंटीबायोटिक', 'दर्द निवारक',
];

export const CONDITION_NAMES: string[] = [
  'typhoid', 'malaria', 'dengue', 'chikungunya', 'covid', 'corona', 'influenza', 'viral fever', 'pneumonia',
  'tuberculosis', 'bronchitis', 'sinusitis', 'tonsillitis', 'pharyngitis', 'infection', 'diabetes', 'hypertension',
  'migraine', 'asthma', 'gastritis', 'acidity', 'gerd', 'reflux', 'ulcer', 'appendicitis', 'jaundice', 'hepatitis',
  'eczema', 'psoriasis', 'dermatitis', 'fungal', 'ringworm', 'scabies', 'urticaria', 'arthritis', 'osteoarthritis',
  'gout', 'thyroid disorder', 'hypothyroid', 'hyperthyroid', 'anaemia', 'anemia', 'cancer', 'tumour', 'tumor',
  'heart attack', 'angina', 'cardiac', 'stroke', 'depression', 'anxiety disorder', 'pcos', 'pcod', 'uti',
  'kidney stone', 'piles', 'hernia', 'sprain', 'fracture', 'ligament tear',
  // Hinglish / Hindi
  'daad', 'khujli ki bimari', 'pathri', 'peeliya', 'piliya', 'tb ', 'टाइफाइड', 'मलेरिया', 'डेंगू', 'पीलिया', 'मधुमेह',
  'कैंसर', 'संक्रमण', 'इन्फेक्शन',
];
