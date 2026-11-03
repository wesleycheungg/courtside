import './Page.css';

interface PageProps {
  /** Becomes the screen's only h1. */
  title: React.ReactNode;
  /** Rendered beside the title, e.g. header actions. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

/** Standard screen frame: a labelled h1, then the screen's content. */
export function Page({ title, actions, children }: PageProps) {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">{title}</h1>
        {actions ? <div className="page__actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
