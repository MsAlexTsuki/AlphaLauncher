use tauri::Manager;
use base64::{
    engine::general_purpose::URL_SAFE_NO_PAD,
    Engine as _,
};

use rand::{
    distributions::Alphanumeric,
    Rng,
};

use reqwest::blocking::Client;

use serde::{
    Deserialize,
    Serialize,
};

use serde_json::Value;

use sha2::{
    Digest,
    Sha256,
};

use std::{
    env,
    fs,
    fs::File,
    io::{
        Read,
        Write,
    },
    net::{
        TcpListener,
        TcpStream,
    },
    path::{
        Path,
        PathBuf,
    },
    process::Command,
    sync::{
        Mutex,
        OnceLock,
    },
    time::Duration,
};

use url::Url;

use zip::ZipArchive;


// ============================================================
// ALPHACLIENT
// ============================================================

const ALPHACLIENT_VERSION: &str = "0.3.79";

// Set this environment variable on the machine/build that distributes the launcher
// to enable the live AlphaClient release manifest. If it is not configured,
// the launcher safely continues with the installed client version.
const ALPHACLIENT_UPDATE_MANIFEST_ENV: &str = "ALPHACLIENT_UPDATE_MANIFEST_URL";

const ALPHACLIENT_VERSION_FILE: &str = "alpha-client-version.json";
const ALPHACLIENT_UPDATE_ZIP_NAME: &str = "alphaclient-update.jar";
const ALPHACLIENT_GITHUB_RELEASES_URL: &str = "https://api.github.com/repos/MsAlexTsuki/AlphaClient/releases?per_page=20";
const ALPHACLIENT_OFFICIAL_MOD_JAR_NAME: &str = "AlphaClient.jar";
const ALPHACLIENT_0_3_81_SHA256: &str = "fb2451cb5ce671a6f5b2f5229374ff1df02f0164eef83367d692f74cbb97fec2";

const MINECRAFT_VERSION: &str = "1.8.9";

const FORGE_VERSION: &str = "11.15.1.2318";

const FORGE_INSTALLER_NAME: &str =
    "forge-1.8.9-11.15.1.2318-1.8.9-installer.jar";

const FORGE_INSTALLER_URL: &str =
    "https://maven.minecraftforge.net/net/minecraftforge/forge/1.8.9-11.15.1.2318-1.8.9/forge-1.8.9-11.15.1.2318-1.8.9-installer.jar";

const FORGE_VERSION_NAME: &str =
    "1.8.9-forge1.8.9-11.15.1.2318-1.8.9";

const FORGE_UNIVERSAL_JAR_NAME: &str =
    "forge-1.8.9-11.15.1.2318-1.8.9.jar";

const VERSION_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";


// ============================================================
// MICROSOFT AUTHENTICATION
// ============================================================

const MICROSOFT_CLIENT_ID: &str =
    "06539d90-3301-4053-bb4d-409096727f7b";

const MICROSOFT_AUTHORIZE_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";

const MICROSOFT_TOKEN_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

const MICROSOFT_USERINFO_URL: &str =
    "https://graph.microsoft.com/oidc/userinfo";

const MICROSOFT_SCOPES: &str =
    "XboxLive.signin openid profile email offline_access";


// ============================================================
// XBOX LIVE / XSTS
// ============================================================

const XBOX_LIVE_AUTH_URL: &str =
    "https://user.auth.xboxlive.com/user/authenticate";

const XSTS_AUTH_URL: &str =
    "https://xsts.auth.xboxlive.com/xsts/authorize";

const XBOX_SANDBOX: &str =
    "RETAIL";


// ============================================================
// MINECRAFT SERVICES
// ============================================================

const MINECRAFT_LOGIN_WITH_XBOX_URL: &str =
    "https://api.minecraftservices.com/authentication/login_with_xbox";

const MINECRAFT_ENTITLEMENTS_URL: &str =
    "https://api.minecraftservices.com/entitlements/mcstore";

const MINECRAFT_PROFILE_URL: &str =
    "https://api.minecraftservices.com/minecraft/profile";


// ============================================================
// GLOBAL AUTH STATE
// ============================================================

