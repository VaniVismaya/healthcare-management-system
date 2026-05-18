import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/services/draft_store.dart';

class LabReportUploadPage extends StatefulWidget {
  const LabReportUploadPage({super.key});

  @override
  State<LabReportUploadPage> createState() => _LabReportUploadPageState();
}

class _LabReportUploadPageState extends State<LabReportUploadPage> {
  static const _draftKey = 'mobile_lab_report_draft';

  List<dynamic> _orders = [];
  int? _orderId;
  int? _testId;
  final _titleCtrl = TextEditingController();
  final _fileCtrl = TextEditingController();
  final _valueCtrl = TextEditingController();
  final _unitCtrl = TextEditingController();
  final List<Map<String, dynamic>> _summary = [];
  bool _loading = false;

  Future<void> _loadOrders() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/lab/orders', auth: true);
      if (mounted) setState(() => _orders = data['orders'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _restoreDraft() async {
    final draft = await DraftStore.load(_draftKey);
    if (draft == null || !mounted) return;
    setState(() {
      _orderId = draft['order_id'] as int?;
      _testId = draft['test_id'] as int?;
      _titleCtrl.text = draft['report_title']?.toString() ?? '';
      _fileCtrl.text = draft['file_path']?.toString() ?? '';
      _valueCtrl.text = draft['result_value']?.toString() ?? '';
      _unitCtrl.text = draft['result_unit']?.toString() ?? '';
      _summary
        ..clear()
        ..addAll(((draft['summary'] as List?) ?? []).map((item) => (item as Map).cast<String, dynamic>()));
    });
  }

  Future<void> _saveDraft() {
    return DraftStore.save(_draftKey, {
      'order_id': _orderId,
      'test_id': _testId,
      'report_title': _titleCtrl.text.trim(),
      'file_path': _fileCtrl.text.trim(),
      'result_value': _valueCtrl.text.trim(),
      'result_unit': _unitCtrl.text.trim(),
      'summary': _summary,
    });
  }

  Future<void> _submit() async {
    if (_orderId == null) return;
    try {
      final summary = _summary
          .where((r) =>
              (r['test_id'] != null && r['test_id'].toString().isNotEmpty) ||
              (r['result_name'] != null && r['result_name'].toString().isNotEmpty) ||
              (r['result_value'] != null && r['result_value'].toString().isNotEmpty))
          .toList();
      final data = await ApiClient.instance.post('/api/lab/reports', {
        'lab_order_id': _orderId,
        'test_id': _testId,
        'report_title': _titleCtrl.text.trim().isEmpty ? 'Lab Report' : _titleCtrl.text.trim(),
        'file_path': _fileCtrl.text.trim(),
        'result_value': _valueCtrl.text.trim(),
        'result_unit': _unitCtrl.text.trim(),
        'summary_results': summary,
      }, auth: true);
      await DraftStore.clear(_draftKey);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(data['offlineQueued'] == true ? 'Report draft saved offline and queued for sync' : 'Report uploaded')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
    }
  }

  List<dynamic> get _selectedOrderTests {
    final selected = _orders.cast<Map?>().firstWhere((o) => o?['id'] == _orderId, orElse: () => null);
    if (selected == null) return [];
    return selected['test_items'] as List? ?? [];
  }

  @override
  void initState() {
    super.initState();
    _loadOrders();
    _restoreDraft();
    _titleCtrl.addListener(_saveDraft);
    _fileCtrl.addListener(_saveDraft);
    _valueCtrl.addListener(_saveDraft);
    _unitCtrl.addListener(_saveDraft);
  }

  @override
  void dispose() {
    _titleCtrl.removeListener(_saveDraft);
    _fileCtrl.removeListener(_saveDraft);
    _valueCtrl.removeListener(_saveDraft);
    _unitCtrl.removeListener(_saveDraft);
    _titleCtrl.dispose();
    _fileCtrl.dispose();
    _valueCtrl.dispose();
    _unitCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tests = _selectedOrderTests;
    return Scaffold(
      appBar: AppBar(title: const Text('Upload Lab Report')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: ListView(
                children: [
                  DropdownButton<int>(
                    value: _orderId,
                    hint: const Text('Select Lab Order'),
                    items: _orders.map<DropdownMenuItem<int>>((o) {
                      return DropdownMenuItem<int>(
                        value: o['id'],
                        child: Text('${o['patient_name']} - ${o['created_at']}'),
                      );
                    }).toList(),
                    onChanged: (v) {
                      final selected = _orders.firstWhere((o) => o['id'] == v, orElse: () => null);
                      final selectedTests = selected is Map ? (selected['test_items'] as List? ?? []) : [];
                      setState(() {
                        _orderId = v;
                        _testId = selectedTests.isNotEmpty ? (selectedTests[0]['test_id'] as int?) : null;
                        _summary.clear();
                      });
                      _saveDraft();
                    },
                  ),
                  if (_orderId != null)
                    DropdownButton<int>(
                      value: _testId,
                      hint: const Text('Select Test (optional)'),
                      items: tests.map<DropdownMenuItem<int>>((t) {
                        return DropdownMenuItem<int>(
                          value: t['test_id'],
                          child: Text(t['test_name'] ?? 'Test'),
                        );
                      }).toList(),
                      onChanged: (v) {
                        setState(() => _testId = v);
                        _saveDraft();
                      },
                    ),
                  TextField(controller: _titleCtrl, decoration: const InputDecoration(labelText: 'Report Title')),
                  TextField(controller: _fileCtrl, decoration: const InputDecoration(labelText: 'File URL / Path')),
                  TextField(controller: _valueCtrl, decoration: const InputDecoration(labelText: 'Result Value')),
                  TextField(controller: _unitCtrl, decoration: const InputDecoration(labelText: 'Unit')),
                  const SizedBox(height: 6),
                  const Text(
                    'Draft values auto-save on this device. If you use a real file upload later, attach the file again after reconnecting.',
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Key Result Summary (optional)'),
                      TextButton(
                        onPressed: () {
                          if (_summary.length >= 5) return;
                          setState(() {
                            _summary.add({
                              'test_id': null,
                              'result_name': '',
                              'result_value': '',
                              'result_unit': '',
                              'normal_range': ''
                            });
                          });
                          _saveDraft();
                        },
                        child: const Text('Add Result'),
                      ),
                    ],
                  ),
                  if (_summary.isNotEmpty)
                    SizedBox(
                      height: 260,
                      child: ListView.builder(
                        itemCount: _summary.length,
                        itemBuilder: (_, i) {
                          final row = _summary[i];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: Padding(
                              padding: const EdgeInsets.all(8),
                              child: Column(
                                children: [
                                  DropdownButtonFormField<int>(
                                    value: row['test_id'],
                                    items: tests.map<DropdownMenuItem<int>>((t) {
                                      return DropdownMenuItem<int>(
                                        value: t['test_id'],
                                        child: Text(t['test_name'] ?? 'Test'),
                                      );
                                    }).toList(),
                                    onChanged: (v) {
                                      final selected = tests.firstWhere((t) => t['test_id'] == v, orElse: () => null);
                                      setState(() {
                                        row['test_id'] = v;
                                        row['result_name'] = selected is Map ? (selected['test_name'] ?? row['result_name']) : row['result_name'];
                                        row['normal_range'] = selected is Map ? (selected['normal_range'] ?? row['normal_range']) : row['normal_range'];
                                      });
                                      _saveDraft();
                                    },
                                    decoration: const InputDecoration(labelText: 'Test (optional)'),
                                  ),
                                  TextFormField(
                                    initialValue: row['result_name']?.toString() ?? '',
                                    decoration: const InputDecoration(labelText: 'Result Name'),
                                    onChanged: (v) {
                                      row['result_name'] = v;
                                      _saveDraft();
                                    },
                                  ),
                                  TextFormField(
                                    initialValue: row['result_value']?.toString() ?? '',
                                    decoration: const InputDecoration(labelText: 'Value'),
                                    onChanged: (v) {
                                      row['result_value'] = v;
                                      _saveDraft();
                                    },
                                  ),
                                  TextFormField(
                                    initialValue: row['result_unit']?.toString() ?? '',
                                    decoration: const InputDecoration(labelText: 'Unit'),
                                    onChanged: (v) {
                                      row['result_unit'] = v;
                                      _saveDraft();
                                    },
                                  ),
                                  TextFormField(
                                    initialValue: row['normal_range']?.toString() ?? '',
                                    decoration: const InputDecoration(labelText: 'Normal Range'),
                                    onChanged: (v) {
                                      row['normal_range'] = v;
                                      _saveDraft();
                                    },
                                  ),
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: TextButton(
                                      onPressed: () {
                                        setState(() => _summary.removeAt(i));
                                        _saveDraft();
                                      },
                                      child: const Text('Remove'),
                                    ),
                                  )
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: _submit, child: const Text('Upload')),
                ],
              ),
            ),
    );
  }
}

