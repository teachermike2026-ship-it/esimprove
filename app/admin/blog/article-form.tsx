"use client";

import { useActionState, useState } from "react";
import type { BlogArticleWithRelations } from "@/lib/blog";
import { saveArticleAction, type BlogActionState } from "./actions";

type Option = { id: string; name: string };

const initialState: BlogActionState = {};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ArticleForm({
  article,
  categories,
  tags,
}: {
  article?: BlogArticleWithRelations | null;
  categories: Option[];
  tags: Option[];
}) {
  const [state, formAction, pending] = useActionState(saveArticleAction, initialState);
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(article?.slug));
  const [status, setStatus] = useState(article?.status ?? "draft");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    article?.tags.map((tag) => tag.id) ?? [],
  );

  const effectiveSlug = slugTouched ? slug : slugify(title);

  function toggleTag(id: string) {
    setSelectedTags((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  const scheduledDefault = article?.scheduledAt
    ? new Date(article.scheduledAt).toISOString().slice(0, 16)
    : "";

  return (
    <form className="card form" action={formAction}>
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      {state.error ? <div className="alert alert-error">{state.error}</div> : null}
      {state.ok ? <div className="alert alert-ok">Article saved.</div> : null}

      <h2>Article</h2>
      <div className="meta-list stacked">
        <div>
          <label htmlFor="article-title">Title</label>
          <input
            id="article-title"
            name="title"
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="article-slug">Slug</label>
          <input
            id="article-slug"
            name="slug"
            type="text"
            required
            maxLength={100}
            pattern="[a-z0-9-]+"
            value={effectiveSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value.toLowerCase());
            }}
          />
          <p className="muted small">Public URL: /blog/{effectiveSlug || "your-slug"}</p>
        </div>
        <div>
          <label htmlFor="article-excerpt">Excerpt</label>
          <textarea id="article-excerpt" name="excerpt" rows={3} maxLength={500} defaultValue={article?.excerpt ?? ""} />
        </div>
        <div>
          <label htmlFor="article-body">Content (HTML)</label>
          <textarea
            id="article-body"
            name="bodyHtml"
            rows={16}
            required
            defaultValue={article?.bodyHtml ?? ""}
            placeholder="<p>Write your article…</p>"
          />
          <p className="muted small">
            HTML is sanitized on save. Only safe formatting tags are stored.
          </p>
        </div>
      </div>

      <h2>Publishing</h2>
      <div className="inline-grid three">
        <div>
          <label htmlFor="article-status">Status</label>
          <select id="article-status" name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        <div>
          <label htmlFor="article-category">Category</label>
          <select id="article-category" name="categoryId" defaultValue={article?.categoryId ?? ""}>
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="article-scheduledAt">Scheduled publication</label>
          <input
            id="article-scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            defaultValue={scheduledDefault}
            disabled={status !== "scheduled"}
          />
        </div>
      </div>

      <fieldset className="section-tight">
        <legend>Tags</legend>
        {tags.length === 0 ? (
          <p className="muted small">No tags yet. Create tags first.</p>
        ) : (
          <div className="chip-row">
            {tags.map((tag) => (
              <label key={tag.id} className={`chip ${selectedTags.includes(tag.id) ? "chip-active" : ""}`}>
                <input
                  type="checkbox"
                  name="tagIds"
                  value={tag.id}
                  checked={selectedTags.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  hidden
                />
                {tag.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <h2>Media</h2>
      <div className="inline-grid two">
        <div>
          <label htmlFor="article-featuredImage">Featured image URL</label>
          <input id="article-featuredImage" name="featuredImage" type="url" defaultValue={article?.featuredImage ?? ""} />
          <p className="muted small">
            Use a hosted image URL. Local uploads are not persisted on Netlify.
          </p>
        </div>
        <div>
          <label htmlFor="article-featuredAlt">Image alt text</label>
          <input id="article-featuredAlt" name="featuredAlt" type="text" maxLength={300} defaultValue={article?.featuredAlt ?? ""} />
        </div>
      </div>

      <h2>SEO metadata</h2>
      <div className="meta-list stacked">
        <div>
          <label htmlFor="article-seoTitle">SEO title</label>
          <input id="article-seoTitle" name="seoTitle" type="text" maxLength={200} defaultValue={article?.seoTitle ?? ""} />
        </div>
        <div>
          <label htmlFor="article-seoDescription">Meta description</label>
          <textarea id="article-seoDescription" name="seoDescription" rows={3} maxLength={300} defaultValue={article?.seoDescription ?? ""} />
        </div>
        <div>
          <label htmlFor="article-canonicalUrl">Canonical URL</label>
          <input id="article-canonicalUrl" name="canonicalUrl" type="url" defaultValue={article?.canonicalUrl ?? ""} placeholder="Leave blank to use /blog/slug" />
        </div>
        <div>
          <label htmlFor="article-ogImage">Open Graph image URL</label>
          <input id="article-ogImage" name="ogImage" type="url" defaultValue={article?.ogImage ?? ""} />
        </div>
        <div>
          <label htmlFor="article-robots">Robots directive</label>
          <select id="article-robots" name="robots" defaultValue={article?.robots || "index, follow"}>
            <option value="index, follow">index, follow</option>
            <option value="index, nofollow">index, nofollow</option>
            <option value="noindex, follow">noindex, follow</option>
            <option value="noindex, nofollow">noindex, nofollow</option>
          </select>
        </div>
      </div>

      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : article ? "Save article" : "Create article"}
        </button>
      </div>
    </form>
  );
}
