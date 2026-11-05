# NEXCLOUD

NEXCLOUD is a Next.js cloud-file dashboard backed by Supabase Authentication,
Postgres, and private Storage.

## Backend features

- Email OTP registration using Supabase Auth, Supabase Postgres, and Gmail SMTP.
- Authenticated API routes for listing files, uploading file metadata, renaming
  and deleting files, issuing signed upload/download URLs, and dashboard stats.
- File bytes upload directly to Supabase Storage using a short-lived,
  server-issued upload token. The server verifies the uploaded object and
  associates it with the authenticated user.
- File operations are scoped to the user ID from a verified Supabase access
  token. The Supabase secret key is only used on the server.

## Supabase setup

1. Create a Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql)
   in the Supabase SQL Editor. This creates the OTP and file metadata tables and
   the private `nextcloud-files` bucket (50 MB per file).
2. In Authentication settings, enable email/password sign-in. Account creation
   uses the app's email OTP flow and confirms the email after the OTP is valid.
3. Configure the environment variables listed in [`.env.example`](./.env.example).
   `SUPABASE_SECRET_KEY` must be a server-side Supabase secret/service-role key;
   never use it as a `NEXT_PUBLIC_` variable or expose it in browser code.
4. Configure Gmail SMTP with a Gmail app password for OTP delivery.

The OTP endpoints require the `email_otps` table. API file operations use the
server secret key and still verify the caller's access token and ownership for
each file. Keep the bucket private; the app generates short-lived signed URLs
for downloads and previews.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production

Set the same environment variables in the deployment platform and run:

```bash
npm run build
npm run start
```
