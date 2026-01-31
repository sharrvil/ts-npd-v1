// utils.js - Common utilities for all pages

// Toast notification system
class Toast {
    static show(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${this.getIcon(type)}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Show animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    static getIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
}

// Date formatting utilities
const DateUtils = {
    formatDate(dateString, format = 'short') {
        if (!dateString) return 'Not set';
        
        const date = new Date(dateString);
        
        if (format === 'short') {
            return date.toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } else if (format === 'long') {
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        } else if (format === 'datetime') {
            return date.toLocaleString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        return date.toISOString().split('T')[0];
    },
    
    isPastDate(dateString) {
        if (!dateString) return false;
        return new Date(dateString) < new Date();
    },
    
    daysBetween(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = end - start;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
};

// File utilities
const FileUtils = {
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    getFileIcon(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const icons = {
            'pdf': '📕',
            'dwg': '📐',
            'dxf': '📐',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'doc': '📄',
            'docx': '📄',
            'xls': '📊',
            'xlsx': '📊',
            'txt': '📝'
        };
        
        return icons[extension] || '📄';
    },
    
    validateFile(file, options = {}) {
        const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
        const allowedTypes = options.allowedTypes || [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/jpg',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (file.size > maxSize) {
            return { valid: false, error: `File size must be less than ${this.formatFileSize(maxSize)}` };
        }
        
        if (!allowedTypes.includes(file.type)) {
            return { valid: false, error: 'File type not supported' };
        }
        
        return { valid: true };
    }
};

// Validation utilities
const Validation = {
    email(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    required(value) {
        return value !== null && value !== undefined && value.toString().trim() !== '';
    },
    
    minLength(value, min) {
        return value.length >= min;
    },
    
    maxLength(value, max) {
        return value.length <= max;
    },
    
    number(value, options = {}) {
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        
        if (options.min !== undefined && num < options.min) return false;
        if (options.max !== undefined && num > options.max) return false;
        
        return true;
    }
};

// Mobile detection and helpers
const MobileHelper = {
    isMobile() {
        return window.innerWidth < 768;
    },
    
    isTablet() {
        return window.innerWidth >= 768 && window.innerWidth < 1024;
    },
    
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },
    
    setupTouchScroll(container) {
        if (this.isTouchDevice()) {
            container.style.webkitOverflowScrolling = 'touch';
        }
    },
    
    preventZoom() {
        document.addEventListener('touchmove', function(event) {
            if (event.scale !== 1) {
                event.preventDefault();
            }
        }, { passive: false });
    }
};

// Export utilities to global scope
window.Toast = Toast;
window.DateUtils = DateUtils;
window.FileUtils = FileUtils;
window.Validation = Validation;
window.MobileHelper = MobileHelper;