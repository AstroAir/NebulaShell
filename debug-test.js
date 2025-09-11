const { render, screen, waitFor } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event');
const { TerminalApp } = require('./src/components/terminal/TerminalApp');
const { mockSocket } = require('./__tests__/mocks/socket.io');

// Simple debug test
test('debug session timeout', async () => {
  const user = userEvent.setup();
  render(TerminalApp());

  // Connect
  await user.type(screen.getByLabelText(/hostname/i), 'timeout.example.com');
  await user.type(screen.getByLabelText(/username/i), 'testuser');
  await user.type(screen.getByPlaceholderText('Enter password'), 'testpass');

  mockSocket.connect();
  await user.click(screen.getByRole('button', { name: /connect/i }));

  const sessionId = 'timeout-session';
  mockSocket.simulateServerEvent('ssh_connected', {
    sessionId,
    status: 'connected'
  });

  await waitFor(() => {
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  // Simulate session timeout
  mockSocket.simulateServerEvent('ssh_error', {
    sessionId,
    message: 'Session timeout after 30 minutes of inactivity',
    code: 'SESSION_TIMEOUT'
  });

  await waitFor(() => {
    console.log('=== DEBUG: Current DOM ===');
    console.log(document.body.innerHTML);
    
    const statusBadge = screen.getByRole('status');
    console.log('=== DEBUG: Status Badge ===');
    console.log(statusBadge.textContent);
    
    // Try to find the message
    const allText = screen.queryAllByText(/session timeout/i);
    console.log('=== DEBUG: Found timeout messages ===');
    console.log(allText.length);
    allText.forEach((el, i) => console.log(`${i}: ${el.textContent}`));
  });
});
