#!/usr/bin/env bash
set -euo pipefail

REPO="harald666/vibez"
API_URL="https://api.github.com/repos/${REPO}/releases/latest"

info() {
  printf '==> %s\n' "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v uname >/dev/null 2>&1 || fail "uname is required."

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)
    ;;
  *)
    fail "VibeZ currently provides Linux packages for x86_64/amd64 only. Detected architecture: ${ARCH}."
    ;;
esac

if [[ ! -r /etc/os-release ]]; then
  fail "Could not detect your Linux distribution (/etc/os-release is missing)."
fi

# shellcheck disable=SC1091
. /etc/os-release
DISTRO_ID="${ID:-unknown}"
DISTRO_LIKE="${ID_LIKE:-}"

info "Checking the latest VibeZ release..."
RELEASE_JSON="$(curl -fsSL --retry 3 "$API_URL")" || fail "Could not contact GitHub Releases."
TAG="$(printf '%s\n' "$RELEASE_JSON" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
[[ -n "$TAG" ]] || fail "Could not determine the latest VibeZ version."
VERSION="${TAG#v}"
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ "${EUID}" -eq 0 ]]; then
  SUDO=()
else
  command -v sudo >/dev/null 2>&1 || fail "sudo is required to install VibeZ system-wide."
  SUDO=(sudo)
fi

install_deb() {
  local file="VibeZ_${VERSION}_amd64.deb"
  info "Detected Debian/Ubuntu-based Linux."
  info "Downloading VibeZ ${VERSION}..."
  curl -fL --retry 3 -o "$TMP_DIR/$file" "$BASE_URL/$file"
  info "Installing ${file}..."
  "${SUDO[@]}" apt install -y "$TMP_DIR/$file"
}

install_rpm() {
  local file="VibeZ-${VERSION}.x86_64.rpm"
  info "Detected Fedora/RPM-based Linux."
  info "Downloading VibeZ ${VERSION}..."
  curl -fL --retry 3 -o "$TMP_DIR/$file" "$BASE_URL/$file"
  info "Installing ${file}..."

  if command -v dnf >/dev/null 2>&1; then
    "${SUDO[@]}" dnf install -y "$TMP_DIR/$file"
  elif command -v yum >/dev/null 2>&1; then
    "${SUDO[@]}" yum install -y "$TMP_DIR/$file"
  else
    fail "No supported RPM package manager was found (dnf or yum)."
  fi
}

install_pacman() {
  local file="VibeZ-${VERSION}.pacman"
  info "Detected Arch-based Linux."
  info "Downloading VibeZ ${VERSION}..."
  curl -fL --retry 3 -o "$TMP_DIR/$file" "$BASE_URL/$file"
  info "Installing ${file}..."
  "${SUDO[@]}" pacman -U --noconfirm "$TMP_DIR/$file"
}

case " ${DISTRO_ID} ${DISTRO_LIKE} " in
  *" debian "*|*" ubuntu "*)
    install_deb
    ;;
  *" fedora "*|*" rhel "*|*" centos "*)
    install_rpm
    ;;
  *" arch "*)
    install_pacman
    ;;
  *)
    fail "Unsupported distribution: ${PRETTY_NAME:-$DISTRO_ID}. Download the AppImage from https://github.com/${REPO}/releases/latest instead."
    ;;
esac

info "VibeZ ${VERSION} installed successfully."
