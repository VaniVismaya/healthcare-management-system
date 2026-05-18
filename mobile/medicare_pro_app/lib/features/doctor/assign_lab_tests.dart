import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/services/draft_store.dart';

const _assignLabDraftKey = 'assign_lab_tests_mobile_draft';

class AssignLabTestsPage extends StatefulWidget {
  final int? appointmentId;
  const AssignLabTestsPage({super.key, this.appointmentId});

  @override
  State<AssignLabTestsPage> createState() => _AssignLabTestsPageState();
}

class _AssignLabTestsPageState extends State<AssignLabTestsPage> {
  List<dynamic> _labs = [];
  List<dynamic> _tests = [];
  int? _labId;
  List<int> _selectedTests = [];
  bool _loading = false;
  bool _hydratingDraft = false;
  bool _collectionRequired = false;
  final _collectionDateCtrl = TextEditingController();
  final _collectionTimeCtrl = TextEditingController();
  final _collectionAddressCtrl = TextEditingController();
  final _collectionNotesCtrl = TextEditingController();

  Future<void> _saveDraft() async {
    if (_hydratingDraft) return;
    await DraftStore.save(_assignLabDraftKey, {
      'appointment_id': widget.appointmentId,
      'laboratory_id': _labId,
      'selected_tests': _selectedTests,
      'collection_required': _collectionRequired,
      'collection_date': _collectionDateCtrl.text.trim(),
      'collection_time': _collectionTimeCtrl.text.trim(),
      'collection_address': _collectionAddressCtrl.text.trim(),
      'collection_notes': _collectionNotesCtrl.text.trim(),
    });
  }

  Future<void> _restoreDraft() async {
    final draft = await DraftStore.load(_assignLabDraftKey);
    if (draft == null) return;
    if (draft['appointment_id'] != widget.appointmentId) return;

    _hydratingDraft = true;
    _labId = draft['laboratory_id'] is int
        ? draft['laboratory_id'] as int
        : int.tryParse('${draft['laboratory_id']}');
    _selectedTests = ((draft['selected_tests'] as List?) ?? [])
        .map((item) => item is int ? item : int.tryParse('$item'))
        .whereType<int>()
        .toList();
    _collectionRequired = draft['collection_required'] == true;
    _collectionDateCtrl.text = draft['collection_date']?.toString() ?? '';
    _collectionTimeCtrl.text = draft['collection_time']?.toString() ?? '';
    _collectionAddressCtrl.text =
        draft['collection_address']?.toString() ?? '';
    _collectionNotesCtrl.text = draft['collection_notes']?.toString() ?? '';
    _hydratingDraft = false;
  }

  Future<void> _loadLabs() async {
    setState(() => _loading = true);
    try {
      await _restoreDraft();
      final data = await ApiClient.instance.get('/api/labs', auth: true);
      setState(() => _labs = data['labs'] ?? []);
      if (_labId != null) {
        await _loadTests(_labId!);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load labs failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadTests(int labId) async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get(
        '/api/lab/tests',
        params: {'lab_id': labId.toString()},
      );
      setState(() => _tests = data['tests'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load tests failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (widget.appointmentId == null) return;
    if (_labId == null || _selectedTests.isEmpty) return;
    try {
      final res = await ApiClient.instance.post('/api/lab/orders', {
        'appointment_id': widget.appointmentId,
        'laboratory_id': _labId,
        'test_ids': _selectedTests,
        'collection_required': _collectionRequired,
        'collection_date': _collectionDateCtrl.text.trim(),
        'collection_time': _collectionTimeCtrl.text.trim(),
        'collection_address': _collectionAddressCtrl.text.trim(),
        'collection_notes': _collectionNotesCtrl.text.trim(),
      }, auth: true);
      await DraftStore.clear(_assignLabDraftKey);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            res['offlineQueued'] == true
                ? 'Lab order saved offline and queued for sync.'
                : 'Lab order created',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Assign failed: $e')));
    }
  }

  @override
  void initState() {
    super.initState();
    _collectionDateCtrl.addListener(_saveDraft);
    _collectionTimeCtrl.addListener(_saveDraft);
    _collectionAddressCtrl.addListener(_saveDraft);
    _collectionNotesCtrl.addListener(_saveDraft);
    _loadLabs();
  }

  @override
  void dispose() {
    _collectionDateCtrl.dispose();
    _collectionTimeCtrl.dispose();
    _collectionAddressCtrl.dispose();
    _collectionNotesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Assign Lab Tests')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Lab order details stay saved on this device while offline and sync when internet returns.',
                  ),
                  const SizedBox(height: 12),
                  const Text('Select Laboratory'),
                  DropdownButton<int>(
                    value: _labId,
                    hint: const Text('Choose lab'),
                    items: _labs.map<DropdownMenuItem<int>>((lab) {
                      return DropdownMenuItem<int>(
                        value: lab['id'],
                        child: Text(lab['lab_name'] ?? lab['name'] ?? 'Lab'),
                      );
                    }).toList(),
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        _labId = value;
                        _selectedTests = [];
                        _tests = [];
                      });
                      _saveDraft();
                      _loadTests(value);
                    },
                  ),
                  const SizedBox(height: 12),
                  const Text('Select Tests'),
                  Expanded(
                    child: ListView(
                      children: _tests.map((test) {
                        final id = test['id'] as int;
                        final selected = _selectedTests.contains(id);
                        return CheckboxListTile(
                          value: selected,
                          onChanged: (value) {
                            setState(() {
                              if (value == true) {
                                _selectedTests.add(id);
                              } else {
                                _selectedTests.remove(id);
                              }
                            });
                            _saveDraft();
                          },
                          title: Text(test['test_name'] ?? 'Test'),
                          subtitle:
                              Text('INR ${test['discounted_price'] ?? test['price']}'),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Checkbox(
                        value: _collectionRequired,
                        onChanged: (value) {
                          setState(
                            () => _collectionRequired = value ?? false,
                          );
                          _saveDraft();
                        },
                      ),
                      const Text('Home sample collection'),
                    ],
                  ),
                  if (_collectionRequired) ...[
                    TextField(
                      controller: _collectionDateCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Collection Date (YYYY-MM-DD)',
                      ),
                    ),
                    TextField(
                      controller: _collectionTimeCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Collection Time (HH:MM)',
                      ),
                    ),
                    TextField(
                      controller: _collectionAddressCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Collection Address'),
                    ),
                    TextField(
                      controller: _collectionNotesCtrl,
                      decoration: const InputDecoration(labelText: 'Notes'),
                    ),
                  ],
                  ElevatedButton(
                    onPressed: _submit,
                    child: const Text('Assign Tests'),
                  ),
                ],
              ),
            ),
    );
  }
}
