
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
        console.log("Analyzing Gallery List Structure...");

        // Check strict selectors for the gallery
        const items = $('.gallery_list li');
        if (items.length > 0) {
            console.log(`\nFound ${items.length} items for selector '.gallery_list li'`);
            const first = items.first();
            console.log(`--- First Item HTML ---`);
            console.log(first.html());
            console.log(`--- Text Content ---`);
            console.log(first.text().trim());
        } else {
            console.log("No '.gallery_list li' found. Searching for 'cont_box'...");
            // Fallback search based on previous debug hints
            const boxes = $('.cont_box');
            if (boxes.length > 0) {
                console.log(`Found ${boxes.length} '.cont_box' elements.`);
                console.log(boxes.first().parent().html().substring(0, 500));
            }

            // General search for the date again to confirm context
            console.log("\nRe-searching for date context (2026-01-29):");
            $('*').each((i, el) => {
                if ($(el).text().includes('2026-01-29') && $(el).text().length < 100) {
                    console.log(`Matched element: <${el.name} class="${$(el).attr('class')}">`);
                    console.log(`Parent: <${$(el).parent()[0].name} class="${$(el).parent().attr('class')}">`);
                }
            });
        }

    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
