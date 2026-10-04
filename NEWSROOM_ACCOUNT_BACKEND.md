# Newsroom account backend spec

Writers can now manage their own newsroom account from the website. This document is what the API needs to add so the new screens work against real data. It extends `NEWSROOM_BACKEND.md`: same host, same `/api/v1/newsroom` prefix, same token, same error format.

## What changed on the website

| Change | Backend work |
| --- | --- |
| Password fields on sign in, set password and account have a show/hide eye | None, frontend only |
| The editor's top bar shows the writer's photo (or initials) instead of a Sign out button. It opens a menu with **Account** and **Sign out** | `/me` must return `email` and `avatar_url` |
| New page `/newsroom/account` (`newsroom-account.html`): one centred card to change name, password and profile photo | The four endpoints below |

Frontend files, for reference:

| File | Role |
| --- | --- |
| `newsroom.js` | Data layer. New calls: `api.updateProfile`, `api.changePassword`, `api.uploadAvatar`, `api.removeAvatar`. Also the shared profile menu and password eye |
| `newsroom-account.js` | Account page |
| `newsroom-account.html` | Account page markup, served at `/newsroom/account` |
| `newsroom-editor.js` | Uses the profile menu in the top bar |

In mock mode (any host other than `ardena.co.ke`, or `?mock=1`) the account page saves to the browser only, so it can be tried before these endpoints exist.

---

## 1. User model

Add to the staff user, if not already there:

```
avatar_url     string, nullable. Public URL of the current profile photo
avatar_path    string, nullable. Storage key, so the old file can be deleted on change
```

`name` and `email` already exist. Email is **not** editable from the account page; changing it stays an admin action.

## 2. The user object

Every endpoint that returns a user (`POST /auth/login`, `POST /auth/set-password`, `GET /me`, and the new ones below) returns the same shape:

```json
{
  "id": "u_123",
  "name": "Jane Doe",
  "email": "jane@ardena.co.ke",
  "avatar_url": "https://<project>.supabase.co/storage/v1/object/public/b2b-media/newsroom/avatars/u_123/7f3c.jpg",
  "can_publish": true
}
```

`avatar_url` is `null` when there is no photo; the frontend then shows the writer's initials. It must be an `https://` URL, anything else is ignored by the frontend.

## 3. Endpoints

All four need a valid token. They do **not** need `can_publish`: a writer still waiting for approval can already sign in and should be able to set their name and photo.

> **Important:** never answer `401` for a wrong *current* password. The frontend treats any `401` as "session expired", drops the token and sends the writer back to sign in. Use `400` for that case (below).

### `PATCH /api/v1/newsroom/me`

Update the writer's display name.

```json
{ "name": "Jane Wanjiru Doe" }
```

- Trim, collapse inner whitespace, 2 to 120 characters, no control characters or HTML.
- `200` with the full user object.
- `422` with a `detail` the page can show as is, for example `"Name must be at least 2 characters."`
- Ignore any other fields in the body (`email`, `can_publish` and so on must not be settable here).

### `POST /api/v1/newsroom/me/password`

```json
{ "current_password": "...", "new_password": "..." }
```

- Verify `current_password` against the stored hash. Wrong: `400` with `{ "detail": "Current password is incorrect." }`.
- Validate `new_password` with the same rules as `/auth/set-password` (10 to 128 characters). It must differ from the current one. Failing: `422` with a readable `detail`.
- Rate limit per user and per IP (for example 5 attempts per 15 minutes): `429`.
- On success: `204` (or `200` with `{ "detail": "Password updated." }`).
- Revoke the writer's **other** sessions/tokens. The token that made the request stays valid, so the writer is not signed out of the page they are on.
- Send a short "Your newsroom password was changed" email to the account address, with a line to contact the team if it wasn't them.
- Never log either password.

### `POST /api/v1/newsroom/me/avatar`

Multipart form, one field named `file`.

The browser already crops the photo to a centred square and resizes it to at most 512 x 512 JPEG before sending, so normal uploads are small. Do not rely on that; validate on the server:

- Accept JPEG, PNG or WebP only, checked by the file's magic bytes, not the extension or `Content-Type`.
- Max 5 MB: `413` with `{ "detail": "That photo is over 5 MB." }`.
- Not a readable image: `422` with `{ "detail": "Use a JPEG, PNG or WebP image." }`.
- Decode and re-encode server side (for example with Pillow): crop to square if needed, resize to 512 x 512, save as JPEG or WebP, strip EXIF (phone photos carry GPS location).
- Store under `b2b-media/newsroom/avatars/<user_id>/<random>.jpg` with a new random name each time, so caches and CDNs never serve the old photo.
- Delete the previous file (`avatar_path`) after the new one is saved.
- `200` with the full user object.

The frontend error messages for `413` and `422` show the `detail` text directly, so keep it short and plain.

### `DELETE /api/v1/newsroom/me/avatar`

- Delete the stored file, set `avatar_url` and `avatar_path` to `null`.
- `200` with the full user object. Calling it with no photo set is not an error.

## 4. Stories pick up the change

The story page shows the author's photo and name under the headline (`author_avatar`, `author` on the article, see section 3 of `NEWSROOM_BACKEND.md`).

- Resolve `author_avatar` from the user's **current** `avatar_url` when the article is read, not copied into the article on save. A new photo then appears on every past story.
- Same for the name: when `author_display` is empty, use the user's current `name`.
- If articles are cached server side, clear the author's cached articles after a name or photo change.

## 5. CORS

Already covered: `PATCH` and `DELETE` are allowed, and multipart uploads need no extra headers. Make sure the `/me` routes sit behind the same CORS config as the rest of `/api/v1/newsroom`.

## 6. Admin panel

- Show the writer's photo on their user page, with a Remove button for moderation.
- Keep an audit entry for password changes (who, when, IP; never the password).

## 7. Going live checklist

- [ ] `email` and `avatar_url` returned from login, set password and `/me`
- [ ] `PATCH /me`, `POST /me/password`, `POST /me/avatar`, `DELETE /me/avatar` deployed
- [ ] Wrong current password returns `400`, not `401`
- [ ] Changing the password signs the writer out everywhere else, and sends the notice email
- [ ] Uploaded photos are re-encoded with EXIF stripped, and old files deleted
- [ ] A new photo shows on that writer's existing stories
- [ ] Try it on `/newsroom/account?mock=0` with a test writer: change name, change password, sign out and back in with the new password, upload and remove a photo
