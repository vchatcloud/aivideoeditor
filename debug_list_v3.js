
const https = require('https');
const cheerio = require('cheerio');

const url = "https://www.yeosu.go.kr/mayor/together/mayor_photo";

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        const $ = cheerio.load(data);
        console.log("Analyzing List Item HTML...");

        // Check strict selectors
        const selectors = ['.gallery_list li', '.board_list li', '.photo_list li', 'dl'];

        selectors.forEach(sel => {
            const items = $(sel);
            if (items.length > 0) {
                console.log(`\nFound ${items.length} items for selector '${sel}'`);
                // Dump the first item's FULL HTML
                console.log(`--- First Item HTML (${sel}) ---`);
                console.log(items.first().html());
                console.log(`-------------------------------`);

                // Text check
                console.log("Plain Text:", items.first().text().replace(/\s+/g, ' ').trim());
            }
        });
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
