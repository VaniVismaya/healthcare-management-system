const express = require('express');
const router = express.Router();
const masterDataController = require('../controllers/masterData.controller');

router.get('/specializations', masterDataController.listSpecializations);
router.get('/educations', masterDataController.listEducations);

module.exports = router;
