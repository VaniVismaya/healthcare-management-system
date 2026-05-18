import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/services/router.dart';

class ReceptionistQueuePage extends StatefulWidget {
  const ReceptionistQueuePage({super.key});

  @override
  State<ReceptionistQueuePage> createState() => _ReceptionistQueuePageState();
}

class _ReceptionistQueuePageState extends State<ReceptionistQueuePage> {
  List<dynamic> _items = [];
  bool _loading = false;
  DateTime _date = DateTime.now();

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final dateStr =
          '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';
      final data = await ApiClient.instance
          .get('/api/receptionist/queue?date=$dateStr', auth: true);
      setState(() => _items = data['appointments'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 7)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null) {
      setState(() => _date = picked);
      await _load();
    }
  }

  Future<void> _updateStatus(int id, String status) async {
    try {
      final data = await ApiClient.instance.post(
        '/api/appointments/$id/status',
        {'status': status},
        auth: true,
      );
      setState(() {
        _items = _items.map((item) {
          final row = (item as Map).cast<String, dynamic>();
          return row['id'] == id ? {...row, 'status': status} : row;
        }).toList();
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(data['offlineQueued'] == true ? 'Status saved offline and queued for sync' : 'Status updated')),
      );
      if (data['offlineQueued'] != true) {
        await _load();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Update failed: $e')));
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _showActions(Map<String, dynamic> a) {
    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _ActionItem(
              'Record Vitals',
              () => Navigator.pushNamed(
                context,
                AppRouter.recordVitals,
                arguments: {
                  'appointmentId': a['id'],
                  'patientId': a['patient_id'],
                },
              ),
            ),
            _ActionItem('Confirmed', () => _updateStatus(a['id'], 'confirmed')),
            _ActionItem('Checked In', () => _updateStatus(a['id'], 'checked_in')),
            _ActionItem('In Consultation', () => _updateStatus(a['id'], 'in_consultation')),
            _ActionItem('Completed (Check-out)', () => _updateStatus(a['id'], 'completed')),
            _ActionItem('No Show', () => _updateStatus(a['id'], 'no_show')),
            _ActionItem('Cancel', () => _updateStatus(a['id'], 'cancelled')),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Queue'),
        actions: [
          IconButton(
            onPressed: () async {
              final res = await Navigator.pushNamed(context, AppRouter.qrCheckin);
              if (res == true) {
                await _load();
              }
            },
            icon: const Icon(Icons.qr_code_scanner),
          ),
          IconButton(onPressed: _pickDate, icon: const Icon(Icons.date_range)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items.length,
              itemBuilder: (_, i) {
                final a = (_items[i] as Map?)?.cast<String, dynamic>() ?? {};
                final patient = a['patient_name'] ?? 'Patient';
                final session = a['session_label'] ?? 'Session';
                final start = a['session_start_time'] ?? '';
                final end = a['session_end_time'] ?? '';
                final queue = a['queue_number'] ?? '-';
                final status = a['status'] ?? '';
                final checkedIn = a['checked_in_at'] ?? '';
                final checkedOut = a['checked_out_at'] ?? '';
                return ListTile(
                  title: Text('$patient - Queue #$queue'),
                  subtitle: Text(
                    '$session ($start - $end)\n$status'
                    '${checkedIn.toString().isNotEmpty ? '\nCheck-in: $checkedIn' : ''}'
                    '${checkedOut.toString().isNotEmpty ? '\nCheck-out: $checkedOut' : ''}',
                  ),
                  isThreeLine: true,
                  trailing: TextButton(
                    onPressed: () => _showActions(a),
                    child: const Text('Update'),
                  ),
                );
              },
            ),
    );
  }
}

class _ActionItem extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _ActionItem(this.label, this.onTap);

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(label),
      onTap: () {
        Navigator.pop(context);
        onTap();
      },
    );
  }
}
