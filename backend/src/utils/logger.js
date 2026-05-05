/**
 * logger.js - Tiện ích ghi log có định dạng
 *
 * Cung cấp các hàm log với:
 * - Timestamp cho mỗi dòng log
 * - Phân loại theo mức độ: info, warn, error, debug
 * - Dễ dàng thay thế bằng thư viện log chuyên dụng (Winston, Pino) sau này
 */

/**
 * Format timestamp hiện tại
 * @returns {string} Timestamp dạng ISO 8601
 */
const getTimestamp = () => new Date().toISOString();

/**
 * Log thông tin chung
 * @param {string} message - Nội dung log
 * @param  {...any} args - Tham số bổ sung
 */
const info = (message, ...args) => {
  console.log(`[${getTimestamp()}] ℹ️  INFO: ${message}`, ...args);
};

/**
 * Log cảnh báo
 * @param {string} message - Nội dung cảnh báo
 * @param  {...any} args - Tham số bổ sung
 */
const warn = (message, ...args) => {
  console.warn(`[${getTimestamp()}] ⚠️  WARN: ${message}`, ...args);
};

/**
 * Log lỗi
 * @param {string} message - Nội dung lỗi
 * @param  {...any} args - Tham số bổ sung
 */
const error = (message, ...args) => {
  console.error(`[${getTimestamp()}] ❌ ERROR: ${message}`, ...args);
};

/**
 * Log debug (chỉ hiển thị khi NODE_ENV !== 'production')
 * @param {string} message - Nội dung debug
 * @param  {...any} args - Tham số bổ sung
 */
const debug = (message, ...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[${getTimestamp()}] 🐛 DEBUG: ${message}`, ...args);
  }
};

module.exports = {
  info,
  warn,
  error,
  debug,
};
