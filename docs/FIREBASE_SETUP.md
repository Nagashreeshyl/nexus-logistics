# Firebase Setup — Nexus Logistics V2

V1 (`v1.0.0`) stays untouched. Configure Firebase only for the **`v2`** branch.

## 1. Create or select a Firebase project

In [Firebase Console](https://console.firebase.google.com/):

1. Create a project (recommended name: `nexus-logistics`) **or** select an existing one.
2. Note the **Project ID**.

## 2. Enable Authentication

1. Build → Authentication → Get started  
2. Sign-in method → **Email/Password** → Enable  

## 3. Create Firestore

1. Build → Firestore Database → Create database  
2. Start in **production mode** (rules file in repo will be deployed)  
3. Choose a region (e.g. `asia-south1`)

## 4. Register a Web App

1. Project settings → Your apps → Web  
2. Copy the Firebase web config into `frontend/.env.local`:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## 5. Service account (backend Admin SDK)

1. Project settings → Service accounts → Generate new private key  
2. Save as `secrets/firebase-service-account.json` (gitignored)  
3. Backend `.env`:

```bash
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./secrets/firebase-service-account.json
NEXUS_ORG_ID=nexus-demo
NEXUS_DEMO_EMAILS=nagashreeshyl@gmail.com,skandachandrashekar335@gmail.com,nivethams07@gmail.com,ankithalokesh0@gmail.com
```

**Never commit** the JSON key or real `.env` files.

## 6. Create demo Auth users (passwords)

In Authentication → Users → Add user, create accounts for each demo email with passwords **you** choose.  
Do **not** put passwords in git or `.env`.

## 7. Provision Firestore roles

After Auth users exist and backend can reach Firebase:

```bash
cd backend
../.venv/bin/python scripts/provision_demo_users.py
```

This writes/updates `users/{uid}` with roles `[admin, dispatcher, driver, analyst]`.

## 8. Deploy rules (optional for emulator)

```bash
# Update .firebaserc with your project id first
npx -y firebase-tools@latest use YOUR_FIREBASE_PROJECT_ID
npx -y firebase-tools@latest deploy --only firestore:rules
```

## 9. Emulators (recommended for tests)

From `frontend/`:

```bash
npm run firebase:emulators
```

Or:

```bash
npx -y firebase-tools@latest emulators:start --only auth,firestore
```

Backend:

```bash
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_PROJECT_ID=demo-nexus
```

Frontend (`frontend/.env.local`):

```bash
VITE_USE_FIREBASE_EMULATOR=true
# Still need VITE_FIREBASE_* keys pointing at the same project id (demo-nexus is fine for emulators)
```

## Compatibility note

OR-Tools pins `protobuf==5.26.1`. Backend uses `firebase-admin==6.5.0` verified to import Auth + Firestore with that pin. Do not upgrade `google-cloud-firestore` to versions that require protobuf ≥6 without validating OR-Tools.
