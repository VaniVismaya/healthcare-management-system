import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/models/lab_report.dart';

class PatientLabReportsPage extends StatefulWidget {
  const PatientLabReportsPage({super.key});

  @override
  State<PatientLabReportsPage> createState() => _PatientLabReportsPageState();
}

class _PatientLabReportsPageState extends State<PatientLabReportsPage> {
  List<LabReport> _reports = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/lab/reports', auth: true);
      final list = (data['reports'] as List).map((e) => LabReport.fromJson(e)).toList();
      setState(() => _reports = list);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lab Reports')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _reports.length,
              itemBuilder: (_, i) {
                final r = _reports[i];
                final flag = r.resultFlag ?? '';
                final value = r.resultValue ?? '';
                final unit = r.resultUnit ?? '';
                final summary = r.summaryResults.map((s) {
                  final name = s['result_name'] ?? s['test_name'] ?? 'Result';
                  final val = s['result_value'] != null ? '${s['result_value']}${s['result_unit'] != null ? ' ${s['result_unit']}' : ''}' : '';
                  final f = s['result_flag'] != null ? '(${s['result_flag']})' : '';
                  return [name, val, f].where((e) => e.toString().isNotEmpty).join(' ');
                }).where((e) => e.toString().isNotEmpty).toList();
                return ListTile(
                  title: Text(r.title),
                  subtitle: Text(
                    'Doctor: ${r.doctorName}${flag.isNotEmpty ? ' - $flag' : ''}'
                    '${summary.isNotEmpty ? '\n${summary.take(2).join(' • ')}' : ''}',
                  ),
                  trailing: value.isNotEmpty ? Text('$value${unit.isNotEmpty ? ' $unit' : ''}') : null,
                  isThreeLine: summary.isNotEmpty,
                );
              },
            ),
    );
  }
}
