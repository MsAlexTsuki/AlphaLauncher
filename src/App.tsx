

import { useEffect, useState } from "react";

import { invoke } from "@tauri-apps/api/core";

import { getCurrentWindow } from "@tauri-apps/api/window";

import { LogicalSize } from "@tauri-apps/api/dpi";

import { openUrl } from "@tauri-apps/plugin-opener";

import "./App.css";

type Page =

  | "Home"

  | "Play"

  | "Versions"

  | "Mods"

  | "Developer"

  | "Settings"

  | "Account";

type MicrosoftAccount = { name: string; email: string };
type LastPlayed = { timestamp: number; version: string };
type ChangelogEntry = { id: number; version: string; title: string; body: string; date: string };
const CHANGELOG_STORAGE_KEY = "alphaclient.changelogs";
const LAST_PLAYED_STORAGE_KEY = "alphaclient.lastPlayed";
const MAX_LAUNCH_HISTORY = 3;

type ModItem = { name: string; description: string; enabled: boolean };

type ModalContent = {

  title: string;

  body: string;

  kind?: "settings";

} | null;

type Settings = {

  closeToTray: boolean;

  showNews: boolean;

  ramGb: number;

  gameDirectory: string;

};

type AlphaClientUpdateInfo = {

  current_version: string;

  latest_version: string;

  update_available: boolean;

  update_configured: boolean;

  changelog: string;

};

const DEFAULT_SETTINGS: Settings = {

  closeToTray: false,

  showNews: true,

  ramGb: 2,

  gameDirectory: "",

};

const INITIAL_MODS: ModItem[] = [

  {

    name: "AlphaCore",

    description: "Core systems for AlphaClient",

    enabled: true,

  },

  {

    name: "PerformanceCore",

    description: "FPS and rendering optimizations",

    enabled: true,

  },

  {

    name: "HUD",

    description: "Customizable AlphaClient HUD",

    enabled: true,

  },

  {

    name: "StaffCore",

    description: "Staff tools and investigation systems",

    enabled: false,

  },

];

function readSettings(): Settings {

  try {

    const saved = localStorage.getItem("alphaclient.settings");

    return saved

      ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }

      : DEFAULT_SETTINGS;

  } catch {

    return DEFAULT_SETTINGS;

  }

}

function readLastPlayed(): LastPlayed[] {
  try {
    const saved = localStorage.getItem(LAST_PLAYED_STORAGE_KEY);
    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (entry): entry is LastPlayed =>
          entry !== null &&
          typeof entry === "object" &&
          typeof entry.timestamp === "number" &&
          Number.isFinite(entry.timestamp) &&
          typeof entry.version === "string",
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_LAUNCH_HISTORY);
  } catch {
    return [];
  }
}

function readChangelogs(): ChangelogEntry[] {
  try {
    const saved = localStorage.getItem(CHANGELOG_STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ChangelogEntry =>
      item !== null && typeof item === "object" &&
      typeof item.id === "number" && typeof item.version === "string" &&
      typeof item.title === "string" && typeof item.body === "string" &&
      typeof item.date === "string"
    ).sort((a, b) => b.id - a.id);
  } catch { return []; }
}

function errorText(error: unknown): string {

  return error instanceof Error ? error.message : String(error);

}

