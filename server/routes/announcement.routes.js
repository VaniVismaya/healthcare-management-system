const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', adminController.getActiveAnnouncements);

module.exports = router;
