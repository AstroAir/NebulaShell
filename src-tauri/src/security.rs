use crate::types::AppResult;
use crate::logging::StructuredLogger;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use dashmap::DashMap;
use chrono::{DateTime, Utc, Duration};
use serde::{Serialize, Deserialize};
use std::net::IpAddr;
use sha2::{Sha256, Digest};

// Security configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub max_login_attempts: u32,
    pub lockout_duration_minutes: i64,
    pub rate_limit_requests_per_minute: u32,
    pub session_timeout_minutes: i64,
    pub require_key_fingerprint_verification: bool,
    pub allowed_encryption_algorithms: Vec<String>,
    pub audit_log_retention_days: u32,
    pub enable_ddos_protection: bool,
    pub max_concurrent_connections_per_ip: u32,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            max_login_attempts: 5,
            lockout_duration_minutes: 15,
            rate_limit_requests_per_minute: 60,
            session_timeout_minutes: 30,
            require_key_fingerprint_verification: true,
            allowed_encryption_algorithms: vec![
                "aes128-ctr".to_string(),
                "aes192-ctr".to_string(),
                "aes256-ctr".to_string(),
                "aes128-gcm@openssh.com".to_string(),
                "aes256-gcm@openssh.com".to_string(),
            ],
            audit_log_retention_days: 90,
            enable_ddos_protection: true,
            max_concurrent_connections_per_ip: 10,
        }
    }
}

// Security event types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityEvent {
    pub event_type: SecurityEventType,
    pub timestamp: DateTime<Utc>,
    pub source_ip: Option<IpAddr>,
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub details: HashMap<String, String>,
    pub severity: SecuritySeverity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityEventType {
    LoginAttempt,
    LoginSuccess,
    LoginFailure,
    AccountLockout,
    SuspiciousActivity,
    RateLimitExceeded,
    UnauthorizedAccess,
    KeyFingerprintMismatch,
    EncryptionViolation,
    SessionTimeout,
    DdosDetected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecuritySeverity {
    Low,
    Medium,
    High,
    Critical,
}

// Rate limiting
#[derive(Debug, Clone)]
struct RateLimitEntry {
    requests: Vec<DateTime<Utc>>,
    blocked_until: Option<DateTime<Utc>>,
}

// Account lockout tracking
#[derive(Debug, Clone)]
struct AccountSecurity {
    failed_attempts: u32,
    locked_until: Option<DateTime<Utc>>,
    last_attempt: DateTime<Utc>,
}

// SSH key fingerprint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshKeyFingerprint {
    pub algorithm: String,
    pub fingerprint: String,
    pub key_type: String,
}

// Main security manager
pub struct SecurityManager {
    config: SecurityConfig,
    rate_limits: Arc<DashMap<IpAddr, RateLimitEntry>>,
    account_security: Arc<DashMap<String, AccountSecurity>>,
    security_events: Arc<RwLock<Vec<SecurityEvent>>>,
    connection_counts: Arc<DashMap<IpAddr, u32>>,
    trusted_fingerprints: Arc<DashMap<String, Vec<SshKeyFingerprint>>>,
}

impl SecurityManager {
    pub fn new(config: SecurityConfig) -> Self {
        let manager = Self {
            config,
            rate_limits: Arc::new(DashMap::new()),
            account_security: Arc::new(DashMap::new()),
            security_events: Arc::new(RwLock::new(Vec::new())),
            connection_counts: Arc::new(DashMap::new()),
            trusted_fingerprints: Arc::new(DashMap::new()),
        };
        
        // Start cleanup tasks
        manager.start_cleanup_tasks();
        manager
    }

    // Rate limiting
    pub async fn check_rate_limit(&self, ip: IpAddr) -> AppResult<bool> {
        let now = Utc::now();
        let mut entry = self.rate_limits.entry(ip).or_insert_with(|| RateLimitEntry {
            requests: Vec::new(),
            blocked_until: None,
        });

        // Check if currently blocked
        if let Some(blocked_until) = entry.blocked_until {
            if now < blocked_until {
                self.log_security_event(SecurityEvent {
                    event_type: SecurityEventType::RateLimitExceeded,
                    timestamp: now,
                    source_ip: Some(ip),
                    user_id: None,
                    session_id: None,
                    details: {
                        let mut details = HashMap::new();
                        details.insert("blocked_until".to_string(), blocked_until.to_rfc3339());
                        details
                    },
                    severity: SecuritySeverity::Medium,
                }).await;
                return Ok(false);
            } else {
                entry.blocked_until = None;
                entry.requests.clear();
            }
        }

        // Clean old requests (older than 1 minute)
        let cutoff = now - Duration::minutes(1);
        entry.requests.retain(|&timestamp| timestamp > cutoff);

        // Check rate limit
        if entry.requests.len() >= self.config.rate_limit_requests_per_minute as usize {
            entry.blocked_until = Some(now + Duration::minutes(5)); // Block for 5 minutes
            self.log_security_event(SecurityEvent {
                event_type: SecurityEventType::RateLimitExceeded,
                timestamp: now,
                source_ip: Some(ip),
                user_id: None,
                session_id: None,
                details: {
                    let mut details = HashMap::new();
                    details.insert("requests_count".to_string(), entry.requests.len().to_string());
                    details.insert("limit".to_string(), self.config.rate_limit_requests_per_minute.to_string());
                    details
                },
                severity: SecuritySeverity::High,
            }).await;
            return Ok(false);
        }

        // Add current request
        entry.requests.push(now);
        Ok(true)
    }

