# Hardware Inventory Management - Backend API

Backend API for Mobile Supply & Inventory Management App for Hardware Businesses, built with Node.js, Express, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation Steps

#### 1. Install PostgreSQL

**Windows:**
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run the installer and follow the wizard
3. Set a password for the postgres user (remember this!)
4. Default port is 5432 (keep it unless you have a conflict)
5. Complete the installation

**Verify Installation:**
```powershell
psql --version
```

#### 2. Create Database

Open **pgAdmin 4** (installed with PostgreSQL) or use command line:

**Using pgAdmin:**
1. Open pgAdmin 4
2. Connect to your PostgreSQL server (enter your password)
3. Right-click on "Databases" → "Create" → "Database"
4. Name: `hardware_inventory_db`
5. Click "Save"

**Using Command Line:**
```powershell
# Connect to PostgreSQL
psql -U postgres

# In psql terminal:
CREATE DATABASE hardware_inventory_db;
\q
```

#### 3. Install Dependencies

```powershell
cd "C:\Users\ASUS\Desktop\Individual Project\Codebase\backend"
npm install
```

#### 4. Configure Environment Variables

Create a `.env` file in the backend folder:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and update with your PostgreSQL credentials:

```env
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hardware_inventory_db
DB_USER=postgres
DB_PASSWORD=your_actual_password_here

# JWT Configuration
JWT_SECRET=hardware_inventory_secret_key_2026
JWT_EXPIRE=7d
```

**⚠️ IMPORTANT:** Replace `your_actual_password_here` with your PostgreSQL password!

#### 5. Set Up Database Tables

```powershell
npm run db:setup
```

You should see:
```
✅ Database connection successful
✅ Users table created
🎉 Database setup completed successfully!
```

#### 6. Start the Server

**Development mode (with auto-reload):**
```powershell
npm run dev
```

**Production mode:**
```powershell
npm start
```

You should see:
```
✅ Database connection successful
🚀 Server running on port 5000
📊 Environment: development
```

## 📡 API Endpoints

### Authentication

#### Register New User
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "phone": "0771234567",
  "password": "password123",
  "accountType": "SHOP_OWNER"
}
```

**Account Types:** `SHOP_OWNER`, `SUPPLIER`, `CUSTOMER`, `ADMIN`

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "email": "john@example.com",
      "phone": "0771234567",
      "role": "SHOP_OWNER"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login
```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123",
  "loginAs": "SHOP_OWNER"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "email": "john@example.com",
      "phone": "0771234567",
      "role": "SHOP_OWNER"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Get Current User
```http
GET http://localhost:5000/api/auth/me
Authorization: Bearer YOUR_TOKEN_HERE
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "phone": "0771234567",
    "role": "SHOP_OWNER"
  }
}
```

#### Health Check
```http
GET http://localhost:5000/api/health
```

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('SHOP_OWNER', 'SUPPLIER', 'CUSTOMER', 'ADMIN')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Troubleshooting

### "password authentication failed for user postgres"
- Make sure you're using the correct password in `.env`
- The password is set during PostgreSQL installation

### "database does not exist"
- Make sure you created the database `hardware_inventory_db`
- Run the CREATE DATABASE command again

### "port 5000 already in use"
- Change the PORT in `.env` to another port (e.g., 5001)

### "Cannot connect to PostgreSQL"
- Make sure PostgreSQL service is running
- Check in Windows Services or run: `net start postgresql-x64-14`

## 📦 Project Structure

```
backend/
├── config/
│   └── database.js          # PostgreSQL connection
├── controllers/
│   └── authController.js    # Authentication logic
├── middleware/
│   └── auth.js              # JWT authentication middleware
├── models/
│   └── User.js              # User model
├── routes/
│   └── authRoutes.js        # Auth routes
├── scripts/
│   └── setupDatabase.js     # Database setup script
├── .env                     # Environment variables (create this!)
├── .env.example             # Environment template
├── .gitignore
├── package.json
├── README.md
└── server.js                # Entry point
```

## 🔐 Security Features

- Password hashing with bcryptjs
- JWT token authentication
- Role-based access control
- Input validation with express-validator
- SQL injection protection with parameterized queries

## 📝 Next Steps

1. ✅ Set up PostgreSQL
2. ✅ Install dependencies
3. ✅ Configure .env file
4. ✅ Run database setup
5. ✅ Start the server
6. 🔄 Update frontend to connect to this backend
7. 🔄 Test authentication flow

## 🧪 Testing with Postman

1. Download Postman: https://www.postman.com/downloads/
2. Import the API endpoints above
3. Test registration, login, and protected routes
4. Copy the token from login response
5. Use it in Authorization header: `Bearer <token>`