#[derive(Clone, Debug, Serialize)]
struct MicrosoftAccount {
    name: String,
    email: String,
    uuid: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct InstalledAlphaClientVersion {
    version: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct AlphaClientReleaseManifest {
    version: String,
    download_url: String,
    sha256: String,
    #[serde(default)]
    changelog: String,
}

#[derive(Clone, Debug, Serialize)]
struct AlphaClientUpdateInfo {
    current_version: String,
    latest_version: String,
    update_available: bool,
    update_configured: bool,
    changelog: String,
}


static MICROSOFT_ACCOUNT: OnceLock<
    Mutex<Option<MicrosoftAccount>>
> = OnceLock::new();

static MICROSOFT_ACCESS_TOKEN: OnceLock<
    Mutex<Option<String>>
> = OnceLock::new();

static MICROSOFT_REFRESH_TOKEN: OnceLock<
    Mutex<Option<String>>
> = OnceLock::new();

static XBOX_LIVE_TOKEN: OnceLock<
    Mutex<Option<String>>
> = OnceLock::new();

static XSTS_TOKEN: OnceLock<
    Mutex<Option<String>>
> = OnceLock::new();

static XBOX_USER_HASH: OnceLock<
    Mutex<Option<String>>
> = OnceLock::new();

static MINECRAFT_ACCESS_TOKEN: OnceLock<
    Mutex<Option<String>>
> = OnceLock::new();

static MINECRAFT_UUID: OnceLock<
    Mutex<Option<String>>
> = OnceLock::new();


fn microsoft_account_state()
    -> &'static Mutex<Option<MicrosoftAccount>>
{
    MICROSOFT_ACCOUNT.get_or_init(|| {
        Mutex::new(None)
    })
}


fn microsoft_access_token_state()
    -> &'static Mutex<Option<String>>
{
    MICROSOFT_ACCESS_TOKEN.get_or_init(|| {
        Mutex::new(None)
    })
}


fn microsoft_refresh_token_state()
    -> &'static Mutex<Option<String>>
{
    MICROSOFT_REFRESH_TOKEN.get_or_init(|| {
        Mutex::new(None)
    })
}


fn xbox_live_token_state()
    -> &'static Mutex<Option<String>>
{
    XBOX_LIVE_TOKEN.get_or_init(|| {
        Mutex::new(None)
    })
}


fn xsts_token_state()
    -> &'static Mutex<Option<String>>
{
    XSTS_TOKEN.get_or_init(|| {
        Mutex::new(None)
    })
}


fn xbox_user_hash_state()
    -> &'static Mutex<Option<String>>
{
    XBOX_USER_HASH.get_or_init(|| {
        Mutex::new(None)
    })
}


fn minecraft_access_token_state()
    -> &'static Mutex<Option<String>>
{
    MINECRAFT_ACCESS_TOKEN.get_or_init(|| {
        Mutex::new(None)
    })
}


fn minecraft_uuid_state()
    -> &'static Mutex<Option<String>>
{
    MINECRAFT_UUID.get_or_init(|| {
        Mutex::new(None)
    })
}


// ============================================================
// MICROSOFT AUTH TYPES
// ============================================================

#[derive(Debug, Deserialize)]
struct MicrosoftTokenResponse {
    access_token: String,

    #[serde(default)]
    refresh_token: Option<String>,

    #[serde(default)]
    id_token: Option<String>,

    #[serde(default)]
    token_type: Option<String>,

    #[serde(default)]
    expires_in: Option<u64>,
}


#[derive(Debug, Deserialize)]
struct MicrosoftUserInfo {
    #[serde(default)]
    name: Option<String>,

    #[serde(default)]
    email: Option<String>,

    #[serde(default)]
    preferred_username: Option<String>,

    #[serde(default)]
    sub: Option<String>,

    // PKCE/OIDC nonce.
    #[serde(default)]
    nonce: Option<String>,
}


// ============================================================
// XBOX LIVE TYPES
// ============================================================

#[derive(Debug, Deserialize)]
struct XboxLiveTokenResponse {
    #[serde(rename = "Token")]
    token: String,

    #[serde(rename = "DisplayClaims")]
    display_claims: XboxDisplayClaims,
}


#[derive(Debug, Deserialize)]
struct XboxDisplayClaims {
    #[serde(rename = "xui")]
    xui: Vec<XboxUserInfoClaim>,
}


#[derive(Debug, Deserialize)]
struct XboxUserInfoClaim {
    #[serde(rename = "uhs")]
    user_hash: String,
}


#[derive(Debug, Deserialize)]
struct XstsTokenResponse {
    #[serde(rename = "Token")]
    token: String,

    #[serde(rename = "DisplayClaims")]
    display_claims: XboxDisplayClaims,
}


// ============================================================
// MINECRAFT SERVICES TYPES
// ============================================================

#[derive(Debug, Deserialize)]
struct MinecraftLoginResponse {
    access_token: String,

    #[serde(default)]
    expires_in: Option<u64>,

    #[serde(default)]
    token_type: Option<String>,
}


#[derive(Debug, Deserialize)]
struct MinecraftProfile {
    id: String,
    name: String,
}


#[derive(Debug, Deserialize)]
struct MinecraftEntitlements {
    #[serde(default)]
    items: Vec<MinecraftEntitlement>,
}


#[derive(Debug, Deserialize)]
struct MinecraftEntitlement {
    #[serde(default)]
    name: Option<String>,
}


// ============================================================
// CLEAR AUTH STATE
// ============================================================

fn clear_microsoft_auth_state() {
    if let Ok(mut value) =
        microsoft_account_state().lock()
    {
        *value = None;
    }

    if let Ok(mut value) =
        microsoft_access_token_state().lock()
    {
        *value = None;
    }

    if let Ok(mut value) =
        microsoft_refresh_token_state().lock()
    {
        *value = None;
    }

    if let Ok(mut value) =
        xbox_live_token_state().lock()
    {
        *value = None;
    }

    if let Ok(mut value) =
        xsts_token_state().lock()
    {
        *value = None;
    }

    if let Ok(mut value) =
        xbox_user_hash_state().lock()
    {
        *value = None;
    }

    if let Ok(mut value) =
        minecraft_access_token_state().lock()
    {
        *value = None;
    }

    if let Ok(mut value) =
        minecraft_uuid_state().lock()
    {
        *value = None;
    }
}


// ============================================================
// TAURI COMMANDS - MICROSOFT
// ============================================================

#[tauri::command]
async fn start_microsoft_login()
    -> Result<MicrosoftAccount, String>
{
    tauri::async_runtime::spawn_blocking(
        perform_microsoft_login
    )
    .await
    .map_err(|error| {
        format!(
            "Microsoft login task failed: {}",
            error
        )
    })?
}


#[tauri::command]
fn logout_microsoft()
    -> Result<(), String>
{
    clear_microsoft_auth_state();
    Ok(())
}


#[tauri::command]
fn get_microsoft_account()
    -> Option<MicrosoftAccount>
{
    microsoft_account_state()
        .lock()
        .ok()
        .and_then(|account| {
            account.clone()
        })
}


// ============================================================
// MICROSOFT LOGIN
// ============================================================

fn perform_microsoft_login()
    -> Result<MicrosoftAccount, String>
{
    clear_microsoft_auth_state();

    // --------------------------------------------------------
    // Start localhost callback server
    // --------------------------------------------------------

    let listener =
        TcpListener::bind(
            "127.0.0.1:0"
        )
        .map_err(|error| {
            format!(
                "Could not start Microsoft login callback: {}",
                error
            )
        })?;

    let local_address =
        listener
            .local_addr()
            .map_err(|error| {
                format!(
                    "Could not determine login callback port: {}",
                    error
                )
            })?;

    let port =
        local_address.port();

    let redirect_uri =
        format!(
            "http://localhost:{}",
            port
        );

    // --------------------------------------------------------
    // PKCE + STATE + NONCE
    // --------------------------------------------------------

    let state =
        random_string(32);

    let nonce =
        random_string(32);

    let code_verifier =
        random_string(64);

    let code_challenge =
        create_code_challenge(
            &code_verifier
        );

    // --------------------------------------------------------
    // Build Microsoft authorization URL
    // --------------------------------------------------------

    let mut authorization_url =
        Url::parse(
            MICROSOFT_AUTHORIZE_URL
        )
        .map_err(|error| {
            format!(
                "Invalid Microsoft authorization URL: {}",
                error
            )
        })?;

    authorization_url
        .query_pairs_mut()
        .append_pair(
            "client_id",
            MICROSOFT_CLIENT_ID
        )
        .append_pair(
            "response_type",
            "code"
        )
        .append_pair(
            "redirect_uri",
            redirect_uri.as_str()
        )
        .append_pair(
            "response_mode",
            "query"
        )
        .append_pair(
            "scope",
            MICROSOFT_SCOPES
        )
        .append_pair(
            "state",
            state.as_str()
        )
        .append_pair(
            "nonce",
            nonce.as_str()
        )
        .append_pair(
            "code_challenge",
            code_challenge.as_str()
        )
        .append_pair(
            "code_challenge_method",
            "S256"
        );

    // --------------------------------------------------------
    // Open browser
    // --------------------------------------------------------

    open_browser(
        authorization_url.as_str()
    )?;

    // --------------------------------------------------------
    // Wait for Microsoft callback
    // --------------------------------------------------------

    let (mut stream, _) =
        listener
            .accept()
            .map_err(|error| {
                format!(
                    "Could not receive Microsoft login callback: {}",
                    error
                )
            })?;

    // --------------------------------------------------------
    // Read callback
    // --------------------------------------------------------

    let callback_url =
        match read_callback_request(
            &mut stream
        ) {
            Ok(url) => url,

            Err(error) => {
                let _ =
                    send_callback_response(
                        &mut stream,
                        false,
                        Some(&error)
                    );

                return Err(error);
            }
        };

    // --------------------------------------------------------
    // Read callback parameters
    // --------------------------------------------------------

    let mut callback_state:
        Option<String> = None;

    let mut callback_error:
        Option<String> = None;

    let mut callback_error_description:
        Option<String> = None;

    let mut authorization_code:
        Option<String> = None;

    for (key, value) in
        callback_url.query_pairs()
    {
        let key =
            key.as_ref();

        let value =
            value.into_owned();

        match key {
            "state" => {
                callback_state =
                    Some(value);
            }

            "error" => {
                callback_error =
                    Some(value);
            }

            "error_description" => {
                callback_error_description =
                    Some(value);
            }

            "code" => {
                authorization_code =
                    Some(value);
            }

            _ => {}
        }
    }

    // --------------------------------------------------------
    // Validate state
    // --------------------------------------------------------

    if callback_state.as_deref()
        != Some(state.as_str())
    {
        let error =
            "Microsoft login state validation failed."
                .to_string();

        let _ =
            send_callback_response(
                &mut stream,
                false,
                Some(&error)
            );

        return Err(error);
    }

    // --------------------------------------------------------
    // Check OAuth error
    // --------------------------------------------------------

    if let Some(error_code) =
        callback_error
    {
        let description =
            callback_error_description
                .unwrap_or_else(|| {
                    "Microsoft login was cancelled."
                        .to_string()
                });

        let error =
            format!(
                "{}: {}",
                error_code,
                description
            );

        let _ =
            send_callback_response(
                &mut stream,
                false,
                Some(&error)
            );

        return Err(error);
    }

    // --------------------------------------------------------
    // Authorization code
    // --------------------------------------------------------

    let authorization_code =
        match authorization_code {
            Some(code) => code,

            None => {
                let error =
                    "Microsoft did not return an authorization code."
                        .to_string();

                let _ =
                    send_callback_response(
                        &mut stream,
                        false,
                        Some(&error)
                    );

                return Err(error);
            }
        };

    // --------------------------------------------------------
    // Complete authentication chain
    // --------------------------------------------------------

    let login_result:
        Result<MicrosoftAccount, String> =
        (|| {

            // ------------------------------------------------
            // Exchange authorization code using PKCE
            // ------------------------------------------------

            let token_response =
                exchange_authorization_code(
                    &authorization_code,
                    &redirect_uri,
                    &code_verifier
                )?;

            // ------------------------------------------------
            // Store Microsoft access token
            // ------------------------------------------------

            if let Ok(
                mut access_token
            ) =
                microsoft_access_token_state().lock()
            {
                *access_token =
                    Some(
                        token_response
                            .access_token
                            .clone()
                    );
            }

            // ------------------------------------------------
            // Store Microsoft refresh token
            // ------------------------------------------------

            if let Some(refresh_token) =
                token_response.refresh_token.clone()
            {
                if let Ok(
                    mut stored_refresh_token
                ) =
                    microsoft_refresh_token_state().lock()
                {
                    *stored_refresh_token =
                        Some(refresh_token);
                }
            }

            // ------------------------------------------------
            // Microsoft ID token
            // ------------------------------------------------

            let id_token =
                token_response
                    .id_token
                    .as_deref()
                    .ok_or_else(|| {
                        "Microsoft did not return an ID token. Make sure the 'openid' scope is enabled."
                            .to_string()
                    })?;

            // ------------------------------------------------
            // Validate OIDC nonce
            // ------------------------------------------------

            let microsoft_info =
                get_microsoft_user_info_from_id_token(
                    id_token,
                    &nonce
                )?;

            // ------------------------------------------------
            // Xbox Live
            // ------------------------------------------------

            let xbox_response =
                authenticate_xbox_live(
                    &token_response.access_token
                )?;

            if let Ok(
                mut stored_xbox_token
            ) =
                xbox_live_token_state().lock()
            {
                *stored_xbox_token =
                    Some(
                        xbox_response.token.clone()
                    );
            }

            // ------------------------------------------------
            // Xbox User Hash
            // ------------------------------------------------

            let user_hash =
                xbox_response
                    .display_claims
                    .xui
                    .first()
                    .map(|claim| {
                        claim.user_hash.clone()
                    })
                    .ok_or_else(|| {
                        "Xbox Live did not return a user hash."
                            .to_string()
                    })?;

            if let Ok(
                mut stored_user_hash
            ) =
                xbox_user_hash_state().lock()
            {
                *stored_user_hash =
                    Some(
                        user_hash.clone()
                    );
            }

            // ------------------------------------------------
            // XSTS
            // ------------------------------------------------

            let xsts_response =
                authenticate_xsts(
                    &xbox_response.token
                )?;

            if let Ok(
                mut stored_xsts_token
            ) =
                xsts_token_state().lock()
            {
                *stored_xsts_token =
                    Some(
                        xsts_response.token.clone()
                    );
            }

            // ------------------------------------------------
            // Minecraft Services
            // ------------------------------------------------

            let minecraft_login =
                authenticate_minecraft_services(
                    &user_hash,
                    &xsts_response.token
                )?;

            if let Ok(
                mut stored_minecraft_token
            ) =
                minecraft_access_token_state().lock()
            {
                *stored_minecraft_token =
                    Some(
                        minecraft_login.access_token.clone()
                    );
            }

            // ------------------------------------------------
            // Minecraft ownership
            // ------------------------------------------------

            verify_minecraft_entitlement(
                &minecraft_login.access_token
            )?;

            // ------------------------------------------------
            // Minecraft profile
            // ------------------------------------------------

            let minecraft_profile =
                get_minecraft_profile(
                    &minecraft_login.access_token
                )?;

            // ------------------------------------------------
            // Store Minecraft UUID
            // ------------------------------------------------

            if let Ok(
                mut stored_uuid
            ) =
                minecraft_uuid_state().lock()
            {
                *stored_uuid =
                    Some(
                        minecraft_profile.id.clone()
                    );
            }

            // ------------------------------------------------
            // Final account
            // ------------------------------------------------

            let account =
                MicrosoftAccount {
                    name:
                        minecraft_profile.name,

                    email:
                        microsoft_info.email,

                    uuid:
                        minecraft_profile.id,
                };

            // ------------------------------------------------
            // Store final account
            // ------------------------------------------------

            if let Ok(
                mut stored_account
            ) =
                microsoft_account_state().lock()
            {
                *stored_account =
                    Some(
                        account.clone()
                    );
            }

            Ok(account)

        })();

    // --------------------------------------------------------
    // Browser response
    // --------------------------------------------------------

    match login_result {
        Ok(account) => {

            let _ =
                send_callback_response(
                    &mut stream,
                    true,
                    None
                );

            Ok(account)
        }

        Err(error) => {
            clear_microsoft_auth_state();

            let _ =
                send_callback_response(
                    &mut stream,
                    false,
                    Some(&error)
                );

            Err(error)
        }
    }
}


// ============================================================
// XBOX LIVE AUTHENTICATION
// ============================================================

fn authenticate_xbox_live(
    microsoft_access_token: &str
) -> Result<XboxLiveTokenResponse, String>
{
    let client =
        http_client()?;

    let request_body =
        serde_json::json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!(
                    "d={}",
                    microsoft_access_token
                )
            },
            "RelyingParty":
                "http://auth.xboxlive.com",
            "TokenType":
                "JWT"
        });

    let response =
        client
            .post(
                XBOX_LIVE_AUTH_URL
            )
            .json(&request_body)
            .send()
            .map_err(|error| {
                format!(
                    "Xbox Live authentication request failed: {}",
                    error
                )
            })?;

    let status =
        response.status();

    if !status.is_success() {
        let body =
            response
                .text()
                .unwrap_or_else(|_| {
                    "Unknown Xbox Live authentication error."
                        .to_string()
                });

        return Err(
            format!(
                "Xbox Live authentication failed ({}): {}",
                status,
                body
            )
        );
    }

    response
        .json::<XboxLiveTokenResponse>()
        .map_err(|error| {
            format!(
                "Could not parse Xbox Live authentication response: {}",
                error
            )
        })
}


// ============================================================
// XSTS AUTHENTICATION
// ============================================================

fn authenticate_xsts(
    xbox_live_token: &str
) -> Result<XstsTokenResponse, String>
{
    let client =
        http_client()?;

    let request_body =
        serde_json::json!({
            "Properties": {
                "SandboxId": XBOX_SANDBOX,
                "UserTokens": [
                    xbox_live_token
                ]
            },
            "RelyingParty":
                "rp://api.minecraftservices.com/",
            "TokenType":
                "JWT"
        });

    let response =
        client
            .post(
                XSTS_AUTH_URL
            )
            .json(&request_body)
            .send()
            .map_err(|error| {
                format!(
                    "XSTS authentication request failed: {}",
                    error
                )
            })?;

    let status =
        response.status();

    if !status.is_success() {
        let body =
            response
                .text()
                .unwrap_or_else(|_| {
                    "Unknown XSTS authentication error."
                        .to_string()
                });

        return Err(
            format!(
                "XSTS authentication failed ({}): {}",
                status,
                body
            )
        );
    }

    response
        .json::<XstsTokenResponse>()
        .map_err(|error| {
            format!(
                "Could not parse XSTS response: {}",
                error
            )
        })
}


// ============================================================
// MINECRAFT SERVICES AUTHENTICATION
// ============================================================

fn authenticate_minecraft_services(
    user_hash: &str,
    xsts_token: &str
) -> Result<MinecraftLoginResponse, String>
{
    let client =
        http_client()?;

    let identity_token =
        format!(
            "XBL3.0 x={};{}",
            user_hash,
            xsts_token
        );

    let request_body =
        serde_json::json!({
            "identityToken":
                identity_token
        });

    let response =
        client
            .post(
                MINECRAFT_LOGIN_WITH_XBOX_URL
            )
            .json(&request_body)
            .send()
            .map_err(|error| {
                format!(
                    "Minecraft Services authentication request failed: {}",
                    error
                )
            })?;

    let status =
        response.status();

    if !status.is_success() {
        let body =
            response
                .text()
                .unwrap_or_else(|_| {
                    "Unknown Minecraft Services authentication error."
                        .to_string()
                });

        return Err(
            format!(
                "Minecraft Services authentication failed ({}): {}",
                status,
                body
            )
        );
    }

    response
        .json::<MinecraftLoginResponse>()
        .map_err(|error| {
            format!(
                "Could not parse Minecraft Services authentication response: {}",
                error
            )
        })
}


// ============================================================
// MINECRAFT OWNERSHIP
// ============================================================

