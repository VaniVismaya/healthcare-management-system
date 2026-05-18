import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../core/api/api_client.dart';
import '../../core/services/router.dart';

class RegisterPage extends StatefulWidget {
  final String role;
  const RegisterPage({super.key, required this.role});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  String? _verificationId;
  bool _otpSent = false;
  String? _firebaseToken;
  bool _loading = false;

  Future<void> _sendOtp() async {
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter phone')));
      return;
    }
    setState(() => _loading = true);
    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: phone,
        timeout: const Duration(seconds: 60),
        verificationCompleted: (credential) async {
          final userCred = await FirebaseAuth.instance.signInWithCredential(credential);
          _firebaseToken = await userCred.user?.getIdToken();
        },
        verificationFailed: (e) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('OTP failed: ${e.message}')));
        },
        codeSent: (verificationId, _) {
          setState(() {
            _verificationId = verificationId;
            _otpSent = true;
          });
        },
        codeAutoRetrievalTimeout: (verificationId) {
          _verificationId = verificationId;
        },
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _verifyOtp() async {
    if (_verificationId == null) return;
    setState(() => _loading = true);
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: _otpCtrl.text.trim(),
      );
      final userCred = await FirebaseAuth.instance.signInWithCredential(credential);
      _firebaseToken = await userCred.user?.getIdToken();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Phone verified')));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('OTP verify failed: $e')));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _register() async {
    setState(() => _loading = true);
    try {
      if (_phoneCtrl.text.trim().isNotEmpty && _firebaseToken == null) {
        throw Exception('Verify phone first');
      }
      await ApiClient.instance.post('/api/auth/register', {
        'name': _nameCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'password': _passCtrl.text,
        'role': widget.role,
        if (_firebaseToken != null) 'firebase_id_token': _firebaseToken,
      });
      Navigator.pushReplacementNamed(context, AppRouter.login, arguments: widget.role);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Register failed: $e')));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Register (${widget.role})')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: SingleChildScrollView(
          child: Column(
            children: [
              TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Full Name')),
              TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email')),
              TextField(
                controller: _phoneCtrl,
                decoration: const InputDecoration(labelText: 'Phone'),
                onChanged: (_) => setState(() {}),
              ),
              if (_phoneCtrl.text.trim().isNotEmpty) ...[
                if (_otpSent)
                  TextField(controller: _otpCtrl, decoration: const InputDecoration(labelText: 'OTP')),
                const SizedBox(height: 8),
                if (_otpSent)
                  ElevatedButton(onPressed: _loading ? null : _verifyOtp, child: Text(_loading ? 'Verifying...' : 'Verify OTP'))
                else
                  ElevatedButton(onPressed: _loading ? null : _sendOtp, child: Text(_loading ? 'Sending...' : 'Send OTP')),
              ],
              TextField(controller: _passCtrl, decoration: const InputDecoration(labelText: 'Password'), obscureText: true),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _loading ? null : _register, child: Text(_loading ? 'Loading...' : 'Register')),
            ],
          ),
        ),
      ),
    );
  }
}
