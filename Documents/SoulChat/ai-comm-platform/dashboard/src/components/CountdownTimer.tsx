import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';

interface CountdownTimerProps {
  expiresAt: string | Date;
  onExpired?: () => void;
  className?: string;
}

function getRemaining(expiresAt: Date): number {
  return Math.max(0, expiresAt.getTime() - Date.now());
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

function getColorClass(ms: number): string {
  const tenMinutes = 10 * 60 * 1000;
  const oneHour = 60 * 60 * 1000;

  if (ms <= 0) return 'text-red-600';
  if (ms < tenMinutes) return 'text-red-500';
  if (ms < oneHour) return 'text-yellow-500';
  return 'text-green-500';
}

export function CountdownTimer({ expiresAt, onExpired, className }: CountdownTimerProps) {
  const target = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const [remaining, setRemaining] = useState(() => getRemaining(target));
  const [hasFired, setHasFired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const ms = getRemaining(target);
      setRemaining(ms);

      if (ms <= 0 && !hasFired) {
        setHasFired(true);
        onExpired?.();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target, onExpired, hasFired]);

  return (
    <span
      className={cn('font-mono text-sm font-semibold tabular-nums', getColorClass(remaining), className)}
      dir="ltr"
    >
      {formatTime(remaining)}
    </span>
  );
}
