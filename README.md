# Rex Dashboard

Rex is a vanilla HTML, CSS and JavaScript Discord dashboard hosted with Cloudflare Pages Functions. It uses Discord OAuth2 (`identify guilds`), only lists guilds where the signed-in user has **Manage Server** or **Administrator**, and checks whether the configured bot can access each guild. OAuth tokens stay in Cloudflare D1; the browser receives only a random session ID in an HttpOnly cookie.

## Local development

1. Install Node.js (use the current LTS release).
2. From this project root, install dependencies:

   ```bash
   npm install
   ```

   In PowerShell, use `npm.cmd install` if script execution blocks `npm.ps1`.

3. Copy `.dev.vars.example` to `.dev.vars` in the project root. In PowerShell:

   ```powershell
   Copy-Item .dev.vars.example .dev.vars
   ```

4. In the [Discord Developer Portal](https://discord.com/developers/applications), create an application and bot. Set these values in `.dev.vars`:

   - `DISCORD_CLIENT_ID`: Application ID
   - `DISCORD_CLIENT_SECRET`: OAuth2 client secret
   - `DISCORD_BOT_TOKEN`: Bot token (keep private)
   - `DISCORD_REDIRECT_URI`: the exact callback URL used locally
   - `SESSION_SECRET`: a random secret of at least 32 characters
   - `REX_TEST_GUILD_ID`: (optional) your test server ID for fast slash command updates

   Generate a session secret, for example, with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

5. Add the exact value of `DISCORD_REDIRECT_URI` to the OAuth2 redirect URIs in the Discord Developer Portal. Wrangler commonly starts at `http://localhost:8788`, making the callback `http://localhost:8788/api/auth/callback`. If Wrangler prints a different local URL or port, use that actual host and port in both `.dev.vars` and the Portal, then restart Wrangler.
6. Initialize the local D1 schema:

   ```bash
   npm run db:init
   ```

7. Start the local Pages server:

   ```bash
   npm run dev
   ```

   Or in PowerShell if needed: `npm.cmd run dev`.
8. Open the local URL printed by Wrangler. Select **Connect Discord** to sign in. In Discord's OAuth2 URL Generator (or your bot's install settings), ensure bot installation and `applications.commands` are enabled. The dashboard generates a per-server install URL with its permission set.

9. Start Rex itself in a second terminal from this project folder:

   ```bash
   npm run bot
   ```

   Keep that terminal running. The bot will show online in Discord while the process is connected. If slash commands are missing, set `REX_TEST_GUILD_ID` to your test server's ID, then run `npm run commands:deploy` once. Guild commands update quickly; omit the ID and deploy again to register commands globally. Rex needs the Server Members intent only if you add member-event features; the current command runner uses the Guilds intent.

The Pages dashboard and bot runtime are separate processes. On Cloudflare, deploy the dashboard as Pages; run the bot on a separate always-on Node host. `npm run bot` is for local testing and stops when its terminal/process stops.

## Deploy to Cloudflare Pages

1. Create a D1 database with `npx wrangler d1 create rex-dashboard`. Copy the returned database ID into `wrangler.toml`, replacing the local placeholder ID. Initialize the production schema with `npx wrangler d1 execute rex-dashboard --remote --file=./schema.sql`.
2. Push the project to a private or public GitHub repository, or deploy from the project root with Wrangler after logging in using `npx wrangler login`.
3. Set the Pages project build output directory to `.` and configure the production environment variables in Cloudflare Pages **Settings → Variables and Secrets**. Add `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_REDIRECT_URI`, and `SESSION_SECRET` as secrets where appropriate. Do not commit `.dev.vars`, tokens, or secrets.
4. Set `DISCORD_REDIRECT_URI` to the exact production callback, such as `https://your-pages-domain.example/api/auth/callback`, and add that same URL to the Discord Developer Portal OAuth2 redirect URIs.
5. Deploy from the project root:

   ```bash
   npm run deploy
   ```

   Wrangler will print the deployed Pages URL. Use that hostname in the production callback URI. If deploying through GitHub integration instead, Cloudflare builds/deploys from the connected repository; configure the same production secrets and callback URL first.

## Routes and current limits

- `GET /api/auth/discord`, `/api/auth/callback`, `/api/auth/logout`
- `GET /api/me`, `/api/servers`
- The dashboard server list, access filtering, bot installation check, and Add Rex OAuth URL use live Discord APIs.
- `bot.js` connects Rex to Discord's Gateway and responds to the listed slash commands. Start it with `npm run bot`.
- `GET` and `PUT /api/servers/:guildId/settings` return and persist per-server General, Moderation, Logging, Commands, and AutoMod settings in D1. The API rechecks the user's Discord Manage Server permission and validates selected channels against the bot's current server channels.
- Apply `schema.sql` after deploying this update so the `guild_settings` table exists: `npx wrangler d1 execute rex-dashboard --remote --file=./schema.sql`.
- Dashboard settings now save to D1, but they do not themselves moderate messages. A running Rex bot runtime must read the saved configuration and implement/enforce the configured actions.

The Discord client secret, bot token, OAuth tokens and session secret are never included in frontend JavaScript. OAuth access and refresh tokens are stored in D1; only a cryptographically random session ID is held in an HttpOnly, SameSite=Lax cookie. Production cookies use Secure on HTTPS. The dashboard needs network access to Discord's API.
