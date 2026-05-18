class Doctor {
  final int id;
  final String name;
  final String? specialization;
  final String? clinicName;
  final int? clinicId;
  final String? city;
  final num? experienceYears;
  final num? consultationFee;

  Doctor({
    required this.id,
    required this.name,
    this.specialization,
    this.clinicName,
    this.clinicId,
    this.city,
    this.experienceYears,
    this.consultationFee,
  });

  factory Doctor.fromJson(Map<String, dynamic> json) => Doctor(
    id: json['id'],
    name: json['name'] ?? '',
    specialization: json['specialization'],
    clinicName: json['clinic_name'],
    clinicId: json['clinic_id'],
    city: json['city'],
    experienceYears: json['experience_years'],
    consultationFee: json['consultation_fee'],
  );
}
