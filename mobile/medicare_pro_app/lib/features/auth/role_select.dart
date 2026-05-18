import 'package:flutter/material.dart';
import '../../core/services/router.dart';

class RoleSelectPage extends StatelessWidget {
  const RoleSelectPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Select Role')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _roleButton(context, 'Patient', 'patient'),
            _roleButton(context, 'Doctor', 'doctor'),
            _roleButton(context, 'Laboratory', 'laboratory'),
            _roleButton(context, 'Pharmacy', 'pharmacist'),
          ],
        ),
      ),
    );
  }

  Widget _roleButton(BuildContext context, String label, String role) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ElevatedButton(
        onPressed: () => Navigator.pushNamed(context, AppRouter.login, arguments: role),
        child: Text(label),
      ),
    );
  }
}
