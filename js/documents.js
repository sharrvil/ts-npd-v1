document.addEventListener('DOMContentLoaded', function() {
    loadAllDocuments();
    loadRecentUploads();
    
    // Initialize search with debounce
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(searchDocuments, 300);
    });
});

async function loadAllDocuments() {
    try {
        showLoading('documentsList');
        
        // Get all NPDs with their documents
        const { data: npds, error: npdError } = await supabaseClient
            .from('npd_master')
            .select('id, npd_no, ts_part_no, customer, drawing_url')
            .order('created_at', { ascending: false });
        
        if (npdError) throw npdError;
        
        // Get internal documents
        const { data: internalDocs, error: docError } = await supabaseClient
            .from('internal_documents')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (docError) throw docError;
        
        // Get tools with photos
        const { data: tools, error: toolError } = await supabaseClient
            .from('tools')
            .select('npd_id, tool_photo_url, tt_no, tool_type')
            .not('tool_photo_url', 'is', null);
        
        if (toolError) throw toolError;
        
        // Get trial reports
        const { data: trials, error: trialError } = await supabaseClient
            .from('trials')
            .select('npd_id, trial_report_url, trial_no')
            .not('trial_report_url', 'is', null);
        
        if (trialError) throw trialError;
        
        // Get PPAP documents
        const { data: ppapDocs, error: ppapError } = await supabaseClient
            .from('ppap_submissions')
            .select('npd_id, ppap_document_url, submission_no')
            .not('ppap_document_url', 'is', null);
        
        if (ppapError) throw ppapError;
        
        // Combine all documents
        const allDocuments = [];
        
        // Add drawings from NPD master
        npds.forEach(npds => {
            if (npds.drawing_url) {
                allDocuments.push({
                    type: 'drawing',
                    npd_id: npds.id,
                    npd_no: npds.npd_no,
                    ts_part_no: npds.ts_part_no,
                    customer: npds.customer,
                    url: npds.drawing_url,
                    name: `Drawing - ${npds.ts_part_no}`,
                    date: null,
                    version: null,
                    uploader: null
                });
            }
        });
        
        // Add tool photos
        tools.forEach(tool => {
            const npd = npds.find(n => n.id === tool.npd_id);
            if (npd) {
                allDocuments.push({
                    type: 'tool',
                    npd_id: tool.npd_id,
                    npd_no: npd.npd_no,
                    ts_part_no: npd.ts_part_no,
                    customer: npd.customer,
                    url: tool.tool_photo_url,
                    name: `Tool Photo - ${tool.tt_no} (${tool.tool_type})`,
                    date: null,
                    version: null,
                    uploader: null
                });
            }
        });
        
        // Add trial reports
        trials.forEach(trial => {
            const npd = npds.find(n => n.id === trial.npd_id);
            if (npd) {
                allDocuments.push({
                    type: 'trial',
                    npd_id: trial.npd_id,
                    npd_no: npd.npd_no,
                    ts_part_no: npd.ts_part_no,
                    customer: npd.customer,
                    url: trial.trial_report_url,
                    name: `Trial Report - ${trial.trial_no}`,
                    date: null,
                    version: null,
                    uploader: null
                });
            }
        });
        
        // Add PPAP documents
        ppapDocs.forEach(ppap => {
            const npd = npds.find(n => n.id === ppap.npd_id);
            if (npd) {
                allDocuments.push({
                    type: 'ppap',
                    npd_id: ppap.npd_id,
                    npd_no: npd.npd_no,
                    ts_part_no: npd.ts_part_no,
                    customer: npd.customer,
                    url: ppap.ppap_document_url,
                    name: `PPAP Document - ${ppap.submission_no}`,
                    date: null,
                    version: null,
                    uploader: null
                });
            }
        });
        
        // Add internal documents
        internalDocs.forEach(doc => {
            const npd = npds.find(n => n.id === doc.npd_id);
            if (npd) {
                allDocuments.push({
                    type: 'internal',
                    npd_id: doc.npd_id,
                    npd_no: npd.npd_no,
                    ts_part_no: npd.ts_part_no,
                    customer: npd.customer,
                    url: doc.document_url,
                    name: `${doc.document_type}`,
                    date: doc.updated_date,
                    version: doc.version,
                    uploader: doc.uploaded_by
                });
            }
        });
        
        // Store for filtering
        window.allDocuments = allDocuments;
        
        renderDocuments(allDocuments);
        
    } catch (error) {
        console.error('Error loading documents:', error);
        showError('documentsList', 'Failed to load documents');
    }
}

