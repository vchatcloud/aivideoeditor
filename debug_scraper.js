const cheerio = require('cheerio');
const url = "https://www.mfds.go.kr/brd/m_297/view.do?seq=4031&srchFr=&srchTo=&srchWord=&srchTp=&itm_seq_1=0&itm_seq_2=0&multi_itm_seq=0&company_cd=&company_nm=&page=1";

async function debug() {
    try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);

        console.log("--- DEBUG 2 START ---");

        // Search ENTIRE text for the filename
        if (html.includes('DSC_6781.JPG')) {
            console.log("String 'DSC_6781.JPG' FOUND in raw HTML.");

            // Try to find the element containing it
            const el = $('*:contains("DSC_6781.JPG")').last();
            if (el.length) {
                console.log("Container Tag:", el.get(0).tagName);
                console.log("Container Class:", el.attr('class'));
                console.log("Parent Class:", el.parent().attr('class'));
                console.log("Parent Tag:", el.parent().get(0).tagName);
            } else {
                console.log("Could not select element with cheerio :contains");
            }
        } else {
            console.log("String 'DSC_6781.JPG' NOT FOUND in raw HTML. (Dynamic Content?)");
        }

        // Print structure of .bv_contents siblings (attachments usually near content)
        console.log("\nSiblings of .bv_cont:");
        $('.bv_cont').siblings().each((i, el) => {
            console.log(`- ${el.tagName} .${$(el).attr('class')}`);
        });

        // Check for common file inputs
        const fileArea = $('.file_area, .add_file, .bv_file, .attach');
        console.log("\nPotential File Areas:", fileArea.length);
        if (fileArea.length) {
            console.log("File Area HTML:", fileArea.html().substring(0, 200));
        }

        console.log("--- DEBUG 2 END ---");

    } catch (e) { console.error(e); }
}

debug();
