'use strict';

require('dotenv').config();

const PORT = process.env.PORT || 8080;
const ENV = process.env.ENV || 'development';
const express = require('express');
const bodyParser = require('body-parser');
const sass = require('node-sass-middleware');

const app = express();
const cookieSession = require('cookie-session');

const knexConfig = require('./knexfile');
const knex = require('knex')(knexConfig[ENV]);
const morgan = require('morgan');
const knexLogger = require('knex-logger');

// Seperated Routes for each Resource
const usersRoutes = require('./routes/users');

// Separate file with user related Db functions
const User = require('./helpers/Db_Queries.js')(knex);

// Load the logger first so all (static) HTTP requests are logged to STDOUT
// 'dev' = Concise output colored by response status for development use.
// The :status token will be colored red for server error codes, yellow for client error codes,
// cyan for redirection codes, and uncolored for all other codes.
app.use(morgan('dev'));

// Log knex SQL queries to STDOUT as well
app.use(knexLogger(knex));

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/styles', sass({
  src: __dirname + '/styles',
  dest: __dirname + '/public/styles',
  debug: true,
  outputStyle: 'expanded'
}));
app.use(express.static('public'));

app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'development']
}));

// Mount all resource routes
app.use('/api/users', usersRoutes(knex));



app.get("/", (req, res) => {
  res.redirect('/lists');
});

// View User main lists page
app.get('/lists', (req, res) => {
  let ejsTemplate;
  if (req.session.user_id) {
    User.findByID(req.session.user_id)
      .then((user) => {
        ejsTemplate = user[0];
        ejsTemplate.cookie = req.session;
      });
    User.count(req.session.user_id)
      .then((catCounts) => {
        catCounts.forEach((cat) => {
          ejsTemplate[cat.cat_code] = cat.count;
        });
        res.render('index', { ejsTemplate: ejsTemplate });
      });
  } else {
    res.redirect('/login');
  }
});

// View user individual list page
app.get('/lists/:list', (req, res) => {
  let ejsTemplate;
  if (req.session.user_id) {
    User.findByID(req.session.user_id)
      .then((user) => {
        ejsTemplate = user[0];
        ejsTemplate.cookie = req.session;
      });
    User.makeList(req.session.user_id, req.params.list.toUpperCase())
      .then((list) => {
        ejsTemplate.item = [];
        list.forEach((item) => {
          ejsTemplate.item.push(item);
        });
        res.render('list_page', { ejsTemplate: ejsTemplate });
      });
  } else {
    res.redirect('/login');
  }
});

// Force a login without authentication... Yes we know, bad bad
// app.get('/login/:email', (req, res) => {
//   User.findByEmail(req.params.email)
//     .then((user) => {
//       req.session.user_id = user[0].id;
//       res.redirect('/lists');
//     });
// });

// Force a login
app.get('/login/:id', (req, res) => {
  req.session.user_id = req.params.id;
  res.redirect('/lists');
});

// View user login page
app.get('/login', (req, res) => {
  const ejsTemplate = { cookie: req.session };
  if (req.session.user_id) {
    res.redirect('/lists');
  } else {
    res.render('login', { ejsTemplate: ejsTemplate });
  }
});

// View register new user page
app.get('/register', (req, res) => {
  const ejsTemplate = { cookie: req.session };
  if (req.session.user_id) {
    res.redirect('/lists');
  } else {
    res.render('register', { ejsTemplate: ejsTemplate });
  }
});

// View user profile
app.get('/profile', (req, res) => {
  let ejsTemplate;
  if (!req.session.user_id) {
    res.redirect('/login');
  } else {
    User.findByID(req.session.user_id)
      .then((user) => {
        ejsTemplate = user[0];
        ejsTemplate.cookie = req.session;
        res.render('profile', { ejsTemplate: ejsTemplate });
      });
  }
});

// View page for editing user profile
app.get('/profile/edit', (req, res) => {
  const ejsTemplate = { cookie: req.session.user_id };
  if (!req.session.user_id) {
    res.redirect('/login');
  } else {
    res.render('profile_edit', { ejsTemplate: ejsTemplate });
  }
});


// Add new item to a list
app.post('/lists/:list', (req, res) => {
  if (req.session.user_id) {
    User.insert(req.session.user_id, req.body.itemName, req.params.list)
      .then(() => {
        res.status(201).send();
      });
  } else {
    console.log('Must be a user');
  }
});

// Change list item category
app.post('/lists/:list/:item', (req, res) => {
  if (req.session.user_id) {
    User.updateItem(req.session.user_id, req.params.item, req.params.list.toUpperCase(), req.body.newCat.toUpperCase())
      .then(() => {
        res.status(201).send();
      });
  } else {
    console.log('Must be a user');
  }
});

// Change user profile field
app.post('/profile/:user', (req, res) => {
  if (req.session.user_id) {
    User.updateUser(req.session.user_id, req.body.input, req.params.field)
      .then(() => {
        res.status(201).send();
      });
  } else {
    console.log('Must be a user');
  }
});

// // Register a new user
// app.post('/register', (req, res) => {
//   if (!req.session) {

//   }
// });

// User login page
app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

app.get('/multiple', (req, res) => {
  res.render('multiple');
});

app.listen(PORT, () => {
  console.log('listening on ', PORT);
});
