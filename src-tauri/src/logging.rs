use crate::types::{AppError, ErrorSeverity};
use serde_json::json;
use std::collections::HashMap;

pub struct StructuredLogger;

impl StructuredLogger {
    pub fn log_error(error: &AppError, context: Option<&str>, metadata: Option<HashMap<String, String>>) {
        let severity = error.severity();
        let error_code = error.error_code();
        let is_retryable = error.is_retryable();
        
        let mut log_data = json!({
            "level": "error",
            "error_code": error_code,
            "error_message": error.to_string(),
            "severity": format!("{:?}", severity),
            "retryable": is_retryable,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        
        if let Some(ctx) = context {
            log_data["context"] = json!(ctx);
        }
        
        if let Some(meta) = metadata {
            log_data["metadata"] = json!(meta);
        }
        
        match severity {
            ErrorSeverity::Critical => log::error!("{}", log_data),
            ErrorSeverity::High => log::error!("{}", log_data),
            ErrorSeverity::Medium => log::warn!("{}", log_data),
            ErrorSeverity::Low => log::info!("{}", log_data),
        }
    }
    
    pub fn log_connection_event(event_type: &str, session_id: &str, details: Option<HashMap<String, String>>) {
        let mut log_data = json!({
            "level": "info",
            "event_type": "connection",
            "action": event_type,
            "session_id": session_id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        
        if let Some(details) = details {
            log_data["details"] = json!(details);
        }
        
        log::info!("{}", log_data);
    }
    
    pub fn log_performance_metric(metric_name: &str, value: f64, unit: &str, tags: Option<HashMap<String, String>>) {
        let mut log_data = json!({
            "level": "info",
            "event_type": "performance",
            "metric_name": metric_name,
            "value": value,
            "unit": unit,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        
        if let Some(tags) = tags {
            log_data["tags"] = json!(tags);
        }
        
        log::info!("{}", log_data);
    }
    
    pub fn log_security_event(event_type: &str, severity: &str, details: HashMap<String, String>) {
        let log_data = json!({
            "level": "warn",
            "event_type": "security",
            "action": event_type,
            "severity": severity,
            "details": details,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        
        log::warn!("{}", log_data);
    }
    
    pub fn log_transfer_event(transfer_id: &str, event_type: &str, details: Option<HashMap<String, String>>) {
        let mut log_data = json!({
            "level": "info",
            "event_type": "transfer",
            "transfer_id": transfer_id,
            "action": event_type,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        
        if let Some(details) = details {
            log_data["details"] = json!(details);
        }
        
        log::info!("{}", log_data);
    }
    
    pub fn log_websocket_event(client_id: &str, event_type: &str, details: Option<HashMap<String, String>>) {
        let mut log_data = json!({
            "level": "info",
            "event_type": "websocket",
            "client_id": client_id,
            "action": event_type,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        
        if let Some(details) = details {
            log_data["details"] = json!(details);
        }
        
        log::info!("{}", log_data);
    }
}

// Convenience macros for structured logging
#[macro_export]
macro_rules! log_error_with_context {
    ($error:expr, $context:expr) => {
        $crate::logging::StructuredLogger::log_error($error, Some($context), None);
    };
    ($error:expr, $context:expr, $metadata:expr) => {
        crate::logging::StructuredLogger::log_error($error, Some($context), Some($metadata));
    };
}

#[macro_export]
macro_rules! log_connection {
    ($event:expr, $session_id:expr) => {
        $crate::logging::StructuredLogger::log_connection_event($event, $session_id, None);
    };
    ($event:expr, $session_id:expr, $details:expr) => {
        crate::logging::StructuredLogger::log_connection_event($event, $session_id, Some($details));
    };
}

#[macro_export]
macro_rules! log_performance {
    ($metric:expr, $value:expr, $unit:expr) => {
        $crate::logging::StructuredLogger::log_performance_metric($metric, $value, $unit, None);
    };
    ($metric:expr, $value:expr, $unit:expr, $tags:expr) => {
        crate::logging::StructuredLogger::log_performance_metric($metric, $value, $unit, Some($tags));
    };
}

#[macro_export]
macro_rules! log_security {
    ($event:expr, $severity:expr, $details:expr) => {
        $crate::logging::StructuredLogger::log_security_event($event, $severity, $details);
    };
}

#[macro_export]
macro_rules! log_transfer {
    ($transfer_id:expr, $event:expr) => {
        $crate::logging::StructuredLogger::log_transfer_event($transfer_id, $event, None);
    };
    ($transfer_id:expr, $event:expr, $details:expr) => {
        crate::logging::StructuredLogger::log_transfer_event($transfer_id, $event, Some($details));
    };
}

#[macro_export]
macro_rules! log_websocket {
    ($client_id:expr, $event:expr) => {
        $crate::logging::StructuredLogger::log_websocket_event($client_id, $event, None);
    };
    ($client_id:expr, $event:expr, $details:expr) => {
        crate::logging::StructuredLogger::log_websocket_event($client_id, $event, Some($details));
    };
}

// Error context builder
pub struct ErrorContext {
    context: String,
    metadata: HashMap<String, String>,
}

impl ErrorContext {
    pub fn new(context: &str) -> Self {
        Self {
            context: context.to_string(),
            metadata: HashMap::new(),
        }
    }
    
    pub fn with_metadata(mut self, key: &str, value: &str) -> Self {
        self.metadata.insert(key.to_string(), value.to_string());
        self
    }
    
    pub fn log_error(&self, error: &AppError) {
        StructuredLogger::log_error(error, Some(&self.context), Some(self.metadata.clone()));
    }
}
