export interface Employee {
  id?: number | string;
  eid: string;
  name: string;
  rate_per_day?: number;
  philhealth?: number;
}

export interface AttendanceLog {
  id?: number | string;
  eid: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  date: string;
  remarks: string;
  tardiness: number;
  undertime: number;
}

export interface QueuedPunch {
  id: string;
  eid: string;
  type: 'IN' | 'OUT';
  timestamp: string; // ISO string
  remarks: string;
}

export type AdminRole = 'ROOT' | 'TEAMS' | null;
