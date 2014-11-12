process.env.NODE_ENV = 'production';

var fs = require('fs');
var nodeNote = require('node-note');
var Pageres = require('pageres');
var _ = require('lodash');
var each = require('async').eachSeries;
var cheerio = require('cheerio');
var request = require('request');
var rimraf = require('rimraf');
var config = require('./config.json');

var evernote = new nodeNote(config);
var dir = __dirname + '/images';

// configuration
var sizes = {
  'mobile': '320x480',
  'tablet': '768x1024',
  'laptop': '1366x768',
  'desktop': '1920x1080'
};

var keyword = 'web_design_evernote';

/**
 * Get note ooject from Evernote
 *
 * @param {String} search evernote by this
 * @param {Number} max number of return note
 * @param {Function} callback
 */

function fetch (keyword, maxNotes, cb) {
  var notes = [];
  evernote.getNoteMetadata({word: keyword, maxNotes: maxNotes}, function (datas) {
    each(datas, function (data, done) {
      evernote.getNote({guid: data.guid, withContent: true}, function (note) {
        create(notes, note, done);
      });
    }, function (err) {
      if (err) throw err;
      cb(notes);
    });
  });
}

function create (notes, note, next) {
  var n = {};
  var $ = cheerio.load(note.content);
  var tag = note.content.match(/tag\s((\w+\s?){1,})</);

  n.url = $('a').first().text();
  n.guid = note.guid;
  n.title = note.title.replace(/\[feedly\]/, '').trim();
  n.tag = tag ? tag[1].split(' ') : [];
  getTitle(n, function (title) {
    n.title = title;
    notes.push(n);
    next();
  });
}

/**
 * Get note title from web page if there is not note title
 *
 * @param {Object} it must have `title`, `url`
 * @param {Function} callback
 */

function getTitle (note, cb) {
  if (note.title !== 'Mailed in note') {
    cb(note.title);
  } else {
    request(note.url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var $ = cheerio.load(body);
        cb($('title').text());
      }
    });
  }
}

/**
 * Get responsive screenshot using pageres
 *
 * @param {Object} it must have `title`, `url`, `guid`
 * @param {Object} device kind and it's screen size
 * @param {Function} callback
 */

function get (note, sizes, next) {
  new Pageres({delay: 2})
    .src(note.url, _.values(sizes))
    .dest(dir)
    .run(function (err) {
      if (err) throw err;

      var width = /(\d+)x\d+(?:\-cropped)?\.png$/;
      var files = fs.readdirSync(dir).sort(function (a, b) {
        return a.match(width)[1] - b.match(width)[1];
      });
      file(files, note, next);
    });
}

/**
 * Get image files from `dir` directory
 *
 * @param {Object} it must have `title`, `url`, `guid`
 * @param {Function} callback
 */

function file (files, note, next) {
  var i = 0;
  each(files, function (file, nextFile) {
    var n = _.clone(note, true);
    n.width = _.values(sizes)[i].replace(/x\d+/, '');
    n.fp = dir + '/' + file;
    n.tag.push(_.keys(sizes)[i++]);
    save(n, nextFile);
  }, function (err) {
    if (err) throw err;
    remove(note, next);
  });
}

/**
 * Create new note to Evernote
 *
 * @param {Object} it must have `title`, `url`, `guid`
 * @param {Function} callback
 */

function save (note, done) {
  var options = {
    title: note.title + ' (' + _.last(note.tag) + ')',
    file: note.fp,
    url: note.url,
    tag: note.tag,
    width: note.width + 'px',
    notebookName: '1511 Responsive',
    author: 'shgtkshruch'
  };
  evernote.createNote(options, function (note) {
    console.log('Create', options.title, 'note.');
    done();
  });
}

/**
 * Delete images and note in evernote
 *
 * @param {Object} note
 * @param {callback} async callback
 */

function remove (note, done) {
  rimraf(dir, function (err) {
    if (err) throw err;
    evernote.deleteNote({guid: note.guid}, function (note) {
      console.log('Delete note:', note.title);
      done();
    });
  });
}

fetch(keyword, 50, function (notes) {
  console.log("Notes number:", notes.length);
  each(notes, function (note, next) {
    console.log('Start:', note.title);
    get(note, sizes, next);
  }, function (err) {
    if (err) throw err;
    console.log('All task done.');
  });
});
