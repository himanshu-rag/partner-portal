const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/static', express.static(path.join(__dirname, 'public')));

// Fallback index
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/api/login', async (req, res) => {
    try {
        let { email } = req.body;
        if (!email) {
            return res.status(400).json({ detail: "Email is required" });
        }
        email = email.trim().toLowerCase();

        const table = process.env.DB_TABLE || 'backup_history';
        const [rows] = await db.query(`SELECT partner_email FROM ?? WHERE partner_email = ? LIMIT 1`, [table, email]);
        
        if (rows.length > 0) {
            return res.json({ status: "success", message: "Login successful", email: email });
        } else {
            return res.status(401).json({ detail: "Email not found or no data available for this partner." });
        }
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ detail: "Database error occurred." });
    }
});

app.get('/api/data', async (req, res) => {
    try {
        let { email } = req.query;
        if (!email) {
            return res.status(400).json({ detail: "Email parameter missing" });
        }
        email = email.trim().toLowerCase();

        const table = process.env.DB_TABLE || 'backup_history';
        const [rows] = await db.query(`SELECT * FROM ?? WHERE partner_email = ?`, [table, email]);
        
        const data = [];
        for (const row of rows) {
            const partnerName = String(row.partner || '');
            if (partnerName.match(/[\[\]\(\)\{\}]/)) {
                continue;
            }
            const formatDbDate = (d) => {
                if (!d) return null;
                const dateObj = new Date(d);
                if (isNaN(dateObj)) return String(d);
                // Adjust for timezone offset before converting to ISO
                const offset = dateObj.getTimezoneOffset();
                dateObj.setMinutes(dateObj.getMinutes() - offset);
                return dateObj.toISOString().split('T')[0];
            };

            data.push({
                customer_name: row.customer_name,
                customer_id: row.customer_id,
                backup_storage_gb: row.backup_storage_gb !== null ? String(row.backup_storage_gb) : null,
                activation_date: formatDbDate(row.activation_date),
                status: row.status,
                renewal_date: formatDbDate(row.renewal_date),
                size_increased: row.size_increased
            });
        }

        let allocatedStorage = null;
        try {
            const [storageRows] = await db.query(`SELECT item FROM storage_size WHERE email = ? LIMIT 1`, [email]);
            if (storageRows.length > 0) {
                allocatedStorage = storageRows[0].item;
            }
        } catch (e) {
            console.error("Storage fetch error:", e);
        }

        return res.json({ status: "success", data, allocated_storage: allocatedStorage });
    } catch (error) {
        console.error("Data fetch error:", error);
        return res.status(500).json({ detail: "Failed to retrieve data." });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
