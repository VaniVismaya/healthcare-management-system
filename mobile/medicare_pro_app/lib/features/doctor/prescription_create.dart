import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/services/draft_store.dart';

class DoctorPrescriptionCreatePage extends StatefulWidget {
  const DoctorPrescriptionCreatePage({super.key});

  @override
  State<DoctorPrescriptionCreatePage> createState() => _DoctorPrescriptionCreatePageState();
}

class _DoctorPrescriptionCreatePageState extends State<DoctorPrescriptionCreatePage> {
  static const _draftKey = 'mobile_doctor_prescription_draft';

  List<dynamic> _appointments = [];
  List<dynamic> _pharmacies = [];
  int? _appointmentId;
  int? _pharmacistId;
  final _diagnosisCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final _followCtrl = TextEditingController();
  final List<Map<String, dynamic>> _meds = [];
  bool _loading = false;

  Future<void> _loadAppointments() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/appointments', auth: true);
      setState(() => _appointments = data['appointments'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadPharmacies() async {
    try {
      final data = await ApiClient.instance.get('/api/pharmacies', auth: true);
      if (mounted) setState(() => _pharmacies = data['pharmacies'] ?? []);
    } catch (_) {}
  }

  Future<void> _restoreDraft() async {
    final draft = await DraftStore.load(_draftKey);
    if (draft == null || !mounted) return;
    setState(() {
      _appointmentId = draft['appointment_id'] as int?;
      _pharmacistId = draft['pharmacist_id'] as int?;
      _diagnosisCtrl.text = draft['diagnosis']?.toString() ?? '';
      _notesCtrl.text = draft['notes']?.toString() ?? '';
      _followCtrl.text = draft['follow_up_date']?.toString() ?? '';
      _meds
        ..clear()
        ..addAll(((draft['medicines'] as List?) ?? []).map((m) => (m as Map).cast<String, dynamic>()));
    });
  }

  Future<void> _saveDraft() {
    return DraftStore.save(_draftKey, {
      'appointment_id': _appointmentId,
      'pharmacist_id': _pharmacistId,
      'diagnosis': _diagnosisCtrl.text.trim(),
      'notes': _notesCtrl.text.trim(),
      'follow_up_date': _followCtrl.text.trim(),
      'medicines': _meds,
    });
  }

  void _addMedicineRow() {
    setState(() => _meds.add({
          'medicine_name': '',
          'dosage': '',
          'frequency': '1-0-1',
          'duration_days': 5,
          'quantity': 10,
          'before_food': false,
        }));
    _saveDraft();
  }

  Future<void> _submit() async {
    if (_appointmentId == null) return;
    if (_diagnosisCtrl.text.trim().isEmpty) return;
    if (_meds.isEmpty) return;

    try {
      final data = await ApiClient.instance.post('/api/prescriptions', {
        'appointment_id': _appointmentId,
        'pharmacist_id': _pharmacistId,
        'diagnosis': _diagnosisCtrl.text.trim(),
        'notes': _notesCtrl.text.trim(),
        'follow_up_date': _followCtrl.text.trim().isEmpty ? null : _followCtrl.text.trim(),
        'medicines': _meds,
      }, auth: true);
      await DraftStore.clear(_draftKey);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(data['offlineQueued'] == true ? 'Prescription saved offline and queued for sync' : 'Prescription created')),
      );
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Create failed: $e')));
    }
  }

  @override
  void initState() {
    super.initState();
    _loadAppointments();
    _loadPharmacies();
    _restoreDraft();
    _diagnosisCtrl.addListener(_saveDraft);
    _notesCtrl.addListener(_saveDraft);
    _followCtrl.addListener(_saveDraft);
  }

