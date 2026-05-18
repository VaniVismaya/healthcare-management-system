<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class AuditLogsController {
  public static function list() {
    $user = auth_user();
    if (!$user || ($user['role'] ?? '') !== 'admin') {
      json_response(['error' => 'Forbidden'], 403);
    }

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT 200"
    );
    $stmt->execute();
    $rows = $stmt->fetchAll();
    json_response(['logs' => $rows]);
  }
}
