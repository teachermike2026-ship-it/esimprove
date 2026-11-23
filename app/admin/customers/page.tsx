import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listCustomers } from "@/lib/analytics-commerce";
import { formatDate, formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Admin customers",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;

type Params = Record<string, string | string[] | undefined>;

function stringParam(params: Params, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

function pageParam(params: Params): number {
  const value = Number.parseInt(stringParam(params, "page"), 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireStaff("/admin/customers", "customers");
  const params = await searchParams;
  const q = stringParam(params, "q").trim();
  const page = pageParam(params);

  const db = await getDb();
  const result = await listCustomers(db, { q, page, pageSize: PAGE_SIZE });
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);
  const pageLink = (target: number) =>
    `/admin/customers?page=${target}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Customers</h1>
          <p className="muted">Registered customer accounts and their order activity.</p>
        </div>
      </div>

      <form method="get" className="toolbar" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Search name or email…" aria-label="Search customers by name or email" />
        <button type="submit" className="btn btn-secondary">Search</button>
        {q ? <Link className="button button-ghost button-small" href="/admin/customers">Clear</Link> : null}
        <span className="small muted">
          {result.total.toLocaleString()} account{result.total === 1 ? "" : "s"}{q ? ` matching “${q}”` : ""}
        </span>
      </form>

      {result.items.length === 0 ? (
        <div className="card form">
          <p className="muted">{q ? `No customer accounts match “${q}”.` : "No customer accounts exist yet."}</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Orders</th>
                  <th scope="col">DEMO total value (paid mock orders)</th>
                  <th scope="col"><span className="visually-hidden">Detail</span></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>{customer.name}</strong>
                      <br />
                      <span className="small muted">{customer.email}</span>
                    </td>
                    <td>
                      {customer.emailVerifiedAt ? (
                        <span className="badge badge-success">Verified</span>
                      ) : (
                        <span className="badge badge-neutral">Unverified</span>
                      )}
                      <div className="small muted">{customer.emailVerifiedAt ? formatDate(customer.emailVerifiedAt) : "Not verified"}</div>
                    </td>
                    <td>{formatDate(customer.createdAt)}</td>
                    <td>{customer.orders}</td>
                    <td>
                      {customer.orders > 0
                        ? formatMoney(customer.paidValueMinor, customer.currency)
                        : "—"}
                      <div className="small muted">DEMO — mock payments</div>
                    </td>
                    <td>
                      <Link className="button button-ghost button-small" href={`/admin/customers/${customer.id}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-toolbar">
            <span className="small muted">
              Showing {from}–{to} of {result.total.toLocaleString()} · DEMO totals are illustrative mock-payment sums and are not revenue.
            </span>
            <nav className="chip-row" aria-label="Customers pagination">
              {result.page > 1 ? (
                <Link className="chip" href={pageLink(result.page - 1)}>← Previous</Link>
              ) : null}
              <span className="small muted">Page {result.page} of {result.totalPages}</span>
              {result.page < result.totalPages ? (
                <Link className="chip" href={pageLink(result.page + 1)}>Next →</Link>
              ) : null}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
