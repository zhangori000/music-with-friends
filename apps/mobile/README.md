# Music with Friends for iPhone

Expo SDK 57 client for the shared `/api/v1` backend.

```bash
cp .env.example .env.local
npm install
npm run ios
```

`EXPO_PUBLIC_API_BASE_URL` must point at the running web/API deployment. The
iOS Simulator can use `http://localhost:3000`; a physical phone needs a LAN or
public HTTPS URL.