fn verify_minecraft_entitlement(
    minecraft_access_token: &str
) -> Result<(), String>
{
    let client =
        http_client()?;

    let response =
        client
            .get(
                MINECRAFT_ENTITLEMENTS_URL
            )
            .bearer_auth(
                minecraft_access_token
            )
            .send()
            .map_err(|error| {
                format!(
                    "Could not check Minecraft ownership: {}",
                    error
                )
            })?;

    let status =
        response.status();

    if !status.is_success() {
        let body =
            response
                .text()
                .unwrap_or_else(|_| {
                    "Unknown Minecraft ownership error."
                        .to_string()
                });

        return Err(
            format!(
                "Minecraft ownership check failed ({}): {}",
                status,
                body
            )
        );
    }

    let entitlements =
        response
            .json::<MinecraftEntitlements>()
            .map_err(|error| {
                format!(
                    "Could not parse Minecraft ownership response: {}",
                    error
                )
            })?;

    let owns_minecraft =
        entitlements
            .items
            .iter()
            .any(|item| {
                match item.name.as_deref() {
                    Some("product_minecraft") => true,
                    Some("game_minecraft") => true,
                    Some("product_minecraft_java") => true,
                    Some("game_minecraft_java") => true,
                    _ => false,
                }
            });

    if !owns_minecraft {
        return Err(
            "This Microsoft account does not appear to own Minecraft."
                .to_string()
        );
    }

    Ok(())
}


// ============================================================
// MINECRAFT PROFILE
// ============================================================

fn get_minecraft_profile(
    minecraft_access_token: &str
) -> Result<MinecraftProfile, String>
{
    let client =
        http_client()?;

    let response =
        client
            .get(
                MINECRAFT_PROFILE_URL
            )
            .bearer_auth(
                minecraft_access_token
            )
            .send()
            .map_err(|error| {
                format!(
                    "Could not retrieve Minecraft profile: {}",
                    error
                )
            })?;

    let status =
        response.status();

    if !status.is_success() {
        let body =
            response
                .text()
                .unwrap_or_else(|_| {
                    "Unknown Minecraft profile error."
                        .to_string()
                });

        return Err(
            format!(
                "Minecraft profile request failed ({}): {}",
                status,
                body
            )
        );
    }

    let profile =
        response
            .json::<MinecraftProfile>()
            .map_err(|error| {
                format!(
                    "Could not parse Minecraft profile: {}",
                    error
                )
            })?;

    if profile.name.trim().is_empty() {
        return Err(
            "Minecraft Services returned an empty Minecraft username."
                .to_string()
        );
    }

    if profile.id.trim().is_empty() {
        return Err(
            "Minecraft Services returned an empty Minecraft UUID."
                .to_string()
        );
    }

    Ok(profile)
}


// ============================================================
// PKCE
// ============================================================

fn random_string(
    length: usize
) -> String
{
    rand::thread_rng()
        .sample_iter(
            &Alphanumeric
        )
        .take(length)
        .map(char::from)
        .collect()
}


fn create_code_challenge(
    verifier: &str
) -> String
{
    let mut hasher =
        Sha256::new();

    hasher.update(
        verifier.as_bytes()
    );

    let digest =
        hasher.finalize();

    URL_SAFE_NO_PAD
        .encode(digest)
}


// ============================================================
// OPEN BROWSER
// ============================================================

fn open_browser(
    url: &str
) -> Result<(), String>
{
    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32.exe")
            .args([
                "url.dll",
                "FileProtocolHandler",
                url,
            ])
            .spawn()
            .map_err(|error| {
                format!(
                    "Could not open Microsoft login in the browser: {}",
                    error
                )
            })?;

        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|error| {
                format!(
                    "Could not open Microsoft login in the browser: {}",
                    error
                )
            })?;

        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|error| {
                format!(
                    "Could not open Microsoft login in the browser: {}",
                    error
                )
            })?;

        return Ok(());
    }

    #[allow(unreachable_code)]
    Err(
        "Opening the default browser is not supported on this platform."
            .to_string()
    )
}


// ============================================================
// LOCALHOST CALLBACK
// ============================================================

fn read_callback_request(
    stream: &mut TcpStream
) -> Result<Url, String>
{
    stream
        .set_read_timeout(
            Some(
                Duration::from_secs(180)
            )
        )
        .map_err(|error| {
            format!(
                "Could not configure Microsoft callback: {}",
                error
            )
        })?;

    let mut buffer =
        [0u8; 8192];

    let bytes_read =
        stream
            .read(&mut buffer)
            .map_err(|error| {
                format!(
                    "Could not read Microsoft callback: {}",
                    error
                )
            })?;

    if bytes_read == 0 {
        return Err(
            "Microsoft callback request was empty."
                .to_string()
        );
    }

    let request =
        String::from_utf8_lossy(
            &buffer[..bytes_read]
        );

    let first_line =
        request
            .lines()
            .next()
            .ok_or_else(|| {
                "Microsoft callback request was empty."
                    .to_string()
            })?;

    let mut parts =
        first_line.split_whitespace();

    let method =
        parts.next()
            .unwrap_or("");

    let target =
        parts.next()
            .unwrap_or("");

    if method != "GET" {
        return Err(
            "Invalid Microsoft callback request."
                .to_string()
        );
    }

    if target.is_empty() {
        return Err(
            "Microsoft callback did not contain a URL."
                .to_string()
        );
    }

    let callback_url =
        Url::parse(
            &format!(
                "http://localhost{}",
                target
            )
        )
        .map_err(|error| {
            format!(
                "Could not parse Microsoft callback: {}",
                error
            )
        })?;

    Ok(callback_url)
}


// ============================================================
// CALLBACK RESPONSE
// ============================================================

fn send_callback_response(
    stream: &mut TcpStream,
    success: bool,
    error_message: Option<&str>
) -> Result<(), String>
{
    let title =
        if success {
            "Microsoft login successful"
        } else {
            "Microsoft login failed"
        };

    let message =
        if success {

            "Your Microsoft and Minecraft account were successfully authenticated. You can close this window and return to Alpha Launcher."

        } else {

            error_message
                .unwrap_or(
                    "The Microsoft login could not be completed. You can close this window."
                )
        };

    let title_color =
        if success {
            "#FFC83D"
        } else {
            "#FF6B6B"
        };

    let html =
        format!(
            "<!doctype html>\
             <html>\
             <head>\
             <meta charset=\"utf-8\">\
             <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\
             <title>{}</title>\
             <style>\
             body{{\
             background:#07070A;\
             color:#F5F5F2;\
             font-family:Arial,sans-serif;\
             display:flex;\
             align-items:center;\
             justify-content:center;\
             min-height:100vh;\
             margin:0;\
             padding:20px;\
             box-sizing:border-box;\
             }}\
             .box{{\
             background:#17181C;\
             border:1px solid #2A2B31;\
             border-radius:14px;\
             padding:40px;\
             max-width:520px;\
             width:100%;\
             text-align:center;\
             box-sizing:border-box;\
             }}\
             h1{{\
             color:{};\
             margin-top:0;\
             }}\
             p{{\
             color:#9A9CA6;\
             line-height:1.6;\
             word-break:break-word;\
             }}\
             </style>\
             </head>\
             <body>\
             <div class=\"box\">\
             <h1>{}</h1>\
             <p>{}</p>\
             </div>\
             </body>\
             </html>",
            title,
            title_color,
            title,
            message
        );

    let response =
        format!(
            "HTTP/1.1 200 OK\r\n\
             Content-Type: text/html; charset=utf-8\r\n\
             Content-Length: {}\r\n\
             Connection: close\r\n\
             \r\n\
             {}",
            html.as_bytes().len(),
            html
        );

    stream
        .write_all(
            response.as_bytes()
        )
        .map_err(|error| {
            format!(
                "Could not send browser response: {}",
                error
            )
        })?;

    let _ =
        stream.flush();

    Ok(())
}


// ============================================================
// TOKEN EXCHANGE
// ============================================================

fn exchange_authorization_code(
    authorization_code: &str,
    redirect_uri: &str,
    code_verifier: &str
) -> Result<
    MicrosoftTokenResponse,
    String
>
{
    let client =
        http_client()?;

    let response =
        client
            .post(
                MICROSOFT_TOKEN_URL
            )
            .form(&[
                (
                    "client_id",
                    MICROSOFT_CLIENT_ID
                ),
                (
                    "grant_type",
                    "authorization_code"
                ),
                (
                    "code",
                    authorization_code
                ),
                (
                    "redirect_uri",
                    redirect_uri
                ),
                (
                    "code_verifier",
                    code_verifier
                ),
                (
                    "scope",
                    MICROSOFT_SCOPES
                ),
            ])
            .send()
            .map_err(|error| {
                format!(
                    "Microsoft token request failed: {}",
                    error
                )
            })?;

    let status =
        response.status();

    if !status.is_success() {
        let body =
            response
                .text()
                .unwrap_or_else(|_| {
                    "Unknown Microsoft token error."
                        .to_string()
                });

        return Err(
            format!(
                "Microsoft token request failed ({}): {}",
                status,
                body
            )
        );
    }

    response
        .json::<MicrosoftTokenResponse>()
        .map_err(|error| {
            format!(
                "Could not parse Microsoft token response: {}",
                error
            )
        })
}


// ============================================================
// MICROSOFT USER INFO / OIDC ID TOKEN
// ============================================================

fn get_microsoft_user_info_from_id_token(
    id_token: &str,
    expected_nonce: &str
) -> Result<MicrosoftAccount, String>
{
    // JWT bestaat uit:
    // header.payload.signature

    let mut parts =
        id_token.split('.');

    let _header =
        parts.next()
            .ok_or_else(|| {
                "Microsoft returned an invalid ID token (missing header)."
                    .to_string()
            })?;

    let payload =
        parts.next()
            .ok_or_else(|| {
                "Microsoft returned an invalid ID token (missing claims)."
                    .to_string()
            })?;

    let signature =
        parts.next()
            .ok_or_else(|| {
                "Microsoft returned an invalid ID token (missing signature)."
                    .to_string()
            })?;

    if parts.next().is_some() {
        return Err(
            "Microsoft returned an invalid ID token format."
                .to_string()
        );
    }

    if signature.is_empty() {
        return Err(
            "Microsoft returned an ID token without a signature."
                .to_string()
        );
    }

    let decoded_payload =
        URL_SAFE_NO_PAD
            .decode(payload)
            .map_err(|error| {
                format!(
                    "Could not decode Microsoft ID token claims: {}",
                    error
                )
            })?;

    let info =
        serde_json::from_slice::<MicrosoftUserInfo>(
            &decoded_payload
        )
        .map_err(|error| {
            format!(
                "Could not parse Microsoft ID token claims: {}",
                error
            )
        })?;

    // --------------------------------------------------------
    // NONCE VALIDATION
    // --------------------------------------------------------

    let returned_nonce =
        info.nonce
            .as_deref()
            .ok_or_else(|| {
                "Microsoft ID token does not contain a nonce."
                    .to_string()
            })?;

    if returned_nonce != expected_nonce {
        return Err(
            "Microsoft ID token nonce validation failed."
                .to_string()
        );
    }

    // --------------------------------------------------------
    // DISPLAY EMAIL
    // --------------------------------------------------------

    let email =
        info.email
            .or(info.preferred_username)
            .unwrap_or_else(|| {
                "Microsoft Account".to_string()
            });

    Ok(MicrosoftAccount {
        name:
            "Minecraft Account".to_string(),

        email,

        uuid:
            String::new(),
    })
}


// ============================================================
// HTTP CLIENT
// ============================================================

fn http_client()
    -> Result<Client, String>
{
    Client::builder()
        .timeout(
            Duration::from_secs(120)
        )
        .user_agent(
            format!(
                "AlphaClient/{}",
                ALPHACLIENT_VERSION
            )
        )
        .build()
        .map_err(|error| {
            format!(
                "Could not create HTTP client: {}",
                error
            )
        })
}


// ============================================================
// ALPHACLIENT DIRECTORY
// ============================================================

fn alpha_client_directory()
    -> Result<PathBuf, String>
{
    let app_data =
        env::var("APPDATA")
            .map_err(|_| {
                "APPDATA environment variable is not available."
                    .to_string()
            })?;

    Ok(
        PathBuf::from(app_data)
            .join("AlphaClient")
    )
}


