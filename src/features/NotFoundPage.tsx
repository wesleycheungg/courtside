import { Link } from 'react-router-dom';
import { Page } from '../components/Page';
import { Placeholder } from '../components/Placeholder';

export function NotFoundPage() {
  return (
    <Page title="Not found">
      <Placeholder>
        That page does not exist. <Link to="/">Back to games</Link>.
      </Placeholder>
    </Page>
  );
}
