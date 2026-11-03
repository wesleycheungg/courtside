import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from './DatePicker';

const TODAY = '2026-11-03';

function setup(selected = TODAY) {
  const onSelect = vi.fn();
  const user = userEvent.setup();

  render(<DatePicker selected={selected} today={TODAY} onSelect={onSelect} />);

  return { onSelect, user };
}

function trigger() {
  return screen.getByRole('button', { expanded: false });
}

function calendar() {
  return screen.getByRole('dialog', { name: 'Choose a date' });
}

/** A day button inside the open calendar, by its visible number. */
function day(number: string) {
  return within(calendar())
    .getAllByRole('button')
    .find((button) => button.textContent?.startsWith(number) === true);
}

describe('DatePicker bar', () => {
  it('names today in words rather than a date', () => {
    setup();

    expect(screen.getByRole('button', { name: /^Today/ })).toBeInTheDocument();
  });

  it('names the days either side of today in words too', () => {
    setup('2026-11-04');

    expect(screen.getByRole('button', { name: /^Tomorrow/ })).toBeInTheDocument();
  });

  it('spells out a date further from today', () => {
    setup('2026-11-20');

    expect(screen.queryByRole('button', { name: /Today/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /November 20/ })).toBeInTheDocument();
  });

  it('keeps the full date in the accessible name, since "Today" alone is not one', () => {
    setup();

    expect(screen.getByRole('button', { expanded: false })).toHaveAccessibleName(
      /Today.*November 3, 2026|Today.*3 November 2026/,
    );
  });

  it('steps back a day', async () => {
    const { user, onSelect } = setup();

    await user.click(screen.getByRole('button', { name: 'Previous day' }));

    expect(onSelect).toHaveBeenCalledWith('2026-11-02');
  });

  it('steps forward a day', async () => {
    const { user, onSelect } = setup();

    await user.click(screen.getByRole('button', { name: 'Next day' }));

    expect(onSelect).toHaveBeenCalledWith('2026-11-04');
  });

  it('steps across a month boundary without breaking', async () => {
    const { user, onSelect } = setup('2026-11-30');

    await user.click(screen.getByRole('button', { name: 'Next day' }));

    expect(onSelect).toHaveBeenCalledWith('2026-12-01');
  });
});

