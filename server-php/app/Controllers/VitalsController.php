<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class VitalsController {
  public static function create() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    $role = $user['role'] ?? '';
    if (!in_array($role, ['doctor', 'receptionist'], true)) {
      json_response(['error' => 'Forbidden'], 403);
    }

    $data = get_json_body();
    $appointmentId = $data['appointment_id'] ?? null;
    if (!$appointmentId) json_response(['error' => 'appointment_id required'], 400);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT patient_id FROM appointments WHERE id = ?");
    $stmt->execute([$appointmentId]);
    $appt = $stmt->fetch();
    if (!$appt) json_response(['error' => 'Appointment not found'], 404);

    $bp = $data['blood_pressure'] ?? null;
    if ($bp === '') $bp = null;
    $pulse = $data['pulse_rate'] ?? null;
    if ($pulse === '') $pulse = null;
    $temp = $data['temperature'] ?? null;
    if ($temp === '') $temp = null;
    $weight = $data['weight'] ?? null;
    if ($weight === '') $weight = null;
    $height = $data['height'] ?? null;
    if ($height === '') $height = null;
    $spo2 = $data['oxygen_saturation'] ?? null;
    if ($spo2 === '') $spo2 = null;
    $notes = $data['notes'] ?? null;

    $bmi = $data['bmi'] ?? null;
    if (($bmi === null || $bmi === '') && $weight !== null && $height !== null) {
      $w = (float)$weight;
      $h = (float)$height;
      if ($h > 0) {
        $m = $h / 100.0;
        $bmi = round($w / ($m * $m), 1);
      }
    }
    if ($bmi === '') $bmi = null;

    $stmt = $pdo->prepare(
      "INSERT INTO patient_vitals
        (appointment_id, patient_id, blood_pressure, pulse_rate, temperature, weight, height, bmi, oxygen_saturation, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
      $appointmentId,
      $appt['patient_id'],
      $bp,
      $pulse,
      $temp,
      $weight,
      $height,
      $bmi,
      $spo2,
      $notes,
      $user['id']
    ]);

    json_response(['message' => 'Vitals recorded'], 201);
  }
}
