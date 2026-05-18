#!/bin/bash
# MediCare Pro - Quick Start Script (Mac/Linux)
# Run this from the healthcare-system/ root folder

echo "========================================"
echo "  MediCare Pro - Quick Start"
echo "========================================"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org"
  exit 1
fi

# Check MySQL
echo "⚠️  Make sure MySQL is running and credentials are set in server/.env"
echo ""

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server && npm install
echo "✅ Server dependencies installed"

# Run migrations
echo ""
echo "🗄️  Running database migrations..."
npm run migrate
echo "✅ Database migrated"

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "To start the backend:"
echo "  cd server && npm run dev"
echo ""
echo "To start the frontend (new terminal):"
echo "  cd client && npm install && npm start"
echo ""
echo "Admin login:"
echo "  Phone: +919999999999"
echo "  Password: Admin@123456"
echo ""