fn create_alpha_directories()
    -> Result<PathBuf, String>
{
    let root =
        alpha_client_directory()?;

    let directories = [
        root.clone(),

        root.join("versions"),
        root.join("libraries"),

        root.join("assets"),
        root.join("assets").join("indexes"),
        root.join("assets").join("objects"),

        root.join("mods"),
        root.join("config"),
        root.join("logs"),
        root.join("downloads"),
        root.join("runtime"),
    ];

    for directory in directories {
        fs::create_dir_all(
            &directory
        )
        .map_err(|error| {
            format!(
                "Could not create directory {}: {}",
                directory.display(),
                error
            )
        })?;
    }

    Ok(root)
}


// ============================================================
// DEVELOPMENT SANDBOX
// ============================================================

// The offline developer test uses a separate game directory. It never writes
// to %APPDATA%\AlphaClient, which remains the production installation.
const ALPHACLIENT_DEV_DIRECTORY_NAME: &str = "AlphaClient-DevSandbox";

fn alpha_client_dev_directory()
    -> Result<PathBuf, String>
{
    let app_data =
        env::var("APPDATA")
            .map_err(|_| {
                "APPDATA environment variable is not available.".to_string()
            })?;

    Ok(PathBuf::from(app_data).join(ALPHACLIENT_DEV_DIRECTORY_NAME))
}

// Copy only files that do not already exist in the sandbox. This lets the
// sandbox borrow Minecraft/Forge libraries and assets from the normal install,
// while preserving test-specific files and mods on later launches.
fn copy_directory_missing_files(
    source: &Path,
    destination: &Path
) -> Result<(), String>
{
    if !source.is_dir() {
        return Ok(());
    }

    fs::create_dir_all(destination)
        .map_err(|error| format!(
            "Could not create sandbox directory {}: {}",
            destination.display(), error
        ))?;

    let entries = fs::read_dir(source)
        .map_err(|error| format!(
            "Could not read source directory {}: {}",
            source.display(), error
        ))?;

    for entry in entries {
        let entry = entry.map_err(|error| format!("Could not read directory entry: {}", error))?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());

        if source_path.is_dir() {
            copy_directory_missing_files(&source_path, &destination_path)?;
        } else if !destination_path.exists() {
            if let Some(parent) = destination_path.parent() {
                fs::create_dir_all(parent).map_err(|error| format!(
                    "Could not create sandbox directory {}: {}",
                    parent.display(), error
                ))?;
            }
            fs::copy(&source_path, &destination_path).map_err(|error| format!(
                "Could not copy {} to sandbox: {}",
                source_path.display(), error
            ))?;
        }
    }

    Ok(())
}

fn prepare_alpha_client_dev_sandbox()
    -> Result<PathBuf, String>
{
    let production_root = alpha_client_directory()?;
    if !production_root.is_dir() {
        return Err(
            "The normal AlphaClient installation was not found. Install/repair AlphaClient once before using the Development Sandbox.".to_string()
        );
    }

    let sandbox_root = alpha_client_dev_directory()?;
    fs::create_dir_all(&sandbox_root).map_err(|error| format!(
        "Could not create AlphaClient Development Sandbox {}: {}",
        sandbox_root.display(), error
    ))?;

    // Copy runtime files and assets, but never overwrite anything already in
    // the sandbox. The mods folder is seeded only on first use and is then
    // fully independent from the production mods folder.
    for directory in ["versions", "libraries", "assets", "runtime"] {
        copy_directory_missing_files(
            &production_root.join(directory),
            &sandbox_root.join(directory)
        )?;
    }

    let sandbox_mods = sandbox_root.join("mods");
    if !sandbox_mods.exists() {
        copy_directory_missing_files(
            &production_root.join("mods"),
            &sandbox_mods
        )?;
    }

    for directory in ["mods", "config", "logs", "downloads"] {
        fs::create_dir_all(sandbox_root.join(directory)).map_err(|error| format!(
            "Could not create sandbox directory {}: {}",
            sandbox_root.join(directory).display(), error
        ))?;
    }

    Ok(sandbox_root)
}


// ============================================================
// ALPHACLIENT MOD JAR
// ============================================================

const ALPHACLIENT_MOD_JAR_ENV: &str = "ALPHACLIENT_MOD_JAR";
const ALPHASTAFFMOD_MODID: &str = "alphastaffmod";

fn jar_is_alphastaffmod(
    path: &Path
) -> bool
{
    let file = match File::open(path) {
        Ok(file) => file,
        Err(_) => return false,
    };

    let mut archive = match ZipArchive::new(file) {
        Ok(archive) => archive,
        Err(_) => return false,
    };

    let mut entry = match archive.by_name("mcmod.info") {
        Ok(entry) => entry,
        Err(_) => return false,
    };

    let mut contents = String::new();

    if entry.read_to_string(&mut contents).is_err() {
        return false;
    }

    contents.contains("\"modid\"")
        && contents.contains(ALPHASTAFFMOD_MODID)
}

fn find_built_alphastaffmod_jar()
    -> Result<PathBuf, String>
{
    // An explicit path always wins. This is useful for release/build machines.
    if let Ok(value) = env::var(ALPHACLIENT_MOD_JAR_ENV) {
        let path = PathBuf::from(value.trim());

        if path.is_file() && jar_is_alphastaffmod(&path) {
            return Ok(path);
        }

        return Err(format!(
            "ALPHACLIENT_MOD_JAR points to an invalid Alpha Staff Mod JAR: {}",
            path.display()
        ));
    }

    let mut build_directories = Vec::<PathBuf>::new();

    if let Ok(user_profile) = env::var("USERPROFILE") {
        let profile = PathBuf::from(user_profile);

        build_directories.push(
            profile
                .join("Desktop")
                .join("Staffmods")
                .join("build")
                .join("libs")
        );

        build_directories.push(
            profile
                .join("Desktop")
                .join("AlphaStaffmods")
                .join("build")
                .join("libs")
        );
    }

    // Also support running the launcher from inside a copied project.
    if let Ok(current_dir) = env::current_dir() {
        build_directories.push(
            current_dir
                .join("build")
                .join("libs")
        );
    }

    let mut candidates = Vec::<PathBuf>::new();

    for directory in build_directories {
        if !directory.is_dir() {
            continue;
        }

        let entries = fs::read_dir(&directory)
            .map_err(|error| {
                format!(
                    "Could not read Alpha Staff Mod build directory {}: {}",
                    directory.display(),
                    error
                )
            })?;

        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(_) => continue,
            };

            let path = entry.path();

            if path.extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| extension.eq_ignore_ascii_case("jar"))
                != Some(true)
            {
                continue;
            }

            if jar_is_alphastaffmod(&path) {
                candidates.push(path);
            }
        }
    }

    candidates.sort_by(|a, b| {
        let a_time = fs::metadata(a)
            .and_then(|metadata| metadata.modified())
            .ok();
        let b_time = fs::metadata(b)
            .and_then(|metadata| metadata.modified())
            .ok();

        b_time.cmp(&a_time)
    });

    candidates.into_iter().next().ok_or_else(|| {
        "Could not find a built Alpha Staff Mod JAR. Build the mod first (Staffmods\\build\\libs) or set ALPHACLIENT_MOD_JAR to the JAR path."
            .to_string()
    })
}

fn copy_alphaclient_mod_to_mods(
    root: &Path
) -> Result<PathBuf, String>
{
    let source = find_built_alphastaffmod_jar()?;
    let mods_dir = root.join("mods");

    fs::create_dir_all(&mods_dir)
        .map_err(|error| {
            format!(
                "Could not create AlphaClient mods directory {}: {}",
                mods_dir.display(),
                error
            )
        })?;

    // Remove an older Alpha Staff Mod build first so Forge cannot load two
    // different versions of the same mod at the same time.
    if let Ok(entries) = fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            if path.extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| extension.eq_ignore_ascii_case("jar"))
                != Some(true)
            {
                continue;
            }

            if path != source && jar_is_alphastaffmod(&path) {
                let _ = fs::remove_file(&path);
            }
        }
    }

    let destination = mods_dir.join(
        source
            .file_name()
            .ok_or_else(|| "Alpha Staff Mod JAR has no filename.".to_string())?
    );

    fs::copy(&source, &destination)
        .map_err(|error| {
            format!(
                "Could not copy Alpha Staff Mod JAR from {} to {}: {}",
                source.display(),
                destination.display(),
                error
            )
        })?;

    Ok(destination)
}


// ============================================================
// JAVA 8
// ============================================================

fn java_version_is_8(
    java_path: &Path
) -> bool
{
    let output =
        Command::new(
            java_path
        )
        .arg("-version")
        .output();

    let output =
        match output {
            Ok(output) => output,
            Err(_) => return false,
        };

    let version_text =
        format!(
            "{}{}",
            String::from_utf8_lossy(
                &output.stdout
            ),
            String::from_utf8_lossy(
                &output.stderr
            )
        );

    version_text.contains(
        "1.8."
    )
    || version_text.contains(
        "version \"8"
    )
}


fn find_java_8()
    -> Result<PathBuf, String>
{
    if let Ok(java_home) =
        env::var("JAVA_HOME")
    {
        let java =
            PathBuf::from(
                java_home
            )
            .join("bin")
            .join("java.exe");

        if java.exists()
            && java_version_is_8(
                &java
            )
        {
            return Ok(java);
        }
    }

    let java =
        PathBuf::from("java");

    if java_version_is_8(
        &java
    ) {
        return Ok(java);
    }

    Err(
        "Java 8 was not found. AlphaClient Minecraft 1.8.9 requires Java 8."
            .to_string()
    )
}


// ============================================================
// FILE HELPERS
// ============================================================

fn download_file(
    client: &Client,
    url: &str,
    destination: &Path
) -> Result<(), String>
{
    if let Some(parent) =
        destination.parent()
    {
        fs::create_dir_all(
            parent
        )
        .map_err(|error| {
            format!(
                "Could not create download directory: {}",
                error
            )
        })?;
    }

    let mut response =
        client
            .get(url)
            .send()
            .map_err(|error| {
                format!(
                    "Download failed for {}: {}",
                    url,
                    error
                )
            })?;

    if !response.status().is_success() {
        return Err(
            format!(
                "Download failed for {} with HTTP {}.",
                url,
                response.status()
            )
        );
    }

    let mut file =
        File::create(
            destination
        )
        .map_err(|error| {
            format!(
                "Could not create {}: {}",
                destination.display(),
                error
            )
        })?;

    std::io::copy(
        &mut response,
        &mut file
    )
    .map_err(|error| {
        format!(
            "Could not write {}: {}",
            destination.display(),
            error
        )
    })?;

    Ok(())
}


fn read_json_file(
    path: &Path
) -> Result<Value, String>
{
    let contents =
        fs::read_to_string(
            path
        )
        .map_err(|error| {
            format!(
                "Could not read {}: {}",
                path.display(),
                error
            )
        })?;

    serde_json::from_str(
        &contents
    )
    .map_err(|error| {
        format!(
            "Could not parse {}: {}",
            path.display(),
            error
        )
    })
}


fn write_json_file(
    path: &Path,
    value: &Value
) -> Result<(), String>
{
    if let Some(parent) =
        path.parent()
    {
        fs::create_dir_all(
            parent
        )
        .map_err(|error| {
            format!(
                "Could not create directory {}: {}",
                parent.display(),
                error
            )
        })?;
    }

    let contents =
        serde_json::to_string_pretty(
            value
        )
        .map_err(|error| {
            format!(
                "Could not serialize JSON: {}",
                error
            )
        })?;

    fs::write(
        path,
        contents
    )
    .map_err(|error| {
        format!(
            "Could not write {}: {}",
            path.display(),
            error
        )
    })
}


// ============================================================
// MINECRAFT 1.8.9
// ============================================================

