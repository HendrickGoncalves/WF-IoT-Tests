//const ipfsClient = require('ipfs-http-client');
const fs = require('fs');
const { exec } = require('child_process');
const moment = require('moment');
// const ipfs = ipfsClient({ url: 'http://127.0.0.1:4001' });

function readFileAndDecode(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          reject(`Error reading file: ${err}`);
          return;
        }
  
        // Convert file contents to a human-readable format
        const decodedData = data.toString('base64');

        resolve(decodedData);
      });
    });
  }

async function createKeyFile(base64Key, filePath) {
    // Decode the base64 key
    const keyBuffer = Buffer.from(base64Key, 'base64');
  
    // Write the key buffer to the file
    try {
      await fs.promises.writeFile(filePath, keyBuffer);
      console.log(`Key file created: ${filePath}`);
    } catch (error) {
      console.error('Error creating key file:', error);
    }
  }

async function importKey(keyName, keyFile) {
    return new Promise((resolve, reject) => {
      const command = `ipfs key import ${keyName} ./${keyFile}.key`;
  
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(`Error executing command: ${error.message}`);
          return;
        }
  
        if (stderr) {
          reject(`Command error: ${stderr}`);
          return;
        }
  
        const importedKey = stdout.trim();
        
        resolve(importedKey);
      });
    });
  }

async function exportKey(keyName) {
    return new Promise((resolve, reject) => {
      const command = `ipfs key export ${keyName} -o exportedKey.key`;
  
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(`Error executing command: ${error.message}`);
          return;
        }
  
        if (stderr) {
          reject(`Command error: ${stderr}`);
          return;
        }
  
        const exportedKey = stdout.trim();
        resolve(exportedKey);
      });
    });
  }
  

async function main() {
  const currentTimestampFormatted = moment().format('YYYY-MM-DD HH:mm:ss:SSS');
console.log(currentTimestampFormatted);
}

main();
