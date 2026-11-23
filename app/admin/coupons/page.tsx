import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAdminCoupons } from "@/lib/admin";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Admin coupons",
  robots: { index: false, follow: false },
};

export default async function AdminCouponsPage() {
  await requireStaff("/admin/coupons", "coupons");
  const db = await getDb();
  const coupons = await listAdminCoupons(db, 100);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Coupons</h1>
          <p className="muted">Promo codes and redemption records.</p>
        </div>
      </div>
      {coupons.length === 0 ? (
        <div className="card form">
          <p className="muted">No promo codes are configured.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Kind</th>
                <th scope="col">Value</th>
                <th scope="col">Status</th>
                <th scope="col">Redemptions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td>
                    <strong>{coupon.code}</strong>
                  </td>
                  <td>{coupon.kind}</td>
                  <td>{coupon.kind === "percent" ? `${coupon.value / 100}%` : formatMoney(coupon.value)}</td>
                  <td>
                    <span className="badge badge-neutral">{coupon.status}</span>
                  </td>
                  <td>{coupon.redeemedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
