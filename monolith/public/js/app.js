document.addEventListener('DOMContentLoaded', () => {
    
    const loginForm = document.getElementById('loginForm');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    // Check if we are on the login page
    if (loginForm) {
        // Auto-redirect if already logged in
        if (localStorage.getItem('partnerEmail')) {
            window.location.href = '/dashboard';
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('email').value;
            const btnText = document.querySelector('#loginBtn span');
            const spinner = document.querySelector('.spinner');
            const errorMsg = document.getElementById('errorMessage');
            
            // UI Loading state
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
            errorMsg.textContent = '';
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    localStorage.setItem('partnerEmail', data.email);
                    window.location.href = '/dashboard';
                } else {
                    errorMsg.textContent = data.detail || 'Login failed.';
                }
            } catch (err) {
                errorMsg.textContent = 'Server connection error. Please try again later.';
            } finally {
                btnText.classList.remove('hidden');
                spinner.classList.add('hidden');
            }
        });
    }

    // Dashboard Logic
    if (dashboardContainer) {
        const userEmail = localStorage.getItem('partnerEmail');
        
        if (!userEmail) {
            window.location.href = '/';
            return;
        }
        
        document.getElementById('userEmail').textContent = userEmail;
        
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('partnerEmail');
            window.location.href = '/';
        });

        loadDashboardData(userEmail);
        
        // Unified Filtering functionality
        const searchInput = document.getElementById('searchInput');
        const statusFilter = document.getElementById('statusFilter');
        const storageFilter = document.getElementById('storageFilter');
        
        const actStartDateFilter = document.getElementById('actStartDateFilter');
        const actEndDateFilter = document.getElementById('actEndDateFilter');
        const renStartDateFilter = document.getElementById('renStartDateFilter');
        const renEndDateFilter = document.getElementById('renEndDateFilter');
        
        const actDateGroup = document.getElementById('actDateGroup');
        const renDateGroup = document.getElementById('renDateGroup');
        
        // Mutual exclusivity for date filters
        const updateDateFilterState = () => {
            const hasActDates = actStartDateFilter.value || actEndDateFilter.value;
            const hasRenDates = renStartDateFilter.value || renEndDateFilter.value;
            
            if (hasActDates) {
                renDateGroup.style.display = 'none';
            } else {
                renDateGroup.style.display = 'block';
            }
            
            if (hasRenDates) {
                actDateGroup.style.display = 'none';
            } else {
                actDateGroup.style.display = 'block';
            }
        };
        
        actStartDateFilter.addEventListener('change', updateDateFilterState);
        actEndDateFilter.addEventListener('change', updateDateFilterState);
        renStartDateFilter.addEventListener('change', updateDateFilterState);
        renEndDateFilter.addEventListener('change', updateDateFilterState);
        
        const applyFiltersBtn = document.getElementById('applyFiltersBtn');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        
        // Sidebar Toggle Elements
        const filterToggleBtn = document.getElementById('filterToggleBtn');
        const filterSidebar = document.getElementById('filterSidebar');
        const closeSidebarBtn = document.getElementById('closeSidebarBtn');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        function toggleSidebar(show) {
            if (show) {
                filterSidebar.classList.add('open');
                sidebarOverlay.classList.add('active');
            } else {
                filterSidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            }
        }

        filterToggleBtn.addEventListener('click', () => toggleSidebar(true));
        closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
        sidebarOverlay.addEventListener('click', () => toggleSidebar(false));

        function filterTable() {
            const term = searchInput.value.toLowerCase();
            const statusVal = statusFilter.value.toLowerCase();
            const storageVal = storageFilter.value;
            
            const actStartVal = actStartDateFilter.value;
            const actEndVal = actEndDateFilter.value;
            const renStartVal = renStartDateFilter.value;
            const renEndVal = renEndDateFilter.value;
            
            const rows = document.querySelectorAll('#tableBody tr');
            
            // Helper to get inclusive end date
            function parseEnd(val) {
                if (!val) return null;
                const d = new Date(val);
                d.setHours(23, 59, 59, 999);
                return d;
            }
            
            const actStart = actStartVal ? new Date(actStartVal) : null;
            const actEnd = parseEnd(actEndVal);
            
            const renStart = renStartVal ? new Date(renStartVal) : null;
            const renEnd = parseEnd(renEndVal);
            
            // Determine the reference point for historical status
            let referenceDate = null;
            if (actEnd) referenceDate = actEnd;
            else if (renEnd) referenceDate = renEnd;
            else if (actStart) referenceDate = actStart;
            else if (renStart) referenceDate = renStart;
            
            rows.forEach(row => {
                // --- DYNAMIC HISTORICAL STATUS ---
                const rawStatus = row.dataset.rawStatus || 'won';
                const renDateStr = row.dataset.renDate;
                const renDateObj = (renDateStr && renDateStr !== 'None' && renDateStr !== '-') ? new Date(renDateStr) : null;
                
                let displayStatus = 'Active';
                let statusClass = 'status-won';
                
                if (rawStatus === 'lost' || rawStatus === 'pending') {
                    // If they churned, but we are looking at a time BEFORE their renewal/churn date
                    if (referenceDate && renDateObj && referenceDate < renDateObj) {
                        displayStatus = 'Active';
                        statusClass = 'status-won';
                    } else {
                        displayStatus = rawStatus === 'lost' ? 'Lost' : 'Pending';
                        statusClass = rawStatus === 'lost' ? 'status-lost' : 'status-pending';
                    }
                }
                
                const badge = row.querySelector('.status-badge');
                badge.textContent = displayStatus;
                badge.className = `status-badge ${statusClass}`;
                
                // Now read the DOM text for filtering
                const text = row.textContent.toLowerCase();
                const statusCell = badge.textContent.toLowerCase();
                const storageCell = parseFloat(row.dataset.baseStorage) || 0;
                
                const activationCellStr = row.children[3].textContent;
                const renewalCellStr = row.children[5].textContent;
                
                // Search Match
                const matchesSearch = text.includes(term);
                
                // Status Match
                let matchesStatus = true;
                if (statusVal !== 'all') {
                    matchesStatus = statusCell.includes(statusVal);
                }
                
                // Storage Match
                let matchesStorage = true;
                if (storageVal === 'small') matchesStorage = storageCell > 0 && storageCell < 10;
                else if (storageVal === 'medium') matchesStorage = storageCell >= 10 && storageCell <= 50;
                else if (storageVal === 'large') matchesStorage = storageCell > 50;
                
                // Activation Date Match
                let matchesActDate = true;
                const actDate = (activationCellStr && activationCellStr !== '-') ? new Date(activationCellStr) : null;
                
                if ((actStart || actEnd) && actDate) {
                    if (actStart && actDate < actStart) matchesActDate = false;
                    if (actEnd && actDate > actEnd) matchesActDate = false;
                } else if ((actStart || actEnd) && !actDate) {
                    matchesActDate = false;
                }
                
                // Renewal Date Match
                let matchesRenDate = true;
                const renDate = (renewalCellStr && renewalCellStr !== '-') ? new Date(renewalCellStr) : null;
                
                if ((renStart || renEnd) && renDate) {
                    if (renStart && renDate < renStart) matchesRenDate = false;
                    if (renEnd && renDate > renEnd) matchesRenDate = false;
                } else if ((renStart || renEnd) && !renDate) {
                    matchesRenDate = false;
                }
                
                if (matchesSearch && matchesStatus && matchesStorage && matchesActDate && matchesRenDate) {
                    row.classList.remove('hidden');
                } else {
                    row.classList.add('hidden');
                }
            });
            
            updateMetrics();
        }

        // Only search input updates in real-time
        searchInput.addEventListener('input', filterTable);

        applyFiltersBtn.addEventListener('click', () => {
            filterTable();
            toggleSidebar(false); // Close sidebar on apply
        });
        
        clearFiltersBtn.addEventListener('click', () => {
            statusFilter.value = 'all';
            storageFilter.value = 'all';
            actStartDateFilter.value = '';
            actEndDateFilter.value = '';
            renStartDateFilter.value = '';
            renEndDateFilter.value = '';
            updateDateFilterState();
            filterTable();
            // Don't close sidebar on clear so they can pick new filters
        });
    }
});

