import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class AuthStore {
  static const _tokenKey = 'medicare_token';
  static const _userKey = 'medicare_user';

  static String? token;
  static Map<String, dynamic>? user;

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    token = prefs.getString(_tokenKey);
    final rawUser = prefs.getString(_userKey);
    if (rawUser != null && rawUser.isNotEmpty) {
      user = jsonDecode(rawUser) as Map<String, dynamic>;
    }
  }

  static Future<void> saveSession(String nextToken, Map<String, dynamic> nextUser) async {
    token = nextToken;
    user = nextUser;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, nextToken);
    await prefs.setString(_userKey, jsonEncode(nextUser));
  }

  static Future<void> clear() async {
    token = null;
    user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }
}
