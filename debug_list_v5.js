
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
        console.log("Analyzing Full List Item...");

        // Find the date element again to anchor
        let found = false;
        $('*').each((i, el) => {
            if (found) return;
            const txt = $(el).text().trim();
            // Look for the specific date seen in previous debug or any 2026-01 date
            if (txt === '2026-01-29' || (txt.includes('2026') && txt.match(/\d{4}-\d{1,2}-\d{1,2}/))) {
                if (el.tagName === 'dd') {
                    console.log("Found Date Element: <dd> containing " + txt);
                    const dl = $(el).parent();
                    const contBox = dl.parent();
                    const container = contBox.parent(); // Likely the LI

                    console.log(`Structure: ${container[0].name} > ${contBox[0].name} > ${dl[0].name} > dd`);
                    console.log("--- Full Container HTML ---");
                    console.log(container.html());
                    found = true;
                }
            }
        });

        if (!found) console.log("Could not locate a date element to pivot from.");

    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
