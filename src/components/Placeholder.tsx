import './Placeholder.css';

interface PlaceholderProps {
  /** Which milestone delivers this screen, so the stub is honest about why. */
  milestone?: string;
  children: React.ReactNode;
}

/** Marks a route that exists for navigation but has no content yet. */
export function Placeholder({ milestone, children }: PlaceholderProps) {
  return (
    <section className="placeholder">
      <p className="placeholder__body">{children}</p>
      {milestone ? (
        <p className="placeholder__milestone">Arriving in {milestone}</p>
      ) : null}
    </section>
  );
}
