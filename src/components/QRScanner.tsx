import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertTriangle, HelpCircle, AlertCircle, Upload, ExternalLink, Image } from 'lucide-react';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (eid: string) => void;
}

export function QRScanner({ isOpen, onClose, onScanSuccess }: QRScannerProps) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [scanError, setScanError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isIframe, setIsIframe] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const elementId = 'theory11-scanner-viewport';

  // Check if we are running nested inside an iframe on mount
  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      setIsIframe(true);
    }
  }, []);

  // play double soft high-pitched chirp on scan success
  const playSuccessBeep = () => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      
      const playChirp = (frequency: number, delayObj: number, dur: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + delayObj);
        gain.gain.setValueAtTime(0, audioCtx.currentTime + delayObj);
        gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + delayObj + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delayObj + dur);
        
        osc.start(audioCtx.currentTime + delayObj);
        osc.stop(audioCtx.currentTime + delayObj + dur);
      };

      // Friendly double-chirp chime
      playChirp(987.77, 0, 0.08); // B5
      playChirp(1318.51, 0.08, 0.12); // E6
    } catch (e) {
      console.warn('Web Audio Feedback failed', e);
    }
  };

  const processDecodedText = (decodedText: string) => {
    let cleanedEid = decodedText.trim();
    
    // Try to extract eid if it's JSON
    try {
      if (cleanedEid.startsWith('{')) {
        const parsed = JSON.parse(cleanedEid);
        if (parsed.eid) {
          cleanedEid = String(parsed.eid).trim();
        } else if (parsed.id) {
          cleanedEid = String(parsed.id).trim();
        }
      }
    } catch {
      // Not JSON, continue with raw text
    }

    // If it's a URL, extract code parameter if present, otherwise use last path segment
    if (cleanedEid.startsWith('http://') || cleanedEid.startsWith('https://')) {
      try {
        const url = new URL(cleanedEid);
        const isEidParam = url.searchParams.get('eid');
        if (isEidParam) {
          cleanedEid = isEidParam.trim();
        } else {
          const segments = url.pathname.split('/').filter(Boolean);
          if (segments.length > 0) {
            cleanedEid = segments[segments.length - 1].trim();
          }
        }
      } catch {
        // Safe ignore
      }
    }

    playSuccessBeep();
    onScanSuccess(cleanedEid);
  };

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsInitializing(true);
    setScanError('');

    const startScanner = async () => {
      try {
        // Stop any existing instance
        if (qrScannerRef.current) {
          try {
            await qrScannerRef.current.stop();
          } catch {
            // Safe ignore
          }
          qrScannerRef.current = null;
        }

        // Get list of cameras
        const devices = await Html5Qrcode.getCameras().catch(() => []);
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          // Fall back gracefully to upload/native camera snapshot instruction
          setScanError('Browser restricted real-time feed access inside this frame. Real-time stream requires HTTPS and direct permission flags.');
          setIsInitializing(false);
          return;
        }

        setCameras(devices);

        // Prefer back camera for smartphones
        const backCamera = devices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') || 
          device.label.toLowerCase().includes('environment')
        );

        const chosenCameraId = backCamera ? backCamera.id : devices[0].id;
        setActiveCameraId(chosenCameraId);

        // Instantiate scanner
        const scanner = new Html5Qrcode(elementId);
        qrScannerRef.current = scanner;

        await scanner.start(
          chosenCameraId,
          {
            fps: 15,
            qrbox: (width, height) => {
              const minDim = Math.min(width, height);
              const customSize = Math.floor(minDim * 0.7);
              return { width: customSize, height: customSize };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            processDecodedText(decodedText);
          },
          () => {
            // Keep scan silent for scan misses to prevent lag
          }
        );

        setIsInitializing(false);
      } catch (err: any) {
        console.error('Error starting Html5Qrcode', err);
        if (isMounted) {
          const defaultMsg = 'Camera streaming is restricted. Please grant device permissions or use the "Snapshot Fallback" below, which always works.';
          setScanError(err.message || defaultMsg);
          setIsInitializing(false);
        }
      }
    };

    // Delays slightly to allow DOM ref to load cleanly
    const timer = setTimeout(() => {
      startScanner();
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(err => {
          console.warn('Silent stop error on unmount', err);
        });
      }
    };
  }, [isOpen]);

  const handleCameraToggle = async () => {
    if (cameras.length <= 1 || !qrScannerRef.current) return;
    
    const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    
    setIsInitializing(true);
    setScanError('');

    try {
      await qrScannerRef.current.stop();
      setActiveCameraId(nextCamera.id);

      await qrScannerRef.current.start(
        nextCamera.id,
        {
          fps: 15,
          qrbox: (width, height) => {
            const minDim = Math.min(width, height);
            const customSize = Math.floor(minDim * 0.7);
            return { width: customSize, height: customSize };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          processDecodedText(decodedText);
        },
        () => {}
      );
      setIsInitializing(false);
    } catch (err: any) {
      setScanError('Failed to switch camera: ' + (err.message || err));
      setIsInitializing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsInitializing(true);
    setScanError('');

    try {
      // Decode QR dynamically using static file scan
      const engine = new Html5Qrcode(elementId);
      const decodedText = await engine.scanFile(file, false);
      processDecodedText(decodedText);
      setIsInitializing(false);
    } catch (err: any) {
      console.error('Static image scan failed', err);
      setScanError('Could not decode QR. Please make sure the QR image is well-aligned and in focus.');
      setIsInitializing(false);
    }
  };

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a]/95 flex flex-col justify-between p-6 backdrop-blur-md text-white select-none">
      {/* Hidden fallback file uploader */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-100">QR Code Scanner</h3>
            <p className="text-[10px] text-slate-400 font-medium">Position your attendance QR code in the viewport</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 bg-slate-800 hover:bg-slate-700/80 rounded-full transition-all border border-slate-700 cursor-pointer text-slate-300 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Viewport Container */}
      <div className="flex-1 my-6 flex flex-col items-center justify-center relative">
        <div className="w-full max-w-sm aspect-square bg-[#020617] rounded-3xl overflow-hidden relative border-2 border-slate-800 shadow-2xl">
          
          {/* Scanner active element */}
          <div id={elementId} className="w-full h-full" />

          {/* Pulse Overlay Sight lines */}
          {!scanError && !isInitializing && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Scan Line Laser Anim */}
              <div className="absolute left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent top-1/2 -translate-y-1/2 animate-bounce flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,1)]" />
              
              {/* Corner brackets */}
              <div className="absolute top-[18%] left-[18%] w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-md" />
              <div className="absolute top-[18%] right-[18%] w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-md" />
              <div className="absolute bottom-[18%] left-[18%] w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-md" />
              <div className="absolute bottom-[18%] right-[18%] w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-md" />
            </div>
          )}

          {/* Initializing / Loading indicator */}
          {isInitializing && !scanError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020617]/90 text-center px-6">
              <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-3" />
              <p className="text-xs text-slate-300 font-semibold tracking-wide">INITIALIZING CAMERA</p>
              <p className="text-[10px] text-slate-500 mt-1">Requesting direct frame pipeline access...</p>
            </div>
          )}

          {/* Error fallback / Friendly context switch guide */}
          {scanError && (
            <div className="absolute inset-0 bg-[#0c1020]/95 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <AlertCircle className="w-9 h-9 text-blue-400" />
              <div className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">Camera Pipeline Blocked</div>
              
              <div className="text-[11px] text-slate-300 leading-normal max-w-xs space-y-1">
                {isIframe ? (
                  <p>Browsers block real-time camera streaming inside sandboxed preview iframes for privacy.</p>
                ) : (
                  <p>Direct camera streaming is restricted in this context. You can bypass this instantly using the camera snapshot trigger below!</p>
                )}
              </div>

              <div className="flex flex-col gap-2 w-full max-w-[240px] pt-2">
                {/* Instant bypass file trigger */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10"
                >
                  <Camera className="w-4 h-4" />
                  Take Instant Photo
                </button>

                {isIframe && (
                  <button
                    onClick={handleOpenNewTab}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700/80 text-blue-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer border border-slate-700/80 flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in New Tab
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer controls for camera switching / instructions */}
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex justify-center gap-2">
          {cameras.length > 1 && !scanError && (
            <button
              onClick={handleCameraToggle}
              disabled={isInitializing || !!scanError}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700/80 active:scale-95 text-xs text-slate-200 font-bold uppercase tracking-wider py-2.5 px-6 rounded-full border border-slate-700/80 transition-all cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
              <span>Switch Camera</span>
            </button>
          )}

          {/* Snapshot button visible at all times as a convenient alternative */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 bg-[#1e293b]/90 hover:bg-slate-800 text-xs text-blue-400 font-bold uppercase tracking-wider py-2.5 px-6 rounded-full border border-blue-500/10 transition-all cursor-pointer shadow-lg"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload or Snap QR</span>
          </button>
        </div>

        <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/30 text-center">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {isIframe 
              ? "Running in secure sandbox mode. Keep the QR code steady, choose 'Take Instant Photo', or open the app in a new tab for automatic real-time flow!"
              : "Facing camera trouble? Choose 'Upload or Snap QR' to snap a quick photo using your mobile OS camera application or load an image containing the code."
            }
          </p>
        </div>
      </div>
    </div>
  );
}

