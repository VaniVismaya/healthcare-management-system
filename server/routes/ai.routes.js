const express = require('express');
const aiController = require('../controllers/ai.controller');

const router = express.Router();

router.post('/assist', aiController.assist);

module.exports = router;
