use crate::types::AppResult;
use crate::logging::StructuredLogger;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use dashmap::DashMap;
use chrono::{DateTime, Utc, Duration};
use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::{AsyncWriteExt, AsyncReadExt};
use uuid::Uuid;

// Recording configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingConfig {
    pub enabled: bool,
    pub storage_path: PathBuf,
    pub max_recording_size_mb: u64,
    pub retention_days: u32,
    pub compress_recordings: bool,
    pub include_metadata: bool,
    pub auto_cleanup: bool,
}

impl Default for RecordingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            storage_path: PathBuf::from("./recordings"),
            max_recording_size_mb: 100,
            retention_days: 30,
            compress_recordings: true,
            include_metadata: true,
            auto_cleanup: true,
        }
    }
}

// Terminal event types for recording
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalEvent {
    pub timestamp: DateTime<Utc>,
    pub event_type: TerminalEventType,
    pub data: String,
    pub metadata: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TerminalEventType {
    Input,
    Output,
    Resize,
    Connect,
    Disconnect,
    Command,
    Error,
}

// Recording session metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingMetadata {
    pub recording_id: String,
    pub session_id: String,
    pub user_id: Option<String>,
    pub hostname: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub duration_seconds: Option<u64>,
    pub total_events: u64,
    pub file_size_bytes: u64,
    pub terminal_size: Option<(u16, u16)>, // cols, rows
    pub tags: Vec<String>,
    pub description: Option<String>,
    pub compressed: bool,
}

// Active recording session
#[derive(Debug)]
pub struct ActiveRecording {
    pub metadata: RecordingMetadata,
    pub events: Vec<TerminalEvent>,
    pub file_handle: Option<tokio::fs::File>,
    pub last_activity: DateTime<Utc>,
    pub size_bytes: u64,
}

impl ActiveRecording {
    pub fn new(session_id: String, hostname: String, user_id: Option<String>) -> Self {
        let recording_id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        Self {
            metadata: RecordingMetadata {
                recording_id: recording_id.clone(),
                session_id,
                user_id,
                hostname,
                start_time: now,
                end_time: None,
                duration_seconds: None,
                total_events: 0,
                file_size_bytes: 0,
                terminal_size: None,
                tags: Vec::new(),
                description: None,
                compressed: false,
            },
            events: Vec::new(),
            file_handle: None,
            last_activity: now,
            size_bytes: 0,
        }
    }

    pub async fn add_event(&mut self, event: TerminalEvent) -> AppResult<()> {
        self.events.push(event.clone());
        self.metadata.total_events += 1;
        self.last_activity = Utc::now();
        
        // Estimate size increase
        let event_size = serde_json::to_string(&event)?.len() as u64;
        self.size_bytes += event_size;
        self.metadata.file_size_bytes = self.size_bytes;
        
        // Write to file if handle exists
        if let Some(ref mut file) = self.file_handle {
            let event_json = serde_json::to_string(&event)?;
            file.write_all(format!("{}\n", event_json).as_bytes()).await?;
            file.flush().await?;
        }
        
        Ok(())
    }

    pub fn set_terminal_size(&mut self, cols: u16, rows: u16) {
        self.metadata.terminal_size = Some((cols, rows));
    }

    pub fn add_tag(&mut self, tag: String) {
        if !self.metadata.tags.contains(&tag) {
            self.metadata.tags.push(tag);
        }
    }

    pub fn set_description(&mut self, description: String) {
        self.metadata.description = Some(description);
    }

    pub async fn finalize(&mut self) -> AppResult<()> {
        let now = Utc::now();
        self.metadata.end_time = Some(now);
        self.metadata.duration_seconds = Some(
            (now - self.metadata.start_time).num_seconds() as u64
        );
        
        if let Some(ref mut file) = self.file_handle {
            file.flush().await?;
        }
        
        Ok(())
    }
}

// Recording search criteria
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSearchCriteria {
    pub session_id: Option<String>,
    pub user_id: Option<String>,
    pub hostname: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub tags: Vec<String>,
    pub min_duration_seconds: Option<u64>,
    pub max_duration_seconds: Option<u64>,
    pub text_search: Option<String>,
}

// Playback control
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackControl {
    pub speed: f64, // 1.0 = normal speed, 0.5 = half speed, 2.0 = double speed
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub filter_event_types: Option<Vec<TerminalEventType>>,
}

