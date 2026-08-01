const fs = require('fs');
const data = JSON.parse(fs.readFileSync('api_data.json'))['data'];

let unique = new Set();
data.forEach(item => {
    let cid = String(item.customer_id || '-').trim();
    if (unique.has(cid)) {
        console.log("DUPLICATE DOM ID:", cid, "for", item.customer_name);
    }
    unique.add(cid);
});
