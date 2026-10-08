document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('parking-grid');
    const loading = document.getElementById('loading');
    const lastUpdated = document.getElementById('last-updated');
    const notifyBtn = document.getElementById('notify-btn');
    const modal = document.getElementById('modal-overlay');
    const closeModalBtn = document.getElementById('close-modal');
    const alertOptions = document.getElementById('alert-options');
    
    let parkingData = [];
    // Load watched zones from localStorage (e.g. ['P1', 'P3'])
    let watchedZones = JSON.parse(localStorage.getItem('watchedZones') || '[]');
    // Keep track of which zones we've already notified about so we don't spam
    let notifiedZones = JSON.parse(sessionStorage.getItem('notifiedZones') || '{}');

    // Setup Notifications
    let notificationsEnabled = false;
    if ("Notification" in window) {
        if (Notification.permission === "granted") {
            notificationsEnabled = true;
            notifyBtn.classList.add('active');
        }
    }

    notifyBtn.addEventListener('click', async () => {
        if (!notificationsEnabled && "Notification" in window) {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                notificationsEnabled = true;
                notifyBtn.classList.add('active');
            }
        }
        
        // Open Modal
        renderAlertOptions();
        modal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        localStorage.setItem('watchedZones', JSON.stringify(watchedZones));
    });

    function toggleWatchZone(id, el) {
        const index = watchedZones.indexOf(id);
        if (index === -1) {
            watchedZones.push(id);
            el.classList.add('selected');
        } else {
            watchedZones.splice(index, 1);
            el.classList.remove('selected');
        }
    }

    function renderAlertOptions() {
        alertOptions.innerHTML = '';
        if (parkingData.length === 0) {
            alertOptions.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">No data available yet.</p>';
            return;
        }

        parkingData.forEach(zone => {
            const isSelected = watchedZones.includes(zone.id);
            const el = document.createElement('div');
            el.className = `alert-option ${isSelected ? 'selected' : ''}`;
            el.innerHTML = `
                <span><strong>${zone.id}</strong> <small>(${zone.name.replace(zone.id, '').trim()})</small></span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: ${isSelected ? 1 : 0.2}">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            `;
            el.addEventListener('click', () => toggleWatchZone(zone.id, el));
            alertOptions.appendChild(el);
        });
    }

    function checkAlerts(data) {
        if (!notificationsEnabled) return;
        
        data.forEach(zone => {
            if (watchedZones.includes(zone.id)) {
                // If it's full (or whatever condition user wants, e.g. full)
                if (zone.isFull && !notifiedZones[zone.id]) {
                    new Notification(`DUS Parking Alert`, {
                        body: `${zone.name} is now FULL!`,
                        icon: '/icon-192.png'
                    });
                    notifiedZones[zone.id] = true;
                    sessionStorage.setItem('notifiedZones', JSON.stringify(notifiedZones));
                } else if (!zone.isFull && notifiedZones[zone.id]) {
                    // Reset notification if space opens up
                    delete notifiedZones[zone.id];
                    sessionStorage.setItem('notifiedZones', JSON.stringify(notifiedZones));
                }
            }
        });
    }

    function renderCards(data) {
        grid.innerHTML = '';
        data.forEach((zone, index) => {
            const card = document.createElement('div');
            card.className = 'parking-card glass animate-fade-in';
            card.style.animationDelay = `${index * 0.05}s`;
            
            let statusClass = 'status-available';
            let statusText = 'Available';
            let valueClass = '';
            let progressClass = '';
            
            if (zone.isFull) {
                statusClass = 'status-full';
                statusText = 'Full';
                valueClass = 'zero';
                progressClass = 'full';
            } else if (zone.percentFull >= 90) {
                statusClass = 'status-almost';
                statusText = 'Almost Full';
                valueClass = 'low';
                progressClass = 'high';
            }

            card.innerHTML = `
                <div class="card-header">
                    <div class="zone-name">${zone.name}</div>
                    <div class="status-badge ${statusClass}">${statusText}</div>
                </div>
                <div class="card-stats">
                    <div class="stat-item">
                        <span class="stat-label">Total Spaces</span>
                        <span class="stat-value" style="font-size: 1.25rem; color: var(--text-secondary)">${zone.total}</span>
                    </div>
                    <div class="stat-item" style="text-align: right">
                        <span class="stat-label">Free Spaces</span>
                        <span class="stat-value free ${valueClass}">${zone.free}</span>
                    </div>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar ${progressClass}" style="width: ${zone.percentFull}%"></div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    async function fetchData() {
        try {
            const response = await fetch('/api/parking');
            if (response.ok) {
                const json = await response.json();
                parkingData = json.data;
                
                loading.classList.add('hidden');
                grid.classList.remove('hidden');
                
                renderCards(parkingData);
                checkAlerts(parkingData);
                
                const time = new Date(json.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                lastUpdated.textContent = `Updated at ${time}`;
            } else {
                if (response.status === 503) {
                    lastUpdated.textContent = 'Server is gathering data...';
                } else {
                    lastUpdated.textContent = 'Error fetching data';
                }
            }
        } catch (e) {
            console.error("Fetch error", e);
            lastUpdated.textContent = 'Network error';
        }
    }

    // Initial fetch
    fetchData();
    // Poll every 30 seconds
    setInterval(fetchData, 30000);

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js');
        });
    }
});
