process.env.NODE_ENV = 'production';

var fs = require('fs');
var Pageres = require('pageres');
var nodeNote = require('node-note');
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

function getUrl (callback) {
  evernote.getNoteMetadata({word: 'web_design_evernote'}, function (noteMetadataList) {
    var guid = noteMetadataList[0].guid;
    evernote.getNote({guid: guid, withContent: true}, function (note) {
      var $ = cheerio.load(note.content);
      var url = $('a').attr('shape', 'rect').first().text();
      var title = $('b').first().text();
      callback(url, title);
    });
  });
}

function getPage (url, callback) {
  var pageres = new Pageres({delay: 2, crop: true})
    .src(url, _.values(sizes))
    .dest(dir);

  pageres.run(function (err) {
    if (err) {
      throw err;
    }
    callback();
  });
}

function createNote (_title, fp, url, tag, width, done) {
  var title = _title + ' (' + tag + ')';
  var options = {
    title: title,
    author: 'shgtkshruch',
    file: fp,
    url: url,
    tag: [tag],
    width: width + 'px',
    notebookName: '1511 Responsive'
  };
  evernote.createNote(options, function (note) {
    console.log('Create', title, 'note.');
    done();
  });
}

function file (url, title) {
  fs.readdir(dir, function (err, _files) {
    var reFile = /(\d+)x\d+(?:\-cropped)?\.png$/;
    var files = _files.sort(function (a, b) {
      var sizeA= a.match(reFile)[1];
      var sizeB = b.match(reFile)[1];
      return sizeA - sizeB;
    });
    async.eachSeries(files, function (file, done) {
      var width = file.match(reFile)[1];
      var fp = dir + '/' + file;
      var tag = _.findKey(sizes, function (size) {
        var re = new RegExp(width);
        return size.match(re);
      });

      createNote(title, fp, url, tag, width, done);
    }, function (err) {
      if (err) {
        throw err;
      }
      rimraf(dir, function (err) {
        if (err) {
          throw err;
        }
        console.log('Delete', dir);
      });
    });
  });
}

getUrl(function (url, title) {
  getPage(url, function () {
    file(url, title);
  });
});

