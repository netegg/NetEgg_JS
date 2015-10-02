'use strict';

const bodyParser = require('body-parser');
const bluebird = require('bluebird');
const envvar = require('envvar');
const express = require('express');
const mongoose = require('mongoose');
const R = require('ramda');

const db = require('./lib/db');
const Project = require('./app/models/project');
const Scenario = require('./app/models/scenarios');
const Event = require('./app/models/event');

const APP_PORT = envvar.number('APP_PORT', 8080);

const app = express();

const getEvent = function(eventId) {
  return Event.findById(eventId).exec();
}

const getScenario = function(scenarioId) {
  return Scenario.findById(scenarioId).exec()
    .then(bluebird.coroutine(function* (scenario) {
      const events = yield bluebird.all(R.map(getEvent, scenario.events));
      scenario.events = events;
      return scenario;  
  }));
}

const getData = bluebird.coroutine(function* (project){
  const scenarios = yield bluebird.all(R.map(getScenario, project.scenarios));
  project.scenarios = scenarios;
  return project;
});

app.use(bodyParser.json());

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Pass to next layer of middleware
    next();
});

app.get('/', (req, res) => {
  res.render('');
});

app.post('/project/all', (req, res) => {
  const userId = req.body.userId;
  Project.find({ userId: userId }).exec().then(bluebird.coroutine(function* (resp) {
    const projects = yield bluebird.all(R.map(getData, resp));
    res.send(projects);
  }));
})

app.post('/project', (req, res) => {
  const userId = req.body.userId;
  const projectId = req.body.projectId;

  Project.findById(projectId).exec().then(resp => {
    if (resp.userId === userId) {
      getData(resp).then(project => {
        res.send(project);
      });
    } else {
      res.sendStatus(404);
    }
  }).catch(err => {
    console.log(err);
    res.sendStatus(500);
  })
})

app.post('/project/new', (req, res) => {
  const userId = req.body.userId;
  const newProject = Project({
    userId: userId,
    projectName: ""
  });
  newProject.save().then(resp => {
    getData(resp).then(project => {
      res.send(project);  
    });
  });
});

app.post('/project/editname', (req, res) => {
  const userId = req.body.userId;
  const projectId = req.body.projectId;
  const projectName = req.body.projectName;
  console.log()
  Project.findById(projectId).exec().then(resp => {
    if(resp.userId === userId) {
      resp.projectName = projectName;

      resp.save().then(resp2 => {
        getData(resp2).then(project => {
          res.send(project);
        })
      })
    } else {
      res.sendStatus(404);
    }
  }).catch(err => {
    res.sendStatus(404);
  })
})

app.post('/project/update', (req, res) => {
  const userId = req.body.userId;
  const projectId = req.body.projectId;
  Project.findById(projectId).exec().then(resp => {
    if (resp.userId === userId) {
      resp.eventFormat = req.body.eventFormat;

      resp.save().then(resp2 => {
        getData(resp2).then(project => {
          res.send(project);  
        })
      });  
    } else {
      resp.sendStatus(404);
    }
  }).catch(err => {
    res.sendStatus(404);
  })
});

app.post('/project/delete', (req, res) => {
  const userId = req.body.userId;
  const projectId = req.body.projectId;
  const project = Project.findById(projectId).exec().then(resp => {
    if (resp.userId == userId) {
      resp.remove().then(resp2 => {
        console.log(resp2);
        res.sendStatus(200);
      });
    } else {
      res.sendStatus(404);
    }
  });
});

app.post('/project/scenario/new', (req, res) => {
  const userId = req.body.userId;
  const projectId = req.body.projectId;
  Project.findById(projectId).exec().then(project => {
    if (project.userId == userId) {
      const newScenario = Scenario({
        userId: userId,
        scenarioName: ''
      });
      newScenario.save().then(scenario => {
        project.scenarios = R.append(scenario.id, project.scenarios);

        project.save().then(resp => {
          getData(resp).then(resp2 => {
            res.send(resp2)
          })
        }).catch(err => {
          res.send(err)
        });
      });
    } else {
      res.sendStatus(404);
    }
  }).catch(err => {
    res.status(500).send(err);
  });
});

