import { useEffect, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "./lib/supabase";
import PrivateChatPanel from "./PrivateChatPanel";
import RankPermissionsManager from "./RankPermissionsManager";
import "./App.css";

type Page =
  | "Home"
  | "Play"
  | "Versions"
  | "Mods"
  | "Community"
  | "Friends"
  | "Developer"
  | "Settings"
  | "Account";

type MicrosoftAccount = { name: string; email: string };
type LastPlayed = { timestamp: number; version: string };
type ChangelogProduct = "launcher" | "client";
type ChangelogEntry = {
  id: number;
  version: string;
  title: string;
  body: string;
  date: string;
  product?: ChangelogProduct;
  published?: boolean;
};
type ChangelogDraft = {
  id?: number;
  version: string;
  title: string;
  body: string;
  product: ChangelogProduct;
};

const LAST_PLAYED_STORAGE_KEY = "alphaclient.lastPlayed";
const MAX_LAUNCH_HISTORY = 3;

type ModItem = { name: string; description: string; enabled: boolean };
type ModalContent = {
  title: string;
  body: string;
  kind?: "settings" | "changelog";
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
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
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

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const message = typeof value.message === "string" ? value.message : "";
    const code = typeof value.code === "string" ? value.code : "";
    const details = typeof value.details === "string" ? value.details : "";
    const hint = typeof value.hint === "string" ? value.hint : "";
    const parts = [
      message,
      code ? `Code: ${code}` : "",
      details ? `Details: ${details}` : "",
      hint ? `Hint: ${hint}` : "",
    ].filter(Boolean);
    if (parts.length) return parts.join("\\n");
    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return "An unknown error occurred.";
    }
  }

  return String(error);
}

function mapChangelogRows(data: any[]): ChangelogEntry[] {
  return data.map((item) => ({
    id: item.id,
    version: item.version,
    title: item.title,
    body: item.body,
    date: item.created_at
      ? new Date(item.created_at).toLocaleDateString()
      : "",
    product: item.product === "launcher" ? "launcher" : "client",
    published: Boolean(item.published),
  }));
}

