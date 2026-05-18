import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { blogPosts } from './blogData';
import { blogAPI } from '../../utils/api';

const BlogPost = () => {
  const { slug } = useParams();
  const [post, setPost] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    blogAPI.getBySlug(slug)
      .then(({ data }) => { if (isMounted) setPost(data?.post || null); })
      .catch(() => {
        const fallback = blogPosts.find(p => p.slug === slug) || null;
        if (isMounted) setPost(fallback);
      })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [slug]);

  useEffect(() => {
    document.title = post ? `${post.title} | MediCare Pro` : 'Article Not Found | MediCare Pro';
  }, [post]);

  if (!post && !loading) {
    return (
      <div className="landing blog-page">
        <header className="landing-nav">
          <Link to="/" className="landing-brand">
            <span className="landing-brand-mark">Medi</span>Care Pro
          </Link>
          <nav className="landing-links">
            <Link to="/blog">Blog</Link>
            <Link to="/#provider-registration">Provider Registration</Link>
          </nav>
        </header>
        <section className="landing-section">
          <div className="empty-state">
            <h3>Article not found</h3>
            <p>We could not locate that post. Go back to the blog list.</p>
            <Link to="/blog" className="btn btn-primary" style={{ marginTop: 12 }}>Back to Blog</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="landing blog-page">
      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <span className="landing-brand-mark">Medi</span>Care Pro
        </Link>
        <nav className="landing-links">
          <Link to="/blog">Blog</Link>
          <Link to="/#provider-registration">Provider Registration</Link>
        </nav>
        <div className="landing-actions">
          <Link to="/login" className="btn btn-primary">Login / Register</Link>
        </div>
      </header>

      <section className="landing-section blog-post">
        <Link to="/blog" className="blog-back"><ArrowLeft size={14} /> Back to Blog</Link>
        <div className="blog-post-header">
          <span className="blog-category">{post.category}</span>
          <h1>{post.title}</h1>
          <div className="blog-meta">
            <span>{post.author} - {post.authorRole}</span>
            <span><Calendar size={14} /> {post.date}</span>
            <span><Clock size={14} /> {post.readTime}</span>
          </div>
          <div className="blog-cover" style={{ background: post.cover || post.cover_image || 'linear-gradient(135deg, #0A7EA4 0%, #00B894 100%)' }} />
        </div>
        <div className="blog-post-body">
          {Array.isArray(post.content) ? (
            post.content.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))
          ) : (
            String(post.content || '')
              .split(/\n+/)
              .filter(Boolean)
              .map((paragraph, idx) => <p key={idx}>{paragraph}</p>)
          )}
        </div>
      </section>
    </div>
  );
};

export default BlogPost;

