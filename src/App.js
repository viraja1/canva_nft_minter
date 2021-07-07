import React from 'react';
import Button from 'react-bootstrap-button-loader';
import {Navbar, Image} from 'react-bootstrap';
import Web3Modal from "web3modal";
import NFTMinter from './NFTMinter.json';
import Torus from "@toruslabs/torus-embed";
import queryString from 'query-string';
import ENS from "./ENS.json";
import ENSResolver from "./ENSResolver.json";

const Web3 = require('web3');
const torusResolver = new Torus();
const namehash = require('eth-ens-namehash');

let networkNameMapping = {
    "ropsten": {
        "host": "ropsten",
        "chainId": "3",
        "contractAddress": "0x33CFF3EAd2cBE63c6462F1cE6554f30D0AfEB8fE",
        "displayName": "ropsten",
        "ensAddress": "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
    },
    "Mumbai Matic-Testnet": {
        "host": "mumbai",
        "chainId": "80001",
        "contractAddress": "0x4EC59aC3f5f630DA8394A01be966c4a9ce4e54d9",
        "displayName": "matic mumbai"
    },
};
const defaultNetwork = "ropsten";
let allowedNetworks = ['3', '80001'];
const unsupportedNetworkCopy = 'App works only for Ropsten or Matic Mumbai Testnet';

const reverseLookupMapping = {
    "google": "google",
    "ethereum": "ethereum",
    "ens": "ens",
    "reddit": "reddit",
    "discord": "discord"
};


class App extends React.Component {
    state = {
        account: '',
        web3: '',
        tokenId: '',
        tokenURI: '',
        nftDetails: '',
        ownedTokens: [],
        otherAccountType: '',
        otherAccount: '',
        loadingMint: false,
        selectedNetwork: localStorage.getItem('selectedNetwork') || defaultNetwork
    };


    web3Modal = new Web3Modal({
        cacheProvider: true, // optional
        providerOptions: {
            torus: {
                package: Torus, // required
                options: {
                    networkParams: {
                        networkName: this.state.selectedNetwork,
                        host: networkNameMapping[this.state.selectedNetwork]["host"],
                        chainId: networkNameMapping[this.state.selectedNetwork]["chainId"]
                    }
                }
            }
        }
    });

    async fetchDetails() {
        let queries = queryString.parse(window.location.search);
        this.setState({tokenURI: queries.tokenURI});
        if (!this.state.web3) {
            return
        }
        let toAddr = this.state.account;
        const NFTMinterContract = new this.state.web3.eth.Contract(
            NFTMinter,
            networkNameMapping[this.state.selectedNetwork]["contractAddress"]
        );
        let ownedTokens = [];
        let incomingTokenTransferEvents = await NFTMinterContract.getPastEvents('Transfer', {
            filter: {'to': toAddr},
            fromBlock: 0,
            toBlock: 'latest'
        });
        for (let i = 0; i < incomingTokenTransferEvents.length; i++) {
            let event = incomingTokenTransferEvents[i];
            let tokenId = event.returnValues.tokenId;
            let owner = await NFTMinterContract.methods.ownerOf(tokenId).call();
            if (owner.toString().toLowerCase() === this.state.account.toLowerCase()) {
                let uri = await NFTMinterContract.methods.tokenURI(tokenId).call();
                let tokenURI = "https://ipfs.io/ipfs/" + uri.split("ipfs://")[1];
                let nftDetails = await fetch(tokenURI);
                nftDetails = await nftDetails.json();
                nftDetails["uri"] = uri;
                nftDetails["tokenId"] = tokenId;
                nftDetails["contractAddress"] = networkNameMapping[this.state.selectedNetwork]["contractAddress"];
                ownedTokens.push(nftDetails);
            }
        }
        this.setState({ownedTokens: ownedTokens});
        console.log(ownedTokens);
    }

    async login() {
        const provider = await this.web3Modal.connect();
        await this.subscribeProvider(provider);
        const web3 = new Web3(provider);
        const accounts = await web3.eth.getAccounts();
        const address = accounts[0];
        const networkId = await web3.eth.net.getId();
        console.log('Login network id: ' + networkId.toString() + ', type: ' + typeof networkId);
        if (allowedNetworks.indexOf(networkId.toString()) === -1) {
            alert(unsupportedNetworkCopy);
            return;
        }
        this.setState({
            web3: web3,
            account: address
        });
        await this.fetchDetails();
        console.log(this.web3Modal);
    }

