import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/services/draft_store.dart';

const _walkinDraftKey = 'receptionist_walkin_draft';

class ReceptionistWalkinPage extends StatefulWidget {
  const ReceptionistWalkinPage({super.key});

  @override
  State<ReceptionistWalkinPage> createState() => _ReceptionistWalkinPageState();
}

class _ReceptionistWalkinPageState extends State<ReceptionistWalkinPage> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _reasonCtrl = TextEditingController();

  bool _priority = false;
  bool _loading = false;
  bool _hydratingDraft = false;
  List<dynamic> _searchResults = [];

  Map<String, dynamic>? _profile;
  List<dynamic> _sessions = [];
  int? _sessionId;
  DateTime _date = DateTime.now();

  Future<void> _saveDraft() async {
    if (_hydratingDraft) return;
    await DraftStore.save(_walkinDraftKey, {
      'name': _nameCtrl.text.trim(),
      'phone': _phoneCtrl.text.trim(),
      'email': _emailCtrl.text.trim(),
      'reason': _reasonCtrl.text.trim(),
      'priority': _priority,
      'session_id': _sessionId,
      'date': _date.toIso8601String(),
    });
  }

  Future<void> _restoreDraft() async {
    final draft = await DraftStore.load(_walkinDraftKey);
    if (draft == null) return;

    _hydratingDraft = true;
    _nameCtrl.text = draft['name']?.toString() ?? '';
    _phoneCtrl.text = draft['phone']?.toString() ?? '';
    _emailCtrl.text = draft['email']?.toString() ?? '';
    _reasonCtrl.text = draft['reason']?.toString() ?? '';

    final draftDate = DateTime.tryParse(draft['date']?.toString() ?? '');
    setState(() {
      _priority = draft['priority'] == true;
      _sessionId = draft['session_id'] is int ? draft['session_id'] as int : int.tryParse('${draft['session_id']}');
      if (draftDate != null) _date = draftDate;
    });
    _hydratingDraft = false;
  }

  Future<void> _loadProfile() async {
    final data =
        await ApiClient.instance.get('/api/receptionist/profile', auth: true);
    setState(() => _profile = data['profile']);
  }

  Future<void> _loadSessions() async {
    if (_profile == null) return;
    final doctorId = _profile!['doctor_id'];
    final clinicId = _profile!['clinic_id'];
    final dateStr =
        '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';
    final data = await ApiClient.instance.get(
      '/api/appointments/slots?doctor_id=$doctorId&clinic_id=$clinicId&date=$dateStr',
      auth: true,
    );
    setState(() {
      _sessions = data['slots'] ?? [];
      final currentSessionExists =
          _sessions.any((session) => session['session_id'] == _sessionId);
      _sessionId = currentSessionExists
          ? _sessionId
          : (_sessions.isNotEmpty ? _sessions.first['session_id'] : null);
    });
  }

  Future<void> _searchPatient() async {
    final q = _phoneCtrl.text.trim().isNotEmpty
        ? _phoneCtrl.text.trim()
        : _emailCtrl.text.trim();
    if (q.isEmpty) return;
    try {
      final data = await ApiClient.instance.get(
        '/api/receptionist/patient-search?q=$q',
        auth: true,
      );
      setState(() => _searchResults = data['patients'] ?? []);
      if (_searchResults.isNotEmpty) {
        final patient = _searchResults.first;
        _nameCtrl.text = patient['name'] ?? '';
        _phoneCtrl.text = patient['phone'] ?? '';
        _emailCtrl.text = patient['email'] ?? '';
        await _saveDraft();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Search failed: $e')));
    }
  }

  Future<void> _init() async {
    setState(() => _loading = true);
    try {
      await _restoreDraft();
      await _loadProfile();
      await _loadSessions();
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
    _nameCtrl.addListener(_saveDraft);
    _phoneCtrl.addListener(_saveDraft);
    _emailCtrl.addListener(_saveDraft);
    _reasonCtrl.addListener(_saveDraft);
    _init();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null) {
      setState(() => _date = picked);
      await _loadSessions();
      await _saveDraft();
    }
  }

  Future<void> _submit() async {
    final name = _nameCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    final email = _emailCtrl.text.trim();
    if (name.isEmpty || (phone.isEmpty && email.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name and phone or email required')),
      );
      return;
    }
    if (_sessionId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a session')),
      );
      return;
    }
    final dateStr =
        '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.post('/api/receptionist/walkin', {
        'name': name,
        'phone': phone.isEmpty ? null : phone,
        'email': email.isEmpty ? null : email,
        'appointment_date': dateStr,
        'session_id': _sessionId,
        'priority_level': _priority ? 'priority' : 'normal',
        'reason_for_visit': _reasonCtrl.text.trim(),
      }, auth: true);
      if (!mounted) return;
      final queuedOffline = res['offlineQueued'] == true;
      final queue = res['queue_number'];
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            queuedOffline
                ? 'Walk-in saved offline and queued for sync.'
                : 'Walk-in booked. Queue #$queue',
          ),
        ),
      );
      await DraftStore.clear(_walkinDraftKey);
      _nameCtrl.clear();
      _phoneCtrl.clear();
      _emailCtrl.clear();
      _reasonCtrl.clear();
      setState(() => _priority = false);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Booking failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Walk-in Booking')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_profile != null) ...[
                  Text(
                    '${_profile!['clinic_name']} - ${_profile!['doctor_name']}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 12),
                ],
                const Text(
                  'Walk-in details stay saved on this device while offline and sync when internet returns.',
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Patient Name'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _phoneCtrl,
                  decoration: const InputDecoration(labelText: 'Phone'),
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _emailCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Email (optional)'),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton(
                    onPressed: _searchPatient,
                    child: const Text('Search Existing Patient'),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _pickDate,
                        child: Text(
                          '${_date.day}-${_date.month}-${_date.year}',
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        value: _sessionId,
                        items: _sessions
                            .map(
                              (session) => DropdownMenuItem(
                                value: session['session_id'],
                                child: Text(
                                  '${session['label']} (${session['start_time']} - ${session['end_time']})',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          setState(() => _sessionId = value);
                          _saveDraft();
                        },
                        decoration:
                            const InputDecoration(labelText: 'Session'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _reasonCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Reason (optional)'),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  value: _priority,
                  onChanged: (value) {
                    setState(() => _priority = value);
                    _saveDraft();
                  },
                  title: const Text('Priority'),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _submit,
                  child: const Text('Create Walk-in'),
                ),
              ],
            ),
    );
  }
}
