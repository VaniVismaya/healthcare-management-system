import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';

class RemoteAssetPreview extends StatelessWidget {
  const RemoteAssetPreview({
    super.key,
    required this.label,
    required this.path,
    this.height = 150,
  });

  final String label;
  final String? path;
  final double height;

  static const _imageExtensions = <String>{
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.bmp',
  };

  String? get _resolvedUrl {
    final raw = path?.trim();
    if (raw == null || raw.isEmpty) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }

    final base = ApiClient.instance.baseUrl.replaceAll(RegExp(r'/$'), '');
    final normalized = raw.startsWith('/') ? raw : '/$raw';
    return '$base$normalized';
  }

  bool get _isImage {
    final url = _resolvedUrl?.toLowerCase();
    if (url == null) return false;
    return _imageExtensions.any(url.endsWith);
  }

  Future<void> _openFile(BuildContext context) async {
    final url = _resolvedUrl;
    if (url == null) return;

    final uri = Uri.tryParse(url);
    if (uri == null || !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to open $label right now.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final url = _resolvedUrl;
    if (url == null) {
      return const SizedBox.shrink();
    }

    return Card(
      margin: const EdgeInsets.only(top: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 10),
            if (_isImage)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  url,
                  height: height,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    height: height,
                    width: double.infinity,
                    color: Colors.grey.shade200,
                    alignment: Alignment.center,
                    child: const Text('Preview unavailable'),
                  ),
                ),
              )
            else
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.description_outlined),
                    SizedBox(width: 10),
                    Expanded(child: Text('Document uploaded and ready to view')),
                  ],
                ),
              ),
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => _openFile(context),
                icon: Icon(_isImage ? Icons.open_in_new : Icons.picture_as_pdf_outlined),
                label: Text(_isImage ? 'Open Preview' : 'Open Document'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
