# Docker container for SSH server testing
FROM ubuntu:22.04

# Install SSH server and utilities
RUN apt-get update && apt-get install -y \
    openssh-server \
    sudo \
    curl \
    wget \
    vim \
    nano \
    htop \
    tree \
    git \
    python3 \
    python3-pip \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Create SSH host keys
RUN ssh-keygen -A

# Create test users
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser:testpass' | chpasswd && \
    useradd -m -s /bin/bash admin && \
    echo 'admin:adminpass' | chpasswd && \
    usermod -aG sudo admin

# Create test directories and files
RUN mkdir -p /home/testuser/projects /home/testuser/documents && \
    echo "Hello from test server!" > /home/testuser/welcome.txt && \
    echo "#!/bin/bash\necho 'Test script executed successfully'" > /home/testuser/test-script.sh && \
    chmod +x /home/testuser/test-script.sh && \
    chown -R testuser:testuser /home/testuser

# Configure SSH
RUN mkdir -p /var/run/sshd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# Create test SSH keys for key-based authentication
RUN mkdir -p /home/testuser/.ssh && \
    ssh-keygen -t rsa -b 2048 -f /home/testuser/.ssh/id_rsa -N "" && \
    cp /home/testuser/.ssh/id_rsa.pub /home/testuser/.ssh/authorized_keys && \
    chmod 700 /home/testuser/.ssh && \
    chmod 600 /home/testuser/.ssh/authorized_keys && \
    chown -R testuser:testuser /home/testuser/.ssh

# Create test environment variables and aliases
RUN echo 'export TEST_ENV_VAR="test-value"' >> /home/testuser/.bashrc && \
    echo 'alias ll="ls -la"' >> /home/testuser/.bashrc && \
    echo 'alias testcmd="echo Test command executed"' >> /home/testuser/.bashrc

# Expose SSH port
EXPOSE 22

# Start SSH service
CMD ["/usr/sbin/sshd", "-D"]
