#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  sven-mirror-agent — one-line installer for any Linux device
#
#  curl -sSL https://raw.githubusercontent.com/47matrix/sven/main/services/sven-mirror-agent/install.sh | bash
#  wget -qO- ... | bash
#
#  Supports: x86_64, aarch64/arm64, armv7l (Raspberry Pi, cloud VMs, NUCs, etc.)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

INSTALL_DIR="${SVEN_INSTALL_DIR:-/opt/sven-mirror-agent}"
SERVICE_NAME="sven-mirror-agent"
PYTHON_MIN="3.10"

# ── Colours ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ── Pre-checks ──────────────────────────────────────────────
[[ "$(uname -s)" == "Linux" ]] || fail "This installer only supports Linux."

ARCH="$(uname -m)"
case "$ARCH" in
    x86_64|aarch64|arm64|armv7l|armv6l)
        info "Architecture: $ARCH"
        ;;
    *)
        fail "Unsupported architecture: $ARCH"
        ;;
esac

# Check Python
PYTHON=""
for py in python3.12 python3.11 python3.10 python3; do
    if command -v "$py" &>/dev/null; then
        ver="$("$py" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
        major="${ver%%.*}"
        minor="${ver#*.}"
        if [[ "$major" -ge 3 && "$minor" -ge 10 ]]; then
            PYTHON="$py"
            break
        fi
    fi
done

if [[ -z "$PYTHON" ]]; then
    info "Python >= $PYTHON_MIN not found — installing..."
    if command -v apt-get &>/dev/null; then
        sudo apt-get update -qq
        sudo apt-get install -y -qq python3 python3-venv python3-pip
    elif command -v dnf &>/dev/null; then
        sudo dnf install -y python3 python3-pip
    elif command -v pacman &>/dev/null; then
        sudo pacman -Sy --noconfirm python python-pip
    elif command -v apk &>/dev/null; then
        sudo apk add python3 py3-pip
    else
        fail "Cannot auto-install Python. Please install Python >= $PYTHON_MIN manually."
    fi
    PYTHON="python3"
fi

ok "Python: $("$PYTHON" --version)"

# ── System dependencies ─────────────────────────────────────
info "Installing system dependencies..."
if command -v apt-get &>/dev/null; then
    sudo apt-get install -y -qq \
        chromium-browser 2>/dev/null || sudo apt-get install -y -qq chromium 2>/dev/null || warn "Chromium not available (display will use framebuffer fallback)"
    sudo apt-get install -y -qq \
        ffmpeg \
        espeak-ng \
        pulseaudio-utils \
        alsa-utils \
        v4l-utils \
        xdotool \
        wmctrl \
        2>/dev/null || warn "Some optional packages unavailable"
elif command -v dnf &>/dev/null; then
    sudo dnf install -y chromium ffmpeg espeak-ng pulseaudio-utils alsa-utils v4l-utils xdotool wmctrl 2>/dev/null || warn "Some packages unavailable"
elif command -v pacman &>/dev/null; then
    sudo pacman -Sy --noconfirm chromium ffmpeg espeak pulseaudio alsa-utils v4l-utils xdotool wmctrl 2>/dev/null || warn "Some packages unavailable"
fi

# ── Create install directory ────────────────────────────────
info "Installing to $INSTALL_DIR..."
sudo mkdir -p "$INSTALL_DIR"
sudo chown "$(whoami):$(id -gn)" "$INSTALL_DIR"

# ── Virtual environment ─────────────────────────────────────
"$PYTHON" -m venv "$INSTALL_DIR/venv"
source "$INSTALL_DIR/venv/bin/activate"

# ── Download or copy agent files ────────────────────────────
# If running from the repo, copy from current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/requirements.txt" ]]; then
    info "Installing from local source..."
    cp -r "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/"
    cp -r "$SCRIPT_DIR/sven_mirror_agent" "$INSTALL_DIR/"