function updateMetrics() {
    const rows = document.querySelectorAll('#tableBody tr');
    let visibleCustomers = new Set();
    let totalAbsoluteStorage = 0;
    let totalFilteredStorage = 0;
    let activeRenewals = 0;
    let hiddenRowsCount = 0;

    const actStartVal = document.getElementById('actStartDateFilter').value;
    const actEndVal = document.getElementById('actEndDateFilter').value;
    const renStartVal = document.getElementById('renStartDateFilter').value;
    const renEndVal = document.getElementById('renEndDateFilter').value;
    
    let isActFilterActive = actStartVal || actEndVal;
    let isRenFilterActive = renStartVal || renEndVal;

    rows.forEach(row => {
        const base = parseFloat(row.dataset.baseStorage) || 0;
        const extra = parseFloat(row.dataset.extraStorage) || 0;
        const custId = row.children[1].textContent.trim();

        // Total is always base + upgrades across all rows
        totalAbsoluteStorage += base + extra;

        if (!row.classList.contains('hidden')) {
            if (custId && custId !== '-') {
                visibleCustomers.add(custId);
            }
            
            if (isActFilterActive) {
                totalFilteredStorage += base;
            } else if (isRenFilterActive) {
                totalFilteredStorage += extra;
            } else {
                totalFilteredStorage += base + extra;
            }
            
            const statusText = row.querySelector('.status-badge').textContent.toLowerCase();
            if (statusText === 'active') {
                activeRenewals++;
            }
        } else {
            hiddenRowsCount++;
        }
    });

    document.getElementById('metricCustomers').textContent = visibleCustomers.size;
    document.getElementById('metricStorageTotal').textContent = totalAbsoluteStorage.toFixed(2) + ' GB';
    document.getElementById('metricRenewals').textContent = activeRenewals;

    const filteredCard = document.getElementById('metricCardFiltered');
    const filteredCardTitle = filteredCard.querySelector('h3');
    
    if (isActFilterActive) {
        filteredCardTitle.textContent = 'Filtered Base Storage';
    } else if (isRenFilterActive) {
        filteredCardTitle.textContent = 'Filtered Renewed Size';
    } else {
        filteredCardTitle.textContent = 'Filtered Storage';
    }
    
    if (hiddenRowsCount > 0) {
        filteredCard.style.display = 'block';
        document.getElementById('metricStorageFiltered').textContent = totalFilteredStorage.toFixed(2) + ' GB';
    } else {
        filteredCard.style.display = 'none';
    }
}

