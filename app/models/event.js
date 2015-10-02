'use strict';

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const eventSchema = new Schema({
  eventPacket: { type: Schema.Types.Mixed, default: {} },
  userId: String,
  eventAction: { type: Schema.Types.Mixed, default: {} },
  created_at: Date,
  updated_at: Date
});

eventSchema.pre('save', (next) => {
  const currentDate = new Date();
  this.updated_at = currentDate;

  if (!this.created_at) {
    this.created_at = currentDate;
  }

  next();
})

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;