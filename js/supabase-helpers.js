// Supabase Helper Functions
window.supabaseHelpers = {
    // Generate file path for storage
    generateFilePath: function(folder, fileName) {
        const timestamp = Date.now();
        const safeFileName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
        return `${folder}/${timestamp}_${safeFileName}`;
    },
    
    // Upload file to Supabase Storage
    uploadFile: async function(bucket, file, filePath) {
        try {
            console.log(`Uploading file to ${bucket}:`, file.name);
            
            // Check file size (10MB limit)
            if (file.size > 10 * 1024 * 1024) {
                throw new Error('File size exceeds 10MB limit');
            }
            
            const { data, error } = await window.supabaseClient
                .storage
                .from(bucket)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });
            
            if (error) {
                console.error('Upload error:', error);
                throw error;
            }
            
            // Get public URL
            const { data: { publicUrl } } = window.supabaseClient
                .storage
                .from(bucket)
                .getPublicUrl(filePath);
            
            console.log('File uploaded successfully:', publicUrl);
            return publicUrl;
            
        } catch (error) {
            console.error('Error in uploadFile:', error);
            throw error;
        }
    },
    
    // Download file from Supabase Storage
    downloadFile: async function(bucket, filePath) {
        try {
            const { data, error } = await window.supabaseClient
                .storage
                .from(bucket)
                .download(filePath);
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error downloading file:', error);
            return null;
        }
    },
    
    // Delete file from Supabase Storage
    deleteFile: async function(bucket, filePath) {
        try {
            const { error } = await window.supabaseClient
                .storage
                .from(bucket)
                .remove([filePath]);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }
};
// Supabase helper functions
async function uploadFile(file, bucket = 'npd-documents', path = '') {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = path ? `${path}/${fileName}` : fileName;
        
        const { data, error } = await window.supabaseClient
            .storage
            .from(bucket)
            .upload(filePath, file);
        
        if (error) throw error;
        
        // Get public URL
        const { data: { publicUrl } } = window.supabaseClient
            .storage
            .from(bucket)
            .getPublicUrl(filePath);
        
        return { url: publicUrl, path: filePath };
        
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

async function deleteFile(filePath, bucket = 'npd-documents') {
    try {
        const { error } = await window.supabaseClient
            .storage
            .from(bucket)
            .remove([filePath]);
        
        if (error) throw error;
        
    } catch (error) {
        console.error('Error deleting file:', error);
        throw error;
    }
}

function validateForm(formId) {
    const form = document.getElementById(formId);
    return form.checkValidity();
}

function collectFormData(formId) {
    const form = document.getElementById(formId);
    const formData = {};
    
    Array.from(form.elements).forEach(element => {
        if (element.name && element.type !== 'submit' && element.type !== 'button') {
            if (element.type === 'checkbox') {
                formData[element.name] = element.checked;
            } else if (element.type === 'file') {
                formData[element.name] = element.files[0];
            } else {
                formData[element.name] = element.value;
            }
        }
    });
    
    return formData;
}

// Date helper functions
function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function addDays(dateString, days) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}