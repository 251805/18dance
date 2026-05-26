import { QueuedPunch } from '../types';

const QUEUE_KEY = 'theory11_offline_queue';

export const offlineQueue = {
  get: (): QueuedPunch[] => {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  },
  add: (punch: QueuedPunch) => {
    const q = offlineQueue.get();
    localStorage.setItem(QUEUE_KEY, JSON.stringify([...q, punch]));
  },
  remove: (id: string) => {
    const q = offlineQueue.get();
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.filter(p => p.id !== id)));
  },
  clear: () => {
    localStorage.removeItem(QUEUE_KEY);
  }
};
