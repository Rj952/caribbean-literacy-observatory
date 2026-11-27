# Setting up the no-code editor (/admin)

The editor saves changes to the GitHub repository, so editors sign in with GitHub.

1. In `admin/config.yml`, replace `OWNER/caribbean-literacy-observatory` and `site_url` with the real repository and site address.
2. Choose a sign-in route:
   - **Netlify (simplest):** host the site on Netlify, enable Identity and Git Gateway, and change `backend.name` to `git-gateway`.
   - **GitHub Pages:** create a GitHub OAuth App and run a small OAuth proxy (Decap's documentation lists maintained options), then add `base_url` under `backend`.
3. Give each editor write access to the repository.

## Daily use
- **Content → Research repository → New record.** Fill the fields; save as *Draft*.
- Move it to **In review**, then **Ready**. Publishing merges the pull request.
- Set **Review → Status** to `approved` and add your name in **Approved by**; only approved records appear publicly.
