

const Web3 = require('web3');
const fs = require('fs');
const { Console } = require('console');
const { ethers } = require("hardhat");
const { Readable } = require('stream');
const path = require('path');
const { resolve } = require('path');
const { rejects } = require('assert');
const { exec } = require('child_process');
const moment = require('moment');

const API_KEY = process.env.ACHEMY_API_KEY;
const PRIVATE_KEY = process.env.NET2_NODE0_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_SC_ADDRESS = process.env.NET2_PRIVATE_CONTRACT_ADDRESS;

const web3 = new Web3('http://192.168.0.13:8595'); // Geth RPC endpoint
const readCatalogAbiFileData = fs.readFileSync('./ABIs/gtw_catalog_abi.json');
const gtwCatalogAbi = JSON.parse(readCatalogAbiFileData); //private network
const gtwCatalogContract = new web3.eth.Contract(gtwCatalogAbi, PRIVATE_SC_ADDRESS);

const nodePrivateKey = PRIVATE_KEY;
const account = web3.eth.accounts.privateKeyToAccount(nodePrivateKey);
web3.eth.accounts.wallet.add(account);

// For Hardhat 
const contract = require("./artifacts/contracts/Catalog.sol/Catalog.json");
const farmMenuContractAbi = require("./artifacts/contracts/Catalog.sol/FarmMenu.json");

// Provider
const alchemyProvider = new ethers.providers.AlchemyProvider(network="maticmum", API_KEY);

// Signer
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

// Contract
const catalogContract = new ethers.Contract(CONTRACT_ADDRESS, contract.abi, signer);

const farmMenuAbiFileData = fs.readFileSync('./ABIs/farm_menu_abi.json');
const farmMenuAbi = JSON.parse(farmMenuAbiFileData);

var nodeIpnsKey = "";
const FARM_ID = "1";
var farmOutputIpnsPk = "";
let farmSc = "";
let farmMenuContract;

function watchDirectory(directoryToWatch, callback) {
  let timer;

  fs.watch(directoryToWatch, { recursive: true }, (eventType, filename) => {
    if (eventType === 'change' || eventType === 'rename') {
      clearTimeout(timer);
      timer = setTimeout(() => {
        callback(filename);
      }, 1000); // Delay in milliseconds
    }
  });
}

function waitForDirectoryChange(directoryToWatch, callback) {
  watchDirectory(directoryToWatch, callback);
}

