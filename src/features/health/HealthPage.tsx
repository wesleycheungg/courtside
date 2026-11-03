import { Page } from '../../components/Page';
import { LoadingState, Skeleton } from '../../components/Skeleton';
import type { HealthReport, HealthStatus } from '../../data/health';
import { formatAge, formatInstant, formatLatency, formatRows } from './format';
import { useHealth } from './useHealth';
import './HealthPage.css';

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'OK',
  degraded: 'Degraded',
  down: 'Down',
};

const UPSTREAM_LABEL: Record<HealthReport['upstream']['status'], string> = {
  ok: 'Answering, and the payload matched the schema',
  schema_invalid: 'Answering, but the payload did not match the schema',
  unreachable: 'Not answering',
};

const SCHEMA_LABEL: Record<HealthReport['schema']['result'], string> = {
  pass: 'Pass',
  fail: 'Fail',
  unknown: 'Not run on this instance yet',
};

function Pill({ status }: { status: HealthStatus }) {
  return (
    <span className={`health__pill health__pill--${status}`}>{STATUS_LABEL[status]}</span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="health__fact">
      <dt className="health__term">{label}</dt>
      <dd className="health__value">{children}</dd>
    </div>
  );
}

/** Matches the three panels below, so arriving data shifts nothing. */
function HealthSkeleton() {
  return (
    <LoadingState label="Loading health report" className="health__loading">
      {[0, 1, 2].map((panel) => (
        <div className="panel" key={panel}>
          <Skeleton className="health__skeleton-title" />
          <Skeleton className="health__skeleton-row" />
          <Skeleton className="health__skeleton-row" />
          <Skeleton className="health__skeleton-row" />
        </div>
      ))}
    </LoadingState>
  );
}

export function HealthPage() {
  const { data: report, isPending, isError, error, refetch, isFetching } = useHealth();

  return (
    <Page title="Health">
      {isPending && <HealthSkeleton />}

      {isError && (
        <p className="panel__empty" role="alert">
          Could not reach the health endpoint. {error.message}
        </p>
      )}

      {report && (
        <>
          <div className="health__summary">
            <Pill status={report.status} />
            <p className="health__checked">Checked {formatInstant(report.checkedAt)}</p>
            <button
              type="button"
              className="health__refresh"
              onClick={() => void refetch()}
            >
              Refresh
              {/* The accessible name has to contain the visible text (WCAG
                  2.5.3), so the detail is appended rather than replacing it. */}
              <span className="visually-hidden"> the health report</span>
            </button>
            {/* Polite, so a 30s auto-refresh never interrupts a reader. */}
            <p className="visually-hidden" role="status">
              {isFetching ? 'Refreshing the health report' : ''}
            </p>
          </div>

          <section className="panel" aria-labelledby="health-proxy">
            <h2 className="panel__title" id="health-proxy">
              ESPN proxy
            </h2>
            <dl className="health__facts">
              <Fact label="Upstream">{UPSTREAM_LABEL[report.upstream.status]}</Fact>
              <Fact label="Probe">{report.upstream.probe}</Fact>
              <Fact label="Latency">{formatLatency(report.upstream.latencyMs)}</Fact>
              <Fact label="Served from">
                {report.upstream.servedFromCache
                  ? 'the proxy memory cache'
                  : 'a fresh upstream fetch'}
              </Fact>
              {report.upstream.detail && (
                <Fact label="Detail">
                  <span className="health__detail">{report.upstream.detail}</span>
                </Fact>
              )}
            </dl>
          </section>

          <section className="panel" aria-labelledby="health-schema">
            <h2 className="panel__title" id="health-schema">
              Last schema validation
            </h2>
            <dl className="health__facts">
              <Fact label="Result">{SCHEMA_LABEL[report.schema.result]}</Fact>
              <Fact label="Payload">{report.schema.key ?? '—'}</Fact>
              <Fact label="Checked">{formatInstant(report.schema.checkedAt)}</Fact>
            </dl>
            {report.schema.issues.length > 0 && (
              <ul className="health__issues">
                {report.schema.issues.map((issue) => (
                  <li key={issue} className="health__detail">
                    {issue}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="health-cache">
            <h2 className="panel__title" id="health-cache">
              Postgres cache
            </h2>
            <dl className="health__facts">
              <Fact label="Status">
                {!report.database.configured
                  ? 'Not configured'
                  : report.database.reachable
                    ? 'Connected'
                    : 'Unreachable'}
              </Fact>
              {report.database.tables.map((table) => (
                <Fact key={table.table} label={table.table}>
                  {formatRows(table.rows)} · written {formatAge(table.ageSeconds)}
                  <span className="health__detail">
                    {' '}
                    ({formatInstant(table.newestAt)})
                  </span>
                </Fact>
              ))}
              {report.database.detail && (
                <Fact label="Detail">
                  <span className="health__detail">{report.database.detail}</span>
                </Fact>
              )}
            </dl>
          </section>
        </>
      )}
    </Page>
  );
}
