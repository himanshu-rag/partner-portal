import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request) {
    try {
        const body = await request.json();
        let { email, isAdminMode } = body;
        
        if (!email) {
            return NextResponse.json({ detail: "Email is required" }, { status: 400 });
        }
        
        email = email.trim().toLowerCase();
        
        if (isAdminMode) {
            if (email === 'sharma.himanshu@elcom.com') {
                return NextResponse.json({ status: "success", message: "Superadmin Login successful", email: email, role: 'superadmin' });
            } else {
                return NextResponse.json({ detail: "Invalid admin credentials." }, { status: 401 });
            }
        }

        const table = process.env.DB_TABLE || 'backup_history';
        const [rows] = await db.query(`SELECT partner_email FROM ?? WHERE partner_email = ? LIMIT 1`, [table, email]);
        
        if (rows.length > 0) {
            return NextResponse.json({ status: "success", message: "Login successful", email: email });
        } else {
            return NextResponse.json({ detail: "Email not found or no data available for this partner." }, { status: 401 });
        }
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ detail: "Database error occurred." }, { status: 500 });
    }
}