function LauncherApp() {
  const [page, setPage] = useState<Page>("Home");
  const [openProfileEditor, setOpenProfileEditor] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isStartingOfflineTest, setIsStartingOfflineTest] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [launchHistory, setLaunchHistory] = useState<LastPlayed[]>(readLastPlayed);
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);

  const [account, setAccount] = useState<MicrosoftAccount | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [isInstalling, setIsInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalContent>(null);
  const [activeChangelogTab, setActiveChangelogTab] =
    useState<ChangelogProduct>("client");
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

  // Supabase developer authentication is separate from the Microsoft game account.
  const [developerEmail, setDeveloperEmail] = useState("");
  const [developerPassword, setDeveloperPassword] = useState("");
  const [developerUserEmail, setDeveloperUserEmail] = useState<string | null>(
    null,
  );
  const [developerAuthorized, setDeveloperAuthorized] = useState(false);
  const [developerAuthLoading, setDeveloperAuthLoading] = useState(true);
  const [developerAuthError, setDeveloperAuthError] = useState("");
  const [developerSigningIn, setDeveloperSigningIn] = useState(false);
  const [changelogBusy, setChangelogBusy] = useState(false);
  const [changelogMessage, setChangelogMessage] = useState("");

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

  // Restore the Supabase session and verify developer permissions on the server.
  useEffect(() => {
    let cancelled = false;

    const verifyDeveloper = async (user: { email?: string } | null) => {
      if (cancelled) return;

      setDeveloperAuthLoading(true);
      setDeveloperAuthError("");
      setDeveloperUserEmail(user?.email ?? null);
      setDeveloperAuthorized(false);

      if (!user) {
        setDeveloperAuthLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("is_developer_admin");

        if (cancelled) return;

        if (error) {
          console.error("Developer permission check failed:", error.message);
          setDeveloperAuthError(
            "Developerrechten konden niet worden gecontroleerd. Controleer of de Supabase-functie is_developer_admin bestaat en correct is ingesteld.",
          );
          setDeveloperAuthorized(false);
        } else if (data === true) {
          setDeveloperAuthorized(true);
          setDeveloperAuthError("");
        } else {
          setDeveloperAuthorized(false);
          setDeveloperAuthError(
            "Dit account heeft geen developerrechten.",
          );
        }
      } catch (error) {
        if (cancelled) return;
        setDeveloperAuthorized(false);
        setDeveloperAuthError(errorText(error));
      } finally {
        if (!cancelled) setDeveloperAuthLoading(false);
      }
    };

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          setDeveloperAuthError(error.message);
          setDeveloperAuthLoading(false);
          return;
        }
        void verifyDeveloper(data.session?.user ?? null);
      })
      .catch((error) => {
        if (cancelled) return;
        setDeveloperAuthError(errorText(error));
        setDeveloperAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void verifyDeveloper(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Public users only receive published entries. Verified developers receive drafts too.
  useEffect(() => {
    let cancelled = false;

    const loadChangelogs = async () => {
      let query = supabase
        .from("changelogs")
        .select("id, version, title, body, created_at, product, published");

      if (!developerAuthorized) {
        query = query.eq("published", true);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (cancelled) return;

      if (error) {
        console.error("Could not load changelogs:", error.message);
        return;
      }

      setChangelogs(mapChangelogRows(data ?? []));
    };

    void loadChangelogs();

    return () => {
      cancelled = true;
    };
  }, [developerAuthorized]);

  const refreshChangelogs = async () => {
    let query = supabase
      .from("changelogs")
      .select("id, version, title, body, created_at, product, published");

    if (!developerAuthorized) {
      query = query.eq("published", true);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;
    setChangelogs(mapChangelogRows(data ?? []));
  };

  const handleDeveloperLogin = async () => {
    if (developerSigningIn) return;

    const email = developerEmail.trim();
    if (!email || !developerPassword) {
      setDeveloperAuthError("Vul je e-mailadres en wachtwoord in.");
      return;
    }

    setDeveloperSigningIn(true);
    setDeveloperAuthError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: developerPassword,
      });

      if (error) throw error;

      setDeveloperPassword("");
      // onAuthStateChange verifies the account's developer permissions.
    } catch (error) {
      setDeveloperAuthError(errorText(error));
    } finally {
      setDeveloperSigningIn(false);
    }
  };

  const handleDeveloperLogout = async () => {
    setDeveloperAuthError("");
    setChangelogMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setDeveloperAuthError(error.message);
      return;
    }

    setDeveloperAuthorized(false);
    setDeveloperUserEmail(null);
    setChangelogs((current) => current.filter((entry) => entry.published));
  };

  const handleSaveChangelog = async (draft: ChangelogDraft) => {
    if (!developerAuthorized) {
      const message = "Je hebt geen toestemming om changelogs te wijzigen. Controleer of je developer-account is ingelogd en geautoriseerd.";
      setChangelogMessage(message);
      throw new Error(message);
    }

    const version = draft.version.trim();
    const title = draft.title.trim();
    const body = draft.body.trim();

    if (!version || !title || !body) {
      setChangelogMessage("Vul versie, titel en wijzigingen in.");
      return;
    }

    setChangelogBusy(true);
    setChangelogMessage("");

    try {
      const { error } = await supabase.rpc("manage_changelog", {
        p_action: draft.id !== undefined ? "update" : "create",
        p_id: draft.id ?? null,
        p_version: version,
        p_title: title,
        p_body: body,
        p_product: draft.product,
        p_published: false,
      });

      if (error) throw error;

      setChangelogMessage(
        draft.id !== undefined
          ? "Changelog bijgewerkt en geregistreerd in de auditlog."
          : "Concept opgeslagen en geregistreerd in de auditlog.",
      );
      await refreshChangelogs();
    } catch (error) {
      setChangelogMessage(`Opslaan mislukt: ${errorText(error)}`);
      throw error;
    } finally {
      setChangelogBusy(false);
    }
  };

  const handleDeleteChangelog = async (id: number) => {
    if (!developerAuthorized) {
      setChangelogMessage("Je hebt geen toestemming om changelogs te verwijderen.");
      return;
    }

    setChangelogBusy(true);
    setChangelogMessage("");

    try {
      const { error } = await supabase.rpc("manage_changelog", {
        p_action: "delete",
        p_id: id,
        p_version: null,
        p_title: null,
        p_body: null,
        p_product: "client",
        p_published: false,
      });

      if (error) throw error;

      await refreshChangelogs();
      setChangelogMessage("Changelog verwijderd en geregistreerd in de auditlog.");
    } catch (error) {
      setChangelogMessage(`Verwijderen mislukt: ${errorText(error)}`);
    } finally {
      setChangelogBusy(false);
    }
  };

  const handleTogglePublish = async (entry: ChangelogEntry) => {
    if (!developerAuthorized) {
      setChangelogMessage("Je hebt geen toestemming om changelogs te publiceren.");
      return;
    }

    setChangelogBusy(true);
    setChangelogMessage("");

    try {
      const { error } = await supabase.rpc("manage_changelog", {
        p_action: entry.published ? "unpublish" : "publish",
        p_id: entry.id,
        p_version: null,
        p_title: null,
        p_body: null,
        p_product: entry.product ?? "client",
        p_published: !entry.published,
      });

      if (error) throw error;

      await refreshChangelogs();
      setChangelogMessage(
        entry.published
          ? "Changelog is niet meer gepubliceerd en de actie is gelogd."
          : "Changelog gepubliceerd en de actie is gelogd. Deze is nu zichtbaar voor gebruikers.",
      );
    } catch (error) {
      setChangelogMessage(`Publiceren mislukt: ${errorText(error)}`);
    } finally {
      setChangelogBusy(false);
    }
  };

  const recordLaunch = (version: string) => {
    const entry: LastPlayed = { timestamp: Date.now(), version };

    setLaunchHistory((current) => {
      const updated = [entry, ...current]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_LAUNCH_HISTORY);

      try {
        localStorage.setItem(
          LAST_PLAYED_STORAGE_KEY,
          JSON.stringify(updated),
        );
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
      const message = await invoke<string>("start_offline_test", { username });
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
          const updateMessage = await invoke<string>("update_alphaclient");
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
      recordLaunch(
        updateInfo?.update_available
          ? updateInfo.latest_version
          : clientVersion,
      );
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
      setModal({ title: "Installation complete", body: result });
    } catch (error) {
      const message = errorText(error);
      setInstallMessage(`Installation failed: ${message}`);
      setModal({ title: "Installation failed", body: message });
    } finally {
      setIsInstalling(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    if (isLoggingIn) return;

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const result = await invoke<MicrosoftAccount>("start_microsoft_login");
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
    setOpenProfileEditor(false);
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
    { name: "Community", icon: "◉" },
    { name: "Friends", icon: "♧" },
    { name: "Developer", icon: "⌘" },
  ];

  const bottomNavigation: { name: Page; icon: string }[] = [
    { name: "Account", icon: "●" },
    { name: "Settings", icon: "⚙" },
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
          className={`sidebar ${sidebarExpanded ? "expanded" : "collapsed"}`}
        >
          <div
            className={`sidebar-feature-logo ${sidebarExpanded ? "expanded" : "collapsed"}`}
            aria-hidden="true"
          >
            {sidebarExpanded && (
              <img
                src="/alpha-client-startup-logo.png"
                alt=""
                draggable={false}
              />
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
                {item.name === "Developer" && <div className="nav-separator" />}
                <button
                  type="button"
                  title={!sidebarExpanded ? item.name : undefined}
                  className={`nav-item ${page === item.name ? "active" : ""}`}
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

          <div className="sidebar-bottom-group" aria-label="Profile and settings">
            {bottomNavigation.map((item) => (
              <button
                key={item.name}
                type="button"
                title={!sidebarExpanded ? item.name : undefined}
                className={`nav-item ${page === item.name ? "active" : ""}`}
                onClick={() => navigate(item.name)}
              >
                <span className="nav-icon">{item.icon}</span>
                {sidebarExpanded && <span>{item.name}</span>}
              </button>
            ))}
          </div>

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
              changelogs={changelogs.filter((entry) => entry.published)}
              updateInfo={updateInfo}
              showNews={settings.showNews}
              onPlay={handlePlay}
              isLaunching={isLaunching || isUpdatingClient}
              launchError={launchError}
              launchMessage={launchMessage}
              onAccount={() => navigate("Account")}
              onCommunity={() => navigate("Community")}
              onChangelog={() => {
                setActiveChangelogTab("client");
                setModal({
                  title: "Changelog overzicht",
                  body: "",
                  kind: "changelog",
                });
              }}
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

          {page === "Community" && <CommunityPage onOpenProfile={() => { setOpenProfileEditor(true); navigate("Account"); }} />}

          {page === "Friends" && <FriendsPage />}


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
                  localStorage.setItem("alphaclient.dev.username", username);
                } catch {}
              }}
              isStartingOfflineTest={isStartingOfflineTest}
              onStartTest={handleStartOfflineTest}
              changelogs={changelogs}
              developerEmail={developerEmail}
              setDeveloperEmail={setDeveloperEmail}
              developerPassword={developerPassword}
              setDeveloperPassword={setDeveloperPassword}
              developerUserEmail={developerUserEmail}
              developerAuthorized={developerAuthorized}
              developerAuthLoading={developerAuthLoading}
              developerAuthError={developerAuthError}
              developerSigningIn={developerSigningIn}
              onDeveloperLogin={handleDeveloperLogin}
              onDeveloperLogout={handleDeveloperLogout}
              onSaveChangelog={handleSaveChangelog}
              onDeleteChangelog={handleDeleteChangelog}
              onTogglePublish={handleTogglePublish}
              changelogBusy={changelogBusy}
              changelogMessage={changelogMessage}
            />
          )}

          {page === "Settings" && (
            <SettingsPage onOpen={openSettings} directory={clientDirectory} />
          )}

          {page === "Account" && (
            <div className="account-profile-layout">
              <AccountPage
                account={account}
                isLoggingIn={isLoggingIn}
                loginError={loginError}
                onLogin={handleMicrosoftLogin}
                onLogout={handleMicrosoftLogout}
              />
              <ProfilePage startEditing={openProfileEditor} />
            </div>
          )}
        </main>
      </div>

      {modal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
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

            {modal.kind === "changelog" ? (
              <div className="modal-changelog-content">
                <div
                  className="changelog-tabs"
                  role="tablist"
                  aria-label="Kies product"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeChangelogTab === "launcher"}
                    className={
                      activeChangelogTab === "launcher"
                        ? "changelog-tab active"
                        : "changelog-tab"
                    }
                    onClick={() => setActiveChangelogTab("launcher")}
                  >
                    Alpha Launcher
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeChangelogTab === "client"}
                    className={
                      activeChangelogTab === "client"
                        ? "changelog-tab active"
                        : "changelog-tab"
                    }
                    onClick={() => setActiveChangelogTab("client")}
                  >
                    Alpha Client
                  </button>
                </div>

                <div className="changelog-tab-panel" role="tabpanel">
                  {(() => {
                    const entries = changelogs.filter(
                      (entry) => entry.product === activeChangelogTab,
                    );

                    if (entries.length === 0) {
                      return (
                        <p className="modal-body-text">
                          Nog geen gepubliceerde changelogs voor{" "}
                          {activeChangelogTab === "launcher"
                            ? "Alpha Launcher"
                            : "Alpha Client"}
                          .
                        </p>
                      );
                    }

                    return entries.map((entry) => (
                      <article
                        className="changelog-entry"
                        key={`${entry.product}-${entry.id}`}
                      >
                        <div className="changelog-entry-heading">
                          <strong>
                            {entry.version} — {entry.title}
                          </strong>
                          <time>{entry.date}</time>
                        </div>
                        <p>{entry.body}</p>
                      </article>
                    ));
                  })()}
                </div>

                <button
                  type="button"
                  className="large-play-button"
                  onClick={() => setModal(null)}
                >
                  CLOSE
                </button>
              </div>
            ) : modal.kind === "settings" ? (
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
                          {settings.ramGb} GB RAM (saved as a preference; not yet
                          passed to Java).
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

type EditableCommunityProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  is_founder: boolean;
  rank_key?: string | null;
};

const COMMUNITY_RANKS: Record<string, { label: string; color: string }> = {
  founder: { label: "FOUNDER", color: "#FFD866" }, owner: { label: "OWNER", color: "#FF2D00" }, management: { label: "MANAGEMENT", color: "#5C0303" }, senior_admin: { label: "SENIOR ADMIN", color: "#D67020" }, admin: { label: "ADMIN", color: "#E08D16" }, senior_moderator: { label: "SENIOR MODERATOR", color: "#8C17D1" }, moderator: { label: "MODERATOR", color: "#29AFCC" }, trial_moderator: { label: "TRIAL MODERATOR", color: "#166534" }, beta: { label: "BETA", color: "#00FF52" }, alpha_plus: { label: "ALPHA+", color: "#FFF300" }, alpha: { label: "ALPHA", color: "#F300FF" }, member: { label: "MEMBER", color: "#C3BFE0" },
};

function CommunityPage({ onOpenProfile }: { onOpenProfile: () => void }) {
  const [displayName, setDisplayName] = useState("Community member");
  const [communityRank, setCommunityRank] = useState("member");
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [communityFriends, setCommunityFriends] = useState<CommunityProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState("");
  const [communityLogoutLoading, setCommunityLogoutLoading] = useState(false);
  const [communityLogoutError, setCommunityLogoutError] = useState("");
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const handleCommunityAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authBusy) return;
    const cleanEmail = authEmail.trim();
    const cleanUsername = authUsername.trim();
    if (!cleanEmail || !authPassword) {
      setAuthError("Enter your email address and password.");
      return;
    }
    if (authMode === "signup" && !cleanUsername) {
      setAuthError("Choose a community username.");
      return;
    }
    if (authMode === "signup" && authPassword.length < 6) {
      setAuthError("Your password must contain at least 6 characters.");
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: authPassword,
        });
        if (error) throw error;
        window.location.reload();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: authPassword,
          options: {
            data: { username: cleanUsername, display_name: cleanUsername },
          },
        });
        if (error) throw error;
        if (data.session) {
          window.location.reload();
        } else {
          setAuthMessage("Account created. Check your email to confirm the account, then sign in here.");
          setAuthMode("login");
          setAuthPassword("");
        }
      }
    } catch (error) {
      setAuthError(errorText(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCommunityLogout = async () => {
    if (communityLogoutLoading) return;
    setCommunityLogoutLoading(true);
    setCommunityLogoutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSignedIn(false);
      setEmail("");
      setDisplayName("Community member");
      setCommunityRank("member");
      setCommunityFriends([]);
    } catch (error) {
      setCommunityLogoutError(errorText(error));
    } finally {
      setCommunityLogoutLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadCommunityIdentity = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (cancelled) return;
      if (authError || !authData.user) {
        setIdentityLoading(false);
        return;
      }

      const user = authData.user;
      setEmail(user.email ?? "");

      // The editable community profile is the source of truth for the displayed profile name.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username, display_name, rank_key, is_founder")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (profileError) {
        console.warn("Could not load community profile name:", profileError.message);
      }

      const metadata = user.user_metadata ?? {};
      const candidates = [profile?.username, profile?.display_name, metadata.username, metadata.display_name, metadata.full_name];
      const name = candidates.find(
        (candidate): candidate is string =>
          typeof candidate === "string" &&
          candidate.trim().length > 0 &&
          candidate.trim().toLowerCase() !== (user.email ?? "").trim().toLowerCase(),
      );
      setDisplayName(name?.trim() ?? "Community member");
      setCommunityRank(profile?.rank_key || (profile?.is_founder ? "founder" : "member"));
      setSignedIn(true);
      setIdentityLoading(false);
    };

    void loadCommunityIdentity().catch((error) => {
      console.warn("Could not load community identity:", error);
      if (!cancelled) setIdentityLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const forumSections = [
    { icon: "⌘", title: "Help & support", description: "Ask questions and help other AlphaClient players." },
    { icon: "✦", title: "Announcements", description: "Official AlphaClient news and community updates." },
    { icon: "✎", title: "Ideas & feedback", description: "Share suggestions and discuss future improvements." },
    { icon: "☷", title: "Chatroom", description: "Join community conversations and meet other players." },
  ];

  useEffect(() => {
    let cancelled = false;
    const loadCommunityFriends = async () => {
      setFriendsLoading(true);
      setFriendsError("");
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) { setCommunityFriends([]); return; }
        const { data: friendshipRows, error: friendshipError } = await supabase
          .from("friendships")
          .select("user_a, user_b")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
        if (friendshipError) throw friendshipError;
        const friendIds = (friendshipRows ?? []).map((row: { user_a: string; user_b: string }) => row.user_a === user.id ? row.user_b : row.user_a);
        if (!friendIds.length) { setCommunityFriends([]); return; }
        const { data: people, error: peopleError } = await supabase
          .from("profiles")
          .select("id, username, display_name, is_founder, rank_key, avatar_url, bio")
          .in("id", friendIds);
        if (peopleError) throw peopleError;
        if (!cancelled) setCommunityFriends(((people ?? []) as CommunityProfile[]).sort((a, b) => a.username.localeCompare(b.username)));
      } catch (e) {
        if (!cancelled) setFriendsError(errorText(e));
      } finally {
        if (!cancelled) setFriendsLoading(false);
      }
    };
    void loadCommunityFriends();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page community-page">
      <header className="page-header">
        <p className="eyebrow">ALPHACLIENT COMMUNITY</p>
        <h1>Community</h1>
        <p className="subtitle">Your place for profiles, conversations and everything around AlphaClient.</p>
      </header>

      <section className="community-welcome-card">
        <div className="community-avatar" aria-hidden="true">{identityLoading ? "…" : displayName.trim().charAt(0).toUpperCase() || "A"}</div>
        <div className="community-welcome-copy">
          <span className="community-kicker">{signedIn ? "YOUR ALPHA ACCOUNT" : "ALPHA ACCOUNT"}</span>
          <div className="community-name-rank"><h2>{identityLoading ? "Loading profile…" : signedIn ? displayName : "Welcome to the community"}</h2>{signedIn && !identityLoading && <span className={`community-menu-rank ${communityRank === "founder" ? "is-founder" : ""}`} style={{ "--rank-color": COMMUNITY_RANKS[communityRank]?.color ?? COMMUNITY_RANKS.member.color } as React.CSSProperties}>{COMMUNITY_RANKS[communityRank]?.label ?? "MEMBER"}</span>}</div>
          <p>{identityLoading ? "Loading your community account…" : signedIn ? (email || "Your AlphaClient profile") : "Sign in to your community account to use your profile and display name."}</p>
        </div>
        <div className="community-account-actions">
          {signedIn ? (
            <>
              <button type="button" className="friends-primary community-profile-button" onClick={onOpenProfile}>Edit profile <span aria-hidden="true">↗</span></button>
              <button type="button" className="secondary-button community-logout-button" onClick={() => void handleCommunityLogout()} disabled={communityLogoutLoading}>{communityLogoutLoading ? "SIGNING OUT..." : "LOG OUT"}</button>
            </>
          ) : (
            <button type="button" className="friends-primary community-profile-button" onClick={() => { setAuthPanelOpen((open) => !open); setAuthError(""); setAuthMessage(""); }}>
              {authPanelOpen ? "Close sign in" : "Log in / Sign up"} <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
        {communityLogoutError && <p className="community-logout-error" role="alert">{communityLogoutError}</p>}
        {authPanelOpen && !signedIn && (
          <form className="community-auth-panel" onSubmit={(event) => void handleCommunityAuth(event)}>
            <div className="community-auth-heading">
              <div>
                <span className="community-kicker">ALPHA COMMUNITY ACCOUNT</span>
                <h3>{authMode === "login" ? "Welcome back" : "Create your account"}</h3>
                <p>{authMode === "login" ? "Sign in with your email and password." : "Create a test account with a unique email address."}</p>
              </div>
              <div className="community-auth-mode">
                <button type="button" className={authMode === "login" ? "is-active" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); setAuthMessage(""); }}>Log in</button>
                <button type="button" className={authMode === "signup" ? "is-active" : ""} onClick={() => { setAuthMode("signup"); setAuthError(""); setAuthMessage(""); }}>Sign up</button>
              </div>
            </div>
            {authMode === "signup" && <label className="community-auth-field"><span>Username</span><input value={authUsername} onChange={(event) => setAuthUsername(event.target.value)} autoComplete="username" maxLength={24} placeholder="Choose a username" required /></label>}
            <label className="community-auth-field"><span>Email address</span><input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
            <label className="community-auth-field"><span>Password</span><input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={6} placeholder="At least 6 characters" required /></label>
            {authError && <p className="community-auth-feedback is-error" role="alert">{authError}</p>}
            {authMessage && <p className="community-auth-feedback is-success" role="status">{authMessage}</p>}
            <button type="submit" className="friends-primary community-auth-submit" disabled={authBusy}>{authBusy ? "PLEASE WAIT..." : authMode === "login" ? "LOG IN TO COMMUNITY" : "CREATE COMMUNITY ACCOUNT"}</button>
            <p className="community-auth-note">Registration depends on the email sign-up settings in Supabase. If confirmation is enabled, confirm your email before signing in.</p>
          </form>
        )}
      </section>

      <div className="community-main-layout">
        <section className="community-sections-column">
          <div className="community-section-heading">
            <div><p className="eyebrow">MEET. SHARE. PLAY.</p><h2>Community</h2></div>
          </div>
          <p className="community-intro">Choose a space to connect with the AlphaClient community.</p>
          <div className="community-forum-list">
            {forumSections.map((forumSection, index) => (
              <article className="community-forum-card" key={forumSection.title}>
                <div className="community-forum-icon" aria-hidden="true">{forumSection.icon}</div>
                <div className="community-forum-card-copy">
                  <span className="community-forum-number">0{index + 1} / COMMUNITY</span>
                  <h3>{forumSection.title}</h3><p>{forumSection.description}</p>
                </div>
                <span className="community-forum-status">Coming soon</span>
              </article>
            ))}
          </div>
        </section>
        <aside className="community-friends-panel">
          <div className="community-friends-heading">
            <div><p className="eyebrow">YOUR PEOPLE</p><h2>Friends</h2></div>
            <span className="friends-count">{communityFriends.length}</span>
          </div>
          <p className="community-friends-subtitle">Your friends, right beside the community spaces.</p>
          {friendsError && <p className="community-friends-error">{friendsError}</p>}
          {friendsLoading ? <div className="friends-empty">Loading friends…</div> :
            !signedIn ? <div className="friends-empty">Sign in to see your friends.</div> :
            communityFriends.length === 0 ? <div className="friends-empty">No friends yet. Add players from the Friends page.</div> :
            <div className="community-friends-list">{communityFriends.map(friend => (
              <div className="community-friend-item" key={friend.id}>
                <div className="community-friend-avatar">{friend.avatar_url ? <img src={friend.avatar_url} alt="" /> : (friend.username || "?").slice(0, 1).toUpperCase()}</div>
                <div className="community-friend-copy"><strong>{friend.username}</strong><span>Alpha Community</span></div>
                <span className="community-friend-presence" title="Presence is not configured yet" aria-label="Online status unavailable" />
              </div>
            ))}</div>}
          <p className="community-friends-footnote">Online indicators will activate once live presence is connected.</p>
        </aside>
      </div>
    </div>
  );
}

function ProfilePage({ startEditing = false }: { startEditing?: boolean }) {
  const [profile, setProfile] = useState<EditableCommunityProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(startEditing);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        setUserId(null);
        setProfile(null);
        return;
      }
      setUserId(user.id);
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, is_founder, rank_key")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!data) {
        setProfile(null);
        return;
      }
      const loaded = data as EditableCommunityProfile;
      setProfile(loaded);
      setDisplayName(loaded.username || "");
      setBio(loaded.bio || "");
      setAvatarUrl(loaded.avatar_url || null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProfile(); }, []);

  const handleAvatarSelection = (file: File | null) => {
    setError("");
    setMessage("");
    if (!file) { setSelectedAvatar(null); return; }
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file (PNG, JPG, WEBP, or GIF).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Your profile picture must be 5 MB or smaller.");
      return;
    }
    setSelectedAvatar(file);
    setAvatarUrl(URL.createObjectURL(file));
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || !profile) return;
    const cleanBio = bio.trim();
    if (cleanBio.length > 160) {
      setError("Bio must be 160 characters or fewer.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      let nextAvatarUrl = profile.avatar_url;
      if (selectedAvatar) {
        setUploading(true);
        const extension = selectedAvatar.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
        const filePath = `${userId}/avatar.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-avatars")
          .upload(filePath, selectedAvatar, { upsert: true, contentType: selectedAvatar.type, cacheControl: "3600" });
        if (uploadError) throw new Error(`Profile picture upload failed: ${uploadError.message}. Check that the profile-avatars storage bucket and policies have been created.`);
        nextAvatarUrl = supabase.storage.from("profile-avatars").getPublicUrl(filePath).data.publicUrl;
      }
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ bio: cleanBio, avatar_url: nextAvatarUrl })
        .eq("id", userId)
        .select("id, username, display_name, bio, avatar_url, is_founder, rank_key")
        .single();
      if (updateError) throw updateError;
      setProfile(data as EditableCommunityProfile);
      setDisplayName(data.username || profile.username); setBio(cleanBio); setAvatarUrl(nextAvatarUrl);
      setIsEditing(false);
      setSelectedAvatar(null);
      setMessage("Your profile has been saved.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false); setUploading(false);
    }
  };

  const resetChanges = () => {
    if (!profile) return;
    setDisplayName(profile.username || "");
    setBio(profile.bio || "");
    setAvatarUrl(profile.avatar_url || null);
    setSelectedAvatar(null);
    setError(""); setMessage("");
  };

  return <div className="page profile-page">
    <div className="page-header">
      <div>
        <div className="eyebrow">ALPHA ACCOUNT</div>
        <h1>{isEditing ? "Edit Alpha Account" : "My Alpha Account"}</h1>
        <p>{isEditing ? "Update the profile details other AlphaClient players can see." : "Your Alpha Account and community profile in one place."}</p>
      </div>
      <div className="profile-header-actions">
        {profile && !isEditing && <button className="profile-edit-icon-button" type="button" onClick={() => { setIsEditing(true); setError(""); setMessage(""); }} aria-label="Edit profile" title="Edit profile">✎</button>}
        {isEditing && <button className="friends-secondary profile-back-button" type="button" onClick={() => { resetChanges(); setIsEditing(false); }}>← Back to profile</button>}
        <button className="friends-refresh" type="button" onClick={() => void loadProfile()} disabled={loading}>↻ Refresh</button>
      </div>
    </div>
    {error && <div className="friends-notice error">{error}</div>}
    {message && <div className="friends-notice success">{message}</div>}
    {!loading && !userId && <section className="section-card profile-signin"><div className="profile-avatar-large">◎</div><h2>Sign in to your Alpha Account</h2><p>Your Alpha Account is also your community profile. Sign in to manage your profile and access Alpha community features.</p></section>}
    {!loading && userId && !profile && <section className="section-card"><h2>Alpha Account profile not found</h2><p>Your Alpha Account does not have a community profile yet. Open Friends and complete the username setup, or check the profile creation trigger in Supabase.</p></section>}
    {loading && <div className="friends-loading">Loading profile…</div>}
    {profile && !isEditing && <section className="section-card profile-preview-card profile-view-card">
      <div className="profile-preview-glow" />
      <div className="eyebrow profile-account-label">ALPHA ACCOUNT</div>
      <div className="profile-avatar-large">{profile.avatar_url ? <img src={profile.avatar_url} alt="Your profile avatar" /> : <span>{profile.username.slice(0, 1).toUpperCase()}</span>}</div>
      <h2 className="profile-name-row">{(() => { const rankKey = profile.rank_key || (profile.is_founder ? "founder" : "member"); const rank = COMMUNITY_RANKS[rankKey] || COMMUNITY_RANKS.member; return rankKey === "founder" ? <span className="profile-founder-badge"><span className="profile-founder-icon" aria-hidden="true">🌸</span>FOUNDER</span> : <span className="profile-rank-badge" style={{ "--rank-color": rank.color } as React.CSSProperties}>{rank.label}</span>; })()}{profile.username}</h2>
      <div className="profile-username">@{profile.username}</div>
      <p className="profile-bio-preview">{profile.bio?.trim() || "You haven't added a bio yet."}</p>
      <div className="profile-preview-divider" />
      <div className="profile-preview-foot"><span className="profile-status-dot" /> Alpha Account</div>
      {profile.is_founder && <div className="profile-founder-status"><span className="profile-founder-crown">♛</span> Founder of Alpha Client</div>}
    </section>}
    {profile && isEditing && <form className="profile-edit-page" onSubmit={saveProfile}>
      <section className="section-card profile-edit-card">
        <div className="profile-section-heading"><div><h2>Edit your profile</h2><p>These details are saved to your Alpha Account and community profile.</p></div></div>
        <div className="profile-avatar-editor">
          <div className="profile-avatar-small">{avatarUrl ? <img src={avatarUrl} alt="Selected profile avatar" /> : <span>{profile.username.slice(0, 1).toUpperCase()}</span>}</div>
          <div className="profile-avatar-controls"><strong>Profile picture</strong><span>PNG, JPG, WEBP or GIF · Max 5 MB</span><label className="friends-secondary profile-upload-button" htmlFor="profile-avatar-upload">{selectedAvatar ? "Change image" : "Upload image"}</label><input id="profile-avatar-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => handleAvatarSelection(event.target.files?.[0] ?? null)} /></div>
        </div>
        <label className="profile-field-label" htmlFor="profile-display-name">Alpha Name</label>
        <input className="profile-text-input" id="profile-display-name" value={profile.username} readOnly aria-readonly="true" />
        <div className="profile-field-meta"><span>Your Alpha Name is your permanent community identity and cannot be changed here.</span></div>
        <label className="profile-field-label" htmlFor="profile-username">Username</label>
        <div className="profile-username-readonly"><span>@</span><input id="profile-username" value={profile.username} readOnly aria-readonly="true" /><span className="profile-lock">UNIQUE</span></div>
        <small className="profile-field-help">Your unique username is used to find you and send friend requests.</small>
        <label className="profile-field-label" htmlFor="profile-bio">Bio</label>
        <textarea className="profile-bio-input" id="profile-bio" value={bio} onChange={event => setBio(event.target.value.slice(0, 160))} maxLength={160} rows={4} placeholder="Tell the community a little about yourself…" />
        <div className="profile-field-meta"><span>Keep it friendly and personal</span><span>{bio.length}/160</span></div>
        <div className="profile-form-actions"><button type="button" className="friends-secondary" onClick={resetChanges} disabled={saving || uploading}>Discard changes</button><button type="submit" className="friends-primary" disabled={saving || uploading}>{uploading ? "Uploading picture…" : saving ? "Saving profile…" : "Save changes"}</button></div>
      </section>
    </form>}
  </div>;
}

type CommunityProfile = { id: string; username: string; display_name: string; is_founder: boolean; rank_key?: string | null; avatar_url?: string | null; bio?: string | null };
type CommunityFriendRequest = { id: string; sender_id: string; recipient_id: string; status: string; created_at: string };

function FriendsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<CommunityProfile | null>(null);
  const [friends, setFriends] = useState<CommunityProfile[]>([]);
  const [selectedChatFriendId, setSelectedChatFriendId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<Array<CommunityFriendRequest & { profile?: CommunityProfile }>>([]);
  const [outgoing, setOutgoing] = useState<Array<CommunityFriendRequest & { profile?: CommunityProfile }>>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CommunityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [setupUsername, setSetupUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSetupRequired, setProfileSetupRequired] = useState(false);

  const loadCommunity = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        setUserId(null); setMyProfile(null); setFriends([]); setIncoming([]); setOutgoing([]);
        return;
      }
      setUserId(user.id);
      const { data: profile, error: profileError } = await supabase.from("profiles").select("id, username, display_name, is_founder, rank_key").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      const loadedProfile = profile as CommunityProfile | null;
      setMyProfile(loadedProfile);
      const needsSetup = Boolean(loadedProfile && loadedProfile.username.startsWith("alpha_"));
      setProfileSetupRequired(needsSetup);
      if (loadedProfile && needsSetup) {
        setSetupUsername(loadedProfile.username.startsWith("alpha_") ? "" : loadedProfile.username);
      }
      const [{ data: friendshipRows, error: friendshipError }, { data: requestRows, error: requestError }] = await Promise.all([
        supabase.from("friendships").select("user_a, user_b").or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
        supabase.from("friend_requests").select("id, sender_id, recipient_id, status, created_at").or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).eq("status", "pending").order("created_at", { ascending: false }),
      ]);
      if (friendshipError) throw friendshipError;
      if (requestError) throw requestError;
      const friendIds = (friendshipRows ?? []).map((row: { user_a: string; user_b: string }) => row.user_a === user.id ? row.user_b : row.user_a);
      const requests = (requestRows ?? []) as CommunityFriendRequest[];
      const otherIds = [...new Set([...friendIds, ...requests.map(r => r.sender_id === user.id ? r.recipient_id : r.sender_id)])];
      const { data: people, error: peopleError } = otherIds.length ? await supabase.from("profiles").select("id, username, display_name, is_founder, rank_key").in("id", otherIds) : { data: [], error: null };
      if (peopleError) throw peopleError;
      const profileMap = new Map(((people ?? []) as CommunityProfile[]).map(person => [person.id, person]));
      setFriends(friendIds.map(id => profileMap.get(id)).filter((person): person is CommunityProfile => Boolean(person)).sort((a,b) => a.username.localeCompare(b.username)));
      setIncoming(requests.filter(r => r.recipient_id === user.id).map(r => ({ ...r, profile: profileMap.get(r.sender_id) })));
      setOutgoing(requests.filter(r => r.sender_id === user.id).map(r => ({ ...r, profile: profileMap.get(r.recipient_id) })));
    } catch (e) {
      setError(errorText(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadCommunity(); }, []);

  const saveCommunityProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) return;
    const username = setupUsername.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { setError("Username must be 3–20 characters and use only letters, numbers, or underscores."); return; }
    setSavingProfile(true); setError(""); setMessage("");
    const { error: saveError } = await supabase.from("profiles").update({ username, display_name: username }).eq("id", userId);
    setSavingProfile(false);
    if (saveError) {
      setError(saveError.code === "23505" ? "That username is already taken. Please choose another." : errorText(saveError));
      return;
    }
    setProfileSetupRequired(false);
    setMessage("Your Alpha Community profile is ready.");
    await loadCommunity();
  };

  const searchUsers = async () => {
    setError(""); setMessage("");
    const term = search.trim().toLowerCase().replace(/^@/, "");
    if (term.length < 3) { setError("Enter at least 3 characters to search."); setResults([]); return; }
    if (!userId) { setError("Sign in to an Alpha community account before searching."); return; }
    const { data, error: searchError } = await supabase.from("profiles").select("id, username, display_name, is_founder, rank_key").ilike("username", `%${term}%`).neq("id", userId).limit(20);
    if (searchError) { setError(errorText(searchError)); return; }
    const known = new Set([...friends.map(f => f.id), ...incoming.map(r => r.sender_id), ...outgoing.map(r => r.recipient_id)]);
    setResults(((data ?? []) as CommunityProfile[]).filter(person => !known.has(person.id)));
    if (!data?.length) setMessage("No Alpha accounts matched that username.");
  };

  const sendRequest = async (profile: CommunityProfile) => {
    setBusyId(profile.id); setError(""); setMessage("");
    const { error: requestError } = await supabase.rpc("send_friend_request", { p_recipient_id: profile.id });
    if (requestError) setError(errorText(requestError));
    else { setMessage(`Friend request sent to @${profile.username}.`); setResults(old => old.filter(p => p.id !== profile.id)); await loadCommunity(); }
    setBusyId(null);
  };

  const respond = async (request: CommunityFriendRequest, accept: boolean) => {
    setBusyId(request.id); setError(""); setMessage("");
    const { error: responseError } = await supabase.rpc("respond_to_friend_request", { p_request_id: request.id, p_accept: accept });
    if (responseError) setError(errorText(responseError));
    else { setMessage(accept ? "Friend request accepted." : "Friend request declined."); await loadCommunity(); }
    setBusyId(null);
  };

  const cancelRequest = async (request: CommunityFriendRequest) => {
    if (!userId || request.sender_id !== userId || request.status !== "pending") return;
    setBusyId(request.id); setError(""); setMessage("");
    const { error: cancelError } = await supabase.rpc("cancel_friend_request", { p_request_id: request.id });
    if (cancelError) setError(errorText(cancelError));
    else { setMessage("Friend request cancelled."); await loadCommunity(); }
    setBusyId(null);
  };

  return <div className="page friends-page">
    <div className="page-header"><div><div className="eyebrow">ALPHA COMMUNITY</div><h1>Friends</h1><p>Find people to play AlphaClient with.</p></div><button className="friends-refresh" onClick={() => void loadCommunity()} disabled={loading} title="Refresh">↻ Refresh</button></div>
    {error && <div className="friends-notice error">{error}</div>}
    {message && <div className="friends-notice success">{message}</div>}
    {!userId && !loading && <section className="section-card friends-signin"><div className="friends-empty-icon">♧</div><h2>Sign in to Alpha Community</h2><p>Your Microsoft Minecraft account and Alpha community account are separate. The current developer login is not intended to be the general community login, so sign in to a community account before using friends.</p><button className="friends-primary" onClick={() => setError("Community account sign-in is not connected yet. We need to add a dedicated Alpha community account flow next.")}>Community account required</button></section>}
    {userId && !myProfile && !loading && <section className="section-card"><h2>Community profile not found</h2><p>Your signed-in Supabase account has no Alpha profile yet. Check that the database migration and new-account trigger ran successfully.</p></section>}
    {userId && myProfile && profileSetupRequired && <div className="friends-modal-backdrop"><section className="section-card friends-profile-setup" role="dialog" aria-modal="true" aria-labelledby="friends-profile-title"><div className="friends-empty-icon">✦</div><div className="eyebrow">WELCOME TO ALPHA COMMUNITY</div><h2 id="friends-profile-title">Choose your username</h2><p>Choose a unique username. Other players will use this name to find you and send friend requests.</p><form onSubmit={saveCommunityProfile} className="friends-profile-form"><label htmlFor="friends-username">Username</label><div className="friends-username-field"><span>@</span><input id="friends-username" value={setupUsername} onChange={event => setSetupUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0,20))} minLength={3} maxLength={20} pattern="[a-z0-9_]{3,20}" placeholder="yourname" required autoFocus /></div><small>3–20 characters: lowercase letters, numbers, and underscores.</small>{error && <div className="friends-notice error">{error}</div>}<button className="friends-primary friends-save-profile" type="submit" disabled={savingProfile}>{savingProfile ? "Saving profile…" : "Save and continue"}</button></form></section></div>}
    {userId && myProfile && !profileSetupRequired && <>
      <section className="section-card friends-search-card"><div className="friends-section-heading"><div><h2>Find players</h2><p>Search by Alpha username.</p></div><span className="friends-handle">@{myProfile.username}</span></div><form className="friends-search" onSubmit={event => { event.preventDefault(); void searchUsers(); }}><span className="friends-search-icon">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Enter a username…" maxLength={20}/><button className="friends-primary" type="submit">Search</button></form>
        {results.length > 0 && <div className="friends-user-list">{results.map(person => <div className="friends-user-row" key={person.id}><div className="friends-avatar">{person.username.slice(0,1).toUpperCase()}</div><div className="friends-user-copy"><strong>{person.username}</strong><span>@{person.username}</span></div><span className={`community-rank-badge ${(person.rank_key || (person.is_founder ? "founder" : "member")) === "founder" ? "community-rank-founder" : ""}`}>{(person.rank_key || (person.is_founder ? "founder" : "member")) === "founder" ? "FOUNDER" : (COMMUNITY_RANKS[person.rank_key || "member"]?.label || "Member")}</span><button className="friends-secondary" disabled={busyId === person.id} onClick={() => void sendRequest(person)}>{busyId === person.id ? "Sending…" : "+ Add friend"}</button></div>)}</div>}
      </section>
      <div className="friends-main-layout">
        <div className="friends-columns friends-request-columns">
        <section className="section-card friends-list-card">
          <div className="friends-section-heading"><div><h2>Incoming requests</h2><p>Players who want to add you.</p></div><span className="friends-count">{incoming.length}</span></div>
          {incoming.length === 0 ? <div className="friends-empty">No incoming requests right now.</div> : incoming.map(request => <div className="friends-user-row" key={request.id}><div className="friends-avatar">{(request.profile?.username || "?").slice(0,1).toUpperCase()}</div><div className="friends-user-copy"><strong>{request.profile?.username || "Alpha player"}</strong><span>@{request.profile?.username || "unknown"}</span></div>{request.profile && <span className={`community-rank-badge ${(request.profile.rank_key || (request.profile.is_founder ? "founder" : "member")) === "founder" ? "community-rank-founder" : ""}`}>{(request.profile.rank_key || (request.profile.is_founder ? "founder" : "member")) === "founder" ? "FOUNDER" : (COMMUNITY_RANKS[request.profile.rank_key || "member"]?.label || "Member")}</span>}<button className="friends-primary compact" disabled={busyId === request.id} onClick={() => void respond(request, true)}>{busyId === request.id ? "…" : "Accept"}</button><button className="friends-secondary compact" disabled={busyId === request.id} onClick={() => void respond(request, false)}>Decline</button></div>)}
        </section>
        <section className="section-card friends-list-card">
          <div className="friends-section-heading"><div><h2>Outgoing requests</h2><p>Players you have sent a request to.</p></div><span className="friends-count">{outgoing.length}</span></div>
          {outgoing.length === 0 ? <div className="friends-empty">You haven't sent any pending requests.</div> : outgoing.map(request => <div className="friends-user-row" key={request.id}><div className="friends-avatar">{(request.profile?.username || "?").slice(0,1).toUpperCase()}</div><div className="friends-user-copy"><strong>{request.profile?.is_founder && <span className="profile-founder-badge friends-founder-badge">FOUNDER</span>}{request.profile?.username || "Alpha player"}</strong><span>@{request.profile?.username || "unknown"}</span></div><span className="friends-pending"><i /> Pending</span><button className="friends-secondary compact" type="button" disabled={busyId === request.id} onClick={() => void cancelRequest(request)}>{busyId === request.id ? "Cancelling…" : "Cancel request"}</button></div>)}
        </section>
        <PrivateChatPanel userId={userId} friends={friends} selectedFriendId={selectedChatFriendId} onSelectFriend={setSelectedChatFriendId} />
        </div>
        <section className="section-card friends-list-card friends-roster-card">
          <div className="friends-section-heading"><div><h2>Your friends</h2><p>Players connected to your account.</p></div><span className="friends-count">{friends.length}</span></div>
          {friends.length === 0 ? <div className="friends-empty">Your friends list is empty. Search for a player to get started.</div> : <div className="friends-scroll-list" role="list" aria-label="Your friends">{friends.map(friend => <div className={`friends-user-row friends-roster-clickable${selectedChatFriendId === friend.id ? " is-chat-selected" : ""}`} role="listitem" tabIndex={0} aria-label={`Open private chat with ${friend.username}`} key={friend.id} onClick={() => setSelectedChatFriendId(friend.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedChatFriendId(friend.id); } }}><div className="friends-avatar">{friend.username.slice(0,1).toUpperCase()}</div><div className="friends-user-copy"><strong>{friend.username}</strong><span>@{friend.username}</span></div><span className={`community-rank-badge ${(friend.rank_key || (friend.is_founder ? "founder" : "member")) === "founder" ? "community-rank-founder" : ""}`}>{(friend.rank_key || (friend.is_founder ? "founder" : "member")) === "founder" ? "FOUNDER" : (COMMUNITY_RANKS[friend.rank_key || "member"]?.label || "Member")}</span><span className="friends-connected"><i/> Friend</span></div>)}</div>}
        </section>
      </div>
    </>}
    {loading && <div className="friends-loading">Loading community…</div>}
  </div>;
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
  onCommunity: () => void;
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
    onCommunity,
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
              <div className="hero-brand-mark">
                <AlphaLogo />
              </div>
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
              <div className={`avatar${account ? " avatar-skin" : ""}`}>
                {account ? (
                  <img
                    src={`https://mc-heads.net/avatar/${encodeURIComponent(account.name)}/64`}
                    alt={`${account.name} Minecraft skin`}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  "?"
                )}
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
            <strong>
              {changelogs[0]?.title ?? "View the latest release notes."}
            </strong>
            {changelogs[0] && (
              <span className="card-label">
                {changelogs[0].version} · {changelogs[0].date}
              </span>
            )}
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
              <button type="button" className="text-button" onClick={onNews}>
                View all →
              </button>
            </div>
            <div className="news-list">
              {changelogs.slice(0, 2).map((entry) => (
                <div
                  className="news-item"
                  key={`${entry.product ?? "client"}-${entry.id}`}
                >
                  <div className="news-icon">
                    {entry.product === "launcher" ? "+" : "A"}
                  </div>
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{entry.body}</span>
                  </div>
                  <time>
                    {entry.product === "launcher" ? "Launcher" : "Client"}
                  </time>
                </div>
              ))}
              {changelogs.length === 0 && (
                <p className="subtitle">
                  Er zijn nog geen gepubliceerde changelogs.
                </p>
              )}
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

      <div className="home-community-account-wrap">
        <button
          type="button"
          className="home-community-account-button"
          onClick={onCommunity}
        >
          <span aria-hidden="true">✦</span>
          Make your Alpha Client account
          <span className="home-community-account-arrow" aria-hidden="true">›</span>
        </button>
      </div>
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
    (version) => props.filter === "All" || version.channel === props.filter,
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
            className={`filter ${props.filter === filter ? "active" : ""}`}
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
              <span>Minecraft {version.minecraft} • Forge</span>
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
        {props.isInstalling ? "INSTALLING..." : "INSTALL / REPAIR CLIENT"}
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
              title={mod.enabled ? "Disable preference" : "Enable preference"}
              className={`toggle ${mod.enabled ? "enabled" : ""}`}
              onClick={() => onToggle(mod.name)}
            >
              <span />
            </button>
          </div>
        ))}
      </div>

      <p className="backend-note">
        These switches currently save state only in this React session. They do
        not yet enable or disable the actual Minecraft mod files.
      </p>
    </div>
  );
}

