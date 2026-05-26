import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, WifiOff, QrCode, Clock, Keyboard, MessageSquare, Check, Sparkles, UserCheck } from 'lucide-react';

interface AttendanceCardProps {
  onPunch: (eid: string, remarks: string, type: 'IN' | 'OUT') => Promise<void>;
  isOffline: boolean;
  isLoading: boolean;
  onOpenScanner: () => void;
}

export function AttendanceCard({ onPunch, isOffline, isLoading, onOpenScanner }: AttendanceCardProps) {
  const [eid, setEid] = useState('');
  const [remarks, setRemarks] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showManualForm, setShowManualForm] = useState(false);

  // Device registration for Permanent Session Cookie (a10dance_eid)
  const [deviceEid, setDeviceEid] = useState<string>(() => {
    return localStorage.getItem('a10dance_eid') || '';
  });
  const [tempEid, setTempEid] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [showIdSetup, setShowIdSetup] = useState(false);

  // Maintain ticking digital clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const registerDevice = () => {
    const clean = tempEid.trim();
    if (!clean) return;
    localStorage.setItem('a10dance_eid', clean);
    const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
    document.cookie = `a10dance_eid=${encodeURIComponent(clean)}; expires=${expires}; path=/; SameSite=Lax`;
    setDeviceEid(clean);
    setTempEid('');
    setStatusMsg('Saved browser session!');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const removeDevice = () => {
    localStorage.removeItem('a10dance_eid');
    document.cookie = "a10dance_eid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax";
    setDeviceEid('');
    setStatusMsg('Session cleared.');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handlePunch = async (type: 'IN' | 'OUT') => {
    if (!eid.trim()) {
       return onPunch('', '', type); 
    }
    await onPunch(eid.trim(), remarks.trim(), type);
    setEid('');
    setRemarks('');
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-5 animate-fade-in select-none">
      
      {/* 1) Modern Social App Clock Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl -ml-5 -mb-5" />
        
        <div className="relative z-10 flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[11px] font-extrabold tracking-wider uppercase mb-3">
            <Sparkles className="w-3 h-3 animate-pulse" />
            Standard Local Time
          </span>
          <div className="text-4xl font-black tracking-tight text-slate-800 tabular-nums">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-xs text-slate-400 font-semibold mt-1">
            {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Permanent Identity Session Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative">
        <div className="flex items-center justify-between">
          <div className="text-left w-[65%]">
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Mobile Device Session</span>
            {deviceEid ? (
              <span className="block text-xs font-black text-slate-700 mt-0.5 truncate">Identified: <span className="text-blue-600 font-mono">{deviceEid}</span></span>
            ) : (
              <span className="block text-xs font-bold text-slate-500 mt-0.5">No crew session cookie active</span>
            )}
          </div>
          <button
            onClick={() => setShowIdSetup(!showIdSetup)}
            className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[11px] rounded-xl border border-slate-200 uppercase tracking-wide cursor-pointer transition-colors"
          >
            {deviceEid ? "Configure" : "Set EID"}
          </button>
        </div>

        {statusMsg && (
          <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100/60 mt-3 text-center">{statusMsg}</p>
        )}

        {showIdSetup && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3.5 text-left animate-slide-down">
            {deviceEid ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">Your browser currently holds a permanent <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-blue-600 text-[10px]">a10dance_eid</code> cookie. There is no need to log in daily. If this is a shared device, clear the session below.</p>
                <button
                  onClick={removeDevice}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Clear Device Session
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">Save your Employee ID onto this smartphone browser. It pins your session so you only have to scan the tablet's dynamic QR code with your camera.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempEid}
                    onChange={(e) => setTempEid(e.target.value)}
                    placeholder="Enter EID (e.g. 251805)"
                    className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                  <button
                    onClick={registerDevice}
                    disabled={!tempEid.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2) Main Social-themed Scanner Action Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center relative overflow-hidden">
        <div className="flex items-center justify-between mb-5 select-none">
          <div className="text-left">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-500" />
              Timesheet Log
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">Punch using your QR code or manual key</p>
          </div>
          
          {isOffline && (
            <div className="flex items-center text-[10px] font-extrabold tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full uppercase border border-amber-100 animate-pulse">
              <WifiOff className="w-3 h-3 mr-1 text-amber-500" />
              Queue Offline
            </div>
          )}
        </div>

        {/* Scan Button trigger for smartphone cameras */}
        <div className="space-y-4">
          <button
            onClick={onOpenScanner}
            disabled={isLoading}
            className="w-full group bg-blue-600 hover:bg-blue-500 hover:scale-[1.01] active:scale-[0.99] text-white rounded-2xl p-5 flex flex-col items-center justify-center gap-2.5 transition-all shadow-[0_12px_24px_rgba(37,99,235,0.18)] cursor-pointer disabled:opacity-50"
            style={{ minHeight: '130px' }}
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="block font-black text-base uppercase tracking-wider">Scan Attendance QR</span>
              <span className="block text-[11px] font-medium text-blue-100/95 mt-0.5">Compatible with iOS & Android Camera</span>
            </div>
          </button>

          {/* Toggle manual entry choice */}
          <div className="flex items-center justify-center pt-2">
            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer border border-slate-100"
            >
              <Keyboard className="w-3.5 h-3.5 text-slate-500" />
              <span>{showManualForm ? "Hide Manual Form" : "Or Key-In Employee EID"}</span>
            </button>
          </div>
        </div>

        {/* 3) Toggled Accordion Form for EID Key-in */}
        {showManualForm && (
          <div className="mt-5 pt-5 border-t border-slate-100 space-y-4 text-left animate-slide-down">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Employee ID (EID)</label>
              <input
                type="text"
                value={eid}
                onChange={(e) => setEid(e.target.value)}
                placeholder="e.g. 251805"
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 text-sm font-extrabold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400 placeholder:font-normal"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-slate-400" /> Optional Remarks / Purpose
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Field assignment, Client meeting"
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 text-xs text-slate-700 resize-none h-16 focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                disabled={isLoading}
              />
            </div>

            <div className="flex space-x-3 pt-1">
              <button
                onClick={() => handlePunch('IN')}
                disabled={isLoading || !eid.trim()}
                className="flex-1 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm shadow-blue-600/10"
              >
                <LogIn className="w-3.5 h-3.5 mr-1.5" />
                IN
              </button>
              <button
                onClick={() => handlePunch('OUT')}
                disabled={isLoading || !eid.trim()}
                className="flex-1 flex items-center justify-center bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm shadow-orange-500/10"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                OUT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
