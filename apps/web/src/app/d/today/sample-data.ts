/**
 * FICTIONAL sample data for the doctor dashboard preview (spec §15 seed people). Replaced by the real
 * queue and summaries in Phase 2. Summary lines are the patient's facts only — no assessment, no
 * diagnosis, no advice (golden rules 1, 2, 5).
 */
export interface QueueRow {
  id: string;
  time: string;
  medicosId: string;
  label: string;
  complaint: string;
  status: 'ready' | 'progress' | 'walkin' | 'idle';
  safety?: boolean;
  followUp?: boolean;
  summary?: {
    files: string[];
    thirty: string[];
    subjective: Array<{ text: string; quote: string }>;
    objective: Array<{ text: string; quote: string }>;
  };
}

export const SAMPLE_QUEUE: QueueRow[] = [
  {
    id: 'q1',
    time: '09:30',
    medicosId: 'MED-7K4P-29XA',
    label: 'RM · 28 M',
    complaint: 'Fever for 2 days, sore throat',
    status: 'ready',
    summary: {
      files: ['Old prescription.jpg'],
      thirty: ['Fever for 2 days, highest 101°F at home', 'Sore throat; no cough', 'No known allergies', 'Wants to ask when he can return to work'],
      subjective: [
        { text: 'Chief complaint: fever for 2 days', quote: '2 din se bukhar hai' },
        { text: 'Highest temperature 101°F, worse at night', quote: '101 tak gaya, raat ko zyada' },
        { text: 'Sore throat; denies cough', quote: 'gale mein kharash, khansi nahi' },
        { text: 'Concern: missing work', quote: 'kaam par kab ja paunga?' },
      ],
      objective: [{ text: 'Home temperature 101°F (yesterday evening)', quote: 'kal shaam 101 tha' }],
    },
  },
  {
    id: 'q2',
    time: '10:00',
    medicosId: 'MED-9N2B-4FQH',
    label: 'RK · 46 M',
    complaint: 'Burning in chest after meals, 2 weeks',
    status: 'ready',
    safety: true,
    followUp: true,
    summary: {
      files: ['Lipid report Mar 2026.pdf', 'Strip photo.jpg'],
      thirty: ['Burning in chest after meals for 2 weeks, worse at night', 'Smokes about 10 a day', 'Takes a BP tablet daily (strip photo attached)', 'Safety message was shown during the interview'],
      subjective: [
        { text: 'Burning sensation in chest after meals for 2 weeks', quote: 'khana khane ke baad chhati mein jalan, 2 hafte se' },
        { text: 'Worse at night and after spicy food', quote: 'raat ko zyada, teekha khane se badhta hai' },
        { text: 'Smokes about 10 cigarettes a day', quote: 'roz 10 cigarette' },
      ],
      objective: [{ text: 'Home BP 138/88 (yesterday)', quote: 'BP 138/88 kal' }],
    },
  },
  { id: 'q3', time: '10:30', medicosId: 'MED-6D8M-1ZPR', label: 'MED-6D8M-1ZPR', complaint: 'Knee pain for 3 months', status: 'progress' },
  { id: 'q4', time: '11:00', medicosId: 'MED-3K8V-71NA', label: 'MED-3K8V-71NA', complaint: 'Itchy rash on both forearms', status: 'walkin' },
  { id: 'q5', time: '11:30', medicosId: 'MED-5R3J-90BK', label: 'MED-5R3J-90BK', complaint: '—', status: 'idle' },
  { id: 'q6', time: '12:00', medicosId: 'MED-8P6K-14ZM', label: 'MED-8P6K-14ZM', complaint: '—', status: 'idle' },
];
