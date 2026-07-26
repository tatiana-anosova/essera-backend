# Essera Backend

Backend service for **Essera**, an early-stage retail platform built as a personal product project.

This repository focuses on API design, authentication, and modular backend architecture using NestJS.

---

## 🚀 Project Status

**Work in progress.**  
Core API structure and main domain logic are implemented.  
The backend is actively used by the frontend application.

---

## 🧠 Overview

The backend provides REST APIs for core product functionality, including:

- Product catalog management
- Product variants and sizes
- Authenticated user profile access

---

## 🛠 Tech Stack

- **NestJS**
- **TypeScript**
- **Supabase** (Authentication & Database)
- **Prisma**
- **REST API**
- **Swagger** for API documentation

---

## 🧩 Architecture

- Modular, domain-based structure (e.g. `products`, `users`)
- Each domain includes:
	- Controller
	- Service
	- Module
- DTOs are used for request and response contracts
- Prisma is used for database access and schema management

---

## 🔐 Authentication

- Authentication is implemented using a **custom Supabase-based NestJS guard**
- Protected routes use `@UseGuards`
- Authenticated user context is extracted from the request object
- Authorization uses a `role` column (`ADMIN` | `CUSTOMER`) on `profiles`, checked by `RolesGuard` via `@Roles('ADMIN')`
- Product, variant, size and detail **mutations are admin-only**; all storefront `GET` endpoints stay public

### Token verification

`SupabaseAuthGuard` picks the verification key from the token's `alg` header, because Supabase signs access tokens differently depending on the project:

| Project setting | Token `alg` | Required env |
| --- | --- | --- |
| Legacy JWT secret | `HS256` | `SUPABASE_JWT_SECRET` (Supabase → Settings → API → JWT Settings) |
| Asymmetric signing keys | `ES256` / `RS256` | none — the key is fetched from the project's JWKS |

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Project URL; also the expected issuer (`<url>/auth/v1`) |
| `SUPABASE_JWT_SECRET` | only for HS256 projects | Legacy JWT secret |
| `SUPABASE_JWKS_URL` | no | Overrides the derived `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` |
| `SUPABASE_JWT_AUD` | no | Expected audience, defaults to `authenticated` |

Tokens are also checked against the expected issuer and audience. A rejected token logs one `SupabaseAuthGuard` warning with the `alg`, `kid`, issuer, JWKS URL and the underlying jose error — never the token itself.

---

## 🗄 Database Setup

1. Apply the Prisma migrations (enum `UserRole`, `profiles.role` defaulting to `CUSTOMER`, schema changes):

```bash
npx prisma migrate deploy
```

2. Run the Supabase-specific provisioning SQL **manually and separately** — it depends on `auth.users`, which only exists in a Supabase database, so it is deliberately not a Prisma migration. Paste `supabase/profile-provisioning.sql` into the **Supabase SQL Editor** (which runs with the privileges required to create a trigger on `auth.users`), or run it through the Supabase CLI against the direct — not pooled — connection:

```bash
supabase db execute --file supabase/profile-provisioning.sql
```

Creating a trigger on `auth.users` requires ownership of that table, so this must be executed by a privileged role (the SQL Editor or the `postgres` service role). The application's runtime `DATABASE_URL` role is not expected to have those privileges, which is why the step is manual.

It creates a trigger that inserts a `profiles` row for every new `auth.users` record and backfills existing ones. It is safe to run more than once and never overwrites existing profiles.

3. Promote one profile to admin (every profile is created as `CUSTOMER`):

```sql
UPDATE profiles SET role = 'ADMIN' WHERE email = '<your-admin-email>';
```

---

## 📖 API Documentation

Swagger is enabled for local development and used for API exploration and admin-level operations during the MVP phase.

Local Swagger URL:
http://localhost:3001/api/

---

## 🧭 Future Improvements

- Introduce role-based access control
- Improve validation and error handling
- Expand test coverage
- Add an admin UI instead of Swagger-only workflows

---

## ⚙️ Local Development

Install dependencies and start the development server:

```bash
npm install
npm run start:dev
```

The service runs locally at:
http://localhost:3001

---

## 👩‍💻 Author

Built by **Tatiana Anosova**  
Senior/Staff Frontend Engineer

- LinkedIn: https://www.linkedin.com/in/tatiana-anosova
- Email: tatiana.anosova78@gmail.com
