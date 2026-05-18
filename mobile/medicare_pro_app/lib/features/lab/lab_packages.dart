import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class LabPackagesPage extends StatefulWidget {
  const LabPackagesPage({super.key});

  @override
  State<LabPackagesPage> createState() => _LabPackagesPageState();
}

class _LabPackagesPageState extends State<LabPackagesPage> {
  List<dynamic> _packages = [];
  List<dynamic> _tests = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final p = await ApiClient.instance.get('/api/lab/packages', auth: true);
      final t = await ApiClient.instance.get('/api/lab/my-tests', auth: true);
      setState(() {
        _packages = p['packages'] ?? [];
        _tests = t['tests'] ?? [];
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

  Future<void> _openForm({Map<String, dynamic>? pkg}) async {
    final nameCtrl = TextEditingController(text: pkg?['package_name'] ?? '');
    final priceCtrl = TextEditingController(text: pkg?['price']?.toString() ?? '');
    final discCtrl = TextEditingController(text: pkg?['discounted_price']?.toString() ?? '');
    bool active = (pkg?['is_active'] ?? 1) == 1;

    final selected = <int>{};
    if (pkg != null && pkg['test_items'] is List) {
      for (final t in (pkg['test_items'] as List)) {
        if (t['test_id'] != null) selected.add(t['test_id']);
      }
    }

    await showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text(pkg == null ? 'Add Package' : 'Edit Package'),
          content: SingleChildScrollView(
            child: Column(
              children: [
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Package Name')),
                TextField(controller: priceCtrl, decoration: const InputDecoration(labelText: 'Price'), keyboardType: TextInputType.number),
                TextField(controller: discCtrl, decoration: const InputDecoration(labelText: 'Discounted Price'), keyboardType: TextInputType.number),
                SwitchListTile(
                  value: active,
                  onChanged: (v) => setState(() => active = v),
                  title: const Text('Active'),
                ),
                const SizedBox(height: 8),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Select Tests', style: TextStyle(fontWeight: FontWeight.w600)),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 220,
                  child: ListView(
                    children: _tests.map((t) {
                      final id = t['id'];
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
                        title: Text(t['test_name'] ?? 'Test'),
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
                final payload = {
                  'package_name': nameCtrl.text.trim(),
                  'price': priceCtrl.text.trim(),
                  'discounted_price': discCtrl.text.trim().isEmpty ? null : discCtrl.text.trim(),
                  'is_active': active ? 1 : 0,
                  'test_ids': selected.toList(),
                };
                try {
                  if (pkg == null) {
                    await ApiClient.instance.post('/api/lab/packages', payload, auth: true);
                  } else {
                    await ApiClient.instance.post('/api/lab/packages/${pkg['id']}', payload, auth: true);
                  }
                  if (!mounted) return;
                  Navigator.pop(ctx);
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
      appBar: AppBar(title: const Text('Lab Packages')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _packages.length,
              itemBuilder: (_, i) {
                final p = (_packages[i] as Map?)?.cast<String, dynamic>() ?? {};
                final name = p['package_name'] ?? 'Package';
                final price = p['price'] ?? '';
                return ListTile(
                  title: Text(name),
                  subtitle: Text('INR $price'),
                  trailing: TextButton(
                    onPressed: () => _openForm(pkg: p),
                    child: const Text('Edit'),
                  ),
                );
              },
            ),
    );
  }
}
