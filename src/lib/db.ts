import { supabase } from './supabase';
import { Employee, AttendanceLog } from '../types';
import { SEED_EMPLOYEES } from './seedEmployees';

const LOCAL_EMPLOYEES_KEY = 'theory11_local_employees';
const LOCAL_ATTENDANCE_KEY = 'theory11_local_attendance';

let lastSupabaseError: string | null = null;

export const getLastSupabaseError = () => lastSupabaseError;
export const clearLastSupabaseError = () => { lastSupabaseError = null; };

// Decodes, parses, and cleans any raw barcode, QR code or keyed-in Employee ID string
export function normalizeEid(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();

  // Strip wrapping quotes
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Try parsing as JSON
  if (cleaned.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.eid) cleaned = String(parsed.eid).trim();
      else if (parsed.id) cleaned = String(parsed.id).trim();
      else if (parsed.employeeId) cleaned = String(parsed.employeeId).trim();
      else if (parsed.employee_id) cleaned = String(parsed.employee_id).trim();
    } catch {
      // Safe ignore
    }
  }

  // Parse if it's a URL
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const url = new URL(cleaned);
      const possibleKeys = ['eid', 'id', 'empid', 'emp_id', 'employee_id', 'employee'];
      let foundParam = '';
      for (const key of possibleKeys) {
        const val = url.searchParams.get(key);
        if (val) {
          foundParam = val.trim();
          break;
        }
      }
      if (foundParam) {
        cleaned = foundParam;
      } else {
        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length > 0) {
          cleaned = segments[segments.length - 1].trim();
        }
      }
    } catch {
      // Safe ignore
    }
  }

  return cleaned.trim();
}

// Helper to check if real Supabase should be bypassed/is a mockup placeholder
const isPlaceholderSupabase = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return false; // Default fallback to your live Supabase configuration is active!
  return url.includes('placeholder-project');
};

