const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');

// Public list
router.get('/', departmentController.listDepartments);

module.exports = router;
