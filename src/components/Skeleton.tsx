import './Skeleton.css';

interface SkeletonProps {
  /** Sizing lives with the screen that uses it, not here. */
  className?: string;
}

/**
 * One grey block.
 *
 * Always `aria-hidden`: a skeleton is a picture of content that does not exist
 * yet, so there is nothing for a screen reader to read. The announcement comes
 * from `LoadingState` instead, once, as words.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={className ? `skeleton ${className}` : 'skeleton'}
    />
  );
}

interface LoadingStateProps {
  /** What a screen reader hears, e.g. "Loading games". */
  label: string;
  className?: string;
  /** The skeleton shapes. */
  children: React.ReactNode;
}

/**
 * The loading region: an announced status, and silent shapes inside it.
 *
 * `aria-busy` tells assistive tech the region is still filling in, which is
 * what distinguishes "loading" from "this is all there is".
 */
export function LoadingState({ label, className, children }: LoadingStateProps) {
  return (
    <div className={className} role="status" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {children}
    </div>
  );
}
