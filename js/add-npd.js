document.addEventListener('DOMContentLoaded', function() {
    const wizard = new NPDWizard();
    wizard.init();
});

class NPDWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 8;
        this.npdData = {
            master: {},
            tools: [],
            gauges: [],
            trials: [],
            samples: [],
            ppap: [],
            documents: {}
        };
        this.currentNPDId = null;
    }

    init() {
        console.log('NPD Wizard initializing...');
        console.log('Supabase client available:', !!window.supabaseClient);
        console.log('Supabase helpers available:', !!window.supabaseHelpers);
        
        this.renderWizardSteps();
        this.loadStep(this.currentStep);
        this.setupEventListeners();
        this.generateNPDNo();
    }

    renderWizardSteps() {
        const steps = [
            'NPD Master Details',
            'Tools Required',
            'Gauges Required',
            'Trials',
            'Sample Submission',
            'PPAP Submission',
            'Internal Documents',
            'Handover'
        ];

        const container = document.getElementById('wizardSteps');
        let stepsHTML = '';

        steps.forEach((label, index) => {
            const stepNum = index + 1;
            const activeClass = stepNum === this.currentStep ? 'active' : '';
            const completedClass = stepNum < this.currentStep ? 'completed' : '';
            
            stepsHTML += `
                <div class="step ${activeClass} ${completedClass}" data-step="${stepNum}">
                    <div class="step-number">${stepNum}</div>
                    <div class="step-label">${label}</div>
                </div>
            `;
        });

        container.innerHTML = stepsHTML;
    }

    async loadStep(step) {
        const form = document.getElementById('npdForm');
        
        switch(step) {
            case 1:
                form.innerHTML = this.getStep1HTML();
                this.setupDatePickers();
                this.setupFileUpload('drawingUpload', 'drawingFile');
                break;
            case 2:
                form.innerHTML = this.getStep2HTML();
                // Use setTimeout to ensure DOM is ready
                setTimeout(() => {
                    this.setupDynamicRows('toolsContainer', 'addTool', this.addToolRow.bind(this));
                    this.setupFileUploads('.toolPhotoUpload');
                }, 100);
                break;
            case 3:
                form.innerHTML = this.getStep3HTML();
                setTimeout(() => {
                    this.setupDynamicRows('gaugesContainer', 'addGauge', this.addGaugeRow.bind(this));
                    this.setupFileUploads('.gaugePhotoUpload');
                }, 100);
                break;
            case 4:
                form.innerHTML = this.getStep4HTML();
                setTimeout(() => {
                    this.setupDynamicRows('trialsContainer', 'addTrial', this.addTrialRow.bind(this));
                    this.setupFileUploads('.trialReportUpload');
                }, 100);
                break;
            case 5:
                form.innerHTML = this.getStep5HTML();
                setTimeout(() => {
                    this.setupDynamicRows('samplesContainer', 'addSample', this.addSampleRow.bind(this));
                }, 100);
                break;
            case 6:
                form.innerHTML = this.getStep6HTML();
                setTimeout(() => {
                    this.setupDynamicRows('ppapContainer', 'addPPAP', this.addPPAPRow.bind(this));
                    this.setupFileUpload('ppapDocumentUpload', 'ppapDocument');
                }, 100);
                break;
            case 7:
                form.innerHTML = this.getStep7HTML();
                this.setupFileUploads('.documentUpload');
                break;
            case 8:
                form.innerHTML = this.getStep8HTML();
                break;
        }

        this.updateNavigationButtons();
    }

    getStep1HTML() {
        return `
            <div class="card-header">
                <h2 class="card-title">Step 1: NPD Master Details</h2>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">NPD No</label>
                    <input type="text" class="form-control" id="npdNo" readonly>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Release Date *</label>
                    <input type="date" class="form-control" id="releaseDate" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Customer *</label>
                    <input type="text" class="form-control" id="customer" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Customer Part No</label>
                    <input type="text" class="form-control" id="customerPartNo">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">TS Part No *</label>
                    <input type="text" class="form-control" id="tsPartNo" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Drawing Rev No</label>
                    <input type="text" class="form-control" id="drawingRevNo">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" id="description" rows="3"></textarea>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Tool Cost Paid By</label>
                    <select class="form-control" id="toolCostPaidBy">
                        <option value="">Select</option>
                        <option value="Customer">Customer</option>
                        <option value="Company">Company</option>
                        <option value="Shared">Shared</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Total Tool Cost (₹)</label>
                    <input type="number" class="form-control" id="totalToolCost" step="0.01" min="0">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Drawing Upload</label>
                <div class="file-upload" id="drawingUpload">
                    <input type="file" id="drawingFile" accept=".pdf,.dwg,.dxf,.jpg,.png">
                    <p>Click to upload drawing (PDF, DWG, DXF, JPG, PNG)</p>
                    <small>Max file size: 10MB</small>
                </div>
                <div class="file-list" id="drawingFileList"></div>
            </div>
        `;
    }

    getStep2HTML() {
        return `
            <div class="card-header">
                <h2 class="card-title">Step 2: Tools / Fixtures Required</h2>
                <p class="card-subtitle">Add all tools, fixtures, jigs, and molds required for this NPD</p>
            </div>
            
            <div id="toolsContainer">
                <!-- Tool rows will be added here dynamically -->
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn btn-outline" id="addTool">
                    ➕ Add Another Tool
                </button>
            </div>
            
            <div class="form-note">
                <small>* Required fields must be filled before proceeding to next step</small>
            </div>
        `;
    }

    addToolRow(container, isFirst = false) {
        const toolId = Date.now() + Math.random();
        const toolRow = `
            <div class="dynamic-row tool-row" data-id="${toolId}">
                <div class="row-header">
                    <h4>Tool ${container.children.length + 1}</h4>
                    ${!isFirst ? '<button type="button" class="btn-remove" onclick="this.closest(\'.dynamic-row\').remove(); updateToolNumbers()">× Remove</button>' : ''}
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">TT No *</label>
                        <input type="text" class="form-control tool-tt-no" data-field="tt_no" placeholder="TT-001" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Tool Type *</label>
                        <select class="form-control tool-type" data-field="tool_type" required>
                            <option value="">Select Type</option>
                            <option value="Press Tool">Press Tool</option>
                            <option value="Fixture">Fixture</option>
                            <option value="Mold">Mold</option>
                            <option value="Jig">Jig</option>
                            <option value="Gauge">Gauge</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Planned Start Date</label>
                        <input type="date" class="form-control planned-start" data-field="planned_start_date">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Planned Completion Date</label>
                        <input type="date" class="form-control planned-completion" data-field="planned_completion_date">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select class="form-control tool-status" data-field="status">
                            <option value="Planned">Planned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Trial">Trial</option>
                            <option value="Approved">Approved</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Actual Start Date</label>
                        <input type="date" class="form-control actual-start" data-field="actual_start_date">
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Tool Photo / Drawing</label>
                    <div class="file-upload toolPhotoUpload">
                        <input type="file" class="tool-photo-input" accept="image/*,.pdf,.dwg">
                        <div class="upload-content">
                            <span class="upload-icon">📷</span>
                            <p>Click to upload tool photo or drawing</p>
                            <small>Supports: JPG, PNG, PDF, DWG (Max 10MB)</small>
                        </div>
                    </div>
                    <div class="file-preview"></div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Remarks / Notes</label>
                    <textarea class="form-control tool-remarks" data-field="remarks" rows="2" placeholder="Any special requirements or notes..."></textarea>
                </div>
                
                <hr class="row-divider">
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', toolRow);
        
        // Initialize date pickers for this row
        this.setupDatePickersForRow(container.lastElementChild);
        
        // Setup file upload for this row
        this.setupFileUploadForRow(container.lastElementChild);
        
        // Update tool numbers
        this.updateToolNumbers();
        
        if (isFirst && this.npdData.tools.length > 0) {
            // Initialize first row with existing data
            this.populateRowData(container.lastElementChild, this.npdData.tools[0]);
        }
    }

    setupEventListeners() {
        // Navigation buttons
        document.getElementById('btnPrev').addEventListener('click', () => {
            if (this.currentStep > 1) {
                this.saveStepData(this.currentStep);
                this.currentStep--;
                this.loadStep(this.currentStep);
            }
        });

        document.getElementById('btnNext').addEventListener('click', async () => {
            console.log('Next button clicked for step:', this.currentStep);
            
            if (await this.validateStep(this.currentStep)) {
                console.log('Step validation passed');
                await this.saveStepData(this.currentStep);
                
                if (this.currentStep < this.totalSteps) {
                    this.currentStep++;
                    this.loadStep(this.currentStep);
                } else {
                    await this.completeNPD();
                }
            } else {
                console.log('Step validation failed');
            }
        });

        // Save buttons
        document.getElementById('btnSaveDraft').addEventListener('click', async () => {
            await this.saveAsDraft();
        });

        document.getElementById('btnSaveClose').addEventListener('click', async () => {
            if (await this.validateStep(this.currentStep)) {
                await this.saveStepData(this.currentStep);
                await this.saveNPD();
                window.location.href = 'analytics.html';
            }
        });
    }

    async validateStep(step) {
        console.log(`Validating step ${step}`);
        
        if (step === 2) {
            return this.validateToolsStep();
        }
        
        // Basic validation for other steps
        const form = document.getElementById('npdForm');
        const requiredFields = form.querySelectorAll('[required]');
        
        for (const field of requiredFields) {
            if (!field.value.trim()) {
                const label = field.closest('.form-group')?.querySelector('.form-label')?.textContent || 'this field';
                this.showError(`Please fill in ${label}`);
                field.focus();
                return false;
            }
        }
        
        return true;
    }

    validateToolsStep() {
        const container = document.getElementById('toolsContainer');
        if (!container) {
            console.error('Tools container not found during validation');
            return false;
        }
        
        const toolRows = container.querySelectorAll('.tool-row');
        console.log(`Validating ${toolRows.length} tool rows`);
        
        if (toolRows.length === 0) {
            this.showError('At least one tool is required. Please add a tool.');
            return false;
        }
        
        let hasValidTool = false;
        
        for (const row of toolRows) {
            const ttNo = row.querySelector('.tool-tt-no');
            const toolType = row.querySelector('.tool-type');
            
            // Check if this row has any data (not empty)
            const ttNoValue = ttNo?.value.trim();
            const toolTypeValue = toolType?.value;
            
            if (ttNoValue || toolTypeValue) {
                // This row has data, validate required fields
                if (!ttNoValue) {
                    this.showError('TT No is required for all tools');
                    ttNo?.focus();
                    return false;
                }
                
                if (!toolTypeValue) {
                    this.showError('Tool Type is required for all tools');
                    toolType?.focus();
                    return false;
                }
                
                hasValidTool = true;
            }
        }
        
        if (!hasValidTool) {
            this.showError('Please add at least one tool with TT No and Tool Type');
            return false;
        }
        
        return true;
    }

    showError(message) {
        // Create or show error message
        let errorDiv = document.querySelector('.error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            document.querySelector('#npdForm').prepend(errorDiv);
        }
        
        errorDiv.innerHTML = `
            <div class="alert alert-error">
                <span>⚠️</span>
                <span>${message}</span>
            </div>
        `;
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    async saveStepData(step) {
        console.log(`Saving step ${step} data`);
        
        try {
            switch(step) {
                case 1:
                    await this.saveMasterDetails();
                    break;
                case 2:
                    await this.saveTools();
                    break;
                case 3:
                    await this.saveGauges();
                    break;
                case 4:
                    await this.saveTrials();
                    break;
                case 5:
                    await this.saveSamples();
                    break;
                case 6:
                    await this.savePPAP();
                    break;
                case 7:
                    await this.saveDocuments();
                    break;
                case 8:
                    await this.saveHandover();
                    break;
            }
            
            console.log(`Step ${step} data saved:`, this.npdData);
        } catch (error) {
            console.error(`Error saving step ${step}:`, error);
            this.showError(`Error saving step ${step}: ${error.message}`);
        }
    }

    async saveMasterDetails() {
        const masterData = {
            npd_no: document.getElementById('npdNo').value,
            release_date: document.getElementById('releaseDate').value,
            customer: document.getElementById('customer').value,
            customer_part_no: document.getElementById('customerPartNo').value,
            ts_part_no: document.getElementById('tsPartNo').value,
            description: document.getElementById('description').value,
            drawing_rev_no: document.getElementById('drawingRevNo').value,
            tool_cost_paid_by: document.getElementById('toolCostPaidBy').value,
            total_tool_cost: parseFloat(document.getElementById('totalToolCost').value) || null,
            current_stage: 'CREATED',
            is_draft: false
        };

        // Handle file upload
        const drawingFile = document.getElementById('drawingFile')?.files[0];
        if (drawingFile) {
            console.log('Uploading drawing file:', drawingFile.name);
            const filePath = window.supabaseHelpers.generateFilePath('drawings', drawingFile.name);
            const url = await window.supabaseHelpers.uploadFile('drawings', drawingFile, filePath);
            if (url) {
                masterData.drawing_url = url;
                console.log('Drawing uploaded successfully:', url);
            }
        }

        this.npdData.master = masterData;
        console.log('Master details saved:', masterData);
    }

    async saveTools() {
        console.log('Starting saveTools...');
        
        try {
            const container = document.getElementById('toolsContainer');
            if (!container) {
                console.error('Tools container not found');
                throw new Error('Tools container not found');
            }
            
            const toolRows = container.querySelectorAll('.tool-row');
            console.log(`Found ${toolRows.length} tool rows to save`);
            
            const tools = [];

            for (const row of toolRows) {
                const toolData = this.collectRowData(row);
                console.log('Collected tool data:', toolData);
                
                // Skip empty rows (no TT No or Tool Type)
                if (!toolData.tt_no && !toolData.tool_type) {
                    console.log('Skipping empty tool row');
                    continue;
                }
                
                // Handle tool photo upload
                const photoInput = row.querySelector('.tool-photo-input');
                if (photoInput?.files[0]) {
                    console.log('Uploading tool photo:', photoInput.files[0].name);
                    const filePath = window.supabaseHelpers.generateFilePath('tool-photos', photoInput.files[0].name);
                    const url = await window.supabaseHelpers.uploadFile('tool-photos', photoInput.files[0], filePath);
                    if (url) {
                        toolData.tool_photo_url = url;
                        console.log('Tool photo uploaded:', url);
                    }
                }

                tools.push(toolData);
            }

            this.npdData.tools = tools;
            console.log('Tools saved successfully:', tools);
        } catch (error) {
            console.error('Error in saveTools:', error);
            throw error;
        }
    }

    collectRowData(row) {
        const data = {};
        const inputs = row.querySelectorAll('[data-field]');
        
        inputs.forEach(input => {
            const field = input.dataset.field;
            if (input.type === 'date') {
                data[field] = input.value || null;
            } else if (input.tagName === 'SELECT') {
                data[field] = input.value;
            } else if (input.tagName === 'TEXTAREA') {
                data[field] = input.value.trim();
            } else {
                data[field] = input.value.trim();
            }
        });

        // Add timestamp
        data.updated_at = new Date().toISOString();
        
        return data;
    }

    populateRowData(rowElement, data) {
        if (!rowElement || !data) return;
        
        Object.keys(data).forEach(key => {
            const input = rowElement.querySelector(`[data-field="${key}"]`);
            if (input) {
                if (input.type === 'date') {
                    input.value = data[key] ? data[key].split('T')[0] : '';
                } else if (input.tagName === 'SELECT') {
                    input.value = data[key] || '';
                } else {
                    input.value = data[key] || '';
                }
            }
        });
    }

    async saveAsDraft() {
        try {
            console.log('Saving as draft...');
            
            // Save current step data
            await this.saveStepData(this.currentStep);
            
            // Mark as draft
            this.npdData.master.is_draft = true;
            this.npdData.master.current_stage = 'DRAFT';
            
            await this.saveNPD();
            
            this.showSuccess('Saved as draft successfully!');
            
            // Redirect after a short delay
            setTimeout(() => {
                window.location.href = 'analytics.html';
            }, 1500);
            
        } catch (error) {
            console.error('Error saving draft:', error);
            this.showError('Error saving draft: ' + error.message);
        }
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'alert alert-success';
        successDiv.innerHTML = `
            <span>✅</span>
            <span>${message}</span>
        `;
        
        document.querySelector('#npdForm').prepend(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    async saveNPD() {
        try {
            console.log('Saving NPD data...');
            
            let npdId = this.currentNPDId;

            if (!npdId) {
                // Insert new NPD master
                console.log('Creating new NPD...');
                const { data: npd, error: masterError } = await window.supabaseClient
                    .from('npd_master')
                    .insert([this.npdData.master])
                    .select()
                    .single();

                if (masterError) {
                    console.error('Supabase master insert error:', masterError);
                    throw masterError;
                }
                
                npdId = npd.id;
                this.currentNPDId = npdId;
                console.log('New NPD created with ID:', npdId);
            } else {
                // Update existing NPD
                console.log('Updating existing NPD:', npdId);
                const { error: updateError } = await window.supabaseClient
                    .from('npd_master')
                    .update(this.npdData.master)
                    .eq('id', npdId);

                if (updateError) {
                    console.error('Supabase update error:', updateError);
                    throw updateError;
                }
            }

            // Save related data
            console.log('Saving related data...');
            await this.saveRelatedData('tools', npdId, this.npdData.tools);
            await this.saveRelatedData('gauges', npdId, this.npdData.gauges);
            await this.saveRelatedData('trials', npdId, this.npdData.trials);
            await this.saveRelatedData('sample_submissions', npdId, this.npdData.samples);
            await this.saveRelatedData('ppap_submissions', npdId, this.npdData.ppap);

            console.log('NPD saved successfully!');
            return true;
        } catch (error) {
            console.error('Error saving NPD:', error);
            this.showError('Error saving NPD: ' + error.message);
            return false;
        }
    }

    async saveRelatedData(table, npdId, items) {
        if (!items || items.length === 0) {
            console.log(`No items to save for ${table}`);
            return;
        }

        console.log(`Saving ${items.length} items to ${table}`);

        const itemsWithNpdId = items.map(item => ({
            ...item,
            npd_id: npdId
        }));

        const { error } = await window.supabaseClient
            .from(table)
            .upsert(itemsWithNpdId);

        if (error) {
            console.error(`Error saving ${table}:`, error);
            throw error;
        }
        
        console.log(`${table} saved successfully`);
    }

    async generateNPDNo() {
        try {
            console.log('Generating NPD number...');
            
            // Generate NPD number using the database function
            const { data, error } = await window.supabaseClient
                .rpc('generate_npd_no');

            if (error) {
                console.error('Supabase RPC error:', error);
                throw error;
            }
            
            document.getElementById('npdNo').value = data;
            console.log('Generated NPD No:', data);
        } catch (error) {
            console.error('Error generating NPD number:', error);
            // Fallback to client-side generation
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const npdNo = `NPD-${year}${month}-${random}`;
            document.getElementById('npdNo').value = npdNo;
            console.log('Using fallback NPD No:', npdNo);
        }
    }

    updateNavigationButtons() {
        const btnPrev = document.getElementById('btnPrev');
        const btnNext = document.getElementById('btnNext');
        
        btnPrev.style.display = this.currentStep > 1 ? 'inline-block' : 'none';
        
        if (this.currentStep === this.totalSteps) {
            btnNext.textContent = 'Complete NPD';
            btnNext.className = 'btn btn-success';
        } else {
            btnNext.textContent = 'Save & Next →';
            btnNext.className = 'btn btn-primary';
        }
    }

    async completeNPD() {
        console.log('Completing NPD...');
        
        if (await this.validateStep(this.currentStep)) {
            await this.saveStepData(this.currentStep);
            
            // Update NPD status
            this.npdData.master.current_stage = 'PRODUCTION_RELEASED';
            this.npdData.master.handover_done = true;
            this.npdData.master.completion_date = new Date().toISOString();
            
            if (await this.saveNPD()) {
                this.showSuccess('NPD created successfully!');
                
                // Redirect to dashboard after success
                setTimeout(() => {
                    window.location.href = 'analytics.html';
                }, 2000);
            }
        }
    }

    // Helper methods
    setupDynamicRows(containerId, addButtonId, addRowFunction) {
        const container = document.getElementById(containerId);
        const addButton = document.getElementById(addButtonId);
        
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return;
        }
        
        if (!addButton) {
            console.error(`Add button ${addButtonId} not found`);
            return;
        }
        
        console.log(`Setting up dynamic rows for ${containerId}`);
        
        // Clear container
        container.innerHTML = '';
        
        // Determine data key from containerId
        const dataKey = containerId.replace('Container', '').toLowerCase();
        
        // Add existing rows from data or first empty row
        if (this.npdData[dataKey]?.length > 0) {
            console.log(`Loading existing ${dataKey}:`, this.npdData[dataKey].length);
            this.npdData[dataKey].forEach((item, index) => {
                addRowFunction(container, index === 0);
                const rows = container.querySelectorAll('.dynamic-row');
                if (rows.length > index) {
                    this.populateRowData(rows[index], item);
                }
            });
        } else {
            console.log(`Adding first empty ${dataKey} row`);
            addRowFunction(container, true);
        }
        
        // Setup add button
        addButton.addEventListener('click', () => {
            console.log(`Adding new ${dataKey} row`);
            addRowFunction(container, false);
        });
    }

    setupFileUpload(uploadDivId, fileInputId) {
        const uploadDiv = document.getElementById(uploadDivId);
        const fileInput = document.getElementById(fileInputId);
        
        if (!uploadDiv || !fileInput) {
            console.error(`File upload elements not found: ${uploadDivId}, ${fileInputId}`);
            return;
        }
        
        uploadDiv.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                const fileList = uploadDiv.nextElementSibling || uploadDiv.parentNode.querySelector('.file-list');
                if (fileList) {
                    fileList.innerHTML = `
                        <div class="file-item">
                            <span>📄</span>
                            <span>${this.files[0].name}</span>
                            <span class="file-size">(${(this.files[0].size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                    `;
                }
            }
        });
    }

    setupFileUploads(selector) {
        document.addEventListener('change', (e) => {
            if (e.target.matches(`${selector} input[type="file"]`)) {
                const file = e.target.files[0];
                if (file) {
                    const parent = e.target.closest('.file-upload');
                    const previewDiv = parent.nextElementSibling || parent.parentNode.querySelector('.file-preview');
                    
                    if (previewDiv) {
                        previewDiv.innerHTML = `
                            <div class="file-item">
                                <span>📄</span>
                                <span>${file.name}</span>
                                <span class="file-size">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                            </div>
                        `;
                    }
                }
            }
        });
    }

    setupFileUploadForRow(row) {
        const fileInput = row.querySelector('input[type="file"]');
        const uploadDiv = row.querySelector('.file-upload');
        
        if (fileInput && uploadDiv) {
            uploadDiv.addEventListener('click', () => {
                fileInput.click();
            });
        }
    }

    setupDatePickers() {
        // Set min date to today for date inputs
        const today = new Date().toISOString().split('T')[0];
        document.querySelectorAll('input[type="date"]').forEach(input => {
            if (!input.hasAttribute('max')) {
                input.setAttribute('min', today);
            }
        });
    }

    setupDatePickersForRow(row) {
        const today = new Date().toISOString().split('T')[0];
        row.querySelectorAll('input[type="date"]').forEach(input => {
            if (!input.hasAttribute('max')) {
                input.setAttribute('min', today);
            }
        });
    }

    updateToolNumbers() {
        const container = document.getElementById('toolsContainer');
        if (!container) return;
        
        const toolRows = container.querySelectorAll('.tool-row');
        toolRows.forEach((row, index) => {
            const header = row.querySelector('h4');
            if (header) {
                header.textContent = `Tool ${index + 1}`;
            }
        });
    }

    // Placeholder methods for other steps (to be implemented)
    getStep3HTML() { return '<h3>Step 3: Gauges Required</h3>'; }
    getStep4HTML() { return '<h3>Step 4: Trials</h3>'; }
    getStep5HTML() { return '<h3>Step 5: Sample Submission</h3>'; }
    getStep6HTML() { return '<h3>Step 6: PPAP Submission</h3>'; }
    getStep7HTML() { return '<h3>Step 7: Internal Documents</h3>'; }
    getStep8HTML() { return '<h3>Step 8: Handover</h3>'; }

    addGaugeRow() { /* Implementation */ }
    addTrialRow() { /* Implementation */ }
    addSampleRow() { /* Implementation */ }
    addPPAPRow() { /* Implementation */ }

    async saveGauges() { /* Implementation */ }
    async saveTrials() { /* Implementation */ }
    async saveSamples() { /* Implementation */ }
    async savePPAP() { /* Implementation */ }
    async saveDocuments() { /* Implementation */ }
    async saveHandover() { /* Implementation */ }
}