else
    info "Downloading latest release..."
    REPO_URL="https://raw.githubusercontent.com/47matrix/sven/main/services/sven-mirror-agent"
    curl -sSL "$REPO_URL/requirements.txt" -o "$INSTALL_DIR/requirements.txt"
    mkdir -p "$INSTALL_DIR/sven_mirror_agent"
    for f in __init__.py __main__.py config.py api_client.py pairing.py agent.py; do
        curl -sSL "$REPO_URL/sven_mirror_agent/$f" -o "$INSTALL_DIR/sven_mirror_agent/$f"
    done
    for mod in display camera audio sensors desktop; do
        mkdir -p "$INSTALL_DIR/sven_mirror_agent/$mod"
        curl -sSL "$REPO_URL/sven_mirror_agent/$mod/__init__.py" -o "$INSTALL_DIR/sven_mirror_agent/$mod/__init__.py"
    done
    curl -sSL "$REPO_URL/sven_mirror_agent/display/renderer.py" -o "$INSTALL_DIR/sven_mirror_agent/display/renderer.py"
    curl -sSL "$REPO_URL/sven_mirror_agent/camera/capture.py" -o "$INSTALL_DIR/sven_mirror_agent/camera/capture.py"
    curl -sSL "$REPO_URL/sven_mirror_agent/audio/player.py" -o "$INSTALL_DIR/sven_mirror_agent/audio/player.py"
    curl -sSL "$REPO_URL/sven_mirror_agent/sensors/gpio_reader.py" -o "$INSTALL_DIR/sven_mirror_agent/sensors/gpio_reader.py"
    curl -sSL "$REPO_URL/sven_mirror_agent/desktop/controller.py" -o "$INSTALL_DIR/sven_mirror_agent/desktop/controller.py"
fi

pip install --quiet -r "$INSTALL_DIR/requirements.txt"
ok "Python dependencies installed"

# ── Env file ────────────────────────────────────────────────
ENV_FILE="$INSTALL_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    cat > "$ENV_FILE" <<'ENVEOF'
# ─── Sven Mirror Agent Configuration ───
# Required: Your Sven gateway URL
SVEN_GATEWAY_URL=https://app.sven.example.com
# Required in production pairing:
# SVEN_ORGANIZATION_ID=<org-id>
# Required for unauth production pairing:
# SVEN_PROVISIONING_TOKEN=<device-provisioning-token>

# Optional: Device identity (auto-detected if blank)
# SVEN_DEVICE_NAME=Kitchen Mirror
# SVEN_DEVICE_TYPE=mirror

# Optional: Pre-provisioned API key (skips pairing)
# SVEN_API_KEY=sven_dev_xxxxx

# Optional: Module toggles
# SVEN_DISPLAY_ENABLED=true
# SVEN_CAMERA_ENABLED=true
# SVEN_AUDIO_ENABLED=true
# SVEN_SENSOR_ENABLED=false
# SVEN_DESKTOP_CONTROL_ENABLED=true
ENVEOF
    info "Edit $ENV_FILE to configure your agent"
fi

# ── Systemd service ─────────────────────────────────────────
if command -v systemctl &>/dev/null; then
    info "Creating systemd service..."
    sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<SVCEOF
[Unit]
Description=Sven Mirror Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$INSTALL_DIR/venv/bin/python -m sven_mirror_agent
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Hardening
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=$INSTALL_DIR /tmp
ProtectHome=read-only

[Install]
WantedBy=multi-user.target
SVCEOF

    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME"
    ok "Systemd service created and enabled"
    echo ""
    info "To start:   sudo systemctl start $SERVICE_NAME"
    info "To logs:    sudo journalctl -u $SERVICE_NAME -f"
    info "To stop:    sudo systemctl stop $SERVICE_NAME"
else
    warn "systemd not found — run manually:"
    echo "  cd $INSTALL_DIR && source venv/bin/activate && python -m sven_mirror_agent"
fi

echo ""
ok "Sven Mirror Agent installed successfully!"
echo ""
info "Next steps:"
echo "  1. Edit $ENV_FILE with your Sven gateway URL"
echo "  2. Start the agent: sudo systemctl start $SERVICE_NAME"
echo "  3. Follow the pairing instructions in the terminal/journal output"
echo "  4. Confirm the pairing code in the Sven companion app"
echo ""
