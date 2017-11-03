
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes');
var Twitter = require('twitter')
const secrets = require('docker-secrets')
const TwitterClient = new Twitter(secrets)
const schedule = require('node-schedule')

var test = ""
var app = module.exports = express.createServer();

var params = {screen_name: 'epimorphics'};
const tweetDB = []

var rule = new schedule.RecurrenceRule()
rule.second = new schedule.Range(0, 59, 15)

var updateTimeline = schedule.scheduleJob(rule, () => {
  TwitterClient.get('statuses/user_timeline', params, function(error, tweets, response) {
    if (!error) {
      tweets.map((tweet) => {
        if (!params.since_id || params.since_id < tweet.id) {
          params.since_id = tweet.id
        }
        tweetDB.push(tweet)
      })
      console.log("tweets SIZE: ", tweets.length)
      console.log("tweetDB SIZE: ", tweetDB.length)
      console.log("highest id: ", params.since_id)
    }
    else {
      console.log(error)
    }
  });
})

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

//app.get('/', routes.index);

app.get('/', (res, req) => {
  req.send(tweetDB.map((tweet) => tweet.id))
})

app.listen(3000, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});
