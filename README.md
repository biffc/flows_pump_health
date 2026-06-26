# Pump Health (Flows App)

## Local Development

This app is pinned to port `3003` for predictable Fusion live refresh.

1. Start the app:
   ```bash
   npm run dev
   ```
   If port 3003 is stuck from an old Vite process, use:
   ```bash
   npm run dev:reset
   ```
2. Open the Fusion development URL using the same port:
   ```text
   https://<org>.fusion.cognite.com/<project>/custom-apps/development/pump-health/3003?cluster=<cluster>&workspace=flows
   ```

## Why Port 3003 Is Fixed

- `dev` and `start` use `vite --port 3003 --strictPort`.
- `--strictPort` prevents Vite from silently switching to another port.
- This avoids the common issue where Fusion points to one port while Vite runs on another, which looks like "screen not refreshing".

## Troubleshooting Refresh Issues

- If the app does not refresh in Fusion, confirm the URL contains `/pump-health/3003`.
- If `npm run dev` fails because port 3003 is already in use, run `npm run dev:reset`.
- If the iframe appears blank, load `https://localhost:3003` once in your browser session to trust the local certificate, then reload Fusion.

## Navigation Options

The app provides two navigation methods for drilling down into pump details. Both use React Router internally but differ in Fusion state management:

### Option 1: React Router (SPA)
- **Use case**: Standard client-side navigation within the app
- **Behavior**: URL updates via browser history; back/forward buttons work
- **State persistence**: Only within the current browser session
- **Deployment**: Works standalone and in Fusion environments

### Option 2: React Router + Fusion Sync
- **Use case**: Integration with Fusion environments that require shared links and state restoration
- **Behavior**: Same as Option 1, but additionally syncs UI state (`selectedPump`, filters, chat draft) with Fusion via `api.syncInternalState()`
- **State persistence**: Shared links restore app state; reloads restore previous context through Fusion host
- **Deployment**: Recommended for Fusion deployments; gracefully degrades in demo/local mode

**How to switch**: Use the "Navigation Method Demo" toggle card on the dashboard to compare both options. In local demo mode, Option 2 toggle is disabled (requires Fusion host). In Fusion iframe, both options are available.
