FROM oven/bun:latest

# Install cron
RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files for main project
COPY package.json bun.lock ./

# Install main project dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build Docusaurus documentation site
WORKDIR /app/docs-site
RUN bun install --frozen-lockfile && \
    bun run build && \
    echo "Docusaurus build complete"

# Return to app root
WORKDIR /app

# Create cron job - runs at 2am on 5th of month
RUN echo "0 2 5 * * cd /app && bun src/jobs/refresh.ts >> /var/log/cron.log 2>&1" > /etc/cron.d/monthly-refresh && \
    chmod 0644 /etc/cron.d/monthly-refresh && \
    crontab /etc/cron.d/monthly-refresh && \
    touch /var/log/cron.log

# Create startup script
RUN echo '#!/bin/bash\n\
echo "Running database migrations..."\n\
bun src/db/migrate.ts\n\
echo "Starting cron daemon..."\n\
cron\n\
echo "Starting API server with documentation..."\n\
bun src/index.ts' > /app/start.sh && chmod +x /app/start.sh

# Expose API port
EXPOSE 3000

# Run migrations then start cron and API server
CMD ["/app/start.sh"]
