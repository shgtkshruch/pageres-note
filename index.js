process.env.NODE_ENV = 'production';

var fs = require('fs');
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
      var note = {};
      note.guid = metadata.guid;
      evernote.getNote({guid: note.guid, withContent: true}, function (_note) {
        var $ = cheerio.load(_note.content);
        note.url = $('a').attr('shape', 'rect').first().text();
        note.title = $('b').first().text();
        notes.push(note);
        done();
      });
    }, function (err) {
      if (err) {
        throw err;
      }
      cb(notes);
    });
  });
}

/**
 * Get responsive screenshot using pageres
 *
 * @param {Object} it must have `title`, `url`, `guid`
 * @param {Object} device kind and it's screen size
 * @param {Function} callback
 */

function getScreenshot (note, sizes, done) {
  var pageres = new Pageres({delay: 2})
    .src(note.url, _.values(sizes))
    .dest(dir);

  pageres.run(function (err) {
    if (err) {
      throw err;
    }
    file(note, done);
  });
}

/**
 * Get image files from `dir` directory
 *
 * @param {Object} it must have `title`, `url`, `guid`
 * @param {Function} callback
 */

function file (note, done) {
  fs.readdir(dir, function (err, _files) {
    var reFile = /(\d+)x\d+(?:\-cropped)?\.png$/;
    var files = _files.sort(function (a, b) {
      var sizeA= a.match(reFile)[1];
      var sizeB = b.match(reFile)[1];
      return sizeA - sizeB;
    });
    async.eachSeries(files, function (file, _done) {
      note.width = file.match(reFile)[1];
      note.fp = dir + '/' + file;
      note.tag = _.findKey(sizes, function (size) {
        var re = new RegExp(note.width);
        return size.match(re);
      });

      createNote(note, _done);
    }, function (err) {
      if (err) {
        throw err;
      }
      rimraf(dir, function (err) {
        if (err) {
          throw err;
        }
        evernote.deleteNote({title: note.title, guid: note.guid}, function (note) {
          console.log('Delete note:', note.title);
          done();
        });
      });
    });
  });
}

/**
 * Create new note to Evernote
 *
 * @param {Object} it must have `title`, `url`, `guid`
 * @param {Function} callback
 */

function createNote (note, _done) {
  var title = note.title + ' (' + note.tag + ')';
  var options = {
    title: title,
    author: 'shgtkshruch',
    file: note.fp,
    url: note.url,
    tag: [note.tag],
    width: note.width + 'px',
    notebookName: notebookName
  };
  evernote.createNote(options, function (note) {
    console.log('Create', title, 'note.');
    _done();
  });
}


getNotes(keyword, 50, function (notes) {
  async.eachSeries(notes, function (note, done) {
    console.log('Start:', note.title);
    getScreenshot(note, sizes, done);
  }, function (err) {
    if (err) {
      throw err;
    }
    console.log('All task done.');
  });
});

