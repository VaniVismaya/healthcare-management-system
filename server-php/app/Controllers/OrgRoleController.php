<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class OrgRoleController {
  private static function getOrgContext($user, $clinicId = null) {
    $pdo = Db::conn();
    if ($user['role'] === 'doctor') {
      if ($clinicId) {
        $stmt = $pdo->prepare("SELECT id, owner_doctor_id FROM clinics WHERE id = ? AND owner_doctor_id = ?");
        $stmt->execute([$clinicId, $user['id']]);
        $row = $stmt->fetch();
        if (!$row) json_response(['error' => 'Invalid clinic'], 400);
        return ['org_type' => 'clinic', 'org_id' => (int)$clinicId, 'owner_id' => (int)$row['owner_doctor_id']];
      }
      $stmt = $pdo->prepare("SELECT id, owner_doctor_id FROM clinics WHERE owner_doctor_id = ? ORDER BY created_at ASC LIMIT 1");
      $stmt->execute([$user['id']]);
      $row = $stmt->fetch();
      if (!$row) json_response(['error' => 'No clinic found'], 400);
      return ['org_type' => 'clinic', 'org_id' => (int)$row['id'], 'owner_id' => (int)$row['owner_doctor_id']];
    }

    if ($user['role'] === 'laboratory') {
      $stmt = $pdo->prepare("SELECT id FROM laboratory_profiles WHERE user_id = ? LIMIT 1");
      $stmt->execute([$user['id']]);
      $row = $stmt->fetch();
      if (!$row) json_response(['error' => 'Lab profile not found'], 400);
      return ['org_type' => 'laboratory', 'org_id' => (int)$row['id'], 'owner_id' => (int)$user['id']];
    }

    if ($user['role'] === 'pharmacist') {
      $stmt = $pdo->prepare("SELECT id FROM pharmacist_profiles WHERE user_id = ? LIMIT 1");
      $stmt->execute([$user['id']]);
      $row = $stmt->fetch();
      if (!$row) json_response(['error' => 'Pharmacy profile not found'], 400);
      return ['org_type' => 'pharmacy', 'org_id' => (int)$row['id'], 'owner_id' => (int)$user['id']];
    }

    json_response(['error' => 'Not allowed'], 403);
  }

  public static function permissions() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (!in_array($user['role'], ['doctor','laboratory','pharmacist'])) json_response(['error' => 'Forbidden'], 403);

    $pdo = Db::conn();
    $rows = $pdo->query("SELECT id, code, description FROM permissions ORDER BY code ASC")->fetchAll();
    json_response(['permissions' => $rows]);
  }

  public static function listRoles() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (!in_array($user['role'], ['doctor','laboratory','pharmacist'])) json_response(['error' => 'Forbidden'], 403);

    $clinicId = $_GET['clinic_id'] ?? null;
    $ctx = self::getOrgContext($user, $clinicId);

    $pdo = Db::conn();
    $stmt = $pdo->prepare("SELECT * FROM org_roles WHERE org_type = ? AND org_id = ? ORDER BY created_at DESC");
    $stmt->execute([$ctx['org_type'], $ctx['org_id']]);
    $roles = $stmt->fetchAll();

    if ($roles) {
      $ids = array_map(fn($r) => $r['id'], $roles);
      $in = implode(',', array_fill(0, count($ids), '?'));
      $pstmt = $pdo->prepare(
        "SELECT orp.org_role_id, p.id, p.code, p.description
         FROM org_role_permissions orp
         JOIN permissions p ON p.id = orp.permission_id
         WHERE orp.org_role_id IN ($in)"
      );
      $pstmt->execute($ids);
      $rows = $pstmt->fetchAll();
      $map = [];
      foreach ($rows as $r) {
        $map[$r['org_role_id']][] = [
          'id' => $r['id'],
          'code' => $r['code'],
          'description' => $r['description']
        ];
      }
      foreach ($roles as &$r) { $r['permissions'] = $map[$r['id']] ?? []; }
    }

    json_response(['roles' => $roles]);
  }

  public static function createRole() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (!in_array($user['role'], ['doctor','laboratory','pharmacist'])) json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $name = trim($data['name'] ?? '');
    $desc = $data['description'] ?? null;
    $permIds = $data['permission_ids'] ?? [];
    $clinicId = $data['clinic_id'] ?? null;

    if ($name === '') json_response(['error' => 'name required'], 400);
    if (!is_array($permIds)) $permIds = [];

    $ctx = self::getOrgContext($user, $clinicId);
    $pdo = Db::conn();
    $stmt = $pdo->prepare("INSERT INTO org_roles (org_type, org_id, name, description, created_by) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$ctx['org_type'], $ctx['org_id'], $name, $desc, $user['id']]);
    $roleId = $pdo->lastInsertId();

    if (count($permIds)) {
      $ins = $pdo->prepare("INSERT INTO org_role_permissions (org_role_id, permission_id) VALUES (?, ?)");
      foreach ($permIds as $pid) {
        $ins->execute([$roleId, $pid]);
      }
    }

    json_response(['message' => 'Role created', 'id' => $roleId], 201);
  }

  public static function listStaff() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (!in_array($user['role'], ['doctor','laboratory','pharmacist'])) json_response(['error' => 'Forbidden'], 403);

    $clinicId = $_GET['clinic_id'] ?? null;
    $ctx = self::getOrgContext($user, $clinicId);

    $pdo = Db::conn();
    $stmt = $pdo->prepare(
      "SELECT u.id, u.name, u.email, u.phone, r.name as role_name
       FROM org_user_roles our
       JOIN org_roles r ON r.id = our.org_role_id
       JOIN users u ON u.id = our.user_id
       WHERE r.org_type = ? AND r.org_id = ?
       ORDER BY u.created_at DESC"
    );
    $stmt->execute([$ctx['org_type'], $ctx['org_id']]);
    $rows = $stmt->fetchAll();
    json_response(['staff' => $rows]);
  }

  public static function createStaff() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (!in_array($user['role'], ['doctor','laboratory','pharmacist'])) json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $name = trim($data['name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $email = trim($data['email'] ?? '');
    $roleId = $data['org_role_id'] ?? null;
    $deptIds = $data['department_ids'] ?? [];
    $clinicId = $data['clinic_id'] ?? null;

    if ($name === '' || (!$phone && !$email) || !$roleId) {
      json_response(['error' => 'name, phone/email, org_role_id required'], 400);
    }

    $ctx = self::getOrgContext($user, $clinicId);
    $pdo = Db::conn();

    $rstmt = $pdo->prepare("SELECT id FROM org_roles WHERE id = ? AND org_type = ? AND org_id = ?");
    $rstmt->execute([$roleId, $ctx['org_type'], $ctx['org_id']]);
    if (!$rstmt->fetch()) json_response(['error' => 'Invalid org role'], 400);

    $baseRole = $ctx['org_type'] === 'clinic' ? 'receptionist' : ($ctx['org_type'] === 'laboratory' ? 'laboratory' : 'pharmacist');
    $password = 'Staff@123';
    $hash = password_hash($password, PASSWORD_BCRYPT);

    $pdo->beginTransaction();
    try {
      $ustmt = $pdo->prepare("INSERT INTO users (name, email, phone, password_hash, role, is_verified, is_active, is_phone_verified)
        VALUES (?, ?, ?, ?, ?, 0, 1, 0)");
      $ustmt->execute([$name, $email ?: null, $phone ?: null, $hash, $baseRole]);
      $staffId = $pdo->lastInsertId();

      if ($ctx['org_type'] === 'clinic') {
        $cstmt = $pdo->prepare("SELECT owner_doctor_id FROM clinics WHERE id = ? LIMIT 1");
        $cstmt->execute([$ctx['org_id']]);
        $clinic = $cstmt->fetch();
        $doctorId = $clinic ? (int)$clinic['owner_doctor_id'] : $user['id'];
        $pdo->prepare("INSERT INTO receptionist_profiles (user_id, clinic_id, doctor_id) VALUES (?, ?, ?)")
            ->execute([$staffId, $ctx['org_id'], $doctorId]);
      }

      if ($ctx['org_type'] === 'laboratory') {
        $lstmt = $pdo->prepare("SELECT * FROM laboratory_profiles WHERE id = ? LIMIT 1");
        $lstmt->execute([$ctx['org_id']]);
        $lab = $lstmt->fetch();
        if ($lab) {
          $pdo->prepare("INSERT INTO laboratory_profiles (user_id, lab_name, registration_number, certificate_path, address, city, state, pincode, latitude, longitude, phone, email, logo, working_hours_start, working_hours_end, working_days, is_verified, admin_remarks, verified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([
              $staffId,
              $lab['lab_name'],
              $lab['registration_number'],
              $lab['certificate_path'],
              $lab['address'],
              $lab['city'],
              $lab['state'],
              $lab['pincode'],
              $lab['latitude'],
              $lab['longitude'],
              $lab['phone'],
              $lab['email'],
              $lab['logo'],
              $lab['working_hours_start'],
              $lab['working_hours_end'],
              $lab['working_days'],
              $lab['is_verified'],
              $lab['admin_remarks'],
              $lab['verified_at'],
            ]);
        }
      }

      if ($ctx['org_type'] === 'pharmacy') {
        $pstmt = $pdo->prepare("SELECT * FROM pharmacist_profiles WHERE id = ? LIMIT 1");
        $pstmt->execute([$ctx['org_id']]);
        $ph = $pstmt->fetch();
        if ($ph) {
          $pdo->prepare("INSERT INTO pharmacist_profiles (user_id, pharmacy_name, license_number, license_certificate_path, address, city, state, pincode, phone, gstin, is_verified, admin_remarks, verified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([
              $staffId,
              $ph['pharmacy_name'],
              $ph['license_number'],
              $ph['license_certificate_path'],
              $ph['address'],
              $ph['city'],
              $ph['state'],
              $ph['pincode'],
              $ph['phone'],
              $ph['gstin'],
              $ph['is_verified'],
              $ph['admin_remarks'],
              $ph['verified_at'],
            ]);
        }
      }

      $pdo->prepare("INSERT INTO org_user_roles (user_id, org_role_id) VALUES (?, ?)")
        ->execute([$staffId, $roleId]);

      if ($ctx['org_type'] === 'laboratory' && is_array($deptIds) && count($deptIds)) {
        $in = implode(',', array_fill(0, count($deptIds), '?'));
        $params = array_merge([$ctx['owner_id']], $deptIds);
        $dstmt = $pdo->prepare("SELECT id FROM lab_departments WHERE lab_id = ? AND id IN ($in)");
        $dstmt->execute($params);
        $rows = $dstmt->fetchAll();
        if ($rows) {
          $ins = $pdo->prepare("INSERT IGNORE INTO lab_staff_departments (staff_user_id, lab_id, department_id) VALUES (?, ?, ?)");
          foreach ($rows as $r) {
            $ins->execute([$staffId, $ctx['owner_id'], $r['id']]);
          }
        }
      }

      $pdo->commit();
      json_response(['message' => 'Staff created', 'password' => $password], 201);
    } catch (Exception $e) {
      $pdo->rollBack();
      json_response(['error' => 'Create failed', 'details' => $e->getMessage()], 500);
    }
  }
}
