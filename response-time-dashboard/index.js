var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var request = require('request-promise')
var moment = require('moment')
var cassandra =  require('cassandra-driver')
var schedule = require('node-schedule')
const client = new cassandra.Client({ contactPoints: ['db'], keyspace: 'dev'})
const hostPromise = client.execute('SELECT * from dev.hosts')
  .then(result => result.rows.map((row) => row.host))

const sockets = []
const interest = {}

hostPromise.then((hosts) => {
  hosts.map((host) => interest[host] = [])
})

hostPromise.then((hosts) => {
  hosts.map((host) => {
    var rule = new schedule.RecurrenceRule();
    console.log(parseInt(process.env.PERIOD))
    rule.minute = new schedule.Range(0, 59, parseInt(process.env.PERIOD));
    schedule.scheduleJob(rule, function() {
      console.log("calculating");
      var time = moment()
      request.get(host).then(() => {
        var diff = moment().diff(time)
        if (interest[host]) {
          interest[host].map((socket) =>
            socket.emit('news', { host: host, time: moment().toString(), diff})
          )
        }
        const query = 'INSERT INTO dev.measures (host, date, time) VALUES (?,toTimestamp(now()),?);'
        client.execute(query, [host, diff], { prepare: true })
      })
      .catch((err) => console.log(host, "down"))
    })
  })
})

io.on('connection', (socket) => {
  sockets.push(socket)

  socket.on('interest', (msg) => {
    if (interest[msg.host]) {
      interest[msg.host].push(socket)
    }
    socket.on('disconnect', () => {
      console.log('disconnect');
      var index = sockets.indexOf(socket)
      sockets.splice(index, 1)
    })
    const query = 'SELECT * FROM dev.measures WHERE host= ? LIMIT 100'
    client.execute(query, [msg.host], { prepare: true})
      .then((out) =>
        socket.emit('past', out.rows))
      .catch((out) => {
        console.log(out);
      })
  })

  socket.on('disconnect', () => {
    console.log('disconnect');
  })
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

app.get('/epimorphics', (req, res) => {
  client.execute('SELECT * FROM dev.measures WHERE host=\'http://target:80\'')
    .then((out) =>
      res.send(out.rows))
    .catch((out) => {
      console.log(out);
    })
})

app.get('/', function(req, res){
  res.sendFile(__dirname + '/static/index.html');
});
