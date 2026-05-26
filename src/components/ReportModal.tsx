import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Download, Search } from 'lucide-react';
import { db } from '../lib/db';
import { AttendanceLog } from '../types';
import { format, differenceInMinutes, parseISO, isValid } from 'date-fns';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function ReportModal({ isOpen, onClose }: ReportModalProps) {
  const [eid, setEid] = useState('');
  const [monthIndex, setMonthIndex] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<AttendanceLog[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleGenerate = async () => {
    if (!eid.trim()) {
      alert('Please enter an EID.');
      return;
    }
    
    setIsLoading(true);
    setHasSearched(true);
    
    // First verify EID
    const emp = await db.getEmployee(eid);
    if (!emp) {
      alert('EID not found.');
      setIsLoading(false);
      setReportData([]);
      setSelectedEmp(null);
      return;
    }
    
    setSelectedEmp(emp);
    
    // Build date range for the month
    const startDate = new Date(year, monthIndex, 1);
    const endDate = new Date(year, monthIndex + 1, 0); // Last day of month
    
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    try {
      const logs = await db.getMonthlyLogs(eid, startStr, endStr);
      setReportData(logs);
    } catch (e: any) {
      alert('Error fetching logs: ' + e.message);
    }
    
    setIsLoading(false);
  };

  const calculateHours = (log: AttendanceLog) => {
    if (!log.start_time || !log.end_time) return '-';
    const start = parseISO(log.start_time);
    const end = parseISO(log.end_time);
    if (!isValid(start) || !isValid(end)) return '-';
    
    const mins = differenceInMinutes(end, start);
    if (mins <= 0) return '-';
    return (mins / 60).toFixed(2);
  };

  const totalHours = reportData.reduce((acc, log) => {
    const hrs = parseFloat(calculateHours(log));
    return isNaN(hrs) ? acc : acc + hrs;
  }, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    if (reportData.length === 0 || !selectedEmp) return;
    
    let csv = `Name:,${selectedEmp.name}\n`;
    csv += `EID:,${eid}\n`;
    csv += `Rate per Day:,${selectedEmp.rate_per_day || 0}\n`;
    csv += `PhilHealth:,${selectedEmp.philhealth || 0}\n`;
    csv += `Total Hours:,${totalHours.toFixed(2)}\n\n`;
    csv += `AC No,Name,Start Time,End Time,Date,Remarks,Tardiness,Undertime,Rate per Day,PhilHealth\n`;
    
    reportData.forEach(row => {
      const timeIn = row.start_time ? format(parseISO(row.start_time), 'H:mm:ss') : '';
      const timeOut = row.end_time ? format(parseISO(row.end_time), 'H:mm:ss') : '';
      const dateStr = row.date ? format(parseISO(row.date), 'MM/dd/yyyy') : '';
      const rem = (row.remarks || '').replace(/"/g, '""');
      const rate = selectedEmp.rate_per_day || 0;
      const phil = selectedEmp.philhealth || 0;
      
      csv += `${eid},"${selectedEmp.name}",${timeIn},${timeOut},${dateStr},"${rem}",${row.tardiness || 0},${row.undertime || 0},${rate},${phil}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Attendance_Report_${selectedEmp.name.replace(/\s/g, '_')}_${MONTHS[monthIndex]}.csv`;
    link.click();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/50 flex flex-col items-center justify-center p-4 backdrop-blur-sm print:bg-white print:p-0 print:block"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-4xl rounded-xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden print:shadow-none print:max-w-full print:max-h-full print:rounded-none border border-hd-line"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-hd-line bg-hd-bg print:hidden">
              <div>
                <h2 className="font-bold text-base text-hd-ink uppercase tracking-wider">Monthly Attendance Report</h2>
                <p className="text-xs text-hd-subtext mt-0.5">Generate, audit, and print monthly timesheets</p>
              </div>
              <button onClick={onClose} className="p-1.5 bg-[#f1f5f9] hover:bg-zinc-200 rounded-md transition-colors cursor-pointer border border-hd-line">
                <X className="w-4 h-4 text-hd-dark-subtext" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto print:overflow-visible print:p-4">
              
              <div className="flex flex-col md:flex-row gap-3 mb-6 print:hidden">
                <div className="flex-1">
                  <input 
                    type="text"
                    placeholder="Enter Employee ID (e.g. 251805)"
                    value={eid}
                    onChange={(e) => setEid(e.target.value)}
                    className="w-full bg-hd-bg border border-hd-line rounded-lg px-4 py-2.5 text-xs font-semibold text-hd-ink focus:outline-none focus:border-hd-accent focus:ring-1 focus:ring-hd-accent"
                  />
                </div>
                <div className="w-full md:w-44">
                  <select 
                    value={monthIndex}
                    onChange={(e) => setMonthIndex(Number(e.target.value))}
                    className="w-full bg-hd-bg border border-hd-line rounded-lg px-4 py-2.5 text-xs font-semibold text-hd-ink focus:outline-none focus:border-hd-accent focus:ring-1 focus:ring-hd-accent"
                  >
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <div className="w-full md:w-32">
                  <select 
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full bg-hd-bg border border-hd-line rounded-lg px-4 py-2.5 text-xs font-semibold text-hd-ink focus:outline-none focus:border-hd-accent focus:ring-1 focus:ring-hd-accent"
                  >
                    {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <button 
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="flex items-center justify-center bg-hd-accent hover:bg-[#3f38c9] text-white text-xs uppercase tracking-wider font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-sm shadow-hd-accent/10"
                >
                  <Search className="w-3.5 h-3.5 mr-2" />
                  {isLoading ? 'Searching...' : 'Generate'}
                </button>
              </div>

              {hasSearched && !isLoading && (
                <div className="report-container">
                  {reportData.length > 0 ? (
                    <>
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 pb-4 border-b border-hd-line">
                        <div>
                          <div className="text-[10px] uppercase font-bold tracking-widest text-hd-accent mb-1 font-mono">Generated Timesheet</div>
                          <h3 className="text-xl font-extrabold text-[#0f172a] tracking-tight">Report for {selectedEmp?.name || ''}</h3>
                          <p className="text-xs text-hd-subtext mt-0.5">{MONTHS[monthIndex]} {year} • Employee EID: <span className="font-bold text-[#0f172a] font-mono">{eid}</span></p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 font-bold text-xs rounded-md border border-blue-100 font-mono">Hours accrued: {totalHours.toFixed(2)} hrs</span>
                            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-md border border-emerald-100 font-mono">Rate: ₱{(selectedEmp?.rate_per_day || 0).toLocaleString()}/day</span>
                            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-800 font-bold text-xs rounded-md border border-indigo-100 font-mono">PhilHealth: ₱{(selectedEmp?.philhealth || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2 mt-4 md:mt-0 print:hidden justify-end">
                          <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-white hover:bg-hd-bg text-[#0f172a] font-bold text-xs uppercase tracking-wider rounded-lg border border-hd-line transition-colors cursor-pointer">
                            <Printer className="w-3.5 h-3.5 mr-2" /> Print
                          </button>
                          <button onClick={handleDownloadCsv} className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer animate-pulse-once">
                            <Download className="w-3.5 h-3.5 mr-2" /> Export CSV
                          </button>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto border border-hd-line rounded-lg print:border-none print:overflow-visible">
                        <table className="w-full text-left text-xs print:text-[8px] border-collapse bg-white">
                          <thead className="bg-[#f8fafc] text-hd-dark-subtext uppercase print:bg-gray-100 print:text-black font-bold tracking-wider text-[10px] print:text-[8px]">
                            <tr>
                              <th className="px-3 py-3 print:px-1.5 print:py-1 border-r border-b border-hd-line print:border-black font-bold">AC No</th>
                              <th className="px-3 py-3 print:px-1.5 print:py-1 border-r border-b border-hd-line print:border-black font-bold">Name</th>
                              <th className="px-3 py-3 print:px-1.5 print:py-1 border-r border-b border-hd-line print:border-black font-bold">Start Time</th>
                              <th className="px-3 py-3 print:px-1.5 print:py-1 border-r border-b border-hd-line print:border-black font-bold">End Time</th>
                              <th className="px-3 py-3 print:px-1.5 print:py-1 border-r border-b border-hd-line print:border-black font-bold">Date</th>
                              <th className="px-3 py-3 print:px-1.5 print:py-1 border-r border-b border-hd-line print:border-black font-bold">Remarks</th>
                              <th className="px-3 py-3 print:px-1.5 print:py-1 border-r border-b border-hd-line print:border-black font-bold text-right">Tardiness</th>
                              <th className="px-3 py-3 print:px-1.5 print:py-1 border-r border-b border-hd-line print:border-black font-bold text-right">Undertime</th>
                              <th className="px-3 py-3 print:px-1.5 print:py-1 border-r border-b border-hd-line print:border-black font-bold text-right">Rate/Day</th>
                              <th className="px-3 py-3 print:px-1.5 print:py-1 border-b border-hd-line print:border-black font-bold text-right">PhilHealth</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hd-line print:divide-y-0 text-[11px] print:text-[8px]">
                            {reportData.map((row, i) => (
                              <tr key={i} className="hover:bg-slate-50/50 print:hover:bg-transparent">
                                <td className="px-3 py-2.5 print:px-1.5 print:py-0.5 whitespace-nowrap border-r border-hd-line print:border-black font-semibold text-hd-dark-subtext font-mono">{eid}</td>
                                <td className="px-3 py-2.5 print:px-1.5 print:py-0.5 whitespace-nowrap border-r border-hd-line print:border-black font-bold text-hd-ink">{selectedEmp?.name || ''}</td>
                                <td className="px-3 py-2.5 print:px-1.5 print:py-0.5 whitespace-nowrap border-r border-hd-line print:border-black text-hd-ink font-mono">{row.start_time ? format(parseISO(row.start_time), 'H:mm:ss') : '--:--:--'}</td>
                                <td className="px-3 py-2.5 print:px-1.5 print:py-0.5 whitespace-nowrap border-r border-hd-line print:border-black text-hd-ink font-mono">{row.end_time ? format(parseISO(row.end_time), 'H:mm:ss') : '--:--:--'}</td>
                                <td className="px-3 py-2.5 print:px-1.5 print:py-0.5 whitespace-nowrap border-r border-hd-line print:border-black text-hd-dark-subtext font-mono">{row.date ? format(parseISO(row.date), 'yyyy-MM-dd') : ''}</td>
                                <td className="px-3 py-2.5 print:px-1.5 print:py-0.5 border-r border-hd-line print:border-black text-hd-dark-subtext italic max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{row.remarks || ''}</td>
                                <td className="px-3 py-2.5 print:px-1.5 print:py-0.5 whitespace-nowrap border-r border-hd-line print:border-black text-right font-medium font-mono">
                                  {row.tardiness && row.tardiness > 0 ? (
                                    <span className="text-[#991b1b] bg-[#fee2e2] px-1 py-0.5 rounded font-bold text-[10px] print:text-[8px]">{row.tardiness}m</span>
                                  ) : (
                                    <span className="text-hd-subtext/40">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 print:px-1.5 print:py-0.5 whitespace-nowrap border-r border-hd-line print:border-black text-right font-medium font-mono">
                                  {row.undertime && row.undertime > 0 ? (
                                    <span className="text-[#854d0e] bg-[#fef9c3] px-1 py-0.5 rounded font-bold text-[10px] print:text-[8px]">{row.undertime}m</span>
                                  ) : (
                                    <span className="text-hd-subtext/40">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 print:px-1.5 print:py-0.5 whitespace-nowrap border-r border-hd-line print:border-black text-right font-mono text-hd-dark-subtext">
                                  ₱{(selectedEmp?.rate_per_day || 0).toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 print:px-1.5 print:py-0.5 whitespace-nowrap text-right font-mono text-hd-dark-subtext">
                                  ₱{(selectedEmp?.philhealth || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-hd-line rounded-lg bg-[#f8fafc]/50">
                      <p className="text-hd-subtext font-semibold text-xs uppercase tracking-wider">No logs found for this period.</p>
                      <p className="text-[11px] text-hd-subtext/70 mt-1">Please ensure logs exist on selected date range.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
