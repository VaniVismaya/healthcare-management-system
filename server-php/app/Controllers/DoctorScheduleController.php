<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class DoctorScheduleController {
  private static function ensureDoctor($user) {
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'doctor') json_response(['error' => 'Forbidden'], 403);
  }

  public static function clinics() {
    $user = auth_user();
    self::ensureDoctor($user);
    $pdo = Db::conn();

    $stmt = $pdo->prepare(
      "SELECT id, name FROM clinics WHERE owner_doctor_id = ?
       UNION
       SELECT c.id, c.name
       FROM clinics c
       JOIN doctor_profiles dp ON dp.clinic_id = c.id
       WHERE dp.user_id = ?"
    );
    $stmt->execute([$user['id'], $user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['clinics' => $rows]);
  }

  public static function list() {
    $user = auth_user();
    self::ensureDoctor($user);
    $pdo = Db::conn();

    $stmt = $pdo->prepare(
      "SELECT ds.*, c.name as clinic_name
       FROM doctor_schedules ds
       JOIN clinics c ON c.id = ds.clinic_id
       WHERE ds.doctor_id = ?
       ORDER BY ds.day_of_week ASC, ds.start_time ASC"
    );
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['schedules' => $rows]);
  }

  public static function create() {
    $user = auth_user();
    self::ensureDoctor($user);
    $data = get_json_body();

    $clinicId = $data['clinic_id'] ?? null;
    $day = $data['day_of_week'] ?? null;
    $label = $data['session_label'] ?? 'Session';
    $start = $data['start_time'] ?? null;
    $end = $data['end_time'] ?? null;
    $duration = $data['slot_duration_minutes'] ?? 15;
    $max = $data['max_patients_per_slot'] ?? 30;

    if (!$clinicId || $day === null || !$start || !$end) {
      json_response(['error' => 'clinic_id, day_of_week, start_time, end_time required'], 400);
    }

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "INSERT INTO doctor_schedules
       (doctor_id, clinic_id, day_of_week, session_label, start_time, end_time, slot_duration_minutes, max_patients_per_slot, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)"
    );
    $stmt->execute([
      $user['id'],
      $clinicId,
      $day,
      $label,
      $start,
      $end,
      $duration,
      $max
    ]);
    json_response(['message' => 'Schedule created'], 201);
  }

  public static function update($id) {
    $user = auth_user();
    self::ensureDoctor($user);
    $data = get_json_body();

    $fields = [];
    $params = [];
    $allowed = [
      'session_label',
      'start_time',
      'end_time',
      'slot_duration_minutes',
      'max_patients_per_slot',
      'is_active'
    ];

    foreach ($allowed as $key) {
      if (array_key_exists($key, $data)) {
        $fields[] = "$key = ?";
        $params[] = $data[$key];
      }
    }
    if (!$fields) json_response(['error' => 'Nothing to update'], 400);

    $params[] = $user['id'];
    $params[] = $id;
    $sql = "UPDATE doctor_schedules SET " . implode(', ', $fields) . " WHERE doctor_id = ? AND id = ?";
    $pdo = Db::conn();
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    json_response(['message' => 'Schedule updated']);
  }
}
