<?php
require_once __DIR__ . '/../Services/Helpers.php';

function auth_user() {
  $headers = getallheaders();
  $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
  if (!str_starts_with($auth, 'Bearer ')) return null;
  $token = trim(substr($auth, 7));
  return jwt_verify($token);
}
