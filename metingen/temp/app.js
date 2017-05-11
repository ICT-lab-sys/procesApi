/**
 * In this example we'll create a server which has an index page that prints
 * out "hello world", and a page `http://localhost:3000/times` which prints
 * out the last ten response times that InfluxDB gave us.
 *
 * Get started by importing everything we need!
 */
const Influx = require('influx')
const express = require('express')
const http = require('http')
const os = require('os')
const http_stream = require('client-http');
let oldInterval;
let newInterval;
const app = express()

/**
 * Create a new Influx client. We tell it to use the
 * `express_response_db` database by default, and give
 * it some information about the schema we're writing.
 */
const influx = new Influx.InfluxDB({
    host: 'localhost',
    database: 'metingen',
    schema: [
        {
            measurement: 'temperatuur',
            fields: {
                //path: Influx.FieldType.STRING,
                graden: Influx.FieldType.INTEGER,
                id: Influx.FieldType.INTEGER
            },
            tags: [
                'host'
            ]
        }
    ]
})

/**
 * Next we define our middleware and hook into the response stream. When it
 * ends we'll write how long the response took to Influx!
 */
var oldData = "dfsd"
var timer = setInterval(getData, 1000);
var timer1 = setInterval(checkDataIntervals, 5000)
function getData () {
    http_stream.get("http://localhost:3001/api/streamdata/temp", function(data) {

            if(data == null){
                console.log("streamdata uitgevallen")
                return;
            }
            if(data[13] == 'u'){
            console.log("parsen mag nog niet")
            return;
             }
            if(data[13] != 'u'){
                var json = JSON.parse(data)
            }




            const graden = json.Temperature


      //  console.log(json.Temperature)

    if(JSON.stringify(oldData) != JSON.stringify(json)) {
        // var test = oldData
        oldData = json;
       // console.log(JSON.stringify(oldData) + "  ," + JSON.stringify(json))
        influx.writePoints([
            {
                measurement: 'temperatuur',
                tags: { host: os.hostname() },
                fields: { graden, id: 1} //, path: req.path
            }
        ]).catch(err => {
            console.error(`Error saving data to InfluxDB! ${err.stack}`)
        })
    }
    })
}

app.get('/', function (req, res) {
    setTimeout(() => res.end('Hello world!'), Math.random() * 500)
})

app.get('/temp/1', function (req, res, next) {
    influx.query(`
    select * from temperatuur
    where id = 1
    order by time desc
  `).then(result => {
        res.json(result)
}).catch(err => {
        next(res.status(500).send(err.stack))
})
})


/**
 * Now, we'll make sure the database exists and boot the app.
 */
influx.getDatabaseNames()
    .then(names => {
    if (!names.includes('metingen')) {
    return influx.createDatabase('metingen')
}
})
.then(() => {
    http.createServer(app).listen(3000, function () {
    console.log('Listening on port 3000')
})
})
.catch(err => {
    console.error(`Error creating Influx database!`)
})

 function checkDataIntervals() {
    influx.query(`
     select * from temperatuur
     where id = 1
     order by time desc
     limit 1`).then(result => {
       oldInterval = JSON.stringify(result)
}).catch(err => {
        next(res.status(500).send(err.stack))
    })
     if(newInterval != oldInterval){
        console.log("data is niet gelijk")
        newInterval = oldInterval
         return;
     }
     if (newInterval == oldInterval){
         console.log("data is gelijk")
     }

}