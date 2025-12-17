const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NameRegistry", function () {
  let nameRegistry;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const NameRegistry = await ethers.getContractFactory("NameRegistry");
    nameRegistry = await NameRegistry.deploy();
  });

  describe("Handle Validation", function () {
    it("should accept valid handles (4-10 chars, A-Z, 0-9)", async function () {
      expect(await nameRegistry.isAvailable("TEST")).to.be.true;
      expect(await nameRegistry.isAvailable("MARAT")).to.be.true;
      expect(await nameRegistry.isAvailable("LOGOS123")).to.be.true;
      expect(await nameRegistry.isAvailable("ABCDEFGHIJ")).to.be.true; // 10 chars
    });

    it("should reject handles shorter than 4 chars", async function () {
      expect(await nameRegistry.isAvailable("ABC")).to.be.false;
      expect(await nameRegistry.isAvailable("A")).to.be.false;
    });

    it("should reject handles longer than 10 chars", async function () {
      expect(await nameRegistry.isAvailable("ABCDEFGHIJK")).to.be.false; // 11 chars
    });

    it("should reject lowercase letters", async function () {
      expect(await nameRegistry.isAvailable("test")).to.be.false;
      expect(await nameRegistry.isAvailable("Marat")).to.be.false;
    });

    it("should reject special characters", async function () {
      expect(await nameRegistry.isAvailable("TEST!")).to.be.false;
      expect(await nameRegistry.isAvailable("TEST_")).to.be.false;
      expect(await nameRegistry.isAvailable("TEST-")).to.be.false;
    });
  });

  describe("Registration", function () {
    it("should register a valid handle", async function () {
      await nameRegistry.registerName("MARAT", user1.address);
      
      expect(await nameRegistry.resolve("MARAT")).to.equal(user1.address);
      expect(await nameRegistry.reverseResolve(user1.address)).to.equal("MARAT");
    });

    it("should emit NameRegistered event", async function () {
      await expect(nameRegistry.registerName("LOGOS", user1.address))
        .to.emit(nameRegistry, "NameRegistered")
        .withArgs("LOGOS", user1.address);
    });

    it("should reject duplicate registration", async function () {
      await nameRegistry.registerName("TEST", user1.address);
      
      await expect(nameRegistry.registerName("TEST", user2.address))
        .to.be.revertedWithCustomError(nameRegistry, "HandleAlreadyRegistered");
    });

    it("should reject invalid handle length on registration", async function () {
      await expect(nameRegistry.registerName("ABC", user1.address))
        .to.be.revertedWithCustomError(nameRegistry, "InvalidHandleLength");
    });

    it("should reject invalid characters on registration", async function () {
      await expect(nameRegistry.registerName("test", user1.address))
        .to.be.revertedWithCustomError(nameRegistry, "InvalidHandleCharacter");
    });
  });

  describe("Resolution", function () {
    it("should return zero address for unregistered handle", async function () {
      expect(await nameRegistry.resolve("UNREGISTERED")).to.equal(ethers.ZeroAddress);
    });

    it("should return empty string for address without handle", async function () {
      expect(await nameRegistry.reverseResolve(user1.address)).to.equal("");
    });
  });
});

