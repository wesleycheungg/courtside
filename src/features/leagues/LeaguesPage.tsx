import { useSearchParams } from 'react-router-dom';
import { Page } from '../../components/Page';
import { TeamLogo } from '../../components/TeamLogo';
import type { Conference, ConferenceId, Standing } from '../../data/types';
import { formatGamesBehind, formatWinPercent, seedBand, seedBandLabel } from './seeding';
import { useStandings } from './useStandings';
import './LeaguesPage.css';

function StandingRow({ row }: { row: Standing }) {
  const band = seedBand(row.rank);
  const label = seedBandLabel(band);

  return (
    <tr className={`standings__row standings__row--${band}`}>
      <th scope="row" className="standings__team">
        <span className={`standings__seed standings__seed--${band}`}>
          {row.rank}
          {/* Keeps the playoff / play-in distinction off colour alone. */}
          {label ? <span className="visually-hidden">. {label}</span> : null}
        </span>
        <TeamLogo abbreviation={row.team.abbreviation} color={row.team.color} />
        <span className="standings__name">{row.team.name}</span>
      </th>
      <td>{row.wins}</td>
      <td className="standings__muted">{row.losses}</td>
      <td>{formatWinPercent(row.winPercent)}</td>
      <td className="standings__muted">{formatGamesBehind(row.gamesBehind)}</td>
      <td className={row.streak.startsWith('W') ? 'standings__win' : 'standings__loss'}>
        {row.streak}
      </td>
    </tr>
  );
}

function StandingsTable({ conference }: { conference: Conference }) {
  return (
    <div className="panel__scroll">
      <table className="standings">
        <caption className="visually-hidden">
          {conference.name} standings. Seeds 1 to 6 reach the playoffs, 7 to 10 the
          play-in tournament.
        </caption>
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">W</th>
            <th scope="col">L</th>
            <th scope="col">PCT</th>
            <th scope="col">GB</th>
            <th scope="col">STRK</th>
          </tr>
        </thead>
        <tbody>
          {conference.standings.map((row) => (
            <StandingRow key={row.team.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeaguesPage() {
  const [params, setParams] = useSearchParams();
  const { data, isPending, isError, error } = useStandings();

  const selected: ConferenceId = params.get('conf') === 'west' ? 'west' : 'east';

  function selectConference(id: ConferenceId) {
    const next = new URLSearchParams(params);
    if (id === 'east') next.delete('conf');
    else next.set('conf', id);
    setParams(next, { replace: true });
  }

  const conference = data?.find((c) => c.id === selected);

  return (
    <Page title="Leagues">
      <div className="conf-switch" role="group" aria-label="Choose a conference">
        {(['east', 'west'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`conf-switch__option${
              selected === id ? ' conf-switch__option--active' : ''
            }`}
            aria-pressed={selected === id}
            onClick={() => selectConference(id)}
          >
            {id === 'east' ? 'East' : 'West'}
          </button>
        ))}
      </div>

      {isPending && (
        <p className="panel__empty" role="status">
          Loading standings…
        </p>
      )}

      {isError && (
        <p className="panel__empty" role="alert">
          Could not load standings. {error.message}
        </p>
      )}

      {conference && (
        <>
          <section className="panel">
            <StandingsTable conference={conference} />
          </section>

          <ul className="standings__legend">
            <li>
              <span className="standings__swatch standings__swatch--playoffs" />
              Playoffs (1–6)
            </li>
            <li>
              <span className="standings__swatch standings__swatch--playin" />
              Play-in (7–10)
            </li>
          </ul>
        </>
      )}
    </Page>
  );
}
