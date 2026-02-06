// Global variables
let supabaseInitialized = false;
let allDocuments = [];

// Initialize application
async function initializeApp() {
    try {
        console.log('🔧 Initializing application...');
        
        // Check if supabaseClient exists
        if (typeof supabaseClient === 'undefined') {
            console.error('❌ Supabase client not loaded');
            showError('documentsList', 'Database connection not configured. Please check supabase-config.js');
            return;
        }
        
        // Test connection with a simple query
        const { data, error } = await supabaseClient
            .from('npd_master')
            .select('count')
            .limit(1);
        
        if (error) {
            console.error('❌ Supabase connection error:', error);
            showError('documentsList', `Database connection failed: ${error.message}. Please check your Supabase configuration.`);
            return;
        }
        
        supabaseInitialized = true;
        console.log('✅ Supabase initialized successfully');
        
        // Load initial data
        await loadAllDocuments();
        await loadRecentUploads();
        
    } catch (error) {
        console.error('❌ Initialization error:', error);
        showError('documentsList', `Failed to initialize: ${error.message}`);
    }
}

// DOM Content Loaded event
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM loaded, initializing app...');
    
    // Initialize the app
    initializeApp();
    
    // Setup search with debounce
    let searchTimeout;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(searchDocuments, 300);
        });
    }
    
    // Setup modal event listeners
    setupModalListeners();
});

// Setup modal and file upload listeners
function setupModalListeners() {
    const uploadBtn = document.getElementById('uploadDocumentBtn');
    const modal = document.getElementById('uploadModal');
    const uploadArea = document.getElementById('docUploadArea');
    const fileInput = document.getElementById('docFile');
    const docTypeSelect = document.getElementById('docType');
    
    // Open modal button
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
            if (!supabaseInitialized) {
                alert('Please wait for database connection to initialize.');
                return;
            }
            modal.style.display = 'flex';
            loadNPDsForSelect();
        });
    }
    
    // File upload area click
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
    }
    
    // File input change
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                const file = this.files[0];
                const fileList = document.getElementById('docFileList');
                if (fileList) {
                    fileList.innerHTML = `
                        <div class="file-item">
                            <span>📄</span>
                            <span>${file.name}</span>
                            <span>(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                    `;
                }
                
                // Validate file size (20MB limit)
                const maxSize = 20 * 1024 * 1024; // 20MB in bytes
                if (file.size > maxSize) {
                    alert('File size exceeds 20MB limit. Please choose a smaller file.');
                    this.value = '';
                    if (fileList) fileList.innerHTML = '';
                }
            }
        });
    }
    
    // Document type change
    if (docTypeSelect) {
        docTypeSelect.addEventListener('change', function() {
            const customContainer = document.getElementById('customTypeContainer');
            if (customContainer) {
                customContainer.style.display = this.value === 'other' ? 'block' : 'none';
            }
        });
    }
    
    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }
    
    // Close button
    const closeBtn = modal?.querySelector('button[onclick="closeModal()"]');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Cancel button in modal footer
    const cancelBtn = modal?.querySelector('.btn-outline');
    if (cancelBtn && !cancelBtn.onclick) {
        cancelBtn.addEventListener('click', closeModal);
    }
}

