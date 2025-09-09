document.addEventListener('DOMContentLoaded', () => {
    const manualModeBtn = document.getElementById('manual-mode-btn');
    const autoModeBtn = document.getElementById('auto-mode-btn');
    const manualControls = document.getElementById('manual-controls');
    const autoControls = document.getElementById('auto-controls');
    const valueInput = document.getElementById('value-input');
    const addBtn = document.getElementById('add-btn');
    const undoBtn = document.getElementById('undo-btn');

    const statPickerBtn = document.getElementById('stat-picker-btn');
    const statPickerContent = document.getElementById('stat-picker-content');
    let selectedStat = 'cpu_percent'; // Default value

    const intervalPickerBtn = document.getElementById('interval-picker-btn');
    const intervalPickerContent = document.getElementById('interval-picker-content');
    let selectedInterval = '1000'; // Default value

    const pingHostInput = document.getElementById('ping-host-input');
    const pidInput = document.getElementById('pid-input');
    const includeChildrenCheckbox = document.getElementById('include-children-checkbox');
    const includeChildrenWrapper = document.getElementById('include-children-wrapper');
    const startTrackingBtn = document.getElementById('start-tracking-btn');
    const stopTrackingBtn = document.getElementById('stop-tracking-btn');
    const restartBtn = document.getElementById('restart-btn');
    const exportBtn = document.getElementById('export-btn');
    const exportPngBtn = document.getElementById('export-png-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const exportJsonBtn = document.getElementById('export-json-btn');
    const colorPicker = document.getElementById('color-picker');
    const colorPickerPreview = document.getElementById('color-picker-preview');
    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d');

    let chart;
    let trackingIntervalId = null;
    let lastNetStats = {
        sent: 0,
        recv: 0,
        time: 0
    };

    function updateDocumentTitle() {
        const baseTitle = 'Nanograph';
        if (manualModeBtn.classList.contains('active')) {
            document.title = `${baseTitle} - Manual`;
        } else {
            const statName = statPickerBtn.textContent;
            document.title = `${baseTitle} - ${statName}`;
        }
    }

    function initializeChart() {
        if (chart) chart.destroy();
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'value',
                    data: [],
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHitRadius: 12,
                    pointBackgroundColor: '#28a745',
                    pointBorderColor: '#121212'
                }]
            },
            options: {
                animation: {
                    duration: 400
                },
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'second', displayFormats: { second: 'HH:mm:ss' } },
                        title: { display: false, text: 'time', color: '#e0e0e0' },
                        ticks: { color: '#e0e0e0', maxTicksLimit: 6, autoSkip: true, maxRotation: 0, minRotation: 0 },
                        grid: { color: '#333' }
                    },
                    y: {
                        beginAtZero: false,
                        title: { display: false, text: 'value', color: '#e0e0e0' },
                        ticks: { color: '#e0e0e0' },
                        grid: { color: '#333' }
                    }
                }
            }
        });
    }

    function addDataPoint(value) {
        if (isNaN(value) || value === -1) return;
        chart.data.labels.push(new Date());
        chart.data.datasets[0].data.push(value);
        chart.update();
        if (manualModeBtn.classList.contains('active')) {
            manualModeBtn.disabled = true;
            autoModeBtn.disabled = true;
        }
    }

    function clearChart() {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        lastNetStats = { sent: 0, recv: 0, time: 0 };
        chart.update();
        if (trackingIntervalId === null) {
            manualModeBtn.disabled = false;
            autoModeBtn.disabled = false;
        }
    }

    async function fetchAndProcessStats() {
        if (selectedStat === 'ping_latency_ms') {
            const host = pingHostInput.value || 'google.com';
            try {
                const response = await fetch(`http://127.0.0.1:8000/ping?host=${host}`);
                const data = await response.json();
                addDataPoint(data.latency_ms);
            } catch (error) {
                console.error("Ping failed:", error);
            }
        } else if (selectedStat === 'process_ram_mb') {
            const pid = pidInput.value;
            if (!pid) return;
            const includeChildren = includeChildrenCheckbox.checked;
            try {
                const response = await fetch(`http://127.0.0.1:8000/process_stats?pid=${pid}&include_children=${includeChildren}`);
                const data = await response.json();
                addDataPoint(data.memory_mb);
            } catch (error) {
                console.error("Failed to fetch process stats:", error);
            }
        } else {
            try {
                const response = await fetch('http://127.0.0.1:8000/stats');
                const stats = await response.json();
                
                if (selectedStat === 'net_sent_kbs' || selectedStat === 'net_recv_kbs') {
                    const now = Date.now();
                    if (lastNetStats.time > 0) {
                        const timeDiffSec = (now - lastNetStats.time) / 1000;
                        const sentRate = (stats.net_bytes_sent - lastNetStats.sent) / timeDiffSec / 1024;
                        const recvRate = (stats.net_bytes_recv - lastNetStats.recv) / timeDiffSec / 1024;
                        addDataPoint(selectedStat === 'net_sent_kbs' ? sentRate : recvRate);
                    }
                    lastNetStats = { sent: stats.net_bytes_sent, recv: stats.net_bytes_recv, time: now };
                } else {
                    addDataPoint(stats[selectedStat]);
                }
            } catch (error) {
                console.error("Failed to fetch stats:", error);
                stopTracking();
            }
        }
    }

    function startTracking() {
        stopTracking();
        const interval = parseInt(selectedInterval, 10);
        fetchAndProcessStats();
        trackingIntervalId = setInterval(fetchAndProcessStats, interval);
        startTrackingBtn.style.display = 'none';
        stopTrackingBtn.style.display = 'inline-block';
        statPickerBtn.disabled = true;
        intervalPickerBtn.disabled = true;
        pingHostInput.disabled = true;
        pidInput.disabled = true;
        includeChildrenCheckbox.disabled = true;
        manualModeBtn.disabled = true;
        autoModeBtn.disabled = true;
    }

    function stopTracking() {
        if (trackingIntervalId) clearInterval(trackingIntervalId);
        trackingIntervalId = null;
        startTrackingBtn.style.display = 'inline-block';
        stopTrackingBtn.style.display = 'none';
        statPickerBtn.disabled = false;
        intervalPickerBtn.disabled = false;
        pingHostInput.disabled = false;
        pidInput.disabled = false;
        includeChildrenCheckbox.disabled = false;
        manualModeBtn.disabled = false;
        autoModeBtn.disabled = false;
    }

    function saveSettings() {
        const settings = {
            mode: manualModeBtn.classList.contains('active') ? 'manual' : 'automatic',
            stat: selectedStat,
            interval: selectedInterval,
            pingHost: pingHostInput.value,
            pid: pidInput.value,
            includeChildren: includeChildrenCheckbox.checked,
            color: colorPicker.value,
        };
        localStorage.setItem('nanograph-settings', JSON.stringify(settings));
    }

    function loadSettings() {
        const settings = JSON.parse(localStorage.getItem('nanograph-settings'));
        if (settings) {
            selectedStat = settings.stat || 'cpu_percent';
            const selectedOption = statPickerContent.querySelector(`[data-value="${selectedStat}"]`);
            statPickerBtn.textContent = selectedOption ? selectedOption.textContent : 'cpu usage (%)';
            
            selectedInterval = settings.interval || '1000';
            const selectedIntervalOption = intervalPickerContent.querySelector(`[data-value="${selectedInterval}"]`);
            intervalPickerBtn.textContent = selectedIntervalOption ? selectedIntervalOption.textContent : 'every 1 second';

            colorPicker.value = settings.color || '#28a745';
            updateGraphColor(colorPicker.value);

            pingHostInput.value = settings.pingHost || 'google.com';
            pidInput.value = settings.pid || '';
            includeChildrenCheckbox.checked = settings.includeChildren || false;
            setMode(settings.mode || 'manual');
            if (settings.mode === 'automatic') {
                updateYAxis();
            }
            updateDocumentTitle();
        } else {
            setMode('manual');
        }
    }

    function updateGraphColor(newColor) {
        colorPickerPreview.style.setProperty('--color', newColor);
        chart.data.datasets[0].borderColor = newColor;
        chart.data.datasets[0].pointBackgroundColor = newColor;
        const r = parseInt(newColor.slice(1, 3), 16);
        const g = parseInt(newColor.slice(3, 5), 16);
        const b = parseInt(newColor.slice(5, 7), 16);
        chart.data.datasets[0].backgroundColor = `rgba(${r}, ${g}, ${b}, 0.1)`;
        chart.update();
    }

    function updateYAxis() {
        pingHostInput.style.display = selectedStat === 'ping_latency_ms' ? 'inline-block' : 'none';
        const isProcessRam = selectedStat === 'process_ram_mb';
        pidInput.style.display = isProcessRam ? 'inline-block' : 'none';
        includeChildrenWrapper.style.display = isProcessRam ? 'flex' : 'none';

        if (selectedStat.includes('percent')) {
            chart.options.scales.y.min = 0;
            chart.options.scales.y.max = 100;
        } else {
            chart.options.scales.y.min = undefined;
            chart.options.scales.y.max = undefined;
        }
        clearChart();
    }

    function setMode(mode) {
        clearChart();
        stopTracking();
        if (mode === 'manual') {
            manualModeBtn.classList.add('active');
            autoModeBtn.classList.remove('active');
            manualControls.style.display = 'flex';
            autoControls.style.display = 'none';
            chart.options.scales.y.min = undefined;
            chart.options.scales.y.max = undefined;
        } else {
            manualModeBtn.classList.remove('active');
            autoModeBtn.classList.add('active');
            manualControls.style.display = 'none';
            autoControls.style.display = 'flex';
            updateYAxis();
        }
        saveSettings();
        updateDocumentTitle();
    }

    manualModeBtn.addEventListener('click', () => setMode('manual'));
    autoModeBtn.addEventListener('click', () => setMode('automatic'));
    addBtn.addEventListener('click', () => {
        addDataPoint(parseFloat(valueInput.value));
        valueInput.value = '';
    });
    valueInput.addEventListener('keydown', (e) => e.key === 'Enter' && addBtn.click());
    undoBtn.addEventListener('click', () => {
        chart.data.labels.pop();
        chart.data.datasets[0].data.pop();
        chart.update();
        if (chart.data.labels.length === 0) {
            manualModeBtn.disabled = false;
            autoModeBtn.disabled = false;
        }
    });
    startTrackingBtn.addEventListener('click', startTracking);
    stopTrackingBtn.addEventListener('click', stopTracking);

    statPickerBtn.addEventListener('click', () => {
        const isVisible = statPickerContent.style.display === 'block';
        statPickerContent.style.display = isVisible ? 'none' : 'block';
        statPickerBtn.classList.toggle('active', !isVisible);
    });

    statPickerContent.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            selectedStat = e.target.dataset.value;
            statPickerBtn.textContent = e.target.textContent;
            statPickerContent.style.display = 'none';
            statPickerBtn.classList.remove('active');
            updateYAxis();
            saveSettings();
            updateDocumentTitle();
        }
    });

    document.addEventListener('click', (e) => {
        if (!statPickerBtn.contains(e.target) && !statPickerContent.contains(e.target)) {
            statPickerContent.style.display = 'none';
            statPickerBtn.classList.remove('active');
        }
        if (!intervalPickerBtn.contains(e.target) && !intervalPickerContent.contains(e.target)) {
            intervalPickerContent.style.display = 'none';
            intervalPickerBtn.classList.remove('active');
        }
    });

    intervalPickerBtn.addEventListener('click', () => {
        const isVisible = intervalPickerContent.style.display === 'block';
        intervalPickerContent.style.display = isVisible ? 'none' : 'block';
        intervalPickerBtn.classList.toggle('active', !isVisible);
    });

    intervalPickerContent.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            selectedInterval = e.target.dataset.value;
            intervalPickerBtn.textContent = e.target.textContent;
            intervalPickerContent.style.display = 'none';
            intervalPickerBtn.classList.remove('active');
            saveSettings();
        }
    });

    pingHostInput.addEventListener('input', saveSettings);
    pidInput.addEventListener('input', saveSettings);
    includeChildrenCheckbox.addEventListener('change', saveSettings);
    restartBtn.addEventListener('click', clearChart);

    colorPicker.addEventListener('input', (e) => {
        updateGraphColor(e.target.value);
    });

    colorPicker.addEventListener('change', (e) => {
        saveSettings();
    });

    exportPngBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
        const link = document.createElement('a');
        link.href = chart.toBase64Image();
        link.download = `graph_${timestamp}.png`;
        link.click();
    });

    exportCsvBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const { labels, datasets } = chart.data;
        if (labels.length === 0) {
            alert("No data to export.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "timestamp,value\r\n"; // CSV header

        labels.forEach((label, index) => {
            const value = datasets[0].data[index];
            const timestamp = new Date(label).toISOString();
            csvContent += `${timestamp},${value}\r\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
        link.setAttribute("download", `graph_data_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    exportJsonBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const { labels, datasets } = chart.data;
        if (labels.length === 0) {
            alert("No data to export.");
            return;
        }

        const data = labels.map((label, index) => ({
            timestamp: new Date(label).toISOString(),
            value: datasets[0].data[index]
        }));

        const jsonContent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const link = document.createElement("a");
        link.setAttribute("href", jsonContent);
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
        link.setAttribute("download", `graph_data_${timestamp}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    initializeChart();
    loadSettings();

    window.addEventListener('beforeunload', async (event) => {
        try {
            await fetch('http://127.0.0.1:8000/shutdown', { method: 'POST' });
        } catch (error) {
            console.error("Failed to send shutdown signal:", error);
        }
    });
});
