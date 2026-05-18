import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/services/draft_store.dart';
import '../shared/remote_asset_preview.dart';

const _doctorProfileDraftKey = 'doctor_profile_mobile_draft';

class DoctorProfilePage extends StatefulWidget {
  const DoctorProfilePage({super.key});

  @override
  State<DoctorProfilePage> createState() => _DoctorProfilePageState();
}

class _DoctorProfilePageState extends State<DoctorProfilePage> {
  Map<String, dynamic>? _profile;
  bool _loading = false;
  bool _hydratingDraft = false;
  List<dynamic> _departments = [];

  final _nameCtrl = TextEditingController();
  final _specCtrl = TextEditingController();
  final _qualCtrl = TextEditingController();
  final _licenseCtrl = TextEditingController();
  final _expCtrl = TextEditingController();
  final _feeCtrl = TextEditingController();
  final _langCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();

  Future<void> _saveDraft() async {
    if (_hydratingDraft) return;
    await DraftStore.save(_doctorProfileDraftKey, {
      'name': _nameCtrl.text.trim(),
      'specialization': _specCtrl.text.trim(),
      'qualification': _qualCtrl.text.trim(),
      'medical_license_number': _licenseCtrl.text.trim(),
      'experience_years': _expCtrl.text.trim(),
      'consultation_fee': _feeCtrl.text.trim(),
      'languages': _langCtrl.text.trim(),
      'bio': _bioCtrl.text.trim(),
    });
  }

  void _bindDraftListeners() {
    _nameCtrl.addListener(_saveDraft);
    _specCtrl.addListener(_saveDraft);
    _qualCtrl.addListener(_saveDraft);
    _licenseCtrl.addListener(_saveDraft);
    _expCtrl.addListener(_saveDraft);
    _feeCtrl.addListener(_saveDraft);
    _langCtrl.addListener(_saveDraft);
    _bioCtrl.addListener(_saveDraft);
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final draft = await DraftStore.load(_doctorProfileDraftKey);
      final data = await ApiClient.instance.get('/api/doctor/profile', auth: true);
      final profileData = data['profile'] ?? data['doctor'];
      final profile = (profileData as Map?)?.cast<String, dynamic>();

      _hydratingDraft = true;
      setState(() => _profile = profile);
      if (profile != null) {
        _nameCtrl.text = profile['name'] ?? '';
        _specCtrl.text = profile['specialization'] ?? '';
        _qualCtrl.text = profile['qualification'] ?? '';
        _licenseCtrl.text = profile['medical_license_number'] ?? '';
        _expCtrl.text = profile['experience_years']?.toString() ?? '';
        _feeCtrl.text = profile['consultation_fee']?.toString() ?? '';
        _langCtrl.text = profile['languages'] ?? '';
        _bioCtrl.text = profile['bio'] ?? '';
      }
      if (draft != null) {
        _nameCtrl.text = draft['name']?.toString() ?? _nameCtrl.text;
        _specCtrl.text = draft['specialization']?.toString() ?? _specCtrl.text;
        _qualCtrl.text = draft['qualification']?.toString() ?? _qualCtrl.text;
        _licenseCtrl.text =
            draft['medical_license_number']?.toString() ?? _licenseCtrl.text;
        _expCtrl.text = draft['experience_years']?.toString() ?? _expCtrl.text;
        _feeCtrl.text = draft['consultation_fee']?.toString() ?? _feeCtrl.text;
        _langCtrl.text = draft['languages']?.toString() ?? _langCtrl.text;
        _bioCtrl.text = draft['bio']?.toString() ?? _bioCtrl.text;
      }
      _hydratingDraft = false;

      try {
        final deps =
            await ApiClient.instance.get('/api/departments', auth: true);
        if (mounted) setState(() => _departments = deps['departments'] ?? []);
      } catch (_) {
        if (mounted) setState(() => _departments = []);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      _hydratingDraft = false;
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    try {
      final res = await ApiClient.instance.post('/api/doctor/profile', {
        'name': _nameCtrl.text.trim(),
        'specialization': _specCtrl.text.trim(),
        'qualification': _qualCtrl.text.trim(),
        'medical_license_number': _licenseCtrl.text.trim(),
        'experience_years': int.tryParse(_expCtrl.text.trim()) ?? 0,
        'consultation_fee': double.tryParse(_feeCtrl.text.trim()) ?? 0,
        'languages': _langCtrl.text.trim(),
        'bio': _bioCtrl.text.trim(),
      }, auth: true);
      await DraftStore.clear(_doctorProfileDraftKey);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            res['offlineQueued'] == true
                ? 'Profile saved offline and queued for sync.'
                : 'Profile updated',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Save failed: $e')));
    }
  }

  @override
  void initState() {
    super.initState();
    _bindDraftListeners();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _specCtrl.dispose();
    _qualCtrl.dispose();
    _licenseCtrl.dispose();
    _expCtrl.dispose();
    _feeCtrl.dispose();
    _langCtrl.dispose();
    _bioCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Doctor Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'Profile text changes stay saved on this device while offline and sync when internet returns.',
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Full Name'),
                ),
                TextField(
                  decoration: InputDecoration(
                    labelText: 'Email (read-only)',
                    hintText: _profile?['email'] ?? '',
                  ),
                  enabled: false,
                ),
                TextField(
                  decoration: InputDecoration(
                    labelText: 'Phone (read-only)',
                    hintText: _profile?['phone'] ?? '',
                  ),
                  enabled: false,
                ),
                const SizedBox(height: 8),
                _departments.isNotEmpty
                    ? DropdownButtonFormField<String>(
                        value: _specCtrl.text.isEmpty ? null : _specCtrl.text,
                        items: _departments
                            .map(
                              (department) => DropdownMenuItem(
                                value: department['name'],
                                child: Text(
                                  department['name'] ?? 'Department',
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          setState(() => _specCtrl.text = value ?? '');
                          _saveDraft();
                        },
                        decoration:
                            const InputDecoration(labelText: 'Specialization'),
                      )
                    : TextField(
                        controller: _specCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Specialization'),
                      ),
                TextField(
                  controller: _qualCtrl,
                  decoration: const InputDecoration(labelText: 'Qualification'),
                ),
                TextField(
                  controller: _licenseCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Medical License Number',
                  ),
                ),
                TextField(
                  controller: _expCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Experience (Years)'),
                ),
                TextField(
                  controller: _feeCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Consultation Fee'),
                ),
                TextField(
                  controller: _langCtrl,
                  decoration: const InputDecoration(labelText: 'Languages'),
                ),
                TextField(
                  controller: _bioCtrl,
                  decoration: const InputDecoration(labelText: 'Bio'),
                ),
                RemoteAssetPreview(
                  label: 'Saved Profile Photo',
                  path: _profile?['profile_image']?.toString(),
                ),
                RemoteAssetPreview(
                  label: 'Saved License Certificate',
                  path: _profile?['license_certificate_path']?.toString(),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: _save,
                  child: const Text('Save Profile'),
                ),
              ],
            ),
    );
  }
}
