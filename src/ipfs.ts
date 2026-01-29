import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as crypto from 'crypto';

export class IPFSService {
  private usePinata: boolean;
  private pinataApiKey: string;
  private pinataSecretKey: string;
  private storageDir: string;

  constructor(usePinata: boolean = true) {
    this.usePinata = usePinata;
    this.pinataApiKey = process.env.PINATA_API_KEY || '';
    this.pinataSecretKey = process.env.PINATA_SECRET_KEY || '';
    this.storageDir = './ipfs-storage';

    // Create storage directory for local demo
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async uploadFile(filePath: string): Promise<string> {
    if (this.usePinata && this.pinataApiKey && this.pinataSecretKey) {
      return this.uploadToPinata(filePath);
    } else {
      // Store locally and return mock hash
      return this.storeLocally(filePath);
    }
  }

  private async uploadToPinata(filePath: string): Promise<string> {
    const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
    
    const FormData = require('form-data');
    const data = new FormData();
    data.append('file', fs.createReadStream(filePath));

    const metadata = JSON.stringify({
      name: path.basename(filePath),
    });
    data.append('pinataMetadata', metadata);

    try {
      const response = await axios.post(url, data, {
        maxBodyLength: Infinity,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey,
        },
      });

      return response.data.IpfsHash;
    } catch (error) {
      console.error('Error uploading to Pinata:', error);
      throw error;
    }
  }

  private storeLocally(filePath: string): string {
    // Generate a mock IPFS hash
    const fileContent = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
    const ipfsHash = `Qm${hash.substring(0, 44)}`;
    
    // Copy file to storage with hash as filename
    const storagePath = path.join(this.storageDir, ipfsHash);
    fs.copyFileSync(filePath, storagePath);
    
    return ipfsHash;
  }

  async downloadFile(ipfsHash: string, outputPath: string): Promise<void> {
    if (this.usePinata && this.pinataApiKey) {
      await this.downloadFromPinata(ipfsHash, outputPath);
    } else {
      await this.downloadLocally(ipfsHash, outputPath);
    }
  }

  private async downloadFromPinata(ipfsHash: string, outputPath: string): Promise<void> {
    const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });

    fs.writeFileSync(outputPath, response.data);
  }

  private async downloadLocally(ipfsHash: string, outputPath: string): Promise<void> {
    const storagePath = path.join(this.storageDir, ipfsHash);
    
    if (!fs.existsSync(storagePath)) {
      throw new Error(`File not found in local storage: ${ipfsHash}`);
    }
    
    fs.copyFileSync(storagePath, outputPath);
  }
}