    // Account lockout management
    pub async fn check_account_lockout(&self, username: &str) -> AppResult<bool> {
        let now = Utc::now();
        
        if let Some(mut security) = self.account_security.get_mut(username) {
            if let Some(locked_until) = security.locked_until {
                if now < locked_until {
                    return Ok(false); // Account is locked
                } else {
                    // Unlock account
                    security.locked_until = None;
                    security.failed_attempts = 0;
                }
            }
        }
        
        Ok(true) // Account is not locked
    }

    pub async fn record_login_attempt(&self, username: &str, ip: IpAddr, success: bool, session_id: Option<String>) -> AppResult<()> {
        let now = Utc::now();
        
        if success {
            // Reset failed attempts on successful login
            if let Some(mut security) = self.account_security.get_mut(username) {
                security.failed_attempts = 0;
                security.locked_until = None;
                security.last_attempt = now;
            }
            
            self.log_security_event(SecurityEvent {
                event_type: SecurityEventType::LoginSuccess,
                timestamp: now,
                source_ip: Some(ip),
                user_id: Some(username.to_string()),
                session_id,
                details: HashMap::new(),
                severity: SecuritySeverity::Low,
            }).await;
        } else {
            // Handle failed login
            let mut security = self.account_security.entry(username.to_string()).or_insert_with(|| AccountSecurity {
                failed_attempts: 0,
                locked_until: None,
                last_attempt: now,
            });
            
            security.failed_attempts += 1;
            security.last_attempt = now;
            
            if security.failed_attempts >= self.config.max_login_attempts {
                security.locked_until = Some(now + Duration::minutes(self.config.lockout_duration_minutes));
                
                self.log_security_event(SecurityEvent {
                    event_type: SecurityEventType::AccountLockout,
                    timestamp: now,
                    source_ip: Some(ip),
                    user_id: Some(username.to_string()),
                    session_id,
                    details: {
                        let mut details = HashMap::new();
                        details.insert("failed_attempts".to_string(), security.failed_attempts.to_string());
                        details.insert("lockout_duration_minutes".to_string(), self.config.lockout_duration_minutes.to_string());
                        details
                    },
                    severity: SecuritySeverity::High,
                }).await;
            } else {
                self.log_security_event(SecurityEvent {
                    event_type: SecurityEventType::LoginFailure,
                    timestamp: now,
                    source_ip: Some(ip),
                    user_id: Some(username.to_string()),
                    session_id,
                    details: {
                        let mut details = HashMap::new();
                        details.insert("failed_attempts".to_string(), security.failed_attempts.to_string());
                        details.insert("max_attempts".to_string(), self.config.max_login_attempts.to_string());
                        details
                    },
                    severity: SecuritySeverity::Medium,
                }).await;
            }
        }
        
        Ok(())
    }

    // SSH key fingerprint verification
    pub fn calculate_key_fingerprint(&self, public_key: &[u8], _algorithm: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(public_key);
        let result = hasher.finalize();

        // Format as SHA256 fingerprint using base64 encoding
        use base64::{Engine as _, engine::general_purpose};
        format!("SHA256:{}", general_purpose::STANDARD.encode(result))
    }

    pub async fn verify_key_fingerprint(&self, username: &str, fingerprint: &SshKeyFingerprint) -> AppResult<bool> {
        if !self.config.require_key_fingerprint_verification {
            return Ok(true);
        }
        
        if let Some(trusted_fingerprints) = self.trusted_fingerprints.get(username) {
            let is_trusted = trusted_fingerprints.iter().any(|trusted| {
                trusted.fingerprint == fingerprint.fingerprint && 
                trusted.algorithm == fingerprint.algorithm
            });
            
            if !is_trusted {
                self.log_security_event(SecurityEvent {
                    event_type: SecurityEventType::KeyFingerprintMismatch,
                    timestamp: Utc::now(),
                    source_ip: None,
                    user_id: Some(username.to_string()),
                    session_id: None,
                    details: {
                        let mut details = HashMap::new();
                        details.insert("provided_fingerprint".to_string(), fingerprint.fingerprint.clone());
                        details.insert("algorithm".to_string(), fingerprint.algorithm.clone());
                        details
                    },
                    severity: SecuritySeverity::High,
                }).await;
            }
            
            Ok(is_trusted)
        } else {
            // No trusted fingerprints for user - reject
            Ok(false)
        }
    }

    pub fn add_trusted_fingerprint(&self, username: &str, fingerprint: SshKeyFingerprint) {
        self.trusted_fingerprints
            .entry(username.to_string())
            .or_default()
            .push(fingerprint);
    }

