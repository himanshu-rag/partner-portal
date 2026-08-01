"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
    const [data, setData] = useState([]);
    const [allocatedStorage, setAllocatedStorage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState("");
    const router = useRouter();

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [storageFilter, setStorageFilter] = useState("all");
    const [actStart, setActStart] = useState("");
    const [actEnd, setActEnd] = useState("");
    const [renStart, setRenStart] = useState("");
    const [renEnd, setRenEnd] = useState("");
    
    // Sort
    const [sortOrder, setSortOrder] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const storedEmail = localStorage.getItem("partner_email");
        if (!storedEmail) {
            router.push("/");
            return;
        }
        setEmail(storedEmail);

        const fetchData = async () => {
            try {
                const res = await fetch(`/api/data?email=${encodeURIComponent(storedEmail)}`);
                const result = await res.json();
                if (result.status === "success") {
                    setData(result.data || []);
                    setAllocatedStorage(result.allocated_storage);
                } else {
                    router.push("/");
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("partner_email");
        router.push("/");
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        let referenceDate = null;
        if (actEnd) referenceDate = new Date(actEnd + "T23:59:59");
        else if (renEnd) referenceDate = new Date(renEnd + "T23:59:59");
        else if (actStart) referenceDate = new Date(actStart + "T00:00:00");
        else if (renStart) referenceDate = new Date(renStart + "T00:00:00");

        let processed = data.map(row => {
            const rawStatus = row.status || 'won';
            const renDateObj = row.renewal_date ? new Date(row.renewal_date) : null;
            let displayStatus = 'Active';
            
            if (rawStatus === 'lost' || rawStatus === 'pending') {
                if (referenceDate && renDateObj && referenceDate < renDateObj) {
                    displayStatus = 'Active';
                } else {
                    displayStatus = rawStatus === 'lost' ? 'Lost' : 'Pending';
                }
            }

            return { ...row, displayStatus };
        });

        // Search Filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            processed = processed.filter(r => 
                (r.customer_name || "").toLowerCase().includes(term) ||
                (r.customer_id || "").toLowerCase().includes(term)
            );
        }

        // Status Filter
        if (statusFilter !== "all") {
            processed = processed.filter(r => r.displayStatus.toLowerCase() === statusFilter);
        }

        // Storage Filter
        if (storageFilter !== "all") {
            processed = processed.filter(r => {
                const storage = parseFloat(r.backup_storage_gb) || 0;
                if (storageFilter === "small") return storage > 0 && storage < 10;
                if (storageFilter === "medium") return storage >= 10 && storage <= 50;
                if (storageFilter === "large") return storage > 50;
                return true;
            });
        }

        // Activation Date Filter
        if (actStart || actEnd) {
            processed = processed.filter(r => {
                if (!r.activation_date) return false;
                const actDate = new Date(r.activation_date);
                if (actStart && actDate < new Date(actStart + "T00:00:00")) return false;
                if (actEnd && actDate > new Date(actEnd + "T23:59:59")) return false;
                return true;
            });
        }

        // Renewal Date Filter
        if (renStart || renEnd) {
            processed = processed.filter(r => {
                if (!r.renewal_date) return false;
                const renDate = new Date(r.renewal_date);
                if (renStart && renDate < new Date(renStart + "T00:00:00")) return false;
                if (renEnd && renDate > new Date(renEnd + "T23:59:59")) return false;
                return true;
            });
        }

        // Sorting
        if (sortOrder === "asc") {
            processed.sort((a, b) => new Date(a.activation_date || 0) - new Date(b.activation_date || 0));
        } else if (sortOrder === "desc") {
            processed.sort((a, b) => new Date(b.activation_date || 0) - new Date(a.activation_date || 0));
        }

        return processed;
    }, [data, searchTerm, statusFilter, storageFilter, actStart, actEnd, renStart, renEnd, sortOrder]);

    const metrics = useMemo(() => {
        const activeRows = filteredData.filter(r => r.displayStatus === "Active");
        const activeData = data.filter(r => {
            const status = r.status ? String(r.status).toLowerCase() : 'active';
            const isIndirect = r.partner && String(r.partner).toLowerCase().includes('indirect');
            return status !== 'lost' && !isIndirect;
        });
        
        // Total Absolute Storage (Used Storage) -> All active rows, base + extra
        const usedStorage = activeData.reduce((acc, r) => {
            const base = parseFloat(String(r.backup_storage_gb).replace(/[^\d.-]/g, '')) || 0;
            const extra = parseFloat(String(r.size_increased).replace(/[^\d.-]/g, '')) || 0;
            return acc + base + extra;
        }, 0);

        // Filtered Storage
        let filteredStorage = 0;
        let filteredTitle = "Filtered Storage";
        
        const isActFilterActive = actStart || actEnd;
        const isRenFilterActive = renStart || renEnd;
        
        if (isActFilterActive) filteredTitle = "Filtered Base Storage";
        else if (isRenFilterActive) filteredTitle = "Filtered Renewed Size";

        filteredStorage = filteredData.reduce((acc, r) => {
            const base = parseFloat(String(r.backup_storage_gb).replace(/[^\d.-]/g, '')) || 0;
            const extra = parseFloat(String(r.size_increased).replace(/[^\d.-]/g, '')) || 0;
            const isIndirect = r.partner && String(r.partner).toLowerCase().includes('indirect');
            
            if (isIndirect) return acc; // Completely ignore indirect from filtered storage too
            
            if (isActFilterActive) return acc + base;
            if (isRenFilterActive) return acc + extra;
            return acc + base + extra;
        }, 0);

        const activeDirectCount = activeRows.filter(r => !(r.partner && String(r.partner).toLowerCase().includes('indirect'))).length;

        return {
            totalCustomers: activeDirectCount,
            activeRenewals: activeDirectCount,
            usedStorage: usedStorage.toFixed(2),
            filteredStorage: filteredStorage.toFixed(2),
            filteredTitle,
            isFiltered
        };
    }, [filteredData, data, actStart, actEnd, renStart, renEnd]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-slate-950 text-slate-200">
            {/* Sidebar Overlay */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-slate-950/60 z-40 backdrop-blur-sm transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar Slide-over Panel */}
            <aside className={`fixed top-0 right-0 h-screen w-80 bg-slate-900 border-l border-slate-800 p-6 z-50 shadow-2xl transition-transform duration-300 flex flex-col ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Advanced Filters</h2>
                    <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-hide">
                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Status</label>
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="lost">Lost</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>

                    {/* Storage */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Storage Size</label>
                        <select 
                            value={storageFilter} 
                            onChange={(e) => setStorageFilter(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="all">Any Size</option>
                            <option value="small">Small (&lt;10 GB)</option>
                            <option value="medium">Medium (10-50 GB)</option>
                            <option value="large">Large (&gt;50 GB)</option>
                        </select>
                    </div>

                    {/* Sort */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Sort By Date</label>
                        <select 
                            value={sortOrder} 
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="">Default (No Sort)</option>
                            <option value="asc">Oldest to Newest</option>
                            <option value="desc">Newest to Oldest</option>
                        </select>
                    </div>

                    {/* Activation Dates */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-400">Activation Date</label>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={actStart} onChange={(e) => { setActStart(e.target.value); setRenStart(""); setRenEnd(""); }} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-xs text-slate-300" />
                            <input type="date" value={actEnd} onChange={(e) => { setActEnd(e.target.value); setRenStart(""); setRenEnd(""); }} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-xs text-slate-300" />
                        </div>
                    </div>

                    {/* Renewal Dates */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-400">Renewal Date</label>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={renStart} onChange={(e) => { setRenStart(e.target.value); setActStart(""); setActEnd(""); }} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-xs text-slate-300" />
                            <input type="date" value={renEnd} onChange={(e) => { setRenEnd(e.target.value); setActStart(""); setActEnd(""); }} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-xs text-slate-300" />
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-800">
                    <button 
                        onClick={() => {
                            setStatusFilter("all"); setStorageFilter("all"); setSortOrder("");
                            setActStart(""); setActEnd(""); setRenStart(""); setRenEnd(""); setSearchTerm("");
                        }}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm font-medium"
                    >
                        Clear All Filters
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 p-4 md:p-8 lg:p-12 overflow-y-auto">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Overview</h1>
                        <p className="text-slate-400 mt-1">{email}</p>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto ml-12 md:ml-0">
                        <div className="relative w-full sm:w-64">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input 
                                type="text" 
                                placeholder="Search customers..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                            />
                        </div>
                        <button onClick={handleLogout} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors shrink-0">
                            Log Out
                        </button>
                    </div>
                </header>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <div className="bg-white/5 border border-white/5 p-6 rounded-2xl backdrop-blur-sm shadow-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <p className="text-sm font-medium text-slate-400 mb-2">Total Customers</p>
                        <p className="text-3xl font-bold text-white">{metrics.totalCustomers}</p>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-6 rounded-2xl backdrop-blur-sm shadow-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <p className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-1">Total Storage <span className="text-xs text-slate-500 cursor-help" title="Allocated Storage from DB">ⓘ</span></p>
                        <p className="text-3xl font-bold text-white">{allocatedStorage || "N/A"}</p>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-6 rounded-2xl backdrop-blur-sm shadow-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <p className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-1">Used Storage <span className="text-xs text-slate-500 cursor-help" title="Calculated from Base Storage + Renewed Size across all customers">ⓘ</span></p>
                        <p className="text-3xl font-bold text-white">{metrics.usedStorage} GB</p>
                    </div>
                    {metrics.isFiltered && (
                        <div className="bg-white/5 border border-white/5 p-6 rounded-2xl backdrop-blur-sm shadow-xl relative overflow-hidden group animate-in fade-in zoom-in duration-300">
                            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <p className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-1">{metrics.filteredTitle} <span className="text-xs text-slate-500 cursor-help" title="Calculated based on active date filters">ⓘ</span></p>
                            <p className="text-3xl font-bold text-white">{metrics.filteredStorage} GB</p>
                        </div>
                    )}
                    <div className="bg-white/5 border border-white/5 p-6 rounded-2xl backdrop-blur-sm shadow-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <p className="text-sm font-medium text-slate-400 mb-2">Active Renewals</p>
                        <p className="text-3xl font-bold text-white">{metrics.activeRenewals}</p>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white/5 border border-white/5 rounded-2xl backdrop-blur-sm shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/50">
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer Name</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Storage (GB)</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Activation Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Renewal Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Renewed Size</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                            No customers found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.filter(r => !(r.partner && String(r.partner).toLowerCase().includes('indirect'))).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-slate-200">{row.customer_name || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-400">{row.customer_id || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-300">{row.backup_storage_gb || '0'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-400">{row.activation_date || '-'}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                    row.displayStatus === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                    row.displayStatus === 'Lost' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                }`}>
                                                    {row.displayStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-400">{row.renewal_date || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-300">{row.size_increased || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Floating Filter Button */}
                <button 
                    onClick={() => setSidebarOpen(true)}
                    className="fixed bottom-8 right-8 z-40 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl shadow-indigo-600/30 transition-transform hover:scale-110 flex items-center justify-center group border border-indigo-500/30"
                    aria-label="Open Filters"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    {(statusFilter !== "all" || storageFilter !== "all" || actStart || renStart) && (
                        <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full border-2 border-indigo-600"></span>
                    )}
                </button>
            </main>
        </div>
    );
}
