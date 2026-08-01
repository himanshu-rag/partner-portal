require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const db = require('../lib/db');
const creds = require('../credentials.json');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const normalizeString = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).trim().toLowerCase().replace(/\s+/g, ' ');
    return str || null;
};

const normalizeDate = (dateVal) => {
    if (dateVal === null || dateVal === undefined || String(dateVal).trim() === '') return null;
    const parts = String(dateVal).replace(/\//g, '-').split('-');
    if (parts.length === 3) {
        // DD-MM-YYYY to YYYY-MM-DD
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return String(dateVal);
};

const normalizeDecimal = (decVal) => {
    if (decVal === null || decVal === undefined || String(decVal).trim() === '') return null;
    const valStr = String(decVal).replace(/GB/g, '').replace(/TB/g, '').trim();
    const num = parseFloat(valStr);
    return isNaN(num) ? null : num.toFixed(2);
};

async function fetchWorksheet(doc, title) {
    const sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        console.warn(`Sheet ${title} not found.`);
        return [];
    }
    const rows = await sheet.getRows();
    const headers = sheet.headerValues;
    
    return rows.map(r => {
        let obj = {};
        for(let header of headers) {
            obj[header] = r.get(header);
        }
        return obj;
    });
}

async function runSync() {
    console.log("============================================================");
    console.log("STARTING CUSTOMER SYNC ETL PIPELINE (NODE V3)");
    console.log("============================================================");
    const startTime = Date.now();

    try {
        const serviceAccountAuth = new JWT({
            email: creds.client_email,
            key: creds.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        
        console.log("Fetching worksheets...");
        const backupRows = await fetchWorksheet(doc, 'Backup');
        const renewalRows = await fetchWorksheet(doc, 'Renewal Transactions');
        const portalRows = await fetchWorksheet(doc, 'Portal');

        if (backupRows.length === 0) {
            console.error("Backup sheet is empty. Aborting pipeline.");
            return;
        }

        console.log("Transforming portal records...");
        const portalLookup = {};
        const portalStorageRecords = [];
        
        for (const row of portalRows) {
            const partnerRaw = row['Partner'];
            const emailRaw = row['Email'];
            const itemRaw = row['Item'];
            
            const partnerNorm = normalizeString(partnerRaw);
            const email = emailRaw ? String(emailRaw).trim() : null;
            const item = itemRaw ? String(itemRaw).trim() : null;

            if (partnerNorm && email) {
                portalLookup[partnerNorm] = email;
            }

            if (partnerRaw || email || itemRaw) {
                portalStorageRecords.push({
                    partner_name: partnerRaw ? String(partnerRaw).trim() : null,
                    email: email,
                    item: item
                });
            }
        }

        console.log("Transforming renewal records...");
        const renewalRecords = renewalRows.map(r => ({
            id_norm: normalizeString(r['Customer ID']),
            name_norm: normalizeString(r['Customer Name']),
            status: r['Status'] ? String(r['Status']).trim() : null,
            renewal_date: normalizeDate(r['Activation Date']),
            size_increased: r['Item'] ? String(r['Item']).trim() : null
        }));

        console.log("Processing backup records...");
        const finalRecords = [];
        
        for (const row of backupRows) {
            const partner = row['Partner'] ? String(row['Partner']).trim() : null;
            const customerName = row['Customer Name'] ? String(row['Customer Name']).trim() : null;
            const customerId = row['Customer ID'] ? String(row['Customer ID']).trim() : null;

            if (!partner && !customerName && !customerId) continue;

            const backupStorage = normalizeDecimal(row['Backup Storage (GB)']);
            const activationDate = normalizeDate(row['Activation Date']);
            
            const partnerNorm = normalizeString(partner);
            const partnerEmail = portalLookup[partnerNorm] || null;

            const normId = normalizeString(customerId);
            const normName = normalizeString(customerName);

            const matchedRenewals = [];
            for (const r of renewalRecords) {
                if (normId && r.id_norm === normId) {
                    matchedRenewals.push(r);
                } else if (!normId && normName && r.name_norm === normName) {
                    matchedRenewals.push(r);
                } else if (normId && r.id_norm !== normId && normName && r.name_norm === normName) {
                    if (!r.id_norm) {
                        matchedRenewals.push(r);
                    }
                }
            }

            if (matchedRenewals.length > 0) {
                for (const renewal of matchedRenewals) {
                    let finalStatus = null;
                    let finalSizeIncreased = 0;

                    const rawStatus = renewal.status;
                    const rawItem = renewal.size_increased;

                    if (rawStatus) {
                        const statusLower = rawStatus.toLowerCase();
                        if (statusLower === 'won') {
                            finalStatus = 'won';
                            finalSizeIncreased = rawItem ? rawItem : 0;
                        } else if (statusLower === 'lost') {
                            finalStatus = 'lost';
                            finalSizeIncreased = 0;
                        } else {
                            finalStatus = rawStatus;
                            finalSizeIncreased = 0;
                        }
                    }

                    finalRecords.push({
                        partner,
                        partnerEmail,
                        customerName,
                        customerId,
                        backupStorage,
                        activationDate,
                        finalStatus,
                        renewalDate: renewal.renewal_date,
                        finalSizeIncreased
                    });
                }
            } else {
                finalRecords.push({
                    partner,
                    partnerEmail,
                    customerName,
                    customerId,
                    backupStorage,
                    activationDate,
                    finalStatus: null,
                    renewalDate: null,
                    finalSizeIncreased: 0
                });
            }
        }

        console.log(`Generated ${finalRecords.length} backup records, loading to database...`);
        
        let inserted = 0;
        const backupTable = process.env.DB_TABLE || 'backup_history';
        
        // Truncate before full load since we are syncing everything from sheets
        // This ensures no duplicates or stale data
        await db.query(`TRUNCATE TABLE ??`, [backupTable]);
        
        for (const r of finalRecords) {
            const query = `
                INSERT INTO ?? 
                (partner, partner_email, customer_name, customer_id, backup_storage_gb, activation_date, status, renewal_date, size_increased) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const values = [
                backupTable,
                r.partner, r.partnerEmail, r.customerName, r.customerId, r.backupStorage,
                r.activationDate, r.finalStatus, r.renewalDate, r.finalSizeIncreased
            ];
            
            try {
                await db.query(query, values);
                inserted++;
            } catch (err) {
                console.error("DB Insert Error on Backup History:", err);
            }
        }

        console.log(`Inserting ${portalStorageRecords.length} records into storage_size table...`);
        let storageInserted = 0;
        if (portalStorageRecords.length > 0) {
            await db.query(`TRUNCATE TABLE storage_size`);
            for (const r of portalStorageRecords) {
                try {
                    await db.query(
                        `INSERT INTO storage_size (partner_name, email, item) VALUES (?, ?, ?)`,
                        [r.partner_name, r.email, r.item]
                    );
                    storageInserted++;
                } catch (err) {
                    console.error("DB Insert Error on Storage Size:", err);
                }
            }
        }

        const duration = (Date.now() - startTime) / 1000;
        console.log("============================================================");
        console.log("PIPELINE EXECUTION SUMMARY");
        console.log(`Duration: ${duration.toFixed(2)} seconds`);
        console.log(`Backup Customers Processed: ${backupRows.length}`);
        console.log(`Total Records Generated: ${finalRecords.length}`);
        console.log(`Records Processed: ${inserted}`);
        console.log(`Portal Storage Records Inserted: ${storageInserted}`);
        console.log("============================================================");
        
        process.exit(0);

    } catch (err) {
        console.error("ETL Pipeline Failed:", err);
        process.exit(1);
    }
}

runSync();
