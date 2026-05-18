class Prescription {
  final int id;
  final String appointmentDate;
  final String doctorName;
  final String patientName;
  final String diagnosis;
  final String? notes;
  final List<PrescriptionMedicine> medicines;

  Prescription({
    required this.id,
    required this.appointmentDate,
    required this.doctorName,
    required this.patientName,
    required this.diagnosis,
    this.notes,
    required this.medicines,
  });

  factory Prescription.fromJson(Map<String, dynamic> json) => Prescription(
    id: json['id'],
    appointmentDate: json['appointment_date'] ?? '',
    doctorName: json['doctor_name'] ?? '',
    patientName: json['patient_name'] ?? '',
    diagnosis: json['diagnosis'] ?? '',
    notes: json['notes'],
    medicines: (json['medicines'] as List? ?? []).map((m) => PrescriptionMedicine.fromJson(m)).toList(),
  );
}

class PrescriptionMedicine {
  final String name;
  final String? dosage;
  final String? frequency;
  final int? durationDays;
  final int? quantity;
  final bool beforeFood;

  PrescriptionMedicine({
    required this.name,
    this.dosage,
    this.frequency,
    this.durationDays,
    this.quantity,
    required this.beforeFood,
  });

  factory PrescriptionMedicine.fromJson(Map<String, dynamic> json) => PrescriptionMedicine(
    name: json['medicine_name'] ?? '',
    dosage: json['dosage'],
    frequency: json['frequency'],
    durationDays: json['duration_days'],
    quantity: json['quantity'],
    beforeFood: (json['before_food'] ?? 0) == 1,
  );
}
