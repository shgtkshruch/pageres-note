process.env.NODE_ENV = 'production';

var crypto = require('crypto');
var Pageres = require('pageres');
var nodeNote = require('node-note');
var cheerio = require('cheerio');
var config = require('./config.json');

var evernote = new nodeNote(config);

function getUrl (callback) {
  evernote.getNoteMetadata({word: 'web_design_evernote'}, function (noteMetadataList) {
    var guid = noteMetadataList[0].guid;
    evernote.getNote({guid: guid, withContent: true}, function (note) {
      var _note = {};
      var $ = cheerio.load(note.content);
      var url = $('a').attr('shape', 'rect').first().text();
      console.log('URL:', url);

      _note.title = note.title
      _note.url = url;

      callback(_note);
    });
  });
}

function getPage (note, callback) {
  var pageres = new Pageres({delay: 2})
    .src(note.url, ['iphone 5'], {crop: true})

  pageres.run(function (err, items) {
    if (err) throw err;
    callback(note, items);
  });
}

function createNote (note, items) {
  var stream = items[0];
  var filename = stream.filename;
  var md5 = crypto.createHash('md5');
  var hex;
  md5.setEncoding('hex');

  stream.on('end', function () {
    md5.end();
    hex = md5.read();
  });
}

getUrl(function (note) {
  getPage(note, function (note, items) {
    createNote(note, items);
  });
});
