/**
 * Token utility functions
 */

export const tokenUtils = {
  /**
   * Get token from localStorage
   */
  getToken: (): string | null => {
    return localStorage.getItem('token');
  },

  /**
   * Set token in localStorage
   */
  setToken: (token: string): void => {
    localStorage.setItem('token', token);
  },

  /**
   * Remove token from localStorage
   */
  removeToken: (): void => {
    localStorage.removeItem('token');
  },

  /**
   * Check if token exists
   */
  hasToken: (): boolean => {
    return !!localStorage.getItem('token');
  },

  /**
   * Clear all auth data
   */
  clearAuth: (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};

/**
 * Date utility functions
 */
export const dateUtils = {
  /**
   * Format date to readable string
   */
  formatDate: (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  },

  /**
   * Format date with time
   */
  formatDateTime: (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },
};

/**
 * Validation utility functions
 */
export const validationUtils = {
  /**
   * Validate email format
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate if string is not empty
   */
  isNotEmpty: (value: string): boolean => {
    return value.trim().length > 0;
  },

  /**
   * Validate image file type
   */
  isImageFile: (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
  },
};

/**
 * Object utility functions
 */
export const objectUtils = {
  /**
   * Check if object is empty
   */
  isEmpty: (obj: Record<string, unknown>): boolean => {
    return Object.keys(obj).length === 0;
  },

  /**
   * Deep clone an object
   */
  deepClone: <T>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
  },
};
