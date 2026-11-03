import { Page } from '../../components/Page';
import { Placeholder } from '../../components/Placeholder';
import './GamesPage.css';

/** The wordmark from the design: "COURT" in white, "SIDE" in accent. */
function Wordmark() {
  return (
    <span className="wordmark">
      Court<span className="wordmark__accent">side</span>
    </span>
  );
}

export function GamesPage() {
  return (
    <Page title={<Wordmark />}>
      <Placeholder milestone="M2">
        The games feed — date strip, live filters, and games grouped as live, final, and
        scheduled.
      </Placeholder>
    </Page>
  );
}
