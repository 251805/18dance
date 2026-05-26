import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error';

interface StatusToastProps {
  message: string;
  type: ToastType;
  visible: boolean;
  onClose: () => void;
}

export function StatusToast({ message, type, visible, onClose }: StatusToastProps) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => onClose(), 5000);
      return () => clearTimeout(t);
    }
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 flex items-center p-4 rounded-xl shadow-lg border text-sm font-medium z-50 ${
            type === 'success' ? 'bg-[#e7f3eb] border-[#31a24c] text-[#1c1e21]' : 'bg-[#fbe9e9] border-[#f02849] text-[#1c1e21]'
          }`}
        >
          {type === 'success' ? <CheckCircle className="w-5 h-5 text-[#31a24c] shrink-0 mr-3" /> : <XCircle className="w-5 h-5 text-[#f02849] shrink-0 mr-3" />}
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
