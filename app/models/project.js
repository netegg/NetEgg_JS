'use strict';

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const projectSchema = new Schema({
  projectName: String,
  userId: String,
  packetFormat: { type: Schema.Types.Mixed, default: {} },
  scenarios: Array,
  builds: Array,
  created_at: Date,
  updated_at: Date
});

projectSchema.pre('save', (next) => {
  const currentDate = new Date();
  this.updated_at = currentDate;

  if (!this.created_at) {
    this.created_at = currentDate;
  }

  next();
})

projectSchema.methods.findFormatted = function(id, userId) {
  return Project.findById(id).exec().then(resp => {
    const getData = bluebird.coroutine(function* (project){
      const getEvents = function() {
        return Event.findById(eventId).exec();
      }
      const getScenarios = function(scenarioId) {
        return Scenario.findById(scenarioId).exec()
        .then(bluebird.coroutine(function* (scenario) {
          const events = yield bluebird.all(R.map(getEvents, scenario.events));
          scenario.events = events;
          return scenario;
        }));
      }
      const scenarios = yield bluebird.all(R.map(getScenarios, project.scenarios));
      project.scenarios = scenarios;
      return project;  
    });
    return getData(resp);
  })
}

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;