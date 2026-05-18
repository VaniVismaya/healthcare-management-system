import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/models/appointment.dart';
import '../../core/services/router.dart';

class DoctorAppointmentsPage extends StatefulWidget {
  const DoctorAppointmentsPage({super.key});

  @override
  State<DoctorAppointmentsPage> createState() => _DoctorAppointmentsPageState();
}

class _DoctorAppointmentsPageState extends State<DoctorAppointmentsPage> {
  List<Appointment> _appointments = [];
  bool _loading = false;

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

  Future<void> _updateStatus(int id, String status) async {
    try {
      await ApiClient.instance.post('/api/appointments/$id/status', {'status': status}, auth: true);
      await _load();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Update failed: $e')));
    }
  }

  Future<void> _setVideoLink(Appointment a) async {
    final urlCtrl = TextEditingController(text: a.videoMeetingUrl ?? '');
    final res = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Video Meeting Link'),
        content: TextField(
          controller: urlCtrl,
          decoration: const InputDecoration(labelText: 'Meeting URL'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Save')),
        ],
      ),
    );
    if (res != true) return;
    try {
      await ApiClient.instance.post(
        '/api/appointments/${a.id}/video',
        {'video_meeting_url': urlCtrl.text.trim(), 'video_provider': 'zoom'},
        auth: true,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Video link saved')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Save failed: $e')));
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
      appBar: AppBar(
        title: const Text('Appointments'),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () async {
              final res = await Navigator.pushNamed(context, AppRouter.qrCheckin);
              if (res == true) {
                await _load();
              }
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _appointments.length,
              itemBuilder: (_, i) {
                final a = _appointments[i];
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  child: ListTile(
                    title: Text('${a.sessionLabel ?? ''} - ${a.patientName ?? ''}'),
                    subtitle: Text('Queue #${a.queueNumber} - ${a.status}'),
                    trailing: Wrap(
                      spacing: 8,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.person),
                          onPressed: () => Navigator.pushNamed(
                            context,
                            AppRouter.doctorPatientDetails,
                            arguments: a.patientId,
                          ),
                        ),
                        if (a.consultationMode == 'video')
                          IconButton(
                            icon: const Icon(Icons.videocam),
                            onPressed: () async {
                              final url = a.videoMeetingUrl;
                              if (url != null && url.isNotEmpty) {
                                await launchUrl(Uri.parse(url),
                                    mode: LaunchMode.inAppWebView);
                              } else {
                                await _setVideoLink(a);
                              }
                            },
                          ),
                        IconButton(
                          icon: const Icon(Icons.favorite),
                          onPressed: () => Navigator.pushNamed(
                            context,
                            AppRouter.recordVitals,
                            arguments: {
                              'appointmentId': a.id,
                              'patientId': a.patientId,
                            },
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.science_outlined),
                          onPressed: () => Navigator.pushNamed(
                            context,
                            AppRouter.doctorAssignLab,
                            arguments: a.id,
                          ),
                        ),
                        PopupMenuButton<String>(
                          onSelected: (v) => _updateStatus(a.id, v),
                          itemBuilder: (_) => const [
                            PopupMenuItem(value: 'confirmed', child: Text('Confirm')),
                            PopupMenuItem(value: 'checked_in', child: Text('Check In')),
                            PopupMenuItem(value: 'in_consultation', child: Text('Start Consultation')),
                            PopupMenuItem(value: 'completed', child: Text('Complete')),
                            PopupMenuItem(value: 'no_show', child: Text('No Show')),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}

