import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class AdminAuditLogsPage extends StatefulWidget {
  const AdminAuditLogsPage({super.key});

  @override
  State<AdminAuditLogsPage> createState() => _AdminAuditLogsPageState();
}

class _AdminAuditLogsPageState extends State<AdminAuditLogsPage> {
  List<dynamic> _items = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/admin/audit-logs', auth: true);
      setState(() => _items = data['logs'] ?? []);
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Audit Logs')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items.length,
              itemBuilder: (_, i) {
                final l = (_items[i] as Map?)?.cast<String, dynamic>() ?? {};
                final user = l['user_name'] ?? 'System';
                final action = l['action'] ?? '';
                final resource = l['resource_type'] ?? '';
                final rid = l['resource_id']?.toString() ?? '';
                final created = l['created_at'] ?? '';
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  child: ListTile(
                    title: Text(action),
                    subtitle: Text('$user\n$resource ${rid.isNotEmpty ? '#$rid' : ''}\n$created'),
                    isThreeLine: true,
                  ),
                );
              },
            ),
    );
  }
}
