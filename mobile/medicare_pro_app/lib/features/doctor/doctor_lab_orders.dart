import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class DoctorLabOrdersPage extends StatefulWidget {
  const DoctorLabOrdersPage({super.key});

  @override
  State<DoctorLabOrdersPage> createState() => _DoctorLabOrdersPageState();
}

class _DoctorLabOrdersPageState extends State<DoctorLabOrdersPage> {
  List<dynamic> _orders = [];
  bool _loading = false;

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
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openTests(Map<String, dynamic> order) {
    final items = (order['test_items'] as List?) ?? [];
    final manual = order['manual_tests'];
    final manualList = manual is List
        ? manual
        : (manual != null && manual.toString().isNotEmpty ? [manual] : []);
    final collectionRequired = order['collection_required'] == 1 || order['collection_required'] == true;
    final collectionDate = order['collection_date'] ?? '';
    final collectionTime = order['collection_time'] ?? '';
    final collectionAddress = order['collection_address'] ?? '';
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Assigned Tests'),
        content: SizedBox(
          width: double.maxFinite,
          child: items.isEmpty && manualList.isEmpty
              ? const Text('No tests assigned.')
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
                      final done = t['is_completed'] == true;
                      return ListTile(
                        title: Text(t['test_name'] ?? 'Test'),
                        trailing: Icon(
                          done ? Icons.check_circle : Icons.radio_button_unchecked,
                          color: done ? Colors.green : Colors.grey,
                        ),
                      );
                    }).toList(),
                    ...manualList.map((t) => ListTile(title: Text(t.toString()))),
                  ],
                ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
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
      appBar: AppBar(title: const Text('Lab Orders')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _orders.length,
              itemBuilder: (_, i) {
                final o = (_orders[i] as Map?)?.cast<String, dynamic>() ?? {};
                final patient = o['patient_name'] ?? 'Patient';
                final lab = o['lab_name'] ?? 'Lab';
                final status = o['status'] ?? '';
                final amount = o['total_amount'] ?? '';
                final collectionRequired = o['collection_required'] == 1 || o['collection_required'] == true;
                final collectionDate = o['collection_date'] ?? '';
                final collectionTime = o['collection_time'] ?? '';
                return ListTile(
                  title: Text('$patient - $lab'),
                  subtitle: Text('Status: $status${collectionRequired ? '\nCollection: $collectionDate $collectionTime' : ''}'),
                  trailing: Text(amount != '' ? 'INR $amount' : ''),
                  onTap: () => _openTests(o),
                );
              },
            ),
    );
  }
}