impl Default for PlaybackControl {
    fn default() -> Self {
        Self {
            speed: 1.0,
            start_time: None,
            end_time: None,
            filter_event_types: None,
        }
    }
}

// Main recording manager
pub struct RecordingManager {
    config: RecordingConfig,
    active_recordings: Arc<DashMap<String, ActiveRecording>>,
    metadata_cache: Arc<RwLock<HashMap<String, RecordingMetadata>>>,
}

impl RecordingManager {
    pub async fn new(config: RecordingConfig) -> AppResult<Self> {
        // Ensure storage directory exists
        if !config.storage_path.exists() {
            fs::create_dir_all(&config.storage_path).await?;
        }
        
        let manager = Self {
            config,
            active_recordings: Arc::new(DashMap::new()),
            metadata_cache: Arc::new(RwLock::new(HashMap::new())),
        };
        
        // Load existing metadata
        manager.load_metadata_cache().await?;
        
        // Start cleanup task if enabled
        if manager.config.auto_cleanup {
            manager.start_cleanup_task();
        }
        
        Ok(manager)
    }

    // Start recording a session
    pub async fn start_recording(&self, session_id: String, hostname: String, user_id: Option<String>) -> AppResult<String> {
        if !self.config.enabled {
            return Err(crate::types::AppError::OperationFailed("Recording is disabled".to_string()));
        }
        
        let mut recording = ActiveRecording::new(session_id.clone(), hostname, user_id);
        let recording_id = recording.metadata.recording_id.clone();
        
        // Create recording file
        let file_path = self.get_recording_file_path(&recording_id);
        let file = fs::File::create(&file_path).await?;
        recording.file_handle = Some(file);
        
        // Add initial connect event
        let connect_event = TerminalEvent {
            timestamp: Utc::now(),
            event_type: TerminalEventType::Connect,
            data: format!("Recording started for session {}", session_id),
            metadata: Some({
                let mut meta = HashMap::new();
                meta.insert("recording_id".to_string(), recording_id.clone());
                meta.insert("session_id".to_string(), session_id.clone());
                meta
            }),
        };
        
        recording.add_event(connect_event).await?;
        
        self.active_recordings.insert(session_id, recording);
        
        StructuredLogger::log_performance_metric(
            "recording_started",
            1.0,
            "count",
            Some({
                let mut details = HashMap::new();
                details.insert("recording_id".to_string(), recording_id.clone());
                details
            }),
        );
        
        Ok(recording_id)
    }

    // Stop recording a session
    pub async fn stop_recording(&self, session_id: &str) -> AppResult<Option<RecordingMetadata>> {
        if let Some((_, mut recording)) = self.active_recordings.remove(session_id) {
            // Add disconnect event
            let disconnect_event = TerminalEvent {
                timestamp: Utc::now(),
                event_type: TerminalEventType::Disconnect,
                data: format!("Recording stopped for session {}", session_id),
                metadata: None,
            };
            
            recording.add_event(disconnect_event).await?;
            recording.finalize().await?;
            
            // Save metadata
            let metadata = recording.metadata.clone();
            self.save_metadata(&metadata).await?;
            
            // Update cache
            {
                let mut cache = self.metadata_cache.write().await;
                cache.insert(metadata.recording_id.clone(), metadata.clone());
            }
            
            StructuredLogger::log_performance_metric(
                "recording_stopped",
                metadata.duration_seconds.unwrap_or(0) as f64,
                "seconds",
                Some({
                    let mut details = HashMap::new();
                    details.insert("recording_id".to_string(), metadata.recording_id.clone());
                    details.insert("total_events".to_string(), metadata.total_events.to_string());
                    details.insert("file_size_bytes".to_string(), metadata.file_size_bytes.to_string());
                    details
                }),
            );
            
            Ok(Some(metadata))
        } else {
            Ok(None)
        }
    }

    // Record a terminal event
    pub async fn record_event(&self, session_id: &str, event: TerminalEvent) -> AppResult<()> {
        if !self.config.enabled {
            return Ok(());
        }
        
        if let Some(mut recording) = self.active_recordings.get_mut(session_id) {
            // Check size limit
            if recording.size_bytes > (self.config.max_recording_size_mb * 1024 * 1024) {
                log::warn!("Recording {} exceeded size limit, stopping", recording.metadata.recording_id);
                drop(recording); // Release the lock
                self.stop_recording(session_id).await?;
                return Ok(());
            }
            
            recording.add_event(event).await?;
        }
        
        Ok(())
    }

