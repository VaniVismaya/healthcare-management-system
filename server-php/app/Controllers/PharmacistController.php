<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class PharmacistController {
  public static function profile() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'pharmacist') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT u.id, u.name, u.email, u.phone,
              pp.pharmacy_name, pp.license_number, pp.address, pp.city, pp.state, pp.pincode, pp.phone as pharmacy_phone, pp.gstin
       FROM users u
       JOIN pharmacist_profiles pp ON pp.user_id = u.id
       WHERE u.id = ?"
    );
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    json_response(['profile' => $row]);
  }

  public static function updateProfile() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'pharmacist') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $name = $data['name'] ?? null;

    $pdo = Db::conn();
    if ($name) {
      $pdo->prepare("UPDATE users SET name = ? WHERE id = ?")->execute([$name, $user['id']]);
    }

    $allowed = ['pharmacy_name','license_number','address','city','state','pincode','phone','gstin'];
    $fields = [];
    $params = [];
    foreach ($allowed as $f) {
      if (array_key_exists($f, $data)) {
        $col = $f === 'phone' ? 'phone' : $f;
        $fields[] = "$col = ?";
        $params[] = $data[$f];
      }
    }
    if ($fields) {
      $params[] = $user['id'];
      $sql = "UPDATE pharmacist_profiles SET " . implode(', ', $fields) . " WHERE user_id = ?";
      $pdo->prepare($sql)->execute($params);
    }

    json_response(['message' => 'Profile updated']);
  }

  public static function listPharmacies() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT u.id as user_id, pp.pharmacy_name, pp.city
       FROM pharmacist_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE u.is_active = 1"
    );
    $stmt->execute();
    $rows = $stmt->fetchAll();
    json_response(['pharmacies' => $rows]);
  }

  public static function listPrescriptions() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'pharmacist') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT p.*, d.name as doctor_name, pt.name as patient_name
       FROM prescriptions p
       JOIN users d ON d.id = p.doctor_id
       JOIN users pt ON pt.id = p.patient_id
       WHERE p.pharmacist_id = ?
       ORDER BY p.created_at DESC"
    );
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();

    if (!$rows) json_response(['prescriptions' => []]);

    $ids = array_map(fn($r) => $r['id'], $rows);
    $in = implode(',', array_fill(0, count($ids), '?'));
    $medStmt = $pdo->prepare(
      "SELECT prescription_id, medicine_name, dosage, frequency, duration_days, quantity, instructions
       FROM prescription_medicines
       WHERE prescription_id IN ($in)"
    );
    $medStmt->execute($ids);
    $meds = $medStmt->fetchAll();

    $byRx = [];
    foreach ($meds as $m) {
      $pid = $m['prescription_id'];
      if (!isset($byRx[$pid])) $byRx[$pid] = [];
      $byRx[$pid][] = $m;
    }

    foreach ($rows as &$r) {
      $r['medicines'] = $byRx[$r['id']] ?? [];
    }

    json_response(['prescriptions' => $rows]);
  }

  public static function dispense($id) {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'pharmacist') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("UPDATE prescriptions SET is_dispensed = 1, dispensed_at = NOW() WHERE id = ? AND pharmacist_id = ?");
    $stmt->execute([$id, $user['id']]);
    json_response(['message' => 'Dispensed']);
  }

  public static function listMedicines() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'pharmacist') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT m.id, m.name, m.strength, m.unit, m.price, m.mrp, m.is_active,
              COALESCE(SUM(ms.quantity),0) as total_quantity,
              COALESCE(MIN(ms.low_stock_alert),10) as low_stock_alert
       FROM medicines m
       LEFT JOIN medicine_stock ms ON ms.medicine_id = m.id
       WHERE m.pharmacist_id = ?
       GROUP BY m.id
       ORDER BY m.name"
    );
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
      $qty = (int)($r['total_quantity'] ?? 0);
      $low = (int)($r['low_stock_alert'] ?? 10);
      $r['alert_level'] = $qty <= 0 ? 'out_of_stock' : ($qty <= $low ? 'low_stock' : 'ok');
    }
    // Save alerts (idempotent by status per medicine)
    foreach ($rows as $r) {
      if ($r['alert_level'] === 'ok') continue;
      $title = $r['alert_level'] === 'out_of_stock' ? 'Out of stock' : 'Low stock';
      $message = ($r['name'] ?? 'Medicine') . ' is ' . ($r['alert_level'] === 'out_of_stock' ? 'out of stock' : 'low on stock');
      $check = $pdo->prepare("SELECT id FROM notifications WHERE user_id = ? AND type = 'stock_alert' AND reference_type = 'medicine' AND reference_id = ? AND message = ? LIMIT 1");
      $check->execute([$user['id'], $r['id'], $message]);
      if (!$check->fetch()) {
        $ins = $pdo->prepare("INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type) VALUES (?, ?, ?, 'stock_alert', ?, 'medicine')");
        $ins->execute([$user['id'], $title, $message, $r['id']]);
      }
    }
    json_response(['medicines' => $rows]);
  }

  public static function createMedicine() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'pharmacist') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $name = trim($data['name'] ?? '');
    $price = $data['price'] ?? null;
    $strength = trim($data['strength'] ?? '');
    $unit = trim($data['unit'] ?? '');
    $quantity = (int)($data['quantity'] ?? 0);

    if ($name === '' || $price === null || $price === '') {
      json_response(['error' => 'Name and price required'], 400);
    }

    $pdo = Db::conn();
    try {
      $pdo->beginTransaction();
      $stmt = $pdo->prepare(
        "INSERT INTO medicines (pharmacist_id, name, strength, unit, price)
         VALUES (?, ?, ?, ?, ?)"
      );
      $stmt->execute([$user['id'], $name, $strength ?: null, $unit ?: null, $price]);
      $medId = $pdo->lastInsertId();

      $stockStmt = $pdo->prepare(
        "INSERT INTO medicine_stock (medicine_id, quantity, batch_number, low_stock_alert)
         VALUES (?, ?, ?, ?)"
      );
      $stockStmt->execute([$medId, $quantity, null, 10]);

      $pdo->commit();
      json_response(['message' => 'Medicine created', 'id' => $medId], 201);
    } catch (Exception $e) {
      $pdo->rollBack();
      json_response(['error' => 'Create failed', 'details' => $e->getMessage()], 500);
    }
  }
}
