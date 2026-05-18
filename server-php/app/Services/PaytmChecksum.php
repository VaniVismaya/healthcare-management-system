<?php
class PaytmChecksum {
  private static $iv = "@@@@&&&&####$$$$";

  public static function encrypt($input, $key) {
    $key = html_entity_decode($key);
    $output = openssl_encrypt($input, "AES-128-CBC", $key, 0, self::$iv);
    return $output;
  }

  public static function decrypt($input, $key) {
    $key = html_entity_decode($key);
    $output = openssl_decrypt($input, "AES-128-CBC", $key, 0, self::$iv);
    return $output;
  }

  public static function generateSignature($params, $key) {
    if (!is_array($params) && !is_string($params)) {
      return null;
    }
    if (is_array($params)) {
      $params = self::getParamsString($params);
    }
    return self::generateSignatureByString($params, $key);
  }

  public static function verifySignature($params, $key, $checksum) {
    if (!is_array($params) && !is_string($params)) {
      return false;
    }
    if (is_array($params)) {
      $params = self::getParamsString($params);
    }
    $paytm_hash = self::generateSignatureByString($params, $key);
    return $paytm_hash === $checksum;
  }

  private static function generateSignatureByString($params, $key) {
    $salt = self::generateRandomString(4);
    return self::calculateChecksum($params, $key, $salt);
  }

  private static function calculateChecksum($params, $key, $salt) {
    $finalString = $params . "|" . $salt;
    $hash = hash("sha256", $finalString);
    $hashString = $hash . $salt;
    $checksum = self::encrypt($hashString, $key);
    return $checksum;
  }

  private static function getParamsString($params) {
    ksort($params);
    $paramsToString = [];
    foreach ($params as $key => $value) {
      if (is_array($value)) continue;
      $paramsToString[] = $value === "null" ? "" : $value;
    }
    return implode("|", $paramsToString);
  }

  private static function generateRandomString($length) {
    $random = "";
    $data = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    $dataLength = strlen($data);
    for ($i = 0; $i < $length; $i++) {
      $random .= $data[random_int(0, $dataLength - 1)];
    }
    return $random;
  }
}
