# ArchVita

EmuDeck-style bubble builder for the PS Vita. Point it at a ROM library, pick
the games you care about, and it generates one LiveArea bubble per game that
boots straight into the emulator, with box art on the home screen and a
screenshot on the LiveArea page. Bubbles can be pushed to the console over FTP
or exported as folders or VPKs.

## How it works

A bubble is an ordinary Vita app folder:

```
ux0:app/AV3K7QW2P/
  eboot.bin                      tiny launcher, identical for every bubble
  launch.txt                     the URI it launches, e.g.
                                 psgm:play?titleid=RETROVITA&param=app0:/snes9x2005_libretro.self&param2=ux0:data/roms/snes/Game.sfc
  archvita.json                  what this bubble was built from
  sce_sys/param.sfo              title and title ID
  sce_sys/icon0.png              128x128 home screen icon
  sce_sys/package/head.bin       lets VitaShell register the folder
  sce_sys/livearea/contents/     bg.png, startup.png, template.xml
```

The launcher reads `launch.txt`, calls the system's launch-by-URI function and
exits. RetroArch, DaedalusX64, Flycast and Emu4Vita++ all accept a ROM path
that way, so the user lands directly in the game. Title IDs are derived from a
hash of the ROM path, so re-running ArchVita updates existing bubbles instead
of creating duplicates.

Artwork comes from the libretro thumbnail repositories, which are keyed by
No-Intro names. ROMs named like `Super Mario World (USA).sfc` match without
any configuration.

## Requirements

On the PC:

