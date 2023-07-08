const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { spawn } = require('child_process');
const Docker = require('dockerode');
// Creating the Express application
const app = express();

// Connecting to MongoDB Database
mongoose.connect('mongodb://localhost/judge0api', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
}); 

// Define the Submission model schema
const submissionSchema = new mongoose.Schema({
  code: String,
  language: String,
  userId: mongoose.Schema.Types.ObjectId,
  result: {
    output: String,
    error: String,
    exitCode: Number,
  },
});

// Define the User model schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
},{ collection: 'ravi' });

// Defining collection names explicitly
const Submission = mongoose.model('Submission', submissionSchema, 'submissions');
const User = mongoose.model('User', userSchema, 'users');

// Middleware for parsing JSON request bodies
app.use(express.json());

// Checking user registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = new User({ username, password });
    await user.save();
    res.status(200).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'User Registration unsuccessful' });
  }
});

// Checking user login
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

// Middleware 
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

// Sandbox 
function executeCode(code, language) {
  return new Promise((resolve, reject) => {
    const docker = new Docker();
    const containerOptions = {
      Image: `judge0/${language}`,
      Cmd: ['timeout', '5', 'python', '-c', code], // Example: executing Python code
    };

    docker.createContainer(containerOptions, (err, container) => {
      if (err) {
        reject(err);
      }

      container.start((err) => {
        if (err) {
          reject(err);
        }

        container.wait((err, data) => {
          if (err) {
            reject(err);
          }

          container.remove(() => {
            resolve(data);
          });
        });
      });
    });
  });
}

// Endpoint for code submission and execution
app.post('/execute', authenticateToken, async (req, res) => {
  const { code, language } = req.body;
  const { username } = req.user;
  try {
    const user = await User.findOne({ username });
    const submission = new Submission({
      code,
      language,
      userId: user._id,
    });

    const executionResult = {
      output: '',
      error: '',
      exitCode: 0,
    };

    const dockerExecutionData = await executeCode(code, language);

    executionResult.output = dockerExecutionData.output;
    executionResult.error = dockerExecutionData.error;
    executionResult.exitCode = dockerExecutionData.statusCode;

    submission.result = executionResult;
    await submission.save();
    res.status(200).json(executionResult);
  } catch (error) {
    res.status(500).json({ message: 'Error submitting and executing code' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// Starting the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});