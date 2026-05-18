import 'package:csc_picker/csc_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/services/draft_store.dart';

const _patientProfileDraftKey = 'patient_profile_mobile_draft';
const _patientInsuranceDraftKey = 'patient_insurance_mobile_draft';

class PatientProfilePage extends StatefulWidget {
  const PatientProfilePage({super.key});

  @override
  State<PatientProfilePage> createState() => _PatientProfilePageState();
}

class _PatientProfilePageState extends State<PatientProfilePage> {
  Map<String, dynamic>? _profile;
  bool _loading = false;
  bool _hydratingDraft = false;

  final _nameCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _genderCtrl = TextEditingController();
  final _bloodCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _pincodeCtrl = TextEditingController();
  final _emgNameCtrl = TextEditingController();
  final _emgPhoneCtrl = TextEditingController();
  final _allergiesCtrl = TextEditingController();
  final _chronicCtrl = TextEditingController();

  List<dynamic> _policies = [];
  final _providerCtrl = TextEditingController();
  final _policyNumberCtrl = TextEditingController();
  final _planCtrl = TextEditingController();
  final _validFromCtrl = TextEditingController();
  final _validToCtrl = TextEditingController();
  String? _docPath;
  String? _country;
  String? _state;
  String? _city;

  Future<void> _saveProfileDraft() async {
    if (_hydratingDraft) return;
    await DraftStore.save(_patientProfileDraftKey, {
      'name': _nameCtrl.text.trim(),
      'date_of_birth': _dobCtrl.text.trim(),
      'gender': _genderCtrl.text.trim(),
      'blood_group': _bloodCtrl.text.trim(),
      'address': _addressCtrl.text.trim(),
      'country': _country,
      'state': _state,
      'city': _city,
      'pincode': _pincodeCtrl.text.trim(),
      'emergency_contact_name': _emgNameCtrl.text.trim(),
      'emergency_contact_phone': _emgPhoneCtrl.text.trim(),
      'allergies': _allergiesCtrl.text.trim(),
      'chronic_conditions': _chronicCtrl.text.trim(),
    });
  }

  Future<void> _saveInsuranceDraft() async {
    if (_hydratingDraft) return;
    await DraftStore.save(_patientInsuranceDraftKey, {
      'provider': _providerCtrl.text.trim(),
      'policy_number': _policyNumberCtrl.text.trim(),
      'plan_name': _planCtrl.text.trim(),
      'valid_from': _validFromCtrl.text.trim(),
      'valid_to': _validToCtrl.text.trim(),
    });
  }

