import { IPFSService } from './ipfs';
import { EncryptionService } from './encryption';
import { BlockchainService } from './blockchain';
import * as fs from 'fs';
import * as path from 'path';

export class FileSharingService {
  private ipfs: IPFSService;
  private encryption: EncryptionService;
  private blockchain: BlockchainService;
  private tempDir: string;

  constructor(
    ipfsService: IPFSService,
    encryptionService: EncryptionService,
    blockchainService: BlockchainService,
    tempDir: string = './temp'
  ) {
    this.ipfs = ipfsService;
    this.encryption = encryptionService;
    this.blockchain = blockchainService;
    this.tempDir = tempDir;

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  }

  async uploadFile(
    filePath: string,
    isPublic: boolean = false,
    ownerPublicKey: string
  ): Promise<{ fileId: number; ipfsHash: string }> {
    try {
      console.log('1. Generating encryption key...');
      const aesKey = this.encryption.generateKey();

      console.log('2. Encrypting file...');
      const encryptedPath = path.join(this.tempDir, `encrypted_${Date.now()}`);
      const { iv, authTag } = await this.encryption.encryptFile(
        filePath,
        encryptedPath,
        aesKey
      );

      console.log('3. Uploading encrypted file to IPFS...');
      const ipfsHash = await this.ipfs.uploadFile(encryptedPath);
      console.log(`   IPFS Hash: ${ipfsHash}`);

      console.log('4. Encrypting AES key with owner public key...');
      const encodedKey = this.encryption.encodeKey(aesKey, iv, authTag);
      const encryptedAESKey = this.encryption.encryptWithPublicKey(
        Buffer.from(encodedKey),
        ownerPublicKey
      );

      console.log('5. Storing metadata on blockchain...');
      const fileStats = fs.statSync(filePath);
      const fileId = await this.blockchain.uploadFile(
        ipfsHash,
        path.basename(filePath),
        fileStats.size,
        isPublic,
        encryptedAESKey.toString('base64')
      );

      console.log(`   File ID: ${fileId}`);

      fs.unlinkSync(encryptedPath);

      return { fileId, ipfsHash };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async downloadFile(
    fileId: number,
    outputPath: string,
    userAddress: string,
    userPrivateKey: string
  ): Promise<void> {
    try {
      console.log('1. Checking access permissions...');
      const accessInfo = await this.blockchain.hasAccess(fileId, userAddress);
      
      if (!accessInfo.hasAccess) {
        throw new Error('Access denied: You do not have permission to access this file');
      }

      console.log('2. Getting file metadata...');
      const file = await this.blockchain.getFile(fileId);

      console.log('3. Downloading encrypted file from IPFS...');
      const encryptedPath = path.join(this.tempDir, `encrypted_${Date.now()}`);
      await this.ipfs.downloadFile(file.ipfsHash, encryptedPath);

      console.log('4. Decrypting AES key...');
      const encryptedAESKey = Buffer.from(accessInfo.encryptedKey, 'base64');
      const decryptedKeyData = this.encryption.decryptWithPrivateKey(
        encryptedAESKey,
        userPrivateKey
      );

      const { key, iv, authTag } = this.encryption.decodeKey(decryptedKeyData.toString());

      console.log('5. Decrypting file...');
      await this.encryption.decryptFile(encryptedPath, outputPath, key, iv, authTag);

      fs.unlinkSync(encryptedPath);

      console.log(`✅ File downloaded successfully to: ${outputPath}`);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  async shareFileWithUser(
    fileId: number,
    recipientAddress: string,
    recipientPublicKey: string,
    ownerPrivateKey: string,
    canReshare: boolean = false
  ): Promise<void> {
    try {
      console.log('1. Getting file metadata...');
      const file = await this.blockchain.getFile(fileId);

      console.log('2. Decrypting AES key with owner private key...');
      const encryptedAESKey = Buffer.from(file.encryptedKey, 'base64');
      const decryptedKeyData = this.encryption.decryptWithPrivateKey(
        encryptedAESKey,
        ownerPrivateKey
      );

      console.log('3. Encrypting AES key with recipient public key...');
      const recipientEncryptedKey = this.encryption.encryptWithPublicKey(
        decryptedKeyData,
        recipientPublicKey
      );

      console.log('4. Updating blockchain with share info...');
      await this.blockchain.shareFile(
        fileId,
        recipientAddress,
        recipientEncryptedKey.toString('base64'),
        canReshare
      );

      console.log('✅ File shared successfully!');
    } catch (error) {
      console.error('Error sharing file:', error);
      throw error;
    }
  }

  async listUserFiles(userAddress: string): Promise<any[]> {
    const fileIds = await this.blockchain.getUserFiles(userAddress);
    const files = [];

    for (const fileId of fileIds) {
      const file = await this.blockchain.getFile(fileId);
      files.push({
        fileId,
        fileName: file.fileName,
        fileSize: Number(file.fileSize),
        ipfsHash: file.ipfsHash,
        owner: file.owner,
        isPublic: file.isPublic,
        uploadTimestamp: new Date(Number(file.uploadTimestamp) * 1000),
      });
    }

    return files;
  }

  async listSharedFiles(userAddress: string): Promise<any[]> {
    const fileIds = await this.blockchain.getSharedFiles(userAddress);
    const files = [];

    for (const fileId of fileIds) {
      const file = await this.blockchain.getFile(fileId);
      files.push({
        fileId,
        fileName: file.fileName,
        fileSize: Number(file.fileSize),
        ipfsHash: file.ipfsHash,
        owner: file.owner,
        isPublic: file.isPublic,
        uploadTimestamp: new Date(Number(file.uploadTimestamp) * 1000),
      });
    }

    return files;
  }
}