const Influx = require('influx')
const express = require('express')
const http = require('http')
const app = express()



app.use(require('./metingen/temp/temp'))
app.use(require('./metingen/humidity/humid'))
app.use(require('./metingen/light/light'))

app.listen('3000', function () {
    console.log('listening on port 3000');
});


   // // .then(() =>{
   //      http.createServer(app).listen(3000, function () {
   //          console.log('Listening on port 3000')
   //      })
   //     // })
   //  //})
