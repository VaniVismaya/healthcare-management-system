import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class DoctorSchedulePage extends StatefulWidget {
  const DoctorSchedulePage({super.key});

  @override
  State<DoctorSchedulePage> createState() => _DoctorSchedulePageState();
}

class _DoctorSchedulePageState extends State<DoctorSchedulePage> {
  List<dynamic> _schedules = [];
  List<dynamic> _clinics = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final c = await ApiClient.instance.get('/api/doctor/clinics', auth: true);
      final s = await ApiClient.instance.get('/api/doctor/schedules', auth: true);
      setState(() {
        _clinics = c['clinics'] ?? [];
        _schedules = s['schedules'] ?? [];
      });
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

  String _dayLabel(int day) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[day % 7];
  }

  Future<TimeOfDay?> _pickTime(TimeOfDay initial) {
    return showTimePicker(context: context, initialTime: initial);
  }

  String _timeToStr(TimeOfDay t) {
    final h = t.hour.toString().padLeft(2, '0');
    final m = t.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  Future<void> _openAdd() async {
    if (_clinics.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('No clinic found')));
      return;
    }

    int day = 1;
    int? clinicId = _clinics.first['id'];
    final labelCtrl = TextEditingController(text: 'Morning Session');
    final durationCtrl = TextEditingController(text: '15');
    final maxCtrl = TextEditingController(text: '30');
    TimeOfDay start = const TimeOfDay(hour: 9, minute: 0);
    TimeOfDay end = const TimeOfDay(hour: 13, minute: 0);

    await showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Add Session'),
          content: SingleChildScrollView(
            child: Column(
              children: [
                DropdownButtonFormField<int>(
                  value: clinicId,
                  items: _clinics
                      .map((c) => DropdownMenuItem(
                            value: c['id'],
                            child: Text(c['name'] ?? 'Clinic'),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => clinicId = v),
                  decoration: const InputDecoration(labelText: 'Clinic'),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<int>(
                  value: day,
                  items: List.generate(
                    7,
                    (i) => DropdownMenuItem(
                      value: i,
                      child: Text(_dayLabel(i)),
                    ),
                  ),
                  onChanged: (v) => setState(() => day = v ?? 1),
                  decoration: const InputDecoration(labelText: 'Day'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: labelCtrl,
                  decoration: const InputDecoration(labelText: 'Session Label'),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          final picked = await _pickTime(start);
                          if (picked != null) setState(() => start = picked);
                        },
                        child: Text('Start: ${_timeToStr(start)}'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          final picked = await _pickTime(end);
                          if (picked != null) setState(() => end = picked);
                        },
                        child: Text('End: ${_timeToStr(end)}'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: durationCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Slot Duration (min)'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: maxCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Session Capacity'),
                  keyboardType: TextInputType.number,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () async {
                try {
                  await ApiClient.instance.post('/api/doctor/schedules', {
                    'clinic_id': clinicId,
                    'day_of_week': day,
                    'session_label': labelCtrl.text.trim(),
                    'start_time': _timeToStr(start),
                    'end_time': _timeToStr(end),
                    'slot_duration_minutes': int.tryParse(durationCtrl.text) ?? 15,
                    'max_patients_per_slot': int.tryParse(maxCtrl.text) ?? 30,
                  }, auth: true);
                  if (!mounted) return;
                  Navigator.pop(ctx);
                  await _load();
                } catch (e) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text('Create failed: $e')));
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleActive(Map<String, dynamic> s) async {
    final id = s['id'];
    final next = s['is_active'] == 1 ? 0 : 1;
    try {
      await ApiClient.instance.post('/api/doctor/schedules/$id', {
        'is_active': next,
      }, auth: true);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Update failed: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Schedule')),
      floatingActionButton: FloatingActionButton(
        onPressed: _openAdd,
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _schedules.length,
              itemBuilder: (_, i) {
                final s = (_schedules[i] as Map?)?.cast<String, dynamic>() ?? {};
                final day = _dayLabel(s['day_of_week'] ?? 0);
                final label = s['session_label'] ?? 'Session';
                final start = s['start_time'] ?? '';
                final end = s['end_time'] ?? '';
                final cap = s['max_patients_per_slot'] ?? 0;
                final active = s['is_active'] == 1;
                return ListTile(
                  title: Text('$day • $label'),
                  subtitle: Text('$start - $end • Capacity $cap'),
                  trailing: Switch(
                    value: active,
                    onChanged: (_) => _toggleActive(s),
                  ),
                );
              },
            ),
    );
  }
}
