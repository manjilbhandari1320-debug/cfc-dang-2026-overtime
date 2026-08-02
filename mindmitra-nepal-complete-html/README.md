# MindMitra Nepal — HTML/CSS/JS + Neon PostgreSQL

MindMitra uses a Node.js API backed by Neon PostgreSQL. Database credentials are available only to the server and are never sent to browser JavaScript.

## Setup and run

From the repository root:

```powershell
npm install
npm run db:migrate
npm start
```

Then open `http://localhost:3000`.

The `.env` file must contain `DATABASE_URL` with the Neon pooled PostgreSQL connection string. Never commit `.env` or place the connection string in HTML/JavaScript under `mindmitra-nepal-complete-html`.

## Authentication

- Passwords are salted and hashed with Node.js `scrypt`.
- Login verification happens only on the server.
- Successful login creates a random, hashed database session and an HTTP-only, SameSite cookie.
- Organization-created student and employee accounts can log in by email or username.
- `client`, `counsellor`, `organization_admin`, and `super_admin` permissions are checked by API routes.

## Database

The idempotent schema is in `neon/schema.sql`. Apply schema changes with:

```powershell
npm run db:migrate
```

## Important production work

Before clinical production use, add MFA, password-reset/email-verification flows, a transactional email provider, Google Meet OAuth credentials, centralized rate limiting, encrypted backups, comprehensive audit coverage, and independent privacy/security review.
