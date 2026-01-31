document.addEventListener('DOMContentLoaded', function() {
    loadDashboardData();
    loadNPDTable();
    
    // Filter change event
    document.getElementById('statusFilter').addEventListener('change', loadNPDTable);
    
    // Add click event for charts (will be added after charts are rendered)
});

async function loadDashboardData() {
    try {
        // Load analytics data
        const { data: npds, error } = await window.supabaseClient
            .from('npd_master')
            .select('*')
            .eq('is_draft', false);
        
        if (error) throw error;
        
        // Calculate statistics
        const stats = {
            total: npds.length,
            toolingPending: npds.filter(n => n.current_stage === 'TOOLING_PLANNED' || n.current_stage === 'TOOLING_IN_PROGRESS').length,
            trialsPending: npds.filter(n => n.current_stage === 'TRIAL_ONGOING').length,
            samplePending: npds.filter(n => n.current_stage === 'SAMPLE_SUBMITTED').length,
            ppapPending: npds.filter(n => n.current_stage === 'PPAP_SUBMITTED').length,
            readyForProduction: npds.filter(n => n.current_stage === 'PRODUCTION_RELEASED').length,
            delayed: npds.filter(n => n.overall_status === 'Delayed').length,
            drafts: npds.filter(n => n.is_draft).length
        };
        
        renderCharts(stats);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Error loading dashboard data');
    }
}

function renderCharts(stats) {
    const chartsContainer = document.getElementById('chartsContainer');
    
    const charts = [
        {
            title: 'Tooling Pending',
            value: stats.toolingPending,
            total: stats.total,
            color: '#f59e0b',
            filter: 'TOOLING'
        },
        {
            title: 'Trials Pending',
            value: stats.trialsPending,
            total: stats.total,
            color: '#8b5cf6',
            filter: 'TRIAL_ONGOING'
        },
        {
            title: 'Sample Pending',
            value: stats.samplePending,
            total: stats.total,
            color: '#10b981',
            filter: 'SAMPLE_SUBMITTED'
        },
        {
            title: 'PPAP Pending',
            value: stats.ppapPending,
            total: stats.total,
            color: '#3b82f6',
            filter: 'PPAP_SUBMITTED'
        },
        {
            title: 'Ready for Production',
            value: stats.readyForProduction,
            total: stats.total,
            color: '#10b981',
            filter: 'PRODUCTION_RELEASED'
        },
        {
            title: 'Delayed NPDs',
            value: stats.delayed,
            total: stats.total,
            color: '#ef4444',
            filter: 'DELAYED'
        }
    ];
    
    let chartsHTML = '';
    
    charts.forEach(chart => {
        const percentage = stats.total > 0 ? Math.round((chart.value / stats.total) * 100) : 0;
        
        chartsHTML += `
            <div class="chart-container" data-filter="${chart.filter}" style="cursor: pointer;">
                <div class="chart-title">${chart.title}</div>
                <div class="donut-chart" style="background: conic-gradient(
                    ${chart.color} 0% ${percentage}%,
                    #e2e8f0 ${percentage}% 100%
                );">
                    <div class="donut-hole"></div>
                    <div class="chart-value">${chart.value}</div>
                </div>
                <div class="chart-label">${percentage}% of total NPDs</div>
            </div>
        `;
    });
    
    chartsContainer.innerHTML = chartsHTML;
    
    // Add click events to charts
    document.querySelectorAll('.chart-container').forEach(chart => {
        chart.addEventListener('click', function() {
            const filter = this.dataset.filter;
            redirectToNPDView(filter);
        });
    });
}

function redirectToNPDView(filter) {
    localStorage.setItem('npdFilter', filter);
    window.location.href = 'npd-view.html';
}

async function loadNPDTable() {
    try {
        const statusFilter = document.getElementById('statusFilter').value;
        
        let query = window.supabaseClient
            .from('npd_master')
            .select('*')
            .eq('is_draft', false)
            .order('created_at', { ascending: false });
        
        if (statusFilter) {
            query = query.eq('current_stage', statusFilter);
        }
        
        const { data: npds, error } = await query;
        
        if (error) throw error;
        
        renderNPDTable(npds);
        
    } catch (error) {
        console.error('Error loading NPD table:', error);
    }
}

function renderNPDTable(npds) {
    const tbody = document.getElementById('npdTableBody');
    
    if (npds.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem;">
                    No NPDs found
                </td>
            </tr>
        `;
        return;
    }
    
    let rowsHTML = '';
    
    npds.forEach(npds => {
        const stageBadge = getStageBadge(npds.current_stage);
        const statusBadge = getStatusBadge(npds.overall_status);
        
        rowsHTML += `
            <tr>
                <td>${npds.npd_no}</td>
                <td>${npds.ts_part_no}</td>
                <td>${npds.customer}</td>
                <td>${stageBadge}</td>
                <td>${statusBadge}</td>
                <td>
                    <a href="npd-view.html?id=${npds.id}" class="btn btn-outline btn-sm">
                        View
                    </a>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = rowsHTML;
}

function getStageBadge(stage) {
    const stages = {
        'CREATED': { label: 'Created', class: 'status-pending' },
        'TOOLING_PLANNED': { label: 'Tooling Planned', class: 'status-pending' },
        'TOOLING_IN_PROGRESS': { label: 'Tooling In Progress', class: 'status-pending' },
        'TRIAL_ONGOING': { label: 'Trial Ongoing', class: 'status-pending' },
        'SAMPLE_SUBMITTED': { label: 'Sample Submitted', class: 'status-pending' },
        'PPAP_SUBMITTED': { label: 'PPAP Submitted', class: 'status-pending' },
        'PRODUCTION_RELEASED': { label: 'Production Released', class: 'status-completed' },
        'DRAFT': { label: 'Draft', class: 'status-pending' }
    };
    
    const stageInfo = stages[stage] || { label: stage, class: 'status-pending' };
    return `<span class="status-badge ${stageInfo.class}">${stageInfo.label}</span>`;
}

function getStatusBadge(status) {
    const statuses = {
        'On Track': { class: 'status-on-track' },
        'Delayed': { class: 'status-delayed' },
        'At Risk': { class: 'status-pending' },
        'Completed': { class: 'status-completed' }
    };
    
    const statusInfo = statuses[status] || { class: 'status-pending' };
    return `<span class="status-badge ${statusInfo.class}">${status}</span>`;
}