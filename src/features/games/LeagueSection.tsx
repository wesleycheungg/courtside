import type { LeagueGroup } from './grouping';
import { GameRow } from './GameRow';
import './LeagueSection.css';

/** One league's card: a header, then its games separated by hairlines. */
export function LeagueSection({ group }: { group: LeagueGroup }) {
  return (
    <section className="league-section" aria-labelledby={`league-${group.league}`}>
      <header className="league-section__header">
        <span className="league-section__badge" aria-hidden="true">
          {group.name}
        </span>
        <h2 className="league-section__name" id={`league-${group.league}`}>
          {group.name}
        </h2>
      </header>

      <ul className="league-section__games">
        {group.games.map((game) => (
          <li key={game.id}>
            <GameRow game={game} />
          </li>
        ))}
      </ul>
    </section>
  );
}
