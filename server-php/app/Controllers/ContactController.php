<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class ContactController {
  public static function create() {
    $data = get_json_body();
    $name = trim($data['name'] ?? '');
    $email = trim($data['email'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $topic = trim($data['topic'] ?? 'Support');
    $message = trim($data['message'] ?? '');

    if ($name === '' || $email === '' || $message === '') {
      json_response(['error' => 'name, email, message required'], 400);
    }

    $user = auth_user();
    $userId = $user ? $user['id'] : null;
    $role = $user['role'] ?? 'guest';

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "INSERT INTO contact_messages (user_id, name, email, phone, topic, message, status)
       VALUES (?, ?, ?, ?, ?, ?, 'new')"
    );
    $stmt->execute([$userId, $name, $email, $phone, $topic, $message]);

    json_response(['message' => 'Message submitted', 'role' => $role], 201);
  }
}
