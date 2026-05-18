const { pool } = require('../config/database');
const { logAuditFromRequest } = require('../utils/audit');

const slugify = (title) => {
  const base = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 200);
  return base || `post-${Date.now()}`;
};

const ensureUniqueSlug = async (title, excludeId = null) => {
  const base = slugify(title);
  let slug = base;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = excludeId ? [slug, excludeId] : [slug];
    const [existing] = await pool.query(
      excludeId
        ? 'SELECT id FROM blog_posts WHERE slug = ? AND id != ?'
        : 'SELECT id FROM blog_posts WHERE slug = ?',
      params
    );
    if (!existing.length) return slug;
    slug = `${base}-${i++}`;
  }
};

const mapPostPayload = async (payload = {}, options = {}) => {
  const title = String(payload.title || '').trim();
  const content = String(payload.content || '').trim();
  if (!title || !content) {
    const err = new Error('Title and content are required');
    err.statusCode = 400;
    throw err;
  }

  return {
    title,
    summary: String(payload.summary || '').trim() || null,
    content,
    category: String(payload.category || '').trim() || null,
    cover_image: String(payload.cover_image || '').trim() || null,
    status: options.allowStatus && ['draft', 'pending', 'approved', 'rejected'].includes(payload.status)
      ? payload.status
      : (options.defaultStatus || 'pending'),
    admin_remarks: options.allowStatus ? (String(payload.admin_remarks || '').trim() || null) : null,
  };
};

