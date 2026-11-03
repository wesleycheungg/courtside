import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { BottomNav } from './BottomNav';
import { renderWithProviders } from '../test/render';

const SECTIONS = ['Games', 'Leagues', 'Following', 'News'];

describe('BottomNav', () => {
  it('renders a link for every section', () => {
    renderWithProviders(<BottomNav />);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const section of SECTIONS) {
      expect(screen.getByRole('link', { name: new RegExp(section) })).toBeInTheDocument();
    }
    expect(nav).toBeInTheDocument();
  });

  it('points each link at its route', () => {
    renderWithProviders(<BottomNav />);

    expect(screen.getByRole('link', { name: /Games/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Leagues/ })).toHaveAttribute(
      'href',
      '/leagues',
    );
    expect(screen.getByRole('link', { name: /Following/ })).toHaveAttribute(
      'href',
      '/following',
    );
    expect(screen.getByRole('link', { name: /News/ })).toHaveAttribute('href', '/news');
  });

  it('marks the active tab with aria-current', () => {
    renderWithProviders(<BottomNav />, { route: '/leagues' });

    expect(screen.getByRole('link', { name: /Leagues/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /Games/ })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('treats Games as active only at the root, not on every route', () => {
    renderWithProviders(<BottomNav />, { route: '/news' });

    expect(screen.getByRole('link', { name: /Games/ })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: /News/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks exactly one tab as current at a time', () => {
    renderWithProviders(<BottomNav />, { route: '/following' });

    const current = SECTIONS.filter(
      (section) =>
        screen
          .getByRole('link', { name: new RegExp(section) })
          .getAttribute('aria-current') === 'page',
    );

    expect(current).toEqual(['Following']);
  });
});
