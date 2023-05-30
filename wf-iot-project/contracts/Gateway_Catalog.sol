// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

//import "hardhat/console.sol";

contract GatewayCatalog {

    string public catalogIpnsKey; //lista de devices disponiveis
    string public outputIpnsKey; //saida
    string public privateKeyCid; //cid where is stored the private key for import the ipns

    function setCatalogIpnsKey(string memory _caralog_ipns_key) public {
        catalogIpnsKey = _caralog_ipns_key;
    }

    function setOuputIpnsKey(string memory _output_ipns_key) public {
        outputIpnsKey = _output_ipns_key;
    }

    function setPrivateKeyCid(string memory _sk_cid) public {
        privateKeyCid = _sk_cid;
    }
}