app.post('/project/scenario', (req, res) => {
  const userId = req.body.userId;
  const scenarioId = req.body.scenarioId;
  Scenario.findById(scenarioId).exec().then(resp => {
    if (resp.userId == userId) {
      getScenario(resp).then(resp2 => {
        res.send(resp2);
      });
    } else {
      res.sendStatus(404);
    }
  }).catch(err => {
    res.sendStatus(500).send(err);
  })
});

app.post('/project/scenario/editname', (req, res) => {
  const userId = req.body.userId;
  const scenarioId = req.body.scenarioId;
  Scenario.findById(scenarioId).exec().then(scenario => {
    if (scenario.userId == userId) {
      scenario.scenarioName = req.body.scenarioName;

      scenario.save().then(resp => {
        getScenario(resp).then(resp2 => {
          res.send(resp2);
        });
      });
    } else {
      res.sendStatus(404);
    }
  }).catch(err => {
    res.sendStatus(500).send(err);
  })
});

app.post('/project/scenario/delete', (req, res) => {
  const userId = req.body.userId;
  const scenarioId = req.body.scenarioId;
  Scenario.findById(scenarioId).exec().then(resp => {
    if (resp.userId == userId) {
      resp.remove().then(() => {
        Project.findOne({scenarios: scenarioId}).exec().then(resp => {
          resp.scenarios = R.reject(R.equals(scenarioId), resp.scenarios)
          resp.save().then(resp2 => {
            getData(resp2).then(project => {
              res.send(project);
            })
          })
        })
      });
    }
  })
});

app.post('/project/scenario/event', (req, res) => {
  const userId = req.body.userId;
  const eventId = req.body.eventId;
  Event.findById(eventId).exec().then(resp => {
    if(resp.userId == userId) {
      res.send(resp);
    } else {
      res.sendStatus(404);
    }
  }).catch(err => {
    res.send(err).sendStatus(500);
  })
});

app.post('/project/scenario/event/new', (req, res) => {
  const userId = req.body.userId;
  const scenarioId = req.body.scenarioId;
  Project.findOne({scenarios : scenarioId}).exec().then(project => {
    if (project.userId == userId) {
      const newEvent = Event({
        userId: userId,
        eventPacket: project.eventFormat,
        eventAction: {
          actionString: "",
          f: "",
          p: "",
          v: ""
        }
      });
      newEvent.save().then(resp => {
        Scenario.findById(scenarioId).exec().then(scenario => {
          scenario.events = R.append(resp.id, scenario.events);
          scenario.save().then(newScenario => {
            getScenario(newScenario).then(resp2 => {
              console.log(resp2);
              res.send(resp2.events);
            })  
          });
        });
      });
    } else {
      res.sendStatus(404);
    }
  }).catch(err => {
    console.log(err);
    res.send(err);
  });
});

app.post('/project/scenario/event/edit', (req, res) => {
  const userId = req.body.userId;
  const eventId = req.body.eventId;
  console.log(req.body.eventPacket);
  Event.findById(eventId).exec().then(eventObj => {
    if (eventObj.userId == userId) {
      console.log(req.eventPacket);
      eventObj.eventPacket = req.body.eventPacket;
      eventObj.eventAction = req.body.eventAction;
      eventObj.save().then(resp => {
        console.log(resp);
        Scenario.findOne({ events: resp.id }).exec().then(resp2 => {
          console.log(resp2);
          getScenario(resp2).then(scenario => {
            console.log(scenario);
            res.send(scenario);
          })
        })
      })
    } else {
      res.sendStatus(404);
    }
  });
});

app.post('/project/scenario/event/delete', (req, res) => {
  const userId = req.body.userId;
  const eventId = req.body.eventId;
  Event.findById(eventId).exec().then(eventObj => {
    if (eventObj.userId == userId) {
      Scenario.findOne({ events: eventObj.id }).exec().then(scenario => {
        const newEvents = R.reject(R.equals(eventObj.id), scenario.events);
        scenario.events = newEvents
        scenario.save().then(resp => {
          eventObj.remove().then(resp2 => {
            getScenario(resp).then(data => {
              res.send(data);
            })
          })
        })
      })
    }
  })
});

app.listen(APP_PORT, () => {
  console.log('NetEgg server started on port', APP_PORT);
});