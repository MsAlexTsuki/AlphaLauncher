import { useEffect, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "./lib/supabase";
import PrivateChatPanel from "./PrivateChatPanel";
import InboxButton from "./InboxButton";
import RankPermissionsManager from "./RankPermissionsManager";
import ClientModPermissionsManager from "./ClientModPermissionsManager";
import "./App.css";

type Page =
  | "Home"
  | "Play"
  | "Versions"
  | "Mods"
  | "Community"
  | "Friends"
  | "Developer"
  | "Chats"
  | "Settings"
  | "Account";

type MicrosoftAccount = { name: string; email: string; uuid?: string };
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

// Treat an update as available only when the release is newer than the
// installed version. The initial backend check can race the installed-version
// lookup and briefly report UNKNOWN even when a valid client is installed.
function isClientUpdateAvailable(latestVersion: string, installedVersion: string): boolean {
  const latest = latestVersion.trim().replace(/^v/i, "");
  const installed = installedVersion.trim().replace(/^v/i, "");

  if (!latest || latest === "UNKNOWN") return false;
  if (!installed || installed === "UNKNOWN") return false;
  if (installed === "Niet geïnstalleerd") return true;

  const latestParts = latest.split(".").map((part) => Number.parseInt(part, 10));
  const installedParts = installed.split(".").map((part) => Number.parseInt(part, 10));
  if (
    latestParts.some((part) => !Number.isFinite(part)) ||
    installedParts.some((part) => !Number.isFinite(part))
  ) {
    return latest !== installed;
  }

  const length = Math.max(latestParts.length, installedParts.length);
  for (let index = 0; index < length; index += 1) {
    const next = latestParts[index] ?? 0;
    const current = installedParts[index] ?? 0;
    if (next !== current) return next > current;
  }
  return false;
}

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

const SAVED_MICROSOFT_ACCOUNTS_KEY = "alphaclient.microsoftAccounts";
const MAX_SAVED_MICROSOFT_ACCOUNTS = 5;

function readSavedMicrosoftAccounts(): MicrosoftAccount[] {
  try {
    const saved = localStorage.getItem(SAVED_MICROSOFT_ACCOUNTS_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is MicrosoftAccount =>
        entry !== null && typeof entry === "object" &&
        typeof (entry as MicrosoftAccount).name === "string" &&
        typeof (entry as MicrosoftAccount).email === "string" &&
        ((entry as MicrosoftAccount).uuid === undefined ||
          (typeof (entry as MicrosoftAccount).uuid === "string" && (entry as MicrosoftAccount).uuid.trim().length > 0))
      )
      .filter((entry, index, accounts) => accounts.findIndex((candidate) => candidate.email.toLowerCase() === entry.email.toLowerCase()) === index)
      .slice(0, MAX_SAVED_MICROSOFT_ACCOUNTS);
  } catch {
    return [];
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
  // Advertise this signed-in Alpha Account as online for the lifetime of the launcher.
  useEffect(() => {
    let disposed = false;
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;

    const connectPresence = async (userId: string | null) => {
      if (presenceChannel) {
        const oldChannel = presenceChannel;
        presenceChannel = null;
        await supabase.removeChannel(oldChannel);
      }
      if (disposed || !userId) return;

      const channel = supabase.channel("alphaclient-presence", {
        config: { presence: { key: userId } },
      });
      presenceChannel = channel;

      // Keep all presence listeners on the one channel before it is subscribed.
      const publishPresence = () => {
        const state = channel.presenceState() as Record<string, Array<{ user_id?: string }>>;
        const onlineIds = new Set<string>();
        for (const [key, entries] of Object.entries(state)) {
          if (entries.length > 0) onlineIds.add(entries[0]?.user_id || key);
        }
        window.dispatchEvent(new CustomEvent("alphaclient-presence-update", {
          detail: Array.from(onlineIds),
        }));
      };

      channel
        .on("presence", { event: "sync" }, publishPresence)
        .on("presence", { event: "join" }, publishPresence)
        .on("presence", { event: "leave" }, publishPresence)
        .subscribe((status) => {
          if (status === "SUBSCRIBED" && !disposed) {
            void channel.track({ user_id: userId, online_at: new Date().toISOString() });
            publishPresence();
          }
        });
    };

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!error && !disposed) void connectPresence(data.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void connectPresence(session?.user?.id ?? null);
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
      if (presenceChannel) void supabase.removeChannel(presenceChannel);
    };
  }, []);
  const [page, setPage] = useState<Page>("Home");
  const [chatTargetFriendId, setChatTargetFriendId] = useState<string | null>(null);
  const [communityLoginRequested, setCommunityLoginRequested] = useState(false);
  const [alphaAuthModalOpen, setAlphaAuthModalOpen] = useState(false);
  const [openProfileEditor, setOpenProfileEditor] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isStartingOfflineTest, setIsStartingOfflineTest] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [launchHistory, setLaunchHistory] = useState<LastPlayed[]>(readLastPlayed);
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);

  const [account, setAccount] = useState<MicrosoftAccount | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<MicrosoftAccount[]>(readSavedMicrosoftAccounts);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isMinecraftRunning, setIsMinecraftRunning] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [isInstalling, setIsInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalContent>(null);
  const [activeChangelogTab, setActiveChangelogTab] =
    useState<ChangelogProduct>("client");
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [mods, setMods] = useState<ModItem[]>(INITIAL_MODS);
  const [versionFilter, setVersionFilter] = useState("All");
  const [selectedVersion, setSelectedVersion] = useState("UNKNOWN");
  const [clientVersion, setClientVersion] = useState("UNKNOWN");
  const [updateInfo, setUpdateInfo] =
    useState<AlphaClientUpdateInfo | null>(null);
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);
  const [clientDirectory, setClientDirectory] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const refreshMinecraftStatus = async () => {
      try {
        const running = await invoke<boolean>("get_minecraft_process_status");
        if (!disposed) setIsMinecraftRunning(running);
      } catch (error) {
        console.warn("Could not check Minecraft process status:", error);
      }
    };

    void refreshMinecraftStatus();
    const interval = window.setInterval(() => {
      void refreshMinecraftStatus();
    }, 1000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

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
  const [canManageReleases, setCanManageReleases] = useState(false);
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
      .then((restoredAccount) => {
        setAccount(restoredAccount);
        if (restoredAccount) {
          setSavedAccounts((current) => [restoredAccount, ...current.filter((saved) => saved.uuid !== restoredAccount.uuid && saved.email.toLowerCase() !== restoredAccount.email.toLowerCase())].slice(0, MAX_SAVED_MICROSOFT_ACCOUNTS));
        }
      })
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
      .catch((error) => {
        console.warn("Could not read AlphaClient version:", error);
        setClientVersion("UNKNOWN");
        setSelectedVersion("UNKNOWN");
      });

    invoke<AlphaClientUpdateInfo>("check_alphaclient_update")
      .then(setUpdateInfo)
      .catch((error) =>
        console.warn("Could not check AlphaClient updates:", error),
      );
  }, []);

  useEffect(() => {
    setUpdateInfo((current) =>
      current
        ? {
            ...current,
            current_version: clientVersion,
            update_available: isClientUpdateAvailable(
              current.latest_version,
              clientVersion,
            ),
          }
        : current,
    );
  }, [clientVersion, updateInfo?.latest_version, updateInfo?.update_available]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_MICROSOFT_ACCOUNTS_KEY, JSON.stringify(savedAccounts));
    } catch (error) {
      console.warn("Could not save Microsoft account list:", error);
    }
  }, [savedAccounts]);

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
      setCanManageReleases(false);

      if (!user) {
        setDeveloperAuthLoading(false);
        return;
      }

      try {
        const [
          { data: developerToolsPermission, error: developerToolsError },
          { data: releasePermission, error: releasePermissionError },
        ] = await Promise.all([
          supabase.rpc("has_rank_permission", { p_scope: "launcher", p_permission_key: "developer.tools" }),
          supabase.rpc("has_rank_permission", { p_scope: "launcher", p_permission_key: "releases.manage" }),
        ]);

        if (cancelled) return;

        if (developerToolsError || releasePermissionError) {
         const errorMessage =
  developerToolsError?.message ??
  releasePermissionError?.message ??
  "Unknown permission-check error.";

console.error("Developer permission check failed:", errorMessage);
          setDeveloperAuthError(
            "Developer permissions could not be verified. Check that the Supabase function has_rank_permission exists and is configured correctly.",
          );
          setDeveloperAuthorized(false);
          setCanManageReleases(false);
        } else {
          const hasDeveloperTools = developerToolsPermission === true;
          const hasReleasePermission = releasePermission === true;
          setDeveloperAuthorized(hasDeveloperTools);
          setCanManageReleases(hasReleasePermission);
          setDeveloperAuthError(
            hasDeveloperTools || hasReleasePermission
              ? ""
              : "This account does not have the launcher permission 'developer.tools' or 'releases.manage'.",
          );
        }
      } catch (error) {
        if (cancelled) return;
        setDeveloperAuthorized(false);
        setCanManageReleases(false);
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

  useEffect(() => {
    if (!developerAuthLoading && !developerAuthorized && !canManageReleases && page === "Developer") {
      setPage("Home");
    }
  }, [developerAuthLoading, developerAuthorized, canManageReleases, page]);

  // Public users only receive published entries. Verified developers receive drafts too.
  useEffect(() => {
    let cancelled = false;

    const loadChangelogs = async () => {
      let query = supabase
        .from("changelogs")
        .select("id, version, title, body, created_at, product, published");

      if (!developerAuthorized && !canManageReleases) {
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
  }, [developerAuthorized, canManageReleases]);

  const refreshChangelogs = async () => {
    let query = supabase
      .from("changelogs")
      .select("id, version, title, body, created_at, product, published");

    if (!developerAuthorized && !canManageReleases) {
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
      setDeveloperAuthError("Enter your email address and password.");
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
    if (!developerAuthorized && !canManageReleases) {
      const message = "You are not authorized to edit changelogs. Make sure you have the launcher permission 'releases.manage'.";
      setChangelogMessage(message);
      throw new Error(message);
    }

    const version = draft.version.trim();
    const title = draft.title.trim();
    const body = draft.body.trim();

    if (!version || !title || !body) {
      setChangelogMessage("Enter a version, title, and changes.");
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
          ? "Changelog updated and recorded in the audit log."
          : "Draft saved and recorded in the audit log.",
      );
      await refreshChangelogs();
    } catch (error) {
      setChangelogMessage(`Save failed: ${errorText(error)}`);
      throw error;
    } finally {
      setChangelogBusy(false);
    }
  };

  const handleDeleteChangelog = async (id: number) => {
    if (!developerAuthorized && !canManageReleases) {
      setChangelogMessage("You are not authorized to delete changelogs.");
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
      setChangelogMessage("Changelog deleted and recorded in the audit log.");
    } catch (error) {
      setChangelogMessage(`Delete failed: ${errorText(error)}`);
    } finally {
      setChangelogBusy(false);
    }
  };

  const handleTogglePublish = async (entry: ChangelogEntry) => {
    if (!developerAuthorized && !canManageReleases) {
      setChangelogMessage("You are not authorized to publish changelogs.");
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
          ? "Changelog unpublished and the action was logged."
          : "Changelog published and the action was logged. It is now visible to users.",
      );
    } catch (error) {
      setChangelogMessage(`Publishing failed: ${errorText(error)}`);
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

  const handlePlay = async (partnerServer = false) => {
    if (isLaunching || isUpdatingClient) return;
    if (isMinecraftRunning) {
      setLaunchError(
        partnerServer
          ? "Minecraft is already running. Close it before joining the partner server."
          : "Minecraft is already running. Close it before launching or updating AlphaClient.",
      );
      return;
    }

    setIsLaunching(true);
    setLaunchError(null);
    setLaunchMessage(
      partnerServer ? "Starting AlphaClient…" : null,
    );

    try {
      try {
        const checked = await invoke<AlphaClientUpdateInfo>(
          "check_alphaclient_update",
        );
        const installedVersion = await invoke<string>("get_alphaclient_version");
        const reconciledCheck = {
          ...checked,
          current_version: installedVersion,
          update_available: isClientUpdateAvailable(
            checked.latest_version,
            installedVersion,
          ),
        };
        setClientVersion(installedVersion);
        setSelectedVersion(installedVersion);
        setUpdateInfo(reconciledCheck);

        if (reconciledCheck.update_available) {
          setIsUpdatingClient(true);
          const updateMessage = await invoke<string>("update_alphaclient");
          setClientVersion(checked.latest_version);
          setSelectedVersion(checked.latest_version);
          setUpdateInfo({
            ...reconciledCheck,
            current_version: checked.latest_version,
            update_available: false,
          });
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

      const message = await invoke<string>(
        partnerServer ? "launch_partner_server" : "launch_alphaclient",
      );
      const launchedVersion = updateInfo?.update_available
        ? updateInfo.latest_version
        : clientVersion;
      recordLaunch(launchedVersion);

      // Sync Last played separately so a database setup issue never blocks launching.
      void (async () => {
        try {
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (authError) throw authError;
          if (!authData.user) return;
          const { error: activityError } = await supabase
            .from("profile_activity")
            .upsert({
              user_id: authData.user.id,
              last_played_at: new Date().toISOString(),
              last_played_version: launchedVersion,
            }, { onConflict: "user_id" });
          if (activityError) throw activityError;
        } catch (activityError) {
          console.warn("Could not sync Last played to Supabase:", activityError);
        }
      })();

      setLaunchMessage(message || "AlphaClient is starting.");
    } catch (error) {
      setIsUpdatingClient(false);
      setLaunchError(errorText(error));
    } finally {
      setIsLaunching(false);
    }
  };

  const handleUpdateClient = async () => {
    if (isUpdatingClient || isLaunching || isMinecraftRunning) {
      if (isMinecraftRunning) {
        setLaunchError("Close Minecraft before updating AlphaClient.");
      }
      return;
    }

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
    if (isInstalling || isMinecraftRunning) {
      if (isMinecraftRunning) {
        setLaunchError("Close Minecraft before installing or repairing AlphaClient.");
      }
      return;
    }

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

  const handleMicrosoftLogin = async (accountToSwitch?: MicrosoftAccount) => {
    if (isLoggingIn || isMinecraftRunning) return;

    if (!accountToSwitch && savedAccounts.length >= MAX_SAVED_MICROSOFT_ACCOUNTS) {
      setLoginError("You can save up to 5 Minecraft accounts. Select a saved account to switch, or remove one before adding another.");
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const result = await invoke<MicrosoftAccount>("start_microsoft_login", {
        loginHint: accountToSwitch?.email ?? null,
      });
      setAccount(result);
      setSavedAccounts((current) => [result, ...current.filter((saved) => saved.uuid !== result.uuid && saved.email.toLowerCase() !== result.email.toLowerCase())].slice(0, MAX_SAVED_MICROSOFT_ACCOUNTS));
    } catch (error) {
      setLoginError(errorText(error));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleMicrosoftLogout = async () => {
    if (isMinecraftRunning) {
      setLoginError("Je kunt niet uitloggen zolang Minecraft actief is. Sluit Minecraft eerst af.");
      return;
    }

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

  const handleNavigation = async (next: Page) => {
    if (next === "Friends") {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          navigate("Friends");
          setAlphaAuthModalOpen(true);
          return;
        }
      } catch {
        navigate("Friends");
        setAlphaAuthModalOpen(true);
        return;
      }
    }
    navigate(next);
  };

  const handleOpenAlphaAuth = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return;
    } catch {
      // If the session cannot be checked, keep the login option available.
    }
    setAlphaAuthModalOpen(true);
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
    { name: "Chats", icon: "✉" },
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

        <div className="titlebar-actions" data-tauri-drag-region="false">
          <InboxButton onOpenFriends={() => void handleNavigation("Friends")} onOpenChats={(friendId) => { setChatTargetFriendId(friendId ?? null); void handleNavigation("Chats"); }} />
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
            {navigation
              .filter((item) => item.name !== "Developer" || developerAuthorized || canManageReleases)
              .map((item) => (
              <span key={item.name}>
                {item.name === "Developer" && <div className="nav-separator" />}
                <button
                  type="button"
                  title={!sidebarExpanded ? item.name : undefined}
                  className={`nav-item ${page === item.name ? "active" : ""}`}
                  onClick={() => void handleNavigation(item.name)}
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
                  onClick={() => void handlePlay(true)}
                >
                  <span className="nav-icon">◈</span>
                  <span className="partner-nav-content">
                    <strong>Alpha.rip</strong>
                    <small>Partner Server · Join alpha.rip</small>
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
            {developerUserEmail ? (
              <button
                type="button"
                title={!sidebarExpanded ? "Log out" : undefined}
                className="nav-item sidebar-logout-item"
                onClick={() => void handleDeveloperLogout()}
              >
                <span className="nav-icon">↪</span>
                {sidebarExpanded && <span>Log out</span>}
              </button>
            ) : null}
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
              savedAccounts={savedAccounts}
              onSwitchAccount={(savedAccount) => void handleMicrosoftLogin(savedAccount)}
              onAddAccount={() => void handleMicrosoftLogin()}
              isLoggingIn={isLoggingIn}
              isMinecraftRunning={isMinecraftRunning}
              clientVersion={clientVersion}
              launchHistory={launchHistory}
              changelogs={changelogs.filter((entry) => entry.published)}
              updateInfo={updateInfo}
              showNews={settings.showNews}
              onPlay={() => void handlePlay()}
              isLaunching={isLaunching || isUpdatingClient}
              launchError={launchError}
              launchMessage={launchMessage}
              onOpenAlphaAuth={() => void handleOpenAlphaAuth()}
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
              onPlay={() => void handlePlay()}
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
              isMinecraftRunning={isMinecraftRunning}
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
              isMinecraftRunning={isMinecraftRunning}
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

          {page === "Community" && <CommunityPage isMinecraftRunning={isMinecraftRunning} onOpenProfile={() => { setOpenProfileEditor(true); navigate("Account"); }} onOpenAlphaAuth={() => setAlphaAuthModalOpen(true)} openLoginRequested={communityLoginRequested} onLoginRequestHandled={() => setCommunityLoginRequested(false)} />}

          {page === "Friends" && <FriendsPage onOpenAlphaAuth={() => setAlphaAuthModalOpen(true)} onOpenChat={(friendId) => { setChatTargetFriendId(friendId); navigate("Chats"); }} />}

          {page === "Chats" && <ChatsPage onOpenAlphaAuth={() => setAlphaAuthModalOpen(true)} initialFriendId={chatTargetFriendId} onInitialFriendHandled={() => setChatTargetFriendId(null)} />}


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
              canManageReleases={canManageReleases}
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
                savedAccounts={savedAccounts}
                onSwitchAccount={(savedAccount) => void handleMicrosoftLogin(savedAccount)}
                isLoggingIn={isLoggingIn}
                isMinecraftRunning={isMinecraftRunning}
                loginError={loginError}
                onLogin={handleMicrosoftLogin}
                onLogout={handleMicrosoftLogout}
              />
              <ProfilePage startEditing={openProfileEditor} />
            </div>
          )}
        </main>
      </div>

      {alphaAuthModalOpen && (
        <AlphaAccountAuthModal onClose={() => setAlphaAuthModalOpen(false)} />
      )}

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
                  aria-label="Choose product"
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
                      (entry) =>
                        entry.published && entry.product === activeChangelogTab,
                    );

                    if (entries.length === 0) {
                      return (
                        <p className="modal-body-text">
                          No published changelogs yet for{" "}
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
  rank_keys?: string[];
};

const COMMUNITY_RANK_ORDER = [
  "founder",
  "owner",
  "manager",
  "plat_admin",
  "senior_admin",
  "admin",
  "senior_moderator",
  "moderator",
  "trial_moderator",
  "the_nibbler",
  "alpha_plus",
  "alpha",
  "elite",
  "rogue",
  "scout",
  "member",
  "beta", // Legacy rank retained for existing assignments; hidden from Rank Management.
] as const;

const COMMUNITY_RANKS: Record<string, { label: string; color: string }> = {
  founder: { label: "FOUNDER", color: "#FFD866" },
  owner: { label: "OWNER", color: "#FF2D00" },
  manager: { label: "MANAGER", color: "#5C0303" },
  plat_admin: { label: "PLAT ADMIN", color: "#5C0303" },
  senior_admin: { label: "SR ADMIN", color: "#D67020" },
  admin: { label: "ADMIN", color: "#E08D16" },
  senior_moderator: { label: "SR MOD", color: "#8C17D1" },
  moderator: { label: "MOD", color: "#29AFCC" },
  trial_moderator: { label: "T-MOD", color: "#166534" },
  the_nibbler: { label: "THE NIBBLER", color: "#A855F7" },
  alpha_plus: { label: "ALPHA+", color: "#FFF300" },
  alpha: { label: "ALPHA", color: "#F300FF" },
  beta: { label: "BETA (LEGACY)", color: "#00FF52" },
  elite: { label: "ELITE", color: "#00D9FF" },
  rogue: { label: "ROGUE", color: "#A855F7" },
  scout: { label: "SCOUT", color: "#FFD700" },
  member: { label: "MEMBER", color: "#C3BFE0" },
};

const COMMUNITY_RANK_ICONS: Record<string, string> = {
  founder: "🌸", owner: "♛", manager: "⬟", plat_admin: "◆", senior_admin: "⬟", admin: "✦",
  senior_moderator: "✚", moderator: "✧", trial_moderator: "◇", the_nibbler: "N",
  alpha_plus: "A+", alpha: "A", beta: "β", elite: "E", rogue: "R", scout: "S", member: "●",
};

const NIBBLER_RANK_IMAGE_URL = "https://raw.githubusercontent.com/MsAlexTsuki/AlphaClient---Mod/development/src/main/resources/assets/alphastaffmod/textures/ranks/the_nibbler.png";
const MANAGEMENT_RANK_IMAGE_URL = "https://raw.githubusercontent.com/MsAlexTsuki/AlphaClient---Mod/development/src/main/resources/assets/alphastaffmod/textures/ranks/management.png";

function CommunityRankIcon({ rankKey, className }: { rankKey: string | null | undefined; className: string }) {
  const key = rankKey || "member";
  if (key === "the_nibbler") {
    return <img className={className + " rank-image-icon"} src={NIBBLER_RANK_IMAGE_URL} alt="" aria-hidden="true" draggable={false} />;
  }
  if (key === "manager") {
    return <img className={className + " rank-image-icon"} src={MANAGEMENT_RANK_IMAGE_URL} alt="" aria-hidden="true" draggable={false} />;
  }
  return <span className={className} aria-hidden="true">{COMMUNITY_RANK_ICONS[key] || COMMUNITY_RANK_ICONS.member}</span>;
}

function CommunityRankBadge({ rankKey }: { rankKey: string | null | undefined }) {
  const key = rankKey || "member";
  const rank = COMMUNITY_RANKS[key] || COMMUNITY_RANKS.member;
  if (key === "founder") return <span className="community-rank-badge community-rank-founder"><span className="community-rank-icon community-rank-icon-founder" aria-hidden="true">🌸</span>{rank.label}</span>;
  return <span className="community-rank-badge" style={{ "--rank-color": rank.color } as React.CSSProperties}><CommunityRankIcon rankKey={key} className="community-rank-icon" />{rank.label}</span>;
}


function CommunityPage({ isMinecraftRunning, onOpenProfile, onOpenAlphaAuth, openLoginRequested, onLoginRequestHandled }: { isMinecraftRunning: boolean; onOpenProfile: () => void; onOpenAlphaAuth: () => void; openLoginRequested: boolean; onLoginRequestHandled: () => void }) {
  useEffect(() => {
    const updatePresence = (event: Event) => {
      const ids = (event as CustomEvent<string[]>).detail;
      setCommunityOnlineIds(new Set(Array.isArray(ids) ? ids : []));
    };
    window.addEventListener("alphaclient-presence-update", updatePresence);
    return () => window.removeEventListener("alphaclient-presence-update", updatePresence);
  }, []);
  const [displayName, setDisplayName] = useState("Community member");
  const [communityRank, setCommunityRank] = useState("member");
  const [communityAvatarUrl, setCommunityAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [communityFriends, setCommunityFriends] = useState<CommunityProfile[]>([]);
  const [communityOnlineIds, setCommunityOnlineIds] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    if (!openLoginRequested) return;
    setAuthPanelOpen(true);
    setAuthMode("login");
    setAuthError("");
    setAuthMessage("");
    onLoginRequestHandled();
  }, [openLoginRequested, onLoginRequestHandled]);

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
            emailRedirectTo: "alphaclient://auth/callback",
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
    if (isMinecraftRunning) {
      setCommunityLogoutError("Close Minecraft before logging out of your Alpha Community account.");
      return;
    }
    setCommunityLogoutLoading(true);
    setCommunityLogoutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSignedIn(false);
      setEmail("");
      setDisplayName("Community member");
      setCommunityRank("member");
      setCommunityAvatarUrl(null);
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
        .select("username, display_name, rank_key, is_founder, avatar_url")
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
      setCommunityAvatarUrl(typeof profile?.avatar_url === "string" && profile.avatar_url.trim() ? profile.avatar_url : null);
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
        <div className="community-avatar" aria-hidden="true">{communityAvatarUrl ? <img src={communityAvatarUrl} alt="" onError={() => setCommunityAvatarUrl(null)} /> : (identityLoading ? "…" : displayName.trim().charAt(0).toUpperCase() || "A")}</div>
        <div className="community-welcome-copy">
          <span className="community-kicker">{signedIn ? "YOUR ALPHA ACCOUNT" : "ALPHA ACCOUNT"}</span>
          <div className="community-name-rank"><h2>{identityLoading ? "Loading profile…" : signedIn ? displayName : "Welcome to the community"}</h2>{signedIn && !identityLoading && <span className={`community-menu-rank ${communityRank === "founder" ? "is-founder" : ""}`} style={{ "--rank-color": COMMUNITY_RANKS[communityRank]?.color ?? COMMUNITY_RANKS.member.color } as React.CSSProperties}><CommunityRankIcon rankKey={communityRank} className="community-rank-icon" />{COMMUNITY_RANKS[communityRank]?.label ?? "MEMBER"}</span>}</div>
          <p>{identityLoading ? "Loading your community account…" : signedIn ? (email || "Your AlphaClient profile") : "Sign in to your community account to use your profile and display name."}</p>
        </div>
        <div className="community-account-actions">
          {signedIn ? (
            <>
              <button type="button" className="friends-primary community-profile-button" onClick={onOpenProfile}>Edit profile <span aria-hidden="true">↗</span></button>
              <button type="button" className="secondary-button community-logout-button" onClick={() => void handleCommunityLogout()} disabled={communityLogoutLoading || isMinecraftRunning} title={isMinecraftRunning ? "Close Minecraft before logging out." : undefined}>{isMinecraftRunning ? "MINECRAFT IS RUNNING" : communityLogoutLoading ? "SIGNING OUT..." : "LOG OUT"}</button>
            </>
          ) : (
            <button type="button" className="friends-primary community-profile-button" onClick={onOpenAlphaAuth}>
              Log in / Sign up <span aria-hidden="true">↗</span>
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
                <span className={`community-friend-presence ${communityOnlineIds.has(friend.id) ? "is-online" : "is-offline"}`} title={communityOnlineIds.has(friend.id) ? "Online" : "Offline"} aria-label={communityOnlineIds.has(friend.id) ? "Online" : "Offline"} />
              </div>
            ))}</div>}
          <p className="community-friends-footnote">Green indicates online; gray indicates offline.</p>
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
      const { data: rankRows, error: rankError } = await supabase.rpc("get_profile_ranks", { p_profile_ids: [user.id] });
      if (rankError) throw rankError;
      const loaded = { ...(data as EditableCommunityProfile), rank_keys: (rankRows ?? []).map((row: { rank_key: string }) => row.rank_key) };
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
      setProfile({ ...(data as EditableCommunityProfile), rank_keys: profile.rank_keys });
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
      <h2 className="profile-name-row">{(() => { const rankKey = profile.rank_key || (profile.is_founder ? "founder" : "member"); const rank = COMMUNITY_RANKS[rankKey] || COMMUNITY_RANKS.member; return rankKey === "founder" ? <span className="profile-founder-badge"><span className="profile-founder-icon" aria-hidden="true">🌸</span>FOUNDER</span> : <span className="profile-rank-badge" style={{ "--rank-color": rank.color } as React.CSSProperties}><CommunityRankIcon rankKey={rankKey} className="profile-rank-icon" />{rank.label}</span>; })()}{profile.username}</h2>
      <div className="profile-username">@{profile.username}</div>
      <p className="profile-bio-preview">{profile.bio?.trim() || "You haven't added a bio yet."}</p>
      <div className="profile-preview-divider" />
      <div className="profile-preview-foot"><span className="profile-status-dot" /> Alpha Account</div>
      {(() => {
        const rankLabels: Record<string, string> = {
          founder: "Founder of Alpha Client",
          owner: "Owner of Alpha",
          manager: "Manager on Alpha",
  plat_admin: "Plat Admin on Alpha",
          senior_admin: "Senior Admin on Alpha",
          admin: "Admin on Alpha",
          senior_moderator: "Senior Moderator on Alpha",
          moderator: "Moderator on Alpha",
          trial_moderator: "Trial Moderator on Alpha",
          beta: "Beta Tester on Alpha",
          alpha_plus: "Alpha+ on Alpha",
          alpha: "Alpha on Alpha",
          member: "Member on Alpha",
          the_nibbler: "Nibbling them balls",
        };
        const rankKeys = profile.rank_keys?.length
          ? profile.rank_keys
          : [profile.rank_key || (profile.is_founder ? "founder" : "member")];
        return <div className="profile-rank-list">
          {rankKeys.map((rankKey) => {
            const rank = COMMUNITY_RANKS[rankKey] || COMMUNITY_RANKS.member;
            const icon = rankKey === "founder" ? "♛" : (COMMUNITY_RANK_ICONS[rankKey] || COMMUNITY_RANK_ICONS.member);
            return <div key={rankKey} className="profile-founder-status" style={{ "--rank-color": rank.color } as React.CSSProperties}>
              {rankKey === "the_nibbler" ? <CommunityRankIcon rankKey={rankKey} className="profile-founder-crown" /> : <span className="profile-founder-crown" aria-hidden="true">{icon}</span>}
              {rankLabels[rankKey] || rank.label}
            </div>;
          })}
        </div>;
      })()}
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

type CommunityProfile = { id: string; username: string; display_name: string; is_founder: boolean; rank_key?: string | null; rank_keys?: string[]; avatar_url?: string | null; bio?: string | null; created_at?: string | null; last_played_at?: string | null; last_played_version?: string | null };

function ChatsPage({ onOpenAlphaAuth, initialFriendId, onInitialFriendHandled }: { onOpenAlphaAuth: () => void; initialFriendId: string | null; onInitialFriendHandled: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<CommunityProfile[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadChats = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) {
          if (!cancelled) { setUserId(null); setFriends([]); setSelectedFriendId(null); }
          return;
        }
        if (cancelled) return;
        setUserId(user.id);
        const { data: friendshipRows, error: friendshipError } = await supabase
          .from("friendships")
          .select("user_a, user_b")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
        if (friendshipError) throw friendshipError;
        const friendIds = [...new Set((friendshipRows ?? []).map((row: { user_a: string; user_b: string }) => row.user_a === user.id ? row.user_b : row.user_a))];
        const { data: people, error: peopleError } = friendIds.length
          ? await supabase.from("profiles").select("id, username, display_name, is_founder, rank_key, avatar_url").in("id", friendIds)
          : { data: [], error: null };
        if (peopleError) throw peopleError;
        if (cancelled) return;
        const loadedFriends = ((people ?? []) as CommunityProfile[]).sort((a, b) => a.username.localeCompare(b.username));
        setFriends(loadedFriends);
        setSelectedFriendId(current => current && loadedFriends.some(friend => friend.id === current) ? current : null);
      } catch (loadError) {
        if (!cancelled) setError(errorText(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadChats();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!initialFriendId || loading) return;
    if (friends.some(friend => friend.id === initialFriendId)) setSelectedFriendId(initialFriendId);
    onInitialFriendHandled();
  }, [initialFriendId, loading, friends, onInitialFriendHandled]);

  return <div className="page chats-page">
    <div className="page-header"><div><div className="eyebrow">ALPHA COMMUNITY</div><h1>Chats</h1><p>Your private conversations with Alpha friends.</p></div></div>
    {!loading && !userId && <section className="section-card friends-signin"><div className="friends-empty-icon">✉</div><h2>Sign in to Alpha Community</h2><p>Sign in to your Alpha Account to open private chats with your friends.</p><button className="friends-primary" onClick={onOpenAlphaAuth}>Sign in to Alpha Account</button></section>}
    {loading && <section className="section-card"><div className="friends-loading">Loading your chats…</div></section>}
    {error && <section className="section-card"><p className="friends-notice error" role="alert">{error}</p></section>}
    {userId && !loading && !error && <PrivateChatPanel userId={userId} friends={friends} selectedFriendId={selectedFriendId} onSelectFriend={setSelectedFriendId} />}
  </div>;
}

type CommunityFriendRequest = { id: string; sender_id: string; recipient_id: string; status: string; created_at: string };

function FriendsPage({ onOpenAlphaAuth, onOpenChat }: { onOpenAlphaAuth: () => void; onOpenChat: (friendId: string) => void }) {
  const [onlineFriendIds, setOnlineFriendIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const updatePresence = (event: Event) => {
      const ids = (event as CustomEvent<string[]>).detail;
      setOnlineFriendIds(new Set(Array.isArray(ids) ? ids : []));
    };
    window.addEventListener("alphaclient-presence-update", updatePresence);
    return () => window.removeEventListener("alphaclient-presence-update", updatePresence);
  }, []);
  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<CommunityProfile | null>(null);
  const [friends, setFriends] = useState<CommunityProfile[]>([]);
  const [publicProfile, setPublicProfile] = useState<CommunityProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [incoming, setIncoming] = useState<Array<CommunityFriendRequest & { profile?: CommunityProfile }>>([]);
  const [outgoing, setOutgoing] = useState<Array<CommunityFriendRequest & { profile?: CommunityProfile }>>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CommunityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<CommunityProfile | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [setupUsername, setSetupUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSetupRequired, setProfileSetupRequired] = useState(false);

  const loadCommunity = async () => {
    const startedAt = performance.now();
    const mark = (step: string) => console.debug(`[Alpha Friends] ${step}: ${Math.round(performance.now() - startedAt)}ms`);
    setLoading(true);
    setError("");
    try {
      const authStartedAt = performance.now();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      mark(`auth.getUser (${Math.round(performance.now() - authStartedAt)}ms)`);
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        setUserId(null); setMyProfile(null); setFriends([]); setIncoming([]); setOutgoing([]);
        return;
      }
      setUserId(user.id);

      // Independent profile and relationship requests run in parallel.
      const initialStartedAt = performance.now();
      const [profileResult, friendshipResult, requestResult] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, is_founder, rank_key, avatar_url, bio, created_at").eq("id", user.id).maybeSingle(),
        supabase.from("friendships").select("user_a, user_b").or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
        supabase.from("friend_requests").select("id, sender_id, recipient_id, status, created_at").or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).eq("status", "pending").order("created_at", { ascending: false }),
      ]);
      mark(`profile/friendship/request queries (${Math.round(performance.now() - initialStartedAt)}ms)`);
      const { data: profile, error: profileError } = profileResult;
      const { data: friendshipRows, error: friendshipError } = friendshipResult;
      const { data: requestRows, error: requestError } = requestResult;
      if (profileError) throw profileError;
      if (friendshipError) throw friendshipError;
      if (requestError) throw requestError;

      const loadedProfile = profile as CommunityProfile | null;
      setMyProfile(loadedProfile);
      const needsSetup = Boolean(loadedProfile && loadedProfile.username.startsWith("alpha_"));
      setProfileSetupRequired(needsSetup);
      if (loadedProfile && needsSetup) setSetupUsername("");

      const friendIds = (friendshipRows ?? []).map((row: { user_a: string; user_b: string }) => row.user_a === user.id ? row.user_b : row.user_a);
      const requests = (requestRows ?? []) as CommunityFriendRequest[];
      const otherIds = [...new Set([...friendIds, ...requests.map(r => r.sender_id === user.id ? r.recipient_id : r.sender_id)])];

      if (!otherIds.length) {
        setFriends([]);
        setIncoming([]);
        setOutgoing([]);
        mark("complete (no friend profiles to fetch)");
        return;
      }

      const peopleStartedAt = performance.now();
      const { data: people, error: peopleError } = await supabase.from("profiles")
        .select("id, username, display_name, is_founder, rank_key, avatar_url")
        .in("id", otherIds);
      mark(`friend/request profiles query (${Math.round(performance.now() - peopleStartedAt)}ms, ${otherIds.length} profiles)`);
      if (peopleError) throw peopleError;

      const profileMap = new Map(((people ?? []) as CommunityProfile[]).map(person => [person.id, person]));
      setFriends(friendIds.map(id => profileMap.get(id)).filter((person): person is CommunityProfile => Boolean(person)).sort((a,b) => a.username.localeCompare(b.username)));
      setIncoming(requests.filter(r => r.recipient_id === user.id).map(r => ({ ...r, profile: profileMap.get(r.sender_id) })));
      setOutgoing(requests.filter(r => r.sender_id === user.id).map(r => ({ ...r, profile: profileMap.get(r.recipient_id) })));
      mark("complete");
    } catch (e) {
      setError(errorText(e));
      console.error("[Alpha Friends] Failed to load community data:", e);
    } finally {
      setLoading(false);
      mark("loading state cleared");
    }
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
    const { data, error: searchError } = await supabase.from("profiles").select("id, username, display_name, is_founder, rank_key, avatar_url").ilike("username", `%${term}%`).neq("id", userId).limit(20);
    if (searchError) { setError(errorText(searchError)); return; }
    const known = new Set([...friends.map(f => f.id), ...incoming.map(r => r.sender_id), ...outgoing.map(r => r.recipient_id)]);
    setResults(((data ?? []) as CommunityProfile[]).filter(person => !known.has(person.id)));
    if (!data?.length) setMessage("No Alpha accounts matched that username.");
  };

  const openPublicProfile = async (person: CommunityProfile) => {
    setPublicProfile(person);
    setProfileLoading(true);
    const { data, error: profileError } = await supabase.from("profiles").select("id, username, display_name, is_founder, rank_key, avatar_url, bio, created_at").eq("id", person.id).maybeSingle();
    if (!profileError && data) {
      const [{ data: rankRows, error: rankError }, { data: activity, error: activityError }] = await Promise.all([
        supabase.rpc("get_profile_ranks", { p_profile_ids: [person.id] }),
        supabase.from("profile_activity").select("last_played_at, last_played_version").eq("user_id", person.id).maybeSingle(),
      ]);
      if (rankError) {
        setError(errorText(rankError));
      } else {
        setPublicProfile({
          ...(data as CommunityProfile),
          rank_keys: (rankRows ?? []).map((row: { rank_key: string }) => row.rank_key),
          last_played_at: activityError ? null : activity?.last_played_at ?? null,
          last_played_version: activityError ? null : activity?.last_played_version ?? null,
        });
      }
      if (activityError) console.warn("Could not load profile Last played:", activityError);
    } else if (profileError) setError(errorText(profileError));
    setProfileLoading(false);
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

  const removeFriend = async (friend: CommunityProfile) => {
    if (!userId || busyId) return;
    setBusyId(friend.id); setError(""); setMessage("");
    const { error: removeError } = await supabase.from("friendships").delete()
      .or(`and(user_a.eq.${userId},user_b.eq.${friend.id}),and(user_a.eq.${friend.id},user_b.eq.${userId})`);
    if (removeError) setError(errorText(removeError));
    else {
      setMessage(`@ ${friend.username} was removed from your friends.`.replace("@ ", "@"));
      setPublicProfile(null);
      setFriendToRemove(null);
      await loadCommunity();
    }
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
    {!userId && !loading && <section className="section-card friends-signin"><div className="friends-empty-icon">♧</div><h2>Sign in to Alpha Community</h2><p>Your Microsoft Minecraft account and Alpha community account are separate. The current developer login is not intended to be the general community login, so sign in to a community account before using friends.</p><button className="friends-primary" onClick={onOpenAlphaAuth}>Community account required</button></section>}
    {userId && !myProfile && !loading && <section className="section-card"><h2>Community profile not found</h2><p>Your signed-in Supabase account has no Alpha profile yet. Check that the database migration and new-account trigger ran successfully.</p></section>}
    {userId && myProfile && profileSetupRequired && <div className="friends-modal-backdrop"><section className="section-card friends-profile-setup" role="dialog" aria-modal="true" aria-labelledby="friends-profile-title"><div className="friends-empty-icon">✦</div><div className="eyebrow">WELCOME TO ALPHA COMMUNITY</div><h2 id="friends-profile-title">Choose your username</h2><p>Choose a unique username. Other players will use this name to find you and send friend requests.</p><form onSubmit={saveCommunityProfile} className="friends-profile-form"><label htmlFor="friends-username">Username</label><div className="friends-username-field"><span>@</span><input id="friends-username" value={setupUsername} onChange={event => setSetupUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0,20))} minLength={3} maxLength={20} pattern="[a-z0-9_]{3,20}" placeholder="yourname" required autoFocus /></div><small>3–20 characters: lowercase letters, numbers, and underscores.</small>{error && <div className="friends-notice error">{error}</div>}<button className="friends-primary friends-save-profile" type="submit" disabled={savingProfile}>{savingProfile ? "Saving profile…" : "Save and continue"}</button></form></section></div>}
    {userId && myProfile && !profileSetupRequired && <>
      <section className="section-card friends-search-card"><div className="friends-section-heading"><div><h2>Find players</h2><p>Search by Alpha username.</p></div><span className="friends-handle">@{myProfile.username}</span></div><form className="friends-search" onSubmit={event => { event.preventDefault(); void searchUsers(); }}><span className="friends-search-icon">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Enter a username…" maxLength={20}/><button className="friends-primary" type="submit">Search</button></form>
        {results.length > 0 && <div className="friends-user-list">{results.map(person => <div className="friends-user-row friends-search-result-row" key={person.id}><button type="button" className="friends-avatar friends-profile-open" aria-label={`View @${person.username} profile`} onClick={() => void openPublicProfile(person)}>{person.avatar_url ? <img src={person.avatar_url} alt="" onError={event => { event.currentTarget.style.display = "none"; }} /> : person.username.slice(0,1).toUpperCase()}</button><div className="friends-user-copy"><strong className="friends-search-result-name"><button type="button" className="friends-profile-name-button" onClick={() => void openPublicProfile(person)}>{person.username}</button><CommunityRankBadge rankKey={person.rank_key || (person.is_founder ? "founder" : "member")} /></strong><span>@{person.username}</span></div><button className="friends-secondary" disabled={busyId === person.id} onClick={() => void sendRequest(person)}>{busyId === person.id ? "Sending…" : "+ Add friend"}</button></div>)}</div>}
      </section>
      <div className="friends-main-layout">
        <div className="friends-columns friends-request-columns">
        <section className="section-card friends-list-card">
          <div className="friends-section-heading"><div><h2>Incoming requests</h2><p>Players who want to add you.</p></div><span className="friends-count">{incoming.length}</span></div>
          {incoming.length === 0 ? <div className="friends-empty">No incoming requests right now.</div> : incoming.map(request => <div className="friends-user-row" key={request.id}><div className="friends-avatar">{request.profile?.avatar_url ? <img src={request.profile.avatar_url} alt="" onError={event => { event.currentTarget.style.display = "none"; }} /> : (request.profile?.username || "?").slice(0,1).toUpperCase()}</div><div className="friends-user-copy"><strong>{request.profile?.username || "Alpha player"}</strong><span>@{request.profile?.username || "unknown"}</span></div>{request.profile && <CommunityRankBadge rankKey={request.profile.rank_key || (request.profile.is_founder ? "founder" : "member")} />}<button className="friends-primary compact" disabled={busyId === request.id} onClick={() => void respond(request, true)}>{busyId === request.id ? "…" : "Accept"}</button><button className="friends-secondary compact" disabled={busyId === request.id} onClick={() => void respond(request, false)}>Decline</button></div>)}
        </section>
        <section className="section-card friends-list-card">
          <div className="friends-section-heading"><div><h2>Outgoing requests</h2><p>Players you have sent a request to.</p></div><span className="friends-count">{outgoing.length}</span></div>
          {outgoing.length === 0 ? <div className="friends-empty">You haven't sent any pending requests.</div> : outgoing.map(request => <div className="friends-user-row" key={request.id}><div className="friends-avatar">{request.profile?.avatar_url ? <img src={request.profile.avatar_url} alt="" onError={event => { event.currentTarget.style.display = "none"; }} /> : (request.profile?.username || "?").slice(0,1).toUpperCase()}</div><div className="friends-user-copy"><strong>{request.profile?.is_founder && <span className="profile-founder-badge friends-founder-badge">FOUNDER</span>}{request.profile?.username || "Alpha player"}</strong><span>@{request.profile?.username || "unknown"}</span></div><span className="friends-pending"><i /> Pending</span><button className="friends-secondary compact" type="button" disabled={busyId === request.id} onClick={() => void cancelRequest(request)}>{busyId === request.id ? "Cancelling…" : "Cancel request"}</button></div>)}
        </section>
        </div>
        <section className="section-card friends-list-card friends-roster-card">
          <div className="friends-section-heading"><div><h2>Your friends</h2><p>Players connected to your account.</p></div><span className="friends-count">{friends.length}</span></div>
          {friends.length === 0 ? <div className="friends-empty">Your friends list is empty. Search for a player to get started.</div> : <div className="friends-scroll-list" role="list" aria-label="Your friends">{friends.map(friend => <div className="friends-user-row friends-roster-row" role="listitem" key={friend.id}><button type="button" className="friends-avatar friends-profile-open" aria-label={`View ${friend.username} profile`} onClick={event => { event.stopPropagation(); void openPublicProfile(friend); }}>{friend.avatar_url ? <img src={friend.avatar_url} alt="" /> : friend.username.slice(0,1).toUpperCase()}</button><div className="friends-user-copy"><div className="friends-roster-name-line"><button type="button" className="friends-profile-name-button" onClick={event => { event.stopPropagation(); void openPublicProfile(friend); }}>{friend.username}</button><CommunityRankBadge rankKey={friend.rank_key || (friend.is_founder ? "founder" : "member")} /><button type="button" className="friends-chat-icon-button" aria-label={`Chat with ${friend.username}`} title={`Message ${friend.username}`} onClick={() => onOpenChat(friend.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8.2 8.2 0 0 1-3.3-.7L4 20l1.7-4.2A7.5 7.5 0 1 1 20 11.5Z" /></svg></button></div><span>@{friend.username}</span></div><span className={`friends-presence ${onlineFriendIds.has(friend.id) ? "is-online" : "is-offline"}`}><i />{onlineFriendIds.has(friend.id) ? "Online" : "Offline"}</span></div>)}</div>}
        </section>
      </div>
    </>}
    {publicProfile && <div className="public-profile-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPublicProfile(null); }}><section className="section-card profile-preview-card profile-view-card public-profile-modal" role="dialog" aria-modal="true" aria-labelledby="public-profile-name"><button type="button" className="public-profile-close" aria-label="Close profile" onClick={() => setPublicProfile(null)}>×</button><div className="profile-preview-glow" /><div className="eyebrow profile-account-label">ALPHA ACCOUNT</div><div className="profile-avatar-large">{publicProfile.avatar_url ? <img src={publicProfile.avatar_url} alt={publicProfile.username + " avatar"} /> : <span>{publicProfile.username.slice(0, 1).toUpperCase()}</span>}</div><h2 className="profile-name-row" id="public-profile-name">{(() => { const key = publicProfile.rank_key || (publicProfile.is_founder ? "founder" : "member"); const rank = COMMUNITY_RANKS[key] || COMMUNITY_RANKS.member; return key === "founder" ? <span className="profile-founder-badge"><span className="profile-founder-icon" aria-hidden="true">🌸</span>FOUNDER</span> : <span className="profile-rank-badge" style={{ "--rank-color": rank.color } as React.CSSProperties}><CommunityRankIcon rankKey={key} className="profile-rank-icon" />{rank.label}</span>; })()}{publicProfile.username}</h2><div className="profile-username">@{publicProfile.username}</div><p className="profile-bio-preview">{publicProfile.bio?.trim() || "This player hasn't added a bio yet."}</p><div className="profile-preview-divider" /><div className="profile-preview-foot"><span className="profile-status-dot" /> Alpha Account</div>{(() => { const rankLabels: Record<string, string> = { founder: "Founder of Alpha Client", owner: "Owner of Alpha", management: "Manager of Alpha", senior_admin: "Senior Admin on Alpha", admin: "Admin on Alpha", senior_moderator: "Senior Moderator on Alpha", moderator: "Moderator on Alpha", trial_moderator: "Trial Moderator on Alpha", beta: "Beta Tester on Alpha", alpha_plus: "Alpha+ on Alpha", alpha: "Alpha on Alpha", member: "Member on Alpha", the_nibbler: "Nibbling them balls" }; const rankKeys = publicProfile.rank_keys?.length ? publicProfile.rank_keys : [publicProfile.rank_key || (publicProfile.is_founder ? "founder" : "member")]; return <div className="profile-rank-list">{rankKeys.map(rankKey => { const rank = COMMUNITY_RANKS[rankKey] || COMMUNITY_RANKS.member; const icon = rankKey === "founder" ? "♛" : (COMMUNITY_RANK_ICONS[rankKey] || COMMUNITY_RANK_ICONS.member); return <div key={rankKey} className="profile-founder-status" style={{ "--rank-color": rank.color } as React.CSSProperties}>{rankKey === "the_nibbler" ? <CommunityRankIcon rankKey={rankKey} className="profile-founder-crown" /> : <span className="profile-founder-crown" aria-hidden="true">{icon}</span>}{rankLabels[rankKey] || rank.label}</div>; })}</div>; })()}{publicProfile.last_played_at ? <div className="public-profile-meta">Last played: {new Date(publicProfile.last_played_at).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}{publicProfile.last_played_version ? ` · ${publicProfile.last_played_version}` : ""}</div> : <div className="public-profile-meta">Last played: Not recorded yet</div>}{publicProfile.created_at && <div className="public-profile-meta">Member since {new Date(publicProfile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>}{profileLoading && <div className="public-profile-meta">Refreshing profile…</div>}<div className="public-profile-actions">{friends.some(friend => friend.id === publicProfile.id) ? <><span className="friends-connected"><i /> Friend</span><button className="friends-secondary" type="button" onClick={() => { setPublicProfile(null); onOpenChat(publicProfile.id); }}>Message</button><button className="friends-danger" type="button" disabled={busyId === publicProfile.id} onClick={() => setFriendToRemove(publicProfile)}>Remove friend</button></> : incoming.find(request => request.profile?.id === publicProfile.id) ? <><button className="friends-primary" type="button" disabled={busyId === incoming.find(request => request.profile?.id === publicProfile.id)?.id} onClick={() => { const request = incoming.find(item => item.profile?.id === publicProfile.id); if (request) void respond(request, true); }}>Accept request</button><button className="friends-secondary" type="button" onClick={() => { const request = incoming.find(item => item.profile?.id === publicProfile.id); if (request) void respond(request, false); }}>Decline</button></> : outgoing.find(request => request.profile?.id === publicProfile.id) ? <button className="friends-secondary" type="button" onClick={() => { const request = outgoing.find(item => item.profile?.id === publicProfile.id); if (request) void cancelRequest(request); }}>Request sent · Cancel</button> : <button className="friends-primary" type="button" disabled={busyId === publicProfile.id} onClick={() => void sendRequest(publicProfile)}>{busyId === publicProfile.id ? "Sending…" : "Add friend"}</button>}</div></section></div>}
    {friendToRemove && <div className="action-confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busyId) setFriendToRemove(null); }}><section className="action-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="remove-friend-title" aria-describedby="remove-friend-description"><div className="action-confirm-icon danger">!</div><h2 id="remove-friend-title">Remove friend?</h2><p id="remove-friend-description">Are you sure you want to remove <strong>@{friendToRemove.username}</strong> from your friends? You can send a new friend request later.</p><div className="action-confirm-actions"><button type="button" className="friends-secondary" disabled={!!busyId} onClick={() => setFriendToRemove(null)}>Cancel</button><button type="button" className="friends-danger" disabled={!!busyId} onClick={() => void removeFriend(friendToRemove)}>{busyId === friendToRemove.id ? "Removing…" : "Remove friend"}</button></div></section></div>}
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


function AlphaAccountAuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const changeMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setError("");
    setMessage("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const cleanEmail = email.trim();
    const cleanUsername = username.trim();
    if (!cleanEmail || !password) {
      setError("Enter your email address and password.");
      return;
    }
    if (mode === "signup" && !cleanUsername) {
      setError("Choose an Alpha Account username.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Your password must contain at least 6 characters.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (loginError) throw loginError;
        window.location.reload();
      } else {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: "alphaclient://auth/callback",
            data: { username: cleanUsername, display_name: cleanUsername },
          },
        });
        if (signupError) throw signupError;
        if (data.session) {
          window.location.reload();
        } else {
          setMessage("Account created. Check your email to confirm your account, then sign in here.");
          setMode("login");
          setPassword("");
        }
      }
    } catch (submitError) {
      setError(errorText(submitError));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  return (
    <div
      className="alpha-access-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="alpha-access-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alpha-access-title"
      >
        <aside className="alpha-access-showcase">
          <button
            type="button"
            className="alpha-access-close alpha-access-close-showcase"
            onClick={onClose}
            disabled={busy}
            aria-label="Close Alpha Account login"
          >
            ×
          </button>
          <div className="alpha-access-logo" aria-hidden="true"><AlphaLogo /></div>
          <span className="alpha-access-overline">ONE ACCOUNT. ALL OF ALPHA.</span>
          <h2>Your Alpha journey starts here.</h2>
          <p>Sign in to connect with the community, manage your profile, and make your Alpha experience yours.</p>
          <div className="alpha-access-showcase-footer">
            <span className="alpha-access-status-dot" />
            <span>ALPHACLIENT ACCOUNT</span>
          </div>
        </aside>

        <div className="alpha-access-form-side">
          <button
            type="button"
            className="alpha-access-close alpha-access-close-form"
            onClick={onClose}
            disabled={busy}
            aria-label="Close Alpha Account login"
          >
            ×
          </button>
          <div className="alpha-access-form-heading">
            <span className="alpha-access-kicker">{mode === "login" ? "WELCOME BACK" : "JOIN THE COMMUNITY"}</span>
            <h3 id="alpha-access-title">{mode === "login" ? "Sign in" : "Create account"}</h3>
            <p>{mode === "login" ? "Enter your details to continue to Alpha." : "Create your Alpha Account in just a moment."}</p>
          </div>

          <div className="alpha-access-tabs" role="tablist" aria-label="Alpha Account access">
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => changeMode("login")}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "is-active" : ""} onClick={() => changeMode("signup")}>Create account</button>
          </div>

          <form className="alpha-access-form" onSubmit={(event) => void handleSubmit(event)}>
            {mode === "signup" && (
              <div className="alpha-access-field">
                <label htmlFor="alpha-access-username">USERNAME</label>
                <input id="alpha-access-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))} maxLength={20} placeholder="Choose a username" required />
              </div>
            )}
            <div className="alpha-access-field">
              <label htmlFor="alpha-access-email">EMAIL ADDRESS</label>
              <input id="alpha-access-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="alpha-access-field">
              <label htmlFor="alpha-access-password">PASSWORD</label>
              <input id="alpha-access-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "signup" ? 6 : undefined} placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"} required />
            </div>
            {error && <p className="alpha-access-feedback is-error" role="alert">{error}</p>}
            {message && <p className="alpha-access-feedback is-success" role="status">{message}</p>}
            <button type="submit" className="alpha-access-submit" disabled={busy}>
              {busy ? "PLEASE WAIT..." : mode === "login" ? "SIGN IN TO ALPHA" : "CREATE ALPHA ACCOUNT"}
              {!busy && <span aria-hidden="true">↗</span>}
            </button>
          </form>
          <p className="alpha-access-switch-copy">
            {mode === "login" ? "New to Alpha?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => changeMode(mode === "login" ? "signup" : "login")} disabled={busy}>
              {mode === "login" ? "Create an account" : "Sign in instead"}
            </button>
          </p>
          <p className="alpha-access-legal">By continuing, you agree to use your Alpha Account responsibly.</p>
        </div>
      </section>
    </div>
  );
}

function HomePage(props: {
  account: MicrosoftAccount | null;
  savedAccounts: MicrosoftAccount[];
  onSwitchAccount: (account: MicrosoftAccount) => void;
  onAddAccount: () => void;
  isLoggingIn: boolean;
  isMinecraftRunning: boolean;
  clientVersion: string;
  launchHistory: LastPlayed[];
  changelogs: ChangelogEntry[];
  updateInfo: AlphaClientUpdateInfo | null;
  showNews: boolean;
  onPlay: () => void;
  isLaunching: boolean;
  launchError: string | null;
  launchMessage: string | null;
  onOpenAlphaAuth: () => void;
  onChangelog: () => void;
  onNews: () => void;
}) {
  const {
    account,
    savedAccounts,
    onSwitchAccount,
    onAddAccount,
    isLoggingIn,
    isMinecraftRunning,
    clientVersion,
    launchHistory,
    changelogs,
    updateInfo,
    showNews,
    onPlay,
    isLaunching,
    launchError,
    launchMessage,
    onOpenAlphaAuth,
    onChangelog,
    onNews,
  } = props;
  const [accountsExpanded, setAccountsExpanded] = useState(false);

  useEffect(() => {
    if (!accountsExpanded) return;

    const closeAccountsOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".home-account-dropdown-wrap")) return;
      setAccountsExpanded(false);
    };

    document.addEventListener("pointerdown", closeAccountsOnOutsideClick);
    return () => {
      document.removeEventListener("pointerdown", closeAccountsOnOutsideClick);
    };
  }, [accountsExpanded]);

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
          <div className="home-account-dropdown-wrap">
          <button
            type="button"
            className={`info-card info-card-button home-account-toggle${accountsExpanded ? " is-expanded" : ""}`}
            onClick={() => setAccountsExpanded((expanded) => !expanded)}
            aria-expanded={accountsExpanded}
            aria-controls="home-saved-accounts-panel"
            title={accountsExpanded ? "Hide saved Minecraft accounts" : "Show saved Minecraft accounts"}
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
              <span className="home-account-chevron" aria-hidden="true">{accountsExpanded ? "⌃" : "⌄"}</span>
            </div>
          </button>
          <div id="home-saved-accounts-panel" className={`saved-accounts-collapse${accountsExpanded ? " is-expanded" : ""}`} aria-hidden={!accountsExpanded} onClick={(event) => { const target = event.target; if (target instanceof Element && target.closest("button, a, input, select, textarea")) return; setAccountsExpanded(false); }}>
            <div className="saved-accounts-collapse-inner">
              <div className="saved-accounts-inline-header">
                <span className="card-label">SAVED ACCOUNTS</span>
                <span className="saved-account-count">{savedAccounts.length}/{MAX_SAVED_MICROSOFT_ACCOUNTS}</span>
              </div>
              {savedAccounts.length === 0 ? <p className="subtitle">No Minecraft accounts saved yet. Add one below.</p> : (
                <div className="saved-accounts-list">
                  {savedAccounts.map((savedAccount) => (
                    <div className="saved-account-row" key={savedAccount.uuid ?? savedAccount.email}>
                      <img src={`https://mc-heads.net/avatar/${encodeURIComponent(savedAccount.name)}/48`} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                      <div className="saved-account-copy"><strong>{savedAccount.name}</strong><span>{savedAccount.email}</span></div>
                      {(savedAccount.uuid && account?.uuid === savedAccount.uuid) || account?.email.toLowerCase() === savedAccount.email.toLowerCase() ? <span className="saved-account-current">Current</span> : (
                        <button type="button" className="small-button" onClick={() => onSwitchAccount(savedAccount)} disabled={isLoggingIn || isLaunching || isMinecraftRunning} title={isMinecraftRunning ? "Close Minecraft before switching accounts." : undefined}>{isLoggingIn ? "Signing in…" : "Switch"}</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="saved-accounts-footer">
                <span className="saved-accounts-note">Select an account to sign in with it. Microsoft may ask you to confirm the account.</span>
                <button type="button" className="small-button saved-account-add" onClick={onAddAccount} disabled={isLoggingIn || isMinecraftRunning || savedAccounts.length >= MAX_SAVED_MICROSOFT_ACCOUNTS} title={savedAccounts.length >= MAX_SAVED_MICROSOFT_ACCOUNTS ? "You can save up to 5 accounts." : isMinecraftRunning ? "Close Minecraft before adding an account." : undefined}>{isLoggingIn ? "Waiting for Microsoft…" : savedAccounts.length >= MAX_SAVED_MICROSOFT_ACCOUNTS ? "Limit reached (5/5)" : "+ Add account"}</button>
              </div>
            </div>
          </div>
          </div>

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
                  There are no published changelogs yet.
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
          onClick={onOpenAlphaAuth}
        >
          <span aria-hidden="true">✦</span>
          Login to your Alpha Account
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
  isMinecraftRunning: boolean;
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
          {props.isMinecraftRunning
            ? "MINECRAFT RUNNING"
            : props.updateInfo?.update_available
              ? `UPDATE ${props.updateInfo.latest_version}`
              : "INSTALLED"}
        </span>
      </div>

      {!props.isMinecraftRunning && props.updateInfo?.update_available && (
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

      {props.isMinecraftRunning && (
        <p className="subtitle">
          Minecraft is already running. Close the game before launching, updating, or repairing AlphaClient.
        </p>
      )}

      <button
        type="button"
        className="large-play-button"
        onClick={props.onPlay}
        disabled={props.isLaunching || props.isUpdating || props.isMinecraftRunning}
      >
        <span>▶</span>
        {props.isMinecraftRunning
          ? "MINECRAFT IS RUNNING"
          : props.isLaunching
            ? "PREPARING..."
            : "LAUNCH ALPHACLIENT"}
      </button>

      <button
        type="button"
        className="secondary-button install-button"
        onClick={props.onInstall}
        disabled={props.isInstalling || props.isUpdating || props.isMinecraftRunning}
      >
        {props.isMinecraftRunning
          ? "CLOSE MINECRAFT TO REPAIR"
          : props.isInstalling
            ? "INSTALLING..."
            : "INSTALL / REPAIR FILES"}
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
  isMinecraftRunning: boolean;
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
              disabled={props.isUpdating || props.isMinecraftRunning}
              title={props.isMinecraftRunning ? "Close Minecraft before changing or updating versions." : undefined}
            >
              {props.isMinecraftRunning
                ? "Minecraft running"
                : version.version === props.selectedVersion
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
        disabled={props.isInstalling || props.isUpdating || props.isMinecraftRunning}
        title={props.isMinecraftRunning ? "Close Minecraft before installing or repairing AlphaClient." : undefined}
      >
        {props.isMinecraftRunning
          ? "CLOSE MINECRAFT TO REPAIR"
          : props.isInstalling
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
  rank_keys: string[];
};

function RankManagement() {
  const [actorId, setActorId] = useState<string | null>(null);
  const [actorRank, setActorRank] = useState<string | null>(null);
  const [canManageRanks, setCanManageRanks] = useState(false);
  const [members, setMembers] = useState<ManagedCommunityProfile[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedRank, setSelectedRank] = useState("member");
  const [selectedRanks, setSelectedRanks] = useState<string[]>(["member"]);
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

      const { data: permissionData, error: permissionError } = await supabase.rpc("has_rank_permission", {
        p_scope: "community",
        p_permission_key: "ranks.manage",
      });
      if (permissionError) throw permissionError;
      const permitted = permissionData === true || resolvedRank === "founder" || actor?.is_founder === true;
      setCanManageRanks(permitted);
      if (!permitted) {
        setMembers([]);
        return;
      }

      const { data, error: membersError } = await supabase.rpc(
        "search_rank_management_profiles",
        { search_term: search.trim() },
      );
      if (membersError) throw membersError;
      const profileRows = (data ?? []) as Omit<ManagedCommunityProfile, "rank_keys">[];
      const { data: rankRows, error: rankRowsError } = await supabase.rpc("get_profile_ranks", {
        p_profile_ids: profileRows.map((member) => member.id),
      });
      if (rankRowsError) throw rankRowsError;
      const rankMap = new Map<string, string[]>();
      for (const rankRow of rankRows ?? []) {
        const keys = rankMap.get(rankRow.profile_id) ?? [];
        keys.push(rankRow.rank_key);
        rankMap.set(rankRow.profile_id, keys);
      }
      setMembers(profileRows.map((member) => ({
        ...member,
        rank_keys: rankMap.get(member.id) ?? [member.rank_key || "member"],
      })));
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadMembers(); }, []);

  useEffect(() => {
    if (!canManageRanks) return;
    const refresh = async () => {
      try {
        const { data, error: queryError } = await supabase.rpc(
          "search_rank_management_profiles",
          { search_term: search.trim() },
        );
        if (queryError) throw queryError;
        const profileRows = (data ?? []) as Omit<ManagedCommunityProfile, "rank_keys">[];
      const { data: rankRows, error: rankRowsError } = await supabase.rpc("get_profile_ranks", {
        p_profile_ids: profileRows.map((member) => member.id),
      });
      if (rankRowsError) throw rankRowsError;
      const rankMap = new Map<string, string[]>();
      for (const rankRow of rankRows ?? []) {
        const keys = rankMap.get(rankRow.profile_id) ?? [];
        keys.push(rankRow.rank_key);
        rankMap.set(rankRow.profile_id, keys);
      }
      setMembers(profileRows.map((member) => ({
        ...member,
        rank_keys: rankMap.get(member.id) ?? [member.rank_key || "member"],
      })));
      } catch (searchError) {
        setError(errorText(searchError));
      }
    };
    void refresh();
  }, [search, canManageRanks]);

  const selectedMember = members.find((member) => member.id === selectedId) ?? null;
  const filteredMembers = members;
  const rankEntries = Object.entries(COMMUNITY_RANKS).filter(([key]) => key !== "founder" && key !== "beta").sort(([a], [b]) =>
    COMMUNITY_RANK_ORDER.indexOf(a as (typeof COMMUNITY_RANK_ORDER)[number]) -
    COMMUNITY_RANK_ORDER.indexOf(b as (typeof COMMUNITY_RANK_ORDER)[number]),
  );

  const assignRank = async () => {
    if (!selectedMember) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { error: assignError } = await supabase.rpc("assign_community_ranks", {
        target_profile_id: selectedMember.id,
        requested_rank_keys: selectedRanks,
      });
      if (assignError) throw assignError;
      setMessage(`Updated @${selectedMember.username} to ${selectedRanks.map((key) => COMMUNITY_RANKS[key]?.label ?? key).join(", ")}.`);
      await loadMembers();
    } catch (saveError) {
      setError(errorText(saveError));
    } finally {
      setSaving(false);
    }
  };

  const actorRankIndex = COMMUNITY_RANK_ORDER.indexOf(
    (actorRank ?? "member") as (typeof COMMUNITY_RANK_ORDER)[number],
  );
  const selectedRankIndex = COMMUNITY_RANK_ORDER.indexOf(
    selectedRank as (typeof COMMUNITY_RANK_ORDER)[number],
  );
  const targetRankIndex = selectedMember
    ? COMMUNITY_RANK_ORDER.indexOf(
        (selectedMember.rank_key || "member") as (typeof COMMUNITY_RANK_ORDER)[number],
      )
    : -1;
  const isFounder = actorRank === "founder";
  const protectedTarget = !isFounder && selectedMember !== null && targetRankIndex >= 0 &&
    actorRankIndex >= 0 && targetRankIndex <= actorRankIndex;
  const canManageTarget = canManageRanks && Boolean(selectedMember) &&
    (selectedMember?.id !== actorId || (isFounder && selectedMember?.rank_key === "founder")) &&
    !protectedTarget &&
    (selectedRank !== "founder" || (isFounder && selectedMember?.rank_key === "founder")) &&
    (selectedRankIndex > actorRankIndex || (isFounder && selectedMember?.rank_key === "founder"));

  return (
    <section className="section-card developer-card">
      <div className="section-header">
        <div>
          <span className="card-label">COMMUNITY ADMINISTRATION</span>
          <h3>Rank Management</h3>
        </div>
        <span className={`developer-status ${canManageRanks ? "active" : ""}`}>
          {canManageRanks ? (actorRank === "founder" ? "Founder access" : actorRank === "owner" ? "Owner access" : actorRank === "plat_admin" ? "Plat Admin access" : "Rank management access") : "Restricted"}
        </span>
      </div>
      <p className="subtitle">Search for a community member, review their current rank, and assign a new rank or reset them to Member.</p>
      {loading ? <p className="subtitle">Loading community members…</p> :
        !canManageRanks ? (
          <div className="developer-warning">
            <span className="developer-warning-icon">!</span>
            <div><strong>Access denied</strong><p>Your account does not have the community ranks.manage permission.</p></div>
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
                if (member) { setSelectedRank(member.rank_key || "member"); setSelectedRanks(member.rank_keys?.length ? member.rank_keys : [member.rank_key || "member"]); }
              }}>
                <option value="">Select a member…</option>
                {filteredMembers.map((member) => (
                  <option key={member.id} value={member.id}>@{member.username} · {(member.rank_keys ?? [member.rank_key]).map((key) => COMMUNITY_RANKS[key]?.label ?? key).join(" + ")}</option>
                ))}
              </select>
            </label>
            {selectedMember && (
              <>
                <div className="developer-info-grid">
                  <div><span>Username</span><strong>@{selectedMember.username}</strong></div>
                  <div><span>Current rank</span><strong style={{ color: COMMUNITY_RANKS[selectedMember.rank_key]?.color ?? "#C3BFE0" }}>{COMMUNITY_RANKS[selectedMember.rank_key]?.label ?? selectedMember.rank_key}</strong></div>
                </div>
                <div className="setting-line developer-setting-line rank-checkbox-setting">
                  <span>Assign their rank</span>
                  <div className="rank-checkbox-grid">
                    {rankEntries.map(([key, rank]) => {
                      const rankIndex = COMMUNITY_RANK_ORDER.indexOf(
                        key as (typeof COMMUNITY_RANK_ORDER)[number],
                      );
                      const cannotAssign = (key === "founder" && (!isFounder || selectedMember.rank_key === "founder")) ||
                        (!isFounder && rankIndex <= actorRankIndex);
                      return (
                        <label key={key} className="rank-checkbox-option">
                          <input
                            type="checkbox"
                            checked={selectedRanks.includes(key)}
                            disabled={cannotAssign || (key === "the_nibbler" && !isFounder)}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...selectedRanks, key]
                                : selectedRanks.filter((item) => item !== key);
                              if (!next.length) return;
                              const ordered = next.sort((a, b) =>
                                COMMUNITY_RANK_ORDER.indexOf(a as (typeof COMMUNITY_RANK_ORDER)[number]) -
                                COMMUNITY_RANK_ORDER.indexOf(b as (typeof COMMUNITY_RANK_ORDER)[number])
                              );
                              setSelectedRanks(ordered);
                              setSelectedRank(ordered[0]);
                            }}
                          />
                          <span style={{ color: rank.color }}>{rank.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <small className="subtitle">The highest rank becomes the primary rank. The Nibbler is Founder-only and limited to two accounts.</small>
                </div>
                <div className="developer-actions">
                  <button className="friends-primary rank-save-button" type="button" disabled={saving || !canManageTarget || selectedRanks.slice().sort((a, b) => COMMUNITY_RANK_ORDER.indexOf(a as (typeof COMMUNITY_RANK_ORDER)[number]) - COMMUNITY_RANK_ORDER.indexOf(b as (typeof COMMUNITY_RANK_ORDER)[number])).join(",") === (selectedMember.rank_keys ?? [selectedMember.rank_key]).slice().sort((a, b) => COMMUNITY_RANK_ORDER.indexOf(a as (typeof COMMUNITY_RANK_ORDER)[number]) - COMMUNITY_RANK_ORDER.indexOf(b as (typeof COMMUNITY_RANK_ORDER)[number])).join(",")} onClick={() => void assignRank()}>
                    {saving ? "Saving…" : "Save rank"}
                  </button>
                  <button className="friends-secondary" type="button" disabled={saving || !canManageTarget || selectedMember.rank_key === "founder" || selectedMember.rank_key === "member"} onClick={() => { setSelectedRank("member"); setSelectedRanks(["member"]); void (async () => {
                    setSaving(true); setError(""); setMessage("");
                    try {
                      const { error: assignError } = await supabase.rpc("assign_community_ranks", { target_profile_id: selectedMember.id, requested_rank_keys: ["member"] });
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
                    protectedTarget ? "You cannot change a member whose rank is equal to or higher than yours." :
                    selectedRank === "founder" ? "Founder rank cannot be assigned here." :
                    selectedRankIndex <= actorRankIndex ? "You cannot assign a rank equal to or higher than your own." :
                    "This rank change is not permitted."}
                </p>}
                {canManageTarget && selectedRanks.slice().sort((a, b) => COMMUNITY_RANK_ORDER.indexOf(a as (typeof COMMUNITY_RANK_ORDER)[number]) - COMMUNITY_RANK_ORDER.indexOf(b as (typeof COMMUNITY_RANK_ORDER)[number])).join(",") === (selectedMember.rank_keys ?? [selectedMember.rank_key]).slice().sort((a, b) => COMMUNITY_RANK_ORDER.indexOf(a as (typeof COMMUNITY_RANK_ORDER)[number]) - COMMUNITY_RANK_ORDER.indexOf(b as (typeof COMMUNITY_RANK_ORDER)[number])).join(",") && <p className="subtitle">Choose a different rank to enable Save rank.</p>}
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
                  } as Record<string, string>)[row.action] ?? row.action.replace(/_/g, " ")}</strong>
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
  | "Mods"
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
    name: "Mods",
    description: "Manage AlphaClient mod access, rank defaults, and player grants.",
    icon: "▦",
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
  canManageReleases,
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
  canManageReleases: boolean;
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
  const [activeReleaseSection, setActiveReleaseSection] = useState<"Changelogs" | "Releases" | null>(null);
  const [activeReleaseTool, setActiveReleaseTool] = useState<"Built JARs" | "Publish release" | "Official version" | "Test versions" | null>(null);
  const [activeRolloutSection, setActiveRolloutSection] = useState<"Rollout plans" | "Audience targeting" | "Rollout schedule" | "Monitoring" | null>(null);
  const [activeChangeReviewSection, setActiveChangeReviewSection] = useState<"Review Changelogs" | "Review Rank Management" | "Review Mod Changes" | "Review Audit Timeline" | null>(null);
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
          <p className="subtitle">Checking Supabase session and developer permissions…</p>
        </section>
      </div>
    );
  }

  if (!developerAuthorized && !canManageReleases) {
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
              Signed in as {developerUserEmail}, but this account does not have
              verified developer permissions.
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

            {developerTools
              .filter((tool) => developerAuthorized || tool.name === "Release Manager")
              .map((tool) => (
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
            {developerAuthorized && activeTool === "Rank Management" && <RankManagement />}
            {developerAuthorized && activeTool === "Mods" && <ClientModPermissionsManager />}

            {developerAuthorized && activeTool === "Permission Explorer" &&
              renderPlaceholder(
                "Permission Explorer",
                "Explore available actions, which ranks receive them, and where each permission is used.",
              )}

            {developerAuthorized && activeTool === "Audit Timeline" && <AuditTimeline />}

            {developerAuthorized && activeTool === "Change Review" && (
              <section className="section-card developer-card change-review-manager">
                {activeChangeReviewSection === null ? (
                  <>
                    <div className="section-header">
                      <div>
                        <span className="card-label">CHANGE CONTROL</span>
                        <h3>Change Review</h3>
                      </div>
                    </div>
                    <p className="subtitle">Choose the area whose proposed changes you want to review.</p>
                    <div className="release-overview-grid">
                      <button type="button" className="release-overview-card" onClick={() => setActiveChangeReviewSection("Review Changelogs")}>
                        <span className="release-overview-icon" aria-hidden="true">▤</span>
                        <strong>Review Changelogs</strong>
                        <small>Review proposed changelog edits before they are applied.</small>
                      </button>
                      <button type="button" className="release-overview-card" onClick={() => setActiveChangeReviewSection("Review Rank Management")}>
                        <span className="release-overview-icon" aria-hidden="true">◆</span>
                        <strong>Review Rank Management</strong>
                        <small>Review proposed rank and rank-assignment changes.</small>
                      </button>
                      <button type="button" className="release-overview-card" onClick={() => setActiveChangeReviewSection("Review Mod Changes")}>
                        <span className="release-overview-icon" aria-hidden="true">▦</span>
                        <strong>Review Mod Changes</strong>
                        <small>Review proposed AlphaClient mod permission changes.</small>
                      </button>
                      <button type="button" className="release-overview-card" onClick={() => setActiveChangeReviewSection("Review Audit Timeline")}>
                        <span className="release-overview-icon" aria-hidden="true">◷</span>
                        <strong>Review Audit Timeline</strong>
                        <small>Review audit history relevant to proposed changes.</small>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="release-tool-detail">
                    <button type="button" className="release-manager-back" onClick={() => setActiveChangeReviewSection(null)}>
                      <span aria-hidden="true">←</span> Back to Change Review
                    </button>
                    <div className="section-header">
                      <div>
                        <span className="card-label">CHANGE CONTROL</span>
                        <h3>{activeChangeReviewSection}</h3>
                      </div>
                    </div>
                    <p className="subtitle">This section is ready for navigation. Change review workflows are not connected yet.</p>
                  </div>
                )}
              </section>
            )}

            {developerAuthorized && activeTool === "Development Sandbox" && (
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

            {developerAuthorized && activeTool === "Feature Rollout Manager" && (
              <section className="section-card developer-card rollout-manager">
                {activeRolloutSection === null ? (
                  <>
                    <div className="section-header">
                      <div>
                        <span className="card-label">CONTROLLED DEPLOYMENT</span>
                        <h3>Feature Rollout Manager</h3>
                      </div>
                      <span className="developer-status">Not connected</span>
                    </div>
                    <p className="subtitle">
                      Plan staged AlphaClient updates so they reach users in controlled groups instead of everyone at once.
                    </p>
                    <div className="release-overview-grid">
                      <button type="button" className="release-overview-card" onClick={() => setActiveRolloutSection("Rollout plans")}>
                        <span className="release-overview-icon" aria-hidden="true">▤</span>
                        <strong>Rollout plans</strong>
                        <small>Create and review staged rollout plans for a client version.</small>
                      </button>
                      <button type="button" className="release-overview-card" onClick={() => setActiveRolloutSection("Audience targeting")}>
                        <span className="release-overview-icon" aria-hidden="true">◎</span>
                        <strong>Audience targeting</strong>
                        <small>Plan how users are grouped and how many receive an update per wave.</small>
                      </button>
                      <button type="button" className="release-overview-card" onClick={() => setActiveRolloutSection("Rollout schedule")}>
                        <span className="release-overview-icon" aria-hidden="true">◷</span>
                        <strong>Rollout schedule</strong>
                        <small>Plan wave timing, pauses, and gradual percentage increases.</small>
                      </button>
                      <button type="button" className="release-overview-card" onClick={() => setActiveRolloutSection("Monitoring")}>
                        <span className="release-overview-icon" aria-hidden="true">⌁</span>
                        <strong>Monitoring</strong>
                        <small>Review rollout progress and plan when to pause or continue.</small>
                      </button>
                    </div>
                    <div className="developer-warning">
                      <span className="developer-warning-icon">i</span>
                      <div>
                        <strong>Rollout execution is not connected yet</strong>
                        <p>These sections are navigation and planning placeholders. They do not change who receives an update until rollout rules are connected to a secure backend and enforced by the launcher update flow.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="release-tool-detail">
                    <button type="button" className="release-manager-back" onClick={() => setActiveRolloutSection(null)}>
                      <span aria-hidden="true">←</span> Back to Feature Rollout Manager
                    </button>
                    <div className="section-header">
                      <div>
                        <span className="card-label">CONTROLLED DEPLOYMENT</span>
                        <h3>{activeRolloutSection}</h3>
                      </div>
                      <span className="developer-status">Not connected</span>
                    </div>
                    <p className="subtitle">This section is ready for navigation. Rollout configuration and update delivery are not connected yet.</p>
                  </div>
                )}
              </section>
            )}

            {activeTool === "Release Manager" && (
              <>
                {activeReleaseSection === null && (
                  <>
                  <div className="release-manager-header">
                    <div>
                      <span className="card-label">RELEASE WORKSPACE</span>
                      <h3>Release Manager</h3>
                      <p>Choose whether to manage changelogs or client releases.</p>
                    </div>
                  </div>
                  <div className="release-manager-nav" aria-label="Release Manager sections">
                    <button
                      type="button"
                      className={`release-manager-nav-item ${activeReleaseSection === "Changelogs" ? "active" : ""}`}
                      onClick={() => setActiveReleaseSection("Changelogs")}
                    >
                      <span className="release-manager-nav-icon release-folder-icon" aria-hidden="true">▰</span>
                      <span>
                        <strong>Changelogs</strong>
                        <small>Edit and publish launcher/client changelogs</small>
                      </span>
                      <span className="release-manager-chevron" aria-hidden="true">›</span>
                    </button>
                    <button
                      type="button"
                      className={`release-manager-nav-item ${activeReleaseSection === "Releases" ? "active" : ""}`}
                      onClick={() => setActiveReleaseSection("Releases")}
                    >
                      <span className="release-manager-nav-icon release-folder-icon" aria-hidden="true">▰</span>
                      <span>
                        <strong>Releases</strong>
                        <small>Build selection and official version management</small>
                      </span>
                      <span className="release-manager-chevron" aria-hidden="true">›</span>
                    </button>
                  </div>
                  </>
                )}
                {activeReleaseSection === "Changelogs" && (
                  <>
                    <button type="button" className="release-manager-back" onClick={() => setActiveReleaseSection(null)}>
                      <span aria-hidden="true">←</span> Back to Release Manager
                    </button>
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
                  Version
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
                  Title
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
                    "Added — New features\nFixed — Bug fixes\nImproved — Improvements"
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
                      changelogMessage.toLowerCase().includes("failed") ||
                      changelogMessage.toLowerCase().includes("not authorized")
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
                  </>
                )}
                {activeReleaseSection === "Releases" && (
                  <>
                    <button type="button" className="release-manager-back" onClick={() => setActiveReleaseSection(null)}>
                      <span aria-hidden="true">←</span> Back to Release Manager
                    </button>
                    <section className="section-card developer-card release-overview">
                    <div className="section-header">
                      <div>
                        <span className="card-label">ALPHACLIENT RELEASES</span>
                        <h3>Release management</h3>
                      </div>
                      <span className="developer-status">Not connected</span>
                    </div>
                    <p className="subtitle">
                      This is the dedicated Releases workspace. The next step is connecting build discovery, JAR metadata reading,
                      release publishing, and the official-version setting to the release backend.
                    </p>
                    {activeReleaseTool === null ? (
                      <>
                        <div className="release-overview-grid">
                          <button type="button" className="release-overview-card" onClick={() => setActiveReleaseTool("Built JARs")}>
                            <span className="release-overview-icon" aria-hidden="true">▣</span>
                            <strong>Built JARs</strong>
                            <small>Find local AlphaClient builds and read each JAR's actual version.</small>
                          </button>
                          <button type="button" className="release-overview-card" onClick={() => setActiveReleaseTool("Publish release")}>
                            <span className="release-overview-icon" aria-hidden="true">↑</span>
                            <strong>Publish release</strong>
                            <small>Publish a selected build as an official AlphaClient release.</small>
                          </button>
                          <button type="button" className="release-overview-card" onClick={() => setActiveReleaseTool("Official version")}>
                            <span className="release-overview-icon" aria-hidden="true">★</span>
                            <strong>Official version</strong>
                            <small>Choose the version ordinary launcher users receive by default.</small>
                          </button>
                          <button type="button" className="release-overview-card" onClick={() => setActiveReleaseTool("Test versions")}>
                            <span className="release-overview-icon" aria-hidden="true">⌁</span>
                            <strong>Test versions</strong>
                            <small>Keep older or test builds available for your own development use.</small>
                          </button>
                        </div>
                        <div className="developer-warning">
                          <span className="developer-warning-icon">i</span>
                          <div>
                            <strong>Release actions are not enabled yet</strong>
                            <p>
                              No release has been published or changed by this screen. Publishing and official-version selection
                              need a secure backend connection before these actions can be enabled.
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="release-tool-detail">
                        <button type="button" className="release-manager-back" onClick={() => setActiveReleaseTool(null)}>
                          <span aria-hidden="true">←</span> Back to Releases
                        </button>
                        <div className="section-header">
                          <div>
                            <span className="card-label">ALPHACLIENT RELEASES</span>
                            <h3>{activeReleaseTool}</h3>
                          </div>
                          <span className="developer-status">Not connected</span>
                        </div>
                        <p className="subtitle">
                          This section is ready for navigation. Its release-management functionality has not been connected yet.
                        </p>
                      </div>
                    )}

                    </section>
                  </>
                )}
              </>
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
  savedAccounts,
  onSwitchAccount,
  isLoggingIn,
  isMinecraftRunning,
  loginError,
  onLogin,
  onLogout,
}: {
  account: MicrosoftAccount | null;
  savedAccounts: MicrosoftAccount[];
  onSwitchAccount: (account: MicrosoftAccount) => void;
  isLoggingIn: boolean;
  isMinecraftRunning: boolean;
  loginError: string | null;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const [savedAccountsExpanded, setSavedAccountsExpanded] = useState(false);

  return (
    <div className="page">
      <PageTitle
        eyebrow="MINECRAFT ACCOUNT"
        title="Your account"
        description="Manage the Microsoft account used by AlphaClient."
      />

      <div className={`account-large-card account-large-card-toggle${savedAccountsExpanded ? " is-expanded" : ""}`} role="button" tabIndex={0} onClick={() => setSavedAccountsExpanded((expanded) => !expanded)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSavedAccountsExpanded((expanded) => !expanded); } }} aria-expanded={savedAccountsExpanded} aria-controls="account-saved-microsoft-accounts-panel">
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
        <span className="account-large-chevron" aria-hidden="true">{savedAccountsExpanded ? "⌃" : "⌄"}</span>
      </div>

        <div id="account-saved-microsoft-accounts-panel" className={`saved-accounts-collapse account-saved-accounts-panel${savedAccountsExpanded ? " is-expanded" : ""}`} aria-hidden={!savedAccountsExpanded}>
          <div className="saved-accounts-collapse-inner">
            {savedAccounts.length === 0 ? (
              <p className="subtitle">No saved accounts yet. Log in with Microsoft to add one.</p>
            ) : (
              <div className="saved-accounts-list">
                {savedAccounts.map((savedAccount) => (
                  <div className="saved-account-row" key={savedAccount.uuid ?? savedAccount.email}>
                    <img src={`https://mc-heads.net/avatar/${encodeURIComponent(savedAccount.name)}/48`} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                    <div className="saved-account-copy">
                      <strong>{savedAccount.name}</strong>
                      <span>{savedAccount.email}</span>
                    </div>
                    {(savedAccount.uuid && account?.uuid === savedAccount.uuid) || account?.email.toLowerCase() === savedAccount.email.toLowerCase() ? (
                      <span className="saved-account-current">Current account</span>
                    ) : (
                      <button type="button" className="small-button" onClick={() => onSwitchAccount(savedAccount)} disabled={isLoggingIn || isMinecraftRunning} title={isMinecraftRunning ? "Close Minecraft before switching accounts." : undefined}>
                        {isLoggingIn ? "Waiting…" : "Your Accounts"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="saved-accounts-note">Account names are saved on this device. Choosing an account starts Microsoft sign-in with that email as a hint; the launcher does not store Microsoft passwords.</p>
          </div>
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
              disabled={isLoggingIn || isMinecraftRunning}
              title={isMinecraftRunning ? "Close Minecraft before switching accounts." : undefined}
            >
              {isMinecraftRunning ? "MINECRAFT IS RUNNING" : isLoggingIn ? "LOGGING IN..." : "SWITCH ACCOUNT"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={onLogout}
              disabled={isMinecraftRunning}
              title={isMinecraftRunning ? "Close Minecraft before logging out." : undefined}
            >
              {isMinecraftRunning ? "MINECRAFT IS RUNNING" : "LOG OUT"}
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