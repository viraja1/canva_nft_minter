const express = require('express');
const jimp = require('jimp');
const path = require('path');
const url = require('url');
const nft = require('nft.storage');

const app = express();

app.use(express.json());
app.use(express.static('public'));

app.get('/', (request, response) => {
    response.send('API homepage');
});

app.post('/publish/resources/upload', async (request, response) => {
    // Download the image
    console.log(request.body.assets);
    const [asset] = request.body.assets;
    const image = await jimp.read(asset.url);
    let mimeType = 'image/jpeg';
    if(asset.type === 'PNG'){
        mimeType = 'image/png';
    }

    // Write the file to disk
    // const filePath = path.join(__dirname, 'public', asset.name);
    // await image.write(filePath);
    const apiKey = process.env.TOKEN;
    const client = new nft.NFTStorage({ token: apiKey });
    const buffer = await image.getBufferAsync(mimeType);
    const metadata = await client.store({
        name: request.body.message,
        description: request.body.message,
        image: new nft.File([buffer], asset.name, { type: mimeType })
    });

    // Respond to the request
    response.send({
        type: 'SUCCESS',
        url: "https://canva-nft-minter.netlify.app/?tokenURI=" + metadata.url,
    });
});

app.listen(process.env.PORT || 3000);