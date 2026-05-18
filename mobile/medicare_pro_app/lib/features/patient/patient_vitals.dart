import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class PatientVitalsPage extends StatefulWidget {
  const PatientVitalsPage({super.key});

  @override
  State<PatientVitalsPage> createState() => _PatientVitalsPageState();
}

class _PatientVitalsPageState extends State<PatientVitalsPage> {
  List<dynamic> _items = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/patient/vitals', auth: true);
      setState(() => _items = data['vitals'] ?? []);
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
      appBar: AppBar(title: const Text('Vitals')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? const Center(child: Text('No vitals recorded'))
              : ListView.builder(
                  itemCount: _items.length,
                  itemBuilder: (_, i) {
                    final v = (_items[i] as Map?)?.cast<String, dynamic>() ?? {};
                    final date = v['appointment_date'] ?? '';
                    final doctor = v['doctor_name'] ?? '';
                    final bp = v['blood_pressure'] ?? '-';
                    final pulse = v['pulse_rate'] ?? '-';
                    final temp = v['temperature'] ?? '-';
                    final spo2 = v['oxygen_saturation'] ?? '-';
                    return Card(
                      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      child: ListTile(
                        title: Text('BP $bp - Pulse $pulse - Temp $temp - SpO2 $spo2'),
                        subtitle: Text('$date${doctor.toString().isNotEmpty ? ' - $doctor' : ''}'),
                      ),
                    );
                  },
                ),
    );
  }
}
