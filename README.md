# Daemon Time

A multiplayer practice game for ACT/SAT-style math and grammar questions.
This repository contains the React frontend. Authentication uses Supabase;
the Socket.IO game server lives in a separate repository.

## Local development

1. Install Node.js 24 and run `npm ci`.
2. Copy `.env.example` to `.env.local` and supply your Supabase project URL
   and public/publishable key. Never put a Supabase service-role key in frontend configuration.
3. Start the separate game server on port 3000.
4. Run `npm run dev` and open the URL Vite prints.

By default, Socket.IO connects through Vite's proxy to `http://localhost:3000`.
Set `VITE_SOCKET_URL` to connect to a different game server in either development
or production. Vite embeds these values at build time, so restart or rebuild after changes.

On Windows with PowerShell script restrictions, use `npm.cmd` in place of `npm`.

## Commands

| Command                | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Start the development server                         |
| `npm run format`       | Apply consistent formatting                          |
| `npm run format:check` | Check formatting without changing files              |
| `npm run lint`         | Check JavaScript, TypeScript, and React hooks        |
| `npm test`             | Run socket regression tests using Node's test runner |
| `npm run build`        | Type-check and create the production site in `dist`  |
| `npm run preview`      | Preview the production build locally                 |

The socket tests use a fake transport and require no network or credentials.
An end-to-end multiplayer test requires the separate backend and a configured
Supabase project.

## Code layout

- `src/App.tsx` owns authentication, routes, and theme changes.
- `src/components` contains the lobby, game, chat, and authentication screens.
  `AuthForm.css` holds the shared login, signup, and recovery styles.
- `src/services/socket.service.ts` owns the connection and immutable snapshots
  of server state. Components subscribe through `src/hooks/useSocketState.ts`.
- `src/services/auth.service.ts` contains authentication operations.
- `tests/socket.service.test.mjs` covers connection lifecycles, room changes,
  stale responses, message history, and the backend event contract.

## Deployment

Pushes to `main` run formatting, lint, tests, and the production build before
deploying to GitHub Pages. In the repository's Pages settings, select GitHub
Actions as the source and keep the custom domain from `CNAME`.

The build reads `VITE_SOCKET_URL`, `VITE_SUPABASE_URL`, and
`VITE_SUPABASE_PUBLISHABLE_KEY` from the repository's tracked `.env` file.
No duplicate GitHub Actions variables are required. Set `VITE_SOCKET_URL` to
the HTTPS origin of the separately hosted game server. That server must allow
connections from the frontend domain and validate Supabase access tokens.
GitHub Pages serves only the frontend.

Local development uses the same socket URL unless you override it in
`.env.local`. To use the local game server through Vite's proxy, set
`VITE_SOCKET_URL=` in `.env.local`.

The build creates entry files for `/login/`, `/signup/`, `/forgot-password/`,
and `/reset-password/`, plus a `404.html` fallback. To enable password recovery,
allow `https://daemontime.com/reset-password/` and your local development
equivalent in Supabase Authentication's redirect URL configuration.
