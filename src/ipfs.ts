import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

export class IPFSService {
  private usePinata: boolean;
  private pinataApiKey: string;
  private pinataSecretKey: string;

  constructor(usePinata: boolean = true) {
    this.usePinata = usePinata;
    this.pinataApiKey = process.env.PINATA_API_KEY || '';
    this.pinataSecretKey = process.env.PINATA_SECRET_KEY || '';
  }

  async uploadFile(filePath: string): Promise<string> {
    if (this.usePinata && this.pinataApiKey && this.pinataSecretKey) {
      return this.uploadToPinata(filePath);
    } else {
      // For demo purposes, return a mock IPFS hash
      return this.generateMockIPFSHash(filePath);
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

  private generateMockIPFSHash(filePath: string): string {
    const crypto = require('crypto');
    const fileContent = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
    return `Qm${hash.substring(0, 44)}`;
  }

  async downloadFile(ipfsHash: string, outputPath: string): Promise<void> {
    if (this.usePinata && this.pinataApiKey) {
      await this.downloadFromPinata(ipfsHash, outputPath);
    } else {
      console.log(`Mock download: ${ipfsHash} -> ${outputPath}`);
      // For demo, we'll handle this differently
    }
  }

  private async downloadFromPinata(ipfsHash: string, outputPath: string): Promise<void> {
    const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });

    fs.writeFileSync(outputPath, response.data);
  }
}