async function publishToIpns(ipfs, cid, keyName, timeout_ms) {

  //const options = { key: keyName }; 

  while(true) {
    try { 
      //console.log(`Publishing [${cid}] to ${keyName}`);
      console.log("\nPublishing cid: ", cid);
      console.log("To: ", keyName);
      const result = await ipfs.name.publish(cid, { key: keyName });
      console.log("Published to Catalog IPNS result: ", result);
      break;

    } catch(error) {
      console.log("Error: ",  error);
      console.log("Error publishing to IPNS! Trying again...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function waitForAddressEvent() {
  const eventName = 'FarmCreated';

  console.log('Waiting for SC Address event...');

  return new Promise((resolve, reject) => {
    catalogContract.on(eventName, (farmScAddr) => {
      catalogContract.removeAllListeners(eventName); // Remove the event listener after the event is detected
      resolve(farmScAddr);
    });
  });
}

function waitForEvents() {
  return new Promise((resolve, reject) => {
    const event1 = "DataDeviceRequested";
    const event2 = "FarmDataRequested";
    const event3 = "IpnsUpdated";
    let resolved = false;

    const event1Listener = (deviceId) => {
      if (!resolved) {
        resolved = true;
        let info = {
          deviceID: deviceId,
          eventName: event1,
        };
        resolve(info);
      }
    };

    const event2Listener = () => {
      if (!resolved) {
        resolved = true;
        let info = {
          eventName: event2,
        };
        resolve(info);
      }
    };

    const event3Listener = (outputIpnsPk) => {
      if (!resolved) {
        resolved = true;
        let info = {
          ipnsPk: outputIpnsPk,
          eventName: event2,
        };
        resolve(info);
      }
    };

    // Cleanup event listeners
    const cleanupListeners = () => {
      farmMenuContract.removeListener(event1, event1Listener);
      farmMenuContract.removeListener(event2, event2Listener);
      farmMenuContract.removeListener(event3, event3Listener);
    };

    // Handle errors
    const errorHandler = (error) => {
      cleanupListeners();
      reject(error);
    };

    // Register event listeners
    farmMenuContract.on(event1, event1Listener);
    farmMenuContract.on(event2, event2Listener);
    farmMenuContract.on(event3, event3Listener);
    farmMenuContract.on("error", errorHandler);
  });
}

async function checkIPNSKeyNameExists(ipfs, keyName) {
  console.log("Checking if IPNS key exists...");
  try {
    const keys = await ipfs.key.list();
    const keyExists = keys.some((key) => key.name === keyName);

    return keyExists;
  } catch (error) {
    // An error occurred while retrieving the keys, which indicates
    // that the key does not exist.
    return false;
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

async function checkPublicCatalog(ipfs) {

  var farmMenuListIpnsKey = await catalogContract.farmMenuListIpnsKey(); //verifica se a lista de farms nao existe
  console.log("FarmMenuListIpnsKey: ", farmMenuListIpnsKey);

  try {
    if(farmMenuListIpnsKey == '') { //se nao existe
      
      const catalogKeyName = 'PublicFarmMenuList'; //ipns key name para onde a lista de farms será armazenada

      var key = "";
      const keyExists = await checkIPNSKeyNameExists(ipfs, catalogKeyName);

      if(keyExists == false) {
        console.log("Generating a new IPNS public key for CSC...");
        key = await ipfs.key.gen(catalogKeyName, { type: 'rsa', size: 2048 }); //gera a chave
      } else{
        const keys = await ipfs.key.list();
        key = keys.find((k) => k.name === catalogKeyName); //procura a chave, caso ela exista
      }
      
      const cid = await ipfs.add({
        path: "ipfs_file.txt",
        content: "-1;-1;-1;-1;-1;-1",
      });
    
      //populate this IPNS key with a first value
      await publishToIpns(ipfs, cid.cid, catalogKeyName, 30000);

      farmMenuListIpnsKey = key.id;

      console.log("Sending key IPNS Public key to Catalog SC: ", key.id);
      var tx = await catalogContract.setFarmMenuListIpnsKey(key.id); //manda a chave gerada para o SC
      await tx.wait();
      console.log("Transaction done!");

      //const exportedKey = await ipfs.key.export(catalogKeyName); //exporta a chave privada para armazenar no SC para os outros nodos
      const tmpKey = await exportKey(catalogKeyName);
      const tmpPath = 'exportedKey.key';
      const exportedKey = await readFileAndDecode(tmpPath);

      const fileAdded = await ipfs.add({
        path: "ipfs_file.txt",
        content: exportedKey
      });

      tx = await catalogContract.setFarmMenuListSecretKey(fileAdded.cid.toString()); //armazena chave privada no SC
      await tx.wait();
      console.log("Transaction done!");
      
    }
  } catch(error) {
    console.log("Error catched: ", error);
    //console.log("Catalog Key Name already exist!");
  }


  if(farmMenuListIpnsKey == "") {
    const keys = await ipfs.key.list();
    farmMenuListIpnsKey = keys.find((k) => k.name === 'PublicFarmMenuList'); //procura a chave onde a lista de farms está armazenada
  }

  //verifica se esta farm existe na lista de farms disponivel
  const farmExist = await checkFarmIpnsKey(ipfs, farmMenuListIpnsKey);
  if(!farmExist) {
    farmOutputIpnsPk = await generateFarmIpnsKey(ipfs);

    ////////////////////////////////////////////////
    console.log("Creating Farm Smart Contract...");
    const tx = await catalogContract.createFarm(FARM_ID, farmOutputIpnsPk); //gera o seu SC e salve a chave IPNS onde os dados requisitados desta fazenda serao enviados

    farmSc = await waitForAddressEvent();
    console.log("Farm SC: ", farmSc);

    //////////////////////////////////////
    const ipnsName = '/ipns/' + farmMenuListIpnsKey;
    let ipfsCid;

    //busca pelo ultimo elemento da fila
    console.log("IpnsName: ", ipnsName);
    for await (const name of ipfs.name.resolve(ipnsName)) {
      ipfsCid = name;
    }

    const metadata = FARM_ID + ';' + farmSc + ';' + ipfsCid.replace('/ipfs/', '');
    console.log(`Storing FARM${FARM_ID} key: `, metadata);
    const fileAdded = await ipfs.add({
      path: "ipfs_file.txt",
      content: metadata,
    });

    console.log("CID1: ", fileAdded);
    //importa a chave para poder alterar o seu conteudo
    const farmMenuListIpnsKeyName = await importFarmMenuIpnsKeyName(ipfs);
    //publica esta chave IPNS gerada na lista de chaves do Catalog SC
    await publishToIpns(ipfs, fileAdded.cid, farmMenuListIpnsKeyName, 5000); 

  }

  farmMenuContract = new ethers.Contract(farmSc, farmMenuContractAbi.abi, signer);
}

async function checkPrivateCatalog(ipfs) {
  var privateKeyCid = await gtwCatalogContract.methods.privateKeyCid().call(); 
  console.log("PrivateKey: ", privateKeyCid);

  var keyExists = false;
  var key = "";

  if(privateKeyCid == '') {
    const privateScIpnsSk = 'IpnsSecretKey'; //ipns key name

    keyExists = await checkIPNSKeyNameExists(ipfs, privateScIpnsSk);

    if(keyExists == false) {
      console.log("Generating a new IPNS key for Gateway Catalog...");
      key = await ipfs.key.gen(privateScIpnsSk, { type: 'rsa', size: 2048 });
    } else{
      const keys = await ipfs.key.list();
      key = keys.find((k) => k.name === privateScIpnsSk);
    }

    //const exportedKey = await ipfs.key.export(privateScIpnsSk);
    const tmpKey = await exportKey(privateScIpnsSk);
    const tmpPath = 'exportedKey.key';
    const exportedKey = await readFileAndDecode(tmpPath);

    const fileAdded = await ipfs.add({
      path: "ipfs_file.txt",
      content: exportedKey
    });

    await gtwCatalogContract.methods.setPrivateKeyCid(fileAdded.cid.toString()).send({ from: account.address, gas: 9999999, gasPrice: '0' }, function(error, result) {
      if (error) {
        console.error("Error:", error);
      } else {
        console.log("Return:", result);
      }
    });

    const cid = await ipfs.add({
      path: "ipfs_file.txt",
      content: "-1;-1;-1;-1;-1;-1",
    });
  
    //populate this IPNS key
    await publishToIpns(ipfs, cid.cid, privateScIpnsSk, 30000);

    await gtwCatalogContract.methods.setCatalogIpnsKey(key.id).send({ from: account.address, gas: 9999999, gasPrice: '0' }, function(error, result) {
      if (error) {
        console.error("Error:", error);
      } else {
        console.log("Return:", result);
      }
    });
  }
  
  var outputIpnsKey = await gtwCatalogContract.methods.outputIpnsKey().call(); 
  console.log("OutputIpnsKey: ", outputIpnsKey);

  if(outputIpnsKey == '') {
    const outputIpnsKey = 'PrivateOutputIpnsKey'; //ipns public key name

    keyExists = await checkIPNSKeyNameExists(ipfs, outputIpnsKey);

    if(keyExists == false) {
      console.log("Generating a new Private Output IPNS key for Gateway Catalog...");
      key = await ipfs.key.gen(outputIpnsKey, { type: 'rsa', size: 2048 });
    } else{
      const keys = await ipfs.key.list();
      key = keys.find((k) => k.name === outputIpnsKey);
    }

    await gtwCatalogContract.methods.setOuputIpnsKey(key.id).send({ from: account.address, gas: 9999999, gasPrice: '0' }, function(error, result) {
      if (error) {
        console.error("Error:", error);
      } else {
        console.log("Return:", result);
      }
    });
  }
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

async function importFarmMenuIpnsKeyName(ipfs) {
  const secretKeyCid = await catalogContract.farmMenuListSecretKey(); 

  console.log("Secret key CID: ", secretKeyCid);

  const data = ipfs.cat(secretKeyCid);
  const metadata_chunks = []
  for await (const chunk of data) {
      metadata_chunks.push(chunk)
  }
  
  const exportedKey = Buffer.concat(metadata_chunks).toString()
  console.log("Key exported...");

  const clone = "FarmMenuListSecretKey_Farm" + FARM_ID;
  console.log("Checking if keye exist ...");
  keyExists = await checkIPNSKeyNameExists(ipfs, clone);

  if(keyExists == false) {
    //const key = await ipfs.key.import(clone, exportedKey, '123456');
    const keyFile = clone;
    console.log("Creating key file...");
    await createKeyFile(exportedKey, `${keyFile}.key`);
    console.log("Importing key...");
    const key = await importKey(clone, keyFile);

    console.log("\nKey imported: ", key);
    return key;
  }

  return clone;
}

async function importCatalogIpnsKeyName(ipfs) {
  const privateKeyCid = await gtwCatalogContract.methods.privateKeyCid().call(); 

  const data = ipfs.cat(privateKeyCid);
  const metadata_chunks = []
  for await (const chunk of data) {
      metadata_chunks.push(chunk)
  }
  
  const exportedKey = Buffer.concat(metadata_chunks).toString()
  //console.log("IPFS output: ", exportedKey);

  var fileName = path.basename(__filename);
  fileName = fileName.replace(".js", "");

  const clone = "CatalogPrivateIpnsKey_" + fileName;
  //const key = await ipfs.key.import(clone, exportedKey, '123456');
  const keyFile = clone;
  await createKeyFile(exportedKey, `${keyFile}.key`);
  const key = await importKey(clone, keyFile);

  console.log("\nKey imported: ", key);
}

async function generateFarmIpnsKey(ipfs) {
  var keyExists = false;
  var key = "";

  var farmIpnsKey = "Farm" + FARM_ID + 'IpnsKey'; //ipns key name para estar farm
  console.log("FarmIpnsKey: ", farmIpnsKey);

  keyExists = await checkIPNSKeyNameExists(ipfs, farmIpnsKey);
  if(keyExists == false) {
    console.log(`Generating a new IPNS key for FARM${FARM_ID}...`);
    key = await ipfs.key.gen(farmIpnsKey, { type: 'rsa', size: 2048 });
  } else{
    const keys = await ipfs.key.list();
    key = keys.find((k) => k.name === farmIpnsKey);
  }

  const cid = await ipfs.add({
    path: "ipfs_file.txt",
    content: "-1;-1;-1;-1;-1;-1",
  });

  //populate this IPNS key
  await publishToIpns(ipfs, cid.cid, farmIpnsKey, 30000);

  return key.id; //retorna o ID da chave onde vai ser enviado o conteúdo dessa farm
}

async function generateNodeIpnsKey(ipfs, deviceID) {

  var keyExists = false;
  var key = "";

  nodeIpnsKey = "Farm" + FARM_ID + '_' + "Device" + deviceID + 'IpnsKey'; //ipns key name
  console.log("nodeIpnsKey: ", nodeIpnsKey);

  keyExists = await checkIPNSKeyNameExists(ipfs, nodeIpnsKey);
  console.log("Debug keyExists: ", keyExists);

  if(keyExists == false) {
    console.log(`Generating a new IPNS key for ${deviceID}...`);
    key = await ipfs.key.gen(nodeIpnsKey, { type: 'rsa', size: 2048 });
  } else{
    const keys = await ipfs.key.list();
    key = keys.find((k) => k.name === nodeIpnsKey);
  }

  const cid = await ipfs.add({
    path: "ipfs_file.txt",
    content: "-1;-1;-1;-1;-1;-1",
  });

  console.log("IPFS CID: ", cid);

  //populate its dataset IPNS key
  await publishToIpns(ipfs, cid.cid, nodeIpnsKey, 30000);

  //publishes its dataset IPNS key to catalog IPNS key
  const catalogIpnsKey = await gtwCatalogContract.methods.catalogIpnsKey().call(); 
  const ipnsName = '/ipns/' + catalogIpnsKey;
  let ipfsCid;

  console.log("IPNS Name: ", ipnsName);
  for await (const name of ipfs.name.resolve(ipnsName)) {
    ipfsCid = name;
  }

  console.log("ipfsCID: ", ipfsCid);

  const metadata = deviceID + ';' + key.id + ';' + ipfsCid.replace('/ipfs/', '');
  console.log(`Storing DEVICE${deviceID} key: `, metadata);
  const fileAdded = await ipfs.add({
    path: "ipfs_file.txt",
    content: metadata,
  });

  console.log("fileAdded: ", fileAdded.cid);

  //no caso do gateway, ele ja tem a chave, se nao teria que importar
  //const catalogIpnsKeyName = await importCatalogIpnsKeyName(ipfs);
  await publishToIpns(ipfs, fileAdded.cid, "IpnsSecretKey", 5000); 
}

async function getLastIpnsData(iterator) {
  let result;
  for await (const value of iterator) {
    result = value;
  }
  return result;
}

async function checkFarmIpnsKey(ipfs, farmMenuListIpnsKey) {
  let cid;

  //cid = await getLastIpnsData(ipfs.name.resolve(`/ipns/${farmMenuListIpnsKey}`));
  for await (const name of ipfs.name.resolve(`/ipns/${farmMenuListIpnsKey}`)) {
    cid = name;
  }
  console.log("CID: ", cid.replace('/ipfs/', ''));

  var contentString = "";

  //verifica se a farm já possui um IPNS key para ela
  while(contentString != "-1;-1;-1;-1;-1;-1") {
    const data = ipfs.cat(cid);
    const metadata_chunks = []
    for await (const chunk of data) {
        metadata_chunks.push(chunk)
    }
    contentString = Buffer.concat(metadata_chunks).toString()
    console.log("IPFS output: ", contentString);

    const ipfsContentList = contentString.split(';');

    //check of this device already has its own IPNS key
    if(ipfsContentList[0] == FARM_ID) {
      console.log("This FARM already has its IPNS key!");
      return true;
    }

    cid = ipfsContentList[2];
  }

  console.log("This FARM doesnt have its IPNS key!");

  return false
}

async function checkDatasetIpns(ipfs, deviceID) {
  //const fileName = path.basename(__filename);
  const catalogIpnsKey = await gtwCatalogContract.methods.catalogIpnsKey().call(); 
  console.log("CatalogIpnsKey: ", catalogIpnsKey);
  
  //const ipnsPk = '/ipns/' + catalogIpnsKey;
  let cid;

  console.log("\n");
  //cid = await getLastIpnsData(ipfs.name.resolve(`/ipns/${catalogIpnsKey}`));
  for await (const name of ipfs.name.resolve(`/ipns/${catalogIpnsKey}`)) {
    cid = name;
  }

  console.log("CatalogIpnsKey: ", catalogIpnsKey)
  console.log("CID: ", cid.replace('/ipfs/', ''));

  var contentString = "";

  //verifica se o device já possui um IPNS key para ele
  while(contentString != "-1;-1;-1;-1;-1;-1") {
    const data = ipfs.cat(cid);
    const metadata_chunks = []
    for await (const chunk of data) {
        metadata_chunks.push(chunk)
    }
    contentString = Buffer.concat(metadata_chunks).toString()
    console.log("IPFS output: ", contentString);

    const ipfsContentList = contentString.split(';');

    //check of this device already has its own IPNS key
    if(ipfsContentList[0] == deviceID) {
      console.log("This device already has its IPNS key!");
      return true;
    }

    cid = ipfsContentList[2];

  }

  console.log("There is no IPNS key for this device!");

  return false;
}

async function getLastIpfsCid(ipfs, deviceID) {

  nodeIpnsKey = "Farm" + FARM_ID + '_' + "Device" + deviceID + "IpnsKey";
  console.log("Searching for key: ", nodeIpnsKey);

  var keys = await ipfs.key.list();
  var key = keys.find((k) => k.name === nodeIpnsKey);

  try {
    const ipnsName = '/ipns/' + key.id;
    let cid;

    for await (const name of ipfs.name.resolve(ipnsName)) {
        cid = name;
    }

    return (cid.replace('/ipfs/', ''));
  } catch(error) {
    await generateNodeIpnsKey(ipfs, deviceID);
    keys = await ipfs.key.list();
    key = keys.find((k) => k.name === nodeIpnsKey);

    const ipnsName = '/ipns/' + key.id;
    console.log("After generate IPNS key: ", ipnsName);

    let cid;

    for await (const name of ipfs.name.resolve(ipnsName)) {
        cid = name;
    }

    return (cid.replace('/ipfs/', ''));
  }
}

async function getSensorData(filePath, fileName) {
  const fileContent = fs.readFileSync(filePath + fileName);
  const contentString = fileContent.toString();

  return (contentString)
}

async function main() {
    const { create } = await import('ipfs-http-client');
    const ipfs = await create({ url: 'http://127.0.0.1:4001' });

    const filePath = './Nodes/Farm2/Node0/Devices/'

    await checkPublicCatalog(ipfs);
    await checkPrivateCatalog(ipfs);

    const handleEvent = async (info) => {
      console.log("Event received:", info);
      // Continue with other actions based on the event
      
      if(info.eventName == "DataDeviceRequested") {
        const lastCid = await getLastIpfsCid(ipfs, info.deviceID);
        console.log("CID that will be sent: ", lastCid);

        const farmIpnsKey = "Farm" + FARM_ID + 'IpnsKey';
        //send data to output IPNS key of FarmMenu
        await publishToIpns(ipfs, lastCid, farmIpnsKey, 30000);

      } else if(info.eventName == "FarmDataRequested") {
        console.log("FarmDataRequested!");
        //catalogIpnsKey
        const ipnsPk = await gtwCatalogContract.methods.catalogIpnsKey().call();
        console.log("PK that will be sent: ", ipnsPk);

        const cid = await ipfs.add({
          path: "ipfs_file.txt",
          content: ipnsPk
        });

        const farmIpnsKey = "Farm" + FARM_ID + 'IpnsKey';
        //send data to output IPNS key of FarmMenu
        await publishToIpns(ipfs, cid.cid, farmIpnsKey, 30000);
      }

      // Call waitForEvents again to listen for the next event with a delay
      setTimeout(() => {
        waitForEvents()
          .then(handleEvent)
          .catch((error) => {
            console.error("Error occurred:", error);
            // Handle the error accordingly
          });
      }, 1000); // Delay in milliseconds
    };
  
    const handleFileChange = async (filename) => {
      console.log(`File ${filename} was modified`);
      
      // Continue with other actions based on the file change
      const metadata = await getSensorData(filePath,filename);
      const deviceIDList = metadata.split(';');
      const deviceID = deviceIDList[0];

      const datasetExists = await checkDatasetIpns(ipfs, deviceID);
      if(datasetExists == false) {
        await generateNodeIpnsKey(ipfs, deviceID);
      }

      const lastCid = await getLastIpfsCid(ipfs, deviceID);
      const currentTimestamp = moment().format('YYYY-MM-DD HH:mm:ss:SSS');
      const data = metadata + currentTimestamp + ';' + lastCid;

      console.log("Next value: ", data);
      const cid = await ipfs.add({
        path: "ipfs_file.txt",
        content: data
      });

      //console.log("DEBUG CID: ", cid);
      await publishToIpns(ipfs, cid.cid, nodeIpnsKey, 5000);
      
    
      // Delay using a Promise
      await new Promise((resolve) => setTimeout(resolve, 1000));
    
    };
  
    waitForEvents()
      .then(handleEvent)
      .catch((error) => {
        console.error("Error occurred:", error);
        // Handle the error accordingly
      });
  
    waitForDirectoryChange(filePath, handleFileChange);


}
    
main();
