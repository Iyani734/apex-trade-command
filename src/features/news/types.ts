export type Impact = 'High' | 'Medium' | 'Low' | 'Holiday';

export interface NewsEvent {
  id: string;            // stable hash
  title: string;
  country: string;       // currency code: USD, EUR, GBP, JPY...
  date: string;          // ISO datetime
  impact: Impact;
  forecast?: string;
  previous?: string;
  actual?: string;
  url?: string;
}

export interface Reminder {
  eventId: string;
  minutesBefore: number; // 5, 15, 30, 60
  createdAt: number;
}
