'use strict';

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const scenarioSchema = new Schema({
  scenarioId: mongoose.Schema.Types.ObjectId,
  userId: String,
  scenarioName: String,
  events: Array,
  created_at: Date,
  updated_at: Date
});

scenarioSchema.pre('save', (next) => {
  const currentDate = new Date();
  this.updated_at = currentDate;

  if (!this.created_at) {
    this.created_at = currentDate;
  }

  next();
})

const Scenario = mongoose.model('Scenario', scenarioSchema);

module.exports = Scenario;