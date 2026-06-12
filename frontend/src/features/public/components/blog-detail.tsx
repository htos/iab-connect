// SPDX-License-Identifier: AGPL-3.0-or-later
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import Image from "next/image";
import { getPublicBlogPost } from "../api/public-content-api";
import { ShareButton } from "./share-button";
import type { PublicBlogPostDto } from "../types/public.types";

/**
 * E28-S2: public blog DETAIL as an async Server Component (DEC-4=A). Reads
 * `params.id` (passed by the route entry), fetches the post at request time, and
 * server-renders the article; only the Share button is a client island. The
 * missing/unpublished path keeps the SINGLE GENERIC ERROR BLOCK that ships today
 * (no Next `notFound()` introduced — A56/AC-3). A79 delta: no client loading
 * spinner (RSC awaits the fetch).
 */
export default async function BlogDetail({ id }: { id: string }) {
  const t = await getTranslations("publicBlog");

  let post: PublicBlogPostDto | null = null;
  let error = false;
  try {
    post = await getPublicBlogPost(id);
  } catch {
    error = true;
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("de-CH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  // Generic error block for missing/unpublished — no distinct 404 (A56/AC-3).
  if (error || !post) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <p className="text-red-700">{t("errorMessage")}</p>
          <Link
            href="/public/blog"
            className="mt-4 inline-block rounded-lg bg-orange-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-orange-700"
          >
            {t("backToBlog")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/public/blog"
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-orange-600 transition-colors hover:text-orange-700"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {t("backToBlog")}
      </Link>

      {/* Header */}
      <article>
        <header className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
              {post.category}
            </span>
            <span className="text-sm text-gray-500">
              {formatDate(post.publishedAt)}
            </span>
          </div>

          <h1 className="text-3xl leading-tight font-bold text-gray-900 sm:text-4xl">
            {post.title}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 font-semibold text-orange-700">
              {post.author.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{post.author}</p>
              <p className="text-xs text-gray-500">
                {formatDate(post.publishedAt)}
              </p>
            </div>
          </div>
        </header>

        {/* Featured image */}
        {post.imageUrl && (
          <div className="mb-8 overflow-hidden rounded-xl">
            <Image
              src={post.imageUrl}
              alt={post.title}
              width={0}
              height={0}
              sizes="100vw"
              className="h-auto w-full object-cover"
              unoptimized
            />
          </div>
        )}

        {/* Content — render paragraphs by splitting on newlines */}
        <div className="prose prose-lg max-w-none">
          {post.content.split("\n").map((paragraph, idx) => {
            const trimmed = paragraph.trim();
            if (!trimmed) return <br key={idx} />;
            return (
              <p key={idx} className="mb-4 leading-relaxed text-gray-700">
                {trimmed}
              </p>
            );
          })}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-10 border-t border-gray-200 pt-6">
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Share section */}
        <div className="mt-10 border-t border-gray-200 pt-6">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
            {t("share")}
          </h3>
          <div className="flex gap-3">
            <ShareButton title={post.title} label={t("copyLink")} />
          </div>
        </div>
      </article>

      {/* Back to blog */}
      <div className="mt-12 text-center">
        <Link
          href="/public/blog"
          className="inline-block rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
        >
          {t("allPosts")}
        </Link>
      </div>
    </div>
  );
}
