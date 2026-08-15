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

The project uses Supabase **asymmetric JWT signing keys**, so `SupabaseAuthGuard` verifies access tokens locally against the project's JWKS — the recommended approach: the public key is fetched once from `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, cached by `jose`, and no signing secret is ever stored in this service. Legacy HS256 tokens are rejected.

Each token is checked for signature (`ES256`/`RS256` only), issuer (`<SUPABASE_URL>/auth/v1`), audience and expiry; `sub` and `email` are then exposed as `req.user`.

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | **yes** | Project URL; also the expected issuer and the source of the JWKS URL. The app refuses to start without it, so issuer validation can never be skipped |
| `SUPABASE_JWT_AUD` | no | Expected audience, defaults to `authenticated` |

A rejected token logs one `SupabaseAuthGuard` warning with the issuer, JWKS URL and the underlying jose error — never the token itself.

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

## 🛒 Product lifecycle

A product is `DRAFT`, `ACTIVE` or `ARCHIVED`, and the reads are split accordingly:

- `GET /products`, `GET /products/:id`, `GET /products/slug/:slug` and the public details reads
  (`GET /products/:productId/details`, `GET /products/slug/:slug/details`) — public, and they only
  ever see `ACTIVE` products; a draft or archived one answers `404`.
- `/admin/products` — ADMIN only, every status visible, optionally filtered with `?status=DRAFT`.

A product is created as a `DRAFT` and the status is never taken from the request body: it moves
through `POST /admin/products/:id/publish` (`DRAFT → ACTIVE`), `/archive` (`ACTIVE → ARCHIVED`) and
`/restore` (`ARCHIVED → ACTIVE`). Any other transition answers `409`. `DELETE /admin/products/:id`
is permanent and therefore allowed for drafts only; published products are archived instead. The
transitions and the delete carry the expected source status in the write itself, so two concurrent
requests cannot both win.

---

## 👥 Users

`GET /admin/users` (ADMIN only) lists the `profiles` rows — user id, both names, email, role and
registration date — newest first, and takes an optional `?search=` that matches the email or either
name case-insensitively. It is unpaginated: the admin app sorts and paginates the list it is given.
Nothing from Supabase's `auth.users` is exposed; a user's own profile is still `GET /users/me`.

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
