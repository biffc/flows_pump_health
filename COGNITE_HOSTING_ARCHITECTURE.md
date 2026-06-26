# How the Local React App Interacts with Cognite

## Overview

Your Cognite Flows app operates across three layers: **local development**, **Fusion integration**, and **production hosting**. This document explains how code changes on your machine are reflected in the Cognite Data Fusion environment.

---

## The Three Layers

```
Your Local Machine (Dev)
    ↓ (Vite HMR + mkcert HTTPS)
Port 3003 (https://localhost:3003)
    ↓ (Tunnel or Fusion Dev Server)
Cognite Fusion iframe (Browser loads your app)
    ↓ (npm run build)
Cognite's Hosting (Production)
```

---

## Layer 1: Local Development

### What Happens When You Run `npm run dev`

```bash
npm run dev
# Starts Vite dev server on port 3003
# Enables Hot Module Replacement (HMR)
# Uses mkcert HTTPS certificates
# Binds strictly to port 3003 (--strictPort)
```

Your **local Vite server** serves the app at `https://localhost:3003`. This is only accessible on your machine—it is not yet on the internet.

### How Files Are Served

- **Source files** (`src/`) remain on your disk
- **Vite dev server** watches for changes
- **In-memory bundling**: Files are not written to disk; they're bundled in RAM
- **mkcert HTTPS**: Self-signed certificates allow `https://localhost:3003` to work in Fusion

---

## Layer 2: Fusion Integration (The Magic Part)

### The @cognite/app-sdk Connection

Your app imports and uses the Cognite SDK:

```typescript
// src/App.tsx
import { connectToHostApp } from '@cognite/app-sdk';

const { api, initialState } = await connectToHostApp({ 
  applicationName: 'pump-health' 
});
```

**What `connectToHostApp()` does:**
- Detects if your app is running **inside a Fusion iframe**
- If yes: Returns an `api` object with methods to interact with Cognite
- If no: Returns `null` (demo mode)

### The API Object Provides

```typescript
api.getAccessToken()        // CDF authentication token
api.getBaseUrl()            // CDF cluster URL
api.getProject()            // Current CDF project name
api.syncInternalState()     // Share UI state with Fusion
api.navigateInternal()      // Navigate between Fusion apps
api.registerAgentServer()   // Expose agents to Fusion
```

### How the Connection Works

When **you open your Flows app in Fusion**:

1. **Fusion creates an iframe** inside its web interface
2. **Fusion points the iframe to your app's URL**
   - Development: `https://localhost:3003`
   - Production: `https://cognite-apps.azurewebsites.net/pump-health-xyz`
3. **Your browser loads that URL**
   - In dev mode, your browser requests `https://localhost:3003`
   - This works because you're on the same machine as the Vite server
4. **Fusion handles CDF OAuth**
   - Fusion authenticates with Cognite Data Fusion
   - Fusion gives your app an access token via `connectToHostApp()`
5. **Your app uses the token**
   - Calls `api.getAccessToken()` to get the token
   - Calls `api.getBaseUrl()` to get the CDF cluster URL
   - Creates a Cognite SDK client with these credentials
   - Queries real production CDF data

### Data Flow Diagram

```
Browser (Your Machine)
    ↓
Cognite Fusion iframe
    ↓
Loads https://localhost:3003 (Vite dev server)
    ↓
Your React app runs
    ↓
Calls connectToHostApp()
    ↓
Fusion provides access token
    ↓
Your app calls CDF APIs
    ↓
Real Cognite data returned
    ↓
React renders with production data
```

---

## Layer 3: Live Refresh (Vite HMR)

### Why Changes Appear Instantly

This is the key to the developer experience:

1. **You edit a file** → Save in VS Code
2. **Vite watches for changes** → Detects file modification
3. **HMR (Hot Module Replacement) rebuilds** → Only changed modules
4. **HMR sends delta to browser** → Over WebSocket
5. **Browser re-renders component** → Without full page reload
6. **React state is preserved** → You don't lose your place in the app

### Example Workflow

```
You edit src/pages/Dashboard.tsx
    ↓
Vite detects change
    ↓
Rebuilds only Dashboard.tsx module
    ↓
HMR sends update over WebSocket
    ↓
Browser receives new code
    ↓
React replaces Dashboard component
    ↓
UI updates instantly
    ↓
Fusion iframe sees the change
```

### Why This Is Not "NPM Refresh in Cognite"

**Important clarification:** NPM packages are **not** being refreshed in Cognite. Instead:

- ✅ Your **local machine** has `node_modules/`
- ✅ **Vite bundles packages locally** into your app
- ✅ **Code changes** are sent via HMR WebSocket
- ✅ **Cognite iframe** reloads only the changed component
- ✅ **No network upload** to Cognite's servers during development

The browser (inside Fusion) is polling your local Vite dev server for updates. When you save a file, Vite says "here's the new code," and React re-renders.

---

## HTTPS and mkcert

### Why HTTPS Is Required

**Fusion only loads HTTPS iframes.** During development, you need:

```bash
# In certificates/mkcert/
localhost.pem          # Certificate
localhost-key.pem      # Private key
```

These are created by `mkcert`, a tool that generates self-signed certificates trusted by your machine.

### How Vite Uses Them

In `vite.config.ts`:

```typescript
server: {
  https: {
    cert: fs.readFileSync('./certificates/mkcert/localhost.pem'),
    key: fs.readFileSync('./certificates/mkcert/localhost-key.pem'),
  },
  port: 3003,
  strictPort: true,
}
```

