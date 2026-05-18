import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/services/auth_store.dart';

class StaffAccountsPage extends StatefulWidget {
  const StaffAccountsPage({super.key});

  @override
  State<StaffAccountsPage> createState() => _StaffAccountsPageState();
}

class _StaffAccountsPageState extends State<StaffAccountsPage> {
  List<dynamic> _staff = [];
  List<dynamic> _roles = [];
  List<dynamic> _clinics = [];
  List<dynamic> _departments = [];
  int? _clinicId;
  bool _loading = false;

  Future<void> _loadClinics() async {
    if (AuthStore.user?['role'] != 'doctor') return;
    final data = await ApiClient.instance.get('/api/clinics', auth: true);
    setState(() {
      _clinics = data['clinics'] ?? [];
      if (_clinics.isNotEmpty && _clinicId == null) _clinicId = _clinics.first['id'];
    });
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      await _loadClinics();
      List<dynamic> deptsData = [];
      if (AuthStore.user?['role'] == 'laboratory') {
        final depts = await ApiClient.instance.get('/api/lab/departments', auth: true);
        deptsData = depts['departments'] ?? [];
      }
      final roles = await ApiClient.instance.get(
        '/api/org/roles${_clinicId != null ? '?clinic_id=$_clinicId' : ''}',
        auth: true,
      );
      final staff = await ApiClient.instance.get(
        '/api/org/staff${_clinicId != null ? '?clinic_id=$_clinicId' : ''}',
        auth: true,
      );
      setState(() {
        _roles = roles['roles'] ?? [];
        _staff = staff['staff'] ?? [];
        _departments = deptsData;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openCreate() async {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    int? roleId = _roles.isNotEmpty ? _roles.first['id'] : null;
    final selectedDepts = <int>[];

    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Create Staff'),
        content: SingleChildScrollView(
          child: Column(
            children: [
              if (_clinics.isNotEmpty)
                DropdownButtonFormField<int>(
                  value: _clinicId,
                  items: _clinics
                      .map((c) => DropdownMenuItem(
                            value: c['id'],
                            child: Text(c['name'] ?? 'Clinic'),
                          ))
                      .toList(),
                  onChanged: (v) => _clinicId = v,
                  decoration: const InputDecoration(labelText: 'Clinic'),
                ),
              DropdownButtonFormField<int>(
                value: roleId,
                items: _roles
                    .map((r) => DropdownMenuItem(
                          value: r['id'],
                          child: Text(r['name'] ?? 'Role'),
                        ))
                    .toList(),
                onChanged: (v) => roleId = v,
                decoration: const InputDecoration(labelText: 'Role'),
              ),
              if (AuthStore.user?['role'] == 'laboratory' && _departments.isNotEmpty)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),
                    const Text('Departments (optional)'),
                    ..._departments.map((d) {
                      return CheckboxListTile(
                        value: selectedDepts.contains(d['id']),
                        onChanged: (v) {
                          setState(() {
                            if (v == true) {
                              selectedDepts.add(d['id']);
                            } else {
                              selectedDepts.remove(d['id']);
                            }
                          });
                        },
                        title: Text(d['name'] ?? 'Department'),
                        controlAffinity: ListTileControlAffinity.leading,
                      );
                    }).toList(),
                  ],
                ),
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name')),
              TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Phone')),
              TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              try {
                final res = await ApiClient.instance.post('/api/org/staff', {
                  'name': nameCtrl.text.trim(),
                  'phone': phoneCtrl.text.trim(),
                  'email': emailCtrl.text.trim(),
                  'org_role_id': roleId,
                  'clinic_id': _clinicId,
                  'department_ids': selectedDepts,
                }, auth: true);
                if (!mounted) return;
                Navigator.pop(context);
                final pwd = res['password'] ?? 'Staff@123';
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Staff created. Password: $pwd')),
                );
                await _load();
              } catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Create failed: $e')));
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Staff Accounts')),
      floatingActionButton: FloatingActionButton(
        onPressed: _openCreate,
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_clinics.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: DropdownButtonFormField<int>(
                      value: _clinicId,
                      items: _clinics
                          .map((c) => DropdownMenuItem(
                                value: c['id'],
                                child: Text(c['name'] ?? 'Clinic'),
                              ))
                          .toList(),
                      onChanged: (v) {
                        setState(() => _clinicId = v);
                        _load();
                      },
                      decoration: const InputDecoration(labelText: 'Clinic'),
                    ),
                  ),
                Expanded(
                  child: _staff.isEmpty
                      ? const Center(child: Text('No staff'))
                      : ListView.builder(
                          itemCount: _staff.length,
                          itemBuilder: (_, i) {
                            final s = (_staff[i] as Map?)?.cast<String, dynamic>() ?? {};
                            return ListTile(
                              title: Text(s['name'] ?? 'Staff'),
                              subtitle: Text(s['role_name'] ?? ''),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
