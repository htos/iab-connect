// SPDX-License-Identifier: AGPL-3.0-or-later
import BlogDetail from "@/features/public/components/blog-detail";

/**
 * E28-S2: thin route entry for the public blog detail. Awaits the route `params`
 * (Next 16 — `params` is a Promise) and delegates to the slice's async Server
 * Component, which fetches the post at request time and keeps the generic error
 * block (no `notFound()`). Returning the content fn's promise flattens so the page
 * resolves to fully-rendered JSX. DEC-4=A.
 */
export default async function PublicBlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return BlogDetail({ id });
}
