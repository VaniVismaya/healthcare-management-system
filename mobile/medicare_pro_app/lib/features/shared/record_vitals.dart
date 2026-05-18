import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class RecordVitalsPage extends StatefulWidget {
  final int appointmentId;
  final int patientId;
  const RecordVitalsPage({
    super.key,
    required this.appointmentId,
    required this.patientId,
  });

  @override
  State<RecordVitalsPage> createState() => _RecordVitalsPageState();
}

class _RecordVitalsPageState extends State<RecordVitalsPage> {
  final _bpCtrl = TextEditingController();
  final _pulseCtrl = TextEditingController();
  final _tempCtrl = TextEditingController();
  final _weightCtrl = TextEditingController();
  final _heightCtrl = TextEditingController();
  final _spo2Ctrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final payload = {
        'appointment_id': widget.appointmentId,
        'patient_id': widget.patientId,
        'blood_pressure': _bpCtrl.text.trim().isEmpty ? null : _bpCtrl.text.trim(),
        'pulse_rate': int.tryParse(_pulseCtrl.text.trim()),
        'temperature': double.tryParse(_tempCtrl.text.trim()),
        'weight': double.tryParse(_weightCtrl.text.trim()),
        'height': double.tryParse(_heightCtrl.text.trim()),
        'oxygen_saturation': int.tryParse(_spo2Ctrl.text.trim()),
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      };
      await ApiClient.instance.post('/api/vitals', payload, auth: true);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Vitals saved')));
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Save failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _bpCtrl.dispose();
    _pulseCtrl.dispose();
    _tempCtrl.dispose();
    _weightCtrl.dispose();
    _heightCtrl.dispose();
    _spo2Ctrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Record Vitals')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _bpCtrl,
              decoration: const InputDecoration(labelText: 'Blood Pressure (e.g., 120/80)'),
            ),
            TextField(
              controller: _pulseCtrl,
              decoration: const InputDecoration(labelText: 'Pulse Rate (bpm)'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: _tempCtrl,
              decoration: const InputDecoration(labelText: 'Temperature (C)'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            TextField(
              controller: _weightCtrl,
              decoration: const InputDecoration(labelText: 'Weight (kg)'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            TextField(
              controller: _heightCtrl,
              decoration: const InputDecoration(labelText: 'Height (cm)'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            TextField(
              controller: _spo2Ctrl,
              decoration: const InputDecoration(labelText: 'SpO2 (%)'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: _notesCtrl,
              decoration: const InputDecoration(labelText: 'Notes'),
              maxLines: 3,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Saving...' : 'Save Vitals'),
            ),
          ],
        ),
      ),
    );
  }
}
