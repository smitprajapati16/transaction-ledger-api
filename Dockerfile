# Node.js Alpine base image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY src/ ./src/

# Expose API port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Run as non-root node user for security
USER node

# Start API server
CMD ["node", "src/server.js"]

