# Android release signing

How release signing works in MacroZone and how it survives `prebuild --clean`.

## Layout

```
macrozone/
├── credentials/
│   └── release.keystore          # created once (gitignored)
├── credentials.example.json      # committed path + alias template
├── .env.local                    # signing passwords (gitignored)
├── plugins/
│   └── withAndroidReleaseSigning.js
├── app.config.js                 # loads .env.local + registers plugin
├── android/                      # generated — deleted on prebuild clean
└── ios/                          # generated
```

| Persistent (safe) | Generated (prebuild) |
|-------------------|----------------------|
| `credentials/release.keystore` | `android/` |
| `.env.local` | `ios/` |
| `plugins/withAndroidReleaseSigning.js` | |
| `app.config.js` | |

## One-time setup (production signing)

### 1. Environment file

```bash
cp .env.example .env.local
```

Fill in:

```env
ANDROID_KEYSTORE_PASSWORD=your-keystore-password
ANDROID_KEY_PASSWORD=your-key-password
ANDROID_KEY_ALIAS=upload
```

### 2. Create keystore

```bash
bun run keystore:create
```

- Writes `credentials/release.keystore`
- Fails if the file already exists
- To overwrite (breaks Play updates for the same signing key): `bun run keystore:create -- --force` and type `macrozone`

### 3. Back up

Store `credentials/release.keystore` and passwords securely off this machine. Losing them means you cannot publish updates to the same Play listing.

## Device release testing

Both commands build and install the Android `release` variant on a connected device (`com.anonymous.macrozone`). They differ only in signing:

| Command | Signing | Production credentials |
|---------|---------|------------------------|
| `bun run android:release:test` | Android debug keystore | Not required |
| `bun run android:release:prod` | Configured release/upload keystore | Required in `.env.local` |

The test build has release-mode behavior for checking issues that only appear outside the debug build, but its debug signature makes it unsuitable for distribution or Play uploads. The production command checks for the release keystore and passwords before prebuild. `android:standalone` is an alias for `android:release:prod`.

Both variants use the same application ID. Android will reject installing one over the other when their signing certificates differ; uninstall the existing app before switching signatures. Uninstalling clears the app's local data.

Each device command explicitly runs Android prebuild with its selected signing mode, so switching modes updates the generated Gradle configuration instead of relying on stale `android/` files. Test mode removes generated `MYAPP_UPLOAD_*` Gradle properties and selects the Android debug signing config for `release`.

## Production release artifacts

```bash
bun run build:aab    # Play Store bundle
# or
bun run build:apk    # sideload / beta APK
```

These artifact scripts:

1. Validate keystore + `.env.local` passwords
2. Run `expo prebuild --platform android` (config plugin injects signing)
3. Run Gradle `bundleRelease` or `assembleRelease`

Verify the certificate:

```bash
bun run verify:signature
```

## Prebuild clean

Regenerate native projects without losing signing:

```bash
bun run prebuild:android:clean   # stops Gradle, wipes android/, regenerates
```

- `credentials/release.keystore` is **not** deleted
- Production signing is **re-applied** on the next `build:aab` / `build:apk` because the config plugin runs during prebuild
- Device release commands also re-apply their selected test or production signing mode during prebuild

Other clean commands:

| Command | Scope |
|---------|--------|
| `bun run prebuild:clean` | Both platforms (Gradle stop for Android) |
| `bun run prebuild:ios:clean` | iOS only |

## How signing survives clean

[`plugins/withAndroidReleaseSigning.js`](../plugins/withAndroidReleaseSigning.js) runs on every prebuild and selects signing based on `ANDROID_RELEASE_SIGNING_MODE`:

1. `test` mode removes `MYAPP_UPLOAD_*` properties and points `buildTypes.release` at the Android debug signing config.
2. `prod` mode writes `MYAPP_UPLOAD_*` properties to `android/gradle.properties`, adds a `release` `signingConfigs` block to `android/app/build.gradle`, and points `buildTypes.release` at it.

The production keystore path is relative to `android/app/`: `../credentials/release.keystore`. The mode is selected by the device runner; regular production artifact builds default to `prod`.

## EAS Build (optional)

Local Gradle signing is separate from [EAS Build](../eas.json). You can upload the same local keystore to EAS:

```bash
eas credentials
```

Choose Android → production → upload existing keystore. Use the same file and passwords as local builds. See [Expo credentials docs](https://docs.expo.dev/app-signing/app-credentials/).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `android:release:prod` reports missing keystore/password | Create the release keystore and configure `.env.local`; use `android:release:test` when production signing is not needed |
| `Release keystore missing` | Run `bun run keystore:create` |
| `ANDROID_KEYSTORE_PASSWORD is not set` | Fill `.env.local` from `.env.example` |
| `EBUSY` deleting `android/` on clean | Use `prebuild:android:clean` (stops Gradle first) |
| Release build unsigned | Re-run `build:aab`; ensure `.env.local` is set before prebuild |
| `[app.config.js] Release keystore not found` | Warning only for production signing; create the keystore before a production release build |
