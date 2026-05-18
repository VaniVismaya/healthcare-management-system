const express = require('express');
const router = express.Router();
const labController = require('../controllers/lab.controller');
const { authenticate, authorize, requireVerified, requirePermission } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'report' ? 'uploads/reports' : 'uploads/certificates';
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage });
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/public/labs'),
  filename: (req, file, cb) => cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`)
});
const uploadPhotos = multer({ storage: photoStorage });

router.get('/search', labController.searchLabs);
router.get('/:labId/tests', labController.getTests);
router.get('/:id/profile', labController.getLabProfile);

router.use(authenticate);
router.post('/setup-profile', authorize('laboratory'), upload.fields([{name:'certificate'}]), labController.setupProfile);
router.post('/photos', authorize('laboratory'), uploadPhotos.array('photos', 10), labController.addLabPhotos);
router.post('/request-verification', authorize('laboratory'), labController.requestVerification);
router.post('/staff', authorize('laboratory'), labController.createStaff);
router.get('/profile', authorize('laboratory'), labController.getLabProfile);
router.get('/departments', authorize('laboratory'), labController.getDepartments);
router.post('/departments', authorize('laboratory'), requireVerified, requirePermission('lab.tests.manage'), labController.createDepartment);
router.get('/tests', authorize('laboratory'), labController.getTests);
router.post('/tests', authorize('laboratory'), requireVerified, requirePermission('lab.tests.manage'), labController.addTest);
router.put('/tests/:id', authorize('laboratory'), requireVerified, requirePermission('lab.tests.manage'), labController.updateTest);
router.post('/orders/assign', authorize('doctor'), requireVerified, labController.assignLabOrder);
router.get('/orders', labController.getLabOrders);
router.get('/reports', labController.getReports);
router.patch('/orders/:id/status', authorize('laboratory'), requireVerified, requirePermission('lab.orders.manage'), labController.updateOrderStatus);
router.patch('/orders/:id/tests', authorize('laboratory'), requireVerified, requirePermission('lab.orders.manage'), labController.updateOrderTests);
router.post('/reports/upload', authorize('laboratory'), requireVerified, requirePermission('lab.reports.manage'), upload.single('report'), labController.uploadReport);
router.get('/reports/:id/view', labController.viewReport);

module.exports = router;
