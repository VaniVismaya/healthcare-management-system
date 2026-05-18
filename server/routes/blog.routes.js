const express = require('express');
const blogController = require('../controllers/blog.controller');
const { authenticate, authorize, blockDemoAdminWrites } = require('../middleware/auth.middleware');

const router = express.Router();

// Public
router.get('/', blogController.listPublic);
router.get('/slug/:slug', blogController.getPublicBySlug);

// Authenticated
router.use(authenticate);
router.post('/', authorize('doctor', 'admin'), blogController.createPost);
router.get('/mine', authorize('doctor'), blogController.listMine);
router.get('/pending', authorize('admin'), blogController.listPending);
router.get('/admin/all', authorize('admin'), blogController.listAdmin);
router.post('/admin', authorize('admin'), blockDemoAdminWrites, blogController.saveAdminPost);
router.put('/:id', authorize('admin'), blockDemoAdminWrites, blogController.saveAdminPost);
router.delete('/:id', authorize('admin'), blockDemoAdminWrites, blogController.deletePost);
router.patch('/:id/status', authorize('admin'), blockDemoAdminWrites, blogController.updateStatus);

module.exports = router;
