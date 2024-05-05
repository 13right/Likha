const express = require('express');
const sql = require('mssql');
const path = require('path')

const app = express();
const port = 8000;



app.use(express.static(path.join(__dirname)));

const config = {
    user: 'Jennie',
    password: '2harmaine!',
    server: 'capstoneliwanag.database.windows.net',
    database: 'Capstone',
    options: {
        encrypt: true
    }
};


const pool = new sql.ConnectionPool(config);
pool.connect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
            res.status(200).send('Login successful');
        } else {
            res.status(401).send('Invalid username or password');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Error logging in');
    }
});



//Server itu guys
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});