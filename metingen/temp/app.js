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
var TotalWorkingNodes
var DataNotUpdatedCount
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
                graden: Influx.FieldType.INTEGER,
                //path: Influx.FieldType.STRING,
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
var timer = setInterval(getData, 3000);
var timer1 = setInterval(checkDataIntervals, 5000)


function getData () {
    var i = 1;
    http_stream.get("http://localhost:3001/api/streamdata/activenodes", function(data) {
        if (data == null) {
            DataNotUpdatedCount++;
            console.log(DataNotUpdatedCount)
            return;
        }
        DataNotUpdatedCount = 0;

        for( i; i <= JSON.parse(data).temp; i++ ) {
           // console.log("getData() i: "+i)
            processData(i)

        }
        //TotalWorkingNodes = JSON.parse(data).temp;
    })
}

function processData(i){
  //  console.log("processData() buiten httpstream i: "+i)
    http_stream.get("http://localhost:3001/api/streamdata/temp/"+i, function (data) {
       // console.log("processData() binnen httpstream i: "+i)


        if (data == null) {
            console.log("streamdata uitgevallen")
            return;
        }
        if (data[13] == 'u') {
            console.log("parsen mag nog niet")
            return;
        }
        if (data[13] != 'u') {
            var json = JSON.parse(data)
        }


        const graden = json.Temperature
      // console.log("buiten de if i: "+i)


        insertData(graden, json, i)


    })
}




function insertData(graden, json, i){

    // if (JSON.stringify(oldData) != JSON.stringify(json)) {
    //        console.log("in de if begin i: "+i)
    //     oldData = json;
        influx.writePoints([
            {
                measurement: 'temperatuur',
                tags: {host: os.hostname()},
                fields: {graden, id: i} //, path: req.path
            }
        ]).catch(err => {
            console.error(`Error saving data to InfluxDB! ${err.stack}`)
        })
          console.log("einde i: "+i)
   // }
}

app.get('/', function (req, res) {
    setTimeout(() => res.end('Hello world!'), Math.random() * 500)
})

app.get('/temp/:id', function (req, res, next) {
    influx.query(`
    select * from temperatuur
    where id =` + req.params.id + `
    order by time desc
  `).then(result => {
        if(DataNotUpdatedCount > 3 && DataNotUpdatedCount < 30){
            next(res.status(404).send(result));
            return;
        }
        if(DataNotUpdatedCount >= 30){
            next(res.status(500).send(result));
            return;
        }
        res.json(result)

}).catch(err => {
        next(res.status(500).send(err.stack))
})
})

// app.get('/temp/stop/:id', function (req, res, next) {
//
//     http_stream.get("http://localhost:3001/api/streamdata/temp/" + req.params.id, function (data) {
//
//     })
// })


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

    for(var i = 1; i <= TotalWorkingNodes; i++) {
        influx.query(`
     select * from temperatuur
     where id = ` + i + `
     order by time desc
     limit 1`).then(result => {
            oldInterval = JSON.stringify(result)
        }).catch(err => {
            next(res.status(500).send(err.stack))
        })
        if (newInterval != oldInterval) {
            console.log("data is niet gelijk")
            newInterval = oldInterval
            return;
        }
        if (newInterval == oldInterval) {
            DataNotUpdatedCount++
        }
    }

}