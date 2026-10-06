import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type Page =
  | "Home"
  | "Play"
  | "Versions"
  | "Mods"
  | "Settings"
  | "Account";

type NavigationItem = {
  name: Page;
  icon: string;
};

type ModItem = {
  name: string;
  description: string;
  enabled: boolean;
};

type MicrosoftAccount = {
  name: string;
  email: string;
};

function App() {
  const [page, setPage] = useState<Page>("Home");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const [account, setAccount] =
    useState<MicrosoftAccount | null>(null);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] =
    useState<string | null>(null);

  const handlePlay = async () => {
    if (isLaunching) return;

    setIsLaunching(true);
    setLaunchError(null);

    try {
      await invoke("launch_alphaclient");
    } catch (error) {
      console.error(
        "Failed to launch AlphaClient:",
        error
      );

      setLaunchError(
        error instanceof Error
          ? error.message
          : String(error)
      );
    } finally {
      setIsLaunching(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    if (isLoggingIn) return;

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const result =
        await invoke<MicrosoftAccount>(
          "start_microsoft_login"
        );

      setAccount(result);
    } catch (error) {
      console.error(
        "Microsoft login failed:",
        error
      );

      setLoginError(
        error instanceof Error
          ? error.message
          : String(error)
      );
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
      console.error(
        "Microsoft logout failed:",
        error
      );
    }
  };

  const navigation: NavigationItem[] = [
    { name: "Home", icon: "⌂" },
    { name: "Play", icon: "▶" },
    { name: "Versions", icon: "▣" },
    { name: "Mods", icon: "◆" },
  ];

  const secondaryNavigation: NavigationItem[] = [
    { name: "Settings", icon: "⚙" },
    { name: "Account", icon: "●" },
  ];

  return (
    <div className="launcher">
      <header className="titlebar">
        <div className="brand">
          <div
            className="brand-mark"
            aria-hidden="true"
            style={{
              background: "#24262C",
              border: "1px solid #3A3C44",
              borderRadius: "12px",
              boxShadow:
                "0 8px 20px rgba(0, 0, 0, 0.25)",
            }}
          >
            <svg
              className="alpha-logo"
              viewBox="0 0 100 100"
              focusable="false"
            >
              <path
                d="M50 7L12 91H30L38 73H62L70 91H88L50 7ZM45 59L50 46L55 59H45Z"
                fill="#07070A"
              />

              <path
                d="M34 79L42 59L48 43L56 25L63 11L70 25L62 38L56 51L49 66L43 80L34 79Z"
                fill="#101114"
              />

              <path
                d="M34 79L42 59L48 43L56 25L63 11L70 25L62 38L56 51L49 66L43 80L34 79Z"
                fill="#FFC83D"
              />

              <path
                d="M50 43L57 50L50 58L43 50L50 43Z"
                fill="#FFC83D"
              />

              <path
                d="M63 11L78 20L69 27L62 20L63 11Z"
                fill="#FFC83D"
              />
            </svg>
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
          >
            −
          </button>

          <button
            type="button"
            aria-label="Maximize"
          >
            □
          </button>

          <button
            type="button"
            className="close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </header>

      <div className="launcher-body">
        <aside
          className={`sidebar ${
            sidebarExpanded
              ? "expanded"
              : "collapsed"
          }`}
        >
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() =>
              setSidebarExpanded(
                (expanded) => !expanded
              )
            }
            aria-label="Toggle sidebar"
          >
            {sidebarExpanded ? "‹" : "›"}
          </button>

          <nav className="navigation">
            {navigation.map((item) => (
              <button
                type="button"
                key={item.name}
                className={`nav-item ${
                  page === item.name
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setPage(item.name)
                }
              >
                <span className="nav-icon">
                  {item.icon}
                </span>

                {sidebarExpanded && (
                  <span>{item.name}</span>
                )}
              </button>
            ))}

            <div className="nav-separator" />

            {secondaryNavigation.map(
              (item) => (
                <button
                  type="button"
                  key={item.name}
                  className={`nav-item ${
                    page === item.name
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setPage(item.name)
                  }
                >
                  <span className="nav-icon">
                    {item.icon}
                  </span>

                  {sidebarExpanded && (
                    <span>
                      {item.name}
                    </span>
                  )}
                </button>
              )
            )}

            {sidebarExpanded && (
              <div className="nav-partner">
                <div className="nav-section-label">
                  PARTNER
                </div>

                <button
                  type="button"
                  className="partner-nav-item"
                >
                  <span className="nav-icon">
                    ◈
                  </span>

                  <span className="partner-nav-content">
                    <strong>
                      Alpha.rip
                    </strong>

                    <small>
                      Partner Server
                    </small>
                  </span>
                </button>
              </div>
            )}
          </nav>

          {sidebarExpanded && (
            <div className="sidebar-version">
              <span>AlphaClient</span>
              <strong>v0.3.79</strong>
            </div>
          )}
        </aside>

        <main className="content">
          {page === "Home" && (
            <HomePage
              onPlay={handlePlay}
              isLaunching={isLaunching}
              launchError={launchError}
              account={account}
            />
          )}

          {page === "Play" && (
            <PlayPage
              onPlay={handlePlay}
              isLaunching={isLaunching}
              launchError={launchError}
            />
          )}

          {page === "Versions" && (
            <VersionsPage />
          )}

          {page === "Mods" && (
            <ModsPage />
          )}

          {page === "Settings" && (
            <SettingsPage />
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
    </div>
  );
}

function HomePage({
  onPlay,
  isLaunching,
  launchError,
  account,
}: {
  onPlay: () => void;
  isLaunching: boolean;
  launchError: string | null;
  account: MicrosoftAccount | null;
}) {
  return (
    <div className="page">
      <div className="page-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "12px",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: "88px",
              height: "88px",
              flex: "0 0 88px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "16px",
              background: "#24262C",
              border: "1px solid #3A3C44",
              boxShadow:
                "0 12px 30px rgba(0, 0, 0, 0.28)",
            }}
          >
            <svg
              viewBox="0 0 100 100"
              width="72"
              height="72"
              focusable="false"
            >
              <path
                d="M18 88L44 12H56L82 88H67L59 64H41L33 88H18ZM45 52H55L50 34L45 52Z"
                fill="#07070A"
                fillRule="evenodd"
              />

              <path
                d="M25 82L47 18H53L75 82H67L55 45L50 28L45 45L33 82H25Z"
                fill="#101114"
              />

              <path
                d="M24 72L39 57L49 65L72 41L78 47L49 76L39 68L29 79Z"
                fill="#FFC83D"
              />

              <path
                d="M27 70L39 59L49 67L72 44L75 47L49 72L39 64L30 75Z"
                fill="#FFD866"
              />

              <path
                d="M70 41L87 34L80 51L75 47Z"
                fill="#FFC83D"
              />

              <path
                d="M50 38L58 51L50 64L42 51L50 38Z"
                fill="#FFC83D"
              />

              <path
                d="M50 38L58 51L50 51Z"
                fill="#FFD866"
              />
            </svg>
          </div>

          <div>
            <p className="eyebrow">
              ALPHACLIENT
            </p>

            <h1>Welcome back</h1>
          </div>
        </div>

        <p className="subtitle">
          Your Minecraft experience is ready.
        </p>
      </div>

      <section className="home-grid">
        <div className="hero-card">
          <div className="hero-glow" />

          <div className="hero-content">
            <div className="hero-brand">
              <div className="hero-brand-copy">
                <strong>
                  AlphaClient
                </strong>

                <span>
                  MINECRAFT 1.8.9 · FORGE
                </span>
              </div>
            </div>

            <span className="version-badge">
              VERSION 0.3.79
            </span>

            <p>
              A modern Minecraft client built
              for performance, customization
              and staff tools.
            </p>

            <div className="hero-meta">
              <span>
                Minecraft 1.8.9
              </span>

              <span>•</span>

              <span>Forge</span>
            </div>

            <button
              type="button"
              className="play-button"
              onClick={onPlay}
              disabled={isLaunching}
            >
              <span>▶</span>

              {isLaunching
                ? "STARTING..."
                : "PLAY"}
            </button>

            {launchError && (
              <p className="launch-error">
                {launchError}
              </p>
            )}
          </div>
        </div>

        <div className="side-cards">
          <div className="info-card">
            <div className="card-label">
              ACCOUNT
            </div>

            <div className="account-row">
              <div className="avatar">
                {account?.name
                  ?.charAt(0)
                  ?.toUpperCase() ?? "?"}
              </div>

              <div>
                <strong>
                  {account?.name ??
                    "Not connected"}
                </strong>

                <span>
                  {account?.email ??
                    "Microsoft Account"}
                </span>
              </div>

              <div
                className={`online-dot ${
                  account
                    ? ""
                    : "offline"
                }`}
              />
            </div>
          </div>

          <div className="info-card">
            <div className="card-label">
              CLIENT STATUS
            </div>

            <div className="status-row">
              <div className="status-icon">
                ✓
              </div>

              <div>
                <strong>
                  Everything is up to date
                </strong>

                <span>
                  AlphaClient 0.3.79
                </span>
              </div>
            </div>
          </div>

          <div className="info-card update-card">
            <div className="card-label">
              UPDATES
            </div>

            <strong>
              You are running the latest
              version.
            </strong>

            <button
              type="button"
              className="text-button"
            >
              View changelog →
            </button>
          </div>
        </div>
      </section>

      <section className="lower-grid">
        <div className="section-card">
          <div className="section-header">
            <div>
              <span className="card-label">
                LATEST
              </span>

              <h3>News</h3>
            </div>

            <button
              type="button"
              className="text-button"
            >
              View all →
            </button>
          </div>

          <div className="news-list">
            <div className="news-item">
              <div className="news-icon">
                A
              </div>

              <div>
                <strong>
                  Welcome to AlphaClient
                  0.3.79
                </strong>

                <span>
                  New improvements and
                  performance updates.
                </span>
              </div>

              <time>Today</time>
            </div>

            <div className="news-item">
              <div className="news-icon">
                +
              </div>

              <div>
                <strong>
                  Alpha Launcher
                </strong>

                <span>
                  A new launcher experience
                  is coming together.
                </span>
              </div>

              <time>Recently</time>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-header">
            <div>
              <span className="card-label">
                HISTORY
              </span>

              <h3>Last played</h3>
            </div>
          </div>

          <div className="last-played">
            <div className="minecraft-icon">
              A
            </div>

            <div>
              <strong>
                AlphaClient
              </strong>

              <span>
                Minecraft 1.8.9 • Forge
              </span>
            </div>

            <div className="played-time">
              <strong>
                0h 00m
              </strong>

              <span>
                Not played yet
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PlayPage({
  onPlay,
  isLaunching,
  launchError,
}: {
  onPlay: () => void;
  isLaunching: boolean;
  launchError: string | null;
}) {
  return (
    <div className="page">
      <PageTitle
        eyebrow="PLAY"
        title="Start AlphaClient"
        description="Choose an installation and launch Minecraft."
      />

      <div className="installation-card selected">
        <div className="installation-icon">
          A
        </div>

        <div className="installation-info">
          <span className="card-label">
            SELECTED INSTALLATION
          </span>

          <h2>
            AlphaClient 0.3.79
          </h2>

          <p>
            Minecraft 1.8.9 • Forge
          </p>
        </div>

        <span className="installed-badge">
          Installed
        </span>
      </div>

      <button
        type="button"
        className="large-play-button"
        onClick={onPlay}
        disabled={isLaunching}
      >
        <span>▶</span>

        {isLaunching
          ? "STARTING..."
          : "PLAY ALPHACLIENT"}
      </button>

      {launchError && (
        <p className="launch-error">
          {launchError}
        </p>
      )}
    </div>
  );
}

function VersionsPage() {
  return (
    <div className="page">
      <PageTitle
        eyebrow="VERSIONS"
        title="Versions"
        description="Manage your AlphaClient installations."
      />

      <div className="filter-row">
        <button
          type="button"
          className="filter active"
        >
          All
        </button>

        <button
          type="button"
          className="filter"
        >
          Stable
        </button>

        <button
          type="button"
          className="filter"
        >
          Beta
        </button>

        <button
          type="button"
          className="filter"
        >
          Development
        </button>
      </div>

      <div className="version-list">
        <VersionRow
          version="0.3.79"
          channel="Stable"
          minecraft="1.8.9"
          status="Installed"
        />

        <VersionRow
          version="0.3.80"
          channel="Beta"
          minecraft="1.8.9"
          status="Update available"
        />
      </div>
    </div>
  );
}

function VersionRow({
  version,
  channel,
  minecraft,
  status,
}: {
  version: string;
  channel: string;
  minecraft: string;
  status: string;
}) {
  const buttonText =
    status === "Installed"
      ? "Select"
      : "Update";

  return (
    <div className="version-row">
      <div className="version-icon">
        A
      </div>

      <div className="version-main">
        <strong>
          AlphaClient {version}
        </strong>

        <span>
          Minecraft {minecraft} • Forge
        </span>
      </div>

      <span className="channel-badge">
        {channel}
      </span>

      <span className="version-status">
        {status}
      </span>

      <button
        type="button"
        className="small-button"
      >
        {buttonText}
      </button>
    </div>
  );
}

function ModsPage() {
  const mods: ModItem[] = [
    {
      name: "AlphaCore",
      description:
        "Core systems for AlphaClient",
      enabled: true,
    },
    {
      name: "PerformanceCore",
      description:
        "FPS and rendering optimizations",
      enabled: true,
    },
    {
      name: "HUD",
      description:
        "Customizable AlphaClient HUD",
      enabled: true,
    },
    {
      name: "StaffCore",
      description:
        "Staff tools and investigation systems",
      enabled: false,
    },
  ];

  return (
    <div className="page">
      <PageTitle
        eyebrow="MODS"
        title="AlphaClient Mods"
        description="Manage your client modules."
      />

      <div className="mods-list">
        {mods.map((mod) => (
          <div
            className="mod-row"
            key={mod.name}
          >
            <div className="mod-icon">
              ◆
            </div>

            <div className="mod-info">
              <strong>
                {mod.name}
              </strong>

              <span>
                {mod.description}
              </span>
            </div>

            <button
              type="button"
              className={`toggle ${
                mod.enabled
                  ? "enabled"
                  : ""
              }`}
              aria-label={`Toggle ${mod.name}`}
            >
              <span />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="page">
      <PageTitle
        eyebrow="SETTINGS"
        title="Settings"
        description="Configure your Alpha Launcher experience."
      />

      <div className="settings-grid">
        <SettingsCard
          title="General"
          description="Launcher appearance and behavior."
        />

        <SettingsCard
          title="Minecraft"
          description="Game directory, memory and Java."
        />

        <SettingsCard
          title="Launcher"
          description="Updates, downloads and notifications."
        />

        <SettingsCard
          title="AlphaClient"
          description="Client profiles and preferences."
        />
      </div>
    </div>
  );
}

function SettingsCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      className="settings-card"
    >
      <div className="settings-icon">
        ⚙
      </div>

      <div>
        <h3>{title}</h3>

        <p>{description}</p>
      </div>

      <span className="settings-arrow">
        ›
      </span>
    </button>
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
        description="Manage your Microsoft account."
      />

      {!account ? (
        <div className="account-large-card">
          <div className="large-avatar">
            M
          </div>

          <div>
            <span className="card-label">
              MICROSOFT ACCOUNT
            </span>

            <h2>
              Not connected
            </h2>

            <p>
              Sign in with your Microsoft
              account to use AlphaClient.
            </p>
          </div>
        </div>
      ) : (
        <div className="account-large-card">
          <div className="large-avatar">
            {account.name
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <span className="card-label">
              MICROSOFT ACCOUNT
            </span>

            <h2>
              {account.name}
            </h2>

            <p>
              {account.email}
            </p>
          </div>

          <div className="account-connected">
            <span />
            Connected
          </div>
        </div>
      )}

      {loginError && (
        <p className="launch-error">
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

            {isLoggingIn
              ? "WAITING FOR MICROSOFT..."
              : "LOGIN WITH MICROSOFT"}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="secondary-button"
              onClick={onLogin}
              disabled={isLoggingIn}
            >
              {isLoggingIn
                ? "LOGGING IN..."
                : "SWITCH ACCOUNT"}
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
      <p className="eyebrow">
        {eyebrow}
      </p>

      <h1>{title}</h1>

      <p className="subtitle">
        {description}
      </p>
    </div>
  );
}

export default App;