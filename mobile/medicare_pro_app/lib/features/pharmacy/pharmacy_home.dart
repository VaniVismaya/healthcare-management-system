import 'package:flutter/material.dart';
import '../../core/services/router.dart';

class PharmacyHomePage extends StatelessWidget {
  const PharmacyHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pharmacy Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications),
            onPressed: () => Navigator.pushNamed(context, AppRouter.notifications),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _HomeCard(
            title: 'Prescriptions',
            subtitle: 'View assigned prescriptions',
            onTap: () => Navigator.pushNamed(context, AppRouter.pharmacyPrescriptions),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'My Profile',
            subtitle: 'Edit pharmacy profile',
            onTap: () => Navigator.pushNamed(context, AppRouter.pharmacyProfile),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Inventory',
            subtitle: 'Manage medicines and stock',
            onTap: () => Navigator.pushNamed(context, AppRouter.pharmacyInventory),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Stock Alerts',
            subtitle: 'Low stock and out of stock',
            onTap: () => Navigator.pushNamed(context, AppRouter.pharmacyAlerts),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Staff Roles',
            subtitle: 'Manage pharmacy roles',
            onTap: () => Navigator.pushNamed(context, AppRouter.staffRoles),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Staff Accounts',
            subtitle: 'Create pharmacy staff',
            onTap: () => Navigator.pushNamed(context, AppRouter.staffAccounts),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Announcements',
            subtitle: 'System updates',
            onTap: () => Navigator.pushNamed(context, AppRouter.announcements),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Health Articles',
            subtitle: 'Read verified articles',
            onTap: () => Navigator.pushNamed(context, AppRouter.blog),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Contact Support',
            subtitle: 'Get help and onboarding',
            onTap: () => Navigator.pushNamed(context, AppRouter.contactSupport),
          ),
        ],
      ),
    );
  }
}

class _HomeCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _HomeCard({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Card(
        elevation: 1,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}