    async logout() {
        this.resetApp();
    }

    async subscribeProvider(provider) {
        if (!provider.on) {
            return;
        }
        provider.on("close", () => this.resetApp());
        provider.on("accountsChanged", async (accounts) => {
            await this.setState({account: accounts[0]});
        });
        provider.on("chainChanged", async (chainId) => {
            const {web3} = this.state;
            if (!web3) {
                return
            }
            const networkId = await web3.eth.net.getId();
            console.log('chainChanged network id: ' + networkId.toString() + ', type: ' + typeof networkId);
            if (allowedNetworks.indexOf(networkId.toString()) === -1) {
                alert(unsupportedNetworkCopy);
                return;
            }
            await this.fetchDetails();
            console.log(this.web3Modal);
        });

        provider.on("networkChanged", async (networkId) => {
            console.log('networkChanged network id: ' + networkId.toString() + ', type: ' + typeof networkId);
            if (allowedNetworks.indexOf(networkId.toString()) === -1) {
                alert(unsupportedNetworkCopy);
                return;
            }
            await this.fetchDetails();
            console.log(this.web3Modal);
        });
    };

    async resetApp() {
        const {web3} = this.state;
        if (web3 && web3.currentProvider && web3.currentProvider.close) {
            await web3.currentProvider.close();
        }
        await this.web3Modal.clearCachedProvider();
        this.setState({account: '', web3: '', loadingMint: false, ownedTokens: [], tokenId: '', nftDetails: ''});
    };

    async componentWillMount() {
        if (this.web3Modal.cachedProvider) {
            this.login();
        }
    }

    updateOtherAccountType(value) {
        this.setState({otherAccountType: value});
    }

    updateOtherAccount(value) {
        this.setState({otherAccount: value});
    }

    updateTokenURI(value) {
        this.setState({tokenURI: value});
    }

    updateNetwork(value) {
        localStorage.setItem('selectedNetwork', value);
        this.setState({selectedNetwork: value});
        console.log('updateNetwork: ' + value);
        window.location.reload();
    }

    async mintNFT() {
        console.log('selectedNetwork: ' + this.state.selectedNetwork);
        if (!this.state.otherAccount || !this.state.otherAccountType || !this.state.tokenURI) {
            alert('Required details are missing');
            return
        }
        this.setState({loadingMint: true});
        let account;
        if (this.state.otherAccountType === 'ethereum') {
            account = this.state.otherAccount;
        } else if (this.state.otherAccountType === 'ens') {
            let hash = namehash.hash(this.state.otherAccount);
            let ensAddress = networkNameMapping[this.state.selectedNetwork]["ensAddress"];
            if(!ensAddress){
                alert('ENS is not supported for this network');
                this.setState({loadingMint: false});
                return
            }
            let ENSContract = new this.state.web3.eth.Contract(ENS, ensAddress);
            let resolver = await ENSContract.methods.resolver(hash).call();
            let ENSResolverContract = new this.state.web3.eth.Contract(ENSResolver, resolver);
            account = await ENSResolverContract.methods.addr(hash).call();
        } else {
            account = await torusResolver.getPublicAddress({
                verifier: this.state.otherAccountType,
                verifierId: this.state.otherAccount,
            });
        }
        console.log('otherAccount: ' + account);
        const NFTMinterContract = new this.state.web3.eth.Contract(
            NFTMinter,
            networkNameMapping[this.state.selectedNetwork]["contractAddress"]
        );
        const tokenId = await NFTMinterContract.methods.mintNFT(account, this.state.tokenURI)
            .send({from: this.state.account});
        let tokenURI = "https://ipfs.io/ipfs/" + this.state.tokenURI.split("ipfs://")[1];
        let nftDetails = await fetch(tokenURI);
        nftDetails = await nftDetails.json();
        this.setState({tokenId: tokenId, loadingMint: false, nftDetails: nftDetails});
        this.fetchDetails();
    }

