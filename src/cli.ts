import { Command } from 'commander';
import { FileSharingService } from './fileSharing';
import { IPFSService } from './ipfs';
import { EncryptionService } from './encryption';
import { BlockchainService } from './blockchain';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Load contract ABI
const contractABI = JSON.parse(
  fs.readFileSync('./artifacts/contracts/FileSharing.sol/FileSharing.json', 'utf8')
).abi;

// Initialize services
const ipfsService = new IPFSService(false); // Using mock IPFS for demo
const encryptionService = new EncryptionService();
const blockchainService = new BlockchainService(
  process.env.RPC_URL || 'http://127.0.0.1:8545',
  process.env.PRIVATE_KEY || '',
  process.env.CONTRACT_ADDRESS || '',
  contractABI
);

const fileSharing = new FileSharingService(
  ipfsService,
  encryptionService,
  blockchainService
);

const program = new Command();

program
  .name('blockchain-file-sharing')
  .description('CLI for blockchain-based file sharing system')
  .version('1.0.0');

// Generate RSA key pair
program
  .command('generate-keys')
  .description('Generate RSA key pair for encryption')
  .option('-o, --output <prefix>', 'Output file prefix', 'user')
  .action((options) => {
    try {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();
      
      const publicKeyPath = `${options.output}_public.pem`;
      const privateKeyPath = `${options.output}_private.pem`;
      
      fs.writeFileSync(publicKeyPath, publicKey);
      fs.writeFileSync(privateKeyPath, privateKey);
      
      console.log('\n✅ Keys generated successfully!');
      console.log(`📄 Public key saved to: ${publicKeyPath}`);
      console.log(`🔐 Private key saved to: ${privateKeyPath}`);
      console.log('\n⚠️  Keep your private key secure and never share it!');
    } catch (error) {
      console.error('❌ Error:', error);
    }
  });

