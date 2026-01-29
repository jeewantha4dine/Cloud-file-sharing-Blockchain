import { ethers } from "hardhat";

async function main() {
  console.log("Deploying FileSharing contract...");

  const FileSharingFactory = await ethers.getContractFactory("FileSharing");
  const fileSharing = await FileSharingFactory.deploy();

  await fileSharing.waitForDeployment();
  const address = await fileSharing.getAddress();

  console.log(`FileSharing deployed to: ${address}`);
  console.log("\nSave this address for later use!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });