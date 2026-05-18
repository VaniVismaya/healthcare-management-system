import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class AdminDashboardPage extends StatefulWidget {
  const AdminDashboardPage({super.key});

  @override
  State<AdminDashboardPage> createState() => _AdminDashboardPageState();
}

class _AdminDashboardPageState extends State<AdminDashboardPage> {
  Map<String, dynamic>? _stats;
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/admin/stats', auth: true);
      setState(() => _stats = data);
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
    final users = (_stats?['users'] as Map?) ?? {};
    final pending = (_stats?['pending_verifications'] as Map?) ?? {};
    return Scaffold(
      appBar: AppBar(title: const Text('Admin Overview')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _StatCard('Doctors', users['doctor'] ?? 0),
                _StatCard('Patients', users['patient'] ?? 0),
                _StatCard('Labs', users['laboratory'] ?? 0),
                _StatCard('Pharmacies', users['pharmacist'] ?? 0),
                _StatCard('Receptionists', users['receptionist'] ?? 0),
                const SizedBox(height: 12),
                _StatCard('Pending Doctor Verifications', pending['doctors'] ?? 0),
                _StatCard('Pending Lab Verifications', pending['laboratories'] ?? 0),
                _StatCard('Pending Pharmacy Verifications', pending['pharmacists'] ?? 0),
                const SizedBox(height: 12),
                _StatCard('Today Appointments', _stats?['today_appointments'] ?? 0),
              ],
            ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final Object value;

  const _StatCard(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(label),
        trailing: Text(value.toString()),
      ),
    );
  }
}
