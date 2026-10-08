## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Bank sync is optional. To enable it, get free sandbox keys from the
[Plaid dashboard](https://dashboard.plaid.com/), copy `.env.example` to
`.env.local`, and fill in:

```
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox
```
