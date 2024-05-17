const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { Connection, Request } = require('tedious');

const app = express();

// Multer configuration for handling file uploads
const upload = multer({ dest: 'uploads/' });

// Connection configuration for Azure SQL Database
const config = {
    user: 'Jennie',
    password: '2harmaine!',
    server: 'LAPTOP-GV6HVKVU',
    database: 'Capstone',
    options: {
        encrypt: false
    }
};

//POST route to handle image upload
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    // Read the uploaded image file
    fs.readFile(req.file.path, (err, data) => {
        if (err) {
            return res.status(500).send('Error reading file');
        }

        // Connect to the Azure SQL Database
        const connection = new Connection(config);

        connection.on('connect', (err) => {
            if (err) {
                return res.status(500).send('Error connecting to database');
            }

            // Insert the image data into the database
            const request = new Request('INSERT INTO tbl_Product (ProductImage) VALUES (@ImageData) WHERE ProductName = Aphrodite Dress', (err) => {
                if (err) {
                    connection.close();
                    return res.status(500).send('Error inserting data into database');
                }

                connection.close();
                return res.send('Image uploaded successfully');
            });

            request.addParameter('ImageData', TYPES.VarBinary, data);
            connection.execSql(request);
        });
    });
});

// Serve the HTML form
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/try.html');
});

// Start the server
const PORT = 5500;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
