# Newsroom backend spec

The website's newsroom UI is built and running on mock data. This document is what the API needs to provide so it can switch to real data. Everything lives under the existing API host (`https://api.ardena.xyz`, `http://localhost:8001` in dev), at the prefix `/api/v1/newsroom`.

Frontend files, for reference:

| File | Role |
| --- | --- |
| `newsroom.html` | Listing page, `/newsroom` |
| `newsroom-article.html` | Story page, `/newsroom/:slug` |
| `newsroom-write.html` | Editor, `/newsroom/write` and `/newsroom/write?slug=...` |
| `newsroom.js` | Data layer (every API call is in the `api` object), listing and article rendering |
| `newsroom-editor.js` | Editor, Unsplash picker, publish |
| `newsroom-mock.js` | Preview data, used only in mock mode |

**Mock mode** is on for any host that isn't `ardena.co.ke` (localhost, Vercel previews), or when the URL has `?mock=1`. `?mock=0` forces the real API. Production always calls the API.

---

## 1. Publisher rights

The admin panel needs a way to give an account publisher rights.

- Add `can_publish: boolean` (default `false`) to the staff/admin user model, or a `newsroom_publisher` role if roles already exist.
- Admin UI: a toggle on the user detail page, "Newsroom publisher". Only super admins can change it.
- Log who granted or removed the right, and when.
- Signing in doesn't give publishing rights on its own. Every write endpoint checks `can_publish` on the server. The frontend's Write button is only a convenience.

## 2. Auth

The editor has its own sign-in form, because the marketing site has no session today.

### `POST /api/v1/newsroom/auth/login`

```json
{ "email": "editor@ardena.co.ke", "password": "..." }
```

`200`
```json
{
  "token": "<jwt or opaque token>",
  "user": { "id": "u_123", "name": "Jane Doe", "can_publish": true }
}
```

`401` for wrong credentials. Rate limit by IP and by email (for example 5 attempts per 15 minutes).

If the admin panel already has a login endpoint and token format, reuse it and point this route at the same logic. The frontend only needs `{ token, user }` back. The token is stored in `localStorage` under `ardena_newsroom_token` and sent as `Authorization: Bearer <token>`. Keep token lifetimes short (for example 12 hours). The frontend clears the token on any `401`.

### `GET /api/v1/newsroom/me` (auth)

```json
{ "id": "u_123", "name": "Jane Doe", "can_publish": true }
```

The listing and article pages call this on load when a token is present. If `can_publish` is true they show "Write a story" and "Edit story".

## 3. Data model

```
newsroom_article
  id                 uuid / string, primary key
  slug               string, unique, lowercase a-z 0-9 and hyphens, max 80
  status             enum: draft | published | archived
  category           enum: Company | Product | Hosts | Safety | Travel | Community
  title              string, max 140
  excerpt            string, max 240
  body_html          text (sanitised, see section 6)
  cover_image        json (UnsplashImage, see below)
  author_id          fk -> user
  author_display     string, optional override ("Ardena Newsroom"); falls back to the author's name
  featured           boolean, default false (admin can pin one story to the top)
  reading_minutes    int, computed on save: max(2, round(words / 200))
  published_at       timestamp, set on first publish, never moved automatically
  created_at, updated_at
  updated_by         fk -> user
```

`UnsplashImage` (for the cover, and the shape the picker returns):

```json
{
  "id": "Dwu85P9SOIk",
  "url": "https://images.unsplash.com/photo-...?ixid=...&w=1600&q=80",
  "thumb": "https://images.unsplash.com/photo-...?ixid=...&w=480&q=70",
  "alt": "Car on a winding road at golden hour",
  "color": "#262626",
  "photographer_name": "Jane Photographer",
  "photographer_url": "https://unsplash.com/@janephoto",
  "unsplash_url": "https://unsplash.com/photos/Dwu85P9SOIk",
  "download_location": "https://api.unsplash.com/photos/Dwu85P9SOIk/download?ixid=..."
}
```

