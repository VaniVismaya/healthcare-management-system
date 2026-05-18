<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';
require_once __DIR__ . '/../Services/PaytmChecksum.php';
require_once __DIR__ . '/../Middlewares/Auth.php';

class PaymentController {
  private static function ensureSettingsTable($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      setting_value VARCHAR(255),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
  }

  private static function ensurePaymentTable($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS payment_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL UNIQUE,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(8) DEFAULT 'INR',
      status ENUM('created','paid','failed','cancelled') DEFAULT 'created',
      gateway VARCHAR(20) DEFAULT 'paytm',
      gateway_order_id VARCHAR(64),
      gateway_payment_id VARCHAR(64),
      gateway_signature VARCHAR(255),
      appointment_id INT,
      queue_number INT,
      transaction_id VARCHAR(64),
      appointment_payload LONGTEXT,
      callback_payload LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
  }

  private static function getBookingFee($pdo) {
    self::ensureSettingsTable($pdo);
    $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'booking_fee' LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch();
    if (!$row) return 0;
    $fee = (float)$row['setting_value'];
    return $fee > 0 ? $fee : 0;
  }

  private static function paytmBaseUrl() {
    $env = strtolower(getenv('PAYTM_ENV') ?: 'staging');
    return $env === 'production' ? 'https://securegw.paytm.in' : 'https://securegw-stage.paytm.in';
  }

  private static function createAppointment($pdo, $payload, $userId, $paymentRef) {
    $doctorId = $payload['doctor_id'] ?? null;
    $clinicId = $payload['clinic_id'] ?? null;
    $date = $payload['appointment_date'] ?? null;
    $sessionId = $payload['session_id'] ?? null;
    $reason = $payload['reason_for_visit'] ?? null;
    $priority = ($payload['priority_level'] ?? 'normal') === 'priority' ? 'priority' : 'normal';
    $mode = ($payload['consultation_mode'] ?? 'in_person') === 'video' ? 'video' : 'in_person';

    if (!$doctorId || !$clinicId || !$date || !$sessionId) {
      throw new Exception('Missing booking data');
    }

    $schedStmt = $pdo->prepare("SELECT * FROM doctor_schedules WHERE id = ? AND doctor_id = ? AND clinic_id = ? AND is_active = 1");
    $schedStmt->execute([$sessionId, $doctorId, $clinicId]);
    $sched = $schedStmt->fetch();
    if (!$sched) throw new Exception('Invalid session');

    $countStmt = $pdo->prepare("SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ? AND status NOT IN ('cancelled','no_show')");
    $countStmt->execute([$doctorId, $clinicId, $date, $sessionId]);
    $count = (int)$countStmt->fetch()['count'];
    $max = (int)($sched['max_patients_per_slot'] ?? 30);
    if ($count >= $max) throw new Exception('Session full');

    $queue = $count + 1;
    $fee = self::getBookingFee($pdo);

    $stmt = $pdo->prepare("INSERT INTO appointments (
        patient_id, doctor_id, clinic_id, appointment_date, appointment_time, slot_number, queue_number,
        session_id, priority_level, reason_for_visit, consultation_mode,
        booked_by, booked_by_user_id, booking_fee, payment_status, payment_reference
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient', ?, ?, 'paid', ?)");
    $stmt->execute([
      $userId,
      $doctorId,
      $clinicId,
      $date,
      $sched['start_time'],
      $queue,
      $queue,
      $sessionId,
      $priority,
      $reason,
      $mode,
      $userId,
      $fee,
      $paymentRef
    ]);

    return ['appointment_id' => (int)$pdo->lastInsertId(), 'queue_number' => $queue];
  }

  public static function initiatePaytm() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $doctorId = $data['doctor_id'] ?? null;
    $clinicId = $data['clinic_id'] ?? null;
    $date = $data['appointment_date'] ?? null;
    $sessionId = $data['session_id'] ?? null;

    if (!$doctorId || !$clinicId || !$date || !$sessionId) {
      json_response(['error' => 'Missing required booking details'], 400);
    }

    $pdo = Db::conn();
    self::ensurePaymentTable($pdo);
    $fee = self::getBookingFee($pdo);
    if ($fee <= 0) json_response(['error' => 'Booking fee is not enabled'], 400);

    $MID = getenv('PAYTM_MID');
    $MERCHANT_KEY = getenv('PAYTM_MERCHANT_KEY');
    $WEBSITE = getenv('PAYTM_WEBSITE') ?: 'WEBSTAGING';
    $CALLBACK = getenv('PAYTM_CALLBACK_URL') ?: 'http://localhost:8000/api/payments/paytm/callback';
    if (!$MID || !$MERCHANT_KEY) json_response(['error' => 'Paytm not configured'], 500);

    $orderId = 'BOOK' . time() . $user['id'];
    $amount = number_format((float)$fee, 2, '.', '');
    $payload = [
      'doctor_id' => $doctorId,
      'clinic_id' => $clinicId,
      'appointment_date' => $date,
      'appointment_time' => $data['appointment_time'] ?? null,
      'reason_for_visit' => $data['reason_for_visit'] ?? null,
      'consultation_mode' => $data['consultation_mode'] ?? 'in_person',
      'session_id' => $sessionId,
      'priority_level' => $data['priority_level'] ?? 'normal'
    ];

    $body = [
      'requestType' => 'Payment',
      'mid' => $MID,
      'websiteName' => $WEBSITE,
      'orderId' => $orderId,
      'callbackUrl' => $CALLBACK,
      'txnAmount' => ['value' => $amount, 'currency' => 'INR'],
      'userInfo' => [
        'custId' => 'CUST_' . $user['id'],
        'mobile' => $user['phone'] ?? '',
        'email' => $user['email'] ?? ''
      ]
    ];

    $checksum = PaytmChecksum::generateSignature($body, $MERCHANT_KEY);
    $post = ['body' => $body, 'head' => ['signature' => $checksum]];

    $url = self::paytmBaseUrl() . "/theia/api/v1/initiateTransaction?mid={$MID}&orderId={$orderId}";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($post));
    $resp = curl_exec($ch);
    if ($resp === false) {
      json_response(['error' => 'Paytm initiation failed'], 500);
    }
    $result = json_decode($resp, true);
    $txnToken = $result['body']['txnToken'] ?? null;
    if (!$txnToken) json_response(['error' => 'Paytm initiation failed'], 500);

