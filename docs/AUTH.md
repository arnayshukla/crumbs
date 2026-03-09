# Authentication

Crumbs supports password-based authentication and optional OAuth/SSO via Google, GitHub, or any OpenID Connect (OIDC) provider (e.g. Authentik, Keycloak, Okta, Auth0).

## First-run setup

On first launch, Crumbs presents a setup screen to create the initial admin account with email and password (minimum 8 characters). This account becomes the instance administrator.

## Password authentication

- Passwords are hashed with **Argon2** (argon2id variant)
- Sessions use httpOnly cookies with 30-day expiry
- Admins can reset passwords and revoke sessions for any user via Settings

## OAuth / SSO

OAuth providers are **auto-enabled** when their environment variables are set — no code changes needed. The login page dynamically shows buttons for each configured provider.

### How it works

1. User clicks an OAuth button on the login page
2. Crumbs redirects to the provider's authorization endpoint (with PKCE)
3. Provider authenticates the user and redirects back to Crumbs
4. Crumbs validates the response, extracts the user's email and name
5. If a matching user exists (by provider ID or email), a session is created
6. If no matching user exists, the login is rejected (invite-only model)

### Invite-only model

OAuth does **not** auto-create accounts. Users must be pre-created by an admin:

1. Go to **Settings > Users > Invite User**
2. Create the user with the **same email** they use on the OAuth provider
3. The user can now log in via OAuth — their account is automatically linked on first sign-in

After initial linking, the user is identified by their provider-specific ID (`sub` claim), so email changes on the provider side won't break login.

### Environment variables

#### Google OAuth

| Variable | Description |
|----------|-------------|
| `AUTH_GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `AUTH_GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |

**Callback URL:** `https://<your-domain>/api/auth/oauth/google/callback`

Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add the callback URL above as an authorized redirect URI
4. Copy the client ID and secret into your environment

#### GitHub OAuth

| Variable | Description |
|----------|-------------|
| `AUTH_GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `AUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |

**Callback URL:** `https://<your-domain>/api/auth/oauth/github/callback`

Setup:
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set the authorization callback URL to the callback URL above
4. Copy the client ID and secret into your environment

#### Generic OIDC

Any OpenID Connect-compliant provider works via the generic OIDC integration. Crumbs automatically discovers endpoints via the provider's `/.well-known/openid-configuration` document.

| Variable | Description |
|----------|-------------|
| `AUTH_OIDC_ISSUER` | OIDC issuer URL (must serve `/.well-known/openid-configuration`) |
| `AUTH_OIDC_CLIENT_ID` | OIDC client ID |
| `AUTH_OIDC_CLIENT_SECRET` | OIDC client secret |
| `AUTH_OIDC_DISPLAY_NAME` | Button label on login page (default: `SSO`) |

**Callback URL:** `https://<your-domain>/api/auth/oauth/oidc/callback`

**Required scopes:** `openid`, `profile`, `email`

### Provider guides

#### Authentik

