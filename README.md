# 🏥 MediCare Pro — Healthcare Management System

A complete, production-ready healthcare management platform with:
- **Backend**: Node.js + Express.js (MVC Architecture)
- **Frontend Web**: React.js
- **Mobile**: Flutter (Android & iOS)
- **Database**: MySQL

---

## 📁 Project Structure

```
healthcare-system/
├── server/          ← Node.js + Express.js Backend (MVC)
├── client/          ← React.js Web Frontend
└── mobile/          ← Flutter Mobile App (Android & iOS)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MySQL 8.0+
- Flutter SDK 3.0+
- VS Code

---

## 1️⃣ Backend Setup (server/)

### Step 1 — Install dependencies
```bash
cd server
npm install
```

### Step 2 — Configure environment
Open `server/.env` and fill in your credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=healthcare_db

TWILIO_ACCOUNT_SID=your_twilio_sid      # For OTP SMS
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

EMAIL_USER=your_email@gmail.com         # For email notifications
EMAIL_PASSWORD=your_gmail_app_password

JWT_SECRET=your_super_secret_key_here
```

> **Without Twilio**: OTPs will print in the VS Code terminal console — perfect for local testing.

### Step 3 — Run database migrations
```bash
npm run migrate
```
This creates all tables and a default admin account:
- **Email**: admin@medicare.com  
- **Password**: Admin@123456

### Step 4 — Start the server
```bash
npm run dev        # Development (with auto-reload)
npm start          # Production
```
Server runs at: `http://localhost:5000`

---

## 2️⃣ Frontend Setup (client/)

### Step 1 — Install dependencies
```bash
cd client
npm install
```

### Step 2 — Configure environment
Edit `client/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

### Step 3 — Start the web app
```bash
npm start
```
Opens at: `http://localhost:3001`

---

## 3️⃣ Mobile Setup (mobile/)

### Step 1 — Install Flutter dependencies
```bash
cd mobile
flutter pub get
```

### Step 2 — Configure API URL
Edit `mobile/lib/config/constants.dart`:
```dart
// Android Emulator
static const String apiBaseUrl = 'http://10.0.2.2:5000/api';

// iOS Simulator
static const String apiBaseUrl = 'http://localhost:5000/api';

// Physical Device (use your computer's local IP)
static const String apiBaseUrl = 'http://192.168.1.XXX:5000/api';
```

### Step 3 — Run the app

**Android:**
```bash
flutter run                    # With connected device/emulator
flutter build apk              # Build APK
flutter build apk --release    # Release APK
```

**iOS:**
```bash
flutter run                    # With connected device/simulator
flutter build ios              # Build iOS (requires Mac + Xcode)
```

---

## 🌐 Hosting Deployment

### Backend (Node.js)
1. Upload `server/` folder to your hosting provider (e.g., Railway, Render, DigitalOcean)
2. Update `server/.env` with production database credentials
3. Run `npm run migrate` once on the server
4. Set `NODE_ENV=production` in environment variables

### Frontend (React)
```bash
cd client
npm run build
```
Upload the `build/` folder to your static hosting (Netlify, Vercel, etc.)
Update `REACT_APP_API_URL` to your production server URL.

### Mobile — Production
Update `mobile/lib/config/constants.dart`:
```dart
static const String apiBaseUrl = 'https://your-production-server.com/api';
```
Then rebuild the app.

---

## 👥 User Roles & Access

| Role | Registration | Verification |
|------|-------------|--------------|
| **Patient** | Self-register → OTP verify → Instant access | Auto-verified |
| **Doctor** | Self-register → Admin verifies profile + clinic | Admin approval required |
| **Laboratory** | Self-register → Upload certificate → Admin verifies | Admin approval required |
| **Pharmacist** | Self-register → Upload license → Admin verifies | Admin approval required |
| **Receptionist** | Added by clinic's main doctor | Auto-verified |
| **Guest Doctor** | Added by main doctor | Auto-verified |
| **Admin** | Pre-created via migration | — |

---

## 🔑 Default Credentials

After running migrations:
- **Admin Login**: Phone `+919999999999`, Password `Admin@123456`
- **OR** change in `server/.env` before migrating

---

## 📱 App Flow

