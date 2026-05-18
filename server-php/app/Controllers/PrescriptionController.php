<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class PrescriptionController {
  public static function create() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'doctor') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $appointmentId = $data['appointment_id'] ?? null;
    $diagnosis = $data['diagnosis'] ?? null;
    $notes = $data['notes'] ?? null;
    $follow = $data['follow_up_date'] ?? null;
    $medicines = $data['medicines'] ?? [];
    $pharmacistId = $data['pharmacist_id'] ?? null;

    if (!$appointmentId || !$diagnosis) json_response(['error' => 'appointment_id and diagnosis required'], 400);
    if (!is_array($medicines) || count($medicines) === 0) json_response(['error' => 'At least one medicine required'], 400);

    $pdo = Db::conn();
    $apptStmt = $pdo->prepare("SELECT patient_id FROM appointments WHERE id = ?");
    $apptStmt->execute([$appointmentId]);
    $appt = $apptStmt->fetch();
    if (!$appt) json_response(['error' => 'Appointment not found'], 404);

    if ($pharmacistId) {
      $pstmt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'pharmacist' LIMIT 1");
      $pstmt->execute([$pharmacistId]);
      if (!$pstmt->fetch()) {
        json_response(['error' => 'Invalid pharmacist'], 400);
      }
    }

    $stmt = $pdo->prepare("INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, pharmacist_id, diagnosis, notes, follow_up_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
      $appointmentId,
      $user['id'],
      $appt['patient_id'],
      $pharmacistId,
      $diagnosis,
      $notes,
      $follow
    ]);

    $prescriptionId = $pdo->lastInsertId();

    $mStmt = $pdo->prepare("INSERT INTO prescription_medicines (prescription_id, medicine_id, medicine_name, dosage, frequency, morning, afternoon, evening, before_food, duration_days, quantity, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    foreach ($medicines as $m) {
      $mStmt->execute([
        $prescriptionId,
        $m['medicine_id'] ?? null,
        $m['medicine_name'] ?? 'Medicine',
        $m['dosage'] ?? null,
        $m['frequency'] ?? null,
        $m['morning'] ?? 0,
        $m['afternoon'] ?? 0,
        $m['evening'] ?? 0,
        $m['before_food'] ?? 0,
        $m['duration_days'] ?? null,
        $m['quantity'] ?? null,
        $m['instructions'] ?? null,
      ]);
    }

    json_response(['message' => 'Prescription created', 'prescription_id' => $prescriptionId], 201);
  }

  public static function list() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);

    $pdo = Db::conn();
    $where = '';
    $params = [];
    if ($user['role'] === 'doctor') { $where = 'WHERE pr.doctor_id = ?'; $params[] = $user['id']; }
    if ($user['role'] === 'patient') { $where = 'WHERE pr.patient_id = ?'; $params[] = $user['id']; }

    $stmt = $pdo->prepare("SELECT pr.*, p.name as patient_name, d.name as doctor_name, a.appointment_date
      FROM prescriptions pr
      JOIN users p ON pr.patient_id = p.id
      JOIN users d ON pr.doctor_id = d.id
      JOIN appointments a ON pr.appointment_id = a.id
      $where
      ORDER BY pr.created_at DESC");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    if ($rows) {
      $ids = array_map(fn($r) => $r['id'], $rows);
      $in = implode(',', array_fill(0, count($ids), '?'));
      $mStmt = $pdo->prepare("SELECT * FROM prescription_medicines WHERE prescription_id IN ($in)");
      $mStmt->execute($ids);
      $meds = $mStmt->fetchAll();
      $map = [];
      foreach ($meds as $m) { $map[$m['prescription_id']][] = $m; }
      foreach ($rows as &$r) { $r['medicines'] = $map[$r['id']] ?? []; }
    }

    json_response(['prescriptions' => $rows]);
  }
}
