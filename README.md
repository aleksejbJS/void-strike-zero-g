cd server
npm install
npm run dev:local     # LAN only
npm run dev:public    # public URL through localtunnel
npm run dev:ngrok     # public URL through ngrok (set NGROK_AUTHTOKEN first)
Deployment
Every push to main builds the game and publishes it to GitHub Pages (.github/workflows/deploy.yml). The build takes the SUPABASE_URL and SUPABASE_ANON_KEY repository variables. Database changes are SQL migrations in supabase/migrations/; docs/supabase-setup.md lists which ones each release needs. The supabase-keepalive.yml workflow pings the database every three days so the free Supabase project does not pause.
Tech stack
UI: React 19, TypeScript, Tailwind CSS, built with Vite
Rendering: PixiJS 8
Physics: Matter.js plus the game's own ragdoll code
Networking: PeerJS (browser-hosted rooms), Socket.IO (dedicated server)
Backend: Supabase (accounts, cloud saves, tournaments, leaderboards)
Audio: Web Audio API with procedurally generated sounds
Tests: Vitest and Testing Library; SQL tests in supabase/tests/