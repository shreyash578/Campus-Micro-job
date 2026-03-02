// Load environment variables from .env into process.env
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const { getJwtConfig } = require('./utils/jwt');

// Validate JWT config at startup so auth is never running in insecure mode
getJwtConfig();

// Create an Express application instance
const app = express();

// Middleware to parse incoming JSON request bodies
app.use(express.json());

// Read values from environment variables with sensible fallbacks
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_microjob';

// Basic health route to verify server is running
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Campus Placement Microjob API is running' });
});

app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api/dashboard', dashboardRoutes);
app.use(express.static('public'));

// Connect to MongoDB first, then start the server
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected successfully');

    // Start listening for incoming HTTP requests
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    // Log connection errors and stop the process to avoid running without DB
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });
