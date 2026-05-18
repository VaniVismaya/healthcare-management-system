import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class AdminVerificationsPage extends StatefulWidget {
  const AdminVerificationsPage({super.key});

  @override
  State<AdminVerificationsPage> createState() => _AdminVerificationsPageState();
}

class _AdminVerificationsPageState extends State<AdminVerificationsPage> {
  String _role = 'doctor';
  List<dynamic> _items = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance
          .get('/api/admin/verifications?role=$_role', auth: true);
      setState(() => _items = data['items'] ?? []);
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

  Future<void> _verify(Map<String, dynamic> item, bool approved) async {
    final remarksCtrl = TextEditingController();
    if (!approved) {
      await showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Reject Reason'),
          content: TextField(
            controller: remarksCtrl,
            decoration: const InputDecoration(labelText: 'Reason'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Continue')),
          ],
        ),
      );
    }
    try {
      await ApiClient.instance.post('/api/admin/verify', {
        'role': _role,
        'user_id': item['user_id'],
        'approved': approved,
        'remarks': remarksCtrl.text.trim(),
      }, auth: true);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(approved ? 'Approved' : 'Rejected')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Update failed: $e')));
    }
  }

  Widget _buildCard(Map<String, dynamic> item) {
    final name = item['name'] ?? '';
    final email = item['email'] ?? '-';
    final phone = item['phone'] ?? '-';
    String line1 = '';
    String line2 = '';
    String cert = '';
    if (_role == 'doctor') {
      line1 = item['specialization'] ?? '';
      line2 = 'License: ${item['medical_license_number'] ?? '-'}';
      cert = item['license_certificate_path'] ?? '';
    } else if (_role == 'laboratory') {
      line1 = item['lab_name'] ?? '';
      line2 = 'Reg: ${item['registration_number'] ?? '-'}';
      cert = item['certificate_path'] ?? '';
    } else {
      line1 = item['pharmacy_name'] ?? '';
      line2 = 'License: ${item['license_number'] ?? '-'}';
      cert = item['license_certificate_path'] ?? '';
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(line1),
            Text(line2),
            const SizedBox(height: 4),
            Text('Email: $email'),
            Text('Phone: $phone'),
            if (cert.isNotEmpty) Text('Certificate: $cert'),
            const SizedBox(height: 8),
            Row(
              children: [
                ElevatedButton(
                  onPressed: () => _verify(item, true),
                  child: const Text('Approve'),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () => _verify(item, false),
                  child: const Text('Reject'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verifications')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: DropdownButtonFormField<String>(
              value: _role,
              items: const [
                DropdownMenuItem(value: 'doctor', child: Text('Doctors')),
                DropdownMenuItem(value: 'laboratory', child: Text('Labs')),
                DropdownMenuItem(value: 'pharmacist', child: Text('Pharmacies')),
              ],
              onChanged: (v) {
                if (v == null) return;
                setState(() => _role = v);
                _load();
              },
              decoration: const InputDecoration(labelText: 'Role'),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _items.isEmpty
                    ? const Center(child: Text('No pending verifications'))
                    : ListView.builder(
                        itemCount: _items.length,
                        itemBuilder: (_, i) => _buildCard(
                          (_items[i] as Map?)?.cast<String, dynamic>() ?? {},
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
