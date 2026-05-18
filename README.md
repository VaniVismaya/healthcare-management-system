# MediCare Pro - Healthcare Management System

Full-stack healthcare management system with patient, doctor, lab, pharmacy, and appointment workflows.

## Stack

- Backend: Node.js, Express.js, MySQL
- Frontend: React.js
- Mobile: Flutter
- Realtime: Socket.IO

## Project Structure

```text
healthcare-system/
|-- server/
|-- client/
|-- mobile/
|-- docs/
`-- server-php/
```

## Core Features

- Role-based authentication for patients, doctors, labs, pharmacists, receptionists, and admin
- Appointment booking and queue management
- Prescriptions and lab order flows
- Lab reports and pharmacy inventory support
- Admin dashboards, approvals, and audit features
- Realtime notifications

## Local Setup

### Backend

```bash
cd server
npm install
npm run migrate
npm run dev
```

### Frontend

```bash
cd client
npm install
npm start
```

## Environment Variables

Keep secrets in local or hosting environment variables only. Do not commit `.env` files.

Backend examples:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=med_appoint
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:3001
```

Frontend examples:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

## Default Admin

- Email: `admin@medicare.com`
- Password: `Admin@123456`

Update these before production use.

## Deployment

- Frontend: Vercel / Netlify
- Backend: Render / Railway
- Database: MySQL compatible cloud host

## Notes

- `.env` files, `node_modules`, logs, uploads, and zip files are excluded from Git.
- This repository is intended for interview/demo purposes and can be deployed with environment variables configured on the hosting platform.
