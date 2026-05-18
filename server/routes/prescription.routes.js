const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescription.controller');
const { authenticate, authorize, requireVerified } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/', authorize('doctor'), requireVerified, prescriptionController.createPrescription);
router.get('/', prescriptionController.getPrescriptions);
router.get('/:id', prescriptionController.getPrescription);
router.patch('/:id/dispense', authorize('pharmacist'), requireVerified, prescriptionController.markDispensed);

module.exports = router;
