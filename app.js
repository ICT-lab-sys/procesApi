const Influx = require('influx')
const express = require('express')
const http = require('http')
const app = express()
var cors = require('cors');
app.use(cors({origin: 'http://localhost:4200'}));
app.use(cors({origin: 'http://localhost:3000'}));


//gebruik deze bestanden
app.use(require('./metingen/temp/temp'))
app.use(require('./metingen/humidity/humid'))
app.use(require('./metingen/light/light'))

//luister naar deze poort
app.listen('3005', function () {
    console.log('listening on port 3005');
});