    $stmt = $pdo->prepare("INSERT INTO payment_orders (order_id, user_id, amount, status, gateway, appointment_payload)
      VALUES (?, ?, ?, 'created', 'paytm', ?)");
    $stmt->execute([$orderId, $user['id'], $amount, json_encode($payload)]);

    json_response([
      'order_id' => $orderId,
      'txn_token' => $txnToken,
      'amount' => $amount,
      'mid' => $MID,
      'callback_url' => $CALLBACK,
      'env' => getenv('PAYTM_ENV') ?: 'staging'
    ]);
  }

  public static function paytmCallback() {
    $body = $_POST;
    $checksum = $body['CHECKSUMHASH'] ?? '';
    unset($body['CHECKSUMHASH']);
    $MERCHANT_KEY = getenv('PAYTM_MERCHANT_KEY');
    $valid = PaytmChecksum::verifySignature($body, $MERCHANT_KEY, $checksum);

    $orderId = $body['ORDERID'] ?? null;
    $status = $body['STATUS'] ?? null;
    $txnId = $body['TXNID'] ?? null;
    $clientUrl = getenv('CLIENT_URL') ?: 'http://localhost:3001';

    if (!$orderId) {
      echo "Missing order id";
      exit;
    }

    $pdo = Db::conn();
    self::ensurePaymentTable($pdo);
    $stmt = $pdo->prepare("SELECT * FROM payment_orders WHERE order_id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();
    if (!$order) {
      echo "Order not found";
      exit;
    }

    if (!$valid || $status !== 'TXN_SUCCESS') {
      $upd = $pdo->prepare("UPDATE payment_orders SET status = 'failed', callback_payload = ? WHERE order_id = ?");
      $upd->execute([json_encode(array_merge($body, ['CHECKSUMHASH' => $checksum])), $orderId]);
      echo "<html><body>Payment failed. <a href=\"{$clientUrl}\">Return</a></body></html>";
      exit;
    }

    if ($order['status'] === 'paid' && $order['appointment_id']) {
      echo "<html><body>Payment already processed. <a href=\"{$clientUrl}\">Return</a></body></html>";
      exit;
    }

    $payload = json_decode($order['appointment_payload'] ?? '{}', true);
    try {
      $booking = self::createAppointment($pdo, $payload, (int)$order['user_id'], $txnId ?: $orderId);
      $upd = $pdo->prepare("UPDATE payment_orders SET status = 'paid', appointment_id = ?, queue_number = ?, transaction_id = ?, callback_payload = ? WHERE order_id = ?");
      $upd->execute([
        $booking['appointment_id'],
        $booking['queue_number'],
        $txnId,
        json_encode(array_merge($body, ['CHECKSUMHASH' => $checksum])),
        $orderId
      ]);

      echo "<html><body>Payment successful. Queue #{$booking['queue_number']}. <a href=\"{$clientUrl}\">Return</a></body></html>";
      exit;
    } catch (Exception $e) {
      echo "<html><body>Payment processed but booking failed: " . htmlspecialchars($e->getMessage()) . "</body></html>";
      exit;
    }
  }

  public static function paytmStatus() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') json_response(['error' => 'Forbidden'], 403);

    $orderId = $_GET['order_id'] ?? null;
    if (!$orderId) json_response(['error' => 'order_id required'], 400);

    $pdo = Db::conn();
    self::ensurePaymentTable($pdo);
    $stmt = $pdo->prepare("SELECT order_id, status, appointment_id, queue_number FROM payment_orders WHERE order_id = ? AND user_id = ? LIMIT 1");
    $stmt->execute([$orderId, $user['id']]);
    $row = $stmt->fetch();
    if (!$row) json_response(['error' => 'Order not found'], 404);
    json_response($row);
  }

