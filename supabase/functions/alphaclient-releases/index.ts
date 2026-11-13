import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const BUCKET = "alphaclient-release-builds";
const RELEASE_API = "https://api.github.com/repos/MsAlexTsuki/AlphaClient/releases/tags/Release";
const GITHUB_API = "https://api.github.com";
const VERSION_RE = /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/;

function env(name: string): string {
  return Deno.env.get(name) ?? "";
}
function githubHeaders(token?: string) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "AlphaLauncher-ReleaseManager",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
async function githubRelease(token?: string) {
  const response = await fetch(RELEASE_API, { headers: githubHeaders(token) });
  if (!response.ok) throw new Error(`Could not read the AlphaClient GitHub Release (HTTP ${response.status}).`);
  return await response.json() as Record<string, any>;
}
function versionParts(value: string): number[] {
  return value.split(".").map((part) => Number.parseInt(part, 10));
}
function compareVersions(a: string, b: string): number {
  const aa = versionParts(a), bb = versionParts(b);
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    const diff = (aa[i] ?? 0) - (bb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}
function assetVersion(name: string): string | null {
  const match = name.match(/^AlphaClient-(\d+(?:\.\d+){1,3})\.jar$/i);
  return match?.[1] ?? null;
}
function validDigest(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digest = value.replace(/^sha256:/i, "").toLowerCase();
  return /^[a-f0-9]{64}$/.test(digest) ? digest : null;
}
async function sha256(file: Blob): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function inspectJar(file: File) {
  if (!file.name.toLowerCase().endsWith(".jar")) throw new Error("Select an AlphaClient .jar file.");
  if (file.size <= 0 || file.size > 64 * 1024 * 1024) throw new Error("The JAR must be between 1 byte and 64 MB.");
  const zip = await JSZip.loadAsync(file);
  const modInfoEntry = Object.values(zip.files).find((entry) => entry.name.toLowerCase() === "mcmod.info" && !entry.dir);
  if (!modInfoEntry) throw new Error("This JAR does not contain mcmod.info.");
  const modInfoText = await modInfoEntry.async("text");
  let modInfo: any;
  try { modInfo = JSON.parse(modInfoText); } catch { throw new Error("mcmod.info contains invalid JSON."); }
  const mods = Array.isArray(modInfo) ? modInfo : [modInfo];
  const alphaMod = mods.find((item) => item && typeof item === "object" && String(item.modid ?? "").toLowerCase() === "alphastaffmod");
  if (!alphaMod) throw new Error("This JAR is not the AlphaClient mod (modid alphastaffmod was not found).");
  let version = typeof alphaMod.version === "string" ? alphaMod.version.trim() : "";
  const marker = zip.file("alpha-client-version.json");
  if (marker) {
    try {
      const data = JSON.parse(await marker.async("text"));
      if (typeof data.version === "string" && data.version.trim()) version = data.version.trim();
    } catch { throw new Error("alpha-client-version.json contains invalid JSON."); }
  }
  if (!VERSION_RE.test(version)) throw new Error("The JAR does not contain a valid numeric AlphaClient version.");
  return { version, file_name: file.name, file_size: file.size, sha256: await sha256(file), mod_id: "alphastaffmod" };
}
async function getClients() {
  const url = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) throw new Error("Supabase release backend is not configured.");
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  return { admin, url, anon };
}
async function requireReleasePermission(req: Request, url: string, anon: string) {
  const auth = req.headers.get("Authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("A signed-in Alpha Account is required."), { status: 401 });
  const userClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(match[1]);
  if (userError || !userData.user) throw Object.assign(new Error("The Alpha Account session is invalid or expired."), { status: 401 });
  const { data: allowed, error } = await userClient.rpc("has_rank_permission", {
    p_scope: "launcher",
    p_permission_key: "releases.manage",
  });
  if (error) throw new Error("Could not verify the releases.manage permission.");
  if (allowed !== true) throw Object.assign(new Error("This account does not have releases.manage permission."), { status: 403 });
  return userData.user;
}
async function ensureBucket(admin: any) {
  const { error } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: "64MB",
    allowedMimeTypes: ["application/java-archive", "application/octet-stream"],
  });
  if (error && !/already exists|duplicate/i.test(error.message ?? "")) throw new Error("Could not prepare private release storage.");
}
async function audit(admin: any, user: any, action: string, version: string, details: Record<string, unknown> = {}) {
  const { data: profile } = await admin.from("profiles").select("username").eq("id", user.id).maybeSingle();
  const { error } = await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_label: profile?.username ?? user.email ?? user.id,
    product: "launcher",
    category: "releases",
    action,
    target_label: version,
    outcome: "success",
    details,
  });
  if (error) console.error("Release audit entry could not be written:", error.message);
}
async function uploadGithubAsset(file: Blob, name: string, token: string, releaseId: number) {
  const url = `https://uploads.github.com/repos/MsAlexTsuki/AlphaClient/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/java-archive" },
    body: file,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub rejected the release upload (HTTP ${response.status}): ${message.slice(0, 500)}`);
  }
  return await response.json() as Record<string, any>;
}
async function removeOldOfficialAssets(release: Record<string, any>, keepAssetId: number, token: string) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  for (const asset of assets) {
    if (asset.id !== keepAssetId && assetVersion(String(asset.name ?? ""))) {
      const response = await fetch(`${GITHUB_API}/repos/MsAlexTsuki/AlphaClient/releases/assets/${asset.id}`, {
        method: "DELETE", headers: githubHeaders(token),
      });
      if (!response.ok && response.status !== 404) {
        console.error("Could not remove previous official release asset:", asset.name, response.status);
      }
    }
  }
}
async function currentOfficial(admin: any, token?: string) {
  const { data: settings } = await admin.from("alphaclient_release_settings")
    .select("official_version").eq("singleton", true).maybeSingle();
  if (settings?.official_version) {
    const { data } = await admin.from("alphaclient_releases").select("*").eq("version", settings.official_version).maybeSingle();
    if (data) return data;
  }
  const release = await githubRelease(token);
  const assets = (Array.isArray(release.assets) ? release.assets : [])
    .map((asset: any) => ({ asset, version: assetVersion(String(asset.name ?? "")) }))
    .filter((entry: any) => entry.version && validDigest(entry.asset.digest) && entry.asset.browser_download_url)
    .sort((a: any, b: any) => compareVersions(b.version, a.version));
  if (!assets.length) throw new Error("The GitHub Release has no AlphaClient JAR with a valid SHA-256 digest.");
  const { asset, version } = assets[0];
  const row = {
    version, channel: "official", asset_name: asset.name, github_asset_id: asset.id,
    download_url: asset.browser_download_url, storage_path: null,
    sha256: validDigest(asset.digest), file_size: asset.size, release_notes: release.body ?? "",
  };
  const { error } = await admin.from("alphaclient_releases").upsert(row, { onConflict: "version" });
  if (error) throw new Error("Could not synchronize the existing GitHub release with Supabase.");
  const { error: settingError } = await admin.from("alphaclient_release_settings")
    .update({ official_version: version, updated_at: new Date().toISOString() }).eq("singleton", true);
  if (settingError) throw new Error("Could not initialize the official version setting.");
  return row;
}
async function releaseStatus(admin: any, token?: string) {
  const official = await currentOfficial(admin, token);
  const { data: versions, error } = await admin.from("alphaclient_releases")
    .select("version, channel, asset_name, sha256, file_size, release_notes, created_at, storage_path")
    .in("channel", ["official", "test"]).order("created_at", { ascending: false });
  if (error) throw new Error("Could not load release versions from Supabase.");
  return {
    official_version: official.version,
    github_release_url: "https://github.com/MsAlexTsuki/AlphaClient/releases/tag/Release",
    github_configured: Boolean(token),
    versions: (versions ?? []).map((row: any) => ({
      version: row.version, channel: row.channel, asset_name: row.asset_name,
      sha256: row.sha256, file_size: row.file_size, release_notes: row.release_notes,
      created_at: row.created_at, downloadable: Boolean(row.storage_path),
    })),
  };
}
async function publishOfficial(admin: any, user: any, file: File, metadata: any, notes: string, token: string) {
  const release = await githubRelease(token);
  await ensureBucket(admin);
  const storagePath = `${metadata.version}/AlphaClient-${metadata.version}.jar`;
  const { error: storageError } = await admin.storage.from(BUCKET).upload(storagePath, file, {
    contentType: "application/java-archive", upsert: false,
  });
  if (storageError) throw new Error("Could not store a private backup of this release.");
  let uploaded: Record<string, any>;
  try {
    uploaded = await uploadGithubAsset(file, `AlphaClient-${metadata.version}.jar`, token, release.id);
  } catch (error) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
  const downloadUrl = uploaded.browser_download_url;
  const { error: insertError } = await admin.from("alphaclient_releases").upsert({
    version: metadata.version, channel: "official", asset_name: uploaded.name,
    github_asset_id: uploaded.id, download_url: downloadUrl, storage_path: storagePath,
    sha256: metadata.sha256, file_size: metadata.file_size, release_notes: notes,
    published_by: user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "version" });
  if (insertError) {
    await fetch(`${GITHUB_API}/repos/MsAlexTsuki/AlphaClient/releases/assets/${uploaded.id}`, { method: "DELETE", headers: githubHeaders(token) });
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new Error("The JAR was uploaded, but Supabase could not save its release record. The GitHub upload was rolled back.");
  }
  await removeOldOfficialAssets(release, uploaded.id, token);
  await admin.from("alphaclient_releases").update({ channel: "archived", updated_at: new Date().toISOString() })
    .eq("channel", "official").neq("version", metadata.version);
  const { error: settingError } = await admin.from("alphaclient_release_settings")
    .update({ official_version: metadata.version, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("singleton", true);
  if (settingError) throw new Error("The JAR was published, but the official-version setting could not be updated.");
  await audit(admin, user, "release.publish_official", metadata.version, { sha256: metadata.sha256, file_size: metadata.file_size });
  return { ok: true, version: metadata.version, channel: "official", download_url: downloadUrl, sha256: metadata.sha256 };
}
async function publishTest(admin: any, user: any, file: File, metadata: any, notes: string) {
  await ensureBucket(admin);
  const storagePath = `${metadata.version}/AlphaClient-Test-${metadata.version}.jar`;
  const { error: storageError } = await admin.storage.from(BUCKET).upload(storagePath, file, {
    contentType: "application/java-archive", upsert: false,
  });
  if (storageError) throw new Error("A test build with this version may already exist, or private storage rejected the upload.");
  const { error } = await admin.from("alphaclient_releases").insert({
    version: metadata.version, channel: "test", asset_name: `AlphaClient-Test-${metadata.version}.jar`,
    storage_path: storagePath, sha256: metadata.sha256, file_size: metadata.file_size,
    release_notes: notes, published_by: user.id,
  });
  if (error) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new Error("Could not save the test-version record. The private upload was rolled back.");
  }
  await audit(admin, user, "release.publish_test", metadata.version, { sha256: metadata.sha256, file_size: metadata.file_size });
  return { ok: true, version: metadata.version, channel: "test", sha256: metadata.sha256 };
}
async function promoteTest(admin: any, user: any, version: string, token: string) {
  const { data: row, error } = await admin.from("alphaclient_releases").select("*")
    .eq("version", version).eq("channel", "test").maybeSingle();
  if (error || !row?.storage_path) throw new Error("The selected test version is not available for promotion.");
  const { data: file, error: downloadError } = await admin.storage.from(BUCKET).download(row.storage_path);
  if (downloadError || !file) throw new Error("Could not retrieve the stored test JAR.");
  const release = await githubRelease(token);
  const uploaded = await uploadGithubAsset(file, `AlphaClient-${version}.jar`, token, release.id);
  const { error: updateError } = await admin.from("alphaclient_releases").update({
    channel: "official", github_asset_id: uploaded.id, download_url: uploaded.browser_download_url,
    asset_name: uploaded.name, updated_at: new Date().toISOString(),
  }).eq("version", version);
  if (updateError) {
    await fetch(`${GITHUB_API}/repos/MsAlexTsuki/AlphaClient/releases/assets/${uploaded.id}`, { method: "DELETE", headers: githubHeaders(token) });
    throw new Error("The JAR was uploaded, but its Supabase release record could not be updated.");
  }
  await removeOldOfficialAssets(release, uploaded.id, token);
  await admin.from("alphaclient_releases").update({ channel: "archived", updated_at: new Date().toISOString() })
    .eq("channel", "official").neq("version", version);
  const { error: settingError } = await admin.from("alphaclient_release_settings")
    .update({ official_version: version, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("singleton", true);
  if (settingError) throw new Error("The test JAR was promoted, but the official-version setting could not be updated.");
  await audit(admin, user, "release.set_official", version);
  return { ok: true, official_version: version };
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { admin, url, anon } = await getClients();
    const token = env("GITHUB_RELEASE_TOKEN");
    if (req.method === "GET") {
      const official = await currentOfficial(admin);
      if (!official.download_url || !official.sha256) return json({ error: "The official release manifest is incomplete." }, 503);
      return json({
        version: official.version,
        download_url: official.download_url,
        sha256: official.sha256,
        changelog: official.release_notes ?? "",
      });
    }
    if (req.method !== "POST") return json({ error: "GET or POST required." }, 405);
    const user = await requireReleasePermission(req, url, anon);
    const contentType = req.headers.get("content-type") ?? "";
    let action = "";
    let body: Record<string, any> = {};
    let form: FormData | null = null;
    if (contentType.includes("multipart/form-data")) {
      form = await req.formData();
      action = String(form.get("action") ?? "");
    } else {
      body = await req.json().catch(() => ({}));
      action = String(body.action ?? "");
    }
    if (action === "status") return json({ ok: true, ...await releaseStatus(admin, token) });
    if (action === "inspect") {
      const file = form?.get("file");
      if (!(file instanceof File)) return json({ error: "Select a JAR file first." }, 400);
      return json({ ok: true, metadata: await inspectJar(file) });
    }
    if (action === "publish_official" || action === "publish_test") {
      const file = form?.get("file");
      if (!(file instanceof File)) return json({ error: "Select a JAR file first." }, 400);
      const metadata = await inspectJar(file);
      const notes = String(form?.get("release_notes") ?? "").trim().slice(0, 12000);
      const { data: existing } = await admin.from("alphaclient_releases").select("version").eq("version", metadata.version).maybeSingle();
      if (existing) return json({ error: `Version ${metadata.version} already exists in release management. Increment the JAR version before publishing.` }, 409);
      if (action === "publish_test") return json(await publishTest(admin, user, file, metadata, notes));
      if (!token) return json({ error: "GitHub publishing is not configured. Add GITHUB_RELEASE_TOKEN to Supabase Edge Function secrets." }, 503);
      return json(await publishOfficial(admin, user, file, metadata, notes, token));
    }
    if (action === "set_official") {
      if (!token) return json({ error: "GitHub publishing is not configured. Add GITHUB_RELEASE_TOKEN to Supabase Edge Function secrets." }, 503);
      const version = String(body.version ?? "");
      if (!VERSION_RE.test(version)) return json({ error: "Invalid version." }, 400);
      return json(await promoteTest(admin, user, version, token));
    }
    if (action === "download_test") {
      const version = String(body.version ?? "");
      const { data: row } = await admin.from("alphaclient_releases").select("storage_path")
        .eq("version", version).eq("channel", "test").maybeSingle();
      if (!row?.storage_path) return json({ error: "Test version not found." }, 404);
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(row.storage_path, 600);
      if (error || !data?.signedUrl) throw new Error("Could not create a temporary download link.");
      return json({ ok: true, url: data.signedUrl });
    }
    return json({ error: "Unknown release action." }, 400);
  } catch (error) {
    const status = Number((error as any)?.status ?? 400);
    const message = error instanceof Error ? error.message : "Release request failed.";
    console.error("AlphaClient release request failed:", message);
    return json({ error: message }, status >= 400 && status <= 599 ? status : 500);
  }
});