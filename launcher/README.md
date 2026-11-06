# ArchVita launcher

The tiny Vita-side half of ArchVita. Every bubble ArchVita generates is this
binary plus a `launch.txt` next to it. On start it reads the launch URI from
`app0:/launch.txt`, hands it to `sceAppMgrLaunchAppByUri`, and exits. The
system replaces the bubble's process with the emulator, so the user lands
straight in the game.

If the launch fails, the error code and URI are appended to
`ux0:data/ArchVita/launcher.log`.

## Building

Requires [VitaSDK](https://vitasdk.org/).

```sh
cmake -S launcher -B build/launcher
cmake --build build/launcher
cp build/launcher/eboot.bin resources/launcher/eboot.bin
```

Or without a local toolchain, using the official Docker image. Run these from
the repository root.

Bash:

```sh
docker run --rm -v "$PWD":/work -w /work vitasdk/vitasdk:latest \
  sh -c "cmake -S launcher -B build/launcher && cmake --build build/launcher"
cp build/launcher/eboot.bin resources/launcher/eboot.bin
```

PowerShell (one line, PowerShell does not treat a trailing backslash as a
line continuation):

```powershell
docker run --rm -v "${PWD}:/work" -w /work vitasdk/vitasdk:latest sh -c "cmake -S launcher -B build/launcher && cmake --build build/launcher"
Copy-Item build\launcher\eboot.bin resources\launcher\eboot.bin
```

The GitHub workflow in `.github/workflows/launcher.yml` builds the same binary
on every change under `launcher/` and attaches it to tagged releases.
