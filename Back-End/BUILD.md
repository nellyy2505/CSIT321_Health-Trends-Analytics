# SAM build

If `sam build` fails with **pip "Read timed out"** or **PythonPipBuilder:ResolveDependencies**:

## Option 1: Build with Docker (recommended on Windows)

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/), then:

```powershell
cd Back-End
sam build --use-container
```

## Option 2: Build with Makefile (long pip timeout)

The template uses a Makefile that runs `pip install --timeout 600`. You need `make` and Unix tools:

- **Git Bash**: open "Git Bash", `cd` to this repo's `Back-End` folder, then run:
  ```bash
  sam build
  ```
- **WSL**: same as above from a WSL terminal.

## Option 3: Use default builder with env timeout

In PowerShell, set a long timeout and retry:

```powershell
$env:PIP_DEFAULT_TIMEOUT = 600
$env:PIP_RETRIES = 10
sam build
```

If it still times out, use Option 1 (Docker) or Option 2 (Git Bash).

## After a successful build

```powershell
sam deploy
# or first-time: sam deploy --guided
```
