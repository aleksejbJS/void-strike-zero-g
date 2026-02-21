<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Void Strike: Zero-G

**A fast-paced multiplayer shooter set in zero gravity with ragdoll physics!**

[![Game Screenshot](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)](https://ai.studio/apps/drive/1Yh7EHoj-sq5sKHJKnxpQwDADdKw4o8G7)

## Latest Update - v1.0.0 "Complete Overhaul" 🚀

### Major New Features
- **🎯 Achievement System** - 20+ achievements with XP rewards and progress tracking
- **🎵 Enhanced Audio** - Dynamic background music, improved sound effects, and audio settings
- **📱 Mobile Support** - Touch controls, virtual joystick, and responsive design
- **🌍 Localization** - Full English/Russian language support
- **⚡ Performance Optimizations** - Object pooling, optimized rendering, and reduced lag
- **🛠️ Code Quality** - ESLint, Prettier, and comprehensive linting setup
- **🏆 Hunger Games Mode** - Battle royale with shrinking safe zones and betting system

### Game Modes
- **Deathmatch** - Free-for-all combat
- **Capture The Flag** - Team-based flag capture
- **Hold The Flag** - King-of-the-hill style gameplay
- **Infiltration** - Steal intel and extract
- **Hunger Games** - Battle royale with betting

### Key Features
- **Ragdoll Physics** - Realistic body dismemberment and physics
- **Modular Characters** - Customizable body parts and colors
- **Jetpack Mechanics** - Zero-gravity movement with fuel management
- **Grappling Hook** - Swing and pull yourself around the map
- **Multiple Weapons** - Machine gun, shotgun, plasma gun, rocket launcher, railgun, chainsaw
- **P2P Multiplayer** - Host and join games with friends
- **Bot AI** - Intelligent computer opponents
- **Achievement System** - Track progress and unlock rewards

See [CHANGELOG.md](CHANGELOG.md) for full details.


## Installation & Setup

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd void-strike-zero-g
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run server` - Start multiplayer server
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier

## How to Play

### Controls
- **WASD** - Move
- **Mouse** - Aim
- **Left Click** - Fire weapon
- **Right Click / Shift** - Grappling hook
- **Space** - Jetpack
- **1-6** - Switch weapons
- **Escape** - Return to menu

### Mobile Controls
- **Left side** - Movement joystick
- **Right side** - Aim and fire
- **Action buttons** - Jump and grapple

### Multiplayer

#### Hosting Your Own Server
```bash
# Navigate to server folder
cd server

# Install dependencies
npm install

# Start public server with tunneling
npm run dev:public

# Or use ngrok for better performance
export NGROK_AUTHTOKEN=your_ngrok_token
npm run dev:ngrok
```

The server will automatically create a public URL that you can share with friends!

#### Joining Public Servers
1. Click "Public Servers" tab in main menu
2. Browse available servers
3. Click "JOIN" on any server
4. Customize your character and start playing!

#### Server Types
- **Local**: LAN multiplayer, no setup required
- **Public**: Internet multiplayer via tunneling
- **Custom**: Connect to any server URL

### Game Modes

#### Deathmatch
Free-for-all combat. First to reach the score limit wins.

#### Capture The Flag (CTF)
Two teams compete to capture the enemy flag and return it to their base.

#### Hold The Flag (HTF)
Control the neutral flag for as long as possible. Points awarded over time.

#### Infiltration
Steal enemy intel and extract it. Time-limited mode with objectives.

#### Hunger Games
Battle royale with shrinking safe zones. Bet on survivors for extra rewards.

## Architecture

### Tech Stack
- **Frontend**: React 19, TypeScript, PixiJS
- **Multiplayer**: PeerJS (P2P), Socket.io
- **Physics**: Custom physics engine
- **Audio**: Web Audio API with procedural generation
- **Build**: Vite
- **Styling**: Tailwind CSS

### Project Structure
```
src/
├── components/          # React components
├── game/
│   ├── systems/        # Core game systems
│   ├── data/          # Level and game data
│   └── utils/         # Utility functions
├── i18n/              # Localization
├── store/             # State management
└── types.ts           # TypeScript definitions
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting: `npm run lint && npm run test`
5. Format code: `npm run format`
6. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
