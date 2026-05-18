const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { testConnection } = require('./config/database');

// Import Routes
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const doctorRoutes = require('./routes/doctor.routes');
const patientRoutes = require('./routes/patient.routes');
const clinicRoutes = require('./routes/clinic.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const labRoutes = require('./routes/lab.routes');
const pharmacistRoutes = require('./routes/pharmacist.routes');
const prescriptionRoutes = require('./routes/prescription.routes');
const notificationRoutes = require('./routes/notification.routes');
const announcementRoutes = require('./routes/announcement.routes');
const receptionistRoutes = require('./routes/receptionist.routes');
const uploadRoutes = require('./routes/upload.routes');
const contactRoutes = require('./routes/contact.routes');
const aiRoutes = require('./routes/ai.routes');
const blogRoutes = require('./routes/blog.routes');
const orgRoleRoutes = require('./routes/orgRole.routes');
const paymentRoutes = require('./routes/payment.routes');
const departmentRoutes = require('./routes/department.routes');
const masterDataRoutes = require('./routes/masterData.routes');
const subscriptionRoutes = require('./routes/subscription.routes');

const app = express();
const server = http.createServer(app);

// Ensure upload directories exist (avoids ENOENT on multer writes)
const ensureUploadDirs = () => {
  const base = path.join(__dirname, 'uploads');
  const dirs = [
    base,
    path.join(base, 'certificates'),
    path.join(base, 'reports'),
    path.join(base, 'public'),
    path.join(base, 'public', 'logos'),
    path.join(base, 'public', 'profiles'),
    path.join(base, 'public', 'clinics'),
    path.join(base, 'public', 'labs'),
    path.join(base, 'public', 'pharmacies')
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
};
ensureUploadDirs();

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3001',
    methods: ['GET', 'POST']
  }
});

// Make io accessible in controllers
app.set('io', io);

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3001',
    'http://localhost:3001',
    'http://localhost:3000',
    'http://10.0.0.0/8',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }));
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Static files (uploaded files served securely)
app.use('/uploads', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Public uploads (profile pics, logos)
app.use('/public', express.static(path.join(__dirname, 'uploads/public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/pharmacists', pharmacistRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/receptionists', receptionistRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/org-roles', orgRoleRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/master-data', masterDataRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), app: process.env.APP_NAME });
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('join_clinic', (clinicId) => {
    socket.join(`clinic_${clinicId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await testConnection();
  server.listen(PORT, () => {
    console.log(`\n🏥 MediCare Pro Server running on port ${PORT}`);
    console.log(`🌐 API: http://localhost:${PORT}/api`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
};

startServer();

module.exports = { app, io };
