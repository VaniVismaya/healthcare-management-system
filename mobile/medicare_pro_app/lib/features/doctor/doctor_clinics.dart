import 'package:flutter/material.dart';
import 'package:csc_picker/csc_picker.dart';
import '../../core/api/api_client.dart';

class DoctorClinicsPage extends StatefulWidget {
  const DoctorClinicsPage({super.key});

  @override
  State<DoctorClinicsPage> createState() => _DoctorClinicsPageState();
}

class _DoctorClinicsPageState extends State<DoctorClinicsPage> {
  List<dynamic> _clinics = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/clinics', auth: true);
      setState(() => _clinics = data['clinics'] ?? []);
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

  Future<void> _openForm({Map<String, dynamic>? clinic}) async {
    final nameCtrl = TextEditingController(text: clinic?['name'] ?? '');
    final addressCtrl = TextEditingController(text: clinic?['address'] ?? '');
    final pinCtrl = TextEditingController(text: clinic?['pincode'] ?? '');
    final phoneCtrl = TextEditingController(text: clinic?['phone'] ?? '');
    final emailCtrl = TextEditingController(text: clinic?['email'] ?? '');
    String? countryVal = clinic?['country'];
    String? stateVal = clinic?['state'];
    String? cityVal = clinic?['city'];

    await showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text(clinic == null ? 'Add Clinic' : 'Edit Clinic'),
          content: SingleChildScrollView(
            child: Column(
              children: [
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Clinic Name')),
                TextField(controller: addressCtrl, decoration: const InputDecoration(labelText: 'Address')),
                const SizedBox(height: 8),
                CSCPicker(
                  layout: Layout.vertical,
                  currentCountry: countryVal,
                  currentState: stateVal,
                  currentCity: cityVal,
                  countryDropdownLabel: 'Select Country',
                  stateDropdownLabel: 'Select State',
                  cityDropdownLabel: 'Select City',
                  onCountryChanged: (v) => setState(() {
                    countryVal = v;
                    stateVal = null;
                    cityVal = null;
                  }),
                  onStateChanged: (v) => setState(() {
                    stateVal = v;
                    cityVal = null;
                  }),
                  onCityChanged: (v) => setState(() => cityVal = v),
                ),
                TextField(controller: pinCtrl, decoration: const InputDecoration(labelText: 'Pincode')),
                TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Phone')),
                TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email')),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            TextButton(
              onPressed: () async {
                final payload = {
                  'name': nameCtrl.text.trim(),
                  'address': addressCtrl.text.trim(),
                  'country': countryVal ?? '',
                  'city': cityVal ?? '',
                  'state': stateVal ?? '',
                  'pincode': pinCtrl.text.trim(),
                  'phone': phoneCtrl.text.trim(),
                  'email': emailCtrl.text.trim(),
                };
                try {
                  if (clinic == null) {
                    await ApiClient.instance.post('/api/clinics', payload, auth: true);
                  } else {
                    await ApiClient.instance.post('/api/clinics/${clinic['id']}', payload, auth: true);
                  }
                  if (!mounted) return;
                  Navigator.pop(context);
                  await _load();
                } catch (e) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text('Save failed: $e')));
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Clinics')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _clinics.length,
              itemBuilder: (_, i) {
                final c = (_clinics[i] as Map?)?.cast<String, dynamic>() ?? {};
                return ListTile(
                  title: Text(c['name'] ?? 'Clinic'),
                  subtitle: Text('${c['city'] ?? ''} • ${c['state'] ?? ''}'),
                  trailing: TextButton(
                    onPressed: () => _openForm(clinic: c),
                    child: const Text('Edit'),
                  ),
                );
              },
            ),
    );
  }
}