// Load all documents from various tables
async function loadAllDocuments() {
    if (!supabaseInitialized) {
        console.warn('⚠️ Supabase not initialized, skipping loadAllDocuments');
        return;
    }
    
    try {
        console.log('📂 Loading all documents...');
        showLoading('documentsList');
        
        // Get all NPDs first
        const { data: npds, error: npdError } = await supabaseClient
            .from('npd_master')
            .select('id, npd_no, ts_part_no, customer, drawing_url, created_at')
            .order('created_at', { ascending: false });
        
        if (npdError) {
            console.error('NPD query error:', npdError);
            throw npdError;
        }
        
        console.log(`📊 Found ${npds?.length || 0} NPDs`);
        
        // Initialize documents array
        const documents = [];
        
        // Add drawings from NPD master
        if (npds && npds.length > 0) {
            npds.forEach(npd => {
                if (npd.drawing_url) {
                    documents.push({
                        type: 'drawing',
                        npd_id: npd.id,
                        npd_no: npd.npd_no || 'N/A',
                        ts_part_no: npd.ts_part_no || 'N/A',
                        customer: npd.customer || 'N/A',
                        url: npd.drawing_url,
                        name: `Drawing - ${npd.ts_part_no || npd.npd_no}`,
                        date: npd.created_at ? new Date(npd.created_at).toLocaleDateString() : null,
                        version: null,
                        uploader: null,
                        file_name: npd.drawing_url.split('/').pop() || 'drawing.pdf'
                    });
                }
            });
        }
        
        // Get internal documents
        const { data: internalDocs, error: docError } = await supabaseClient
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (docError) {
            console.error('Internal docs error:', docError);
        } else {
            console.log(`📄 Found ${internalDocs?.length || 0} internal documents`);
            
            // Add internal documents
            if (internalDocs && internalDocs.length > 0) {
                internalDocs.forEach(doc => {
                    const npd = npds?.find(n => n.id === doc.npd_id);
                    documents.push({
                        type: 'internal',
                        npd_id: doc.npd_id,
                        npd_no: npd?.npd_no || 'N/A',
                        ts_part_no: npd?.ts_part_no || 'N/A',
                        customer: npd?.customer || 'N/A',
                        url: doc.document_url,
                        name: `${doc.document_type || 'Internal Document'}`,
                        date: doc.updated_date || doc.created_at ? new Date(doc.updated_date || doc.created_at).toLocaleDateString() : null,
                        version: doc.version || null,
                        uploader: doc.uploaded_by || 'System',
                        file_name: doc.document_url?.split('/').pop() || 'document.pdf',
                        remarks: doc.remarks
                    });
                });
            }
        }
        
        // Try to load optional tables (they might not exist yet)
        try {
            // Get tools with photos
            const { data: tools, error: toolError } = await supabaseClient
                .from('tools')
                .select('npd_id, tool_photo_url, tt_no, tool_type, created_at')
                .not('tool_photo_url', 'is', null);
            
            if (!toolError && tools && tools.length > 0) {
                console.log(`⚙️ Found ${tools.length} tool photos`);
                tools.forEach(tool => {
                    const npd = npds?.find(n => n.id === tool.npd_id);
                    if (npd) {
                        documents.push({
                            type: 'tool',
                            npd_id: tool.npd_id,
                            npd_no: npd.npd_no,
                            ts_part_no: npd.ts_part_no,
                            customer: npd.customer,
                            url: tool.tool_photo_url,
                            name: `Tool Photo - ${tool.tt_no || 'N/A'} (${tool.tool_type || 'N/A'})`,
                            date: tool.created_at ? new Date(tool.created_at).toLocaleDateString() : null,
                            version: null,
                            uploader: null,
                            file_name: tool.tool_photo_url?.split('/').pop() || 'tool_photo.jpg'
                        });
                    }
                });
            }
        } catch (toolError) {
            console.warn('⚠️ Could not load tools table:', toolError.message);
        }
        
        try {
            // Get trial reports
            const { data: trials, error: trialError } = await supabaseClient
                .from('trials')
                .select('npd_id, trial_report_url, trial_no, created_at')
                .not('trial_report_url', 'is', null);
            
            if (!trialError && trials && trials.length > 0) {
                console.log(`📋 Found ${trials.length} trial reports`);
                trials.forEach(trial => {
                    const npd = npds?.find(n => n.id === trial.npd_id);
                    if (npd) {
                        documents.push({
                            type: 'trial',
                            npd_id: trial.npd_id,
                            npd_no: npd.npd_no,
                            ts_part_no: npd.ts_part_no,
                            customer: npd.customer,
                            url: trial.trial_report_url,
                            name: `Trial Report - ${trial.trial_no || 'N/A'}`,
                            date: trial.created_at ? new Date(trial.created_at).toLocaleDateString() : null,
                            version: null,
                            uploader: null,
                            file_name: trial.trial_report_url?.split('/').pop() || 'trial_report.pdf'
                        });
                    }
                });
            }
        } catch (trialError) {
            console.warn('⚠️ Could not load trials table:', trialError.message);
        }
        
        try {
            // Get PPAP documents
            const { data: ppapDocs, error: ppapError } = await supabaseClient
                .from('ppap_submissions')
                .select('npd_id, ppap_document_url, submission_no, created_at')
                .not('ppap_document_url', 'is', null);
            
            if (!ppapError && ppapDocs && ppapDocs.length > 0) {
                console.log(`📊 Found ${ppapDocs.length} PPAP documents`);
                ppapDocs.forEach(ppap => {
                    const npd = npds?.find(n => n.id === ppap.npd_id);
                    if (npd) {
                        documents.push({
                            type: 'ppap',
                            npd_id: ppap.npd_id,
                            npd_no: npd.npd_no,
                            ts_part_no: npd.ts_part_no,
                            customer: npd.customer,
                            url: ppap.ppap_document_url,
                            name: `PPAP Document - ${ppap.submission_no || 'N/A'}`,
                            date: ppap.created_at ? new Date(ppap.created_at).toLocaleDateString() : null,
                            version: null,
                            uploader: null,
                            file_name: ppap.ppap_document_url?.split('/').pop() || 'ppap_document.pdf'
                        });
                    }
                });
            }
        } catch (ppapError) {
            console.warn('⚠️ Could not load PPAP table:', ppapError.message);
        }
        
        // Store documents globally for filtering
        allDocuments = documents;
        console.log(`✅ Total documents loaded: ${documents.length}`);
        
        // Render documents
        renderDocuments(documents);
        
    } catch (error) {
        console.error('❌ Error loading documents:', error);
        showError('documentsList', `Failed to load documents: ${error.message}`);
    }
}

