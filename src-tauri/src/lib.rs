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

// XboxLive.signin is required for the Xbox Live authentication step.
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
    // Echte Minecraft Java gebruikersnaam.
    name: String,

    // Microsoft account e-mail.
    email: String,

    // Minecraft UUID.
    uuid: String,
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


// Clear all in-memory credentials so failed logins cannot leave stale tokens.
fn clear_microsoft_auth_state() {
    if let Ok(mut value) = microsoft_account_state().lock() { *value = None; }
    if let Ok(mut value) = microsoft_access_token_state().lock() { *value = None; }
    if let Ok(mut value) = microsoft_refresh_token_state().lock() { *value = None; }
    if let Ok(mut value) = xbox_live_token_state().lock() { *value = None; }
    if let Ok(mut value) = xsts_token_state().lock() { *value = None; }
    if let Ok(mut value) = xbox_user_hash_state().lock() { *value = None; }
    if let Ok(mut value) = minecraft_access_token_state().lock() { *value = None; }
    if let Ok(mut value) = minecraft_uuid_state().lock() { *value = None; }
}


// ============================================================
// TAURI COMMANDS - MICROSOFT
// ============================================================

#[tauri::command]
async fn start_microsoft_login()
    -> Result<MicrosoftAccount, String>
{
    tauri::async_runtime::spawn_blocking(perform_microsoft_login)
        .await
        .map_err(|error| format!("Microsoft login task failed: {}", error))?
}


