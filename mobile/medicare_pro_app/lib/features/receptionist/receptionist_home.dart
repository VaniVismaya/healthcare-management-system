import 'package:flutter/material.dart';
import '../../core/services/router.dart';

class ReceptionistHomePage extends StatelessWidget {
  const ReceptionistHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Receptionist Dashboard'),
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
            title: 'Walk-in Booking',
            subtitle: 'Register a walk-in patient',
            onTap: () => Navigator.pushNamed(context, AppRouter.receptionistWalkin),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Queue',
            subtitle: 'Manage today's queue',
            onTap: () => Navigator.pushNamed(context, AppRouter.receptionistQueue),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Capacity Override',
            subtitle: 'Increase session capacity for a day',
            onTap: () => Navigator.pushNamed(context, AppRouter.receptionistCapacity),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Handover Notes',
            subtitle: 'Shift handover for staff',
            onTap: () => Navigator.pushNamed(context, AppRouter.receptionistHandover),
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
