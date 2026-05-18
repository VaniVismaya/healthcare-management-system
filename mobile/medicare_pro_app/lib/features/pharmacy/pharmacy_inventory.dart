import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/services/draft_store.dart';

const _pharmacyInventoryAddDraftKey = 'pharmacy_inventory_add_draft';

class PharmacyInventoryPage extends StatefulWidget {
  const PharmacyInventoryPage({super.key});

  @override
  State<PharmacyInventoryPage> createState() => _PharmacyInventoryPageState();
}

class _PharmacyInventoryPageState extends State<PharmacyInventoryPage> {
  List<dynamic> _items = [];
  bool _showAlertsOnly = false;
  bool _loading = false;

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data =
          await ApiClient.instance.get('/api/pharmacy/medicines', auth: true);
      setState(() => _items = data['medicines'] ?? []);
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
    final draft = await DraftStore.load(_pharmacyInventoryAddDraftKey);
    final nameCtrl =
        TextEditingController(text: draft?['name']?.toString() ?? '');
    final priceCtrl =
        TextEditingController(text: draft?['price']?.toString() ?? '');
    final qtyCtrl =
        TextEditingController(text: draft?['quantity']?.toString() ?? '');
    final strengthCtrl =
        TextEditingController(text: draft?['strength']?.toString() ?? '');
    final unitCtrl =
        TextEditingController(text: draft?['unit']?.toString() ?? '');

    Future<void> saveDialogDraft() {
      return DraftStore.save(_pharmacyInventoryAddDraftKey, {
        'name': nameCtrl.text.trim(),
        'price': priceCtrl.text.trim(),
        'quantity': qtyCtrl.text.trim(),
        'strength': strengthCtrl.text.trim(),
        'unit': unitCtrl.text.trim(),
      });
    }

    nameCtrl.addListener(saveDialogDraft);
    priceCtrl.addListener(saveDialogDraft);
    qtyCtrl.addListener(saveDialogDraft);
    strengthCtrl.addListener(saveDialogDraft);
    unitCtrl.addListener(saveDialogDraft);

    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add Medicine'),
        content: SingleChildScrollView(
          child: Column(
            children: [
              const Text(
                'Medicine details stay saved on this device while offline and sync when internet returns.',
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              TextField(
                controller: priceCtrl,
                decoration: const InputDecoration(labelText: 'Price'),
                keyboardType: TextInputType.number,
              ),
              TextField(
                controller: qtyCtrl,
                decoration: const InputDecoration(labelText: 'Quantity'),
                keyboardType: TextInputType.number,
              ),
              TextField(
                controller: strengthCtrl,
                decoration:
                    const InputDecoration(labelText: 'Strength (optional)'),
              ),
              TextField(
                controller: unitCtrl,
                decoration: const InputDecoration(labelText: 'Unit (optional)'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              final price = priceCtrl.text.trim();
              final qty = qtyCtrl.text.trim();
              if (name.isEmpty || price.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Name and price required')),
                );
                return;
              }
              try {
                final res = await ApiClient.instance.post(
                  '/api/pharmacy/medicines',
                  {
                    'name': name,
                    'price': price,
                    'quantity': int.tryParse(qty) ?? 0,
                    'strength': strengthCtrl.text.trim(),
                    'unit': unitCtrl.text.trim(),
                  },
                  auth: true,
                );
                await DraftStore.clear(_pharmacyInventoryAddDraftKey);
                if (!mounted) return;
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      res['offlineQueued'] == true
                          ? 'Medicine saved offline and queued for sync.'
                          : 'Medicine added',
                    ),
                  ),
                );
                await _load();
              } catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Create failed: $e')),
                );
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );

    nameCtrl.dispose();
    priceCtrl.dispose();
    qtyCtrl.dispose();
    strengthCtrl.dispose();
    unitCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _showAlertsOnly
        ? _items.where((medicine) => (medicine['alert_level'] ?? 'ok') != 'ok').toList()
        : _items;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory'),
        actions: [
          TextButton(
            onPressed: () => setState(() => _showAlertsOnly = !_showAlertsOnly),
            child: Text(
              _showAlertsOnly ? 'Show All' : 'Alerts Only',
              style: const TextStyle(color: Colors.white),
            ),
          )
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openAdd,
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: filtered.length,
              itemBuilder: (_, index) {
                final medicine =
                    (filtered[index] as Map?)?.cast<String, dynamic>() ?? {};
                final name = medicine['name'] ?? 'Medicine';
                final qty = medicine['total_quantity'] ?? 0;
                final strength = medicine['strength'] ?? '';
                final unit = medicine['unit'] ?? '';
                final label =
                    strength.toString().isNotEmpty || unit.toString().isNotEmpty
                        ? '$strength $unit'
                        : '';
                final alert = medicine['alert_level'] ?? 'ok';
                final alertLabel = alert == 'out_of_stock'
                    ? 'Out of stock'
                    : alert == 'low_stock'
                        ? 'Low stock'
                        : '';
                return ListTile(
                  title: Text(name),
                  subtitle: Text(
                    alertLabel.isNotEmpty ? '$label - $alertLabel' : label,
                  ),
                  trailing: Text('Qty $qty'),
                );
              },
            ),
    );
  }
}
