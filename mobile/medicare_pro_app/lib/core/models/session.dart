class SessionSlot {
  final int sessionId;
  final String label;
  final String startTime;
  final String endTime;
  final int maxPatients;
  final int bookedCount;
  final bool isAvailable;

  SessionSlot({
    required this.sessionId,
    required this.label,
    required this.startTime,
    required this.endTime,
    required this.maxPatients,
    required this.bookedCount,
    required this.isAvailable,
  });

  factory SessionSlot.fromJson(Map<String, dynamic> json) => SessionSlot(
    sessionId: json['session_id'],
    label: json['label'] ?? 'Session',
    startTime: json['start_time'] ?? '',
    endTime: json['end_time'] ?? '',
    maxPatients: json['max_patients'] ?? 0,
    bookedCount: json['booked_count'] ?? 0,
    isAvailable: json['is_available'] ?? false,
  );
}