    // Set terminal size for recording
    pub fn set_terminal_size(&self, session_id: &str, cols: u16, rows: u16) {
        if let Some(mut recording) = self.active_recordings.get_mut(session_id) {
            recording.set_terminal_size(cols, rows);
        }
    }

    // Add tag to recording
    pub fn add_recording_tag(&self, session_id: &str, tag: String) {
        if let Some(mut recording) = self.active_recordings.get_mut(session_id) {
            recording.add_tag(tag);
        }
    }

    // Set recording description
    pub fn set_recording_description(&self, session_id: &str, description: String) {
        if let Some(mut recording) = self.active_recordings.get_mut(session_id) {
            recording.set_description(description);
        }
    }

    // Search recordings
    pub async fn search_recordings(&self, criteria: RecordingSearchCriteria) -> AppResult<Vec<RecordingMetadata>> {
        let cache = self.metadata_cache.read().await;
        let mut results = Vec::new();
        
        for metadata in cache.values() {
            if self.matches_criteria(metadata, &criteria) {
                results.push(metadata.clone());
            }
        }
        
        // Sort by start time (newest first)
        results.sort_by(|a, b| b.start_time.cmp(&a.start_time));
        
        Ok(results)
    }

    // Get recording metadata
    pub async fn get_recording_metadata(&self, recording_id: &str) -> AppResult<Option<RecordingMetadata>> {
        let cache = self.metadata_cache.read().await;
        Ok(cache.get(recording_id).cloned())
    }

    // Load recording events for playback
    pub async fn load_recording_events(&self, recording_id: &str, control: Option<PlaybackControl>) -> AppResult<Vec<TerminalEvent>> {
        let file_path = self.get_recording_file_path(recording_id);
        
        if !file_path.exists() {
            return Err(crate::types::AppError::NotFound(format!("Recording file not found: {}", recording_id)));
        }
        
        let mut file = fs::File::open(&file_path).await?;
        let mut contents = String::new();
        file.read_to_string(&mut contents).await?;
        
        let mut events = Vec::new();
        for line in contents.lines() {
            if let Ok(event) = serde_json::from_str::<TerminalEvent>(line) {
                events.push(event);
            }
        }
        
        // Apply playback control filters
        if let Some(control) = control {
            events = self.apply_playback_filters(events, &control);
        }
        
        Ok(events)
    }

    // Get recording statistics
    pub async fn get_recording_stats(&self) -> RecordingStats {
        let cache = self.metadata_cache.read().await;
        let now = Utc::now();
        let last_day = now - Duration::days(1);
        let last_week = now - Duration::days(7);
        
        let total_recordings = cache.len();
        let active_recordings = self.active_recordings.len();
        
        let recent_recordings = cache.values()
            .filter(|m| m.start_time > last_day)
            .count();
        
        let weekly_recordings = cache.values()
            .filter(|m| m.start_time > last_week)
            .count();
        
        let total_size_bytes: u64 = cache.values()
            .map(|m| m.file_size_bytes)
            .sum();
        
        let total_duration_seconds: u64 = cache.values()
            .map(|m| m.duration_seconds.unwrap_or(0))
            .sum();
        
        RecordingStats {
            total_recordings,
            active_recordings,
            recent_recordings,
            weekly_recordings,
            total_size_bytes,
            total_size_mb: total_size_bytes / (1024 * 1024),
            total_duration_seconds,
            average_duration_seconds: if total_recordings > 0 {
                total_duration_seconds / total_recordings as u64
            } else {
                0
            },
        }
    }

    // Helper methods
    fn get_recording_file_path(&self, recording_id: &str) -> PathBuf {
        self.config.storage_path.join(format!("{}.jsonl", recording_id))
    }

    fn get_metadata_file_path(&self, recording_id: &str) -> PathBuf {
        self.config.storage_path.join(format!("{}.meta.json", recording_id))
    }

    async fn save_metadata(&self, metadata: &RecordingMetadata) -> AppResult<()> {
        let file_path = self.get_metadata_file_path(&metadata.recording_id);
        let json = serde_json::to_string_pretty(metadata)?;
        fs::write(&file_path, json).await?;
        Ok(())
    }

