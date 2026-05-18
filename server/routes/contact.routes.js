const express = require('express');
const contactController = require('../controllers/contact.controller');

const router = express.Router();

// Public contact form submission
router.post('/', contactController.createContactMessage);

module.exports = router;