  @override
  void dispose() {
    _diagnosisCtrl.removeListener(_saveDraft);
    _notesCtrl.removeListener(_saveDraft);
    _followCtrl.removeListener(_saveDraft);
    _diagnosisCtrl.dispose();
    _notesCtrl.dispose();
    _followCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Prescription')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DropdownButton<int>(
                      value: _appointmentId,
                      hint: const Text('Select Appointment'),
                      items: _appointments.map<DropdownMenuItem<int>>((a) {
                        return DropdownMenuItem<int>(
                          value: a['id'],
                          child: Text('${a['patient_name']} • ${a['appointment_date']}'),
                        );
                      }).toList(),
                      onChanged: (v) {
                        setState(() => _appointmentId = v);
                        _saveDraft();
                      },
                    ),
                    DropdownButton<int>(
                      value: _pharmacistId,
                      hint: const Text('Select Pharmacy'),
                      items: _pharmacies.map<DropdownMenuItem<int>>((p) {
                        final name = p['pharmacy_name'] ?? 'Pharmacy';
                        final city = p['city'] ?? '';
                        return DropdownMenuItem<int>(
                          value: p['user_id'],
                          child: Text('$name${city.toString().isNotEmpty ? ' • $city' : ''}'),
                        );
                      }).toList(),
                      onChanged: (v) {
                        setState(() => _pharmacistId = v);
                        _saveDraft();
                      },
                    ),
                    TextField(controller: _diagnosisCtrl, decoration: const InputDecoration(labelText: 'Diagnosis')),
                    TextField(controller: _notesCtrl, decoration: const InputDecoration(labelText: 'Notes')),
                    TextField(controller: _followCtrl, decoration: const InputDecoration(labelText: 'Follow-up Date (YYYY-MM-DD)')),
                    const SizedBox(height: 6),
                    const Text(
                      'Draft auto-saves on this device while you work offline.',
                      style: TextStyle(fontSize: 12, color: Colors.black54),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Text('Medicines', style: TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(width: 12),
                        TextButton(onPressed: _addMedicineRow, child: const Text('Add')),
                      ],
                    ),
                    ..._meds.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final m = entry.value;
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(8),
                          child: Column(
                            children: [
                              TextFormField(
                                initialValue: m['medicine_name']?.toString() ?? '',
                                decoration: const InputDecoration(labelText: 'Medicine Name'),
                                onChanged: (v) {
                                  m['medicine_name'] = v;
                                  _saveDraft();
                                },
                              ),
                              TextFormField(
                                initialValue: m['dosage']?.toString() ?? '',
                                decoration: const InputDecoration(labelText: 'Dosage'),
                                onChanged: (v) {
                                  m['dosage'] = v;
                                  _saveDraft();
                                },
                              ),
                              TextFormField(
                                initialValue: m['frequency']?.toString() ?? '1-0-1',
                                decoration: const InputDecoration(labelText: 'Frequency (1-0-1)'),
                                onChanged: (v) {
                                  m['frequency'] = v;
                                  _saveDraft();
                                },
                              ),
                              TextFormField(
                                initialValue: '${m['duration_days'] ?? 5}',
                                decoration: const InputDecoration(labelText: 'Days'),
                                keyboardType: TextInputType.number,
                                onChanged: (v) {
                                  m['duration_days'] = int.tryParse(v) ?? 0;
                                  _saveDraft();
                                },
                              ),
                              TextFormField(
                                initialValue: '${m['quantity'] ?? 10}',
                                decoration: const InputDecoration(labelText: 'Quantity'),
                                keyboardType: TextInputType.number,
                                onChanged: (v) {
                                  m['quantity'] = int.tryParse(v) ?? 0;
                                  _saveDraft();
                                },
                              ),
                              SwitchListTile(
                                value: m['before_food'] ?? false,
                                onChanged: (v) {
                                  setState(() => m['before_food'] = v);
                                  _saveDraft();
                                },
                                title: const Text('Before Food'),
                              ),
                              TextButton(
                                onPressed: () {
                                  setState(() => _meds.removeAt(idx));
                                  _saveDraft();
                                },
                                child: const Text('Remove'),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                    const SizedBox(height: 12),
                    ElevatedButton(onPressed: _submit, child: const Text('Create Prescription')),
                  ],
                ),
              ),
            ),
    );
  }
}
