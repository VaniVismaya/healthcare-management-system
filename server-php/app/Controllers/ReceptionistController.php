<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class ReceptionistController {
  private static function ensureOverridesTable($pdo) {
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS schedule_overrides (
        id INT AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT NOT NULL,
        clinic_id INT NOT NULL,
        session_id INT NOT NULL,
        override_date DATE NOT NULL,
        max_patients_override INT NOT NULL,
        created_by INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_override (session_id, override_date),
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES doctor_schedules(id) ON DELETE CASCADE
      )"
    );
  }
  private static function profile($userId) {
    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT rp.clinic_id, rp.doctor_id, c.name as clinic_name, d.name as doctor_name
       FROM receptionist_profiles rp
       JOIN clinics c ON c.id = rp.clinic_id
       JOIN users d ON d.id = rp.doctor_id
       WHERE rp.user_id = ?"
    );
    $stmt->execute([$userId]);
    return $stmt->fetch();
  }

  public static function getProfile() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'receptionist') json_response(['error' => 'Forbidden'], 403);

    $profile = self::profile($user['id']);
    json_response(['profile' => $profile]);
  }

  public static function queue() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'receptionist') json_response(['error' => 'Forbidden'], 403);

    $profile = self::profile($user['id']);
    if (!$profile) json_response(['error' => 'Receptionist profile not found'], 404);

    $date = $_GET['date'] ?? date('Y-m-d');

    $pdo = Db::conn();
    self::ensureOverridesTable($pdo);
    $stmt = $pdo->prepare(
      "SELECT a.*, p.name as patient_name, d.name as doctor_name,
              ds.session_label, ds.start_time as session_start_time, ds.end_time as session_end_time
       FROM appointments a
       JOIN users p ON a.patient_id = p.id
       JOIN users d ON a.doctor_id = d.id
       LEFT JOIN doctor_schedules ds ON a.session_id = ds.id
       WHERE a.clinic_id = ? AND a.appointment_date = ?
       ORDER BY a.session_id ASC, a.queue_number ASC, a.created_at ASC"
    );
    $stmt->execute([$profile['clinic_id'], $date]);
    $rows = $stmt->fetchAll();
    json_response(['appointments' => $rows]);
  }

  public static function sessions() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'receptionist') json_response(['error' => 'Forbidden'], 403);

    $profile = self::profile($user['id']);
    if (!$profile) json_response(['error' => 'Receptionist profile not found'], 404);

    $date = $_GET['date'] ?? date('Y-m-d');
    $dayOfWeek = (int)date('w', strtotime($date));
    $pdo = Db::conn();
    self::ensureOverridesTable($pdo);

    $schedStmt = $pdo->prepare(
      "SELECT ds.*, so.max_patients_override
       FROM doctor_schedules ds
       LEFT JOIN schedule_overrides so ON so.session_id = ds.id AND so.override_date = ?
       WHERE ds.doctor_id = ? AND ds.clinic_id = ? AND ds.day_of_week = ? AND ds.is_active = 1"
    );
    $schedStmt->execute([$date, $profile['doctor_id'], $profile['clinic_id'], $dayOfWeek]);
    $schedules = $schedStmt->fetchAll();

    $countStmt = $pdo->prepare(
      "SELECT session_id, COUNT(*) as count
       FROM appointments
       WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND status NOT IN ('cancelled','no_show')
       GROUP BY session_id"
    );
    $countStmt->execute([$profile['doctor_id'], $profile['clinic_id'], $date]);
    $counts = $countStmt->fetchAll();
    $countMap = [];
    foreach ($counts as $c) { $countMap[$c['session_id']] = (int)$c['count']; }

    $result = [];
    foreach ($schedules as $s) {
      $booked = $countMap[$s['id']] ?? 0;
      $override = $s['max_patients_override'] !== null ? (int)$s['max_patients_override'] : null;
      $base = (int)($s['max_patients_per_slot'] ?? 30);
      $max = $override !== null ? $override : $base;
      $result[] = [
        'session_id' => $s['id'],
        'label' => $s['session_label'],
        'start_time' => $s['start_time'],
        'end_time' => $s['end_time'],
        'base_capacity' => $base,
        'override_capacity' => $override,
        'max_patients' => $max,
        'booked_count' => $booked,
        'available_count' => max(0, $max - $booked)
      ];
    }

    json_response(['sessions' => $result]);
  }

  public static function patientSearch() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'receptionist') json_response(['error' => 'Forbidden'], 403);

    $q = trim($_GET['q'] ?? '');
    if ($q === '') json_response(['patients' => []]);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT id, name, email, phone
       FROM users
       WHERE role = 'patient' AND (phone LIKE ? OR email LIKE ?)
       ORDER BY created_at DESC LIMIT 20"
    );
    $stmt->execute(["%$q%", "%$q%"]);
    $rows = $stmt->fetchAll();
    json_response(['patients' => $rows]);
  }

  public static function overrideCapacity() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'receptionist') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $sessionId = $data['session_id'] ?? null;
    $date = $data['appointment_date'] ?? null;
    $max = $data['max_patients'] ?? null;

    if (!$sessionId || !$date) {
      json_response(['error' => 'session_id and appointment_date required'], 400);
    }

    $profile = self::profile($user['id']);
    if (!$profile) json_response(['error' => 'Receptionist profile not found'], 404);

    $pdo = Db::conn();
    self::ensureOverridesTable($pdo);

    if ($max === null || $max === '') {
      $del = $pdo->prepare("DELETE FROM schedule_overrides WHERE session_id = ? AND override_date = ?");
      $del->execute([$sessionId, $date]);
      json_response(['message' => 'Override cleared']);
    }

    $max = (int)$max;
    if ($max < 1) json_response(['error' => 'max_patients must be >= 1'], 400);

    $stmt = $pdo->prepare(
      "INSERT INTO schedule_overrides (doctor_id, clinic_id, session_id, override_date, max_patients_override, created_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE max_patients_override = VALUES(max_patients_override), created_by = VALUES(created_by)"
    );
    $stmt->execute([
      $profile['doctor_id'],
      $profile['clinic_id'],
      $sessionId,
      $date,
      $max,
      $user['id']
    ]);
    json_response(['message' => 'Override saved']);
  }

  public static function walkin() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'receptionist') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $name = trim($data['name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $email = trim($data['email'] ?? '');
    $sessionId = $data['session_id'] ?? null;
    $date = $data['appointment_date'] ?? date('Y-m-d');
    $priority = ($data['priority_level'] ?? 'normal') === 'priority' ? 'priority' : 'normal';
    $reason = $data['reason_for_visit'] ?? null;

    if (!$name || (!$phone && !$email) || !$sessionId) {
      json_response(['error' => 'Name, phone/email, and session required'], 400);
    }

    $profile = self::profile($user['id']);
    if (!$profile) json_response(['error' => 'Receptionist profile not found'], 404);

    $pdo = Db::conn();
    self::ensureOverridesTable($pdo);
    $doctorId = $profile['doctor_id'];
    $clinicId = $profile['clinic_id'];

    $schedStmt = $pdo->prepare("SELECT * FROM doctor_schedules WHERE id = ? AND doctor_id = ? AND clinic_id = ? AND is_active = 1");
    $schedStmt->execute([$sessionId, $doctorId, $clinicId]);
    $sched = $schedStmt->fetch();
    if (!$sched) json_response(['error' => 'Invalid session'], 400);

    $patientStmt = $pdo->prepare("SELECT id FROM users WHERE (phone = ? AND ? <> '') OR (email = ? AND ? <> '') LIMIT 1");
    $patientStmt->execute([$phone, $phone, $email, $email]);
    $patient = $patientStmt->fetch();
    $patientId = $patient['id'] ?? null;

    if (!$patientId) {
      $hash = password_hash('Patient@123', PASSWORD_BCRYPT);
      $insert = $pdo->prepare("INSERT INTO users (name, email, phone, password_hash, role, is_verified, is_active, is_phone_verified)
        VALUES (?, ?, ?, ?, 'patient', 1, 1, 0)");
      $insert->execute([$name, $email ?: null, $phone ?: null, $hash]);
      $patientId = $pdo->lastInsertId();
      $pdo->prepare("INSERT INTO patient_profiles (user_id) VALUES (?)")->execute([$patientId]);
    }

    $countStmt = $pdo->prepare("SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ? AND status NOT IN ('cancelled','no_show')");
    $countStmt->execute([$doctorId, $clinicId, $date, $sessionId]);
    $count = (int)$countStmt->fetch()['count'];
    $ovStmt = $pdo->prepare("SELECT max_patients_override FROM schedule_overrides WHERE session_id = ? AND override_date = ? LIMIT 1");
    $ovStmt->execute([$sessionId, $date]);
    $ov = $ovStmt->fetch();
    $max = $ov ? (int)$ov['max_patients_override'] : (int)($sched['max_patients_per_slot'] ?? 30);
    if ($count >= $max) json_response(['error' => 'Session full'], 400);
    $queue = $count + 1;

    $stmt = $pdo->prepare("INSERT INTO appointments (patient_id, doctor_id, clinic_id, appointment_date, appointment_time, slot_number, queue_number, session_id, priority_level, reason_for_visit, consultation_mode, booked_by, booked_by_user_id, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_person', 'receptionist', ?, 'walk_in')");
    $stmt->execute([
      $patientId,
      $doctorId,
      $clinicId,
      $date,
      $sched['start_time'],
      $queue,
      $queue,
      $sessionId,
      $priority,
      $reason,
      $user['id']
    ]);

    json_response(['message' => 'Walk-in booked', 'queue_number' => $queue], 201);
  }

  public static function handoverList() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'receptionist') json_response(['error' => 'Forbidden'], 403);

    $profile = self::profile($user['id']);
    if (!$profile) json_response(['error' => 'Receptionist profile not found'], 404);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT hn.id, hn.shift_date, hn.shift_type, hn.notes, hn.created_at, u.name as created_by_name
       FROM shift_handover_notes hn
       LEFT JOIN users u ON u.id = hn.created_by
       WHERE hn.clinic_id = ?
       ORDER BY hn.created_at DESC
       LIMIT 50"
    );
    $stmt->execute([$profile['clinic_id']]);
    $rows = $stmt->fetchAll();
    json_response(['notes' => $rows]);
  }

  public static function handoverCreate() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'receptionist') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $notes = trim($data['notes'] ?? '');
    if ($notes === '') json_response(['error' => 'Notes are required'], 400);
    $shiftDate = $data['shift_date'] ?? date('Y-m-d');
    $shiftType = $data['shift_type'] ?? 'morning';
    if (!in_array($shiftType, ['morning','afternoon','evening','night'], true)) $shiftType = 'morning';

    $profile = self::profile($user['id']);
    if (!$profile) json_response(['error' => 'Receptionist profile not found'], 404);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("INSERT INTO shift_handover_notes (clinic_id, created_by, role_label, shift_date, shift_type, notes)
      VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$profile['clinic_id'], $user['id'], 'receptionist', $shiftDate, $shiftType, $notes]);
    json_response(['message' => 'Handover note added'], 201);
  }
}