exports.listPublic = async (req, res) => {
  try {
    const [posts] = await pool.query(
      `SELECT b.id, b.slug, b.title, b.summary, b.category, b.cover_image,
              b.published_at, u.name as author_name, dp.specialization
       FROM blog_posts b
       JOIN users u ON b.author_id = u.id
       LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
       WHERE b.status = 'approved'
       ORDER BY b.published_at DESC, b.created_at DESC`
    );
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPublicBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    const [posts] = await pool.query(
      `SELECT b.*, u.name as author_name, dp.specialization, u.profile_image
       FROM blog_posts b
       JOIN users u ON b.author_id = u.id
       LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
       WHERE b.slug = ? AND b.status = 'approved'`,
      [slug]
    );
    if (!posts.length) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: posts[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPost = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const payload = await mapPostPayload(req.body, {
      allowStatus: isAdmin,
      defaultStatus: isAdmin ? 'approved' : 'pending',
    });
    const slug = await ensureUniqueSlug(payload.title);
    const publishedAt = payload.status === 'approved' ? new Date() : null;
    const [result] = await pool.query(
      `INSERT INTO blog_posts (author_id, title, slug, summary, content, category, cover_image, status, admin_remarks, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, payload.title, slug, payload.summary, payload.content, payload.category, payload.cover_image, payload.status, payload.admin_remarks, publishedAt]
    );
    if (isAdmin) {
      await logAuditFromRequest(req, 'create_blog', 'blog_post', result.insertId, null, {
        title: payload.title,
        status: payload.status,
        category: payload.category,
      });
    }
    res.status(201).json({
      id: result.insertId,
      message: isAdmin ? 'Article published successfully' : 'Post submitted for review',
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

exports.listMine = async (req, res) => {
  try {
    const [posts] = await pool.query(
      `SELECT id, slug, title, summary, category, status, admin_remarks, created_at, published_at
       FROM blog_posts WHERE author_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listPending = async (req, res) => {
  const { status } = req.query;
  try {
    let query = `SELECT b.*, u.name as author_name, COALESCE(dp.specialization, r.name, 'Admin') as specialization
                 FROM blog_posts b
                 JOIN users u ON b.author_id = u.id
                 LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
                 LEFT JOIN roles r ON u.role_id = r.id`;
    const params = [];
    if (status) {
      query += ' WHERE b.status = ?';
      params.push(status);
    } else {
      query += ' WHERE b.status IN (\'pending\', \'rejected\')';
    }
    query += ' ORDER BY b.created_at DESC';
    const [posts] = await pool.query(query, params);
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listAdmin = async (req, res) => {
  const { status = '', search = '' } = req.query;
  try {
    let query = `SELECT b.*, u.name as author_name, COALESCE(dp.specialization, r.name, 'Admin') as specialization
                 FROM blog_posts b
                 JOIN users u ON b.author_id = u.id
                 LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
                 LEFT JOIN roles r ON r.id = u.role_id
                 WHERE 1=1`;
    const params = [];
    if (status) {
      query += ' AND b.status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (b.title LIKE ? OR b.category LIKE ? OR u.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY b.created_at DESC';
    const [posts] = await pool.query(query, params);
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveAdminPost = async (req, res) => {
  const { id } = req.params;
  try {
    const payload = await mapPostPayload(req.body, { allowStatus: true, defaultStatus: 'approved' });
    const publishedAt = payload.status === 'approved' ? new Date() : null;

    if (id) {
      const [existingRows] = await pool.query(
        'SELECT id, title, summary, content, category, cover_image, status, admin_remarks, published_at FROM blog_posts WHERE id = ?',
        [id]
      );
      if (!existingRows.length) return res.status(404).json({ error: 'Post not found' });
      const slug = await ensureUniqueSlug(payload.title, Number(id));
      await pool.query(
        `UPDATE blog_posts
         SET title = ?, slug = ?, summary = ?, content = ?, category = ?, cover_image = ?, status = ?, admin_remarks = ?, published_at = ?
         WHERE id = ?`,
        [payload.title, slug, payload.summary, payload.content, payload.category, payload.cover_image, payload.status, payload.admin_remarks, publishedAt, id]
      );
      await logAuditFromRequest(req, 'update_blog', 'blog_post', Number(id), existingRows[0], {
        title: payload.title,
        summary: payload.summary,
        content: payload.content,
        category: payload.category,
        cover_image: payload.cover_image,
        status: payload.status,
        admin_remarks: payload.admin_remarks,
        published_at: publishedAt,
      });
      return res.json({ message: 'Article updated successfully' });
    }

    const slug = await ensureUniqueSlug(payload.title);
    const [result] = await pool.query(
      `INSERT INTO blog_posts (author_id, title, slug, summary, content, category, cover_image, status, admin_remarks, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, payload.title, slug, payload.summary, payload.content, payload.category, payload.cover_image, payload.status, payload.admin_remarks, publishedAt]
    );
    await logAuditFromRequest(req, 'create_blog', 'blog_post', result.insertId, null, {
      title: payload.title,
      status: payload.status,
      category: payload.category,
    });
    res.status(201).json({ id: result.insertId, message: 'Article created successfully' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, admin_remarks } = req.body;
  if (!['approved', 'rejected', 'pending', 'draft'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const [existingRows] = await pool.query(
      'SELECT id, status, admin_remarks, published_at, title FROM blog_posts WHERE id = ?',
      [id]
    );
    if (!existingRows.length) return res.status(404).json({ error: 'Post not found' });
    const publishedAt = status === 'approved' ? new Date() : null;
    await pool.query(
      'UPDATE blog_posts SET status = ?, admin_remarks = ?, published_at = ? WHERE id = ?',
      [status, admin_remarks || null, publishedAt, id]
    );
    await logAuditFromRequest(req, 'update_blog_status', 'blog_post', Number(id), existingRows[0], {
      status,
      admin_remarks: admin_remarks || null,
      published_at: publishedAt,
    });
    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePost = async (req, res) => {
  const { id } = req.params;
  try {
    const [existingRows] = await pool.query('SELECT id, title, status, category FROM blog_posts WHERE id = ?', [id]);
    if (!existingRows.length) return res.status(404).json({ error: 'Post not found' });
    const [result] = await pool.query('DELETE FROM blog_posts WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Post not found' });
    await logAuditFromRequest(req, 'delete_blog', 'blog_post', Number(id), existingRows[0], null);
    res.json({ message: 'Article deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
