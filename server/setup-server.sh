#!/bin/bash

echo "🚀 Void Strike Server Setup"
echo "============================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="18.0.0"

if ! [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo "⚠️  Node.js version $NODE_VERSION detected. Recommended: $REQUIRED_VERSION or higher"
fi

echo "✅ Node.js version: $NODE_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"

# Ask for server configuration
echo ""
echo "⚙️  Server Configuration"
echo "======================="

read -p "Enter server name [Void Strike Server]: " SERVER_NAME
SERVER_NAME=${SERVER_NAME:-"Void Strike Server"}

read -p "Enter max players [8]: " MAX_PLAYERS
MAX_PLAYERS=${MAX_PLAYERS:-8}

read -p "Enable public tunneling? (y/n) [y]: " ENABLE_TUNNELING
ENABLE_TUNNELING=${ENABLE_TUNNELING:-y}

if [[ $ENABLE_TUNNELING =~ ^[Yy]$ ]]; then
    read -p "Use ngrok or localtunnel? (ngrok/localtunnel) [localtunnel]: " TUNNEL_PROVIDER
    TUNNEL_PROVIDER=${TUNNEL_PROVIDER:-localtunnel}

    if [ "$TUNNEL_PROVIDER" = "ngrok" ]; then
        read -p "Enter ngrok auth token (leave empty for free tier): " NGROK_TOKEN
        if [ -n "$NGROK_TOKEN" ]; then
            export NGROK_AUTHTOKEN="$NGROK_TOKEN"
        fi
    fi
else
    TUNNEL_PROVIDER="none"
fi

# Create .env file
cat > .env << EOF
# Void Strike Server Configuration
SERVER_NAME="$SERVER_NAME"
MAX_PLAYERS=$MAX_PLAYERS
TUNNELING_ENABLED=$( [[ $ENABLE_TUNNELING =~ ^[Yy]$ ]] && echo "true" || echo "false" )
TUNNELING_PROVIDER=$TUNNEL_PROVIDER
EOF

if [ -n "$NGROK_TOKEN" ]; then
    echo "NGROK_AUTHTOKEN=\"$NGROK_TOKEN\"" >> .env
fi

echo ""
echo "✅ Configuration saved to .env"
echo ""
echo "🚀 Starting server..."
echo "===================="
echo "Server Name: $SERVER_NAME"
echo "Max Players: $MAX_PLAYERS"
echo "Public Access: $( [[ $ENABLE_TUNNELING =~ ^[Yy]$ ]] && echo "Enabled ($TUNNEL_PROVIDER)" || echo "Disabled" )"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm run dev
