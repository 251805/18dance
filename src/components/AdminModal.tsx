import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Trash2, Plus, QrCode } from 'lucide-react';
import { AdminRole, Employee } from '../types';
import { db, initializeLocalDB } from '../lib/db';
import { QRCodeSVG } from 'qrcode.react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminModal({ isOpen, onClose }: AdminModalProps) {
  const [role, setRole] = useState<AdminRole>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [showUniversalQR, setShowUniversalQR] = useState(false);

  useEffect(() => {
    if (role && isOpen) {
      fetchEmployees();
    }
  }, [role, isOpen]);

  const handleLogin = () => {
    setErrorMsg('');
    const u = username.trim().toLowerCase();
    const p = password.trim();

    if (u === 'lee' && (p === 'metallica' || p === 'METALLICA')) {
      setRole('ROOT');
    } else if (u === 'admin' && p === '2026pcc2026') {
      setRole('TEAMS');
    } else {
      setErrorMsg('Invalid administrative credentials.');
    }
  };

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await db.getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error(error);
      setErrorMsg('Failed to load employees.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRow = () => {
    setEmployees([{ eid: '', name: '', rate_per_day: 0, philhealth: 0 }, ...employees]);
  };

  const handleEmployeeChange = (index: number, field: keyof Employee, value: string | number) => {
    const updated = [...employees];
    updated[index] = { ...updated[index], [field]: value };
    setEmployees(updated);
  };

  const handleDelete = async (index: number) => {
    const emp = employees[index];
    if (emp.id) {
      const confirmDelete = window.confirm(`Are you sure you want to delete ${emp.name}?`);
      if (!confirmDelete) return;
      setIsLoading(true);
      try {
        await db.deleteEmployee(emp.id);
      } catch (error: any) {
        alert('Failed to delete employee: ' + error.message);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }
    const updated = [...employees];
    updated.splice(index, 1);
    setEmployees(updated);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await db.saveEmployeeRoster(employees);
      alert('Changes saved successfully!');
      fetchEmployees();
    } catch (error: any) {
      setErrorMsg('Failed to save changes: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const showQrCode = (eid: string) => {
    setQrCodeData(eid);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-4xl rounded-xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden border border-hd-line"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-hd-line bg-hd-bg">
              <div>
                <h2 className="font-bold text-base text-hd-ink uppercase tracking-wider">
                  {role ? `Admin Workspace (${role})` : 'Administrative Login'}
                </h2>
                <p className="text-xs text-hd-subtext mt-0.5">Manage system access, updates, and employee rosters</p>
              </div>
              <div className="flex items-center space-x-2">
                {role && (
                  <button 
                    onClick={() => {
                      setRole(null);
                      setUsername('');
                      setPassword('');
                      setShowUniversalQR(false);
                      setQrCodeData(null);
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#991b1b] font-extrabold text-xs uppercase tracking-wider rounded-lg border border-rose-200 transition-colors cursor-pointer"
                  >
                    Log Out
                  </button>
                )}
                <button onClick={() => { onClose(); setQrCodeData(null); }} className="p-1.5 bg-[#f1f5f9] hover:bg-zinc-200 rounded-md transition-colors cursor-pointer border border-hd-line">
                  <X className="w-4 h-4 text-hd-dark-subtext" />
                </button>
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
                {!role ? (
                  <div className="max-w-sm mx-auto space-y-4 py-8">
                    <div>
                      <label className="block text-[11px] font-bold text-hd-dark-subtext uppercase tracking-wider mb-1.5">User Account</label>
                      <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-hd-bg border border-hd-line rounded-lg px-4 py-2.5 text-hd-ink font-semibold focus:outline-none focus:border-hd-accent focus:ring-1 focus:ring-hd-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-hd-dark-subtext uppercase tracking-wider mb-1.5">Security Password</label>
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-hd-bg border border-hd-line rounded-lg px-4 py-2.5 text-hd-ink font-semibold focus:outline-none focus:border-hd-accent focus:ring-1 focus:ring-hd-accent"
                      />
                    </div>
                    {errorMsg && <p className="text-fb-red text-xs font-semibold text-center">{errorMsg}</p>}
                    <button 
                      onClick={handleLogin}
                      className="w-full bg-hd-accent hover:bg-[#3f38c9] text-white font-semibold py-2.5 rounded-lg transition-colors cursor-pointer text-sm shadow-sm"
                    >
                      Login
                    </button>
                  </div>
                ) : qrCodeData ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-6">
                    <h3 className="font-bold text-base text-hd-ink uppercase tracking-wider">System QR Code for EID: {qrCodeData}</h3>
                    <div className="p-5 bg-white rounded-xl shadow-md border border-hd-line">
                       <QRCodeSVG value={qrCodeData} size={256} />
                    </div>
                    <button 
                      onClick={() => setQrCodeData(null)}
                      className="px-6 py-2 bg-hd-bg hover:bg-zinc-200 text-hd-ink font-semibold rounded-lg transition-all border border-hd-line text-xs uppercase tracking-wider cursor-pointer"
                    >
                      Back to Roster
                    </button>
                  </div>
                ) : showUniversalQR ? (
                  <div className="space-y-6 flex flex-col items-center justify-center py-6">
                    <div className="w-full flex justify-between items-center pb-4 border-b border-hd-line print:hidden select-none">
                      <div>
                        <h3 className="font-extrabold text-sm text-hd-ink uppercase tracking-widest flex items-center gap-2">
                          <QrCode className="w-5 h-5 text-blue-600 animate-pulse" />
                          Universal Access QR
                        </h3>
                        <p className="text-xs text-hd-subtext mt-0.5">Generate and print the main check-in portal QR code</p>
                      </div>
                      <button 
                        onClick={() => setShowUniversalQR(false)}
                        className="px-4 py-2 bg-hd-bg hover:bg-zinc-200 text-hd-ink font-semibold rounded-lg border border-hd-line text-xs uppercase tracking-wider cursor-pointer font-sans"
                      >
                        Back to Roster
                      </button>
                    </div>

                    <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-lg relative print:border-none print:shadow-none print:p-0">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-extrabold tracking-wider uppercase mb-1 print:hidden font-mono">
                        Kiosk & Mobile Access Node
                      </span>
                      <h4 className="text-lg font-black text-slate-800 tracking-tight font-sans">Pagbilao Command Center</h4>
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5 mb-6">Daily Time Record System</p>

                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shadow-inner print:bg-white print:border-none">
                        <QRCodeSVG value={`a10dance-daily-qr-${new Date().toISOString().split('T')[0]}`} size={220} level="H" />
                      </div>

                      <p className="text-[11px] font-bold text-slate-600 font-mono tracking-tight mt-6 bg-slate-100 px-3 py-1.5 rounded-lg max-w-full truncate">
                        Daily Code: a10dance-daily-qr-{new Date().toISOString().split('T')[0]}
                      </p>

                      <div className="text-left bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-6 space-y-2 max-w-sm print:hidden font-sans">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">How to use:</div>
                        <p className="text-[11px] text-slate-600 leading-normal">
                          <strong>1. Print Badge:</strong> Laminate and mount this QR code near the workspace entrance or dynamic station terminals.
                        </p>
                        <p className="text-[11px] text-slate-600 leading-normal">
                          <strong>2. Scan Attendance:</strong> Crew members scan this QR code with their mobile cameras to automatically register/access the DTR system.
                        </p>
                      </div>

                      <div className="mt-8 flex gap-3 print:hidden w-full">
                        <button 
                          onClick={() => window.print()}
                          className="w-full flex items-center justify-center gap-1.5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                          Print Universal QR
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <h3 className="font-bold text-sm text-hd-ink uppercase tracking-wider">Employee Roster List</h3>
                        <p className="text-xs text-hd-subtext">Add or modify crew details, day rates, and insurances</p>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={handleAddRow}
                          className="flex items-center px-3.5 py-1.5 bg-hd-bg hover:bg-zinc-200 text-hd-ink font-semibold text-xs uppercase tracking-wider rounded-lg transition-colors border border-hd-line cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add 
                        </button>
                        <button 
                          onClick={() => setShowUniversalQR(true)}
                          className="flex items-center px-3.5 py-1.5 bg-[#eff6ff] hover:bg-[#dbeafe] text-blue-700 font-extrabold text-xs uppercase tracking-wider rounded-lg transition-colors border border-blue-200 cursor-pointer shadow-sm"
                        >
                          <QrCode className="w-3.5 h-3.5 mr-1 text-blue-600" /> Universal QR
                        </button>
                        <button 
                          onClick={async () => {
                            if (window.confirm('This will load all 21 preset employees from the seed directory. Proceed?')) {
                              setIsLoading(true);
                              try {
                                if (!db.isMockMode()) {
                                  await db.syncSeedToSupabase();
                                  alert('Successfully seeded 21 employees onto Supabase!');
                                } else {
                                  localStorage.removeItem('theory11_local_employees');
                                  initializeLocalDB();
                                  alert('Successfully seeded 21 default employees locally!');
                                }
                                fetchEmployees();
                              } catch (e: any) {
                                alert('Error syncing seed: ' + e.message);
                              } finally {
                                setIsLoading(false);
                              }
                            }
                          }}
                          disabled={isLoading}
                          className="flex items-center px-3.5 py-1.5 bg-[#fef08a] hover:bg-[#fde047] text-zinc-900 font-extrabold text-xs uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-sm border border-[#facc15]"
                        >
                          <Save className="w-3.5 h-3.5 mr-1 text-zinc-900" /> Seed Defaults
                        </button>
                        <button 
                          onClick={handleSave}
                          disabled={isLoading}
                          className="flex items-center px-3.5 py-1.5 bg-hd-accent hover:bg-[#3f38c9] text-white font-semibold text-xs uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                        >
                          <Save className="w-3.5 h-3.5 mr-1" /> Save All
                        </button>
                      </div>
                    </div>
                    {errorMsg && <p className="text-fb-red text-xs font-semibold">{errorMsg}</p>}
                    
                    <div className="overflow-x-auto border border-hd-line rounded-lg">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-[#f8fafc] text-hd-dark-subtext border-b border-hd-line uppercase tracking-wider font-bold">
                          <tr>
                            <th className="px-4 py-3 border-r border-hd-line">EID</th>
                            <th className="px-4 py-3 border-r border-hd-line">Full Name</th>
                            <th className="px-4 py-3 text-right border-r border-hd-line">Rate / Day</th>
                            <th className="px-4 py-3 text-right border-r border-hd-line">PhilHealth</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hd-line">
                          {employees.map((emp, idx) => (
                            <tr key={emp.id || `new-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-2 border-r border-hd-line">
                                <input 
                                  type="text" 
                                  value={emp.eid} 
                                  onChange={(e) => handleEmployeeChange(idx, 'eid', e.target.value)}
                                  className="w-24 px-2 py-1 bg-white border border-hd-line rounded font-semibold text-[13px] text-hd-ink focus:border-hd-accent focus:outline-none"
                                />
                              </td>
                              <td className="px-4 py-2 border-r border-hd-line">
                                  <input 
                                    type="text" 
                                    value={emp.name} 
                                    onChange={(e) => handleEmployeeChange(idx, 'name', e.target.value)}
                                    className="w-full min-w-[200px] px-2 py-1 bg-white border border-hd-line rounded text-[13px] text-hd-ink focus:border-hd-accent focus:outline-none"
                                  />
                              </td>
                              <td className="px-4 py-2 border-r border-hd-line">
                                <input 
                                  type="number" 
                                  value={emp.rate_per_day || ''} 
                                  onChange={(e) => handleEmployeeChange(idx, 'rate_per_day', e.target.value)}
                                  className="w-24 text-right px-2 py-1 bg-white border border-hd-line rounded text-[13px] text-hd-ink focus:border-hd-accent focus:outline-none ml-auto block"
                                />
                              </td>
                              <td className="px-4 py-2 border-r border-hd-line">
                                <input 
                                  type="number" 
                                  value={emp.philhealth || ''} 
                                  onChange={(e) => handleEmployeeChange(idx, 'philhealth', e.target.value)}
                                  className="w-24 text-right px-2 py-1 bg-white border border-hd-line rounded text-[13px] text-hd-ink focus:border-hd-accent focus:outline-none ml-auto block"
                                />
                              </td>
                              <td className="px-4 py-2 flex justify-center items-center">
                                <button 
                                  onClick={() => handleDelete(idx)}
                                  title="Delete"
                                  className="p-1.5 text-fb-red hover:text-white hover:bg-fb-red bg-rose-50 rounded transition-colors cursor-pointer border border-rose-200"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {employees.length === 0 && !isLoading && (
                            <tr>
                              <td colSpan={5} className="px-4 py-12 text-center text-hd-subtext font-medium bg-[#f8fafc]/30">
                                No employees found in the roster. Add one to begin.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
