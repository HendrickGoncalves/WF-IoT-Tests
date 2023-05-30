// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

//import "hardhat/console.sol";

contract Catalog {

    string public catalogIpnsKey; //ipns public key
    string public farmMenuListIpnsKey; //list of available farms
    string public farmMenuListSecretKey; //secret key CID to store data on farmMenuListIpnsKey

    event FarmCreated(address farmScAddr);

    //deploy a new farm
    function createFarm(string memory _farmId, string memory _ipns_pk) public returns (address){
        address farmAddr = address(new FarmMenu(_farmId, _ipns_pk));
        emit FarmCreated(farmAddr);
        
        return farmAddr;
    }

    function setIpnsKey(string memory _ipns_key) public { //set ipns public key
        catalogIpnsKey = _ipns_key;
    }

    function setFarmMenuListIpnsKey(string memory _farm_menu_ipns_key) public { 
        farmMenuListIpnsKey = _farm_menu_ipns_key;
    }

    function setFarmMenuListSecretKey(string memory _farm_secret_key) public { 
        farmMenuListSecretKey = _farm_secret_key;
    }
     
}

contract FarmMenu {
    string public farmId;
    string public outputIpnsPk; //public key for output to be sold

    event IpnsUpdated(string outputIpnsPk);
    event DataDeviceRequested(string deviceId);
    event FarmDataRequested();
    
    constructor(string memory _farmId, string memory _output_ipns_pk) {
        farmId = _farmId;
        outputIpnsPk = _output_ipns_pk;
    }
    

    function updateIpnsPk(string memory _output_ipns_pk) public {
        outputIpnsPk = _output_ipns_pk;
        emit IpnsUpdated(_output_ipns_pk);
    }
    

    function requestDeviceData(string memory _device_id) public returns (string memory) {
        emit DataDeviceRequested(_device_id);
        return ("Device data requested! Check the IPNS key");
    }

    //request all farm data
    function requestFarmData() public returns (string memory) {
        emit FarmDataRequested();
        
        return ("Farm data requested! Check the IPNS key");
    }
}
