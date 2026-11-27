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
import {
  getCatalogueAnalytics,
  getDemoOrderValue,
  getOrdersByFulfillmentStatus,
  getOrdersByPaymentStatus,
  getOrdersSeries,
  getRegistrationsSeries,
  getTopDestinationsByOrders,
  getTopPlansByOrders,
  resolveCommerceRange,
  type CommerceRange,
} from "@/lib/analytics-commerce";
import { formatDate, formatMoney } from "@/lib/money";
import { BarList, LineChart } from "@/components/analytics-charts";
import { FUNNEL_STAGES, getFunnelReport, getScrollReport, type FunnelGroup } from "@/lib/analytics-funnel";
import { ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

const TABS = [
  { key: "commerce", label: "Commerce" },
  { key: "overview", label: "Overview" },
  { key: "geo", label: "Geography" },
  { key: "pages", label: "Pages" },
  { key: "games", label: "Games" },
  { key: "activities", label: "Activities" },
  { key: "sources", label: "Sources & devices" },
  { key: "funnel", label: "Funnel & scroll" },
] as const;

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "custom", label: "Custom" },
];

const COMMERCE_RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "all", label: "All time" },
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
    : "commerce";
  const isCommerce = tab === "commerce";
  const commerceRange = resolveCommerceRange(stringParam(params, "range") || "7d");
  // Web-analytics tabs keep the shared resolver; the Commerce tab never uses it.
  const webRange = isCommerce
    ? resolveAnalyticsRange({ range: "7d" })
    : resolveAnalyticsRange({
        range: stringParam(params, "range") || "7d",
        from: stringParam(params, "from"),
        to: stringParam(params, "to"),
      });
  const rangeForChips = isCommerce ? commerceRange.key : webRange.key;
  const rangeLabel = isCommerce ? commerceRange.label : webRange.label;
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
          <select name="range" defaultValue={rangeForChips} aria-label="Date range">
            {(isCommerce ? COMMERCE_RANGE_OPTIONS : RANGE_OPTIONS).map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          {isCommerce ? null : (
            <>
              <input type="date" name="from" defaultValue={webRange.key === "custom" ? stringParam(params, "from") : ""} aria-label="From date" />
              <input type="date" name="to" defaultValue={webRange.key === "custom" ? stringParam(params, "to") : ""} aria-label="To date" />
            </>
          )}
          <button type="submit" className="btn btn-secondary">Apply</button>
          <span className="small muted">{rangeLabel}</span>
        </form>
        <nav className="analytics-tabs" aria-label="Analytics sections">
          {TABS.map((entry) => (
            <Link
              key={entry.key}
              href={`/admin/analytics?tab=${entry.key}&range=${rangeForChips}${country ? `&country=${country}` : ""}`}
              className={`chip ${tab === entry.key ? "chip-active" : ""}`}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      </section>

      {tab === "commerce" ? (
        <CommerceTab db={db} range={commerceRange} />
      ) : tab === "funnel" ? (
        <FunnelTab db={db} range={webRange} group={stringParam(params, "group")} />
      ) : !hasData ? (
        <EmptyState />
      ) : tab === "overview" ? (
        <OverviewTab db={db} range={webRange} />
      ) : tab === "geo" ? (
        <GeoBrowser db={db} range={webRange} country={country} />
      ) : tab === "pages" ? (
        <PagesTab db={db} range={webRange} pageTypeFilter={pageTypeFilter} country={country} />
      ) : tab === "games" ? (
        <GamesTab db={db} range={webRange} selectedGame={selectedGame} />
      ) : tab === "activities" ? (
        <ActivitiesTab db={db} range={webRange} />
      ) : (
        <SourcesTab db={db} range={webRange} />
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

const FUNNEL_GROUPS: Array<{ key: FunnelGroup; label: string }> = [
  { key: "all", label: "All" },
  { key: "device", label: "By device" },
  { key: "source", label: "By traffic source" },
  { key: "country", label: "By country" },
];

async function FunnelTab({ db, range, group }: { db: Db; range: Range; group?: string }) {
  const selected = (FUNNEL_GROUPS.some((g) => g.key === group) ? group : "all") as FunnelGroup;
  const [funnel, scroll] = await Promise.all([getFunnelReport(db, range, selected), getScrollReport(db, range)]);
  const first = funnel.stages[0]?.count ?? 0;
  return (
    <>
      <section className="card section-tight">
        <h2>Sales funnel</h2>
        <p className="muted small">
          Browsing stages count distinct sessions of visitors who accepted analytics cookies (pseudonymous; internal
          traffic excluded). Payment and delivery come from order records, which do not depend on consent, so the two
          parts are shown side by side rather than joined per person.
        </p>
        <BarList
          ariaLabel="Funnel stages"
          rows={funnel.stages.map((stage) => ({
            label: stage.label,
            value: stage.count,
            hint:
              stage.fromPrevious === null
                ? "sessions"
                : `${stage.fromPrevious}% of previous · ${stage.fromFirst}% of visitors`,
          }))}
        />
        <div className="stat-grid section-tight">
          <article className="card stat">
            <span>Payments confirmed</span>
            <strong>{funnel.paidOrders}</strong>
            <p className="muted small">Paid orders in this period (verified payments only).</p>
          </article>
          <article className="card stat">
            <span>eSIMs delivered</span>
            <strong>{funnel.deliveredOrders}</strong>
            <p className="muted small">Paid orders in this period that were delivered.</p>
          </article>
          <article className="card stat">
            <span>Checkout → payment</span>
            <strong>
              {funnel.stages[4]?.count ? `${Math.round((funnel.paidOrders / funnel.stages[4].count) * 1000) / 10}%` : "—"}
            </strong>
            <p className="muted small">Approximate: paid orders ÷ consenting checkout sessions.</p>
          </article>
          <article className="card stat">
            <span>Visitor → payment</span>
            <strong>{first ? `${Math.round((funnel.paidOrders / first) * 1000) / 10}%` : "—"}</strong>
            <p className="muted small">Approximate, for the same reason.</p>
          </article>
        </div>
      </section>

      <section className="card section-tight">
        <div className="admin-toolbar">
          <h2>Conversion by segment</h2>
          <nav className="pill-row" aria-label="Segment">
            {FUNNEL_GROUPS.map((g) => (
              <a
                key={g.key}
                className={`chip ${selected === g.key ? "chip-active" : ""}`}
                href={`/admin/analytics?tab=funnel&range=${range.key}&group=${g.key}`}
              >
                {g.label}
              </a>
            ))}
          </nav>
        </div>
        {funnel.byGroup.length === 0 ? (
          <p className="muted small">No funnel events in this period yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Segment</th>
                  {FUNNEL_STAGES.map((s) => (
                    <th key={s.key}>{s.label}</th>
                  ))}
                  <th>Visit → checkout</th>
                </tr>
              </thead>
              <tbody>
                {funnel.byGroup.map((row) => (
                  <tr key={row.group}>
                    <td>{row.group}</td>
                    {row.stages.map((n, i) => (
                      <td key={i}>{n}</td>
                    ))}
                    <td>{row.stages[0] ? `${Math.round((row.stages[4]! / row.stages[0]) * 1000) / 10}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="form-note">
          Traffic sources are classified from the referrer host only. AI assistants are counted only when their host is
          recognised; everything else falls under its search, social, referral, direct or unknown category.
        </p>
      </section>

      <section className="card section-tight">
        <h2>Scroll depth</h2>
        <p className="muted small">
          Milestone events (25/50/75/90%) on public pages, at most four per page view. Individual scroll positions are
          not recorded. Tracking starts with this release, so earlier periods are empty.
        </p>
        <BarList
          ariaLabel="Scroll milestones reached"
          rows={scroll.milestones.map((m) => ({ label: `Reached ${m.depth}%`, value: m.events, hint: "page views" }))}
        />
        {scroll.pages.length > 0 ? (
          <div className="table-wrap section-tight">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Views</th>
                  <th>Reached 50%</th>
                  <th>Reached 90%</th>
                </tr>
              </thead>
              <tbody>
                {scroll.pages.map((p) => (
                  <tr key={p.path}>
                    <td className="small">{p.path}</td>
                    <td>{p.views}</td>
                    <td>{p.views ? `${Math.round((p.reached50 / p.views) * 100)}%` : "—"}</td>
                    <td>{p.views ? `${Math.round((p.reached90 / p.views) * 100)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
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


async function CommerceTab({ db, range }: { db: Db; range: CommerceRange }) {
  const [orderSeries, registrationSeries, demoValue, ordersByPayment, ordersByFulfillment, topPlans, topDestinations, catalogue] =
    await Promise.all([
      getOrdersSeries(db, range),
      getRegistrationsSeries(db, range),
      getDemoOrderValue(db, range),
      getOrdersByPaymentStatus(db, range),
      getOrdersByFulfillmentStatus(db, range),
      getTopPlansByOrders(db, range, 10),
      getTopDestinationsByOrders(db, range, 10),
      getCatalogueAnalytics(db),
    ]);

  return (
    <>
      <div className="inline-grid two">
        <section className="card section-tight">
          <h2>Orders over time</h2>
          <LineChart
            ariaLabel={`Orders per ${range.bucket} for ${range.label}`}
            data={orderSeries.map((point) => ({ label: point.bucket, value: point.value }))}
          />
          <p className="muted small">Orders created per {range.bucket}. Includes every mock order regardless of payment status.</p>
        </section>
        <section className="card section-tight">
          <h2>Customer registrations over time</h2>
          <LineChart
            ariaLabel={`Customer registrations per ${range.bucket} for ${range.label}`}
            data={registrationSeries.map((point) => ({ label: point.bucket, value: point.value }))}
          />
          <p className="muted small">New customer accounts per {range.bucket} (UTC).</p>
        </section>
      </div>

      <section className="card section-tight">
        <h2>DEMO order value over time</h2>
        {demoValue.primaryCurrency ? (
          <>
            <div className="stat-grid">
              {demoValue.byCurrency.map((entry) => (
                <article className="card stat" key={entry.currency}>
                  <span>Paid mock orders ({entry.currency})</span>
                  <strong>{formatMoney(entry.totalMinor, entry.currency)}</strong>
                  <p className="muted small">DEMO — mock payment totals, never real revenue.</p>
                </article>
              ))}
            </div>
            <LineChart
              ariaLabel={`Demo order value per ${range.bucket} for ${range.label} (${demoValue.primaryCurrency})`}
              data={demoValue.series.map((point) => ({ label: point.bucket, value: Math.round(point.value / 100) }))}
            />
            <p className="muted small">
              DEMO: sums of paid mock orders in the most common currency in this period
              ({demoValue.primaryCurrency}), shown in major units. This is not revenue, not accounting,
              and not a financial report.
            </p>
          </>
        ) : (
          <p className="muted">No paid mock orders in this period yet. Demo totals will appear here once orders are paid.</p>
        )}
      </section>

      <div className="inline-grid two">
        <section className="card section-tight">
          <h2>Orders by payment status</h2>
          <BarList
            ariaLabel="Orders by payment status"
            rows={ordersByPayment.map((row) => ({ label: row.status, value: row.count }))}
            emptyLabel="No orders in this period."
          />
        </section>
        <section className="card section-tight">
          <h2>Orders by fulfillment status</h2>
          <BarList
            ariaLabel="Orders by fulfillment status"
            rows={ordersByFulfillment.map((row) => ({ label: row.status, value: row.count }))}
            emptyLabel="No orders in this period."
          />
        </section>
      </div>

      <div className="inline-grid two">
        <section className="card section-tight">
          <h2>Top plans by orders</h2>
          <BarList
            ariaLabel="Top plans by ordered quantity"
            rows={topPlans.map((row) => ({ label: row.label, value: row.quantity, hint: "units ordered" }))}
            emptyLabel="No ordered plans in this period."
          />
        </section>
        <section className="card section-tight">
          <h2>Top destinations by orders</h2>
          <BarList
            ariaLabel="Top destinations by ordered quantity"
            rows={topDestinations.map((row) => ({ label: row.label, value: row.quantity, hint: row.hint }))}
            emptyLabel="No destination data in this period."
          />
        </section>
      </div>

      <section className="card section-tight">
        <div className="admin-toolbar">
          <h2>Catalogue</h2>
          <Link className="button button-ghost button-small" href="/admin/plans">Manage catalogue <ArrowRight className="inline-icon" /></Link>
        </div>
        <div className="stat-grid">
          <article className="card stat">
            <span>Published plans</span>
            <strong>{catalogue.plansByStatus.published}</strong>
            <p className="muted small">Live in the catalogue.</p>
          </article>
          <article className="card stat">
            <span>Draft plans</span>
            <strong>{catalogue.plansByStatus.draft}</strong>
            <p className="muted small">Not visible to customers.</p>
          </article>
          <article className="card stat">
            <span>Archived plans</span>
            <strong>{catalogue.plansByStatus.archived}</strong>
            <p className="muted small">Hidden but kept for order history.</p>
          </article>
          <article className="card stat">
            <span>Published plans with zero orders</span>
            <strong>{catalogue.zeroOrderPlans}</strong>
            <p className="muted small">Live plans never ordered.</p>
          </article>
        </div>

        <div className="inline-grid two">
          <div>
            <h3 className="small muted">Published plans with zero orders</h3>
            {catalogue.zeroOrderPlanList.length === 0 ? (
              <p className="muted small">Every published plan has at least one order.</p>
            ) : (
              <ul className="simple-list">
                {catalogue.zeroOrderPlanList.map((plan) => (
                  <li key={plan.id}>
                    <Link className="link" href="/admin/plans">{plan.name}</Link>{" "}
                    <span className="muted small">· {plan.destinationName}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="small muted">Recent catalogue changes</h3>
            {catalogue.recentChanges.length === 0 ? (
              <p className="muted small">No catalogue changes recorded yet.</p>
            ) : (
              <ul className="simple-list">
                {catalogue.recentChanges.map((change) => (
                  <li key={change.id}>
                    <span className="small">{change.action.replace(/^admin\./, "")}</span>{" "}
                    <span className="muted small">{formatDate(change.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
