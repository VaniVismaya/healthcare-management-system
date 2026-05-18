<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class NotificationController {
  public static function list() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC");
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['notifications' => $rows]);
  }
}
