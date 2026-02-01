// ============================================
// SUPABASE CONFIGURATION
// ============================================

// Supabase credentials
const SUPABASE_URL = 'https://kmxtelszfkcmbrljxqma.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtteHRlbHN6ZmtjbWJybGp4cW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MzkwNDksImV4cCI6MjA4NTQxNTA0OX0.hw_afqiNE8mx6xB4cGzOK36Kw62DFDD2NE3mXL9LvLs';

// ============================================
// INITIALIZE SUPABASE CLIENT (CORRECT)
// ============================================

// IMPORTANT:
// `supabase` comes from the CDN
// `createClient()` returns the actual client that has `.from()`

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// Expose globally for other JS files
window.supabaseClient = supabaseClient;

// Sanity check (you SHOULD see "function")
console.log('Supabase client loaded');
console.log('supabaseClient.from =', typeof supabaseClient.from);

// ============================================
// STORAGE HELPERS
// ============================================

async function uploadFile(bucket, file, filePath) {
    try {
        const { error } = await supabaseClient.storage
            .from(bucket)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        const { data } = supabaseClient.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error) {
        console.error('Upload error:', error);
        return null;
    }
}

function generateFilePath(prefix, fileName) {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2);
    const safeName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
    return `${prefix}/${timestamp}_${rand}_${safeName}`;
}

async function deleteFile(bucket, filePath) {
    try {
        const { error } = await supabaseClient.storage
            .from(bucket)
            .remove([filePath]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Delete error:', error);
        return false;
    }
}

async function listBuckets() {
    try {
        const { data, error } = await supabaseClient.storage.listBuckets();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error(error);
        return [];
    }
}

async function listFiles(bucket, folder = '') {
    try {
        const { data, error } = await supabaseClient.storage
            .from(bucket)
            .list(folder);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error(error);
        return [];
    }
}

// ============================================
// CONNECTION TEST
// ============================================

async function testConnection() {
    try {
        const { error } = await supabaseClient
            .from('npd_master')
            .select('id')
            .limit(1);

        if (error) {
            console.error('Supabase connection failed:', error);
            return false;
        }

        console.log('Supabase connected successfully');
        return true;
    } catch (err) {
        console.error('Connection test error:', err);
        return false;
    }
}

// Run test once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    testConnection();
});

// ============================================
// EXPORT HELPERS
// ============================================

window.supabaseHelpers = {
    uploadFile,
    generateFilePath,
    deleteFile,
    listBuckets,
    listFiles,
    testConnection
};
