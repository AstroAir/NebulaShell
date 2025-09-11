// Test binary to run the HTTP server standalone for testing
use webterminal_pro_lib::server::AppServer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    env_logger::init();
    
    println!("Starting test HTTP server on port 3001...");
    
    let server = AppServer::new(3001).await?;

    println!("Server starting at http://localhost:3001");
    println!("Health check: http://localhost:3001/health");
    println!("WebSocket endpoint: ws://localhost:3001/ws");
    println!("Press Ctrl+C to stop");

    server.start().await?;
    
    Ok(())
}