// Initialize helper for local backup database
export function initializeLocalDB() {
  const storedEmps = localStorage.getItem(LOCAL_EMPLOYEES_KEY);
  if (!storedEmps) {
    // Populate with 21 seed employees provided by the user
    const preparedSeeds: Employee[] = SEED_EMPLOYEES.map((emp, index) => ({
      id: `local-emp-${index + 1}`,
      eid: emp.eid,
      name: emp.name,
      rate_per_day: emp.rate_per_day,
      philhealth: emp.philhealth
    }));
    localStorage.setItem(LOCAL_EMPLOYEES_KEY, JSON.stringify(preparedSeeds));
  } else {
    // Merge new seeds (like alternate EID formats) if they don't exist in local localStorage cache
    try {
      const parsed: Employee[] = JSON.parse(storedEmps);
      let updated = false;
      SEED_EMPLOYEES.forEach((seed, index) => {
        if (!parsed.some(e => e.eid === seed.eid)) {
          parsed.push({
            id: `local-emp-new-${index}-${Date.now()}`,
            eid: seed.eid,
            name: seed.name,
            rate_per_day: seed.rate_per_day,
            philhealth: seed.philhealth
          });
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem(LOCAL_EMPLOYEES_KEY, JSON.stringify(parsed));
      }
    } catch {
      // Safe reset on parsing error
      const preparedSeeds: Employee[] = SEED_EMPLOYEES.map((emp, index) => ({
        id: `local-emp-reset-${index + 1}`,
        eid: emp.eid,
        name: emp.name,
        rate_per_day: emp.rate_per_day,
        philhealth: emp.philhealth
      }));
      localStorage.setItem(LOCAL_EMPLOYEES_KEY, JSON.stringify(preparedSeeds));
    }
  }
}

// Ensure database fallback initialization triggers on load
initializeLocalDB();

// Local Storage operations
const getLocalEmployees = (): Employee[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_EMPLOYEES_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveLocalEmployees = (emps: Employee[]) => {
  localStorage.setItem(LOCAL_EMPLOYEES_KEY, JSON.stringify(emps));
};

const getLocalAttendanceLogs = (): AttendanceLog[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_ATTENDANCE_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveLocalAttendanceLogs = (logs: AttendanceLog[]) => {
  localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(logs));
};

export const db = {
  // Check if we are currently online and using a fully operational Supabase connection
  isMockMode: (): boolean => {
    return isPlaceholderSupabase();
  },

  // Get single employee by EID
  getEmployee: async (eid: string): Promise<Employee | null> => {
    const cleanEid = normalizeEid(eid);
    if (!cleanEid) return null;

    const strippedEid = cleanEid.replace(/-/g, '');
    const altEid = cleanEid.includes('-') 
      ? cleanEid 
      : (cleanEid.length === 6 ? `${cleanEid.slice(0, 4)}-${cleanEid.slice(4)}` : cleanEid);
    
    const candidates = Array.from(new Set([cleanEid, strippedEid, altEid].map(c => c.trim())));

    if (isPlaceholderSupabase()) {
      const emps = getLocalEmployees();
      return emps.find(e => {
        const ee = normalizeEid(e.eid);
        const eeStripped = ee.replace(/-/g, '');
        return candidates.includes(ee) || candidates.includes(eeStripped);
      }) || null;
    }

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .in('eid', candidates)
        .limit(1)
        .maybeSingle();

      if (error) {
        lastSupabaseError = error.message;
        console.error('Supabase getEmployee error:', error);
      }

      if (data) {
        return data;
      }

      // If not in Supabase, check local list of defaults
      const emps = getLocalEmployees();
      const localEmp = emps.find(e => {
        const ee = normalizeEid(e.eid);
        const eeStripped = ee.replace(/-/g, '');
        return candidates.includes(ee) || candidates.includes(eeStripped);
      });

      if (localEmp) {
        // Self-heal: insert client-found local/seed employee to live Supabase on the fly so syncing works!
        console.log(`Self-healing roster in Supabase: registering ${localEmp.name} (${localEmp.eid})`);
        const { data: serverEmp, error: saveErr } = await supabase
          .from('employees')
          .insert({
            eid: localEmp.eid.trim(),
            name: localEmp.name.trim(),
            full_name: localEmp.name.trim(),
            rate_per_day: Number(localEmp.rate_per_day) || 0,
            philhealth: Number(localEmp.philhealth) || 0
          })
          .select()
          .maybeSingle();

        if (!saveErr && serverEmp) {
          return serverEmp;
        }
        return localEmp;
      }

      return null;
    } catch (e: any) {
      lastSupabaseError = e?.message || String(e);
      const emps = getLocalEmployees();
      return emps.find(e => {
        const ee = normalizeEid(e.eid);
        const eeStripped = ee.replace(/-/g, '');
        return candidates.includes(ee) || candidates.includes(eeStripped);
      }) || null;
    }
  },

  // Get all employees (Roster)
  getEmployees: async (): Promise<Employee[]> => {
    if (isPlaceholderSupabase()) {
      return getLocalEmployees();
    }

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');
      
      if (error) {
        lastSupabaseError = error.message;
        throw error;
      }
      return data || [];
    } catch (e: any) {
      lastSupabaseError = e?.message || String(e);
      console.warn('Supabase fetch employees failed, falling back to local database:', e);
      return getLocalEmployees();
    }
  },

  // Upsert or Save array of employees
  saveEmployeeRoster: async (employeesArray: Employee[]): Promise<void> => {
    // Always keep local updated
    saveLocalEmployees(employeesArray);

    if (isPlaceholderSupabase()) {
      return;
    }

    try {
      const toUpsert = employeesArray.filter(e => e.eid && e.name).map(e => ({
        id: typeof e.id === 'string' && e.id.startsWith('local-') ? undefined : e.id,
        eid: e.eid.trim(),
        name: e.name.trim(),
        full_name: e.name.trim(),
        rate_per_day: Number(e.rate_per_day) || 0,
        philhealth: Number(e.philhealth) || 0
      }));

      const { error } = await supabase.from('employees').upsert(toUpsert, { onConflict: 'eid' });
      if (error) throw error;
    } catch (e) {
      console.error('Failed to sync to Supabase, but saved to local fallback repository.', e);
      throw e;
    }
  },

  // Delete an employee from roster
  deleteEmployee: async (id: string | number): Promise<void> => {
    const emps = getLocalEmployees();
    const updated = emps.filter(e => String(e.id) !== String(id));
    saveLocalEmployees(updated);

    if (isPlaceholderSupabase()) {
      return;
    }

    if (typeof id === 'string' && id.startsWith('local-')) {
      return; // Not on live supabase anyway
    }

    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.error('Failed to delete on Supabase:', e);
      throw e;
    }
  },

  // Seed / force overwrite mock employees to Supabase
  syncSeedToSupabase: async (): Promise<{ count: number }> => {
    if (isPlaceholderSupabase()) {
      throw new Error('Supabase project has not been configured in .env variables.');
    }

    const toUpsert = SEED_EMPLOYEES.map(e => ({
      eid: e.eid.trim(),
      name: e.name.trim(),
      full_name: e.name.trim(),
      rate_per_day: Number(e.rate_per_day) || 0,
      philhealth: Number(e.philhealth) || 0
    }));

    const { error } = await supabase.from('employees').upsert(toUpsert, { onConflict: 'eid' });
    if (error) throw error;
    return { count: toUpsert.length };
  },

  // Record a physical Log check-in
  insertAttendanceLog: async (log: Omit<AttendanceLog, 'id'>): Promise<void> => {
    const localLogs = getLocalAttendanceLogs();
    const newId = `local-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newLog: AttendanceLog = { ...log, id: newId };
    localLogs.push(newLog);
    saveLocalAttendanceLogs(localLogs);

    if (isPlaceholderSupabase()) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .insert(log)
        .select()
        .single();
      
      if (error) {
        lastSupabaseError = error.message;
        throw error;
      }

      if (data && data.id) {
        // Sync the newly received ID back into the local log so that update works correctly
        const currentLogs = getLocalAttendanceLogs();
        const index = currentLogs.findIndex(l => l.eid === log.eid && l.date === log.date && !l.end_time);
        if (index !== -1) {
          currentLogs[index].id = data.id;
          saveLocalAttendanceLogs(currentLogs);
        }
      }
    } catch (e: any) {
      lastSupabaseError = e?.message || String(e);
      console.warn('Supabase sync insert failed, queued to local reports list.', e);
    }
  },

  // Retrieve today's active log (clock-in already exists but no clock-out yet)
  getTodayLogWithoutEndTime: async (eid: string, todayStr: string): Promise<AttendanceLog | null> => {
    if (isPlaceholderSupabase()) {
      const logs = getLocalAttendanceLogs();
      const matched = logs
        .filter(l => l.eid === eid && l.date === todayStr && !l.end_time)
        .sort((a, b) => {
          const tA = a.start_time ? new Date(a.start_time).getTime() : 0;
          const tB = b.start_time ? new Date(b.start_time).getTime() : 0;
          return tB - tA;
        });
      return matched[0] || null;
    }

    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('eid', eid)
        .eq('date', todayStr)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        lastSupabaseError = error.message;
      }

      if (error || !data) {
        // Local fallback
        const logs = getLocalAttendanceLogs();
        const matched = logs
          .filter(l => l.eid === eid && l.date === todayStr && !l.end_time)
          .sort((a, b) => {
            const tA = a.start_time ? new Date(a.start_time).getTime() : 0;
            const tB = b.start_time ? new Date(b.start_time).getTime() : 0;
            return tB - tA;
          });
        return matched[0] || null;
      }
      return data;
    } catch (e: any) {
      lastSupabaseError = e?.message || String(e);
      const logs = getLocalAttendanceLogs();
      const matched = logs
        .filter(l => l.eid === eid && l.date === todayStr && !l.end_time)
        .sort((a, b) => {
          const tA = a.start_time ? new Date(a.start_time).getTime() : 0;
          const tB = b.start_time ? new Date(b.start_time).getTime() : 0;
          return tB - tA;
        });
      return matched[0] || null;
    }
  },

  // Update existing clock-in with matching clock-out data
  updateAttendanceLog: async (
    id: string | number, 
    end_time: string, 
    undertime: number, 
    remarks: string
  ): Promise<void> => {
    const localLogs = getLocalAttendanceLogs();
    const idx = localLogs.findIndex(l => String(l.id) === String(id));
    let localRecord = idx !== -1 ? localLogs[idx] : null;
    if (idx !== -1) {
      localLogs[idx] = {
        ...localLogs[idx],
        end_time,
        undertime,
        remarks: (localLogs[idx].remarks ? localLogs[idx].remarks + ' | ' : '') + remarks
      };
      saveLocalAttendanceLogs(localLogs);
      localRecord = localLogs[idx];
    }

    if (isPlaceholderSupabase()) {
      return;
    }

    try {
      let supabaseId: string | number | null = null;

      if (typeof id === 'string' && id.startsWith('local-')) {
        // Check if there's an active matching record on Supabase for this EID/date
        if (localRecord) {
          const { data: matched } = await supabase
            .from('attendance_logs')
            .select('id')
            .eq('eid', localRecord.eid)
            .eq('date', localRecord.date)
            .is('end_time', null)
            .maybeSingle();

          if (matched && matched.id) {
            supabaseId = matched.id;
            // Sync the real ID back local for any future references
            if (idx !== -1) {
              const currentLogs = getLocalAttendanceLogs();
              if (currentLogs[idx]) {
                currentLogs[idx].id = matched.id;
                saveLocalAttendanceLogs(currentLogs);
              }
            }
          } else {
            // No uncompleted record found on Supabase. Insert a completed log instead!
            const logToInsert = {
              eid: localRecord.eid,
              name: localRecord.name,
              date: localRecord.date,
              start_time: localRecord.start_time,
              end_time: end_time,
              remarks: localRecord.remarks,
              tardiness: localRecord.tardiness || 0,
              undertime: undertime
            };
            const { data: newRow, error: insertErr } = await supabase
              .from('attendance_logs')
              .insert(logToInsert)
              .select()
              .single();

            if (insertErr) {
              lastSupabaseError = insertErr.message;
              throw insertErr;
            }

            if (newRow && newRow.id) {
              if (idx !== -1) {
                const currentLogs = getLocalAttendanceLogs();
                if (currentLogs[idx]) {
                  currentLogs[idx].id = newRow.id;
                  saveLocalAttendanceLogs(currentLogs);
                }
              }
            }
            return;
          }
        } else {
          return;
        }
      } else {
        supabaseId = id;
      }

      if (supabaseId) {
        const { data: matchedLog, error: selectErr } = await supabase
          .from('attendance_logs')
          .select('remarks')
          .eq('id', supabaseId)
          .maybeSingle();

        if (selectErr) {
          lastSupabaseError = selectErr.message;
        }

        const combinedRemarks = matchedLog ? ((matchedLog.remarks ? matchedLog.remarks + ' | ' : '') + remarks) : remarks;

        const { error } = await supabase
          .from('attendance_logs')
          .update({
            end_time,
            undertime,
            remarks: combinedRemarks
          })
          .eq('id', supabaseId);

        if (error) {
          lastSupabaseError = error.message;
          throw error;
        }
      }
    } catch (e: any) {
      lastSupabaseError = e?.message || String(e);
      console.error('Failed to update live log:', e);
    }
  },

  // Get logs in date range (monthly report)
  getMonthlyLogs: async (eid: string, startStr: string, endStr: string): Promise<AttendanceLog[]> => {
    const localLogs = getLocalAttendanceLogs()
      .filter(l => l.eid === eid && l.date >= startStr && l.date <= endStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (isPlaceholderSupabase()) {
      return localLogs;
    }

    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('eid', eid)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch {
      return localLogs;
    }
  }
};
