import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Placeholder } from '../../components/Placeholder';
import { BoxScoreTab } from './BoxScoreTab';
import { GameDetailSkeleton } from './GameDetailSkeleton';
import { GameHeader } from './GameHeader';
import { PlaysTab } from './PlaysTab';
import { SummaryTab } from './SummaryTab';
import { useGameDetail } from './useGameDetail';
import './GameDetailPage.css';

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'boxscore', label: 'Box score' },
  { id: 'plays', label: 'Plays' },
  { id: 'shots', label: 'Shots' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

export function GameDetailPage() {
  const { gameId = '' } = useParams();
  const [params, setParams] = useSearchParams();

  const tabParam = params.get('tab');
  const activeTab: TabId = isTabId(tabParam) ? tabParam : 'summary';

  const { data: game, isPending, isError, error } = useGameDetail(gameId);

  function selectTab(tab: TabId) {
    const next = new URLSearchParams(params);
    // Summary is the default, so it stays out of the URL.
    if (tab === 'summary') next.delete('tab');
    else next.set('tab', tab);
    setParams(next, { replace: true });
  }

  if (isPending) {
    return <GameDetailSkeleton />;
  }

  if (isError) {
    return (
      <div className="game-detail__failure">
        <p className="panel__empty" role="alert">
          Could not load this game. {error.message}
        </p>
        <p className="game-detail__back-link">
          <Link to="/">Back to games</Link>
        </p>
      </div>
    );
  }

  return (
    <article className="game-detail">
      <GameHeader game={game} />

      <div className="game-detail__tabs" role="tablist" aria-label="Game sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`game-detail__tab${
              activeTab === tab.id ? ' game-detail__tab--active' : ''
            }`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="game-detail__panel"
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === 'summary' && <SummaryTab game={game} />}
        {activeTab === 'boxscore' && <BoxScoreTab game={game} />}
        {activeTab === 'plays' && <PlaysTab game={game} active />}
        {activeTab === 'shots' && (
          <Placeholder milestone="a later milestone">
            Shot charts need per-shot coordinates, which this build does not request yet.
          </Placeholder>
        )}
      </div>
    </article>
  );
}
