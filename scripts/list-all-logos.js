/**
 * List all registered Logos from NameRegistry V2
 * Run: node scripts/list-all-logos.js
 */

const { ethers } = require("ethers");

const NAME_REGISTRY_V2 = "0x87B9fD42553067BeBc2Abf42c7045C8F2F7D1A79";
const BASE_RPC = "https://mainnet.base.org";

const ABI = [
  "event NameRegistered(string indexed handle, address indexed controller)",
  "function resolve(string handle) view returns (address)",
  "function reverseResolve(address controller) view returns (string)"
];

async function main() {
  console.log("🔍 Scanning NameRegistry V2 on Base Mainnet...");
  console.log(`   Contract: ${NAME_REGISTRY_V2}`);
  console.log("");
  
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const registry = new ethers.Contract(NAME_REGISTRY_V2, ABI, provider);
  
  // Get deployment block (approx - contract deployed around Dec 2024)
  // We'll scan from block 0 to be safe, but limit to recent blocks
  const currentBlock = await provider.getBlockNumber();
  console.log(`   Current block: ${currentBlock}`);
  
  // Query all NameRegistered events
  // Note: indexed string becomes topic hash, so we query all events
  const filter = registry.filters.NameRegistered();
  
  // Scan in chunks to avoid RPC limits
  const CHUNK_SIZE = 10000;
  const START_BLOCK = 20000000; // Contract deployed after this
  
  let allEvents = [];
  
  for (let fromBlock = START_BLOCK; fromBlock < currentBlock; fromBlock += CHUNK_SIZE) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
    try {
      const events = await registry.queryFilter(filter, fromBlock, toBlock);
      if (events.length > 0) {
        allEvents = allEvents.concat(events);
        console.log(`   Found ${events.length} events in blocks ${fromBlock}-${toBlock}`);
      }
    } catch (e) {
      console.log(`   Error scanning ${fromBlock}-${toBlock}: ${e.message}`);
    }
  }
  
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`📊 TOTAL LOGOS REGISTERED: ${allEvents.length}`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  
  if (allEvents.length === 0) {
    console.log("No Logos found. Checking known handles directly...\n");
    
    // Check known handles from documentation
    const knownHandles = ["4DTOCH", "GUVUIK", "MARAT", "NEXO"];
    for (const handle of knownHandles) {
      const controller = await registry.resolve(handle);
      if (controller !== ethers.ZeroAddress) {
        console.log(`✅ ${handle} → ${controller}`);
      }
    }
    return;
  }
  
  // Decode and display each Logos
  console.log("│ # │ Handle     │ Controller Address                          │");
  console.log("├───┼────────────┼─────────────────────────────────────────────┤");
  
  for (let i = 0; i < allEvents.length; i++) {
    const event = allEvents[i];
    // For indexed strings, we need to decode from topics or get from logs
    const controller = event.args?.controller || event.args?.[1];
    
    // Try to reverse resolve to get the actual handle
    let handle = "???";
    try {
      handle = await registry.reverseResolve(controller);
    } catch (e) {
      // Try to decode from event
    }
    
    const num = String(i + 1).padStart(1);
    const handlePad = handle.padEnd(10);
    console.log(`│ ${num} │ ${handlePad} │ ${controller} │`);
  }
  
  console.log("└───┴────────────┴─────────────────────────────────────────────┘");
}

main().catch(console.error);
