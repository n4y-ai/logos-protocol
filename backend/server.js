/**
 * Logos Backend API
 * 
 * Endpoints:
 * - GET  /api/logos/health         - Health check
 * - GET  /api/logos/check/:handle  - Check handle availability
 * - POST /api/logos/create         - Create Logos (on-chain)
 * - GET  /api/logos/:handle        - Get Logos info
 * - GET  /api/did/:did             - DID Resolution
 * - POST /api/auth/challenge       - Get auth challenge
 * - POST /api/auth/verify          - Verify signature & get session
 * - POST /api/logos/:handle/chat   - Chat with Logos AI (requires auth)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const crypto = require('crypto');

// LLM modules
const llmClient = require('./llm-client');
const promptBuilder = require('./prompt-builder');

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Contract addresses (Base Mainnet V2)
const NAME_REGISTRY = '0x87B9fD42553067BeBc2Abf42c7045C8F2F7D1A79';
const LOGOS_FACTORY = '0x7553244FB04ff64EA0B86cA16F0427feb7F4E263';

// ABIs (minimal)
const NAME_REGISTRY_ABI = [
  'function isAvailable(string handle) view returns (bool)',
  'function resolve(string handle) view returns (address)',
  'function reverseResolve(address controller) view returns (string)',
  'function registerName(string handle, address controller)',
  'event NameRegistered(string indexed handle, address indexed controller)'
];

const LOGOS_FACTORY_ABI = [
  'function createLogos(address owner, address agent, string handle) returns (address)',
  'function ownerToAccount(address owner) view returns (address)',
  'function totalAccounts() view returns (uint256)',
  'event LogosCreated(address indexed account, address indexed owner, address indexed agent, string handle)'
];

const LOGOS_ACCOUNT_ABI = [
  'function getDID() view returns (string)',
  'function owner() view returns (address)',
  'function agent() view returns (address)',
  'function handle() view returns (string)'
];

// Provider and contracts
const provider = new ethers.JsonRpcProvider(RPC_URL);
let wallet;
let nameRegistry;
let logosFactory;

// Agent keys storage (in-memory for demo, use DB in production)
const agentKeys = new Map(); // handle -> { publicKey, privateKey }

// Auth challenges (temporary, expire after 5 min)
const authChallenges = new Map(); // challengeId -> { handle, challenge, expires }

// Sessions (in-memory for demo, use Redis/DB in production)
const sessions = new Map(); // sessionId -> { handle, owner, expires }

// Initialize contracts
function initContracts() {
  if (!PRIVATE_KEY) {
    console.warn('⚠️  PRIVATE_KEY not set - write operations disabled');
    nameRegistry = new ethers.Contract(NAME_REGISTRY, NAME_REGISTRY_ABI, provider);
    logosFactory = new ethers.Contract(LOGOS_FACTORY, LOGOS_FACTORY_ABI, provider);
  } else {
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    nameRegistry = new ethers.Contract(NAME_REGISTRY, NAME_REGISTRY_ABI, wallet);
    logosFactory = new ethers.Contract(LOGOS_FACTORY, LOGOS_FACTORY_ABI, wallet);
    console.log('✅ Wallet connected:', wallet.address);
  }
}

// Health check
app.get('/api/logos/health', async (req, res) => {
  try {
    const totalAccounts = await logosFactory.totalAccounts();
    res.json({
      status: 'ok',
      nameRegistry: NAME_REGISTRY,
      logosFactory: LOGOS_FACTORY,
      totalAccounts: totalAccounts.toString(),
      writeEnabled: !!PRIVATE_KEY,
      llm: llmClient.getConfig()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check handle availability
app.get('/api/logos/check/:handle', async (req, res) => {
  try {
    const handle = req.params.handle.toUpperCase();
    
    // Validate format
    if (!/^[A-Z0-9]{4,10}$/.test(handle)) {
      return res.json({
        handle,
        available: false,
        error: 'Invalid format: 4-10 chars, A-Z 0-9 only'
      });
    }
    
    const available = await nameRegistry.isAvailable(handle);
    const controller = available ? null : await nameRegistry.resolve(handle);
    
    res.json({
      handle,
      available,
      did: available ? null : `did:logos:${handle}`,
      controller: controller || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Logos
app.post('/api/logos/create', async (req, res) => {
  try {
    const { handle, ownerPublicKey } = req.body;
    
    if (!handle || !ownerPublicKey) {
      return res.status(400).json({ error: 'handle and ownerPublicKey required' });
    }
    
    if (!wallet) {
      return res.status(503).json({ error: 'Write operations disabled - PRIVATE_KEY not set' });
    }
    
    const upperHandle = handle.toUpperCase();
    
    // Validate format
    if (!/^[A-Z0-9]{4,10}$/.test(upperHandle)) {
      return res.status(400).json({ error: 'Invalid handle format' });
    }
    
    // Check availability
    const available = await nameRegistry.isAvailable(upperHandle);
    if (!available) {
      return res.status(409).json({ error: 'Handle already taken' });
    }
    
    // Generate agent key
    const agentWallet = ethers.Wallet.createRandom();
    const agentPublicKey = agentWallet.address;
    const agentPrivateKey = agentWallet.privateKey;
    
    console.log(`Creating Logos: ${upperHandle}`);
    console.log(`  Owner: ${ownerPublicKey}`);
    console.log(`  Agent: ${agentPublicKey}`);
    
    // Call factory to create Logos
    const tx = await logosFactory.createLogos(ownerPublicKey, agentPublicKey, upperHandle);
    console.log(`  TX: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`  Confirmed in block: ${receipt.blockNumber}`);
    
    // Get account address from event
    const event = receipt.logs.find(log => {
      try {
        return logosFactory.interface.parseLog(log)?.name === 'LogosCreated';
      } catch { return false; }
    });
    
    let accountAddress;
    if (event) {
      const parsed = logosFactory.interface.parseLog(event);
      accountAddress = parsed.args.account;
    } else {
      // Fallback: get from ownerToAccount
      accountAddress = await logosFactory.ownerToAccount(ownerPublicKey);
    }
    
    // Store agent key (in production: encrypt and store in DB)
    agentKeys.set(upperHandle, {
      publicKey: agentPublicKey,
      privateKey: agentPrivateKey
    });
    
    res.json({
      success: true,
      handle: upperHandle,
      did: `did:logos:${upperHandle}`,
      accountAddress,
      agentPublicKey,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: 'Logos created successfully on Base Mainnet'
    });
    
  } catch (error) {
    console.error('Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Logos info
app.get('/api/logos/:handle', async (req, res) => {
  try {
    const handle = req.params.handle.toUpperCase();
    
    const controller = await nameRegistry.resolve(handle);
    
    if (controller === ethers.ZeroAddress) {
      return res.status(404).json({ error: 'Handle not found' });
    }
    
    // Get account info
    const account = new ethers.Contract(controller, LOGOS_ACCOUNT_ABI, provider);
    
    let owner, agent, did;
    try {
      [owner, agent, did] = await Promise.all([
        account.owner(),
        account.agent(),
        account.getDID()
      ]);
    } catch {
      // Fallback for non-LogosAccount controllers
      owner = controller;
      agent = null;
      did = `did:logos:${handle}`;
    }
    
    // Get stored agent public key
    const storedAgent = agentKeys.get(handle);
    
    res.json({
      handle,
      did,
      controller,
      owner,
      agentPublicKey: agent || storedAgent?.publicKey || null
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DID Resolution
app.get('/api/did/:did', async (req, res) => {
  try {
    const did = decodeURIComponent(req.params.did);
    
    // Parse did:logos:HANDLE
    const match = did.match(/^did:logos:([A-Z0-9]{4,10})$/i);
    if (!match) {
      return res.status(400).json({ error: 'Invalid DID format' });
    }
    
    const handle = match[1].toUpperCase();
    const controller = await nameRegistry.resolve(handle);
    
    if (controller === ethers.ZeroAddress) {
      return res.status(404).json({ error: 'DID not found' });
    }
    
    // Build DID Document
    const didDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/secp256k1-2019/v1'
      ],
      id: `did:logos:${handle}`,
      controller: `did:logos:${handle}`,
      verificationMethod: [
        {
          id: `did:logos:${handle}#controller`,
          type: 'EcdsaSecp256k1RecoveryMethod2020',
          controller: `did:logos:${handle}`,
          blockchainAccountId: `eip155:8453:${controller}`
        }
      ],
      authentication: [`did:logos:${handle}#controller`],
      assertionMethod: [`did:logos:${handle}#controller`],
      service: [
        {
          id: `did:logos:${handle}#registry`,
          type: 'LogosNameRegistry',
          serviceEndpoint: `https://basescan.org/address/${NAME_REGISTRY}`
        }
      ]
    };
    
    res.json(didDocument);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sign message as agent
app.post('/api/logos/:handle/sign', async (req, res) => {
  try {
    const handle = req.params.handle.toUpperCase();
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }
    
    const storedAgent = agentKeys.get(handle);
    if (!storedAgent) {
      return res.status(404).json({ error: 'Agent key not found for this handle' });
    }
    
    const agentWallet = new ethers.Wallet(storedAgent.privateKey);
    const signature = await agentWallet.signMessage(message);
    
    res.json({
      handle,
      message,
      signature,
      signer: storedAgent.publicKey
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Step 1: Get auth challenge
 * Client requests a challenge to sign with their owner key
 */
