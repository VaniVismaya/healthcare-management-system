import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class DoctorArticlesPage extends StatefulWidget {
  const DoctorArticlesPage({super.key});

  @override
  State<DoctorArticlesPage> createState() => _DoctorArticlesPageState();
}

class _DoctorArticlesPageState extends State<DoctorArticlesPage> {
  List<dynamic> _items = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/blog/my', auth: true);
      setState(() => _items = data['posts'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final titleCtrl = TextEditingController();
    final summaryCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    final categoryCtrl = TextEditingController();

    final res = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('New Article'),
        content: SingleChildScrollView(
          child: Column(
            children: [
              TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Title')),
              TextField(controller: categoryCtrl, decoration: const InputDecoration(labelText: 'Category')),
              TextField(controller: summaryCtrl, decoration: const InputDecoration(labelText: 'Summary')),
              TextField(
                controller: contentCtrl,
                decoration: const InputDecoration(labelText: 'Content'),
                maxLines: 5,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Submit')),
        ],
      ),
    );

    if (res != true) return;
    try {
      await ApiClient.instance.post('/api/blog', {
        'title': titleCtrl.text.trim(),
        'summary': summaryCtrl.text.trim(),
        'content': contentCtrl.text.trim(),
        'category': categoryCtrl.text.trim(),
      }, auth: true);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Submitted for review')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Submit failed: $e')));
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
      appBar: AppBar(
        title: const Text('My Articles'),
        actions: [
          IconButton(onPressed: _create, icon: const Icon(Icons.add)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items.length,
              itemBuilder: (_, i) {
                final p = (_items[i] as Map?)?.cast<String, dynamic>() ?? {};
                final title = p['title'] ?? 'Article';
                final status = p['status'] ?? '';
                final created = p['created_at'] ?? '';
                return ListTile(
                  title: Text(title),
                  subtitle: Text('Status: $status\n$created'),
                  isThreeLine: true,
                );
              },
            ),
    );
  }
}
