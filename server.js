const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { spawn } = require('child_process');

// Create the Express application
const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost/judge0api', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define the User model schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const User = mongoose.model('User', userSchema);

// Middleware for parsing JSON request bodies
app.use(express.json());

// Endpoint for user registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = new User({ username, password });
    await user.save();
    res.status(200).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Endpoint for user login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ username }, 'secretkey');
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Middleware for authentication
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) {
    return res.sendStatus(401);
  }
  jwt.verify(token, 'secretkey', (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
}

// Endpoint for code submission and execution
app.post('/execute', authenticateToken, (req, res) => {
  const { code, language } = req.body;
  const executionResult = {
    output: '',
    error: '',
  };
  const process = spawn('python', ['-c', code]); // Example: executing Python code

  process.stdout.on('data', (data) => {
    executionResult.output += data.toString();
  });

  process.stderr.on('data', (data) => {
    executionResult.error += data.toString();
  });

  process.on('close', (code) => {
    executionResult.exitCode = code;
    res.status(200).json(executionResult);
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});