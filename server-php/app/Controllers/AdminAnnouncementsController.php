<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class AdminAnnouncementsController {
  private static function ensureAdmin($user) {
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'admin') json_response(['error' => 'Forbidden'], 403);
  }

  public static function list() {
    $user = auth_user();
    self::ensureAdmin($user);
    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT * FROM system_announcements ORDER BY created_at DESC");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    json_response(['announcements' => $rows]);
  }

  public static function create() {
    $user = auth_user();
    self::ensureAdmin($user);
    $data = get_json_body();
    $title = trim($data['title'] ?? '');
    $message = trim($data['message'] ?? '');
    $role = $data['target_role'] ?? 'all';
    $active = isset($data['is_active']) ? (int)($data['is_active'] ? 1 : 0) : 1;

    if ($title === '' || $message === '') json_response(['error' => 'title and message required'], 400);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "INSERT INTO system_announcements (title, message, target_role, is_active, created_by)
       VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([$title, $message, $role, $active, $user['id']]);
    json_response(['message' => 'Announcement created'], 201);
  }
}
