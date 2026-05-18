import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../core/api/api_client.dart';
import '../../core/services/auth_store.dart';
import '../../core/services/router.dart';

class LoginPage extends StatefulWidget {
  final String role;
  const LoginPage({super.key, required this.role});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _idCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  String? _verificationId;
  bool _otpSent = false;
  String _mode = 'password';
  bool _loading = false;

  Future<void> _loginWithFirebaseToken(String token, String phone) async {
    final data = await ApiClient.instance.post('/api/auth/login-otp', {
      'firebase_id_token': token,
      'role': widget.role,
      'phone': phone,
    });
    await AuthStore.saveSession(data['token'], (data['user'] as Map).cast<String, dynamic>());
    final role = data['user']['role'];
    if (role == 'patient') {
      Navigator.pushReplacementNamed(context, AppRouter.patientHome);
    } else if (role == 'doctor') {
      Navigator.pushReplacementNamed(context, AppRouter.doctorHome);
    } else if (role == 'laboratory') {
      Navigator.pushReplacementNamed(context, AppRouter.labHome);
    } else if (role == 'pharmacist') {
      Navigator.pushReplacementNamed(context, AppRouter.pharmacyHome);
    } else if (role == 'receptionist') {
      Navigator.pushReplacementNamed(context, AppRouter.receptionistHome);
    } else if (role == 'admin') {
      Navigator.pushReplacementNamed(context, AppRouter.adminHome);
    } else {
      Navigator.pushReplacementNamed(context, AppRouter.patientHome);
    }
  }

  Future<void> _login() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.post('/api/auth/login', {
        'identifier': _idCtrl.text.trim(),
        'password': _passCtrl.text,
      });
      await AuthStore.saveSession(data['token'], (data['user'] as Map).cast<String, dynamic>());
      final role = data['user']['role'];
      if (role == 'patient') {
        Navigator.pushReplacementNamed(context, AppRouter.patientHome);
      } else if (role == 'doctor') {
        Navigator.pushReplacementNamed(context, AppRouter.doctorHome);
      } else if (role == 'laboratory') {
        Navigator.pushReplacementNamed(context, AppRouter.labHome);
      } else if (role == 'pharmacist') {
        Navigator.pushReplacementNamed(context, AppRouter.pharmacyHome);
      } else if (role == 'receptionist') {
        Navigator.pushReplacementNamed(context, AppRouter.receptionistHome);
      } else if (role == 'admin') {
        Navigator.pushReplacementNamed(context, AppRouter.adminHome);
      } else {
        Navigator.pushReplacementNamed(context, AppRouter.patientHome);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Login failed: $e')));
    } finally {
      setState(() => _loading = false);
    }
  }

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
          final token = await userCred.user?.getIdToken();
          if (token != null) {
            await _loginWithFirebaseToken(token, phone);
          }
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
    final phone = _phoneCtrl.text.trim();
    if (_verificationId == null) return;
    setState(() => _loading = true);
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: _otpCtrl.text.trim(),
      );
      final userCred = await FirebaseAuth.instance.signInWithCredential(credential);
      final token = await userCred.user?.getIdToken();
      if (token == null) throw Exception('Token not available');
      await _loginWithFirebaseToken(token, phone);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('OTP verify failed: $e')));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Login (${widget.role})')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _mode = 'password'),
                    child: const Text('Password'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _mode = 'otp'),
                    child: const Text('OTP'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_mode == 'password') ...[
              TextField(controller: _idCtrl, decoration: const InputDecoration(labelText: 'Email or Phone')),
              TextField(controller: _passCtrl, decoration: const InputDecoration(labelText: 'Password'), obscureText: true),
            ] else ...[
              TextField(controller: _phoneCtrl, decoration: const InputDecoration(labelText: 'Phone')),
              if (_otpSent)
                TextField(controller: _otpCtrl, decoration: const InputDecoration(labelText: 'OTP')),
            ],
            const SizedBox(height: 16),
            if (_mode == 'password')
              ElevatedButton(onPressed: _loading ? null : _login, child: Text(_loading ? 'Loading...' : 'Login'))
            else if (_otpSent)
              ElevatedButton(onPressed: _loading ? null : _verifyOtp, child: Text(_loading ? 'Verifying...' : 'Verify OTP'))
            else
              ElevatedButton(onPressed: _loading ? null : _sendOtp, child: Text(_loading ? 'Sending...' : 'Send OTP')),
            TextButton(
              onPressed: () => Navigator.pushNamed(context, AppRouter.register, arguments: widget.role),
              child: const Text('Create account'),
            ),
          ],
        ),
      ),
    );
  }
}

