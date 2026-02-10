const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = 'C:\\Users\\veto\\.gemini\\antigravity\\brain\\fdb14dbd-8ea4-435d-a2d5-c5240be22cca';

async function captureScreenshots() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: { width: 1920, height: 1080 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        // 1. Load app
        console.log('1. Loading application...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        // Screenshot 1: Step 1 - Content Input (initial dashboard)
        console.log('2. Capturing Step 1: Content Input...');
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'ui_01_content_input.png'), fullPage: false });

        // 2. Click "Analyze Content" to trigger scraping and move to step 2
        console.log('3. Clicking Analyze Content...');
        const analyzeBtn = await page.$('button::-p-text(Analyze Content)');
        if (analyzeBtn) {
            await analyzeBtn.click();
            // Wait for scraping to complete (up to 15 seconds)
            await new Promise(r => setTimeout(r, 15000));
        }
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'ui_02_scraped_posts.png'), fullPage: false });

        // 3. Scroll down if there are posts
        await page.evaluate(() => window.scrollBy(0, 600));
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'ui_03_post_list.png'), fullPage: false });

        // 4. Try to load a saved project to show a more complete UI
        console.log('4. Trying to load a project...');
        // Click "Load" button in header
        const loadBtn = await page.$('button::-p-text(Load)');
        if (loadBtn) {
            await loadBtn.click();
            await new Promise(r => setTimeout(r, 3000));
            await page.screenshot({ path: path.join(OUTPUT_DIR, 'ui_04_project_gallery.png'), fullPage: false });

            // Click on the first project if available
            const firstProject = await page.$('[class*="cursor-pointer"][class*="border"]');
            if (firstProject) {
                await firstProject.click();
                await new Promise(r => setTimeout(r, 5000)); // Wait for project load
            }

            // Close modal if still open by pressing Escape
            await page.keyboard.press('Escape');
            await new Promise(r => setTimeout(r, 1000));
        }

        // 5. Now capture views of the loaded project (if any)
        console.log('5. Capturing loaded project views...');
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'ui_05_project_loaded.png'), fullPage: false });

        // Scroll down to scene editor area
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'ui_06_scene_editor.png'), fullPage: false });

        // Scroll further
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'ui_07_scene_details.png'), fullPage: false });

        // Scroll to preview area
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'ui_08_preview_area.png'), fullPage: false });

        // Scroll further to render settings
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'ui_09_render_settings.png'), fullPage: false });

        console.log('\n✅ All screenshots saved!');
        const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('ui_0'));
        files.forEach(f => {
            const stat = fs.statSync(path.join(OUTPUT_DIR, f));
            console.log(`  ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

captureScreenshots();
