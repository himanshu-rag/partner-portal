"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
            className={"absolute top-6 right-6 z-50 p-2.5 rounded-full border transition-all duration-300 hover:scale-110 shadow-sm " + (isDark ? 'bg-slate-800/50 border-slate-700/50 text-sky-400 hover:bg-slate-700/80 hover:shadow-sky-500/20' : 'bg-white/80 border-slate-200 text-amber-500 hover:bg-white hover:shadow-amber-500/20')}
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

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isAdminMode, setIsAdminMode] = useState(false);
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, isAdminMode })
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem("partner_email", data.email);
                router.push("/dashboard");
            } else {
                setError(data.detail || "Login failed");
            }
        } catch (err) {
            setError("Network error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans selection:bg-sky-500/30 transition-colors duration-500">
            <ThemeToggle />
            
            {/* Left Graphic Pane */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-white dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800/50 flex-col justify-between p-12 transition-colors duration-500">
                <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full bg-sky-400/20 dark:bg-sky-400/10 blur-[120px] pointer-events-none mix-blend-screen" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-blue-400/20 dark:bg-blue-400/10 blur-[120px] pointer-events-none mix-blend-screen" />
                <div className="absolute top-[40%] right-[20%] w-[50%] h-[50%] rounded-full bg-teal-400/20 dark:bg-teal-400/10 blur-[100px] pointer-events-none mix-blend-screen" />
                
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-sky-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <span className="text-xl font-medium tracking-wide text-slate-900 dark:text-white transition-colors duration-500">Elcom Networks</span>
                </div>

                <div className="relative z-10 max-w-md">
                    <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white leading-tight mb-6 transition-colors duration-500">
                        Welcome to your Partner Portal
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 font-light leading-relaxed transition-colors duration-500">
                        We're glad to see you again. Access your cloud infrastructure, manage deployments, and support your customers in a secure, unified space.
                    </p>
                </div>

                <div className="relative z-10 flex gap-6 text-sm font-medium text-slate-500 dark:text-slate-500">
                    <p>© 2026 Elcom</p>
                    <a href="#" className="hover:text-slate-800 dark:hover:text-slate-300 transition-colors">Privacy</a>
                    <a href="#" className="hover:text-slate-800 dark:hover:text-slate-300 transition-colors">Terms</a>
                </div>
            </div>

            {/* Right Login Pane */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
                {/* Mobile glow */}
                <div className="absolute inset-0 lg:hidden rounded-full bg-sky-500/10 dark:bg-sky-500/5 blur-[100px] pointer-events-none" />

                <div className="w-full max-w-sm relative z-10">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2 transition-colors duration-500">Sign in</h2>
                        <p className="text-slate-600 dark:text-slate-400 font-light transition-colors duration-500">Please enter your credentials to continue.</p>
                    </div>

                    {/* Mode Toggle (Segmented Control) */}
                    <div className="flex p-1.5 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 mb-8 w-full shadow-sm dark:shadow-inner transition-colors duration-500">
                        <button
                            onClick={() => { setIsAdminMode(false); setError(""); setEmail(""); }}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 ${!isAdminMode ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm dark:shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                        >
                            Partner
                        </button>
                        <button
                            onClick={() => { setIsAdminMode(true); setError(""); setEmail(""); }}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 ${isAdminMode ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm dark:shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                        >
                            Administrator
                        </button>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-slate-300 ml-1 transition-colors duration-500">
                                {isAdminMode ? 'Admin Email Address' : 'Partner Email Address'}
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-sky-500 dark:group-focus-within:text-sky-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={isAdminMode ? "admin@elcom.com" : "partner@company.com"}
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all duration-300 shadow-sm"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm flex items-start animate-in fade-in slide-in-from-top-2 duration-300">
                                <svg className="w-5 h-5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading || !email}
                                className="w-full py-3.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-lg shadow-sky-600/20 transition-all duration-300 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {loading ? (
                                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    'Continue'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}
