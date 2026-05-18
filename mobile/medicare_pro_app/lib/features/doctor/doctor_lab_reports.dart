import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';

class DoctorLabReportsPage extends StatefulWidget {
  const DoctorLabReportsPage({super.key});

  @override
  State<DoctorLabReportsPage> createState() => _DoctorLabReportsPageState();
}

class _DoctorLabReportsPageState extends State<DoctorLabReportsPage> {
  List<dynamic> _items = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/lab/reports', auth: true);
      setState(() => _items = data['reports'] ?? []);
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

  Future<void> _openReport(Map<String, dynamic> report) async {
    final filePath = report['file_path']?.toString() ?? report['report_file_path']?.toString() ?? '';
    if (filePath.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Report file not available')));
      return;
    }
    final base = ApiClient.instance.baseUrl;
    final url = filePath.startsWith('http')
        ? filePath
        : '${base.replaceAll(RegExp(r"/+$"), "")}/${filePath.replaceFirst(RegExp(r"^/+"), "")}';
    final uri = Uri.tryParse(url);
    if (uri == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Invalid report URL')));
      return;
    }
    await launchUrl(uri, mode: LaunchMode.inAppWebView);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lab Reports')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items.length,
              itemBuilder: (_, i) {
                final r = (_items[i] as Map?)?.cast<String, dynamic>() ?? {};
                final patient = r['patient_name'] ?? 'Patient';
                final title = r['report_title'] ?? 'Report';
                final created = r['created_at'] ?? '';
                final flag = r['result_flag']?.toString() ?? '';
                final value = r['result_value']?.toString() ?? '';
                final unit = r['result_unit']?.toString() ?? '';
                final summaryList = (r['summary_results'] as List?) ?? [];
                final summary = summaryList.map((s) {
                  final name = s['result_name'] ?? s['test_name'] ?? 'Result';
                  final val = s['result_value'] != null ? '${s['result_value']}${s['result_unit'] != null ? ' ${s['result_unit']}' : ''}' : '';
                  final f = s['result_flag'] != null ? '(${s['result_flag']})' : '';
                  return [name, val, f].where((e) => e.toString().isNotEmpty).join(' ');
                }).where((e) => e.toString().isNotEmpty).toList();
                final meta = [
                  patient,
                  if (flag.isNotEmpty) 'Flag: $flag',
                  if (value.isNotEmpty) 'Value: $value${unit.isNotEmpty ? ' $unit' : ''}',
                ].join(' - ');
                return ListTile(
                  title: Text(title),
                  subtitle: Text('${meta.isNotEmpty ? meta : 'Report'}${summary.isNotEmpty ? '\n${summary.take(2).join(' • ')}' : ''}\n$created'),
                  isThreeLine: true,
                  trailing: const Icon(Icons.picture_as_pdf),
                  onTap: () => _openReport(r),
                );
              },
            ),
    );
  }
}





