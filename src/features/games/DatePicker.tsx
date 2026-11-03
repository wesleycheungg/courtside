import { useEffect, useRef, useState } from 'react';
import { addDays, fullDateLabel, relativeDateLabel } from '../../lib/date';
import { Calendar } from './Calendar';
import { Chevron } from './Chevron';
import './DatePicker.css';

interface DatePickerProps {
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}

export function DatePicker({ selected, today, onSelect }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // A press anywhere else dismisses. pointerdown rather than click, so the
  // calendar is gone before the press can also activate what's underneath.
  useEffect(() => {
    if (!open) return;

    function dismiss(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  /** Dismiss and hand focus back, for the paths the keyboard drove. */
  function closeAndRestoreFocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="date-picker" ref={containerRef}>
      <button
        type="button"
        className="date-picker__step"
        aria-label="Previous day"
        onClick={() => onSelect(addDays(selected, -1))}
      >
        <Chevron direction="left" />
      </button>

      <button
        type="button"
        className="date-picker__current"
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        {/* The visible word plus the full date, so the accessible name
            contains the label it shows (WCAG 2.5.3) and still says which
            day "Today" actually is. */}
        <span>{relativeDateLabel(selected, today)}</span>
        <Chevron direction="down" className="date-picker__caret" />
        <span className="visually-hidden">{fullDateLabel(selected)}</span>
      </button>

      <button
        type="button"
        className="date-picker__step"
        aria-label="Next day"
        onClick={() => onSelect(addDays(selected, 1))}
      >
        <Chevron direction="right" />
      </button>

      {open && (
        <Calendar
          selected={selected}
          today={today}
          onSelect={(date) => {
            onSelect(date);
            closeAndRestoreFocus();
          }}
          onClose={closeAndRestoreFocus}
        />
      )}
    </div>
  );
}
