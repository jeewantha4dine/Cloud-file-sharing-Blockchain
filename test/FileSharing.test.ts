import { expect } from "chai";
import { ethers } from "hardhat";
import { FileSharing } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FileSharing", function () {
  let fileSharing: FileSharing;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const FileSharingFactory = await ethers.getContractFactory("FileSharing");
    fileSharing = await FileSharingFactory.deploy();
    await fileSharing.waitForDeployment();
  });

  describe("File Upload", function () {
    it("Should upload a file successfully", async function () {
      const tx = await fileSharing.uploadFile(
        "QmTest123",
        "test.txt",
        1024,
        false,
        "encryptedKey123"
      );
      
      await expect(tx)
        .to.emit(fileSharing, "FileUploaded");
      
      const file = await fileSharing.getFile(1);
      expect(file.fileName).to.equal("test.txt");
      expect(file.owner).to.equal(owner.address);
    });

    it("Should track user files", async function () {
      await fileSharing.uploadFile("QmTest1", "file1.txt", 100, false, "key1");
      await fileSharing.uploadFile("QmTest2", "file2.txt", 200, false, "key2");
      
      const userFiles = await fileSharing.getUserFiles(owner.address);
      expect(userFiles.length).to.equal(2);
    });
  });

  describe("File Sharing", function () {
    beforeEach(async function () {
      await fileSharing.uploadFile(
        "QmTest123",
        "test.txt",
        1024,
        false,
        "ownerKey"
      );
    });

    it("Should share file with another user", async function () {
      await expect(
        fileSharing.shareFile(1, user1.address, "sharedKey", false)
      ).to.emit(fileSharing, "FileShared");
      
      const sharedFiles = await fileSharing.getSharedFiles(user1.address);
      expect(sharedFiles.length).to.equal(1);
      expect(sharedFiles[0]).to.equal(1);
    });

    it("Should not allow sharing with self", async function () {
      await expect(
        fileSharing.shareFile(1, owner.address, "key", false)
      ).to.be.revertedWith("Cannot share with yourself");
    });

    it("Should check access correctly", async function () {
      let [hasAccess, key] = await fileSharing.hasAccess(1, owner.address);
      expect(hasAccess).to.be.true;
      expect(key).to.equal("ownerKey");
      
      [hasAccess] = await fileSharing.hasAccess(1, user1.address);
      expect(hasAccess).to.be.false;
      
      await fileSharing.shareFile(1, user1.address, "sharedKey", false);
      
      [hasAccess, key] = await fileSharing.hasAccess(1, user1.address);
      expect(hasAccess).to.be.true;
      expect(key).to.equal("sharedKey");
    });
  });

  describe("Access Revocation", function () {
    beforeEach(async function () {
      await fileSharing.uploadFile("QmTest", "file.txt", 100, false, "key");
      await fileSharing.shareFile(1, user1.address, "sharedKey", false);
    });

    it("Should revoke access successfully", async function () {
      await expect(
        fileSharing.revokeAccess(1, user1.address)
      ).to.emit(fileSharing, "FileAccessRevoked");
      
      const [hasAccess] = await fileSharing.hasAccess(1, user1.address);
      expect(hasAccess).to.be.false;
    });
  });

  describe("File Deletion", function () {
    it("Should delete file successfully", async function () {
      await fileSharing.uploadFile("QmTest", "file.txt", 100, false, "key");
      
      await expect(fileSharing.deleteFile(1))
        .to.emit(fileSharing, "FileDeleted");
      
      await expect(fileSharing.getFile(1))
        .to.be.revertedWith("File does not exist");
    });
  });
});