function LauncherApp() {

  const [page, setPage] = useState<Page>("Home");

  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const [isLaunching, setIsLaunching] = useState(false);

  const [isStartingOfflineTest, setIsStartingOfflineTest] = useState(false);

  const [launchError, setLaunchError] = useState<string | null>(null);

  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [launchHistory, setLaunchHistory] = useState<LastPlayed[]>(readLastPlayed);
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>(readChangelogs);

  const [account, setAccount] = useState<MicrosoftAccount | null>(null);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [loginError, setLoginError] = useState<string | null>(null);

  const [isInstalling, setIsInstalling] = useState(false);

  const [installMessage, setInstallMessage] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalContent>(null);

  const [settings, setSettings] = useState<Settings>(readSettings);

  const [mods, setMods] = useState<ModItem[]>(INITIAL_MODS);

  const [versionFilter, setVersionFilter] = useState("All");

  const [selectedVersion, setSelectedVersion] = useState("0.3.79");

  const [clientVersion, setClientVersion] = useState("0.3.79");

  const [updateInfo, setUpdateInfo] =

    useState<AlphaClientUpdateInfo | null>(null);

  const [isUpdatingClient, setIsUpdatingClient] = useState(false);

  const [clientDirectory, setClientDirectory] = useState<string | null>(null);

  const [offlineMode, setOfflineMode] = useState(() => {

    try {

      return localStorage.getItem("alphaclient.dev.offlineMode") === "true";

    } catch {

      return false;

    }

  });

  const [testUsername, setTestUsername] = useState(() => {

    try {

      return localStorage.getItem("alphaclient.dev.username") || "TestPlayer";

    } catch {

      return "TestPlayer";

    }

  });

  useEffect(() => {

    const timers: number[] = [];

    timers.push(

      window.setTimeout(() => {

        document.documentElement.classList.add("alpha-startup-complete");

      }, 2600),

    );

    return () => {

      timers.forEach(window.clearTimeout);

      document.documentElement.classList.remove("alpha-startup-complete");

    };

  }, []);

  useEffect(() => {

    invoke<MicrosoftAccount | null>("get_microsoft_account")

      .then(setAccount)

      .catch((error) =>

        console.warn("Could not restore Microsoft account:", error),

      );

    invoke<string>("get_alphaclient_directory_path")

      .then(setClientDirectory)

      .catch(() => setClientDirectory(null));

    invoke<string>("get_alphaclient_version")

      .then((version) => {

        setClientVersion(version);

        setSelectedVersion(version);

      })

      .catch(() => {});

    invoke<AlphaClientUpdateInfo>("check_alphaclient_update")

      .then(setUpdateInfo)

      .catch((error) =>

        console.warn("Could not check AlphaClient updates:", error),

      );

  }, []);

  useEffect(() => {

    try {

      localStorage.setItem("alphaclient.settings", JSON.stringify(settings));

    } catch (error) {

      console.warn("Could not save launcher settings:", error);

    }

  }, [settings]);

  useEffect(() => {
    try { localStorage.setItem(CHANGELOG_STORAGE_KEY, JSON.stringify(changelogs)); }
    catch (error) { console.warn("Could not save changelogs:", error); }
  }, [changelogs]);

  const recordLaunch = (version: string) => {
    const entry: LastPlayed = { timestamp: Date.now(), version };
    setLaunchHistory((current) => {
      const updated = [entry, ...current]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_LAUNCH_HISTORY);

      try {
        localStorage.setItem(LAST_PLAYED_STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.warn("Could not save launch history:", error);
      }

      return updated;
    });
  };

  const handleStartOfflineTest = async () => {

    if (isStartingOfflineTest) return;

    const username = testUsername.trim();

    if (!offlineMode) {

      setLaunchError("Enable offline test mode first.");

      return;

    }

    if (!username) {

      setLaunchError("Enter a test username.");

      return;

    }

    setIsStartingOfflineTest(true);

    setLaunchError(null);

    setLaunchMessage(null);

    try {

      const message = await invoke<string>("start_offline_test", {

        username,

      });

      setLaunchMessage(message || "Offline test is starting.");
      recordLaunch(`Offline test · ${username}`);

    } catch (error) {

      setLaunchError(errorText(error));

    } finally {

      setIsStartingOfflineTest(false);

    }

  };

  const handlePlay = async () => {

    if (isLaunching || isUpdatingClient) return;

    setIsLaunching(true);

    setLaunchError(null);

    setLaunchMessage(null);

    try {

      try {

        const checked = await invoke<AlphaClientUpdateInfo>(

          "check_alphaclient_update",

        );

        setUpdateInfo(checked);

        if (checked.update_available) {

          setIsUpdatingClient(true);

          const updateMessage =

            await invoke<string>("update_alphaclient");

          setClientVersion(checked.latest_version);

          setSelectedVersion(checked.latest_version);

          setLaunchMessage(updateMessage);

          setIsUpdatingClient(false);

        }

      } catch (updateError) {

        console.warn(

          "AlphaClient update check failed; continuing with installed client:",

          updateError,

        );

        setIsUpdatingClient(false);

      }

      const message = await invoke<string>("launch_alphaclient");

      recordLaunch(updateInfo?.update_available ? updateInfo.latest_version : clientVersion);

      setLaunchMessage(message || "AlphaClient is starting.");

    } catch (error) {

      setIsUpdatingClient(false);

      setLaunchError(errorText(error));

    } finally {

      setIsLaunching(false);

    }

  };

  const handleUpdateClient = async () => {

    if (isUpdatingClient || isLaunching) return;

    setIsUpdatingClient(true);

    setLaunchError(null);

    try {

      const message = await invoke<string>("update_alphaclient");

      const version = await invoke<string>("get_alphaclient_version");

      setClientVersion(version);

      setSelectedVersion(version);

      const checked =

        await invoke<AlphaClientUpdateInfo>("check_alphaclient_update");

      setUpdateInfo(checked);

      setLaunchMessage(message);

    } catch (error) {

      setLaunchError(errorText(error));

    } finally {

      setIsUpdatingClient(false);

    }

  };

  const handleInstall = async () => {

    if (isInstalling) return;

    setIsInstalling(true);

    setInstallMessage(null);

    setLaunchError(null);

    try {

      const message = await invoke<string>("install_alphaclient");

      const result = message || "AlphaClient installation completed.";

      setInstallMessage(result);

      setModal({

        title: "Installation complete",

        body: result,

      });

    } catch (error) {

      const message = errorText(error);

      setInstallMessage(`Installation failed: ${message}`);

      setModal({

        title: "Installation failed",

        body: message,

      });

    } finally {

      setIsInstalling(false);

    }

  };

  const handleMicrosoftLogin = async () => {

    if (isLoggingIn) return;

    setIsLoggingIn(true);

    setLoginError(null);

    try {

      const result = await invoke<MicrosoftAccount>(

        "start_microsoft_login",

      );

      setAccount(result);

    } catch (error) {

      setLoginError(errorText(error));

    } finally {

      setIsLoggingIn(false);

    }

  };

  const handleMicrosoftLogout = async () => {

    try {

      await invoke("logout_microsoft");

      setAccount(null);

      setLoginError(null);

    } catch (error) {

      setLoginError(errorText(error));

    }

  };

  const navigate = (next: Page) => {

    setPage(next);

    setLaunchError(null);

    setLaunchMessage(null);

  };

  const openSettings = (section: string) => {

    setModal({

      title: `${section} settings`,

      kind: "settings",

      body: section,

    });

  };

  const navigation: { name: Page; icon: string }[] = [

    { name: "Home", icon: "⌂" },

    { name: "Play", icon: "▶" },

    { name: "Versions", icon: "▣" },

    { name: "Mods", icon: "◆" },

    { name: "Developer", icon: "⌘" },

    { name: "Settings", icon: "⚙" },

    { name: "Account", icon: "●" },

  ];

  return (

    <div className="launcher">

      <header className="titlebar" data-tauri-drag-region>

        <div className="brand" data-tauri-drag-region>

          <div className="brand-mark" aria-hidden="true">

            <AlphaLogo />

          </div>

          <div className="brand-text">

            <strong>AlphaClient</strong>

            <span>Launcher</span>

          </div>

        </div>

        <div className="window-controls">

          <button

            type="button"

            aria-label="Minimize"

            title="Minimize"

            onClick={() => void getCurrentWindow().minimize()}

          >

            −

          </button>

          <button

            type="button"

            aria-label="Maximize or restore"

            title="Maximize / restore"

            onClick={() => void getCurrentWindow().toggleMaximize()}

          >

            □

          </button>

          <button

            type="button"

            className="close"

            aria-label="Close"

            title="Close"

            onClick={() => void getCurrentWindow().close()}

          >

            ×

          </button>

        </div>

      </header>

      <div className="launcher-body">

        <aside

          className={`sidebar ${

            sidebarExpanded ? "expanded" : "collapsed"

          }`}

        >

          <div className={`sidebar-feature-logo ${sidebarExpanded ? "expanded" : "collapsed"}`} aria-hidden="true">

            {sidebarExpanded && (

              <img src="/alpha-client-startup-logo.png" alt="" draggable={false} />

            )}

          </div>

          <button

            type="button"

            className="sidebar-toggle"

            onClick={() => setSidebarExpanded((value) => !value)}

            aria-label="Toggle sidebar"

            title="Toggle sidebar"

          >

            {sidebarExpanded ? "‹" : "›"}

          </button>

          <nav className="navigation">

            {navigation.map((item) => (

              <span key={item.name}>

                {item.name === "Developer" && (

                  <div className="nav-separator" />

                )}

                <button

                  type="button"

                  title={!sidebarExpanded ? item.name : undefined}

                  className={`nav-item ${

                    page === item.name ? "active" : ""

                  }`}

                  onClick={() => navigate(item.name)}

                >

                  <span className="nav-icon">{item.icon}</span>

                  {sidebarExpanded && <span>{item.name}</span>}

                </button>

              </span>

            ))}

            {sidebarExpanded && (

              <div className="nav-partner">

                <div className="nav-section-label">PARTNER</div>

                <button

                  type="button"

                  className="partner-nav-item"

                  onClick={() => void openUrl("https://alpha.rip")}

                >

                  <span className="nav-icon">◈</span>

                  <span className="partner-nav-content">

                    <strong>Alpha.rip</strong>

                    <small>Partner Server · Open website</small>

                  </span>

                </button>

              </div>

            )}

          </nav>

          {sidebarExpanded && (

            <div className="sidebar-version">

              <span>AlphaClient</span>

              <strong>v{clientVersion}</strong>

            </div>

          )}

        </aside>

        <main className="content">

          {page === "Home" && (

            <HomePage

              account={account}

              clientVersion={clientVersion}

              launchHistory={launchHistory}
              changelogs={changelogs}
              updateInfo={updateInfo}

              showNews={settings.showNews}

              onPlay={handlePlay}

              isLaunching={isLaunching || isUpdatingClient}

              launchError={launchError}

              launchMessage={launchMessage}

              onAccount={() => navigate("Account")}

              onChangelog={() =>

                setModal({

                  title: "AlphaClient changelog",

                  body: changelogs.length
                    ? changelogs.map((entry) => `${entry.version} — ${entry.title}\n${entry.date}\n${entry.body}`).join("\n\n────────────\n\n")
                    : updateInfo?.changelog || `AlphaClient ${clientVersion}\nNo changelog has been published yet. Add one in Developer → Changelogs.`,

                })

              }

              onNews={() =>

                setModal({

                  title: "AlphaClient news",

                  body:

                    updateInfo?.changelog ||

                    `AlphaClient ${clientVersion}\nThe launcher checks for client updates independently from the launcher installation.`,

                })

              }

            />

          )}

          {page === "Play" && (

            <PlayPage

              onPlay={handlePlay}

              isLaunching={isLaunching || isUpdatingClient}

              launchError={launchError}

              launchMessage={launchMessage}

              onInstall={handleInstall}

              isInstalling={isInstalling}

              installMessage={installMessage}

              selectedVersion={selectedVersion}

              clientVersion={clientVersion}

              updateInfo={updateInfo}

              onUpdate={handleUpdateClient}

              isUpdating={isUpdatingClient}

            />

          )}

          {page === "Versions" && (

            <VersionsPage

              filter={versionFilter}

              setFilter={setVersionFilter}

              selectedVersion={selectedVersion}

              setSelectedVersion={setSelectedVersion}

              clientVersion={clientVersion}

              updateInfo={updateInfo}

              onInstall={handleInstall}

              isInstalling={isInstalling}

              onUpdate={handleUpdateClient}

              isUpdating={isUpdatingClient}

            />

          )}

          {page === "Mods" && (

            <ModsPage

              mods={mods}

              onToggle={(name) =>

                setMods((old) =>

                  old.map((mod) =>

                    mod.name === name

                      ? { ...mod, enabled: !mod.enabled }

                      : mod,

                  ),

                )

              }

            />

          )}

          {page === "Developer" && (

            <DeveloperPage

              offlineMode={offlineMode}

              setOfflineMode={(enabled) => {

                setOfflineMode(enabled);

                try {

                  localStorage.setItem(

                    "alphaclient.dev.offlineMode",

                    String(enabled),

                  );

                } catch {}

              }}

              testUsername={testUsername}

              setTestUsername={(username) => {

                setTestUsername(username);

                try {

                  localStorage.setItem(

                    "alphaclient.dev.username",

                    username,

                  );

                } catch {}

              }}

              isStartingOfflineTest={isStartingOfflineTest}

              onStartTest={handleStartOfflineTest}

              changelogs={changelogs}

              setChangelogs={setChangelogs}

            />

          )}

          {page === "Settings" && (

            <SettingsPage

              onOpen={openSettings}

              directory={clientDirectory}

            />

          )}

          {page === "Account" && (

            <AccountPage

              account={account}

              isLoggingIn={isLoggingIn}

              loginError={loginError}

              onLogin={handleMicrosoftLogin}

              onLogout={handleMicrosoftLogout}

            />

          )}

        </main>

      </div>

      {modal && (

        <div

          className="modal-backdrop"

          role="presentation"

          onMouseDown={(event) => {

            if (event.target === event.currentTarget) {

              setModal(null);

            }

          }}

        >

          <section

            className="modal-card"

            role="dialog"

            aria-modal="true"

            aria-labelledby="modal-title"

          >

            <div className="modal-header">

              <h2 id="modal-title">{modal.title}</h2>

              <button

                type="button"

                className="modal-close"

                aria-label="Close dialog"

                onClick={() => setModal(null)}

              >

                ×

              </button>

            </div>

            {modal.kind === "settings" ? (

              <div className="modal-settings">

                {modal.body === "General" && (

                  <>

                    <label className="setting-line">

                      <span>

                        <strong>Show news on Home</strong>

                        <small>Display the launcher news panel.</small>

                      </span>

                      <input

                        type="checkbox"

                        checked={settings.showNews}

                        onChange={(event) =>

                          setSettings({

                            ...settings,

                            showNews: event.target.checked,

                          })

                        }

                      />

                    </label>

                    <label className="setting-line">

                      <span>

                        <strong>Close to tray</strong>

                        <small>

                          Preference saved locally; tray behavior is not

                          implemented yet.

                        </small>

                      </span>

                      <input

                        type="checkbox"

                        checked={settings.closeToTray}

                        onChange={(event) =>

                          setSettings({

                            ...settings,

                            closeToTray: event.target.checked,

                          })

                        }

                      />

                    </label>

                  </>

                )}

                {modal.body === "Minecraft" && (

                  <>

                    <label className="setting-line">

                      <span>

                        <strong>Memory allocation</strong>

                        <small>

                          {settings.ramGb} GB RAM (saved as a preference;

                          not yet passed to Java).

                        </small>

                      </span>

                      <input

                        type="range"

                        min="2"

                        max="8"

                        step="1"

                        value={settings.ramGb}

                        onChange={(event) =>

                          setSettings({

                            ...settings,

                            ramGb: Number(event.target.value),

                          })

                        }

                      />

                    </label>

                    <div className="setting-line directory-setting">

                      <span>

                        <strong>Game directory</strong>

                        <small>

                          {clientDirectory ||

                            "Could not read directory from backend."}

                        </small>

                      </span>

                      <button

                        type="button"

                        className="small-button"

                        onClick={() =>

                          setModal({

                            title: "Game directory",

                            body:

                              clientDirectory ||

                              "The backend did not return a directory.",

                          })

                        }

                      >

                        View

                      </button>

                    </div>

                  </>

                )}

                {modal.body === "Launcher" && (

                  <p>

                    Launcher preferences are saved locally on this device.

                    Automatic updates and notifications are not connected yet.

                  </p>

                )}

                {modal.body === "AlphaClient" && (

                  <p>

                    AlphaClient version: {clientVersion}

                    <br />

                    Minecraft: 1.8.9

                    <br />

                    Forge: 11.15.1.2318

                    <br />

                    {updateInfo?.update_available

                      ? `Update available: ${updateInfo.latest_version}`

                      : "No update is reported by the update check."}

                  </p>

                )}

                <button

                  type="button"

                  className="large-play-button"

                  onClick={() => setModal(null)}

                >

                  DONE

                </button>

              </div>

            ) : (

              <>

                <p className="modal-body-text">{modal.body}</p>

                <button

                  type="button"

                  className="large-play-button"

                  onClick={() => setModal(null)}

                >

                  CLOSE

                </button>

              </>

            )}

          </section>

        </div>

      )}

    </div>

  );

}

