# Converting Habit Tracker to a Full-Stack Containerized Application

This plan outlines the architecture and steps required to convert your currently client-side-only React habit tracker into a robust, full-stack microservices application powered by Docker, Node.js, and MongoDB, complete with user authentication.

## User Review Required

> [!WARNING]
> This is a large architectural shift. 
> 1. Your existing `localStorage` data will NOT be automatically migrated to the new MongoDB database. We will start fresh with authenticated accounts.
> 2. The project structure will change significantly to accommodate a monolithic repository holding both frontend and backend services, orchestrated by `docker-compose`.

## Proposed Architecture

We will restructure the project into three distinct microservices running in Docker containers:

1. **Frontend (`frontend/`)**: Your existing Vite + React application.
2. **Backend (`backend/`)**: A new Node.js/Express REST API serving authentication and data mapping.
3. **Database (`mongo`)**: An official MongoDB Docker image.

These will be orchestrated using a single `docker-compose.yml` at the project root.

## Proposed Changes

---

### Project Restructure

We need to create the root directory for the microservices.

#### [MODIFY] Move current app to frontend
All content currently in `habit-tracker/` will be moved to `habit-tracker/frontend/`.

#### [NEW] [docker-compose.yml](file:///c:/Users/Mechergui%20Rami/.gemini/antigravity/brain/ea474d78-f084-4f1b-89e3-2cda24be8ebe/habit-tracker/docker-compose.yml)
Will contain the configuration linking the `frontend`, `backend`, and `mongo` services via a shared Docker network and volume for data persistence.

---

### Frontend (React/Vite)

#### [NEW] [frontend/Dockerfile](file:///c:/Users/Mechergui%20Rami/.gemini/antigravity/brain/ea474d78-f084-4f1b-89e3-2cda24be8ebe/habit-tracker/frontend/Dockerfile)
A Dockerfile to serve the Vite development server (or built files) via Nginx.

#### [NEW] Splash Screen Component
Create a `SplashScreen.jsx` that shows a vibrant, dynamic animation for 2-3 seconds upon app load.

#### [NEW] Authentication Views
Create `Login.jsx` and `Signup.jsx` pages using the existing `.glass-card` aesthetics.

#### [MODIFY] [frontend/src/Store.jsx](file:///c:/Users/Mechergui%20Rami/.gemini/antigravity/brain/ea474d78-f084-4f1b-89e3-2cda24be8ebe/habit-tracker/frontend/src/Store.jsx)
Rip out the `localStorage` logic. Replace it with `fetch` or `axios` calls pointing to the backend API (`http://localhost:5000/api/habits`). Introduce authentication context (storing JWT tokens).

---

### Backend (Node.js/Express)

#### [NEW] [backend/Dockerfile](file:///c:/Users/Mechergui%20Rami/.gemini/antigravity/brain/ea474d78-f084-4f1b-89e3-2cda24be8ebe/habit-tracker/backend/Dockerfile)
Node.js environment setup.

#### [NEW] [backend/server.js](file:///c:/Users/Mechergui%20Rami/.gemini/antigravity/brain/ea474d78-f084-4f1b-89e3-2cda24be8ebe/habit-tracker/backend/server.js)
Entry point for the API managing routes, CORS, and JSON parsing.

#### [NEW] Database Connection Models
- `backend/models/User.js`: Schema for Email/Password (hashed via bcrypt) credentials.
- `backend/models/Log.js`: Schema containing the massive habit payload for each day.

#### [NEW] Controllers & Routes
- `backend/controllers/authController.js`: Registration, Login, and JWT generation logic.
- `backend/controllers/habitController.js`: CRUD operations for getting weekly/monthly user-specific data.

## Open Questions

> [!IMPORTANT]
> 1. You mentioned "confirm it" regarding signup. Do you explicitly want **Email Verification** (sending a physical email via SMTP or SendGrid containing a link they must click before logging in), or did you just mean a "Confirm Password" password input box on the frontend?
> 2. Are you familiar with running `docker-compose up` on your Windows machine, or would you like me to execute the build scripts remotely?

## Verification Plan

### Automated/Manual Verification
- I will run `docker-compose build` and `docker-compose up` to ensure all 3 services start successfully and communicate contextually without networking errors.
- Create a test user via the new React Signup page.
- Log in and verify a JWT session token is assigned.
- Submit a daily log and verify the data travels through the Express API and persists directly in the MongoDB container volume.
