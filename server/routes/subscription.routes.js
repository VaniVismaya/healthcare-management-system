const express = require('express');
const router = express.Router();
const controller = require('../controllers/subscription.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/overview', controller.getOverview);
router.post('/custom-request', controller.requestCustomPlan);

module.exports = router;
