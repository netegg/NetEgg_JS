'use strict';

const bodyParser = require('body-parser');
const bluebird = require('bluebird');
const envvar = require('envvar');
const express = require('express');
const mongoose = require('mongoose');
const R = require('ramda');
const rp = require('request-promise')

const db = require('./lib/db');
const Project = require('./app/models/project');
const Scenario = require('./app/models/scenario');
const Event = require('./app/models/event');
const userController = require('./app/controllers/user');

const APP_PORT = envvar.number('APP_PORT', 8080);
const NETEGG_PYTHON_URL = envvar.string('NETEGG_PYTHON_URL');

const app = express();
const router = express.Router();

router.route('/users')
  .post(userController.postUsers)
  .get(userController.getUsers);

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
  project.scenarios = scenarios
  return project;
});

const submitEvent = function(eventId) {
  return Event.findById(eventId).exec().then(eventObj => {
    const keys = R.sort((a,b) => { return a - b; }, R.keys(eventObj.eventPacket));
    const packet = R.props(keys, eventObj.eventPacket);
    let action;
    if (eventObj.eventAction.actionString == 'Forward(p)') {
      action = 'fwd(' + eventObj.eventAction.p + ')'
    } else if (eventObj.eventAction.actionString == 'Modify(f,v)') {
      action = 'modify(' + eventObj.eventAction.f + ',' + eventObj.eventAction.v + ')'
    } else {
      action = eventObj.eventAction.actionString.toString().toLowerCase()
    }
    return {
      packet: packet,
      actions: [action]
    }
  })
}

const submitScenario = function(scenarioId) {
  return Scenario.findById(scenarioId).exec().then(bluebird.coroutine(function*(scenario) {
    const events = yield bluebird.all(R.map(submitEvent, scenario.events));
    return {
      name: scenario.scenarioName,
      events: events
    }
  }));
}

const submitData = bluebird.coroutine(function* (project){
  const format = R.sort((a,b) => { return a - b; }, R.keys(project.packetFormat));
  const scenarios = yield bluebird.all(R.map(submitScenario, project.scenarios));
  return {
    name: project.projectName,
    format: format,
    scenarios: scenarios
  }
})

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
  res.json({ message: 'NetEgg API'});
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
    if (resp.userId == userId) {
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
      resp.packetFormat = req.body.packetFormat;

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
      Project.findOne({ scenarios: scenarioId }).exec().then(project => {
        getScenario(resp).then(resp2 => {
          res.send({
            packetFormat: project.packetFormat,
            events: resp2.events
          });
        });
      })      
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
        eventPacket: project.packetFormat,
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
            Project.findOne({ scenarios: newScenario.id }).exec().then(project => {
              getScenario(newScenario).then(resp2 => {
                res.send({
                  scenarioId: newScenario.id,
                  packetFormat: project.packetFormat,
                  events: resp2.events
                });
              })  
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
  
  Event.findById(eventId).exec().then(eventObj => {
    if (eventObj.userId == userId) {
      eventObj.eventPacket = req.body.eventPacket;
      eventObj.eventAction = req.body.eventAction;
      eventObj.save().then(resp => {
        
        Scenario.findOne({ events: resp.id }).exec().then(resp2 => {
        Project.findOne({ scenarios: resp2.id }).exec().then(resp3 => {
          getScenario(resp2).then(scenario => {
            res.send({
              scenarioId: resp2.id,
              packetFormat: resp3.packetFormat,
              events: scenario.events
            })
          })
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
              Project.findOne({ scenarios: data.id }).exec().then(project => {
                res.send({
                  packetFormat: project.packetFormat,
                  scenarioId: data.id,
                  events: data.events
                });  
              })
              
            })
          })
        })
      })
    }
  })
});

app.post('/project/build', (req, res) => {
  const userId = req.body.userId;
  const projectId = req.body.projectId;
  Project.findById(projectId).exec().then(resp => {
    submitData(resp).then(project => {

      console.log(project);

      const options = {
        uri: NETEGG_PYTHON_URL + '/build',
        method: 'POST',
        json: {
          userId: userId,
          projectId: projectId,
          projectName: resp.projectName,
          projectData: project
        }
      }

      rp(options).then(build => {
        resp.builds = R.prepend(build, resp.builds);
        resp.save().then(savedProject => {
          res.send(savedProject);
        })
      })
    })
  })
})

app.listen(APP_PORT, () => {
  console.log('NetEgg server started on port', APP_PORT);
});