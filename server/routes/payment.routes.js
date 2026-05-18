const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate, authorize, requireAnyPermission } = require('../middleware/auth.middleware');

// Paytm - initiate payment for booking (patient only)
router.post('/paytm/initiate', authenticate, authorize('patient'), paymentController.initiatePaytm);

// Paytm callback (no auth, Paytm posts here)
router.post('/paytm/callback', paymentController.paytmCallback);

// Paytm order status (patient only)
router.get('/paytm/status', authenticate, authorize('patient'), paymentController.getPaytmStatus);

// Razorpay
router.post('/razorpay/initiate', authenticate, authorize('patient'), paymentController.initiateRazorpay);
router.post('/razorpay/webhook', paymentController.razorpayWebhook);
router.get('/razorpay/status', authenticate, authorize('patient'), paymentController.getRazorpayStatus);

// Stripe
router.post('/stripe/initiate', authenticate, authorize('patient'), paymentController.initiateStripe);
router.post('/stripe/webhook', paymentController.stripeWebhook);
router.get('/stripe/status', authenticate, authorize('patient'), paymentController.getStripeStatus);

module.exports = router;
