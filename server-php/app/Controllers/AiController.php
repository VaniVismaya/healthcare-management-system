<?php
require_once __DIR__ . '/../Services/Db.php';
require_once __DIR__ . '/../Services/Helpers.php';

class AiController {
  public static function suggest() {
    $data = get_json_body();
    $symptoms = strtolower(trim($data['symptoms'] ?? ''));
    if ($symptoms === '') {
      json_response(['error' => 'symptoms required'], 400);
    }

    $map = [
      'Cardiology' => ['chest', 'heart', 'bp', 'pressure', 'palpitations', 'cardio'],
      'Dermatology' => ['skin', 'rash', 'itch', 'acne', 'eczema'],
      'Orthopedics' => ['bone', 'joint', 'knee', 'back', 'fracture', 'sprain'],
      'Pediatrics' => ['child', 'baby', 'infant', 'toddler'],
      'ENT' => ['ear', 'nose', 'throat', 'sinus', 'tonsil'],
      'Gastroenterology' => ['stomach', 'abdomen', 'nausea', 'vomit', 'diarrhea', 'constipation'],
      'Neurology' => ['headache', 'migraine', 'dizzy', 'vision', 'seizure', 'numb'],
      'Gynecology' => ['pregnant', 'period', 'menstrual', 'pcos', 'gynec'],
      'General Physician' => ['fever', 'cold', 'cough', 'body pain', 'sore throat', 'fatigue']
    ];

    $best = 'General Physician';
    $bestScore = 0;
    foreach ($map as $spec => $keywords) {
      $score = 0;
      foreach ($keywords as $kw) {
        if (strpos($symptoms, $kw) !== false) $score++;
      }
      if ($score > $bestScore) {
        $bestScore = $score;
        $best = $spec;
      }
    }

    $pdo = Db::conn();
    $like = '%' . $best . '%';
    $stmt = $pdo->prepare(
      "SELECT u.id, u.name, dp.specialization, dp.experience_years, dp.consultation_fee,
              c.id as clinic_id, c.name as clinic_name, c.city
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       LEFT JOIN clinics c ON dp.clinic_id = c.id
       WHERE (u.role = 'doctor' OR r.name = 'doctor')
         AND dp.specialization LIKE ?
       ORDER BY dp.experience_years DESC
       LIMIT 5"
    );
    $stmt->execute([$like]);
    $doctors = $stmt->fetchAll();

    if (!$doctors) {
      $stmt = $pdo->prepare(
        "SELECT u.id, u.name, dp.specialization, dp.experience_years, dp.consultation_fee,
                c.id as clinic_id, c.name as clinic_name, c.city
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
         LEFT JOIN clinics c ON dp.clinic_id = c.id
         WHERE (u.role = 'doctor' OR r.name = 'doctor')
         ORDER BY dp.experience_years DESC
         LIMIT 5"
      );
      $stmt->execute();
      $doctors = $stmt->fetchAll();
    }

    $next = "Recommended specialist: $best. You can book an appointment below.";
    json_response([
      'recommended_specialization' => $best,
      'message' => $next,
      'doctors' => $doctors
    ]);
  }
}
