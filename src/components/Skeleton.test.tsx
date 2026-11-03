import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingState, Skeleton } from './Skeleton';

describe('LoadingState', () => {
  it('announces once, as words', () => {
    render(
      <LoadingState label="Loading games">
        <Skeleton />
        <Skeleton />
      </LoadingState>,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading games');
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('keeps the shapes out of the accessible name', () => {
    const { container } = render(
      <LoadingState label="Loading games">
        <Skeleton className="feed-skeleton__name" />
      </LoadingState>,
    );

    // Three empty grey blocks read as nothing useful; only the label should
    // reach assistive tech.
    const blocks = container.querySelectorAll('.skeleton');
    expect(blocks).toHaveLength(1);
    for (const block of blocks) {
      expect(block).toHaveAttribute('aria-hidden', 'true');
    }
    expect(screen.getByRole('status').textContent).toBe('Loading games');
  });
});

describe('Skeleton', () => {
  it('carries its own class alongside the sizing class', () => {
    const { container } = render(<Skeleton className="feed-skeleton__score" />);

    const block = container.querySelector('span');
    expect(block).toHaveClass('skeleton');
    expect(block).toHaveClass('feed-skeleton__score');
  });

  it('works with no sizing class', () => {
    const { container } = render(<Skeleton />);

    expect(container.querySelector('span')).toHaveAttribute('class', 'skeleton');
  });
});
