import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/services/auth_store.dart';

class StaffRolesPage extends StatefulWidget {
  const StaffRolesPage({super.key});

  @override
  State<StaffRolesPage> createState() => _StaffRolesPageState();
}

class _StaffRolesPageState extends State<StaffRolesPage> {
  List<dynamic> _roles = [];
  List<dynamic> _perms = [];
  List<dynamic> _clinics = [];
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
      final role = AuthStore.user?['role'] ?? '';
      final p = await ApiClient.instance.get('/api/org/permissions', auth: true);
      final perms = (p['permissions'] as List?) ?? [];
      final filtered = perms.where((x) {
        final code = x['code'] ?? '';
        if (role == 'doctor') return code.toString().startsWith('receptionist.') || code.toString().startsWith('doctor.');
        if (role == 'laboratory') return code.toString().startsWith('lab.');
        if (role == 'pharmacist') return code.toString().startsWith('pharmacy.');
        return false;
      }).toList();
      final roles = await ApiClient.instance.get(
        '/api/org/roles${_clinicId != null ? '?clinic_id=$_clinicId' : ''}',
        auth: true,
      );
      setState(() {
        _perms = filtered;
        _roles = roles['roles'] ?? [];
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
    final descCtrl = TextEditingController();
    final selected = <int>{};

    await showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Create Role'),
          content: SingleChildScrollView(
            child: Column(
              children: [
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Role Name')),
                TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Description')),
                const SizedBox(height: 8),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Permissions', style: TextStyle(fontWeight: FontWeight.w600)),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 260,
                  child: ListView(
                    children: _perms.map((p) {
                      final id = p['id'];
                      final checked = selected.contains(id);
                      return CheckboxListTile(
                        value: checked,
                        onChanged: (v) {
                          setState(() {
                            if (v == true) {
                              selected.add(id);
                            } else {
                              selected.remove(id);
                            }
                          });
                        },
                        title: Text(p['code'] ?? ''),
                        subtitle: Text(p['description'] ?? ''),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            TextButton(
              onPressed: () async {
                try {
                  await ApiClient.instance.post('/api/org/roles', {
                    'name': nameCtrl.text.trim(),
                    'description': descCtrl.text.trim(),
                    'permission_ids': selected.toList(),
                    'clinic_id': _clinicId,
                  }, auth: true);
                  if (!mounted) return;
                  Navigator.pop(ctx);
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
      appBar: AppBar(title: const Text('Staff Roles')),
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
                  child: _roles.isEmpty
                      ? const Center(child: Text('No roles'))
                      : ListView.builder(
                          itemCount: _roles.length,
                          itemBuilder: (_, i) {
                            final r = (_roles[i] as Map?)?.cast<String, dynamic>() ?? {};
                            return ListTile(
                              title: Text(r['name'] ?? 'Role'),
                              subtitle: Text(r['description'] ?? ''),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