  private static function razorpayAuthHeader() {
    $keyId = getenv('RAZORPAY_KEY_ID');
    $keySecret = getenv('RAZORPAY_KEY_SECRET');
    if (!$keyId || !$keySecret) return null;
    return 'Basic ' . base64_encode($keyId . ':' . $keySecret);
  }

  public static function initiateRazorpay() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $doctorId = $data['doctor_id'] ?? null;
    $clinicId = $data['clinic_id'] ?? null;
    $date = $data['appointment_date'] ?? null;
    $sessionId = $data['session_id'] ?? null;
    if (!$doctorId || !$clinicId || !$date || !$sessionId) {
      json_response(['error' => 'Missing required booking details'], 400);
    }

    $pdo = Db::conn();
    self::ensurePaymentTable($pdo);
    $fee = self::getBookingFee($pdo);
    if ($fee <= 0) json_response(['error' => 'Booking fee is not enabled'], 400);

    $auth = self::razorpayAuthHeader();
    if (!$auth) json_response(['error' => 'Razorpay not configured'], 500);

    $orderId = 'BOOK' . time() . $user['id'];
    $amountPaise = (int)round($fee * 100);
    $callbackBase = getenv('RAZORPAY_CALLBACK_URL') ?: (getenv('CLIENT_URL') ?: 'http://localhost:3001') . '/patient/book';
    $callbackUrl = $callbackBase . (strpos($callbackBase, '?') !== false ? '&' : '?') . 'razorpay_order=' . $orderId;

    $payload = [
      'doctor_id' => $doctorId,
      'clinic_id' => $clinicId,
      'appointment_date' => $date,
      'appointment_time' => $data['appointment_time'] ?? null,
      'reason_for_visit' => $data['reason_for_visit'] ?? null,
      'consultation_mode' => $data['consultation_mode'] ?? 'in_person',
      'session_id' => $sessionId,
      'priority_level' => $data['priority_level'] ?? 'normal'
    ];

    $body = [
      'amount' => $amountPaise,
      'currency' => 'INR',
      'description' => 'Appointment Booking Fee',
      'reference_id' => $orderId,
      'callback_url' => $callbackUrl,
      'callback_method' => 'get',
      'customer' => [
        'name' => $user['name'] ?? 'Patient',
        'email' => $user['email'] ?? '',
        'contact' => $user['phone'] ?? ''
      ],
      'notify' => ['sms' => true, 'email' => true]
    ];

    $ch = curl_init('https://api.razorpay.com/v1/payment_links');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Authorization: ' . $auth]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $resp = curl_exec($ch);
    if ($resp === false) {
      json_response(['error' => 'Razorpay initiation failed'], 500);
    }
    $result = json_decode($resp, true);
    $linkId = $result['id'] ?? null;
    $shortUrl = $result['short_url'] ?? null;
    if (!$linkId || !$shortUrl) json_response(['error' => 'Razorpay initiation failed'], 500);

    $stmt = $pdo->prepare("INSERT INTO payment_orders (order_id, user_id, amount, status, gateway, gateway_order_id, appointment_payload)
      VALUES (?, ?, ?, 'created', 'razorpay', ?, ?)");
    $stmt->execute([$orderId, $user['id'], number_format($fee, 2, '.', ''), $linkId, json_encode($payload)]);

    json_response([
      'order_id' => $orderId,
      'payment_url' => $shortUrl,
      'callback_url' => $callbackUrl
    ]);
  }

