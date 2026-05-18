import 'package:flutter/material.dart';
import 'package:csc_picker/csc_picker.dart';

import '../../core/api/api_client.dart';
import '../shared/remote_asset_preview.dart';

class LabProfilePage extends StatefulWidget {
  const LabProfilePage({super.key});

  @override
  State<LabProfilePage> createState() => _LabProfilePageState();
}

class _LabProfilePageState extends State<LabProfilePage> {
  Map<String, dynamic>? _profile;
  bool _loading = false;

  final _nameCtrl = TextEditingController();
  final _regCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _startCtrl = TextEditingController();
  final _endCtrl = TextEditingController();
  final _daysCtrl = TextEditingController();
  String? _country;
  String? _state;
  String? _city;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/lab/profile', auth: true);
      final profileData = data['profile'] ?? data['lab'];
      final p = (profileData as Map?)?.cast<String, dynamic>();
      setState(() => _profile = p);
      if (p != null) {
        _nameCtrl.text = p['lab_name'] ?? '';
        _regCtrl.text = p['registration_number'] ?? '';
        _addressCtrl.text = p['address'] ?? '';
        _city = p['city'];
        _state = p['state'];
        _country = p['country'];
        _pinCtrl.text = p['pincode'] ?? '';
        _phoneCtrl.text = p['phone'] ?? '';
        _emailCtrl.text = p['email'] ?? '';
        _startCtrl.text = p['working_hours_start'] ?? '';
        _endCtrl.text = p['working_hours_end'] ?? '';
        _daysCtrl.text = p['working_days'] ?? '';
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    try {
      await ApiClient.instance.post('/api/lab/profile', {
        'lab_name': _nameCtrl.text.trim(),
        'registration_number': _regCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'country': _country ?? '',
        'city': _city ?? '',
        'state': _state ?? '',
        'pincode': _pinCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'working_hours_start': _startCtrl.text.trim(),
        'working_hours_end': _endCtrl.text.trim(),
        'working_days': _daysCtrl.text.trim(),
      }, auth: true);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Profile updated')));
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
      appBar: AppBar(title: const Text('Lab Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Lab Name')),
                TextField(controller: _regCtrl, decoration: const InputDecoration(labelText: 'Registration Number')),
                TextField(controller: _addressCtrl, decoration: const InputDecoration(labelText: 'Address')),
                const SizedBox(height: 8),
                CSCPicker(
                  layout: Layout.vertical,
                  currentCountry: _country,
                  currentState: _state,
                  currentCity: _city,
                  countryDropdownLabel: 'Select Country',
                  stateDropdownLabel: 'Select State',
                  cityDropdownLabel: 'Select City',
                  onCountryChanged: (v) => setState(() {
                    _country = v;
                    _state = null;
                    _city = null;
                  }),
                  onStateChanged: (v) => setState(() {
                    _state = v;
                    _city = null;
                  }),
                  onCityChanged: (v) => setState(() => _city = v),
                ),
                TextField(controller: _pinCtrl, decoration: const InputDecoration(labelText: 'Pincode')),
                TextField(controller: _phoneCtrl, decoration: const InputDecoration(labelText: 'Phone')),
                TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email')),
                TextField(controller: _startCtrl, decoration: const InputDecoration(labelText: 'Working Hours Start (HH:MM)')),
                TextField(controller: _endCtrl, decoration: const InputDecoration(labelText: 'Working Hours End (HH:MM)')),
                TextField(controller: _daysCtrl, decoration: const InputDecoration(labelText: 'Working Days (Mon,Tue,...)')),
                RemoteAssetPreview(
                  label: 'Saved Profile Photo',
                  path: _profile?['profile_image']?.toString(),
                ),
                RemoteAssetPreview(
                  label: 'Saved Registration Certificate',
                  path: _profile?['certificate_path']?.toString(),
                ),
                const SizedBox(height: 12),
                ElevatedButton(onPressed: _save, child: const Text('Save Profile')),
              ],
            ),
    );
  }
}
