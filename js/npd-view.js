document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const npdId = urlParams.get('id');
    
    if (npdId) {
        loadNPDDetails(npdId);
        setupMobileSupport();
        setupModalEvents();
    } else {
        showError('content', 'No NPD ID provided. Please select an NPD from the dashboard.');
    }
});

let currentNPDId = null;
let currentItemType = null;
let currentItemId = null;
let currentFormData = {};

// Setup mobile support
function setupMobileSupport() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
            
            if (window.innerWidth < 768) {
                document.getElementById('content').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
    
    let touchStartX = 0;
    let touchEndX = 0;
    
    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });
    
    document.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            const activeTab = document.querySelector('.tab-btn.active');
            const tabs = Array.from(tabButtons);
            const currentIndex = tabs.indexOf(activeTab);
            
            if (diff > 0 && currentIndex < tabs.length - 1) {
                tabs[currentIndex + 1].click();
            } else if (diff < 0 && currentIndex > 0) {
                tabs[currentIndex - 1].click();
            }
        }
    }
}

// Setup modal event listeners
function setupModalEvents() {
    // Close modal when clicking outside
    document.getElementById('itemModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('itemModal').style.display === 'flex') {
            closeModal();
        }
    });
}

// Main function to load NPD details
async function loadNPDDetails(npdId) {
    showLoading();
    currentNPDId = npdId;
    
    try {
        // Load NPD master data
        const { data: npd, error } = await window.supabaseClient
            .from('npd_master')
            .select('*')
            .eq('id', npdId)
            .single();
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        if (!npd) {
            throw new Error('NPD not found');
        }
        
        // Check if read-only (handover done)
        if (npd.handover_done) {
            document.querySelectorAll('.add-btn').forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            });
            document.getElementById('readOnlyAlert').style.display = 'block';
        }
        
        // Populate master data
        populateMasterData(npd);
        
        // Load related data
        await Promise.all([
            loadTools(npdId),
            loadGauges(npdId),
            loadTrials(npdId),
            loadSamples(npdId),
            loadPPAP(npdId),
            loadDocuments(npdId),
            loadHandover(npdId)
        ]);
        
        // Update state machine
        updateStateMachine(npd);
        updateStateProgress(npd.current_stage);
        
        hideLoading();
        
    } catch (error) {
        console.error('Error in loadNPDDetails:', error);
        // FIX: Call showError properly
        showError('content', 'Failed to load NPD details. Please try again. Error: ' + error.message);
        hideLoading();
    }
}// Populate master data in overview tab
function populateMasterData(npd) {
    // Basic info
    document.getElementById('npdNo').textContent = npd.npd_no || '-';
    document.getElementById('customer').textContent = npd.customer || '-';
    document.getElementById('tsPartNo').textContent = npd.ts_part_no || '-';
    document.getElementById('customerPartNo').textContent = npd.customer_part_no || '-';
    document.getElementById('releaseDate').textContent = npd.release_date ? formatDate(npd.release_date) : '-';
    
    // Cost info
    document.getElementById('toolCostPaidBy').textContent = npd.tool_cost_paid_by || '-';
    document.getElementById('totalToolCost').textContent = npd.total_tool_cost ? 
        '₹' + Number(npd.total_tool_cost).toLocaleString('en-IN') : '-';
    
    // Description
    document.getElementById('description').textContent = npd.description || '-';
    
    // Drawing
    const drawingInfo = document.getElementById('drawingInfo');
    if (npd.drawing_url) {
        drawingInfo.innerHTML = `
            <a href="${npd.drawing_url}" target="_blank" class="file-link">
                <span>📄</span>
                <span>View Drawing</span>
            </a>
            ${npd.drawing_rev_no ? `<div style="margin-top: 8px; font-size: 14px; color: #4a5568;">Revision: ${npd.drawing_rev_no}</div>` : ''}
        `;
    } else {
        drawingInfo.textContent = 'No drawing uploaded';
    }
}

