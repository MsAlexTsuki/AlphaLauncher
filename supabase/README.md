# AlphaClient release management

The `alphaclient-releases` Supabase Edge Function manages AlphaClient release publishing.

## Required Supabase secret

Add a fine-grained GitHub personal access token as the Edge Function secret:

- Name: `GITHUB_RELEASE_TOKEN`
- Repository access: `MsAlexTsuki/AlphaClient` only
- Repository permissions: `Contents: Read and write`
- Metadata: `Read-only`

Add it in Supabase Dashboard → Edge Functions → Secrets. Do not put this token in AlphaLauncher, the repository, or the AlphaClient mod.

The secret is read at runtime; the function does not need to be redeployed after it is added.

## Release behavior

- Official JARs are uploaded to the existing GitHub Release with tag `Release`.
- Only the selected official `AlphaClient-x.y.z.jar` asset remains in that release, so older Launcher builds that still choose the highest matching version also see the official build.
- A private copy of each build is retained in the private `alphaclient-release-builds` Storage bucket.
- Test JARs stay private and are not included in the public update manifest.
- The public manifest is served by `/functions/v1/alphaclient-releases`.
- Launcher update downloads continue to verify SHA-256 before installation.

The Edge Function checks the signed-in Alpha Account's `launcher / releases.manage` permission on every management request. The public GET manifest is read-only.
