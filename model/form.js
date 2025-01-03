const mongoose = require('mongoose');

const FormSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', required: true },
});

const Form = mongoose.model('Form', FormSchema);
module.exports = Form;
