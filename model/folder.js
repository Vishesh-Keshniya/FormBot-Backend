const FolderSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  forms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Form' }],
});

const Folder = mongoose.model('Folder', FolderSchema);
module.exports = Folder;
