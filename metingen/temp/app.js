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
            processData(i)

        }
    })
}

function processData(i){
    http_stream.get("http://localhost:3001/api/streamdata/temp/"+i, function (data) {
       console.log(data)
        var stringdata = data.toString()

        if (stringdata == 'sensor gestopt') {
            console.log('sensor gestopt')
            return
        }
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
        insertData(graden, json, i)
    })
}

function insertData(graden, json, i){
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