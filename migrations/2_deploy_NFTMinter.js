const NFTMinter = artifacts.require("NFTMinter");

module.exports = function(deployer) {
    return deployer.then(() => deployer.deploy(NFTMinter));
};