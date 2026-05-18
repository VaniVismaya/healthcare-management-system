import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class LabTestsPage extends StatefulWidget {
  const LabTestsPage({super.key});

  @override
  State<LabTestsPage> createState() => _LabTestsPageState();
}

class _LabTestsPageState extends State<LabTestsPage> {
  List<dynamic> _tests = [];
  List<dynamic> _departments = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final tests = await ApiClient.instance.get('/api/lab/my-tests', auth: true);
      final depts = await ApiClient.instance.get('/api/lab/departments', auth: true);
      setState(() {
        _tests = tests['tests'] ?? [];
        _departments = depts['departments'] ?? [];
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

  Future<void> _addDepartment() async {
    final nameCtrl = TextEditingController();
    final res = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add Department'),
        content: TextField(
          controller: nameCtrl,
          decoration: const InputDecoration(labelText: 'Department name'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Save')),
        ],
      ),
    );
    if (res != true) return;
    try {
      await ApiClient.instance.post('/api/lab/departments', {'name': nameCtrl.text.trim()}, auth: true);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Save failed: $e')));
    }
  }

  Future<void> _openForm({Map<String, dynamic>? test}) async {
    final nameCtrl = TextEditingController(text: test?['test_name'] ?? '');
    final codeCtrl = TextEditingController(text: test?['test_code'] ?? '');
    final catCtrl = TextEditingController(text: test?['category'] ?? '');
    final priceCtrl = TextEditingController(text: test?['price']?.toString() ?? '');
    final discCtrl = TextEditingController(text: test?['discounted_price']?.toString() ?? '');
    int? deptId = test?['lab_department_id'];
    bool active = (test?['is_active'] ?? 1) == 1;

    await showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text(test == null ? 'Add Test' : 'Edit Test'),
          content: SingleChildScrollView(
            child: Column(
              children: [
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Test Name')),
                TextField(controller: codeCtrl, decoration: const InputDecoration(labelText: 'Test Code')),
                TextField(controller: catCtrl, decoration: const InputDecoration(labelText: 'Category')),
                DropdownButtonFormField<int>(
                  value: deptId,
                  items: _departments.map<DropdownMenuItem<int>>((d) {
                    return DropdownMenuItem<int>(
                      value: d['id'],
                      child: Text(d['name'] ?? 'Department'),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => deptId = v),
                  decoration: const InputDecoration(labelText: 'Department'),
                ),
                TextField(controller: priceCtrl, decoration: const InputDecoration(labelText: 'Price'), keyboardType: TextInputType.number),
                TextField(controller: discCtrl, decoration: const InputDecoration(labelText: 'Discounted Price'), keyboardType: TextInputType.number),
                SwitchListTile(
                  value: active,
                  onChanged: (v) => setState(() => active = v),
                  title: const Text('Active'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            TextButton(
              onPressed: () async {
                final payload = {
                  'test_name': nameCtrl.text.trim(),
                  'test_code': codeCtrl.text.trim(),
                  'category': catCtrl.text.trim(),
                  'price': priceCtrl.text.trim(),
                  'discounted_price': discCtrl.text.trim().isEmpty ? null : discCtrl.text.trim(),
                  'is_active': active ? 1 : 0,
                  'lab_department_id': deptId,
                };
                try {
                  if (test == null) {
                    await ApiClient.instance.post('/api/lab/tests', payload, auth: true);
                  } else {
                    await ApiClient.instance.post('/api/lab/tests/${test['id']}', payload, auth: true);
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
      appBar: AppBar(
        title: const Text('Lab Tests'),
        actions: [
          IconButton(
            icon: const Icon(Icons.account_tree),
            onPressed: _addDepartment,
            tooltip: 'Add Department',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _tests.length,
              itemBuilder: (_, i) {
                final t = (_tests[i] as Map?)?.cast<String, dynamic>() ?? {};
                final name = t['test_name'] ?? 'Test';
                final price = t['price'] ?? '';
                final active = t['is_active'] == 1 ? 'Active' : 'Inactive';
                final dept = _departments.firstWhere(
                  (d) => d['id'] == t['lab_department_id'],
                  orElse: () => null,
                );
                final deptName = dept is Map ? (dept['name'] ?? '') : '';
                return ListTile(
                  title: Text(name),
                  subtitle: Text('INR $price - $active${deptName.toString().isNotEmpty ? ' - $deptName' : ''}'),
                  trailing: TextButton(
                    onPressed: () => _openForm(test: t),
                    child: const Text('Edit'),
                  ),
                );
              },
            ),
    );
  }
}

