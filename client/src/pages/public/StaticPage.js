import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { staticPages } from './staticPages';

export default function StaticPage({ pageKey }) {
  const page = staticPages[pageKey] || staticPages.notFound;

  useEffect(() => {
    document.title = `${page.title} | MediCare Pro`;
  }, [page.title]);

  return (
    <div className="landing blog-page">
      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <span className="landing-brand-mark">Medi</span>Care Pro
        </Link>
        <nav className="landing-links">
          <Link to="/">Home</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/#provider-registration">Provider Registration</Link>
        </nav>
        <div className="landing-actions">
          <Link to="/login" className="btn btn-primary">Login / Register</Link>
        </div>
      </header>

      <section className="landing-section static-page">
        <div className="section-header" style={{ textAlign: 'left' }}>
          <h2>{page.title}</h2>
          <p>{page.subtitle}</p>
        </div>
        <div className="static-grid">
          {page.sections.map((section, idx) => (
            <div key={`${page.title}-${idx}`} className="static-card">
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
