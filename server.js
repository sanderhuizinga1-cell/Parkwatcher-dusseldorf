const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('public'));

let cachedData = null;
let lastScrapeTime = null;
let isScraping = false;

async function scrapeParkingData() {
    if (isScraping) return;
    isScraping = true;
    console.log("Scraping parking data...");
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto('https://www.dus.com/en/parking/information', { waitUntil: 'networkidle2' });
        
        const data = await page.evaluate(() => {
            const rows = document.querySelectorAll('.utilization-table__section');
            const result = [];
            
            rows.forEach(row => {
                const nameEl = row.querySelector('a');
                if (!nameEl) return;
                
                const typeEl = row.querySelector('span');
                const name = nameEl.innerText.trim();
                const type = typeEl ? typeEl.innerText.trim() : '';
                
                // Get all divs inside utilization-table__child
                const children = row.querySelectorAll('.utilization-table__child > div');
                if (children.length >= 3) {
                    const total = parseInt(children[1].innerText.trim(), 10);
                    const free = parseInt(children[2].innerText.trim(), 10);
                    
                    result.push({
                        id: name,
                        name: `${name} ${type}`,
                        total: total,
                        free: free,
                        isFull: free === 0,
                        percentFull: total > 0 ? Math.round(((total - free) / total) * 100) : 0
                    });
                }
            });
            return result;
        });
        
        cachedData = data;
        lastScrapeTime = new Date().toISOString();
        console.log("Scrape successful. Found " + data.length + " parking zones.");
    } catch (err) {
        console.error("Error scraping:", err);
    } finally {
        if (browser) {
            await browser.close();
        }
        isScraping = false;
    }
}

// Scrape on startup and then every 5 minutes
scrapeParkingData();
setInterval(scrapeParkingData, 5 * 60 * 1000);

app.get('/api/parking', async (req, res) => {
    // If we don't have data yet, try to wait or force a scrape
    if (!cachedData && !isScraping) {
        await scrapeParkingData();
    }
    
    if (!cachedData) {
        return res.status(503).json({ error: "Data not available yet, please try again." });
    }
    
    res.json({
        lastUpdated: lastScrapeTime,
        data: cachedData
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});
