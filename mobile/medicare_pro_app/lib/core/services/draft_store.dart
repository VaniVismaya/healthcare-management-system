import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class DraftStore {
  static Future<Map<String, dynamic>?> load(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key);
    if (raw == null || raw.isEmpty) return null;
    return (jsonDecode(raw) as Map).cast<String, dynamic>();
  }

  static Future<void> save(String key, Map<String, dynamic> value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      key,
      jsonEncode({
        ...value,
        'savedAt': DateTime.now().toIso8601String(),
      }),
    );
  }

  static Future<void> clear(String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(key);
  }
}

