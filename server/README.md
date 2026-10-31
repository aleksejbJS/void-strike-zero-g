# Void Strike Server

Dedicated server for Void Strike multiplayer game with automatic public tunneling and matchmaking.

## 🚀 Quick Setup

### Automatic Setup (Recommended)
```bash
# Run the interactive setup script
./setup-server.sh
```
This will automatically:
- Check system requirements
- Install dependencies
- Configure your server
- Create public tunnel
- Start the server

### Manual Setup

#### Local Testing
```bash
npm install
npm run dev:local
```

#### Public Server with Tunneling
```bash
# Using localtunnel (free, easy)
npm run dev:public

# Using ngrok (paid, better performance)
# First: sign up at https://ngrok.com and get auth token
export NGROK_AUTHTOKEN=your_token_here
npm run dev:ngrok
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `SERVER_NAME` | `Void Strike Server` | Server display name |
| `MAX_PLAYERS` | `8` | Maximum human players (bots fill the rest) |
| `SERVER_MODE` | `DEATHMATCH` | `DEATHMATCH`, `GUN_GAME`, `CTF`, `HOLD_THE_FLAG`, `INFILTRATION` (Hunger Games is offline-only) |
| `SERVER_MAP` | `default` | `default`, `tunnels`, `hunger` |
| `TUNNELING_ENABLED` | `false` | Enable public tunneling |
| `TUNNELING_PROVIDER` | `localtunnel` | `localtunnel` or `ngrok` |
| `NGROK_AUTHTOKEN` | - | ngrok auth token |
| `TUNNELING_SUBDOMAIN` | - | Custom subdomain |
| `MATCHMAKING_ENABLED` | `false` | Register on matchmaking server |
| `MATCHMAKING_SERVER` | - | Matchmaking server URL (required when matchmaking is enabled) |
| `SERVER_REGION` | `unknown` | Server region for matchmaking |

## Hosting Options

### 1. Local Network (LAN)
- No setup required
- Players connect via local IP
- Best for local multiplayer

### 2. Public Tunneling (Free)
- **localtunnel**: Easy, but may be slow
- **ngrok**: Better performance, requires account
- Automatic public URL generation

### 3. VPS/Cloud Hosting
- DigitalOcean, AWS, Google Cloud
- Static IP, better performance
- Professional setup

### 4. Port Forwarding
- Configure router port forwarding
- Direct connections
- Requires technical knowledge

## Server Management

### Commands
- `npm run dev:local` - Local server only
- `npm run dev:public` - Public server with localtunnel
- `npm run dev:ngrok` - Public server with ngrok
- `npm run dev:matchmaking` - Enable matchmaking registration

### Monitoring
Server logs show:
- Player connections/disconnections
- Public tunnel URLs
- Matchmaking registration status
- Performance metrics

## Troubleshooting

### Tunneling Issues
- **ngrok**: Make sure auth token is valid
- **localtunnel**: Try different subdomain
- **Firewall**: Ensure ports are open

### Connection Issues
- Check if server is running
- Verify tunnel URL is accessible
- Check firewall/antivirus settings

### Performance
- Use ngrok over localtunnel for better performance
- Reduce max players if server is overloaded
- Monitor CPU/memory usage

## Advanced Configuration

### Custom Game Modes
Edit `src/constants.ts` to add custom weapons/modes.

### Custom Maps
Add new map files to `src/game/data/level.ts`.

### Matchmaking Server
Set up your own matchmaking server for server discovery.
