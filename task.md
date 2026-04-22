# Dockerize and Auth Task List

- `[/]` **Project Restructure**
  - `[ ]` Move existing source code into `frontend/` directory.
  - `[ ]` Create `backend/` directory structure.
  - `[ ]` Create `docker-compose.yml`.

- `[ ]` **Backend (Node/Express)**
  - `[ ]` Initialize `package.json` and install dependencies (`express`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `cors`).
  - `[ ]` Create MongoDB models (`User.js`, `Log.js`).
  - `[ ]` Create authentication controllers (Register, Login).
  - `[ ]` Create habit tracking API endpoints (Get/Save Logs).
  - `[ ]` Create backend `Dockerfile`.

- `[ ]` **Frontend Update**
  - `[ ]` Create `Dockerfile` for Vite frontend.
  - `[ ]` Implement a Splash Screen.
  - `[ ]` Implement Login and Registration components.
  - `[ ]` Refactor `Store.jsx` to fetch and post to the backend API instead of `localStorage`.
  - `[ ]` Protect routes using auth context.

- `[ ]` **Docker Orchestration & Build**
  - `[ ]` Execute `docker-compose up -d --build`.
  - `[ ]` Verify connectivity and container health.
