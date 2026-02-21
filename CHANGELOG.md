# Void Strike: Zero-G - Changelog

## Version 0.3.0 - "Ragdoll & Modular Update" (2025-11-25)

### 🎮 New Game Modes
- **Hold The Flag** - King of the hill style mode where teams fight for control of a neutral flag
  - Score points every 4 seconds while holding your team's flag
  - Flag carrier moves slower and takes extra damage
  - Can throw flag with crouch + jump
  - Special golden flag visual with fire effects

- **Infiltration** (Work in Progress) - Asymmetric mode where attackers steal intel
  - Blue team must grab intel and extract to zone
  - Red team defends for limited time
  - Intel drops on death
  - Timer-based scoring

### 💀 Ragdoll Physics System
- **Realistic Death Effects**
  - Bodies now break apart into 6 pieces (head, torso, 2 arms, 2 legs)
  - Each part has independent physics with gravity, rotation, and collisions
  - Parts bounce off platforms and gradually come to rest
  - Smooth fade-out over 5 seconds
  - Blood splatter and decals on death

### 🎨 Modular Character System
- **Improved Character Rendering**
  - Characters now built from separate body parts
  - Left arm with independent animation (swings while running)
  - Right arm holds weapon and aims
  - Helper functions for easy customization
  - Z-index layering for proper rendering order
  - Ready for sprite replacement and custom skins

### 🌐 Multiplayer (PeerJS)
- **Peer-to-Peer Multiplayer**
  - Host/Client architecture
  - Create game and share invite link
  - Join via URL parameter
  - Real-time state synchronization
  - Remote player input handling
  - Players replace bots when joining

### 🎯 Gameplay Improvements
- **Bot AI Enhancements**
  - Bots now actively seek flags in Hold The Flag mode
  - Improved pathfinding and objective prioritization
  - Better combat behavior
  - Weapon switching based on distance

- **Visual Improvements**
  - Intel item with golden briefcase visual
  - Flag glow effects (blue, red, golden)
  - Improved pickup rendering
  - Better team color indicators

### 🛠️ Technical Improvements
- **Code Architecture**
  - Modular body part creation functions
  - Cleaner separation of rendering logic
  - Better type definitions for network packets
  - Improved state management

### 🐛 Bug Fixes
- Fixed `rect()` calls to use `roundRect()` for rounded corners
- Fixed asset path issues for Netlify deployment
- Corrected mouse coordinate conversion for multiplayer
- Fixed team balancing in respawn logic

---

## Version 0.2.0 - "Multiplayer Foundation" (2025-11-24)

### Features
- PeerJS integration for P2P multiplayer
- NetworkManager class for connection handling
- Host/Client game modes
- State synchronization
- Remote input processing

---

## Version 0.1.0 - "Initial Release" (2025-11-23)

### Features
- Deathmatch mode
- Capture The Flag mode
- Bot AI
- Multiple weapons (Machine Gun, Shotgun, Plasma Gun, Rocket Launcher, Grenade Launcher, Railgun, Chainsaw)
- Jetpack movement
- Grappling hook
- Dash ability
- Pickups (Health, Armor, Ammo, Fuel)
- Particle effects
- Sound system
- Scoreboard
- Player customization (name, color, jetpack color)

---

## Upcoming Features

### v0.4.0 - "Customization & Polish"
- [ ] Body part skin system
- [ ] Sprite-based character rendering
- [ ] Skin selection UI
- [ ] More visual styles for each body part
- [ ] Improved animations
- [ ] Sound effects for ragdoll
- [ ] Complete Infiltration mode
- [ ] Extraction zone visuals
- [ ] Intel carrier effects

### Future
- [ ] More game modes (Team Deathmatch, Survival)
- [ ] Power-ups and special abilities
- [ ] Map editor
- [ ] Custom game settings
- [ ] Leaderboards
- [ ] Achievements
