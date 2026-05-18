<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class LabReportController {
  private static function parseNormalRange($text) {
    if (!$text) return null;
    preg_match_all('/-?\d+(?:\.\d+)?/', (string)$text, $matches);
    if (!isset($matches[0]) || count($matches[0]) < 2) return null;
    $min = floatval($matches[0][0]);
    $max = floatval($matches[0][1]);
    if (!is_finite($min) || !is_finite($max)) return null;
    return ['min' => $min, 'max' => $max];
  }

  private static function computeFlag($valueText, $rangeText) {
    if ($valueText === null || $valueText === '') return null;
    $valueNum = floatval(preg_replace('/[^0-9.\-]/', '', (string)$valueText));
    if (!is_finite($valueNum)) return null;
    $range = self::parseNormalRange($rangeText);
    if (!$range) return null;
    if ($valueNum < $range['min'] || $valueNum > $range['max']) return 'abnormal';
    return 'normal';
  }

  public static function upload() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if ($user['role'] !== 'laboratory') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $labOrderId = $data['lab_order_id'] ?? null;
    $title = $data['report_title'] ?? 'Lab Report';
    $filePath = $data['file_path'] ?? null;
    $testId = $data['test_id'] ?? null;
    $resultValue = $data['result_value'] ?? null;
    $resultUnit = $data['result_unit'] ?? null;
    $summary = $data['summary_results'] ?? [];
    if (!is_array($summary)) $summary = [];

    if (!$labOrderId || !$filePath) json_response(['error' => 'lab_order_id and file_path required'], 400);

    $pdo = Db::conn();
    if (empty($summary) && ($resultValue || $resultUnit || $testId)) {
      $summary = [[
        'test_id' => $testId,
        'result_name' => null,
        'result_value' => $resultValue,
        'result_unit' => $resultUnit,
        'normal_range' => null
      ]];
    }

    $summary = array_slice($summary, 0, 5);
    $testIds = [];
    foreach ($summary as $r) {
      if (!empty($r['test_id'])) $testIds[] = $r['test_id'];
    }
    $testMeta = [];
    if (count($testIds)) {
      $in = implode(',', array_fill(0, count($testIds), '?'));
      $tstmt = $pdo->prepare("SELECT id, test_name, normal_range FROM lab_tests WHERE id IN ($in)");
      $tstmt->execute($testIds);
      foreach ($tstmt->fetchAll() as $t) {
        $testMeta[$t['id']] = $t;
      }
    }

    $normalized = [];
    foreach ($summary as $r) {
      $tid = $r['test_id'] ?? null;
      $meta = $tid && isset($testMeta[$tid]) ? $testMeta[$tid] : null;
      $name = $r['result_name'] ?? ($meta ? $meta['test_name'] : 'Result');
      $range = $r['normal_range'] ?? ($meta ? $meta['normal_range'] : null);
      $value = $r['result_value'] ?? null;
      $unit = $r['result_unit'] ?? null;
      $flag = self::computeFlag($value, $range);
      $normalized[] = [
        'test_id' => $tid,
        'result_name' => $name,
        'result_value' => $value,
        'result_unit' => $unit,
        'normal_range' => $range,
        'result_flag' => $flag
      ];
    }

    $primary = count($normalized) ? $normalized[0] : null;
    $stmt = $pdo->prepare("INSERT INTO lab_reports (lab_order_id, test_id, report_title, report_file_path, result_value, result_unit, result_flag, normal_range_snapshot, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->execute([
      $labOrderId,
      $primary ? $primary['test_id'] : $testId,
      $title,
      $filePath,
      $primary ? $primary['result_value'] : $resultValue,
      $primary ? $primary['result_unit'] : $resultUnit,
      $primary ? $primary['result_flag'] : self::computeFlag($resultValue, $primary ? $primary['normal_range'] : null),
      $primary ? $primary['normal_range'] : null
    ]);
    $reportId = $pdo->lastInsertId();

    if (count($normalized)) {
      $ins = $pdo->prepare("INSERT INTO lab_report_results (lab_report_id, test_id, result_name, result_value, result_unit, normal_range, result_flag)
        VALUES (?, ?, ?, ?, ?, ?, ?)");
      foreach ($normalized as $r) {
        $ins->execute([
          $reportId,
          $r['test_id'],
          $r['result_name'],
          $r['result_value'],
          $r['result_unit'],
          $r['normal_range'],
          $r['result_flag']
        ]);
      }
    }

    json_response(['message' => 'Report uploaded'], 201);
  }

  public static function list() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);

    $pdo = Db::conn();
    $where = '';
    $params = [];
    if ($user['role'] === 'laboratory') { $where = 'WHERE lo.laboratory_id = ?'; $params[] = $user['id']; }
    if ($user['role'] === 'doctor') { $where = 'WHERE lo.doctor_id = ?'; $params[] = $user['id']; }
    if ($user['role'] === 'patient') { $where = 'WHERE lo.patient_id = ?'; $params[] = $user['id']; }

    $stmt = $pdo->prepare("SELECT lr.*, lo.patient_id, lo.doctor_id, p.name as patient_name, d.name as doctor_name,
      lr.report_file_path as file_path
      FROM lab_reports lr
      JOIN lab_orders lo ON lr.lab_order_id = lo.id
      JOIN users p ON lo.patient_id = p.id
      JOIN users d ON lo.doctor_id = d.id
      $where ORDER BY lr.created_at DESC");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    if ($rows) {
      $ids = array_map(fn($r) => $r['id'], $rows);
      $in = implode(',', array_fill(0, count($ids), '?'));
      $rstmt = $pdo->prepare("SELECT lab_report_id, test_id, result_name, result_value, result_unit, normal_range, result_flag
        FROM lab_report_results WHERE lab_report_id IN ($in) ORDER BY id ASC");
      $rstmt->execute($ids);
      $rrows = $rstmt->fetchAll();
      $map = [];
      foreach ($rrows as $r) {
        $map[$r['lab_report_id']][] = $r;
      }
      foreach ($rows as &$row) {
        $row['summary_results'] = $map[$row['id']] ?? [];
      }
    }

    json_response(['reports' => $rows]);
  }
}