type ManagedCommunityProfile = {
  id: string;
  username: string;
  display_name: string | null;
  rank_key: string;
};

function RankManagement() {
  const [actorId, setActorId] = useState<string | null>(null);
  const [actorRank, setActorRank] = useState<string | null>(null);
  const [members, setMembers] = useState<ManagedCommunityProfile[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedRank, setSelectedRank] = useState("member");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadMembers = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Log in to manage community ranks.");
      setActorId(authData.user.id);

      const { data: actor, error: actorError } = await supabase
        .from("profiles")
        .select("rank_key, is_founder")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (actorError) throw actorError;
      const resolvedRank = actor?.rank_key || (actor?.is_founder ? "founder" : "member");
      setActorRank(resolvedRank);
      if (resolvedRank !== "founder" && resolvedRank !== "owner") {
        setMembers([]);
        return;
      }

      const { data, error: membersError } = await supabase.rpc(
        "search_rank_management_profiles",
        { search_term: search.trim() },
      );
      if (membersError) throw membersError;
      setMembers((data ?? []) as ManagedCommunityProfile[]);
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadMembers(); }, []);

  useEffect(() => {
    if (actorRank !== "founder" && actorRank !== "owner") return;
    const refresh = async () => {
      try {
        const { data, error: queryError } = await supabase.rpc(
          "search_rank_management_profiles",
          { search_term: search.trim() },
        );
        if (queryError) throw queryError;
        setMembers((data ?? []) as ManagedCommunityProfile[]);
      } catch (searchError) {
        setError(errorText(searchError));
      }
    };
    void refresh();
  }, [search, actorRank]);

  const selectedMember = members.find((member) => member.id === selectedId) ?? null;
  const filteredMembers = members;
  const rankEntries = Object.entries(COMMUNITY_RANKS);

  const assignRank = async () => {
    if (!selectedMember) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { error: assignError } = await supabase.rpc("assign_community_rank", {
        target_profile_id: selectedMember.id,
        requested_rank_key: selectedRank,
      });
      if (assignError) throw assignError;
      setMessage(`Updated @${selectedMember.username} to ${COMMUNITY_RANKS[selectedRank]?.label ?? selectedRank}.`);
      await loadMembers();
    } catch (saveError) {
      setError(errorText(saveError));
    } finally {
      setSaving(false);
    }
  };

  const canManageTarget = Boolean(selectedMember) &&
    selectedMember?.id !== actorId &&
    (actorRank === "founder" ||
      (selectedMember?.rank_key !== "owner" &&
        selectedMember?.rank_key !== "founder" &&
        selectedRank !== "founder"));

  return (
    <section className="section-card developer-card">
      <div className="section-header">
        <div>
          <span className="card-label">COMMUNITY ADMINISTRATION</span>
          <h3>Rank Management</h3>
        </div>
        <span className={`developer-status ${actorRank === "founder" || actorRank === "owner" ? "active" : ""}`}>
          {actorRank === "founder" ? "Founder access" : actorRank === "owner" ? "Owner access" : "Restricted"}
        </span>
      </div>
      <p className="subtitle">Search for a community member, review their current rank, and assign a new rank or reset them to Member.</p>
      {loading ? <p className="subtitle">Loading community members…</p> :
        actorRank !== "founder" && actorRank !== "owner" ? (
          <div className="developer-warning">
            <span className="developer-warning-icon">!</span>
            <div><strong>Access denied</strong><p>Only Founder and Owner accounts can manage ranks.</p></div>
          </div>
        ) : (
          <>
            <label className="setting-line developer-setting-line">
              <span>Search member</span>
              <input className="developer-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Username or display name" />
            </label>
            <label className="setting-line developer-setting-line">
              <span>Community member</span>
              <select className="developer-input" value={selectedId} onChange={(event) => {
                setSelectedId(event.target.value);
                const member = members.find((item) => item.id === event.target.value);
                if (member) setSelectedRank(member.rank_key || "member");
              }}>
                <option value="">Select a member…</option>
                {filteredMembers.map((member) => (
                  <option key={member.id} value={member.id}>@{member.username} · {COMMUNITY_RANKS[member.rank_key]?.label ?? member.rank_key}</option>
                ))}
              </select>
            </label>
            {selectedMember && (
              <>
                <div className="developer-info-grid">
                  <div><span>Username</span><strong>@{selectedMember.username}</strong></div>
                  <div><span>Current rank</span><strong style={{ color: COMMUNITY_RANKS[selectedMember.rank_key]?.color ?? "#C3BFE0" }}>{COMMUNITY_RANKS[selectedMember.rank_key]?.label ?? selectedMember.rank_key}</strong></div>
                </div>
                <label className="setting-line developer-setting-line">
                  <span>Assign rank</span>
                  <select className="developer-input" value={selectedRank} onChange={(event) => setSelectedRank(event.target.value)}>
                    {rankEntries.map(([key, rank]) => <option key={key} value={key} disabled={key === "founder" && selectedMember.rank_key !== "founder"}>{rank.label}</option>)}
                  </select>
                </label>
                <div className="developer-actions">
                  <button className="friends-primary rank-save-button" type="button" disabled={saving || !canManageTarget || selectedRank === selectedMember.rank_key} onClick={() => void assignRank()}>
                    {saving ? "Saving…" : "Save rank"}
                  </button>
                  <button className="friends-secondary" type="button" disabled={saving || !canManageTarget || selectedMember.rank_key === "member"} onClick={() => { setSelectedRank("member"); void (async () => {
                    setSaving(true); setError(""); setMessage("");
                    try {
                      const { error: assignError } = await supabase.rpc("assign_community_rank", { target_profile_id: selectedMember.id, requested_rank_key: "member" });
                      if (assignError) throw assignError;
                      setMessage(`Reset @${selectedMember.username} to Member.`);
                      await loadMembers();
                    } catch (saveError) { setError(errorText(saveError)); }
                    finally { setSaving(false); }
                  })(); }}>Reset to Member</button>
                </div>
                {!canManageTarget && <p className="subtitle" role="status">
                  {saving ? "Saving rank…" :
                    selectedMember.id === actorId ? "You cannot change your own rank." :
                    actorRank === "owner" && (selectedMember.rank_key === "owner" || selectedMember.rank_key === "founder") ? "Owners cannot change Founder or Owner accounts." :
                    actorRank === "owner" && selectedRank === "founder" ? "Only the protected Founder account can grant Founder access; Founder cannot be assigned here." :
                    "This rank change is not permitted."}
                </p>}
                {canManageTarget && selectedRank === selectedMember.rank_key && <p className="subtitle">Choose a different rank to enable Save rank.</p>}
              </>
            )}
          </>
        )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
    </section>
  );
}

