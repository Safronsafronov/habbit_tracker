# Habits

Personal habit tracker. Static web app — no backend, data lives in `localStorage`
on the device. Works offline and installs to the iOS home screen.

## Run locally

ES modules need HTTP (not `file://`):

    python3 -m http.server 8000

Open <http://localhost:8000/>.

## Test

    node --test

## Publish on GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Build and deployment → Source: **Deploy from a branch**,
   Branch: **main**, folder: **/ (root)**. Save.
3. Wait for the Pages build, then open `https://<user>.github.io/<repo>/`.

All paths are relative, so the subdirectory URL works as-is.

## Deploying an update

The service worker caches all assets. After changing any file, bump the
`CACHE` constant in `sw.js` (e.g. `habits-cache-v2`) and redeploy — the old
cache is purged on the next launch. The page shell itself is fetched
network-first, so HTML/routing changes show up on the next online launch even
without a bump; JS/CSS/icon changes need the bump.

## Add to the iPhone home screen

1. Open the Pages URL in Safari.
2. Share → **Add to Home Screen** → Add.
3. Launch it from the icon — it opens full-screen and works without a connection.

## Regenerate icons

    node tools/make-icons.mjs
