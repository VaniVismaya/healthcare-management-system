# MediCare Pro - Healthcare Management System

Full-stack healthcare management system with patient, doctor, laboratory, pharmacy, receptionist, and admin workflows.

## Overview

This project includes:

- `client/`: React web application
- `server/`: Node.js + Express API
- `mobile/`: Flutter mobile application
- `docs/`: supporting project documentation

## Stack

- Frontend: React.js
- Backend: Node.js, Express.js
- Database: MySQL
- Mobile: Flutter
- Realtime: Socket.IO

## Core Features

- Role-based authentication and authorization
- Appointment booking and queue management
- Doctor prescriptions and lab orders
- Lab report uploads and patient access
- Pharmacy inventory and prescription workflows
- Admin dashboards, approvals, and audit logs
- Realtime notifications

## Local Setup

### 1. Clone and install

```bash
cd server
npm install

cd ../client
npm install
```

### 2. Create local env files

Copy the example files and fill in your own values:

```bash
copy server\.env.example server\.env
copy client\.env.example client\.env
```

### 3. Run the backend

```bash
cd server
npm run migrate
npm run dev
```

### 4. Run the frontend

```bash
cd client
npm start
```

## Environment Variables

Do not commit `.env` files. Use:

- [server/.env.example](server/.env.example)
- [client/.env.example](client/.env.example)

These examples show the required variables for local development and deployment.


## Deployment Notes

### Backend

Set these on your backend host:

- `NODE_ENV=production`
- `CLIENT_URL=https://your-frontend-domain`
- database credentials from your cloud MySQL instance
- JWT, email, payment, Zoom, Firebase, and other private keys

### Frontend

Set these on your frontend host:

- `REACT_APP_API_URL=https://your-backend-domain/api`
- `REACT_APP_SOCKET_URL=https://your-backend-domain`

### Database

You can migrate your local MySQL database to a remote one using Navicat by exporting from local and importing into the cloud database.

## Security Notes

- `.env` files are ignored by Git
- `node_modules`, logs, uploads, and archives are also ignored
- Rotate any local keys that were previously used during development before production deployment



