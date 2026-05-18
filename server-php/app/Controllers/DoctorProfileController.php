<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class DoctorProfileController {
  private static function ensureDoctor($user) {
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'doctor') json_response(['error' => 'Forbidden'], 403);
  }

  public static function profile() {
    $user = auth_user();
    self::ensureDoctor($user);
    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT u.id, u.name, u.email, u.phone,
              dp.specialization, dp.qualification, dp.medical_license_number,
              dp.experience_years, dp.consultation_fee, dp.languages, dp.bio
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE u.id = ?"
    );
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    json_response(['profile' => $row]);
  }

  public static function updateProfile() {
    $user = auth_user();
    self::ensureDoctor($user);
    $data = get_json_body();
    $name = $data['name'] ?? null;

    $pdo = Db::conn();
    if ($name) {
      $pdo->prepare("UPDATE users SET name = ? WHERE id = ?")->execute([$name, $user['id']]);
    }

    $fields = [
      'specialization','qualification','medical_license_number',
      'experience_years','consultation_fee','languages','bio'
    ];
    $updates = [];
    $params = [];
    foreach ($fields as $f) {
      if (array_key_exists($f, $data)) {
        $updates[] = "$f = ?";
        $params[] = $data[$f];
      }
    }
    if ($updates) {
      $exists = $pdo->prepare("SELECT id FROM doctor_profiles WHERE user_id = ? LIMIT 1");
      $exists->execute([$user['id']]);
      if ($exists->fetch()) {
        $sql = "UPDATE doctor_profiles SET " . implode(', ', $updates) . " WHERE user_id = ?";
        $params[] = $user['id'];
        $pdo->prepare($sql)->execute($params);
      } else {
        $cols = implode(', ', $fields);
        $place = implode(', ', array_fill(0, count($fields), '?'));
        $vals = [];
        foreach ($fields as $f) { $vals[] = $data[$f] ?? null; }
        $sql = "INSERT INTO doctor_profiles (user_id, $cols) VALUES (?, $place)";
        $pdo->prepare($sql)->execute(array_merge([$user['id']], $vals));
      }
    }

    json_response(['message' => 'Profile updated']);
  }
}
