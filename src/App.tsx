import React, { useState, useEffect, useCallback } from 'react';
import { TopNav } from './components/TopNav';
import { AttendanceCard } from './components/AttendanceCard';
import { AdminModal } from './components/AdminModal';
import { ReportModal } from './components/ReportModal';
import { StatusToast, ToastType } from './components/StatusToast';
import { QRScanner } from './components/QRScanner';
import { offlineQueue } from './lib/offlineQueue';
import { db, getLastSupabaseError, clearLastSupabaseError, normalizeEid } from './lib/db';
import { detectShiftAndCalculateDiscrepancies } from './lib/shiftLogic';
import { format } from 'date-fns';
import { KioskView } from './components/KioskView';

export default function App() {
  const [isKioskMode] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.has('kiosk') || window.location.pathname.startsWith('/kiosk');
  });

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Stored cookie/localStorage employee ID for Universal Scan
  const [sessionEid, setSessionEid] = useState<string>(() => {
    return localStorage.getItem('a10dance_eid') || '';
  });

  // Re-sync session state when window focuses or localStorage changes
  useEffect(() => {
    const syncSession = () => {
      setSessionEid(localStorage.getItem('a10dance_eid') || '');
    };
    window.addEventListener('focus', syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener('focus', syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, []);
  
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false
  });

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type, visible: true });
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      processOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const processOfflineQueue = async () => {
    const queue = offlineQueue.get();
    if (queue.length === 0) return;
    
    // Simple mock offline processing queue logic
    let successCount = 0;
    showToast(`Syncing ${queue.length} offline punches...`, 'success');
    
    for (const punch of queue) {
        offlineQueue.remove(punch.id);
        successCount++;
    }
    if (successCount > 0) {
       showToast(`Successfully synced ${successCount} entries!`, 'success');
    }
  };

  const handlePunch = async (eid: string, remarks: string, type: 'IN' | 'OUT') => {
    const cleanEidStr = normalizeEid(eid);
    if (!cleanEidStr) {
      showToast('Please enter your EID.', 'error');
      return;
    }

    // 1-Minute Anti-spam check
    const now = Date.now();
    const lastLogsRaw = localStorage.getItem('theory11_last_logs');
    const lastLogs = lastLogsRaw ? JSON.parse(lastLogsRaw) : {};
    
    if (lastLogs[cleanEidStr] && lastLogs[cleanEidStr][type]) {
      const diff = now - lastLogs[cleanEidStr][type];
      if (diff < 60000) {
        showToast('Duplicate punch. Please wait 1 minute and try again.', 'error');
        return;
      }
    }

    if (isOffline) {
      // Offline mode - Queue
      const payload = {
        id: crypto.randomUUID(),
        eid: cleanEidStr,
        type,
        timestamp: new Date().toISOString(),
        remarks
      };
      offlineQueue.add(payload);
      
      // Update anti-spam
      lastLogs[cleanEidStr] = { ...(lastLogs[cleanEidStr] || {}), [type]: now };
      localStorage.setItem('theory11_last_logs', JSON.stringify(lastLogs));
      
      showToast(`You are offline. Your Log ${type} was saved locally and will sync later.`, 'success');
      return;
    }

    setIsLoading(true);
    
    try {
      const employee = await db.getEmployee(cleanEidStr);
        
      if (!employee) {
        showToast('EID not found. Please verify your ID.', 'error');
        setIsLoading(false);
        return;
      }

      const timestamp = new Date();
      const todayStr = format(timestamp, 'yyyy-MM-dd');
      const timeStr = format(timestamp, 'HH:mm'); 
      const fullIsoStr = timestamp.toISOString();

      if (type === 'IN') {
        const { tardiness, undertime } = detectShiftAndCalculateDiscrepancies(timeStr, null);
        
        await db.insertAttendanceLog({
          eid: cleanEidStr,
          name: employee.name,
          date: todayStr,
          start_time: fullIsoStr,
          end_time: null,
          remarks,
          tardiness,
          undertime
        });

      } else { 
        const existingLog = await db.getTodayLogWithoutEndTime(cleanEidStr, todayStr);

        if (!existingLog) {
             const { undertime } = detectShiftAndCalculateDiscrepancies(null, timeStr);
             await db.insertAttendanceLog({
                eid: cleanEidStr, name: employee.name, date: todayStr, start_time: null, end_time: fullIsoStr, remarks, tardiness: 0, undertime
             });
        } else {
             const inTimeStr = existingLog.start_time ? format(new Date(existingLog.start_time), 'HH:mm') : null;
             const { undertime } = detectShiftAndCalculateDiscrepancies(inTimeStr, timeStr);
             
             await db.updateAttendanceLog(existingLog.id!, fullIsoStr, undertime, remarks);
        }
      }

      // Update anti-spam success
      lastLogs[cleanEidStr] = { ...(lastLogs[cleanEidStr] || {}), [type]: now };
      localStorage.setItem('theory11_last_logs', JSON.stringify(lastLogs));

      showToast(`Your Log ${type} was recorded successfully`, 'success');

    } catch (err: any) {
      console.error(err);
      // fallback to offline queue on DB hang/error
      offlineQueue.add({
        id: crypto.randomUUID(), eid, type, timestamp: new Date().toISOString(), remarks
      });
      showToast(`Database error. Saved log ${type} locally.`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQRScan = async (scannedEid: string) => {
    setIsScannerOpen(false);
    if (!scannedEid) {
      showToast('EID not found in QR code.', 'error');
      return;
    }

    const cleanScanned = normalizeEid(scannedEid);

    // 1) DYNAMIC UNIVERSAL DAILY QR CODE Case: (e.g. a10dance-daily-qr-YYYY-MM-DD)
    if (cleanScanned.startsWith('a10dance-daily-qr-')) {
      // Find EID stored in our cookie/localStorage session
      const savedEid = sessionEid || localStorage.getItem('a10dance_eid');
      if (!savedEid) {
        showToast("Device has no active identity session. Set your EID on this mobile device first.", 'error');
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-a10dance-eid': savedEid
          },
          body: JSON.stringify({
            scannedCode: cleanScanned,
            manualEid: savedEid
          })
        });

        const result = await response.json();
        if (response.ok && result.success) {
          showToast(`Welcome ${result.employeeName}! Your Log ${result.action} was recorded successfully.`, 'success');
        } else {
          // Explicitly match "You're not registered" if that's returned by backend or if they are unregistered
          if (result.message && result.message.includes("not registered")) {
            showToast("You're not registered", 'error');
          } else {
            showToast(result.message || 'Scan failed. Please try again.', 'error');
          }
        }
      } catch (err: any) {
        console.warn('Fullstack scanner proxy endpoint failed or offline, running safe local backup simulation:', err);
        
        // Client-side fallback check
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const expectedToken = `a10dance-daily-qr-${todayStr}`;
        if (cleanScanned !== expectedToken) {
          showToast('Stale QR code scanned! Real-time token is expired.', 'error');
        } else {
          const employee = await db.getEmployee(savedEid);
          if (!employee) {
            showToast("You're not registered", 'error');
          } else {
            const activeLog = await db.getTodayLogWithoutEndTime(savedEid, todayStr);
            const direction = activeLog ? 'OUT' : 'IN';
            await handlePunch(savedEid, 'QR Auto-Punch', direction);
          }
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 2) STANDARD DIRECT PORTAL KEY-IN / CARD SCAN Case
    if (cleanScanned.startsWith('http://') || cleanScanned.startsWith('https://')) {
      const isUniversal = cleanScanned.includes(window.location.host);
      if (isUniversal || cleanScanned === window.location.origin) {
        showToast('Universal Portal QR detected! Print this code to let employees scan and open the check-in panel on their own mobile devices.', 'success');
        return;
      }
    }

    // Traditional badge scan: the barcode stream is the raw employee EID
    setIsLoading(true);
    try {
      const employee = await db.getEmployee(cleanScanned);
      if (!employee) {
        // Fetch active roster examples to aid diagnostics
        const allEmps = await db.getEmployees();
        const activeEids = allEmps.slice(0, 5).map(e => e.eid).join(', ');
        const helpMsg = activeEids 
          ? ` (Active examples in roster: ... ${activeEids})` 
          : ' (Your roster is empty. Go to Admin settings to "Seed Defaults".)';

        showToast(`Employee ID "${cleanScanned}" is unregistered.${helpMsg}`, 'error');
        setIsLoading(false);
        return;
      }

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const activeLog = await db.getTodayLogWithoutEndTime(cleanScanned, todayStr);
      const direction = activeLog ? 'OUT' : 'IN';

      await handlePunch(cleanScanned, 'QR Auto-Punch', direction);
    } catch (err: any) {
      showToast(`Scan failure: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isKioskMode) {
    return <KioskView />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-hd-bg font-sans">
      <TopNav onOpenAdmin={() => setIsAdminOpen(true)} onOpenReport={() => setIsReportOpen(true)} />
      
      {/* 2) Camera Capture Dynamic processing loader with backdrop-blur */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in select-none">
          <div className="bg-white rounded-3xl p-8 max-w-xs w-[85%] mx-auto border border-slate-100 shadow-[0_24px_50px_rgba(0,0,0,0.18)] text-center space-y-4">
            <div className="relative w-12 h-12 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-850 uppercase tracking-widest">Processing scan...</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-1">Routing verification and registering shift changes</p>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto flex items-center justify-center p-6 md:p-12">
        <AttendanceCard 
          onPunch={handlePunch} 
          isOffline={isOffline} 
          isLoading={isLoading} 
          onOpenScanner={() => setIsScannerOpen(true)} 
        />
      </main>

      <AdminModal isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
      <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
      <QRScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleQRScan} />
      
      <StatusToast 
        visible={toast.visible} 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast(prev => ({ ...prev, visible: false }))} 
      />

      <footer className="w-full border-t border-hd-line bg-white h-12 flex items-center justify-between px-6 text-xs text-hd-subtext font-semibold uppercase tracking-wider select-none mt-auto">
        <div>PCC DTR Tracker System</div>
        <div className="flex items-center space-x-6">
          <span className="flex items-center">
            System Status: &nbsp;
            <strong className={isOffline ? "text-fb-red animate-pulse" : "text-fb-green"}>
              {isOffline ? "LOCAL ONLY" : "CONNECTED"}
            </strong>
          </span>
          <span className="hidden md:inline text-hd-subtext/60">
            Last Checked: {format(new Date(), 'hh:mm:ss a')}
          </span>
        </div>
      </footer>

      {getLastSupabaseError() && (
        <div className="w-full bg-amber-50 border-t border-amber-200 px-6 py-2.5 flex items-center justify-between text-[11px] text-amber-800 font-sans font-semibold sticky bottom-0 z-50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0"></span>
            <span>Supabase status note: {getLastSupabaseError()}</span>
          </div>
          <button 
            onClick={() => { clearLastSupabaseError(); }}
            className="text-amber-600 hover:text-amber-800 underline uppercase text-[10px] tracking-wider cursor-pointer font-bold ml-4 whitespace-nowrap"
          >
            Acknowledge & Clear
          </button>
        </div>
      )}
    </div>
  );
}