Keep the category list in one place (a constant or a table). If it changes, update `CATEGORIES` in `newsroom.js` and the tabs in `newsroom.html`.

## 4. Public endpoints (no auth)

### `GET /api/v1/newsroom/articles`

Query: `offset` (default 0), `limit` (default 9, max 30), `category` (optional), `exclude` (optional slug, used for "More from the newsroom").

Returns published stories only, newest `published_at` first. Put `featured = true` first when no category is set.

```json
{
  "items": [ArticleSummary],
  "offset": 0,
  "limit": 10,
  "total": 42,
  "has_more": true
}
```

`ArticleSummary`:
```json
{
  "id": "a_1",
  "slug": "ardena-is-live-in-nakuru",
  "category": "Company",
  "title": "Ardena is live in Nakuru, and this is only the start",
  "excerpt": "Verified cars from local owners...",
  "cover_image": { "url": "...", "thumb": "...", "alt": "...", "photographer_name": "...", "photographer_url": "...", "unsplash_url": "..." },
  "author": "Ardena Newsroom",
  "published_at": "2026-09-18T09:00:00Z",
  "reading_minutes": 3,
  "featured": true
}
```

Note: the first page on the "All" tab asks for `limit = 10` (one feature slot plus a grid of 9). Later pages use `limit = 9` with the running `offset`.

### `GET /api/v1/newsroom/articles/:slug`

Returns `ArticleSummary` plus `body` (sanitised HTML) and `updated_at`. Returns `404` for unknown, draft or archived slugs. Publishers may fetch their own drafts when they send a token, because the editor loads stories this way when editing.

If a slug has changed, keep the old one in a `newsroom_slug_history` table and return `301` with a `Location` header, or return the article with `canonical_slug` set, so shared links keep working.

Cache headers: `Cache-Control: public, max-age=60, stale-while-revalidate=600`.

## 5. Publisher endpoints (auth + `can_publish`)

Return `401` without a valid token and `403` without `can_publish`.

### `POST /api/v1/newsroom/articles`

Body sent by the editor:
```json
{
  "status": "published",
  "category": "Travel",
  "title": "Five weekend drives from Nakuru worth the fuel",
  "excerpt": "Crater rims, flamingo lakes and hot springs...",
  "cover_image": UnsplashImage,
  "body": "<p>...</p><h2>...</h2>...",
  "unsplash_downloads": ["https://api.unsplash.com/photos/.../download?ixid=..."]
}
```

The server:
1. Validates: title required; for `published` also category, cover image and at least about 30 words of body.
2. Sanitises `body` (section 6) and rejects any `<img>` whose `src` isn't on `images.unsplash.com`.
3. Generates `slug` from the title. On a clash, add `-2`, `-3` and so on.
4. Sets `published_at` the first time status becomes `published`.
5. Triggers the Unsplash download events for each URL in `unsplash_downloads` (section 7) in a background job.
6. Returns the full article, including `id` and `slug`. After publishing, the editor redirects to `/newsroom/<slug>`.

### `PATCH /api/v1/newsroom/articles/:id`

Same body, all fields optional. Returns the updated article. Changing the title does **not** change the slug unless `"regenerate_slug": true` is sent (not used by the UI yet).

### `DELETE /api/v1/newsroom/articles/:id`

Soft delete: set `status = archived`. Not in the UI yet. Add it to the admin panel first.

### Nice to have in the admin panel

A table of all stories (drafts included) with status, author and dates, plus "Feature", "Unpublish" and "Archive" actions. The website editor covers writing. Housekeeping belongs in admin.

## 6. HTML sanitising

The editor produces a small, known set of tags. Sanitise on the server with an allowlist (for example `bleach` / `nh3` in Python or `sanitize-html` in Node). Never trust the client.

| Tag | Allowed attributes |
| --- | --- |
| `p h2 h3 strong b em i u br hr blockquote ul ol li figure figcaption` | none |
| `a` | `href` (only `http:`, `https:`, `mailto:` or a relative `/path`) |
| `img` | `src` (only `https://images.unsplash.com/...`), `alt` |

