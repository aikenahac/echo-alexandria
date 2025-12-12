FROM oven/bun:latest

# Install cron
RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Create cron job - runs at 2am on 5th of month
RUN echo "0 2 5 * * cd /app && bun src/jobs/refresh.ts >> /var/log/cron.log 2>&1" > /etc/cron.d/monthly-refresh && \
    chmod 0644 /etc/cron.d/monthly-refresh && \
    crontab /etc/cron.d/monthly-refresh && \
    touch /var/log/cron.log

# Expose API port
EXPOSE 3000

# Start cron and API server
CMD cron && bun src/index.ts
