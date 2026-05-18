<?php
function json_response($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json');
  echo json_encode($data);
  exit;
}

function get_json_body() {
  $raw = file_get_contents('php://input');
  if (!$raw) return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function jwt_secret() {
  return getenv('JWT_SECRET') ?: 'dev_secret';
}

function jwt_sign($payload) {
  $header = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
  $body = base64_encode(json_encode($payload));
  $signature = hash_hmac('sha256', "$header.$body", jwt_secret());
  return "$header.$body.$signature";
}

function jwt_verify($token) {
  $parts = explode('.', $token);
  if (count($parts) !== 3) return null;
  [$header, $body, $sig] = $parts;
  $expected = hash_hmac('sha256', "$header.$body", jwt_secret());
  if (!hash_equals($expected, $sig)) return null;
  $payload = json_decode(base64_decode($body), true);
  return is_array($payload) ? $payload : null;
}
