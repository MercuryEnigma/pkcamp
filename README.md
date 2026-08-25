# pkcamp

Source for [mercuryenigma.github.io/pkcamp](https://mercuryenigma.github.io/pkcamp) —
a static site about Pokémon game internals.

## Structure

- `index.html` — the whole site, for now. Plain HTML with inline CSS, no build step.
- `.nojekyll` — tells GitHub Pages to serve files as-is instead of running Jekyll.

## Local preview

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Deploying

This is a GitHub Pages *project* site, so it publishes under a `/pkcamp/` path prefix.
Enable it once under **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**,
then every push to `main` redeploys.

Because of the path prefix, internal links must be relative (`notes/foo.html`) or
prefixed (`/pkcamp/notes/foo.html`) — a root-absolute `/notes/foo.html` will 404.
