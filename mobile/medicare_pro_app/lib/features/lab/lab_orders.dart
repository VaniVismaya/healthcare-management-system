import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class LabOrdersPage extends StatefulWidget {
  const LabOrdersPage({super.key});

  @override
  State<LabOrdersPage> createState() => _LabOrdersPageState();
}

class _LabOrdersPageState extends State<LabOrdersPage> {
  List<dynamic> _orders = [];
  bool _loading = false;

  Future<void> _saveTests(int orderId, List<dynamic> items) async {
    final payload = items
        .where((t) => t['test_id'] != null)
        .map((t) => {
              'test_id': t['test_id'],
              'is_completed': t['is_completed'] == true,
            })
        .toList();
    try {
      await ApiClient.instance
          .post('/api/lab/orders/$orderId/tests', {'tests': payload}, auth: true);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Tests updated')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Update failed: $e')));
    }
  }

  void _openTests(Map<String, dynamic> order) {
    final items = (order['test_items'] as List?) ?? [];
    final collectionRequired = order['collection_required'] == 1 || order['collection_required'] == true;
    final collectionDate = order['collection_date'] ?? '';
    final collectionTime = order['collection_time'] ?? '';
    final collectionAddress = order['collection_address'] ?? '';
    showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Tests'),
          content: SizedBox(
            width: double.maxFinite,
            child: items.isEmpty
                ? const Text('No assigned tests.')
                : ListView(
                    shrinkWrap: true,
                    children: [
                      if (collectionRequired)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(
                            'Home Collection: $collectionDate $collectionTime${collectionAddress.toString().isNotEmpty ? ' - $collectionAddress' : ''}',
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      ...items.map((t) {
                        final checked = t['is_completed'] == true;
                        return CheckboxListTile(
                          value: checked,
                          onChanged: (v) {
                            setState(() {
                              t['is_completed'] = v == true;
                            });
                          },
                          title: Text(t['test_name'] ?? 'Test'),
                        );
                      }).toList(),
                    ],
                  ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close'),
            ),
            TextButton(
              onPressed: () async {
                await _saveTests(order['id'], items);
                if (Navigator.canPop(ctx)) {
                  Navigator.pop(ctx);
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/lab/orders', auth: true);
      setState(() => _orders = data['orders'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
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
      appBar: AppBar(title: const Text('Lab Orders')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _orders.length,
              itemBuilder: (_, i) {
                final o = (_orders[i] as Map?)?.cast<String, dynamic>() ?? {};
                final testItems = (o['test_items'] as List?) ?? [];
                final testNames = (o['test_names'] as List?) ?? [];
                final manualTests = o['manual_tests'];
                final manualList = manualTests is List
                    ? manualTests
                    : (manualTests != null && manualTests.toString().isNotEmpty
                        ? [manualTests]
                        : []);
                final count = testItems.isNotEmpty
                    ? testItems.length
                    : testNames.length + manualList.length;
                final status = o['status'] ?? '';
                final collectionRequired = o['collection_required'] == 1 || o['collection_required'] == true;
                final collectionDate = o['collection_date'] ?? '';
                final collectionTime = o['collection_time'] ?? '';
                final collectionLine = collectionRequired
                    ? 'Collection: $collectionDate $collectionTime'
                    : '';
                final subtitle = [
                  count > 0 ? '$count tests - $status' : status,
                  if (collectionLine.isNotEmpty) collectionLine,
                ].join(' | ');
                return ListTile(
                  title: Text(o['patient_name'] ?? 'Patient'),
                  subtitle: Text(subtitle),
                  trailing: TextButton(
                    onPressed: () => _openTests(o),
                    child: const Text('View'),
                  ),
                  onTap: () => _openTests(o),
                );
              },
            ),
    );
  }
}
