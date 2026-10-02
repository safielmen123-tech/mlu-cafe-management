# Deployment notes

Keep MySQL on the machine that runs the API. Do not open port 3306 to the internet. The public site should expose only 80 and 443 through a reverse proxy. The API talks to MySQL on `127.0.0.1`.

## Dedicated database user

Do not run the app as MySQL `root`. Create a user that can use only `mlu_kitchen_cafe_db`.

The server creates and alters tables when it starts (login security, reservations, session revocation, and similar). Until that startup work is moved to a separate migration step, the app user needs those rights:

```sql
CREATE USER 'mlu_app'@'127.0.0.1' IDENTIFIED BY 'choose_a_long_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON mlu_kitchen_cafe_db.* TO 'mlu_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Put that user in `backend/.env`:

```
DB_HOST=127.0.0.1
DB_USER=mlu_app
DB_PASSWORD=choose_a_long_password
DB_NAME=mlu_kitchen_cafe_db
```

If MySQL is bound to `127.0.0.1` only (`bind-address = 127.0.0.1`), a host firewall should still drop inbound 3306. Do not add a cloud security-group rule for 3306.

## HTTPS

Set `NODE_ENV=production` on the API. It then redirects plain HTTP to HTTPS with status 308, which keeps the original method and body. `req.secure` follows Express `trust proxy`: the `X-Forwarded-Proto` header is trusted only when `TRUST_PROXY=true`. Turn that on when nginx or Cloudflare terminates TLS in front of Node. Leave it off when Node itself is the TLS endpoint. In production the API also sends `Strict-Transport-Security` (one year, including subdomains).

Behind nginx, set:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

## React app headers

The static site is separate from the API. Put these headers on the server that serves the built React app. Replace `https://api.example.com` with the real API origin. The app loads Noto Sans from Google Fonts, and some components set inline styles.

```nginx
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://api.example.com" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## Notifications (stock, expenses, reservations)

The bell polls `/api/alerts` while someone is signed in. It refreshes when the tab is focused, when the browser comes back online, and about every 20 seconds while the tab is visible. Stock changes clear the server alert cache immediately so online admins see low/out-of-stock notices quickly. Expense till notices are stored for **Admin** accounts only.

For the frontend to reach the API from your public domain, set:

```
FRONTEND_URL=https://your-cafe-site.example
CORS_ALLOWED_ORIGINS=https://your-cafe-site.example
TRUST_PROXY=true
```

And build the React app with `VITE_API_URL=https://api.your-cafe-site.example/api` (same origin path the CSP `connect-src` allows).
