import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/models/prescription.dart';

class PatientPrescriptionsPage extends StatefulWidget {
  const PatientPrescriptionsPage({super.key});

  @override
  State<PatientPrescriptionsPage> createState() => _PatientPrescriptionsPageState();
}

class _PatientPrescriptionsPageState extends State<PatientPrescriptionsPage> {
  List<Prescription> _prescriptions = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/prescriptions', auth: true);
      final list = (data['prescriptions'] as List).map((e) => Prescription.fromJson(e)).toList();
      setState(() => _prescriptions = list);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      setState(() => _loading = false);
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
      appBar: AppBar(title: const Text('My Prescriptions')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _prescriptions.length,
              itemBuilder: (_, i) {
                final p = _prescriptions[i];
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${p.appointmentDate} • ${p.doctorName}', style: const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Text('Diagnosis: ${p.diagnosis}'),
                        const SizedBox(height: 6),
                        const Text('Medicines:', style: TextStyle(fontWeight: FontWeight.w600)),
                        ...p.medicines.map((m) => Text('- ${m.name} ${m.dosage ?? ''} (${m.frequency ?? ''})')),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
