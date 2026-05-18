const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const { authenticate, authorize, requireVerified } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/certificates'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.get('/search', doctorController.searchDoctors);
router.get('/:id/profile', doctorController.getDoctorProfile);

router.use(authenticate);
router.get('/profile', doctorController.getDoctorProfile);
router.get('/consultation-fees', authorize('doctor'), requireVerified, doctorController.getConsultationFees);
router.get('/consultation-fees/applicable', doctorController.getApplicableConsultationFee);
router.get('/schedule', authorize('doctor'), requireVerified, doctorController.getSchedule);
router.get('/schedule-overrides', authorize('doctor'), requireVerified, doctorController.getScheduleOverrides);
router.get('/leaves', authorize('doctor'), requireVerified, doctorController.getLeaves);
router.post('/setup-profile', authorize('doctor'), upload.any(), doctorController.setupProfile);
router.post('/consultation-fees', authorize('doctor'), requireVerified, doctorController.saveConsultationFee);
router.delete('/consultation-fees/:id', authorize('doctor'), requireVerified, doctorController.deleteConsultationFee);
router.get('/dashboard-stats', authorize('doctor'), requireVerified, doctorController.getDashboardStats);
router.post('/add-guest-doctor', authorize('doctor'), requireVerified, doctorController.addGuestDoctor);
router.post('/request-verification', authorize('doctor'), doctorController.requestVerification);
router.post('/schedule', authorize('doctor'), requireVerified, doctorController.setSchedule);
router.post('/schedule-overrides', authorize('doctor'), requireVerified, doctorController.saveScheduleOverride);
router.post('/leave', authorize('doctor'), requireVerified, doctorController.markLeave);
router.delete('/schedule-overrides/:id', authorize('doctor'), requireVerified, doctorController.deleteScheduleOverride);
router.get('/patient/:patientId', authorize('doctor'), requireVerified, doctorController.getPatientDetails);
router.get('/guest-doctors', authorize('doctor'), requireVerified, doctorController.getGuestDoctors);

module.exports = router;
