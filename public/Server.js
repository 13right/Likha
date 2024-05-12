const express = require('express');
const sql = require('mssql');
const path = require('path')
const multer = require('multer');
const fs = require('fs');



const app = express();

app.set('view engine', 'ejs');

const port = 8000;

const upload = multer({ dest: 'uploads/' });


app.use(express.static(path.join(__dirname)));

// config = {
//     server : "LAPTOP-GV6HVKVU\\Lyster Liwanag",
//     database : "try",
//     port : 1433
// }

// const config = {
//     authentication: {
//         type: 'default',
//         options: {
//             userName: 'LAPTOP-GV6HVKVU\\Lyster Liwanag', // Replace with your Windows username and domain
//             password: ''
//         }
//     },
//     server: 'LAPTOP-GV6HVKVU\\Lyster Liwanag', // Replace with your local SQL Server instance name
//     options: {
//         database: 'try', // Replace with your database name
//         encrypt: true,
//         trustServerCertificate: true // Set to true if using self-signed certificates
//     }
// };

const config = {
    user: 'Jennie',
    password: '2harmaine!',
    server: 'capstoneliwanag.database.windows.net',
    database: 'Capstone',
    options: {
        encrypt: true
    }
};

// const config = {
//     user: 'Jennie',
//     password: '2harmaine!',
//     server: 'localhost\\MSSQLSERVER', // You may need to change this
//     database: 'try',
//     options: {
//       encrypt: true // If you're connecting to Azure SQL Database, set this to true
//     }
//   };

const pool = new sql.ConnectionPool(config);
pool.connect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Update
app.put('/updateProduct/:productName', async (req, res) => {
    const { productName } = req.params;
    const { updatedName, updatedPrice } = req.body;

    try {
        // Connect to the database
        await sql.connect(config);

        // Update the product in the database
        const result = await sql.query`
            UPDATE Products
            SET productName = ${updatedName}, productPrice = ${updatedPrice}
            WHERE productName = ${productName}
        `;

        // Check if the product was updated successfully
        if (result.rowsAffected[0] > 0) {
            res.status(200).json({ message: 'Product updated successfully' });
            
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//Delete
app.delete('/DeleteProduct/:productName', async (req, res) => {
    const productName = req.params.productName;



    try{
        await sql.connect(config);

        const ressult = await sql.query`
        DELETE FROM Products WHERE productName = ${productName}
        `;
        if(ressult.rowsAffected[0]>0){
            res.status(200).json({ message: 'Product Delete successfully' });
            window.location.href = "AdminHome.html";
        }
        else{
            res.status(404).json({ message: 'Product not found' });
        }
    }
    catch(err){

    }
    // if (index !== -1) {
    //     // If product found, remove it from the array
    //     products.splice(index, 1);
    //     res.status(200).json({ message: 'Product deleted successfully' });
    // } else {
    //     // If product not found, return 404 Not Found
    //     res.status(404).json({ message: 'Product not found' });
    // }
});

//SignUp
app.post('/SignUp', async (req, res) => {
    console.log("Request Body:", req.body);
    const { name, num, Password } = req.body;

    try {
        const request = pool.request();
        request.input('name', sql.NVarChar, name);
        request.input('number', sql.NVarChar, num);
        request.input('Password',sql.NVarChar,Password);
        const result = await request.query('INSERT INTO Users VALUES (@name, @number,@Password)');
        const select = await sql.query('SELECT * FROM Bright');
        console.log(select.recordset);
            
        console.log("Data successfully inserted!");
        res.send('Data successfully inserted!' + name + email);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error inserting data into database');
    }
});


// LogIn
app.post('/LogIn', async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM Users WHERE Name = @username');

        const user = result.recordset[0];

        if (user && user.Password === password) { 
            
            if(user.Type === "Admin"){
            res.status(250).send('Admin')
            }
            else{
                res.status(200).send('Login successful');
            }
        } else {
            res.status(401).send('Invalid username or password');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Error logging in');
    }
});

// Route for uploading an image
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }

        // Read the uploaded image file
        const data = fs.readFileSync(req.file.path);

        // Connect to the SQL Server database
        const pool = await sql.connect(config);

        // Insert the image data into the database
        const result = await pool.request()
        .input('Image', sql.VarBinary, data)
        .input('Pname', sql.VarChar, req.body.productName)
        .input('Price', sql.Int, req.body.productPrice)
        .query("INSERT INTO Products (productName, productPrice, productImage) VALUES (@Pname, @Price, @Image);");


        // Delete the temporary file after upload
        fs.unlinkSync(req.file.path);

        res.sendStatus(200); // Send a success response
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).send('Error uploading image');
    }
});
// Serve the HTML form for uploading images
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/try.html');
});


// Route to fetch data from MSSQL and send it as JSON
app.get('/products', async (req, res) => {
    try {
        // Connect to the database
        await sql.connect(config);
        // Query to select productName, productPrice, and productImage columns
        const result = await sql.query('SELECT productName, productPrice, productImage FROM Products');
        
        // Convert VARBINARY images to Base64 encoded strings
        const products = result.recordset.map(product => {
            const base64Image = Buffer.from(product.productImage, 'binary').toString('base64');
            return {
                productName: product.productName,
                productPrice: product.productPrice,
                productImage: base64Image
            };
        });

        // Send the modified result as JSON
        res.json(products);
    } catch (err) {
        // Error handling
        console.error(err);
        res.status(500).send('Server Error');
    }
});


//Server itu guys
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});