<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Services/Firebase.php';

class AuthController {
  private static function hasColumn($pdo, $table, $column) {
    $stmt = $pdo->prepare("SELECT COUNT(*) as c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $stmt->execute([$table, $column]);
    $row = $stmt->fetch();
    return (int)($row['c'] ?? 0) > 0;
  }

  private static function resolveRoleName($row) {
    if (!empty($row['role'])) return $row['role'];
    if (!empty($row['role_name'])) return $row['role_name'];
    return 'patient';
  }

  public static function register() {
    $data = get_json_body();
    $name = trim($data['name'] ?? '');
    $email = trim($data['email'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $password = $data['password'] ?? '';
    $role = $data['role'] ?? 'patient';
    $firebaseToken = $data['firebase_id_token'] ?? '';
    $phoneVerified = false;

    if (!$name || !$password || (!$email && !$phone)) {
      json_response(['error' => 'Name, password, and email or phone required'], 400);
    }

    if ($firebaseToken) {
      $info = Firebase::verifyIdToken($firebaseToken);
      $firebasePhone = $info['phoneNumber'] ?? '';
      if (!$firebasePhone) {
        json_response(['error' => 'Firebase phone not found'], 400);
      }
      if ($phone && $phone !== $firebasePhone) {
        json_response(['error' => 'Phone does not match Firebase token'], 400);
      }
      $phone = $firebasePhone;
      $phoneVerified = true;
    }

    $pdo = Db::conn();
    $hash = password_hash($password, PASSWORD_BCRYPT);

    $hasRoleCol = self::hasColumn($pdo, 'users', 'role');
    $hasRoleId = self::hasColumn($pdo, 'users', 'role_id');
    $roleId = null;
    if ($hasRoleId) {
      $r = $pdo->prepare("SELECT id FROM roles WHERE name = ? LIMIT 1");
      $r->execute([$role]);
      $roleId = $r->fetch()['id'] ?? null;
    }

    if ($hasRoleCol) {
      $stmt = $pdo->prepare("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)");
    } else {
      $stmt = $pdo->prepare("INSERT INTO users (name, email, phone, password_hash, role_id) VALUES (?, ?, ?, ?, ?)");
    }
    try {
      $stmt->execute([$name, $email ?: null, $phone ?: null, $hash, $hasRoleCol ? $role : $roleId]);
      if ($phoneVerified && $phone) {
        $pdo->prepare("UPDATE users SET is_phone_verified = 1 WHERE phone = ?")->execute([$phone]);
      }
      json_response(['message' => 'Registered'], 201);
    } catch (Exception $e) {
      json_response(['error' => 'Registration failed', 'details' => $e->getMessage()], 500);
    }
  }

  public static function login() {
    $data = get_json_body();
    $identifier = trim($data['identifier'] ?? '');
    $password = $data['password'] ?? '';
    if (!$identifier || !$password) json_response(['error' => 'Identifier and password required'], 400);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ? OR u.phone = ? LIMIT 1");
    $stmt->execute([$identifier, $identifier]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
      json_response(['error' => 'Invalid credentials'], 401);
    }

    $roleName = self::resolveRoleName($user);
    $payload = [
      'id' => $user['id'],
      'role' => $roleName,
      'name' => $user['name'],
      'exp' => time() + 60*60*24*7
    ];
    $token = jwt_sign($payload);

    json_response([
      'token' => $token,
      'user' => [
        'id' => $user['id'],
        'name' => $user['name'],
        'role' => $roleName,
        'email' => $user['email'],
        'phone' => $user['phone']
      ]
    ]);
  }

  public static function loginOtp() {
    $data = get_json_body();
    $token = $data['firebase_id_token'] ?? '';
    $role = $data['role'] ?? null;
    if (!$token) json_response(['error' => 'Firebase token required'], 400);

    $info = Firebase::verifyIdToken($token);
    $phone = $info['phoneNumber'] ?? '';
    if (!$phone) json_response(['error' => 'Firebase phone not found'], 400);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.phone = ? LIMIT 1");
    $stmt->execute([$phone]);
    $user = $stmt->fetch();
    if (!$user) json_response(['error' => 'User not found', 'code' => 'NOT_REGISTERED'], 404);

    $roleName = self::resolveRoleName($user);
    if ($role && $roleName !== $role) {
      json_response(['error' => 'Selected role does not match account'], 401);
    }

    $pdo->prepare("UPDATE users SET last_login = NOW(), is_phone_verified = 1 WHERE id = ?")->execute([$user['id']]);

    $payload = [
      'id' => $user['id'],
      'role' => $roleName,
      'name' => $user['name'],
      'exp' => time() + 60*60*24*7
    ];
    $jwt = jwt_sign($payload);

    json_response([
      'token' => $jwt,
      'user' => [
        'id' => $user['id'],
        'name' => $user['name'],
        'role' => $roleName,
        'email' => $user['email'],
        'phone' => $user['phone']
      ]
    ]);
  }
}
