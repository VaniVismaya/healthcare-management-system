<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class BlogController {
  public static function listPublic() {
    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT b.id, b.title, b.slug, b.summary, b.category, b.cover_image, b.published_at, u.name as author_name
       FROM blog_posts b
       JOIN users u ON b.author_id = u.id
       WHERE b.status = 'approved'
       ORDER BY b.published_at DESC"
    );
    $stmt->execute();
    $rows = $stmt->fetchAll();
    json_response(['posts' => $rows]);
  }

  public static function myPosts() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'doctor') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT id, title, slug, summary, category, status, published_at, created_at
       FROM blog_posts WHERE author_id = ? ORDER BY created_at DESC"
    );
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['posts' => $rows]);
  }

  public static function create() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'doctor') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $title = trim($data['title'] ?? '');
    $summary = trim($data['summary'] ?? '');
    $content = trim($data['content'] ?? '');
    $category = trim($data['category'] ?? '');
    $slug = trim($data['slug'] ?? '');

    if ($title === '' || $content === '') {
      json_response(['error' => 'title and content required'], 400);
    }
    if ($slug === '') {
      $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $title));
      $slug = trim($slug, '-');
    }

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "INSERT INTO blog_posts (author_id, title, slug, summary, content, category, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')"
    );
    $stmt->execute([$user['id'], $title, $slug, $summary, $content, $category]);
    json_response(['message' => 'Article submitted for review'], 201);
  }

  public static function adminList() {
    $user = auth_user();
    if (!$user || ($user['role'] ?? '') !== 'admin') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT b.id, b.title, b.slug, b.summary, b.category, b.status, b.created_at,
              u.name as author_name
       FROM blog_posts b
       JOIN users u ON b.author_id = u.id
       WHERE b.status IN ('pending','approved','rejected')
       ORDER BY b.created_at DESC"
    );
    $stmt->execute();
    $rows = $stmt->fetchAll();
    json_response(['posts' => $rows]);
  }

  public static function adminUpdate($id) {
    $user = auth_user();
    if (!$user || ($user['role'] ?? '') !== 'admin') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $status = $data['status'] ?? null;
    $remarks = $data['admin_remarks'] ?? null;
    if (!in_array($status, ['approved','rejected','pending'], true)) {
      json_response(['error' => 'Invalid status'], 400);
    }

    $pdo = Db::conn();
    $fields = ["status = ?"];
    $params = [$status];
    if ($remarks !== null) {
      $fields[] = "admin_remarks = ?";
      $params[] = $remarks;
    }
    if ($status === 'approved') {
      $fields[] = "published_at = NOW()";
    }
    $params[] = $id;
    $sql = "UPDATE blog_posts SET " . implode(', ', $fields) . " WHERE id = ?";
    $pdo->prepare($sql)->execute($params);
    json_response(['message' => 'Updated']);
  }
}