function AlphaLogo() {

  return (

    <img

      className="alpha-logo"

      src="/alpha-client-icon.png"

      alt="AlphaClient icon"

      draggable={false}

    />

  );

}

function StartupLogo() {

  return (

    <img

      className="startup-logo-image"

      src="/alpha-client-startup-logo.png"

      alt="AlphaClient"

      draggable={false}

    />

  );

}

function PageTitle({

  eyebrow,

  title,

  description,

}: {

  eyebrow: string;

  title: string;

  description: string;

}) {

  return (

    <div className="page-header">

      <p className="eyebrow">{eyebrow}</p>

      <h1>{title}</h1>

      <p className="subtitle">{description}</p>

    </div>

  );

}

function HomePage(props: {

  account: MicrosoftAccount | null;

  clientVersion: string;

  launchHistory: LastPlayed[];
  changelogs: ChangelogEntry[];
  updateInfo: AlphaClientUpdateInfo | null;

  showNews: boolean;

  onPlay: () => void;

  isLaunching: boolean;

  launchError: string | null;

  launchMessage: string | null;

  onAccount: () => void;

  onChangelog: () => void;

  onNews: () => void;

}) {

  const {

    account,

    clientVersion,

    launchHistory,
    changelogs,
    updateInfo,

    showNews,

    onPlay,

    isLaunching,

    launchError,

    launchMessage,

    onAccount,

    onChangelog,

    onNews,

  } = props;

  return (

    <div className="page">

      <div className="page-header home-page-header">
        <div
          className="home-welcome"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            textAlign: "center",
            gap: "16px",
          }}
        >
          <div
            className="home-welcome-logo"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              margin: 0,
            }}
          >
            <img
              className="home-welcome-logo-image"
              src="/alpha-client-startup-logo.png"
              alt="AlphaClient logo"
              draggable={false}
              style={{
                display: "block",
                width: "280px",
                maxWidth: "100%",
                height: "auto",
                objectFit: "contain",
                objectPosition: "center",
              }}
            />
          </div>
          <div className="home-welcome-copy" style={{ textAlign: "center" }}>
            <p className="eyebrow">ALPHACLIENT</p>
            <h1>Welcome back</h1>
          </div>
        </div>
        <p className="subtitle" style={{ textAlign: "center" }}>
          Your Minecraft experience is ready.
        </p>
      </div>

      <section className="home-grid">

        <div className="hero-card">

          <div className="hero-glow" />

          <div className="hero-content">

            <div className="hero-brand">

              <div className="hero-brand-copy">

                <strong>AlphaClient</strong>

                <span>MINECRAFT 1.8.9 · FORGE</span>

              </div>

            </div>

            <span className="version-badge">VERSION {clientVersion}</span>

            <h2>Ready to play?</h2>

            <p>

              A custom Minecraft client built around performance,

              customization and the Alpha identity.

            </p>

            <div className="hero-meta">

              <span>Minecraft 1.8.9</span>

              <span>•</span>

              <span>Forge</span>

            </div>

            <button

              type="button"

              className="play-button"

              onClick={onPlay}

              disabled={isLaunching}

            >

              <span>{isLaunching ? "◌" : "▶"}</span>

              {isLaunching ? "PREPARING..." : "LAUNCH ALPHACLIENT"}

            </button>

            {launchError && (

              <p className="launch-error" role="alert">

                {launchError}

              </p>

            )}

            {launchMessage && (

              <p className="launch-success">{launchMessage}</p>

            )}

          </div>

        </div>

        <div className="side-cards">

          <button

            type="button"

            className="info-card info-card-button"

            onClick={onAccount}

          >

            <div className="card-label">ACCOUNT</div>

            <div className="account-row">

              <div className="avatar">

                {account?.name?.charAt(0)?.toUpperCase() ?? "?"}

              </div>

              <div>

                <strong>{account?.name ?? "Not connected"}</strong>

                <span>{account?.email ?? "Click to connect"}</span>

              </div>

              <div className={`online-dot ${account ? "" : "offline"}`} />

            </div>

          </button>

          <div className="info-card">

            <div className="card-label">CLIENT STATUS</div>

            <div className="status-row">

              <div className="status-icon">

                {updateInfo?.update_available ? "↻" : "✓"}

              </div>

              <div>

                <strong>

                  {updateInfo?.update_available

                    ? "Update available"

                    : "Launcher ready"}

                </strong>

                <span>

                  AlphaClient {clientVersion}

                  {updateInfo?.update_available

                    ? ` • ${updateInfo.latest_version} available`

                    : ""}

                </span>

              </div>

            </div>

          </div>

          <div className="info-card update-card">

            <div className="card-label">UPDATES</div>

            <strong>{changelogs[0]?.title ?? "View the latest release notes."}</strong>
            {changelogs[0] && <span className="card-label">{changelogs[0].version} · {changelogs[0].date}</span>}

            <button

              type="button"

              className="text-button"

              onClick={onChangelog}

            >

              View changelog →

            </button>

          </div>

        </div>

      </section>

      <section className="lower-grid">
        {showNews && (
          <div className="section-card">
            <div className="section-header">
              <div>
                <span className="card-label">LATEST</span>
                <h3>News</h3>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={onNews}
              >
                View all →
              </button>
            </div>
            <div className="news-list">
              <div className="news-item">
                <div className="news-icon">A</div>
                <div>
                  <strong>{changelogs[0]?.title ?? `AlphaClient ${clientVersion}`}</strong>
                  <span>{changelogs[0]?.body ?? "Launcher improvements and installation preparation."}</span>
                </div>
                <time>{changelogs[0]?.version ?? "Client"}</time>
              </div>
              <div className="news-item">
                <div className="news-icon">+</div>
                <div>
                  <strong>Alpha Launcher</strong>
                  <span>More features are being developed.</span>
                </div>
                <time>News</time>
              </div>
            </div>
          </div>
        )}

        <div className="section-card">
          <div className="section-header">
            <div>
              <span className="card-label">HISTORY</span>
              <h3>Last played</h3>
            </div>
          </div>
          <div className="launch-history-list">
            {launchHistory.length > 0 ? (
              launchHistory.slice(0, MAX_LAUNCH_HISTORY).map((session, index) => (
                <div
                  className="last-played"
                  key={`${session.timestamp}-${index}`}
                >
                  <div className="minecraft-icon">A</div>
                  <div className="last-played-info">
                    <strong>AlphaClient</strong>
                    <span>Minecraft 1.8.9 • Forge</span>
                  </div>
                  <div className="played-time">
                    <strong>
                      {new Date(session.timestamp).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </strong>
                    <span>
                      {session.version.startsWith("Offline test · ")
                        ? `Offline test · ${session.version.slice("Offline test · ".length)}`
                        : `AlphaClient ${session.version}`}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="last-played">
                <div className="minecraft-icon">A</div>
                <div className="last-played-info">
                  <strong>AlphaClient</strong>
                  <span>Minecraft 1.8.9 • Forge</span>
                </div>
                <div className="played-time">
                  <strong>—</strong>
                  <span>No launch history</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>

  );

}

function PlayPage(props: {

  onPlay: () => void;

  isLaunching: boolean;

  launchError: string | null;

  launchMessage: string | null;

  onInstall: () => void;

  isInstalling: boolean;

  installMessage: string | null;

  selectedVersion: string;

  clientVersion: string;

  updateInfo: AlphaClientUpdateInfo | null;

  onUpdate: () => void;

  isUpdating: boolean;

}) {

  return (

    <div className="page">

      <PageTitle

        eyebrow="PLAY"

        title="Start AlphaClient"

        description="Prepare the selected installation or start the client."

      />

      <div className="installation-card selected">

        <div className="installation-icon">

          <AlphaLogo />

        </div>

        <div className="installation-info">

          <span className="card-label">SELECTED INSTALLATION</span>

          <h2>AlphaClient {props.clientVersion}</h2>

          <p>Minecraft 1.8.9 • Forge 11.15.1.2318</p>

        </div>

        <span className="installed-badge">

          {props.updateInfo?.update_available

            ? `UPDATE ${props.updateInfo.latest_version}`

            : "INSTALLED"}

        </span>

      </div>

      {props.updateInfo?.update_available && (

        <div className="section-card">

          <div className="section-header">

            <div>

              <span className="card-label">UPDATE AVAILABLE</span>

              <h3>AlphaClient {props.updateInfo.latest_version}</h3>

            </div>

          </div>

          <p className="subtitle">

            {props.updateInfo.changelog ||

              "A newer AlphaClient build is available."}

          </p>

          <button

            type="button"

            className="secondary-button install-button"

            onClick={props.onUpdate}

            disabled={props.isUpdating || props.isLaunching}

          >

            {props.isUpdating ? "UPDATING CLIENT..." : "UPDATE ALPHACLIENT"}

          </button>

        </div>

      )}

      <button

        type="button"

        className="large-play-button"

        onClick={props.onPlay}

        disabled={props.isLaunching || props.isUpdating}

      >

        <span>▶</span>

        {props.isLaunching ? "PREPARING..." : "LAUNCH ALPHACLIENT"}

      </button>

      <button

        type="button"

        className="secondary-button install-button"

        onClick={props.onInstall}

        disabled={props.isInstalling || props.isUpdating}

      >

        {props.isInstalling ? "INSTALLING..." : "INSTALL / REPAIR FILES"}

      </button>

      {props.launchError && (

        <p className="launch-error" role="alert">

          {props.launchError}

        </p>

      )}

      {props.launchMessage && (

        <p className="launch-success">{props.launchMessage}</p>

      )}

      {props.installMessage && (

        <p className="subtitle">{props.installMessage}</p>

      )}

      <p className="backend-note">

        The launcher can update AlphaClient builds independently from the

        launcher itself. Minecraft 1.8.9 and Forge remain in the AlphaClient

        installation.

      </p>

    </div>

  );

}

function VersionsPage(props: {

  filter: string;

  setFilter: (value: string) => void;

  selectedVersion: string;

  setSelectedVersion: (value: string) => void;

  onInstall: () => void;

  isInstalling: boolean;

  clientVersion: string;

  updateInfo: AlphaClientUpdateInfo | null;

  onUpdate: () => void;

  isUpdating: boolean;

}) {

  const versions = [

    {

      version: props.clientVersion,

      channel: "Stable",

      minecraft: "1.8.9",

      status: "Current installation",

    },

    ...(props.updateInfo?.update_available

      ? [

          {

            version: props.updateInfo.latest_version,

            channel: "Stable",

            minecraft: "1.8.9",

            status: "Update available",

          },

        ]

      : []),

  ];

  const visible = versions.filter(

    (version) =>

      props.filter === "All" || version.channel === props.filter,

  );

  return (

    <div className="page">

      <PageTitle

        eyebrow="VERSIONS"

        title="Versions"

        description="Manage AlphaClient builds independently from the launcher."

      />

      <div className="filter-row">

        {["All", "Stable", "Beta", "Development"].map((filter) => (

          <button

            type="button"

            key={filter}

            className={`filter ${

              props.filter === filter ? "active" : ""

            }`}

            onClick={() => props.setFilter(filter)}

          >

            {filter}

          </button>

        ))}

      </div>

      <div className="version-list">

        {visible.map((version) => (

          <div className="version-row" key={version.version}>

            <div className="version-icon">

              <AlphaLogo />

            </div>

            <div className="version-main">

              <strong>AlphaClient {version.version}</strong>

              <span>

                Minecraft {version.minecraft} • Forge

              </span>

            </div>

            <span className="channel-badge">{version.channel}</span>

            <span className="version-status">{version.status}</span>

            <button

              type="button"

              className="small-button"

              onClick={() =>

                props.updateInfo?.update_available &&

                version.version === props.updateInfo.latest_version

                  ? props.onUpdate()

                  : props.setSelectedVersion(version.version)

              }

              disabled={props.isUpdating}

            >

              {version.version === props.selectedVersion

                ? "Selected"

                : props.updateInfo?.update_available &&

                    version.version === props.updateInfo.latest_version

                  ? "Update"

                  : "Select"}

            </button>

          </div>

        ))}

      </div>

      <button

        type="button"

        className="large-play-button"

        onClick={props.onInstall}

        disabled={props.isInstalling || props.isUpdating}

      >

        {props.isInstalling

          ? "INSTALLING..."

          : "INSTALL / REPAIR CLIENT"}

      </button>

    </div>

  );

}

function ModsPage({

  mods,

  onToggle,

}: {

  mods: ModItem[];

  onToggle: (name: string) => void;

}) {

  return (

    <div className="page">

      <PageTitle

        eyebrow="CUSTOMIZATION"

        title="AlphaClient Mods"

        description="Manage module preferences for your client."

      />

      <div className="mods-list">

        {mods.map((mod) => (

          <div className="mod-row" key={mod.name}>

            <div className="mod-icon">◆</div>

            <div className="mod-info">

              <strong>{mod.name}</strong>

              <span>{mod.description}</span>

            </div>

            <button

              type="button"

              role="switch"

              aria-checked={mod.enabled}

              aria-label={`Toggle ${mod.name}`}

              title={

                mod.enabled

                  ? "Disable preference"

                  : "Enable preference"

              }

              className={`toggle ${mod.enabled ? "enabled" : ""}`}

              onClick={() => onToggle(mod.name)}

            >

              <span />

            </button>

          </div>

        ))}

      </div>

      <p className="backend-note">

        These switches currently save state only in this React session.

        They do not yet enable or disable the actual Minecraft mod files.

      </p>

    </div>

  );

}

type DeveloperTool =
  | "Rank Management"
  | "Permission Explorer"
  | "Audit Timeline"
  | "Change Review"
  | "Development Sandbox"
  | "Feature Rollout Manager"
  | "Release Manager";

const developerTools: { name: DeveloperTool; description: string; icon: string }[] = [
  { name: "Rank Management", description: "Manage Alpha ranks and rank assignments.", icon: "◆" },
  { name: "Permission Explorer", description: "Explore permissions and access rules.", icon: "◇" },
  { name: "Audit Timeline", description: "Review a chronological history of actions.", icon: "◷" },
  { name: "Change Review", description: "Review proposed changes before applying them.", icon: "⇄" },
  { name: "Development Sandbox", description: "Run local tests and inspect build information.", icon: "⌘" },
  { name: "Feature Rollout Manager", description: "Plan staged feature releases and rollouts.", icon: "◉" },
  { name: "Release Manager", description: "Prepare releases and publish changelogs.", icon: "↑" },
];

function DeveloperPage({
  offlineMode,
  setOfflineMode,
  testUsername,
  setTestUsername,
  isStartingOfflineTest,
  onStartTest,
  changelogs,
  setChangelogs,
}: {
  offlineMode: boolean;
  setOfflineMode: (enabled: boolean) => void;
  testUsername: string;
  setTestUsername: (username: string) => void;
  isStartingOfflineTest: boolean;
  onStartTest: () => void;
  changelogs: ChangelogEntry[];
  setChangelogs: (updater: ChangelogEntry[] | ((current: ChangelogEntry[]) => ChangelogEntry[])) => void;
}) {
  const [activeTool, setActiveTool] = useState<DeveloperTool>("Development Sandbox");
  const [draftVersion, setDraftVersion] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [changelogError, setChangelogError] = useState("");

  const resetChangelogDraft = () => {
    setDraftVersion("");
    setDraftTitle("");
    setDraftBody("");
    setEditingId(null);
    setChangelogError("");
  };

  const saveChangelog = () => {
    const version = draftVersion.trim();
    const title = draftTitle.trim();
    const body = draftBody.trim();
    if (!version || !title || !body) {
      setChangelogError("Vul versie, titel en wijzigingen in.");
      return;
    }
    const entry: ChangelogEntry = {
      id: editingId ?? Date.now(),
      version,
      title,
      body,
      date: new Date().toLocaleDateString(),
    };
    setChangelogs((current) => [entry, ...current.filter((item) => item.id !== editingId)].sort((a, b) => b.id - a.id));
    resetChangelogDraft();
  };

  const renderPlaceholder = (tool: DeveloperTool, detail: string) => (
    <section className="section-card developer-card">
      <div className="section-header">
        <div>
          <span className="card-label">DEVELOPER MODULE</span>
          <h3>{tool}</h3>
        </div>
        <span className="developer-status">Planned</span>
      </div>
      <p className="subtitle">{detail}</p>
      <div className="developer-warning">
        <span className="developer-warning-icon">i</span>
        <div>
          <strong>Module structure ready to build</strong>
          <p>This menu item is a placeholder for now. It does not change ranks, permissions, or live client data yet.</p>
        </div>
      </div>
      {tool === "Rank Management" && (
        <div className="developer-info-grid">
          {["Owner", "Developer", "Staff", "Tester", "User"].map((rank) => (
            <div key={rank}><span>Example rank</span><strong>{rank}</strong></div>
          ))}
        </div>
      )}
      {tool === "Permission Explorer" && (
        <div className="developer-info-grid">
          {["Mod Management", "Blacklist Management", "Rank Management", "Release Management"].map((permission) => (
            <div key={permission}><span>Example permission</span><strong>{permission}</strong></div>
          ))}
        </div>
      )}
      {tool === "Feature Rollout Manager" && (
        <div className="developer-info-grid">
          <div><span>Rollout strategy</span><strong>Staged rollout</strong></div>
          <div><span>Targeting</span><strong>Rank / user group</strong></div>
          <div><span>Safety</span><strong>Preview before publish</strong></div>
        </div>
      )}
    </section>
  );

  return (
    <div className="page developer-page">
      <PageTitle
        eyebrow="DEVELOPMENT"
        title="Developer Center"
        description="Een centrale plek voor Alpha Client development, beheer en releases."
      />

      <div className="developer-warning">
        <span className="developer-warning-icon">!</span>
        <div>
          <strong>Development build</strong>
          <p>De tools worden stap voor stap gebouwd. Modules met de status Planned zijn op dit moment alleen een menu en ontwerp, geen werkende backend-functies.</p>
        </div>
      </div>

      <div className="developer-tool-layout">
        <nav className="developer-tool-nav" aria-label="Developer menu">
          <span className="card-label">DEVELOPER MENU</span>
          {developerTools.map((tool) => (
            <button
              type="button"
              key={tool.name}
              className={`developer-tool-nav-item ${activeTool === tool.name ? "active" : ""}`}
              onClick={() => setActiveTool(tool.name)}
              aria-current={activeTool === tool.name ? "page" : undefined}
            >
              <span className="developer-tool-icon" aria-hidden="true">{tool.icon}</span>
              <span className="developer-tool-nav-copy">
                <strong>{tool.name}</strong>
                <small>{tool.description}</small>
              </span>
              <span className="developer-tool-chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </nav>

        <div className="developer-tool-content">
          {activeTool === "Rank Management" && renderPlaceholder("Rank Management", "Beheer ranks zoals Owner, Developer, Staff, Tester en User, en koppel later gecontroleerde rechten aan elke rank.")}
          {activeTool === "Permission Explorer" && renderPlaceholder("Permission Explorer", "Bekijk welke acties beschikbaar zijn, welke rank ze krijgt en waar een permission wordt gebruikt.")}
          {activeTool === "Audit Timeline" && renderPlaceholder("Audit Timeline", "Een tijdlijn voor wijzigingen aan ranks, permissions, instellingen en releases. Er worden nog geen acties gelogd.")}
          {activeTool === "Change Review" && renderPlaceholder("Change Review", "Een review-stap voor wijzigingen, zodat voorstellen kunnen worden bekeken en goedgekeurd voordat ze worden toegepast.")}

          {activeTool === "Development Sandbox" && <>
            <section className="section-card developer-card">
              <div className="section-header">
                <div><span className="card-label">TEST ENVIRONMENT</span><h3>Offline / Test Mode</h3></div>
                <span className={`developer-status ${offlineMode ? "active" : ""}`}>{offlineMode ? "Enabled" : "Disabled"}</span>
              </div>
              <label className="setting-line developer-setting-line">
                <span><strong>Enable offline test mode</strong><small>Alleen voor lokale development-tests.</small></span>
                <input type="checkbox" checked={offlineMode} onChange={(event) => setOfflineMode(event.target.checked)} />
              </label>
              <label className="developer-input-label" htmlFor="developer-username">Test username</label>
              <input id="developer-username" className="developer-text-input" type="text" value={testUsername} maxLength={16} onChange={(event) => setTestUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} placeholder="TestPlayer" />
              <button type="button" className="large-play-button developer-start-button" disabled={!offlineMode || !testUsername.trim() || isStartingOfflineTest} onClick={onStartTest}>
                {isStartingOfflineTest ? "STARTING OFFLINE TEST..." : "▶ START OFFLINE TEST"}
              </button>
            </section>
            <section className="section-card developer-card">
              <div className="section-header"><div><span className="card-label">BUILD INFORMATION</span><h3>Current profile</h3></div></div>
              <div className="developer-info-grid">
                <div><span>AlphaClient</span><strong>Live version from launcher</strong></div>
                <div><span>Minecraft</span><strong>1.8.9</strong></div>
                <div><span>Forge</span><strong>11.15.1.2318</strong></div>
                <div><span>Backend status</span><strong className="developer-not-connected">Not verified</strong></div>
              </div>
            </section>
          </>}

          {activeTool === "Feature Rollout Manager" && renderPlaceholder("Feature Rollout Manager", "Plan feature flags, target groups and staged rollouts. Publishing and remote targeting are not connected yet.")}

          {activeTool === "Release Manager" && <>
            <section className="section-card developer-card changelog-editor">
              <div className="section-header">
                <div><span className="card-label">HOME PAGE CONTENT</span><h3>Changelogs</h3></div>
                <span className="developer-status active">{changelogs.length} saved</span>
              </div>
              <p className="subtitle">Changelogs die hier worden opgeslagen, worden op Home bij Updates en News getoond. Deze opslag is lokaal in deze launcher.</p>
              <label className="developer-input-label" htmlFor="changelog-version">Versie</label>
              <input id="changelog-version" className="developer-text-input" value={draftVersion} onChange={(event) => setDraftVersion(event.target.value)} placeholder="0.3.80" />
              <label className="developer-input-label" htmlFor="changelog-title">Titel</label>
              <input id="changelog-title" className="developer-text-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Combat improvements" />
              <label className="developer-input-label" htmlFor="changelog-body">Wijzigingen</label>
              <textarea id="changelog-body" className="developer-text-input" rows={5} value={draftBody} onChange={(event) => setDraftBody(event.target.value)} placeholder={"Added — Nieuwe functies\nFixed — Bugs opgelost\nImproved — Verbeteringen"} />
              {changelogError && <p role="alert">{changelogError}</p>}
              <div className="developer-changelog-actions">
                <button type="button" className="large-play-button developer-start-button" onClick={saveChangelog}>{editingId === null ? "SAVE CHANGELOG" : "UPDATE CHANGELOG"}</button>
                {editingId !== null && <button type="button" className="secondary-button" onClick={resetChangelogDraft}>Cancel edit</button>}
              </div>
              <div className="news-list">
                {changelogs.length === 0 ? <p className="subtitle">Nog geen changelogs. Voeg hierboven je eerste toe.</p> : changelogs.map((entry) => (
                  <div className="news-item" key={entry.id}>
                    <div className="news-icon">A</div>
                    <div><strong>{entry.version} · {entry.title}</strong><span>{entry.body}</span><time>{entry.date}</time></div>
                    <div className="developer-changelog-actions">
                      <button type="button" className="small-button" onClick={() => { setEditingId(entry.id); setDraftVersion(entry.version); setDraftTitle(entry.title); setDraftBody(entry.body); setChangelogError(""); }}>Edit</button>
                      <button type="button" className="small-button" onClick={() => { setChangelogs((current) => current.filter((item) => item.id !== entry.id)); if (editingId === entry.id) resetChangelogDraft(); }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            {renderPlaceholder("Release Manager", "De changelog editor werkt lokaal. Build signing, release artifacts, update hosting en publicatie naar gebruikers moeten nog worden gekoppeld.")}
          </>}
        </div>
      </div>
    </div>
  );
}

function SettingsPage({

  onOpen,

  directory,

}: {

  onOpen: (section: string) => void;

  directory: string | null;

}) {

  const cards = [

    {

      title: "General",

      description: "Launcher appearance and behavior.",

    },

    {

      title: "Minecraft",

      description: "Game directory and memory preferences.",

    },

    {

      title: "Launcher",

      description: "Updates, downloads and notifications.",

    },

    {

      title: "AlphaClient",

      description: "Client version and profile information.",

    },

  ];

  return (

    <div className="page">

      <PageTitle

        eyebrow="PREFERENCES"

        title="Settings"

        description="Configure your Alpha Launcher preferences."

      />

      {directory && (

        <p className="directory-hint">Game directory: {directory}</p>

      )}

      <div className="settings-grid">

        {cards.map((card) => (

          <button

            type="button"

            key={card.title}

            className="settings-card"

            onClick={() => onOpen(card.title)}

          >

            <div className="settings-icon">⚙</div>

            <div>

              <h3>{card.title}</h3>

              <p>{card.description}</p>

            </div>

            <span className="settings-arrow">›</span>

          </button>

        ))}

      </div>

    </div>

  );

}

function AccountPage({

  account,

  isLoggingIn,

  loginError,

  onLogin,

  onLogout,

}: {

  account: MicrosoftAccount | null;

  isLoggingIn: boolean;

  loginError: string | null;

  onLogin: () => void;

  onLogout: () => void;

}) {

  return (

    <div className="page">

      <PageTitle

        eyebrow="ACCOUNT"

        title="Your account"

        description="Manage the Microsoft account used by AlphaClient."

      />

      <div className="account-large-card">

        <div className="large-avatar">

          {account?.name.charAt(0).toUpperCase() ?? "M"}

        </div>

        <div>

          <span className="card-label">MICROSOFT ACCOUNT</span>

          <h2>{account?.name ?? "Not connected"}</h2>

          <p>{account?.email ?? "Sign in to connect your account."}</p>

        </div>

        {account && (

          <div className="account-connected">

            <span />

            Connected

          </div>

        )}

      </div>

      {loginError && (

        <p className="launch-error" role="alert">

          {loginError}

        </p>

      )}

      <div className="account-actions">

        {!account ? (

          <button

            type="button"

            className="large-play-button"

            onClick={onLogin}

            disabled={isLoggingIn}

          >

            <span>●</span>

            {isLoggingIn ? "WAITING FOR MICROSOFT..." : "LOGIN WITH MICROSOFT"}

          </button>

        ) : (

          <>

            <button

              type="button"

              className="secondary-button"

              onClick={onLogin}

              disabled={isLoggingIn}

            >

              {isLoggingIn ? "LOGGING IN..." : "SWITCH ACCOUNT"}

            </button>

            <button

              type="button"

              className="secondary-button"

              onClick={onLogout}

            >

              LOG OUT

            </button>

          </>

        )}

      </div>

    </div>

  );

}

function StartupSplash() {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("alpha-splash-document");
    document.body.classList.add("alpha-splash-document");

    // Let the logo breathe for a moment, then fade it out before closing the window.
    const fadeTimer = window.setTimeout(() => setIsFadingOut(true), 1650);
    const finishTimer = window.setTimeout(() => {
      void invoke("finish_startup").catch((error) => {
        console.error("Could not finish Alpha Launcher startup:", error);
      });
    }, 2250);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(finishTimer);
      document.documentElement.classList.remove("alpha-splash-document");
      document.body.classList.remove("alpha-splash-document");
    };
  }, []);

  return (
    <main
      className={`alpha-native-splash${isFadingOut ? " alpha-native-splash-out" : ""}`}
      aria-label="Starting Alpha Launcher"
    >
      <img
        className="alpha-native-splash-logo"
        src="/alpha-client-startup-logo.png"
        alt="Alpha Client"
        draggable={false}
      />
    </main>
  );
}

function App() {
  const isSplash = new URLSearchParams(window.location.search).get("splash") === "1";
  return isSplash ? <StartupSplash /> : <LauncherApp />;
}

export default App;