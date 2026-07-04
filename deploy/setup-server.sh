#!/bin/bash
# ============================================
# Claudio FM — Oracle Cloud Server Setup
# Run this on your Oracle Cloud ARM instance
# ============================================

set -e

echo "=========================================="
echo "  🎵 Claudio FM — Server Setup"
echo "=========================================="

# --- 1. System Updates ---
echo ""
echo "[1/7] Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# --- 2. Install Node.js 20 ---
echo ""
echo "[2/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "  Node.js version: $(node -v)"
echo "  npm version: $(npm -v)"

# --- 3. Install ffmpeg ---
echo ""
echo "[3/7] Installing ffmpeg..."
sudo apt-get install -y ffmpeg

echo "  ffmpeg version: $(ffmpeg -version | head -1)"

# --- 4. Install yt-dlp ---
echo ""
echo "[4/7] Installing yt-dlp..."
sudo apt-get install -y python3 python3-pip
sudo pip3 install -U yt-dlp --break-system-packages 2>/dev/null || sudo pip3 install -U yt-dlp

# Ensure yt-dlp is accessible at /usr/local/bin/yt-dlp
if ! command -v yt-dlp &> /dev/null; then
    echo "  ⚠️  yt-dlp not in PATH, trying to find it..."
    YT_DLP_PATH=$(find /usr -name "yt-dlp" -type f 2>/dev/null | head -1)
    if [ -n "$YT_DLP_PATH" ]; then
        sudo ln -sf "$YT_DLP_PATH" /usr/local/bin/yt-dlp
        echo "  ✅ Linked yt-dlp to /usr/local/bin/yt-dlp"
    else
        echo "  ❌ yt-dlp installation failed!"
        exit 1
    fi
fi

echo "  yt-dlp version: $(yt-dlp --version)"

# --- 5. Install PM2 (Process Manager) ---
echo ""
echo "[5/7] Installing PM2..."
sudo npm install -g pm2

# --- 6. Install git ---
echo ""
echo "[6/7] Ensuring git is installed..."
sudo apt-get install -y git

# --- 7. Open Firewall Port ---
echo ""
echo "[7/7] Configuring firewall..."
# Ubuntu's iptables (Oracle Cloud default)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8080 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || sudo sh -c 'iptables-save > /etc/iptables/rules.v4' 2>/dev/null || true

echo ""
echo "=========================================="
echo "  ✅ System setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Clone your repo:  git clone <your-repo-url> claudio"
echo "  2. cd claudio"
echo "  3. npm install"
echo "  4. Create your .env file (see .env.example)"
echo "  5. Create user/ config files"
echo "  6. pm2 start server.js --name claudio"
echo "  7. pm2 save && pm2 startup"
echo ""