  void _bindDraftListeners() {
    final profileListeners = [
      _nameCtrl,
      _dobCtrl,
      _genderCtrl,
      _bloodCtrl,
      _addressCtrl,
      _pincodeCtrl,
      _emgNameCtrl,
      _emgPhoneCtrl,
      _allergiesCtrl,
      _chronicCtrl,
    ];
    for (final controller in profileListeners) {
      controller.addListener(_saveProfileDraft);
    }

    final insuranceListeners = [
      _providerCtrl,
      _policyNumberCtrl,
      _planCtrl,
      _validFromCtrl,
      _validToCtrl,
    ];
    for (final controller in insuranceListeners) {
      controller.addListener(_saveInsuranceDraft);
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final profileDraft = await DraftStore.load(_patientProfileDraftKey);
      final insuranceDraft = await DraftStore.load(_patientInsuranceDraftKey);
      final data =
          await ApiClient.instance.get('/api/patient/profile', auth: true);
      final profile = (data['profile'] as Map?)?.cast<String, dynamic>();

      _hydratingDraft = true;
      setState(() => _profile = profile);
      if (profile != null) {
        _nameCtrl.text = profile['name'] ?? '';
        _dobCtrl.text = profile['date_of_birth'] ?? '';
        _genderCtrl.text = profile['gender'] ?? '';
        _bloodCtrl.text = profile['blood_group'] ?? '';
        _addressCtrl.text = profile['address'] ?? '';
        _city = profile['city'];
        _state = profile['state'];
        _country = profile['country'];
        _pincodeCtrl.text = profile['pincode'] ?? '';
        _emgNameCtrl.text = profile['emergency_contact_name'] ?? '';
        _emgPhoneCtrl.text = profile['emergency_contact_phone'] ?? '';
        _allergiesCtrl.text = profile['allergies'] ?? '';
        _chronicCtrl.text = profile['chronic_conditions'] ?? '';
      }

      if (profileDraft != null) {
        _nameCtrl.text = profileDraft['name']?.toString() ?? _nameCtrl.text;
        _dobCtrl.text =
            profileDraft['date_of_birth']?.toString() ?? _dobCtrl.text;
        _genderCtrl.text = profileDraft['gender']?.toString() ?? _genderCtrl.text;
        _bloodCtrl.text =
            profileDraft['blood_group']?.toString() ?? _bloodCtrl.text;
        _addressCtrl.text =
            profileDraft['address']?.toString() ?? _addressCtrl.text;
        _country = profileDraft['country']?.toString() ?? _country;
        _state = profileDraft['state']?.toString() ?? _state;
        _city = profileDraft['city']?.toString() ?? _city;
        _pincodeCtrl.text =
            profileDraft['pincode']?.toString() ?? _pincodeCtrl.text;
        _emgNameCtrl.text = profileDraft['emergency_contact_name']?.toString() ??
            _emgNameCtrl.text;
        _emgPhoneCtrl.text =
            profileDraft['emergency_contact_phone']?.toString() ??
                _emgPhoneCtrl.text;
        _allergiesCtrl.text =
            profileDraft['allergies']?.toString() ?? _allergiesCtrl.text;
        _chronicCtrl.text = profileDraft['chronic_conditions']?.toString() ??
            _chronicCtrl.text;
      }

      if (insuranceDraft != null) {
        _providerCtrl.text =
            insuranceDraft['provider']?.toString() ?? _providerCtrl.text;
        _policyNumberCtrl.text = insuranceDraft['policy_number']?.toString() ??
            _policyNumberCtrl.text;
        _planCtrl.text =
            insuranceDraft['plan_name']?.toString() ?? _planCtrl.text;
        _validFromCtrl.text =
            insuranceDraft['valid_from']?.toString() ?? _validFromCtrl.text;
        _validToCtrl.text =
            insuranceDraft['valid_to']?.toString() ?? _validToCtrl.text;
      }
      _hydratingDraft = false;

      await _loadPolicies();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      _hydratingDraft = false;
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadPolicies() async {
    try {
      final data =
          await ApiClient.instance.get('/api/patient/insurance', auth: true);
      final list = data['policies'] as List? ?? [];
      if (mounted) setState(() => _policies = list);
    } catch (_) {
      if (mounted) setState(() => _policies = []);
    }
  }

  Future<void> _pickDoc() async {
    final res = await FilePicker.platform.pickFiles();
    if (res != null && res.files.isNotEmpty) {
      setState(() => _docPath = res.files.single.path);
    }
  }

  Future<void> _saveInsurance() async {
    try {
      await ApiClient.instance.postMultipart(
        '/api/patient/insurance',
        {
          'provider': _providerCtrl.text.trim(),
          'policy_number': _policyNumberCtrl.text.trim(),
          'plan_name': _planCtrl.text.trim(),
          'valid_from': _validFromCtrl.text.trim(),
          'valid_to': _validToCtrl.text.trim(),
        },
        filePath: _docPath,
        auth: true,
      );
      await DraftStore.clear(_patientInsuranceDraftKey);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Insurance saved')));
      _providerCtrl.clear();
      _policyNumberCtrl.clear();
      _planCtrl.clear();
      _validFromCtrl.clear();
      _validToCtrl.clear();
      setState(() => _docPath = null);
      _loadPolicies();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Save failed: $e')));
    }
  }

  Future<void> _save() async {
    try {
      final res = await ApiClient.instance.post('/api/patient/profile', {
        'name': _nameCtrl.text.trim(),
        'date_of_birth': _dobCtrl.text.trim(),
        'gender': _genderCtrl.text.trim(),
        'blood_group': _bloodCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'country': _country ?? '',
        'city': _city ?? '',
        'state': _state ?? '',
        'pincode': _pincodeCtrl.text.trim(),
        'emergency_contact_name': _emgNameCtrl.text.trim(),
        'emergency_contact_phone': _emgPhoneCtrl.text.trim(),
        'allergies': _allergiesCtrl.text.trim(),
        'chronic_conditions': _chronicCtrl.text.trim(),
      }, auth: true);
      await DraftStore.clear(_patientProfileDraftKey);
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
    _dobCtrl.dispose();
    _genderCtrl.dispose();
    _bloodCtrl.dispose();
    _addressCtrl.dispose();
    _pincodeCtrl.dispose();
    _emgNameCtrl.dispose();
    _emgPhoneCtrl.dispose();
    _allergiesCtrl.dispose();
    _chronicCtrl.dispose();
    _providerCtrl.dispose();
    _policyNumberCtrl.dispose();
    _planCtrl.dispose();
    _validFromCtrl.dispose();
    _validToCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'Profile details stay saved on this device while offline and sync when internet returns.',
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
                TextField(
                  controller: _dobCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Date of Birth (YYYY-MM-DD)',
                  ),
                ),
                TextField(
                  controller: _genderCtrl,
                  decoration: const InputDecoration(labelText: 'Gender'),
                ),
                TextField(
                  controller: _bloodCtrl,
                  decoration: const InputDecoration(labelText: 'Blood Group'),
                ),
                TextField(
                  controller: _addressCtrl,
                  decoration: const InputDecoration(labelText: 'Address'),
                ),
                const SizedBox(height: 8),
                CSCPicker(
                  layout: Layout.vertical,
                  currentCountry: _country,
                  currentState: _state,
                  currentCity: _city,
                  countryDropdownLabel: 'Select Country',
                  stateDropdownLabel: 'Select State',
                  cityDropdownLabel: 'Select City',
                  onCountryChanged: (value) {
                    setState(() {
                      _country = value;
                      _state = null;
                      _city = null;
                    });
                    _saveProfileDraft();
                  },
                  onStateChanged: (value) {
                    setState(() {
                      _state = value;
                      _city = null;
                    });
                    _saveProfileDraft();
                  },
                  onCityChanged: (value) {
                    setState(() => _city = value);
                    _saveProfileDraft();
                  },
                ),
                TextField(
                  controller: _pincodeCtrl,
                  decoration: const InputDecoration(labelText: 'Pincode'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _emgNameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Emergency Contact Name',
                  ),
                ),
                TextField(
                  controller: _emgPhoneCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Emergency Contact Phone',
                  ),
                ),
                TextField(
                  controller: _allergiesCtrl,
                  decoration: const InputDecoration(labelText: 'Allergies'),
                ),
                TextField(
                  controller: _chronicCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Chronic Conditions'),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: _save,
                  child: const Text('Save Profile'),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Insurance & Policy (KYC)',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Insurance form details stay saved locally. KYC document upload still needs internet and may need to be reattached.',
                ),
                const SizedBox(height: 8),
                if (_policies.isEmpty)
                  const Text('No insurance policies added yet')
                else
                  ..._policies.map((policy) {
                    final provider = policy['provider'] ?? '';
                    final policyNumber = policy['policy_number'] ?? '';
                    final status = policy['status'] ?? 'pending';
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(provider),
                      subtitle: Text('Policy: $policyNumber'),
                      trailing: Text(status.toString()),
                    );
                  }).toList(),
                const Divider(),
                TextField(
                  controller: _providerCtrl,
                  decoration: const InputDecoration(labelText: 'Provider *'),
                ),
                TextField(
                  controller: _policyNumberCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Policy Number *'),
                ),
                TextField(
                  controller: _planCtrl,
                  decoration: const InputDecoration(labelText: 'Plan Name'),
                ),
                TextField(
                  controller: _validFromCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Valid From (YYYY-MM-DD)',
                  ),
                ),
                TextField(
                  controller: _validToCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Valid To (YYYY-MM-DD)'),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _pickDoc,
                  child: Text(
                    _docPath == null
                        ? 'Upload KYC Document'
                        : 'Document Selected',
                  ),
                ),
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: _saveInsurance,
                  child: const Text('Save Insurance'),
                ),
              ],
            ),
    );
  }
}
