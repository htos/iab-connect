'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface PublicBlogPostDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  tags: string[];
  publishedAt: string;
  imageUrl?: string;
}

export default function PublicBlogDetailPage() {
  const t = useTranslations('publicBlog');
  const params = useParams();
  const id = params.id as string;

  const [post, setPost] = useState<PublicBlogPostDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchPost = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/v1/blog/public/${id}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data: PublicBlogPostDto = await res.json();
        setPost(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('de-CH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-24">
          <svg className="h-10 w-10 animate-spin text-orange-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  // Error
  if (error || !post) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <p className="text-red-700">{t('errorMessage')}</p>
          <Link
            href="/public/blog"
            className="mt-4 inline-block rounded-lg bg-orange-600 px-6 py-2 font-semibold text-white hover:bg-orange-700 transition-colors"
          >
            {t('backToBlog')}
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
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t('backToBlog')}
      </Link>

      {/* Header */}
      <article>
        <header className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
              {post.category}
            </span>
            <span className="text-sm text-gray-500">{formatDate(post.publishedAt)}</span>
          </div>

          <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
            {post.title}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700 font-semibold">
              {post.author.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{post.author}</p>
              <p className="text-xs text-gray-500">{formatDate(post.publishedAt)}</p>
            </div>
          </div>
        </header>

        {/* Featured image */}
        {post.imageUrl && (
          <div className="mb-8 overflow-hidden rounded-xl">
            <img
              src={post.imageUrl}
              alt={post.title}
              className="h-auto w-full object-cover"
            />
          </div>
        )}

        {/* Content — render paragraphs by splitting on newlines */}
        <div className="prose prose-lg max-w-none">
          {post.content.split('\n').map((paragraph, idx) => {
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
            <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
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

        {/* Share section (placeholder) */}
        <div className="mt-10 border-t border-gray-200 pt-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {t('share')}
          </h3>
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: post.title, url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {t('copyLink')}
            </button>
          </div>
        </div>
      </article>

      {/* Back to blog */}
      <div className="mt-12 text-center">
        <Link
          href="/public/blog"
          className="inline-block rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700 transition-colors"
        >
          {t('allPosts')}
        </Link>
      </div>
    </div>
  );
}
