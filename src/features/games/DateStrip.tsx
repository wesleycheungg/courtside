import { dateWindow, dayOfMonth, fullDateLabel, weekdayLabel } from '../../lib/date';
import './DateStrip.css';

interface DateStripProps {
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}

export function DateStrip({ selected, today, onSelect }: DateStripProps) {
  const dates = dateWindow(selected);

  return (
    <div className="date-strip" role="group" aria-label="Select a date">
      {dates.map((date) => {
        const isSelected = date === selected;
        const isToday = date === today;

        return (
          <button
            key={date}
            type="button"
            className={`date-strip__day${isSelected ? ' date-strip__day--selected' : ''}`}
            aria-pressed={isSelected}
            aria-label={fullDateLabel(date)}
            onClick={() => onSelect(date)}
          >
            <span className="date-strip__weekday">
              {isToday ? 'Today' : weekdayLabel(date)}
            </span>
            <span className="date-strip__date">{dayOfMonth(date)}</span>
          </button>
        );
      })}
    </div>
  );
}