app.post('/api/auth/challenge', async (req, res) => {
  try {
    const { handle } = req.body;
    
    if (!handle) {
      return res.status(400).json({ error: 'handle required' });
    }
    
    const upperHandle = handle.toUpperCase();
    
    // Check if Logos exists
    const controller = await nameRegistry.resolve(upperHandle);
    if (controller === ethers.ZeroAddress) {
      return res.status(404).json({ error: 'Logos not found' });
    }
    
    // Generate challenge
    const challengeId = crypto.randomUUID();
    const timestamp = Date.now();
    const challenge = `Sign this message to prove ownership of ${upperHandle}\n\nChallenge: ${challengeId}\nTimestamp: ${timestamp}`;
    
    // Store challenge (expires in 5 minutes)
    authChallenges.set(challengeId, {
      handle: upperHandle,
      challenge,
      timestamp,
      expires: Date.now() + 5 * 60 * 1000
    });
    
    // Cleanup old challenges
    for (const [id, data] of authChallenges) {
      if (data.expires < Date.now()) {
        authChallenges.delete(id);
      }
    }
    
    res.json({
      challengeId,
      challenge,
      handle: upperHandle,
      expiresIn: 300 // 5 minutes
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Step 2: Verify signature and create session
 * Client sends signed challenge, server verifies against on-chain owner
 */
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { challengeId, signature } = req.body;
    
    if (!challengeId || !signature) {
      return res.status(400).json({ error: 'challengeId and signature required' });
    }
    
    // Get challenge
    const challengeData = authChallenges.get(challengeId);
    if (!challengeData) {
      return res.status(400).json({ error: 'Invalid or expired challenge' });
    }
    
    // Check expiration
    if (challengeData.expires < Date.now()) {
      authChallenges.delete(challengeId);
      return res.status(400).json({ error: 'Challenge expired' });
    }
    
    // Recover signer from signature
    const recoveredAddress = ethers.verifyMessage(challengeData.challenge, signature);
    
    // Get on-chain owner
    const controller = await nameRegistry.resolve(challengeData.handle);
    const account = new ethers.Contract(controller, LOGOS_ACCOUNT_ABI, provider);
    
    let owner;
    try {
      owner = await account.owner();
    } catch {
      owner = controller; // Fallback for non-LogosAccount
    }
    
    // Verify signature is from owner
    if (recoveredAddress.toLowerCase() !== owner.toLowerCase()) {
      return res.status(403).json({ 
        error: 'Invalid signature - not owner',
        recovered: recoveredAddress,
        expected: owner
      });
    }
    
    // Create session
    const sessionId = crypto.randomUUID();
    const sessionExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    sessions.set(sessionId, {
      handle: challengeData.handle,
      owner,
      controller,
      createdAt: Date.now(),
      expires: sessionExpires
    });
    
    // Delete used challenge
    authChallenges.delete(challengeId);
    
    console.log(`✅ Auth successful: ${challengeData.handle} (owner: ${owner.slice(0, 10)}...)`);
    
    res.json({
      success: true,
      sessionId,
      handle: challengeData.handle,
      did: `did:logos:${challengeData.handle}`,
      owner,
      expiresIn: 86400 // 24 hours
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Middleware: Verify session
 */
function requireAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Session ID required in X-Session-Id header' });
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  if (session.expires < Date.now()) {
    sessions.delete(sessionId);
    return res.status(401).json({ error: 'Session expired' });
  }
  
  // Attach session to request
  req.session = session;
  next();
}

/**
 * Get current session info
 */
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    authenticated: true,
    handle: req.session.handle,
    did: `did:logos:${req.session.handle}`,
    owner: req.session.owner
  });
});

/**
 * Logout - invalidate session
 */
app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.json({ success: true });
});

