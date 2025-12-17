const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  
  // Check if NameRegistry already deployed (Base Mainnet)
  const existingNameRegistry = "0x0Eb28d2b84F48CE18742f6C42C5BA18c17b0d4E3";
  const network = hre.network.name;
  
  let nameRegistryAddress;
  
  if (network === "base") {
    console.log("\n=== Base Mainnet - Using existing NameRegistry ===");
    nameRegistryAddress = existingNameRegistry;
    console.log("NameRegistry:", nameRegistryAddress);
  } else {
    // Deploy new NameRegistry for testnet/local
    console.log("\n=== Deploying NameRegistry ===");
    const NameRegistry = await hre.ethers.getContractFactory("NameRegistry");
    const nameRegistry = await NameRegistry.deploy();
    await nameRegistry.waitForDeployment();
    nameRegistryAddress = await nameRegistry.getAddress();
    console.log("NameRegistry deployed to:", nameRegistryAddress);
  }
  
  // Deploy LogosAccountFactory
  console.log("\n=== Deploying LogosAccountFactory ===");
  const LogosAccountFactory = await hre.ethers.getContractFactory("LogosAccountFactory");
  const factory = await LogosAccountFactory.deploy(nameRegistryAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("LogosAccountFactory deployed to:", factoryAddress);
  
  // Summary
  console.log("\n=== Deployment Summary ===");
  console.log("Network:", network);
  console.log("NameRegistry:", nameRegistryAddress);
  console.log("LogosAccountFactory:", factoryAddress);
  console.log("\nAdd to DEPLOYMENT.md:");
  console.log(`- LogosAccountFactory: ${factoryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

