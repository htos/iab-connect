// SPDX-License-Identifier: AGPL-3.0-or-later
import { getTranslations } from "next-intl/server";
import { getPublicBlogPosts } from "../api/public-content-api";
import { BlogSearch } from "./blog-search";
import type { PublicBlogPostDto } from "../types/public.types";

/**
 * E28-S2: public blog LIST as an async Server Component (DEC-4=A). Fetches the
 * posts at request time and server-renders the hero; the search box + filtered
 * card grid + error/empty states live in the `<BlogSearch>` client island (the
 * only interactivity). A79 delta: the client loading spinner is gone (RSC awaits
 * the server fetch); error/empty COPY is identical.
 */
export default async function BlogList() {
  const t = await getTranslations("publicBlog");

  let posts: PublicBlogPostDto[] = [];
  let error = false;
  try {
    posts = await getPublicBlogPosts();
  } catch {
    error = true;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-4 text-lg text-gray-600">{t("subtitle")}</p>
      </div>

      <BlogSearch posts={posts} error={error} />
    </div>
  );
}
