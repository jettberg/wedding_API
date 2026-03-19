require('dotenv').config();

const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

// test route
app.get('/', (req, res) => {
  res.send('Wedding API is running');
});

// routes
const userRoutes = require('./routes/users');
app.use('/users', userRoutes);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});