import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import {
  TRACKED_EVENT_TYPES,
  formatDuration,
  getActivityBreakdown,
  getAnalyticsOverview,
  getGameDetail,
  getGamesBreakdown,
  getGeoBreakdown,
  getPageBreakdown,
  getRecentActivity,
  getSourceBreakdown,
  hasAnyAnalyticsData,
  pageType,
  percentChange,
  resolveAnalyticsRange,
} from "@/lib/analytics-web";
import { BarList, LineChart } from "@/components/analytics-charts";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "geo", label: "Geography" },
  { key: "pages", label: "Pages" },
  { key: "games", label: "Games" },
  { key: "activities", label: "Activities" },
  { key: "sources", label: "Sources & devices" },
] as const;

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "custom", label: "Custom" },
];

type Params = Record<string, string | string[] | undefined>;

function stringParam(params: Params, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

function countryName(code: string | null): string {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function metricDelta(current: number, previous: number): string {
  const change = percentChange(current, previous);
  if (change === null) return previous === 0 && current > 0 ? "new in this period" : "—";
  if (change === 0) return "no change";
  return `${change > 0 ? "+" : ""}${change}% vs previous`;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireStaff("/admin/analytics", "analytics");
  const params = await searchParams;
  const tab = TABS.some((entry) => entry.key === stringParam(params, "tab"))
    ? stringParam(params, "tab")
    : "overview";
  const range = resolveAnalyticsRange({
    range: stringParam(params, "range") || "7d",
    from: stringParam(params, "from"),
    to: stringParam(params, "to"),
  });
  const country = stringParam(params, "country");
  const pageTypeFilter = stringParam(params, "pageType") || "all";
  const selectedGame = stringParam(params, "game");

  const db = await getDb();
  const hasData = await hasAnyAnalyticsData(db);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Insights</p>
          <h1>Analytics</h1>
          <p className="muted">
            First-party, anonymous usage analytics. Internal/admin traffic is excluded from every report.
          </p>
        </div>
        <Link href="/admin/monitoring" className="link-button">System health →</Link>
      </div>

      <section className="card section-tight">
        <form method="get" className="toolbar">
          <input type="hidden" name="tab" value={tab} />
          {country ? <input type="hidden" name="country" value={country} /> : null}
          {pageTypeFilter !== "all" ? <input type="hidden" name="pageType" value={pageTypeFilter} /> : null}
          {selectedGame ? <input type="hidden" name="game" value={selectedGame} /> : null}
          <select name="range" defaultValue={range.key} aria-label="Date range">
            {RANGE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          <input type="date" name="from" defaultValue={range.key === "custom" ? stringParam(params, "from") : ""} aria-label="From date" />
          <input type="date" name="to" defaultValue={range.key === "custom" ? stringParam(params, "to") : ""} aria-label="To date" />
          <button type="submit" className="btn btn-secondary">Apply</button>
          <span className="small muted">{range.label}</span>
        </form>
        <nav className="analytics-tabs" aria-label="Analytics sections">
          {TABS.map((entry) => (
            <Link
              key={entry.key}
              href={`/admin/analytics?tab=${entry.key}&range=${range.key}${country ? `&country=${country}` : ""}`}
              className={`chip ${tab === entry.key ? "chip-active" : ""}`}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      </section>

      {!hasData ? (
        <EmptyState />
      ) : tab === "overview" ? (
        <OverviewTab db={db} range={range} />
      ) : tab === "geo" ? (
        <GeoBrowser db={db} range={range} country={country} />
      ) : tab === "pages" ? (
        <PagesTab db={db} range={range} pageTypeFilter={pageTypeFilter} country={country} />
      ) : tab === "games" ? (
        <GamesTab db={db} range={range} selectedGame={selectedGame} />
      ) : tab === "activities" ? (
        <ActivitiesTab db={db} range={range} />
      ) : (
        <SourcesTab db={db} range={range} />
      )}

      <p className="muted small">
        Measured values come from anonymous first-party events. Page views are not completed
        orders, and a game completion is only counted when the game explicitly sends a
        completion event. Country data is coarse and only present when the hosting platform
        supplies a country header.
      </p>
    </>
  );
}

function EmptyState() {
  return (
    <section className="card section-tight">
      <h2>No analytics data available yet</h2>
      <p className="muted">
        Data will appear after tracking is configured and visitors begin using the website.
        Nothing on this dashboard is estimated, fabricated, or back-filled.
      </p>
      <ul className="simple-list">
        <li>Tracking endpoint: <code>POST /api/track</code></li>
        <li>Visitors must accept the anonymous analytics consent notice.</li>
        <li>Admin, portal, checkout, and bot traffic is excluded.</li>
        <li>Verify database connectivity with <Link className="link" href="/api/health">/api/health</Link>.</li>
      </ul>
    </section>
  );
}

type Db = Awaited<ReturnType<typeof getDb>>;
type Range = ReturnType<typeof resolveAnalyticsRange>;

async function OverviewTab({ db, range }: { db: Db; range: Range }) {
  const [overview, geo, pages, sources] = await Promise.all([
    getAnalyticsOverview(db, range),
    getGeoBreakdown(db, range),
    getPageBreakdown(db, range),
    getSourceBreakdown(db, range),
  ]);
  const current = overview.current;
  const previous = overview.previous;

  const cards = [
    { label: "Total visitors", value: current.visitors.toLocaleString(), hint: metricDelta(current.visitors, previous.visitors) },
    { label: "Sessions", value: current.sessions.toLocaleString(), hint: metricDelta(current.sessions, previous.sessions) },
    { label: "Page views", value: current.pageViews.toLocaleString(), hint: metricDelta(current.pageViews, previous.pageViews) },
    { label: "New visitors", value: current.newVisitors.toLocaleString(), hint: "First session in this period" },
    { label: "Returning visitors", value: current.returningVisitors.toLocaleString(), hint: "Not a first session" },
    { label: "Avg session duration", value: formatDuration(current.avgSessionSeconds), hint: "Measured from session start/end" },
    { label: "Pages per session", value: current.pagesPerSession === null ? "—" : String(current.pagesPerSession) },
    { label: "Bounce (1-page sessions)", value: current.bounceRate === null ? "—" : `${current.bounceRate}%` },
  ];

  return (
    <>
      <div className="stat-grid">
        {cards.map((card) => (
          <article className="card stat" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            {card.hint ? <p className="muted small">{card.hint}</p> : null}
          </article>
        ))}
      </div>

      <section className="card section-tight">
        <h2>Traffic trend</h2>
        <LineChart
          ariaLabel={`Page views per day for ${range.label}`}
          data={overview.trend.map((point) => ({ label: point.date, value: point.pageViews }))}
        />
        <p className="muted small">Page views per day. Sessions and visitors are available in the table data.</p>
      </section>

      <div className="inline-grid two">
        <section className="card section-tight">
          <h2>Top pages</h2>
          <BarList
            ariaLabel="Top pages by page views"
            rows={pages.slice(0, 8).map((page) => ({
              label: page.title || page.path,
              value: page.pageViews,
              hint: page.path,
            }))}
            emptyLabel="No page views recorded in this period."
          />
        </section>
        <section className="card section-tight">
          <h2>Top countries</h2>
          <BarList
            ariaLabel="Top countries by sessions"
            rows={geo.slice(0, 8).map((row) => ({
              label: countryName(row.countryCode),
              value: row.sessions,
              hint: `${row.percentage}%`,
              href: `/admin/analytics?tab=geo&range=${range.key}&country=${row.countryCode ?? ""}`,
            }))}
            emptyLabel="No country data yet. Country headers are not available in every environment."
          />
        </section>
      </div>

      <div className="inline-grid two">
        <section className="card section-tight">
          <h2>Traffic sources</h2>
          <BarList
            ariaLabel="Sessions by traffic source"
            rows={sources.sources.map((row) => ({
              label: row.source,
              value: row.sessions,
              hint: `${row.percentage}%`,
            }))}
            emptyLabel="No traffic source data yet."
          />
        </section>
        <section className="card section-tight">
          <h2>Devices</h2>
          <BarList
            ariaLabel="Sessions by device type"
            rows={sources.devices.map((row) => ({
              label: row.deviceType,
              value: row.sessions,
              hint: `${row.percentage}%`,
            }))}
            emptyLabel="No device data yet."
          />
        </section>
      </div>
    </>
  );
}

async function GeoBrowser({ db, range, country }: { db: Db; range: Range; country: string }) {
  const geo = await getGeoBreakdown(db, range);
  const selected = geo.find((row) => row.countryCode === country);
  const pages = country ? await getPageBreakdown(db, range, { country }) : [];

  return (
    <>
      <section className="card section-tight">
        <h2>Countries</h2>
        {geo.length === 0 ? (
          <p className="muted">
            No country data recorded. The hosting provider may not expose a country header, or
            no consented traffic has arrived yet.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Country</th>
                <th scope="col">Code</th>
                <th scope="col">Visitors</th>
                <th scope="col">Sessions</th>
                <th scope="col">Page views</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {geo.map((row) => (
                <tr key={row.countryCode ?? "unknown"}>
                  <td>
                    <Link className="link" href={`/admin/analytics?tab=geo&range=${range.key}&country=${row.countryCode ?? ""}`}>
                      {countryName(row.countryCode)}
                    </Link>
                  </td>
                  <td className="small muted">{row.countryCode ?? "—"}</td>
                  <td>{row.visitors.toLocaleString()}</td>
                  <td>{row.sessions.toLocaleString()}</td>
                  <td>{row.pageViews.toLocaleString()}</td>
                  <td>{row.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card section-tight">
        <h2>Distribution</h2>
        <BarList
          ariaLabel="Sessions by country"
          rows={geo.map((row) => ({
            label: countryName(row.countryCode),
            value: row.sessions,
            hint: `${row.percentage}%`,
          }))}
          emptyLabel="No country distribution available."
        />
      </section>

      {selected ? (
        <>
          <section className="card section-tight">
            <h2>{countryName(selected.countryCode)} trend</h2>
            <LineChart
              ariaLabel={`Sessions per day for ${countryName(selected.countryCode)}`}
              data={selected.trend.map((value, index) => ({
                label: new Date(range.from.getTime() + index * 86_400_000).toISOString().slice(0, 10),
                value,
              }))}
            />
          </section>
          <section className="card section-tight">
            <h2>Top pages in {countryName(selected.countryCode)}</h2>
            <BarList
              ariaLabel="Top pages in the selected country"
              rows={pages.slice(0, 10).map((page) => ({
                label: page.title || page.path,
                value: page.pageViews,
                hint: page.path,
              }))}
            />
          </section>
        </>
      ) : null}
    </>
  );
}

async function PagesTab({
  db,
  range,
  pageTypeFilter,
  country,
}: {
  db: Db;
  range: Range;
  pageTypeFilter: string;
  country: string;
}) {
  const pages = await getPageBreakdown(db, range, {
    type: pageTypeFilter,
    country: country || undefined,
  });

  const filters = ["all", "home", "blog", "destinations", "plans", "guides", "games", "other"];

  return (
    <section className="card section-tight">
      <div className="stat-head">
        <h2>Page analytics</h2>
        <div className="chip-row">
          {filters.map((filter) => (
            <Link
              key={filter}
              className={`chip ${pageTypeFilter === filter ? "chip-active" : ""}`}
              href={`/admin/analytics?tab=pages&range=${range.key}&pageType=${filter}${country ? `&country=${country}` : ""}`}
            >
              {filter}
            </Link>
          ))}
        </div>
      </div>
      {pages.length === 0 ? (
        <p className="muted">No page views recorded for this period and filter.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col">Type</th>
              <th scope="col">Views</th>
              <th scope="col">Visitors</th>
              <th scope="col">Sessions</th>
              <th scope="col">Entries</th>
              <th scope="col">Exits</th>
              <th scope="col">Avg session</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.path}>
                <td>
                  <span className="strong">{page.title || page.path}</span>
                  <div className="small muted">{page.path}</div>
                </td>
                <td className="small muted">{pageType(page.path)}</td>
                <td>{page.pageViews.toLocaleString()}</td>
                <td>{page.visitors.toLocaleString()}</td>
                <td>{page.sessions.toLocaleString()}</td>
                <td>{page.entries.toLocaleString()}</td>
                <td>{page.exits.toLocaleString()}</td>
                <td className="small muted">{formatDuration(page.avgEngagementSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

async function GamesTab({ db, range, selectedGame }: { db: Db; range: Range; selectedGame: string }) {
  const games = await getGamesBreakdown(db, range);
  const detail = selectedGame ? await getGameDetail(db, selectedGame, range) : null;

  if (games.length === 0) {
    return (
      <section className="card section-tight">
        <h2>Games analytics</h2>
        <p className="muted">No game events recorded in this period.</p>
        <p className="muted small">
          The current Esimprove storefront does not expose a games section, so no game
          popularity is invented here. When game pages exist, send <code>game_opened</code>,{" "}
          <code>game_started</code>, <code>game_completed</code>, and <code>game_exited</code>{" "}
          events with a stable <code>gameId</code> using <code>window.esimproveTrack</code>.
          A page view is never counted as a completed game.
        </p>
      </section>
    );
  }

  const mostVisited = games[0];
  const leastVisited = [...games].sort((a, b) => a.opened - b.opened)[0];

  return (
    <>
      <div className="stat-grid">
        <article className="card stat">
          <span>Total game opens</span>
          <strong>{games.reduce((sum, game) => sum + game.opened, 0).toLocaleString()}</strong>
        </article>
        <article className="card stat">
          <span>Games tracked</span>
          <strong>{games.length}</strong>
        </article>
        <article className="card stat">
          <span>Most opened</span>
          <strong>{mostVisited?.gameId ?? "—"}</strong>
        </article>
        <article className="card stat">
          <span>Least opened</span>
          <strong>{leastVisited?.gameId ?? "—"}</strong>
        </article>
      </div>

      <section className="card section-tight">
        <h2>Game ranking</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Game ID</th>
              <th scope="col">Opens</th>
              <th scope="col">Starts</th>
              <th scope="col">Completions</th>
              <th scope="col">Exits</th>
              <th scope="col">Sessions</th>
              <th scope="col">Visitors</th>
              <th scope="col">Completion rate</th>
              <th scope="col">Avg time</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.gameId}>
                <td>
                  <Link className="link" href={`/admin/analytics?tab=games&range=${range.key}&game=${encodeURIComponent(game.gameId)}`}>
                    {game.gameId}
                  </Link>
                </td>
                <td>{game.opened.toLocaleString()}</td>
                <td>{game.started.toLocaleString()}</td>
                <td>{game.completed.toLocaleString()}</td>
                <td>{game.exited.toLocaleString()}</td>
                <td>{game.sessions.toLocaleString()}</td>
                <td>{game.visitors.toLocaleString()}</td>
                <td>{game.completionRate === null ? "—" : `${game.completionRate}%`}</td>
                <td>{formatDuration(game.averageSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Completion is only counted when a game sends an explicit completion event. Time is
          measured from the first to last event for that game within a session.
        </p>
      </section>

      {detail ? (
        <>
          <section className="card section-tight">
            <h2>{selectedGame} trend</h2>
            <LineChart
              ariaLabel={`Game events per day for ${selectedGame}`}
              data={detail.trend.map((point) => ({ label: point.date, value: point.occurrences }))}
            />
          </section>
          <div className="inline-grid two">
            <section className="card section-tight">
              <h2>Event breakdown</h2>
              <BarList
                ariaLabel="Game events by type"
                rows={detail.events.map((event) => ({ label: event.eventType, value: event.occurrences }))}
              />
            </section>
            <section className="card section-tight">
              <h2>Game pages</h2>
              <BarList
                ariaLabel="Game page views"
                rows={detail.pages.map((page) => ({ label: page.path, value: page.views }))}
              />
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}

async function ActivitiesTab({ db, range }: { db: Db; range: Range }) {
  const [activities, recent] = await Promise.all([
    getActivityBreakdown(db, range),
    getRecentActivity(db, 25),
  ]);

  return (
    <>
      <section className="card section-tight">
        <h2>Activity overview</h2>
        {activities.length === 0 ? (
          <p className="muted">
            No interaction events recorded in this period. Only page views exist so far, or no
            consented traffic has arrived.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Occurrences</th>
                <th scope="col">Unique sessions</th>
                <th scope="col">Unique visitors</th>
                <th scope="col">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={activity.eventType}>
                  <td className="strong">{activity.eventType}</td>
                  <td>{activity.occurrences.toLocaleString()}</td>
                  <td>{activity.sessions.toLocaleString()}</td>
                  <td>{activity.visitors.toLocaleString()}</td>
                  <td className="small muted">{activity.lastSeen ? activity.lastSeen.toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small">
          Supported events: {TRACKED_EVENT_TYPES.join(", ")}. Passwords, payment details,
          private form content, keystrokes, and session recordings are never collected.
        </p>
      </section>

      <section className="card section-tight">
        <h2>Recent activity</h2>
        {recent.length === 0 ? (
          <p className="muted">No activity recorded yet.</p>
        ) : (
          <ol className="timeline">
            {recent.map((event) => (
              <li key={event.id}>
                <span className="timeline-dot" aria-hidden="true" />
                <div>
                  <strong>{event.eventType}</strong>{" "}
                  <span className="muted small">{event.pagePath}</span>
                  {event.gameId ? <span className="muted small"> · game {event.gameId}</span> : null}
                  {event.countryCode ? <span className="muted small"> · {event.countryCode}</span> : null}
                  <div className="small muted">{event.createdAt.toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

async function SourcesTab({ db, range }: { db: Db; range: Range }) {
  const sources = await getSourceBreakdown(db, range);
  return (
    <>
      <div className="inline-grid two">
        <section className="card section-tight">
          <h2>Traffic sources</h2>
          <BarList
            ariaLabel="Sessions by traffic source"
            rows={sources.sources.map((row) => ({
              label: row.source,
              value: row.sessions,
              hint: `${row.percentage}%`,
            }))}
            emptyLabel="No traffic source data yet. Direct traffic is not assumed when the referrer is unavailable."
          />
          <p className="muted small">
            Campaigns are not inferred. UTM parameters are not currently promoted into a
            separate report because the site does not run campaigns in this build.
          </p>
        </section>
        <section className="card section-tight">
          <h2>Referrers</h2>
          <BarList
            ariaLabel="Sessions by referrer host"
            rows={sources.referrers.map((row) => ({ label: row.host, value: row.sessions }))}
            emptyLabel="No referrer data recorded yet."
          />
        </section>
      </div>

      <div className="inline-grid three">
        <section className="card section-tight">
          <h2>Devices</h2>
          <BarList
            ariaLabel="Sessions by device type"
            rows={sources.devices.map((row) => ({
              label: row.deviceType,
              value: row.sessions,
              hint: `${row.percentage}%`,
            }))}
          />
        </section>
        <section className="card section-tight">
          <h2>Browsers</h2>
          <BarList
            ariaLabel="Sessions by browser"
            rows={sources.browsers.map((row) => ({ label: row.browser, value: row.sessions }))}
          />
        </section>
        <section className="card section-tight">
          <h2>Operating systems</h2>
          <BarList
            ariaLabel="Sessions by operating system"
            rows={sources.operatingSystems.map((row) => ({ label: row.os, value: row.sessions }))}
          />
        </section>
      </div>
    </>
  );
}
