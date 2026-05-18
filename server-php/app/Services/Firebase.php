<?php

class Firebase {
  public static function verifyIdToken($idToken) {
    $apiKey = getenv('FIREBASE_WEB_API_KEY');
    if (!$apiKey) {
      throw new Exception('Firebase API key not configured');
    }

    $url = "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={$apiKey}";
    $payload = json_encode(['idToken' => $idToken]);
    $ctx = stream_context_create([
      'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $payload,
        'timeout' => 10
      ]
    ]);
    $res = file_get_contents($url, false, $ctx);
    if ($res === false) {
      throw new Exception('Firebase verification failed');
    }
    $data = json_decode($res, true);
    if (!isset($data['users'][0])) {
      throw new Exception('Invalid Firebase token');
    }
    return $data['users'][0];
  }
}