type AuditLogRow = {
  id: number;
  occurred_at: string;
  actor_label: string | null;
  product: "launcher" | "client" | "system";
  category: string;
  action: string;
  target_label: string | null;
  outcome: "success" | "failure" | "denied";
  details: Record<string, unknown> | null;
  request_id: string | null;
};

function AuditTimeline() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("audit_logs")
        .select("id, occurred_at, actor_label, product, category, action, target_label, outcome, details, request_id")
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (queryError) throw queryError;
      setRows((data ?? []) as AuditLogRow[]);
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const filteredRows = rows.filter((row) => {
    if (productFilter !== "all" && row.product !== productFilter) return false;
    if (outcomeFilter !== "all" && row.outcome !== outcomeFilter) return false;
    const haystack = [row.actor_label, row.product, row.category, row.action, row.target_label, row.outcome, row.request_id]
      .filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <section className="section-card developer-card audit-timeline">
      <div className="section-header audit-heading">
        <div>
          <span className="card-label">SECURITY &amp; ACTIVITY</span>
          <h3>Audit Timeline</h3>
          <p>Chronological record of developer actions performed.</p>
        </div>
        <button type="button" className="small-button" onClick={() => void loadLogs()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="audit-filters">
        <label>Product
          <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
            <option value="all">Alle producten</option>
            <option value="launcher">Launcher</option>
            <option value="client">Client</option>
            <option value="system">Systeem</option>
          </select>
        </label>
        <label>Resultaat
          <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)}>
            <option value="all">Alle resultaten</option>
            <option value="success">Success</option>
            <option value="failure">Failed</option>
            <option value="denied">Denied</option>
          </select>
        </label>
        <label className="audit-search-label">Search
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Action, user, target…" />
        </label>
      </div>

      {error && <div className="audit-state audit-error" role="alert">
        <strong>Could not load audit log</strong>
        <p>{error}</p>
        <small>Check your developer permissions, the audit_logs RLS policy, and the Supabase connection.</small>
      </div>}
      {!error && loading && <div className="audit-state">Loading audit logs…</div>}
      {!error && !loading && filteredRows.length === 0 && <div className="audit-state">No audit entries match these filters.</div>}
      {!error && !loading && filteredRows.length > 0 && (
        <div className="audit-list">
          {filteredRows.map((row) => (
            <article className="audit-row" key={row.id}>
              <span className={`audit-outcome audit-outcome-${row.outcome}`}>{row.outcome === "success" ? "SUCCESS" : row.outcome === "failure" ? "FAILED" : "DENIED"}</span>
              <div className="audit-row-main">
                <div className="audit-row-title">
                  <strong>{({
                    "changelog.create": "Create",
                    "changelog.update": "Edit",
                    "changelog.publish": "Publish",
                    "changelog.unpublish": "Unpublish",
                    "changelog.delete": "Delete",
                  } as Record<string, string>)[row.action] ?? row.action.replaceAll("_", " ")}</strong>
                  <span className="audit-product">{row.product}</span>
                </div>
                <p>{row.category}{row.target_label ? ` · Doel: ${row.target_label}` : ""}</p>
                <small>{row.actor_label || "Onbekende actor"} · {new Date(row.occurred_at).toLocaleString()}</small>
                {row.details && Object.keys(row.details).length > 0 && (
                  <details className="audit-details">
                    <summary>View details</summary>
                    <pre>{JSON.stringify(row.details, null, 2)}</pre>
                    {row.request_id && <small>Request ID: {row.request_id}</small>}
                  </details>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="audit-footer">Showing up to 200 most recent entries · {filteredRows.length} weergegeven</div>
    </section>
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

const developerTools: {
  name: DeveloperTool;
  description: string;
  icon: string;
}[] = [
  {
    name: "Rank Management",
    description: "Manage Alpha ranks and rank assignments.",
    icon: "◆",
  },
  {
    name: "Permission Explorer",
    description: "Explore permissions and access rules.",
    icon: "◇",
  },
  {
    name: "Audit Timeline",
    description: "Review a chronological history of actions.",
    icon: "◷",
  },
  {
    name: "Change Review",
    description: "Review proposed changes before applying them.",
    icon: "⇄",
  },
  {
    name: "Development Sandbox",
    description: "Run local tests and inspect build information.",
    icon: "⌘",
  },
  {
    name: "Feature Rollout Manager",
    description: "Plan staged feature releases and rollouts.",
    icon: "◉",
  },
  {
    name: "Release Manager",
    description: "Prepare releases and publish changelogs.",
    icon: "↑",
  },
];

function DeveloperPage({
  offlineMode,
  setOfflineMode,
  testUsername,
  setTestUsername,
  isStartingOfflineTest,
  onStartTest,
  changelogs,
  developerEmail,
  setDeveloperEmail,
  developerPassword,
  setDeveloperPassword,
  developerUserEmail,
  developerAuthorized,
  developerAuthLoading,
  developerAuthError,
  developerSigningIn,
  onDeveloperLogin,
  onDeveloperLogout,
  onSaveChangelog,
  onDeleteChangelog,
  onTogglePublish,
  changelogBusy,
  changelogMessage,
}: {
  offlineMode: boolean;
  setOfflineMode: (enabled: boolean) => void;
  testUsername: string;
  setTestUsername: (username: string) => void;
  isStartingOfflineTest: boolean;
  onStartTest: () => void;
  changelogs: ChangelogEntry[];
  developerEmail: string;
  setDeveloperEmail: (value: string) => void;
  developerPassword: string;
  setDeveloperPassword: (value: string) => void;
  developerUserEmail: string | null;
  developerAuthorized: boolean;
  developerAuthLoading: boolean;
  developerAuthError: string;
  developerSigningIn: boolean;
  onDeveloperLogin: () => void;
  onDeveloperLogout: () => void;
  onSaveChangelog: (draft: ChangelogDraft) => Promise<void>;
  onDeleteChangelog: (id: number) => void;
  onTogglePublish: (entry: ChangelogEntry) => void;
  changelogBusy: boolean;
  changelogMessage: string;
}) {
  const [activeTool, setActiveTool] = useState<DeveloperTool | null>(null);
  const [draftVersion, setDraftVersion] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftProduct, setDraftProduct] =
    useState<ChangelogProduct>("client");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [changelogError, setChangelogError] = useState("");

  const resetChangelogDraft = () => {
    setDraftVersion("");
    setDraftTitle("");
    setDraftBody("");
    setDraftProduct("client");
    setEditingId(null);
    setChangelogError("");
  };

  const saveChangelog = async () => {
    const version = draftVersion.trim();
    const title = draftTitle.trim();
    const body = draftBody.trim();

    if (!version || !title || !body) {
      setChangelogError("Enter a version, title, and change description.");
      return;
    }

    setChangelogError("");

    try {
      await onSaveChangelog({
        id: editingId ?? undefined,
        version,
        title,
        body,
        product: draftProduct,
      });
      resetChangelogDraft();
    } catch (error) {
      setChangelogError(errorText(error));
    }
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
          <p>
            This menu item is a placeholder for now. It does not change ranks,
            permissions, or live client data yet.
          </p>
        </div>
      </div>

      {tool === "Rank Management" && (
        <div className="developer-info-grid">
          {["Owner", "Developer", "Staff", "Tester", "User"].map((rank) => (
            <div key={rank}>
              <span>Example rank</span>
              <strong>{rank}</strong>
            </div>
          ))}
        </div>
      )}

      {tool === "Permission Explorer" && <RankPermissionsManager />}

      {tool === "Feature Rollout Manager" && (
        <div className="developer-info-grid">
          <div>
            <span>Rollout strategy</span>
            <strong>Staged rollout</strong>
          </div>
          <div>
            <span>Targeting</span>
            <strong>Rank / user group</strong>
          </div>
          <div>
            <span>Safety</span>
            <strong>Preview before publish</strong>
          </div>
        </div>
      )}
    </section>
  );

  if (developerAuthLoading) {
    return (
      <div className="page developer-page">
        <PageTitle
          eyebrow="DEVELOPMENT"
          title="Developer Center"
          description="Beveiligde toegang tot developer tools en releasebeheer."
        />
        <section className="section-card developer-card">
          <p className="subtitle">Supabase-sessie en developerrechten controleren…</p>
        </section>
      </div>
    );
  }

  if (!developerAuthorized) {
    return (
      <div className="page developer-page">
        <PageTitle
          eyebrow="DEVELOPMENT"
          title="Developer Login"
          description="Sign in with your developer account to access developer tools."
        />

        <section className="section-card developer-card">
          <div className="section-header">
            <div>
              <span className="card-label">SECURE ACCESS</span>
              <h3>Supabase authentication</h3>
            </div>
            <span className="developer-status">Restricted</span>
          </div>

          {developerUserEmail && (
            <p className="subtitle">
              Ingelogd als {developerUserEmail}, maar dit account heeft geen
              bevestigde developerrechten.
            </p>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onDeveloperLogin();
            }}
          >
            <label className="developer-input-label" htmlFor="developer-email">
              E-mailadres
            </label>
            <input
              id="developer-email"
              className="developer-text-input"
              type="email"
              autoComplete="username"
              value={developerEmail}
              onChange={(event) => setDeveloperEmail(event.target.value)}
              placeholder="developer@example.com"
              required
            />

            <label
              className="developer-input-label"
              htmlFor="developer-password"
            >
              Wachtwoord
            </label>
            <input
              id="developer-password"
              className="developer-text-input"
              type="password"
              autoComplete="current-password"
              value={developerPassword}
              onChange={(event) => setDeveloperPassword(event.target.value)}
              placeholder="Your Supabase account password"
              required
            />

            {developerAuthError && (
              <p className="launch-error" role="alert">
                {developerAuthError}
              </p>
            )}

            <button
              type="submit"
              className="large-play-button developer-start-button"
              disabled={developerSigningIn}
            >
              {developerSigningIn ? "SIGNING IN..." : "LOGIN TO DEVELOPER CENTER"}
            </button>
          </form>

          {developerUserEmail && (
            <button
              type="button"
              className="secondary-button"
              onClick={onDeveloperLogout}
            >
              LOG OUT
            </button>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="page developer-page">
      <PageTitle
        eyebrow="DEVELOPMENT"
        title="Developer Center"
        description="A central hub for Alpha Client development, management, and releases."
      />

      <div className="developer-warning">
        <span className="developer-warning-icon">!</span>
        <div>
          <strong>Developer access verified</strong>
          <p>
            Signed in as {developerUserEmail}. Developer permissions have been
            verified through Supabase. Changelog changes are stored in the
            database.
          </p>
        </div>
        <button
          type="button"
          className="small-button"
          onClick={onDeveloperLogout}
        >
          Log out
        </button>
      </div>

      {activeTool === null ? (
        <section className="developer-dashboard" aria-label="Developer modules">
          <div className="developer-dashboard-heading">
            <span className="card-label">DEVELOPER WORKSPACE</span>
            <h2>What would you like to work on?</h2>
            <p>
              Select a module to open. You will not be taken directly into a tool
              terecht.
            </p>
          </div>

          <div className="developer-dashboard-grid">
            {developerTools.map((tool) => (
              <button
                type="button"
                key={tool.name}
                className="developer-dashboard-card"
                onClick={() => setActiveTool(tool.name)}
              >
                <span className="developer-tool-icon" aria-hidden="true">
                  {tool.icon}
                </span>
                <span className="developer-dashboard-card-copy">
                  <strong>{tool.name}</strong>
                  <small>{tool.description}</small>
                </span>
                <span className="developer-tool-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="developer-tool-layout">
          <nav className="developer-tool-nav" aria-label="Developer menu">
            <button
              type="button"
              className="developer-tool-nav-item"
              onClick={() => setActiveTool(null)}
            >
              <span className="developer-tool-icon" aria-hidden="true">
                ←
              </span>
              <span className="developer-tool-nav-copy">
                <strong>Developer Dashboard</strong>
                <small>Back to all modules</small>
              </span>
            </button>

            <span className="card-label">DEVELOPER MENU</span>

            {developerTools.map((tool) => (
              <button
                type="button"
                key={tool.name}
                className={`developer-tool-nav-item ${activeTool === tool.name ? "active" : ""}`}
                onClick={() => setActiveTool(tool.name)}
                aria-current={activeTool === tool.name ? "page" : undefined}
              >
                <span className="developer-tool-icon" aria-hidden="true">
                  {tool.icon}
                </span>
                <span className="developer-tool-nav-copy">
                  <strong>{tool.name}</strong>
                  <small>{tool.description}</small>
                </span>
                <span className="developer-tool-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </nav>

          <div className="developer-tool-content">
            {activeTool === "Rank Management" && <RankManagement />}

            {activeTool === "Permission Explorer" &&
              renderPlaceholder(
                "Permission Explorer",
                "Explore available actions, which ranks receive them, and where each permission is used.",
              )}

            {activeTool === "Audit Timeline" && <AuditTimeline />}

            {activeTool === "Change Review" &&
              renderPlaceholder(
                "Change Review",
                "Review proposed changes and approve them before they are applied.",
              )}

            {activeTool === "Development Sandbox" && (
              <>
                <section className="section-card developer-card">
                  <div className="section-header">
                    <div>
                      <span className="card-label">TEST ENVIRONMENT</span>
                      <h3>Offline / Test Mode</h3>
                    </div>
                    <span
                      className={`developer-status ${offlineMode ? "active" : ""}`}
                    >
                      {offlineMode ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  <label className="setting-line developer-setting-line">
                    <span>
                      <strong>Enable offline test mode</strong>
                      <small>For local development testing only.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={offlineMode}
                      onChange={(event) =>
                        setOfflineMode(event.target.checked)
                      }
                    />
                  </label>

                  <label
                    className="developer-input-label"
                    htmlFor="developer-username"
                  >
                    Test username
                  </label>
                  <input
                    id="developer-username"
                    className="developer-text-input"
                    type="text"
                    value={testUsername}
                    maxLength={16}
                    onChange={(event) =>
                      setTestUsername(
                        event.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                      )
                    }
                    placeholder="TestPlayer"
                  />

                  <button
                    type="button"
                    className="large-play-button developer-start-button"
                    disabled={
                      !offlineMode ||
                      !testUsername.trim() ||
                      isStartingOfflineTest
                    }
                    onClick={onStartTest}
                  >
                    {isStartingOfflineTest
                      ? "STARTING OFFLINE TEST..."
                      : "▶ START OFFLINE TEST"}
                  </button>
                </section>

                <section className="section-card developer-card">
                  <div className="section-header">
                    <div>
                      <span className="card-label">BUILD INFORMATION</span>
                      <h3>Current profile</h3>
                    </div>
                  </div>
                  <div className="developer-info-grid">
                    <div>
                      <span>AlphaClient</span>
                      <strong>Live version from launcher</strong>
                    </div>
                    <div>
                      <span>Minecraft</span>
                      <strong>1.8.9</strong>
                    </div>
                    <div>
                      <span>Forge</span>
                      <strong>11.15.1.2318</strong>
                    </div>
                    <div>
                      <span>Backend status</span>
                      <strong>Supabase connected</strong>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTool === "Feature Rollout Manager" &&
              renderPlaceholder(
                "Feature Rollout Manager",
                "Plan feature flags, target groups and staged rollouts. Publishing and remote targeting are not connected yet.",
              )}

            {activeTool === "Release Manager" && (
              <section className="section-card developer-card changelog-editor">
                <div className="section-header">
                  <div>
                    <span className="card-label">HOME PAGE CONTENT</span>
                    <h3>Changelogs</h3>
                  </div>
                  <span className="developer-status active">
                    {changelogs.length} loaded
                  </span>
                </div>

                <p className="subtitle">
                  Drafts are saved in Supabase as unpublished entries. Published changelogs appear in the launcher for all users.
                </p>

                <label
                  className="developer-input-label"
                  htmlFor="changelog-product"
                >
                  Product
                </label>
                <select
                  id="changelog-product"
                  className="developer-text-input"
                  value={draftProduct}
                  onChange={(event) =>
                    setDraftProduct(event.target.value as ChangelogProduct)
                  }
                >
                  <option value="client">Alpha Client</option>
                  <option value="launcher">Alpha Launcher</option>
                </select>

                <label
                  className="developer-input-label"
                  htmlFor="changelog-version"
                >
                  Versie
                </label>
                <input
                  id="changelog-version"
                  className="developer-text-input"
                  value={draftVersion}
                  onChange={(event) => setDraftVersion(event.target.value)}
                  placeholder="0.3.80"
                />

                <label
                  className="developer-input-label"
                  htmlFor="changelog-title"
                >
                  Titel
                </label>
                <input
                  id="changelog-title"
                  className="developer-text-input"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="Combat improvements"
                />

                <label
                  className="developer-input-label"
                  htmlFor="changelog-body"
                >
                  Changes
                </label>
                <textarea
                  id="changelog-body"
                  className="developer-text-input"
                  rows={5}
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  placeholder={
                    "Added — Nieuwe functies\nFixed — Bugs opgelost\nImproved — Verbeteringen"
                  }
                />

                {changelogError && (
                  <p className="launch-error" role="alert">
                    {changelogError}
                  </p>
                )}
                {changelogMessage && (
                  <p
                    className={
                      changelogMessage.toLowerCase().includes("mislukt") ||
                      changelogMessage.toLowerCase().includes("geen toestemming")
                        ? "launch-error"
                        : "launch-success"
                    }
                    role="status"
                  >
                    {changelogMessage}
                  </p>
                )}

                <div className="developer-changelog-actions">
                  <button
                    type="button"
                    className="large-play-button developer-start-button"
                    onClick={() => void saveChangelog()}
                    disabled={changelogBusy}
                  >
                    {changelogBusy
                      ? "SAVING..."
                      : editingId === null
                        ? "SAVE DRAFT TO SUPABASE"
                        : "UPDATE CHANGELOG"}
                  </button>

                  {editingId !== null && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={resetChangelogDraft}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>

                <div className="news-list">
                  {changelogs.length === 0 ? (
                    <p className="subtitle">
                      No changelogs yet. Create your first one above.
                    </p>
                  ) : (
                    changelogs.map((entry) => (
                      <div className="news-item" key={entry.id}>
                        <div className="news-icon">
                          {entry.product === "launcher" ? "+" : "A"}
                        </div>

                        <div>
                          <strong>
                            {entry.version} · {entry.title}
                          </strong>
                          <span>{entry.body}</span>
                          <time>
                            {entry.product === "launcher"
                              ? "Alpha Launcher"
                              : "Alpha Client"}{" "}
                            · {entry.date}
                          </time>
                          <span>
                            Status: {entry.published ? "Published" : "Draft"}
                          </span>
                        </div>

                        <div className="developer-changelog-actions">
                          <button
                            type="button"
                            className="small-button"
                            disabled={changelogBusy}
                            onClick={() => {
                              setEditingId(entry.id);
                              setDraftVersion(entry.version);
                              setDraftTitle(entry.title);
                              setDraftBody(entry.body);
                              setDraftProduct(entry.product ?? "client");
                              setChangelogError("");
                            }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="small-button"
                            disabled={changelogBusy}
                            onClick={() => onTogglePublish(entry)}
                          >
                            {entry.published ? "Unpublish" : "Publish"}
                          </button>

                          <button
                            type="button"
                            className="small-button"
                            disabled={changelogBusy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to delete "${entry.title}"?`,
                                )
                              ) {
                                onDeleteChangelog(entry.id);
                                if (editingId === entry.id) resetChangelogDraft();
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
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
        eyebrow="MINECRAFT ACCOUNT"
        title="Your account"
        description="Manage the Microsoft account used by AlphaClient."
      />

      <div className="account-large-card">
        <div className={`large-avatar${account ? " avatar-skin" : ""}`}>
          {account ? (
            <img
              src={`https://mc-heads.net/avatar/${encodeURIComponent(account.name)}/128`}
              alt={`${account.name} Minecraft skin`}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            "M"
          )}
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
  const isSplash =
    new URLSearchParams(window.location.search).get("splash") === "1";

  return isSplash ? <StartupSplash /> : <LauncherApp />;
}

export default App;