// ============================================================================
// CHAT WITH LOGOS (AI Agent)
// ============================================================================

/**
 * Chat with your Logos
 * Requires authentication - only owner can chat with their Logos
 * 
 * Request:
 *   POST /api/logos/:handle/chat
 *   Headers: X-Session-Id: <session_id>
 *   Body: { message: string, context?: { previousMessages: [], metadata: {} } }
 * 
 * Response:
 *   {
 *     response: string,
 *     metadata: { model, tokens, timestamp },
 *     signature: { message, messageHash, signature, signer }
 *   }
 */
app.post('/api/logos/:handle/chat', requireAuth, async (req, res) => {
  try {
    const handle = req.params.handle.toUpperCase();
    const { message, context } = req.body;
    
    // Verify user owns this Logos
    if (req.session.handle !== handle) {
      return res.status(403).json({ 
        error: 'Access denied - you can only chat with your own Logos',
        yourHandle: req.session.handle,
        requested: handle
      });
    }
    
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }
    
    // Get agent key for signing
    const storedAgent = agentKeys.get(handle);
    
    // Build context for system prompt
    const promptContext = {
      handle,
      did: `did:logos:${handle}`,
      owner: req.session.owner,
      agentPublicKey: storedAgent?.publicKey,
      sessionStart: new Date(req.session.createdAt).toISOString()
    };
    
    let aiResponse;
    let metadata = {
      model: 'mock',
      tokens: 0,
      timestamp: new Date().toISOString()
    };
    
    // Check if LLM is configured
    if (llmClient.isConfigured()) {
      // Build system prompt
      const systemPrompt = promptBuilder.buildSystemPrompt(promptContext);
      
      // Get previous messages if provided
      const history = context?.previousMessages 
        ? promptBuilder.formatHistory(context.previousMessages) 
        : [];
      
      // Call LLM
      console.log(`[Chat] ${handle}: "${message.substring(0, 50)}..."`);
      
      const llmResponse = await llmClient.chatWithHistory(
        systemPrompt,
        history,
        message
      );
      
      aiResponse = llmResponse.content;
      metadata = {
        model: llmResponse.model,
        tokens: llmResponse.tokens,
        timestamp: new Date().toISOString()
      };
      
      console.log(`[Chat] ${handle} response: ${aiResponse.substring(0, 50)}...`);
    } else {
      // Fallback to mock response if LLM not configured
      console.log(`[Chat] LLM not configured, using mock response`);
      aiResponse = generateMockResponse(handle, message);
    }
    
    // Sign response with Agent Key
    let signatureData = null;
    if (storedAgent) {
      const nonce = Date.now();
      
      // Create message hash according to spec (section 6.1)
      const signPayload = JSON.stringify({
        response: aiResponse,
        timestamp: nonce,
        handle: handle,
        nonce: nonce
      });
      
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(signPayload));
      
      // Sign the hash
      const agentWallet = new ethers.Wallet(storedAgent.privateKey);
      const signature = await agentWallet.signMessage(ethers.getBytes(messageHash));
      
      signatureData = {
        message: aiResponse,
        messageHash,
        signature,
        signer: storedAgent.publicKey
      };
    }
    
    res.json({
      response: aiResponse,
      metadata,
      signature: signatureData
    });
    
  } catch (error) {
    console.error(`[Chat] Error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Fallback mock response when LLM is not configured
 */
function generateMockResponse(handle, message) {
  return `[${handle}] Я получил твоё сообщение: "${message}"

⚠️ Это mock-ответ. LLM gateway не настроен (LLM_API_KEY отсутствует).
Для реальных ответов настройте переменные окружения:
- LLM_GATEWAY_URL
- LLM_API_KEY
- LLM_MODEL`;
}

// Start server
initContracts();
app.listen(PORT, () => {
  console.log(`\n🚀 Logos Backend API running on http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /api/logos/health         - Health check`);
  console.log(`  GET  /api/logos/check/:handle  - Check availability`);
  console.log(`  POST /api/logos/create         - Create Logos`);
  console.log(`  GET  /api/logos/:handle        - Get Logos info`);
  console.log(`  GET  /api/did/:did             - DID Resolution`);
  console.log(`\nAuth:`);
  console.log(`  POST /api/auth/challenge       - Get challenge to sign`);
  console.log(`  POST /api/auth/verify          - Verify signature & login`);
  console.log(`  GET  /api/auth/me              - Current session (auth required)`);
  console.log(`  POST /api/auth/logout          - End session`);
  console.log(`\nChat (auth required):`);
  console.log(`  POST /api/logos/:handle/chat   - Chat with your Logos (AI)`);
  console.log(`\nContracts (Base Mainnet):`);
  console.log(`  NameRegistry:     ${NAME_REGISTRY}`);
  console.log(`  LogosFactory:     ${LOGOS_FACTORY}`);
  
  // LLM Status
  const llmConfig = llmClient.getConfig();
  if (llmConfig.configured) {
    console.log(`\n🤖 LLM (Enabled):`);
    console.log(`  Gateway:  ${llmConfig.gatewayUrl}`);
    console.log(`  Model:    ${llmConfig.model}`);
  } else {
    console.log(`\n⚠️  LLM not configured (set LLM_API_KEY in .env)`);
  }
});