    // Connection tracking for DDoS protection
    pub async fn track_connection(&self, ip: IpAddr) -> AppResult<bool> {
        if !self.config.enable_ddos_protection {
            return Ok(true);
        }
        
        let current_count = self.connection_counts
            .entry(ip)
            .and_modify(|count| *count += 1)
            .or_insert(1);
        
        if *current_count > self.config.max_concurrent_connections_per_ip {
            self.log_security_event(SecurityEvent {
                event_type: SecurityEventType::DdosDetected,
                timestamp: Utc::now(),
                source_ip: Some(ip),
                user_id: None,
                session_id: None,
                details: {
                    let mut details = HashMap::new();
                    details.insert("connection_count".to_string(), current_count.to_string());
                    details.insert("max_allowed".to_string(), self.config.max_concurrent_connections_per_ip.to_string());
                    details
                },
                severity: SecuritySeverity::Critical,
            }).await;
            
            return Ok(false);
        }
        
        Ok(true)
    }

    pub fn release_connection(&self, ip: IpAddr) {
        self.connection_counts.entry(ip).and_modify(|count| {
            if *count > 0 {
                *count -= 1;
            }
        });
    }

    // Security event logging
    async fn log_security_event(&self, event: SecurityEvent) {
        // Add to internal log
        {
            let mut events = self.security_events.write().await;
            events.push(event.clone());

            // Keep only recent events (last 1000)
            let events_len = events.len();
            if events_len > 1000 {
                events.drain(0..events_len - 1000);
            }
        }
        
        // Log to structured logger
        let mut details = event.details.clone();
        details.insert("event_type".to_string(), format!("{:?}", event.event_type));
        details.insert("severity".to_string(), format!("{:?}", event.severity));
        
        if let Some(ip) = event.source_ip {
            details.insert("source_ip".to_string(), ip.to_string());
        }
        
        if let Some(user_id) = &event.user_id {
            details.insert("user_id".to_string(), user_id.clone());
        }
        
        if let Some(session_id) = &event.session_id {
            details.insert("session_id".to_string(), session_id.clone());
        }
        
        StructuredLogger::log_security_event(
            &format!("{:?}", event.event_type),
            &format!("{:?}", event.severity),
            details,
        );
    }

    // Get security statistics
    pub async fn get_security_stats(&self) -> SecurityStats {
        let events = self.security_events.read().await;
        let now = Utc::now();
        let last_hour = now - Duration::hours(1);
        let last_day = now - Duration::days(1);
        
        let recent_events: Vec<&SecurityEvent> = events.iter()
            .filter(|event| event.timestamp > last_hour)
            .collect();
        
        let daily_events: Vec<&SecurityEvent> = events.iter()
            .filter(|event| event.timestamp > last_day)
            .collect();
        
        SecurityStats {
            total_events: events.len(),
            events_last_hour: recent_events.len(),
            events_last_day: daily_events.len(),
            active_rate_limits: self.rate_limits.len(),
            locked_accounts: self.account_security.iter()
                .filter(|entry| entry.value().locked_until.is_some_and(|until| until > now))
                .count(),
            active_connections: self.connection_counts.iter()
                .map(|entry| *entry.value())
                .sum(),
            critical_events_last_day: daily_events.iter()
                .filter(|event| matches!(event.severity, SecuritySeverity::Critical))
                .count(),
        }
    }

    // Cleanup tasks
    fn start_cleanup_tasks(&self) {
        let rate_limits = self.rate_limits.clone();
        let account_security = self.account_security.clone();
        let security_events = self.security_events.clone();
        let retention_days = self.config.audit_log_retention_days;
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // 5 minutes
            
            loop {
                interval.tick().await;
                Self::cleanup_expired_data(&rate_limits, &account_security, &security_events, retention_days).await;
            }
        });
    }

    async fn cleanup_expired_data(
        rate_limits: &Arc<DashMap<IpAddr, RateLimitEntry>>,
        account_security: &Arc<DashMap<String, AccountSecurity>>,
        security_events: &Arc<RwLock<Vec<SecurityEvent>>>,
        retention_days: u32,
    ) {
        let now = Utc::now();
        let cutoff = now - Duration::minutes(5);
        let retention_cutoff = now - Duration::days(retention_days as i64);
        
        // Clean up expired rate limits
        rate_limits.retain(|_, entry| {
            if let Some(blocked_until) = entry.blocked_until {
                blocked_until > now
            } else {
                !entry.requests.is_empty() && entry.requests.iter().any(|&timestamp| timestamp > cutoff)
            }
        });
        
        // Clean up expired account lockouts
        account_security.retain(|_, security| {
            if let Some(locked_until) = security.locked_until {
                locked_until > now || security.last_attempt > cutoff
            } else {
                security.last_attempt > cutoff
            }
        });
        
        // Clean up old security events
        {
            let mut events = security_events.write().await;
            events.retain(|event| event.timestamp > retention_cutoff);
        }
    }
}

#[derive(Debug, Serialize)]
pub struct SecurityStats {
    pub total_events: usize,
    pub events_last_hour: usize,
    pub events_last_day: usize,
    pub active_rate_limits: usize,
    pub locked_accounts: usize,
    pub active_connections: u32,
    pub critical_events_last_day: usize,
}
