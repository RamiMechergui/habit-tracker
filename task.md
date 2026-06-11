# Dockerize and Auth Task List

- `[/]` **Project Restructure**
  - `[ ]` Move existing source code into `frontend/` directory.
  - `[ ]` Create `backend/` directory structure.
  - `[ ]` Create `docker-compose.yml`.

- `[ ]` **Backend (Node/Express)**
  - `[x]` Update `pm2.config.js` with robust query parameter enrichment (`authSource=admin`, `serverSelectionTimeoutMS=5000`, `connectTimeoutMS=5000`).
  - `[ ]` Initialize `package.json` and install dependencies (`express`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `cors`).
  - `[ ]` Create MongoDB models (`User.js`, `Log.js`).
  - `[ ]` Create authentication controllers (Register, Login).
  - `[ ]` Create habit tracking API endpoints (Get/Save Logs).
# Dockerize and Auth Task List

- `[/]` **Project Restructure**
  - `[ ]` Move existing source code into `frontend/` directory.
  - `[ ]` Create `backend/` directory structure.
  - `[ ]` Create `docker-compose.yml`.

- `[ ]` **Backend (Node/Express)**
  - `[x]` Update `pm2.config.js` with robust query parameter enrichment (`authSource=admin`, `serverSelectionTimeoutMS=5000`, `connectTimeoutMS=5000`).
  - `[ ]` Initialize `package.json` and install dependencies (`express`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `cors`).
  - `[ ]` Create MongoDB models (`User.js`, `Log.js`).
  - `[ ]` Create authentication controllers (Register, Login).
  - `[ ]` Create habit tracking API endpoints (Get/Save Logs).
  - `[ ]` Create backend `Dockerfile`.

- `[ ]` **Frontend Update**
  - `[ ]` Create `Dockerfile` for Vite frontend.
  - `[ ]` Implement a Splash Screen.
  - `[ ]` Implement Login and Registration components.
  - `[x]` Update `frontend/src/pages/TasksPage.jsx` to remove push notifications hook and banner.
  - `[x]` Update `frontend/src/Store.jsx` to clean up notifications/SSE states, helper functions, and context values.
  - `[/]` Update `frontend/src/components/timeline/TaskBottomSheet.jsx` to remove notification settings and bell icon options.
  - `[ ]` Protect routes using auth context.

- `[ ]` **Docker Orchestration & Build**
  - `[ ]` Execute `docker-compose up -d --build`.
  - `[ ]` Verify connectivity and container health.