// Render documents to the page
function renderDocuments(documents) {
    const container = document.getElementById('documentsList');
    if (!container) {
        console.error('❌ documentsList container not found');
        return;
    }
    
    if (!documents || documents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <h3>No documents found</h3>
                <p>Upload your first document to get started</p>
                <button onclick="loadAllDocuments()" class="btn btn-outline" style="margin-top: 1rem;">Refresh</button>
            </div>
        `;
        return;
    }
    
    let documentsHTML = '';
    
    documents.forEach(doc => {
        const icon = getDocumentIcon(doc.type);
        const typeBadge = getTypeBadge(doc.type);
        const fileName = doc.file_name || doc.name;
        
        documentsHTML += `
            <div class="document-card">
                <div class="document-info">
                    <div class="document-icon">${icon}</div>
                    <div style="flex: 1; min-width: 0;">
                        <h4 style="margin-bottom: 0.25rem; word-break: break-word;">${doc.name}</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.875rem; color: var(--secondary-color); margin-bottom: 0.25rem;">
                            <span title="NPD Number"><strong>NPD:</strong> ${doc.npd_no}</span>
                            <span title="Part Number"><strong>Part:</strong> ${doc.ts_part_no}</span>
                            <span title="Customer"><strong>Customer:</strong> ${doc.customer}</span>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.8rem; color: #6b7280;">
                            ${doc.version ? `<span><strong>Version:</strong> ${doc.version}</span>` : ''}
                            ${doc.date ? `<span><strong>Date:</strong> ${doc.date}</span>` : ''}
                            ${doc.uploader ? `<span><strong>Uploaded by:</strong> ${doc.uploader}</span>` : ''}
                        </div>
                        ${doc.remarks ? `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem;"><strong>Remarks:</strong> ${doc.remarks}</div>` : ''}
                    </div>
                    <div class="document-actions">
                        ${typeBadge}
<a href="${doc.url}" target="_blank"
   class="btn btn-primary btn-sm"
   style="text-decoration: none;"
   title="View Document">
    <span class="icon">👁️</span> View
</a>

<a href="${doc.url}" download="${fileName}"
   class="btn btn-outline btn-sm"
   style="text-decoration: none;"
   title="Download Document">
    <span class="icon">⬇️</span> Download
</a>

                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = documentsHTML;
}

// Filter documents by type
function filterDocuments(type) {
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.type === type) {
            tab.classList.add('active');
        }
    });
    
    if (!allDocuments || allDocuments.length === 0) {
        showError('documentsList', 'No documents available to filter');
        return;
    }
    
    let filtered = allDocuments;
    
    if (type !== 'all') {
        filtered = allDocuments.filter(doc => doc.type === type);
    }
    
    renderDocuments(filtered);
}