fn download_minecraft_1_8_9(
    root: &Path,
    client: &Client
) -> Result<(), String>
{
    let manifest =
        client
            .get(
                VERSION_MANIFEST_URL
            )
            .send()
            .map_err(|error| {
                format!(
                    "Could not download Minecraft version manifest: {}",
                    error
                )
            })?
            .json::<Value>()
            .map_err(|error| {
                format!(
                    "Could not parse Minecraft version manifest: {}",
                    error
                )
            })?;

    let versions =
        manifest
            .get("versions")
            .and_then(Value::as_array)
            .ok_or_else(|| {
                "Minecraft version manifest has no versions list."
                    .to_string()
            })?;

    let version_entry =
        versions
            .iter()
            .find(|version| {
                version
                    .get("id")
                    .and_then(Value::as_str)
                    == Some(MINECRAFT_VERSION)
            })
            .ok_or_else(|| {
                "Minecraft 1.8.9 was not found in the Mojang manifest."
                    .to_string()
            })?;

    let version_url =
        version_entry
            .get("url")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                "Minecraft 1.8.9 has no version JSON URL."
                    .to_string()
            })?;

    let version_json =
        client
            .get(version_url)
            .send()
            .map_err(|error| {
                format!(
                    "Could not download Minecraft 1.8.9 metadata: {}",
                    error
                )
            })?
            .json::<Value>()
            .map_err(|error| {
                format!(
                    "Could not parse Minecraft 1.8.9 metadata: {}",
                    error
                )
            })?;

    let version_directory =
        root
            .join("versions")
            .join(MINECRAFT_VERSION);

    fs::create_dir_all(
        &version_directory
    )
    .map_err(|error| {
        format!(
            "Could not create Minecraft version directory: {}",
            error
        )
    })?;

    let version_json_path =
        version_directory
            .join(
                format!(
                    "{}.json",
                    MINECRAFT_VERSION
                )
            );

    write_json_file(
        &version_json_path,
        &version_json
    )?;

    let client_jar =
        version_directory
            .join(
                format!(
                    "{}.jar",
                    MINECRAFT_VERSION
                )
            );

    if !client_jar.exists() {
        let client_url =
            version_json
                .get("downloads")
                .and_then(|downloads| {
                    downloads.get("client")
                })
                .and_then(|client| {
                    client.get("url")
                })
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    "Minecraft 1.8.9 client download URL is missing."
                        .to_string()
                })?;

        download_file(
            client,
            client_url,
            &client_jar
        )?;
    }

    Ok(())
}


// ============================================================
// MAVEN
// ============================================================

fn maven_path_from_name(
    name: &str
) -> Option<String>
{
    let (coordinate, extension) =
        match name.rsplit_once('@') {
            Some((coordinate, extension)) =>
                (coordinate, extension),

            None =>
                (name, "jar"),
        };

    let parts =
        coordinate
            .split(':')
            .collect::<Vec<_>>();

    if parts.len() < 3 {
        return None;
    }

    let group =
        parts[0].replace('.', "/");

    let artifact =
        parts[1];

    let version =
        parts[2];

    let classifier =
        parts.get(3).copied();

    let file_name =
        match classifier {
            Some(classifier) =>
                format!(
                    "{}-{}-{}.{}",
                    artifact,
                    version,
                    classifier,
                    extension
                ),

            None =>
                format!(
                    "{}-{}.{}",
                    artifact,
                    version,
                    extension
                ),
        };

    Some(
        format!(
            "{}/{}/{}/{}",
            group,
            artifact,
            version,
            file_name
        )
    )
}


fn download_forge_library(
    root: &Path,
    client: &Client,
    library: &Value
) -> Result<(), String>
{
    let name =
        library
            .get("name")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                "Forge library is missing its name."
                    .to_string()
            })?;

    let relative =
        maven_path_from_name(
            name
        )
        .ok_or_else(|| {
            format!(
                "Could not parse Forge library name: {}",
                name
            )
        })?;

    let destination =
        root
            .join("libraries")
            .join(&relative);

    if destination.exists() {
        return Ok(());
    }

    let url =
        if let Some(downloads) =
            library.get("downloads")
        {
            if let Some(artifact) =
                downloads.get("artifact")
            {
                artifact
                    .get("url")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            } else {
                None
            }
        } else {
            None
        };

    let url =
        url.unwrap_or_else(|| {
            format!(
                "https://libraries.minecraft.net/{}",
                relative
            )
        });

    download_file(
        client,
        &url,
        &destination
    )
}


// ============================================================
// FORGE INSTALLATION
// ============================================================

fn install_forge_from_installer(
    root: &Path,
    client: &Client
) -> Result<(), String>
{
    let installer =
        root
            .join("downloads")
            .join(
                FORGE_INSTALLER_NAME
            );

    if !installer.exists() {
        download_file(
            client,
            FORGE_INSTALLER_URL,
            &installer
        )?;
    }

    let file =
        File::open(
            &installer
        )
        .map_err(|error| {
            format!(
                "Could not open Forge installer: {}",
                error
            )
        })?;

    let mut archive =
        ZipArchive::new(
            file
        )
        .map_err(|error| {
            format!(
                "Could not open Forge installer archive: {}",
                error
            )
        })?;

    let mut install_profile =
        String::new();

    {
        let mut profile =
            archive
                .by_name(
                    "install_profile.json"
                )
                .map_err(|error| {
                    format!(
                        "Forge installer has no install_profile.json: {}",
                        error
                    )
                })?;

        profile
            .read_to_string(
                &mut install_profile
            )
            .map_err(|error| {
                format!(
                    "Could not read Forge install profile: {}",
                    error
                )
            })?;
    }

    let profile_json =
        serde_json::from_str::<Value>(
            &install_profile
        )
        .map_err(|error| {
            format!(
                "Could not parse Forge install profile: {}",
                error
            )
        })?;

    let version_info =
        profile_json
            .get("versionInfo")
            .cloned()
            .unwrap_or_else(|| {
                profile_json.clone()
            });

    let target =
        version_info
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or(
                FORGE_VERSION_NAME
            );

    let target_directory =
        root
            .join("versions")
            .join(target);

    fs::create_dir_all(
        &target_directory
    )
    .map_err(|error| {
        format!(
            "Could not create Forge version directory: {}",
            error
        )
    })?;

    let forge_library_path =
        root
            .join("libraries")
            .join("net")
            .join("minecraftforge")
            .join("forge")
            .join(
                "1.8.9-11.15.1.2318-1.8.9"
            );

    fs::create_dir_all(
        &forge_library_path
    )
    .map_err(|error| {
        format!(
            "Could not create Forge library directory: {}",
            error
        )
    })?;

    let forge_universal_jar =
        forge_library_path
            .join(
                FORGE_UNIVERSAL_JAR_NAME
            );

    if !forge_universal_jar.exists() {
        let mut forge_file =
            archive
                .by_name(
                    FORGE_UNIVERSAL_JAR_NAME
                )
                .map_err(|error| {
                    format!(
                        "Forge universal JAR was not found in installer: {}",
                        error
                    )
                })?;

        let mut output =
            File::create(
                &forge_universal_jar
            )
            .map_err(|error| {
                format!(
                    "Could not create Forge universal JAR: {}",
                    error
                )
            })?;

        std::io::copy(
            &mut forge_file,
            &mut output
        )
        .map_err(|error| {
            format!(
                "Could not extract Forge universal JAR: {}",
                error
            )
        })?;
    }

    if let Some(libraries) =
        version_info
            .get("libraries")
            .and_then(Value::as_array)
    {
        for library in libraries {
            download_forge_library(
                root,
                client,
                library
            )?;
        }
    }

    let forge_json_path =
        target_directory
            .join(
                format!(
                    "{}.json",
                    target
                )
            );

    write_json_file(
        &forge_json_path,
        &version_info
    )?;

    Ok(())
}


// ============================================================
// MINECRAFT LIBRARIES, ASSETS AND LEGACY FORGE LAUNCH
// ============================================================

fn library_is_allowed(
    library: &Value
) -> bool
{
    let rules =
        match library
            .get("rules")
            .and_then(Value::as_array)
        {
            Some(rules) => rules,
            None => return true,
        };

    let mut allowed =
        false;

    for rule in rules {
        let os_name =
            rule
                .get("os")
                .and_then(|os| {
                    os.get("name")
                })
                .and_then(Value::as_str);

        if os_name
            .map(|name| name != "windows")
            .unwrap_or(false)
        {
            continue;
        }

        match rule
            .get("action")
            .and_then(Value::as_str)
            .unwrap_or("allow")
        {
            "allow" =>
                allowed = true,

            "disallow" =>
                allowed = false,

            _ => {}
        }
    }

    allowed
}


fn library_relative_path(
    library: &Value
) -> Option<String>
{
    library
        .get("downloads")
        .and_then(|d| {
            d.get("artifact")
        })
        .and_then(|a| {
            a.get("path")
        })
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            library
                .get("name")
                .and_then(Value::as_str)
                .and_then(maven_path_from_name)
        })
}


fn download_metadata_libraries(
    root: &Path,
    client: &Client,
    metadata: &Value
) -> Result<(), String>
{
    let libraries =
        match metadata
            .get("libraries")
            .and_then(Value::as_array)
        {
            Some(libraries) => libraries,
            None => return Ok(()),
        };

    for library in libraries {
        if !library_is_allowed(
            library
        ) {
            continue;
        }

        let has_artifact =
            library
                .get("downloads")
                .and_then(|d| {
                    d.get("artifact")
                })
                .is_some();

        if !has_artifact
            && library
                .get("natives")
                .is_some()
        {
            continue;
        }

        let relative =
            match library_relative_path(
                library
            ) {
                Some(path) => path,
                None => continue,
            };

        let destination =
            root
                .join("libraries")
                .join(&relative);

        if destination.exists() {
            continue;
        }

        let explicit_url =
            library
                .get("downloads")
                .and_then(|d| {
                    d.get("artifact")
                })
                .and_then(|a| {
                    a.get("url")
                })
                .and_then(Value::as_str);

        let base_url =
            library
                .get("url")
                .and_then(Value::as_str)
                .unwrap_or(
                    "https://libraries.minecraft.net/"
                );

        let url =
            explicit_url
                .map(str::to_string)
                .unwrap_or_else(|| {
                    format!(
                        "{}{}",
                        base_url,
                        relative
                    )
                });

        download_file(
            client,
            &url,
            &destination
        )?;
    }

    Ok(())
}


fn download_assets(
    root: &Path,
    client: &Client,
    version_json: &Value
) -> Result<String, String>
{
    let index =
        version_json
            .get("assetIndex")
            .ok_or_else(|| {
                "Minecraft metadata is missing assetIndex."
                    .to_string()
            })?;

    let index_id =
        index
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("1.8");

    let index_url =
        index
            .get("url")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                "Minecraft asset index URL is missing."
                    .to_string()
            })?;

    let index_path =
        root
            .join("assets")
            .join("indexes")
            .join(
                format!(
                    "{}.json",
                    index_id
                )
            );

    if !index_path.exists() {
        download_file(
            client,
            index_url,
            &index_path
        )?;
    }

    let index_json =
        read_json_file(
            &index_path
        )?;

    let objects =
        index_json
            .get("objects")
            .and_then(Value::as_object)
            .ok_or_else(|| {
                "Minecraft asset index has no objects map."
                    .to_string()
            })?;

    for (logical_name, object) in objects {
        let hash =
            match object
                .get("hash")
                .and_then(Value::as_str)
            {
                Some(hash)
                    if hash.len() >= 2 =>
                    hash,

                _ => continue,
            };

        let relative =
            format!(
                "{}/{}",
                &hash[..2],
                hash
            );

        let destination =
            root
                .join("assets")
                .join("objects")
                .join(&relative);

        if !destination.exists() {
            download_file(
                client,
                &format!(
                    "https://resources.download.minecraft.net/{}",
                    relative
                ),
                &destination
            )?;
        }

        if index_json
            .get("virtual")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            let virtual_path =
                root
                    .join("assets")
                    .join("virtual")
                    .join("legacy")
                    .join(logical_name);

            if !virtual_path.exists() {
                if let Some(parent) =
                    virtual_path.parent()
                {
                    fs::create_dir_all(
                        parent
                    )
                    .map_err(|e| {
                        format!(
                            "Could not create legacy asset directory: {}",
                            e
                        )
                    })?;
                }

                fs::copy(
                    &destination,
                    &virtual_path
                )
                .map_err(|e| {
                    format!(
                        "Could not prepare legacy asset {}: {}",
                        logical_name,
                        e
                    )
                })?;
            }
        }
    }

    Ok(
        index_id.to_string()
    )
}


