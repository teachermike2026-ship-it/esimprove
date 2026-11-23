import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAdminPlans, listAdminPricingRules } from "@/lib/admin";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Admin pricing",
  robots: { index: false, follow: false },
};

export default async function AdminPricingPage() {
  await requireStaff("/admin/pricing", "pricing");
  const db = await getDb();
  const [plans, rules] = await Promise.all([listAdminPlans(db, 120), listAdminPricingRules(db, 100)]);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Pricing rules</h1>
          <p className="muted">Central pricing rules and synced plan cost/selling price pairs.</p>
        </div>
      </div>
      <section className="card form">
        <h2>Pricing rules</h2>
        {rules.length === 0 ? (
          <p className="muted">No custom pricing rules configured.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Type</th>
                  <th scope="col">Value</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <strong>{rule.code}</strong>
                    </td>
                    <td>{rule.type}</td>
                    <td>{rule.value}</td>
                    <td>
                      <span className="badge badge-neutral">{rule.isDemo ? "illustrative" : "live"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card form section-tight">
        <h2>Synced plans</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Supplier product</th>
                <th scope="col">Cost</th>
                <th scope="col">Selling price</th>
                <th scope="col">Margin</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(({ plan, destinationName }) => {
                const marginBps = plan.priceMinor - plan.costMinor;
                const margin = plan.costMinor > 0 ? marginBps / plan.costMinor : null;
                return (
                  <tr key={plan.id}>
                    <td>
                      {plan.name}
                      <br />
                      <span className="small muted">{destinationName}</span>
                    </td>
                    <td className="small">{plan.supplierProductId}</td>
                    <td>{formatMoney(plan.costMinor, plan.currency)}</td>
                    <td>{formatMoney(plan.priceMinor, plan.currency)}</td>
                    <td>{margin === null ? "—" : `${(margin * 100).toFixed(2)}%`}</td>
                    <td>
                      <span className="badge badge-neutral">{plan.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
