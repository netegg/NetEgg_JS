'use strict';

const bluebird = require('bluebird');
const bcrypt = bluebird.promisifyAll(require('bcrypt-nodejs'));
const mongoose = require('mongoose');


const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  }
});

UserSchema.pre('save', (next) => {
  const user = this;

  if (!user.isModified('password')) next();

  bcrypt.genSaltAsync(5).then(salt => {
    bcrypt.hashAsync(user.password, salt, null).then(hash => {
      user.password = hash;
      next();
    })
  }).catch(err => {
    next(err);
  })
})

module.exports = mongoose.model('User', UserSchema);