fn extract_native_jar(
    jar_path: &Path,
    destination: &Path
) -> Result<(), String>
{
    let file =
        File::open(
            jar_path
        )
        .map_err(|e| {
            format!(
                "Could not open native library {}: {}",
                jar_path.display(),
                e
            )
        })?;

    let mut archive =
        ZipArchive::new(
            file
        )
        .map_err(|e| {
            format!(
                "Could not read native library {}: {}",
                jar_path.display(),
                e
            )
        })?;

    fs::create_dir_all(
        destination
    )
    .map_err(|e| {
        format!(
            "Could not create native directory: {}",
            e
        )
    })?;

    for i in 0..archive.len() {
        let mut entry =
            archive
                .by_index(i)
                .map_err(|e| {
                    format!(
                        "Could not read native archive entry: {}",
                        e
                    )
                })?;

        let name =
            entry
                .name()
                .replace('\\', "/");

        if name.starts_with("META-INF/")
            || name.ends_with('/')
            || name.starts_with('/')
            || name
                .split('/')
                .any(|part| {
                    part == ".."
                        || part.contains(':')
                })
        {
            continue;
        }

        let output =
            destination.join(
                &name
            );

        if let Some(parent) =
            output.parent()
        {
            fs::create_dir_all(
                parent
            )
            .map_err(|e| {
                format!(
                    "Could not create native subdirectory: {}",
                    e
                )
            })?;
        }

        let mut file =
            File::create(
                &output
            )
            .map_err(|e| {
                format!(
                    "Could not create native file: {}",
                    e
                )
            })?;

        std::io::copy(
            &mut entry,
            &mut file
        )
        .map_err(|e| {
            format!(
                "Could not extract native file: {}",
                e
            )
        })?;
    }

    Ok(())
}


fn download_native_libraries(
    root: &Path,
    client: &Client,
    metadata: &Value,
    natives_dir: &Path
) -> Result<(), String>
{
    let libraries =
        match metadata
            .get("libraries")
            .and_then(Value::as_array)
        {
            Some(libraries) => libraries,
            None => return Ok(()),
        };

    for library in libraries {
        if !library_is_allowed(
            library
        ) {
            continue;
        }

        let natives =
            match library
                .get("natives")
                .and_then(|n| {
                    n.get("windows")
                })
                .and_then(Value::as_str)
            {
                Some(value) =>
                    value.replace(
                        "${arch}",
                        "64"
                    ),

                None => continue,
            };

        let classifier =
            library
                .get("downloads")
                .and_then(|d| {
                    d.get("classifiers")
                })
                .and_then(|c| {
                    c.get(
                        natives.as_str()
                    )
                });

        let (relative, url) =
            if let Some(classifier) =
                classifier
            {
                let path =
                    classifier
                        .get("path")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .or_else(|| {
                            library
                                .get("name")
                                .and_then(Value::as_str)
                                .and_then(|name| {
                                    let (
                                        coord,
                                        ext
                                    ) =
                                        name
                                            .rsplit_once('@')
                                            .unwrap_or(
                                                (name, "jar")
                                            );

                                    let mut parts =
                                        coord
                                            .split(':')
                                            .collect::<Vec<_>>();

                                    if parts.len() < 3 {
                                        return None;
                                    }

                                    if parts.len() == 3 {
                                        parts.push(
                                            &natives
                                        );
                                    }

                                    Some(
                                        maven_path_from_name(
                                            &format!(
                                                "{}@{}",
                                                parts.join(":"),
                                                ext
                                            )
                                        )?
                                    )
                                })
                        })
                        .ok_or_else(|| {
                            "Could not determine native library path."
                                .to_string()
                        })?;

                let url =
                    classifier
                        .get("url")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .unwrap_or_else(|| {
                            format!(
                                "https://libraries.minecraft.net/{}",
                                path
                            )
                        });

                (
                    path,
                    url
                )
            } else {
                let name =
                    match library
                        .get("name")
                        .and_then(Value::as_str)
                    {
                        Some(name) => name,
                        None => continue,
                    };

                let (coord, ext) =
                    name
                        .rsplit_once('@')
                        .unwrap_or(
                            (name, "jar")
                        );

                let parts =
                    coord
                        .split(':')
                        .collect::<Vec<_>>();

                if parts.len() < 3 {
                    continue;
                }

                let relative =
                    maven_path_from_name(
                        &format!(
                            "{}:{}:{}:{}@{}",
                            parts[0],
                            parts[1],
                            parts[2],
                            natives,
                            ext
                        )
                    )
                    .ok_or_else(|| {
                        format!(
                            "Could not parse native library name: {}",
                            name
                        )
                    })?;

                let base =
                    library
                        .get("url")
                        .and_then(Value::as_str)
                        .unwrap_or(
                            "https://libraries.minecraft.net/"
                        );

                (
                    relative.clone(),
                    format!(
                        "{}{}",
                        base,
                        relative
                    )
                )
            };

        let jar =
            root
                .join("libraries")
                .join(&relative);

        if !jar.exists() {
            download_file(
                client,
                &url,
                &jar
            )?;
        }

        extract_native_jar(
            &jar,
            natives_dir
        )?;
    }

    Ok(())
}


fn build_classpath(
    root: &Path,
    vanilla: &Value,
    forge: &Value
) -> Result<String, String>
{
    let mut paths =
        Vec::<String>::new();

    let mut seen =
        std::collections::HashSet::<String>::new();

    for metadata in [
        vanilla,
        forge
    ] {
        if let Some(libraries) =
            metadata
                .get("libraries")
                .and_then(Value::as_array)
        {
            for library in libraries {
                if !library_is_allowed(
                    library
                ) {
                    continue;
                }

                if library
                    .get("natives")
                    .is_some()
                    && library
                        .get("downloads")
                        .and_then(|d| {
                            d.get("artifact")
                        })
                        .is_none()
                {
                    continue;
                }

                let relative =
                    match library_relative_path(
                        library
                    ) {
                        Some(path) => path,
                        None => continue,
                    };

                let path =
                    root
                        .join("libraries")
                        .join(relative);

                if path.exists() {
                    let value =
                        path
                            .to_string_lossy()
                            .to_string();

                    if seen.insert(
                        value.clone()
                    ) {
                        paths.push(
                            value
                        );
                    }
                }
            }
        }
    }

    let client_jar =
        root
            .join("versions")
            .join(MINECRAFT_VERSION)
            .join(
                format!(
                    "{}.jar",
                    MINECRAFT_VERSION
                )
            );

    if !client_jar.exists() {
        return Err(
            "Minecraft client JAR is missing after installation."
                .to_string()
        );
    }

    paths.insert(
        0,
        client_jar
            .to_string_lossy()
            .to_string()
    );

    Ok(
        paths.join(
            if cfg!(windows) {
                ";"
            } else {
                ":"
            }
        )
    )
}


fn replace_launch_placeholders(
    argument: &str,
    values: &std::collections::HashMap<&str, String>
) -> String
{
    let mut result =
        argument.to_string();

    for (key, value) in values {
        result =
            result.replace(
                &format!(
                    "${{{}}}",
                    key
                ),
                value.as_str()
            );
    }

    result
}


// ============================================================
// ALPHACLIENT RELEASE / UPDATE SYSTEM
// ============================================================

fn alpha_client_version_file(
    root: &Path
) -> PathBuf
{
    root.join(ALPHACLIENT_VERSION_FILE)
}


// Read the version from the actual installed mod JAR. The JSON version marker
// is only bookkeeping and must never override the version of the JAR Minecraft loads.
fn alphastaffmod_version_from_jar(path: &Path) -> Option<String>
{
    let file = File::open(path).ok()?;
    let mut archive = ZipArchive::new(file).ok()?;
    let mut entry = archive.by_name("mcmod.info").ok()?;
    let mut contents = String::new();
    entry.read_to_string(&mut contents).ok()?;

    let metadata: Value = serde_json::from_str(&contents).ok()?;
    let entries: Vec<&Value> = match &metadata {
        Value::Array(items) => items.iter().collect(),
        Value::Object(_) => vec![&metadata],
        _ => return None,
    };

    for item in entries {
        let modid = item.get("modid").and_then(Value::as_str).unwrap_or("");
        if !modid.eq_ignore_ascii_case(ALPHASTAFFMOD_MODID) {
            continue;
        }

        let version = item.get("version").and_then(Value::as_str)?.trim();
        // Ignore unresolved Gradle placeholders and empty metadata values.
        if version.is_empty()
            || version.contains("${")
            || !version.trim_start_matches('v').chars().next()
                .map(|character| character.is_ascii_digit())
                .unwrap_or(false)
        {
            return None;
        }

        return Some(version.to_string());
    }

    None
}


fn installed_alphaclient_version(
    root: &Path
) -> Result<String, String>
{
    let mods_dir = root.join("mods");
    if !mods_dir.is_dir() {
        return Ok("Niet geïnstalleerd".to_string());
    }

    let mut jars = Vec::<PathBuf>::new();
    let official_jar = mods_dir.join(ALPHACLIENT_OFFICIAL_MOD_JAR_NAME);
    if official_jar.is_file() {
        jars.push(official_jar);
    }

    if let Ok(entries) = fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path == mods_dir.join(ALPHACLIENT_OFFICIAL_MOD_JAR_NAME)
                || path.extension().and_then(|extension| extension.to_str())
                    .map(|extension| extension.eq_ignore_ascii_case("jar")) != Some(true)
            {
                continue;
            }
            jars.push(path);
        }
    }

    let mut found_alphastaffmod = false;
    for jar in jars {
        if !jar_is_alphastaffmod(&jar) {
            continue;
        }
        found_alphastaffmod = true;
        if let Some(version) = alphastaffmod_version_from_jar(&jar) {
            return Ok(version);
        }
    }

    if found_alphastaffmod {
        Ok("Onbekend".to_string())
    } else {
        Ok("Niet geïnstalleerd".to_string())
    }
}


fn write_installed_alphaclient_version(
    root: &Path,
    version: &str
) -> Result<(), String>
{
    let value =
        serde_json::json!({
            "version": version,
        });

    write_json_file(
        &alpha_client_version_file(root),
        &value
    )
}


