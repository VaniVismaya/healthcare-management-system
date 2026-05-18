import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class PaytmWebViewPage extends StatefulWidget {
  final String mid;
  final String orderId;
  final String txnToken;
  final String env;
  final String callbackUrl;

  const PaytmWebViewPage({
    super.key,
    required this.mid,
    required this.orderId,
    required this.txnToken,
    required this.env,
    required this.callbackUrl,
  });

  @override
  State<PaytmWebViewPage> createState() => _PaytmWebViewPageState();
}

class _PaytmWebViewPageState extends State<PaytmWebViewPage> {
  late final WebViewController _controller;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            if (request.url.startsWith(widget.callbackUrl)) {
              setState(() => _finished = true);
              return NavigationDecision.navigate;
            }
            return NavigationDecision.navigate;
          },
        ),
      );

    final base = widget.env.toLowerCase() == 'production'
        ? 'https://securegw.paytm.in'
        : 'https://securegw-stage.paytm.in';
    final action = '$base/theia/api/v1/showPaymentPage?mid=${widget.mid}&orderId=${widget.orderId}';

    final html = '''
<!DOCTYPE html>
<html>
  <body onload="document.forms[0].submit()">
    <form method="post" action="$action">
      <input type="hidden" name="mid" value="${widget.mid}"/>
      <input type="hidden" name="orderId" value="${widget.orderId}"/>
      <input type="hidden" name="txnToken" value="${widget.txnToken}"/>
    </form>
  </body>
</html>
''';

    final uri = Uri.dataFromString(
      html,
      mimeType: 'text/html',
      encoding: utf8,
    );
    _controller.loadRequest(uri);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Paytm Payment'),
        actions: [
          if (_finished)
            TextButton(
              onPressed: () => Navigator.of(context).pop(widget.orderId),
              child: const Text('Done', style: TextStyle(color: Colors.white)),
            )
        ],
      ),
      body: Column(
        children: [
          Expanded(child: WebViewWidget(controller: _controller)),
          if (_finished)
            Padding(
              padding: const EdgeInsets.all(12),
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).pop(widget.orderId),
                child: const Text('Return to App'),
              ),
            ),
        ],
      ),
    );
  }
}
