# Airport Carpooling App

Monorepo with mobile app (Expo) and backend (Express / Node.js).

## Structure

- `mobile/` — Expo React Native app
- `myapp-backend/` — Express API server

## Quick start

Prerequisites:

- Node.js (16+)
- npm
- Expo CLI (`npm install -g expo-cli`) for development
- MongoDB (URI or local)

1. Backend

```bash
cd myapp-backend
npm install
# Set env vars (see Environment below)
npm run dev   # or `npm start` depending on package scripts
```

2. Mobile (Expo)

```bash
cd mobile
npm install
npx expo start -c
```

## Environment variables

Backend (`myapp-backend/.env` or environment):

- `MONGO_URI` — MongoDB connection string
- `PORT` — server port (default 3000)
- `CLOUDINARY_URL` — optional, `cloudinary://<api_key>:<api_secret>@<cloud_name>` to upload avatars
- `STRIPE_SECRET_KEY` — Stripe secret key (for driver payouts)
- `STRIPE_ONBOARD_REFRESH_URL` / `STRIPE_ONBOARD_RETURN_URL` — Stripe onboarding URLs
- `FIREBASE_SERVICE_ACCOUNT_JSON` — contents of Firebase service account JSON (or set via file `src/config/*.json`)

Mobile (set in Expo env or `.env` as `EXPO_PUBLIC_API_BASE_URL`):

- `EXPO_PUBLIC_API_BASE_URL` — e.g., `http://<host-ip>:3000/api/v1` (use `10.0.2.2` for Android emulator)

## Firebase setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication > Phone sign-in if you use phone auth.
3. Create a service account: Project Settings → Service Accounts → Generate new private key. Save the JSON.
4. For backend, you can either:
   - Place the JSON at `myapp-backend/src/config/<your-file>.json` and set `FIREBASE_SERVICE_ACCOUNT_JSON` to its contents, or
   - Set `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable to the JSON string before running the backend:

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON="$(cat /path/to/service-account.json)"
```

5. The backend uses the Firebase Admin SDK to verify ID tokens from clients.

## Avatar uploads / Cloudinary

- If `CLOUDINARY_URL` is set in the backend environment, user avatars will be uploaded to Cloudinary and the `avatar_url` and `avatar_public_id` fields will be set on the user.
- If `CLOUDINARY_URL` is not set, avatars are stored in `avatar_url` as base64 in the DB (not recommended for production).

## Notes & security

- Do NOT commit secrets to Git. This repo may already contain service account files — consider rotating keys if pushed to a public repo.
- Add `.env` to `.gitignore` and avoid committing `node_modules`.

## Troubleshooting

- Expo bundler cache issues: `npx expo start -c`
- Android emulator: use `10.0.2.2` to reach localhost
- If Cloudinary uploads fail, check `CLOUDINARY_URL` and backend logs.

---

Created/updated by development assistant. Adjust README details to your project conventions and secrets handling policies.