Remove everything else, including `style`, `class`, `on*` attributes, `script`, `iframe` and `svg`. Force `rel="noopener noreferrer"` and `target="_blank"` on external links. The frontend also sanitises before rendering with the same list (`sanitize()` in `newsroom.js`), as a second line of defence.

## 7. Unsplash

Images come from Unsplash through a server-side proxy, so the access key never reaches the browser.

**Setup:** register an app at https://unsplash.com/developers and put the Access Key in `UNSPLASH_ACCESS_KEY`. Demo apps get 50 requests an hour, which is enough for building. Apply for production access (5,000 an hour) before launch. The approval needs screenshots showing attribution, which the UI already adds.

### `GET /api/v1/newsroom/unsplash/search?query=car&page=1` (auth + `can_publish`)

Proxies `GET https://api.unsplash.com/search/photos?query=...&page=...&per_page=24&orientation=landscape&content_filter=high` with `Authorization: Client-ID <key>`, and maps each result to the `UnsplashImage` shape:

| Ours | Unsplash field |
| --- | --- |
| `id` | `id` |
| `url` | `urls.raw` + `&w=1600&q=80&auto=format&fit=crop` |
| `thumb` | `urls.small` |
| `alt` | `alt_description` or `description` |
| `color` | `color` |
| `photographer_name` | `user.name` |
| `photographer_url` | `user.links.html` |
| `unsplash_url` | `links.html` |
| `download_location` | `links.download_location` |

Response: `{ "results": [UnsplashImage], "total_pages": 12 }`.

Cache each query and page for about 1 hour (Redis or in-memory) to stay under the rate limit.

### Unsplash API rules we must follow

1. **Hotlink.** Use the `images.unsplash.com` URLs directly. Don't download and re-host the images.
2. **Attribution.** Credit the photographer and Unsplash with links. The UI already renders "Photo by *Name* on *Unsplash*" with `utm_source=ardena&utm_medium=referral` under the cover and in inline figure captions.
3. **Trigger downloads.** When a photo is actually used (on save), send `GET <download_location>` with `Authorization: Client-ID <key>`. The editor sends these URLs in `unsplash_downloads`. Only trigger each one once per article.

## 8. SEO and sharing

`newsroom-article.html` is one static file, so link previews on WhatsApp, X and LinkedIn will show the generic newsroom title, and crawlers that don't run JavaScript won't see the story. Options, best first:

1. **Server-rendered meta.** Add `GET /api/v1/newsroom/articles/:slug/og` returning `{ title, description, image, url }`, plus a Vercel Edge Middleware or function on the website that injects those `<meta property="og:*">` tags into `newsroom-article.html` for `/newsroom/:slug` requests. This is small and has the most impact.
2. Add stories to `sitemap.xml` from `GET /api/v1/newsroom/sitemap` (slug and `updated_at`), generated at build time or served dynamically.
3. Add `NewsArticle` JSON-LD with the same data as the OG tags.

## 9. CORS

Allow `https://ardena.co.ke`, `https://www.ardena.co.ke`, the Vercel preview domain pattern and `http://localhost:5501` / `http://127.0.0.1:5501` (Live Server). Allow the `Authorization` and `Content-Type` headers and the `GET, POST, PATCH, DELETE` methods.

## 10. Going live checklist

- [ ] Endpoints above deployed, and `can_publish` granted to at least one account
- [ ] `UNSPLASH_ACCESS_KEY` set, and production access approved by Unsplash
- [ ] Publish one real story, and check the listing, story page, related stories and editing
- [ ] Add "Newsroom" to the site nav (Resources > Company) and footer, and add `/newsroom` to `sitemap.xml` (left out on purpose until the API is live, so production never shows an empty newsroom)
- [ ] Add `/newsroom` to the 404 page's suggested links
- [ ] Optional: OG meta injection (section 8)

## Error format

Errors are JSON with a `detail` (or `message`) string. The editor shows it for `4xx` validation errors and a generic message otherwise.

```json
{ "detail": "A cover image is required to publish." }
```
