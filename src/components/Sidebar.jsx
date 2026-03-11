"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar fluid-background">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">K</div>
                    <span className="sidebar-logo-text">Kida CRM</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section">
                    <div className="nav-section-title">Overview</div>
                    <Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>
                        <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        Dashboard
                    </Link>
                </div>

                <div className="nav-section">
                    <div className="nav-section-title">Management</div>
                    <Link href="/clients" className={`nav-item ${pathname === '/clients' ? 'active' : ''}`}>
                        <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Clients
                    </Link>
                    <Link href="/projects" className={`nav-item ${pathname === '/projects' ? 'active' : ''}`}>
                        <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        Projects
                    </Link>
                    <Link href="/people" className={`nav-item ${pathname === '/people' ? 'active' : ''}`}>
                        <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        People
                    </Link>
                    <Link href="/transactions" className={`nav-item ${pathname === '/transactions' ? 'active' : ''}`}>
                        <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="1" x2="12" y2="23" />
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        Transactions
                    </Link>
                    <Link href="/debts" className={`nav-item ${pathname === '/debts' ? 'active' : ''}`}>
                        <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4l3 3" />
                        </svg>
                        Debts
                    </Link>
                </div>

                <div className="nav-section">
                    <div className="nav-section-title">Reports</div>
                    <Link href="/reports" className={`nav-item ${pathname === '/reports' ? 'active' : ''}`}>
                        <svg className="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        Reports
                    </Link>
                </div>
            </nav>
        </aside>
    );
}
