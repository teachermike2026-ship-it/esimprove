import { ImageResponse } from "next/og";
import { ArticleArt } from "@/components/blog/article-art";
import { editorialCategoryName, getEditorialArticle } from "@/lib/editorial";

/**
 * 1200×630 PNG for Open Graph / social cards and Article structured data.
 * Social networks do not accept SVG previews, so the editorial illustration
 * is rasterised here together with the title.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getEditorialArticle(slug);
  if (!article) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#11182c" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex" }}>
          <ArticleArt theme={article.art.theme} alt="" width={1200} height={675} decorative />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: 1200,
            display: "flex",
            flexDirection: "column",
            padding: "40px 56px",
            background: "rgba(17, 24, 44, 0.88)",
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex", fontSize: 26, color: "#5acf70", letterSpacing: 1 }}>
            {`ESIMPROVE · ${editorialCategoryName(article.category).toUpperCase()}`}
          </div>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 700, lineHeight: 1.12, marginTop: 10 }}>{article.title}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
    },
  );
}
