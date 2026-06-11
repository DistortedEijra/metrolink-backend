# Deploying Metrolink FOMS online (demo)

The repo now ships with a `Dockerfile` that builds the backend WAR, bundles
the frontend, and serves both from one Tomcat container. The container
auto-initializes the database (schema + demo data) on first boot.

The fastest host for this is **Railway** (free trial credit, one-click MySQL,
auto HTTPS domain, builds straight from the Dockerfile in this repo).

## Steps (≈5-10 minutes)

1. Go to https://railway.app and **sign in with GitHub** (use the
   `DistortedEijra` account so it can see this repo).
2. **New Project → Deploy from GitHub repo** → select `metrolink-backend`.
   Railway detects the `Dockerfile` and builds it automatically.
3. Add the database: in the project, click **+ New → Database → Add MySQL**.
4. Open the web service (the one built from the Dockerfile) → **Variables**
   tab → add references to the MySQL service's variables:
   - `MYSQLHOST`   → `${{MySQL.MYSQLHOST}}`
   - `MYSQLPORT`   → `${{MySQL.MYSQLPORT}}`
   - `MYSQLUSER`   → `${{MySQL.MYSQLUSER}}`
   - `MYSQLPASSWORD` → `${{MySQL.MYSQLPASSWORD}}`

   (Railway shows a "+" / variable-reference picker — pick the MySQL
   service's vars, no need to type values manually.)
5. Add one more variable for security:
   - `JWT_SECRET` → any long random string (e.g. generate one with
     `openssl rand -hex 32`)
6. Go to the web service's **Settings → Networking** and click
   **Generate Domain**. Set the target port to `8080` if asked.
7. Wait for the deploy to finish (first boot also loads `schema.sql` +
   `demo-seed.sql` into the database — check the Deploy Logs for
   "Database ready.").
8. Open `https://<your-app>.up.railway.app/metrolink-frontend/` — that's the
   live demo URL. Log in with the seeded admin account
   (`admin` / `admin123`).

## Notes

- Both the API (`/metrolink-backend/api/...`) and the frontend
  (`/metrolink-frontend/...`) are served from the same Tomcat/domain, so the
  frontend's API base (`window.location.origin + '/metrolink-backend/api'`)
  works automatically — no extra config needed.
- Local development is unaffected: `src/main/resources/config.properties`
  (gitignored) still works as before when the `MYSQLHOST`/`JWT_SECRET` env
  vars aren't set.
- To reset the demo data, drop the `metrolink_db` database in Railway's MySQL
  data tab and redeploy — the entrypoint script will reseed it.
