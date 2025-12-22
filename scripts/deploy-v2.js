const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying Logos Protocol V2");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  
  // 1. Deploy new NameRegistry (with registerName(string, address))
  console.log("\n=== Deploying NameRegistry V2 ===");
  const NameRegistry = await hre.ethers.getContractFactory("NameRegistry");
  const nameRegistry = await NameRegistry.deploy();
  await nameRegistry.waitForDeployment();
  const nameRegistryAddress = await nameRegistry.getAddress();
  console.log("NameRegistry V2:", nameRegistryAddress);
  
  // 2. Deploy LogosAccountFactory
  console.log("\n=== Deploying LogosAccountFactory ===");
  const LogosAccountFactory = await hre.ethers.getContractFactory("LogosAccountFactory");
  const factory = await LogosAccountFactory.deploy(nameRegistryAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("LogosAccountFactory:", factoryAddress);
  
  // 3. Test: Check factory can call registry
  console.log("\n=== Testing ===");
  const testHandle = "ZZZTEST";
  const isAvailable = await nameRegistry.isAvailable(testHandle);
  console.log(`${testHandle} available:`, isAvailable);
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT COMPLETE - Base Mainnet");
  console.log("=".repeat(50));
  console.log(`NameRegistry V2:      ${nameRegistryAddress}`);
  console.log(`LogosAccountFactory:  ${factoryAddress}`);
  console.log("=".repeat(50));
  console.log("\nUpdate backend/server.js:");
  console.log(`const NAME_REGISTRY = '${nameRegistryAddress}';`);
  console.log(`const LOGOS_FACTORY = '${factoryAddress}';`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

