const DEMO_ADMIN = {
  role: 'admin',
  name: 'Admin Demo Viewer',
  email: 'demo.admin@medicarepro.local',
  phone: '+919000000050',
  password: 'DemoAdmin@123',
};

const isDemoAdmin = (user = {}) => {
  if (!user || user.role !== 'admin') return false;
  return user.email === DEMO_ADMIN.email || user.phone === DEMO_ADMIN.phone;
};

module.exports = {
  DEMO_ADMIN,
  isDemoAdmin,
};
