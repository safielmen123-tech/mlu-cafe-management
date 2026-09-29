-- Progressive login lockout, admin security alerts, and blocked devices.
-- Applied automatically on backend startup as well.

CREATE TABLE IF NOT EXISTS login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(191) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  device_fingerprint CHAR(64) NULL,
  failed_count INT NOT NULL DEFAULT 0,
  stage TINYINT NOT NULL DEFAULT 1,
  locked_until DATETIME NULL,
  last_attempt_at DATETIME NOT NULL,
  UNIQUE KEY uq_login_attempts_user_ip (username, ip_address),
  KEY idx_login_attempts_locked (locked_until),
  KEY idx_login_attempts_ip (ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS security_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(191) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent VARCHAR(512) NULL,
  browser VARCHAR(64) NULL,
  os_name VARCHAR(64) NULL,
  device_type VARCHAR(32) NULL,
  device_fingerprint CHAR(64) NULL,
  location VARCHAR(191) NOT NULL DEFAULT 'Unknown',
  failed_attempts INT NOT NULL,
  stage TINYINT NOT NULL,
  status ENUM('NEW', 'REVIEWED', 'BLOCKED') NOT NULL DEFAULT 'NEW',
  created_at DATETIME NOT NULL,
  reviewed_at DATETIME NULL,
  KEY idx_security_alerts_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blocked_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  device_fingerprint CHAR(64) NOT NULL,
  alert_id INT NULL,
  blocked_by INT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_blocked_device (ip_address, device_fingerprint),
  KEY idx_blocked_devices_ip (ip_address),
  KEY idx_blocked_devices_fp (device_fingerprint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
