import React from 'react';
import { Settings, FileText } from 'lucide-react';

interface TopNavProps {
  onOpenAdmin: () => void;
  onOpenReport: () => void;
}

export function TopNav({ onOpenAdmin, onOpenReport }: TopNavProps) {
  return (
    <header className="bg-white w-full border-b border-hd-line h-16 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center space-x-3">
        {/* Corrected Raw GitHub Asset URL */}
        <img 
          src="https://raw.githubusercontent.com/251805/18dance/main/PCCLogo.png" 
          alt="PCC Logo" 
          className="w-9 h-9 object-contain rounded-lg shadow-sm"
        />
        <div>
          <h1 className="text-base font-bold text-hd-ink leading-tight">Pagbilao Command Center</h1>
          <div className="text-[10px] font-medium tracking-wider text-hd-subtext uppercase">DTR Tracker System</div>
        </div>
      </div>
      <div className="flex space-x-2">
        <button 
          onClick={onOpenReport} 
          className="h-9 px-3.5 rounded-lg border border-hd-line bg-white hover:bg-hd-bg flex items-center justify-center text-xs font-semibold uppercase tracking-wider text-hd-dark-subtext hover:text-hd-ink transition-colors cursor-pointer gap-2" 
          title="Reports"
        >
          <FileText className="w-4 h-4 text-hd-accent" />
          <span className="hidden sm:inline">Reports</span>
        </button>
        <button 
          onClick={onOpenAdmin} 
          className="h-9 px-3.5 rounded-lg border border-hd-line bg-white hover:bg-hd-bg flex items-center justify-center text-xs font-semibold uppercase tracking-wider text-hd-dark-subtext hover:text-hd-ink transition-colors cursor-pointer gap-2" 
          title="Admin Settings"
        >
          <Settings className="w-4 h-4 text-hd-dark-subtext" />
          <span className="hidden sm:inline">Admin</span>
        </button>
      </div>
    </header>
  );
}