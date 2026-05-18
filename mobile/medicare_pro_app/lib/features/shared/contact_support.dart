import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/services/auth_store.dart';

class ContactSupportPage extends StatefulWidget {
  const ContactSupportPage({super.key});

  @override
  State<ContactSupportPage> createState() => _ContactSupportPageState();
}

class _ContactSupportPageState extends State<ContactSupportPage> {
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _messageCtrl = TextEditingController();
  String _topic = 'Support';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final user = AuthStore.user;
    if (user != null) {
      _nameCtrl.text = user['name'] ?? '';
      _emailCtrl.text = user['email'] ?? '';
      _phoneCtrl.text = user['phone'] ?? '';
    }
  }

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty ||
        _emailCtrl.text.trim().isEmpty ||
        _messageCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Fill required fields')));
      return;
    }
    setState(() => _saving = true);
    try {
      await ApiClient.instance.post('/api/contact', {
        'name': _nameCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'topic': _topic,
        'message': _messageCtrl.text.trim(),
      }, auth: AuthStore.token != null);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Submitted')));
      _messageCtrl.clear();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Submit failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _messageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Contact Support')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Name *'),
            ),
            TextField(
              controller: _emailCtrl,
              decoration: const InputDecoration(labelText: 'Email *'),
            ),
            TextField(
              controller: _phoneCtrl,
              decoration: const InputDecoration(labelText: 'Phone'),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _topic,
              items: const [
                DropdownMenuItem(value: 'Support', child: Text('Support')),
                DropdownMenuItem(value: 'Onboarding', child: Text('Onboarding')),
                DropdownMenuItem(value: 'Partnership', child: Text('Partnership')),
              ],
              onChanged: (v) => setState(() => _topic = v ?? 'Support'),
              decoration: const InputDecoration(labelText: 'Topic'),
            ),
            TextField(
              controller: _messageCtrl,
              decoration: const InputDecoration(labelText: 'Message *'),
              maxLines: 5,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _saving ? null : _submit,
              child: Text(_saving ? 'Submitting...' : 'Submit'),
            ),
          ],
        ),
      ),
    );
  }
}