    async fn load_metadata_cache(&self) -> AppResult<()> {
        let mut cache = self.metadata_cache.write().await;
        
        if !self.config.storage_path.exists() {
            return Ok(());
        }
        
        let mut dir = fs::read_dir(&self.config.storage_path).await?;
        while let Some(entry) = dir.next_entry().await? {
            let path = entry.path();
            if let Some(extension) = path.extension() {
                if extension == "json" && path.file_stem().unwrap().to_str().unwrap().ends_with(".meta") {
                    if let Ok(contents) = fs::read_to_string(&path).await {
                        if let Ok(metadata) = serde_json::from_str::<RecordingMetadata>(&contents) {
                            cache.insert(metadata.recording_id.clone(), metadata);
                        }
                    }
                }
            }
        }
        
        Ok(())
    }

    fn matches_criteria(&self, metadata: &RecordingMetadata, criteria: &RecordingSearchCriteria) -> bool {
        if let Some(ref session_id) = criteria.session_id {
            if metadata.session_id != *session_id {
                return false;
            }
        }
        
        if let Some(ref user_id) = criteria.user_id {
            if metadata.user_id.as_ref() != Some(user_id) {
                return false;
            }
        }
        
        if let Some(ref hostname) = criteria.hostname {
            if metadata.hostname != *hostname {
                return false;
            }
        }
        
        if let Some(start_date) = criteria.start_date {
            if metadata.start_time < start_date {
                return false;
            }
        }
        
        if let Some(end_date) = criteria.end_date {
            if metadata.start_time > end_date {
                return false;
            }
        }
        
        if !criteria.tags.is_empty()
            && !criteria.tags.iter().any(|tag| metadata.tags.contains(tag)) {
                return false;
            }
        
        if let Some(min_duration) = criteria.min_duration_seconds {
            if metadata.duration_seconds.unwrap_or(0) < min_duration {
                return false;
            }
        }
        
        if let Some(max_duration) = criteria.max_duration_seconds {
            if metadata.duration_seconds.unwrap_or(0) > max_duration {
                return false;
            }
        }
        
        true
    }

    fn apply_playback_filters(&self, mut events: Vec<TerminalEvent>, control: &PlaybackControl) -> Vec<TerminalEvent> {
        // Filter by time range
        if let Some(start_time) = control.start_time {
            events.retain(|e| e.timestamp >= start_time);
        }
        
        if let Some(end_time) = control.end_time {
            events.retain(|e| e.timestamp <= end_time);
        }
        
        // Filter by event types
        if let Some(ref filter_types) = control.filter_event_types {
            events.retain(|e| filter_types.contains(&e.event_type));
        }
        
        events
    }

    fn start_cleanup_task(&self) {
        let storage_path = self.config.storage_path.clone();
        let retention_days = self.config.retention_days;
        let metadata_cache = self.metadata_cache.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600)); // 1 hour
            
            loop {
                interval.tick().await;
                Self::cleanup_old_recordings(&storage_path, retention_days, &metadata_cache).await;
            }
        });
    }

    async fn cleanup_old_recordings(
        storage_path: &Path,
        retention_days: u32,
        metadata_cache: &Arc<RwLock<HashMap<String, RecordingMetadata>>>,
    ) {
        let cutoff = Utc::now() - Duration::days(retention_days as i64);
        let mut to_remove = Vec::new();
        
        {
            let cache = metadata_cache.read().await;
            for (recording_id, metadata) in cache.iter() {
                if metadata.start_time < cutoff {
                    to_remove.push(recording_id.clone());
                }
            }
        }
        
        for recording_id in to_remove {
            // Remove files
            let recording_file = storage_path.join(format!("{}.jsonl", recording_id));
            let metadata_file = storage_path.join(format!("{}.meta.json", recording_id));
            
            let _ = fs::remove_file(&recording_file).await;
            let _ = fs::remove_file(&metadata_file).await;
            
            // Remove from cache
            {
                let mut cache = metadata_cache.write().await;
                cache.remove(&recording_id);
            }
            
            log::info!("Cleaned up old recording: {}", recording_id);
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RecordingStats {
    pub total_recordings: usize,
    pub active_recordings: usize,
    pub recent_recordings: usize,
    pub weekly_recordings: usize,
    pub total_size_bytes: u64,
    pub total_size_mb: u64,
    pub total_duration_seconds: u64,
    pub average_duration_seconds: u64,
}
