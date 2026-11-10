import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { orders, users } from "@/lib/db/schema";
import { formatDate } from "@/lib/money";

export const metadata: Metadata = {
  title: "Admin customers",
  robots: { index: false, follow: false },
};

export default async function AdminCustomersPage() {
  await requireStaff("/admin/customers", "customers");
  const db = await getDb();
  const [userRows, orderRows] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)).limit(200),
    db.select({ userId: orders.userId, status: orders.status, totalMinor: orders.totalMinor }).from(orders),
  ]);

  const statsByUser = new Map<string, { orderCount: number; spentMinor: number }>();
  for (const order of orderRows) {
    if (!order.userId) continue;
    const current = statsByUser.get(order.userId) ?? { orderCount: 0, spentMinor: 0 };
    current.orderCount += 1;
    if (order.status === "paid") current.spentMinor += order.totalMinor;
    statsByUser.set(order.userId, current);
  }

  const customerStats = userRows.map((user) => ({
    user,
    ...(statsByUser.get(user.id) ?? { orderCount: 0, spentMinor: 0 }),
  }));

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Demo operations</p>
          <h1>Customers</h1>
          <p className="muted">Registered accounts and their order activity.</p>
        </div>
      </div>
      {customerStats.length === 0 ? (
        <div className="card form">
          <p className="muted">No customer accounts exist yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Role</th>
                <th scope="col">Joined</th>
                <th scope="col">Orders</th>
                <th scope="col">Paid spend</th>
              </tr>
            </thead>
            <tbody>
              {customerStats.map(({ user, orderCount, spentMinor }) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <br />
                    <span className="small muted">{user.email}</span>
                  </td>
                  <td>
                    <span className="badge badge-neutral">{user.role}</span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{orderCount}</td>
                  <td>{orderCount > 0 ? spentMinor / 100 : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Showing the most recent 200 registered accounts.</p>
    </>
  );
}
