<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class AdminController {
  private static function ensureAdmin($user) {
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'admin') json_response(['error' => 'Forbidden'], 403);
  }

  public static function verifications() {
    $user = auth_user();
    self::ensureAdmin($user);
    $role = $_GET['role'] ?? '';
    $pdo = Db::conn();

    switch ($role) {
      case 'doctor':
        $stmt = $pdo->prepare(
          "SELECT u.id as user_id, u.name, u.email, u.phone,
                  dp.specialization, dp.medical_license_number, dp.license_certificate_path, dp.is_verified
           FROM doctor_profiles dp
           JOIN users u ON u.id = dp.user_id
           WHERE dp.is_verified = 0"
        );
        $stmt->execute();
        json_response(['items' => $stmt->fetchAll()]);
      case 'laboratory':
        $stmt = $pdo->prepare(
          "SELECT u.id as user_id, u.name, u.email, u.phone,
                  lp.lab_name, lp.registration_number, lp.certificate_path, lp.is_verified
           FROM laboratory_profiles lp
           JOIN users u ON u.id = lp.user_id
           WHERE lp.is_verified = 0"
        );
        $stmt->execute();
        json_response(['items' => $stmt->fetchAll()]);
      case 'pharmacist':
        $stmt = $pdo->prepare(
          "SELECT u.id as user_id, u.name, u.email, u.phone,
                  pp.pharmacy_name, pp.license_number, pp.license_certificate_path, pp.is_verified
           FROM pharmacist_profiles pp
           JOIN users u ON u.id = pp.user_id
           WHERE pp.is_verified = 0"
        );
        $stmt->execute();
        json_response(['items' => $stmt->fetchAll()]);
      default:
        json_response(['error' => 'role must be doctor, laboratory, or pharmacist'], 400);
    }
  }

  public static function verify() {
    $user = auth_user();
    self::ensureAdmin($user);
    $data = get_json_body();
    $role = $data['role'] ?? '';
    $userId = $data['user_id'] ?? null;
    $approved = isset($data['approved']) ? (bool)$data['approved'] : true;
    $remarks = $data['remarks'] ?? null;
    if (!$role || !$userId) json_response(['error' => 'role and user_id required'], 400);

    $pdo = Db::conn();
    if ($role === 'doctor') {
      $stmt = $pdo->prepare("UPDATE doctor_profiles SET is_verified = ?, admin_remarks = ? WHERE user_id = ?");
      $stmt->execute([$approved ? 1 : 0, $remarks, $userId]);
    } elseif ($role === 'laboratory') {
      $stmt = $pdo->prepare("UPDATE laboratory_profiles SET is_verified = ?, admin_remarks = ? WHERE user_id = ?");
      $stmt->execute([$approved ? 1 : 0, $remarks, $userId]);
    } elseif ($role === 'pharmacist') {
      $stmt = $pdo->prepare("UPDATE pharmacist_profiles SET is_verified = ?, admin_remarks = ? WHERE user_id = ?");
      $stmt->execute([$approved ? 1 : 0, $remarks, $userId]);
    } else {
      json_response(['error' => 'Invalid role'], 400);
    }

    $pdo->prepare("UPDATE users SET is_verified = ? WHERE id = ?")->execute([$approved ? 1 : 0, $userId]);
    $title = $approved ? 'Verification Approved' : 'Verification Rejected';
    $msg = $approved ? 'Your verification is approved.' : ('Your verification was rejected.' . ($remarks ? " Reason: $remarks" : ''));
    $pdo->prepare("INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type) VALUES (?, ?, ?, 'verification', ?, ?)")
        ->execute([$userId, $title, $msg, $userId, $role]);

    json_response(['message' => 'Verification updated']);
  }
}