fn update_manifest_url()
    -> Option<String>
{
    env::var(ALPHACLIENT_UPDATE_MANIFEST_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}


fn parse_version_parts(
    version: &str
) -> Vec<u64>
{
    version
        .trim()
        .trim_start_matches('v')
        .split('.')
        .map(|part| {
            part
                .chars()
                .take_while(|character| character.is_ascii_digit())
                .collect::<String>()
                .parse::<u64>()
                .unwrap_or(0)
        })
        .collect()
}


fn version_is_newer(
    latest: &str,
    current: &str
) -> bool
{
    let latest_parts = parse_version_parts(latest);
    let current_parts = parse_version_parts(current);
    let length = latest_parts.len().max(current_parts.len());

    for index in 0..length {
        let latest_part =
            *latest_parts.get(index).unwrap_or(&0);
        let current_part =
            *current_parts.get(index).unwrap_or(&0);

        if latest_part != current_part {
            return latest_part > current_part;
        }
    }

    false
}


fn fetch_alpha_client_manifest()
    -> Result<AlphaClientReleaseManifest, String>
{
    let client = http_client()?;

    // Keep support for a custom manifest, but use GitHub Releases by default so
    // end users do not need to configure an environment variable.
    if let Some(url) = update_manifest_url() {
        return client
            .get(&url)
            .send()
            .map_err(|error| format!("Could not download AlphaClient update manifest: {}", error))?
            .error_for_status()
            .map_err(|error| format!("AlphaClient update manifest returned an error: {}", error))?
            .json::<AlphaClientReleaseManifest>()
            .map_err(|error| format!("Could not parse AlphaClient update manifest: {}", error));
    }

    let releases = client
        .get(ALPHACLIENT_GITHUB_RELEASES_URL)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .map_err(|error| format!("Could not contact GitHub Releases: {}", error))?
        .error_for_status()
        .map_err(|error| format!("GitHub Releases returned an error: {}", error))?
        .json::<Vec<Value>>()
        .map_err(|error| format!("Could not parse GitHub Releases response: {}", error))?;

    for release in releases {
        let assets = match release.get("assets").and_then(Value::as_array) {
            Some(assets) => assets,
            None => continue,
        };

        let jar_asset = assets.iter().find(|asset| {
            let name = asset.get("name").and_then(Value::as_str).unwrap_or("");
            let lower = name.to_ascii_lowercase();
            lower.starts_with("alphaclient-") && lower.ends_with(".jar")
        });
        let jar_asset = match jar_asset {
            Some(asset) => asset,
            None => continue,
        };

        let asset_name = jar_asset.get("name").and_then(Value::as_str).unwrap_or("");
        let version = asset_name
            .strip_prefix("AlphaClient-")
            .and_then(|name| name.strip_suffix(".jar"))
            .or_else(|| asset_name.strip_prefix("alphaclient-").and_then(|name| name.strip_suffix(".jar")))
            .ok_or_else(|| format!("Could not determine version from GitHub asset {}.", asset_name))?;
        if parse_version_parts(version).is_empty() || !version.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
            continue;
        }

        let download_url = jar_asset.get("browser_download_url").and_then(Value::as_str)
            .ok_or_else(|| format!("GitHub asset {} has no download URL.", asset_name))?
            .to_string();

        let mut sha256 = jar_asset.get("digest").and_then(Value::as_str)
            .and_then(|digest| digest.strip_prefix("sha256:"))
            .unwrap_or("")
            .to_string();

        // GitHub's asset digest is not populated for every older release.
        // Retain the verified checksum for the currently published 0.3.81 asset.
        if sha256.is_empty() && version == "0.3.81" {
            sha256 = ALPHACLIENT_0_3_81_SHA256.to_string();
        }
        if sha256.is_empty() {
            return Err(format!(
                "GitHub release asset {} has no SHA-256 digest. Add a SHA-256 digest/checksum to the release before publishing updates.",
                asset_name
            ));
        }

        let changelog = release.get("body").and_then(Value::as_str).unwrap_or("").to_string();
        return Ok(AlphaClientReleaseManifest {
            version: version.to_string(),
            download_url,
            sha256,
            changelog,
        });
    }

    Err("No GitHub release containing an AlphaClient-<version>.jar asset was found.".to_string())
}


fn check_alphaclient_update_internal()
    -> Result<AlphaClientUpdateInfo, String>
{
    let root =
        create_alpha_directories()?;

    let current_version =
        installed_alphaclient_version(&root)?;

    let manifest = fetch_alpha_client_manifest()?;

    Ok(
        AlphaClientUpdateInfo {
            current_version: current_version.clone(),
            latest_version: manifest.version.clone(),
            update_available: current_version == "Niet geïnstalleerd"
                || current_version == "Onbekend"
                || version_is_newer(
                    &manifest.version,
                    &current_version
                ),
            update_configured: true,
            changelog: manifest.changelog,
        }
    )
}


fn sha256_file(
    path: &Path
) -> Result<String, String>
{
    let mut file =
        File::open(path)
            .map_err(|error| {
                format!(
                    "Could not open {} for checksum verification: {}",
                    path.display(),
                    error
                )
            })?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let read =
            file.read(&mut buffer)
                .map_err(|error| {
                    format!(
                        "Could not read {} for checksum verification: {}",
                        path.display(),
                        error
                    )
                })?;

        if read == 0 {
            break;
        }

        hasher.update(&buffer[..read]);
    }

    Ok(
        format!("{:x}", hasher.finalize())
    )
}


fn extract_alpha_client_update(
    archive_path: &Path,
    root: &Path
) -> Result<(), String>
{
    let archive_file =
        File::open(archive_path)
            .map_err(|error| {
                format!(
                    "Could not open AlphaClient update archive: {}",
                    error
                )
            })?;

    let mut archive =
        ZipArchive::new(archive_file)
            .map_err(|error| {
                format!(
                    "Could not read AlphaClient update archive: {}",
                    error
                )
            })?;

    for index in 0..archive.len() {
        let mut entry =
            archive.by_index(index)
                .map_err(|error| {
                    format!(
                        "Could not read AlphaClient update entry: {}",
                        error
                    )
                })?;

        let enclosed_name =
            entry
                .enclosed_name()
                .ok_or_else(|| {
                    "AlphaClient update archive contains an unsafe file path.".to_string()
                })?
                .to_path_buf();

        let destination =
            root.join(enclosed_name);

        if entry.is_dir() {
            fs::create_dir_all(&destination)
                .map_err(|error| {
                    format!(
                        "Could not create AlphaClient update directory {}: {}",
                        destination.display(),
                        error
                    )
                })?;
            continue;
        }

        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| {
                    format!(
                        "Could not create AlphaClient update directory {}: {}",
                        parent.display(),
                        error
                    )
                })?;
        }

        let mut output =
            File::create(&destination)
                .map_err(|error| {
                    format!(
                        "Could not create AlphaClient update file {}: {}",
                        destination.display(),
                        error
                    )
                })?;

        std::io::copy(&mut entry, &mut output)
            .map_err(|error| {
                format!(
                    "Could not extract AlphaClient update file {}: {}",
                    destination.display(),
                    error
                )
            })?;
    }

    Ok(())
}


fn update_alphaclient_internal()
    -> Result<String, String>
{
    let root = create_alpha_directories()?;
    let manifest = fetch_alpha_client_manifest()?;
    let current_version = installed_alphaclient_version(&root)?;
    let mods_dir = root.join("mods");
    fs::create_dir_all(&mods_dir).map_err(|error| format!("Could not create mods directory: {}", error))?;
    let destination = mods_dir.join(ALPHACLIENT_OFFICIAL_MOD_JAR_NAME);

    // Repair a missing/corrupt install even when the version marker claims it is current.
    let jar_missing = !destination.is_file();
    if !jar_missing && !version_is_newer(&manifest.version, &current_version) {
        return Ok(format!("AlphaClient {} is already up to date.", current_version));
    }

    let download_path = root.join("downloads").join(ALPHACLIENT_UPDATE_ZIP_NAME);
    let client = http_client()?;
    download_file(&client, &manifest.download_url, &download_path)?;

    let expected_hash = manifest.sha256.trim().to_ascii_lowercase();
    if expected_hash.len() != 64 || !expected_hash.chars().all(|character| character.is_ascii_hexdigit()) {
        let _ = fs::remove_file(&download_path);
        return Err("AlphaClient release has an invalid SHA-256 checksum.".to_string());
    }

    let actual_hash = sha256_file(&download_path)?.to_ascii_lowercase();
    if actual_hash != expected_hash {
        let _ = fs::remove_file(&download_path);
        return Err(format!("AlphaClient update checksum mismatch. Expected {}, got {}.", expected_hash, actual_hash));
    }

    // GitHub publishes the client as a single JAR, not a ZIP. Replace the mod JAR
    // atomically after verifying the download and remove older copies to avoid duplicates.
    let temporary_destination = mods_dir.join("AlphaClient.jar.new");
    fs::copy(&download_path, &temporary_destination)
        .map_err(|error| format!("Could not stage AlphaClient JAR: {}", error))?;
    if destination.exists() {
        fs::remove_file(&destination)
            .map_err(|error| format!("Could not replace existing AlphaClient JAR: {}", error))?;
    }
    fs::rename(&temporary_destination, &destination)
        .map_err(|error| format!("Could not install AlphaClient JAR: {}", error))?;

    if let Ok(entries) = fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path == destination || path == download_path || path.extension().and_then(|ext| ext.to_str()).map(|ext| !ext.eq_ignore_ascii_case("jar")).unwrap_or(true) {
                continue;
            }
            if jar_is_alphastaffmod(&path) {
                let _ = fs::remove_file(path);
            }
        }
    }

    write_installed_alphaclient_version(&root, &manifest.version)?;
    let _ = fs::remove_file(&download_path);

    Ok(format!("AlphaClient updated from {} to {}.", current_version, manifest.version))
}

// ============================================================
// INSTALLATION
// ============================================================

fn install_alphaclient_internal()
    -> Result<String, String>
{
    let root =
        create_alpha_directories()?;

    let java =
        find_java_8()?;

    let client =
        http_client()?;

    download_minecraft_1_8_9(
        &root,
        &client
    )?;

    install_forge_from_installer(
        &root,
        &client
    )?;

    let vanilla_json_path =
        root
            .join("versions")
            .join(MINECRAFT_VERSION)
            .join(
                format!(
                    "{}.json",
                    MINECRAFT_VERSION
                )
            );

    let forge_json_path =
        root
            .join("versions")
            .join(FORGE_VERSION_NAME)
            .join(
                format!(
                    "{}.json",
                    FORGE_VERSION_NAME
                )
            );

    let vanilla_json =
        read_json_file(
            &vanilla_json_path
        )?;

    let forge_json =
        read_json_file(
            &forge_json_path
        )?;

    download_metadata_libraries(
        &root,
        &client,
        &vanilla_json
    )?;

    download_metadata_libraries(
        &root,
        &client,
        &forge_json
    )?;

    let asset_index =
        download_assets(
            &root,
            &client,
            &vanilla_json
        )?;

    let natives_dir =
        root
            .join("runtime")
            .join("natives");

    download_native_libraries(
        &root,
        &client,
        &vanilla_json,
        &natives_dir
    )?;

    download_native_libraries(
        &root,
        &client,
        &forge_json,
        &natives_dir
    )?;

    let forge_jar =
        root
            .join("libraries")
            .join("net")
            .join("minecraftforge")
            .join("forge")
            .join(
                "1.8.9-11.15.1.2318-1.8.9"
            )
            .join(
                FORGE_UNIVERSAL_JAR_NAME
            );

    let minecraft_jar =
        root
            .join("versions")
            .join(MINECRAFT_VERSION)
            .join(
                format!(
                    "{}.jar",
                    MINECRAFT_VERSION
                )
            );

    if !minecraft_jar.exists()
        || !forge_jar.exists()
        || !forge_json_path.exists()
    {
        return Err(
            "Installatie onvolledig: Minecraft- of Forge-bestanden ontbreken."
                .to_string()
        );
    }

    if !alpha_client_version_file(&root).exists() {
        write_installed_alphaclient_version(
            &root,
            ALPHACLIENT_VERSION
        )?;
    }

    let official_mod_path = root.join("mods").join(ALPHACLIENT_OFFICIAL_MOD_JAR_NAME);
    let mod_path = if official_mod_path.is_file() {
        official_mod_path
    } else {
        // A clean end-user install may not have a locally-built development JAR.
        // Let the GitHub updater install the official release before launching.
        copy_alphaclient_mod_to_mods(&root).unwrap_or(official_mod_path)
    };

    Ok(
        format!(
            "AlphaClient {} base-installatie is gereed. Java: {}. Minecraft {} + Forge {}. Asset-index: {}. Clientmod: {}.",
            ALPHACLIENT_VERSION,
            java.display(),
            MINECRAFT_VERSION,
            FORGE_VERSION,
            asset_index,
            mod_path.display()
        )
    )
}


// ============================================================
// TAURI COMMANDS
// ============================================================

#[tauri::command]
fn greet(
    name: &str
) -> String
{
    format!(
        "Hello, {}! You've been greeted from Rust!",
        name
    )
}


