import 'package:csc_picker/csc_picker.dart';
import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/services/draft_store.dart';
import '../shared/remote_asset_preview.dart';

const _pharmacyProfileDraftKey = 'pharmacy_profile_mobile_draft';

class PharmacyProfilePage extends StatefulWidget {
  const PharmacyProfilePage({super.key});

  @override
  State<PharmacyProfilePage> createState() => _PharmacyProfilePageState();
}

class _PharmacyProfilePageState extends State<PharmacyProfilePage> {
  Map<String, dynamic>? _profile;
  bool _loading = false;
  bool _hydratingDraft = false;

  final _nameCtrl = TextEditingController();
  final _pharmacyCtrl = TextEditingController();
  final _licenseCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _gstCtrl = TextEditingController();
  String? _country;
  String? _state;
  String? _city;

  Future<void> _saveDraft() async {
    if (_hydratingDraft) return;
    await DraftStore.save(_pharmacyProfileDraftKey, {
      'name': _nameCtrl.text.trim(),
      'pharmacy_name': _pharmacyCtrl.text.trim(),
      'license_number': _licenseCtrl.text.trim(),
      'address': _addressCtrl.text.trim(),
      'country': _country,
      'state': _state,
      'city': _city,
      'pincode': _pinCtrl.text.trim(),
      'phone': _phoneCtrl.text.trim(),
      'gstin': _gstCtrl.text.trim(),
    });
  }

  void _bindListeners() {
    _nameCtrl.addListener(_saveDraft);
    _pharmacyCtrl.addListener(_saveDraft);
    _licenseCtrl.addListener(_saveDraft);
    _addressCtrl.addListener(_saveDraft);
    _pinCtrl.addListener(_saveDraft);
    _phoneCtrl.addListener(_saveDraft);
    _gstCtrl.addListener(_saveDraft);
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final draft = await DraftStore.load(_pharmacyProfileDraftKey);
      final data =
          await ApiClient.instance.get('/api/pharmacy/profile', auth: true);
      final profileData = data['profile'] ?? data['pharmacist'];
      final profile = (profileData as Map?)?.cast<String, dynamic>();
      setState(() => _profile = profile);
      _hydratingDraft = true;
      if (profile != null) {
        _nameCtrl.text = profile['name'] ?? '';
        _pharmacyCtrl.text = profile['pharmacy_name'] ?? '';
        _licenseCtrl.text = profile['license_number'] ?? '';
        _addressCtrl.text = profile['address'] ?? '';
        _city = profile['city'];
        _state = profile['state'];
        _country = profile['country'];
        _pinCtrl.text = profile['pincode'] ?? '';
        _phoneCtrl.text = profile['pharmacy_phone'] ?? '';
        _gstCtrl.text = profile['gstin'] ?? '';
      }
      if (draft != null) {
        _nameCtrl.text = draft['name']?.toString() ?? _nameCtrl.text;
        _pharmacyCtrl.text =
            draft['pharmacy_name']?.toString() ?? _pharmacyCtrl.text;
        _licenseCtrl.text =
            draft['license_number']?.toString() ?? _licenseCtrl.text;
        _addressCtrl.text = draft['address']?.toString() ?? _addressCtrl.text;
        _country = draft['country']?.toString() ?? _country;
        _state = draft['state']?.toString() ?? _state;
        _city = draft['city']?.toString() ?? _city;
        _pinCtrl.text = draft['pincode']?.toString() ?? _pinCtrl.text;
        _phoneCtrl.text = draft['phone']?.toString() ?? _phoneCtrl.text;
        _gstCtrl.text = draft['gstin']?.toString() ?? _gstCtrl.text;
      }
      _hydratingDraft = false;
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
      final res = await ApiClient.instance.post('/api/pharmacy/profile', {
        'name': _nameCtrl.text.trim(),
        'pharmacy_name': _pharmacyCtrl.text.trim(),
        'license_number': _licenseCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'country': _country ?? '',
        'city': _city ?? '',
        'state': _state ?? '',
        'pincode': _pinCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'gstin': _gstCtrl.text.trim(),
      }, auth: true);
      await DraftStore.clear(_pharmacyProfileDraftKey);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            res['offlineQueued'] == true
                ? 'Pharmacy profile saved offline and queued for sync.'
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
    _bindListeners();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _pharmacyCtrl.dispose();
    _licenseCtrl.dispose();
    _addressCtrl.dispose();
    _pinCtrl.dispose();
    _phoneCtrl.dispose();
    _gstCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pharmacy Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'Pharmacy profile text stays saved on this device while offline and syncs when internet returns.',
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
                  controller: _pharmacyCtrl,
                  decoration: const InputDecoration(labelText: 'Pharmacy Name'),
                ),
                TextField(
                  controller: _licenseCtrl,
                  decoration: const InputDecoration(labelText: 'License Number'),
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
                    _saveDraft();
                  },
                  onStateChanged: (value) {
                    setState(() {
                      _state = value;
                      _city = null;
                    });
                    _saveDraft();
                  },
                  onCityChanged: (value) {
                    setState(() => _city = value);
                    _saveDraft();
                  },
                ),
                TextField(
                  controller: _pinCtrl,
                  decoration: const InputDecoration(labelText: 'Pincode'),
                ),
                TextField(
                  controller: _phoneCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Pharmacy Phone'),
                ),
                TextField(
                  controller: _gstCtrl,
                  decoration: const InputDecoration(labelText: 'GSTIN'),
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
