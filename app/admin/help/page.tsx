import { requireAdmin } from "@/lib/auth/guards";

export const metadata = {
  title: "Admin help center",
  robots: { index: false, follow: false },
};

const faqCategories = [
  "General",
  "Getting Started",
  "Installation",
  "Activation",
  "Coverage",
  "Data & Usage",
  "Troubleshooting",
  "Billing",
  "Refunds",
];

export default async function AdminHelpPage() {
  await requireAdmin();
  const faqEntries = [
    { title: "How do I install my eSIM?", category: "Installation", published: true },
    { title: "When does my data plan start?", category: "Data & Usage", published: true },
    { title: "Can I top up my data?", category: "Top-up", published: true },
    { title: "What countries are covered?", category: "Coverage", published: true },
  ];

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Support</p>
          <h1>Help center & FAQ</h1>
          <p className="muted">Manage frequently asked questions and help articles.</p>
        </div>
      </div>

      <section className="card form section-tight">
        <h2>FAQ management</h2>
        {faqEntries.length === 0 ? (
          <div className="callout callout-info">
            <p>No FAQs configured yet. Add FAQs to provide self-service support.</p>
            <ul className="simple-list">
              <li>Category: {faqCategories.join(", ")}</li>
              <li>Fields: Question, Answer, Category, Order, Published</li>
            </ul>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Category</th>
                  <th scope="col">Order</th>
                  <th scope="col">Published</th>
                </tr>
              </thead>
              <tbody>
                {faqEntries.map((faq, i) => (
                  <tr key={i}>
                    <td>{faq.title}</td>
                    <td>{faq.category}</td>
                    <td>—</td>
                    <td>{faq.published ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card form section-tight">
        <h2>Help center configuration</h2>
        <p className="muted">
          Help center pages are file-based in this build. Configure content via:
        </p>
        <ul className="simple-list">
          <li>FAQ page: /legal/faq (needs creation)</li>
          <li>Guides: /guides/[slug]</li>
          <li>Installation guides: embedded in plan detail pages</li>
        </ul>
      </section>
    </>
  );
}