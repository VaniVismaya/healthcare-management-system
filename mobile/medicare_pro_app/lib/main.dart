import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'core/api/api_client.dart';
import 'core/services/auth_store.dart';
import 'core/services/router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  await AuthStore.init();
  await ApiClient.instance.init();
  runApp(const MediCareProApp());
}

class MediCareProApp extends StatelessWidget {
  const MediCareProApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MediCare Pro',
      theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0E7490))),
      onGenerateRoute: AppRouter.onGenerate,
      initialRoute: AppRouter.roleSelect,
      builder: (context, child) {
        return ValueListenableBuilder<bool>(
          valueListenable: ApiClient.isOnline,
          builder: (context, isOnline, _) {
            return ValueListenableBuilder<int>(
              valueListenable: ApiClient.pendingQueueCount,
              builder: (context, pendingCount, __) {
                return ValueListenableBuilder<bool>(
                  valueListenable: ApiClient.syncingQueue,
                  builder: (context, syncing, ___) {
                    final showBanner = !isOnline || pendingCount > 0 || syncing;
                    return Column(
                      children: [
                        if (showBanner)
                          Container(
                            width: double.infinity,
                            color: isOnline ? const Color(0xFFECFEFF) : const Color(0xFFFFF7ED),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            child: SafeArea(
                              bottom: false,
                              child: Text(
                                !isOnline
                                    ? 'Offline mode: saved screens still open, and supported updates queue until internet returns.'
                                    : syncing
                                        ? 'Syncing offline changes...'
                                        : '$pendingCount offline change${pendingCount == 1 ? '' : 's'} waiting to sync.',
                                style: TextStyle(
                                  color: isOnline ? const Color(0xFF155E75) : const Color(0xFF9A3412),
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        Expanded(child: child ?? const SizedBox.shrink()),
                      ],
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }
}
