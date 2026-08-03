import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        let email = searchParams.get('email');
        
        if (!email || email.trim().toLowerCase() !== 'sharma.himanshu@elcom.com') {
            return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
        }

        const [rows] = await db.query(`SELECT partner_name, email, item FROM storage_size ORDER BY partner_name ASC`);
        
        return NextResponse.json({ status: "success", data: rows });
    } catch (error) {
        console.error("Partners fetch error:", error);
        return NextResponse.json({ detail: "Failed to retrieve partners." }, { status: 500 });
    }
}
