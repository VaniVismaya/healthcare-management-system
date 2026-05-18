import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class GuestDoctorsPage extends StatefulWidget {
  const GuestDoctorsPage({super.key});

  @override
  State<GuestDoctorsPage> createState() => _GuestDoctorsPageState();
}

class _GuestDoctorsPageState extends State<GuestDoctorsPage> {
  List<dynamic> _items = [];
  List<dynamic> _clinics = [];
  List<dynamic> _departments = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/guest-doctors', auth: true);
      final c = await ApiClient.instance.get('/api/clinics', auth: true);
      final d = await ApiClient.instance.get('/api/departments', auth: true);
      setState(() {
        _items = data['guest_doctors'] ?? [];
        _clinics = c['clinics'] ?? [];
        _departments = d['departments'] ?? [];
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

  Future<void> _openAdd() async {
    if (_clinics.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Add a clinic first')));
      return;
    }
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final qualCtrl = TextEditingController();
    final licCtrl = TextEditingController();
    int? clinicId = _clinics.first['id'];
    String? specValue;

    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add Guest Doctor'),
        content: SingleChildScrollView(
          child: Column(
            children: [
              DropdownButtonFormField<int>(
                value: clinicId,
                items: _clinics
                    .map((c) => DropdownMenuItem(
                          value: c['id'],
                          child: Text(c['name'] ?? 'Clinic'),
                        ))
                    .toList(),
                onChanged: (v) => clinicId = v,
                decoration: const InputDecoration(labelText: 'Clinic'),
              ),
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name')),
              TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Phone')),
              TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email')),
              DropdownButtonFormField<String>(
                value: specValue,
                items: _departments
                    .map((d) => DropdownMenuItem(
                          value: d['name'],
                          child: Text(d['name'] ?? 'Department'),
                        ))
                    .toList(),
                onChanged: (v) => specValue = v,
                decoration: const InputDecoration(labelText: 'Specialization'),
              ),
              TextField(controller: qualCtrl, decoration: const InputDecoration(labelText: 'Qualification')),
              TextField(controller: licCtrl, decoration: const InputDecoration(labelText: 'License Number')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              try {
                final res = await ApiClient.instance.post('/api/guest-doctors', {
                  'clinic_id': clinicId,
                  'name': nameCtrl.text.trim(),
                  'phone': phoneCtrl.text.trim(),
                  'email': emailCtrl.text.trim(),
                  'specialization': specValue ?? '',
                  'qualification': qualCtrl.text.trim(),
                  'medical_license_number': licCtrl.text.trim(),
                }, auth: true);
                if (!mounted) return;
                Navigator.pop(context);
                final pwd = res['login_password'] ?? 'Guest@123';
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Guest created. Password: $pwd')),
                );
                await _load();
              } catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text('Create failed: $e')));
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Guest Doctors')),
      floatingActionButton: FloatingActionButton(
        onPressed: _openAdd,
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items.length,
              itemBuilder: (_, i) {
                final g = (_items[i] as Map?)?.cast<String, dynamic>() ?? {};
                return ListTile(
                  title: Text(g['name'] ?? 'Guest Doctor'),
                  subtitle: Text(g['specialization'] ?? ''),
                );
              },
            ),
    );
  }
}
