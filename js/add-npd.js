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
            documents: {},
            handover: {}
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
        this.currentStep = step;      // ensure sync
        this.renderWizardSteps();     // 🔴 ADD THIS LINE
        const form = document.getElementById('npdForm');
        
        switch(step) {
            case 1:
                form.innerHTML = this.getStep1HTML();
                this.setupDatePickers();
                this.setupFileUpload('drawingUpload', 'drawingFile');
                break;
            case 2:
                form.innerHTML = this.getStep2HTML();
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

    getStep3HTML() {
        return `
            <div class="card-header">
                <h2 class="card-title">Step 3: Gauges Required</h2>
                <p class="card-subtitle">Add all gauges and measurement tools required</p>
            </div>
            
            <div id="gaugesContainer">
                <!-- Gauge rows will be added here dynamically -->
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn btn-outline" id="addGauge">
                    ➕ Add Another Gauge
                </button>
            </div>
            
            <div class="form-note">
                <small>* Required fields must be filled before proceeding to next step</small>
            </div>
        `;
    }

    getStep4HTML() {
        return `
            <div class="card-header">
                <h2 class="card-title">Step 4: Trials</h2>
                <p class="card-subtitle">Record trial results and reports</p>
            </div>
            
            <div id="trialsContainer">
                <!-- Trial rows will be added here dynamically -->
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn btn-outline" id="addTrial">
                    ➕ Add Another Trial
                </button>
            </div>
            
            <div class="form-note">
                <small>Attach trial reports for each trial conducted</small>
            </div>
        `;
    }

    getStep5HTML() {
        return `
            <div class="card-header">
                <h2 class="card-title">Step 5: Sample Submission</h2>
                <p class="card-subtitle">Record sample submissions to customer</p>
            </div>
            
            <div id="samplesContainer">
                <!-- Sample rows will be added here dynamically -->
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn btn-outline" id="addSample">
                    ➕ Add Another Sample Submission
                </button>
            </div>
            
            <div class="form-note">
                <small>Track all sample submissions and their status</small>
            </div>
        `;
    }

    getStep6HTML() {
        return `
            <div class="card-header">
                <h2 class="card-title">Step 6: PPAP Submission</h2>
                <p class="card-subtitle">Production Part Approval Process submissions</p>
            </div>
            
            <div id="ppapContainer">
                <!-- PPAP rows will be added here dynamically -->
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn btn-outline" id="addPPAP">
                    ➕ Add Another PPAP Submission
                </button>
            </div>
            
            <div class="form-note">
                <small>Record PPAP submissions and approval status</small>
            </div>
        `;
    }

    getStep7HTML() {
        return `
            <div class="card-header">
                <h2 class="card-title">Step 7: Internal Documents</h2>
                <p class="card-subtitle">Upload and track internal documentation</p>
            </div>
            
            <div class="document-grid">
                <div class="document-item">
                    <div class="document-header">
                        <h4>Latest TS Drawing</h4>
                        <div class="document-status">
                            <span class="status-badge pending">Pending</span>
                        </div>
                    </div>
                    <div class="document-row">
                        <div class="form-group">
                            <label class="form-label">Updated Date</label>
                            <input type="date" class="form-control" id="tsDrawingDate" data-field="ts_drawing_date">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Upload Document</label>
                            <div class="file-upload documentUpload" data-doc="ts_drawing">
                                <input type="file" class="document-file" accept=".pdf,.dwg,.dxf,.jpg,.png">
                                <div class="upload-content">
                                    <span class="upload-icon">📄</span>
                                    <p>Click to upload</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="document-item">
                    <div class="document-header">
                        <h4>RM Database</h4>
                        <div class="document-status">
                            <span class="status-badge pending">Pending</span>
                        </div>
                    </div>
                    <div class="document-row">
                        <div class="form-group">
                            <label class="form-label">Updated Date</label>
                            <input type="date" class="form-control" id="rmDatabaseDate" data-field="rm_database_date">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Upload Document</label>
                            <div class="file-upload documentUpload" data-doc="rm_database">
                                <input type="file" class="document-file" accept=".xlsx,.xls,.csv,.pdf">
                                <div class="upload-content">
                                    <span class="upload-icon">📊</span>
                                    <p>Click to upload</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="document-item">
                    <div class="document-header">
                        <h4>Inspection Report Format</h4>
                        <div class="document-status">
                            <span class="status-badge pending">Pending</span>
                        </div>
                    </div>
                    <div class="document-row">
                        <div class="form-group">
                            <label class="form-label">Updated Date</label>
                            <input type="date" class="form-control" id="inspectionFormatDate" data-field="inspection_format_date">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Upload Document</label>
                            <div class="file-upload documentUpload" data-doc="inspection_format">
                                <input type="file" class="document-file" accept=".docx,.doc,.pdf">
                                <div class="upload-content">
                                    <span class="upload-icon">📋</span>
                                    <p>Click to upload</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="document-item">
                    <div class="document-header">
                        <h4>Manufacturing Process Card</h4>
                        <div class="document-status">
                            <span class="status-badge pending">Pending</span>
                        </div>
                    </div>
                    <div class="document-row">
                        <div class="form-group">
                            <label class="form-label">Updated Date</label>
                            <input type="date" class="form-control" id="processCardDate" data-field="process_card_date">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Upload Document</label>
                            <div class="file-upload documentUpload" data-doc="process_card">
                                <input type="file" class="document-file" accept=".docx,.doc,.pdf">
                                <div class="upload-content">
                                    <span class="upload-icon">⚙️</span>
                                    <p>Click to upload</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="document-item">
                    <div class="document-header">
                        <h4>PPAP Documents</h4>
                        <div class="document-status">
                            <span class="status-badge pending">Pending</span>
                        </div>
                    </div>
                    <div class="document-row">
                        <div class="form-group">
                            <label class="form-label">Updated Date</label>
                            <input type="date" class="form-control" id="ppapDocDate" data-field="ppap_doc_date">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Upload Document</label>
                            <div class="file-upload documentUpload" data-doc="ppap_documents">
                                <input type="file" class="document-file" accept=".zip,.pdf,.docx">
                                <div class="upload-content">
                                    <span class="upload-icon">📦</span>
                                    <p>Click to upload</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="form-note">
                <small>Upload all required internal documents for the NPD process</small>
            </div>
        `;
    }

    getStep8HTML() {
        return `
            <div class="card-header">
                <h2 class="card-title">Step 8: Handover</h2>
                <p class="card-subtitle">Complete the handover process to production</p>
            </div>
            
            <div class="handover-section">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Handover Completed *</label>
                        <div class="radio-group">
                            <label class="radio-label">
                                <input type="radio" name="handoverDone" value="true" required>
                                <span class="radio-text">Yes</span>
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="handoverDone" value="false" required>
                                <span class="radio-text">No</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Handover Date *</label>
                        <input type="date" class="form-control" id="handoverDate" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Handover By *</label>
                        <input type="text" class="form-control" id="handoverBy" placeholder="Enter name" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Handover To *</label>
                        <input type="text" class="form-control" id="handoverTo" placeholder="Enter department/name" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Handover Notes / Remarks</label>
                    <textarea class="form-control" id="handoverNotes" rows="3" placeholder="Any special instructions or notes for handover..."></textarea>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Handover Documents</label>
                    <div class="file-upload" id="handoverDocumentsUpload">
                        <input type="file" id="handoverDocuments" multiple accept=".pdf,.docx,.xlsx,.zip">
                        <div class="upload-content">
                            <span class="upload-icon">📎</span>
                            <p>Click to upload handover documents</p>
                            <small>Multiple files allowed (PDF, DOCX, XLSX, ZIP)</small>
                        </div>
                    </div>
                    <div class="file-list" id="handoverFilesList"></div>
                </div>
            </div>
            
            <div class="form-note">
                <small>* Mark handover as completed to finish the NPD process</small>
            </div>
        `;
    }

    // Row creation methods
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
        this.setupDatePickersForRow(container.lastElementChild);
        this.setupFileUploadForRow(container.lastElementChild);
        this.updateToolNumbers();
        
        if (isFirst && this.npdData.tools.length > 0) {
            this.populateRowData(container.lastElementChild, this.npdData.tools[0]);
        }
    }

    addGaugeRow(container, isFirst = false) {
        const gaugeId = Date.now() + Math.random();
        const gaugeRow = `
            <div class="dynamic-row gauge-row" data-id="${gaugeId}">
                <div class="row-header">
                    <h4>Gauge ${container.children.length + 1}</h4>
                    ${!isFirst ? '<button type="button" class="btn-remove" onclick="this.closest(\'.dynamic-row\').remove(); updateGaugeNumbers()">× Remove</button>' : ''}
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Gauge No *</label>
                        <input type="text" class="form-control gauge-no" data-field="gauge_no" placeholder="G-001" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Gauge Type *</label>
                        <select class="form-control gauge-type" data-field="gauge_type" required>
                            <option value="">Select Type</option>
                            <option value="Vernier Caliper">Vernier Caliper</option>
                            <option value="Micrometer">Micrometer</option>
                            <option value="Height Gauge">Height Gauge</option>
                            <option value="Plug Gauge">Plug Gauge</option>
                            <option value="Ring Gauge">Ring Gauge</option>
                            <option value="Thread Gauge">Thread Gauge</option>
                            <option value="CMM">CMM</option>
                            <option value="Surface Roughness Tester">Surface Roughness Tester</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Start Date</label>
                        <input type="date" class="form-control gauge-start-date" data-field="start_date">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Completion Date</label>
                        <input type="date" class="form-control gauge-completion-date" data-field="completion_date">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Current Status</label>
                        <select class="form-control gauge-status" data-field="status">
                            <option value="Required">Required</option>
                            <option value="Ordered">Ordered</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Received">Received</option>
                            <option value="Calibrated">Calibrated</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Gauge Photo / Drawing</label>
                    <div class="file-upload gaugePhotoUpload">
                        <input type="file" class="gauge-photo-input" accept="image/*,.pdf">
                        <div class="upload-content">
                            <span class="upload-icon">📏</span>
                            <p>Click to upload gauge photo or drawing</p>
                            <small>Supports: JPG, PNG, PDF (Max 10MB)</small>
                        </div>
                    </div>
                    <div class="file-preview"></div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Remarks</label>
                    <textarea class="form-control gauge-remarks" data-field="remarks" rows="2" placeholder="Any special requirements or notes..."></textarea>
                </div>
                
                <hr class="row-divider">
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', gaugeRow);
        this.setupDatePickersForRow(container.lastElementChild);
        this.setupFileUploadForRow(container.lastElementChild);
        this.updateGaugeNumbers();
        
        if (isFirst && this.npdData.gauges.length > 0) {
            this.populateRowData(container.lastElementChild, this.npdData.gauges[0]);
        }
    }

    addTrialRow(container, isFirst = false) {
        const trialId = Date.now() + Math.random();
        const trialRow = `
            <div class="dynamic-row trial-row" data-id="${trialId}">
                <div class="row-header">
                    <h4>Trial ${container.children.length + 1}</h4>
                    ${!isFirst ? '<button type="button" class="btn-remove" onclick="this.closest(\'.dynamic-row\').remove(); updateTrialNumbers()">× Remove</button>' : ''}
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Trial Date *</label>
                        <input type="date" class="form-control trial-date" data-field="trial_date" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Status *</label>
                        <select class="form-control trial-status" data-field="status" required>
                            <option value="">Select Status</option>
                            <option value="Scheduled">Scheduled</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed - Success">Completed - Success</option>
                            <option value="Completed - Issues">Completed - Issues</option>
                            <option value="On Hold">On Hold</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Trial Description / Purpose</label>
                    <textarea class="form-control trial-description" data-field="description" rows="2" placeholder="Describe the purpose of this trial..."></textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Trial Report</label>
                        <div class="file-upload trialReportUpload">
                            <input type="file" class="trial-report-input" accept=".pdf,.docx,.xlsx">
                            <div class="upload-content">
                                <span class="upload-icon">📋</span>
                                <p>Click to upload trial report</p>
                                <small>Supports: PDF, DOCX, XLSX (Max 10MB)</small>
                            </div>
                        </div>
                        <div class="file-preview"></div>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Issues Found</label>
                        <textarea class="form-control trial-issues" data-field="issues_found" rows="2" placeholder="List any issues found during trial..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Corrective Actions</label>
                        <textarea class="form-control trial-actions" data-field="corrective_actions" rows="2" placeholder="Corrective actions taken..."></textarea>
                    </div>
                </div>
                
                <hr class="row-divider">
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', trialRow);
        this.setupDatePickersForRow(container.lastElementChild);
        this.setupFileUploadForRow(container.lastElementChild);
        this.updateTrialNumbers();
        
        if (isFirst && this.npdData.trials.length > 0) {
            this.populateRowData(container.lastElementChild, this.npdData.trials[0]);
        }
    }

    addSampleRow(container, isFirst = false) {
        const sampleId = Date.now() + Math.random();
        const sampleRow = `
            <div class="dynamic-row sample-row" data-id="${sampleId}">
                <div class="row-header">
                    <h4>Sample Submission ${container.children.length + 1}</h4>
                    ${!isFirst ? '<button type="button" class="btn-remove" onclick="this.closest(\'.dynamic-row\').remove(); updateSampleNumbers()">× Remove</button>' : ''}
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Submission Date *</label>
                        <input type="date" class="form-control sample-submission-date" data-field="submission_date" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Quantity *</label>
                        <input type="number" class="form-control sample-quantity" data-field="quantity" min="1" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Status *</label>
                        <select class="form-control sample-status" data-field="status" required>
                            <option value="">Select Status</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Approved">Approved</option>
                            <option value="Under Deviation">Under Deviation</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Pending Review">Pending Review</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Approval/Rejection Date</label>
                        <input type="date" class="form-control sample-approval-date" data-field="approval_date">
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Customer Feedback / Remarks</label>
                    <textarea class="form-control sample-remarks" data-field="remarks" rows="2" placeholder="Customer feedback or remarks..."></textarea>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Deviation Details (if applicable)</label>
                    <textarea class="form-control sample-deviation" data-field="deviation_details" rows="2" placeholder="Details of any deviations..."></textarea>
                </div>
                
                <hr class="row-divider">
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', sampleRow);
        this.setupDatePickersForRow(container.lastElementChild);
        this.updateSampleNumbers();
        
        if (isFirst && this.npdData.samples.length > 0) {
            this.populateRowData(container.lastElementChild, this.npdData.samples[0]);
        }
    }

    addPPAPRow(container, isFirst = false) {
        const ppapId = Date.now() + Math.random();
        const ppapRow = `
            <div class="dynamic-row ppap-row" data-id="${ppapId}">
                <div class="row-header">
                    <h4>PPAP Submission ${container.children.length + 1}</h4>
                    ${!isFirst ? '<button type="button" class="btn-remove" onclick="this.closest(\'.dynamic-row\').remove(); updatePPAPNumbers()">× Remove</button>' : ''}
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Submission Date *</label>
                        <input type="date" class="form-control ppap-submission-date" data-field="submission_date" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Lot Quantity *</label>
                        <input type="number" class="form-control ppap-quantity" data-field="lot_quantity" min="1" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Status *</label>
                        <select class="form-control ppap-status" data-field="status" required>
                            <option value="">Select Status</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Approved">Approved</option>
                            <option value="Under Deviation">Under Deviation</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Pending Review">Pending Review</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Approval Date</label>
                        <input type="date" class="form-control ppap-approval-date" data-field="approval_date">
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">PPAP Level</label>
                    <select class="form-control ppap-level" data-field="ppap_level">
                        <option value="">Select Level</option>
                        <option value="Level 1">Level 1</option>
                        <option value="Level 2">Level 2</option>
                        <option value="Level 3">Level 3</option>
                        <option value="Level 4">Level 4</option>
                        <option value="Level 5">Level 5</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">PPAP Documents</label>
                    <div class="file-upload ppap-doc-upload">
                        <input type="file" class="ppap-doc-input" multiple accept=".pdf,.docx,.xlsx,.zip">
                        <div class="upload-content">
                            <span class="upload-icon">📦</span>
                            <p>Click to upload PPAP documents</p>
                            <small>Multiple files allowed (PDF, DOCX, XLSX, ZIP)</small>
                        </div>
                    </div>
                    <div class="file-preview"></div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Customer Feedback / Remarks</label>
                    <textarea class="form-control ppap-remarks" data-field="remarks" rows="2" placeholder="Customer feedback or remarks on PPAP..."></textarea>
                </div>
                
                <hr class="row-divider">
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', ppapRow);
        this.setupDatePickersForRow(container.lastElementChild);
        this.setupFileUploadForRow(container.lastElementChild);
        this.updatePPAPNumbers();
        
        if (isFirst && this.npdData.ppap.length > 0) {
            this.populateRowData(container.lastElementChild, this.npdData.ppap[0]);
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
        
        switch(step) {
            case 1:
                return this.validateMasterDetails();
            case 2:
                return this.validateToolsStep();
            case 3:
                return this.validateGaugesStep();
            case 4:
                return this.validateTrialsStep();
            case 5:
                return this.validateSamplesStep();
            case 6:
                return this.validatePPAPStep();
            case 7:
                return this.validateDocumentsStep();
            case 8:
                return this.validateHandoverStep();
            default:
                return this.validateGenericStep();
        }
    }

    validateMasterDetails() {
        const requiredFields = [
            { id: 'releaseDate', label: 'Release Date' },
            { id: 'customer', label: 'Customer' },
            { id: 'tsPartNo', label: 'TS Part No' }
        ];

        for (const field of requiredFields) {
            const element = document.getElementById(field.id);
            if (!element?.value.trim()) {
                this.showError(`Please fill in ${field.label}`);
                element?.focus();
                return false;
            }
        }

        return true;
    }

    validateToolsStep() {
        const container = document.getElementById('toolsContainer');
        if (!container) {
            this.showError('Tools container not found');
            return false;
        }
        
        const toolRows = container.querySelectorAll('.tool-row');
        
        if (toolRows.length === 0) {
            this.showError('At least one tool is required. Please add a tool.');
            return false;
        }
        
        let hasValidTool = false;
        
        for (const row of toolRows) {
            const ttNo = row.querySelector('.tool-tt-no');
            const toolType = row.querySelector('.tool-type');
            
            const ttNoValue = ttNo?.value.trim();
            const toolTypeValue = toolType?.value;
            
            if (ttNoValue || toolTypeValue) {
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

    validateGaugesStep() {
        const container = document.getElementById('gaugesContainer');
        if (!container) {
            this.showError('Gauges container not found');
            return false;
        }
        
        const gaugeRows = container.querySelectorAll('.gauge-row');
        
        if (gaugeRows.length === 0) {
            // Gauges are optional, but if added, validate
            return true;
        }
        
        for (const row of gaugeRows) {
            const gaugeNo = row.querySelector('.gauge-no');
            const gaugeType = row.querySelector('.gauge-type');
            
            const gaugeNoValue = gaugeNo?.value.trim();
            const gaugeTypeValue = gaugeType?.value;
            
            // If either field has data, both are required
            if (gaugeNoValue || gaugeTypeValue) {
                if (!gaugeNoValue) {
                    this.showError('Gauge No is required when adding a gauge');
                    gaugeNo?.focus();
                    return false;
                }
                
                if (!gaugeTypeValue) {
                    this.showError('Gauge Type is required when adding a gauge');
                    gaugeType?.focus();
                    return false;
                }
            }
        }
        
        return true;
    }

    validateTrialsStep() {
        const container = document.getElementById('trialsContainer');
        if (!container) return true; // Trials are optional
        
        const trialRows = container.querySelectorAll('.trial-row');
        
        for (const row of trialRows) {
            const trialDate = row.querySelector('.trial-date');
            const trialStatus = row.querySelector('.trial-status');
            
            const trialDateValue = trialDate?.value;
            const trialStatusValue = trialStatus?.value;
            
            // If either field has data, both are required
            if (trialDateValue || trialStatusValue) {
                if (!trialDateValue) {
                    this.showError('Trial Date is required when adding a trial');
                    trialDate?.focus();
                    return false;
                }
                
                if (!trialStatusValue) {
                    this.showError('Trial Status is required when adding a trial');
                    trialStatus?.focus();
                    return false;
                }
            }
        }
        
        return true;
    }

    validateSamplesStep() {
        const container = document.getElementById('samplesContainer');
        if (!container) return true; // Samples are optional
        
        const sampleRows = container.querySelectorAll('.sample-row');
        
        for (const row of sampleRows) {
            const submissionDate = row.querySelector('.sample-submission-date');
            const quantity = row.querySelector('.sample-quantity');
            const status = row.querySelector('.sample-status');
            
            // Check if this row has any data
            const hasData = submissionDate?.value || quantity?.value || status?.value;
            
            if (hasData) {
                if (!submissionDate?.value) {
                    this.showError('Submission Date is required for sample submissions');
                    submissionDate?.focus();
                    return false;
                }
                
                if (!quantity?.value || parseInt(quantity.value) < 1) {
                    this.showError('Valid Quantity is required for sample submissions');
                    quantity?.focus();
                    return false;
                }
                
                if (!status?.value) {
                    this.showError('Status is required for sample submissions');
                    status?.focus();
                    return false;
                }
            }
        }
        
        return true;
    }

    validatePPAPStep() {
        const container = document.getElementById('ppapContainer');
        if (!container) return true; // PPAP is optional
        
        const ppapRows = container.querySelectorAll('.ppap-row');
        
        for (const row of ppapRows) {
            const submissionDate = row.querySelector('.ppap-submission-date');
            const quantity = row.querySelector('.ppap-quantity');
            const status = row.querySelector('.ppap-status');
            
            // Check if this row has any data
            const hasData = submissionDate?.value || quantity?.value || status?.value;
            
            if (hasData) {
                if (!submissionDate?.value) {
                    this.showError('Submission Date is required for PPAP submissions');
                    submissionDate?.focus();
                    return false;
                }
                
                if (!quantity?.value || parseInt(quantity.value) < 1) {
                    this.showError('Valid Lot Quantity is required for PPAP submissions');
                    quantity?.focus();
                    return false;
                }
                
                if (!status?.value) {
                    this.showError('Status is required for PPAP submissions');
                    status?.focus();
                    return false;
                }
            }
        }
        
        return true;
    }

    validateDocumentsStep() {
        // All documents are optional
        return true;
    }

    validateHandoverStep() {
        const handoverDone = document.querySelector('input[name="handoverDone"]:checked');
        const handoverDate = document.getElementById('handoverDate');
        const handoverBy = document.getElementById('handoverBy');
        const handoverTo = document.getElementById('handoverTo');
        
        if (!handoverDone) {
            this.showError('Please select if handover is completed');
            return false;
        }
        
        if (handoverDone.value === 'true') {
            if (!handoverDate?.value) {
                this.showError('Handover Date is required');
                handoverDate?.focus();
                return false;
            }
            
            if (!handoverBy?.value.trim()) {
                this.showError('Handover By is required');
                handoverBy?.focus();
                return false;
            }
            
            if (!handoverTo?.value.trim()) {
                this.showError('Handover To is required');
                handoverTo?.focus();
                return false;
            }
        }
        
        return true;
    }

    validateGenericStep() {
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

    showError(message) {
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
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
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
            
            console.log(`Step ${step} data saved`);
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

        console.log('Master data collected:', masterData);

        // Handle file upload
        const drawingFile = document.getElementById('drawingFile')?.files[0];
        if (drawingFile) {
            console.log('Uploading drawing file:', drawingFile.name);
            const filePath = window.supabaseHelpers.generateFilePath('drawings', drawingFile.name);
            const url = await window.supabaseHelpers.uploadFile('drawings', drawingFile, filePath);
            if (url) {
                masterData.drawing_url = url;
                console.log('Drawing uploaded to:', url);
            }
        }

        this.npdData.master = masterData;
        console.log('Master data saved to npdData:', this.npdData.master);
    }
    async saveTools() {
        const container = document.getElementById('toolsContainer');
        if (!container) return;
        
        const toolRows = container.querySelectorAll('.tool-row');
        const tools = [];

        for (const row of toolRows) {
            const toolData = this.collectRowData(row);
            
            // Skip empty rows
            if (!toolData.tt_no && !toolData.tool_type) {
                continue;
            }
            
            // Handle tool photo upload
            const photoInput = row.querySelector('.tool-photo-input');
            if (photoInput?.files[0]) {
                const filePath = window.supabaseHelpers.generateFilePath('tool-photos', photoInput.files[0].name);
                const url = await window.supabaseHelpers.uploadFile('tool-photos', photoInput.files[0], filePath);
                if (url) {
                    toolData.tool_photo_url = url;
                }
            }

            tools.push(toolData);
        }

        this.npdData.tools = tools;
    }

    async saveGauges() {
        const container = document.getElementById('gaugesContainer');
        if (!container) return;
        
        const gaugeRows = container.querySelectorAll('.gauge-row');
        const gauges = [];

        for (const row of gaugeRows) {
            const gaugeData = this.collectRowData(row);
            
            // Skip empty rows
            if (!gaugeData.gauge_no && !gaugeData.gauge_type) {
                continue;
            }
            
            // Handle gauge photo upload
            const photoInput = row.querySelector('.gauge-photo-input');
            if (photoInput?.files[0]) {
                const filePath = window.supabaseHelpers.generateFilePath('gauge-photos', photoInput.files[0].name);
                const url = await window.supabaseHelpers.uploadFile('gauge-photos', photoInput.files[0], filePath);
                if (url) {
                    gaugeData.gauge_photo_url = url;
                }
            }

            gauges.push(gaugeData);
        }

        this.npdData.gauges = gauges;
    }

    async saveTrials() {
        const container = document.getElementById('trialsContainer');
        if (!container) return;
        
        const trialRows = container.querySelectorAll('.trial-row');
        const trials = [];

        for (const row of trialRows) {
            const trialData = this.collectRowData(row);
            
            // Skip empty rows
            if (!trialData.trial_date && !trialData.status) {
                continue;
            }
            
            // Handle trial report upload
            const reportInput = row.querySelector('.trial-report-input');
            if (reportInput?.files[0]) {
                const filePath = window.supabaseHelpers.generateFilePath('trial-reports', reportInput.files[0].name);
                const url = await window.supabaseHelpers.uploadFile('trial-reports', reportInput.files[0], filePath);
                if (url) {
                    trialData.report_url = url;
                }
            }

            trials.push(trialData);
        }

        this.npdData.trials = trials;
    }

    async saveSamples() {
        const container = document.getElementById('samplesContainer');
        if (!container) return;
        
        const sampleRows = container.querySelectorAll('.sample-row');
        const samples = [];

        for (const row of sampleRows) {
            const sampleData = this.collectRowData(row);
            
            // Skip empty rows
            if (!sampleData.submission_date && !sampleData.quantity && !sampleData.status) {
                continue;
            }

            samples.push(sampleData);
        }

        this.npdData.samples = samples;
    }

    async savePPAP() {
        const container = document.getElementById('ppapContainer');
        if (!container) return;
        
        const ppapRows = container.querySelectorAll('.ppap-row');
        const ppapSubmissions = [];

        for (const row of ppapRows) {
            const ppapData = this.collectRowData(row);
            
            // Skip empty rows
            if (!ppapData.submission_date && !ppapData.lot_quantity && !ppapData.status) {
                continue;
            }
            
            // Handle PPAP documents upload
            const docInput = row.querySelector('.ppap-doc-input');
            if (docInput?.files?.length > 0) {
                const urls = [];
                for (const file of docInput.files) {
                    const filePath = window.supabaseHelpers.generateFilePath('ppap-docs', file.name);
                    const url = await window.supabaseHelpers.uploadFile('ppap-docs', file, filePath);
                    if (url) {
                        urls.push(url);
                    }
                }
                if (urls.length > 0) {
                    ppapData.document_urls = urls;
                }
            }

            ppapSubmissions.push(ppapData);
        }

        this.npdData.ppap = ppapSubmissions;
    }

    async saveDocuments() {
        const documentsData = {};
        
        // Collect document dates
        const docDates = [
            'ts_drawing_date',
            'rm_database_date',
            'inspection_format_date',
            'process_card_date',
            'ppap_doc_date'
        ];
        
        for (const doc of docDates) {
            const element = document.getElementById(doc.replace('_date', 'Date'));
            if (element?.value) {
                documentsData[doc] = element.value;
            }
        }
        
        // Handle document uploads
        const uploadPromises = [];
        const uploadElements = document.querySelectorAll('.documentUpload');
        
        for (const upload of uploadElements) {
            const docType = upload.dataset.doc;
            const fileInput = upload.querySelector('input[type="file"]');
            
            if (fileInput?.files[0]) {
                const file = fileInput.files[0];
                const filePath = window.supabaseHelpers.generateFilePath('documents', `${docType}_${file.name}`);
                
                uploadPromises.push(
                    window.supabaseHelpers.uploadFile('documents', file, filePath)
                        .then(url => {
                            if (url) {
                                documentsData[`${docType}_url`] = url;
                            }
                        })
                        .catch(error => {
                            console.error(`Error uploading ${docType}:`, error);
                        })
                );
            }
        }
        
        // Wait for all uploads to complete
        await Promise.all(uploadPromises);
        
        this.npdData.documents = documentsData;
    }

    async saveHandover() {
        const handoverData = {
            handover_done: document.querySelector('input[name="handoverDone"]:checked')?.value === 'true',
            handover_date: document.getElementById('handoverDate')?.value || null,
            handover_by: document.getElementById('handoverBy')?.value.trim() || null,
            handover_to: document.getElementById('handoverTo')?.value.trim() || null,
            handover_notes: document.getElementById('handoverNotes')?.value.trim() || null
        };
        
        // Handle handover documents upload
        const docInput = document.getElementById('handoverDocuments');
        if (docInput?.files?.length > 0) {
            const urls = [];
            for (const file of docInput.files) {
                const filePath = window.supabaseHelpers.generateFilePath('handover-docs', file.name);
                const url = await window.supabaseHelpers.uploadFile('handover-docs', file, filePath);
                if (url) {
                    urls.push(url);
                }
            }
            if (urls.length > 0) {
                handoverData.document_urls = urls;
            }
        }
        
        this.npdData.handover = handoverData;
        
        // Update master data with handover info
        if (this.npdData.master) {
            this.npdData.master.handover_done = handoverData.handover_done;
            this.npdData.master.handover_date = handoverData.handover_date;
            this.npdData.master.handover_by = handoverData.handover_by;
            this.npdData.master.handover_to = handoverData.handover_to;
        }
    }

    collectRowData(row) {
        const data = {};
        const inputs = row.querySelectorAll('[data-field]');
        
        inputs.forEach(input => {
            const field = input.dataset.field;
            if (input.type === 'date') {
                data[field] = input.value || null;
            } else if (input.type === 'number') {
                data[field] = input.value ? parseFloat(input.value) : null;
            } else if (input.tagName === 'SELECT') {
                data[field] = input.value;
            } else if (input.tagName === 'TEXTAREA') {
                data[field] = input.value.trim();
            } else {
                data[field] = input.value.trim();
            }
        });

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
                } else if (input.type === 'number') {
                    input.value = data[key] || '';
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
            await this.saveStepData(this.currentStep);
            
            this.npdData.master.is_draft = true;
            this.npdData.master.current_stage = 'DRAFT';
            
            console.log('Draft master data:', this.npdData.master);
            
            if (await this.saveNPD()) {
                this.showSuccess('Saved as draft successfully!');
                
                setTimeout(() => {
                    window.location.href = 'analytics.html';
                }, 1500);
            } else {
                this.showError('Failed to save draft');
            }
            
        } catch (error) {
            console.error('Error saving draft:', error);
            this.showError('Error saving draft: ' + error.message);
        }
    }
    async saveNPD() {
        try {
            let npdId = this.currentNPDId;

            // First save master data to get the ID
            const { data: npd, error: masterError } = await window.supabaseClient
                .from('npd_master')
                .insert([this.npdData.master])
                .select()
                .single();

            if (masterError) {
                console.error('Error saving NPD master:', masterError);
                throw masterError;
            }
            
            console.log('NPD master saved successfully:', npd);
            
            npdId = npd.id;
            this.currentNPDId = npdId;

            // Now save all related data with the correct npd_id
            if (this.npdData.tools && this.npdData.tools.length > 0) {
                await this.saveRelatedData('tools', npdId, this.npdData.tools);
            }
            
            if (this.npdData.gauges && this.npdData.gauges.length > 0) {
                await this.saveRelatedData('gauges', npdId, this.npdData.gauges);
            }
            
            if (this.npdData.trials && this.npdData.trials.length > 0) {
                await this.saveRelatedData('trials', npdId, this.npdData.trials);
            }
            
            if (this.npdData.samples && this.npdData.samples.length > 0) {
                await this.saveRelatedData('sample_submissions', npdId, this.npdData.samples);
            }
            
            if (this.npdData.ppap && this.npdData.ppap.length > 0) {
                await this.saveRelatedData('ppap_submissions', npdId, this.npdData.ppap);
            }

            // Save documents
            if (this.npdData.documents && Object.keys(this.npdData.documents).length > 0) {
                const documentsWithNpdId = {
                    ...this.npdData.documents,
                    npd_id: npdId
                };
                
                const { error: docsError } = await window.supabaseClient
                    .from('documents')
                    .insert([documentsWithNpdId]);
                
                if (docsError) throw docsError;
            }

            // Save handover
            if (this.npdData.handover && Object.keys(this.npdData.handover).length > 0) {
                const handoverWithNpdId = {
                    ...this.npdData.handover,
                    npd_id: npdId
                };
                
                const { error: handoverError } = await window.supabaseClient
                    .from('handover')
                    .insert([handoverWithNpdId]);
                
                if (handoverError) throw handoverError;
            }

            console.log('NPD saved successfully with ID:', npdId);
            return true;
        } catch (error) {
            console.error('Error saving NPD:', error);
            this.showError('Error saving NPD: ' + error.message);
            return false;
        }
    }

    async saveRelatedData(table, npdId, items) {
        if (!items || items.length === 0) return;

        const itemsWithNpdId = items.map(item => ({
            ...item,
            npd_id: npdId
        }));

        console.log(`Saving ${items.length} items to ${table} for NPD ${npdId}:`, itemsWithNpdId);

        const { data, error } = await window.supabaseClient
            .from(table)
            .insert(itemsWithNpdId)
            .select();

        if (error) {
            console.error(`Error saving to ${table}:`, error);
            throw error;
        }
        
        console.log(`Successfully saved to ${table}:`, data);
        return data;
    }
    async saveRelatedData(table, npdId, items) {
        if (!items || items.length === 0) return;

        const itemsWithNpdId = items.map(item => ({
            ...item,
            npd_id: npdId
        }));

        const { error } = await window.supabaseClient
            .from(table)
            .upsert(itemsWithNpdId);

        if (error) throw error;
    }

    async generateNPDNo() {
        try {
            const { data, error } = await window.supabaseClient
                .rpc('generate_npd_no');

            if (error) throw error;
            
            document.getElementById('npdNo').value = data;
        } catch (error) {
            console.error('Error generating NPD number:', error);
            // Fallback to client-side generation
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const npdNo = `NPD-${year}${month}-${random}`;
            document.getElementById('npdNo').value = npdNo;
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
            console.log('Step validation passed');
            await this.saveStepData(this.currentStep);
            
            console.log('Updating NPD master data for completion');
            this.npdData.master.current_stage = 'PRODUCTION_RELEASED';
            this.npdData.master.handover_done = true;
            this.npdData.master.completion_date = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
            
            console.log('NPD master data:', this.npdData.master);
            
            if (await this.saveNPD()) {
                this.showSuccess('NPD created successfully!');
                
                setTimeout(() => {
                    window.location.href = 'analytics.html';
                }, 2000);
            } else {
                this.showError('Failed to save NPD');
            }
        } else {
            console.log('Step validation failed');
        }
    }

    setupDynamicRows(containerId, addButtonId, addRowFunction) {
        const container = document.getElementById(containerId);
        const addButton = document.getElementById(addButtonId);
        
        if (!container || !addButton) return;
        
        container.innerHTML = '';
        
        const dataKey = containerId.replace('Container', '').toLowerCase();
        
        if (this.npdData[dataKey]?.length > 0) {
            this.npdData[dataKey].forEach((item, index) => {
                addRowFunction(container, index === 0);
                const rows = container.querySelectorAll('.dynamic-row');
                if (rows.length > index) {
                    this.populateRowData(rows[index], item);
                }
            });
        } else {
            addRowFunction(container, true);
        }
        
        addButton.addEventListener('click', () => {
            addRowFunction(container, false);
        });
    }

    setupFileUpload(uploadDivId, fileInputId) {
        const uploadDiv = document.getElementById(uploadDivId);
        const fileInput = document.getElementById(fileInputId);
        
        if (!uploadDiv || !fileInput) return;
        
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

    updateGaugeNumbers() {
        const container = document.getElementById('gaugesContainer');
        if (!container) return;
        
        const gaugeRows = container.querySelectorAll('.gauge-row');
        gaugeRows.forEach((row, index) => {
            const header = row.querySelector('h4');
            if (header) {
                header.textContent = `Gauge ${index + 1}`;
            }
        });
    }

    updateTrialNumbers() {
        const container = document.getElementById('trialsContainer');
        if (!container) return;
        
        const trialRows = container.querySelectorAll('.trial-row');
        trialRows.forEach((row, index) => {
            const header = row.querySelector('h4');
            if (header) {
                header.textContent = `Trial ${index + 1}`;
            }
        });
    }

    updateSampleNumbers() {
        const container = document.getElementById('samplesContainer');
        if (!container) return;
        
        const sampleRows = container.querySelectorAll('.sample-row');
        sampleRows.forEach((row, index) => {
            const header = row.querySelector('h4');
            if (header) {
                header.textContent = `Sample Submission ${index + 1}`;
            }
        });
    }

    updatePPAPNumbers() {
        const container = document.getElementById('ppapContainer');
        if (!container) return;
        
        const ppapRows = container.querySelectorAll('.ppap-row');
        ppapRows.forEach((row, index) => {
            const header = row.querySelector('h4');
            if (header) {
                header.textContent = `PPAP Submission ${index + 1}`;
            }
        });
    }
}