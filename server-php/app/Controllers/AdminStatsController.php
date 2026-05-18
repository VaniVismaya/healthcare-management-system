<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class AdminStatsController {
  public static function stats() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'admin') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $counts = [];

    $stmt = $pdo->query("SELECT role, COUNT(*) as c FROM users GROUP BY role");
    $rows = $stmt->fetchAll();
    foreach ($rows as $r) {
      $counts[$r['role']] = (int)$r['c'];
    }

    $pendingDoctors = $pdo->query("SELECT COUNT(*) as c FROM doctor_profiles WHERE is_verified = 0")->fetch()['c'] ?? 0;
    $pendingLabs = $pdo->query("SELECT COUNT(*) as c FROM laboratory_profiles WHERE is_verified = 0")->fetch()['c'] ?? 0;
    $pendingPharm = $pdo->query("SELECT COUNT(*) as c FROM pharmacist_profiles WHERE is_verified = 0")->fetch()['c'] ?? 0;
    $today = date('Y-m-d');
    $todayAppts = $pdo->prepare("SELECT COUNT(*) as c FROM appointments WHERE appointment_date = ?");
    $todayAppts->execute([$today]);
    $apptCount = $todayAppts->fetch()['c'] ?? 0;

    json_response([
      'users' => $counts,
      'pending_verifications' => [
        'doctors' => (int)$pendingDoctors,
        'laboratories' => (int)$pendingLabs,
        'pharmacists' => (int)$pendingPharm,
      ],
      'today_appointments' => (int)$apptCount
    ]);
  }
}
