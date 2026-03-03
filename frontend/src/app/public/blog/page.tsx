'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';

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

export default function PublicBlogPage() {
  const t = useTranslations('publicBlog');

  const [posts, setPosts] = useState<PublicBlogPostDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/v1/blog/public`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data: PublicBlogPostDto[] = await res.json();
        setPosts(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const filteredPosts = useMemo(() => {
    if (!search.trim()) return posts;
    const q = search.toLowerCase();
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [posts, search]);

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

  const getExcerpt = (post: PublicBlogPostDto) => {
    if (post.excerpt) return post.excerpt.slice(0, 200);
    return post.content.slice(0, 200) + (post.content.length > 200 ? '…' : '');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-4 text-lg text-gray-600">{t('subtitle')}</p>
      </div>

      {/* Search */}
      <div className="mx-auto mb-10 max-w-xl">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-lg border border-gray-300 py-3 pl-12 pr-4 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <svg className="h-10 w-10 animate-spin text-orange-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <p className="text-red-700">{t('errorMessage')}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-orange-600 px-6 py-2 font-semibold text-white hover:bg-orange-700 transition-colors"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filteredPosts.length === 0 && (
        <div className="rounded-xl bg-gray-50 p-12 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-gray-500">
            {search ? t('noResults') : t('empty')}
          </p>
        </div>
      )}

      {/* Posts grid */}
      {!loading && !error && filteredPosts.length > 0 && (
        <div className="grid gap-8 md:grid-cols-2">
          {filteredPosts.map((post) => (
            <Link
              key={post.id}
              href={`/public/blog/${post.id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              {post.imageUrl && (
                <div className="relative h-48 overflow-hidden bg-gray-100">
                  <Image
                    src={post.imageUrl}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    unoptimized
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col p-6">
                <div className="mb-3 flex items-center gap-3">
                  <span className="rounded-full bg-orange-100 px-3 py-0.5 text-xs font-medium text-orange-700">
                    {post.category}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(post.publishedAt)}</span>
                </div>
                <h2 className="mb-2 text-xl font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                  {post.title}
                </h2>
                <p className="mb-4 flex-1 text-sm text-gray-600 leading-relaxed">
                  {getExcerpt(post)}
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{post.author}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
