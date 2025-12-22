const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  // Configuration
  const HANDLE = process.env.HANDLE || "TEST";
  const CONTROLLER = process.env.CONTROLLER || signer.address;
  
  // NameRegistry addresses
  // NOTE: For Base mainnet we default to the current V2 deployment.
  // You can override with NAME_REGISTRY_ADDRESS env var.
  const ADDRESSES = {
    base: process.env.NAME_REGISTRY_ADDRESS || "0x87B9fD42553067BeBc2Abf42c7045C8F2F7D1A79",
    baseSepolia: process.env.NAME_REGISTRY_ADDRESS || "", // Add when deployed / override
    hardhat: "" // Will be deployed fresh
  };
  
  const network = hre.network.name;
  let nameRegistryAddress = ADDRESSES[network];
  
  // For local/testnet, deploy fresh
  if (!nameRegistryAddress) {
    console.log("Deploying fresh NameRegistry for", network);
    const NameRegistry = await hre.ethers.getContractFactory("NameRegistry");
    const registry = await NameRegistry.deploy();
    await registry.waitForDeployment();
    nameRegistryAddress = await registry.getAddress();
  }
  
  console.log("NameRegistry:", nameRegistryAddress);
  console.log("Handle:", HANDLE);
  console.log("Controller:", CONTROLLER);
  
  // Connect to registry
  const nameRegistry = await hre.ethers.getContractAt("NameRegistry", nameRegistryAddress);
  
  // Check availability
  const available = await nameRegistry.isAvailable(HANDLE);
  console.log("Available:", available);
  
  if (!available) {
    const existingController = await nameRegistry.resolve(HANDLE);
    console.log("Handle already registered to:", existingController);
    return;
  }
  
  // Register
  console.log("\nRegistering handle...");
  const tx = await nameRegistry.registerName(HANDLE, CONTROLLER);
  console.log("TX:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);
  
  // Verify
  const registeredController = await nameRegistry.resolve(HANDLE);
  console.log("\n✅ Handle registered!");
  console.log("Handle:", HANDLE);
  console.log("Controller:", registeredController);
  console.log("DID:", `did:logos:${HANDLE}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