// Search documents
function searchDocuments() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!allDocuments || allDocuments.length === 0) {
        return;
    }
    
    if (!searchTerm) {
        const activeTab = document.querySelector('.filter-tab.active')?.dataset.type || 'all';
        filterDocuments(activeTab);
        return;
    }
    
    const filtered = allDocuments.filter(doc => 
        (doc.npd_no && doc.npd_no.toLowerCase().includes(searchTerm)) ||
        (doc.ts_part_no && doc.ts_part_no.toLowerCase().includes(searchTerm)) ||
        (doc.customer && doc.customer.toLowerCase().includes(searchTerm)) ||
        (doc.name && doc.name.toLowerCase().includes(searchTerm)) ||
        (doc.type && doc.type.toLowerCase().includes(searchTerm)) ||
        (doc.uploader && doc.uploader.toLowerCase().includes(searchTerm)) ||
        (doc.remarks && doc.remarks.toLowerCase().includes(searchTerm))
    );
    
    renderDocuments(filtered);
}

// Load NPDs for the select dropdown
async function loadNPDsForSelect() {
    if (!supabaseInitialized) {
        console.warn('⚠️ Supabase not initialized, skipping loadNPDsForSelect');
        return;
    }
    
    try {
        console.log('📋 Loading NPDs for select dropdown...');
        
        const { data: npds, error } = await supabaseClient
            .from('npd_master')
            .select('id, npd_no, ts_part_no, customer')
            .order('npd_no', { ascending: false });
        
        if (error) {
            console.error('Error loading NPDs:', error);
            throw error;
        }
        
        const select = document.getElementById('npdSelect');
        if (!select) {
            console.error('❌ npdSelect element not found');
            return;
        }
        
        select.innerHTML = '<option value="">Choose NPD...</option>';
        
        if (!npds || npds.length === 0) {
            console.warn('⚠️ No NPDs found in database');
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No NPDs available - Create one first";
            option.disabled = true;
            select.appendChild(option);
            return;
        }
        
        console.log(`✅ Loaded ${npds.length} NPDs for dropdown`);
        
        npds.forEach(npd => {
            const option = document.createElement('option');
            option.value = npd.id;
            option.textContent = `${npd.npd_no} - ${npd.ts_part_no} (${npd.customer || 'No Customer'})`;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('❌ Error loading NPDs for select:', error);
        const select = document.getElementById('npdSelect');
        if (select) {
            select.innerHTML = '<option value="">Error loading NPDs</option>';
        }
    }
}

// Upload document function
async function uploadDocument() {
    if (!supabaseInitialized) {
        alert('Database connection not ready. Please try again.');
        return;
    }
    
    const npdId = document.getElementById('npdSelect')?.value;
    const docType = document.getElementById('docType')?.value;
    const customType = document.getElementById('customType')?.value;
    const version = document.getElementById('docVersion')?.value;
    const remarks = document.getElementById('docRemarks')?.value;
    const fileInput = document.getElementById('docFile');
    
    // Validation
    if (!npdId) {
        alert('Please select an NPD');
        return;
    }
    
    if (!docType) {
        alert('Please select a document type');
        return;
    }
    
    if (docType === 'other' && (!customType || customType.trim() === '')) {
        alert('Please specify the custom document type');
        return;
    }
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert('Please select a file to upload');
        return;
    }
    
    const finalDocType = docType === 'other' ? customType.trim() : docType;
    const file = fileInput.files[0];
    
    try {
        // Show loading state
        const uploadBtn = document.querySelector('#uploadModal .btn-primary');
        const originalText = uploadBtn?.textContent;
        if (uploadBtn) {
            uploadBtn.textContent = 'Uploading...';
            uploadBtn.disabled = true;
        }
        
        // Generate unique file path
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `internal-docs/${npdId}/${timestamp}_${safeFileName}`;
        
        console.log(`📤 Uploading file: ${file.name} to ${filePath}`);
        
        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('internal-docs')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`File upload failed: ${uploadError.message}`);
        }
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('internal-docs')
            .getPublicUrl(filePath);
        
        if (!urlData || !urlData.publicUrl) {
            throw new Error('Failed to get public URL for uploaded file');
        }
        
        // Get current user (in real app, get from auth session)
        const currentUser = 'System User'; // Replace with actual user from auth
        
        // Save to documents table
        const docData = {
            npd_id: npdId,
            document_type: finalDocType,
            document_url: urlData.publicUrl,
            version: version?.trim() || null,
            updated_date: new Date().toISOString().split('T')[0],
            uploaded_by: currentUser,
            remarks: remarks?.trim() || null
        };
        
        console.log('📝 Saving document metadata:', docData);
        
        const { error: insertError } = await supabaseClient
            .from('documents')
            .insert([docData]);
        
        if (insertError) {
            console.error('Insert error:', insertError);
            throw new Error(`Database save failed: ${insertError.message}`);
        }
        
        console.log('✅ Document uploaded successfully');
        
        // Success message
        alert('Document uploaded successfully!');
        
        // Close modal and reset form
        closeModal();
        
        // Reset form
        const form = document.getElementById('uploadForm');
        if (form) form.reset();
        
        const fileList = document.getElementById('docFileList');
        if (fileList) fileList.innerHTML = '';
        
        const customContainer = document.getElementById('customTypeContainer');
        if (customContainer) customContainer.style.display = 'none';
        
        // Reload data
        await Promise.all([
            loadAllDocuments(),
            loadRecentUploads()
        ]);
        
    } catch (error) {
        console.error('❌ Error uploading document:', error);
        alert(`Error uploading document: ${error.message}`);
    } finally {
        // Reset button state
        const uploadBtn = document.querySelector('#uploadModal .btn-primary');
        if (uploadBtn) {
            uploadBtn.textContent = originalText || 'Upload Document';
            uploadBtn.disabled = false;
        }
    }
}

