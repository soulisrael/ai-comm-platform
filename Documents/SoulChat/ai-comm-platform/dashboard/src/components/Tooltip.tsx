import { useState, useRef, type ReactNode } from 'react';
import { cn } from '../lib/utils';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'right' | 'left';
}

const positionClasses: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  right: 'top-1/2 -translate-y-1/2 start-full ms-2',
  left: 'top-1/2 -translate-y-1/2 end-full me-2',
};

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(true);
  };

  const hide = () => {
    timeoutRef.current = setTimeout(() => setVisible(false), 100);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={cn(
            'absolute z-50 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg pointer-events-none',
            positionClasses[position],
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
