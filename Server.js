const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: "https://form-bot-full-stack-31tj.vercel.app/", 
  credentials: true, 
}));

app.use(express.json());


app.use(
  session({
    secret: process.env.SESSION_SECRET || 'some_random_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, 
      httpOnly: true,
      sameSite: 'lax',
    },
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  })
);


mongoose.connect(
  process.env.MONGO_URI || 'mongodb+srv://your_mongodb_url',
  { useNewUrlParser: true, useUnifiedTopology: true }
)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));


const FolderSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  forms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Form' }]
});
const Folder = mongoose.model('Folder', FolderSchema);

const FormSchema = new mongoose.Schema({
  name: { type: String, required: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' }
});
const Form = mongoose.model('Form', FormSchema);

// User Schema for Authentication
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model('User', UserSchema);


const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });
    req.user = decoded;
    next();
  });
};

// Routes

// Sign-Up Route
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });
    res.status(201).json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create Folder Route
app.post('/api/folders', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Folder name is required' });
  }
  try {
    const newFolder = new Folder({ name });
    await newFolder.save();
    res.status(201).json(newFolder);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Folder name must be unique' });
    }
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Route to fetch all folders
app.get('/api/folders', async (req, res) => {
  try {
    const folders = await Folder.find();
    res.status(200).json(folders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});


// Create Form Route
app.post('/api/forms', async (req, res) => {
  const { name, folderId } = req.body;
  try {
    const form = new Form({ name, folderId });
    await form.save();

    // Optionally update the folder to include the form
    await Folder.findByIdAndUpdate(folderId, { $push: { forms: form._id } });

    res.status(201).json(form);
  } catch (error) {
    console.error('Error creating form:', error);
    res.status(500).json({ message: 'Error creating form' });
  }
});

// Fetch forms for a folder
app.get('/api/forms/:folderId', async (req, res) => {
  const { folderId } = req.params;
  try {
    const forms = await Form.find({ folderId });
    res.status(200).json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ message: 'Error fetching forms' });
  }
});

// Delete a form
app.delete('/api/forms/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const form = await Form.findByIdAndDelete(id);
    if (form) {
      await Folder.findByIdAndUpdate(form.folderId, { $pull: { forms: form._id } });
    }
    res.status(200).json({ message: 'Form deleted' });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({ message: 'Error deleting form' });
  }
});

// Fetch Folders Route
app.get('/folders', authenticate, async (req, res) => {
  try {
    const folders = await Folder.find().populate('forms');
    res.json(folders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch Username Route
app.get('/username', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json({ username: user.username });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Folder Route
app.delete('/folders/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    await Folder.findByIdAndDelete(id);
    res.status(200).json({ message: 'Folder deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/globalForms', async (req, res) => {
  try {
    const globalForms = await GlobalForm.find();
    res.json(globalForms);
  } catch (error) {
    console.error('Error fetching global forms:', error);
    res.status(500).send('Server Error');
  }
});

// Route to create a Global Form
app.post('/api/globalForms', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).send('Form name is required');
  }

  try {
    const newForm = new GlobalForm({ name });
    await newForm.save();
    res.json(newForm);
  } catch (error) {
    console.error('Error creating global form:', error);
    res.status(500).send('Server Error');
  }
});

// Delete Form Route
// Delete Folder Route
app.delete('/api/folders/:folderId', async (req, res) => {
  try {
    const folderId = req.params.folderId;
    const folder = await Folder.findByIdAndDelete(folderId); // Delete the folder from the database
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }
    res.status(200).json({ message: "Folder deleted successfully" });
  } catch (error) {
    console.error("Error deleting folder:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
// Delete Form Route
app.delete('/api/forms/:formId', async (req, res) => {
  try {
    const formId = req.params.formId;
    const form = await Form.findByIdAndDelete(formId); // Delete the form from the database
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }
    res.status(200).json({ message: "Form deleted successfully" });
  } catch (error) {
    console.error("Error deleting form:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Server Listening
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log("Server running on port 8000 " );
});
