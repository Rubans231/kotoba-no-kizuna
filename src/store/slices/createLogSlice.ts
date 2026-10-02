import type { StateCreator } from 'zustand';

export type LogLevel = 'info' | 'success' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

const MAX_LOG_ENTRIES = 300;

export interface LogSlice {
  logs: LogEntry[];
  addLog: (level: LogLevel, message: string) => void;
  clearLogs: () => void;
}

export const createLogSlice: StateCreator<LogSlice> = (set) => ({
  logs: [],
  addLog: (level, message) =>
    set((state) => {
      const entry: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level,
        message,
      };
      const next = [...state.logs, entry];
      // Trim from the front rather than let this grow unbounded over a
      // long session - keeps it a live window, not a full history.
      return { logs: next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next };
    }),
  clearLogs: () => set({ logs: [] }),
});
