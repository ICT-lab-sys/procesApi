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
var humid = require('../humidity/humid');
var router = express.Router()

//maak een schema van de database
const influx = new Influx.InfluxDB({
    host: 'localhost',
    database: 'metingen',
    schema: [
        {
            measurement: 'temperatuur',
            fields: {
                graden: Influx.FieldType.INTEGER,
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
    http_stream.get("http://localhost:3001/api/streamdata/activenodes/temp", function(data) {
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

//controleer data en roep de fucntie om de data in de database te zetten.
function processData(i){
    http_stream.get("http://localhost:3001/api/streamdata/temp/"+i, function (data) {
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


        const graden = json.Temperature
        insertData(graden, json, i)


    })
}

//zet de streamdata in de database
function insertData(graden, json, i){
        influx.writePoints([
            {
                measurement: 'temperatuur',
                tags: {host: os.hostname()},
                fields: {graden, id: i}
            }
        ]).catch(err => {
            console.error(`Error saving data to InfluxDB! ${err.stack}`)
        })
        //  console.log("einde i: "+i)
}

//root api
router.get('/', function (req, res) {
    setTimeout(() => res.end('ROOT API'), Math.random() * 500)
})

//hiermee kan je een sensor verwijderen
router.get('/temp/remove/:id', function (req, res, next) {
    var id = req.params.id
    http_stream.get("http://localhost:3001/api/streamdata/temp/remove/"+id, function(data) {
        console.log('gelukt data verwijderd')
    })
    res.send('gelukt')

})

//hiermee krijg alle data terug van een id
router.get('/temp/:id', function (req, res, next) {
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

//hiermee krijg je alle ids terug van de sensor type
router.get('/temp/sensors/totaal', function (req, res, next) {
    var totaal;
    http_stream.get("http://localhost:3001/temp/sensors/totaal", function(data) {
        totaal = data
        res.send(totaal)
    })
})

//in geval als er geen database is gemaakt, maak de database + error handeling
influx.getDatabaseNames()
    .then(names => {
    if (!names.includes('metingen')) {
    return influx.createDatabase('metingen')
}
})
.catch(err => {
    console.error(`Error creating Influx database!`)
})

//controleert of er nieuwe data is binnengekomen.
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

//geeft de data terug van een specefieke sensor, jaar, maand, id
router.get('/:sensor/:year/:month/:id', function (req, res, next) {
    var year = req.params.year
    var sensor = req.params.sensor
    var month = req.params.month
    var id = req.params.id
    var datatype;
    if(sensor == 'temperatuur'){
        datatype = 'graden'
    }
    if(sensor == 'luchtvochtigheid'){
        sensor = 'humidity'
        datatype = "humidity"
    }
    if(sensor == 'licht'){
        sensor = 'light'
        datatype = "light"
    }
    var getDaysInMonth = function(month,year) {
        return new Date(year, month, 0).getDate();
    };
    var aantaldagen = getDaysInMonth(month, year)
    console.log('time >= 2017-0'+month+'-01 and time <= 2017-06-'+aantaldagen+'')
    influx.query(`
    select mean(`+datatype+`) from `+sensor+`
    where id = `+id+` and time >= '`+year+`-0`+month+`-01' and time <= '`+year+`-0`+month+`-`+aantaldagen+`'
    group by time(1d)
  `
    ).then(result => {
        res.json(result)
    }).catch(err => {
        next(res.status(500).send(err.stack))
    })
})

module.exports = router