# 🛢️ Cylinder Tracking System (CTS)

A full-stack, production-ready web application built with **React + Vite**, **Tailwind CSS**, and **Firebase** for managing gas cylinder operations — tracking cylinders, filling sessions, inventory, customers, suppliers, HR, vehicles, and expenses.

---

## 🚀 Quick Start

### 1. Clone / Extract the Project

```bash
cd cylinder-tracking-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Authentication** → Email/Password provider.
3. Create a **Firestore Database** in production mode.
4. Copy your Firebase config keys.

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and replace the placeholder values with your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 5. Apply Firestore Security Rules

In Firebase Console → Firestore → Rules tab, paste the contents of `firestore.rules`.

### 6. Run the App

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 🔐 Authentication Flow

### First Run (System Initialization)
- On first load, you're redirected to `/setup`
- Create the **Super Admin** account (sets `systemInitialized = true` in Firestore)
- You're automatically logged in as Super Admin

### Subsequent Users
- Visit `/register` → account is created with `status: "pending"`
- **Super Admin** must approve the account at `/users`
- Only `status: "approved"` users can log in

### Roles

| Role        | Access Level |
|-------------|-------------|
| **Super Admin** | Full access — user approval, role management, all modules, settings |
| **Admin**   | All modules except user management and settings |
| **User**    | Cylinders, Filling, and Inventory (read + create) |

---

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI components (Table, Modal, Badge, etc.)
│   └── layout/          # Sidebar, Navbar, AppLayout
├── context/
│   ├── AuthContext.jsx  # Firebase auth + user profile state
│   └── ThemeContext.jsx # Dark/light mode (localStorage)
├── hooks/
│   ├── useFirestore.js  # Real-time Firestore collection hook
│   └── useTable.js      # Search, sort, pagination for tables
├── pages/
│   ├── auth/            # Setup, Login, Register
│   ├── dashboard/       # Stats + charts
│   ├── users/           # User management (Super Admin)
│   ├── gas/             # Gas type master
│   ├── cylinders/       # Cylinder CRUD + status
│   ├── filling/         # Filling sessions
│   ├── inventory/       # Inventory view + alerts
│   ├── vehicles/        # Fleet + fuel logs
│   ├── customers/       # Customer CRUD
│   ├── suppliers/       # Supplier CRUD
│   ├── hr/              # Employees + attendance + salary
│   ├── expenses/        # Expense tracking + charts
│   ├── reports/         # Reports with date filters + CSV export
│   └── settings/        # Profile + appearance
├── routes/
│   └── Guards.jsx       # ProtectedRoute, RoleBasedRoute, GuestRoute
├── services/
│   ├── firebase.js      # Firebase initialization
│   ├── authService.js   # Auth operations
│   └── firestoreService.js # Generic CRUD helpers
└── utils/
    ├── helpers.js       # Formatters, CSV export, date utils
    └── validations.js   # Yup schemas
```

---

## 🗂️ Firestore Collections

| Collection | Description |
|------------|-------------|
| `settings` | System config (`systemInitialized`) |
| `users` | User profiles with role & status |
| `gasTypes` | Gas type master with capacities |
| `cylinders` | Cylinder master with status |
| `fillings` | Filling session records |
| `customers` | Customer database |
| `suppliers` | Supplier database |
| `vehicles` | Fleet vehicles |
| `fuelLogs` | Vehicle fuel entries |
| `employees` | HR employee records |
| `attendance` | Daily attendance |
| `salaries` | Salary disbursements |
| `expenses` | Business expense records |

---

## ✨ Features

- 🔐 Role-based auth (Super Admin / Admin / User)
- 📊 Dashboard with Recharts (bar, line, pie charts)
- 🛢️ Cylinder tracking with IN/OUT status flow
- 🔥 Filling session management (start/end/duration)
- 📦 Inventory with real-time low-stock alerts
- 🚛 Vehicle fleet + fuel log tracking
- 👥 Customer & supplier CRUD
- 👨‍💼 HR: employees, attendance, salary records
- 💸 Expense tracking with category charts
- 📈 Reports with date filters + CSV export
- 🌙 Dark / light mode (localStorage persisted)
- 📱 Fully responsive (mobile-first)
- 🔔 Toast notifications
- ✅ Form validation with React Hook Form + Yup
- ⚡ Real-time Firestore listeners (onSnapshot)

---

## 🛠️ Tech Stack

| Tech | Usage |
|------|-------|
| React 18 + Vite | Frontend framework |
| Tailwind CSS v3 | Utility-first styling |
| React Router v6 | Client-side routing |
| Firebase Auth | Authentication |
| Cloud Firestore | Real-time database |
| Firebase Storage | File storage |
| React Hook Form | Form management |
| Yup | Schema validation |
| Recharts | Data visualization |
| Lucide React | Icon library |
| React Hot Toast | Notifications |
| date-fns | Date utilities |

---

## 📦 Build for Production

```bash
npm run build
```

Output is in the `dist/` folder — deploy to Firebase Hosting, Vercel, or Netlify.

---

## 🔒 Security Notes

- All Firestore operations are protected by security rules (`firestore.rules`)
- Only Super Admin can approve/reject users and change roles
- Route-level and database-level access control both enforced
- Pending/rejected users are logged out automatically

---

## 📄 License

MIT — Free to use and modify for personal and commercial projects.
