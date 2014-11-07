process.env.NODE_ENV = 'production';

var fs = require('fs');
var Pageres = require('pageres');
var nodeNote = require('node-note');
var cheerio = require('cheerio');
var rimraf = require('rimraf');
var config = require('./config.json');

var evernote = new nodeNote(config);

var sizes = ['320x480', '768x1024', '1366x768', '1920x1080'];
var tags = ['mobile', 'tablet', 'laptop', 'desktop'];
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
  var pageres = new Pageres({delay: 2})
    .src(url, sizes)
    .dest(dir);

  pageres.run(function (err) {
    if (err) throw err;
    callback();
  });
}

function createNote (_title, file, url, tag) {
  var title = _title + ' (' + tag + ')';
  var options = {
    title: title,
    author: 'shgtkshruch',
    file: file,
    url: url,
    tag: [tag],
    notebookName: '1511 Responsive'
  }
  evernote.createNote(options, function (note) {
    console.log('Create', title, 'note.');
  });
}

getUrl(function (url, title) {
  getPage(url, function () {
    fs.readdir(dir, function (err, files) {
      var files = files.sort(function (a, b) {
        var re = /\-(\d+)x.+\.png$/;
        var a = a.match(re);
        var b = b.match(re);
        return a[1] - b[1];
      });
      files.forEach(function (file, i) {
        var file = dir + '/' + file;
        createNote(title, file, url, tags[i]);
      });
      // rimraf(dir, function () {
      //   console.log('delete', dir);
      // });
    });
  });
});

