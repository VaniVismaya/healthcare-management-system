import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class AdminAnnouncementsPage extends StatefulWidget {
  const AdminAnnouncementsPage({super.key});

  @override
  State<AdminAnnouncementsPage> createState() => _AdminAnnouncementsPageState();
}

class _AdminAnnouncementsPageState extends State<AdminAnnouncementsPage> {
  List<dynamic> _items = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/admin/announcements', auth: true);
      setState(() => _items = data['announcements'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openCreate() async {
    final titleCtrl = TextEditingController();
    final msgCtrl = TextEditingController();
    String role = 'all';
    bool active = true;

    await showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('New Announcement'),
          content: SingleChildScrollView(
            child: Column(
              children: [
                TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Title')),
                TextField(controller: msgCtrl, decoration: const InputDecoration(labelText: 'Message')),
                DropdownButtonFormField<String>(
                  value: role,
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('All')),
                    DropdownMenuItem(value: 'doctor', child: Text('Doctors')),
                    DropdownMenuItem(value: 'patient', child: Text('Patients')),
                    DropdownMenuItem(value: 'laboratory', child: Text('Labs')),
                    DropdownMenuItem(value: 'pharmacist', child: Text('Pharmacies')),
                    DropdownMenuItem(value: 'receptionist', child: Text('Receptionists')),
                  ],
                  onChanged: (v) => setState(() => role = v ?? 'all'),
                  decoration: const InputDecoration(labelText: 'Target Role'),
                ),
                SwitchListTile(
                  value: active,
                  onChanged: (v) => setState(() => active = v),
                  title: const Text('Active'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            TextButton(
              onPressed: () async {
                try {
                  await ApiClient.instance.post('/api/admin/announcements', {
                    'title': titleCtrl.text.trim(),
                    'message': msgCtrl.text.trim(),
                    'target_role': role,
                    'is_active': active,
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
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Announcements')),
      floatingActionButton: FloatingActionButton(
        onPressed: _openCreate,
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? const Center(child: Text('No announcements'))
              : ListView.builder(
                  itemCount: _items.length,
                  itemBuilder: (_, i) {
                    final a = (_items[i] as Map?)?.cast<String, dynamic>() ?? {};
                    return ListTile(
                      title: Text(a['title'] ?? 'Announcement'),
                      subtitle: Text(a['message'] ?? ''),
                      trailing: Text(a['target_role'] ?? 'all'),
                    );
                  },
                ),
    );
  }
}
