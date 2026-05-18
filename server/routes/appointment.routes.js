const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const { authenticate, authorize, requireAnyPermission } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/booking-fee', appointmentController.getBookingFee);
router.get('/slots', appointmentController.getAvailableSlots);
router.post('/book', appointmentController.bookAppointment);
router.post(
  '/walk-in',
  authorize('receptionist', 'doctor'),
  requireAnyPermission('receptionist.appointments.manage', 'doctor.appointments.manage'),
  appointmentController.walkInAppointment
);
router.get('/', appointmentController.getAppointments);
router.get('/queue', appointmentController.getQueueTimeline);
router.get('/:id/qr', authorize('patient'), appointmentController.getQrToken);
router.post(
  '/qr/checkin',
  authorize('doctor','receptionist','admin'),
  requireAnyPermission('receptionist.patients.checkin', 'doctor.appointments.manage'),
  appointmentController.checkInByQr
);
router.patch('/:id/status', authorize('doctor','receptionist','admin'), appointmentController.updateStatus);
router.post(
  '/:id/requeue',
  authorize('doctor','receptionist'),
  requireAnyPermission('receptionist.appointments.manage', 'doctor.appointments.manage'),
  appointmentController.requeueAppointment
);
router.post(
  '/:id/vitals',
  authorize('doctor','receptionist'),
  requireAnyPermission('receptionist.patients.checkin', 'doctor.appointments.manage'),
  appointmentController.recordVitals
);

module.exports = router;