#[tauri::command]
async fn launch_alphaclient()
    -> Result<String, String>
{
    tauri::async_runtime::spawn_blocking(
        || {
            let account =
                microsoft_account_state()
                    .lock()
                    .map_err(|_| {
                        "Could not access Microsoft account state."
                            .to_string()
                    })?
                    .clone()
                    .ok_or_else(|| {
                        "Log eerst in met je Microsoft-account voordat je AlphaClient start."
                            .to_string()
                    })?;

            let access_token =
                minecraft_access_token_state()
                    .lock()
                    .map_err(|_| {
                        "Could not access Minecraft token state."
                            .to_string()
                    })?
                    .clone()
                    .ok_or_else(|| {
                        "Minecraft-sessietoken ontbreekt. Log opnieuw in."
                            .to_string()
                    })?;

            let uuid =
                minecraft_uuid_state()
                    .lock()
                    .map_err(|_| {
                        "Could not access Minecraft UUID state."
                            .to_string()
                    })?
                    .clone()
                    .ok_or_else(|| {
                        "Minecraft-UUID ontbreekt. Log opnieuw in."
                            .to_string()
                    })?;

            install_alphaclient_internal()?;
            update_alphaclient_internal()?;

            let root =
                alpha_client_directory()?;

            let java =
                find_java_8()?;

            let vanilla_json =
                read_json_file(
                    &root
                        .join("versions")
                        .join(MINECRAFT_VERSION)
                        .join(
                            format!(
                                "{}.json",
                                MINECRAFT_VERSION
                            )
                        )
                )?;

            let forge_json =
                read_json_file(
                    &root
                        .join("versions")
                        .join(FORGE_VERSION_NAME)
                        .join(
                            format!(
                                "{}.json",
                                FORGE_VERSION_NAME
                            )
                        )
                )?;

            let asset_index =
                vanilla_json
                    .get("assetIndex")
                    .and_then(|v| {
                        v.get("id")
                    })
                    .and_then(Value::as_str)
                    .unwrap_or("1.8")
                    .to_string();

            let classpath =
                build_classpath(
                    &root,
                    &vanilla_json,
                    &forge_json
                )?;

            let natives_dir =
                root
                    .join("runtime")
                    .join("natives");

            let main_class =
                forge_json
                    .get("mainClass")
                    .and_then(Value::as_str)
                    .unwrap_or(
                        "net.minecraft.launchwrapper.Launch"
                    );

            let game_dir =
                root
                    .to_string_lossy()
                    .to_string();

            let assets_dir =
                root
                    .join("assets")
                    .to_string_lossy()
                    .to_string();

            let natives_path =
                natives_dir
                    .to_string_lossy()
                    .to_string();

            let properties =
                "{}".to_string();

            let mut placeholders =
                std::collections::HashMap::<
                    &str,
                    String
                >::new();

            placeholders.insert(
                "auth_player_name",
                account.name.clone()
            );

            placeholders.insert(
                "version_name",
                FORGE_VERSION_NAME.to_string()
            );

            placeholders.insert(
                "game_directory",
                game_dir.clone()
            );

            placeholders.insert(
                "assets_root",
                assets_dir
            );

            placeholders.insert(
                "assets_index_name",
                asset_index
            );

            placeholders.insert(
                "auth_uuid",
                uuid.clone()
            );

            placeholders.insert(
                "auth_access_token",
                access_token.clone()
            );

            placeholders.insert(
                "auth_session",
                access_token
            );

            placeholders.insert(
                "user_type",
                "mojang".to_string()
            );

            placeholders.insert(
                "version_type",
                format!(
                    "AlphaClient {}",
                    ALPHACLIENT_VERSION
                )
            );

            placeholders.insert(
                "user_properties",
                properties
            );

            let raw_arguments =
                forge_json
                    .get("minecraftArguments")
                    .and_then(Value::as_str)
                    .or_else(|| {
                        vanilla_json
                            .get("minecraftArguments")
                            .and_then(Value::as_str)
                    })
                    .unwrap_or(
                        "${auth_player_name} ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userType ${user_type} --versionType ${version_type}"
                    );

            let game_arguments =
                raw_arguments
                    .split_whitespace()
                    .map(|argument| {
                        replace_launch_placeholders(
                            argument,
                            &placeholders
                        )
                    })
                    .collect::<Vec<_>>();

            let mut command =
                Command::new(
                    &java
                );

            command
                .current_dir(&root)
                .arg("-Xms512M")
                .arg("-Xmx2G")
                .arg(
                    format!(
                        "-Djava.library.path={}",
                        natives_path
                    )
                )
                .arg("-cp")
                .arg(classpath)
                .arg(main_class)
                .args(game_arguments);

            command
                .spawn()
                .map_err(|e| {
                    format!(
                        "Minecraft kon niet worden gestart met Java {}: {}",
                        java.display(),
                        e
                    )
                })?;

            Ok(
                format!(
                    "AlphaClient wordt gestart voor {}.",
                    account.name
                )
            )
        }
    )
    .await
    .map_err(|error| {
        format!(
            "AlphaClient launch task failed: {}",
            error
        )
    })?
}


fn start_offline_test_internal(
    username: String
) -> Result<String, String>
{
    let username =
        username.trim().to_string();

    if username.is_empty() {
        return Err(
            "Enter a test username before starting the offline test.".to_string()
        );
    }

    if username.len() > 16 {
        return Err(
            "The test username may contain at most 16 characters.".to_string()
        );
    }

    if !username
        .chars()
        .all(|character| {
            character.is_ascii_alphanumeric()
                || character == '_'
        })
    {
        return Err(
            "The test username may only contain letters, numbers and underscores.".to_string()
        );
    }

    let root =
        prepare_alpha_client_dev_sandbox()?;

    let java =
        find_java_8()?;

    let vanilla_json_path =
        root
            .join("versions")
            .join(MINECRAFT_VERSION)
            .join(
                format!(
                    "{}.json",
                    MINECRAFT_VERSION
                )
            );

    let forge_json_path =
        root
            .join("versions")
            .join(FORGE_VERSION_NAME)
            .join(
                format!(
                    "{}.json",
                    FORGE_VERSION_NAME
                )
            );

    if !vanilla_json_path.exists() {
        return Err(
            "Minecraft 1.8.9 is not installed yet. Use Install / Repair Selected Client first.".to_string()
        );
    }

    if !forge_json_path.exists() {
        return Err(
            "Forge 1.8.9-11.15.1.2318 is not installed yet. Use Install / Repair Selected Client first.".to_string()
        );
    }

    let vanilla_json =
        read_json_file(
            &vanilla_json_path
        )?;

    let forge_json =
        read_json_file(
            &forge_json_path
        )?;

    let asset_index =
        vanilla_json
            .get("assetIndex")
            .and_then(|value| value.get("id"))
            .and_then(Value::as_str)
            .unwrap_or("1.8")
            .to_string();

    let classpath =
        build_classpath(
            &root,
            &vanilla_json,
            &forge_json
        )?;

    let natives_dir =
        root
            .join("runtime")
            .join("natives");

    let main_class =
        forge_json
            .get("mainClass")
            .and_then(Value::as_str)
            .unwrap_or(
                "net.minecraft.launchwrapper.Launch"
            );

    let game_dir =
        root
            .to_string_lossy()
            .to_string();

    let assets_dir =
        root
            .join("assets")
            .to_string_lossy()
            .to_string();

    let natives_path =
        natives_dir
            .to_string_lossy()
            .to_string();

    // A fixed valid UUID is sufficient for a local/offline test profile.
    // It is deliberately not taken from Microsoft/Minecraft authentication state.
    let offline_uuid =
        "00000000-0000-0000-0000-000000000001".to_string();

    let mut placeholders =
        std::collections::HashMap::<
            &str,
            String
        >::new();

    placeholders.insert(
        "auth_player_name",
        username.clone()
    );

    placeholders.insert(
        "version_name",
        FORGE_VERSION_NAME.to_string()
    );

    placeholders.insert(
        "game_directory",
        game_dir
    );

    placeholders.insert(
        "assets_root",
        assets_dir
    );

    placeholders.insert(
        "assets_index_name",
        asset_index
    );

    placeholders.insert(
        "auth_uuid",
        offline_uuid
    );

    placeholders.insert(
        "auth_access_token",
        "0".to_string()
    );

    placeholders.insert(
        "auth_session",
        "0".to_string()
    );

    placeholders.insert(
        "user_type",
        "legacy".to_string()
    );

    placeholders.insert(
        "version_type",
        format!(
            "AlphaClient {}",
            ALPHACLIENT_VERSION
        )
    );

    placeholders.insert(
        "user_properties",
        "{}".to_string()
    );

    let raw_arguments =
        forge_json
            .get("minecraftArguments")
            .and_then(Value::as_str)
            .or_else(|| {
                vanilla_json
                    .get("minecraftArguments")
                    .and_then(Value::as_str)
            })
            .unwrap_or(
                "${auth_player_name} ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userType ${user_type} --versionType ${version_type}"
            );

    let game_arguments =
        raw_arguments
            .split_whitespace()
            .map(|argument| {
                replace_launch_placeholders(
                    argument,
                    &placeholders
                )
            })
            .collect::<Vec<_>>();

    let mut command =
        Command::new(&java);

    command
        .current_dir(&root)
        .arg("-Xms512M")
        .arg("-Xmx2G")
        .arg(
            format!(
                "-Djava.library.path={}",
                natives_path
            )
        )
        .arg("-cp")
        .arg(classpath)
        .arg(main_class)
        .args(game_arguments);

    command
        .spawn()
        .map_err(|error| {
            format!(
                "Minecraft kon niet worden gestart met Java {}: {}",
                java.display(),
                error
            )
        })?;

    Ok(
        format!(
            "AlphaClient offline test wordt gestart voor {}.",
            username
        )
    )
}


#[tauri::command]
async fn start_offline_test(
    username: String
) -> Result<String, String>
{
    tauri::async_runtime::spawn_blocking(
        move || {
            start_offline_test_internal(
                username
            )
        }
    )
    .await
    .map_err(|error| {
        format!(
            "Offline test launch task failed: {}",
            error
        )
    })?
}


#[tauri::command]
fn get_alphaclient_version()
    -> Result<String, String>
{
    let root =
        create_alpha_directories()?;

    installed_alphaclient_version(&root)
}


#[tauri::command]
async fn check_alphaclient_update()
    -> Result<AlphaClientUpdateInfo, String>
{
    tauri::async_runtime::spawn_blocking(
        check_alphaclient_update_internal
    )
    .await
    .map_err(|error| {
        format!(
            "AlphaClient update check task failed: {}",
            error
        )
    })?
}


#[tauri::command]
async fn update_alphaclient()
    -> Result<String, String>
{
    tauri::async_runtime::spawn_blocking(
        update_alphaclient_internal
    )
    .await
    .map_err(|error| {
        format!(
            "AlphaClient update task failed: {}",
            error
        )
    })?
}


#[tauri::command]
async fn install_alphaclient()
    -> Result<String, String>
{
    tauri::async_runtime::spawn_blocking(
        install_alphaclient_internal
    )
    .await
    .map_err(|error| {
        format!(
            "AlphaClient installation task failed: {}",
            error
        )
    })?
}


#[tauri::command]
fn get_alphaclient_directory_path()
    -> Result<String, String>
{
    Ok(
        alpha_client_directory()?
            .display()
            .to_string()
    )
}


#[tauri::command]
fn finish_startup(app: tauri::AppHandle) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "Main launcher window was not found.".to_string())?;

    main.show().map_err(|error| error.to_string())?;
    main.set_focus().map_err(|error| error.to_string())?;

    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }

    Ok(())
}


// ============================================================
// TAURI APPLICATION
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run()
{
    tauri::Builder::default()
        .setup(|app| {
            // Open the launcher at a comfortable, centered size by default.
            // This avoids requiring the user to maximize the window every time.
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let scale_factor = monitor.scale_factor();
                    let monitor_size = monitor.size();

                    let screen_width = monitor_size.width as f64 / scale_factor;
                    let screen_height = monitor_size.height as f64 / scale_factor;

                    // Use most of the available screen while keeping the window
                    // at a sensible size on both large and smaller displays.
                    let width = (screen_width * 0.82).min(1440.0).max(1100.0_f64.min(screen_width));
                    let height = (screen_height * 0.82).min(920.0).max(700.0_f64.min(screen_height));

                    window.set_min_size(Some(tauri::Size::Logical(
                        tauri::LogicalSize::new(1000.0_f64.min(screen_width), 650.0_f64.min(screen_height))
                    )))?;
                    window.set_size(tauri::Size::Logical(
                        tauri::LogicalSize::new(width, height)
                    ))?;
                    window.center()?;
                }
            }

            Ok(())
        })
        .plugin(
            tauri_plugin_opener::init()
        )
        .invoke_handler(
            tauri::generate_handler![
                greet,
                finish_startup,
                launch_alphaclient,
                start_offline_test,
                get_alphaclient_version,
                check_alphaclient_update,
                update_alphaclient,
                install_alphaclient,
                get_alphaclient_directory_path,
                start_microsoft_login,
                logout_microsoft,
                get_microsoft_account
            ]
        )
        .run(
            tauri::generate_context!()
        )
        .expect(
            "error while running Alpha Launcher"
        );
}