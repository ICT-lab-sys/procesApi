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
var router = express.Router()

//maak een schema van de database
const influx = new Influx.InfluxDB({
    host: 'localhost',
    database: 'metingen',
    schema: [
        {
            measurement: 'humidity',
            fields: {
                humidity: Influx.FieldType.INTEGER,
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

//krijg alle actievenodes
function getData () {
    var i = 1;
    http_stream.get("http://localhost:3001/api/streamdata/activenodes/humidity", function(data) {
        if (data == null) {
            DataNotUpdatedCount++;
            console.log(DataNotUpdatedCount)
            return;
        }
        DataNotUpdatedCount = 0;

        for( i; i <= JSON.parse(data).humidity; i++ ) {
            processData(i)

        }
    })
}

//controleer data en roep de fucntie om de data in de database te zetten.
function processData(i){
    http_stream.get("http://localhost:3001/api/streamdata/humidity/"+i, function (data) {
        var stringdata = data.toString()

        if(stringdata == 'sensor gestopt'){
            return
        }

        if(stringdata == 'No sensor found'){
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


        const humidity = json.Humidity
        insertData(humidity, json, i)


    })
}

//zet de streamdata in de database
function insertData(humidity, json, i){
    influx.writePoints([
        {
            measurement: 'humidity',
            tags: {host: os.hostname()},
            fields: {humidity, id: i}
        }
    ]).catch(err => {
        console.error(`Error saving data to InfluxDB! ${err.stack}`)
    })
}

//hiermee kan je een sensor verwijderen
router.get('/humidity/remove/:id', function (req, res, next) {
    var id = req.params.id
    http_stream.get("http://localhost:3001/api/streamdata/humidity/remove/"+id, function(data) {
        console.log('gelukt data verwijderd')
    })
    res.send('gelukt')

})

//hiermee krijg alle data terug van een id
router.get('/humidity/:id', function (req, res, next) {
    influx.query(`
    select * from humidity
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

//hiermee krijg je alle ids terug van de sensor type
router.get('/humidity/sensors/totaal', function (req, res, next) {
    var totaal;
    http_stream.get("http://localhost:3001/humidity/sensors/totaal", function(data) {
        totaal = data
        res.send(totaal)
    })
})

//controleert of er nieuwe data is binnengekomen.
function checkDataIntervals() {
    for(var i = 1; i <= TotalWorkingNodes; i++) {
        influx.query(`
     select * from humidity
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
module.exports = router

