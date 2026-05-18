class LabReport {
  final int id;
  final String title;
  final String filePath;
  final String patientName;
  final String doctorName;
  final String createdAt;
  final String? resultValue;
  final String? resultUnit;
  final String? resultFlag;
  final String? normalRange;
  final List<dynamic> summaryResults;

  LabReport({
    required this.id,
    required this.title,
    required this.filePath,
    required this.patientName,
    required this.doctorName,
    required this.createdAt,
    this.resultValue,
    this.resultUnit,
    this.resultFlag,
    this.normalRange,
    this.summaryResults = const [],
  });

  factory LabReport.fromJson(Map<String, dynamic> json) => LabReport(
    id: json['id'],
    title: json['report_title'] ?? 'Report',
    filePath: json['file_path'] ?? '',
    patientName: json['patient_name'] ?? '',
    doctorName: json['doctor_name'] ?? '',
    createdAt: json['created_at'] ?? '',
    resultValue: json['result_value']?.toString(),
    resultUnit: json['result_unit']?.toString(),
    resultFlag: json['result_flag']?.toString(),
    normalRange: json['normal_range_snapshot']?.toString() ?? json['normal_range']?.toString(),
    summaryResults: (json['summary_results'] as List?) ?? const [],
  );
}
