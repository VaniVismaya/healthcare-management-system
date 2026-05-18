<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class DoctorLeaveController {
  private static function ensureDoctor($user) {
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'doctor') json_response(['error' => 'Forbidden'], 403);
  }

  private static function clinicAllowed($pdo, $doctorId, $clinicId) {
    if (!$clinicId) return true;
    $stmt = $pdo->prepare(
      "SELECT 1 FROM clinics WHERE id = ? AND owner_doctor_id = ?
       UNION
       SELECT 1 FROM doctor_profiles WHERE clinic_id = ? AND user_id = ?"
    );
    $stmt->execute([$clinicId, $doctorId, $clinicId, $doctorId]);
    return (bool)$stmt->fetch();
  }

  public static function list() {
    $user = auth_user();
    self::ensureDoctor($user);
    $pdo = Db::conn();

    $stmt = $pdo->prepare(
      "SELECT dl.*, c.name as clinic_name
       FROM doctor_leaves dl
       LEFT JOIN clinics c ON c.id = dl.clinic_id
       WHERE dl.doctor_id = ?
       ORDER BY dl.leave_date DESC"
    );
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['leaves' => $rows]);
  }

  public static function create() {
    $user = auth_user();
    self::ensureDoctor($user);
    $data = get_json_body();

    $leaveDate = $data['leave_date'] ?? null;
    $leaveType = $data['leave_type'] ?? 'full_day';
    $reason = $data['reason'] ?? null;
    $clinicId = $data['clinic_id'] ?? null;

    if (!$leaveDate) json_response(['error' => 'leave_date required'], 400);
    $allowed = ['full_day','morning','evening'];
    if (!in_array($leaveType, $allowed, true)) json_response(['error' => 'Invalid leave_type'], 400);

    $pdo = Db::conn();
    if (!self::clinicAllowed($pdo, $user['id'], $clinicId)) {
      json_response(['error' => 'Clinic not allowed'], 403);
    }

    $stmt = $pdo->prepare(
      "INSERT INTO doctor_leaves (doctor_id, clinic_id, leave_date, leave_type, reason)
       VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([$user['id'], $clinicId ?: null, $leaveDate, $leaveType, $reason]);
    json_response(['message' => 'Leave created'], 201);
  }
}
