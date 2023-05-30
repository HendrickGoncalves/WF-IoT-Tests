

const Web3 = require('web3');
const fs = require('fs');
const { Console } = require('console');
const { ethers } = require("hardhat");
const { Readable } = require('stream');

const API_KEY = process.env.ACHEMY_API_KEY;
const PRIVATE_KEY = process.env.REQUESTER2_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// For Hardhat 
const contract = require("./artifacts/contracts/Catalog.sol/Catalog.json");
const farmMenuContractAbi = require("./artifacts/contracts/Catalog.sol/FarmMenu.json");

// Provider
const alchemyProvider = new ethers.providers.AlchemyProvider(network="maticmum", API_KEY);

// Signer
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

// Contract
const catalogContract = new ethers.Contract(CONTRACT_ADDRESS, contract.abi, signer);

async function catIpfs(ipfs, cid) {
    const data = ipfs.cat(cid);
    const metadata_chunks = []
    for await (const chunk of data) {
        metadata_chunks.push(chunk)
    }
    const contentString = Buffer.concat(metadata_chunks).toString()
    
    return (contentString);
}

//0;0x7DAef6bc88a5B41004914535CCC6ef0D11d78150;QmZPzphDi6i8usB9eSgJ1x661E7Xjdm66pZRBSCjSpCQUs
async function main() {
    const { create } = await import('ipfs-http-client');
    const ipfs = await create({ url: 'http://127.0.0.1:4001' });

    const result = await catalogContract.farmMenuListIpnsKey();
    console.log("Request result: ", result);

    for await (const name of ipfs.name.resolve(`/ipns/${result}`)) {
        cid = name;
    }
    
    console.log("CID: ", cid.replace('/ipfs/', ''));
    var contentString = "";

    let farmSc = "";
    while(contentString != "-1;-1;-1;-1;-1;-1") {
        contentString = await catIpfs(ipfs, cid);
        console.log("IPFS output: ", contentString);
    
        const ipfsContentList = contentString.split(';');

        //if it is the farm that I want
        if(ipfsContentList[0] == "0") {
            farmSc = ipfsContentList[1];
            break;
        }
    
        if (ipfsContentList.length > 1) { 
          cid = ipfsContentList[2];
        }
    }

    console.log("Farm SC: ", farmSc)
    const farmMenuContract = new ethers.Contract(farmSc, farmMenuContractAbi.abi, signer);
    const outputIpns = await farmMenuContract.outputIpnsPk();

    const ipnsName = '/ipns/' + outputIpns;
    let previousCid;

    console.log("IPNS Name: ", ipnsName);
    for await (const name of ipfs.name.resolve(ipnsName)) {
        previousCid = name;
    }

    let outputCid = previousCid;

    console.time("Request");

    const device_requested = "1";
    
    while(true) {
        const tx = await farmMenuContract.requestDeviceData(device_requested);
        await tx.wait();
        console.log("Transaction done!");

        console.log("Previous CID: ", previousCid);
        console.log("Output CID: ", outputCid);
        while(outputCid == previousCid) {
            for await (const name of ipfs.name.resolve(ipnsName)) {
                outputCid = name;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        console.timeEnd("Request")

        console.log("Device data: ", outputCid);
        const deviceMetadata = await catIpfs(ipfs, outputCid);
        console.log("Device Metadata: ", deviceMetadata);

        const metadataList = deviceMetadata.split(';');
        const deviceLastData = await catIpfs(ipfs, metadataList[1]);
        console.log("Device last data: ", deviceLastData);

        const deviceLastDataList = deviceLastData.split(';');

        if(deviceLastDataList[0] == device_requested)  {
            let hash = deviceLastDataList[5];
            let cont = 1;

            while(hash != "-1") {
                const ipfs_content = ipfs.cat(hash);
                const chunks = []
                for await (const chunk of ipfs_content) {
                    chunks.push(chunk)
                }

                const contentString = Buffer.concat(chunks).toString()
                console.log("%d IPFS Content: ", cont, contentString);

                const contentSplit = contentString.split(';');

                cont += 1;
                hash = contentSplit[5];
            }
            
            break;

        } else {
            console.log(`Got: ${deviceLastDataList[0]} --- Wanted: ${device_requested}`);
            console.log("Asking again...\n");
            previousCid = outputCid;
        }

        
    }

    
}
    
main();