  public static function razorpayWebhook() {
    $secret = getenv('RAZORPAY_WEBHOOK_SECRET');
    if (!$secret) {
      http_response_code(500);
      echo "Webhook not configured";
      exit;
    }

    $body = file_get_contents('php://input');
    $sig = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';
    $expected = hash_hmac('sha256', $body, $secret);
    if (!hash_equals($expected, $sig)) {
      http_response_code(400);
      echo "Invalid signature";
      exit;
    }

    $payload = json_decode($body, true);
    $entity = $payload['payload']['payment_link']['entity'] ?? null;
    if (!$entity) { echo "No payload"; exit; }
    $paymentLinkId = $entity['id'] ?? null;
    $referenceId = $entity['reference_id'] ?? null;
    $status = $entity['status'] ?? null;
    if ($status !== 'paid') { echo "No action"; exit; }

    $pdo = Db::conn();
    self::ensurePaymentTable($pdo);
    $stmt = $pdo->prepare("SELECT * FROM payment_orders WHERE (gateway_order_id = ? OR order_id = ?) AND gateway = 'razorpay' LIMIT 1");
    $stmt->execute([$paymentLinkId, $referenceId]);
    $order = $stmt->fetch();
    if (!$order) { echo "Order not found"; exit; }
    if ($order['status'] === 'paid') { echo "Already paid"; exit; }

    $payloadData = json_decode($order['appointment_payload'] ?? '{}', true);
    try {
      $booking = self::createAppointment($pdo, $payloadData, (int)$order['user_id'], $paymentLinkId);
      $upd = $pdo->prepare("UPDATE payment_orders SET status = 'paid', appointment_id = ?, queue_number = ?, gateway_payment_id = ?, callback_payload = ? WHERE order_id = ?");
      $upd->execute([$booking['appointment_id'], $booking['queue_number'], $paymentLinkId, $body, $order['order_id']]);
      echo "OK";
    } catch (Exception $e) {
      echo "Error";
    }
  }

  public static function razorpayStatus() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') json_response(['error' => 'Forbidden'], 403);
    $orderId = $_GET['order_id'] ?? null;
    if (!$orderId) json_response(['error' => 'order_id required'], 400);

