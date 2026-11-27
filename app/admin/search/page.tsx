import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, or, sql } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/guards";
import { canAccessAdminSection } from "@/lib/auth/admin-access";
import { getDb } from "@/lib/db/client";
import { orders, plans, users } from "@/lib/db/schema";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Global admin search. Each result type is shown only to roles that may open it. */
export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireStaff("/admin/search", "search");
  const q = ((await searchParams).q ?? "").trim().slice(0, 120);
  const db = await getDb();
  const like = `%${q.toLowerCase()}%`;
  const canOrders = canAccessAdminSection(staff.role, "orders");
  const canCustomers = canAccessAdminSection(staff.role, "customers");
  const canPlans = canAccessAdminSection(staff.role, "plans");
  const [orderRows, customerRows, planRows] =
    q.length < 2
      ? [[], [], []]
      : await Promise.all([
          canOrders
            ? db
                .select()
                .from(orders)
                .where(
                  or(
                    sql`lower(${orders.orderNumber}) like ${like}`,
                    sql`lower(${orders.email}) like ${like}`,
                    sql`lower(${orders.customerName}) like ${like}`,
                  ),
                )
                .orderBy(desc(orders.createdAt))
                .limit(20)
            : Promise.resolve([]),
          canCustomers
            ? db
                .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
                .from(users)
                .where(sql`${users.role} = 'customer' and (lower(${users.email}) like ${like} or lower(${users.name}) like ${like})`)
                .limit(20)
            : Promise.resolve([]),
          canPlans
            ? db
                .select({
                  id: plans.id,
                  name: plans.name,
                  slug: plans.slug,
                  status: plans.status,
                  priceMinor: plans.priceMinor,
                  currency: plans.currency,
                })
                .from(plans)
                .where(or(sql`lower(${plans.name}) like ${like}`, sql`lower(${plans.slug}) like ${like}`, eq(plans.id, q)))
                .limit(20)
            : Promise.resolve([]),
        ]);
  const total = orderRows.length + customerRows.length + planRows.length;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Search</p>
          <h1>{q ? `Results for “${q}”` : "Search"}</h1>
          <p className="muted">
            {q.length < 2 ? "Type at least two characters in the search box above." : `${total} result${total === 1 ? "" : "s"}.`}
          </p>
        </div>
      </div>
      {orderRows.length > 0 ? (
        <section className="card form section-tight">
          <h2>Orders</h2>
          <div className="table-wrap">
            <table className="data-table">
              <tbody>
                {orderRows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/orders/${o.orderNumber}`}>{o.orderNumber}</Link>
                    </td>
                    <td className="small">{o.email || "Guest (no email)"}</td>
                    <td>{formatMoney(o.totalMinor, o.currency)}</td>
                    <td>
                      <StatusBadge status={o.paymentStatus} />
                    </td>
                    <td className="small">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {customerRows.length > 0 ? (
        <section className="card form section-tight">
          <h2>Customers</h2>
          <div className="table-wrap">
            <table className="data-table">
              <tbody>
                {customerRows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/customers/${u.id}`}>{u.name}</Link>
                    </td>
                    <td className="small">{u.email}</td>
                    <td className="small">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {planRows.length > 0 ? (
        <section className="card form section-tight">
          <h2>Plans</h2>
          <div className="table-wrap">
            <table className="data-table">
              <tbody>
                {planRows.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="small">{p.slug}</td>
                    <td>{formatMoney(p.priceMinor, p.currency)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {q.length >= 2 && total === 0 ? (
        <div className="card form section-tight">
          <p className="muted">Nothing matches. Try an order number (ES-…), an email address or a plan name.</p>
        </div>
      ) : null}
    </>
  );
}
