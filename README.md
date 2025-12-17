# Logos Protocol

On-chain identity and smart account infrastructure for the Logos ecosystem.

## Overview

Logos Protocol provides the foundational blockchain layer for Logos - AI-powered digital twins that operate autonomously on behalf of users.

### Key Components

- **NameRegistry** - Global registry for unique handles (NEXOs). Base36 format (A-Z, 0-9), 4-10 characters.
- **LogosAccount** - Smart account with two-key architecture (owner + agent keys).
- **LogosAccountFactory** - Factory for creating LogosAccount instances with automatic handle registration.

## Deployments

### Base Mainnet (Chain ID: 8453)

| Contract | Address |
|----------|---------|
| NameRegistry | `0x0Eb28d2b84F48CE18742f6C42C5BA18c17b0d4E3` |
| LogosAccountFactory | *Pending* |

### Registered Handles

| Handle | Controller | DID |
|--------|------------|-----|
| MARAT | `0x0F4229f05190c347F38D62D35A95F9ca2b7F4368` | `did:logos:MARAT` |

## Architecture

### Two-Key System

Each Logos has two keys:

1. **Owner Key** - User's primary key
   - Full control over the Logos
   - Stored encrypted in user's browser (localStorage)
   - Can change agent key, execute transactions, withdraw funds

2. **Agent Key** - AI's autonomous key
   - Limited capabilities
   - Stored securely on backend
   - Can sign messages, record attestations

### DID Format

Logos uses a simple DID method:
```
did:logos:HANDLE
```

Example: `did:logos:MARAT`

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
npm install
```

### Compile

```bash
npm run compile
```

### Test

```bash
npm test
```

### Deploy

1. Create `.env` file:
```env
PRIVATE_KEY=your_private_key_here
BASESCAN_API_KEY=optional_for_verification
```

2. Deploy to Base Mainnet:
```bash
npm run deploy:base
```

Or to testnet:
```bash
npm run deploy:base-sepolia
```

### Register Handle

```bash
HANDLE=YOURHANDLE CONTROLLER=0x... npx hardhat run scripts/register-handle.js --network base
```

## Security

- **NEVER** commit private keys or `.env` files
- Owner keys should only exist in user's browser
- Agent keys should be stored with encryption at rest

## License

MIT

