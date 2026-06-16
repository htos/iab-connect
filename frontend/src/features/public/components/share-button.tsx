"use client";

/**
 * E28-S2: the blog-detail Share button client island (DEC-4=A). The only
 * interactivity on the otherwise-static blog detail page — `navigator.share` /
 * `navigator.clipboard` / `window.location.href` are client-only APIs, kept
 * verbatim. The resolved label is passed in from the Server Component so the island
 * needs no translator.
 */
export function ShareButton({
  title,
  label,
}: {
  title: string;
  label: string;
}) {
  return (
    <button
      onClick={() => {
        if (navigator.share) {
          navigator.share({ title, url: window.location.href });
        } else {
          navigator.clipboard.writeText(window.location.href);
        }
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
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
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      {label}
    </button>
  );
}
