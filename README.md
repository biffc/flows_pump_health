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
