# Run SAM build. Uses Makefile so pip runs with --timeout 600 (avoids "Read timed out").
# Requires: make (e.g. run from Git Bash, or install make on Windows).
# If you don't have make: use Docker and run .\sam-build.ps1 --use-container
# Usage: .\sam-build.ps1   or   .\sam-build.ps1 --use-container

& sam build @args
