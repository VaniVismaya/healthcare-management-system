import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class DoctorLeavesPage extends StatefulWidget {
  const DoctorLeavesPage({super.key});

  @override
  State<DoctorLeavesPage> createState() => _DoctorLeavesPageState();
}

class _DoctorLeavesPageState extends State<DoctorLeavesPage> {
  List<dynamic> _leaves = [];
  List<dynamic> _clinics = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final c = await ApiClient.instance.get('/api/doctor/clinics', auth: true);
      final l = await ApiClient.instance.get('/api/doctor/leaves', auth: true);
      setState(() {
        _clinics = c['clinics'] ?? [];
        _leaves = l['leaves'] ?? [];
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

  Future<void> _openAdd() async {
    DateTime date = DateTime.now();
    String type = 'full_day';
    int? clinicId;
    final reasonCtrl = TextEditingController();

    await showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Add Leave'),
          content: SingleChildScrollView(
            child: Column(
              children: [
                OutlinedButton(
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: date,
                      firstDate: DateTime.now().subtract(const Duration(days: 1)),
                      lastDate: DateTime.now().add(const Duration(days: 60)),
                    );
                    if (picked != null) {
                      setState(() => date = picked);
                    }
                  },
                  child: Text(
                    '${date.day}-${date.month}-${date.year}',
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: type,
                  items: const [
                    DropdownMenuItem(value: 'full_day', child: Text('Full Day')),
                    DropdownMenuItem(value: 'morning', child: Text('Morning')),
                    DropdownMenuItem(value: 'evening', child: Text('Evening')),
                  ],
                  onChanged: (v) => setState(() => type = v ?? 'full_day'),
                  decoration: const InputDecoration(labelText: 'Leave Type'),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<int?>(
                  value: clinicId,
                  items: [
                    const DropdownMenuItem(value: null, child: Text('All Clinics')),
                    ..._clinics.map((c) => DropdownMenuItem(
                          value: c['id'],
                          child: Text(c['name'] ?? 'Clinic'),
                        ))
                  ],
                  onChanged: (v) => setState(() => clinicId = v),
                  decoration: const InputDecoration(labelText: 'Clinic'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: reasonCtrl,
                  decoration: const InputDecoration(labelText: 'Reason (optional)'),
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
                final dateStr =
                    '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
                try {
                  await ApiClient.instance.post('/api/doctor/leaves', {
                    'leave_date': dateStr,
                    'leave_type': type,
                    'clinic_id': clinicId,
                    'reason': reasonCtrl.text.trim(),
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

  String _typeLabel(String t) {
    switch (t) {
      case 'morning':
        return 'Morning';
      case 'evening':
        return 'Evening';
      default:
        return 'Full Day';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leaves')),
      floatingActionButton: FloatingActionButton(
        onPressed: _openAdd,
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _leaves.length,
              itemBuilder: (_, i) {
                final l = (_leaves[i] as Map?)?.cast<String, dynamic>() ?? {};
                final date = l['leave_date'] ?? '';
                final type = _typeLabel(l['leave_type'] ?? 'full_day');
                final clinic = l['clinic_name'] ?? 'All clinics';
                return ListTile(
                  title: Text('$date • $type'),
                  subtitle: Text(clinic),
                );
              },
            ),
    );
  }
}
