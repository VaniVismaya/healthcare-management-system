import 'package:flutter/material.dart';
import '../../core/services/router.dart';

class AdminHomePage extends StatelessWidget {
  const AdminHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Dashboard'),
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
            title: 'Dashboard',
            subtitle: 'Summary stats',
            onTap: () => Navigator.pushNamed(context, AppRouter.adminDashboard),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Verifications',
            subtitle: 'Approve doctors, labs, pharmacies',
            onTap: () => Navigator.pushNamed(context, AppRouter.adminVerifications),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Contact Messages',
            subtitle: 'View and respond to user messages',
            onTap: () => Navigator.pushNamed(context, AppRouter.adminMessages),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Announcements',
            subtitle: 'Create system announcements',
            onTap: () => Navigator.pushNamed(context, AppRouter.adminAnnouncements),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Blog Reviews',
            subtitle: 'Approve doctor articles',
            onTap: () => Navigator.pushNamed(context, AppRouter.adminBlogReviews),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Audit Logs',
            subtitle: 'System activity history',
            onTap: () => Navigator.pushNamed(context, AppRouter.adminAuditLogs),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Public Announcements',
            subtitle: 'View active announcements',
            onTap: () => Navigator.pushNamed(context, AppRouter.announcements),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Health Articles',
            subtitle: 'View published articles',
            onTap: () => Navigator.pushNamed(context, AppRouter.blog),
          ),
          const SizedBox(height: 12),
          _HomeCard(
            title: 'Contact Support',
            subtitle: 'Send admin message',
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
