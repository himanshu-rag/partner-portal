const fs = require('fs');
const data = JSON.parse(fs.readFileSync('api_data.json'))['data'];

function parseEnd(val) {
    if (!val) return null;
    const d = new Date(val);
    d.setHours(23, 59, 59, 999);
    return d;
}

const actStartVal = "2025-01-01";
const actEndVal = "2025-12-31";
const actStart = new Date(actStartVal);
const actEnd = parseEnd(actEndVal);

let visible = 0;
let hidden = [];

data.forEach(item => {
    let matchesActDate = true;
    const activationCellStr = item.activation_date ? new Date(item.activation_date).toISOString().split('T')[0] : '-';
    const actDate = (activationCellStr && activationCellStr !== '-') ? new Date(activationCellStr) : null;
    
    if ((actStart || actEnd) && actDate) {
        if (actStart && actDate < actStart) matchesActDate = false;
        if (actEnd && actDate > actEnd) matchesActDate = false;
    } else if ((actStart || actEnd) && !actDate) {
        matchesActDate = false;
    }
    
    if (matchesActDate) {
        visible++;
    } else {
        hidden.push(item.customer_name);
    }
});

console.log(`Visible: ${visible}`);
console.log(`Hidden: ${hidden.join(', ')}`);
