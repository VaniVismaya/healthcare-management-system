<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class LabController {
  public static function profile() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT u.id, u.name, u.email, u.phone,
              lp.lab_name, lp.registration_number, lp.address, lp.city, lp.state, lp.pincode,
              lp.working_hours_start, lp.working_hours_end, lp.working_days
       FROM users u
       JOIN laboratory_profiles lp ON lp.user_id = u.id
       WHERE u.id = ?"
    );
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    json_response(['profile' => $row]);
  }

  public static function updateProfile() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $allowed = [
      'lab_name','registration_number','address','city','state','pincode',
      'phone','email','working_hours_start','working_hours_end','working_days'
    ];
    $fields = [];
    $params = [];
    foreach ($allowed as $f) {
      if (array_key_exists($f, $data)) {
        $fields[] = "$f = ?";
        $params[] = $data[$f];
      }
    }
    if (!$fields) json_response(['error' => 'Nothing to update'], 400);

    $pdo = Db::conn();
    $params[] = $user['id'];
    $sql = "UPDATE laboratory_profiles SET " . implode(', ', $fields) . " WHERE user_id = ?";
    $pdo->prepare($sql)->execute($params);
    json_response(['message' => 'Profile updated']);
  }

  public static function myTests() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT lt.id, lt.test_name, lt.test_code, lt.category, lt.price, lt.discounted_price, lt.is_active, lt.lab_department_id, ld.name as department_name
      FROM lab_tests lt
      LEFT JOIN lab_departments ld ON lt.lab_department_id = ld.id
      WHERE lt.laboratory_id = ? ORDER BY lt.test_name");
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['tests' => $rows]);
  }

  public static function departments() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT id, name, is_active FROM lab_departments WHERE lab_id = ? ORDER BY name");
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['departments' => $rows]);
  }

  public static function createDepartment() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $name = trim($data['name'] ?? '');
    if ($name === '') json_response(['error' => 'name required'], 400);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("INSERT IGNORE INTO lab_departments (lab_id, name) VALUES (?, ?)");
    $stmt->execute([$user['id'], $name]);
    json_response(['message' => 'Department created'], 201);
  }

  public static function myPackages() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT * FROM lab_test_packages WHERE laboratory_id = ? ORDER BY created_at DESC"
    );
    $stmt->execute([$user['id']]);
    $packages = $stmt->fetchAll();

    if ($packages) {
      $ids = array_map(fn($p) => $p['id'], $packages);
      $in = implode(',', array_fill(0, count($ids), '?'));
      $tstmt = $pdo->prepare(
        "SELECT lpt.package_id, lt.id as test_id, lt.test_name
         FROM lab_package_tests lpt
         JOIN lab_tests lt ON lt.id = lpt.test_id
         WHERE lpt.package_id IN ($in)"
      );
      $tstmt->execute($ids);
      $rows = $tstmt->fetchAll();
      $map = [];
      foreach ($rows as $r) {
        $map[$r['package_id']][] = [
          'test_id' => $r['test_id'],
          'test_name' => $r['test_name']
        ];
      }
      foreach ($packages as &$p) {
        $items = $map[$p['id']] ?? [];
        $p['test_items'] = $items;
        $p['test_names'] = array_map(fn($i) => $i['test_name'], $items);
      }
    }

    json_response(['packages' => $packages]);
  }

  public static function createPackage() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $name = trim($data['package_name'] ?? '');
    $price = $data['price'] ?? null;
    $discounted = $data['discounted_price'] ?? null;
    $tests = $data['test_ids'] ?? [];

    if ($name === '' || $price === null || $price === '') {
      json_response(['error' => 'package_name and price required'], 400);
    }

    $pdo = Db::conn();
    $pdo->beginTransaction();
    try {
      $stmt = $pdo->prepare(
        "INSERT INTO lab_test_packages (laboratory_id, package_name, price, discounted_price, is_active)
         VALUES (?, ?, ?, ?, 1)"
      );
      $stmt->execute([$user['id'], $name, $price, $discounted]);
      $pid = $pdo->lastInsertId();

      if (is_array($tests) && count($tests)) {
        $ins = $pdo->prepare("INSERT INTO lab_package_tests (package_id, test_id) VALUES (?, ?)");
        foreach ($tests as $tid) {
          $ins->execute([$pid, $tid]);
        }
      }
      $pdo->commit();
      json_response(['message' => 'Package created', 'id' => $pid], 201);
    } catch (Exception $e) {
      $pdo->rollBack();
      json_response(['error' => 'Create failed', 'details' => $e->getMessage()], 500);
    }
  }

  public static function updatePackage($id) {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $allowed = ['package_name','price','discounted_price','is_active'];
    $fields = [];
    $params = [];
    foreach ($allowed as $f) {
      if (array_key_exists($f, $data)) {
        $fields[] = "$f = ?";
        $params[] = $data[$f];
      }
    }
    $pdo = Db::conn();

    $pdo->beginTransaction();
    try {
      if ($fields) {
        $params[] = $user['id'];
        $params[] = $id;
        $sql = "UPDATE lab_test_packages SET " . implode(', ', $fields) . " WHERE laboratory_id = ? AND id = ?";
        $pdo->prepare($sql)->execute($params);
      }

      if (array_key_exists('test_ids', $data) && is_array($data['test_ids'])) {
        $pdo->prepare("DELETE FROM lab_package_tests WHERE package_id = ?")->execute([$id]);
        $ins = $pdo->prepare("INSERT INTO lab_package_tests (package_id, test_id) VALUES (?, ?)");
        foreach ($data['test_ids'] as $tid) {
          $ins->execute([$id, $tid]);
        }
      }

      $pdo->commit();
      json_response(['message' => 'Package updated']);
    } catch (Exception $e) {
      $pdo->rollBack();
      json_response(['error' => 'Update failed', 'details' => $e->getMessage()], 500);
    }
  }

  public static function createTest() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $name = trim($data['test_name'] ?? '');
    $price = $data['price'] ?? null;
    if ($name === '' || $price === null || $price === '') json_response(['error' => 'test_name and price required'], 400);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "INSERT INTO lab_tests (laboratory_id, lab_department_id, test_name, test_code, category, price, discounted_price, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)"
    );
    $stmt->execute([
      $user['id'],
      $data['lab_department_id'] ?? null,
      $name,
      $data['test_code'] ?? null,
      $data['category'] ?? null,
      $price,
      $data['discounted_price'] ?? null
    ]);
    json_response(['message' => 'Test created'], 201);
  }

  public static function updateTest($id) {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $allowed = ['test_name','test_code','category','price','discounted_price','is_active','lab_department_id'];
    $fields = [];
    $params = [];
    foreach ($allowed as $f) {
      if (array_key_exists($f, $data)) {
        $fields[] = "$f = ?";
        $params[] = $data[$f];
      }
    }
    if (!$fields) json_response(['error' => 'Nothing to update'], 400);

    $pdo = Db::conn();
    $params[] = $user['id'];
    $params[] = $id;
    $sql = "UPDATE lab_tests SET " . implode(', ', $fields) . " WHERE laboratory_id = ? AND id = ?";
    $pdo->prepare($sql)->execute($params);
    json_response(['message' => 'Test updated']);
  }
  public static function listLabs() {
    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT u.id, u.name, lp.lab_name, lp.city
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      JOIN laboratory_profiles lp ON lp.user_id = u.id
      WHERE (u.role = 'laboratory' OR r.name = 'laboratory')");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    json_response(['labs' => $rows]);
  }

  public static function tests() {
    $labId = $_GET['lab_id'] ?? null;
    if (!$labId) json_response(['error' => 'lab_id required'], 400);
    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT id, test_name, price, discounted_price FROM lab_tests WHERE laboratory_id = ? AND is_active = 1");
    $stmt->execute([$labId]);
    $rows = $stmt->fetchAll();
    json_response(['tests' => $rows]);
  }

  public static function createOrder() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'doctor') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $appointmentId = $data['appointment_id'] ?? null;
    $laboratoryId = $data['laboratory_id'] ?? null;
    $testIds = $data['test_ids'] ?? [];
    $manualTests = $data['manual_tests'] ?? null;

    if (!$appointmentId) json_response(['error' => 'appointment_id required'], 400);

    $pdo = Db::conn();
    $apptStmt = $pdo->prepare("SELECT patient_id FROM appointments WHERE id = ?");
    $apptStmt->execute([$appointmentId]);
    $appt = $apptStmt->fetch();
    if (!$appt) json_response(['error' => 'Appointment not found'], 404);

    $total = 0;
    if ($testIds && count($testIds)) {
      $in = implode(',', array_fill(0, count($testIds), '?'));
      $stmt = $pdo->prepare("SELECT price, discounted_price FROM lab_tests WHERE id IN ($in)");
      $stmt->execute($testIds);
      $tests = $stmt->fetchAll();
      foreach ($tests as $t) {
        $price = $t['discounted_price'] !== null ? $t['discounted_price'] : $t['price'];
        $total += (float)$price;
      }
    }

    $orderType = $laboratoryId ? 'assigned' : 'manual';
    $collectionRequired = !empty($data['collection_required']) ? 1 : 0;
    $collectionDate = $data['collection_date'] ?? null;
    $collectionTime = $data['collection_time'] ?? null;
    $collectionAddress = $data['collection_address'] ?? null;
    $collectionNotes = $data['collection_notes'] ?? null;

    $stmt = $pdo->prepare("INSERT INTO lab_orders (
      appointment_id, doctor_id, patient_id, laboratory_id, order_type, manual_tests, total_amount,
      collection_required, collection_date, collection_time, collection_address, collection_notes
    )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
      $appointmentId,
      $user['id'],
      $appt['patient_id'],
      $laboratoryId ?: null,
      $orderType,
      $manualTests ? json_encode($manualTests) : null,
      $total,
      $collectionRequired,
      $collectionDate,
      $collectionTime,
      $collectionAddress,
      $collectionNotes
    ]);
    $orderId = $pdo->lastInsertId();

    if ($testIds && count($testIds)) {
      foreach ($testIds as $tid) {
        $pdo->prepare("INSERT INTO lab_order_tests (lab_order_id, test_id) VALUES (?, ?)")->execute([$orderId, $tid]);
      }
    }

    json_response(['order_id' => $orderId, 'message' => 'Lab order created'], 201);
  }

  public static function listOrders() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);

    $pdo = Db::conn();
    $where = '';
    $params = [];
    if ($user['role'] === 'laboratory') { $where = 'WHERE lo.laboratory_id = ?'; $params[] = $user['id']; }
    if ($user['role'] === 'doctor') { $where = 'WHERE lo.doctor_id = ?'; $params[] = $user['id']; }
    if ($user['role'] === 'patient') { $where = 'WHERE lo.patient_id = ?'; $params[] = $user['id']; }

    $stmt = $pdo->prepare("SELECT lo.*, p.name as patient_name, d.name as doctor_name, lp.lab_name
      FROM lab_orders lo
      JOIN users p ON lo.patient_id = p.id
      JOIN users d ON lo.doctor_id = d.id
      LEFT JOIN laboratory_profiles lp ON lo.laboratory_id = lp.user_id
      $where ORDER BY lo.created_at DESC");
    $stmt->execute($params);
    $orders = $stmt->fetchAll();

    if ($orders) {
      $ids = array_map(fn($o) => $o['id'], $orders);
      $in = implode(',', array_fill(0, count($ids), '?'));
      $tstmt = $pdo->prepare("SELECT lot.lab_order_id, lot.test_id, lot.is_completed, lt.test_name, lt.price, lt.discounted_price
        FROM lab_order_tests lot
        JOIN lab_tests lt ON lot.test_id = lt.id
        WHERE lot.lab_order_id IN ($in)");
      $tstmt->execute($ids);
      $rows = $tstmt->fetchAll();
      $map = [];
      foreach ($rows as $r) {
        $map[$r['lab_order_id']][] = [
          'test_id' => $r['test_id'],
          'test_name' => $r['test_name'],
          'price' => $r['price'],
          'discounted_price' => $r['discounted_price'],
          'is_completed' => (int)($r['is_completed'] ?? 0) === 1
        ];
      }
      foreach ($orders as &$o) {
        $items = $map[$o['id']] ?? [];
        $o['test_items'] = $items;
        $o['test_names'] = array_map(fn($i) => $i['test_name'], $items);
      }
    }

    if ($orders) {
      $ids = array_map(fn($o) => $o['id'], $orders);
      $in = implode(',', array_fill(0, count($ids), '?'));
      $rstmt = $pdo->prepare(
        "SELECT lab_order_id, COUNT(*) as report_count
         FROM lab_reports
         WHERE lab_order_id IN ($in)
         GROUP BY lab_order_id"
      );
      $rstmt->execute($ids);
      $rows = $rstmt->fetchAll();
      $rmap = [];
      foreach ($rows as $r) { $rmap[$r['lab_order_id']] = (int)$r['report_count']; }
      foreach ($orders as &$o) {
        $o['report_count'] = $rmap[$o['id']] ?? 0;
      }
    }

    json_response(['orders' => $orders]);
  }

  public static function updateOrderTests($id) {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $tests = $data['tests'] ?? null;
    if (!is_array($tests)) json_response(['error' => 'tests must be an array'], 400);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT laboratory_id FROM lab_orders WHERE id = ?");
    $stmt->execute([$id]);
    $order = $stmt->fetch();
    if (!$order) json_response(['error' => 'Order not found'], 404);
    if ((int)$order['laboratory_id'] !== (int)$user['id']) json_response(['error' => 'Not your lab order'], 403);

    foreach ($tests as $t) {
      if (!isset($t['test_id'])) continue;
      $pdo->prepare("UPDATE lab_order_tests SET is_completed = ? WHERE lab_order_id = ? AND test_id = ?")
        ->execute([(int)($t['is_completed'] ? 1 : 0), $id, $t['test_id']]);
    }

    json_response(['message' => 'Lab tests updated']);
  }
}