#[tauri::command]
fn logout_microsoft() -> Result<(), String> {
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
    // PKCE
    // --------------------------------------------------------

    let state =
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
    // IMPORTANT:
    //
    // We do NOT send "success" to the browser here.
    //
    // The entire authentication chain must succeed first:
    //
    // Microsoft
    //      ↓
    // Xbox Live
    //      ↓
    // XSTS
    //      ↓
    // Minecraft Services
    //      ↓
    // Ownership
    //      ↓
    // Minecraft profile
    //
    // Only then do we send the success page.
    // --------------------------------------------------------

    let login_result:
        Result<MicrosoftAccount, String> =
        (|| {

            // ------------------------------------------------
            // Exchange authorization code
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
            // Microsoft account information
            // ------------------------------------------------

            let id_token =
                token_response
                    .id_token
                    .as_deref()
                    .ok_or_else(|| {
                        "Microsoft did not return an ID token. Make sure the 'openid' scope is enabled."
                            .to_string()
                    })?;

            // The Microsoft access token requested with XboxLive.signin
            // is intended for Xbox authentication, not Microsoft Graph.
            // Read display-only account details from the OIDC ID token instead
            // of sending the Xbox-scoped access token to Graph's userinfo API.
            let microsoft_info =
                get_microsoft_user_info_from_id_token(
                    id_token
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
    // ONLY NOW tell the browser whether login succeeded.
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
// MICROSOFT USER INFO
// ============================================================

fn get_microsoft_user_info_from_id_token(
    id_token: &str
) -> Result<MicrosoftAccount, String>
{
    // OIDC ID tokens are JWTs. We decode the claims only to display the
    // account label/email in the launcher. Authentication and Minecraft
    // entitlement decisions must continue to use the Xbox/Minecraft tokens
    // and their server responses, never these display-only claims.
    let mut parts = id_token.split('.');

    let _header = parts.next().ok_or_else(|| {
        "Microsoft returned an invalid ID token (missing header).".to_string()
    })?;

    let payload = parts.next().ok_or_else(|| {
        "Microsoft returned an invalid ID token (missing claims).".to_string()
    })?;

    if parts.next().is_none() || parts.next().is_some() {
        return Err(
            "Microsoft returned an invalid ID token format.".to_string()
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

    let email =
        info.email
            .or(info.preferred_username)
            .unwrap_or_else(|| "Microsoft Account".to_string());

    Ok(MicrosoftAccount {
        name: "Minecraft Account".to_string(),
        email,
        uuid: String::new(),
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
    // --------------------------------------------------------
    // JAVA_HOME
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // PATH
    // --------------------------------------------------------

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
    let parts =
        name
            .split(':')
            .collect::<Vec<_>>();

    if parts.len() < 3 {
        return None;
    }

    let group =
        parts[0]
            .replace('.', "/");

    let artifact =
        parts[1];

    let version =
        parts[2];

    let classifier =
        if parts.len() >= 4 {
            Some(parts[3])
        } else {
            None
        };

    let extension =
        if parts.len() >= 5 {
            parts[4]
        } else {
            "jar"
        };

    let file_name =
        match classifier {
            Some(classifier) => {
                format!(
                    "{}-{}-{}.{}",
                    artifact,
                    version,
                    classifier,
                    extension
                )
            }

            None => {
                format!(
                    "{}-{}.{}",
                    artifact,
                    version,
                    extension
                )
            }
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

    // --------------------------------------------------------
    // Read install profile
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Extract Forge universal JAR
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Download Forge libraries
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Write Forge version JSON
    // --------------------------------------------------------

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
// INSTALLATION
// ============================================================

fn install_alphaclient_internal()
    -> Result<String, String>
{
    let root =
        create_alpha_directories()?;

    // --------------------------------------------------------
    // Require Java 8
    // --------------------------------------------------------

    let java =
        find_java_8()?;

    // --------------------------------------------------------
    // HTTP client
    // --------------------------------------------------------

    let client =
        http_client()?;

    // --------------------------------------------------------
    // Minecraft 1.8.9
    // --------------------------------------------------------

    download_minecraft_1_8_9(
        &root,
        &client
    )?;

    // --------------------------------------------------------
    // Forge 1.8.9
    // --------------------------------------------------------

    install_forge_from_installer(
        &root,
        &client
    )?;

    // --------------------------------------------------------
    // Validate installation
    // --------------------------------------------------------

    let forge_json =
        root
            .join("versions")
            .join(FORGE_VERSION_NAME)
            .join(
                format!(
                    "{}.json",
                    FORGE_VERSION_NAME
                )
            );

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

    if !minecraft_jar.exists() {
        return Err(
            "Minecraft installation finished without creating the Minecraft JAR."
                .to_string()
        );
    }

    if !forge_json.exists() {
        return Err(
            "Forge installation finished without creating its version JSON."
                .to_string()
        );
    }

    if !forge_jar.exists() {
        return Err(
            "Forge installation finished without creating the Forge JAR."
                .to_string()
        );
    }

    Ok(
        format!(
            "AlphaClient {} preparation completed. Java: {}. Minecraft {} + Forge {} are installed.",
            ALPHACLIENT_VERSION,
            java.display(),
            MINECRAFT_VERSION,
            FORGE_VERSION
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
    /*
     * Op dit moment wordt Minecraft + Forge voorbereid.
     *
     * De daadwerkelijke JVM launch komt hierna.
     *
     * Daarvoor gebruiken we:
     *
     * - Java 8
     * - Minecraft 1.8.9
     * - Forge 11.15.1.2318
     * - Minecraft libraries
     * - Minecraft assets
     * - Forge libraries
     * - Microsoft authentication
     * - Xbox Live authentication
     * - XSTS authentication
     * - Minecraft Services authentication
     * - Minecraft username
     * - Minecraft UUID
     * - Minecraft access token
     */

    tauri::async_runtime::spawn_blocking(install_alphaclient_internal)
        .await
        .map_err(|error| format!("AlphaClient launch preparation task failed: {}", error))?
}


#[tauri::command]
async fn install_alphaclient()
    -> Result<String, String>
{
    tauri::async_runtime::spawn_blocking(install_alphaclient_internal)
        .await
        .map_err(|error| format!("AlphaClient installation task failed: {}", error))?
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


// ============================================================
// TAURI APPLICATION
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run()
{
    tauri::Builder::default()
        .plugin(
            tauri_plugin_opener::init()
        )
        .invoke_handler(
            tauri::generate_handler![
                greet,
                launch_alphaclient,
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