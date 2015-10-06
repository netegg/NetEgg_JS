'use strict';

const User = require('../models/user');

exports.postUsers = function(req, res) {
  const user = new User({
    username: req.body.username,
    email: req.body.email,
    password: req.body.password
  });

  user.save().then(newUser => {
    res.send(newUser);
  }).catch(err => {
    res.send(err);
  });
};

exports.getUsers = function(req, res) {
  User.find().exec().then(users => {
    res.send(users);
  }).catch(err => {
    res.send(err);
  });
};