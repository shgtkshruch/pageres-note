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

var sizes = {
  'mobile': '320x480',
  'tablet': '768x1024',
  'laptop': '1366x768',
  'desktop': '1920x1080'
};

var keyword = 'web_design_evernote';
var num = 20;

evernote.getNoteMetadata({word: keyword, maxNotes: num}, function (datas) {
  if (datas.length === 0) {
    console.log(keyword, 'note not found.');
    return;
  }
  console.log("Notes number:", datas.length);
  each(datas, function (data, nextNote) {
    evernote.getNote({guid: data.guid, withContent: true}, function (note) {
      create(note, nextNote);
    });
  }, function (err) {
    if (err) throw err;
    console.log('All task done.');
  });
});

/**
 * Crate new note object
 *
 * @param {Object} fetched note from evernote
 */

function create (note, nextNote) {
  var n = {};
  var $ = cheerio.load(note.content);
  n.guid = note.guid;
  n.title = note.title.replace(/\[feedly\]/, '').trim();
  n.url = $('a').first().text();
  getTitle(n, function (title) {
    console.log('Start:', title);
    var tag = note.content.match(/tag\s((\w+\s?){1,})</);
    n.tag = tag ? tag[1].split(' ') : [];
    n.title = title;
    get(n, nextNote);
  });
}

/**
 * Get note title from web page if there is not note title
 *
 * @param {Object} it must have `title`, `url`
 * @param {Function} callback
 */

function getTitle (note, cb) {
  if (note.title === 'Mailed in note' || note.title === '無題ノート') {
    request(note.url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var $ = cheerio.load(body);
        cb($('title').text());
      }
    });
  } else {
    cb(note.title);
  }
}

/**
 * Get responsive screenshot using pageres
 *
 * @param {Object} it must have `title`, `url`, `guid`
 * @param {Object} device kind and it's screen size
 * @param {Function} callback
 */

function get (note, nextNote) {
  new Pageres({delay: 3})
    .src(note.url, _.values(sizes))
    .dest(dir)
    .run(function (err) {
      if (err) throw err;

      var width = /(\d+)x\d+(?:\-cropped)?\.png$/;
      var files = fs.readdirSync(dir).sort(function (a, b) {
        return a.match(width)[1] - b.match(width)[1];
      });
      file(files, note, nextNote);
    });
}

/**
 * Get image files from `dir` directory
 *
 * @param {Object} it must have `title`, `url`, `guid`
 * @param {Function} callback
 */

function file (files, note, nextNote) {
  var i = 0;
  each(files, function (file, nextFile) {
    var n = _.clone(note, true);
    n.width = _.values(sizes)[i].replace(/x\d+/, '');
    n.fp = dir + '/' + file;
    n.tag.push(_.keys(sizes)[i++]);
    save(n, nextFile);
  }, function (err) {
    if (err) throw err;
    remove(note, nextNote);
  });
}

/**
 * Create new note to Evernote
 *
 * @param {Object} it must have `title`, `url`, `guid`
 * @param {Function} callback
 */

function save (note, nextFile) {
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
    nextFile();
  });
}

/**
 * Delete images and note in evernote
 *
 * @param {Object} note
 * @param {callback} async callback
 */

function remove (note, nextNote) {
  rimraf(dir, function (err) {
    if (err) throw err;
    evernote.deleteNote({guid: note.guid}, function (note) {
      console.log('Delete:', note.title);
      nextNote();
    });
  });
}