### Patient Flow
1. Select "Patient" role → Register with OTP → Browse doctors by location/department
2. Select doctor → Choose clinic → Pick available time slot → Confirm booking
3. Receive queue number (e.g., #3) and estimated wait time
4. View appointments, prescriptions, lab reports — all in one place

### Doctor Flow
1. Register → Set up profile → Create clinic → Wait for admin verification
2. After verified: Set weekly schedule → Manage appointments → Write prescriptions
3. Assign lab tests → Search and select medicines with dosage (1-0-1 format)
4. View patient history → Add guest doctors → Add receptionists

### Lab Flow
1. Register → Upload certificate → Admin verifies
2. Add available tests with prices → Set discounts / packages
3. Receive lab orders from doctors → Accept → Upload reports (view-only for doctors/patients)

### Pharmacist Flow
1. Register → Upload license → Admin verifies
2. Add medicine inventory with stock tracking
3. Receive prescriptions from doctors → View and dispense
4. Get low stock / expiry alerts automatically

### Receptionist Flow
1. Added by clinic doctor → Login with provided credentials
2. Manage daily appointments → Check-in / Check-out patients → Register walk-ins

---

## 🗄️ Database Tables

| Table | Purpose |
|-------|---------|
| `users` | All users across all roles |
| `otp_verifications` | OTP storage and verification |
| `clinics` | Clinic registration and details |
| `doctor_profiles` | Doctor specialization and details |
| `doctor_schedules` | Weekly schedule per clinic |
| `doctor_leaves` | Doctor availability / leaves |
| `patient_profiles` | Patient health and demographic info |
| `appointments` | All appointment bookings |
| `prescriptions` | Doctor prescriptions |
| `prescription_medicines` | Medicines in each prescription |
| `lab_tests` | Tests offered by each lab |
| `lab_orders` | Doctor-assigned lab tests |
| `lab_reports` | Uploaded test reports |
| `medicines` | Pharmacist medicine catalog |
| `medicine_stock` | Current stock levels |
| `stock_movements` | Stock in/out history |
| `notifications` | In-app notifications |
| `audit_logs` | Admin action tracking |
| `subscription_plans` | Billing plans (free/basic/premium) |

---

## 🔌 API Endpoints

### Auth
- `POST /api/auth/send-otp` — Send OTP
- `POST /api/auth/verify-otp` — Verify OTP
- `POST /api/auth/register` — Register user
- `POST /api/auth/login` — Password login
- `POST /api/auth/login-otp` — OTP login
- `GET /api/auth/me` — Current user

### Appointments
- `GET /api/appointments/slots` — Available slots
- `POST /api/appointments/book` — Book appointment
- `POST /api/appointments/walk-in` — Walk-in (receptionist)
- `GET /api/appointments` — List appointments
- `PATCH /api/appointments/:id/status` — Update status

### Lab
- `GET /api/labs/search` — Search labs
- `GET /api/labs/:labId/tests` — Lab's test catalog
- `POST /api/labs/orders/assign` — Assign lab order
- `POST /api/labs/reports/upload` — Upload report
- `GET /api/labs/reports/:id/view` — View report

### Prescriptions
- `POST /api/prescriptions` — Create prescription
- `GET /api/prescriptions` — List prescriptions
- `GET /api/prescriptions/:id` — View prescription

### Admin
- `GET /api/admin/dashboard` — Platform stats
- `GET /api/admin/pending-verifications` — Pending approvals
- `PATCH /api/admin/users/:id/verify` — Approve/reject user

---

## 🎨 Color Scheme

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Blue | `#0A7EA4` | Main actions, links |
| Secondary Green | `#00B894` | Success, secondary actions |
| Dark Navy | `#0D2137` | Headers, sidebar |
| Warning Amber | `#F59E0B` | Alerts, pending states |
| Danger Red | `#EF4444` | Errors, cancellations |
| Purple | `#7C3AED` | Lab-related items |

---

## 📞 Support & Customization

- All credentials live in `.env` files — never hardcoded
- OTP falls back to console logging when Twilio is not configured
- Subscription plans are managed from Admin → Plans dashboard
- Reports are view-only (not downloadable) by design
- Socket.IO provides real-time notifications across all roles

