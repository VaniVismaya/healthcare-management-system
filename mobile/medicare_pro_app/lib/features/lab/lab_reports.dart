import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class LabReportsPage extends StatefulWidget {
  const LabReportsPage({super.key});

  @override
  State<LabReportsPage> createState() => _LabReportsPageState();
}

class _LabReportsPageState extends State<LabReportsPage> {
  List<dynamic> _reports = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/lab/reports', auth: true);
      setState(() => _reports = data['reports'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
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
          : _reports.isEmpty
              ? const Center(child: Text('No reports yet'))
              : ListView.builder(
                  itemCount: _reports.length,
                  itemBuilder: (_, i) {
                    final r = (_reports[i] as Map?)?.cast<String, dynamic>() ?? {};
                    final title = r['report_title'] ?? 'Report';
                    final patient = r['patient_name'] ?? 'Patient';
                    final file = r['file_path'] ?? '';
                    final flag = r['result_flag']?.toString() ?? '';
                    final value = r['result_value']?.toString() ?? '';
                    final unit = r['result_unit']?.toString() ?? '';
                    final subtitle = [
                      'Patient: $patient',
                      if (flag.isNotEmpty) 'Flag: $flag',
                      if (value.isNotEmpty) 'Value: $value${unit.isNotEmpty ? ' $unit' : ''}',
                    ].join(' - ');
                    return ListTile(
                      title: Text(title),
                      subtitle: Text(subtitle),
                      trailing: file.toString().isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.visibility),
                              onPressed: () {
                                showDialog(
                                  context: context,
                                  builder: (_) => AlertDialog(
                                    title: const Text('Report File'),
                                    content: Text(file),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(context),
                                        child: const Text('Close'),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            )
                          : null,
                    );
                  },
                ),
    );
  }
}


