import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class PharmacyPrescriptionsPage extends StatefulWidget {
  const PharmacyPrescriptionsPage({super.key});

  @override
  State<PharmacyPrescriptionsPage> createState() =>
      _PharmacyPrescriptionsPageState();
}

class _PharmacyPrescriptionsPageState
    extends State<PharmacyPrescriptionsPage> {
  List<dynamic> _items = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance
          .get('/api/pharmacy/prescriptions', auth: true);
      setState(() => _items = data['prescriptions'] ?? []);
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

  void _openDetails(Map<String, dynamic> p) {
    final meds = (p['medicines'] as List?) ?? [];
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Prescription'),
        content: SizedBox(
          width: double.maxFinite,
          child: meds.isEmpty
              ? const Text('No medicines found.')
              : ListView(
                  shrinkWrap: true,
                  children: meds.map((m) {
                    final name = m['medicine_name'] ?? 'Medicine';
                    final dosage = m['dosage'] ?? '';
                    final freq = m['frequency'] ?? '';
                    final duration = m['duration_days'] != null
                        ? '${m['duration_days']} days'
                        : '';
                    final qty = m['quantity'] != null ? 'Qty ${m['quantity']}' : '';
                    final line = [dosage, freq, duration, qty]
                        .where((v) => v.toString().isNotEmpty)
                        .join(' • ');
                    return ListTile(
                      title: Text(name),
                      subtitle: Text(line.isEmpty ? '-' : line),
                    );
                  }).toList(),
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
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Prescriptions')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items.length,
              itemBuilder: (_, i) {
                final p = (_items[i] as Map?)?.cast<String, dynamic>() ?? {};
                final patient = p['patient_name'] ?? 'Patient';
                final doctor = p['doctor_name'] ?? 'Doctor';
                final dispensed = p['is_dispensed'] == 1 || p['is_dispensed'] == true;
                return ListTile(
                  title: Text(patient),
                  subtitle: Text('Doctor: $doctor${dispensed ? ' • Dispensed' : ''}'),
                  trailing: Wrap(
                    spacing: 8,
                    children: [
                      TextButton(
                        onPressed: () => _openDetails(p),
                        child: const Text('View'),
                      ),
                      if (!dispensed)
                        TextButton(
                          onPressed: () async {
                            try {
                              await ApiClient.instance.post(
                                '/api/pharmacy/prescriptions/${p['id']}/dispense',
                                {},
                                auth: true,
                              );
                              if (!mounted) return;
                              await _load();
                            } catch (e) {
                              if (!mounted) return;
                              ScaffoldMessenger.of(context)
                                  .showSnackBar(SnackBar(content: Text('Dispense failed: $e')));
                            }
                          },
                          child: const Text('Dispense'),
                        ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
