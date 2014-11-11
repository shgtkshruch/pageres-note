process.env.NODE_ENV = 'production';

var fs = require('fs');
var http = require('http');
var nodeNote = require('node-note');
var Pageres = require('pageres');
var _ = require('lodash');
var async = require('async');
var cheerio = require('cheerio');
var rimraf = require('rimraf');
var config = require('./config.json');

var evernote = new nodeNote(config);

var sizes = {
  'mobile': '320x480',
  'tablet': '768x1024',
  'laptop': '1366x768',
  'desktop': '1920x1080'
};
var dir = __dirname + '/images';
var keyword = 'web_design_evernote';
var notebookName = '1511 Responsive';

/**
 * Get note ooject from Evernote
 *
 * @param {String} search evernote by this
 * @param {Number} max number of return note
 * @param {Function} callback
 */

function getNotes (keyword, maxNotes, cb) {
  var notes = [];
  evernote.getNoteMetadata({word: keyword, maxNotes: maxNotes}, function (noteMetadataList) {
    async.each(noteMetadataList, function (metadata, done) {
      evernote.getNote({guid: metadata.guid, withContent: true}, function (note) {
        createNotes(notes, note, done);
      });
    }, function (err) {
      if (err) throw err;
      cb(notes);
    });
  });
}

function createNotes (notes, note, next) {
  var resNote = {};
  var $ = cheerio.load(note.content);
  resNote.guid = note.guid;
  resNote.url = $('a').first().text();
  resNote.title = note.title.replace(/\[feedly\]/, '').trim();
  var tag = note.content.match(/tag\s((\w+\s?){1,})</);
  resNote.tag = tag ? tag[1].split(' ') : [];
  getTitle(resNote, function (title) {
    resNote.title = title;
    notes.push(resNote);
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
  if (note.title !== '無題ノート') {
    cb(note.title);
  } else {

    http.get(note.url, function (res) {
      var data;

      res.on('data', function (chunk) {
        data += chunk;
      });

      res.on('end', function () {
        var $ = cheerio.load(data);
        cb($('title').text());
      });
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

function getScreenshot (note, sizes, next) {
  var pageres = new Pageres({delay: 2})
    .src(note.url, _.values(sizes))
    .dest(dir);

  pageres.run(function (err) {
    if (err) throw err;
    file(note, next);
  });
}

/**
 * Get image files from `dir` directory
 *
 * @param {Object} it must have `title`, `url`, `guid`
 * @param {Function} callback
 */

function file (note, next) {
  fs.readdir(dir, function (err, _files) {
    var reFile = /(\d+)x\d+(?:\-cropped)?\.png$/;
    var files = _files.sort(function (a, b) {
      var sizeA= a.match(reFile)[1];
      var sizeB = b.match(reFile)[1];
      return sizeA - sizeB;
    });
    createNoteFrom(note, files, next);
  });
}

/**
 * Pass file to createNote method
 *
 * @param {Array} files array
 */

function createNoteFrom (note, files, next) {
  var i = 0;
  async.eachSeries(files, function (file, nextFile) {
    var newNote = _.clone(note, true);
    newNote.width = _.values(sizes)[i++].replace(/x\d+/, '');
    newNote.fp = dir + '/' + file;
    newNote.tag.push(_.findKey(sizes, function (size) {
      var re = new RegExp(newNote.width);
      return size.match(re);
    }));
    createNote(newNote, nextFile);
  }, function (err) {
      if (err) throw err;
      deleteResource(note, next);
  });
}

/**
 * Create new note to Evernote
 *
 * @param {Object} it must have `title`, `url`, `guid`
 * @param {Function} callback
 */

function createNote (note, nextFile) {
  var title = note.title + ' (' + _.last(note.tag) + ')';
  var options = {
    title: title,
    author: 'shgtkshruch',
    file: note.fp,
    url: note.url,
    tag: note.tag,
    width: note.width + 'px',
    notebookName: notebookName
  };
  evernote.createNote(options, function (note) {
    console.log('Create', title, 'note.');
    nextFile();
  });
}

/**
 * Delete images and note in evernote
 *
 * @param {Object} note
 * @param {callback} async callback
 */

function deleteResource (note, done) {
  rimraf(dir, function (err) {
    if (err) throw err;
    evernote.deleteNote({guid: note.guid}, function (note) {
      console.log('Delete note:', note.title);
      done();
    });
  });
}


getNotes(keyword, 50, function (notes) {
  console.log("Notes number:", notes.length);
  async.eachSeries(notes, function (note, next) {
    console.log('Start:', note.title);
    getScreenshot(note, sizes, next);
  }, function (err) {
    if (err) throw err;
    console.log('All task done.');
  });
});

