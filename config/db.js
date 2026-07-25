const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST="nezoir.h.filess.io",
    user: process.env.DB_USER="task_planner_roarpuredo",
    password: process.env.DB_PASSWORD="80e84af108027d61b533c67cbdeb3dcdda7031f3",
    database: process.env.DB_NAME="task_planner_roarpuredo",
    port: process.env.DB_PORT || 61000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool.promise();61000
