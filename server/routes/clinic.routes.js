const express = require('express');
const router = express.Router();
const clinicController = require('../controllers/clinic.controller');
const { authenticate, authorize, requireVerified } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'logo' ? 'uploads/public/logos' : 'uploads/certificates';
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/public/clinics'),
  filename: (req, file, cb) => cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`)
});
const uploadPhotos = multer({ storage: photoStorage });

router.get('/search', clinicController.searchClinics);

router.use(authenticate);
router.post('/', authorize('doctor'), upload.fields([{name:'certificate'},{name:'logo'}]), clinicController.createClinic);
router.post('/:id/photos', authorize('doctor'), uploadPhotos.array('photos', 10), clinicController.addClinicPhotos);
router.post('/:id/request-verification', authorize('doctor'), clinicController.requestVerification);
router.get('/my-clinics', authorize('doctor'), clinicController.getMyClinics);
router.get('/:id/receptionists', authorize('doctor','admin'), clinicController.getClinicReceptionists);
router.put('/:id', authorize('doctor'), upload.fields([{name:'certificate'},{name:'logo'}]), clinicController.updateClinic);
router.post('/add-receptionist', authorize('doctor'), requireVerified, clinicController.addReceptionist);
router.get('/:id/roles', authorize('doctor','admin'), clinicController.getClinicRoles);
router.post('/:id/roles', authorize('doctor','admin'), clinicController.createClinicRole);
router.put('/:id/roles/:roleId/permissions', authorize('doctor','admin'), clinicController.updateClinicRolePermissions);
router.post('/:id/roles/:roleId/assign', authorize('doctor','admin'), clinicController.assignClinicRole);

module.exports = router;