- Node.js 20.19 or newer, when running from source
- The launcher binary (`resources/launcher/eboot.bin`), when running from
  source. The packaged builds ship it. Download `eboot.bin` from a release
  on the Releases page, or build it with [VitaSDK](https://vitasdk.org/) as
  described in `launcher/README.md`.

On the Vita:

- HENkaku or h-encore² with unsafe homebrew enabled
- VitaShell, for the FTP server. Its `PROM` command (VitaShell 0.95 and newer)
  lets ArchVita install bubbles directly; **Refresh LiveArea** (Triangle menu
  at the device list) is only needed after USB exports and emulator installs
- The emulators you want to use: RetroArch (with its cores), DaedalusX64,
  Flycast, Emu4Vita++. The Emulators tab installs these for you.
- For DaedalusX64 and Flycast, the runtime shader compiler
  (`ur0:data/libshacccg.suprx`). It is not part of the firmware; the Emulators
  tab installs ShaRKBR33D, a one-click tool that fetches it, and you run that
  once on the Vita with Wi-Fi connected. Without it those emulators stop with
  "Runtime shader compiler (libshacccg.suprx) is not installed".

## Installing

Every tagged release on the Releases page carries:

- `ArchVita-<version>-win-x64.exe`, an installer for Windows
- `ArchVita-<version>-mac-arm64.dmg` for Apple Silicon Macs and
  `ArchVita-<version>-mac-x64.dmg` for Intel Macs
- `ArchVita-<version>-linux-x64.AppImage`; make it executable and run it (some
  distributions need the `libfuse2` package for AppImages)
- `eboot.bin`, the launcher, only needed when running from source

The builds are not code-signed. Windows SmartScreen shows "Windows protected
your PC"; choose "More info", then "Run anyway". macOS refuses to open an
unsigned download until its quarantine flag is cleared, so after copying the
app to Applications run `xattr -cr /Applications/ArchVita.app` once.

## Getting started

```sh
npm install
npm run dev
```

1. In **Settings**, choose the ROM library folder. It needs one sub-folder per
   system, EmuDeck style: `snes`, `nes`, `gba`, `genesis`, `psx`, `n64`, ...
   "Create system folders" makes all of them for you and writes a
   `README-ArchVita.txt` into the folder that lists which system each one is
   for and which file types belong there. The full list of recognised folder
   names is in `src/shared/systems.ts`.
2. In **Library**, scan, select the games you want bubbles for, and fetch
   artwork. Emulator and core can be changed per game; the defaults are the
   usual fast cores for the Vita.
3. In **Emulators**, install RetroArch and whatever else your games use. The
   packages are downloaded from the libretro buildbot and the emulators'
   GitHub releases, unpacked, and pushed into `ux0:app` like a bubble. For
   RetroArch and Emu4Vita++ only the cores your library needs are installed
   unless you ask for all of them, which keeps a 500 MB package down to a few
   dozen megabytes. RetroArch can be installed from the stable release or
   the nightly build; cloud sync of saves to a WebDAV server, HTTPS, and
   loading games from SMB or NFS shares exist only in nightlies until the
   next stable release. "Check the Vita" shows what is already there and which
   cores are missing, and any other VPK can be installed the same way.
4. Back in **Library**, use the bar at the bottom. Press "Check the Vita"
   first: it lists which selected games would fail because their emulator or
   core is not on the card, with a shortcut to fix that in the Emulators tab.
   Then either push everything to
   the Vita over FTP (start the FTP server in VitaShell first), export bubble
   folders to copy over USB, or export VPKs. An FTP sync repeats the check and
   logs a warning for every bubble whose target is missing. Over FTP each
   bubble is uploaded as a VPK to `ux0:data/ArchVita` and installed on the
   spot through VitaShell's `PROM` command, so it is on the home screen as
   soon as the sync finishes. If the FTP server is vitacompanion's, which has
   no such command, the bubble folders are uploaded instead and step 5 applies.
5. After a USB export or an emulator install, open VitaShell on the Vita,
   press Circle until you are at the device list (`ux0:`, `ur0:`, ...), press
   Triangle and choose **Refresh LiveArea**. It is only offered at that top
   level. Launch RetroArch once by itself before using a bubble.

`npm run package` builds a Windows installer with electron-builder.

Releases are built by GitHub Actions (`.github/workflows/release.yml`). To
publish one: set `version` in `package.json`, commit, then

```sh
git tag v0.2.0
git push origin main v0.2.0
```

The workflow refuses a tag that does not match `package.json`. It builds the
launcher with VitaSDK, packages the app on Windows, macOS and Linux runners
with that launcher inside, and attaches everything to a release named after
the tag. The `ci` workflow type-checks and builds every push and pull request,
and `launcher` builds the Vita binary whenever `launcher/` changes.

## DOS games

A `dos` folder is scanned for DOSBox Pure content: one `.zip` per game holding
the game's files, which is how DOSBox Pure likes them. Name the zip after the
game, `Commander Keen 1 - Marooned on Mars.zip`, and the cover art matches the
libretro DOS database. DOSBox Pure starts a game with a single executable
directly and otherwise shows its start menu to pick one; choosing an entry
there with the auto-start option makes later launches go straight in.

## Limits worth knowing

- The Vita home screen holds at most 500 icons, folders included. Keep bubbles
  for favourites and use a frontend such as RetroFlow for the long tail.
- PSP and PS1-through-Adrenaline games use a different bubble mechanism and
  are not generated yet. PS1 through the RetroArch core works.
- RetroArch cannot launch a ROM whose path contains `&`. ArchVita renames such
  files to `_` when uploading.
- Removing a bubble has to be done on the Vita (hold the icon, Delete), since
  deleting the folder over FTP would leave a dead entry in the app database.

## Project layout

```
.github/         CI, launcher and release workflows
launcher/        C source for the launcher eboot.bin (VitaSDK, CMake)
resources/       bundled launcher binary (not committed; see Requirements)
src/shared/      types, system table, emulator profiles, URI builder
src/main/        Electron main: scanning, artwork, image rendering, SFO and
                 head.bin writers, VPK packing, FTP sync, emulator downloads
                 and a small streaming zip reader
src/preload/     IPC bridge
src/renderer/    React UI
```

## License

GPL-3.0. The `head.bin` template and the way it is patched come from
[VitaShell](https://github.com/TheOfficialFloW/VitaShell), which is GPL-3.0.

## Troubleshooting

**`npm run dev` fails with "Error: Electron uninstall"** while `npm run package`
works. electron-vite starts the Electron binary from
`node_modules/electron/dist`, and that binary is downloaded by the `electron`
package's install script, which also writes `node_modules/electron/path.txt`.
Recent npm versions do not run dependencies' install scripts until they are
approved, so after a fresh install the warning `1 package has install scripts
not yet covered by allowScripts` means the download never happened. This
repository's `package.json` approves Electron's script in its `allowScripts`
field; if you still see the warning, approve it and rerun the script:

```sh
npm install-scripts approve electron --no-allow-scripts-pin
npm rebuild electron
```

Packaging works regardless because electron-builder downloads its own copy of
Electron. An `.npmrc` with `ignore-scripts=true` or an
`ELECTRON_SKIP_BINARY_DOWNLOAD` environment variable causes the same symptom.

**Uploads fail with `read ECONNRESET (data socket)`.** The Vita's FTP server
dropped the data connection, which its Wi-Fi does from time to time during
long transfers. ArchVita reconnects and retries each file up to three times,
verifies sizes after upload, and skips files that already arrived, so if an
install or sync still gives up, running it again continues where it stopped.
Keeping the Vita awake and close to the access point helps; a USB export
avoids the problem entirely.

**`connect ETIMEDOUT ... (control socket)`.** Nothing is listening at that
address. In VitaShell the FTP server runs only while its "FTP server is now
running" dialog is open: pressing Select opens it and shows the IP address to
use, and closing it stops the server and lets the console go back to sleep.
Any trip to the home screen, a Refresh LiveArea, or launching a game ends the
session, so reopen the dialog before each install or sync and check that the
IP still matches Settings. ArchVita waits and retries the connection for a
while, so you can start the install first and open the dialog afterwards.
