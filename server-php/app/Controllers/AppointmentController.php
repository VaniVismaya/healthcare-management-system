<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class AppointmentController {
  private static function ensureSettingsTable($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      setting_value VARCHAR(255),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
  }

  private static function getBookingFee($pdo) {
    self::ensureSettingsTable($pdo);
    $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'booking_fee' LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch();
    if (!$row) return 0;
    $fee = (float)$row['setting_value'];
    return $fee > 0 ? $fee : 0;
  }
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

  private static function getOverride($pdo, $sessionId, $date) {
    $stmt = $pdo->prepare("SELECT max_patients_override FROM schedule_overrides WHERE session_id = ? AND override_date = ? LIMIT 1");
    $stmt->execute([$sessionId, $date]);
    $row = $stmt->fetch();
    return $row ? (int)$row['max_patients_override'] : null;
  }

  public static function slots() {
    $doctorId = $_GET['doctor_id'] ?? null;
    $clinicId = $_GET['clinic_id'] ?? null;
    $date = $_GET['date'] ?? null;
    if (!$doctorId || !$clinicId || !$date) json_response(['error' => 'doctor_id, clinic_id, date required'], 400);

    $pdo = Db::conn();
    self::ensureOverridesTable($pdo);
    $dayOfWeek = (int)date('w', strtotime($date));
    $stmt = $pdo->prepare("SELECT * FROM doctor_schedules WHERE doctor_id = ? AND clinic_id = ? AND day_of_week = ? AND is_active = 1");
    $stmt->execute([$doctorId, $clinicId, $dayOfWeek]);
    $schedules = $stmt->fetchAll();
    $sessions = [];

    foreach ($schedules as $s) {
      $countStmt = $pdo->prepare("SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ? AND status NOT IN ('cancelled','no_show')");
      $countStmt->execute([$doctorId, $clinicId, $date, $s['id']]);
      $count = (int)$countStmt->fetch()['count'];
      $override = self::getOverride($pdo, $s['id'], $date);
      $max = $override !== null ? $override : (int)($s['max_patients_per_slot'] ?? 30);
      $sessions[] = [
        'session_id' => $s['id'],
        'label' => $s['session_label'] ?? 'Session',
        'start_time' => $s['start_time'],
        'end_time' => $s['end_time'],
        'max_patients' => $max,
        'override_max_patients' => $override,
        'booked_count' => $count,
        'available_count' => max(0, $max - $count),
        'is_available' => $count < $max,
        'avg_minutes' => $s['slot_duration_minutes'] ?? 15
      ];
    }

    json_response(['slots' => $sessions]);
  }

  public static function bookingFee() {
    $pdo = Db::conn();
    $fee = self::getBookingFee($pdo);
    json_response(['booking_fee' => $fee]);
  }

  public static function book() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);

    $data = get_json_body();
    $doctorId = $data['doctor_id'] ?? null;
    $clinicId = $data['clinic_id'] ?? null;
    $date = $data['appointment_date'] ?? null;
    $sessionId = $data['session_id'] ?? null;
    $reason = $data['reason_for_visit'] ?? null;
    $priority = ($data['priority_level'] ?? 'normal') === 'priority' ? 'priority' : 'normal';
    $mode = ($data['consultation_mode'] ?? 'in_person') === 'video' ? 'video' : 'in_person';
    $videoProvider = $data['video_provider'] ?? null;
    $videoMeetingUrl = $data['video_meeting_url'] ?? null;
    $videoHostUrl = $data['video_host_url'] ?? null;
    $paymentStatus = strtolower($data['payment_status'] ?? '');
    $paymentReference = $data['payment_reference'] ?? null;

    if (!$doctorId || !$clinicId || !$date || !$sessionId) json_response(['error' => 'Missing fields'], 400);

    $pdo = Db::conn();
    self::ensureOverridesTable($pdo);
    $fee = self::getBookingFee($pdo);
    if ($fee > 0 && $paymentStatus !== 'paid') {
      json_response(['error' => 'Payment required to book this appointment'], 400);
    }
    $schedStmt = $pdo->prepare("SELECT * FROM doctor_schedules WHERE id = ? AND doctor_id = ? AND clinic_id = ? AND is_active = 1");
    $schedStmt->execute([$sessionId, $doctorId, $clinicId]);
    $sched = $schedStmt->fetch();
    if (!$sched) json_response(['error' => 'Invalid session'], 400);

    $countStmt = $pdo->prepare("SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ? AND status NOT IN ('cancelled','no_show')");
    $countStmt->execute([$doctorId, $clinicId, $date, $sessionId]);
    $count = (int)$countStmt->fetch()['count'];
    $override = self::getOverride($pdo, $sessionId, $date);
    $max = $override !== null ? $override : (int)($sched['max_patients_per_slot'] ?? 30);
    if ($count >= $max) json_response(['error' => 'Session full'], 400);

    $queue = $count + 1;
    $stmt = $pdo->prepare("INSERT INTO appointments (
        patient_id, doctor_id, clinic_id, appointment_date, appointment_time, slot_number, queue_number,
        session_id, priority_level, reason_for_visit, consultation_mode,
        video_provider, video_meeting_url, video_host_url,
        booked_by, booked_by_user_id, booking_fee, payment_status, payment_reference
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient', ?, ?, ?, ?)");
    $stmt->execute([
      $user['id'],
      $doctorId,
      $clinicId,
      $date,
      $sched['start_time'],
      $queue,
      $queue,
      $sessionId,
      $priority,
      $reason,
      $mode,
      $videoProvider,
      $videoMeetingUrl,
      $videoHostUrl,
      $user['id'],
      $fee,
      $fee > 0 ? 'paid' : 'free',
      $paymentReference
    ]);

    json_response(['message' => 'Booked', 'queue_number' => $queue], 201);
  }

  public static function list() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);

    $pdo = Db::conn();
    $date = $_GET['date'] ?? null;

    $sql = "SELECT a.*, p.name as patient_name, d.name as doctor_name, c.name as clinic_name,
                   ds.session_label, ds.start_time as session_start_time, ds.end_time as session_end_time
            FROM appointments a
            JOIN users p ON a.patient_id = p.id
            JOIN users d ON a.doctor_id = d.id
            JOIN clinics c ON a.clinic_id = c.id
            LEFT JOIN doctor_schedules ds ON a.session_id = ds.id
            WHERE 1=1";
    $params = [];
    if ($user['role'] === 'patient') { $sql .= " AND a.patient_id = ?"; $params[] = $user['id']; }
    if ($user['role'] === 'doctor') { $sql .= " AND a.doctor_id = ?"; $params[] = $user['id']; }
    if ($date) { $sql .= " AND a.appointment_date = ?"; $params[] = $date; }
    $sql .= " ORDER BY a.appointment_date DESC, a.appointment_time ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    json_response(['appointments' => $rows]);
  }

  public static function updateStatus($id) {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (!in_array($user['role'], ['doctor','receptionist','admin'])) {
      json_response(['error' => 'Forbidden'], 403);
    }

    $data = get_json_body();
    $status = $data['status'] ?? null;
    if (!$status) json_response(['error' => 'Status required'], 400);

    $pdo = Db::conn();
    $fields = ["status = ?"];
    $params = [$status];
    if ($status === 'checked_in') {
      $fields[] = "checked_in_at = NOW()";
    }
    if ($status === 'completed') {
      $fields[] = "checked_out_at = NOW()";
    }
    $sql = "UPDATE appointments SET " . implode(', ', $fields) . " WHERE id = ?";
    $params[] = $id;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    json_response(['message' => 'Status updated']);
  }

  public static function updateVideo($id) {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (!in_array($user['role'], ['doctor','admin'])) {
      json_response(['error' => 'Forbidden'], 403);
    }

    $data = get_json_body();
    $meetingUrl = trim($data['video_meeting_url'] ?? '');
    $hostUrl = $data['video_host_url'] ?? null;
    $provider = $data['video_provider'] ?? 'zoom';

    if ($meetingUrl === '') json_response(['error' => 'video_meeting_url required'], 400);

    $pdo = Db::conn();
    if ($user['role'] === 'doctor') {
      $check = $pdo->prepare("SELECT doctor_id FROM appointments WHERE id = ?");
      $check->execute([$id]);
      $appt = $check->fetch();
      if (!$appt || (int)$appt['doctor_id'] !== (int)$user['id']) {
        json_response(['error' => 'Not allowed'], 403);
      }
    }

    $stmt = $pdo->prepare(
      "UPDATE appointments
       SET consultation_mode = 'video', video_provider = ?, video_meeting_url = ?, video_host_url = ?
       WHERE id = ?"
    );
    $stmt->execute([$provider, $meetingUrl, $hostUrl, $id]);
    json_response(['message' => 'Video link saved']);
  }

  public static function queueStatus($id) {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT a.*, ds.session_label, ds.start_time as session_start_time, ds.end_time as session_end_time,
              ds.slot_duration_minutes
       FROM appointments a
       LEFT JOIN doctor_schedules ds ON a.session_id = ds.id
       WHERE a.id = ?"
    );
    $stmt->execute([$id]);
    $appt = $stmt->fetch();
    if (!$appt) json_response(['error' => 'Appointment not found'], 404);

    if (($user['role'] ?? '') === 'patient' && (int)$appt['patient_id'] !== (int)$user['id']) {
      json_response(['error' => 'Forbidden'], 403);
    }
    if (($user['role'] ?? '') === 'doctor' && (int)$appt['doctor_id'] !== (int)$user['id']) {
      json_response(['error' => 'Forbidden'], 403);
    }

    $doctorId = $appt['doctor_id'];
    $clinicId = $appt['clinic_id'];
    $date = $appt['appointment_date'];
    $sessionId = $appt['session_id'];
    $queueNumber = (int)$appt['queue_number'];

    $nowStmt = $pdo->prepare(
      "SELECT MIN(queue_number) as q
       FROM appointments
       WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ?
         AND status IN ('checked_in','in_consultation')"
    );
    $nowStmt->execute([$doctorId, $clinicId, $date, $sessionId]);
    $nowServing = $nowStmt->fetch()['q'];

    if ($nowServing === null) {
      $confirmStmt = $pdo->prepare(
        "SELECT MIN(queue_number) as q
         FROM appointments
         WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ?
           AND status = 'confirmed'"
      );
      $confirmStmt->execute([$doctorId, $clinicId, $date, $sessionId]);
      $nowServing = $confirmStmt->fetch()['q'];
    }

    if ($nowServing === null) {
      $nextStmt = $pdo->prepare(
        "SELECT MIN(queue_number) as q
         FROM appointments
         WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ?
           AND status NOT IN ('completed','cancelled','no_show')"
      );
      $nextStmt->execute([$doctorId, $clinicId, $date, $sessionId]);
      $nowServing = $nextStmt->fetch()['q'];
    }

    $aheadStmt = $pdo->prepare(
      "SELECT COUNT(*) as cnt
       FROM appointments
       WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ?
         AND queue_number < ? AND status NOT IN ('completed','cancelled','no_show')"
    );
    $aheadStmt->execute([$doctorId, $clinicId, $date, $sessionId, $queueNumber]);
    $aheadCount = (int)$aheadStmt->fetch()['cnt'];

    $avg = (int)($appt['slot_duration_minutes'] ?? 15);
    $estimatedWait = $aheadCount * max(1, $avg);

    json_response([
      'appointment_id' => (int)$appt['id'],
      'queue_number' => $queueNumber,
      'status' => $appt['status'],
      'session_label' => $appt['session_label'],
      'session_start_time' => $appt['session_start_time'],
      'session_end_time' => $appt['session_end_time'],
      'avg_minutes' => $avg,
      'now_serving_queue' => $nowServing !== null ? (int)$nowServing : null,
      'ahead_count' => $aheadCount,
      'estimated_wait_minutes' => $estimatedWait
    ]);
  }

  public static function qrToken($id) {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') {
      json_response(['error' => 'Forbidden'], 403);
    }

    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT * FROM appointments WHERE id = ? AND patient_id = ? LIMIT 1");
    $stmt->execute([$id, $user['id']]);
    $appt = $stmt->fetch();
    if (!$appt) json_response(['error' => 'Appointment not found'], 404);

    $payload = [
      'type' => 'appointment_qr',
      'appointment_id' => (int)$appt['id'],
      'patient_id' => (int)$appt['patient_id'],
      'doctor_id' => (int)$appt['doctor_id'],
      'clinic_id' => (int)$appt['clinic_id'],
      'appointment_date' => $appt['appointment_date'],
      'queue_number' => (int)$appt['queue_number'],
      'exp' => time() + 60 * 5
    ];

    json_response([
      'token' => jwt_sign($payload),
      'expires_in' => 300
    ]);
  }

  public static function checkInByQr() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (!in_array(($user['role'] ?? ''), ['doctor','receptionist','admin'])) {
      json_response(['error' => 'Forbidden'], 403);
    }

    $data = get_json_body();
    $token = $data['token'] ?? '';
    if (!$token) json_response(['error' => 'Token required'], 400);

    $payload = jwt_verify($token);
    if (!$payload || ($payload['type'] ?? '') !== 'appointment_qr') {
      json_response(['error' => 'Invalid token'], 400);
    }
    if (isset($payload['exp']) && time() > (int)$payload['exp']) {
      json_response(['error' => 'Token expired'], 400);
    }

    $appointmentId = (int)($payload['appointment_id'] ?? 0);
    if (!$appointmentId) json_response(['error' => 'Invalid token payload'], 400);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT * FROM appointments WHERE id = ? LIMIT 1");
    $stmt->execute([$appointmentId]);
    $appt = $stmt->fetch();
    if (!$appt) json_response(['error' => 'Appointment not found'], 404);

    $today = date('Y-m-d');
    if ($appt['appointment_date'] !== $today) {
      json_response(['error' => 'QR is valid only on appointment date'], 400);
    }

    $fields = ["status = 'checked_in'"];
    if (empty($appt['checked_in_at'])) {
      $fields[] = "checked_in_at = NOW()";
    }
    $update = $pdo->prepare("UPDATE appointments SET " . implode(', ', $fields) . " WHERE id = ?");
    $update->execute([$appointmentId]);

    json_response([
      'message' => 'Checked in',
      'appointment_id' => $appointmentId,
      'queue_number' => (int)$appt['queue_number']
    ]);
  }
}