[Authentik](https://goauthentik.io/) is a self-hosted identity provider that works with Crumbs via the generic OIDC integration.

**1. Create a provider in Authentik:**

1. Open the Authentik admin panel
2. Go to **Applications > Providers > Create**
3. Select **OAuth2/OpenID Connect**
4. Configure:
   - **Name:** `Crumbs`
   - **Authorization flow:** `default-provider-authorization-implicit-consent` (or `explicit-consent` to prompt users)
   - **Client type:** `Confidential`
   - **Redirect URIs:** `https://<your-crumbs-domain>/api/auth/oauth/oidc/callback`
   - **Scopes:** `openid`, `profile`, `email`
5. Save and note the **Client ID** and **Client Secret**

**2. Create an application in Authentik:**

1. Go to **Applications > Applications > Create**
2. Configure:
   - **Name:** `Crumbs`
   - **Slug:** `crumbs`
   - **Provider:** Select the `Crumbs` provider you just created
   - **Launch URL:** `https://<your-crumbs-domain>` (optional, for Authentik's app dashboard)
3. Save

**3. Configure Crumbs:**

```yaml
# docker-compose.yml
services:
  crumbs:
    image: ghcr.io/bretzel-app/crumbs:latest
    environment:
      - ORIGIN=https://notes.example.com
      - AUTH_OIDC_ISSUER=https://authentik.example.com/application/o/crumbs/
      - AUTH_OIDC_CLIENT_ID=<client-id>
      - AUTH_OIDC_CLIENT_SECRET=<client-secret>
      - AUTH_OIDC_DISPLAY_NAME=Authentik
```

> **Note:** The issuer URL for Authentik follows the pattern `https://<authentik-domain>/application/o/<app-slug>/`. This URL must serve a valid `/.well-known/openid-configuration` document — you can verify by visiting `https://<authentik-domain>/application/o/crumbs/.well-known/openid-configuration` in your browser.

**4. Pre-create users:**

In Crumbs, go to **Settings > Users > Invite User** and create accounts with emails matching your Authentik users. They can then log in via the "Authentik" button on the login page.

#### Keycloak

1. Create a new client in your Keycloak realm
2. Set **Client type** to `OpenID Connect`, **Client authentication** to `On`
3. Add the callback URL: `https://<your-crumbs-domain>/api/auth/oauth/oidc/callback`
4. Set the issuer URL to `https://<keycloak-domain>/realms/<realm-name>`

```env
AUTH_OIDC_ISSUER=https://keycloak.example.com/realms/myrealm
AUTH_OIDC_CLIENT_ID=crumbs
AUTH_OIDC_CLIENT_SECRET=<client-secret>
AUTH_OIDC_DISPLAY_NAME=Keycloak
```

#### Okta / Auth0

Use the issuer URL from your Okta org or Auth0 tenant:

```env
# Okta
AUTH_OIDC_ISSUER=https://your-org.okta.com

# Auth0
AUTH_OIDC_ISSUER=https://your-tenant.auth0.com
```

### Docker example with multiple providers

```yaml
services:
  crumbs:
    image: ghcr.io/bretzel-app/crumbs:latest
    ports:
      - "3000:3000"
    volumes:
      - crumbs-data:/data
    environment:
      - ORIGIN=https://notes.example.com
      # Google
      - AUTH_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
      - AUTH_GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
      # GitHub
      - AUTH_GITHUB_CLIENT_ID=Iv1.abc123
      - AUTH_GITHUB_CLIENT_SECRET=abc123secret
      # Authentik (OIDC)
      - AUTH_OIDC_ISSUER=https://authentik.example.com/application/o/crumbs/
      - AUTH_OIDC_CLIENT_ID=crumbs-client-id
      - AUTH_OIDC_CLIENT_SECRET=crumbs-client-secret
      - AUTH_OIDC_DISPLAY_NAME=Authentik
    restart: unless-stopped

volumes:
  crumbs-data:
```

All configured providers will appear as buttons on the login page.

## Security notes

- All OAuth flows use **PKCE** (Proof Key for Code Exchange) with S256 challenge method
- OAuth state and code verifier are stored as httpOnly cookies (10-minute expiry)
- Passwords are hashed with **Argon2** (never stored in plain text)
- Sessions expire after **30 days**
- The `ORIGIN` environment variable must match your actual domain for CSRF protection
- Always use **HTTPS** in production (via reverse proxy)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| OAuth button doesn't appear | Provider env vars not set or missing a required variable | Check all required env vars are set and restart |
| "No account found" after OAuth | User doesn't exist in Crumbs | Create the user via Settings with matching email |
| OIDC discovery fails | Issuer URL is wrong or unreachable | Verify `AUTH_OIDC_ISSUER` serves `/.well-known/openid-configuration` |
| Redirect URI mismatch | Callback URL in provider doesn't match `ORIGIN` | Ensure `ORIGIN` matches your domain and the callback URL uses the same origin |
| PKCE error | Provider doesn't support S256 PKCE | Most modern providers support it; check provider docs |
