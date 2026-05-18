import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/api/api_client.dart';

class QrCheckInPage extends StatefulWidget {
  final String title;

  const QrCheckInPage({super.key, this.title = 'Scan Patient QR'});

  @override
  State<QrCheckInPage> createState() => _QrCheckInPageState();
}

class _QrCheckInPageState extends State<QrCheckInPage> {
  bool _processing = false;
  final MobileScannerController _controller = MobileScannerController();

  Future<void> _handleToken(String token) async {
    setState(() => _processing = true);
    try {
      final data = await ApiClient.instance
          .post('/api/appointments/qr/checkin', {'token': token}, auth: true);
      if (!mounted) return;
      final queue = data['queue_number'];
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Checked in. Queue #$queue')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Scan failed: $e')));
      setState(() => _processing = false);
    }
  }

  void _onDetect(BarcodeCapture capture) {
    if (_processing) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw != null && raw.isNotEmpty) {
        _handleToken(raw);
        break;
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          if (_processing)
            const Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: EdgeInsets.all(12),
                child: Card(
                  color: Colors.black87,
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Text(
                      'Checking in...',
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
