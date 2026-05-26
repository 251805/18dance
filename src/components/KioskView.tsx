import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Clock, QrCode, Check, Copy } from 'lucide-react';
import { format } from 'date-fns';

export function KioskView() {
  const [time, setTime] = useState(new Date());
  const [copied, setCopied] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = format(time, 'yyyy-MM-dd');
  const qrCodeValue = `a10dance-daily-qr-${todayStr}`;
  const displayTime = format(time, 'hh:mm:ss a');
  const displayDate = format(time, 'EEEE, MMMM dd, yyyy');

  const kioskUrl = `${window.location.origin}/?kiosk=true`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(kioskUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy kiosk URL:', err);
    }
  };

  const handleExit = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12 relative overflow-hidden font-sans select-none selection:bg-blue-600/30">
      {/* Background Decorative Mesh Filters */}
      <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-blue-900/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-20%] w-[80%] h-[80%] bg-indigo-950/20 rounded-full blur-[150px] pointer-events-none" />

      {/* Top Navigation / Status Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/[0.06] pb-6 z-10">
        <div className="flex items-center gap-3">
          <img 
            src="https://raw.githubusercontent.com/251805/18dance/main/PCCLogo.png" 
            alt="PCC Logo" 
            className="w-11 h-11 object-contain rounded-xl bg-white/5 p-1 border border-white/10 shadow-md"
          />
          <div>
            <h1 className="text-lg font-black tracking-tight text-white font-sans uppercase">
              Pagbilao Command Center
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#10b981]">
                System is online
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            title="Copy Permanent Kiosk Web Link"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied URL!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Link
              </>
            )}
          </button>

          <button
            onClick={handleExit}
            className="px-3.5 py-2 bg-red-950/40 hover:bg-red-900/40 text-red-300 hover:text-red-200 border border-red-500/20 hover:border-red-500/30 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exit
          </button>
        </div>
      </div>

      {/* Main Focus: Dynamic Attendance QR Code and Live Clock Grid */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 my-8 z-10 w-full max-w-5xl mx-auto">
        {/* Left Side: Rich Digital Clock Panel */}
        <div className="flex flex-col justify-center text-center lg:text-left space-y-4 lg:w-1/2">
          <div className="inline-flex py-1.5 px-3 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-bold tracking-wider uppercase font-mono self-center lg:self-start gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Live GMT+8 System Time
          </div>

          <div className="space-y-1">
            <div className="text-5xl md:text-6xl xl:text-7xl font-black tracking-tight text-white font-mono uppercase bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              {displayTime}
            </div>
            <div className="text-sm md:text-base font-semibold text-slate-400 tracking-wide">
              {displayDate}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-2.5 max-w-sm mx-auto lg:mx-0 text-xs">
            <div className="uppercase font-bold text-[10px] text-zinc-500 tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              QR Code
            </div>
            <p className="text-slate-400 leading-relaxed font-medium">
              No need to print or copy QR expires daily.
            </p>
          </div>
        </div>

        {/* Right Side: Big High-Contrast QR Badge Card */}
        <div className="bg-white text-slate-900 rounded-[32px] p-8 md:p-10 flex flex-col items-center justify-center text-center shadow-2xl border border-slate-200/20 max-w-sm w-full transition-transform hover:scale-[1.01]">
          <div className="space-y-1 select-none">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-extrabold tracking-wider uppercase font-mono">
              Live Scanner Station
            </span>
            <h3 className="text-xl font-black text-slate-900 tracking-tight font-sans">
              Scan Daily QR
            </h3>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
              Pagbilao Command Center
            </p>
          </div>

          {/* Large Dynamic QR Code Container */}
          <div className="p-5 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center shadow-inner mt-6 aspect-square w-full">
            <QRCodeSVG value={qrCodeValue} size={256} className="w-full h-full max-w-[240px] max-h-[240px]" level="H" />
          </div>

          <div className="w-full mt-6 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2">
            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wide select-none">
              Active Security Hash
            </div>
            <p className="text-[10px] font-bold text-slate-600 font-mono tracking-tight truncate select-all">
              {qrCodeValue}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Instructions Section */}
      <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500 font-semibold uppercase tracking-wider z-10 w-full">
        <div>Pagbilao Command Center Daily Time Record System</div>
        <div className="flex items-center gap-1.5 font-bold text-[10px] text-slate-400">
          <QrCode className="w-3.5 h-3.5 text-blue-500" />
          Direct camera scan authorized
        </div>
      </div>
    </div>
  );
}
