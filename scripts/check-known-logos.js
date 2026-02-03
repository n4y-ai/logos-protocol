/**
 * Check known Logos handles in NameRegistry V2
 * Run: node scripts/check-known-logos.js
 */

const { ethers } = require("ethers");

const NAME_REGISTRY_V2 = "0x87B9fD42553067BeBc2Abf42c7045C8F2F7D1A79";
// Use Alchemy/Infura-style endpoint for reliability
const BASE_RPC = "https://base.llamarpc.com"; // Alternative public RPC

const ABI = [
  "function resolve(string handle) view returns (address)",
  "function reverseResolve(address controller) view returns (string)",
  "function isAvailable(string handle) view returns (bool)"
];

// Known handles from documentation and testing
const KNOWN_HANDLES = [
  "4DTOCH",   // First E2E Logos (from docs)
  "GUVUIK",   // From demo-auth
  "MARAT",    // V1 legacy (may not be in V2)
  "NEXO",     // Example from specs
  "TEST",     // Testing
  "LOGOS",    // Brand name
  "ALICE",    // Common test
  "BOB",      // Common test
];

async function main() {
  console.log("🔍 Checking known Logos in NameRegistry V2...");
  console.log(`   Contract: ${NAME_REGISTRY_V2}`);
  console.log(`   RPC: ${BASE_RPC}`);
  console.log("");
  
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const registry = new ethers.Contract(NAME_REGISTRY_V2, ABI, provider);
  
  // Verify contract exists
  const code = await provider.getCode(NAME_REGISTRY_V2);
  console.log(`   Contract bytecode: ${code.length} chars`);
  console.log("");
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("│ Handle     │ Status      │ Controller                          │");
  console.log("├────────────┼─────────────┼─────────────────────────────────────┤");
  
  let registeredCount = 0;
  const registered = [];
  
  for (const handle of KNOWN_HANDLES) {
    try {
      const controller = await registry.resolve(handle);
      const isZero = controller === ethers.ZeroAddress;
      const status = isZero ? "❌ Available" : "✅ Registered";
      const addr = isZero ? "—" : controller;
      
      console.log(`│ ${handle.padEnd(10)} │ ${status.padEnd(11)} │ ${addr.padEnd(35)} │`);
      
      if (!isZero) {
        registeredCount++;
        registered.push({ handle, controller });
      }
    } catch (e) {
      console.log(`│ ${handle.padEnd(10)} │ ⚠️ Error    │ ${e.message.slice(0, 35).padEnd(35)} │`);
    }
  }
  
  console.log("└────────────┴─────────────┴─────────────────────────────────────┘");
  console.log("");
  console.log(`📊 Found ${registeredCount} registered Logos from ${KNOWN_HANDLES.length} checked handles`);
  console.log("");
  
  if (registered.length > 0) {
    console.log("✅ REGISTERED LOGOS:");
    for (const { handle, controller } of registered) {
      console.log(`   ${handle} → ${controller}`);
    }
  }
}

main().catch(console.error);
