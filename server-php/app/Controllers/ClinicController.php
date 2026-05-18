<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class ClinicController {
  private static function ensureDoctor($user) {
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'doctor') json_response(['error' => 'Forbidden'], 403);
  }

  public static function list() {
    $user = auth_user();
    self::ensureDoctor($user);
    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT * FROM clinics WHERE owner_doctor_id = ? ORDER BY created_at DESC");
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['clinics' => $rows]);
  }

  public static function create() {
    $user = auth_user();
    self::ensureDoctor($user);
    $data = get_json_body();

    $name = trim($data['name'] ?? '');
    $address = trim($data['address'] ?? '');
    $city = trim($data['city'] ?? '');
    $state = trim($data['state'] ?? '');
    $pincode = trim($data['pincode'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $email = trim($data['email'] ?? '');

    if ($name === '' || $address === '' || $city === '' || $state === '' || $pincode === '') {
      json_response(['error' => 'name, address, city, state, pincode required'], 400);
    }

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "INSERT INTO clinics (owner_doctor_id, name, address, city, state, pincode, phone, email, is_verified, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)"
    );
    $stmt->execute([$user['id'], $name, $address, $city, $state, $pincode, $phone ?: null, $email ?: null]);
    json_response(['message' => 'Clinic created'], 201);
  }

  public static function update($id) {
    $user = auth_user();
    self::ensureDoctor($user);
    $data = get_json_body();

    $allowed = ['name','address','city','state','pincode','phone','email'];
    $fields = [];
    $params = [];
    foreach ($allowed as $f) {
      if (array_key_exists($f, $data)) {
        $fields[] = "$f = ?";
        $params[] = $data[$f];
      }
    }
    if (!$fields) json_response(['error' => 'Nothing to update'], 400);

    $pdo = Db::conn();
    $params[] = $user['id'];
    $params[] = $id;
    $sql = "UPDATE clinics SET " . implode(', ', $fields) . " WHERE owner_doctor_id = ? AND id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    json_response(['message' => 'Clinic updated']);
  }
}
