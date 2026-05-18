<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class GuestDoctorController {
  private static function ensureDoctor($user) {
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'doctor') json_response(['error' => 'Forbidden'], 403);
  }

  public static function list() {
    $user = auth_user();
    self::ensureDoctor($user);
    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT u.id, u.name, u.email, u.phone, dp.specialization, dp.is_guest_doctor, dp.clinic_id
       FROM users u
       JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE dp.is_guest_doctor = 1 AND dp.main_doctor_id = ?
       ORDER BY u.created_at DESC"
    );
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['guest_doctors' => $rows]);
  }

  public static function create() {
    $user = auth_user();
    self::ensureDoctor($user);
    $data = get_json_body();

    $name = trim($data['name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $email = trim($data['email'] ?? '');
    $clinicId = $data['clinic_id'] ?? null;
    $specialization = trim($data['specialization'] ?? '');
    $qualification = trim($data['qualification'] ?? '');
    $license = trim($data['medical_license_number'] ?? '');

    if ($name === '' || ($phone === '' && $email === '') || !$clinicId || $specialization === '' || $qualification === '' || $license === '') {
      json_response(['error' => 'name, phone/email, clinic_id, specialization, qualification, medical_license_number required'], 400);
    }

    $pdo = Db::conn();
    $check = $pdo->prepare("SELECT id FROM clinics WHERE id = ? AND owner_doctor_id = ? LIMIT 1");
    $check->execute([$clinicId, $user['id']]);
    if (!$check->fetch()) {
      json_response(['error' => 'Invalid clinic'], 400);
    }

    $password = 'Guest@123';
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("INSERT INTO users (name, email, phone, password_hash, role, is_verified, is_active, is_phone_verified)
      VALUES (?, ?, ?, ?, 'doctor', 0, 1, 0)");
    $stmt->execute([$name, $email ?: null, $phone ?: null, $hash]);
    $guestId = $pdo->lastInsertId();

    $dp = $pdo->prepare("INSERT INTO doctor_profiles (user_id, clinic_id, specialization, qualification, medical_license_number, is_guest_doctor, main_doctor_id, is_verified)
      VALUES (?, ?, ?, ?, ?, 1, ?, 0)");
    $dp->execute([$guestId, $clinicId, $specialization, $qualification, $license, $user['id']]);

    json_response(['message' => 'Guest doctor created', 'login_password' => $password], 201);
  }
}
