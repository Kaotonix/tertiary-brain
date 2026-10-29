# Tertiary Brain

Kao's running thoughts, drawn on a brain. Life, Work, House, and Professorship each have a lobe. Click a lobe or a thought to read it.

This is a living list, not a notes archive. Edit one JSON file when something changes.

## Open it locally

Fetching `data/thoughts.json` and hashing the password both need a normal web origin. Opening `index.html` as a file will not unlock.

From this folder:

```bash
python3 -m http.server 47321
```

Then visit [http://127.0.0.1:47321](http://127.0.0.1:47321).

The gate says **Tertiary Brain** / **Enter to think**. A correct password unlocks the brain for this browser tab only (`sessionStorage`). Closing the tab locks it again. The **Lock** button does the same without closing the tab.

## What the gate is (and is not)

The password is not stored in this repo. `js/config.js` holds only a SHA-256 hex digest. The page hashes what you type and compares digests in the browser.

That stops someone who happens to open the site from reading the dashboard. It is not cryptographic security:

- This is a static site. `data/thoughts.json` is a public file on the same host. Anyone who can load the site can request that file directly.
- A short password can be guessed offline from the hash.
- `sessionStorage` only remembers that this tab already unlocked. It does not encrypt anything.

Do not put secrets you cannot afford to leak into `thoughts.json`.

## Change the password

1. Generate a new digest locally. This prompt does not put the password in your shell history:

   ```bash
   python3 -c "import hashlib; print(hashlib.sha256(input('New password: ').encode()).hexdigest())"
   ```

2. Replace `passwordHash` in `js/config.js` with that lowercase hex string.
3. Do not write the password into `config.js`, the README, or a commit message.
4. The digest is SHA-256 of the UTF-8 password with no extra newline.

## Add or edit a thought

Edit `data/thoughts.json` only. Refresh the page.

```json
{
  "id": "short-slug",
  "title": "What it is",
  "notes": "The useful detail.",
  "status": "active",
  "priority": "medium",
  "due": "2026-11-02",
  "tags": ["optional"]
}
```

Put the object inside the `thoughts` array of the right category. Separate objects with commas. `id` should be unique.

| Field | Values |
| --- | --- |
| `status` | `active`, `waiting`, or `done` |
| `priority` | `high`, `medium`, or `low` |
| `due` | Optional. `YYYY-MM-DD` (shown in Pacific time, including Today / Tomorrow) or a short phrase like `Next week` |
| `tags` | Optional list of short labels |

`active` + `high` thoughts pulse on the brain. The page sorts active and high-priority items first. File order is just for editing. You do not set coordinates. New thoughts land in the matching lobe automatically.

The lobes are `life`, `work`, `house`, and `professorship`. A different category id still shows up in the list, but it will not have its own region on the drawing.

### How Chiefy updates this

Append or edit the thought in `data/thoughts.json`, then commit and push `main`. If GitHub Pages is publishing that branch, the live site picks up the file on the next publish. No build step.

## Publish on GitHub Pages

There is no public URL until a GitHub repository exists and Pages is turned on. Do not guess one.

### Simplest path: deploy from `main`

1. Create an empty GitHub repository and push this project to `main`.
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Set **Branch** to `main` and the folder to **`/ (root)`**. Save.
5. Wait for the Pages check to finish. The site will be at `https://<github-username>.github.io/<repository-name>/`.

`.nojekyll` is included so GitHub Pages serves the files as-is. Links are relative, so the site works as a project site (`/repo/`) or a user site (`username.github.io`).

The page sends `noindex`. That asks search engines not to list it. It does not hide the files.

### Other path: GitHub Actions

Use this instead of branch deploy, not as well as it.

1. **Settings → Pages → Source**: **GitHub Actions**.
2. Open **Actions → Deploy GitHub Pages → Run workflow**.
3. The workflow file is `.github/workflows/pages.yml`. It only runs when you start it. It copies the site files and deploys them.

If you later want every push to `main` to publish, change the workflow `on:` block to include `push` for `main`. Leave branch deploy off.

## Layout

```
index.html          page, brain drawing, gate
css/styles.css      layout and theme
js/config.js        password hash only
js/app.js           unlock, drawing, panel
data/thoughts.json  every thought
assets/             favicon and self-hosted fonts
```

Fraunces and Outfit are under the SIL Open Font License. See `assets/fonts/OFL-Fraunces.txt` and `assets/fonts/OFL-Outfit.txt`. No analytics, no third-party scripts.
