# LanguageBridge frontend

Vanilla HTML/CSS/JavaScript frontend for the provided Express/Prisma API.

## Run

1. Start your backend.
2. Serve this folder with any static server (recommended) rather than opening files directly.
3. The frontend expects the backend at `http://localhost:3000/api/v1`.
4. If your backend uses another URL, open the browser console and run:

```js
localStorage.setItem("lb_api_base", "http://localhost:YOUR_PORT/api/v1")
```

Then reload.

## Included

- Login / registration
- JWT access + refresh-token handling
- Feed
- Create posts with optional pictures
- Likes and comments
- Friends
- Friend requests
- Chats and messages
- Profile editing and profile-picture upload

## Notes

This is intentionally framework-free. Notifications are not included because the notification endpoints are not implemented yet.


## Vercel deployment

This frontend is configured to use the deployed LanguageBridge backend by default:

`https://language-bridge.onrender.com/api/v1`

You can deploy this folder directly as a static Vercel project. No build command is required.

If you ever need to point the frontend at another API during development, open the browser console and run:

```js
localStorage.setItem("lb_api_base", "http://localhost:3000/api/v1")
```

Then refresh the page.

For production, keep the deployed backend URL as the default. The backend currently uses permissive CORS (`cors()`), which allows the separately hosted frontend to make API requests.
