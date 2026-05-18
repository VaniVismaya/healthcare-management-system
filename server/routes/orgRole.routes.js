const express = require('express');
const router = express.Router();
const orgRoleController = require('../controllers/orgRole.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', orgRoleController.listRoles);
router.post('/', orgRoleController.createRole);
router.put('/:id/permissions', orgRoleController.updatePermissions);
router.post('/:id/assign', orgRoleController.assignRole);

module.exports = router;
