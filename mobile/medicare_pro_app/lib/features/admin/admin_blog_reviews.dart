import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class AdminBlogReviewsPage extends StatefulWidget {
  const AdminBlogReviewsPage({super.key});

  @override
  State<AdminBlogReviewsPage> createState() => _AdminBlogReviewsPageState();
}

class _AdminBlogReviewsPageState extends State<AdminBlogReviewsPage> {
  List<dynamic> _items = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/admin/blogs', auth: true);
      setState(() => _items = data['posts'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _update(int id, String status) async {
    try {
      await ApiClient.instance.post('/api/admin/blogs/$id', {
        'status': status,
      }, auth: true);
      if (!mounted) return;
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Update failed: $e')));
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
      appBar: AppBar(title: const Text('Blog Reviews')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items.length,
              itemBuilder: (_, i) {
                final p = (_items[i] as Map?)?.cast<String, dynamic>() ?? {};
                final title = p['title'] ?? 'Article';
                final author = p['author_name'] ?? '';
                final status = p['status'] ?? '';
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  child: ListTile(
                    title: Text(title),
                    subtitle: Text('By $author\nStatus: $status'),
                    isThreeLine: true,
                    trailing: Wrap(
                      spacing: 8,
                      children: [
                        TextButton(
                          onPressed: () => _update(p['id'], 'approved'),
                          child: const Text('Approve'),
                        ),
                        TextButton(
                          onPressed: () => _update(p['id'], 'rejected'),
                          child: const Text('Reject'),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
