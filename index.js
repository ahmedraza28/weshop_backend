const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const AdmZip = require('adm-zip'); // Import the adm-zip library

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/Weshopfiles', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB...'))
  .catch(err => console.error('Could not connect to MongoDB...', err));

  const fileSchema = new mongoose.Schema({
    imageName: String,
    imagePath: String,
    npyName: String,
    npyPath: String
  });
  const File = mongoose.model('File', fileSchema);


// Multer setup for file uploads (saving files on disk)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/')  // 'uploads/' is the folder where files will be saved
    },
    filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
  });

  const upload = multer({ storage: storage });

// Body-parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// // Update your upload endpoint
// app.post('/upload', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'npyFile', maxCount: 1 }]), async (req, res) => {
//   try {
//     const newFile = new File({
//       imageName: req.files['image'][0].originalname,
//       imagePath: req.files['image'][0].path,
//       npyName: req.files['npyFile'][0].originalname,
//       npyPath: req.files['npyFile'][0].path
//     });
//     await newFile.save();
//     res.send('Files uploaded and saved to server');
//   } catch (error) {
//     console.log(error);
//     res.status(500).send('Error occurred while saving the file');
//   }
// });


app.post('/upload', upload.single('image'), async (req, res) => {
    try {
      const imagePath = req.file.path;
      const imageName = req.file.originalname;
  
      // Create form-data for the external request
      const formData = new FormData();
      formData.append('file', fs.createReadStream(imagePath));
  
      // Send the request to the external API
      const externalApiResponse = await axios.post('https://b2skbfxx-8000.euw.devtunnels.ms/process_image/', formData, {
        headers: formData.getHeaders(),
        responseType: 'arraybuffer', // Set the response type to 'arraybuffer'
      });
  
      // Check if the API response contains valid data
      if (externalApiResponse.status === 200 && externalApiResponse.data) {
        // Save the received data as a .npy file
        const npyName = 'npyFile-' + Date.now() + '.npy';
        const npyPath = path.join('uploads', npyName);
        fs.writeFileSync(npyPath, externalApiResponse.data);
  
        // Store file paths in the database
        const newFile = new File({
          imageName: imageName,
          imagePath: imagePath,
          npyName: npyName,
          npyPath: npyPath,
        });
        await newFile.save();
  
        res.send(`${imagePath} image path, ${npyPath} npy path`);
      } else {
        res.status(400).send('Invalid response from the external API');
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('Error occurred while processing the file');
    }
  });
// app.post('/upload', upload.single('image'), async (req, res) => {
//     try {
//       const imagePath = req.file.path;
  
//       // Create form-data for the external request
//       const formData = new FormData();
//       formData.append('file', fs.createReadStream(imagePath));
  
//       // Send the request to the external API
//       const externalApiResponse = await axios.post('https://b2skbfxx-8000.euw.devtunnels.ms/process_image/', formData, {
//         headers: formData.getHeaders(),
//         responseType: 'arraybuffer', // Set the response type to 'arraybuffer'
//       });
  
//       // Check if the API response contains valid data
//       if (externalApiResponse.status === 200 && externalApiResponse.data) {
//         // Set response headers for the .npy file attachment
//         const npyName = 'npyFile-' + Date.now() + '.npy';
//         res.setHeader('Content-Disposition', `attachment; filename=${npyName}`);
//         res.setHeader('Content-Type', 'application/octet-stream'); // Change to the appropriate content type for .npy files
  
//         // Send the .npy file as an attachment
//         res.send(Buffer.from(externalApiResponse.data, 'binary'));
//       } else {
//         res.status(400).send('Invalid response from the external API');
//       }
//     } catch (error) {
//       console.error(error);
//       res.status(500).send('Error occurred while processing the file');
//     }
//   });

app.get('/files', async (req, res) => {
    try {
      const files = await File.find();
      const filePaths = files.map(file => {
        return {
          imageName: file.imageName,
          imagePath: file.imagePath ? file.imagePath.replace(/\\/g, '/') : null, // Check if imagePath exists
          npyName: file.npyName,
          npyPath: file.npyPath ? file.npyPath.replace(/\\/g, '/') : null // Check if npyPath exists
        };
      });
      res.json(filePaths);
    } catch (error) {
      console.error('Error fetching file list:', error);
      res.status(500).send('Error occurred while fetching file list');
    }
  });
  
  
// Endpoint to fetch a specific image file
app.get('/files/image/:filename', (req, res) => {
  const filename = req.params.filename;
  res.sendFile(path.join(__dirname, 'uploads', filename));
});

// Endpoint to fetch a specific .npy file
app.get('/files/npy/:filename', (req, res) => {
  const filename = req.params.filename;
  res.sendFile(path.join(__dirname, 'uploads', filename));
});

// Server setup
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}...`));
