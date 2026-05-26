import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { detectShiftAndCalculateDiscrepancies } from './src/lib/shiftLogic';
import { SEED_EMPLOYEES } from './src/lib/seedEmployees';

dotenv.config();

// Decodes, parses, and cleans any raw barcode, QR code or keyed-in Employee ID string
function normalizeEid(raw: string): string {
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

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://frbweyvhfrxxkjoolakh.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyYndleXZoZnJ4eGtqb29sYWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NzM2NTYsImV4cCI6MjA5NTI0OTY1Nn0.d5syhFoBhaGJ0VCEWUZ58I8LU6xLnh7UvYsHRhEzFtI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
};

const formatTime = (d: Date): string => {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// API Endpoint for processing dynamic Universal QR code scans
app.post('/api/scan', async (req: express.Request, res: express.Response) => {
  try {
    const { scannedCode, manualEid } = req.body;

    // 1) Permanent Session Lookup: reads from cookie direct
    const cookies = parseCookies(req.headers.cookie);
    let rawEid = cookies['a10dance_eid'] || manualEid || req.headers['x-a10dance-eid'];

    if (!rawEid) {
      return res.status(401).json({
        success: false,
        message: "No identified employee session found. Please save your EID on this device first."
      });
    }

    const cleanedEid = normalizeEid(String(rawEid));
    if (!cleanedEid) {
      return res.status(401).json({
        success: false,
        message: "Invalid or empty employee session ID format."
      });
    }

    // 2) Parse scanned dynamic barcode token
    if (!scannedCode) {
      return res.status(400).json({
        success: false,
        message: "Scanning aborted: barcode stream is empty."
      });
    }

    // Daily code formula matching standard format: a10dance-daily-qr-[YYYY-MM-DD]
    const todayStr = new Date().toISOString().split('T')[0]; // Current local date
    const expectedToken = `a10dance-daily-qr-${todayStr}`;

    // Gracefully check yesterday's token as well to account for timezone drift or shift transitions
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const expectedYesterdayToken = `a10dance-daily-qr-${yesterdayStr}`;

    const isTokenValid = (scannedCode === expectedToken) || (scannedCode === expectedYesterdayToken);

    if (!isTokenValid) {
      return res.status(400).json({
        success: false,
        message: `Stale or invalid Universal QR code. Scan the newly refreshed code from the Admin panel.`
      });
    }

    // 3) Identity Verification & Registration Guard
    const strippedEid = cleanedEid.replace(/-/g, '');
    const altEid = cleanedEid.includes('-')
      ? cleanedEid
      : (cleanedEid.length === 6 ? `${cleanedEid.slice(0, 4)}-${cleanedEid.slice(4)}` : cleanedEid);
    const searchEids = Array.from(new Set([cleanedEid, strippedEid, altEid].map(x => x.trim())));

    let { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('*')
      .in('eid', searchEids)
      .limit(1)
      .maybeSingle();

    if (empErr) {
      console.error('Supabase registration verification check failed:', empErr);
    }

    // Auto-seeding / self-healing fallback for default employees
    if (!employee) {
      const defaultEmp = SEED_EMPLOYEES.find(e => {
        const defaultEid = e.eid.trim();
        const defaultStripped = defaultEid.replace(/-/g, '');
        return searchEids.some(x => x === defaultEid || x === defaultStripped);
      });

      if (defaultEmp) {
        console.log(`Self-healing backend roster: Auto-seeding employee ${defaultEmp.name} (${defaultEmp.eid}) on scan`);
        const { data: insertedEmp, error: insertError } = await supabase
          .from('employees')
          .insert({
            eid: defaultEmp.eid.trim(),
            name: defaultEmp.name.trim(),
            full_name: defaultEmp.name.trim(),
            rate_per_day: Number(defaultEmp.rate_per_day) || 850,
            philhealth: Number(defaultEmp.philhealth) || 120
          })
          .select()
          .maybeSingle();

        if (!insertError && insertedEmp) {
          employee = insertedEmp;
        } else {
          employee = {
            id: 9999,
            eid: defaultEmp.eid,
            name: defaultEmp.name,
            full_name: defaultEmp.name,
            rate_per_day: defaultEmp.rate_per_day,
            philhealth: defaultEmp.philhealth
          } as any;
        }
      }
    }

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "You're not registered"
      });
    }

    // Handle optional backend validation field if explicitly requested or flagged
    if ('registered' in employee && employee.registered === false) {
      return res.status(403).json({
        success: false,
        message: "You're not registered"
      });
    }

    const eid = employee.eid;

    // 4) Smart Auto-Toggle State Engine & Duplicate Scan Prevention
    const nowLocal = new Date();
    const nowIso = nowLocal.toISOString();
    const dateStr = nowIso.split('T')[0];
    const timeStr = formatTime(nowLocal);

    // Get the most recent punch trace to prevent double-clicks
    const { data: lastLog, error: fetchErr } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', eid)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.warn('Could not read from attendance logs table in Supabase:', fetchErr);
    }

    // Duplicate Scan Prevention: if scanned within 30 seconds, reject safely
    if (lastLog && lastLog.timestamp) {
      const lastTime = new Date(lastLog.timestamp).getTime();
      const diffSecs = (Date.now() - lastTime) / 1000;
      if (diffSecs < 30) {
        return res.status(429).json({
          success: false,
          isDuplicate: true,
          message: `Duplicate scan. Please wait ${Math.ceil(30 - diffSecs)}s and scan again.`
        });
      }
    }

    // Determine direction
    let action: 'LOGIN' | 'LOGOUT' = 'LOGIN';
    if (lastLog) {
      action = lastLog.action === 'LOGIN' ? 'LOGOUT' : 'LOGIN';
    }

    // 5) Multi-Table Retention Syncing in Supabase
    // Insert trace in table 'attendance'
    const { error: insertErr } = await supabase
      .from('attendance')
      .insert({
        employee_id: eid,
        action: action,
        source: 'SCAN',
        timestamp: nowIso
      });

    if (insertErr) {
      console.warn('Failed to insert record into the logs table (it might need database scheme update):', insertErr.message);
    }

    // Insert/Update shift state in table 'attendance_sessions'
    if (action === 'LOGIN') {
      const { error: sessErr } = await supabase
        .from('attendance_sessions')
        .insert({
          employee_id: eid,
          login_at: nowIso,
          logout_at: null,
          date: dateStr
        });
      if (sessErr) console.error('Error starting attendance session:', sessErr.message);
    } else {
      // Find active open session
      const { data: openSess } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('employee_id', eid)
        .is('logout_at', null)
        .order('login_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openSess) {
        const { error: updateSessErr } = await supabase
          .from('attendance_sessions')
          .update({ logout_at: nowIso })
          .eq('id', openSess.id);
        if (updateSessErr) console.error('Error updating attendance session:', updateSessErr.message);
      } else {
        // Fallback: create closed session
        const { error: insertSessErr } = await supabase
          .from('attendance_sessions')
          .insert({
            employee_id: eid,
            login_at: nowIso,
            logout_at: nowIso,
            date: dateStr
          });
        if (insertSessErr) console.error('Error inserting fall session:', insertSessErr.message);
      }
    }

    // Sync to secondary legacy 'attendance_logs' table for retroactive dashboard reports compatibility
    try {
      if (action === 'LOGIN') {
        const { tardiness, undertime } = detectShiftAndCalculateDiscrepancies(timeStr, null);
        await supabase
          .from('attendance_logs')
          .insert({
            eid: eid,
            name: employee.name || employee.full_name || 'Crew Member',
            date: dateStr,
            start_time: nowIso,
            end_time: null,
            remarks: 'QR Auto-Punch',
            tardiness,
            undertime
          });
      } else {
        const { data: activeLog } = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('eid', eid)
          .eq('date', dateStr)
          .is('end_time', null)
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!activeLog) {
          const { undertime } = detectShiftAndCalculateDiscrepancies(null, timeStr);
          await supabase
            .from('attendance_logs')
            .insert({
              eid: eid,
              name: employee.name || employee.full_name || 'Crew Member',
              date: dateStr,
              start_time: null,
              end_time: nowIso,
              remarks: 'QR Auto-Punch',
              tardiness: 0,
              undertime
            });
        } else {
          const inTimeStr = activeLog.start_time ? formatTime(new Date(activeLog.start_time)) : null;
          const { undertime } = detectShiftAndCalculateDiscrepancies(inTimeStr, timeStr);
          const legacyCombinedRemarks = activeLog.remarks ? (activeLog.remarks + ' | QR Auto-Punch') : 'QR Auto-Punch';
          
          await supabase
            .from('attendance_logs')
            .update({
              end_time: nowIso,
              undertime,
              remarks: legacyCombinedRemarks
            })
            .eq('id', activeLog.id);
        }
      }
    } catch (legacyErr: any) {
      console.warn('Legacy logs sync failed:', legacyErr);
    }

    return res.status(200).json({
      success: true,
      action: action,
      employeeName: employee.name || 'Crew Member',
      timestamp: nowIso
    });

  } catch (err: any) {
    console.error('Core scan API script failure:', err);
    return res.status(500).json({
      success: false,
      message: err.message || "An error occurred during system scan processing."
    });
  }
});

// Mount Vite middleware or Static asset serves
async function startApp() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Theory11 DTR Server] running on http://localhost:${PORT}`);
  });
}

startApp();
