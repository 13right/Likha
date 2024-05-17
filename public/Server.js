const express = require('express');
const sql = require('mssql');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const { compile } = require('ejs');



const app = express();

app.set('view engine', 'ejs');

const port = 8000;

const upload = multer({ dest: 'uploads/' });


app.use(express.static(path.join(__dirname)));

app.use(session({
    secret: 'Hatdog', // Replace with a strong, secure key
    resave: true,
    saveUninitialized: true

  }));

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
    server: 'LAPTOP-GV6HVKVU',
    database: 'Capstone',
    options: {
        encrypt: false
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
            UPDATE tbl_Product
            SET ProductName = ${updatedName}, Price = ${updatedPrice}
            WHERE ProductName = ${productName}
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

//Add To Cart

app.post('/AddToCart', async (req, res) => {
    const { ProductName,Quantity} = req.body;
    const user = req.session.user;
    const ID = parseInt(user.UserID);
    if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    try {   
        // Connect to the database
        const pool = await sql.connect(config);

        // Use parameterized queries to prevent SQL injection
        const request = pool.request();

        // Insert data into the database
        const query = await sql.query`BEGIN 
        
        DECLARE @ProdID int,@Price int,@Total int;

        SELECT @Price = Price FROM tbl_Product WHERE ProductName = ${ProductName};
        SET @Total = @Price * ${Quantity};
        SELECT @ProdID = ProductID FROM tbl_Product WHERE ProductName = ${ProductName};
        BEGIN
        IF EXISTS (SELECT 1 FROM tbl_Cart WHERE ProductID = @ProdID)
        UPDATE tbl_Cart
        SET Quantity = Quantity + ${Quantity}, Price = Price * (Quantity + ${Quantity})
        WHERE ProductID = @ProdID
        ELSE
        INSERT INTO tbl_Cart VALUES (${Quantity},@Total,${ID},@ProdID);
        END
		END  
        `;

        const result = await request.query(query);

        res.status(200).json({ message: 'Product saved successfully', result });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error', details: err });
    }


});


//Delete
app.delete('/DeleteProduct/:productName', async (req, res) => {
    const productName = req.params.productName;



    try{
        await sql.connect(config);

        const ressult = await sql.query`
        DELETE FROM tbl_Product WHERE ProductName = ${productName}
        `;
        if(ressult.rowsAffected[0]>0){
            res.status(200).json({ message: 'Product Delete successfully' });
            
        }
        else{
            res.status(404).json({ message: 'Product not found' });
        }
    }
    catch(err){
        console.log(err);
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
        const result = await request.query("INSERT INTO tbl_User (Name,MobileNum,Password,Type) VALUES (@name, @number,@Password,'Customer')");
            
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
            .query('SELECT * FROM tbl_User WHERE Name = @username');

        const user = result.recordset[0]; // Retrieve the first user from the recordset

        if (user && user.Password === password) { 
            console.log(req.session);
            req.session.user = user; // Store user in session
            console.log(req.session.user);
            if (user.Type === "Admin") {
                res.status(250).send('Admin');
            } else {
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

app.get('/api/current_user', (req, res) => {
    if (req.session.user) {
      res.json(req.session.user);
    } else {
      res.status(401).send('Not authenticated');
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
        .input('Des', sql.VarChar,req.body.productDes)
        .input('Stock',sql.Int,req.body.Stock)
        .input('Cat', sql.Int, req.body.Cat)
        .query("INSERT INTO tbl_Product (ProductName,Price,Description,Stock,CategoryID,ProductImage) VALUES (@Pname,@Price,@Des,@Stock,@Cat,@Image);");

       


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
    res.sendFile(__dirname + '/AdminHome.html');
});


// Route to fetch data from MSSQL and send it as JSON
app.get('/products', async (req, res) => {
    try {
        // Connect to the database
        await sql.connect(config);
        // Query to select productName, productPrice, and productImage columns
        const result = await sql.query('SELECT ProductName,Price,Description,ProductImage FROM tbl_Product');
        
        // Convert VARBINARY images to Base64 encoded strings
        const products = result.recordset.map(product => {
            const base64Image = Buffer.from(product.ProductImage, 'binary').toString('base64');
            return {
                productName: product.ProductName,
                productPrice: product.Price,
                productDes: product.Description,
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

app.get('/Cart', async (req, res) => {
    try {
        const user = req.session.user;
        const ID = parseInt(user.UserID);
        
        // Log UserID for debugging

        const pool = await sql.connect(config);
        const request = pool.request();

        // Use parameterized queries to prevent SQL injection
        const query = `
            SELECT 
                tbl_Product.ProductName, 
                tbl_Cart.Price, 
                tbl_Cart.Quantity, 
                tbl_Product.ProductImage 
            FROM 
                tbl_Product 
            INNER JOIN 
                tbl_Cart 
            ON 
                tbl_Cart.ProductID = tbl_Product.ProductID 
            INNER JOIN 
                tbl_User 
            ON 
                tbl_Cart.UserID = tbl_User.UserID 
            WHERE 
                tbl_User.UserID = @UserID`;

        request.input('UserID', sql.Int, ID);

        const result = await request.query(query);

        // Log the result for debugging


        if (result.recordset) {
            // Convert VARBINARY images to Base64 encoded strings
            const productsCart = result.recordset.map(productCart => {
                const base64Image = Buffer.from(productCart.ProductImage, 'binary').toString('base64');
                return {
                    productName: productCart.ProductName,
                    productPrice: productCart.Price,
                    productQuantity: productCart.Quantity,
                    productImage: base64Image
                };
            });
            // Send the modified result as JSON
            res.json(productsCart);
        } else {
            console.log('No records found');
            res.status(404).send('No records found');
        }
    } catch (err) {
        // Error handling
        console.error('Error:', err);
        res.status(500).send('Server Error');
    }
});
//PlaceOrder
app.post('/PlaceOrder', async (req, res) => {
    const { orders } = req.body;
    const user = req.session.user;

    // Check if the user is authenticated
    if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        // Connect to the database
        const pool = await sql.connect(config);
        const user = req.session.user;
            const ID = parseInt(user.UserID);
            const order =  pool.request()
                .input('ID',sql.Int,ID)
                .query('INSERT INTO tbl_Order ([Date], UserID) VALUES (GETDATE(), @ID)');

        // Execute the query for each order
        for (const order of orders) {
            
            const query = await pool.request()
                .input('productName', sql.NVarChar(255), order.OrderProductName)
                .input('quantity', sql.Int, order.OrderQuantity)
                .query(`
                    BEGIN 
                        DECLARE @NewOrderID INT;
                        DECLARE @Price INT;
                        DECLARE @Total INT;
                        DECLARE @ProdID INT;


                        SELECT @Price = Price FROM tbl_Product WHERE ProductName LIKE @productName;
                        SELECT @ProdID = ProductID FROM tbl_Product WHERE ProductName LIKE @productName;
                        SET @NewOrderID = (SELECT TOP 1 OrderID FROM tbl_Order ORDER BY OrderID DESC);
                        SET @Total = @Price * @quantity;

                        INSERT INTO tbl_OrderItem (Quantity, Price, ProductID, OrderID)
                        VALUES (@quantity, @Total, @ProdID, @NewOrderID);
                    END
                `);

            // If needed, handle the result here
        }

        // If everything is successful, send a response
        res.status(200).json({ message: 'Order placed successfully' });
    } catch (error) {
        // If an error occurs during database operations, send an error response
        console.error('Error placing order:', error);
        res.status(500).json({ error: 'An error occurred while placing the order' });
    }
});


//Server itu guys
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});