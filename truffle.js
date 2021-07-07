/*
 * This truffle script will deploy your smart contracts to the selected Chain.
 */
require('dotenv').config();
let HDWalletProvider = require("@truffle/hdwallet-provider");

//wallet private key
let privateKey = process.env.PRIVATE_KEY;

// Websocket urls
let ropsten = process.env.ROPSTEN;
let matic_mumbai = process.env.MATIC_MUMBAI;

module.exports = {
    contracts_build_directory: "./output",
    networks: {
        ganache: {
            host: "127.0.0.1",
            port: 8545,
            network_id: "*"
        },
        ropsten: {
            provider: () => new HDWalletProvider(privateKey, ropsten),
            network_id: "3"

        },
        matic_mumbai: {
            provider: () => new HDWalletProvider(privateKey, matic_mumbai),
            network_id: "80001",
            networkCheckTimeout: 1000000,
            timeoutBlocks: 200
        },
    },
    compilers: {
        solc: {
            version: "0.8.0"
        }
    }
};
