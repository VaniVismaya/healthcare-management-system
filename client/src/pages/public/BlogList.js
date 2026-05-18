import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { blogCategories, blogPosts } from './blogData';
import { blogAPI } from '../../utils/api';

const PUBLIC_POSTS_CACHE_KEY = 'medicare_public_posts_v1';
const PUBLIC_POSTS_CACHE_TS_KEY = 'medicare_public_posts_checked_at';
const PUBLIC_POSTS_CACHE_TTL_MS = 5 * 60 * 1000;

const BlogList = () => {
  const [category, setCategory] = useState('All');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'MediCare Pro Blog';
  }, []);

  useEffect(() => {
    const readCachedPosts = () => {
      try {
        const raw = localStorage.getItem(PUBLIC_POSTS_CACHE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    };

    const shouldRefreshPosts = () => {
      try {
        const lastChecked = Number(localStorage.getItem(PUBLIC_POSTS_CACHE_TS_KEY) || 0);
        return !lastChecked || (Date.now() - lastChecked) > PUBLIC_POSTS_CACHE_TTL_MS;
      } catch {
        return true;
      }
    };

    const cachePosts = (items) => {
      try {
        localStorage.setItem(PUBLIC_POSTS_CACHE_KEY, JSON.stringify(items || []));
        localStorage.setItem(PUBLIC_POSTS_CACHE_TS_KEY, String(Date.now()));
      } catch {
        // Ignore storage failures.
      }
    };

    const cachedPosts = readCachedPosts();
    if (cachedPosts.length) {
      setPosts(cachedPosts);
      setLoading(false);
    }

    if (cachedPosts.length && !shouldRefreshPosts()) {
      return;
    }

    let isMounted = true;
    setLoading(true);
    blogAPI.listPublic()
      .then(({ data }) => {
        const list = data?.posts || [];
        if (isMounted) {
          const next = list.length ? list : blogPosts;
          setPosts(next);
          cachePosts(next);
        }
      })
      .catch(() => { if (isMounted) setPosts(blogPosts); })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const source = posts.length ? posts : blogPosts;
    if (category === 'All') return source;
    return source.filter(post => post.category === category);
  }, [category, posts]);

  return (
    <div className="landing blog-page">
      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <span className="landing-brand-mark">Medi</span>Care Pro
        </Link>
        <nav className="landing-links">
          <Link to="/">Home</Link>
          <Link to="/#provider-registration">Provider Registration</Link>
        </nav>
        <div className="landing-actions">
          <Link to="/login" className="btn btn-primary">Login / Register</Link>
        </div>
      </header>

      <section className="landing-section">
        <div className="section-header" style={{ textAlign: 'left' }}>
          <h2>Health Guides & Doctor Articles</h2>
          <p>Practical, verified advice written by clinic professionals.</p>
        </div>
        <div className="blog-categories">
          {blogCategories.map(cat => (
            <button
              key={cat}
              className={`chip ${category === cat ? 'chip-active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="blog-grid">
          {filtered.map(post => (
            <Link key={post.id} to={`/blog/${post.slug}`} className="blog-card">
              <div className="blog-cover" style={{ background: post.cover || post.cover_image || 'linear-gradient(135deg, #0A7EA4 0%, #00B894 100%)' }} />
              <div className="blog-body">
                <span className="blog-category">{post.category}</span>
                <h3>{post.title}</h3>
                <p>{post.excerpt || post.summary}</p>
                <div className="blog-meta">
                  <span>{post.author || post.author_name}</span>
                  <span>-</span>
                  <span>{post.readTime || (post.published_at ? 'Published' : 'Draft')}</span>
                </div>
                <div className="blog-readmore">
                  Read Article <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <BookOpen />
            <h3>No posts in this category yet</h3>
            <p>Try another category or check back soon.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default BlogList;

