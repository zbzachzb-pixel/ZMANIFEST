# Use the official Node.js 18 image as the base image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of your application code to the container
COPY . .

# Expose the port your app listens on (Cloud Run typically uses 8080)
EXPOSE 8080

# Define the command to run your application
CMD ["npm", "start"]
