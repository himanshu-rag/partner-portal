"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useTheme } from "next-themes";

function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    const isDark = theme === 'dark';
    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={"p-2.5 rounded-full border transition-all duration-300 hover:scale-110 shadow-sm " + (isDark ? 'bg-slate-800/50 border-slate-700/50 text-sky-400 hover:bg-slate-700/80 hover:shadow-sky-500/20' : 'bg-white/80 border-slate-200 text-amber-500 hover:bg-white hover:shadow-amber-500/20')}
            aria-label="Toggle Theme"
        >
            {isDark ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
        </button>
    );
}


export default function Dashboard() {
    const [data, setData] = useState([]);
    const [allocatedStorage, setAllocatedStorage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState("");
    const router = useRouter();

    // Superadmin states
    const [isSuperadmin, setIsSuperadmin] = useState(false);
    const [viewMode, setViewMode] = useState("dashboard"); // "directory" or "dashboard"
    const [partners, setPartners] = useState([]);
    const [partnerSearchQuery, setPartnerSearchQuery] = useState("");
    const [viewingPartnerEmail, setViewingPartnerEmail] = useState("");
    const [viewingPartnerName, setViewingPartnerName] = useState("");

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

    const fetchCustomerData = async (targetEmail, isMasquerade = false, partnerName = "") => {
        setLoading(true);
        try {
            const res = await fetch(`/api/data?email=${encodeURIComponent(targetEmail)}`);
            const result = await res.json();
            if (result.status === "success") {
                setData(result.data || []);
                setAllocatedStorage(result.allocated_storage);
                if (isMasquerade) {
                    setViewMode("dashboard");
                    setViewingPartnerEmail(targetEmail);
                    setViewingPartnerName(partnerName);
                } else {
                    setIsSuperadmin(result.is_superadmin || false);
                }
            } else {
                if (!isMasquerade) router.push("/");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const storedEmail = localStorage.getItem("partner_email");
        if (!storedEmail) {
            router.push("/");
            return;
        }
        setEmail(storedEmail);

        const fetchInitial = async () => {
            if (storedEmail.toLowerCase() === 'sharma.himanshu@elcom.com') {
                try {
                    const res = await fetch(`/api/partners?email=${encodeURIComponent(storedEmail)}`);
                    const result = await res.json();
                    if (result.status === "success") {
                        setPartners(result.data || []);
                        setIsSuperadmin(true);
                        setViewMode("directory");
                    } else {
                        router.push("/");
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            } else {
                await fetchCustomerData(storedEmail);
            }
        };

        fetchInitial();
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("partner_email");
        router.push("/");
    };

    const handleBackToDirectory = () => {
        setViewMode("directory");
        setViewingPartnerEmail("");
        setViewingPartnerName("");
    };

    const parseDateString = (str) => {
        if (!str) return null;
        const [year, month, day] = str.split('-');
        return new Date(year, month - 1, day);
    };

    const formatDateString = (date) => {
        if (!date) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        if (viewMode !== "dashboard") return [];

        let referenceDate = null;
        if (actEnd) referenceDate = new Date(actEnd + "T23:59:59");
        else if (renEnd) referenceDate = new Date(renEnd + "T23:59:59");
        else if (actStart) referenceDate = new Date(actStart + "T00:00:00");
        else if (renStart) referenceDate = new Date(renStart + "T00:00:00");

        let processed = data.map(row => {
            const rawStatus = row.status ? row.status.toLowerCase() : null;
            const renDateObj = row.renewal_date ? new Date(row.renewal_date) : null;
            let displayStatus = 'Activated';
            
            if (rawStatus === 'won') {
                displayStatus = 'Activated';
            } else if (rawStatus === 'lost') {
                if (referenceDate && renDateObj && referenceDate < renDateObj) {
                    displayStatus = 'Activated';
                } else {
                    displayStatus = 'Lost';
                }
            } else if (rawStatus === 'pending') {
                displayStatus = 'Pending';
            }

            return { ...row, displayStatus };
        });

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            processed = processed.filter(r => 
                (r.customer_name || "").toLowerCase().includes(term) ||
                (r.customer_id || "").toLowerCase().includes(term)
            );
        }

        if (statusFilter !== "all") {
            processed = processed.filter(r => r.displayStatus.toLowerCase() === statusFilter);
        }

        if (storageFilter !== "all") {
            processed = processed.filter(r => {
                const storage = parseFloat(r.backup_storage_gb) || 0;
                if (storageFilter === "small") return storage > 0 && storage < 10;
                if (storageFilter === "medium") return storage >= 10 && storage <= 50;
                if (storageFilter === "large") return storage > 50;
                return true;
            });
        }

        if (actStart || actEnd) {
            processed = processed.filter(r => {
                if (!r.activation_date) return false;
                const actDate = new Date(r.activation_date);
                if (actStart && actDate < new Date(actStart + "T00:00:00")) return false;
                if (actEnd && actDate > new Date(actEnd + "T23:59:59")) return false;
                return true;
            });
        }

        if (renStart || renEnd) {
            processed = processed.filter(r => {
                if (!r.renewal_date) return false;
                const renDate = new Date(r.renewal_date);
                if (renStart && renDate < new Date(renStart + "T00:00:00")) return false;
                if (renEnd && renDate > new Date(renEnd + "T23:59:59")) return false;
                return true;
            });
        }

        if (sortOrder === "asc") {
            processed.sort((a, b) => new Date(a.activation_date || 0) - new Date(b.activation_date || 0));
        } else if (sortOrder === "desc") {
            processed.sort((a, b) => new Date(b.activation_date || 0) - new Date(a.activation_date || 0));
        }

        return processed;
    }, [data, searchTerm, statusFilter, storageFilter, actStart, actEnd, renStart, renEnd, sortOrder, viewMode]);

    const metrics = useMemo(() => {
        if (viewMode !== "dashboard") return null;

        const activeRows = filteredData.filter(r => r.displayStatus === "Activated" || r.displayStatus === "Won");
        const activeData = data.filter(r => {
            const status = r.status ? String(r.status).toLowerCase() : 'activated';
            const baseIsIndirect = r.partner && String(r.partner).toLowerCase().includes('indirect');
            const renewedIsIndirect = r.renewed_partner ? String(r.renewed_partner).toLowerCase().includes('indirect') : baseIsIndirect;
            return status !== 'lost' && !renewedIsIndirect;
        });
        
        const usedStorage = data.reduce((acc, r) => {
            const status = r.status ? String(r.status).toLowerCase() : 'activated';
            
            const baseIsIndirect = r.partner && String(r.partner).toLowerCase().includes('indirect');
            const renewedIsIndirect = r.renewed_partner ? String(r.renewed_partner).toLowerCase().includes('indirect') : baseIsIndirect;
            
            const base = parseFloat(String(r.backup_storage_gb).replace(/[^\d.-]/g, '')) || 0;
            const extra = parseFloat(String(r.size_increased).replace(/[^\d.-]/g, '')) || 0;
            const accBase = baseIsIndirect ? 0 : base;
            const accExtra = renewedIsIndirect ? 0 : extra;
            
            return acc + accBase + accExtra;
        }, 0);

        let filteredStorage = 0;
        let filteredTitle = "Filtered Storage";
        
        const isActFilterActive = actStart || actEnd;
        const isRenFilterActive = renStart || renEnd;
        
        if (isActFilterActive) filteredTitle = "Filtered Base Storage";
        else if (isRenFilterActive) filteredTitle = "Filtered Renewed Size";

        filteredStorage = filteredData.reduce((acc, r) => {
            const baseIsIndirect = r.partner && String(r.partner).toLowerCase().includes('indirect');
            const renewedIsIndirect = r.renewed_partner ? String(r.renewed_partner).toLowerCase().includes('indirect') : baseIsIndirect;
            const base = parseFloat(String(r.backup_storage_gb).replace(/[^\d.-]/g, '')) || 0;
            const extra = parseFloat(String(r.size_increased).replace(/[^\d.-]/g, '')) || 0;
            const accBase = baseIsIndirect ? 0 : base;
            const accExtra = renewedIsIndirect ? 0 : extra;
            
            if (isActFilterActive) return acc + accBase;
            if (isRenFilterActive) return acc + accExtra;
            return acc + accBase + accExtra;
        }, 0);

        const totalValue = activeData.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0);

        const totalDirectCount = data.filter(r => {
            const baseIsIndirect = r.partner && String(r.partner).toLowerCase().includes('indirect');
            return !baseIsIndirect;
        }).length;
        const activeDirectCount = activeRows.filter(r => {
            const baseIsIndirect = r.partner && String(r.partner).toLowerCase().includes('indirect');
            return !baseIsIndirect;
        }).length;
        const isFiltered = data.length !== filteredData.length;

        let parsedAllocatedGB = null;
        let displayAllocated = "Unlimited";

        if (allocatedStorage) {
            const strOriginal = String(allocatedStorage);
            const numVal = parseFloat(strOriginal.replace(/[^\d.-]/g, ''));
            const strLower = strOriginal.toLowerCase();
            
            // Extract the provider (e.g. AWS, Wasabi) after TB or GB
            let provider = "";
            const providerMatch = strOriginal.match(/(?:tb|gb)\s+(.+)/i);
            if (providerMatch && providerMatch[1]) {
                provider = " " + providerMatch[1].trim();
            }

            if (!isNaN(numVal)) {
                if (strLower.includes('tb')) {
                    parsedAllocatedGB = numVal * 1024;
                } else {
                    parsedAllocatedGB = numVal;
                }
                displayAllocated = `${parsedAllocatedGB.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2})} GB${provider}`;
            }
        }

        let progressPercent = 100;
        if (parsedAllocatedGB && parsedAllocatedGB > 0) {
            progressPercent = Math.min((usedStorage / parsedAllocatedGB) * 100, 100);
        }

        return {
            totalCustomers: totalDirectCount,
            activeRenewals: activeDirectCount,
            usedStorage: usedStorage.toFixed(2),
            filteredStorage: filteredStorage.toFixed(2),
            filteredTitle,
            isFiltered,
            totalValue: totalValue.toLocaleString('en-US', { style: 'currency', currency: 'INR' }),
            displayAllocated,
            progressPercent
        };
    }, [filteredData, data, actStart, actEnd, renStart, renEnd, allocatedStorage, viewMode]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (viewMode === "directory") {
        const filteredPartners = partners.filter(p => {
            const query = partnerSearchQuery.toLowerCase();
            return (
                (p.partner_name && p.partner_name.toLowerCase().includes(query)) ||
                (p.email && p.email.toLowerCase().includes(query)) ||
                (p.item && p.item.toLowerCase().includes(query))
            );
        });

        return (
            <div className="min-h-screen flex transition-colors duration-500 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 relative overflow-hidden">
                {/* Background glow effects */}
                <div className="absolute top-0 left-[20%] w-[600px] h-[400px] bg-sky-600/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-0 right-[10%] w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[120px] pointer-events-none"></div>

                <main className="flex-1 max-w-[1400px] mx-auto px-6 py-10 relative z-10 w-full">
                    <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 pb-8 border-b border-white/5">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20 flex items-center justify-center border border-white/10">
                                <svg className="w-8 h-8 text-slate-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Partner <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 dark:sky-400 to-teal-500 dark:teal-400">Directory</span></h1>
                                <p className="text-slate-600 dark:text-slate-400 text-sm flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Superadmin Session: <span className="text-slate-700 dark:text-slate-300 font-medium">sharma.himanshu@elcom.com</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                            <button onClick={handleLogout} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-900 dark:text-white rounded-xl border border-white/10 transition-all duration-200 font-medium flex items-center gap-2 shadow-sm">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Log Out
                            </button>
                        </div>
                    </header>

                    <div className="flex flex-col md:flex-row gap-6 mb-8 items-start md:items-center justify-between">
                        <div className="bg-white dark:bg-slate-900/40 border border-white/5 px-6 py-4 rounded-2xl backdrop-blur-md shadow-lg flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-500 dark:sky-400">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Active Partners</p>
                                <p className="text-3xl font-bold text-slate-900 dark:text-white">{partners.length}</p>
                            </div>
                        </div>

                        <div className="relative w-full md:w-96">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search by partner name, email, or storage..."
                                value={partnerSearchQuery}
                                onChange={(e) => setPartnerSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700/50 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900/40 border border-white/5 rounded-2xl backdrop-blur-md shadow-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800/60 bg-slate-100 dark:bg-slate-800/30">
                                        <th className="px-6 py-5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Partner details</th>
                                        <th className="px-6 py-5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Contact Email</th>
                                        <th className="px-6 py-5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Storage Plan</th>
                                        <th className="px-6 py-5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">Access</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                                    {filteredPartners.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center justify-center">
                                                    <svg className="w-12 h-12 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <p className="text-slate-600 dark:text-slate-400 text-lg">No partners found matching "{partnerSearchQuery}"</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPartners.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-sm font-bold text-sky-500 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white dark:group-hover:text-white transition-colors shadow-sm">
                                                            {p.partner_name ? p.partner_name.charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{p.partner_name || 'Unknown Partner'}</p>
                                                            <p className="text-xs text-slate-500 mt-0.5">Partner ID: #{String(idx + 1).padStart(3, '0')}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                        </svg>
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">{p.email || '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-500/10 text-teal-500 dark:teal-400 border border-teal-500/20">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 dark:teal-400 mr-2 animate-pulse"></span>
                                                        {p.item || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <button 
                                                        onClick={() => fetchCustomerData(p.email, true, p.partner_name)}
                                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600/90 hover:bg-sky-500 text-slate-900 dark:text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-lg shadow-sky-500/20 opacity-90 group-hover:opacity-100 group-hover:-translate-y-0.5"
                                                    >
                                                        View Data
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex transition-colors duration-500 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-slate-50 dark:bg-slate-950/60 z-40 backdrop-blur-sm transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside className={`fixed top-0 right-0 h-screen w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 z-50 shadow-2xl transition-transform duration-300 flex flex-col ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-500 dark:sky-400 to-blue-500 dark:blue-400">Advanced Filters</h2>
                    <button onClick={() => setSidebarOpen(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-hide">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Status</label>
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                        >
                            <option value="all">All Statuses</option>
                            <option value="activated">Activated</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Storage Size</label>
                        <select 
                            value={storageFilter} 
                            onChange={(e) => setStorageFilter(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                        >
                            <option value="all">Any Size</option>
                            <option value="small">Small (&lt;10 GB)</option>
                            <option value="medium">Medium (10-50 GB)</option>
                            <option value="large">Large (&gt;50 GB)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Sort By Date</label>
                        <select 
                            value={sortOrder} 
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                        >
                            <option value="">Default (No Sort)</option>
                            <option value="asc">Oldest First</option>
                            <option value="desc">Newest First</option>
                        </select>
                    </div>

                    <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Activation Date Range</label>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 uppercase w-10 text-right">From</span>
                                <div className="relative flex-1 group">
                                    <div className="w-full bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-200 group-hover:border-sky-500 group-focus-within:ring-2 group-focus-within:ring-sky-500 transition-all flex items-center justify-between">
                                        <DatePicker 
                                            selected={parseDateString(actStart)}
                                            onChange={date => setActStart(formatDateString(date))}
                                            dateFormat="dd MMM yyyy"
                                            placeholderText="DD / MM / YYYY"
                                            showYearDropdown
                                            scrollableYearDropdown
                                            yearDropdownItemNumber={15}
                                            className="bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 w-full placeholder-slate-500 cursor-pointer"
                                        />
                                        <svg className="w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 uppercase w-10 text-right">To</span>
                                <div className="relative flex-1 group">
                                    <div className="w-full bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-200 group-hover:border-sky-500 group-focus-within:ring-2 group-focus-within:ring-sky-500 transition-all flex items-center justify-between">
                                        <DatePicker 
                                            selected={parseDateString(actEnd)}
                                            onChange={date => setActEnd(formatDateString(date))}
                                            dateFormat="dd MMM yyyy"
                                            placeholderText="DD / MM / YYYY"
                                            showYearDropdown
                                            scrollableYearDropdown
                                            yearDropdownItemNumber={15}
                                            className="bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 w-full placeholder-slate-500 cursor-pointer"
                                        />
                                        <svg className="w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Renewal Date Range</label>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 uppercase w-10 text-right">From</span>
                                <div className="relative flex-1 group">
                                    <div className="w-full bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-200 group-hover:border-sky-500 group-focus-within:ring-2 group-focus-within:ring-sky-500 transition-all flex items-center justify-between">
                                        <DatePicker 
                                            selected={parseDateString(renStart)}
                                            onChange={date => setRenStart(formatDateString(date))}
                                            dateFormat="dd MMM yyyy"
                                            placeholderText="DD / MM / YYYY"
                                            showYearDropdown
                                            scrollableYearDropdown
                                            yearDropdownItemNumber={15}
                                            className="bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 w-full placeholder-slate-500 cursor-pointer"
                                        />
                                        <svg className="w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 uppercase w-10 text-right">To</span>
                                <div className="relative flex-1 group">
                                    <div className="w-full bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-200 group-hover:border-sky-500 group-focus-within:ring-2 group-focus-within:ring-sky-500 transition-all flex items-center justify-between">
                                        <DatePicker 
                                            selected={parseDateString(renEnd)}
                                            onChange={date => setRenEnd(formatDateString(date))}
                                            dateFormat="dd MMM yyyy"
                                            placeholderText="DD / MM / YYYY"
                                            showYearDropdown
                                            scrollableYearDropdown
                                            yearDropdownItemNumber={15}
                                            className="bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 w-full placeholder-slate-500 cursor-pointer"
                                        />
                                        <svg className="w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                    <button 
                        onClick={() => {
                            setStatusFilter("all");
                            setStorageFilter("all");
                            setSortOrder("");
                            setActStart("");
                            setActEnd("");
                            setRenStart("");
                            setRenEnd("");
                            setSearchTerm("");
                        }}
                        className="w-full py-3.5 bg-white dark:bg-slate-900/50 hover:bg-rose-500/10 text-slate-700 dark:text-slate-300 hover:text-rose-400 border border-slate-300 dark:border-slate-700 hover:border-rose-500/30 rounded-xl transition-all duration-300 text-sm font-semibold flex items-center justify-center gap-2 group shadow-sm hover:shadow-rose-500/10"
                    >
                        <svg className="w-4 h-4 transition-transform group-hover:rotate-180 duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear All Filters
                    </button>
                </div>
            </aside>

            <main className="flex-1 max-w-7xl mx-auto px-4 py-8 relative animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
                {isSuperadmin && viewingPartnerEmail && (
                    <div className="mb-8">
                        <button 
                            onClick={handleBackToDirectory}
                            className="inline-flex items-center px-4 py-2 bg-white dark:bg-slate-900/50 hover:bg-sky-500/10 text-slate-700 dark:text-slate-300 hover:text-sky-500 dark:sky-400 border border-slate-200 dark:border-slate-800 hover:border-sky-500/30 rounded-xl font-medium transition-all duration-300 shadow-sm group"
                        >
                            <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Partner Directory
                        </button>
                    </div>
                )}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 pb-6 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-500 dark:sky-400 to-teal-500 dark:teal-400 mb-2">
                            {isSuperadmin && viewingPartnerName ? `${viewingPartnerName} Dashboard` : 'Overview'}
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400 text-lg">
                            {isSuperadmin && viewingPartnerEmail ? viewingPartnerEmail : email}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <input 
                                type="text"
                                placeholder="Search customers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-64 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/80 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-slate-900 dark:text-white placeholder-slate-500 transition-all duration-300 shadow-inner group-hover:bg-white dark:bg-slate-900"
                            />
                            <svg className="w-4 h-4 absolute left-4 top-3 text-slate-500 group-focus-within:text-sky-500 dark:sky-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <ThemeToggle />
                        {!isSuperadmin && (
                            <button onClick={handleLogout} className="px-6 py-2.5 bg-white dark:bg-slate-900/50 hover:bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 hover:border-slate-500 transition-all duration-300 font-medium flex items-center gap-2 shadow-sm hover:shadow-md">
                                <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Log Out
                            </button>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white/5 border border-white/5 p-6 rounded-2xl backdrop-blur-sm shadow-xl relative overflow-hidden group hover:scale-[1.02] hover:shadow-2xl hover:shadow-sky-500/10 transition-all duration-300 cursor-default">
                        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 group-hover:text-indigo-300 transition-colors">Total Customers</p>
                        <p className="text-4xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-50 transition-colors">{metrics?.totalCustomers}</p>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-6 rounded-2xl backdrop-blur-sm shadow-xl relative overflow-hidden group hover:scale-[1.02] hover:shadow-2xl hover:shadow-teal-500/10 transition-all duration-300 cursor-default">
                        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="flex justify-between items-end mb-2">
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1 group-hover:text-emerald-300 transition-colors">Storage Utilization <span className="text-xs text-slate-500 cursor-help" title="Used Storage vs Total Allocated Storage">ⓘ</span></p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-50 transition-colors">{metrics?.usedStorage} GB / {metrics?.displayAllocated}</p>
                        </div>
                        <div className="w-full bg-white dark:bg-slate-900/80 rounded-full h-3 mt-4 border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="bg-gradient-to-r from-teal-500 dark:teal-400 to-teal-600 h-3 rounded-full shadow-lg shadow-teal-500/50 transition-all duration-1000 ease-out" style={{ width: `${metrics?.progressPercent}%` }}></div>
                        </div>
                    </div>
                    {metrics?.isFiltered && (
                        <div className="bg-white/5 border border-fuchsia-500/30 p-6 rounded-2xl backdrop-blur-sm shadow-xl shadow-fuchsia-500/10 relative overflow-hidden group hover:scale-[1.02] hover:shadow-2xl hover:shadow-fuchsia-500/20 transition-all duration-300 cursor-default animate-in zoom-in-95 duration-300">
                            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <p className="text-sm font-medium text-fuchsia-400 mb-2 truncate group-hover:text-fuchsia-300 transition-colors" title={`Filtered: ${metrics.filteredTitle}`}>{metrics.filteredTitle}</p>
                            <p className="text-3xl font-bold text-slate-900 dark:text-white">{metrics.filteredStorage} <span className="text-lg text-fuchsia-400/70">GB</span></p>
                        </div>
                    )}
                    <div className="bg-white/5 border border-white/5 p-6 rounded-2xl backdrop-blur-sm shadow-xl relative overflow-hidden group hover:scale-[1.02] hover:shadow-2xl hover:shadow-rose-500/10 transition-all duration-300 cursor-default">
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 group-hover:text-rose-300 transition-colors">Active & Renewed Customers</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white group-hover:text-rose-50 transition-colors">{metrics?.activeRenewals}</p>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-2xl backdrop-blur-sm shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">S.No.</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Customer Name</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Storage (GB)</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Activation Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Renewal Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Renewed Size</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                                            No customers found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.filter(r => {
                                        const baseIsIndirect = r.partner && String(r.partner).toLowerCase().includes('indirect');
                                        return !baseIsIndirect;
                                    }).map((row, idx) => {
                                        const baseIsIndirect = row.partner && String(row.partner).toLowerCase().includes('indirect');
                                        return (
                                        <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{idx + 1}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-slate-200">{row.customer_name || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.customer_id || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{baseIsIndirect ? '0' : (row.backup_storage_gb || '0')}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.activation_date || '-'}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                    (row.displayStatus === 'Activated' || row.displayStatus === 'Won') ? 'bg-teal-500/10 text-teal-500 dark:text-teal-400 border-teal-500/20' :
                                                    row.displayStatus === 'Lost' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                }`}>
                                                    {row.displayStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.renewal_date || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{row.size_increased || '-'}</td>
                                        </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <button 
                    onClick={() => setSidebarOpen(true)}
                    className="fixed bottom-10 right-10 z-40 px-6 py-4 bg-sky-600 hover:bg-sky-500 text-slate-900 dark:text-white rounded-full shadow-2xl shadow-sky-600/30 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-3 group border border-sky-500/30"
                    aria-label="Open Filters"
                >
                    <svg className="w-6 h-6 transition-transform group-hover:rotate-12 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span className="font-semibold tracking-wide">Filters</span>
                    
                    {(statusFilter !== "all" || storageFilter !== "all" || actStart || renStart) && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-sky-600"></span>
                        </span>
                    )}
                </button>
            </main>
        </div>
    );
}
