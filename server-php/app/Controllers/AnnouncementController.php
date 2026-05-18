<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class AnnouncementController {
  public static function list() {
    $pdo = Db::conn();
    $user = auth_user();
    $role = $user['role'] ?? 'all';

    if ($user) {
      $stmt = $pdo->prepare(
        "SELECT * FROM system_announcements
         WHERE is_active = 1 AND (target_role = 'all' OR target_role = ?)
         ORDER BY created_at DESC"
      );
      $stmt->execute([$role]);
    } else {
      $stmt = $pdo->prepare(
        "SELECT * FROM system_announcements
         WHERE is_active = 1 AND target_role = 'all'
         ORDER BY created_at DESC"
      );
      $stmt->execute();
    }

    $rows = $stmt->fetchAll();
    json_response(['announcements' => $rows]);
  }
}
