class Appointment {
  final int id;
  final int? patientId;
  final int? doctorId;
  final String date;
  final String time;
  final int queueNumber;
  final String? doctorName;
  final String? patientName;
  final String? clinicName;
  final String? sessionLabel;
  final String? sessionStart;
  final String? sessionEnd;
  final String status;
  final String? priority;
  final String? consultationMode;
  final String? videoMeetingUrl;
  final String? videoProvider;

  Appointment({
    required this.id,
    this.patientId,
    this.doctorId,
    required this.date,
    required this.time,
    required this.queueNumber,
    required this.status,
    this.doctorName,
    this.patientName,
    this.clinicName,
    this.sessionLabel,
    this.sessionStart,
    this.sessionEnd,
    this.priority,
    this.consultationMode,
    this.videoMeetingUrl,
    this.videoProvider,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) => Appointment(
    id: json['id'],
    patientId: json['patient_id'],
    doctorId: json['doctor_id'],
    date: json['appointment_date'] ?? '',
    time: json['appointment_time'] ?? '',
    queueNumber: json['queue_number'] ?? 0,
    status: json['status'] ?? 'pending',
    doctorName: json['doctor_name'],
    patientName: json['patient_name'],
    clinicName: json['clinic_name'],
    sessionLabel: json['session_label'],
    sessionStart: json['session_start_time'],
    sessionEnd: json['session_end_time'],
    priority: json['priority_level'],
    consultationMode: json['consultation_mode'],
    videoMeetingUrl: json['video_meeting_url'],
    videoProvider: json['video_provider'],
  );
}