// Upload file
program
  .command('upload <file>')
  .description('Upload a file to the blockchain system')
  .option('-p, --public', 'Make file public', false)
  .option('-k, --key <path>', 'Path to your public key', 'user_public.pem')
  .action(async (file, options) => {
    try {
      if (!fs.existsSync(file)) {
        console.error(`❌ File not found: ${file}`);
        return;
      }

      if (!fs.existsSync(options.key)) {
        console.error(`❌ Public key not found: ${options.key}`);
        console.log('💡 Generate keys first: npm run cli generate-keys');
        return;
      }

      const publicKey = fs.readFileSync(options.key, 'utf8');
      
      console.log('\n🚀 Uploading file to blockchain...\n');
      const { fileId, ipfsHash } = await fileSharing.uploadFile(
        file,
        options.public,
        publicKey
      );
      
      console.log('\n✅ File uploaded successfully!');
      console.log(`📋 File ID: ${fileId}`);
      console.log(`🔗 IPFS Hash: ${ipfsHash}`);
      console.log(`🔒 Public: ${options.public ? 'Yes' : 'No'}`);
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  });

// Download file
program
  .command('download <fileId> <output>')
  .description('Download a file from the blockchain system')
  .option('-k, --key <path>', 'Path to your private key', 'user_private.pem')
  .option('-a, --address <address>', 'Your wallet address')
  .action(async (fileId, output, options) => {
    try {
      if (!fs.existsSync(options.key)) {
        console.error(`❌ Private key not found: ${options.key}`);
        return;
      }

      const privateKey = fs.readFileSync(options.key, 'utf8');
      const address = options.address || process.env.USER_ADDRESS;

      if (!address) {
        console.error('❌ User address not provided');
        console.log('💡 Use --address flag or set USER_ADDRESS in .env');
        return;
      }
      
      console.log('\n📥 Downloading file from blockchain...\n');
      await fileSharing.downloadFile(
        parseInt(fileId),
        output,
        address,
        privateKey
      );
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  });

// Share file
program
  .command('share <fileId> <recipientAddress>')
  .description('Share a file with another user')
  .option('-k, --owner-key <path>', 'Path to your private key', 'user_private.pem')
  .option('-r, --recipient-key <path>', 'Path to recipient public key')
  .option('--can-reshare', 'Allow recipient to reshare', false)
  .action(async (fileId, recipientAddress, options) => {
    try {
      if (!options.recipientKey) {
        console.error('❌ Recipient public key is required');
        console.log('💡 Use --recipient-key flag');
        return;
      }

      if (!fs.existsSync(options.ownerKey)) {
        console.error(`❌ Your private key not found: ${options.ownerKey}`);
        return;
      }

      if (!fs.existsSync(options.recipientKey)) {
        console.error(`❌ Recipient public key not found: ${options.recipientKey}`);
        return;
      }
      
      const ownerPrivateKey = fs.readFileSync(options.ownerKey, 'utf8');
      const recipientPublicKey = fs.readFileSync(options.recipientKey, 'utf8');
      
      console.log('\n🤝 Sharing file...\n');
      await fileSharing.shareFileWithUser(
        parseInt(fileId),
        recipientAddress,
        recipientPublicKey,
        ownerPrivateKey,
        options.canReshare
      );
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  });

// List files
program
  .command('list')
  .description('List your files')
  .option('-a, --address <address>', 'User address')
  .option('-s, --shared', 'List files shared with you instead of owned files', false)
  .action(async (options) => {
    try {
      const address = options.address || process.env.USER_ADDRESS;
      
      if (!address) {
        console.error('❌ User address not provided');
        console.log('💡 Use --address flag or set USER_ADDRESS in .env');
        return;
      }
      
      console.log(`\n📂 ${options.shared ? 'Files shared with you' : 'Your files'}:\n`);
      
      const files = options.shared
        ? await fileSharing.listSharedFiles(address)
        : await fileSharing.listUserFiles(address);
      
      if (files.length === 0) {
        console.log('   No files found.');
      } else {
        files.forEach((file, index) => {
          console.log(`${index + 1}. File ID: ${file.fileId}`);
          console.log(`   Name: ${file.fileName}`);
          console.log(`   Size: ${file.fileSize} bytes`);
          console.log(`   Owner: ${file.owner}`);
          console.log(`   Public: ${file.isPublic ? 'Yes' : 'No'}`);
          console.log(`   Uploaded: ${file.uploadTimestamp.toLocaleString()}`);
          console.log(`   IPFS: ${file.ipfsHash}`);
          console.log('');
        });
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  });

// Get file info
program
  .command('info <fileId>')
  .description('Get detailed information about a file')
  .action(async (fileId) => {
    try {
      const file = await blockchainService.getFile(parseInt(fileId));
      
      console.log('\n📄 File Information:\n');
      console.log(`File ID: ${file.fileId}`);
      console.log(`Name: ${file.fileName}`);
      console.log(`Size: ${Number(file.fileSize)} bytes`);
      console.log(`Owner: ${file.owner}`);
      console.log(`Public: ${file.isPublic ? 'Yes' : 'No'}`);
      console.log(`Uploaded: ${new Date(Number(file.uploadTimestamp) * 1000).toLocaleString()}`);
      console.log(`IPFS Hash: ${file.ipfsHash}`);
      
      console.log('\n🤝 Shared with:');
      const sharedAccess = await blockchainService.getSharedAccess(parseInt(fileId));
      
      if (sharedAccess.length === 0) {
        console.log('   Not shared with anyone');
      } else {
        sharedAccess.forEach((access: any, index: number) => {
          console.log(`${index + 1}. ${access.sharedWith}`);
          console.log(`   Shared at: ${new Date(Number(access.sharedTimestamp) * 1000).toLocaleString()}`);
          console.log(`   Can reshare: ${access.canReshare ? 'Yes' : 'No'}`);
        });
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  });

program.parse();