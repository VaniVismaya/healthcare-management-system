import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class ReceptionistHandoverPage extends StatefulWidget {
  const ReceptionistHandoverPage({super.key});

  @override
  State<ReceptionistHandoverPage> createState() => _ReceptionistHandoverPageState();
}

class _ReceptionistHandoverPageState extends State<ReceptionistHandoverPage> {
  List<dynamic> _notes = [];
  bool _loading = false;
  final _notesCtrl = TextEditingController();
  final _dateCtrl = TextEditingController();
  String _shift = 'morning';

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/receptionist/handover', auth: true);
      setState(() => _notes = data['notes'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    try {
      await ApiClient.instance.post('/api/receptionist/handover', {
        'shift_date': _dateCtrl.text.trim(),
        'shift_type': _shift,
        'notes': _notesCtrl.text.trim(),
      }, auth: true);
      _notesCtrl.clear();
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Handover saved')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Save failed: $e')));
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
      appBar: AppBar(title: const Text('Handover Notes')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(
                  controller: _dateCtrl,
                  decoration: const InputDecoration(labelText: 'Shift Date (YYYY-MM-DD)'),
                ),
                DropdownButtonFormField<String>(
                  value: _shift,
                  decoration: const InputDecoration(labelText: 'Shift Type'),
                  items: const [
                    DropdownMenuItem(value: 'morning', child: Text('Morning')),
                    DropdownMenuItem(value: 'afternoon', child: Text('Afternoon')),
                    DropdownMenuItem(value: 'evening', child: Text('Evening')),
                    DropdownMenuItem(value: 'night', child: Text('Night')),
                  ],
                  onChanged: (v) => setState(() => _shift = v ?? 'morning'),
                ),
                TextField(
                  controller: _notesCtrl,
                  decoration: const InputDecoration(labelText: 'Notes'),
                  maxLines: 4,
                ),
                const SizedBox(height: 8),
                ElevatedButton(onPressed: _save, child: const Text('Save Note')),
                const Divider(height: 32),
                const Text('Recent Notes', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                if (_notes.isEmpty)
                  const Text('No notes yet')
                else
                  ..._notes.map((n) {
                    final date = n['shift_date'] ?? '';
                    final shift = n['shift_type'] ?? '';
                    final createdBy = n['created_by_name'] ?? '';
                    final notes = n['notes'] ?? '';
                    return Card(
                      child: ListTile(
                        title: Text('$date - $shift'),
                        subtitle: Text(notes),
                        trailing: createdBy.toString().isNotEmpty ? Text(createdBy) : null,
                      ),
                    );
                  }).toList(),
              ],
            ),
    );
  }
}
