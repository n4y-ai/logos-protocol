const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LogosAccount & Factory", function () {
  let nameRegistry, factory;
  let owner, agent, other;

  beforeEach(async function () {
    [owner, agent, other] = await ethers.getSigners();
    
    // Deploy NameRegistry
    const NameRegistry = await ethers.getContractFactory("NameRegistry");
    nameRegistry = await NameRegistry.deploy();
    
    // Deploy Factory
    const LogosAccountFactory = await ethers.getContractFactory("LogosAccountFactory");
    factory = await LogosAccountFactory.deploy(await nameRegistry.getAddress());
  });

  describe("Factory", function () {
    it("should create LogosAccount with handle registration", async function () {
      const tx = await factory.createLogos(owner.address, agent.address, "TESTLOGO");
      const receipt = await tx.wait();
      
      // Get account address from event
      const event = receipt.logs.find(log => {
        try {
          return factory.interface.parseLog(log)?.name === "LogosCreated";
        } catch { return false; }
      });
      const parsedEvent = factory.interface.parseLog(event);
      const accountAddress = parsedEvent.args.account;
      
      // Verify registration
      expect(await nameRegistry.resolve("TESTLOGO")).to.equal(accountAddress);
      expect(await factory.ownerToAccount(owner.address)).to.equal(accountAddress);
      expect(await factory.totalAccounts()).to.equal(1);
    });

    it("should reject unavailable handle", async function () {
      await factory.createLogos(owner.address, agent.address, "TAKEN");
      
      await expect(factory.createLogos(other.address, agent.address, "TAKEN"))
        .to.be.revertedWithCustomError(factory, "HandleNotAvailable");
    });

    it("should emit LogosCreated event", async function () {
      await expect(factory.createLogos(owner.address, agent.address, "EVENT"))
        .to.emit(factory, "LogosCreated");
    });
  });

  describe("LogosAccount", function () {
    let logosAccount;
    
    beforeEach(async function () {
      const tx = await factory.createLogos(owner.address, agent.address, "ACCOUNT");
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return factory.interface.parseLog(log)?.name === "LogosCreated";
        } catch { return false; }
      });
      const parsedEvent = factory.interface.parseLog(event);
      const accountAddress = parsedEvent.args.account;
      
      logosAccount = await ethers.getContractAt("LogosAccount", accountAddress);
    });

    it("should return correct DID", async function () {
      expect(await logosAccount.getDID()).to.equal("did:logos:ACCOUNT");
    });

    it("should have correct owner and agent", async function () {
      expect(await logosAccount.owner()).to.equal(owner.address);
      expect(await logosAccount.agent()).to.equal(agent.address);
    });

    it("should allow owner to change agent", async function () {
      await logosAccount.connect(owner).setAgent(other.address);
      expect(await logosAccount.agent()).to.equal(other.address);
    });

    it("should reject agent change from non-owner", async function () {
      await expect(logosAccount.connect(agent).setAgent(other.address))
        .to.be.revertedWithCustomError(logosAccount, "NotOwner");
    });

    it("should allow owner to execute calls", async function () {
      // Send ETH to account
      await owner.sendTransaction({ to: await logosAccount.getAddress(), value: ethers.parseEther("0.1") });
      
      // Execute transfer
      const balanceBefore = await ethers.provider.getBalance(other.address);
      await logosAccount.connect(owner).execute(other.address, ethers.parseEther("0.01"), "0x");
      const balanceAfter = await ethers.provider.getBalance(other.address);
      
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("0.01"));
    });

    it("should reject execute from non-owner", async function () {
      await expect(logosAccount.connect(agent).execute(other.address, 0, "0x"))
        .to.be.revertedWithCustomError(logosAccount, "NotOwner");
    });

    it("should allow owner and agent to record signed messages", async function () {
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      
      await logosAccount.connect(owner).recordSignedMessage(messageHash);
      expect(await logosAccount.signedMessages(messageHash)).to.be.true;
      
      const messageHash2 = ethers.keccak256(ethers.toUtf8Bytes("test message 2"));
      await logosAccount.connect(agent).recordSignedMessage(messageHash2);
      expect(await logosAccount.signedMessages(messageHash2)).to.be.true;
    });

    it("should reject recordSignedMessage from unauthorized", async function () {
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await expect(logosAccount.connect(other).recordSignedMessage(messageHash))
        .to.be.revertedWithCustomError(logosAccount, "NotOwnerOrAgent");
    });

    it("should verify signatures correctly", async function () {
      const message = "Hello Logos";
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
      
      // Sign with owner
      const ownerSig = await owner.signMessage(ethers.toBeArray(messageHash));
      const recoveredOwner = await logosAccount.verifySignature(messageHash, ownerSig);
      expect(recoveredOwner).to.equal(owner.address);
      
      // Sign with agent
      const agentSig = await agent.signMessage(ethers.toBeArray(messageHash));
      const recoveredAgent = await logosAccount.verifySignature(messageHash, agentSig);
      expect(recoveredAgent).to.equal(agent.address);
      
      // Sign with unauthorized
      const otherSig = await other.signMessage(ethers.toBeArray(messageHash));
      const recoveredOther = await logosAccount.verifySignature(messageHash, otherSig);
      expect(recoveredOther).to.equal(ethers.ZeroAddress);
    });

    it("should check authorization correctly", async function () {
      expect(await logosAccount.isAuthorized(owner.address)).to.be.true;
      expect(await logosAccount.isAuthorized(agent.address)).to.be.true;
      expect(await logosAccount.isAuthorized(other.address)).to.be.false;
    });
  });
});

