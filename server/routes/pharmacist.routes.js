const express = require('express');
const router = express.Router();
const pharmacistController = require('../controllers/pharmacist.controller');
const { authenticate, authorize, requireVerified, requirePermission } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/certificates'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/public/pharmacies'),
  filename: (req, file, cb) => cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`)
});
const uploadPhotos = multer({ storage: photoStorage });

router.get('/search', pharmacistController.searchPharmacies);
router.get('/medicines/search', authenticate, pharmacistController.searchMedicines);

router.use(authenticate, authorize('pharmacist'));
router.get('/profile', pharmacistController.getProfile);
router.post('/setup-profile', upload.fields([{name:'license_certificate'}]), pharmacistController.setupProfile);
router.post('/photos', uploadPhotos.array('photos', 10), pharmacistController.addPharmacyPhotos);
router.post('/request-verification', pharmacistController.requestVerification);
router.post('/staff', pharmacistController.createStaff);
router.get('/dashboard', requireVerified, pharmacistController.getDashboardStats);
router.get('/medicines', requireVerified, requirePermission('pharmacy.medicines.manage'), pharmacistController.getMedicines);
router.post('/medicines', requireVerified, requirePermission('pharmacy.medicines.manage'), pharmacistController.addMedicine);
router.post('/stock/update', requireVerified, requirePermission('pharmacy.stock.manage'), pharmacistController.updateStock);
router.get('/stock/alerts', requireVerified, requirePermission('pharmacy.stock.manage'), pharmacistController.getStockAlerts);

module.exports = router;