// Load tools
async function loadTools(npdId) {
    try {
        const { data: tools, error } = await window.supabaseClient
            .from('tools')
            .select('*')
            .eq('npd_id', npdId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('toolsContainer');
        
        if (!tools || tools.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔧</div>
                    <div class="empty-state-message">No tools defined</div>
                    <div class="empty-state-subtext">Click "Add Tool" to start adding tools</div>
                </div>
            `;
            return;
        }
        
        let toolsHTML = '';
        
        tools.forEach((tool, index) => {
            const statusClass = getToolStatusClass(tool.status);
            const isDelayed = checkIfDelayed(tool.planned_completion_date, tool.status !== 'Completed' && tool.status !== 'Approved');
            
            toolsHTML += `
                <div class="dynamic-item" id="tool-${tool.id}">
                    <div class="item-header">
                        <h4 class="item-title">Tool ${index + 1}: ${tool.tt_no}</h4>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            ${isDelayed ? '<span class="item-status status-delayed">Delayed</span>' : ''}
                            <span class="item-status ${statusClass}">${tool.status || 'Planned'}</span>
                            ${!tool.handover_done ? `
                                <button onclick="editItem('tool', '${tool.id}')" class="edit-btn">✏️</button>
                                <button onclick="deleteItem('tool', '${tool.id}')" class="delete-btn">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="item-details">
                        <div class="detail-group">
                            <div class="detail-label">Tool Type</div>
                            <div class="detail-value">${tool.tool_type || '-'}</div>
                        </div>
                        
                        <div class="detail-group">
                            <div class="detail-label">Planned Dates</div>
                            <div class="detail-value">
                                ${tool.planned_start_date ? formatDate(tool.planned_start_date) : 'Not set'} → 
                                ${tool.planned_completion_date ? formatDate(tool.planned_completion_date) : 'Not set'}
                            </div>
                        </div>
                        
                        <div class="detail-group">
                            <div class="detail-label">Actual Dates</div>
                            <div class="detail-value">
                                ${tool.actual_start_date ? formatDate(tool.actual_start_date) : 'Not started'} → 
                                ${tool.actual_completion_date ? formatDate(tool.actual_completion_date) : 'Not completed'}
                            </div>
                        </div>
                    </div>
                    
                    ${tool.tool_photo_url ? `
                        <div style="margin: 10px 0;">
                            <a href="${tool.tool_photo_url}" target="_blank" class="file-link">
                                <span>📷</span>
                                <span>View Tool Photo</span>
                            </a>
                        </div>
                    ` : ''}
                    
                    ${tool.remarks ? `
                        <div class="remarks">${tool.remarks}</div>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = toolsHTML;
        
    } catch (error) {
        console.error('Error loading tools:', error);
        document.getElementById('toolsContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-message">Error loading tools</div>
            </div>
        `;
    }
}

// Load gauges
async function loadGauges(npdId) {
    try {
        const { data: gauges, error } = await window.supabaseClient
            .from('gauges')
            .select('*')
            .eq('npd_id', npdId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('gaugesContainer');
        
        if (!gauges || gauges.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📏</div>
                    <div class="empty-state-message">No gauges defined</div>
                    <div class="empty-state-subtext">Click "Add Gauge" to start adding gauges</div>
                </div>
            `;
            return;
        }
        
        let gaugesHTML = '';
        
        gauges.forEach((gauge, index) => {
            const statusClass = getGaugeStatusClass(gauge.status);
            const isDelayed = checkIfDelayed(gauge.completion_date, gauge.status !== 'Completed' && gauge.status !== 'Received');
            
            gaugesHTML += `
                <div class="dynamic-item" id="gauge-${gauge.id}">
                    <div class="item-header">
                        <h4 class="item-title">Gauge ${index + 1}: ${gauge.gauge_no}</h4>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            ${isDelayed ? '<span class="item-status status-delayed">Delayed</span>' : ''}
                            <span class="item-status ${statusClass}">${gauge.status || 'Required'}</span>
                            ${!gauge.handover_done ? `
                                <button onclick="editItem('gauge', '${gauge.id}')" class="edit-btn">✏️</button>
                                <button onclick="deleteItem('gauge', '${gauge.id}')" class="delete-btn">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="item-details">
                        <div class="detail-group">
                            <div class="detail-label">Gauge Type</div>
                            <div class="detail-value">${gauge.gauge_type || '-'}</div>
                        </div>
                        
                        <div class="detail-group">
                            <div class="detail-label">Dates</div>
                            <div class="detail-value">
                                ${gauge.start_date ? formatDate(gauge.start_date) : 'Not started'} → 
                                ${gauge.completion_date ? formatDate(gauge.completion_date) : 'Not completed'}
                            </div>
                        </div>
                    </div>
                    
                    ${gauge.gauge_photo_url ? `
                        <div style="margin: 10px 0;">
                            <a href="${gauge.gauge_photo_url}" target="_blank" class="file-link">
                                <span>📷</span>
                                <span>View Gauge Photo</span>
                            </a>
                        </div>
                    ` : ''}
                    
                    ${gauge.remarks ? `
                        <div class="remarks">${gauge.remarks}</div>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = gaugesHTML;
        
    } catch (error) {
        console.error('Error loading gauges:', error);
        document.getElementById('gaugesContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-message">Error loading gauges</div>
            </div>
        `;
    }
}

// Load trials
async function loadTrials(npdId) {
    try {
        const { data: trials, error } = await window.supabaseClient
            .from('trials')
            .select('*')
            .eq('npd_id', npdId)
            .order('trial_date', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('trialsContainer');
        
        if (!trials || trials.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚗️</div>
                    <div class="empty-state-message">No trials conducted</div>
                    <div class="empty-state-subtext">Click "Add Trial" to record a trial</div>
                </div>
            `;
            return;
        }
        
        let trialsHTML = '';
        
        trials.forEach((trial, index) => {
            const statusClass = getTrialStatusClass(trial.status);
            
            trialsHTML += `
                <div class="dynamic-item" id="trial-${trial.id}">
                    <div class="item-header">
                        <h4 class="item-title">Trial ${index + 1}: ${trial.description || 'Trial'}</h4>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="item-status ${statusClass}">${trial.status || 'Scheduled'}</span>
                            ${!trial.handover_done ? `
                                <button onclick="editItem('trial', '${trial.id}')" class="edit-btn">✏️</button>
                                <button onclick="deleteItem('trial', '${trial.id}')" class="delete-btn">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="item-details">
                        <div class="detail-group">
                            <div class="detail-label">Trial Date</div>
                            <div class="detail-value">${trial.trial_date ? formatDate(trial.trial_date) : '-'}</div>
                        </div>
                        
                        <div class="detail-group">
                            <div class="detail-label">Status</div>
                            <div class="detail-value">${trial.status || '-'}</div>
                        </div>
                    </div>
                    
                    ${trial.report_url ? `
                        <div style="margin: 10px 0;">
                            <a href="${trial.report_url}" target="_blank" class="file-link">
                                <span>📋</span>
                                <span>View Trial Report</span>
                            </a>
                        </div>
                    ` : ''}
                    
                    ${trial.issues_found ? `
                        <div style="margin: 10px 0;">
                            <div class="detail-label">Issues Found</div>
                            <div style="font-size: 14px; color: #4a5568;">${trial.issues_found}</div>
                        </div>
                    ` : ''}
                    
                    ${trial.corrective_actions ? `
                        <div style="margin: 10px 0;">
                            <div class="detail-label">Corrective Actions</div>
                            <div style="font-size: 14px; color: #4a5568;">${trial.corrective_actions}</div>
                        </div>
                    ` : ''}
                    
                    ${trial.remarks ? `
                        <div class="remarks">${trial.remarks}</div>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = trialsHTML;
        
    } catch (error) {
        console.error('Error loading trials:', error);
        document.getElementById('trialsContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-message">Error loading trials</div>
            </div>
        `;
    }
}

// Load samples
async function loadSamples(npdId) {
    try {
        const { data: samples, error } = await window.supabaseClient
            .from('sample_submissions')
            .select('*')
            .eq('npd_id', npdId)
            .order('submission_date', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('samplesContainer');
        
        if (!samples || samples.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-message">No sample submissions</div>
                    <div class="empty-state-subtext">Click "Add Sample" to record a submission</div>
                </div>
            `;
            return;
        }
        
        let samplesHTML = '';
        
        samples.forEach((sample, index) => {
            const statusClass = getSampleStatusClass(sample.status);
            
            samplesHTML += `
                <div class="dynamic-item" id="sample-${sample.id}">
                    <div class="item-header">
                        <h4 class="item-title">Sample Submission ${index + 1}</h4>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="item-status ${statusClass}">${sample.status || 'Submitted'}</span>
                            ${!sample.handover_done ? `
                                <button onclick="editItem('sample', '${sample.id}')" class="edit-btn">✏️</button>
                                <button onclick="deleteItem('sample', '${sample.id}')" class="delete-btn">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="item-details">
                        <div class="detail-group">
                            <div class="detail-label">Submission Date</div>
                            <div class="detail-value">${sample.submission_date ? formatDate(sample.submission_date) : '-'}</div>
                        </div>
                        
                        <div class="detail-group">
                            <div class="detail-label">Quantity</div>
                            <div class="detail-value">${sample.quantity || '0'}</div>
                        </div>
                        
                        <div class="detail-group">
                            <div class="detail-label">Approval Date</div>
                            <div class="detail-value">${sample.approval_date ? formatDate(sample.approval_date) : 'Pending'}</div>
                        </div>
                    </div>
                    
                    ${sample.deviation_details ? `
                        <div style="margin: 10px 0;">
                            <div class="detail-label">Deviation Details</div>
                            <div style="font-size: 14px; color: #4a5568;">${sample.deviation_details}</div>
                        </div>
                    ` : ''}
                    
                    ${sample.remarks ? `
                        <div class="remarks">${sample.remarks}</div>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = samplesHTML;
        
    } catch (error) {
        console.error('Error loading samples:', error);
        document.getElementById('samplesContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-message">Error loading samples</div>
            </div>
        `;
    }
}

// Load PPAP
async function loadPPAP(npdId) {
    try {
        const { data: ppap, error } = await window.supabaseClient
            .from('ppap_submissions')
            .select('*')
            .eq('npd_id', npdId)
            .order('submission_date', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('ppapContainer');
        
        if (!ppap || ppap.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-message">No PPAP submissions</div>
                    <div class="empty-state-subtext">Click "Add PPAP" to record a submission</div>
                </div>
            `;
            return;
        }
        
        let ppapHTML = '';
        
        ppap.forEach((ppapItem, index) => {
            const statusClass = getPPAPStatusClass(ppapItem.status);
            
            ppapHTML += `
                <div class="dynamic-item" id="ppap-${ppapItem.id}">
                    <div class="item-header">
                        <h4 class="item-title">PPAP Submission ${index + 1}</h4>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="item-status ${statusClass}">${ppapItem.status || 'Submitted'}</span>
                            ${!ppapItem.handover_done ? `
                                <button onclick="editItem('ppap', '${ppapItem.id}')" class="edit-btn">✏️</button>
                                <button onclick="deleteItem('ppap', '${ppapItem.id}')" class="delete-btn">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="item-details">
                        <div class="detail-group">
                            <div class="detail-label">Submission Date</div>
                            <div class="detail-value">${ppapItem.submission_date ? formatDate(ppapItem.submission_date) : '-'}</div>
                        </div>
                        
                        <div class="detail-group">
                            <div class="detail-label">Lot Quantity</div>
                            <div class="detail-value">${ppapItem.lot_quantity || '0'}</div>
                        </div>
                        
                        <div class="detail-group">
                            <div class="detail-label">PPAP Level</div>
                            <div class="detail-value">${ppapItem.ppap_level || '-'}</div>
                        </div>
                        
                        <div class="detail-group">
                            <div class="detail-label">Approval Date</div>
                            <div class="detail-value">${ppapItem.approval_date ? formatDate(ppapItem.approval_date) : 'Pending'}</div>
                        </div>
                    </div>
                    
                    ${ppapItem.document_urls && ppapItem.document_urls.length > 0 ? `
                        <div style="margin: 10px 0;">
                            <div class="detail-label">Documents</div>
                            <div>
                                ${ppapItem.document_urls.map((url, i) => `
                                    <a href="${url}" target="_blank" class="file-link" style="display: block; margin-bottom: 4px;">
                                        <span>📄</span>
                                        <span>Document ${i + 1}</span>
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${ppapItem.remarks ? `
                        <div class="remarks">${ppapItem.remarks}</div>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = ppapHTML;
        
    } catch (error) {
        console.error('Error loading PPAP:', error);
        document.getElementById('ppapContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-message">Error loading PPAP submissions</div>
            </div>
        `;
    }
}

// Load documents (updated with editing capability)
async function loadDocuments(npdId) {
    try {
        const { data: documents, error } = await window.supabaseClient
            .from('documents')
            .select('*')
            .eq('npd_id', npdId)
            .single();
        
        const container = document.getElementById('documentsContainer');
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (!documents) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <div class="empty-state-message">No documents uploaded</div>
                    <div class="empty-state-subtext">Click "Add Document" to upload required documents</div>
                </div>
            `;
            return;
        }
        
        let docsHTML = `
            <div class="dynamic-item">
                <div class="item-header">
                    <h4 class="item-title">NPD Documents</h4>
                    <button onclick="editDocuments('${documents.id}')" class="edit-btn">✏️ Edit</button>
                </div>
                <div class="item-details">
        `;
        
        const docTypes = [
            { key: 'ts_drawing', label: 'Latest TS Drawing', date: documents.ts_drawing_date, url: documents.ts_drawing_url },
            { key: 'rm_database', label: 'RM Database', date: documents.rm_database_date, url: documents.rm_database_url },
            { key: 'inspection_format', label: 'Inspection Report Format', date: documents.inspection_format_date, url: documents.inspection_format_url },
            { key: 'process_card', label: 'Manufacturing Process Card', date: documents.process_card_date, url: documents.process_card_url },
            { key: 'ppap_doc', label: 'PPAP Documents', date: documents.ppap_doc_date, url: documents.ppap_documents_url }
        ];
        
        docTypes.forEach(doc => {
            docsHTML += `
                <div class="detail-group">
                    <div class="detail-label">${doc.label}</div>
                    <div class="detail-value">
                        ${doc.date ? `<div style="margin-bottom: 4px;">Updated: ${formatDate(doc.date)}</div>` : ''}
                        ${doc.url ? `
                            <a href="${doc.url}" target="_blank" class="file-link" style="display: block; margin-bottom: 4px;">
                                📄 View Document
                            </a>
                        ` : 'Not uploaded'}
                    </div>
                </div>
            `;
        });
        
        docsHTML += `
                </div>
            </div>
        `;
        
        container.innerHTML = docsHTML;
        
    } catch (error) {
        console.error('Error loading documents:', error);
        document.getElementById('documentsContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-message">Error loading documents</div>
            </div>
        `;
    }
}

// Load handover
async function loadHandover(npdId) {
    try {
        const { data: npd, error } = await window.supabaseClient
            .from('npd_master')
            .select('handover_done, handover_date, handover_by, handover_to, handover_notes')
            .eq('id', npdId)
            .single();
        
        if (error) throw error;
        
        const container = document.getElementById('handoverContainer');
        
        if (npd.handover_done) {
            container.innerHTML = `
                <div class="dynamic-item">
                    <div class="item-header">
                        <h4 class="item-title">Handover Completed</h4>
                        <span class="item-status status-completed">Completed</span>
                    </div>
                    <div class="item-details">
                        <div class="detail-group">
                            <div class="detail-label">Handover Date</div>
                            <div class="detail-value">${npd.handover_date ? formatDate(npd.handover_date) : '-'}</div>
                        </div>
                        <div class="detail-group">
                            <div class="detail-label">Handover By</div>
                            <div class="detail-value">${npd.handover_by || '-'}</div>
                        </div>
                        <div class="detail-group">
                            <div class="detail-label">Handover To</div>
                            <div class="detail-value">${npd.handover_to || '-'}</div>
                        </div>
                    </div>
                    ${npd.handover_notes ? `
                        <div style="margin-top: 15px;">
                            <div class="detail-label">Handover Notes</div>
                            <div class="remarks">${npd.handover_notes}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📤</div>
                    <div class="empty-state-message">Handover not completed</div>
                    <div class="empty-state-subtext">Ready for production handover</div>
                    <button onclick="initiateHandover()" class="btn btn-primary" style="margin-top: 1rem;">Initiate Handover</button>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading handover info:', error);
        document.getElementById('handoverContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-message">Error loading handover information</div>
            </div>
        `;
    }
}

// State machine functions
async function updateStateMachine(npd) {
    const currentStage = npd.current_stage;
    let newStage = currentStage;
    
    try {
        switch(currentStage) {
            case 'CREATED':
                const { data: tools } = await window.supabaseClient
                    .from('tools')
                    .select('id')
                    .eq('npd_id', npd.id);
                
                if (tools && tools.length > 0) {
                    newStage = 'TOOLING_PLANNED';
                }
                break;
                
            case 'TOOLING_PLANNED':
                const { data: inProgressTools } = await window.supabaseClient
                    .from('tools')
                    .select('id')
                    .eq('npd_id', npd.id)
                    .eq('status', 'In Progress');
                
                if (inProgressTools && inProgressTools.length > 0) {
                    newStage = 'TOOLING_IN_PROGRESS';
                }
                break;
                
            case 'TOOLING_IN_PROGRESS':
                const { data: trials } = await window.supabaseClient
                    .from('trials')
                    .select('id')
                    .eq('npd_id', npd.id);
                
                if (trials && trials.length > 0) {
                    newStage = 'TRIAL_ONGOING';
                }
                break;
                
            case 'TRIAL_ONGOING':
                const { data: samples } = await window.supabaseClient
                    .from('sample_submissions')
                    .select('id')
                    .eq('npd_id', npd.id);
                
                if (samples && samples.length > 0) {
                    newStage = 'SAMPLE_SUBMITTED';
                }
                break;
                
            case 'SAMPLE_SUBMITTED':
                const { data: ppap } = await window.supabaseClient
                    .from('ppap_submissions')
                    .select('id')
                    .eq('npd_id', npd.id);
                
                if (ppap && ppap.length > 0) {
                    newStage = 'PPAP_SUBMITTED';
                }
                break;
                
            case 'PPAP_SUBMITTED':
                if (npd.handover_done) {
                    newStage = 'PRODUCTION_RELEASED';
                }
                break;
        }
        
        if (newStage !== currentStage) {
            await window.supabaseClient
                .from('npd_master')
                .update({ current_stage: newStage })
                .eq('id', npd.id);
                
            document.getElementById('currentStage').textContent = newStage.replace(/_/g, ' ');
            updateStateProgress(newStage);
        }
        
    } catch (error) {
        console.error('Error updating state:', error);
    }
}

function updateStateProgress(currentStage) {
    const states = [
        { id: 'CREATED', label: 'Created' },
        { id: 'TOOLING_PLANNED', label: 'Tooling Planned' },
        { id: 'TOOLING_IN_PROGRESS', label: 'Tooling in Progress' },
        { id: 'TRIAL_ONGOING', label: 'Trial Ongoing' },
        { id: 'SAMPLE_SUBMITTED', label: 'Sample Submitted' },
        { id: 'PPAP_SUBMITTED', label: 'PPAP Submitted' },
        { id: 'PRODUCTION_RELEASED', label: 'Production Released' }
    ];
    
    let progressHTML = '';
    let foundCurrent = false;
    
    states.forEach((state, index) => {
        let className = '';
        
        if (state.id === currentStage) {
            className = 'active';
            foundCurrent = true;
        } else if (foundCurrent) {
            className = '';
        } else {
            className = 'completed';
        }
        
        progressHTML += `
            <div class="state-step ${className}">
                <div class="state-circle">${index + 1}</div>
                <div class="state-label">${state.label}</div>
            </div>
        `;
    });
    
    const progressContainer = document.getElementById('stateProgress');
    if (progressContainer) {
        progressContainer.innerHTML = progressHTML;
    }
}

// Helper functions
function getToolStatusClass(status) {
    switch(status) {
        case 'Planned': return 'status-planned';
        case 'In Progress': return 'status-progress';
        case 'Approved':
        case 'Completed': return 'status-completed';
        default: return 'status-planned';
    }
}

function getGaugeStatusClass(status) {
    switch(status) {
        case 'Required':
        case 'Ordered': return 'status-planned';
        case 'In Progress': return 'status-progress';
        case 'Received':
        case 'Calibrated':
        case 'Completed': return 'status-completed';
        default: return 'status-planned';
    }
}

function getTrialStatusClass(status) {
    if (status?.includes('Completed')) return 'status-completed';
    if (status === 'In Progress') return 'status-progress';
    return 'status-planned';
}

function getSampleStatusClass(status) {
    if (status === 'Approved') return 'status-completed';
    if (status === 'Rejected') return 'status-progress';
    return 'status-planned';
}

function getPPAPStatusClass(status) {
    if (status === 'Approved') return 'status-completed';
    if (status === 'Rejected') return 'status-progress';
    return 'status-planned';
}

function checkIfDelayed(plannedDate, isNotCompleted = true) {
    if (!plannedDate || !isNotCompleted) return false;
    
    const today = new Date();
    const planned = new Date(plannedDate);
    
    return planned < today;
}

function formatDate(dateString) {
    if (!dateString) return 'Not set';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return 'Invalid date';
    }
}

function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h3>Error</h3>
                <p>${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem;">
                    <button onclick="location.reload()" class="btn btn-outline">Retry</button>
                    <a href="analytics.html" class="btn btn-primary">Back to Dashboard</a>
                </div>
            </div>
        `;
    }
}

function showToast(message) {
    // Create toast element if it doesn't exist
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #48bb78;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s ease;
            z-index: 1001;
        `;
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3000);
}

// Modal functions for adding/editing items
function addNewItem(type) {
    currentItemType = type;
    currentItemId = null;
    currentFormData = {};
    
    let modalTitle = '';
    let formHTML = '';
    
    switch(type) {
        case 'tool':
            modalTitle = 'Add New Tool';
            formHTML = getToolForm();
            break;
        case 'gauge':
            modalTitle = 'Add New Gauge';
            formHTML = getGaugeForm();
            break;
        case 'trial':
            modalTitle = 'Add New Trial';
            formHTML = getTrialForm();
            break;
        case 'sample':
            modalTitle = 'Add New Sample Submission';
            formHTML = getSampleForm();
            break;
        case 'ppap':
            modalTitle = 'Add New PPAP Submission';
            formHTML = getPPAPForm();
            break;
        case 'document':
            modalTitle = 'Add/Edit Documents';
            formHTML = getDocumentForm();
            break;
    }
    
    document.getElementById('modalTitle').textContent = modalTitle;
    document.getElementById('itemForm').innerHTML = formHTML;
    document.getElementById('itemModal').style.display = 'flex';
    
    setTimeout(() => {
        const firstInput = document.querySelector('#itemForm input, #itemForm select');
        if (firstInput) firstInput.focus();
    }, 100);
}

async function editItem(type, id) {
    currentItemType = type;
    currentItemId = id;
    currentFormData = {};
    
    showLoading();
    
    try {
        let data = null;
        let tableName = '';
        
        switch(type) {
            case 'tool':
                tableName = 'tools';
                break;
            case 'gauge':
                tableName = 'gauges';
                break;
            case 'trial':
                tableName = 'trials';
                break;
            case 'sample':
                tableName = 'sample_submissions';
                break;
            case 'ppap':
                tableName = 'ppap_submissions';
                break;
        }
        
        const { data: itemData, error } = await window.supabaseClient
            .from(tableName)
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        data = itemData;
        currentFormData = { ...data };
        
        let modalTitle = '';
        let formHTML = '';
        
        switch(type) {
            case 'tool':
                modalTitle = 'Edit Tool';
                formHTML = getToolForm(data);
                break;
            case 'gauge':
                modalTitle = 'Edit Gauge';
                formHTML = getGaugeForm(data);
                break;
            case 'trial':
                modalTitle = 'Edit Trial';
                formHTML = getTrialForm(data);
                break;
            case 'sample':
                modalTitle = 'Edit Sample Submission';
                formHTML = getSampleForm(data);
                break;
            case 'ppap':
                modalTitle = 'Edit PPAP Submission';
                formHTML = getPPAPForm(data);
                break;
        }
        
        document.getElementById('modalTitle').textContent = modalTitle;
        document.getElementById('itemForm').innerHTML = formHTML;
        document.getElementById('itemModal').style.display = 'flex';
        
        hideLoading();
        
    } catch (error) {
        console.error('Error loading item for edit:', error);
        alert('Failed to load item data. Please try again.');
        hideLoading();
    }
}

async function editDocuments(docId) {
    currentItemType = 'document';
    currentItemId = docId;
    
    showLoading();
    
    try {
        const { data: document, error } = await window.supabaseClient
            .from('documents')
            .select('*')
            .eq('id', docId)
            .single();
        
        if (error) throw error;
        
        currentFormData = { ...document };
        
        document.getElementById('modalTitle').textContent = 'Edit Documents';
        document.getElementById('itemForm').innerHTML = getDocumentForm(document);
        document.getElementById('itemModal').style.display = 'flex';
        
        hideLoading();
        
    } catch (error) {
        console.error('Error loading document:', error);
        alert('Failed to load document data. Please try again.');
        hideLoading();
    }
}

function initiateHandover() {
    currentItemType = 'handover';
    showHandoverForm();
}

function showHandoverForm() {
    document.getElementById('modalTitle').textContent = 'Complete Handover';
    document.getElementById('itemForm').innerHTML = getHandoverForm();
    document.getElementById('itemModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
    document.getElementById('itemForm').innerHTML = '';
    currentItemType = null;
    currentItemId = null;
    currentFormData = {};
}

async function saveItem() {
    if (currentItemType === 'handover') {
        await completeHandover();
        return;
    }
    
    const form = document.getElementById('itemForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    showLoading();
    
    try {
        let data = {};
        let tableName = '';
        
        switch(currentItemType) {
            case 'tool':
                tableName = 'tools';
                data = collectToolData();
                break;
            case 'gauge':
                tableName = 'gauges';
                data = collectGaugeData();
                break;
            case 'trial':
                tableName = 'trials';
                data = collectTrialData();
                break;
            case 'sample':
                tableName = 'sample_submissions';
                data = collectSampleData();
                break;
            case 'ppap':
                tableName = 'ppap_submissions';
                data = collectPPAPData();
                break;
            case 'document':
                tableName = 'documents';
                data = collectDocumentData();
                break;
        }
        
        data.npd_id = currentNPDId;
        
        let result;
        
        if (currentItemId) {
            result = await window.supabaseClient
                .from(tableName)
                .update(data)
                .eq('id', currentItemId);
        } else {
            result = await window.supabaseClient
                .from(tableName)
                .insert([data]);
        }
        
        if (result.error) throw result.error;
        
        closeModal();
        
        switch(currentItemType) {
            case 'tool':
                await loadTools(currentNPDId);
                break;
            case 'gauge':
                await loadGauges(currentNPDId);
                break;
            case 'trial':
                await loadTrials(currentNPDId);
                break;
            case 'sample':
                await loadSamples(currentNPDId);
                break;
            case 'ppap':
                await loadPPAP(currentNPDId);
                break;
            case 'document':
                await loadDocuments(currentNPDId);
                break;
        }
        
        const { data: npd } = await window.supabaseClient
            .from('npd_master')
            .select('*')
            .eq('id', currentNPDId)
            .single();
        
        if (npd) {
            await updateStateMachine(npd);
        }
        
        showToast(currentItemId ? 'Item updated successfully!' : 'Item added successfully!');
        
        hideLoading();
        
    } catch (error) {
        console.error('Error saving item:', error);
        alert('Failed to save item. Please try again.');
        hideLoading();
    }
}

async function completeHandover() {
    const handoverDate = document.getElementById('handoverDate');
    const handoverBy = document.getElementById('handoverBy');
    const handoverTo = document.getElementById('handoverTo');
    
    if (!handoverDate.value || !handoverBy.value || !handoverTo.value) {
        alert('Please fill all required fields');
        return;
    }
    
    const handoverData = {
        handover_date: handoverDate.value,
        handover_by: handoverBy.value,
        handover_to: handoverTo.value,
        handover_notes: document.getElementById('handoverNotes')?.value || '',
        handover_done: true,
        completion_date: new Date().toISOString().split('T')[0],
        current_stage: 'PRODUCTION_RELEASED'
    };
    
    const docs = document.getElementById('handoverDocs')?.value || '';
    const docUrls = docs.split(',').map(url => url.trim()).filter(url => url);
    
    showLoading();
    
    try {
        const { error: masterError } = await window.supabaseClient
            .from('npd_master')
            .update(handoverData)
            .eq('id', currentNPDId);
        
        if (masterError) throw masterError;
        
        if (docUrls.length > 0) {
            const { error: handoverError } = await window.supabaseClient
                .from('handover')
                .insert([{
                    npd_id: currentNPDId,
                    document_urls: docUrls,
                    handover_date: handoverData.handover_date,
                    handover_by: handoverData.handover_by,
                    handover_to: handoverData.handover_to,
                    handover_notes: handoverData.handover_notes
                }]);
            
            if (handoverError) throw handoverError;
        }
        
        closeModal();
        await loadHandover(currentNPDId);
        
        updateStateProgress('PRODUCTION_RELEASED');
        
        document.querySelectorAll('.add-btn, .edit-btn').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
        
        document.getElementById('readOnlyAlert').style.display = 'block';
        
        showToast('Handover completed successfully!');
        
        hideLoading();
        
    } catch (error) {
        console.error('Error completing handover:', error);
        alert('Failed to complete handover. Please try again.');
        hideLoading();
    }
}

// Data collection functions
function collectToolData() {
    return {
        tt_no: document.getElementById('ttNo').value,
        tool_type: document.getElementById('toolType').value,
        status: document.getElementById('toolStatus').value,
        planned_start_date: document.getElementById('plannedStartDate')?.value || null,
        planned_completion_date: document.getElementById('plannedCompletionDate')?.value || null,
        actual_start_date: document.getElementById('actualStartDate')?.value || null,
        actual_completion_date: document.getElementById('actualCompletionDate')?.value || null,
        tool_photo_url: document.getElementById('toolPhotoUrl')?.value || null,
        remarks: document.getElementById('toolRemarks')?.value || null
    };
}

function collectGaugeData() {
    return {
        gauge_no: document.getElementById('gaugeNo').value,
        gauge_type: document.getElementById('gaugeType').value,
        status: document.getElementById('gaugeStatus').value,
        start_date: document.getElementById('gaugeStartDate')?.value || null,
        completion_date: document.getElementById('gaugeCompletionDate')?.value || null,
        gauge_photo_url: document.getElementById('gaugePhotoUrl')?.value || null,
        remarks: document.getElementById('gaugeRemarks')?.value || null
    };
}

function collectTrialData() {
    return {
        trial_date: document.getElementById('trialDate').value,
        status: document.getElementById('trialStatus').value,
        description: document.getElementById('trialDescription')?.value || null,
        issues_found: document.getElementById('trialIssues')?.value || null,
        corrective_actions: document.getElementById('trialCorrectiveActions')?.value || null,
        report_url: document.getElementById('trialReportUrl')?.value || null,
        remarks: document.getElementById('trialRemarks')?.value || null
    };
}

function collectSampleData() {
    return {
        submission_date: document.getElementById('sampleDate').value,
        quantity: parseInt(document.getElementById('sampleQty').value),
        status: document.getElementById('sampleStatus').value,
        approval_date: document.getElementById('sampleApprovalDate')?.value || null,
        deviation_details: document.getElementById('sampleDeviation')?.value || null,
        remarks: document.getElementById('sampleRemarks')?.value || null
    };
}

function collectPPAPData() {
    return {
        submission_date: document.getElementById('ppapDate').value,
        lot_quantity: parseInt(document.getElementById('ppapQty').value),
        status: document.getElementById('ppapStatus').value,
        approval_date: document.getElementById('ppapApprovalDate')?.value || null,
        ppap_level: document.getElementById('ppapLevel')?.value || null,
        deviation_details: document.getElementById('ppapDeviation')?.value || null,
        remarks: document.getElementById('ppapRemarks')?.value || null
    };
}

function collectDocumentData() {
    return {
        ts_drawing_date: document.getElementById('tsDrawingDate')?.value || null,
        ts_drawing_url: document.getElementById('tsDrawingUrl')?.value || null,
        rm_database_date: document.getElementById('rmDatabaseDate')?.value || null,
        rm_database_url: document.getElementById('rmDatabaseUrl')?.value || null,
        inspection_format_date: document.getElementById('inspectionFormatDate')?.value || null,
        inspection_format_url: document.getElementById('inspectionFormatUrl')?.value || null,
        process_card_date: document.getElementById('processCardDate')?.value || null,
        process_card_url: document.getElementById('processCardUrl')?.value || null,
        ppap_doc_date: document.getElementById('ppapDocDate')?.value || null,
        ppap_documents_url: document.getElementById('ppapDocumentsUrl')?.value || null
    };
}

// Form templates
function getToolForm(data = {}) {
    return `
        <div class="form-group">
            <label>TT No *</label>
            <input type="text" class="form-control" id="ttNo" value="${data.tt_no || ''}" required>
        </div>
        <div class="form-group">
            <label>Tool Type *</label>
            <select class="form-control" id="toolType" required>
                <option value="">Select Type</option>
                <option value="Press Tool" ${data.tool_type === 'Press Tool' ? 'selected' : ''}>Press Tool</option>
                <option value="Fixture" ${data.tool_type === 'Fixture' ? 'selected' : ''}>Fixture</option>
                <option value="Mold" ${data.tool_type === 'Mold' ? 'selected' : ''}>Mold</option>
                <option value="Jig" ${data.tool_type === 'Jig' ? 'selected' : ''}>Jig</option>
                <option value="Other" ${data.tool_type === 'Other' ? 'selected' : ''}>Other</option>
            </select>
        </div>
        <div class="form-group">
            <label>Status</label>
            <select class="form-control" id="toolStatus">
                <option value="Planned" ${data.status === 'Planned' ? 'selected' : ''}>Planned</option>
                <option value="In Progress" ${data.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Trial" ${data.status === 'Trial' ? 'selected' : ''}>Trial</option>
                <option value="Approved" ${data.status === 'Approved' ? 'selected' : ''}>Approved</option>
                <option value="Completed" ${data.status === 'Completed' ? 'selected' : ''}>Completed</option>
            </select>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Planned Start Date</label>
                <input type="date" class="form-control" id="plannedStartDate" value="${data.planned_start_date || ''}">
            </div>
            <div class="form-group">
                <label>Planned Completion Date</label>
                <input type="date" class="form-control" id="plannedCompletionDate" value="${data.planned_completion_date || ''}">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Actual Start Date</label>
                <input type="date" class="form-control" id="actualStartDate" value="${data.actual_start_date || ''}">
            </div>
            <div class="form-group">
                <label>Actual Completion Date</label>
                <input type="date" class="form-control" id="actualCompletionDate" value="${data.actual_completion_date || ''}">
            </div>
        </div>
        <div class="form-group">
            <label>Tool Photo URL</label>
            <input type="text" class="form-control" id="toolPhotoUrl" value="${data.tool_photo_url || ''}" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Remarks</label>
            <textarea class="form-control" id="toolRemarks" rows="3">${data.remarks || ''}</textarea>
        </div>
    `;
}

function getGaugeForm(data = {}) {
    return `
        <div class="form-group">
            <label>Gauge No *</label>
            <input type="text" class="form-control" id="gaugeNo" value="${data.gauge_no || ''}" required>
        </div>
        <div class="form-group">
            <label>Gauge Type *</label>
            <select class="form-control" id="gaugeType" required>
                <option value="">Select Type</option>
                <option value="Vernier Caliper" ${data.gauge_type === 'Vernier Caliper' ? 'selected' : ''}>Vernier Caliper</option>
                <option value="Micrometer" ${data.gauge_type === 'Micrometer' ? 'selected' : ''}>Micrometer</option>
                <option value="Height Gauge" ${data.gauge_type === 'Height Gauge' ? 'selected' : ''}>Height Gauge</option>
                <option value="Plug Gauge" ${data.gauge_type === 'Plug Gauge' ? 'selected' : ''}>Plug Gauge</option>
                <option value="Other" ${data.gauge_type === 'Other' ? 'selected' : ''}>Other</option>
            </select>
        </div>
        <div class="form-group">
            <label>Status</label>
            <select class="form-control" id="gaugeStatus">
                <option value="Required" ${data.status === 'Required' ? 'selected' : ''}>Required</option>
                <option value="Ordered" ${data.status === 'Ordered' ? 'selected' : ''}>Ordered</option>
                <option value="In Progress" ${data.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Received" ${data.status === 'Received' ? 'selected' : ''}>Received</option>
                <option value="Calibrated" ${data.status === 'Calibrated' ? 'selected' : ''}>Calibrated</option>
                <option value="Completed" ${data.status === 'Completed' ? 'selected' : ''}>Completed</option>
            </select>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Start Date</label>
                <input type="date" class="form-control" id="gaugeStartDate" value="${data.start_date || ''}">
            </div>
            <div class="form-group">
                <label>Completion Date</label>
                <input type="date" class="form-control" id="gaugeCompletionDate" value="${data.completion_date || ''}">
            </div>
        </div>
        <div class="form-group">
            <label>Gauge Photo URL</label>
            <input type="text" class="form-control" id="gaugePhotoUrl" value="${data.gauge_photo_url || ''}" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Remarks</label>
            <textarea class="form-control" id="gaugeRemarks" rows="3">${data.remarks || ''}</textarea>
        </div>
    `;
}

function getTrialForm(data = {}) {
    return `
        <div class="form-group">
            <label>Trial Date *</label>
            <input type="date" class="form-control" id="trialDate" value="${data.trial_date || ''}" required>
        </div>
        <div class="form-group">
            <label>Status *</label>
            <select class="form-control" id="trialStatus" required>
                <option value="">Select Status</option>
                <option value="Scheduled" ${data.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
                <option value="In Progress" ${data.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Completed - Success" ${data.status === 'Completed - Success' ? 'selected' : ''}>Completed - Success</option>
                <option value="Completed - Issues" ${data.status === 'Completed - Issues' ? 'selected' : ''}>Completed - Issues</option>
                <option value="On Hold" ${data.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
                <option value="Cancelled" ${data.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea class="form-control" id="trialDescription" rows="2">${data.description || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Issues Found</label>
            <textarea class="form-control" id="trialIssues" rows="3">${data.issues_found || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Corrective Actions</label>
            <textarea class="form-control" id="trialCorrectiveActions" rows="3">${data.corrective_actions || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Report URL</label>
            <input type="text" class="form-control" id="trialReportUrl" value="${data.report_url || ''}" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Remarks</label>
            <textarea class="form-control" id="trialRemarks" rows="3">${data.remarks || ''}</textarea>
        </div>
    `;
}

function getSampleForm(data = {}) {
    return `
        <div class="form-group">
            <label>Submission Date *</label>
            <input type="date" class="form-control" id="sampleDate" value="${data.submission_date || ''}" required>
        </div>
        <div class="form-group">
            <label>Quantity *</label>
            <input type="number" class="form-control" id="sampleQty" value="${data.quantity || ''}" min="1" required>
        </div>
        <div class="form-group">
            <label>Status *</label>
            <select class="form-control" id="sampleStatus" required>
                <option value="">Select Status</option>
                <option value="Submitted" ${data.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
                <option value="Approved" ${data.status === 'Approved' ? 'selected' : ''}>Approved</option>
                <option value="Under Deviation" ${data.status === 'Under Deviation' ? 'selected' : ''}>Under Deviation</option>
                <option value="Rejected" ${data.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                <option value="Pending Review" ${data.status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
            </select>
        </div>
        <div class="form-group">
            <label>Approval Date</label>
            <input type="date" class="form-control" id="sampleApprovalDate" value="${data.approval_date || ''}">
        </div>
        <div class="form-group">
            <label>Deviation Details</label>
            <textarea class="form-control" id="sampleDeviation" rows="3">${data.deviation_details || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Remarks</label>
            <textarea class="form-control" id="sampleRemarks" rows="3">${data.remarks || ''}</textarea>
        </div>
    `;
}

function getPPAPForm(data = {}) {
    return `
        <div class="form-group">
            <label>Submission Date *</label>
            <input type="date" class="form-control" id="ppapDate" value="${data.submission_date || ''}" required>
        </div>
        <div class="form-group">
            <label>Lot Quantity *</label>
            <input type="number" class="form-control" id="ppapQty" value="${data.lot_quantity || ''}" min="1" required>
        </div>
        <div class="form-group">
            <label>Status *</label>
            <select class="form-control" id="ppapStatus" required>
                <option value="">Select Status</option>
                <option value="Submitted" ${data.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
                <option value="Approved" ${data.status === 'Approved' ? 'selected' : ''}>Approved</option>
                <option value="Under Deviation" ${data.status === 'Under Deviation' ? 'selected' : ''}>Under Deviation</option>
                <option value="Rejected" ${data.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                <option value="Pending Review" ${data.status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
            </select>
        </div>
        <div class="form-group">
            <label>PPAP Level</label>
            <select class="form-control" id="ppapLevel">
                <option value="">Select Level</option>
                <option value="Level 1" ${data.ppap_level === 'Level 1' ? 'selected' : ''}>Level 1</option>
                <option value="Level 2" ${data.ppap_level === 'Level 2' ? 'selected' : ''}>Level 2</option>
                <option value="Level 3" ${data.ppap_level === 'Level 3' ? 'selected' : ''}>Level 3</option>
                <option value="Level 4" ${data.ppap_level === 'Level 4' ? 'selected' : ''}>Level 4</option>
                <option value="Level 5" ${data.ppap_level === 'Level 5' ? 'selected' : ''}>Level 5</option>
            </select>
        </div>
        <div class="form-group">
            <label>Approval Date</label>
            <input type="date" class="form-control" id="ppapApprovalDate" value="${data.approval_date || ''}">
        </div>
        <div class="form-group">
            <label>Deviation Details</label>
            <textarea class="form-control" id="ppapDeviation" rows="3">${data.deviation_details || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Remarks</label>
            <textarea class="form-control" id="ppapRemarks" rows="3">${data.remarks || ''}</textarea>
        </div>
    `;
}

function getDocumentForm(data = {}) {
    const today = new Date().toISOString().split('T')[0];
    return `
        <div class="form-group">
            <label>TS Drawing URL</label>
            <input type="text" class="form-control" id="tsDrawingUrl" value="${data.ts_drawing_url || ''}" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>TS Drawing Date</label>
            <input type="date" class="form-control" id="tsDrawingDate" value="${data.ts_drawing_date || today}">
        </div>
        
        <div class="form-group">
            <label>RM Database URL</label>
            <input type="text" class="form-control" id="rmDatabaseUrl" value="${data.rm_database_url || ''}" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>RM Database Date</label>
            <input type="date" class="form-control" id="rmDatabaseDate" value="${data.rm_database_date || today}">
        </div>
        
        <div class="form-group">
            <label>Inspection Format URL</label>
            <input type="text" class="form-control" id="inspectionFormatUrl" value="${data.inspection_format_url || ''}" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Inspection Format Date</label>
            <input type="date" class="form-control" id="inspectionFormatDate" value="${data.inspection_format_date || today}">
        </div>
        
        <div class="form-group">
            <label>Process Card URL</label>
            <input type="text" class="form-control" id="processCardUrl" value="${data.process_card_url || ''}" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Process Card Date</label>
            <input type="date" class="form-control" id="processCardDate" value="${data.process_card_date || today}">
        </div>
        
        <div class="form-group">
            <label>PPAP Documents URL</label>
            <input type="text" class="form-control" id="ppapDocumentsUrl" value="${data.ppap_documents_url || ''}" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>PPAP Documents Date</label>
            <input type="date" class="form-control" id="ppapDocDate" value="${data.ppap_doc_date || today}">
        </div>
    `;
}

function getHandoverForm() {
    return `
        <div class="form-group">
            <label>Handover Date *</label>
            <input type="date" class="form-control" id="handoverDate" required value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
            <label>Handover By *</label>
            <input type="text" class="form-control" id="handoverBy" required placeholder="Person initiating handover">
        </div>
        <div class="form-group">
            <label>Handover To *</label>
            <input type="text" class="form-control" id="handoverTo" required placeholder="Production department/Person">
        </div>
        <div class="form-group">
            <label>Handover Notes</label>
            <textarea class="form-control" id="handoverNotes" rows="4" placeholder="Important notes for production..."></textarea>
        </div>
        <div class="form-group">
            <label>Attach Documents (URLs, comma separated)</label>
            <textarea class="form-control" id="handoverDocs" rows="3" placeholder="https://doc1.pdf, https://doc2.pdf"></textarea>
        </div>
    `;
}

// Delete item function
async function deleteItem(type, id) {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
        return;
    }
    
    showLoading();
    
    try {
        let tableName = '';
        
        switch(type) {
            case 'tool':
                tableName = 'tools';
                break;
            case 'gauge':
                tableName = 'gauges';
                break;
            case 'trial':
                tableName = 'trials';
                break;
            case 'sample':
                tableName = 'sample_submissions';
                break;
            case 'ppap':
                tableName = 'ppap_submissions';
                break;
        }
        
        const { error } = await window.supabaseClient
            .from(tableName)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        switch(type) {
            case 'tool':
                await loadTools(currentNPDId);
                break;
            case 'gauge':
                await loadGauges(currentNPDId);
                break;
            case 'trial':
                await loadTrials(currentNPDId);
                break;
            case 'sample':
                await loadSamples(currentNPDId);
                break;
            case 'ppap':
                await loadPPAP(currentNPDId);
                break;
        }
        
        const { data: npd } = await window.supabaseClient
            .from('npd_master')
            .select('*')
            .eq('id', currentNPDId)
            .single();
        
        if (npd) {
            await updateStateMachine(npd);
        }
        
        showToast('Item deleted successfully!');
        
        hideLoading();
        
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item. Please try again.');
        hideLoading();
    }
}