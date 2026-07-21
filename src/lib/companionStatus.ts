export type TimeBlock = 'morning' | 'afternoon' | 'evening' | 'lateNight';

export interface DailyRoutine {
  morning: string;
  afternoon: string;
  evening: string;
  lateNight: string;
}

export function getCurrentTimeBlock(date: Date = new Date()): TimeBlock {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'lateNight';
}

export function getCurrentActivity(routine: DailyRoutine, date: Date = new Date()): string {
  return routine[getCurrentTimeBlock(date)];
}