// Load recent uploads
async function loadRecentUploads() {
    if (!supabaseInitialized) {
        return;
    }
    
    try {
        // Get recent documents from documents table
        const { data: recentDocs, error } = await supabaseClient
            .from('documents')
            .select('*, npd_master(npd_no, ts_part_no)')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) {
            console.error('Error loading recent uploads:', error);
            throw error;
        }
        
        const container = document.getElementById('recentUploads');
        if (!container) return;
        
        if (!recentDocs || recentDocs.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--secondary-color); padding: 1rem;">No recent uploads</p>';
            return;
        }
        
        let html = '<div style="display: flex; flex-direction: column; gap: 0.75rem;">';
        
        recentDocs.forEach(doc => {
            const npd = doc.npd_master;
            const docDate = new Date(doc.created_at).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            
html += `
<div style="display: flex; align-items: center; justify-content: space-between;
     padding: 0.75rem;
     background: rgba(255,255,255,0.04);
     border-radius: 12px;
     border: 1px solid var(--glass-border);
     border-left: 4px solid var(--accent-sky);">

     <div style="flex: 1;">
                        <strong style="display: block; margin-bottom: 0.25rem;">${doc.document_type}</strong>
                        <div style="font-size: 0.875rem; color: var(--secondary-color);">
                            ${npd?.npd_no || 'N/A'} • ${npd?.ts_part_no || 'N/A'}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.75rem; color: var(--secondary-color); margin-bottom: 0.25rem;">
                            ${doc.uploaded_by || 'System'}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--secondary-color);">
                            ${docDate}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading recent uploads:', error);
        const container = document.getElementById('recentUploads');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: var(--danger-color);">Error loading recent uploads</p>';
        }
    }
}

// Get document icon based on type
function getDocumentIcon(type) {
    const icons = {
        'drawing': '📐',
        'tool': '🔧',
        'trial': '📋',
        'ppap': '📊',
        'internal': '📄',
        'default': '📎'
    };
    
    return icons[type] || icons.default;
}

// Get type badge HTML
function getTypeBadge(type) {
    const labels = {
        'drawing': { label: 'Drawing', color: '#3b82f6' },
        'tool': { label: 'Tool Photo', color: '#8b5cf6' },
        'trial': { label: 'Trial Report', color: '#10b981' },
        'ppap': { label: 'PPAP', color: '#f59e0b' },
        'internal': { label: 'Internal Doc', color: '#ef4444' }
    };
    
    const config = labels[type] || { label: type, color: '#6b7280' };
    
    return `<span class="status-badge" style="background-color: ${config.color}20; color: ${config.color}; border: 1px solid ${config.color}40;">${config.label}</span>`;
}

// Show loading state
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
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

// Show error state
function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--danger-color);">
            <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
            <h3 style="margin-bottom: 0.5rem;">Error Loading Documents</h3>
            <p style="margin-bottom: 1.5rem; color: var(--secondary-color);">${message}</p>
            <div style="display: flex; gap: 0.5rem; justify-content: center;">
                <button onclick="location.reload()" class="btn btn-primary">Retry</button>
                <button onclick="checkConnection()" class="btn btn-outline">Check Connection</button>
            </div>
        </div>
    `;
}

// Close modal
function closeModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Connection test function
async function checkConnection() {
    try {
        showLoading('documentsList');
        
        const { data, error } = await supabaseClient
            .from('npd_master')
            .select('count')
            .limit(1);
        
        if (error) throw error;
        
        supabaseInitialized = true;
        alert('✅ Connection successful!');
        await loadAllDocuments();
        
    } catch (error) {
        alert(`❌ Connection failed: ${error.message}`);
        showError('documentsList', `Connection failed: ${error.message}`);
    }
}

// Utility function to create test data
async function createTestNPD() {
    try {
        const testData = {
            npd_no: 'TEST-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
            ts_part_no: 'TEST-PART-' + Math.random().toString(36).substr(2, 3).toUpperCase(),
            customer: 'Test Customer',
            drawing_url: 'https://example.com/sample.pdf'
        };
        
        const { data, error } = await supabaseClient
            .from('npd_master')
            .insert([testData])
            .select()
            .single();
        
        if (error) throw error;
        
        console.log('✅ Test NPD created:', data);
        alert(`Test NPD created: ${data.npd_no}`);
        
        // Reload data
        loadAllDocuments();
        loadNPDsForSelect();
        
    } catch (error) {
        console.error('❌ Error creating test NPD:', error);
        alert('Error: ' + error.message);
    }
}

// Expose functions for debugging
window.checkConnection = checkConnection;
window.createTestNPD = createTestNPD;
window.loadAllDocuments = loadAllDocuments;
window.filterDocuments = filterDocuments;
window.searchDocuments = searchDocuments;
window.uploadDocument = uploadDocument;
window.closeModal = closeModal;