describe('DatePicker calendar', () => {
  it('stays shut until the date is tapped', () => {
    setup();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on the selected date’s month', async () => {
    const { user } = setup();

    await user.click(trigger());

    expect(
      within(calendar()).getByRole('heading', { name: /November 2026/ }),
    ).toBeInTheDocument();
  });

  it('marks the selected day as pressed', async () => {
    const { user } = setup();

    await user.click(trigger());

    expect(day('3')).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks today as the current date even when another day is selected', async () => {
    const { user } = setup('2026-11-20');

    await user.click(trigger());

    expect(day('3')).toHaveAttribute('aria-current', 'date');
    expect(day('3')).toHaveAttribute('aria-pressed', 'false');
    expect(day('20')).toHaveAttribute('aria-pressed', 'true');
  });

  it('reports a chosen day and closes', async () => {
    const { user, onSelect } = setup();

    await user.click(trigger());
    await user.click(day('17') as HTMLElement);

    expect(onSelect).toHaveBeenCalledWith('2026-11-17');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pages to the previous month without changing the selection', async () => {
    const { user, onSelect } = setup();

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Previous month' }));

    expect(
      within(calendar()).getByRole('heading', { name: /October 2026/ }),
    ).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('pages forward through a short month rather than skipping it', async () => {
    const { user } = setup('2026-01-31');

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Next month' }));

    expect(
      within(calendar()).getByRole('heading', { name: /February 2026/ }),
    ).toBeInTheDocument();
  });

  it('labels the weekday columns in full for screen readers', async () => {
    const { user } = setup();

    await user.click(trigger());

    expect(
      within(calendar()).getByRole('columnheader', { name: 'Monday' }),
    ).toBeInTheDocument();
  });
});

describe('DatePicker keyboard', () => {
  it('lands focus on the selected day when it opens', async () => {
    const { user } = setup();

    await user.click(trigger());

    expect(day('3')).toHaveFocus();
  });

  it('keeps one tab stop in the grid, not one per day', async () => {
    const { user } = setup();

    await user.click(trigger());

    // Scoped to the grid: the two month-paging buttons are tab stops of their
    // own and should stay that way.
    const tabbable = within(within(calendar()).getByRole('table'))
      .getAllByRole('button')
      .filter((button) => button.tabIndex === 0);

    expect(tabbable).toHaveLength(1);
  });

  it('moves a day at a time with the left and right arrows', async () => {
    const { user } = setup();

    await user.click(trigger());
    await user.keyboard('{ArrowRight}');

    expect(day('4')).toHaveFocus();

    await user.keyboard('{ArrowLeft}{ArrowLeft}');

    expect(day('2')).toHaveFocus();
  });

  it('moves a week at a time with the up and down arrows', async () => {
    const { user } = setup();

    await user.click(trigger());
    await user.keyboard('{ArrowDown}');

    expect(day('10')).toHaveFocus();
  });

  it('pages the view when an arrow crosses out of the month', async () => {
    const { user } = setup('2026-11-01');

    await user.click(trigger());
    await user.keyboard('{ArrowLeft}');

    expect(
      within(calendar()).getByRole('heading', { name: /October 2026/ }),
    ).toBeInTheDocument();
    expect(day('31')).toHaveFocus();
  });

  it('jumps to the ends of the week with Home and End', async () => {
    const { user } = setup();

    await user.click(trigger());
    // 2026-11-03 was a Tuesday, so its week runs Mon 2nd to Sun 8th.
    await user.keyboard('{Home}');
    expect(day('2')).toHaveFocus();

    await user.keyboard('{End}');
    expect(day('8')).toHaveFocus();
  });

  it('pages a month with PageUp and PageDown', async () => {
    const { user } = setup();

    await user.click(trigger());
    await user.keyboard('{PageDown}');

    expect(
      within(calendar()).getByRole('heading', { name: /December 2026/ }),
    ).toBeInTheDocument();
  });

  it('does not load a new day just for arrowing around', async () => {
    const { user, onSelect } = setup();

    await user.click(trigger());
    await user.keyboard('{ArrowRight}{ArrowDown}{PageDown}');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects the focused day on Enter', async () => {
    const { user, onSelect } = setup();

    await user.click(trigger());
    await user.keyboard('{ArrowRight}{Enter}');

    expect(onSelect).toHaveBeenCalledWith('2026-11-04');
  });

  it('closes on Escape and hands focus back to the trigger', async () => {
    const { user, onSelect } = setup();

    await user.click(trigger());
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    expect(trigger()).toHaveFocus();
  });

  it('hands focus back after a day is chosen, so the tab order survives', async () => {
    const { user } = setup();

    await user.click(trigger());
    await user.keyboard('{Enter}');

    expect(trigger()).toHaveFocus();
  });
});

describe('DatePicker dismissal', () => {
  it('closes on a press outside', async () => {
    const { user } = setup();

    await user.click(trigger());
    await user.click(document.body);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves focus alone when dismissed by a press outside', async () => {
    const { user } = setup();

    await user.click(trigger());
    await user.click(document.body);

    // Stealing focus back would yank a mouse user somewhere they never asked
    // to be; only the keyboard paths restore it.
    expect(trigger()).not.toHaveFocus();
  });

  it('stays open when the press lands inside it', async () => {
    const { user } = setup();

    await user.click(trigger());
    await user.click(within(calendar()).getByRole('heading', { name: /November/ }));

    expect(screen.queryByRole('dialog')).toBeInTheDocument();
  });
});
