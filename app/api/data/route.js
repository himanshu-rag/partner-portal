import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        let email = searchParams.get('email');
        
        if (!email) {
            return NextResponse.json({ detail: "Email parameter missing" }, { status: 400 });
        }
        email = email.trim().toLowerCase();

        const table = process.env.DB_TABLE || 'backup_history';
        const isSuperadmin = email === 'sharma.himanshu@elcom.com';
        
        let rows = [];
        if (isSuperadmin) {
            [rows] = await db.query(`SELECT * FROM ??`, [table]);
        } else {
            [rows] = await db.query(`SELECT * FROM ?? WHERE partner_email = ?`, [table, email]);
        }
        
        const data = [];
        for (const row of rows) {
            const partnerName = String(row.partner || '');
            
            const formatDbDate = (d) => {
                if (!d) return null;
                const dateObj = new Date(d);
                if (isNaN(dateObj)) return String(d);
                const offset = dateObj.getTimezoneOffset();
                dateObj.setMinutes(dateObj.getMinutes() - offset);
                return dateObj.toISOString().split('T')[0];
            };

            data.push({
                partner_email: row.partner_email,
                partner: partnerName,
                customer_name: row.customer_name,
                customer_id: row.customer_id,
                backup_storage_gb: row.backup_storage_gb !== null ? String(row.backup_storage_gb) : null,
                activation_date: formatDbDate(row.activation_date),
                status: row.status,
                renewal_date: formatDbDate(row.renewal_date),
                size_increased: row.size_increased,
                value: row.value !== null ? parseFloat(row.value) : null,
                renewal_cycle_months: row.renewal_cycle_months,
                renewed_partner: row.renewed_partner
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

        return NextResponse.json({ 
            status: "success", 
            data, 
            allocated_storage: allocatedStorage,
            is_superadmin: isSuperadmin 
        });
    } catch (error) {
        console.error("Data fetch error:", error);
        return NextResponse.json({ detail: "Failed to retrieve data." }, { status: 500 });
    }
}