    $pdo = Db::conn();
    self::ensurePaymentTable($pdo);
    $stmt = $pdo->prepare("SELECT order_id, status, appointment_id, queue_number FROM payment_orders WHERE order_id = ? AND user_id = ? LIMIT 1");
    $stmt->execute([$orderId, $user['id']]);
    $row = $stmt->fetch();
    if (!$row) json_response(['error' => 'Order not found'], 404);
    json_response($row);
  }

  public static function initiateStripe() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') json_response(['error' => 'Forbidden'], 403);

    $data = get_json_body();
    $doctorId = $data['doctor_id'] ?? null;
    $clinicId = $data['clinic_id'] ?? null;
    $date = $data['appointment_date'] ?? null;
    $sessionId = $data['session_id'] ?? null;
    if (!$doctorId || !$clinicId || !$date || !$sessionId) {
      json_response(['error' => 'Missing required booking details'], 400);
    }

    $pdo = Db::conn();
    self::ensurePaymentTable($pdo);
    $fee = self::getBookingFee($pdo);
    if ($fee <= 0) json_response(['error' => 'Booking fee is not enabled'], 400);

    $secret = getenv('STRIPE_SECRET_KEY');
    if (!$secret) json_response(['error' => 'Stripe not configured'], 500);

    $orderId = 'BOOK' . time() . $user['id'];
    $successBase = getenv('STRIPE_SUCCESS_URL') ?: (getenv('CLIENT_URL') ?: 'http://localhost:3001') . '/patient/book?stripe_order={ORDER_ID}';
    $successUrl = str_replace('{ORDER_ID}', $orderId, $successBase);
    $cancelUrl = getenv('STRIPE_CANCEL_URL') ?: (getenv('CLIENT_URL') ?: 'http://localhost:3001') . '/patient/book';

    $payload = [
      'doctor_id' => $doctorId,
      'clinic_id' => $clinicId,
      'appointment_date' => $date,
      'appointment_time' => $data['appointment_time'] ?? null,
      'reason_for_visit' => $data['reason_for_visit'] ?? null,
      'consultation_mode' => $data['consultation_mode'] ?? 'in_person',
      'session_id' => $sessionId,
      'priority_level' => $data['priority_level'] ?? 'normal'
    ];

    $postData = http_build_query([
      'mode' => 'payment',
      'success_url' => $successUrl,
      'cancel_url' => $cancelUrl,
      'client_reference_id' => $orderId,
      'customer_email' => $user['email'] ?? '',
      'line_items[0][price_data][currency]' => 'inr',
      'line_items[0][price_data][product_data][name]' => 'Appointment Booking Fee',
      'line_items[0][price_data][unit_amount]' => (int)round($fee * 100),
      'line_items[0][quantity]' => 1,
      'metadata[order_id]' => $orderId
    ]);

    $ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $secret, 'Content-Type: application/x-www-form-urlencoded']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    $resp = curl_exec($ch);
    if ($resp === false) json_response(['error' => 'Stripe initiation failed'], 500);
    $result = json_decode($resp, true);
    $sessionId = $result['id'] ?? null;
    $url = $result['url'] ?? null;
    if (!$sessionId || !$url) json_response(['error' => 'Stripe initiation failed'], 500);

    $stmt = $pdo->prepare("INSERT INTO payment_orders (order_id, user_id, amount, status, gateway, gateway_order_id, appointment_payload)
      VALUES (?, ?, ?, 'created', 'stripe', ?, ?)");
    $stmt->execute([$orderId, $user['id'], number_format($fee, 2, '.', ''), $sessionId, json_encode($payload)]);

    json_response([
      'order_id' => $orderId,
      'payment_url' => $url
    ]);
  }

  public static function stripeWebhook() {
    $secret = getenv('STRIPE_WEBHOOK_SECRET');
    if (!$secret) {
      http_response_code(500);
      echo "Webhook not configured";
      exit;
    }

    $payload = file_get_contents('php://input');
    $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
    $parts = explode(',', $sigHeader);
    $timestamp = null;
    $sig = null;
    foreach ($parts as $p) {
      if (strpos($p, 't=') === 0) $timestamp = substr($p, 2);
      if (strpos($p, 'v1=') === 0) $sig = substr($p, 3);
    }
    if (!$timestamp || !$sig) { http_response_code(400); exit; }
    $signed = $timestamp . '.' . $payload;
    $expected = hash_hmac('sha256', $signed, $secret);
    if (!hash_equals($expected, $sig)) { http_response_code(400); exit; }

    $event = json_decode($payload, true);
    if (($event['type'] ?? '') !== 'checkout.session.completed') { echo "OK"; exit; }

    $session = $event['data']['object'] ?? [];
    $orderId = $session['metadata']['order_id'] ?? $session['client_reference_id'] ?? null;
    if (!$orderId) { echo "OK"; exit; }

    $pdo = Db::conn();
    self::ensurePaymentTable($pdo);
    $stmt = $pdo->prepare("SELECT * FROM payment_orders WHERE order_id = ? AND gateway = 'stripe' LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();
    if (!$order) { echo "OK"; exit; }
    if ($order['status'] === 'paid') { echo "OK"; exit; }

    $payloadData = json_decode($order['appointment_payload'] ?? '{}', true);
    try {
      $booking = self::createAppointment($pdo, $payloadData, (int)$order['user_id'], $session['id'] ?? $orderId);
      $upd = $pdo->prepare("UPDATE payment_orders SET status = 'paid', appointment_id = ?, queue_number = ?, gateway_payment_id = ?, callback_payload = ? WHERE order_id = ?");
      $upd->execute([$booking['appointment_id'], $booking['queue_number'], $session['payment_intent'] ?? null, $payload, $orderId]);
      echo "OK";
    } catch (Exception $e) {
      echo "Error";
    }
  }

  public static function stripeStatus() {
    $user = auth_user();
    if (!$user) json_response(['error' => 'Unauthorized'], 401);
    if (($user['role'] ?? '') !== 'patient') json_response(['error' => 'Forbidden'], 403);
    $orderId = $_GET['order_id'] ?? null;
    if (!$orderId) json_response(['error' => 'order_id required'], 400);

    $pdo = Db::conn();
    self::ensurePaymentTable($pdo);
    $stmt = $pdo->prepare("SELECT order_id, status, appointment_id, queue_number FROM payment_orders WHERE order_id = ? AND user_id = ? LIMIT 1");
    $stmt->execute([$orderId, $user['id']]);
    $row = $stmt->fetch();
    if (!$row) json_response(['error' => 'Order not found'], 404);
    json_response($row);
  }
}
