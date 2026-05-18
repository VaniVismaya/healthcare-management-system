<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class PatientController {
  public static function profile() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT u.id, u.name, u.email, u.phone,
              pp.date_of_birth, pp.gender, pp.blood_group, pp.address, pp.city, pp.state, pp.pincode,
              pp.emergency_contact_name, pp.emergency_contact_phone, pp.allergies, pp.chronic_conditions
       FROM users u
       LEFT JOIN patient_profiles pp ON pp.user_id = u.id
       WHERE u.id = ?"
    );
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    json_response(['profile' => $row]);
  }

  public static function updateProfile() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $name = $data['name'] ?? null;

    $pdo = Db::conn();
    if ($name) {
      $pdo->prepare("UPDATE users SET name = ? WHERE id = ?")->execute([$name, $user['id']]);
    }

    $fields = [
      'date_of_birth','gender','blood_group','address','city','state','pincode',
      'emergency_contact_name','emergency_contact_phone','allergies','chronic_conditions'
    ];
    $updates = [];
    $params = [];
    foreach ($fields as $f) {
      if (array_key_exists($f, $data)) {
        $updates[] = "$f = ?";
        $params[] = $data[$f];
      }
    }

    if ($updates) {
      $exists = $pdo->prepare("SELECT id FROM patient_profiles WHERE user_id = ? LIMIT 1");
      $exists->execute([$user['id']]);
      if ($exists->fetch()) {
        $sql = "UPDATE patient_profiles SET " . implode(', ', $updates) . " WHERE user_id = ?";
        $params[] = $user['id'];
        $pdo->prepare($sql)->execute($params);
      } else {
        $cols = implode(', ', array_map(fn($c) => $c, array_keys(array_filter($data, fn($v, $k) => in_array($k, $fields, true), ARRAY_FILTER_USE_BOTH))));
        $vals = array_values(array_filter($data, fn($v, $k) => in_array($k, $fields, true), ARRAY_FILTER_USE_BOTH));
        $place = implode(', ', array_fill(0, count($vals), '?'));
        $sql = "INSERT INTO patient_profiles (user_id, $cols) VALUES (?, $place)";
        $pdo->prepare($sql)->execute(array_merge([$user['id']], $vals));
      }
    }

    json_response(['message' => 'Profile updated']);
  }

  public static function vitals() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT pv.*, a.appointment_date, a.appointment_time, d.name as doctor_name
       FROM patient_vitals pv
       LEFT JOIN appointments a ON a.id = pv.appointment_id
       LEFT JOIN users d ON d.id = a.doctor_id
       WHERE pv.patient_id = ?
       ORDER BY pv.created_at DESC"
    );
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['vitals' => $rows]);
  }

  public static function insuranceList() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT id, provider, policy_number, plan_name, valid_from, valid_to, kyc_doc_path, status, created_at
      FROM insurance_policies WHERE patient_id = ? ORDER BY created_at DESC");
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['policies' => $rows]);
  }

  public static function insuranceCreate() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') json_response(['error' => 'Forbidden'], 403);

    $provider = $_POST['provider'] ?? '';
    $policyNumber = $_POST['policy_number'] ?? '';
    if (!$provider || !$policyNumber) json_response(['error' => 'Provider and policy number required'], 400);

    $planName = $_POST['plan_name'] ?? null;
    $validFrom = $_POST['valid_from'] ?? null;
    $validTo = $_POST['valid_to'] ?? null;

    $docPath = null;
    if (!empty($_FILES['document']) && !empty($_FILES['document']['tmp_name'])) {
      $uploadDir = __DIR__ . '/../../public/uploads/insurance';
      if (!is_dir($uploadDir)) { @mkdir($uploadDir, 0777, true); }
      $ext = pathinfo($_FILES['document']['name'], PATHINFO_EXTENSION);
      $filename = 'insurance-' . $user['id'] . '-' . time() . ($ext ? ('.' . $ext) : '');
      $target = $uploadDir . '/' . $filename;
      if (move_uploaded_file($_FILES['document']['tmp_name'], $target)) {
        $docPath = '/uploads/insurance/' . $filename;
      }
    }

    $pdo = Db::conn();
    $stmt = $pdo->prepare("INSERT INTO insurance_policies (patient_id, provider, policy_number, plan_name, valid_from, valid_to, kyc_doc_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$user['id'], $provider, $policyNumber, $planName, $validFrom, $validTo, $docPath]);
    json_response(['message' => 'Insurance saved'], 201);
  }
}