async function loadDashboardData(email) {
    const loader = document.getElementById('tableLoader');
    const table = document.getElementById('dataTable');
    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    
    try {
        const response = await fetch(`/api/data?email=${encodeURIComponent(email)}`);
        const result = await response.json();
        
        loader.classList.add('hidden');
        
        if (!response.ok || !result.data || result.data.length === 0) {
            emptyState.classList.remove('hidden');
            table.classList.add('hidden');
            return;
        }

        const data = result.data;
        const allocated_storage = result.allocated_storage;

        if (allocated_storage) {
            document.getElementById('metricStorageAllocated').textContent = allocated_storage;
        } else {
            document.getElementById('metricStorageAllocated').textContent = 'N/A';
        }

        // Render Table
        data.forEach(item => {
            const tr = document.createElement('tr');
            
            let statusClass = 'status-won';
            let displayStatus = 'Active';
            
            if (item.status) {
                const status = item.status.toLowerCase();
                if (status === 'lost') {
                    statusClass = 'status-lost';
                    displayStatus = 'Lost';
                } else if (status === 'pending') {
                    statusClass = 'status-pending';
                    displayStatus = 'Pending';
                }
            }

            const formatSize = (size) => {
                const num = parseFloat(String(size).replace(/[^\d.-]/g, ''));
                return !isNaN(num) ? `${num} GB` : '0 GB';
            };
            
            const formatDate = (dateStr) => {
                if (!dateStr || dateStr.toLowerCase() === 'none') return '-';
                try {
                    return new Date(dateStr).toISOString().split('T')[0];
                } catch {
                    return dateStr;
                }
            };
            
            tr.dataset.rawStatus = item.status ? item.status.toLowerCase() : 'won';
            tr.dataset.renDate = item.renewal_date || '';
            tr.dataset.baseStorage = parseFloat(String(item.backup_storage_gb).replace(/[^\d.-]/g, '')) || 0;
            tr.dataset.extraStorage = parseFloat(String(item.size_increased).replace(/[^\d.-]/g, '')) || 0;

            tr.innerHTML = `
                <td style="font-weight: 500;">${item.customer_name || '-'}</td>
                <td style="color: var(--text-secondary); font-family: monospace;">${item.customer_id || '-'}</td>
                <td>${formatSize(item.backup_storage_gb)}</td>
                <td>${formatDate(item.activation_date)}</td>
                <td><span class="status-badge ${statusClass}">${displayStatus}</span></td>
                <td>${formatDate(item.renewal_date)}</td>
                <td>${formatSize(item.size_increased)}</td>
            `;
            
            tbody.appendChild(tr);
        });

        table.classList.remove('hidden');
        updateMetrics();
        
    } catch (error) {
        console.error('Error loading data:', error);
        loader.classList.add('hidden');
        emptyState.innerHTML = `
            <div class="empty-icon" style="color: #ef4444;">⚠️</div>
            <h3>Error Loading Data</h3>
            <p>Could not connect to the server. Please try again later.</p>
        `;
        emptyState.classList.remove('hidden');
    }
}
