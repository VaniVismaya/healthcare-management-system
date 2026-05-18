import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

class BlogListPage extends StatefulWidget {
  const BlogListPage({super.key});

  @override
  State<BlogListPage> createState() => _BlogListPageState();
}

class _BlogListPageState extends State<BlogListPage> {
  List<dynamic> _items = [];
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/blog');
      setState(() => _items = data['posts'] ?? []);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Load failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _open(Map<String, dynamic> post) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(post['title'] ?? 'Article'),
        content: SingleChildScrollView(
          child: Text(post['summary'] ?? 'No summary'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
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
      appBar: AppBar(title: const Text('Health Articles')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items.length,
              itemBuilder: (_, i) {
                final p = (_items[i] as Map?)?.cast<String, dynamic>() ?? {};
                final title = p['title'] ?? 'Article';
                final author = p['author_name'] ?? '';
                final category = p['category'] ?? '';
                return ListTile(
                  title: Text(title),
                  subtitle: Text('$author ${category.toString().isNotEmpty ? '- $category' : ''}'),
                  onTap: () => _open(p),
                );
              },
            ),
    );
  }
}
