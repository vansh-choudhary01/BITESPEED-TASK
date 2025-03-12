import express from 'express';
import mysql from "mysql2";
import dotenv from "dotenv"

const app = express();
dotenv.config();

const connection = mysql.createConnection({
    host : process.env.MYSQL_HOST,
    user : process.env.MYSQL_USER,
    password : process.env.MYSQL_PASSWORD,
});

connection.connect((err) => {
    if (err) {
      console.error('Error connecting to MySQL:', err);
      return;
    }
    console.log('Connected to MySQL');
});

function createDatabase() {
    let database = "bitespeed";
    let q = `CREATE DATABASE IF NOT EXISTS ${database}`;

    connection.query(q, (err, result) => {
        if(err) throw err;
        console.log("Database created or already exists");

        connection.changeUser({database: database}, (err) => {
            if (err) {
                console.error('Error switching to database:', err);
                return;
            }
            console.log(`Connected to database ${database}`);
        });
    })
}
createDatabase();

app.use(express.json());

app.get("/", (req, res) => {
    let q = `CREATE TABLE IF NOT EXISTS Contact (
        id INT NOT NULL AUTO_INCREMENT,
        phoneNumber VARCHAR(10) NOT NULL,
        email VARCHAR(100) NOT NULL,
        linkedId INT,
        linkPrecedence VARCHAR(10) NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt DATETIME,
        PRIMARY KEY (id)
    )`;

    try {
        connection.query(q, (err, result) => {
            if (err) throw err;
            console.log(result);
        });
    } catch (err) {
        console.log(err);
    }

    let q2 = `INSERT INTO Contact 
    (phoneNumber, email, linkPrecedence) 
    VALUES 
    ('9876543210', 'test@gmail.com', 'primary')`;

    try {
        connection.query(q2, (err, result) => {
            if (err) throw err;
            console.log(result);
        });
    } catch (err) {
        console.log(err);
    }

    res.send("Hello world!");
})

app.listen(8080, () => {
    console.log("Server is running on port 8080");
});