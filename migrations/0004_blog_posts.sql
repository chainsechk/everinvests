-- migrations/0004_blog_posts.sql
-- Auto-generated blog posts (Task 3)

CREATE TABLE blog_posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id    INTEGER REFERENCES signals(id),
  slug         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  category     TEXT NOT NULL,
  published_at TEXT NOT NULL,
  views        INTEGER DEFAULT 0
);

-- Indexes for common queries
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_category ON blog_posts(category);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at);
CREATE INDEX idx_blog_posts_signal_id ON blog_posts(signal_id);
