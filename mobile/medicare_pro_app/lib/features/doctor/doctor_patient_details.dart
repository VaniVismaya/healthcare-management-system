import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class DoctorPatientDetailsPage extends StatefulWidget {
  final int patientId;
  const DoctorPatientDetailsPage({super.key, required this.patientId});

  @override
  State<DoctorPatientDetailsPage> createState() =>
      _DoctorPatientDetailsPageState();
}

class _DoctorPatientDetailsPageState extends State<DoctorPatientDetailsPage> {
  Map<String, dynamic>? _profile;
  List<dynamic> _vitals = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get(
        '/api/doctor/patients/${widget.patientId}',
        auth: true,
      );
      setState(() {
        _profile = (data['profile'] as Map?)?.cast<String, dynamic>();
        _vitals = data['vitals'] ?? [];
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
      appBar: AppBar(title: const Text('Patient Details')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_profile != null) ...[
                  Text(_profile?['name'] ?? 'Patient',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text('Phone: ${_profile?['phone'] ?? '-'}'),
                  Text('Email: ${_profile?['email'] ?? '-'}'),
                  const SizedBox(height: 8),
                  Text('Blood Group: ${_profile?['blood_group'] ?? '-'}'),
                  Text('DOB: ${_profile?['date_of_birth'] ?? '-'}'),
                  Text('Gender: ${_profile?['gender'] ?? '-'}'),
                  const SizedBox(height: 12),
                ],
                const Text('Vitals', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (_vitals.isEmpty)
                  const Text('No vitals recorded')
                else
                  ..._vitals.map((v) {
                    final bp = v['blood_pressure'] ?? '-';
                    final pulse = v['pulse_rate'] ?? '-';
                    final temp = v['temperature'] ?? '-';
                    final SpO2 = v['oxygen_saturation'] ?? '-';
                    final date = v['appointment_date'] ?? '';
                    return Card(
                      child: ListTile(
                        title: Text('BP $bp - Pulse $pulse - Temp $temp - SpO2 $SpO2'),
                        subtitle: Text(date),
                      ),
                    );
                  }).toList(),
              ],
            ),
    );
  }
}
