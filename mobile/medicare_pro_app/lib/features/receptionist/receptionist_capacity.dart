import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class ReceptionistCapacityPage extends StatefulWidget {
  const ReceptionistCapacityPage({super.key});

  @override
  State<ReceptionistCapacityPage> createState() =>
      _ReceptionistCapacityPageState();
}

class _ReceptionistCapacityPageState extends State<ReceptionistCapacityPage> {
  List<dynamic> _sessions = [];
  bool _loading = false;
  DateTime _date = DateTime.now();

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final dateStr =
          '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';
      final data = await ApiClient.instance.get(
        '/api/receptionist/sessions?date=$dateStr',
        auth: true,
      );
      setState(() => _sessions = data['sessions'] ?? []);
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

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 7)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null) {
      setState(() => _date = picked);
      await _load();
    }
  }

  Future<void> _setOverride(Map<String, dynamic> s) async {
    final ctrl = TextEditingController(
      text: s['override_capacity'] != null
          ? s['override_capacity'].toString()
          : '',
    );
    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Set Capacity Override'),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Max Patients',
            hintText: 'Leave empty to clear override',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              final dateStr =
                  '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';
              final val = ctrl.text.trim();
              try {
                await ApiClient.instance.post('/api/receptionist/override', {
                  'session_id': s['session_id'],
                  'appointment_date': dateStr,
                  'max_patients': val.isEmpty ? null : int.tryParse(val),
                }, auth: true);
                if (!mounted) return;
                Navigator.pop(context);
                await _load();
              } catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text('Save failed: $e')));
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Capacity Override'),
        actions: [
          IconButton(onPressed: _pickDate, icon: const Icon(Icons.date_range)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _sessions.length,
              itemBuilder: (_, i) {
                final s = (_sessions[i] as Map?)?.cast<String, dynamic>() ?? {};
                final label = s['label'] ?? 'Session';
                final start = s['start_time'] ?? '';
                final end = s['end_time'] ?? '';
                final base = s['base_capacity'] ?? 0;
                final override = s['override_capacity'];
                final max = s['max_patients'] ?? base;
                final booked = s['booked_count'] ?? 0;
                return ListTile(
                  title: Text('$label ($start - $end)'),
                  subtitle: Text(
                    'Booked $booked / $max • Base $base${override != null ? ' • Override $override' : ''}',
                  ),
                  trailing: TextButton(
                    onPressed: () => _setOverride(s),
                    child: const Text('Set'),
                  ),
                );
              },
            ),
    );
  }
}
