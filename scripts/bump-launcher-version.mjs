import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value, "utf8");

const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
const tauriConfig = JSON.parse(read("src-tauri/tauri.conf.json"));
const cargoToml = read("src-tauri/Cargo.toml");
const cargoLock = read("src-tauri/Cargo.lock");

const versions = [
  packageJson.version,
  packageLock.version,
  packageLock.packages?.[""]?.version,
  tauriConfig.version,
  cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
  cargoLock.match(/\[\[package\]\]\nname = "alphalauncher"\nversion = "([^"]+)"/)?.[1],
];

if (versions.some((version) => !version) || new Set(versions).size !== 1) {
  throw new Error(`Launcher version fields are missing or out of sync: ${versions.join(", ")}`);
}

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(versions[0]);
if (!match) throw new Error(`Unsupported launcher version format: ${versions[0]}`);

const nextVersion = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;

packageJson.version = nextVersion;
packageLock.version = nextVersion;
packageLock.packages[""].version = nextVersion;
tauriConfig.version = nextVersion;

write("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
write("package-lock.json", `${JSON.stringify(packageLock, null, 2)}\n`);
write("src-tauri/tauri.conf.json", `${JSON.stringify(tauriConfig, null, 2)}\n`);
write("src-tauri/Cargo.toml", cargoToml.replace(/^(version\s*=\s*")[^"]+(")/m, `$1${nextVersion}$2`));
write(
  "src-tauri/Cargo.lock",
  cargoLock.replace(
    /(\[\[package\]\]\nname = "alphalauncher"\nversion = ")[^"]+(")/,
    `$1${nextVersion}$2`,
  ),
);

console.log(`Alpha Launcher version: ${versions[0]} -> ${nextVersion}`);
