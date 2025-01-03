// Global Form Schema
const GlobalFormSchema = new mongoose.Schema({
    name: { type: String, required: true },
  });
  const GlobalForm = mongoose.model('GlobalForm', GlobalFormSchema);
  
  // Fetch Global Forms Route
  app.get('/api/globalForms', async (req, res) => {
    try {
      const globalForms = await GlobalForm.find();
      res.json(globalForms);
    } catch (err) {
      res.status(500).json({ message: "Error fetching global forms" });
    }
  });
  