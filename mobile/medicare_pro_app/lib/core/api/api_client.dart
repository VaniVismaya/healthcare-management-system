import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../services/auth_store.dart';

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _queueKey = 'medicare_mobile_offline_queue_v1';
  static const _cacheKey = 'medicare_mobile_offline_cache_v1';
  static const _maxCacheEntries = 50;

  static final ValueNotifier<bool> isOnline = ValueNotifier(true);
  static final ValueNotifier<int> pendingQueueCount = ValueNotifier(0);
  static final ValueNotifier<bool> syncingQueue = ValueNotifier(false);

  String baseUrl = const String.fromEnvironment('API_URL', defaultValue: 'http://localhost:8000');
  Timer? _autoSyncTimer;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final queue = _readQueue(prefs);
    pendingQueueCount.value = queue.length;
    _autoSyncTimer ??= Timer.periodic(const Duration(seconds: 20), (_) {
      syncPending();
    });
    unawaited(syncPending());
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body, {bool auth = false}) async {
    final headers = {'Content-Type': 'application/json'};
    if (auth && AuthStore.token != null) headers['Authorization'] = 'Bearer ${AuthStore.token}';

    try {
      final res = await http
          .post(Uri.parse('$baseUrl$path'), headers: headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 30));
      isOnline.value = true;
      return _handle(res);
    } on SocketException catch (_) {
      return _queueOrThrow(path, 'post', body, headers);
    } on TimeoutException catch (_) {
      return _queueOrThrow(path, 'post', body, headers);
    } on http.ClientException catch (_) {
      return _queueOrThrow(path, 'post', body, headers);
    }
  }

  Future<Map<String, dynamic>> get(String path, {bool auth = false, Map<String, String>? params}) async {
    final headers = <String, String>{};
    if (auth && AuthStore.token != null) headers['Authorization'] = 'Bearer ${AuthStore.token}';
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: params);

    try {
      final res = await http.get(uri, headers: headers).timeout(const Duration(seconds: 30));
      isOnline.value = true;
      final data = _handle(res);
      await _cacheGet(uri.toString(), data);
      return data;
    } on SocketException catch (_) {
      return _fromCacheOrThrow(uri.toString());
    } on TimeoutException catch (_) {
      return _fromCacheOrThrow(uri.toString());
    } on http.ClientException catch (_) {
      return _fromCacheOrThrow(uri.toString());
    }
  }

  Future<Map<String, dynamic>> postMultipart(
    String path,
    Map<String, String> fields, {
    String? filePath,
    String fileField = 'document',
    bool auth = false,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final req = http.MultipartRequest('POST', uri);
    if (auth && AuthStore.token != null) {
      req.headers['Authorization'] = 'Bearer ${AuthStore.token}';
    }
    fields.forEach((k, v) => req.fields[k] = v);
    if (filePath != null && filePath.isNotEmpty) {
      req.files.add(await http.MultipartFile.fromPath(fileField, filePath));
    }

    try {
      final res = await req.send().timeout(const Duration(seconds: 60));
      final body = await res.stream.bytesToString();
      final data = _decode(body);
      if (res.statusCode >= 400) {
        throw Exception(data['error'] ?? 'Request failed');
      }
      isOnline.value = true;
      return data;
    } on SocketException catch (_) {
      isOnline.value = false;
      throw Exception('Internet is required for file uploads. Please try again once connection returns.');
    } on TimeoutException catch (_) {
      isOnline.value = false;
      throw Exception('Upload timed out. Please retry when internet is stable.');
    }
  }

  Future<Map<String, dynamic>> syncPending() async {
    if (syncingQueue.value) {
      return {'synced': 0, 'remaining': pendingQueueCount.value};
    }

    final prefs = await SharedPreferences.getInstance();
    final queue = _readQueue(prefs);
    if (queue.isEmpty) {
      pendingQueueCount.value = 0;
      return {'synced': 0, 'remaining': 0};
    }

    syncingQueue.value = true;
    final remaining = <Map<String, dynamic>>[];
    var synced = 0;

    for (final item in queue) {
      try {
        final uri = Uri.parse('${item['baseUrl']}${item['path']}')
            .replace(queryParameters: (item['params'] as Map?)?.cast<String, String>());
        final headers = (item['headers'] as Map?)?.cast<String, String>() ?? <String, String>{};
        http.Response res;
        final method = item['method'] as String? ?? 'post';
        final body = item['body'] == null ? null : jsonEncode(item['body']);

        if (method == 'patch') {
          res = await http.patch(uri, headers: headers, body: body).timeout(const Duration(seconds: 30));
        } else if (method == 'put') {
          res = await http.put(uri, headers: headers, body: body).timeout(const Duration(seconds: 30));
        } else if (method == 'delete') {
          res = await http.delete(uri, headers: headers, body: body).timeout(const Duration(seconds: 30));
        } else {
          res = await http.post(uri, headers: headers, body: body).timeout(const Duration(seconds: 30));
        }

        if (res.statusCode >= 400) {
          remaining.add(item);
          continue;
        }

        synced += 1;
        isOnline.value = true;
      } on SocketException catch (_) {
        isOnline.value = false;
        remaining.add(item);
      } on TimeoutException catch (_) {
        isOnline.value = false;
        remaining.add(item);
      } on http.ClientException catch (_) {
        isOnline.value = false;
        remaining.add(item);
      }
    }

    await prefs.setString(_queueKey, jsonEncode(remaining));
    pendingQueueCount.value = remaining.length;
    syncingQueue.value = false;
    return {'synced': synced, 'remaining': remaining.length};
  }

  Future<Map<String, dynamic>> _queueOrThrow(
    String path,
    String method,
    Map<String, dynamic> body,
    Map<String, String> headers,
  ) async {
    if (!_canQueue(path)) {
      isOnline.value = false;
      throw Exception('Internet is required for this action.');
    }

    final prefs = await SharedPreferences.getInstance();
    final queue = _readQueue(prefs);
    queue.add({
      'id': '${DateTime.now().millisecondsSinceEpoch}_${queue.length + 1}',
      'queuedAt': DateTime.now().toIso8601String(),
      'baseUrl': baseUrl,
      'path': path,
      'method': method,
      'body': body,
      'headers': headers,
    });
    await prefs.setString(_queueKey, jsonEncode(queue));
    pendingQueueCount.value = queue.length;
    isOnline.value = false;

    return {
      'success': true,
      'offlineQueued': true,
      'message': 'Saved offline. It will sync when internet returns.',
    };
  }

  Future<Map<String, dynamic>> _fromCacheOrThrow(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final cache = _readCache(prefs);
    final cached = cache[key];
    if (cached != null) {
      isOnline.value = false;
      return {
        ...(cached['data'] as Map).cast<String, dynamic>(),
        '_offline': true,
        '_cachedAt': cached['cachedAt'],
      };
    }
    throw Exception('No internet connection and no saved copy is available yet.');
  }

  Future<void> _cacheGet(String key, Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    final cache = _readCache(prefs);
    cache[key] = {
      'cachedAt': DateTime.now().toIso8601String(),
      'data': data,
    };

    final sortedKeys = cache.keys.toList()
      ..sort((a, b) => ((cache[b]?['cachedAt'] ?? '') as String).compareTo((cache[a]?['cachedAt'] ?? '') as String));
    if (sortedKeys.length > _maxCacheEntries) {
      for (final keyToRemove in sortedKeys.skip(_maxCacheEntries)) {
        cache.remove(keyToRemove);
      }
    }

    await prefs.setString(_cacheKey, jsonEncode(cache));
  }

  bool _canQueue(String path) {
    return !path.startsWith('/api/auth/') &&
        !path.startsWith('/api/payments/') &&
        !path.startsWith('/api/upload/') &&
        path != '/api/appointments/book' &&
        path != '/api/appointments/walk-in' &&
        !path.startsWith('/api/appointments/qr/');
  }

  List<Map<String, dynamic>> _readQueue(SharedPreferences prefs) {
    final raw = prefs.getString(_queueKey);
    if (raw == null || raw.isEmpty) return <Map<String, dynamic>>[];
    final decoded = jsonDecode(raw) as List;
    return decoded.map((item) => (item as Map).cast<String, dynamic>()).toList();
  }

  Map<String, dynamic> _readCache(SharedPreferences prefs) {
    final raw = prefs.getString(_cacheKey);
    if (raw == null || raw.isEmpty) return <String, dynamic>{};
    return (jsonDecode(raw) as Map).cast<String, dynamic>();
  }

  Map<String, dynamic> _decode(String body) {
    if (body.isEmpty) return <String, dynamic>{};
    return jsonDecode(body) as Map<String, dynamic>;
  }

  Map<String, dynamic> _handle(http.Response res) {
    final data = _decode(res.body);
    if (res.statusCode >= 400) {
      throw Exception(data['error'] ?? 'Request failed');
    }
    return data;
  }
}