This allows `https://localhost:3003` to work without browser warnings.

---

## Deployment: Getting to Production

### Building for Production

```bash
npm run build
# Produces dist/ folder with optimized, bundled code
# No source maps or dev tooling
# Ready for hosting
```

### Submitting to Cognite

```bash
npx @cognite/cli apps submit
# Zips your dist/ folder
# Uploads to Cognite's app hosting service
# Cognite assigns you a real HTTPS URL
# No longer points to your local machine
```

### After Deployment

- **Cognite hosts your built `dist/`** on their servers
  - Example URL: `https://cognite-apps.azurewebsites.net/pump-health-xyz`
- **Fusion iframe points to that URL** instead of `localhost:3003`
- **Users access it from the cloud** ☁️
- **No HMR** (hot module replacement) in production
- **No local dev server needed** for users

---

## Complete Flow Diagram

### Development Environment (Now)

```
┌─────────────────────────────────────────────────────────┐
│ YOU (Developer)                                          │
│  ├─ Run: npm run dev                                    │
│  ├─ Edit: src/ files in VS Code                         │
│  └─ Save: Triggers Vite rebuild + HMR                   │
│                                                          │
│ YOUR LOCAL MACHINE                                       │
│  ├─ Vite Dev Server (port 3003)                         │
│  │  ├─ Watches src/ files                               │
│  │  ├─ Bundles code in RAM                              │
│  │  ├─ Streams HMR updates via WebSocket                │
│  │  └─ Uses mkcert HTTPS certificates                   │
│  │                                                       │
│  └─ Browser                                             │
│     ├─ Connects to https://localhost:3003               │
│     ├─ Loads React app                                  │
│     └─ Connects to Fusion iframe                        │
│                                                          │
│ COGNITE FUSION (Cloud)                                   │
│  ├─ Loads your app in iframe                            │
│  │  └─ src attribute: https://localhost:3003            │
│  ├─ Provides access token                               │
│  ├─ Your app uses token to query CDF                    │
│  └─ Real production data returned to your app           │
└─────────────────────────────────────────────────────────┘
```

### Production Environment (After npm run build + apps submit)

```
┌─────────────────────────────────────────────────────────┐
│ COGNITE APP HOSTING (Azure Servers)                      │
│  ├─ Hosts dist/ folder                                  │
│  ├─ URL: https://cognite-apps.azurewebsites.net/...     │
│  └─ Static files only (no HMR)                          │
│                                                          │
│ USER BROWSER (Anywhere in the World)                     │
│  ├─ Loads Cognite Fusion web application                │
│  ├─ Fusion loads your app in iframe                      │
│  │  └─ src attribute: https://cognite-apps.../pump-h... │
│  ├─ Provides access token                               │
│  ├─ Your app queries CDF APIs                           │
│  └─ Real production data returned                       │
└─────────────────────────────────────────────────────────┘
```

---

## Key Architecture Insights

### Why This Design Works

| Component | Purpose | Benefit |
|-----------|---------|---------|
| **Local Vite Dev Server** | Serves code with HMR | Instant feedback during development |
| **mkcert HTTPS** | Secure localhost serving | Fusion iframe security requirement |
| **connectToHostApp()** | Detects Fusion iframe | Works both locally and in production |
| **Access Token Handoff** | Fusion provides auth | Your app never handles passwords |
| **iframe Isolation** | Browser security model | Fusion can host multiple apps safely |
| **npm run build** | Optimized production bundle | No dev dependencies in production |

### Security Model

- **Your app never stores credentials**
  - Fusion handles all OAuth with Cognite
  - You only get an access token
  - Token is passed via `connectToHostApp()`
- **iframe Sandboxing**
  - Each app runs in its own iframe
  - Cross-origin restrictions prevent interference
- **HTTPS Everywhere**
  - Development: mkcert self-signed
  - Production: Cognite's certificate authority

---

## Summary

**The Magic:** Your local changes are immediately visible in Cognite Fusion because:

1. **Vite dev server** runs on your machine at `https://localhost:3003`
2. **Fusion iframe** points to that local URL (during dev)
3. **HMR WebSocket** streams code changes to your browser
4. **React re-renders** without page reload
5. **Access token** from Fusion allows CDF API queries
6. **Real production data** flows into your local app

When you **deploy**:
1. **npm run build** creates optimized `dist/` folder
2. **npx @cognite/cli apps submit** uploads to Cognite hosting
3. **Fusion iframe** points to the cloud URL instead
4. **Users** access your app from Cognite Data Fusion

No network upload happens during development—only code deltas via HMR. The browser (inside your Fusion iframe) fetches updates from your local Vite server.

---

## Technical References

### Key Files in This Project

- **vite.config.ts** — Dev server configuration (HTTPS, port, HMR)
- **app.json** — Cognite app metadata (tells Fusion it's a Flows app)
- **src/App.tsx** — Uses `connectToHostApp()` to get Cognite API
- **tsconfig.json** — TypeScript configuration
- **package.json** — Dependencies and build scripts

### Commands

```bash
npm run dev              # Start Vite dev server with HMR
npm run build            # Build dist/ for production
npm run build -- --watch # Build and watch for changes
npx @cognite/cli apps submit  # Deploy to Cognite hosting
```

### Environment Variables (if needed)

In production, Fusion handles all auth. In development:
- No `.env` file needed
- Cognite cluster is auto-detected from Fusion
- Access token is provided by Fusion

---

**Document Version:** 1.0  
**Date:** June 26, 2026  
**App:** Pump Health Dashboard (Cognite Flows)
