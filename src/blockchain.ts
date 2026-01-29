import { ethers } from 'ethers';

export class BlockchainService {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private signer: ethers.Wallet;

  constructor(
    rpcUrl: string,
    privateKey: string,
    contractAddress: string,
    contractABI: any
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, contractABI, this.signer);
  }

  async uploadFile(
    ipfsHash: string,
    fileName: string,
    fileSize: number,
    isPublic: boolean,
    encryptedKey: string
  ): Promise<number> {
    console.log('   Sending transaction to blockchain...');
    const tx = await this.contract.uploadFile(
      ipfsHash,
      fileName,
      fileSize,
      isPublic,
      encryptedKey
    );

    console.log('   Waiting for confirmation...');
    const receipt = await tx.wait();
    
    // Extract fileId from event
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog(log);
        if (parsed?.name === 'FileUploaded') {
          return Number(parsed.args[0]);
        }
      } catch (e) {
        continue;
      }
    }

    throw new Error('FileUploaded event not found');
  }

  async shareFile(
    fileId: number,
    recipientAddress: string,
    encryptedKey: string,
    canReshare: boolean = false
  ): Promise<void> {
    const tx = await this.contract.shareFile(
      fileId,
      recipientAddress,
      encryptedKey,
      canReshare
    );
    await tx.wait();
  }

  async revokeAccess(fileId: number, userAddress: string): Promise<void> {
    const tx = await this.contract.revokeAccess(fileId, userAddress);
    await tx.wait();
  }

  async deleteFile(fileId: number): Promise<void> {
    const tx = await this.contract.deleteFile(fileId);
    await tx.wait();
  }

  async getUserFiles(userAddress: string): Promise<number[]> {
    const fileIds = await this.contract.getUserFiles(userAddress);
    return fileIds.map((id: bigint) => Number(id));
  }

  async getSharedFiles(userAddress: string): Promise<number[]> {
    const fileIds = await this.contract.getSharedFiles(userAddress);
    return fileIds.map((id: bigint) => Number(id));
  }

  async getFile(fileId: number): Promise<any> {
    return await this.contract.getFile(fileId);
  }

  async hasAccess(
    fileId: number,
    userAddress: string
  ): Promise<{ hasAccess: boolean; encryptedKey: string }> {
    const [hasAccess, encryptedKey] = await this.contract.hasAccess(fileId, userAddress);
    return { hasAccess, encryptedKey };
  }

  async getSharedAccess(fileId: number): Promise<any[]> {
    return await this.contract.getSharedAccess(fileId);
  }
}