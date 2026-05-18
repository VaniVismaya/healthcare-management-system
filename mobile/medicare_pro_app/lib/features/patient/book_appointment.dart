import 'package:flutter/material.dart';
import '../../core/services/router.dart';
import '../../core/api/api_client.dart';
import '../../core/models/doctor.dart';
import '../../core/models/session.dart';

class BookAppointmentPage extends StatefulWidget {
  final Doctor? initialDoctor;
  const BookAppointmentPage({super.key, this.initialDoctor});

  @override
  State<BookAppointmentPage> createState() => _BookAppointmentPageState();
}

class _BookAppointmentPageState extends State<BookAppointmentPage> {
  final _nameCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  DateTime _date = DateTime.now();
  List<Doctor> _doctors = [];
  Doctor? _selectedDoctor;
  List<SessionSlot> _sessions = [];
  SessionSlot? _selectedSession;
  bool _loading = false;
  String _priority = 'normal';
  String _consultation = 'in_person';
  double _bookingFee = 0;
  bool _paying = false;
  String _paymentMethod = 'razorpay';
  String _paymentOrderId = '';
  String _paymentStatus = '';
  bool _checkingPayment = false;

  Future<void> _search() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/api/doctors/search', params: {
        'name': _nameCtrl.text.trim(),
        'city': _cityCtrl.text.trim(),
      });
      final list = (data['doctors'] as List).map((e) => Doctor.fromJson(e)).toList();
      setState(() => _doctors = list);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Search failed: $e')));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadSessions(Doctor d) async {
    setState(() { _selectedDoctor = d; _sessions = []; _selectedSession = null; });
    final dateStr = _date.toIso8601String().substring(0, 10);
    try {
      final data = await ApiClient.instance.get('/api/appointments/slots', params: {
        'doctor_id': d.id.toString(),
        'clinic_id': d.clinicId.toString(),
        'date': dateStr,
      });
      final list = (data['slots'] as List).map((e) => SessionSlot.fromJson(e)).toList();
      setState(() => _sessions = list);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Load sessions failed: $e')));
    }
  }

  Future<void> _book() async {
    if (_selectedDoctor == null || _selectedSession == null) return;
    if (_bookingFee > 0) {
      if (_paymentMethod == 'razorpay') {
        await _startRazorpayPayment();
      } else if (_paymentMethod == 'stripe') {
        await _startStripePayment();
      } else {
        await _startPaytmPayment();
      }
      return;
    }
    final dateStr = _date.toIso8601String().substring(0, 10);
    try {
      final data = await ApiClient.instance.post('/api/appointments/book', {
        'doctor_id': _selectedDoctor!.id,
        'clinic_id': _selectedDoctor!.clinicId,
        'appointment_date': dateStr,
        'session_id': _selectedSession!.sessionId,
        'priority_level': _priority,
        'consultation_mode': _consultation,
        'payment_status': 'free',
      }, auth: true);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Booked. Queue #${data['queue_number']}')));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Booking failed: $e')));
    }
  }

  Future<void> _loadBookingFee() async {
    try {
      final data = await ApiClient.instance.get('/api/appointments/booking-fee');
      final fee = (data['booking_fee'] ?? 0).toDouble();
      setState(() => _bookingFee = fee);
    } catch (_) {}
  }

  Future<void> _startPaytmPayment() async {
    if (_selectedDoctor == null || _selectedSession == null) return;
    setState(() => _paying = true);
    final dateStr = _date.toIso8601String().substring(0, 10);
    try {
      final data = await ApiClient.instance.post('/api/payments/paytm/initiate', {
        'doctor_id': _selectedDoctor!.id,
        'clinic_id': _selectedDoctor!.clinicId,
        'appointment_date': dateStr,
        'appointment_time': _selectedSession!.startTime,
        'session_id': _selectedSession!.sessionId,
        'reason_for_visit': '',
        'consultation_mode': _consultation,
        'priority_level': _priority,
      }, auth: true);

      final orderId = data['order_id'] ?? '';
      final result = await Navigator.of(context).pushNamed(
        AppRouter.paytmWebView,
        arguments: {
          'mid': data['mid'],
          'orderId': orderId,
          'txnToken': data['txn_token'],
          'env': data['env'] ?? 'staging',
          'callbackUrl': data['callback_url'] ?? '',
        },
      );
      final resolvedOrderId = (result is String && result.isNotEmpty) ? result : orderId;
      setState(() => _paymentOrderId = resolvedOrderId);
      await _checkPaymentStatus();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Payment initiation failed: $e')));
    } finally {
      setState(() => _paying = false);
    }
  }

  Future<void> _startRazorpayPayment() async {
    if (_selectedDoctor == null || _selectedSession == null) return;
    setState(() => _paying = true);
    final dateStr = _date.toIso8601String().substring(0, 10);
    try {
      final data = await ApiClient.instance.post('/api/payments/razorpay/initiate', {
        'doctor_id': _selectedDoctor!.id,
        'clinic_id': _selectedDoctor!.clinicId,
        'appointment_date': dateStr,
        'appointment_time': _selectedSession!.startTime,
        'session_id': _selectedSession!.sessionId,
        'priority_level': _priority,
        'consultation_mode': _consultation,
      }, auth: true);
      _paymentOrderId = data['order_id'] ?? '';
      final callbackUrl = data['callback_url'] ?? '';
      final result = await Navigator.of(context).pushNamed(
        AppRouter.paymentWebView,
        arguments: {'url': data['payment_url'], 'callbackUrl': callbackUrl},
      );
      if (result == true) {
        await _checkPaymentStatus();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Payment initiation failed: $e')));
    } finally {
      setState(() => _paying = false);
    }
  }

  Future<void> _startStripePayment() async {
    if (_selectedDoctor == null || _selectedSession == null) return;
    setState(() => _paying = true);
    final dateStr = _date.toIso8601String().substring(0, 10);
    try {
      final data = await ApiClient.instance.post('/api/payments/stripe/initiate', {
        'doctor_id': _selectedDoctor!.id,
        'clinic_id': _selectedDoctor!.clinicId,
        'appointment_date': dateStr,
        'appointment_time': _selectedSession!.startTime,
        'session_id': _selectedSession!.sessionId,
        'priority_level': _priority,
        'consultation_mode': _consultation,
      }, auth: true);
      _paymentOrderId = data['order_id'] ?? '';
      final result = await Navigator.of(context).pushNamed(
        AppRouter.paymentWebView,
        arguments: {'url': data['payment_url'], 'callbackUrl': ''},
      );
      if (result == true) {
        await _checkPaymentStatus();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Payment initiation failed: $e')));
    } finally {
      setState(() => _paying = false);
    }
  }

  Future<void> _checkPaymentStatus() async {
    if (_paymentOrderId.isEmpty) return;
    setState(() => _checkingPayment = true);
    try {
      Map<String, dynamic> data;
      if (_paymentMethod == 'razorpay') {
        data = await ApiClient.instance.get('/api/payments/razorpay/status', params: {
          'order_id': _paymentOrderId,
        }, auth: true);
      } else if (_paymentMethod == 'stripe') {
        data = await ApiClient.instance.get('/api/payments/stripe/status', params: {
          'order_id': _paymentOrderId,
        }, auth: true);
      } else {
        data = await ApiClient.instance.get('/api/payments/paytm/status', params: {
          'order_id': _paymentOrderId,
        }, auth: true);
      }
      setState(() => _paymentStatus = data['status'] ?? '');
      if (data['status'] == 'paid') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment confirmed. Queue #${data['queue_number'] ?? ''}'))
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Status check failed: $e')));
    } finally {
      setState(() => _checkingPayment = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _loadBookingFee();
    if (widget.initialDoctor != null) {
      _doctors = [widget.initialDoctor!];
      _selectedDoctor = widget.initialDoctor;
      _nameCtrl.text = widget.initialDoctor!.name;
      _loadSessions(widget.initialDoctor!);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Book Appointment')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: SingleChildScrollView(
          child: Column(
            children: [
              TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Doctor Name')),
              TextField(controller: _cityCtrl, decoration: const InputDecoration(labelText: 'City')),
              const SizedBox(height: 8),
              ElevatedButton(onPressed: _loading ? null : _search, child: const Text('Search')),
              const SizedBox(height: 12),
              ..._doctors.map((d) => ListTile(
                title: Text(d.name),
                subtitle: Text('${d.specialization ?? ''} - ${d.clinicName ?? ''}'),
                trailing: Text(d.consultationFee != null ? 'INR ${d.consultationFee}' : ''),
                onTap: () => _loadSessions(d),
              )),
              const Divider(),
              if (_sessions.isNotEmpty) ...[
                const Text('Select Session'),
                ..._sessions.map((s) => RadioListTile<SessionSlot>(
                  value: s,
                  groupValue: _selectedSession,
                  onChanged: (v) => setState(() => _selectedSession = v),
                  title: Text('${s.label} (${s.startTime} - ${s.endTime})'),
                  subtitle: Text('Available: ${s.isAvailable ? 'Yes' : 'No'}'),
                )),
                const SizedBox(height: 8),
                DropdownButton<String>(
                  value: _priority,
                  items: const [
                    DropdownMenuItem(value: 'normal', child: Text('Normal')),
                    DropdownMenuItem(value: 'priority', child: Text('Priority (Emergency)')),
                  ],
                  onChanged: (v) => setState(() => _priority = v ?? 'normal'),
                ),
                const SizedBox(height: 8),
                DropdownButton<String>(
                  value: _consultation,
                  items: const [
                    DropdownMenuItem(value: 'in_person', child: Text('In-person')),
                    DropdownMenuItem(value: 'video', child: Text('Video Consultation')),
                  ],
                  onChanged: (v) => setState(() => _consultation = v ?? 'in_person'),
                ),
                const SizedBox(height: 8),
                if (_bookingFee > 0) ...[
                  DropdownButton<String>(
                    value: _paymentMethod,
                    items: const [
                      DropdownMenuItem(value: 'razorpay', child: Text('Razorpay')),
                      DropdownMenuItem(value: 'stripe', child: Text('Stripe')),
                      DropdownMenuItem(value: 'paytm', child: Text('Paytm')),
                    ],
                    onChanged: (v) => setState(() => _paymentMethod = v ?? 'razorpay'),
                  ),
                  const SizedBox(height: 8),
                ],
                ElevatedButton(
                  onPressed: _paying ? null : _book,
                  child: Text(_bookingFee > 0 ? 'Pay INR ${_bookingFee.toStringAsFixed(0)} & Book' : 'Book'),
                ),
                if (_bookingFee > 0 && _paymentOrderId.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: _checkingPayment ? null : _checkPaymentStatus,
                    child: Text(_checkingPayment ? 'Checking...' : 'Refresh Payment Status'),
                  ),
                  if (_paymentStatus.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text('Payment status: $_paymentStatus'),
                    )
                ],
              ]
            ],
          ),
        ),
      ),
    );
  }
}