function renderDocuments(documents) {
    const container = document.getElementById('documentsList');
    
    if (documents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <h3>No documents found</h3>
                <p>Upload your first document to get started</p>
            </div>
        `;
        return;
    }
    
    let documentsHTML = '';
    
    documents.forEach(doc => {
        const icon = getDocumentIcon(doc.type);
        const typeBadge = getTypeBadge(doc.type);
        
        documentsHTML += `
            <div class="document-card">
                <div class="document-info">
                    <div class="document-icon">${icon}</div>
                    <div style="flex: 1;">
                        <h4 style="margin-bottom: 0.25rem;">${doc.name}</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.875rem; color: var(--secondary-color);">
                            <span>NPD: ${doc.npd_no}</span>
                            <span>Part: ${doc.ts_part_no}</span>
                            <span>Customer: ${doc.customer}</span>
                            ${doc.version ? `<span>Version: ${doc.version}</span>` : ''}
                            ${doc.date ? `<span>Date: ${new Date(doc.date).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                    <div class="document-actions">
                        ${typeBadge}
                        <a href="${doc.url}" target="_blank" class="btn btn-primary btn-sm">View</a>
                        <a href="${doc.url}" download class="btn btn-outline btn-sm">Download</a>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = documentsHTML;
}

function filterDocuments(type) {
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.type === type) {
            tab.classList.add('active');
        }
    });
    
    if (!window.allDocuments) return;
    
    let filtered = window.allDocuments;
    
    if (type !== 'all') {
        filtered = window.allDocuments.filter(doc => doc.type === type);
    }
    
    renderDocuments(filtered);
}

function searchDocuments() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!window.allDocuments) return;
    
    if (!searchTerm.trim()) {
        const activeTab = document.querySelector('.filter-tab.active').dataset.type;
        filterDocuments(activeTab);
        return;
    }
    
    const filtered = window.allDocuments.filter(doc => 
        doc.npd_no.toLowerCase().includes(searchTerm) ||
        doc.ts_part_no.toLowerCase().includes(searchTerm) ||
        doc.customer.toLowerCase().includes(searchTerm) ||
        doc.name.toLowerCase().includes(searchTerm) ||
        (doc.type && doc.type.toLowerCase().includes(searchTerm))
    );
    
    renderDocuments(filtered);
}

function getDocumentIcon(type) {
    const icons = {
        'drawing': '📐',
        'tool': '⚙️',
        'trial': '📋',
        'ppap': '📊',
        'internal': '📑',
        'default': '📄'
    };
    
    return icons[type] || icons.default;
}

function getTypeBadge(type) {
    const labels = {
        'drawing': 'Drawing',
        'tool': 'Tool Photo',
        'trial': 'Trial Report',
        'ppap': 'PPAP',
        'internal': 'Internal Doc'
    };
    
    const label = labels[type] || type;
    return `<span class="status-badge status-pending">${label}</span>`;
}

async function loadRecentUploads() {
    try {
        // Get recent documents from internal_documents table
        const { data: recentDocs, error } = await supabaseClient
            .from('internal_documents')
            .select('*, npd_master(npd_no, ts_part_no)')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        const container = document.getElementById('recentUploads');
        
        if (!recentDocs || recentDocs.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--secondary-color);">No recent uploads</p>';
            return;
        }
        
        let html = '<div style="display: flex; flex-direction: column; gap: 0.75rem;">';
        
        recentDocs.forEach(doc => {
            const npd = doc.npd_master;
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: #f8fafc; border-radius: 6px;">
                    <div>
                        <strong>${doc.document_type}</strong>
                        <div style="font-size: 0.875rem; color: var(--secondary-color);">
                            ${npd?.npd_no || 'N/A'} • ${npd?.ts_part_no || 'N/A'}
                        </div>
                    </div>
                    <div style="font-size: 0.875rem; color: var(--secondary-color);">
                        ${new Date(doc.created_at).toLocaleDateString()}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading recent uploads:', error);
    }
}

async function loadNPDsForSelect() {
    try {
        const { data: npds, error } = await supabaseClient
            .from('npd_master')
            .select('id, npd_no, ts_part_no')
            .order('npd_no', { ascending: false });
        
        if (error) throw error;
        
        const select = document.getElementById('npdSelect');
        select.innerHTML = '<option value="">Choose NPD...</option>';
        
        npds.forEach(npds => {
            const option = document.createElement('option');
            option.value = npds.id;
            option.textContent = `${npds.npd_no} - ${npds.ts_part_no}`;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading NPDs:', error);
    }
}

async function uploadDocument() {
    const npdId = document.getElementById('npdSelect').value;
    const docType = document.getElementById('docType').value;
    const customType = document.getElementById('customType').value;
    const version = document.getElementById('docVersion').value;
    const remarks = document.getElementById('docRemarks').value;
    const fileInput = document.getElementById('docFile');
    
    if (!npdId || !docType || !fileInput.files.length) {
        alert('Please fill all required fields and select a file');
        return;
    }
    
    const finalDocType = docType === 'other' ? customType : docType;
    
    try {
        // Upload file to Supabase Storage
        const file = fileInput.files[0];
        const filePath = `internal-docs/${npdId}/${Date.now()}_${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('internal-docs')
            .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('internal-docs')
            .getPublicUrl(filePath);
        
        // Save to internal_documents table
        const docData = {
            npd_id: npdId,
            document_type: finalDocType,
            document_url: urlData.publicUrl,
            version: version || null,
            updated_date: new Date().toISOString().split('T')[0],
            uploaded_by: 'System User', // In real app, get from session
            remarks: remarks || null
        };
        
        const { error: insertError } = await supabaseClient
            .from('internal_documents')
            .insert([docData]);
        
        if (insertError) throw insertError;
        
        alert('Document uploaded successfully!');
        closeModal();
        
        // Reset form
        document.getElementById('uploadForm').reset();
        document.getElementById('docFileList').innerHTML = '';
        document.getElementById('customTypeContainer').style.display = 'none';
        
        // Reload documents
        loadAllDocuments();
        loadRecentUploads();
        
    } catch (error) {
        console.error('Error uploading document:', error);
        alert('Error uploading document: ' + error.message);
    }
}

function showLoading(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div style="display: inline-block; width: 40px; height: 40px; border: 3px solid var(--border-color); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <p style="margin-top: 1rem; color: var(--secondary-color);">Loading documents...</p>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--danger-color);">
            <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
            <p>${message}</p>
            <button onclick="location.reload()" class="btn btn-outline" style="margin-top: 1rem;">Retry</button>
        </div>
    `;
}