import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../core/api/api_client.dart';
import '../../core/models/appointment.dart';

class PatientAppointmentsPage extends StatefulWidget {
  const PatientAppointmentsPage({super.key});

  @override
  State<PatientAppointmentsPage> createState() => _PatientAppointmentsPageState();
}

class _PatientAppointmentsPageState extends State<PatientAppointmentsPage> {
  List<Appointment> _appointments = [];
  bool _loading = false;
  bool _queueLoading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/appointments', auth: true);
      final list = (data['appointments'] as List).map((e) => Appointment.fromJson(e)).toList();
      setState(() => _appointments = list);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _showQueueStatus(int appointmentId) async {
    setState(() => _queueLoading = true);
    try {
      final data = await ApiClient.instance
          .get('/api/appointments/$appointmentId/queue', auth: true);
      if (!mounted) return;
      final nowServing = data['now_serving_queue'];
      final ahead = data['ahead_count'] ?? 0;
      final est = data['estimated_wait_minutes'] ?? 0;
      final session = data['session_label'] ?? '';
      final start = data['session_start_time'] ?? '';
      final end = data['session_end_time'] ?? '';
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Queue Status'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (session.toString().isNotEmpty)
                Text('$session ($start - $end)'),
              const SizedBox(height: 8),
              Text('Now Serving: ${nowServing ?? '-'}'),
              Text('Patients Ahead: $ahead'),
              Text('Estimated Wait: $est min'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Queue status failed: $e')));
    } finally {
      if (mounted) setState(() => _queueLoading = false);
    }
  }

  Future<void> _showQr(Appointment appointment) async {
    try {
      final data = await ApiClient.instance
          .get('/api/appointments/${appointment.id}/qr', auth: true);
      if (!mounted) return;
      final token = data['token'] as String? ?? '';
      final expires = data['expires_in'] ?? 0;
      if (token.isEmpty) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('QR token not available')));
        return;
      }
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Appointment QR'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              QrImageView(data: token, size: 200),
              const SizedBox(height: 12),
              Text('Queue #${appointment.queueNumber}'),
              Text('Expires in ${expires}s'),
              const SizedBox(height: 8),
              const Text('Show this at the clinic for check-in.'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('QR load failed: $e')));
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
      appBar: AppBar(title: const Text('My Appointments')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _appointments.length,
              itemBuilder: (_, i) {
                final a = _appointments[i];
                return ListTile(
                  title: Text('${a.date} - ${a.sessionLabel ?? ''}'),
                  subtitle: Text('${a.clinicName ?? ''} - Queue #${a.queueNumber}'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(a.status),
                      IconButton(
                        icon: const Icon(Icons.qr_code),
                        onPressed: () => _showQr(a),
                      ),
                      if (a.consultationMode == 'video' &&
                          (a.videoMeetingUrl ?? '').toString().isNotEmpty)
                        IconButton(
                          icon: const Icon(Icons.videocam),
                          onPressed: () async {
                            final url = Uri.parse(a.videoMeetingUrl!);
                            await launchUrl(url, mode: LaunchMode.inAppWebView);
                          },
                        ),
                      IconButton(
                        icon: const Icon(Icons.timeline),
                        onPressed: _queueLoading ? null : () => _showQueueStatus(a.id),
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
