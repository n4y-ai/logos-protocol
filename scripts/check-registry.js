const { ethers } = require("hardhat");

async function main() {
  // Defaults to current production (V2). Override via env when needed.
  const NAME_REGISTRY = process.env.NAME_REGISTRY_ADDRESS || "0x87B9fD42553067BeBc2Abf42c7045C8F2F7D1A79";
  
  // Try old ABI (1 arg)
  const oldABI = [
    "function registerName(string handle) external",
    "function isAvailable(string handle) view returns (bool)",
    "function resolve(string handle) view returns (address)"
  ];
  
  // Try new ABI (2 args)
  const newABI = [
    "function registerName(string handle, address controller) external",
    "function isAvailable(string handle) view returns (bool)",
    "function resolve(string handle) view returns (address)"
  ];
  
  const provider = ethers.provider;
  
  // Check bytecode size to verify contract exists
  const code = await provider.getCode(NAME_REGISTRY);
  console.log("Contract code size:", code.length, "bytes");
  
  // Check a sample handle (works for both ABIs for reads)
  const nr = new ethers.Contract(NAME_REGISTRY, newABI, provider);
  const sample = process.env.HANDLE || "GUVUIK";
  console.log(`${sample} controller:`, await nr.resolve(sample));
  console.log(`${sample} available:`, await nr.isAvailable(sample));
  
  // Check factory (V2 default)
  const FACTORY = process.env.LOGOS_FACTORY_ADDRESS || "0x7553244FB04ff64EA0B86cA16F0427feb7F4E263";
  const factoryCode = await provider.getCode(FACTORY);
  console.log("Factory code size:", factoryCode.length, "bytes");
}

main().catch(console.error);

