<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';

class DoctorController {
  public static function search() {
    $name = $_GET['name'] ?? '';
    $city = $_GET['city'] ?? '';
    $specialization = $_GET['specialization'] ?? '';

    $pdo = Db::conn();
    $sql = "SELECT u.id, u.name, dp.specialization, dp.experience_years, dp.consultation_fee,
                   c.id as clinic_id, c.name as clinic_name, c.city
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
            LEFT JOIN clinics c ON dp.clinic_id = c.id
            WHERE (u.role = 'doctor' OR r.name = 'doctor')";
    $params = [];
    if ($name) { $sql .= " AND u.name LIKE ?"; $params[] = "%{$name}%"; }
    if ($city) { $sql .= " AND c.city LIKE ?"; $params[] = "%{$city}%"; }
    if ($specialization) { $sql .= " AND dp.specialization LIKE ?"; $params[] = "%{$specialization}%"; }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    json_response(['doctors' => $rows]);
  }

  public static function patientDetails($id) {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'doctor') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $check = $pdo->prepare("SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ? LIMIT 1");
    $check->execute([$user['id'], $id]);
    if (!$check->fetch()) {
      json_response(['error' => 'Not allowed'], 403);
    }

    $pStmt = $pdo->prepare(
      "SELECT u.id, u.name, u.email, u.phone,
              pp.date_of_birth, pp.gender, pp.blood_group, pp.address, pp.city, pp.state, pp.pincode,
              pp.emergency_contact_name, pp.emergency_contact_phone, pp.allergies, pp.chronic_conditions
       FROM users u
       LEFT JOIN patient_profiles pp ON pp.user_id = u.id
       WHERE u.id = ?"
    );
    $pStmt->execute([$id]);
    $profile = $pStmt->fetch();

    $vStmt = $pdo->prepare(
      "SELECT pv.*, a.appointment_date, a.appointment_time
       FROM patient_vitals pv
       LEFT JOIN appointments a ON a.id = pv.appointment_id
       WHERE pv.patient_id = ?
       ORDER BY pv.created_at DESC"
    );
    $vStmt->execute([$id]);
    $vitals = $vStmt->fetchAll();

    json_response(['profile' => $profile, 'vitals' => $vitals]);
  }
}
