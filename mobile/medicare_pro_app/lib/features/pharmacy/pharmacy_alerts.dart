import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class PharmacyAlertsPage extends StatefulWidget {
  const PharmacyAlertsPage({super.key});

  @override
  State<PharmacyAlertsPage> createState() => _PharmacyAlertsPageState();
}

class _PharmacyAlertsPageState extends State<PharmacyAlertsPage> {
  List<dynamic> _alerts = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/notifications', auth: true);
      final items = (data['notifications'] as List?) ?? [];
      setState(() {
        _alerts = items.where((n) => n['type'] == 'stock_alert').toList();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Stock Alerts')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _alerts.isEmpty
              ? const Center(child: Text('No alerts'))
              : ListView.builder(
                  itemCount: _alerts.length,
                  itemBuilder: (_, i) {
                    final a = (_alerts[i] as Map?)?.cast<String, dynamic>() ?? {};
                    return ListTile(
                      title: Text(a['title'] ?? 'Alert'),
                      subtitle: Text(a['message'] ?? ''),
                    );
                  },
                ),
    );
  }
}