    render() {
        if (this.state.account === '') {
            return (
                <div>
                    <Navbar className="navbar-custom" variant="dark">
                        <div style={{width: "90%"}}>
                            <Navbar.Brand href="/">
                                <b>Canva NFT Minter</b>
                            </Navbar.Brand>
                        </div>
                        <select className="form-control-sm"
                                style={{marginRight: "10px"}}
                                value={this.state.selectedNetwork}
                                onChange={e => this.updateNetwork(e.target.value)}>
                            {Object.keys(networkNameMapping).map((key, index) => (
                                <option value={key}
                                        key={"network-" + index}>{networkNameMapping[key]['displayName']}</option>
                            ))}
                        </select>
                        <Button variant="default btn-sm" onClick={this.login.bind(this)} style={{float: "right"}}>
                            Connect
                        </Button>
                    </Navbar>
                    <div className="panel-landing  h-100 d-flex" id="section-1">
                        <div className="container row" style={{marginTop: "50px"}}>
                            <div className="col l8 m12">

                                <p className="h2" style={{fontFamily: "Helvetica"}}>
                                    Canva NFT Minter
                                </p>
                                <p className="h6" style={{marginTop: "10px", fontFamily: "Helvetica"}}>
                                    Login to mint NFTs from your canva designs
                                </p>
                                <Image src="/logo.png"
                                       style={{height: "300px", width: "300px", marginTop: "10px"}} fluid/>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }
        return (
            <div className="App">
                <div>
                    <Navbar className="navbar-custom" variant="dark" style={{position: "sticky"}} fixed="top">
                        <div style={{width: "90%"}}>
                            <Navbar.Brand href="/">
                                <b>Canva NFT Minter</b>
                            </Navbar.Brand>
                        </div>
                        <select className="form-control-sm"
                                style={{marginRight: "10px"}}
                                value={this.state.selectedNetwork}
                                onChange={e => this.updateNetwork(e.target.value)}>
                            {Object.keys(networkNameMapping).map((key, index) => (
                                <option value={key}
                                        key={"network-" + index}>{networkNameMapping[key]['displayName']}</option>
                            ))}
                        </select>
                        <Button variant="default btn-sm" onClick={this.logout.bind(this)} style={{float: "right"}}>
                            Logout
                        </Button>
                    </Navbar>
                    <div style={{margin: "20px"}}>
                        <div>
                            <div style={{fontWeight: "900", fontFamily: "Helvetica"}}>
                                <p>Mint NFT</p>
                            </div>
                            <select className="form-control" style={{marginBottom: "10px"}}
                                    value={this.state.otherAccountType}
                                    onChange={e => this.updateOtherAccountType(e.target.value)}>
                                <option value="" disabled>Select account type</option>
                                {Object.keys(reverseLookupMapping).map((key, index) => (
                                    <option value={key}
                                            key={"network-" + index}>{reverseLookupMapping[key]}</option>
                                ))}
                            </select>
                            <input className="form-control" type="text" placeholder="Enter account value"
                                   value={this.state.otherAccount}
                                   onChange={e => this.updateOtherAccount(e.target.value)}
                                   style={{marginBottom: "10px"}}/>
                            <input className="form-control" type="text" placeholder="Token URI"
                                   value={this.state.tokenURI}
                                   onChange={e => this.updateTokenURI(e.target.value)}
                                   style={{marginBottom: "10px"}}/>
                            <Button variant="success btn" onClick={this.mintNFT.bind(this)}
                                    loading={this.state.loadingMint}
                            >Mint NFT</Button>
                            <br/>
                            {this.state.nftDetails &&
                            <Image src={"https://ipfs.io/ipfs/" + this.state.nftDetails.image.split("ipfs://")[1]}
                                   style={{height: "300px", width: "300px", marginTop: "10px"}} fluid/>
                            }
                            <br/>
                            {this.state.ownedTokens.length > 0 &&
                            <div style={{fontWeight: "900", fontFamily: "Helvetica"}}>
                                <p>Your collections</p>
                            </div>
                            }
                            <div>
                                {this.state.ownedTokens.map((n) => (

                                        <div key={n.tokenId} style={{
                                            border: "1px solid #1e1e1e", padding: "20px", borderRadius: "15px",
                                        }}>
                                            <div>
                                                <p><b>{n.name}</b></p>
                                                <Image src={"https://ipfs.io/ipfs/" + n.image.split("ipfs://")[1]}
                                                       style={{height: "300px", width: "300px", marginTop: "10px"}} fluid/>
                                                <p><b>Token Id: </b>{n.tokenId}</p>
                                                <p><b>Contract Address: </b>{n.contractAddress}</p>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }


}

export default App
