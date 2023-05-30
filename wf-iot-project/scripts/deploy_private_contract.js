const Web3 = require('web3');
const fs = require('fs');
const solc = require('solc');
const path = require('path');

const web3 = new Web3('http://192.168.0.13:8545'); // Replace with your Geth RPC endpoint

const myContractPath = path.resolve(__dirname, '../contracts/', 'Gateway_Catalog.sol');
const sourceCode = fs.readFileSync(myContractPath, 'utf8');

// Compile the contract
const input = {
  language: 'Solidity',
  sources: {
    'Gateway_Catalog.sol': {
      content: sourceCode
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const catalogBytecode = output.contracts['Gateway_Catalog.sol']['Gateway_Catalog'].evm.bytecode.object;
const catalogAbi = output.contracts['Gateway_Catalog.sol']['Gateway_Catalog'].abi;

module.exports = {
  bytecode: catalogBytecode,
  abi: catalogAbi
};

const catalogContract = new web3.eth.Contract(catalogAbi);

const deploy = async () => {
    try {
      const accounts = await web3.eth.getAccounts();
      //console.log("Accounts: ", accounts);
      const deployAddress = '0x72Ba14Bf6447325F23F4F3648197237DbCc30959'; //node0 addr

      const contractInstance = await catalogContract.deploy({
          data: catalogBytecode
        })
        .send({
          from: deployAddress,
          gas: 10992921, // Adjust the gas value as neede
          gasPrice: '0',
          value: '0'
        });
  
      console.log('Contract deployed at address:', contractInstance.options.address);
    } catch (error) {
      console.error('Error deploying contract:', error);
    }
  };
  
  deploy();
  