---
description: Build, Test, and Release ClassGame
---

1. Run Tests
// turbo
Execute the following commands to ensure everything is working correctly:
```bash
cd server
npm test
cd ../client
npx playwright test
```

2. Update Version Numbers
Update `version` in:
- `client/package.json`
- `server/package.json`

*Versioning Logic:*
- **Major (x.0.0)**: Big changes / breaking changes.
- **Minor (0.x.0)**: New features.
- **Patch (0.0.x)**: Bug fixes.

3. Documentation
- Update `RELEASE_NOTES.md` with new changes.
- Update `README.md` if necessary.

4. Build Application
// turbo
Run the following to build the client and package the electron app:
```bash
cd client
npm run build
cd ../server
npm run make
```

5. Upload to GitHub
- Commit all changes: `git add . && git commit -m "Release vX.X.X"`
- Tag the release: `git tag vX.X.X`
- Push to GitHub: `git push && git push --tags`
- Upload the built `.zip` (and `.exe` installer) from `server/out/make/...` to the GitHub Release page.
