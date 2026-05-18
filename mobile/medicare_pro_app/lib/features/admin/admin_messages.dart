import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class AdminMessagesPage extends StatefulWidget {
  const AdminMessagesPage({super.key});

  @override
  State<AdminMessagesPage> createState() => _AdminMessagesPageState();
}

class _AdminMessagesPageState extends State<AdminMessagesPage> {
  List<dynamic> _items = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/admin/messages', auth: true);
      setState(() => _items = data['messages'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openMessage(Map<String, dynamic> m) async {
    final replyCtrl = TextEditingController(text: m['admin_reply'] ?? '');
    String status = m['status'] ?? 'new';
    await showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text(m['subject'] ?? 'Message'),
          content: SingleChildScrollView(
            child: Column(
              children: [
                Text('From: ${m['name']} (${m['email'] ?? '-'})'),
                const SizedBox(height: 8),
                Text(m['message'] ?? ''),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: status,
                  items: const [
                    DropdownMenuItem(value: 'new', child: Text('New')),
                    DropdownMenuItem(value: 'in_progress', child: Text('In Progress')),
                    DropdownMenuItem(value: 'resolved', child: Text('Resolved')),
                  ],
                  onChanged: (v) => setState(() => status = v ?? 'new'),
                  decoration: const InputDecoration(labelText: 'Status'),
                ),
                TextField(
                  controller: replyCtrl,
                  decoration: const InputDecoration(labelText: 'Admin Reply'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
            TextButton(
              onPressed: () async {
                try {
                  await ApiClient.instance.post('/api/admin/messages/${m['id']}', {
                    'status': status,
                    'admin_reply': replyCtrl.text.trim(),
                  }, auth: true);
                  if (!mounted) return;
                  Navigator.pop(ctx);
                  await _load();
                } catch (e) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text('Update failed: $e')));
                }
              },
              child: const Text('Save'),
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
      appBar: AppBar(title: const Text('Contact Messages')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? const Center(child: Text('No messages'))
              : ListView.builder(
                  itemCount: _items.length,
                  itemBuilder: (_, i) {
                    final m = (_items[i] as Map?)?.cast<String, dynamic>() ?? {};
                    final subject = m['subject'] ?? 'Message';
                    final name = m['name'] ?? '';
                    return ListTile(
                      title: Text(subject),
                      subtitle: Text(name),
                      trailing: Text(m['status'] ?? ''),
                      onTap: () => _openMessage(m),
                    );
                  },
                ),
    );
  }
}
