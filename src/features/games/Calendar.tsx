import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  addDays,
  addMonths,
  dayOfMonth,
  fromDateKey,
  fullDateLabel,
  monthGrid,
  monthLabel,
  weekdayHeadings,
} from '../../lib/date';
import { Chevron } from './Chevron';
import './Calendar.css';

interface CalendarProps {
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

/** Stable across renders — the headings never change within a locale. */
const HEADINGS = weekdayHeadings();

/** Arrow-key moves, in days. */
const DAY_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/** Monday-first index of the week, 0–6. */
function weekdayIndex(key: string): number {
  return (fromDateKey(key).getDay() + 6) % 7;
}

export function Calendar({ selected, today, onSelect, onClose }: CalendarProps) {
  // Focus roves independently of selection: arrowing across the grid should
  // explore the month, not fire a query for every day it passes over. The
  // month on show is derived from it, so crossing a boundary pages the view.
  const [focused, setFocused] = useState(selected);
  const gridRef = useRef<HTMLTableElement>(null);
  const headingId = useId();

  // The grid holds up to 42 buttons. Giving each a tab stop would bury the
  // rest of the page, so exactly one is tabbable and this moves real DOM
  // focus to follow it — including on open, which lands on the selected day.
  useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>('[data-roving]')?.focus();
  }, [focused]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      onClose();
      return;
    }

    const step = DAY_STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setFocused((current) => addDays(current, step));
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setFocused((current) =>
        addDays(
          current,
          event.key === 'Home' ? -weekdayIndex(current) : 6 - weekdayIndex(current),
        ),
      );
      return;
    }

    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      setFocused((current) => addMonths(current, event.key === 'PageUp' ? -1 : 1));
    }
  }

  return (
    <div
      className="calendar"
      role="dialog"
      aria-label="Choose a date"
      onKeyDown={handleKeyDown}
    >
      <div className="calendar__header">
        <button
          type="button"
          className="calendar__page"
          aria-label="Previous month"
          onClick={() => setFocused(addMonths(focused, -1))}
        >
          <Chevron direction="left" />
        </button>

        <h2 className="calendar__month" id={headingId} aria-live="polite">
          {monthLabel(focused)}
        </h2>

        <button
          type="button"
          className="calendar__page"
          aria-label="Next month"
          onClick={() => setFocused(addMonths(focused, 1))}
        >
          <Chevron direction="right" />
        </button>
      </div>

      <table className="calendar__grid" ref={gridRef} aria-labelledby={headingId}>
        <thead>
          <tr>
            {HEADINGS.map((day) => (
              <th key={day.long} scope="col">
                {/* "T" alone is a coin flip read aloud, so the narrow form is
                    shown and the long one is what a screen reader announces. */}
                <span aria-hidden="true">{day.narrow}</span>
                <span className="visually-hidden">{day.long}</span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {monthGrid(focused).map((week, weekIndex) => (
            <tr key={week.find(Boolean) ?? weekIndex}>
              {week.map((date, dayIndex) => (
                <td key={date ?? `pad-${dayIndex}`}>
                  {date !== null && (
                    <button
                      type="button"
                      className={`calendar__day${
                        date === selected ? ' calendar__day--selected' : ''
                      }${date === today ? ' calendar__day--today' : ''}`}
                      data-roving={date === focused ? '' : undefined}
                      tabIndex={date === focused ? 0 : -1}
                      aria-pressed={date === selected}
                      aria-current={date === today ? 'date' : undefined}
                      onClick={() => onSelect(date)}
                    >
                      {/* The accessible name is the full date, which already
                          contains the visible number — WCAG 2.5.3 holds
                          without reading "4 Wednesday, 4 November 2026". */}
                      <span aria-hidden="true">{dayOfMonth(date)}</span>
                      <span className="visually-hidden">{fullDateLabel(date)}</span>
                    </button>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
