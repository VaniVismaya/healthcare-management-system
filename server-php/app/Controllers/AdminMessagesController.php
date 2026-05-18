<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class AdminMessagesController {
  private static function ensureAdmin($user) {
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'admin') json_response(['error' => 'Forbidden'], 403);
  }

  public static function list() {
    $user = auth_user();
    self::ensureAdmin($user);
    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT * FROM contact_messages ORDER BY created_at DESC");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    json_response(['messages' => $rows]);
  }

  public static function update($id) {
    $user = auth_user();
    self::ensureAdmin($user);
    $data = get_json_body();
    $status = $data['status'] ?? null;
    $reply = $data['admin_reply'] ?? null;
    if (!$status && !$reply) json_response(['error' => 'Nothing to update'], 400);

    $fields = [];
    $params = [];
    if ($status) { $fields[] = "status = ?"; $params[] = $status; }
    if ($reply !== null) { $fields[] = "admin_reply = ?"; $params[] = $reply; }
    $params[] = $id;

    $pdo = Db::conn();
    $sql = "UPDATE contact_messages SET " . implode(', ', $fields) . " WHERE id = ?";
    $pdo->prepare($sql)->execute($params);
    json_response(['message' => 'Message updated']);
  }
}
