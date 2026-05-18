import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/models/doctor.dart';
import '../../core/services/router.dart';

class AiAssistantPage extends StatefulWidget {
  const AiAssistantPage({super.key});

  @override
  State<AiAssistantPage> createState() => _AiAssistantPageState();
}

class _AiAssistantPageState extends State<AiAssistantPage> {
  final _symptomsCtrl = TextEditingController();
  bool _loading = false;
  String? _message;
  String? _specialization;
  List<Doctor> _doctors = [];

  Future<void> _submit() async {
    final symptoms = _symptomsCtrl.text.trim();
    if (symptoms.isEmpty) return;
    setState(() {
      _loading = true;
      _message = null;
      _specialization = null;
      _doctors = [];
    });
    try {
      final data = await ApiClient.instance.post('/api/ai/suggest', {
        'symptoms': symptoms,
      });
      final list = (data['doctors'] as List?) ?? [];
      setState(() {
        _message = data['message'];
        _specialization = data['recommended_specialization'];
        _doctors = list.map((e) => Doctor.fromJson(e)).toList();
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('AI failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _symptomsCtrl.dispose();
    super.dispose();
  }

  Widget _chip(String text) {
    return ActionChip(
      label: Text(text),
      onPressed: () {
        _symptomsCtrl.text = text;
        _submit();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI Doctor Assistant')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Describe symptoms and we will suggest the right specialist.'),
            const SizedBox(height: 8),
            TextField(
              controller: _symptomsCtrl,
              decoration: const InputDecoration(
                labelText: 'Symptoms',
                hintText: 'e.g., fever, cough, chest pain',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                _chip('Fever, cough, body pain'),
                _chip('Chest discomfort, breathless'),
                _chip('Stomach pain, nausea after food'),
                _chip('Headache, blurred vision'),
                _chip('Child fever with cough'),
              ],
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: Text(_loading ? 'Thinking...' : 'Get Suggestions'),
            ),
            const SizedBox(height: 16),
            if (_specialization != null) ...[
              Text('Recommended: $_specialization',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
            ],
            if (_message != null) Text(_message!),
            const SizedBox(height: 12),
            Expanded(
              child: _doctors.isEmpty
                  ? const Text('No doctor suggestions yet.')
                  : ListView.builder(
                      itemCount: _doctors.length,
                      itemBuilder: (_, i) {
                        final d = _doctors[i];
                        return Card(
                          child: ListTile(
                            title: Text(d.name),
                            subtitle: Text(
                              '${d.specialization ?? ''} - ${d.clinicName ?? ''}',
                            ),
                            trailing: TextButton(
                              onPressed: () {
                                Navigator.pushNamed(
                                  context,
                                  AppRouter.book,
                                  arguments: d,
                                );
                              },
                              child: const Text('Book'),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
